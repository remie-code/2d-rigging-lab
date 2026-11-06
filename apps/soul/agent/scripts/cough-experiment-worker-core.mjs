// @ts-check
/**
 * 咳払いの聞き取り実験の子プロセスの中身（文字起こし + 音の種類の判定）— apps/soul/agent。
 *
 * 計画: discussion/ai-cohost/implementation/orchestration/cough-experiment-plan.md §3 の 1・2。
 *
 * **本番の子を変えずに、本番と同じ文字起こしをする**: 文字起こしは本番の子の中身 `createLocalSttWorkerCore`
 * （src/ears/local-stt/local-stt-worker-core.mjs）をそのまま使う（同じ設定の組み立て・hotwords・decodeAsync・直列）。
 * この中身はその外側に、CED-tiny int8 の `AudioTagging` を足すだけ:
 *  - init: 先に AudioTagging を作る（失敗は fatal → exit(1)）。そのあと init を本番の中身へ渡す（ready はそのまま返す・
 *    判定の読み込み時間 `taggerLoadMs` を足す）。
 *  - transcribe: 本番の中身が result を返すとき、同じ pcm を無音で約 5 秒にのばして判定し、**result の前に**
 *    `{ type: "tags", id, speech, cough, throatClearing, topLabel, topIndex, topProb, tagMs, taggedMs }` を送る。
 *    親の `createLocalSttClient` は知らない種類の知らせを読み捨てるので、本番の係のまま使える（判定の知らせは
 *    実験の道具が fork に足した受け口で読む）。
 *  - 本文・音はログ・標準エラーに出さない。判定の知らせに音（サンプル）は載せない。
 *
 * sherpa を import しない（入口 `cough-experiment-worker.mjs` が require して loadSherpa として渡す）。
 */

import { createLocalSttWorkerCore } from "../src/ears/local-stt/local-stt-worker-core.mjs";
import { LOCAL_STT_SAMPLE_RATE } from "../src/ears/local-stt/local-stt-engines.mjs";
import { int16ToFloat32 } from "../src/ears/pcm-framing.mjs";
import {
  AUDIO_TAGGING_TARGET_MS,
  AUDIOSET_CLASS_COUNT,
  buildAudioTaggingConfig,
  countLabels,
  padToDuration,
  summarizeAudioEvents
} from "./cough-experiment-lib.mjs";

/**
 * 入口の引数（`--ced-model <path> --ced-labels <path> [--ced-threads <n>]`）→ 判定のファイルとスレッド。
 * @param {string[]} argv
 * @returns {{ model?: string; labels?: string; threads?: number }}
 */
export function parseTaggerArgs(argv) {
  /** @type {{ model?: string; labels?: string; threads?: number }} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--ced-model") out.model = argv[++i];
    else if (a === "--ced-labels") out.labels = argv[++i];
    else if (a === "--ced-threads") out.threads = Number(argv[++i]);
  }
  return out;
}

/**
 * @param {object} deps
 * @param {() => any} deps.loadSherpa
 * @param {(message: object) => void} deps.send
 * @param {(path: string) => string} deps.readTextFile
 * @param {{ model?: string; labels?: string; threads?: number }} deps.tagger  CED-tiny のファイルとスレッド（入口の引数）。
 * @param {number} [deps.targetMs=AUDIO_TAGGING_TARGET_MS]
 * @param {() => number} [deps.nowImpl]
 * @param {(code: number) => void} [deps.exit]
 * @returns {{ handle: (message: any) => Promise<void> }}
 */
export function createCoughExperimentWorkerCore(deps) {
  const nowImpl = deps.nowImpl ?? (() => performance.now());
  const exit = deps.exit ?? (() => {});
  const targetMs = deps.targetMs ?? AUDIO_TAGGING_TARGET_MS;
  /** @type {any} */
  let tagger = null;
  let topK = AUDIOSET_CLASS_COUNT;
  let taggerLoadMs = 0;
  let initSeen = false;
  /** 判定を待つ pcm（id → pcm）。result / error で消す（音はメモリの中だけ）。 */
  /** @type {Map<unknown, Int16Array>} */
  const pending = new Map();

  const stt = createLocalSttWorkerCore({
    loadSherpa: deps.loadSherpa,
    readTextFile: deps.readTextFile,
    nowImpl: deps.nowImpl,
    exit,
    send: forward
  });

  /** 本番の中身からの知らせ → 親へ（result の前に判定の知らせを挟む）。 @param {any} message */
  function forward(message) {
    if (message && message.type === "ready") {
      deps.send({ ...message, taggerLoadMs });
      return;
    }
    if (message && message.type === "result") {
      const pcm = pending.get(message.id);
      pending.delete(message.id);
      deps.send(tagMessage(message.id, pcm));
      deps.send(message);
      return;
    }
    if (message && message.type === "error") pending.delete(message.id);
    deps.send(message);
  }

  /** @param {unknown} id @param {Int16Array | undefined} pcm */
  function tagMessage(id, pcm) {
    try {
      if (!tagger) throw new Error("audio tagger is not ready");
      if (!(pcm instanceof Int16Array)) throw new TypeError("pcm must be an Int16Array");
      const samples = padToDuration(int16ToFloat32(pcm), targetMs, LOCAL_STT_SAMPLE_RATE);
      const stream = tagger.createStream();
      stream.acceptWaveform({ samples, sampleRate: LOCAL_STT_SAMPLE_RATE });
      const t0 = nowImpl();
      const events = tagger.compute(stream, topK);
      const tagMs = Math.round(nowImpl() - t0);
      const s = summarizeAudioEvents(events);
      return {
        type: "tags",
        id,
        speech: s.speech,
        cough: s.cough,
        throatClearing: s.throatClearing,
        topLabel: s.topLabel,
        topIndex: s.topIndex,
        topProb: s.topProb,
        tagMs,
        taggedMs: Math.round((samples.length / LOCAL_STT_SAMPLE_RATE) * 1000)
      };
    } catch (error) {
      return { type: "tags", id, error: error instanceof Error ? error.message : String(error) };
    }
  }

  function initTagger() {
    const files = deps.tagger ?? {};
    if (typeof files.model !== "string" || typeof files.labels !== "string") {
      throw new Error("audio tagging model paths are missing (--ced-model / --ced-labels)");
    }
    const t0 = nowImpl();
    try {
      const n = countLabels(deps.readTextFile(files.labels));
      if (n > 0) topK = n;
    } catch {
      // ラベルの表が読めなければ AudioTagging の生成で失敗する（そちらの理由を返す）。
    }
    const threads = typeof files.threads === "number" && Number.isInteger(files.threads) && files.threads > 0 ? files.threads : 1;
    const sherpa = deps.loadSherpa();
    tagger = new sherpa.AudioTagging(buildAudioTaggingConfig({ model: files.model, labels: files.labels }, { threads, topK }));
    taggerLoadMs = Math.round(nowImpl() - t0);
  }

  return {
    async handle(message) {
      if (!message || typeof message !== "object") return;
      if (message.type === "init") {
        if (!initSeen) {
          initSeen = true;
          try {
            initTagger();
          } catch (error) {
            deps.send({ type: "fatal", message: `audio tagging: ${error instanceof Error ? error.message : String(error)}` });
            exit(1);
            return;
          }
        }
        await stt.handle(message);
      } else if (message.type === "transcribe") {
        if (message.pcm instanceof Int16Array) pending.set(message.id, message.pcm);
        await stt.handle(message);
        pending.delete(message.id);
      } else if (message.type === "shutdown") {
        tagger = null;
        pending.clear();
        await stt.handle(message);
      }
    }
  };
}
