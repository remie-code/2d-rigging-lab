// @ts-check
/**
 * ElevenLabs リアルタイム STT 用の fake WebSocket（機械テスト専用）— apps/soul/agent。
 *
 * elevenlabs-stt.mjs が使う標準 WebSocket の面（constructor(url, { headers }) / addEventListener /
 * send / close / readyState）だけを持つ in-process の替え玉。実ネットワークには一切出ない。
 * テストは `createFakeWebSocketClass()` が返す `sockets`（生成順）を見て、サーバー側の振る舞い
 * （session_started・commit・auth_error・切断）を手で起こす。
 */

/**
 * @returns {{
 *   FakeWebSocket: any;
 *   sockets: Array<any>;
 *   last: () => any;
 * }}
 */
export function createFakeWebSocketClass() {
  /** @type {Array<any>} */
  const sockets = [];

  class FakeWebSocket {
    /**
     * @param {string} url
     * @param {{ headers?: Record<string, string> }} [init]
     */
    constructor(url, init) {
      this.url = url;
      this.headers = (init && init.headers) || {};
      this.readyState = 0; // CONNECTING
      /** @type {string[]} */
      this.sent = [];
      /** @type {number | null} */
      this.closedByClientCode = null;
      /** @type {Map<string, Set<Function>>} */
      this.listeners = new Map();
      sockets.push(this);
    }

    /** @param {string} type @param {Function} fn */
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      /** @type {Set<Function>} */ (this.listeners.get(type)).add(fn);
    }

    /** @param {string} type @param {any} ev */
    emit(type, ev) {
      for (const fn of this.listeners.get(type) ?? []) fn(ev);
    }

    /** @param {string} data */
    send(data) {
      if (this.readyState !== 1) throw new Error("fake ws: not open");
      this.sent.push(data);
    }

    /** @param {number} [code] */
    close(code) {
      if (this.readyState === 3) return;
      this.closedByClientCode = code ?? 1005;
      this.readyState = 3;
      this.emit("close", { code: code ?? 1005, reason: "" });
    }

    // ── サーバー側の振る舞い（テストから呼ぶ）──
    serverOpen() {
      this.readyState = 1;
      this.emit("open", {});
    }
    /** @param {object} message */
    serverSend(message) {
      this.emit("message", { data: JSON.stringify(message) });
    }
    serverSessionStarted() {
      this.serverOpen();
      this.serverSend({ message_type: "session_started", session_id: "fake", config: {} });
    }
    /** @param {string} text */
    serverCommit(text) {
      this.serverSend({ message_type: "committed_transcript", text });
    }
    /** @param {number} [code] @param {string} [reason] */
    serverClose(code = 1006, reason = "") {
      if (this.readyState === 3) return;
      this.readyState = 3;
      this.emit("close", { code, reason });
    }
    /** 送られた input_audio_chunk を解いた一覧。 */
    sentChunks() {
      return this.sent.map((s) => JSON.parse(s));
    }
  }

  return { FakeWebSocket, sockets, last: () => sockets[sockets.length - 1] };
}

/**
 * 決定論の手動タイマ（setTimeoutImpl/clearTimeoutImpl の替え玉）。`runNext()` で予約順に 1 本ずつ走らせる
 * （実時間は待たない）。
 * @returns {{ setTimeoutImpl: any; clearTimeoutImpl: any; pending: () => Array<{ id: number; ms: number }>; runNext: () => boolean }}
 */
export function createManualTimers() {
  let nextId = 1;
  /** @type {Map<number, { fn: Function; ms: number }>} */
  const timers = new Map();
  return {
    setTimeoutImpl: (/** @type {Function} */ fn, /** @type {number} */ ms) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeoutImpl: (/** @type {number} */ id) => {
      timers.delete(id);
    },
    pending: () => [...timers.entries()].map(([id, t]) => ({ id, ms: t.ms })),
    /** 最初に予約されたタイマを 1 本走らせる（無ければ false）。 */
    runNext() {
      const first = [...timers.entries()][0];
      if (!first) return false;
      timers.delete(first[0]);
      first[1].fn();
      return true;
    }
  };
}
