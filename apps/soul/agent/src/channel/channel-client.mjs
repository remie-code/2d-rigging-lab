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
 *   2. hello.payload.supportedKinds に必須 kind（既定 `intent.speech` + `intent.envelope`）が
 *      あるか照合（無ければ throw）。
 *   3. `{ v:1, id, kind:"intent.speech"|"intent.envelope", payload }` を送り、`replyTo` 相関で
 *      accepted/rejected を受ける（4 秒タイムアウト）。
 *   4. server.hello / replyTo を持つ応答 / それ以外＝未知イベントは黙殺（寛容規則 §3.5）。
 *   5. url の token はログ・レポートで redact する。
 *
 * ── S4: intent.envelope の追加（表情演出の送出路）─────────────────────────────
 *  sendEnvelope を参照ドライバ `reference-driver.mjs` の sendEnvelope から写経して足す
 *  （payload `{ slotId, peak, attackMs, sustainMs, decayMs }`・replyTo 相関は sendSpeech と同型）。
 *  併せて既定 requiredKinds に `intent.envelope` を加える（器は C5 から additively 広告済み＝
 *  常に intent.set/envelope/speech の 3 種を出す）。これで envelope 非対応の相手には**接続時に
 *  fail-fast**（表情が黙って無視される事故を封じる・裁定済みの意図変更／domain-a.md）。
 *
 * ── S6: intent.set の追加（barge-in の口閉じ送出路）───────────────────────────
 *  sendSet を参照ドライバ `reference-driver.mjs` の sendIntent から写経して足す（payload
 *  `{ slotId, value, ttlMs? }`・replyTo 相関は sendSpeech/sendEnvelope と同型）。barge-in で
 *  mouth-open へ value=0 を着弾させ speech タイムラインを強制 release（口を閉じる）ために使う
 *  （inventory §2・器コード/契約 JSON は不変＝器は C5 から intent.set を広告済み・送出路を魂側に
 *  足すだけ）。**既定 requiredKinds は変えない**（intent.set 非広告の相手でも接続は張れる＝口閉じは
 *  best-effort・S1〜S5 の接続契約に無影響）。
 *
 * 契約の正は `apps/runtime-player/src/main/control-channel/contract/channel-exchange-examples.json`
 * の speechPath / envelopePath / server.hello / rejections。
 */

import { performance } from "node:perf_hooks";

const HELLO_TIMEOUT_MS = 4000;
const REPLY_TIMEOUT_MS = 4000;
// A generous circuit breaker for corrupted/runaway speech envelopes, not a
// normal sentence-size limit. The previous 4 KiB cap rejected an observed,
// otherwise valid 4,149-byte Japanese sentence, so both channel endpoints use
// 64 KiB while preserving local preflight and clean partial-delivery recovery.
const SPEECH_ENVELOPE_UTF8_CAP = 64 * 1024;

/**
 * 1 本の接続を張り、server.hello を照合し、intent.speech を送るハンドルを返す。
 * @param {string} url  `ws://127.0.0.1:<port>/channel?token=<token>`。
 * @param {object} [options]
 * @param {typeof WebSocket} [options.WebSocketImpl]  WebSocket の差し替え（既定 globalThis.WebSocket）。
 * @param {string[]} [options.requiredKinds]  hello に必須の supportedKinds
 *   （既定 ["intent.speech", "intent.envelope"]＝発話 + 表情演出。器は C5 から両方を広告済み）。
 * @param {number} [options.helloTimeoutMs]  hello 待ち（既定 4000）。
 * @param {number} [options.replyTimeoutMs]  応答待ち（既定 4000）。
 * @param {(event: string, fields?: Record<string, unknown>) => void} [options.onTrace]
 *   Passive local diagnostics hook. It receives no payload/body text.
 * @param {number} [options.connectionGeneration] lazy connection generation for correlation.
 * @returns {Promise<{
 *   sendSpeech: (timeline: unknown) => Promise<{ result: string; error: unknown; rttMs: number; requestId: string; serializedUtf8Bytes: number }>;
 *   sendEnvelope: (intent: { slotId: string; peak: number; attackMs: number; sustainMs: number; decayMs: number }) => Promise<{ result: string; error: unknown; rttMs: number }>;
 *   sendSet: (intent: { slotId: string; value: number; ttlMs?: number }) => Promise<{ result: string; error: unknown; rttMs: number }>;
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
  const requiredKinds = options.requiredKinds ?? ["intent.speech", "intent.envelope"];
  const helloTimeoutMs = options.helloTimeoutMs ?? HELLO_TIMEOUT_MS;
  const replyTimeoutMs = options.replyTimeoutMs ?? REPLY_TIMEOUT_MS;
  const onTrace = options.onTrace;
  const connectionGeneration = options.connectionGeneration ?? 0;
  const trace = (event, fields = {}) => {
    if (typeof onTrace !== "function") return;
    try {
      onTrace(event, { connectionGeneration, ...fields });
    } catch {
      // Passive diagnostics must never alter Control Channel behavior.
    }
  };

  const socket = new WebSocketImpl(url);
  const connectionStartedAt = performance.now();
  trace("channel.connect.started");
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
      const outcome = {
        result: message.result,
        error: message.error ?? null,
        rttMs: performance.now() - waiter.t0,
        ...(waiter.kind === "intent.speech"
          ? { requestId: message.replyTo, serializedUtf8Bytes: waiter.serializedUtf8Bytes }
          : {})
      };
      trace("channel.request.reply", {
        requestId: message.replyTo,
        kind: waiter.kind,
        result: typeof message.result === "string" ? message.result : null,
        errorCode:
          outcome.error && typeof outcome.error === "object" && typeof outcome.error.code === "string"
            ? outcome.error.code
            : null,
        rttMs: outcome.rttMs
      });
      waiter.resolve(outcome);
      return;
    }

    // それ以外の未知 kind のサーバイベントは無視する義務（クライアント側の寛容規則 §3.5）。
    unknownEventCount += 1;
  });

  const closedError = diagnosticError("Control Channel socket closed unexpectedly.", "channel_closed", "control_channel.close");
  socket.addEventListener("close", () => {
    trace("channel.close");
    helloReject(closedError);
    for (const waiter of pending.values()) {
      waiter.reject(closedError);
    }
    pending.clear();
  });
  socket.addEventListener("error", () => {
    trace("channel.socket.error");
    helloReject(diagnosticError("Control Channel socket error.", "channel_socket_error", "control_channel.socket"));
  });

  await withTimeout(waitForOpen(socket), helloTimeoutMs, "socket open", "channel_open_timeout", "control_channel.open_timeout");
  trace("channel.opened");
  await withTimeout(helloPromise, helloTimeoutMs, "server.hello", "server_hello_timeout", "control_channel.hello_timeout");

  // capabilities 照合: 契約の supportedKinds を hello が満たすか。
  const supported = new Set(helloPayload?.supportedKinds ?? []);
  const missing = requiredKinds.filter((kind) => !supported.has(kind));
  if (missing.length > 0) {
    throw new Error(
      `server.hello is missing required supportedKinds: ${missing.join(", ")}`
    );
  }
  trace("channel.hello", { supportedKindCount: supported.size, durationMs: performance.now() - connectionStartedAt });

  const sendRequest = (kind, payload, label, extra = {}) => {
    const id = `req-${(idCounter += 1)}`;
    const envelope = { v: 1, id, kind, payload };
    const serialized = JSON.stringify(envelope);
    const serializedUtf8Bytes = Buffer.byteLength(serialized, "utf8");
    // Preflight the exact text that would be passed to socket.send().  Do this
    // before registering a pending reply: oversize is local, never reaches the
    // Runtime, and must not make this otherwise healthy connection unusable.
    if (kind === "intent.speech" && serializedUtf8Bytes > SPEECH_ENVELOPE_UTF8_CAP) {
      const failure = diagnosticError(
        `intent.speech envelope is ${serializedUtf8Bytes} UTF-8 bytes; safety cap is ${SPEECH_ENVELOPE_UTF8_CAP}.`,
        "speech_envelope_oversize",
        "control_channel.preflight"
      );
      trace("channel.request.preflight_rejected", {
        requestId: id,
        kind,
        serializedUtf8Bytes,
        configuredUtf8Cap: SPEECH_ENVELOPE_UTF8_CAP,
        ...extra,
        failureCode: failure.code
      });
      throw failure;
    }
    const t0 = performance.now();
    const settled = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, t0, kind, serializedUtf8Bytes });
    });
    trace("channel.request.send", {
      requestId: id,
      kind,
      serializedUtf8Bytes,
      ...extra
    });
    try {
      socket.send(serialized);
    } catch (error) {
      pending.delete(id);
      const failure = withDiagnostic(error, "channel_send_failed", "control_channel.send");
      trace("channel.request.send_failed", { requestId: id, kind, failureName: failure.name, failureCode: failure.code });
      throw failure;
    }
    return withTimeout(settled, replyTimeoutMs, label, "reply_timeout", "control_channel.reply_timeout").catch((error) => {
      // A close/timeout can mean Runtime accepted the request but its reply was
      // lost. Do not leave it eligible for a late reply and, critically, do not
      // retry here: the caller gets one explicit ambiguous failure instead.
      pending.delete(id);
      const failure = /** @type {any} */ (error);
      trace("channel.request.failed", {
        requestId: id,
        kind,
        failureName: failure instanceof Error ? failure.name : typeof failure,
        failureCode: typeof failure?.code === "string" ? failure.code : null,
        failureStage: typeof failure?.diagnosticStage === "string" ? failure.diagnosticStage : "control_channel.reply"
      });
      throw failure;
    });
  };

  return {
    /**
     * intent.speech を 1 本送り、replyTo 相関で accepted/rejected を受ける。
     * @param {unknown} timeline  buildSpeechTimeline の返り timeline（`{timeMs,vowel,s}[]`）。
     * @returns {Promise<{ result: string; error: unknown; rttMs: number; requestId: string; serializedUtf8Bytes: number }>}
     */
    async sendSpeech(timeline) {
      const payload = { timeline };
      return sendRequest("intent.speech", payload, "speech reply", {
        timelineCount: Array.isArray(timeline) ? timeline.length : null
      });
    },
    /**
     * intent.envelope を 1 本送り、replyTo 相関で accepted/rejected を受ける（S4 表情演出）。
     * 写経元 reference-driver.sendEnvelope。payload は器契約
     * `{ slotId, peak, attackMs, sustainMs, decayMs }`（ms・合計 > 0・peak は域内でクランプなし拒否）。
     * @param {{ slotId: string; peak: number; attackMs: number; sustainMs: number; decayMs: number }} intent
     * @returns {Promise<{ result: string; error: unknown; rttMs: number }>}
     */
    sendEnvelope(intent) {
      const payload = {
        slotId: intent.slotId,
        peak: intent.peak,
        attackMs: intent.attackMs,
        sustainMs: intent.sustainMs,
        decayMs: intent.decayMs
      };
      return sendRequest("intent.envelope", payload, `envelope reply for ${intent.slotId}`, { slotId: payload.slotId });
    },
    /**
     * intent.set を 1 本送り、replyTo 相関で accepted/rejected を受ける（S6 barge-in の口閉じ）。
     * 写経元 reference-driver.sendIntent。payload は器契約
     * `{ slotId, value, ttlMs? }`（value は mouth 系 0..1・域外は slotValueOutOfRange 拒否でクランプなし・
     * ttlMs は exclusiveMinimum:0 で省略時は器既定窓）。ttlMs は指定時のみ payload に載せる。
     * @param {{ slotId: string; value: number; ttlMs?: number }} intent
     * @returns {Promise<{ result: string; error: unknown; rttMs: number }>}
     */
    sendSet(intent) {
      /** @type {{ slotId: string; value: number; ttlMs?: number }} */
      const payload = { slotId: intent.slotId, value: intent.value };
      if (intent.ttlMs !== undefined) {
        payload.ttlMs = intent.ttlMs;
      }
      return sendRequest("intent.set", payload, `set reply for ${intent.slotId}`, { slotId: payload.slotId });
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
      await withTimeout(closed, replyTimeoutMs, "socket close", "channel_close_timeout", "control_channel.close_timeout");
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

function withTimeout(promise, ms, label, code = "timeout", diagnosticStage = "control_channel.timeout") {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(diagnosticError(`timed out after ${ms}ms waiting for ${label}`, code, diagnosticStage));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** @param {string} message @param {string} code @param {string} diagnosticStage */
function diagnosticError(message, code, diagnosticStage) {
  const error = new Error(message);
  /** @type {any} */ (error).code = code;
  /** @type {any} */ (error).diagnosticStage = diagnosticStage;
  return error;
}

/** @param {unknown} error @param {string} code @param {string} diagnosticStage */
function withDiagnostic(error, code, diagnosticStage) {
  if (error instanceof Error) {
    if (typeof /** @type {any} */ (error).code !== "string") /** @type {any} */ (error).code = code;
    if (typeof /** @type {any} */ (error).diagnosticStage !== "string") {
      /** @type {any} */ (error).diagnosticStage = diagnosticStage;
    }
    return /** @type {any} */ (error);
  }
  return diagnosticError(String(error), code, diagnosticStage);
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
