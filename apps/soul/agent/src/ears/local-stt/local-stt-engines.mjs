// @ts-check
/**
 * ローカルの文字起こし（Parakeet / Zipformer）の語彙・モデルの場所・設定の正規化・認識器の設定組み立て
 * — apps/soul/agent。
 *
 * 計画: discussion/ai-cohost/implementation/orchestration/local-stt-wave-plan.md §0・§1。
 * 根拠: discussion/ai-cohost/research/stt-candidates-2026-10.md §5（CPU 実測）・§6（同じプロセスで動かせない問題）。
 *
 * ── このファイルは親（魂の本体）からも子プロセスからも読む ──────────────────────
 *  **sherpa-onnx-node を import しない**（純関数と node:fs の存在確認だけ）。sherpa は耳の Silero VAD
 *  （onnxruntime-node 1.27.0）と onnxruntime.dll の版がぶつかり、同じプロセスでは後から読んだ方が落ちる
 *  （実測）。sherpa を読み込むのは子プロセスの入口 `local-stt-worker.mjs` だけ。
 *
 * ── モデル ────────────────────────────────────────────────────────────
 *  `vendor/models/`（git 外）。取得は `scripts/fetch-local-stt-models.mjs`（初回の Start で勝手に落とさない）。
 *   - parakeet:  NeMo Parakeet TDT-CTC 0.6B ja の CTC int8（sherpa-onnx 変換・csukuangfj/…-35000-int8）
 *   - zipformer: ReazonSpeech K2 v2（Zipformer transducer・k2-fsa/sherpa-onnx asr-models の 2024-08-01 int8）
 *
 * ── hotwords（Zipformer のみ）────────────────────────────────────────────
 *  sherpa の OfflineRecognizer.createStream(hotwords) で発話ごとに渡す（transducer + decodingMethod
 *  "modified_beam_search" のときだけ効く・sherpa-onnx-node の non-streaming-asr.js の JSDoc）。
 *  modelingUnit/bpeVocab を持たない（文字単位の）モデルでは、各語を tokens.txt の token を空白区切りで
 *  並べて表す。ReazonSpeech K2 v2 は文字単位なので「チャッピー」は「チ ャ ッ ピ ー」。tokens.txt に無い
 *  文字を含む語は渡さない（落とした語は ready で親へ知らせる）。Parakeet（CTC）には hotwords が無い。
 *  hotwords が空なら greedy_search（速い）。強さは認識器の hotwordsScore（既定 1.5 = sherpa の既定・設定ファイルで変えられる）。
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** agent パッケージルート（src/ の親）。vendor 既定パスの基準。 */
const AGENT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** ローカルの文字起こしのモデル置き場の既定（git 外）。 */
export const DEFAULT_LOCAL_STT_MODELS_DIR = path.join(AGENT_ROOT, "vendor", "models");

/** ローカルの文字起こしの方式（ear-pipeline の STT_ENGINES の部分集合）。 */
export const LOCAL_STT_ENGINES = Object.freeze(["parakeet", "zipformer"]);

/** 表示名（警告・理由の文言に使う）。 */
export const LOCAL_STT_ENGINE_TITLES = Object.freeze(
  /** @type {Record<string, string>} */ ({ parakeet: "Parakeet", zipformer: "Zipformer" })
);

/**
 * モデルの並び（フォルダ名とファイル名）。取得のコマンド（scripts/fetch-local-stt-models.mjs）と同じ並び。
 * @type {Readonly<Record<"parakeet" | "zipformer", Readonly<{ dir: string; files: Readonly<Record<string, string>> }>>>}
 */
export const LOCAL_STT_MODEL_LAYOUT = Object.freeze({
  parakeet: Object.freeze({
    dir: "parakeet-tdt_ctc-0.6b-ja-int8",
    files: Object.freeze({ model: "model.int8.onnx", tokens: "tokens.txt" })
  }),
  zipformer: Object.freeze({
    dir: "zipformer-ja-reazonspeech-2024-08-01-int8",
    files: Object.freeze({
      encoder: "encoder-epoch-99-avg-1.int8.onnx",
      decoder: "decoder-epoch-99-avg-1.int8.onnx",
      joiner: "joiner-epoch-99-avg-1.int8.onnx",
      tokens: "tokens.txt"
    })
  })
});

/** 既定（合意 §0: スレッド 2・本物の音を前に 0.2 秒・作り物の無音を前後に 0.3 秒・hotwords 2 語）。 */
export const LOCAL_STT_DEFAULTS = Object.freeze({
  threads: 2,
  preRollMs: 200,
  silencePadMs: 300,
  hotwords: Object.freeze(["チャッピー", "コーディ"]),
  hotwordsScore: 1.5
});

/** 設定ファイルの値の範囲（範囲外は既定）。 */
export const LOCAL_STT_LIMITS = Object.freeze({
  threads: Object.freeze({ min: 1, max: 16 }),
  preRollMs: Object.freeze({ min: 0, max: 1000 }),
  silencePadMs: Object.freeze({ min: 0, max: 1000 }),
  hotwordsScore: Object.freeze({ min: 0.1, max: 10 }),
  hotwordsMaxCount: 50,
  hotwordMaxChars: 32
});

/** 耳の PCM 形式（16kHz mono）。 */
export const LOCAL_STT_SAMPLE_RATE = 16000;

/**
 * @param {unknown} engine
 * @returns {engine is "parakeet" | "zipformer"}
 */
export function isLocalSttEngine(engine) {
  return typeof engine === "string" && LOCAL_STT_ENGINES.includes(engine);
}

/**
 * 設定ファイルの生の値を正規化する（範囲外・型違いは既定）。
 * @param {{ threads?: unknown; preRollMs?: unknown; silencePadMs?: unknown; hotwords?: unknown; hotwordsScore?: unknown } | null | undefined} raw
 * @returns {{ threads: number; preRollMs: number; silencePadMs: number; hotwords: string[]; hotwordsScore: number }}
 */
export function normalizeLocalSttSettings(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const intIn = (/** @type {unknown} */ v, /** @type {{ min: number; max: number }} */ lim, /** @type {number} */ d) =>
    typeof v === "number" && Number.isInteger(v) && v >= lim.min && v <= lim.max ? v : d;
  const numIn = (/** @type {unknown} */ v, /** @type {{ min: number; max: number }} */ lim, /** @type {number} */ d) =>
    typeof v === "number" && Number.isFinite(v) && v >= lim.min && v <= lim.max ? v : d;
  return {
    threads: intIn(r.threads, LOCAL_STT_LIMITS.threads, LOCAL_STT_DEFAULTS.threads),
    preRollMs: numIn(r.preRollMs, LOCAL_STT_LIMITS.preRollMs, LOCAL_STT_DEFAULTS.preRollMs),
    silencePadMs: numIn(r.silencePadMs, LOCAL_STT_LIMITS.silencePadMs, LOCAL_STT_DEFAULTS.silencePadMs),
    hotwords: normalizeHotwords(r.hotwords),
    hotwordsScore: numIn(r.hotwordsScore, LOCAL_STT_LIMITS.hotwordsScore, LOCAL_STT_DEFAULTS.hotwordsScore)
  };
}

/**
 * hotwords の正規化。配列でなければ既定。配列なら空でない文字列（前後の空白を落とし、32 文字以下）だけを
 * 重複なしで最大 50 個（空配列 = hotwords なし、として有効）。要素が 1 つも使えない非空配列も既定に戻す。
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeHotwords(value) {
  if (!Array.isArray(value)) return [...LOCAL_STT_DEFAULTS.hotwords];
  if (value.length === 0) return [];
  /** @type {string[]} */
  const out = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const w = v.trim();
    if (w.length === 0 || [...w].length > LOCAL_STT_LIMITS.hotwordMaxChars || out.includes(w)) continue;
    out.push(w);
    if (out.length >= LOCAL_STT_LIMITS.hotwordsMaxCount) break;
  }
  return out.length > 0 ? out : [...LOCAL_STT_DEFAULTS.hotwords];
}

/**
 * モデルのファイルの絶対パス。
 * @param {"parakeet" | "zipformer"} engine
 * @param {{ modelsDir?: string }} [opts]
 * @returns {{ dir: string; files: Record<string, string> }}
 */
export function resolveLocalSttModel(engine, opts = {}) {
  const layout = LOCAL_STT_MODEL_LAYOUT[engine];
  if (!layout) throw new RangeError(`resolveLocalSttModel: unknown engine ${JSON.stringify(engine)}.`);
  const dir = path.join(opts.modelsDir ?? DEFAULT_LOCAL_STT_MODELS_DIR, layout.dir);
  /** @type {Record<string, string>} */
  const files = {};
  for (const [role, name] of Object.entries(layout.files)) files[role] = path.join(dir, name);
  return { dir, files };
}

/**
 * モデルが揃っているか（無ければ Start を失敗にする理由の文言を返す・ElevenLabs のキー切れと同じ流儀）。
 * @param {"parakeet" | "zipformer"} engine
 * @param {{ modelsDir?: string; existsImpl?: (p: string) => boolean }} [opts]
 * @returns {{ ok: true } | { ok: false; reason: string; missing: string[] }}
 */
export function checkLocalSttModel(engine, opts = {}) {
  const existsImpl = opts.existsImpl ?? fileHasBytes;
  const { dir, files } = resolveLocalSttModel(engine, opts);
  const missing = Object.values(files).filter((p) => !existsImpl(p));
  if (missing.length === 0) return { ok: true };
  const title = LOCAL_STT_ENGINE_TITLES[engine] ?? engine;
  const names = missing.map((p) => path.basename(p)).join(", ");
  return {
    ok: false,
    missing,
    reason:
      `${title} のモデルが見つからない（${dir} に ${names} が無い）。` +
      "`node apps/soul/agent/scripts/fetch-local-stt-models.mjs` で取得できる"
  };
}

/** @param {string} p */
function fileHasBytes(p) {
  try {
    return existsSync(p) && statSync(p).isFile() && statSync(p).size > 0;
  } catch {
    return false;
  }
}

/**
 * 語を tokens.txt の token 列（空白区切り）に直す。文字単位のモデル前提（1 文字 = 1 token）。
 * 表せない文字を含む語は落とす。
 * @param {string[]} hotwords
 * @param {Set<string>} tokenSet
 * @returns {{ phrases: string[]; used: string[]; dropped: string[] }}
 */
export function hotwordsToTokenPhrases(hotwords, tokenSet) {
  /** @type {string[]} */ const phrases = [];
  /** @type {string[]} */ const used = [];
  /** @type {string[]} */ const dropped = [];
  for (const w of hotwords) {
    const chars = [...w].filter((c) => c.trim().length > 0);
    if (chars.length > 0 && chars.every((c) => tokenSet.has(c))) {
      phrases.push(chars.join(" "));
      used.push(w);
    } else {
      dropped.push(w);
    }
  }
  return { phrases, used, dropped };
}

/**
 * tokens.txt の本文 → token の集合（各行の先頭の欄）。
 * @param {string} text
 * @returns {Set<string>}
 */
export function parseTokensText(text) {
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\S+)\s+\d+\s*$/.exec(line);
    if (m) set.add(m[1]);
  }
  return set;
}

/**
 * sherpa の OfflineRecognizer の設定を組む（純関数・子プロセスが使う）。
 * decodingMethod は「Zipformer かつ hotwords あり」のときだけ modified_beam_search、それ以外は greedy_search。
 * @param {"parakeet" | "zipformer"} engine
 * @param {Record<string, string>} files  resolveLocalSttModel の files。
 * @param {{ threads: number; hotwordsEnabled?: boolean; hotwordsScore?: number }} opts
 * @returns {Record<string, any>}
 */
export function buildRecognizerConfig(engine, files, opts) {
  const common = { tokens: files.tokens, numThreads: opts.threads, provider: "cpu", debug: 0 };
  const featConfig = { sampleRate: LOCAL_STT_SAMPLE_RATE, featureDim: 80 };
  if (engine === "parakeet") {
    return { featConfig, modelConfig: { nemoCtc: { model: files.model }, ...common }, decodingMethod: "greedy_search" };
  }
  if (engine === "zipformer") {
    const beam = opts.hotwordsEnabled === true;
    return {
      featConfig,
      modelConfig: { transducer: { encoder: files.encoder, decoder: files.decoder, joiner: files.joiner }, ...common },
      decodingMethod: beam ? "modified_beam_search" : "greedy_search",
      ...(beam ? { maxActivePaths: 4, hotwordsScore: opts.hotwordsScore ?? LOCAL_STT_DEFAULTS.hotwordsScore } : {})
    };
  }
  throw new RangeError(`buildRecognizerConfig: unknown engine ${JSON.stringify(engine)}.`);
}

/**
 * 前後に作り物の無音を足す（ローカルの文字起こしに渡す音だけ・合意 §0 (b)）。
 * @param {Int16Array} samples
 * @param {number} padMs
 * @param {number} [sampleRate=16000]
 * @returns {Int16Array}
 */
export function padWithSilence(samples, padMs, sampleRate = LOCAL_STT_SAMPLE_RATE) {
  const n = Math.max(0, Math.round((padMs / 1000) * sampleRate));
  if (n === 0) return samples;
  const out = new Int16Array(samples.length + 2 * n);
  out.set(samples, n);
  return out;
}
