// @ts-check
/**
 * 魂のローカル Web コクピット・サーバ（S2.5 Domain A）— apps/soul/agent。
 *
 * 「エンジンが自分の顔を持つ」型のローカル操縦席（UX 定義 screens/soul-cockpit.md・Accepted）。
 * 魂プロセスが **127.0.0.1 限定**の小さな HTTP を立て、ユーザーはブラウザで開く。CLI を触らずに
 * マイクを選び・耳を起動し・喋ると転写がタイムラインに積もるのを見る。器（runtime-player）には
 * 一切作らない（憲章「器は魂を知らない」）。
 *
 * ── このモジュールの守備範囲（Domain A）─────────────────────────────────
 *  cockpit の**土台**: HTTP 静的 1 ページ配信 + 制御 API（デバイス列挙 / 耳 start/stop / 状態取得）
 *  + ライブ更新チャネル（転写 append・discard・VAD イベント・死活変化を push）+ 耳パイプラインの
 *  結線 + クリーンシャットダウン。**ページ本体の HTML・設定の永続化実体・起動スクリプト・docs は
 *  Domain B が乗せる**。ここは「B が消費するワイヤ契約」を確定させ、waves/s2.5/domain-a.md に明文化する。
 *
 * ── ライブ更新は SSE（Server-Sent Events）を選ぶ【設計判断】────────────────────
 *  転送は server→client の一方向 push（転写・VAD・死活）だけで足り、制御は HTTP POST が担う。
 *  自作 WS を選ぶと機械テストのクライアントで既知の相性問題（undici WebSocket が自作 WS サーバの
 *  Sec-WebSocket-Accept を "Incorrect hash received" で拒否・S2 記録）を避けるため MinimalWebSocket
 *  注入が要る。SSE（node:http の text/event-stream）はこの問題自体が消え、機械テストは素の
 *  node:http クライアントで読める。ゆえに SSE。
 *
 * ── 正本はプロセス側・UI は使い捨てのビュー ──────────────────────────────
 *  転写バッファ（正本）・死活・耳の状態はサーバが握る。**ブラウザのタブ（SSE 接続）が切れても
 *  魂（pipeline）は生き続ける**（SSE 切断は購読者集合から外すだけ）。開き直せば /api/state と
 *  SSE 接続時の初期 state で現状が復元される。魂を畳むのは close() だけ。
 *
 * ── バインドは 127.0.0.1 限定（外部露出の構造的防止）─────────────────────────
 *  listen は常に loopback。host option は loopback リテラルのみ許容し、非 loopback は throw
 *  （0.0.0.0 等でうっかり公開しない・blocking 基準 3）。認証は v0 なし（UX §4）。
 *
 * ── クリーンシャットダウン（S1/S2 教訓）───────────────────────────────────
 *  close() は冪等: 全 SSE 応答を end → pipeline.dispose() → http server close（closeAllConnections
 *  で生存接続を即断）。デバイス列挙の spawn タイマは unref。リークするタイマ/ハンドル/子プロセスを
 *  残さない（node:test が自然終了する型）。
 *
 * ── 既存コードは変更しない ────────────────────────────────────────────
 *  ear-pipeline / transcript-buffer / whisper-server / ffmpeg-capture は購読・呼び出しのみ。
 *  結線に必要なフックは全て既存 API（onVadEvent/onTranscript/onDiagnostic・transcriptBuffer.onDiscard・
 *  stats()）で足りる。
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import { createEarPipeline } from "../ears/ear-pipeline.mjs";
import { resolveFfmpegPath } from "../ears/ffmpeg-capture.mjs";
import { normalizeDevice } from "../cli/ears-cli.mjs";

/** コクピット既定 host（loopback 束縛・外に開かない）。 */
export const DEFAULT_COCKPIT_HOST = "127.0.0.1";
/** コクピット既定ポート（whisper 8178 / AivisSpeech 10101 / editor 5173 系と離す）。 */
export const DEFAULT_COCKPIT_PORT = 8181;
/** 状態スナップショットに載せる直近転写の件数（タブ開き直し時の復元用）。 */
export const DEFAULT_TRANSCRIPT_HISTORY = 200;

/** loopback リテラルのみ許容（非 loopback は外部露出になるため拒否）。 */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/**
 * host が loopback であることを保証する（非 loopback は throw）。
 * @param {string} host
 * @returns {string}
 */
export function assertLoopbackHost(host) {
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `cockpit-server: host must be loopback (127.0.0.1/::1/localhost); got "${host}". ` +
        "コクピットは外部公開しない（UX §4・blocking 基準 3）。"
    );
  }
  return host;
}

/** Domain A 既定の最小プレースホルダ HTML（Domain B が本体に差し替える）。 */
const PLACEHOLDER_HTML = `<!doctype html>
<meta charset="utf-8">
<title>Soul Cockpit</title>
<h1>Soul Cockpit</h1>
<p>Domain A placeholder. The real page is served by Domain B.</p>
<p>State: <code>GET /api/state</code> — Live: <code>GET /api/events</code> (SSE).</p>`;

/**
 * dshow の `-list_devices true` 出力からデバイス名を構造化抽出する純関数。
 *
 * 2 系統の ffmpeg 出力形式に両対応する:
 *  (旧) セクション見出し `DirectShow audio devices` / `DirectShow video devices` の下に `"名前"`。
 *  (新) 各行に `"名前" (audio)` / `"名前" (video)` の種別サフィックス。
 * `Alternative name "@device_..."` 行は直前デバイスの別名として畳む（種別行としては数えない）。
 *
 * @param {string} text  ffmpeg stderr 全文。
 * @returns {{ audio: Array<{ name: string; alternativeName: string | null }>; video: Array<{ name: string; alternativeName: string | null }> }}
 */
export function parseDshowDeviceList(text) {
  /** @type {Array<{ name: string; alternativeName: string | null }>} */
  const audio = [];
  /** @type {Array<{ name: string; alternativeName: string | null }>} */
  const video = [];
  /** @type {"audio" | "video" | null} */
  let section = null;
  /** @type {typeof audio | null} */
  let lastList = null;

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (/DirectShow video devices/i.test(line)) {
      section = "video";
      continue;
    }
    if (/DirectShow audio devices/i.test(line)) {
      section = "audio";
      continue;
    }

    // Alternative name 行（引用符を含むが device 名ではない）を先に処理する。
    const alt = line.match(/Alternative name\s+"([^"]+)"/i);
    if (alt) {
      if (lastList && lastList.length > 0) {
        lastList[lastList.length - 1].alternativeName = alt[1];
      }
      continue;
    }

    // device 名行: 引用符で囲まれた名前 + 任意の (audio)/(video) サフィックス。
    const m = line.match(/"([^"]+)"\s*(?:\((audio|video)\))?/i);
    if (m) {
      const name = m[1];
      const explicitKind = m[2] ? m[2].toLowerCase() : null;
      const kind = explicitKind ?? section;
      if (kind === "audio") {
        audio.push({ name, alternativeName: null });
        lastList = audio;
      } else if (kind === "video") {
        video.push({ name, alternativeName: null });
        lastList = video;
      }
      // 種別不明（セクション外・サフィックスなし）は採らない。
    }
  }

  return { audio, video };
}

/**
 * ffmpeg のデバイス列挙を実行して音声デバイス一覧を構造化して返す（録音はしない）。
 * dshow の一覧は stderr に出るので stderr を集めてパースする。spawnImpl 注入でテスト可能。
 *
 * @param {object} [options]
 * @param {string} [options.inputFormat]  既定 win32→"dshow"。
 * @param {string} [options.ffmpegPath]   既定 PATH 解決（env FFMPEG_PATH）。
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {number} [options.timeoutMs=5000]  列挙のハング保険。
 * @param {typeof spawn} [options.spawnImpl]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {Promise<{ devices: Array<{ name: string; alternativeName: string | null }>; inputFormat: string; error: string | null }>}
 */
export function enumerateDevices(options = {}) {
  const inputFormat = options.inputFormat ?? (process.platform === "win32" ? "dshow" : "");
  const ffmpegPath = resolveFfmpegPath(options.ffmpegPath, options.env);
  const spawnImpl = options.spawnImpl ?? spawn;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise((resolve) => {
    let stderrText = "";
    let settled = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;

    const finish = (/** @type {{ devices: any[]; inputFormat: string; error: string | null }} */ result) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeoutImpl(timer);
      resolve(result);
    };

    /** @type {import("node:child_process").ChildProcess} */
    let child;
    try {
      child = spawnImpl(
        ffmpegPath,
        ["-hide_banner", "-f", inputFormat || "dshow", "-list_devices", "true", "-i", "dummy"],
        { stdio: ["ignore", "ignore", "pipe"] }
      );
    } catch (err) {
      finish({ devices: [], inputFormat, error: `ffmpeg spawn failed: ${errMessage(err)}` });
      return;
    }

    timer = setTimeoutImpl(() => {
      try {
        child.kill();
      } catch {
        // best-effort
      }
      finish({ devices: [], inputFormat, error: `device enumeration timed out after ${timeoutMs}ms.` });
    }, timeoutMs);
    if (timer && typeof (/** @type {any} */ (timer).unref) === "function") {
      /** @type {any} */ (timer).unref();
    }

    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderrText += chunk;
      });
    }
    child.on("error", (err) => {
      finish({ devices: [], inputFormat, error: `ffmpeg spawn failed: ${errMessage(err)}` });
    });
    child.on("exit", () => {
      // -list_devices は dummy 入力で必ず非 0 終了する。一覧は stderr に出ているのでパースする。
      const parsed = parseDshowDeviceList(stderrText);
      finish({ devices: parsed.audio, inputFormat, error: null });
    });
  });
}

/**
 * 「最後に選んだデバイス」の in-memory settings store（既定・no-op 永続）。
 * file-backed 実体は Domain B が供給する（テストがディスクに触れないための分離）。
 * @param {string | null} [initial]
 * @returns {{ getLastDevice: () => string | null; setLastDevice: (device: string | null) => void }}
 */
export function createInMemorySettingsStore(initial = null) {
  let lastDevice = initial;
  return {
    getLastDevice: () => lastDevice,
    setLastDevice: (device) => {
      lastDevice = device;
    }
  };
}

/**
 * コクピット・サーバを作る（listen() で開き・close() で全畳み）。
 *
 * @param {object} [options]
 * @param {number} [options.port=DEFAULT_COCKPIT_PORT]  0 で自動割当（テスト用）。
 * @param {string} [options.host=DEFAULT_COCKPIT_HOST]  loopback リテラルのみ許容。
 * @param {string} [options.indexHtml]      配信する HTML 文字列（最優先）。
 * @param {string} [options.indexHtmlPath]  配信する HTML のファイルパス（B が本体を渡す）。
 * @param {string} [options.inputFormat]    ffmpeg 入力フォーマット（既定 win32→dshow）。
 * @param {number} [options.transcriptHistory=DEFAULT_TRANSCRIPT_HISTORY]  状態に載せる直近転写件数。
 * @param {{ getLastDevice: () => any; setLastDevice: (d: any) => any }} [options.settingsStore]
 *   既定は in-memory。get/set は同期でも Promise でもよい（await する）。
 * @param {object} [options.pipelineOptions]  createEarPipeline へ渡す追加設定（whisper/segmenter/asr 等）。
 * @param {typeof createEarPipeline} [options.pipelineFactory]  テスト注入（既定 createEarPipeline）。
 * @param {(opts?: object) => Promise<{ devices: any[]; inputFormat: string; error: string | null }>} [options.enumerateDevicesImpl]
 *   デバイス列挙の差し替え（テスト注入。既定は enumerateDevices）。
 * @param {() => number} [options.nowImpl]  uptime 用時計（既定 Date.now）。
 * @returns {{
 *   listen: (port?: number) => Promise<string>;
 *   url: () => string;
 *   close: () => Promise<void>;
 *   isListening: () => boolean;
 *   earsStatus: () => string;
 * }}
 */
export function createCockpitServer(options = {}) {
  const host = assertLoopbackHost(options.host ?? DEFAULT_COCKPIT_HOST);
  const defaultPort = options.port ?? DEFAULT_COCKPIT_PORT;
  const inputFormat = options.inputFormat ?? (process.platform === "win32" ? "dshow" : "");
  const transcriptHistory = options.transcriptHistory ?? DEFAULT_TRANSCRIPT_HISTORY;
  const settings = options.settingsStore ?? createInMemorySettingsStore();
  const pipelineFactory = options.pipelineFactory ?? createEarPipeline;
  const enumerateDevicesImpl = options.enumerateDevicesImpl ?? enumerateDevices;
  const nowImpl = options.nowImpl ?? Date.now;

  /** @type {Set<import("node:http").ServerResponse>} */
  const sseClients = new Set();

  /** @type {ReturnType<typeof createEarPipeline> | null} */
  let pipeline = null;
  /** @type {(() => void) | null} */
  let discardUnsub = null;
  /** @type {"stopped" | "starting" | "listening"} */
  let earsState = "stopped";
  /** @type {string | null} */
  let currentDevice = null;
  /** @type {number | null} */
  let startedAtMs = null;
  let transitioning = false;
  let closed = false;
  let boundPort = 0;

  const health = {
    /** @type {"up" | "down" | "unknown"} */ whisper: "unknown",
    /** @type {string | null} */ whisperReason: null,
    /** @type {"up" | "down" | "unknown"} */ ffmpeg: "unknown",
    /** @type {string | null} */ ffmpegReason: null
  };

  // ── 状態スナップショット ───────────────────────────────────────────

  /** @param {any} entry */
  const toWireEntry = (entry) => ({
    seq: entry.seq,
    startMs: entry.startMs,
    endMs: entry.endMs,
    text: entry.text,
    appendedAtMs: entry.appendedAtMs,
    speaker: "you" // v0 単一話者（buffer に speaker フィールドは無い）。
  });

  function snapshot() {
    const bufStats = pipeline ? pipeline.transcriptBuffer.stats() : { appended: 0, discarded: 0 };
    return {
      ears: earsState,
      device: currentDevice,
      health: {
        whisper: { status: health.whisper, reason: health.whisperReason },
        ffmpeg: { status: health.ffmpeg, reason: health.ffmpegReason }
      },
      appended: bufStats.appended,
      discarded: bufStats.discarded,
      uptimeMs: earsState === "listening" && startedAtMs != null ? Math.max(0, nowImpl() - startedAtMs) : 0,
      transcripts: pipeline ? pipeline.transcriptBuffer.last(transcriptHistory).map(toWireEntry) : []
    };
  }

  // ── SSE ライブチャネル ─────────────────────────────────────────────

  /**
   * @param {string} event
   * @param {unknown} data
   */
  function broadcast(event, data) {
    if (sseClients.size === 0) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(frame);
      } catch {
        // best-effort（切断済みは req 'close' で除去される）。
      }
    }
  }

  /** 現在状態を丸ごと push（ヘッダ/フッタの権威スナップショット）。 */
  function broadcastState() {
    broadcast("state", snapshot());
  }

  // ── 死活の反映 ─────────────────────────────────────────────────────

  /**
   * @param {"whisper" | "ffmpeg"} which
   * @param {"up" | "down" | "unknown"} status
   * @param {string | null} reason
   */
  function setHealth(which, status, reason) {
    const statusKey = which;
    const reasonKey = /** @type {"whisperReason" | "ffmpegReason"} */ (`${which}Reason`);
    if (health[statusKey] === status && health[reasonKey] === reason) return;
    health[statusKey] = status;
    health[reasonKey] = reason;
    broadcastState();
  }

  /** @param {any} d  pipeline の診断イベント。 */
  function handleDiagnostic(d) {
    if (d && d.type === "whisperDown") {
      setHealth(
        "whisper",
        "down",
        `whisper-server down (${d.phase ?? "runtime"}; code=${d.code ?? "?"}, signal=${d.signal ?? "?"})`
      );
    } else if (d && d.type === "ffmpegExit" && d.willRestart === false) {
      // willRestart=false = 再起動予算切れ/恒久死（capture の再起動耐性が尽きた）。
      // willRestart=true は capture が自己回復するため up のまま（transient blip）。
      setHealth("ffmpeg", "down", `ffmpeg exited (code=${d.code ?? "?"}, signal=${d.signal ?? "?"})`);
    }
    // 診断そのものも流す（B が任意で表示できる。健康以外は状態を変えない）。
    // startMs/endMs はゴースト行の対象 span（asrFailure が持つ・S2.5 追撃 domain-f）。
    // 元々 startMs/endMs を持たない診断型では null になるだけで契約破壊はない（追加フィールド）。
    broadcast("diagnostic", {
      type: d?.type ?? "unknown",
      message: d?.message ?? null,
      reason: d?.reason ?? null,
      startMs: d?.startMs ?? null,
      endMs: d?.endMs ?? null
    });
  }

  // ── 耳のライフサイクル ─────────────────────────────────────────────

  /**
   * @param {string | null} deviceRaw
   * @returns {Promise<{ ok: true; state: object } | { ok: false; error: string; state: object }>}
   */
  async function startEars(deviceRaw) {
    if (pipeline && earsState !== "stopped") {
      // 既に起動中/起動済み。冪等に現状を返す（デバイス変更は Stop→Start）。
      return { ok: true, state: snapshot() };
    }
    const device = normalizeDevice(deviceRaw ?? undefined, inputFormat) ?? null;
    currentDevice = deviceRaw ?? null;
    try {
      await settings.setLastDevice(currentDevice);
    } catch {
      // 永続化失敗は起動を止めない（B の file-backed 実体の I/O 失敗を握る）。
    }

    earsState = "starting";
    health.whisper = "unknown";
    health.whisperReason = null;
    health.ffmpeg = "unknown";
    health.ffmpegReason = null;

    const baseOptions = options.pipelineOptions ?? {};
    const p = pipelineFactory({
      ...baseOptions,
      capture: {
        ...(/** @type {any} */ (baseOptions).capture ?? {}),
        ...(device != null ? { device } : {}),
        ...(inputFormat ? { inputFormat } : {})
      },
      onVadEvent: (e) => {
        broadcast("vad", {
          type: e.type,
          tMs: e.tMs,
          startMs: e.startMs ?? null,
          endMs: e.endMs ?? null,
          durationMs: e.durationMs ?? null,
          reason: e.reason ?? null
        });
      },
      onTranscript: (entry, meta) => {
        const stats = pipeline ? pipeline.transcriptBuffer.stats() : { appended: 0, discarded: 0 };
        broadcast("transcript", {
          ...toWireEntry(entry),
          latencyMs: meta?.latencyMs ?? null,
          audioCtx: meta?.audioCtx ?? null,
          appended: stats.appended,
          discarded: stats.discarded
        });
      },
      onDiagnostic: handleDiagnostic
    });

    // discard 購読は transcriptBuffer 直参照（正本の破棄を footer の diagnostic 材料に）。
    discardUnsub = p.transcriptBuffer.onDiscard((info) => {
      const stats = p.transcriptBuffer.stats();
      broadcast("discard", {
        startMs: info.startMs,
        endMs: info.endMs,
        reason: info.reason,
        appended: stats.appended,
        discarded: stats.discarded
      });
    });

    pipeline = p;
    try {
      await p.start();
    } catch (error) {
      // start 失敗（whisper spawn 失敗等）: pipeline は自身で dispose 済み。状態を畳む。
      if (discardUnsub) {
        discardUnsub();
        discardUnsub = null;
      }
      pipeline = null;
      earsState = "stopped";
      startedAtMs = null;
      setHealth("whisper", "down", `ears failed to start: ${errMessage(error)}`);
      earsState = "stopped"; // setHealth の broadcast 後も stopped を確定。
      return { ok: false, error: errMessage(error), state: snapshot() };
    }

    earsState = "listening";
    startedAtMs = nowImpl();
    // start 成功 = whisper ready・ffmpeg spawn 済み（楽観的 up。以後の死は診断で down に落ちる）。
    health.whisper = "up";
    health.whisperReason = null;
    health.ffmpeg = "up";
    health.ffmpegReason = null;
    broadcastState();
    return { ok: true, state: snapshot() };
  }

  /** @returns {Promise<object>} 停止後の状態。 */
  async function stopEars() {
    if (!pipeline) {
      earsState = "stopped";
      return snapshot();
    }
    const p = pipeline;
    pipeline = null;
    if (discardUnsub) {
      discardUnsub();
      discardUnsub = null;
    }
    try {
      await p.dispose();
    } catch {
      // best-effort
    }
    earsState = "stopped";
    startedAtMs = null;
    health.whisper = "unknown";
    health.whisperReason = null;
    health.ffmpeg = "unknown";
    health.ffmpegReason = null;
    broadcastState();
    return snapshot();
  }

  // ── HTTP ルーティング ─────────────────────────────────────────────

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      sendJson(res, 500, { error: `internal error: ${errMessage(error)}` });
    });
  });

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   */
  async function handleRequest(req, res) {
    if (closed) {
      sendJson(res, 503, { error: "cockpit server is closing." });
      return;
    }
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const pathname = url.pathname;

    if (method === "GET" && pathname === "/") {
      await serveIndex(res);
      return;
    }
    if (method === "GET" && pathname === "/api/devices") {
      const result = await enumerateDevicesImpl({ inputFormat });
      sendJson(res, 200, {
        devices: result.devices,
        inputFormat: result.inputFormat,
        lastDevice: await resolveLastDevice(),
        error: result.error
      });
      return;
    }
    if (method === "GET" && pathname === "/api/state") {
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "GET" && pathname === "/api/events") {
      openSse(req, res);
      return;
    }
    if (method === "POST" && pathname === "/api/ears/start") {
      if (transitioning) {
        sendJson(res, 409, { error: "ears are transitioning; retry shortly.", state: snapshot() });
        return;
      }
      transitioning = true;
      try {
        const body = await readJsonBody(req);
        const deviceRaw = body.device ?? url.searchParams.get("device") ?? (await resolveLastDevice());
        const result = await startEars(deviceRaw ?? null);
        sendJson(res, result.ok ? 200 : 500, result.ok ? result.state : { error: result.error, state: result.state });
      } finally {
        transitioning = false;
      }
      return;
    }
    if (method === "POST" && pathname === "/api/ears/stop") {
      if (transitioning) {
        sendJson(res, 409, { error: "ears are transitioning; retry shortly.", state: snapshot() });
        return;
      }
      transitioning = true;
      try {
        const state = await stopEars();
        sendJson(res, 200, state);
      } finally {
        transitioning = false;
      }
      return;
    }

    sendJson(res, 404, { error: `not found: ${method} ${pathname}` });
  }

  async function serveIndex(res) {
    let htmlBody = options.indexHtml;
    if (htmlBody == null && options.indexHtmlPath != null) {
      try {
        htmlBody = await readFile(options.indexHtmlPath, "utf8");
      } catch (error) {
        sendText(res, 500, `failed to read index html: ${errMessage(error)}`);
        return;
      }
    }
    if (htmlBody == null) htmlBody = PLACEHOLDER_HTML;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(htmlBody);
  }

  /**
   * SSE 接続を開き、購読者集合へ加える。接続が切れても pipeline は畳まない（UI は使い捨て）。
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   */
  function openSse(req, res) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive"
    });
    // 接続直後に現在状態を 1 発（タブ開き直しの復元）。
    res.write(": connected\n\n");
    res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
    sseClients.add(res);
    // クライアント切断 = 購読解除のみ。魂は生き続ける（blocking 基準 5）。
    req.on("close", () => {
      sseClients.delete(res);
    });
  }

  async function resolveLastDevice() {
    try {
      return (await settings.getLastDevice()) ?? null;
    } catch {
      return null;
    }
  }

  // ── ライフサイクル ─────────────────────────────────────────────────

  return {
    listen(port = defaultPort) {
      return new Promise((resolve, reject) => {
        const onError = (/** @type {Error} */ err) => reject(err);
        server.once("error", onError);
        server.listen(port, host, () => {
          const address = server.address();
          boundPort = typeof address === "object" && address ? address.port : 0;
          server.removeListener("error", onError);
          resolve(`http://${host}:${boundPort}`);
        });
      });
    },
    url() {
      return `http://${host}:${boundPort}`;
    },
    isListening: () => server.listening,
    earsStatus: () => earsState,
    /**
     * 全畳み（冪等）: 全 SSE 応答を end → pipeline.dispose → http server close。
     * リークするタイマ/ハンドル/子プロセスを残さない。
     */
    async close() {
      if (closed) return;
      closed = true;
      for (const res of sseClients) {
        try {
          res.end();
        } catch {
          // best-effort
        }
      }
      sseClients.clear();
      if (discardUnsub) {
        discardUnsub();
        discardUnsub = null;
      }
      if (pipeline) {
        const p = pipeline;
        pipeline = null;
        try {
          await p.dispose();
        } catch {
          // best-effort
        }
      }
      earsState = "stopped";
      startedAtMs = null;
      await new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve(undefined));
      });
    }
  };
}

// ── HTTP レスポンスヘルパ ─────────────────────────────────────────────

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} obj
 */
function sendJson(res, status, obj) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {string} text
 */
function sendText(res, status, text) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

/**
 * POST の body を JSON として読む（非 JSON / 空は {} にフォールバック・上限 1MiB）。
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<Record<string, any>>}
 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    let aborted = false;
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        aborted = true;
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      if (aborted) return;
      if (data.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(data);
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

/** @param {unknown} err */
function errMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
