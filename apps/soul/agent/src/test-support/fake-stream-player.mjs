// @ts-check
/**
 * 無音の流し込みプレイヤーの代役（声の差し替え Wave 2 のテスト用）— apps/soul/agent。
 *
 * `createStreamPlayer`（stream-player.mjs）の Node API と同じ形（open/write/end/stop/onEvent）を持ち、
 * 呼ばれた操作を記録するだけ。STARTED/ENDED/STOPPED は `emit()` で手で流すか、`autoStart` / `autoEnd` で
 * 自動にする（マイクロタスクで流す）。今の発話でない id の write/end は本物と同じく false を返す。
 * 実際に音は出さない（機械テスト無音の絶対規律）。
 */

/**
 * @param {object} [options]
 * @param {boolean} [options.autoStart=false]  最初の write の後に STARTED を流す。
 * @param {boolean} [options.autoEnd=false]  end の後に ENDED を流す（音があれば先に STARTED）。
 * @param {() => number} [options.nowImpl]  事象の atMs（既定 Date.now）。
 */
export function createFakeStreamPlayer(options = {}) {
  const now = options.nowImpl ?? Date.now;
  /** @type {Set<(event: any) => void>} */
  const listeners = new Set();
  /** @type {Array<{ op: string; id?: string; format?: any; bytes?: number }>} */
  const calls = [];
  /** @type {string[]} */
  const opened = [];
  /** @type {null | { id: string; started: boolean; endSent: boolean; bytes: number }} */
  let current = null;
  let stops = 0;

  /** @param {Record<string, unknown>} event */
  const emitNow = (event) => {
    const full = { atMs: now(), ...event };
    for (const listener of [...listeners]) listener(full);
  };

  return {
    calls,
    /** open された発話 id（順）。 */
    opened,
    get stops() {
      return stops;
    },
    /** @param {string} id @param {{ sampleRate: number; channels: number }} format */
    open(id, format) {
      calls.push({ op: "open", id, format });
      opened.push(id);
      current = { id, started: false, endSent: false, bytes: 0 };
    },
    /** @param {string} id @param {Uint8Array} pcm */
    write(id, pcm) {
      calls.push({ op: "write", id, bytes: pcm.byteLength });
      if (current == null || current.id !== id || current.endSent) return false;
      current.bytes += pcm.byteLength;
      if (options.autoStart && !current.started) {
        const target = current;
        target.started = true;
        queueMicrotask(() => emitNow({ type: "started", id }));
      }
      return true;
    },
    /** @param {string} id */
    end(id) {
      calls.push({ op: "end", id });
      if (current == null || current.id !== id || current.endSent) return false;
      current.endSent = true;
      if (options.autoEnd) {
        const target = current;
        queueMicrotask(() => {
          if (target.bytes > 0 && !target.started) {
            target.started = true;
            emitNow({ type: "started", id });
          }
          queueMicrotask(() => {
            if (current === target) current = null;
            emitNow({ type: "ended", id });
          });
        });
      }
      return true;
    },
    stop() {
      stops += 1;
      calls.push({ op: "stop" });
      const id = current?.id ?? null;
      current = null;
      queueMicrotask(() => emitNow({ type: "stopped", id }));
    },
    /** @param {(event: any) => void} listener */
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * 事象を手で流す（同期）。
     * @param {"started" | "ended" | "stopped" | "error" | "exit"} type
     * @param {string | null} [id]
     * @param {Record<string, unknown>} [extra]
     */
    emit(type, id = current?.id ?? null, extra = {}) {
      if (type === "ended" && current?.id === id) current = null;
      emitNow({ type, id, ...extra });
    },
    /** n 番目に open された発話の事象を流す。 @param {"started" | "ended" | "stopped" | "error"} type @param {number} index */
    emitFor(type, index) {
      const id = opened[index];
      if (id === undefined) throw new Error(`no opened utterance at index ${index}`);
      if (type === "ended" && current?.id === id) current = null;
      emitNow({ type, id, ...(type === "error" ? { message: "fake" } : {}) });
    },
    listenerCount: () => listeners.size,
    whenReady: () => Promise.resolve(true),
    isAlive: () => true,
    dispose() {
      listeners.clear();
      current = null;
    }
  };
}
