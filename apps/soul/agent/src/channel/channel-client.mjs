// @ts-check
/**
 * 操縦チャネルクライアント（S1 Domain B）— apps/soul/agent。
 *
 * 器（runtime-player）の Control Channel へ WebSocket で接続し、intent.speech を送る薄い
 * クライアント。参照ドライバ `apps/soul/reference-driver/reference-driver.mjs` の connect /
 * sendSpeech を**写経**したもの（依存ゼロ・Node 組み込み `WebSocket`・器コードは import しない・
 * 会話は WS 越しのみ）。C6 で確立した作法をそのまま踏襲する:
 *
 *   1. open → `server.hello` を 4 秒待つ（不着は throw）。
 *   2. hello.payload.supportedKinds に `intent.speech` があるか照合（無ければ throw）。
 *   3. `{ v:1, id, kind:"intent.speech", payload:{ timeline } }` を送り、`replyTo` 相関で
 *      accepted/rejected を受ける（4 秒タイムアウト）。
 *   4. server.hello / replyTo を持つ応答 / それ以外＝未知イベントは黙殺（寛容規則 §3.5）。
 *   5. url の token はログ・レポートで redact する。
 *
 * intent.set / intent.envelope は Domain B の役目ではないので写経しない（発話特化）。
 * 契約の正は `apps/runtime-player/src/main/control-channel/contract/channel-exchange-examples.json`
 * の speechPath / server.hello / rejections。
 */

import { performance } from "node:perf_hooks";

const HELLO_TIMEOUT_MS = 4000;
const REPLY_TIMEOUT_MS = 4000;

/**
 * 1 本の接続を張り、server.hello を照合し、intent.speech を送るハンドルを返す。
 * @param {string} url  `ws://127.0.0.1:<port>/channel?token=<token>`。
 * @param {object} [options]
 * @param {typeof WebSocket} [options.WebSocketImpl]  WebSocket の差し替え（既定 globalThis.WebSocket）。
 * @param {string[]} [options.requiredKinds]  hello に必須の supportedKinds（既定 ["intent.speech"]）。
 * @param {number} [options.helloTimeoutMs]  hello 待ち（既定 4000）。
 * @param {number} [options.replyTimeoutMs]  応答待ち（既定 4000）。
 * @returns {Promise<{
 *   sendSpeech: (timeline: unknown) => Promise<{ result: string; error: unknown; rttMs: number }>;
 *   close: () => Promise<void>;
 *   consumeUnknownEventCount: () => number;
 *   supportedKinds: string[];
 * }>}
 */
export async function connectChannel(url, options = {}) {
  const WebSocketImpl = options.WebSocketImpl ?? globalThis.WebSocket;
  if (typeof WebSocketImpl !== "function") {
    throw new TypeError("no WebSocket implementation available (pass options.WebSocketImpl).");
  }
  const requiredKinds = options.requiredKinds ?? ["intent.speech"];
  const helloTimeoutMs = options.helloTimeoutMs ?? HELLO_TIMEOUT_MS;
  const replyTimeoutMs = options.replyTimeoutMs ?? REPLY_TIMEOUT_MS;

  const socket = new WebSocketImpl(url);
  const pending = new Map(); // id -> { resolve, reject, t0 }
  let helloPayload = null;
  let helloResolve;
  let helloReject;
  const helloPromise = new Promise((resolve, reject) => {
    helloResolve = resolve;
    helloReject = reject;
  });
  let unknownEventCount = 0;
  let idCounter = 0;

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      // 非 JSON = 未知イベント → 黙殺（寛容規則 §3.5）。
      unknownEventCount += 1;
      return;
    }

    if (message && message.kind === "server.hello") {
      helloPayload = message.payload ?? null;
      helloResolve();
      return;
    }

    if (message && typeof message.replyTo === "string") {
      const waiter = pending.get(message.replyTo);
      if (waiter === undefined) {
        // 相関先の無い応答 = 未知イベント扱いで黙殺。
        unknownEventCount += 1;
        return;
      }
      pending.delete(message.replyTo);
      waiter.resolve({
        result: message.result,
        error: message.error ?? null,
        rttMs: performance.now() - waiter.t0
      });
      return;
    }

    // それ以外の未知 kind のサーバイベントは無視する義務（クライアント側の寛容規則 §3.5）。
    unknownEventCount += 1;
  });

  const closedError = new Error("Control Channel socket closed unexpectedly.");
  socket.addEventListener("close", () => {
    helloReject(closedError);
    for (const waiter of pending.values()) {
      waiter.reject(closedError);
    }
    pending.clear();
  });
  socket.addEventListener("error", () => {
    helloReject(new Error("Control Channel socket error."));
  });

  await withTimeout(waitForOpen(socket), helloTimeoutMs, "socket open");
  await withTimeout(helloPromise, helloTimeoutMs, "server.hello");

  // capabilities 照合: 契約の supportedKinds を hello が満たすか。
  const supported = new Set(helloPayload?.supportedKinds ?? []);
  const missing = requiredKinds.filter((kind) => !supported.has(kind));
  if (missing.length > 0) {
    throw new Error(
      `server.hello is missing required supportedKinds: ${missing.join(", ")}`
    );
  }

  return {
    /**
     * intent.speech を 1 本送り、replyTo 相関で accepted/rejected を受ける。
     * @param {unknown} timeline  buildSpeechTimeline の返り timeline（`{timeMs,vowel,s}[]`）。
     * @returns {Promise<{ result: string; error: unknown; rttMs: number }>}
     */
    sendSpeech(timeline) {
      const id = `req-${(idCounter += 1)}`;
      const payload = { timeline };
      const t0 = performance.now();
      const settled = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, t0 });
      });
      socket.send(JSON.stringify({ v: 1, id, kind: "intent.speech", payload }));
      return withTimeout(settled, replyTimeoutMs, "speech reply");
    },
    consumeUnknownEventCount() {
      const count = unknownEventCount;
      unknownEventCount = 0;
      return count;
    },
    supportedKinds: [...supported],
    async close() {
      if (
        socket.readyState === WebSocketImpl.CLOSED ||
        socket.readyState === WebSocketImpl.CLOSING
      ) {
        return;
      }
      const closed = new Promise((resolve) => {
        socket.addEventListener("close", () => resolve(), { once: true });
      });
      socket.close();
      await withTimeout(closed, replyTimeoutMs, "socket close");
    }
  };
}

function waitForOpen(socket) {
  if (socket.readyState === socket.OPEN) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Control Channel socket failed to open.")),
      { once: true }
    );
  });
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${ms}ms waiting for ${label}`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * url の token クエリを `<redacted>` に伏せる（ログ・レポート用。写経元 reference-driver）。
 * @param {string} url
 * @returns {string}
 */
export function redactToken(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("token")) {
      parsed.searchParams.set("token", "<redacted>");
    }
    return parsed.toString();
  } catch {
    return "<unparseable-url>";
  }
}
