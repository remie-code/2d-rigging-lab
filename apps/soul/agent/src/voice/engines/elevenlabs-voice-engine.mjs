// @ts-check
/**
 * ElevenLabs の声の差し替え口（声の差し替え Wave 3 Domain D）— apps/soul/agent。
 *
 * 計画: discussion/ai-cohost/implementation/orchestration/voice-swap-wave-plan.md §0・§3 Domain D・
 * 「D と E の接点」・「Wave 2 からの申し送り」1。実測の根拠: voice-swap-inventory.md §3。
 *
 * ── 通り道（TTD WebSocket・つなぎっぱなし）──────────────────────────────────
 *  `wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input?model_id=eleven_v4_turbo&output_format=pcm_24000
 *  &language_code=ja&sync_alignment=true`、認証はヘッダ `xi-api-key`（URL には載せない）。
 *  - 作った時点で接続する（操縦席の Start で作られる）。open で最初のメッセージ `{voices:[voiceId]}` を送る
 *    （voice_settings は渡されたときだけここに載せる。後から送ると 1008）。
 *  - 何も送らない時間が {@link ELEVENLABS_TTS_DEFAULTS}.keepAliveIntervalMs（10 秒）続いたら
 *    `{"keep_alive": true}` を送る（20 秒無送信で 1008 input_timeout_exceeded になるため）。
 *  - 切れたら 1s → 15s（倍々）で繋ぎ直し続ける（STT と同じ）。AivisSpeech へは自動で戻さない。
 *
 * ── 文の送り方（申し送り 1: 1 本の接続を共有するので直列）───────────────────────
 *  `synthesize(text)` は文を列に積み、前の文の `is_final_audio_for_turn` が届いてから
 *  `{inputs:[{text, voice_id}]}` + `{flush:true}` を送る（送信順 = 受信順）。届く音（audio_base64 の PCM16LE）と
 *  alignment を、`is_final_audio_for_turn` までをその文の分として順に出す。
 *  列: format(24000Hz mono) → audio / timeline（届いた順・時間割は区間が揃った所から）→ end。
 *  同じメッセージの中では alignment を audio より先に扱う（読みが揃っていれば timeline が音より先に出る）。
 *
 * ── 中止（申し送り 1）───────────────────────────────────────────────────
 *  止めるメッセージは無い（未知のメッセージは 1006）。送ったあと終わる前の文が中止されたら、接続を切ってすぐ
 *  裏でつなぎ直す（状態は up のまま。つなぎ直しに失敗したら reconnecting）。まだ送っていない文の中止は列から
 *  外すだけ。終わった（is_final 後の）文の中止は無視する。barge-in で全文が一斉に中止されても、送ったあとの文は
 *  高々 1 本なので、切断とつなぎ直しは 1 回にまとまる。
 *
 * ── 口の時間割 ─────────────────────────────────────────────────────────
 *  読み（AivisSpeech `/accent_phrases`・合成なし）を文を受けた時点で並行して取り、alignment を通し値にして
 *  区間に束ね、読みのモーラを割り付ける（elevenlabs-timeline.mjs）。読みが取れないときは簡易版にし、
 *  `onReadingsFallback()` を呼ぶ。alignmentLeadMs（既定 0）を足す。発話全体 4096 要素を超えない。
 *
 * ── 状態 ───────────────────────────────────────────────────────────────
 *  `connecting`（最初の接続中）→ `up`。最初の接続に失敗したら `down`、繋がった後に切れたら `reconnecting`
 *  （どちらも裏で繋ぎ直し続け、繋がれば `up`）。キーが無ければ `down` のまま繋がない。dispose で `down`。
 *
 * ── 秘密と本文 ──────────────────────────────────────────────────────────
 *  キーはヘッダにだけ載せ、エラー文・診断・トレースには出さない。本文もトレース・診断に出さない（字数のみ）。
 *  診断（onDiagnostic）の reason は決まった語彙・close code・サーバーの `error` の識別子（`[a-z0-9_]` のみ。
 *  例: input_timeout_exceeded）だけで、message はいつも null（サーバーの message 文・close の reason 文は載せない）。
 */

import { createEngineStatusCell } from "./engine-status.mjs";
import { createTtsClient } from "../tts-client.mjs";
import { resolveSByVowel } from "../mora-timeline.mjs";
import {
  createAlignmentTimelineBuilder,
  planSentence,
  readingGroupsFromAccentPhrases,
  textForReading
} from "./elevenlabs-timeline.mjs";

/** TTD WebSocket のエンドポイント。 */
export const ELEVENLABS_TTD_URL = "wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input";

/** 既定（声 = 案3・モデル = v4_turbo・pcm_24000・日本語）と時間の既定。 */
export const ELEVENLABS_TTS_DEFAULTS = Object.freeze({
  voiceId: "Ona22sJYfzcps6cE1jVk",
  modelId: "eleven_v4_turbo",
  outputFormat: "pcm_24000",
  languageCode: "ja",
  keepAliveIntervalMs: 10000,
  reconnectInitialDelayMs: 1000,
  reconnectMaxDelayMs: 15000,
  connectTimeoutMs: 10000,
  /** 繋がっていない間に文を待たせる上限（越えたら elevenlabs_tts_unavailable で失敗）。 */
  connectWaitMs: 5000,
  /** 送ったあと、その文の便りが途絶えてよい上限（越えたら失敗にしてつなぎ直す）。 */
  turnIdleTimeoutMs: 10000,
  /** 読み（/accent_phrases）を待つ上限（越えたら簡易版）。 */
  readingsTimeoutMs: 2000,
  /** 口の時間割の全 timeMs に足す ms（ElevenLabs の alignment は 0 始まりだが声は 0.1〜0.2 秒後）。 */
  alignmentLeadMs: 0
});

/**
 * 接続 URL を組む純関数（キーは載せない）。
 * @param {{ baseUrl?: string; modelId?: string; outputFormat?: string; languageCode?: string }} [opts]
 * @returns {string}
 */
export function buildElevenLabsTtdUrl(opts = {}) {
  const d = ELEVENLABS_TTS_DEFAULTS;
  const query = new URLSearchParams({
    model_id: opts.modelId ?? d.modelId,
    output_format: opts.outputFormat ?? d.outputFormat,
    language_code: opts.languageCode ?? d.languageCode,
    sync_alignment: "true"
  });
  return `${opts.baseUrl ?? ELEVENLABS_TTD_URL}?${query}`;
}

/**
 * @param {object} deps
 * @param {string} deps.apiKey  `xi-api-key`（操縦席が Start で loadElevenLabsApiKey して渡す）。
 * @param {string} [deps.voiceId]
 * @param {string} [deps.modelId]
 * @param {string} [deps.outputFormat]  `pcm_<rate>` だけ（既定 pcm_24000）。
 * @param {string} [deps.languageCode]
 * @param {string} [deps.baseUrl]  TTD の URL（テスト用）。
 * @param {{ accentPhrases: (text: string, options?: { signal?: AbortSignal }) => Promise<unknown> } | null} [deps.readingClient]
 *   読みの口（既定は AivisSpeech の tts-client。null で読みを取らない＝常に簡易版・通知なし）。
 * @param {string} [deps.ttsBaseUrl]  readingClient 省略時の AivisSpeech のベース URL。
 * @param {number|string} [deps.speaker]  readingClient 省略時の話者 ID。
 * @param {number} [deps.alignmentLeadMs]
 * @param {() => void} [deps.onReadingsFallback]  読みが取れず簡易版の口にした文ごとに 1 回。
 * @param {(diag: { type: string; reason?: string | null; message?: string | null }) => void} [deps.onDiagnostic]
 *   接続・切断・つなぎ直し・サーバーのエラーの診断（キー・本文は載らない）。
 * @param {Record<string, unknown>} [deps.voiceSettings]  最初のメッセージにだけ載せる voice_settings（既定なし）。
 * @param {undefined | { vowelMap?: Record<string, number> }} [deps.sConfig]  母音別 s の差し替え。
 * @param {any} [deps.WebSocketImpl]  既定 globalThis.WebSocket。
 * @param {typeof setTimeout} [deps.setTimeoutImpl]
 * @param {typeof clearTimeout} [deps.clearTimeoutImpl]
 * @param {number} [deps.keepAliveIntervalMs]
 * @param {number} [deps.reconnectInitialDelayMs]
 * @param {number} [deps.reconnectMaxDelayMs]
 * @param {number} [deps.connectTimeoutMs]
 * @param {number} [deps.connectWaitMs]
 * @param {number} [deps.turnIdleTimeoutMs]
 * @param {number} [deps.readingsTimeoutMs]
 * @returns {import("./voice-engine.mjs").VoiceEngine}
 */
export function createElevenLabsVoiceEngine(deps) {
  const options = deps ?? /** @type {any} */ ({});
  const cfg = { ...ELEVENLABS_TTS_DEFAULTS };
  for (const key of /** @type {Array<keyof typeof ELEVENLABS_TTS_DEFAULTS>} */ (Object.keys(cfg))) {
    if (/** @type {any} */ (options)[key] !== undefined) /** @type {any} */ (cfg)[key] = /** @type {any} */ (options)[key];
  }
  const formatMatch = /^pcm_(\d+)$/.exec(String(cfg.outputFormat));
  if (!formatMatch) throw new RangeError(`elevenlabs voice engine: outputFormat must be pcm_<rate>; got ${String(cfg.outputFormat)}.`);
  const sampleRate = Number(formatMatch[1]);
  if (!Number.isFinite(cfg.alignmentLeadMs)) throw new RangeError("elevenlabs voice engine: alignmentLeadMs must be a finite number.");
  const sByVowel = resolveSByVowel(options.sConfig);

  const apiKey = options.apiKey;
  const hasKey = typeof apiKey === "string" && apiKey.length > 0;
  const url = buildElevenLabsTtdUrl({ ...cfg, baseUrl: options.baseUrl });
  const WebSocketImpl = options.WebSocketImpl ?? globalThis.WebSocket;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const readingClient =
    options.readingClient === undefined
      ? createTtsClient({ baseUrl: options.ttsBaseUrl, speaker: options.speaker })
      : options.readingClient;
  const voiceSettings = options.voiceSettings && typeof options.voiceSettings === "object" ? options.voiceSettings : null;

  const status = createEngineStatusCell(hasKey ? "connecting" : "down");

  /** @type {any} 今のソケット（接続中も含む）。 */
  let ws = null;
  /** open を受けて文を送れる状態か。 */
  let ready = false;
  let everUp = false;
  let disposed = false;
  /** @type {any} */
  let reconnectTimer = null;
  let reconnectDelayMs = /** @type {number} */ (cfg.reconnectInitialDelayMs);
  /** @type {any} */
  let keepAliveTimer = null;
  /** まだ送っていない文（synthesize の呼び出し順）。 @type {any[]} */
  const queue = [];
  /** 送ったあと is_final を待っている文（高々 1 本）。 @type {any} */
  let current = null;
  let jobSeq = 0;

  const diag = (/** @type {string} */ type, /** @type {string | null} */ reason = null, /** @type {string | null} */ message = null) => {
    if (typeof options.onDiagnostic !== "function") return;
    try {
      options.onDiagnostic({ type, reason, message });
    } catch {
      // 診断の失敗で声を止めない。
    }
  };

  // ── 接続 ──────────────────────────────────────────────────────────

  const clearKeepAlive = () => {
    if (keepAliveTimer !== null) {
      clearTimeoutImpl(keepAliveTimer);
      keepAliveTimer = null;
    }
  };

  const armKeepAlive = () => {
    clearKeepAlive();
    if (disposed || !ready) return;
    keepAliveTimer = setTimeoutImpl(() => {
      keepAliveTimer = null;
      if (disposed || !ready || !ws) return;
      sendRaw({ keep_alive: true });
    }, cfg.keepAliveIntervalMs);
  };

  /** @param {object} message @returns {boolean} 送れたか */
  const sendRaw = (message) => {
    const socket = ws;
    if (!socket) return false;
    try {
      socket.send(JSON.stringify(message));
    } catch {
      return false;
    }
    armKeepAlive();
    return true;
  };

  /** ソケットを手放す（以後そのソケットの事象は無視）。 @param {any} socket */
  const abandon = (socket) => {
    if (ws === socket) {
      ws = null;
      ready = false;
      clearKeepAlive();
    }
    try {
      socket.close(1000);
    } catch {
      // best-effort
    }
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer !== null || ws !== null) return;
    const delay = reconnectDelayMs;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, cfg.reconnectMaxDelayMs);
    reconnectTimer = setTimeoutImpl(() => {
      reconnectTimer = null;
      openSocket();
    }, delay);
  };

  /** @param {string} reason */
  const onConnectFailed = (reason) => {
    diag("ttsConnectFailed", reason);
    status.set(everUp ? "reconnecting" : "down");
    armWaitTimers();
    scheduleReconnect();
  };

  /** @param {number | null} code */
  const onConnectionLost = (code) => {
    // close の reason 文はサーバー任せなので載せない（code だけ）。
    diag("ttsDisconnected", `code=${code ?? "?"}`);
    const job = current;
    if (job) {
      failJob(
        job,
        diagnosticError(
          `ElevenLabs TTS connection closed (code=${code ?? "?"})`,
          "elevenlabs_tts_disconnected",
          "voice.elevenlabs.connection"
        )
      );
    }
    status.set("reconnecting");
    armWaitTimers();
    scheduleReconnect();
  };

  const openSocket = () => {
    if (disposed || ws !== null || !hasKey) return;
    /** @type {any} */
    let socket;
    try {
      socket = new WebSocketImpl(url, { headers: { "xi-api-key": apiKey } });
    } catch (error) {
      onConnectFailed(`websocket constructor failed (${error instanceof Error ? error.name : typeof error})`);
      return;
    }
    ws = socket;
    ready = false;
    const timer = setTimeoutImpl(() => {
      if (ws !== socket || ready || disposed) return;
      abandon(socket);
      onConnectFailed(`no open within ${cfg.connectTimeoutMs}ms`);
    }, cfg.connectTimeoutMs);

    socket.addEventListener("open", () => {
      if (ws !== socket || disposed) return;
      clearTimeoutImpl(timer);
      ready = true;
      const wasUp = everUp;
      everUp = true;
      reconnectDelayMs = cfg.reconnectInitialDelayMs;
      sendRaw({ voices: [cfg.voiceId], ...(voiceSettings ? { voice_settings: voiceSettings } : {}) });
      clearWaitTimers();
      diag(wasUp ? "ttsReconnected" : "ttsConnected");
      status.set("up");
      pump();
    });
    socket.addEventListener("message", (/** @type {{ data: unknown }} */ ev) => {
      if (ws !== socket || disposed) return;
      handleMessage(ev.data);
    });
    socket.addEventListener("error", () => {
      if (ws !== socket || disposed || ready) return;
      // open 前の error は接続失敗（open 後は直後の close で扱う）。
      clearTimeoutImpl(timer);
      abandon(socket);
      onConnectFailed("websocket error");
    });
    socket.addEventListener("close", (/** @type {any} */ ev) => {
      if (ws !== socket || disposed) return;
      clearTimeoutImpl(timer);
      const wasReady = ready;
      ws = null;
      ready = false;
      clearKeepAlive();
      const code = ev && typeof ev.code === "number" ? ev.code : null;
      if (!wasReady) {
        onConnectFailed(`closed code=${code ?? "?"}`);
        return;
      }
      onConnectionLost(code);
    });
  };

  /**
   * 意図して切ってすぐつなぎ直す（中止・文の時間切れ）。状態は up のまま（失敗したら reconnecting）。
   * 送ったあとの文は高々 1 本なので、一斉の中止でも 1 回にまとまる。
   * @param {string} reason
   */
  const restartConnection = (reason) => {
    if (disposed) return;
    if (ws !== null) {
      abandon(ws);
      diag("ttsRestarted", reason);
    }
    armWaitTimers();
    if (reconnectTimer === null) openSocket();
  };

  // ── 文（job）────────────────────────────────────────────────────────

  const clearWaitTimers = () => {
    for (const job of queue) {
      if (job.waitTimer !== null) {
        clearTimeoutImpl(job.waitTimer);
        job.waitTimer = null;
      }
    }
  };

  /** 繋がっていない間に待っている文へ、待ちの上限を付ける。 */
  function armWaitTimers() {
    for (const job of queue) {
      if (job.state !== "queued" || job.waitTimer !== null) continue;
      job.waitTimer = setTimeoutImpl(() => {
        job.waitTimer = null;
        if (job.state !== "queued" || ready) return;
        failJob(
          job,
          diagnosticError("ElevenLabs TTS is not connected", "elevenlabs_tts_unavailable", "voice.elevenlabs.connect")
        );
      }, cfg.connectWaitMs);
    }
  }

  /** @param {any} job */
  const clearJobTimers = (job) => {
    if (job.waitTimer !== null) {
      clearTimeoutImpl(job.waitTimer);
      job.waitTimer = null;
    }
    if (job.idleTimer !== null) {
      clearTimeoutImpl(job.idleTimer);
      job.idleTimer = null;
    }
  };

  /** @param {any} job */
  const removeFromQueue = (job) => {
    const index = queue.indexOf(job);
    if (index >= 0) queue.splice(index, 1);
  };

  /** @param {any} job @param {Error} error */
  function failJob(job, error) {
    if (job.state === "done" || job.state === "failed" || job.state === "cancelled") return;
    job.state = "failed";
    clearJobTimers(job);
    removeFromQueue(job);
    if (current === job) current = null;
    job.readingsController.abort();
    job.trace("voice.elevenlabs.turn.failed", { failureCode: /** @type {any} */ (error).code ?? null });
    job.events.push({ type: "error", error });
  }

  /** 中止（申し送り 1: 終わった文の中止は無視・送ったあとの文なら切ってつなぎ直す）。 @param {any} job */
  const cancelJob = (job) => {
    if (job.state === "done" || job.state === "failed" || job.state === "cancelled") return;
    const inFlight = current === job;
    job.state = "cancelled";
    clearJobTimers(job);
    removeFromQueue(job);
    if (inFlight) current = null;
    job.readingsController.abort();
    job.trace("voice.elevenlabs.turn.cancelled", { inFlight });
    job.events.push({ type: "error", error: abortError() });
    if (inFlight) restartConnection("abort");
  };

  /** @param {any} job */
  const armIdle = (job) => {
    if (job.idleTimer !== null) clearTimeoutImpl(job.idleTimer);
    job.idleTimer = setTimeoutImpl(() => {
      job.idleTimer = null;
      if (current !== job) return;
      failJob(
        job,
        diagnosticError(
          `ElevenLabs TTS turn produced nothing for ${cfg.turnIdleTimeoutMs}ms`,
          "elevenlabs_tts_turn_timeout",
          "voice.elevenlabs.turn"
        )
      );
      restartConnection("turn-timeout");
    }, cfg.turnIdleTimeoutMs);
  };

  /** 次の文を送る（前の文の is_final の後・繋がっているときだけ）。 */
  function pump() {
    if (disposed || !ready || current !== null || ws === null) return;
    while (queue.length > 0) {
      const job = queue.shift();
      if (job.state !== "queued") continue;
      clearJobTimers(job);
      current = job;
      job.state = "receiving";
      const sent = sendRaw({ inputs: [{ text: job.sendText, voice_id: cfg.voiceId }] }) && sendRaw({ flush: true });
      if (!sent) {
        failJob(job, diagnosticError("ElevenLabs TTS send failed", "elevenlabs_tts_send_failed", "voice.elevenlabs.send"));
        restartConnection("send-failed");
        return;
      }
      job.trace("voice.elevenlabs.turn.sent", { speechChars: job.sendText.length });
      armIdle(job);
      return;
    }
  }

  /** @param {unknown} raw */
  const handleMessage = (raw) => {
    /** @type {any} */
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch {
      diag("ttsMessageParseError");
      return;
    }
    if (data == null || typeof data !== "object") return;
    const job = current;
    if (typeof data.error === "string") {
      // サーバーのエラー（例: input_timeout_exceeded / protocol_violation）。種類の識別子だけを載せる
      // （message 文や識別子の形でない値は載せない）。
      const kind = /^[a-z0-9_]{1,64}$/.test(data.error) ? data.error : "unknown";
      diag("ttsServerError", kind);
      if (job) {
        failJob(job, diagnosticError(`ElevenLabs TTS server error: ${kind}`, "elevenlabs_tts_server_error", "voice.elevenlabs.server"));
        restartConnection("server-error");
      }
      return;
    }
    if (!job) return;
    armIdle(job);
    // 同じメッセージの中では時間割（alignment）を音より先に積む（Wave 1 申し送り 2: 器への append は音より先）。
    // 組み立て器が既にあれば、その時間割は同じメッセージの音より先に出る。
    if (data.alignment && typeof data.alignment === "object") {
      job.events.push({ type: "alignment", alignment: data.alignment });
    }
    if (typeof data.audio === "string" && data.audio.length > 0) {
      const pcm = takeEvenPcm(job, Buffer.from(data.audio, "base64"));
      if (pcm) job.events.push({ type: "audio", pcm });
    }
    if (data.is_final_audio_for_turn === true) {
      clearJobTimers(job);
      current = null;
      job.state = "done";
      job.events.push({ type: "final" });
      pump();
    }
  };

  /** @param {any} job */
  const startReadings = (job) => {
    if (readingClient == null || typeof readingClient.accentPhrases !== "function") {
      return Promise.resolve({ groups: null, fallbackReason: null });
    }
    const readText = textForReading(job.sendText).trim();
    if (readText.length === 0) return Promise.resolve({ groups: null, fallbackReason: null });
    return new Promise((resolve) => {
      let settled = false;
      const settle = (/** @type {any} */ value) => {
        if (settled) return;
        settled = true;
        clearTimeoutImpl(timer);
        resolve(value);
      };
      const timer = setTimeoutImpl(() => {
        job.readingsController.abort();
        settle({ groups: null, fallbackReason: "timeout" });
      }, cfg.readingsTimeoutMs);
      Promise.resolve()
        .then(() => readingClient.accentPhrases(readText, { signal: job.readingsController.signal }))
        .then(
          (phrases) => {
            try {
              settle({ groups: readingGroupsFromAccentPhrases(phrases), fallbackReason: null });
            } catch {
              settle({ groups: null, fallbackReason: "invalid" });
            }
          },
          (error) => settle({ groups: null, fallbackReason: error && error.name === "AbortError" ? "aborted" : "failed" })
        );
    });
  };

  /**
   * @param {any} job
   * @returns {AsyncGenerator<import("./voice-engine.mjs").VoiceChunk>}
   */
  async function* runJob(job) {
    let finished = false;
    try {
      yield { type: "format", sampleRate, channels: 1 };
      /** @type {any[]} */
      const pendingAlignments = [];
      /** @type {ReturnType<typeof createAlignmentTimelineBuilder> | null} */
      let builder = null;
      /** @param {{ groups: any; fallbackReason: string | null }} result */
      const makeBuilder = (result) => {
        if (result.fallbackReason && job.state !== "cancelled") {
          job.trace("voice.elevenlabs.readings.fallback", { reason: result.fallbackReason });
          if (typeof options.onReadingsFallback === "function") {
            try {
              options.onReadingsFallback();
            } catch {
              // 通知の失敗で声を止めない。
            }
          }
        }
        const made = createAlignmentTimelineBuilder({
          plan: planSentence(job.sendText, result.groups),
          sByVowel,
          leadMs: cfg.alignmentLeadMs
        });
        /** @type {any[]} */
        const entries = [];
        for (const alignment of pendingAlignments.splice(0)) entries.push(...made.pushAlignment(alignment));
        builder = made;
        return entries;
      };
      for (;;) {
        const event = await job.events.next();
        if (event.type === "error") throw event.error;
        if (event.type === "audio") {
          job.pcmBytes += event.pcm.byteLength;
          yield { type: "audio", pcm: event.pcm };
          continue;
        }
        if (event.type === "alignment") {
          if (builder === null) {
            pendingAlignments.push(event.alignment);
            continue;
          }
          const entries = builder.pushAlignment(event.alignment);
          if (entries.length > 0) yield { type: "timeline", entries };
          continue;
        }
        if (event.type === "readings") {
          if (builder !== null) continue;
          const entries = makeBuilder(event.result);
          if (entries.length > 0) yield { type: "timeline", entries };
          continue;
        }
        if (event.type === "final") {
          const entries = builder === null ? makeBuilder(await job.readings) : [];
          entries.push(.../** @type {any} */ (builder).finish());
          const stats = /** @type {any} */ (builder).stats();
          job.trace("voice.elevenlabs.turn.final", {
            pcmBytes: job.pcmBytes,
            alignmentChars: stats.alignmentChars,
            timelineCount: stats.timelineCount,
            timelineMode: stats.mode,
            alignmentMismatchAt: stats.mismatchAt,
            timelineCapped: stats.capped,
            alignmentTotalMs: stats.totalMs
          });
          if (entries.length > 0) yield { type: "timeline", entries };
          finished = true;
          yield { type: "end" };
          return;
        }
      }
    } finally {
      job.detachAbort();
      // 読み終わる前に消費者が抜けたら中止と同じに扱う（終わった文なら何もしない）。
      if (!finished) cancelJob(job);
    }
  }

  // 作った時点で繋ぐ（操縦席の Start で作られる）。
  if (hasKey) openSocket();

  return {
    kind: "elevenlabs",
    get status() {
      return status.get();
    },
    onStatus: (listener) => status.onStatus(listener),
    synthesize(text, synthOptions = {}) {
      if (typeof text !== "string" || text.length === 0) {
        throw new TypeError("synthesize(text): text must be a non-empty string.");
      }
      if (disposed) throw new Error("elevenlabs voice engine already disposed.");
      const signal = synthOptions.signal;
      const onTrace = synthOptions.onTrace;
      jobSeq += 1;
      const job = {
        seq: jobSeq,
        sendText: text.trim(),
        state: "queued",
        events: createEventQueue(),
        /** @type {any} */
        waitTimer: null,
        /** @type {any} */
        idleTimer: null,
        carry: /** @type {Uint8Array | null} */ (null),
        pcmBytes: 0,
        readingsController: new AbortController(),
        /** @type {Promise<{ groups: any; fallbackReason: string | null }>} */
        readings: /** @type {any} */ (null),
        detachAbort: () => {},
        trace: (/** @type {string} */ event, /** @type {Record<string, unknown>} */ fields = {}) => {
          if (typeof onTrace !== "function") return;
          try {
            onTrace(event, fields);
          } catch {
            // Diagnostic failures must not affect speech.
          }
        }
      };
      const generator = runJob(job);
      if (!hasKey) {
        job.state = "failed";
        job.readings = Promise.resolve({ groups: null, fallbackReason: null });
        job.events.push({
          type: "error",
          error: diagnosticError("ElevenLabs API key is missing", "elevenlabs_api_key_missing", "voice.elevenlabs.connect")
        });
        return generator;
      }
      if (signal && signal.aborted) {
        job.state = "cancelled";
        job.readings = Promise.resolve({ groups: null, fallbackReason: null });
        job.events.push({ type: "error", error: abortError() });
        return generator;
      }
      if (job.sendText.length === 0) {
        // 空白だけの文: 送らずに終わる。
        job.state = "done";
        job.readings = Promise.resolve({ groups: null, fallbackReason: null });
        job.events.push({ type: "final" });
        return generator;
      }
      if (signal) {
        const onAbort = () => cancelJob(job);
        signal.addEventListener("abort", onAbort, { once: true });
        job.detachAbort = () => signal.removeEventListener("abort", onAbort);
      }
      job.readings = startReadings(job);
      void job.readings.then((result) => {
        if (job.state !== "cancelled" && job.state !== "failed") job.events.push({ type: "readings", result });
      });
      queue.push(job);
      if (!ready) {
        armWaitTimers();
        // 裏の繋ぎ直しが待ち時間中なら、文が来た今すぐ試す（戻っていればすぐ鳴る）。
        if (reconnectTimer !== null) {
          clearTimeoutImpl(reconnectTimer);
          reconnectTimer = null;
          openSocket();
        }
      }
      pump();
      return generator;
    },
    dispose() {
      if (disposed) return;
      if (reconnectTimer !== null) {
        clearTimeoutImpl(reconnectTimer);
        reconnectTimer = null;
      }
      const socket = ws;
      if (socket) abandon(socket);
      const pending = [...(current ? [current] : []), ...queue];
      disposed = true;
      for (const job of pending) {
        failJob(job, diagnosticError("voice engine disposed", "voice_engine_disposed", "voice.synthesis"));
      }
      clearKeepAlive();
      status.set("down");
      status.clear();
    }
  };
}

/**
 * PCM16 の奇数バイトを次のかたまりへ持ち越す（サンプルの途中で切らない）。
 * @param {any} job @param {Buffer} bytes
 * @returns {Uint8Array | null}
 */
function takeEvenPcm(job, bytes) {
  let data = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (job.carry) {
    const merged = new Uint8Array(job.carry.byteLength + data.byteLength);
    merged.set(job.carry, 0);
    merged.set(data, job.carry.byteLength);
    data = merged;
    job.carry = null;
  }
  if (data.byteLength % 2 === 1) {
    job.carry = data.slice(data.byteLength - 1);
    data = data.subarray(0, data.byteLength - 1);
  }
  return data.byteLength > 0 ? data : null;
}

/** 待ち合わせ付きの単純な事象の列。 */
function createEventQueue() {
  /** @type {any[]} */
  const items = [];
  /** @type {((value: any) => void) | null} */
  let waiter = null;
  return {
    /** @param {any} item */
    push(item) {
      if (waiter) {
        const resolve = waiter;
        waiter = null;
        resolve(item);
      } else {
        items.push(item);
      }
    },
    /** @returns {Promise<any>} */
    next() {
      if (items.length > 0) return Promise.resolve(items.shift());
      return new Promise((resolve) => {
        waiter = resolve;
      });
    }
  };
}

function abortError() {
  const error = new Error("voice synthesis aborted.");
  error.name = "AbortError";
  /** @type {any} */ (error).code = "voice_synthesis_aborted";
  /** @type {any} */ (error).diagnosticStage = "voice.synthesis.abort";
  return error;
}

/** @param {string} message @param {string} code @param {string} diagnosticStage */
function diagnosticError(message, code, diagnosticStage) {
  const error = new Error(message);
  /** @type {any} */ (error).code = code;
  /** @type {any} */ (error).diagnosticStage = diagnosticStage;
  return error;
}
