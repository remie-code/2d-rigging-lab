// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  AUDIO_TAGGING_LABEL_INDEX,
  AUDIO_TAGGING_TARGET_MS,
  CED_TINY_FETCH_COMMAND,
  CUE_KINDS,
  buildAudioTaggingConfig,
  buildCuePlan,
  buildRecord,
  checkCedTinyModel,
  countChars,
  countLabels,
  createCueSession,
  experimentFileName,
  formatSummary,
  median,
  padToDuration,
  resolveCedTinyModel,
  sanitizeTagMessage,
  seededRng,
  summarizeAudioEvents,
  summarizeRecords
} from "./cough-experiment-lib.mjs";

// 咳払いの聞き取り実験の純関数の機械テスト。音・モデル・実データには触れない。

test("cough-experiment-lib: のばし方（前後に同じだけ 0 を足して 5 秒・もとの音はそのまま・長ければそのまま）", () => {
  assert.equal(AUDIO_TAGGING_TARGET_MS, 5000);
  const short = new Float32Array(16000 * 0.5).fill(0.25); // 0.5 秒
  const out = padToDuration(short);
  assert.equal(out.length, 80000);
  const lead = Math.floor((80000 - short.length) / 2);
  assert.equal(out[lead - 1], 0);
  assert.equal(out[lead], 0.25);
  assert.equal(out[lead + short.length - 1], 0.25);
  assert.equal(out[lead + short.length], 0);
  let sum = 0;
  for (const v of out) sum += v;
  assert.equal(sum, 0.25 * short.length, "足したのは無音だけ");
  const long = new Float32Array(16000 * 6);
  assert.equal(padToDuration(long), long, "5 秒以上はのばさない");
  assert.equal(padToDuration(new Float32Array(0)).length, 80000);
  assert.throws(() => padToDuration(/** @type {any} */ (new Int16Array(10))), /Float32Array/);
});

test("cough-experiment-lib: 判定の結果の要約（番号で引く・無い番号は 0・1 位）", () => {
  assert.deepEqual(AUDIO_TAGGING_LABEL_INDEX, { speech: 0, cough: 47, throatClearing: 48 });
  const s = summarizeAudioEvents([
    { name: "Music", prob: 0.6, index: 137 },
    { name: "Speech", prob: 0.3, index: 0 },
    { name: "Throat clearing", prob: 0.2, index: 48 }
  ]);
  assert.deepEqual(s, { speech: 0.3, cough: 0, throatClearing: 0.2, topLabel: "Music", topIndex: 137, topProb: 0.6 });
  assert.deepEqual(summarizeAudioEvents([]), { speech: 0, cough: 0, throatClearing: 0, topLabel: null, topIndex: null, topProb: null });
});

test("cough-experiment-lib: 子からの判定の知らせは数と短い文字列だけを通す（音や余計な欄は落とす）", () => {
  const t = sanitizeTagMessage({
    type: "tags",
    id: 1,
    speech: 0.1,
    cough: 0.2,
    throatClearing: 0.3,
    topLabel: "Cough",
    topIndex: 47,
    topProb: 0.5,
    samples: new Float32Array(10)
  });
  assert.deepEqual(t, { speech: 0.1, cough: 0.2, throatClearing: 0.3, topLabel: "Cough", topIndex: 47, topProb: 0.5 });
  assert.equal(sanitizeTagMessage({ type: "tags", id: 1, error: "boom" }), null);
  assert.equal(sanitizeTagMessage({ type: "tags", speech: "x" }), null);
});

test("cough-experiment-lib: ラベルの表の数・AudioTagging の設定（CED）", () => {
  assert.equal(countLabels('index,mid,display_name\n0,/m/09x0r,"Speech"\n1,/m/05zppz,"Male speech"\n'), 2);
  assert.equal(countLabels("0,a,b\n1,c,d"), 2);
  assert.deepEqual(buildAudioTaggingConfig({ model: "m.onnx", labels: "l.csv" }, { threads: 1, topK: 527 }), {
    model: { ced: "m.onnx", numThreads: 1, provider: "cpu", debug: 0 },
    labels: "l.csv",
    topK: 527
  });
});

test("cough-experiment-lib: CED-tiny の置き場と、無いときの 1 行（取得の仕方を含む）", () => {
  const { dir, files } = resolveCedTinyModel({ modelsDir: "/models" });
  assert.equal(dir, path.join("/models", "ced-tiny-audio-tagging-2024-04-19-int8"));
  assert.equal(files.model, path.join(dir, "model.int8.onnx"));
  assert.equal(files.labels, path.join(dir, "class_labels_indices.csv"));
  assert.deepEqual(checkCedTinyModel({ modelsDir: "/models", existsImpl: () => true }), { ok: true });
  const r = checkCedTinyModel({ modelsDir: "/models", existsImpl: (p) => !p.endsWith(".onnx") });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.deepEqual(r.missing, [files.model]);
  assert.ok(r.reason.includes(CED_TINY_FETCH_COMMAND));
  assert.ok(r.reason.includes("--only ced-tiny"));
  assert.equal(r.reason.includes("\n"), false, "1 行");
});

test("cough-experiment-lib: 合図の順（4 種類 × 10 回・混ぜた順・乱数を固定すれば同じ順・回数は種類ごと）", () => {
  const plan = buildCuePlan({ rng: seededRng(42) });
  assert.equal(plan.length, 40);
  assert.deepEqual(plan.map((c) => c.seq), Array.from({ length: 40 }, (_, i) => i + 1));
  for (const k of CUE_KINDS) {
    const mine = plan.filter((c) => c.kind === k.id);
    assert.equal(mine.length, 10, k.id);
    assert.deepEqual(mine.map((c) => c.round), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(mine.every((c) => c.label === k.label && c.prompt === k.prompt && c.total === 40));
  }
  assert.deepEqual(buildCuePlan({ rng: seededRng(42) }), plan, "同じ種は同じ順");
  assert.notDeepEqual(buildCuePlan({ rng: seededRng(7) }).map((c) => c.kind), plan.map((c) => c.kind));
  // 混ぜている（並べたままではない）。
  const sorted = CUE_KINDS.flatMap((k) => Array(10).fill(k.id));
  assert.notDeepEqual(plan.map((c) => c.kind), sorted);
  // rng を注入: 常に 0.999… なら入れ替えなし（Fisher–Yates の j = i）。
  assert.deepEqual(buildCuePlan({ perKind: 2, rng: () => 0.9999 }).map((c) => c.kind), CUE_KINDS.flatMap((k) => [k.id, k.id]));
  assert.equal(buildCuePlan({ perKind: 1, rng: () => 0 }).length, 4);
  assert.throws(() => buildCuePlan({ perKind: 0 }), /perKind/);
  assert.deepEqual(CUE_KINDS.map((k) => k.id), ["throat_clear", "un", "uun", "light_cough"]);
});

test("cough-experiment-lib: 記録の形（音を持たない欄だけ・区間なし・失敗）", () => {
  const [cue] = buildCuePlan({ perKind: 1, rng: () => 0.9999 });
  const at = new Date("2026-11-06T12:00:00.000Z");
  const seg = buildRecord(
    cue,
    {
      outcome: "segment",
      text: " うん ",
      durationMs: 420.4,
      tags: { speech: 0.312345, cough: 0.02, throatClearing: 0.44, topLabel: "Throat clearing", topIndex: 48, topProb: 0.44 }
    },
    at
  );
  assert.deepEqual(seg, {
    cue: "throat_clear",
    cueLabel: "咳払い",
    round: 1,
    seq: 1,
    outcome: "segment",
    text: "うん",
    chars: 2,
    durationMs: 420,
    speech: 0.3123,
    cough: 0.02,
    throatClearing: 0.44,
    topLabel: "Throat clearing",
    topProb: 0.44,
    at: "2026-11-06T12:00:00.000Z"
  });
  const none = buildRecord(cue, { outcome: "no_segment" }, at);
  assert.equal(none.outcome, "no_segment");
  assert.equal(none.text, null);
  assert.equal(none.speech, null);
  const failed = buildRecord(cue, { outcome: "failed", durationMs: 300, reason: "asrFailure" }, at);
  assert.equal(failed.reason, "asrFailure");
  assert.equal(failed.durationMs, 300);
  assert.equal(countChars("う ん"), 2);
  assert.equal(countChars(""), 0);
  assert.match(experimentFileName(new Date(2026, 10, 6, 9, 5, 7)), /^2026-11-06T09-05-07\.jsonl$/);
});

/** 合図の進め方のテスト用（時計を手で進める）。 */
function makeSession(timing = {}) {
  let now = 0;
  /** @type {any[]} */
  const records = [];
  /** @type {any[]} */
  const shown = [];
  const cues = buildCuePlan({ perKind: 1, rng: () => 0.9999 }); // throat_clear, un, uun, light_cough
  const session = createCueSession({
    cues,
    timing: { cueTimeoutMs: 1000, settleMs: 200, maxCueMs: 5000, ...timing },
    nowImpl: () => now,
    dateImpl: () => new Date(0),
    onCue: (c) => shown.push(c),
    onRecord: (r) => records.push(r)
  });
  const advance = (/** @type {number} */ ms) => {
    now += ms;
    return session.tick();
  };
  return { session, records, shown, advance, cues };
}

const seg = (/** @type {string} */ text, durationMs = 400) =>
  /** @type {const} */ ({ outcome: "segment", text, durationMs, tags: { speech: 0.3, cough: 0.1, throatClearing: 0.4, topLabel: "Speech", topIndex: 0, topProb: 0.3 } });

test("cough-experiment-lib: 合図の進め方（区間 1 つ → 静かになったら次・来なければ区間なし）", () => {
  const h = makeSession();
  h.session.begin();
  assert.equal(h.shown.length, 1);
  assert.equal(h.session.current()?.kind, "throat_clear");
  // 1 つ目: 話して区切って結果が来る。
  h.session.onVadEvent({ type: "speechStart" });
  h.advance(300);
  h.session.onVadEvent({ type: "speechEnd", endMs: 1000, reason: "silence" });
  h.advance(100);
  assert.equal(h.session.current()?.kind, "throat_clear", "結果を待つ間は進まない");
  h.advance(2000);
  assert.equal(h.session.current()?.kind, "throat_clear", "結果が来るまで（maxCue 未満）は進まない");
  h.session.onSegment(1000, seg("うん"));
  h.advance(100);
  assert.equal(h.session.current()?.kind, "throat_clear", "settle の間は待つ");
  h.advance(150);
  assert.equal(h.session.current()?.kind, "un");
  // 2 つ目: 何も来ない → cueTimeout で区間なし。
  h.advance(500);
  assert.equal(h.session.current()?.kind, "un");
  h.advance(600);
  assert.equal(h.session.current()?.kind, "uun");
  assert.deepEqual(h.records.map((r) => [r.cue, r.outcome, r.text]), [
    ["throat_clear", "segment", "うん"],
    ["un", "no_segment", null]
  ]);
});

test("cough-experiment-lib: 1 つの合図の間に区間が 2 つ来たら両方その合図の印・話している間は進まない", () => {
  const h = makeSession();
  h.session.begin();
  h.session.onVadEvent({ type: "speechStart" });
  h.session.onVadEvent({ type: "speechEnd", endMs: 500, reason: "silence" });
  h.session.onSegment(500, seg("ん"));
  h.advance(150);
  h.session.onVadEvent({ type: "speechStart" });
  h.advance(5000 - 150 - 1);
  assert.equal(h.session.current()?.kind, "throat_clear", "話している間は進まない（maxCue 未満）");
  h.session.onVadEvent({ type: "speechEnd", endMs: 900, reason: "silence" });
  h.session.onSegment(900, seg("うん"));
  h.advance(1);
  assert.equal(h.session.current()?.kind, "un", "maxCue で必ず進む");
  assert.deepEqual(h.records.map((r) => [r.cue, r.seq, r.text]), [
    ["throat_clear", 1, "ん"],
    ["throat_clear", 1, "うん"]
  ]);
});

test("cough-experiment-lib: 区間は話し始めたときの合図のもの（合図の前の話は記録しない・遅れて来た結果も元の合図）", () => {
  const h = makeSession();
  // 合図の前に話し始めた区間。
  h.session.onVadEvent({ type: "speechStart" });
  h.session.begin();
  h.session.onVadEvent({ type: "speechEnd", endMs: 100, reason: "silence" });
  assert.equal(h.session.onSegment(100, seg("はい")), null);
  // 1 つ目の合図で話し始め、maxSpeech で 2 つに切れる（話し続け）。
  h.session.onVadEvent({ type: "speechStart" });
  h.session.onVadEvent({ type: "speechEnd", endMs: 200, reason: "maxSpeech" });
  h.session.onVadEvent({ type: "speechEnd", endMs: 300, reason: "silence" });
  h.session.onSegment(200, seg("う"));
  h.advance(6000); // maxCue で次へ（2 つ目の結果はまだ）。
  assert.equal(h.session.current()?.kind, "un");
  h.session.onSegment(300, seg("ん"));
  // 失敗も区間として記録する。
  h.session.onVadEvent({ type: "speechStart" });
  h.session.onVadEvent({ type: "speechEnd", endMs: 400, reason: "silence" });
  h.session.onSegment(400, { outcome: "failed", durationMs: 250, reason: "asrFailure" });
  h.advance(300);
  assert.equal(h.session.current()?.kind, "uun");
  assert.deepEqual(h.records.map((r) => [r.cue, r.outcome, r.text]), [
    ["throat_clear", "segment", "う"],
    ["throat_clear", "segment", "ん"],
    ["un", "failed", null]
  ]);
});

test("cough-experiment-lib: 取り消された話（speechCancel）だけなら区間なし・最後まで進むと終わり", () => {
  const h = makeSession();
  h.session.begin();
  for (let i = 0; i < 4; i += 1) {
    h.session.onVadEvent({ type: "speechStart" });
    h.session.onVadEvent({ type: "speechCancel" });
    h.advance(1100);
  }
  assert.equal(h.session.isDone(), true);
  assert.equal(h.session.current(), null);
  assert.deepEqual(h.records.map((r) => r.outcome), ["no_segment", "no_segment", "no_segment", "no_segment"]);
  assert.deepEqual(h.records.map((r) => r.cue), ["throat_clear", "un", "uun", "light_cough"]);
});

test("cough-experiment-lib: まとめ（種類ごとの文字の内訳・3 つの確率の最小・中央・最大）", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  const cues = buildCuePlan({ perKind: 3, rng: () => 0.9999 });
  const tc = cues.filter((c) => c.kind === "throat_clear");
  const at = new Date(0);
  const t = (/** @type {number} */ s, /** @type {number} */ c, /** @type {number} */ th) => ({ speech: s, cough: c, throatClearing: th, topLabel: "Speech", topIndex: 0, topProb: s });
  const records = [
    buildRecord(tc[0], { outcome: "segment", text: "うん", durationMs: 300, tags: t(0.1, 0.0, 0.5) }, at),
    buildRecord(tc[0], { outcome: "segment", text: "", durationMs: 200, tags: t(0.3, 0.1, 0.2) }, at),
    buildRecord(tc[1], { outcome: "segment", text: "うん", durationMs: 300, tags: t(0.2, 0.2, 0.3) }, at),
    buildRecord(tc[2], { outcome: "no_segment" }, at)
  ];
  const summary = summarizeRecords(records);
  const s = summary.find((x) => x.kind === "throat_clear");
  assert.ok(s);
  assert.equal(s.cues, 3);
  assert.equal(s.segments, 3);
  assert.equal(s.noSegment, 1);
  assert.deepEqual(s.texts, [["うん", 2], ["（空）", 1]]);
  assert.deepEqual(s.speech, { n: 3, min: 0.1, median: 0.2, max: 0.3 });
  assert.deepEqual(s.throatClearing, { n: 3, min: 0.2, median: 0.3, max: 0.5 });
  const un = summary.find((x) => x.kind === "un");
  assert.equal(un?.segments, 0);
  const text = formatSummary(summary);
  assert.match(text, /咳払い: 合図 3 回・区間 3・区間なし 1・失敗 0/);
  assert.match(text, /文字: 「うん」×2、（空）×1/);
  assert.match(text, /Speech\s+最小 0\.100 \/ 中央 0\.200 \/ 最大 0\.300（3 件）/);
  assert.match(text, /Throat clearing\s+最小 0\.200 \/ 中央 0\.300 \/ 最大 0\.500/);
  assert.match(text, /「うん」: 合図 0 回・区間 0/);
  assert.match(text, /（値なし）/);
});
