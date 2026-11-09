// @ts-check
/**
 * ローカルの文字起こしの子プロセスを親から扱う係（fork・ready・転写・異常終了の検知・dispose）
 * — apps/soul/agent。
 *
 * 計画: discussion/ai-cohost/implementation/orchestration/local-stt-wave-plan.md §1 の 1。
 *
 * ── 親で sherpa-onnx-node を import しない ─────────────────────────────────
 *  このファイルは `local-stt-worker.mjs` を **fork するだけ**（パスを渡す。import しない）。sherpa は
 *  子プロセスの中でだけ読み込まれる（onnxruntime.dll の版がぶつかるため・local-stt-worker.mjs のヘッダ）。
 *
 * ── 形 ─────────────────────────────────────────────────────────────────
 *  - fork 直後に init を送り、子の `ready`（読み込み時間つき）で `ready` Promise が解決する。
 *    ready 前の `fatal` / 終了 / readyTimeoutMs 超過は `ready` の reject（= 耳の Start 失敗）。
 *  - `transcribe(wavBytes)` → `{ text, rawText, ms, tagged, speech, tagMs }`。WAV（encodeWav の出力）から PCM を
 *    取り出し、Int16Array のまま送る（advanced serialization）。要求ごとに id を振り、応答の id で突き合わせる。
 *    tagged / speech / tagMs は子の音の種類の判定（咳払いの落とし 段階 2・local-stt-worker-core.mjs のヘッダ）:
 *    tagged = 判定にかけたか、speech = Speech の確率（かけない・失敗は null）。落とすか通すかは呼び出し側が決める。
 *  - 判定（`audioTaggingMaxChars` が正の整数のときだけ）: CED-tiny のファイル（既定 `<modelsDir>/ced-tiny-…`）が
 *    揃っていれば init に載せる。揃っていなければ載せず「判定なし」（ready は失敗させない）。判定あり/なしと
 *    理由は `ready`（と onReady）の `audioTagging: { enabled, reason }` で呼び出し側が受け取る。
 *  - ready 後の子の終了（落ちた）は `onExit({ code, signal })`（dispose で畳んだときは呼ばない）。
 *    応答待ちの要求は全部 reject（= その発話の転写の失敗）。再起動はしない（whisper と同じ設計判断:
 *    モデルの読み込みを自動で繰り返して配信中の CPU を荒らさない・人間の Stop→Start に委ねる）。
 *  - `dispose()` = 応答待ちを reject → kill → stdio を destroy → IPC を切る → unref。冪等。
 */

import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readWavPcm } from "../../voice/wav-pcm.mjs";
import { resolveLocalSttModel, LOCAL_STT_SAMPLE_RATE } from "./local-stt-engines.mjs";
import { checkCedTinyModel } from "./audio-tagging.mjs";

/** 子プロセスの入口（sherpa を読み込む唯一のファイル）。 */
export const DEFAULT_LOCAL_STT_WORKER_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "local-stt-worker.mjs"
);

/**
 * 判定あり/なし（`ready` の `audioTagging`）。reason は判定なしの理由（英語の短い 1 行・文字起こしの文字は入れない）。
 * @typedef {{ enabled: boolean; reason: string | null }} LocalSttAudioTaggingInfo
 */

/**
 * @typedef {{ loadMs: number; decodingMethod: string; hotwordsUsed: string[]; hotwordsDropped: string[]; audioTagging: LocalSttAudioTaggingInfo }} LocalSttReadyInfo
 */

/**
 * transcribe の戻り。tagged = 子が判定にかけたか、speech = Speech の確率（かけない・失敗は null）、tagMs = 判定の時間。
 * @typedef {{ text: string; rawText: string; ms: number; tagged: boolean; speech: number | null; tagMs: number | null }} LocalSttTranscribeResult
 */

/** 判定なしの理由の長さの上限。 */
const REASON_MAX_CHARS = 200;

/**
 * @param {object} options
 * @param {"parakeet" | "zipformer" | "haas"} options.engine
 * @param {string} [options.modelsDir]  モデル置き場（既定 vendor/models）。CED-tiny もここから探す。
 * @param {number} options.threads
 * @param {string[]} [options.hotwords]  Zipformer のみ効く（Parakeet では使わない）。
 * @param {number} [options.hotwordsScore]  hotwords の強さ（省略時は子の既定 1.5）。
 * @param {number} [options.audioTaggingMaxChars]  判定にかける文字数の上限（正の整数で判定あり・省略や 0 は判定なし）。
 * @param {(p: string) => boolean} [options.existsImpl]  テスト注入（CED-tiny のファイルの有無・既定はファイルがあり 0 byte でない）。
 * @param {number} [options.readyTimeoutMs=120000]
 * @param {(info: { code: number | null; signal: string | null }) => void} [options.onExit]  ready 後に落ちた。
 * @param {(info: LocalSttReadyInfo) => void} [options.onReady]
 * @param {(line: string) => void} [options.onStderr]  子の標準エラー（省略時も必ず読み捨てる）。
 * @param {typeof fork} [options.forkImpl]  テスト注入。
 * @param {string} [options.workerPath]  テスト注入（偽物の子プロセス）。
 * @param {string[]} [options.workerArgs]  テスト注入（偽物の子プロセスへの引数）。
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {{
 *   ready: Promise<LocalSttReadyInfo>;
 *   transcribe: (wavBytes: Uint8Array, text?: string) => Promise<LocalSttTranscribeResult>;
 *   hasExited: () => boolean;
 *   isDisposed: () => boolean;
 *   pending: () => number;
 *   dispose: () => void;
 * }}
 */
export function createLocalSttClient(options) {
  const engine = options.engine;
  const forkImpl = options.forkImpl ?? fork;
  const workerPath = options.workerPath ?? DEFAULT_LOCAL_STT_WORKER_PATH;
  const readyTimeoutMs = options.readyTimeoutMs ?? 120000;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const files = engine === "haas" ? {} : resolveLocalSttModel(engine, { modelsDir: options.modelsDir }).files;
  const tagPlan = planAudioTagging(options);

  let disposed = false;
  let exited = false;
  let isReady = false;
  let nextId = 1;
  /** @type {Map<number, { resolve: (v: LocalSttTranscribeResult) => void; reject: (e: Error) => void }>} */
  const pendingMap = new Map();

  /** @type {(v: any) => void} */
  let resolveReady = () => {};
  /** @type {(e: Error) => void} */
  let rejectReady = () => {};
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // ready を await しない経路（dispose 先行等）で unhandled rejection にしない。
  ready.catch(() => {});

  const child = forkImpl(workerPath, options.workerArgs ?? [], {
    serialization: "advanced",
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    execArgv: [],
    windowsHide: true
  });

  // 子の出力は必ず読み捨てる（sherpa のログでパイプが詰まって子が止まるのを防ぐ）。
  child.stdout?.resume();
  if (child.stderr) {
    if (options.onStderr) lineReader(child.stderr, options.onStderr);
    else child.stderr.resume();
  }

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let readyTimer = setTimeoutImpl(() => {
    readyTimer = undefined;
    if (isReady || disposed || exited) return;
    rejectReady(new Error(`local STT (${engine}) not ready within ${readyTimeoutMs}ms.`));
    killChild();
  }, readyTimeoutMs);

  const clearReadyTimer = () => {
    if (readyTimer !== undefined) {
      clearTimeoutImpl(/** @type {any} */ (readyTimer));
      readyTimer = undefined;
    }
  };

  /** @param {Error} error */
  const rejectAllPending = (error) => {
    for (const [, p] of pendingMap) p.reject(error);
    pendingMap.clear();
  };

  child.on("message", (/** @type {any} */ msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "ready") {
      if (isReady || disposed) return;
      isReady = true;
      clearReadyTimer();
      /** @type {LocalSttReadyInfo} */
      const info = {
        loadMs: typeof msg.loadMs === "number" ? msg.loadMs : NaN,
        decodingMethod: typeof msg.decodingMethod === "string" ? msg.decodingMethod : "unknown",
        hotwordsUsed: Array.isArray(msg.hotwordsUsed) ? msg.hotwordsUsed : [],
        hotwordsDropped: Array.isArray(msg.hotwordsDropped) ? msg.hotwordsDropped : [],
        audioTagging: tagPlan.init ? readyAudioTagging(msg.audioTagging) : { enabled: false, reason: tagPlan.reason }
      };
      try {
        options.onReady?.(info);
      } catch {
        // 通知の失敗で耳を止めない。
      }
      resolveReady(info);
    } else if (msg.type === "fatal") {
      clearReadyTimer();
      rejectReady(new Error(`local STT (${engine}) failed to load: ${String(msg.message ?? "unknown")}`));
    } else if (msg.type === "result" || msg.type === "error") {
      const p = pendingMap.get(msg.id);
      if (!p) return;
      pendingMap.delete(msg.id);
      if (msg.type === "result") {
        const text = typeof msg.text === "string" ? msg.text : "";
        const tagged = msg.tagged === true;
        p.resolve({
          text: text.trim(),
          rawText: text,
          ms: typeof msg.ms === "number" ? msg.ms : NaN,
          tagged,
          speech: tagged && typeof msg.speech === "number" && Number.isFinite(msg.speech) ? msg.speech : null,
          tagMs: tagged && typeof msg.tagMs === "number" && Number.isFinite(msg.tagMs) ? msg.tagMs : null
        });
      } else {
        p.reject(new Error(`local STT (${engine}) failed: ${String(msg.message ?? "unknown")}`));
      }
    }
  });

  /** @param {number | null} code @param {string | null} signal */
  const handleExit = (code, signal) => {
    if (exited) return;
    exited = true;
    clearReadyTimer();
    const error = new Error(`local STT (${engine}) process exited (code ${code}, signal ${signal}).`);
    rejectAllPending(error);
    if (!isReady) {
      rejectReady(error);
      return;
    }
    if (!disposed) {
      try {
        options.onExit?.({ code, signal });
      } catch {
        // 通知の失敗で耳を止めない。
      }
    }
  };
  child.on("exit", (code, signal) => handleExit(code, signal));
  child.on("error", (err) => {
    // fork 自体の失敗（node 実行ファイル不在等）や IPC の送信失敗。exit が来ないことがあるので終了として扱う。
    if (options.onStderr) {
      try {
        options.onStderr(`local STT process error: ${err instanceof Error ? err.message : String(err)}`);
      } catch {
        // best-effort
      }
    }
    handleExit(-1, null);
  });

  try {
    child.send({
      type: "init",
      engine,
      files,
      threads: options.threads,
      hotwords: options.hotwords ?? [],
      hotwordsScore: options.hotwordsScore,
      ...(tagPlan.init ? { audioTagging: tagPlan.init } : {})
    });
  } catch (error) {
    rejectReady(new Error(`local STT (${engine}) init send failed: ${error instanceof Error ? error.message : String(error)}`));
  }

  function killChild() {
    try {
      child.kill();
    } catch {
      // best-effort
    }
    try {
      child.stdout?.destroy();
      child.stderr?.destroy();
    } catch {
      // best-effort
    }
    try {
      if (child.connected) child.disconnect();
    } catch {
      // best-effort
    }
    try {
      child.unref();
    } catch {
      // best-effort
    }
  }

  return {
    ready,
    hasExited: () => exited,
    isDisposed: () => disposed,
    pending: () => pendingMap.size,

    transcribe(wavBytes, text) {
      if (disposed) return Promise.reject(new Error(`local STT (${engine}) disposed.`));
      if (exited) return Promise.reject(new Error(`local STT (${engine}) process is not running.`));
      if (!isReady) return Promise.reject(new Error(`local STT (${engine}) is not ready.`));
      /** @type {Int16Array} */
      let pcm;
      try {
        const wav = readWavPcm(wavBytes);
        if (wav.sampleRate !== LOCAL_STT_SAMPLE_RATE || wav.channels !== 1) {
          throw new RangeError(`expected 16kHz mono; got ${wav.sampleRate}Hz x${wav.channels}`);
        }
        // subarray の位置が 2 byte 境界とは限らないのでコピーしてから Int16Array にする。
        const bytes = wav.pcm.slice();
        pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        pendingMap.set(id, { resolve, reject });
        try {
          child.send({ type: "transcribe", id, pcm, ...(engine === "haas" ? { text } : {}) });
        } catch (error) {
          pendingMap.delete(id);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      clearReadyTimer();
      rejectAllPending(new Error(`local STT (${engine}) disposed.`));
      rejectReady(new Error(`local STT (${engine}) disposed before ready.`));
      killChild();
    }
  };
}

/**
 * 判定を init に載せるか（載せない理由つき）。CED-tiny が揃っていなければ載せない（Start は失敗させない）。
 * @param {{ modelsDir?: string; audioTaggingMaxChars?: number; existsImpl?: (p: string) => boolean }} options
 * @returns {{ init: { model: string; labels: string; maxChars: number } | null; reason: string | null }}
 */
export function planAudioTagging(options) {
  const maxChars = options.audioTaggingMaxChars;
  if (maxChars === undefined || maxChars === null) return { init: null, reason: "not configured" };
  if (!(typeof maxChars === "number" && Number.isInteger(maxChars) && maxChars > 0)) {
    return { init: null, reason: "disabled (max chars is 0)" };
  }
  const check = checkCedTinyModel({ modelsDir: options.modelsDir, existsImpl: options.existsImpl });
  if (!check.ok) return { init: null, reason: check.reason };
  return { init: { model: check.files.model, labels: check.files.labels, maxChars }, reason: null };
}

/**
 * 子の ready の audioTagging → 呼び出し側の形（子が知らせなければ判定なし）。
 * @param {any} raw
 * @returns {LocalSttAudioTaggingInfo}
 */
function readyAudioTagging(raw) {
  if (!raw || typeof raw !== "object") return { enabled: false, reason: "worker did not report audio tagging" };
  if (raw.enabled === true) return { enabled: true, reason: null };
  const reason = typeof raw.reason === "string" && raw.reason.length > 0 ? raw.reason.replace(/\s+/g, " ").slice(0, REASON_MAX_CHARS) : "unknown";
  return { enabled: false, reason };
}

/**
 * ストリームを行単位に割ってコールバックへ流す（whisper-server.mjs と同型の簡易 line reader）。
 * @param {import("node:stream").Readable} stream
 * @param {(line: string) => void} onLine
 */
function lineReader(stream, onLine) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        try {
          onLine(line);
        } catch {
          // best-effort
        }
      }
    }
  });
}
