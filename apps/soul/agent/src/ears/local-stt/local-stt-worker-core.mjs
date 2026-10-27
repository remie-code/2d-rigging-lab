// @ts-check
/**
 * ローカルの文字起こしの子プロセスの中身（IPC の受け答え）— apps/soul/agent。
 *
 * 子プロセスの入口 `local-stt-worker.mjs` が sherpa-onnx-node を読み込んで `loadSherpa` として渡す。
 * この中身は sherpa を import しない（偽物の sherpa でテストできるように・親のテストから読んでも
 * onnxruntime.dll を読まない）。
 *
 * ── IPC（親 → 子）─────────────────────────────────────────────────────
 *  - `{ type: "init", engine, files, threads, hotwords, hotwordsScore }`  最初の 1 回。認識器を作る。
 *  - `{ type: "transcribe", id, pcm }`  pcm = Int16Array（16kHz mono・advanced serialization）。
 *  - `{ type: "shutdown" }`  後片付けして exit(0)。
 * ── IPC（子 → 親）─────────────────────────────────────────────────────
 *  - `{ type: "ready", loadMs, decodingMethod, hotwordsUsed, hotwordsDropped }`  認識器ができた。
 *    loadMs = sherpa の読み込み + 認識器（モデル）の読み込みの時間。
 *  - `{ type: "fatal", message }`  init の失敗（このあと exit(1)）。
 *  - `{ type: "result", id, text, ms }`  ms = 推論（decode）の時間。
 *  - `{ type: "error", id, message }`  その 1 発話の失敗（常駐は続く）。
 *
 *  推論は 1 発話ずつ直列（親の ASR キューも直列だが、子の側でも重ねない）。decodeAsync があれば使う
 *  （子のイベントループを塞がない＝shutdown や次の要求を受け取れる）。
 *  本文（text）は親へ返すだけで、ログ・標準エラーには出さない。
 */

import { buildRecognizerConfig, hotwordsToTokenPhrases, parseTokensText, LOCAL_STT_SAMPLE_RATE } from "./local-stt-engines.mjs";

/**
 * @param {object} deps
 * @param {() => any} deps.loadSherpa  sherpa-onnx-node を返す（入口が require する）。
 * @param {(message: object) => void} deps.send  親へ送る。
 * @param {(path: string) => string} deps.readTextFile  tokens.txt を読む（hotwords の可否の判定）。
 * @param {() => number} [deps.nowImpl]  計測の時計（既定 performance.now）。
 * @param {(code: number) => void} [deps.exit]  プロセスを終える（既定 何もしない）。
 * @returns {{ handle: (message: any) => Promise<void> }}
 */
export function createLocalSttWorkerCore(deps) {
  const nowImpl = deps.nowImpl ?? (() => performance.now());
  const exit = deps.exit ?? (() => {});
  /** @type {any} */
  let recognizer = null;
  /** @type {string | undefined} */
  let hotwordsArg;
  let initStarted = false;
  /** 推論の直列化チェーン。 */
  let chain = Promise.resolve();

  /** @param {any} msg */
  function init(msg) {
    if (initStarted) {
      deps.send({ type: "fatal", message: "init received twice" });
      return;
    }
    initStarted = true;
    try {
      const t0 = nowImpl();
      const engine = msg.engine;
      const threads = msg.threads;
      /** @type {string[]} */
      let used = [];
      /** @type {string[]} */
      let dropped = [];
      if (engine === "zipformer" && Array.isArray(msg.hotwords) && msg.hotwords.length > 0) {
        const tokenSet = parseTokensText(deps.readTextFile(msg.files.tokens));
        const conv = hotwordsToTokenPhrases(msg.hotwords, tokenSet);
        used = conv.used;
        dropped = conv.dropped;
        hotwordsArg = conv.phrases.length > 0 ? conv.phrases.join("/") : undefined;
      } else if (Array.isArray(msg.hotwords)) {
        // Parakeet（CTC）は hotwords を持たない。渡された語は「使っていない」として返す。
        dropped = engine === "parakeet" ? [...msg.hotwords] : [];
      }
      const config = buildRecognizerConfig(engine, msg.files, {
        threads,
        hotwordsEnabled: hotwordsArg !== undefined,
        hotwordsScore: typeof msg.hotwordsScore === "number" ? msg.hotwordsScore : undefined
      });
      const sherpa = deps.loadSherpa();
      recognizer = new sherpa.OfflineRecognizer(config);
      const loadMs = Math.round(nowImpl() - t0);
      deps.send({
        type: "ready",
        loadMs,
        decodingMethod: config.decodingMethod,
        hotwordsUsed: used,
        hotwordsDropped: dropped
      });
    } catch (error) {
      deps.send({ type: "fatal", message: errMessage(error) });
      exit(1);
    }
  }

  /** @param {any} msg */
  async function transcribe(msg) {
    const id = msg.id;
    try {
      if (!recognizer) throw new Error("recognizer is not ready");
      const pcm = msg.pcm;
      if (!(pcm instanceof Int16Array)) throw new TypeError("pcm must be an Int16Array");
      const samples = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i += 1) samples[i] = pcm[i] / 32768;
      const stream = hotwordsArg !== undefined ? recognizer.createStream(hotwordsArg) : recognizer.createStream();
      stream.acceptWaveform({ samples, sampleRate: LOCAL_STT_SAMPLE_RATE });
      const t0 = nowImpl();
      /** @type {any} */
      let result;
      if (typeof recognizer.decodeAsync === "function") {
        result = await recognizer.decodeAsync(stream);
      } else {
        recognizer.decode(stream);
        result = recognizer.getResult(stream);
      }
      const ms = Math.round(nowImpl() - t0);
      const text = result && typeof result.text === "string" ? result.text : "";
      deps.send({ type: "result", id, text, ms });
    } catch (error) {
      deps.send({ type: "error", id, message: errMessage(error) });
    }
  }

  return {
    async handle(message) {
      if (!message || typeof message !== "object") return;
      if (message.type === "init") {
        init(message);
      } else if (message.type === "transcribe") {
        const run = chain.then(() => transcribe(message));
        chain = run.catch(() => {});
        await run;
      } else if (message.type === "shutdown") {
        recognizer = null;
        exit(0);
      }
    }
  };
}

/** @param {unknown} error */
function errMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
