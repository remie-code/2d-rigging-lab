// @ts-check
/**
 * ElevenLabs リアルタイム STT の常駐接続（操縦席の文字起こし選択）— apps/soul/agent。
 *
 * 耳の取り込み（16kHz mono s16le）をそのまま `scribe_v2_realtime` の WebSocket へ流し続け、
 * サーバーが返す **commit（committed_transcript）を 1 件ずつ**呼び出し側へ渡す。partial は使わない
 * （積まない・表示しない）。合意の本体は discussion/ai-cohost/implementation/screens/cockpit-stt-selection.md、
 * 仕様と実機確認は discussion/ai-cohost/elevenlabs/research/stt-plans-and-realtime-2026-10.md。
 *
 * ── 役割の線引き（合意 §3「合図は手元、文字起こしは ElevenLabs」）─────────────────
 *  ここは転写だけを担う。speechStart / speechEnd / speechCancel は手元の Silero VAD が今まで通り出す
 *  （barge-in・区切り応答はそちらで動く）。耳（ear-pipeline.mjs）が engine "elevenlabs" のときだけ
 *  これを作り、whisper-server は起動しない。
 *
 * ── 接続の成否 ─────────────────────────────────────────────────────
 *  WebSocket の open だけでは成功にしない。キーが不正でも open した後に `auth_error` が届いて閉じる
 *  （2026-10-16 実機確認）ため、**`session_started` が届いた時点を接続成功**とする（open 直後に届く）。
 *  それより前のエラー/close/タイムアウトは接続失敗（connect() の reject・耳の Start 失敗）。
 *
 * ── 切断と再接続（合意 §3: 自動で繋ぎ直すだけ・whisper へは切り替えない）────────────
 *  接続成功後に切れたら、状態を "reconnecting" にして待ち時間を倍々（上限あり）にしながら繋ぎ直し
 *  続ける。繋がったら "up" に戻す。**繋ぎ直しの間のマイク音は捨てる**（§8）——送信待ちの端数も
 *  セッションをまたがない。
 *
 * ── 秘密の扱い（§8）──────────────────────────────────────────────────
 *  キーは `apps/soul/agent/.env.elevenlabs.local` の `ELEVENLABS_API_KEY` を loadElevenLabsApiKey で
 *  **コード内で直接読む**（process.env に入れない＝子プロセスに渡らない）。キーの値はエラー文・診断・
 *  ログのどこにも載せない（載るのはサーバーの message_type / error 文と close code だけ）。
 *
 * ── テスト注入 ──────────────────────────────────────────────────────
 *  WebSocketImpl（既定 Node 24 同梱の globalThis.WebSocket = undici）・setTimeoutImpl/clearTimeoutImpl・
 *  readFileImpl を差し替えられる。機械テストは実 ElevenLabs に繋がない。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));

/** リアルタイム STT の WebSocket エンドポイント。 */
export const ELEVENLABS_REALTIME_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";

/** キーを置く env ファイルの変数名。 */
export const ELEVENLABS_API_KEY_NAME = "ELEVENLABS_API_KEY";

/** キーの置き場の既定（`apps/soul/agent/.env.elevenlabs.local`・gitignore 済み）。 */
export const DEFAULT_ELEVENLABS_ENV_PATH = join(here, "..", "..", ".env.elevenlabs.local");

/**
 * 接続設定の既定（合意 §3）と送受信の既定。
 *  - vadSilenceThresholdSecs 0.3 はサーバーの受け付ける下限（0.2 は invalid_request）。
 *  - sendChunkBytes 3200 = 100ms 分（計測スクリプト probe-elevenlabs-stt.mjs と同じ単位で送る）。
 */
export const ELEVENLABS_STT_DEFAULTS = Object.freeze({
  modelId: "scribe_v2_realtime",
  commitStrategy: "vad",
  vadSilenceThresholdSecs: 0.3,
  audioFormat: "pcm_16000",
  languageCode: "ja",
  sampleRate: 16000,
  sendChunkBytes: 3200,
  connectTimeoutMs: 10000,
  reconnectInitialDelayMs: 1000,
  reconnectMaxDelayMs: 15000
});

/** WebSocket の readyState OPEN（標準値）。 */
const WS_OPEN = 1;

/**
 * 接続 URL を組む純関数（キーは URL に載せない。認証はヘッダ `xi-api-key`）。
 * @param {object} [opts]
 * @param {string} [opts.baseUrl]
 * @param {string} [opts.modelId]
 * @param {string} [opts.commitStrategy]
 * @param {number} [opts.vadSilenceThresholdSecs]
 * @param {string} [opts.audioFormat]
 * @param {string} [opts.languageCode]
 * @returns {string}
 */
export function buildElevenLabsRealtimeUrl(opts = {}) {
  const d = ELEVENLABS_STT_DEFAULTS;
  const query = new URLSearchParams({
    model_id: opts.modelId ?? d.modelId,
    audio_format: opts.audioFormat ?? d.audioFormat,
    language_code: opts.languageCode ?? d.languageCode,
    commit_strategy: opts.commitStrategy ?? d.commitStrategy,
    vad_silence_threshold_secs: String(opts.vadSilenceThresholdSecs ?? d.vadSilenceThresholdSecs)
  });
  return `${opts.baseUrl ?? ELEVENLABS_REALTIME_URL}?${query}`;
}

/**
 * `.env.elevenlabs.local` から ELEVENLABS_API_KEY を読む（process.env には入れない）。
 * 失敗理由は操縦席のマイク行の下にそのまま出せる文言（キーの値は含めない）。
 * @param {object} [options]
 * @param {string} [options.path=DEFAULT_ELEVENLABS_ENV_PATH]
 * @param {(path: string) => string} [options.readFileImpl]  テスト注入（既定 readFileSync utf8）。
 * @returns {{ ok: true; apiKey: string } | { ok: false; reason: string }}
 */
export function loadElevenLabsApiKey(options = {}) {
  const filePath = options.path ?? DEFAULT_ELEVENLABS_ENV_PATH;
  const readFileImpl = options.readFileImpl ?? ((/** @type {string} */ p) => readFileSync(p, "utf8"));
  const missing = {
    ok: /** @type {const} */ (false),
    reason: `ElevenLabs のキーが見つからない（apps/soul/agent/.env.elevenlabs.local の ${ELEVENLABS_API_KEY_NAME}）`
  };
  let text;
  try {
    text = readFileImpl(filePath);
  } catch {
    return missing;
  }
  let parsed;
  try {
    parsed = parseEnv(String(text));
  } catch {
    return missing;
  }
  const value = parsed[ELEVENLABS_API_KEY_NAME];
  if (typeof value !== "string" || value.trim().length === 0) return missing;
  return { ok: true, apiKey: value.trim() };
}

/**
 * サーバーのエラー系メッセージから表示用の短い説明を取り出す（キーは含まれない）。
 * @param {any} data
 * @returns {string}
 */
function serverErrorText(data) {
  const raw = data && (data.error ?? data.message ?? data.detail);
  if (typeof raw === "string" && raw.length > 0) return raw.slice(0, 200);
  return "no detail";
}

/** @param {unknown} err */
function errText(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * @typedef {"connecting" | "up" | "reconnecting" | "down"} ElevenLabsSttStatus
 */

/**
 * ElevenLabs リアルタイム STT の常駐接続を作る（connect() で開始・dispose() で畳む）。
 *
 * @param {object} options
 * @param {string} options.apiKey  `xi-api-key` ヘッダに載せるキー（ログ・エラーには出さない）。
 * @param {(commit: { text: string }) => void} [options.onCommit]  committed_transcript 1 件ごと（空文字もそのまま渡す）。
 * @param {(status: ElevenLabsSttStatus, info: { reason: string | null }) => void} [options.onStatus]  状態遷移。
 * @param {(diag: { type: string; reason?: string | null; message?: string | null }) => void} [options.onDiagnostic]
 *   切断・再接続・サーバーのエラー通知などの診断（キーは載らない）。
 * @param {string} [options.baseUrl]
 * @param {string} [options.modelId]
 * @param {string} [options.commitStrategy]
 * @param {number} [options.vadSilenceThresholdSecs]
 * @param {string} [options.audioFormat]
 * @param {string} [options.languageCode]
 * @param {number} [options.sampleRate]
 * @param {number} [options.sendChunkBytes]
 * @param {number} [options.connectTimeoutMs]
 * @param {number} [options.reconnectInitialDelayMs]
 * @param {number} [options.reconnectMaxDelayMs]
 * @param {any} [options.WebSocketImpl]  テスト注入（既定 globalThis.WebSocket）。
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {{
 *   connect: () => Promise<void>;
 *   sendPcm: (chunk: Uint8Array) => void;
 *   status: () => ElevenLabsSttStatus | "idle";
 *   dispose: () => void;
 * }}
 */
export function createElevenLabsRealtimeStt(options) {
  const apiKey = options.apiKey;
  const cfg = { ...ELEVENLABS_STT_DEFAULTS };
  for (const key of /** @type {Array<keyof typeof ELEVENLABS_STT_DEFAULTS>} */ (Object.keys(cfg))) {
    if (/** @type {any} */ (options)[key] !== undefined) /** @type {any} */ (cfg)[key] = /** @type {any} */ (options)[key];
  }
  const url = buildElevenLabsRealtimeUrl({ ...cfg, baseUrl: options.baseUrl });
  const WebSocketImpl = options.WebSocketImpl ?? globalThis.WebSocket;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const onCommit = options.onCommit ?? (() => {});
  const onStatus = options.onStatus ?? (() => {});
  const onDiagnostic = options.onDiagnostic ?? (() => {});

  /** @type {any} 現在のセッションのソケット（session_started 前も含む）。 */
  let ws = null;
  /** session_started を受けたか（受けるまで音声は送らない＝捨てる）。 */
  let sessionReady = false;
  let started = false;
  let disposed = false;
  /** @type {ElevenLabsSttStatus | "idle"} */
  let status = "idle";
  /** 送信待ちの端数（sendChunkBytes に満たない分）。セッションをまたがない。 */
  let pending = new Uint8Array(0);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let reconnectTimer = null;
  let reconnectDelayMs = cfg.reconnectInitialDelayMs;

  /**
   * @param {ElevenLabsSttStatus} next
   * @param {string | null} [reason]
   */
  function setStatus(next, reason = null) {
    if (status === next) return;
    status = next;
    onStatus(next, { reason });
  }

  /** @param {any} socket */
  function closeQuietly(socket) {
    try {
      socket.close(1000);
    } catch {
      // best-effort
    }
  }

  /**
   * 1 本の WebSocket を開き、session_started を待つ。成功で resolve、失敗で reject（ソケットは閉じる）。
   * 成功後の close は handleUnexpectedClose へ回る（再接続）。
   * @returns {Promise<void>}
   */
  function openSession() {
    return new Promise((resolve, reject) => {
      /** @type {any} */
      let socket;
      try {
        socket = new WebSocketImpl(url, { headers: { "xi-api-key": apiKey } });
      } catch (error) {
        reject(new Error(`ElevenLabs に接続できない（${errText(error)}）`));
        return;
      }
      ws = socket;
      sessionReady = false;
      pending = new Uint8Array(0);
      let settled = false;
      /** 接続失敗で手放したソケット（以後のイベントは無視）。 */
      let abandoned = false;

      const fail = (/** @type {string} */ message) => {
        if (settled) return;
        settled = true;
        abandoned = true;
        clearTimeoutImpl(/** @type {any} */ (timer));
        if (ws === socket) {
          ws = null;
          sessionReady = false;
        }
        closeQuietly(socket);
        reject(new Error(message));
      };

      const timer = setTimeoutImpl(() => {
        fail(`ElevenLabs に接続できない（${cfg.connectTimeoutMs}ms 以内に session_started が届かない）`);
      }, cfg.connectTimeoutMs);

      socket.addEventListener("message", (/** @type {{ data: unknown }} */ ev) => {
        if (abandoned || disposed || ws !== socket) return;
        /** @type {any} */
        let data;
        try {
          data = JSON.parse(String(ev.data));
        } catch {
          onDiagnostic({ type: "sttMessageParseError", reason: null, message: null });
          return;
        }
        const type = data && typeof data.message_type === "string" ? data.message_type : null;
        if (type === "session_started") {
          if (!settled) {
            settled = true;
            clearTimeoutImpl(/** @type {any} */ (timer));
            sessionReady = true;
            resolve();
          }
          return;
        }
        if (type === "committed_transcript") {
          onCommit({ text: typeof data.text === "string" ? data.text : "" });
          return;
        }
        // partial は使わない（合意 §3・§4.2: 積まない・表示しない）。
        if (type === "partial_transcript" || type === "committed_transcript_with_timestamps") return;
        // それ以外はエラー系（auth_error / quota_exceeded / session_time_limit_exceeded など）。
        const detail = serverErrorText(data);
        if (!settled) {
          fail(`ElevenLabs に接続できない（${type ?? "unknown"}: ${detail}）`);
          return;
        }
        onDiagnostic({ type: "sttServerError", reason: type, message: detail });
      });

      socket.addEventListener("error", (/** @type {any} */ ev) => {
        if (abandoned || disposed) return;
        if (!settled) {
          fail(`ElevenLabs に接続できない（websocket error${ev && ev.message ? `: ${ev.message}` : ""}）`);
        }
        // 接続後の error は直後の close で扱う（再接続）。
      });

      socket.addEventListener("close", (/** @type {any} */ ev) => {
        if (abandoned || disposed) return;
        const code = ev && typeof ev.code === "number" ? ev.code : null;
        const why = ev && typeof ev.reason === "string" && ev.reason.length > 0 ? ` ${ev.reason}` : "";
        if (!settled) {
          fail(`ElevenLabs に接続できない（closed code=${code ?? "?"}${why}）`);
          return;
        }
        if (ws !== socket) return;
        handleUnexpectedClose(code, why.trim());
      });
    });
  }

  /**
   * 接続成功後の切断: 状態を reconnecting にして繋ぎ直しを予約する（whisper へは切り替えない）。
   * @param {number | null} code
   * @param {string} reason
   */
  function handleUnexpectedClose(code, reason) {
    ws = null;
    sessionReady = false;
    pending = new Uint8Array(0);
    onDiagnostic({ type: "sttDisconnected", reason: `code=${code ?? "?"}`, message: reason || null });
    setStatus("reconnecting", `closed code=${code ?? "?"}${reason ? ` ${reason}` : ""}`);
    scheduleReconnect();
  }

  function scheduleReconnect() {
    if (disposed || reconnectTimer !== null) return;
    const delay = reconnectDelayMs;
    reconnectTimer = setTimeoutImpl(() => {
      reconnectTimer = null;
      if (disposed) return;
      openSession().then(
        () => {
          if (disposed) return;
          reconnectDelayMs = cfg.reconnectInitialDelayMs;
          onDiagnostic({ type: "sttReconnected", reason: null, message: null });
          setStatus("up");
        },
        (error) => {
          if (disposed) return;
          onDiagnostic({ type: "sttReconnectFailed", reason: null, message: errText(error) });
          reconnectDelayMs = Math.min(reconnectDelayMs * 2, cfg.reconnectMaxDelayMs);
          scheduleReconnect();
        }
      );
    }, delay);
  }

  return {
    /**
     * 最初の接続（session_started まで待つ）。失敗は reject（状態 down・理由はキーを含まない文言）。
     */
    async connect() {
      if (started) throw new Error("elevenLabsStt.connect: already started.");
      if (disposed) throw new Error("elevenLabsStt.connect: already disposed.");
      started = true;
      if (typeof apiKey !== "string" || apiKey.length === 0) {
        const message = `ElevenLabs のキーが見つからない（${ELEVENLABS_API_KEY_NAME}）`;
        setStatus("down", message);
        throw new Error(message);
      }
      setStatus("connecting");
      try {
        await openSession();
      } catch (error) {
        setStatus("down", errText(error));
        throw error;
      }
      if (disposed) return;
      setStatus("up");
    },

    /**
     * マイクの PCM（s16le mono 16kHz）を送る。セッションが無い間（接続前・繋ぎ直し中）は捨てる。
     * @param {Uint8Array} chunk
     */
    sendPcm(chunk) {
      if (disposed || !sessionReady || !ws || ws.readyState !== WS_OPEN) return;
      if (!chunk || chunk.length === 0) return;
      const merged = new Uint8Array(pending.length + chunk.length);
      merged.set(pending);
      merged.set(chunk, pending.length);
      pending = merged;
      const n = cfg.sendChunkBytes;
      while (pending.length >= n) {
        const piece = pending.subarray(0, n);
        try {
          ws.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: Buffer.from(piece).toString("base64"),
              commit: false,
              sample_rate: cfg.sampleRate
            })
          );
        } catch {
          // 送れない（閉じかけ）。直後の close で再接続に回る。
        }
        pending = pending.slice(n);
      }
    },

    status: () => status,

    /** 畳む（冪等）: 再接続タイマを止め、ソケットを閉じる。以後のコールバックは来ない。 */
    dispose() {
      if (disposed) return;
      disposed = true;
      if (reconnectTimer !== null) {
        clearTimeoutImpl(reconnectTimer);
        reconnectTimer = null;
      }
      const socket = ws;
      ws = null;
      sessionReady = false;
      pending = new Uint8Array(0);
      if (socket) closeQuietly(socket);
    }
  };
}
