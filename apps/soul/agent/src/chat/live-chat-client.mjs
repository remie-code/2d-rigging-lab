// @ts-check
/**
 * ライブチャット器官（S7 Domain A・壊れる前提の独立器官）— apps/soul/agent。
 *
 * innertube.mjs の純部品を束ね、YouTube Live チャットを常駐取得する器官。耳・目と同格の
 * **独立器官**であり、死んでも魂（発火・会話・既存器官）に一切影響しない（plan §3・inventory §2）。
 *
 * ── 独立の担保（構造とテストで固定）──────────────────────────────────
 *  この器官が import するのは innertube.mjs（同ディレクトリ）と Node グローバルだけ。**魂の他部位
 *  （../ears/** ../mind/** など）への import は 1 つも無い**。魂側はこの器官を知らない——合流は
 *  Domain B が onMessage フック経由で外から行う（この器官からの逆流路は無い）。ディスク書き込みも無い。
 *  「import ゼロ」は live-chat-client.test.mjs の構造テストで機械的に固定する。
 *
 * ── 状態機械（getState / onStatus）─────────────────────────────────────
 *   idle       : start() 前（生成直後）。
 *   connecting : watch ページ取得 + 4 点抽出中（bootstrap）。
 *   live       : get_live_chat をポーリング中（continuation ループ）。
 *   retrying   : 回復可能な障害（network / notLive / extractFailed）でバックオフ再接続待ち。**上限なし**。
 *   dead       : 終端。配信終了（ended）または stop() で到達。以後の自動再接続はしない。
 *  「配信未開始（notLive）は retrying＝待ち続ける」「配信終了（ended）は dead＝終端」で明確に区別する
 *  （inventory §2-4「開始前・終了後は明確なエラー形」）。
 *
 * ── エラー分類（onDiagnostic の info.kind）──────────────────────────────
 *   notLive       : 配信未開始 / canonical 不在 / isReplay（retrying で待つ）。
 *   ended         : 配信終了（dead へ）。
 *   extractFailed : 4 点抽出失敗・レスポンススキーマ変化（retrying・診断を出し続ける＝観測可能な死）。
 *   network       : fetch 失敗・HTTP 非 2xx（retrying）。
 *   listenerError : フック（onMessage/onStatus）が throw した（器官は握って常駐継続）。
 *
 * ── フックの throw は器官が握る（plan §3・transcript-buffer の listener 契約に相当）──────
 *  onMessage / onStatus が throw しても常駐は死なない。throw は onDiagnostic(kind:"listenerError") に
 *  落として飲む。onDiagnostic 自身の throw は（診断の診断でループを避けるため）飲むだけにする。
 *
 * ── 決定論（全注入）────────────────────────────────────────────────────
 *  fetchImpl / nowImpl / setTimeoutImpl / clearTimeoutImpl / rng を全部注入可能にし、fake fetch +
 *  fake clock + 定数 RNG で全分岐（壊れ方全分類・バックオフ遷移）を決定論テストできる
 *  （fire-scheduler.mjs の注入流儀）。機械テストは実 YouTube に一切出ない。
 */

import {
  normalizeSource,
  extractBootstrap,
  parseLiveChatResponse,
  fetchWatchPage,
  fetchLiveChat,
  DEFAULT_POLL_INTERVAL_MS
} from "./innertube.mjs";

/** バックオフ既定（v0 定数）。base から倍々、cap で頭打ち。上限リトライ回数は無し（plan「上限なし」）。 */
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CAP_MS = 30000;

/** 1 リクエスト（watch GET / get_live_chat POST）のタイムアウト既定（v0 定数）。 */
export const REQUEST_TIMEOUT_MS = 15000;

/** ポーリング間隔の下限（timeoutMs が小さすぎる/無いときの床）。 */
export const POLL_FLOOR_MS = 1000;

/** @typedef {"idle" | "connecting" | "live" | "retrying" | "dead"} ChatState */

/**
 * ライブチャット器官を作る。
 * @param {object} options
 * @param {string} options.source  watch URL / video ID / チャンネル `/live` URL。
 * @param {typeof fetch} [options.fetchImpl]           既定 globalThis.fetch。
 * @param {() => number} [options.nowImpl]             既定 Date.now。
 * @param {typeof setTimeout} [options.setTimeoutImpl] 既定 setTimeout。
 * @param {typeof clearTimeout} [options.clearTimeoutImpl] 既定 clearTimeout。
 * @param {() => number} [options.rng]                 バックオフジッター用。既定 Math.random。
 * @param {number} [options.backoffBaseMs]
 * @param {number} [options.backoffCapMs]
 * @param {number} [options.requestTimeoutMs]
 * @param {number} [options.pollFloorMs]
 * @param {number} [options.defaultPollIntervalMs]     timeoutMs 欠落時の間隔（既定 innertube の定数）。
 * @param {string} [options.origin]                    get_live_chat の origin（テスト差し替え用）。
 * @returns {{
 *   start: () => Promise<void>;
 *   stop: () => void;
 *   getState: () => ChatState;
 *   getSource: () => string;
 *   onMessage: (fn: (msg: any) => void) => () => void;
 *   onStatus: (fn: (state: ChatState) => void) => () => void;
 *   onDiagnostic: (fn: (info: any) => void) => () => void;
 *   idle: () => Promise<void>;
 * }}
 */
export function createLiveChatClient(options) {
  if (!options || typeof options.source !== "string") {
    throw new TypeError("createLiveChatClient: options.source (string) is required.");
  }
  const source = options.source;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("createLiveChatClient: no fetch implementation available (pass options.fetchImpl).");
  }
  const nowImpl = options.nowImpl ?? Date.now;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const rng = options.rng ?? Math.random;
  const backoffBaseMs = options.backoffBaseMs ?? BACKOFF_BASE_MS;
  const backoffCapMs = options.backoffCapMs ?? BACKOFF_CAP_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const pollFloorMs = options.pollFloorMs ?? POLL_FLOOR_MS;
  const defaultPollIntervalMs = options.defaultPollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const origin = options.origin;

  /** @type {ChatState} */
  let state = "idle";
  let apiKey = "";
  let clientVersion = "";
  let continuation = "";
  let videoId = /** @type {string | null} */ (null);
  let backoffAttempts = 0;
  /** @type {any} */
  let timer = null;
  let stopped = false;

  /** @type {Set<(msg: any) => void>} */
  const messageListeners = new Set();
  /** @type {Set<(state: ChatState) => void>} */
  const statusListeners = new Set();
  /** @type {Set<(info: any) => void>} */
  const diagnosticListeners = new Set();

  // 進行中の非同期サイクル（bootstrap+初回poll / 再接続 / poll）の settle を追う（テストの決定論待ち）。
  /** @type {Promise<void> | null} */
  let current = null;

  /**
   * onDiagnostic 通知。診断リスナ自身の throw は飲む（診断の診断を出すとループするため）。
   * @param {any} info
   */
  function emitDiagnostic(info) {
    for (const fn of diagnosticListeners) {
      try {
        fn(info);
      } catch {
        // 診断リスナの throw は握るだけ（ここで再度 emit するとループしうる）。
      }
    }
  }

  /**
   * フック呼び出しの共通ガード。throw を握って listenerError 診断に落とす（常駐を殺さない）。
   * @param {Set<(x: any) => void>} listeners
   * @param {any} payload
   * @param {"message" | "status"} hook
   */
  function emitGuarded(listeners, payload, hook) {
    for (const fn of listeners) {
      try {
        fn(payload);
      } catch (err) {
        emitDiagnostic({
          kind: "listenerError",
          hook,
          message: err instanceof Error ? err.message : String(err),
          atMs: nowImpl()
        });
      }
    }
  }

  /**
   * 状態遷移（変化時のみ onStatus 通知）。
   * @param {ChatState} next
   */
  function setState(next) {
    if (state === next) {
      return;
    }
    state = next;
    emitGuarded(statusListeners, next, "status");
  }

  /** AbortController + 注入タイマでリクエストにタイムアウトを掛ける（whisper-client 流儀）。 */
  function withTimeout() {
    const controller = new AbortController();
    const t = setTimeoutImpl(() => {
      controller.abort(new Error(`chat request timed out after ${requestTimeoutMs}ms`));
    }, requestTimeoutMs);
    return {
      signal: controller.signal,
      clear: () => clearTimeoutImpl(t),
      reason: () => (controller.signal.aborted ? controller.signal.reason : null)
    };
  }

  /** バックオフ遅延（base * 2^attempts、cap 頭打ち、[0,20%) ジッター）。attempts を進める。 */
  function nextBackoffDelay() {
    const raw = backoffBaseMs * 2 ** backoffAttempts;
    const capped = Math.min(raw, backoffCapMs);
    backoffAttempts += 1;
    const jitter = Math.floor(rng() * capped * 0.2);
    return capped + jitter;
  }

  /**
   * 回復可能障害 → retrying へ落として再接続をスケジュール（bootstrap からやり直す）。
   * @param {"network" | "notLive" | "extractFailed"} kind
   * @param {string} message
   */
  function scheduleReconnect(kind, message) {
    if (stopped) {
      return;
    }
    setState("retrying");
    const delayMs = nextBackoffDelay();
    emitDiagnostic({ kind, message, action: "retrying", delayMs, attempt: backoffAttempts, atMs: nowImpl() });
    clearTimer();
    timer = setTimeoutImpl(() => {
      timer = null;
      launch(runConnect);
    }, delayMs);
  }

  /** 次のポーリングをスケジュール。 */
  function scheduleNextPoll(delayMs) {
    if (stopped) {
      return;
    }
    clearTimer();
    timer = setTimeoutImpl(() => {
      timer = null;
      launch(runPoll);
    }, delayMs);
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeoutImpl(timer);
      timer = null;
    }
  }

  /**
   * bootstrap（watch ページ取得 + 4 点抽出）→ 成功なら live に上げて初回 poll。
   * @returns {Promise<void>}
   */
  async function runConnect() {
    if (stopped) {
      return;
    }
    setState("connecting");

    const norm = normalizeSource(source);
    if ("error" in norm) {
      // source そのものが不正（watch/video/channel いずれでもない）。抽出失敗として retrying。
      scheduleReconnect("extractFailed", norm.error.message);
      return;
    }

    let html;
    const guard = withTimeout();
    try {
      html = await fetchWatchPage({ url: norm.url, fetchImpl, signal: guard.signal });
    } catch (err) {
      const reason = guard.reason();
      const message = reason instanceof Error ? reason.message : err instanceof Error ? err.message : String(err);
      scheduleReconnect("network", `watch page fetch: ${message}`);
      return;
    } finally {
      guard.clear();
    }

    const boot = extractBootstrap(html, { knownVideoId: norm.videoId });
    if ("error" in boot) {
      if (boot.error.kind === "notLive") {
        scheduleReconnect("notLive", boot.error.message);
      } else {
        scheduleReconnect("extractFailed", boot.error.message);
      }
      return;
    }

    apiKey = boot.apiKey;
    clientVersion = boot.clientVersion;
    continuation = boot.continuation;
    videoId = boot.videoId;
    backoffAttempts = 0; // bootstrap 成功でバックオフをリセット。
    setState("live");
    emitDiagnostic({ kind: "connected", videoId, atMs: nowImpl() });

    await runPoll();
  }

  /**
   * 1 回のポーリング（get_live_chat）→ メッセージ配信 + 次 continuation + 次 poll スケジュール。
   * @returns {Promise<void>}
   */
  async function runPoll() {
    if (stopped) {
      return;
    }

    let json;
    const guard = withTimeout();
    try {
      json = await fetchLiveChat({ apiKey, clientVersion, continuation, fetchImpl, signal: guard.signal, origin });
    } catch (err) {
      const reason = guard.reason();
      const message = reason instanceof Error ? reason.message : err instanceof Error ? err.message : String(err);
      scheduleReconnect("network", `get_live_chat fetch: ${message}`);
      return;
    } finally {
      guard.clear();
    }

    const parsed = parseLiveChatResponse(json);
    if ("error" in parsed) {
      if (parsed.error.kind === "ended") {
        // 配信終了 = 終端（dead）。自動再接続しない。
        clearTimer();
        emitDiagnostic({ kind: "ended", message: parsed.error.message, atMs: nowImpl() });
        setState("dead");
      } else {
        // スキーマ変化等 → 抽出失敗として bootstrap からやり直す（診断を出し続ける＝観測可能）。
        scheduleReconnect("extractFailed", parsed.error.message);
      }
      return;
    }

    for (const msg of parsed.messages) {
      emitGuarded(messageListeners, { ...msg, videoId, receivedAtMs: nowImpl() }, "message");
    }
    if (parsed.ignored.length > 0) {
      emitDiagnostic({ kind: "ignoredRenderers", kinds: parsed.ignored, atMs: nowImpl() });
    }

    continuation = parsed.continuation;
    backoffAttempts = 0; // 成功ポールでバックオフをリセット。
    if (state !== "live") {
      setState("live");
    }
    const delayMs = Math.max(pollFloorMs, parsed.timeoutMs ?? defaultPollIntervalMs);
    scheduleNextPoll(delayMs);
  }

  /**
   * 非同期サイクルを起動し settle を current に記録（テストの idle() 待ち用）。
   * @param {() => Promise<void>} fn
   * @returns {Promise<void>}
   */
  function launch(fn) {
    const p = (async () => {
      try {
        await fn();
      } catch (err) {
        // 想定外の内部例外も器官を殺さない。通常は各段の try/catch で握られるが、万一ここへ落ちても
        // 沈黙凍結させない——診断（internalError）を出した上で、終端でなければ retrying に落として
        // 自動再接続を試みる（inventory §2 裁定 2「壊れたら診断＋器官内自動再接続」の最終防波堤）。
        // 例: runConnect の extractBootstrap / runPoll の parseLiveChatResponse が想定外 throw した場合。
        const message = err instanceof Error ? err.message : String(err);
        emitDiagnostic({
          kind: "internalError",
          message,
          atMs: nowImpl()
        });
        // dead（ended/stop 経由）や stopped は終端のまま——再接続しない。それ以外は bootstrap から
        // やり直す（extractFailed 扱い・バックオフ attempts を進めるので無限タイトループにならない）。
        if (!stopped && state !== "dead") {
          scheduleReconnect("extractFailed", `internalError: ${message}`);
        }
      }
    })();
    current = p;
    p.finally(() => {
      if (current === p) {
        current = null;
      }
    });
    return p;
  }

  return {
    /**
     * 常駐開始。bootstrap + 初回 poll まで await できる（以後の poll はタイマ駆動）。冪等
     * （既に稼働中/終端なら何もしない）。
     */
    async start() {
      if (stopped) {
        return;
      }
      if (state !== "idle") {
        return; // 既に開始済み。
      }
      await launch(runConnect);
    },

    /** 停止（終端 dead）。タイマを畳み、以後の自動再接続をしない。冪等。 */
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      clearTimer();
      emitDiagnostic({ kind: "stopped", atMs: nowImpl() });
      setState("dead");
    },

    getState() {
      return state;
    },

    getSource() {
      return source;
    },

    /**
     * メッセージ購読。返り値は購読解除。フックの throw は器官が握る（listenerError 診断）。
     * @param {(msg: any) => void} fn
     */
    onMessage(fn) {
      if (typeof fn !== "function") {
        throw new TypeError("onMessage: listener must be a function.");
      }
      messageListeners.add(fn);
      return () => messageListeners.delete(fn);
    },

    /**
     * 状態遷移購読。返り値は購読解除。
     * @param {(state: ChatState) => void} fn
     */
    onStatus(fn) {
      if (typeof fn !== "function") {
        throw new TypeError("onStatus: listener must be a function.");
      }
      statusListeners.add(fn);
      return () => statusListeners.delete(fn);
    },

    /**
     * 診断購読（notLive/ended/extractFailed/network/ignoredRenderers/listenerError 等）。返り値は購読解除。
     * @param {(info: any) => void} fn
     */
    onDiagnostic(fn) {
      if (typeof fn !== "function") {
        throw new TypeError("onDiagnostic: listener must be a function.");
      }
      diagnosticListeners.add(fn);
      return () => diagnosticListeners.delete(fn);
    },

    /** 進行中サイクルが settle するまで待つ（テスト/内省の補助・prod では無害）。 */
    async idle() {
      await (current ?? Promise.resolve());
    }
  };
}
