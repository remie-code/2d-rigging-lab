// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  AUDIO_TAGGING_LABEL_INDEX,
  AUDIO_TAGGING_TARGET_MS,
  AUDIO_TAGGING_THREADS,
  AUDIOSET_CLASS_COUNT,
  CED_TINY_MODEL_LAYOUT,
  buildAudioTaggingConfig,
  checkCedTinyModel,
  countChars,
  countLabels,
  padToDuration,
  resolveCedTinyModel,
  shouldTagTranscript,
  speechProbability
} from "./audio-tagging.mjs";
import * as experimentLib from "../../../scripts/cough-experiment-lib.mjs";
import { DEFAULT_LOCAL_STT_MODELS_DIR } from "./local-stt-engines.mjs";

// 音の種類の判定（CED-tiny）の置き場の決まりと純関数（咳払いの落とし 段階 2 §2 の 1・2・7）。モデル・sherpa は読まない。

test("audio-tagging: CED-tiny の置き場（既定 vendor/models の下）と存在の確かめ（英語の 1 行・フォルダは出さない）", () => {
  assert.deepEqual(CED_TINY_MODEL_LAYOUT, {
    dir: "ced-tiny-audio-tagging-2024-04-19-int8",
    files: { model: "model.int8.onnx", labels: "class_labels_indices.csv" }
  });
  const def = resolveCedTinyModel();
  assert.equal(def.dir, path.join(DEFAULT_LOCAL_STT_MODELS_DIR, "ced-tiny-audio-tagging-2024-04-19-int8"));
  const { dir, files } = resolveCedTinyModel({ modelsDir: "/models" });
  assert.equal(dir, path.join("/models", "ced-tiny-audio-tagging-2024-04-19-int8"));
  assert.equal(files.model, path.join(dir, "model.int8.onnx"));
  assert.equal(files.labels, path.join(dir, "class_labels_indices.csv"));

  assert.deepEqual(checkCedTinyModel({ modelsDir: "/models", existsImpl: () => true }), { ok: true, files });
  const r = checkCedTinyModel({ modelsDir: "/models", existsImpl: (p) => !p.endsWith(".onnx") });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.missing, [files.model]);
  assert.equal(r.reason, "audio tagging model not found (missing model.int8.onnx)");
  assert.equal(r.reason.includes("\n"), false);
  assert.equal(r.reason.includes(dir), false, "置き場のフォルダ（利用者のパス）は理由に入れない");
});

test("audio-tagging: 文字数は空白を除いたコードポイントの数・判定にかけるのは 1 以上かつ上限以下（上限 0 は判定しない）", () => {
  assert.equal(countChars("うん"), 2);
  assert.equal(countChars(" う ん　"), 2, "半角・全角の空白を数えない");
  assert.equal(countChars("𠮷"), 1, "サロゲートペアは 1 文字");
  assert.equal(countChars(""), 0);

  assert.equal(shouldTagTranscript("うん", 4), true);
  assert.equal(shouldTagTranscript("うんうん", 4), true, "上限ちょうどはかける");
  assert.equal(shouldTagTranscript("うん うん", 4), true, "空白は数えない");
  assert.equal(shouldTagTranscript("こんにちは", 4), false, "上限を超えたらかけない");
  assert.equal(shouldTagTranscript("", 4), false, "空はかけない");
  assert.equal(shouldTagTranscript("   ", 4), false, "空白だけもかけない");
  assert.equal(shouldTagTranscript("うん", 0), false, "上限 0 は判定しない");
  assert.equal(shouldTagTranscript("うん", -1), false);
  assert.equal(shouldTagTranscript("うん", 2.5), false);
  assert.equal(shouldTagTranscript("うん", /** @type {any} */ ("4")), false);
});

test("audio-tagging: 5 秒にのばす（前後に同じだけ 0）・設定（CED）・ラベルの数", () => {
  assert.equal(AUDIO_TAGGING_TARGET_MS, 5000);
  assert.equal(AUDIO_TAGGING_THREADS, 1);
  assert.equal(AUDIOSET_CLASS_COUNT, 527);
  const short = new Float32Array(16000).fill(0.5);
  const out = padToDuration(short);
  assert.equal(out.length, 80000);
  const lead = Math.floor((80000 - short.length) / 2);
  assert.equal(out[lead - 1], 0);
  assert.equal(out[lead], 0.5);
  assert.equal(out[lead + short.length], 0);
  const long = new Float32Array(16000 * 6);
  assert.equal(padToDuration(long), long);
  assert.throws(() => padToDuration(/** @type {any} */ (new Int16Array(4))), /Float32Array/);

  assert.deepEqual(buildAudioTaggingConfig({ model: "m.onnx", labels: "l.csv" }, { threads: 1, topK: 527 }), {
    model: { ced: "m.onnx", numThreads: 1, provider: "cpu", debug: 0 },
    labels: "l.csv",
    topK: 527
  });
  assert.equal(countLabels('index,mid,display_name\n0,/m/09x0r,"Speech"\n1,/m/05zppz,"Male speech"\n'), 2);
});

test("audio-tagging: Speech の確率は番号 0 で引く（無い・数でない・配列でないときは null = 落とさない側）", () => {
  assert.equal(AUDIO_TAGGING_LABEL_INDEX.speech, 0);
  assert.equal(
    speechProbability([
      { name: "Throat clearing", prob: 0.44, index: 48 },
      { name: "Speech", prob: 0.05, index: 0 }
    ]),
    0.05
  );
  assert.equal(speechProbability([{ name: "Speech", prob: 0, index: 0 }]), 0, "0 は 0 のまま");
  assert.equal(speechProbability([{ name: "Cough", prob: 0.9, index: 47 }]), null);
  assert.equal(speechProbability([{ name: "Speech", prob: NaN, index: 0 }]), null);
  assert.equal(speechProbability([{ name: "Speech", prob: "0.1", index: 0 }]), null);
  assert.equal(speechProbability(null), null);
  assert.equal(speechProbability({ index: 0, prob: 0.1 }), null);
  assert.equal(speechProbability([null, 1]), null);
});

test("audio-tagging: 実験の lib は本番の置き場・純関数をそのまま re-export する（同じもの）", () => {
  assert.equal(experimentLib.CED_TINY_MODEL_LAYOUT, CED_TINY_MODEL_LAYOUT);
  assert.equal(experimentLib.resolveCedTinyModel, resolveCedTinyModel);
  assert.equal(experimentLib.countChars, countChars);
  assert.equal(experimentLib.padToDuration, padToDuration);
  assert.equal(experimentLib.buildAudioTaggingConfig, buildAudioTaggingConfig);
  assert.equal(experimentLib.countLabels, countLabels);
  assert.equal(experimentLib.AUDIO_TAGGING_LABEL_INDEX, AUDIO_TAGGING_LABEL_INDEX);
  assert.equal(experimentLib.AUDIO_TAGGING_TARGET_MS, AUDIO_TAGGING_TARGET_MS);
  assert.equal(experimentLib.AUDIOSET_CLASS_COUNT, AUDIOSET_CLASS_COUNT);
});
