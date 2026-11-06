// @ts-check
/**
 * 音の種類の判定（CED-tiny int8・sherpa の AudioTagging）の置き場の決まりと純関数 — apps/soul/agent。
 *
 * 計画: discussion/ai-cohost/implementation/orchestration/cough-filter-stage2-plan.md §1・§2 の 1・2・3・7。
 * 根拠: discussion/ai-cohost/research/cough-filter-audio-tagging-2026-11.md（段階 1 の実験）。
 *
 * ── このファイルは親（魂の本体）からも子プロセスからも読む ──────────────────────
 *  **sherpa-onnx-node を import しない**（純関数と node:fs の存在確認だけ・local-stt-engines.mjs と同じ縛り）。
 *  AudioTagging を作るのは子の中身 `local-stt-worker-core.mjs`（入口が渡す loadSherpa の戻りで作る）。
 *  ここは置き場・設定の組み立て・文字数・のばし方・Speech の確率の取り出しだけ。
 *  咳払いの実験の道具（scripts/cough-experiment-lib.mjs）と取得の道具（scripts/fetch-local-stt-models.mjs）も
 *  ここを読む（実験の lib は re-export）。
 *
 * ── 判定の使い方（段階 2）────────────────────────────────────────────────
 *  - 子は文字起こしの文字数（`countChars`）が 1 以上かつ上限以下のときだけ判定にかけ、Speech の確率を返す。
 *  - 判定に渡す音は区間の音そのまま（余白込み）を 0 で 5 秒にのばしたもの（`padToDuration`・実験と同じ）。
 *  - 落とすか通すかを線と比べるのは親（ear-pipeline）。
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { DEFAULT_LOCAL_STT_MODELS_DIR, LOCAL_STT_SAMPLE_RATE } from "./local-stt-engines.mjs";

// ── 置き場 ─────────────────────────────────────────────────────────────

/**
 * CED-tiny（int8）の置き場（`vendor/models/` の下・git 外）。取得は `scripts/fetch-local-stt-models.mjs`
 * （既定で足りなければ取る・`--only ced-tiny` で CED だけ。配布元 k2-fsa/sherpa-onnx の Releases
 * `audio-tagging-models` の `sherpa-onnx-ced-tiny-audio-tagging-2024-04-19.tar.bz2` から 2 つだけ取り出す）。
 */
export const CED_TINY_MODEL_LAYOUT = Object.freeze({
  dir: "ced-tiny-audio-tagging-2024-04-19-int8",
  files: Object.freeze({ model: "model.int8.onnx", labels: "class_labels_indices.csv" })
});

/**
 * @param {{ modelsDir?: string }} [opts]
 * @returns {{ dir: string; files: { model: string; labels: string } }}
 */
export function resolveCedTinyModel(opts = {}) {
  const dir = path.join(opts.modelsDir ?? DEFAULT_LOCAL_STT_MODELS_DIR, CED_TINY_MODEL_LAYOUT.dir);
  return {
    dir,
    files: {
      model: path.join(dir, CED_TINY_MODEL_LAYOUT.files.model),
      labels: path.join(dir, CED_TINY_MODEL_LAYOUT.files.labels)
    }
  };
}

/**
 * CED-tiny が揃っているか（checkLocalSttModel と同じ流儀: ファイルがあり 0 byte でない）。
 * 理由は英語の 1 行（置き場のフォルダ・文字起こしの文字は入れない・ファイル名だけ）。
 * @param {{ modelsDir?: string; existsImpl?: (p: string) => boolean }} [opts]
 * @returns {{ ok: true; files: { model: string; labels: string } } | { ok: false; reason: string; missing: string[] }}
 */
export function checkCedTinyModel(opts = {}) {
  const existsImpl = opts.existsImpl ?? fileHasBytes;
  const { files } = resolveCedTinyModel(opts);
  const missing = Object.values(files).filter((p) => !existsImpl(p));
  if (missing.length === 0) return { ok: true, files };
  const names = missing.map((p) => path.basename(p)).join(", ");
  return { ok: false, missing, reason: `audio tagging model not found (missing ${names})` };
}

/** @param {string} p */
function fileHasBytes(p) {
  try {
    return existsSync(p) && statSync(p).isFile() && statSync(p).size > 0;
  } catch {
    return false;
  }
}

// ── 判定の設定 ───────────────────────────────────────────────────────────

/** AudioSet のラベルの番号（調査 §3・class_labels_indices.csv）。 */
export const AUDIO_TAGGING_LABEL_INDEX = Object.freeze({ speech: 0, cough: 47, throatClearing: 48 });

/** AudioSet の種類の数（ラベルの表が読めないときの既定・topK）。 */
export const AUDIOSET_CLASS_COUNT = 527;

/** 判定に渡す前にのばす長さ（調査 §1・§7: 1 秒未満のまま渡すと壊れる・2 秒は揺れた・5 秒で意味のある結果）。 */
export const AUDIO_TAGGING_TARGET_MS = 5000;

/** 判定のスレッド数（実験と同じ 1）。 */
export const AUDIO_TAGGING_THREADS = 1;

/**
 * class_labels_indices.csv の本文 → ラベルの数（見出しの行を除く空でない行）。
 * @param {string} text
 * @returns {number}
 */
export function countLabels(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const body = lines.length > 0 && /^index\s*,/i.test(lines[0]) ? lines.slice(1) : lines;
  return body.length;
}

/**
 * sherpa の AudioTagging の設定（CED）。
 * @param {{ model: string; labels: string }} files
 * @param {{ threads: number; topK: number }} opts
 * @returns {Record<string, any>}
 */
export function buildAudioTaggingConfig(files, opts) {
  return {
    model: { ced: files.model, numThreads: opts.threads, provider: "cpu", debug: 0 },
    labels: files.labels,
    topK: opts.topK
  };
}

// ── 判定にかけるか・入力・結果 ─────────────────────────────────────────────────

/**
 * 文字数（空白を除いたコードポイントの数・計画 §2 の 1）。実験の線と意味を揃える。
 * @param {string} text
 */
export function countChars(text) {
  return [...String(text).replace(/\s+/g, "")].length;
}

/**
 * 判定にかけるか（文字数が 1 以上かつ上限以下。上限が 0 なら判定しない）。
 * 0 文字（空）はかけない（空の文字起こしは親が blank で落とす）。
 * @param {string} text
 * @param {number} maxChars
 */
export function shouldTagTranscript(text, maxChars) {
  if (!(typeof maxChars === "number" && Number.isInteger(maxChars) && maxChars > 0)) return false;
  const n = countChars(text);
  return n >= 1 && n <= maxChars;
}

/**
 * 前後に同じだけ作り物の無音（0）を足して targetMs にのばす（もとから長ければそのまま）。
 * @param {Float32Array} samples
 * @param {number} [targetMs=AUDIO_TAGGING_TARGET_MS]
 * @param {number} [sampleRate=16000]
 * @returns {Float32Array}
 */
export function padToDuration(samples, targetMs = AUDIO_TAGGING_TARGET_MS, sampleRate = LOCAL_STT_SAMPLE_RATE) {
  if (!(samples instanceof Float32Array)) throw new TypeError("padToDuration: samples must be a Float32Array");
  const target = Math.max(0, Math.round((targetMs / 1000) * sampleRate));
  if (samples.length >= target) return samples;
  const out = new Float32Array(target);
  out.set(samples, Math.floor((target - samples.length) / 2));
  return out;
}

/**
 * AudioTagging.compute の結果（`[{ name, prob, index }]`）→ Speech の確率（番号で引く）。
 * 結果が配列でない・Speech の番号が無い・数でないときは null（判定できなかった = 落とさない側に倒す）。
 * @param {unknown} events
 * @returns {number | null}
 */
export function speechProbability(events) {
  if (!Array.isArray(events)) return null;
  const e = events.find((x) => x && typeof x === "object" && x.index === AUDIO_TAGGING_LABEL_INDEX.speech);
  return e && typeof e.prob === "number" && Number.isFinite(e.prob) ? e.prob : null;
}
