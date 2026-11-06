// @ts-check
/**
 * ローカルの文字起こしの子プロセスの中身（IPC の受け答え）— apps/soul/agent。
 *
 * 子プロセスの入口 `local-stt-worker.mjs` が sherpa-onnx-node を読み込んで `loadSherpa` として渡す。
 * この中身は sherpa を import しない（偽物の sherpa でテストできるように・親のテストから読んでも
 * onnxruntime.dll を読まない）。
 *
 * ── IPC（親 → 子）─────────────────────────────────────────────────────
 *  - `{ type: "init", engine, files, threads, hotwords, hotwordsScore, audioTagging? }`  最初の 1 回。認識器を作る。
 *    audioTagging = `{ model, labels, maxChars, threads? }`（CED-tiny の絶対パスと判定にかける文字数の上限）。
 *    無い・null なら判定なし。maxChars が正の整数でない（0 等）なら判定なし（AudioTagging も作らない）。
 *  - `{ type: "transcribe", id, pcm }`  pcm = Int16Array（16kHz mono・advanced serialization）。
 *  - `{ type: "shutdown" }`  後片付けして exit(0)。
 * ── IPC（子 → 親）─────────────────────────────────────────────────────
 *  - `{ type: "ready", loadMs, decodingMethod, hotwordsUsed, hotwordsDropped, audioTagging }`  認識器ができた。
 *    loadMs = sherpa の読み込み + 認識器（モデル）の読み込みの時間。
 *    audioTagging = `{ enabled: boolean, reason: string | null, loadMs: number | null }`（判定あり/なし・
 *    なしの理由は英語の短い 1 行で文字起こしの文字は入れない・loadMs は AudioTagging の読み込み時間）。
 *    **AudioTagging が作れなくても fatal にしない**（判定なしで文字起こしを続ける・咳払いの落とし 段階 2 §1）。
 *  - `{ type: "fatal", message }`  init の失敗（認識器が作れない。このあと exit(1)）。
 *  - `{ type: "result", id, text, ms, tagged, speech, tagMs }`  ms = 推論（decode）の時間。
 *    tagged = 判定にかけたか（判定あり・文字数 `countChars` が 1 以上かつ maxChars 以下）。
 *    speech = Speech の確率（判定にかけない・判定が失敗したときは null）。tagMs = 判定の時間（かけないときは null）。
 *    判定の失敗では error にしない（文字起こしの結果は必ず返す）。落とすか通すかは親が線と比べて決める。
 *  - `{ type: "error", id, message }`  その 1 発話の失敗（文字起こしの失敗・常駐は続く）。
 *
 *  推論は 1 発話ずつ直列（親の ASR キューも直列だが、子の側でも重ねない）。decodeAsync があれば使う
 *  （子のイベントループを塞がない＝shutdown や次の要求を受け取れる）。判定（AudioTagging.compute）は同期
 *  （短い区間だけ・1 回十数 ms の見積もり）。判定に渡す音は区間の pcm そのまま（余白込み）を 0 で 5 秒にのばしたもの。
 *  本文（text）と確率は親へ返すだけで、ログ・標準エラーには出さない。
 */

import { buildRecognizerConfig, hotwordsToTokenPhrases, parseTokensText, LOCAL_STT_SAMPLE_RATE } from "./local-stt-engines.mjs";
import {
  AUDIO_TAGGING_TARGET_MS,
  AUDIO_TAGGING_THREADS,
  AUDIOSET_CLASS_COUNT,
  buildAudioTaggingConfig,
  countLabels,
  padToDuration,
  shouldTagTranscript,
  speechProbability
} from "./audio-tagging.mjs";

/** 判定なしの理由の長さの上限（英語の 1 行）。 */
const REASON_MAX_CHARS = 200;

/**
 * @param {object} deps
 * @param {() => any} deps.loadSherpa  sherpa-onnx-node を返す（入口が require する）。
 * @param {(message: object) => void} deps.send  親へ送る。
 * @param {(path: string) => string} deps.readTextFile  tokens.txt を読む（hotwords の可否の判定）・判定のラベルの表を読む（topK）。
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
  /** 音の種類の判定（CED-tiny の AudioTagging・判定なしなら null）。 */
  /** @type {any} */
  let tagger = null;
  let tagMaxChars = 0;
  let tagTopK = AUDIOSET_CLASS_COUNT;
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
      const audioTagging = initTagger(sherpa, msg.audioTagging);
      deps.send({
        type: "ready",
        loadMs,
        decodingMethod: config.decodingMethod,
        hotwordsUsed: used,
        hotwordsDropped: dropped,
        audioTagging
      });
    } catch (error) {
      deps.send({ type: "fatal", message: errMessage(error) });
      exit(1);
    }
  }

  /**
   * 判定（AudioTagging）を作る。失敗しても throw しない（判定なしの理由を返す・認識器はそのまま使う）。
   * @param {any} sherpa
   * @param {any} opts  init の audioTagging。
   * @returns {{ enabled: boolean; reason: string | null; loadMs: number | null }}
   */
  function initTagger(sherpa, opts) {
    const off = (/** @type {string} */ reason) => ({ enabled: false, reason, loadMs: null });
    if (!opts || typeof opts !== "object") return off("not configured");
    const maxChars = opts.maxChars;
    if (!(typeof maxChars === "number" && Number.isInteger(maxChars) && maxChars > 0)) return off("disabled (max chars is 0)");
    if (typeof opts.model !== "string" || opts.model.length === 0 || typeof opts.labels !== "string" || opts.labels.length === 0) {
      return off("model paths are missing");
    }
    const t0 = nowImpl();
    try {
      let topK = AUDIOSET_CLASS_COUNT;
      try {
        const n = countLabels(deps.readTextFile(opts.labels));
        if (n > 0) topK = n;
      } catch {
        // ラベルの表が読めなければ AudioTagging の生成で失敗する（そちらの理由を返す）。
      }
      const threads =
        typeof opts.threads === "number" && Number.isInteger(opts.threads) && opts.threads > 0 ? opts.threads : AUDIO_TAGGING_THREADS;
      if (!sherpa || typeof sherpa.AudioTagging !== "function") throw new Error("AudioTagging is not available");
      tagger = new sherpa.AudioTagging(buildAudioTaggingConfig({ model: opts.model, labels: opts.labels }, { threads, topK }));
      tagTopK = topK;
      tagMaxChars = maxChars;
      return { enabled: true, reason: null, loadMs: Math.round(nowImpl() - t0) };
    } catch (error) {
      tagger = null;
      tagMaxChars = 0;
      return off(oneLine(`failed to load: ${errMessage(error)}`));
    }
  }

  /**
   * 区間の音の Speech の確率（失敗は null・throw しない）。
   * @param {Float32Array} samples  区間の音そのまま（余白込み）。
   * @returns {{ speech: number | null; tagMs: number }}
   */
  function tagSpeech(samples) {
    const t0 = nowImpl();
    /** @type {number | null} */
    let speech = null;
    try {
      const padded = padToDuration(samples, AUDIO_TAGGING_TARGET_MS, LOCAL_STT_SAMPLE_RATE);
      const stream = tagger.createStream();
      stream.acceptWaveform({ samples: padded, sampleRate: LOCAL_STT_SAMPLE_RATE });
      speech = speechProbability(tagger.compute(stream, tagTopK));
    } catch {
      speech = null;
    }
    return { speech, tagMs: Math.round(nowImpl() - t0) };
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
      /** @type {{ tagged: boolean; speech: number | null; tagMs: number | null }} */
      let tag = { tagged: false, speech: null, tagMs: null };
      if (tagger && shouldTagTranscript(text, tagMaxChars)) {
        const t = tagSpeech(samples);
        tag = { tagged: true, speech: t.speech, tagMs: t.tagMs };
      }
      deps.send({ type: "result", id, text, ms, ...tag });
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
        tagger = null;
        exit(0);
      }
    }
  };
}

/** @param {unknown} error */
function errMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** 改行を空白に寄せて短くする（判定なしの理由は 1 行）。 @param {string} s */
function oneLine(s) {
  return s.replace(/\s+/g, " ").trim().slice(0, REASON_MAX_CHARS);
}
