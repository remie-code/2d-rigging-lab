// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSpeechTimeline,
  DEFAULT_S_BY_VOWEL,
  MAX_TIMELINE_ITEMS
} from "./mora-timeline.mjs";
import {
  GOLDEN_MORAS_KONNICHIWA,
  GOLDEN_KONNICHIWA_WAV_DURATION_SEC,
  GOLDEN_PRE_PHONEME_SEC,
  GOLDEN_POST_PHONEME_SEC
} from "./fixtures.mjs";

const VOWELS = ["a", "i", "u", "e", "o"];

/** 実機 audio_query（1 回・synthesis なし）で固定したゴールデン出力。 */
const GOLDEN_TIMELINE = [
  { timeMs: 100, vowel: "o", s: 0.65 },
  { timeMs: 345, vowel: "i", s: 0.5 },
  { timeMs: 467, vowel: "i", s: 0.5 },
  { timeMs: 590, vowel: "a", s: 0.85 },
  { timeMs: 835, vowel: "e", s: 0.7 },
  { timeMs: 957, vowel: "u", s: 0.55 },
  { timeMs: 1079, vowel: "o", s: 0.65 },
  { timeMs: 1202, vowel: "e", s: 0.7 },
  { timeMs: 1324, vowel: "u", s: 0.55 }
];

test("golden: 「こんにちは、テストです」実機 moras → 固定 timeline", () => {
  const { timeline } = buildSpeechTimeline(
    GOLDEN_MORAS_KONNICHIWA,
    GOLDEN_KONNICHIWA_WAV_DURATION_SEC,
    GOLDEN_PRE_PHONEME_SEC,
    GOLDEN_POST_PHONEME_SEC
  );
  assert.deepEqual(timeline, GOLDEN_TIMELINE);
});

test("脱落 + 時間ギャップ: N(index1) と pau(index5) は要素を出さず「間」を空ける", () => {
  const { timeline } = buildSpeechTimeline(
    GOLDEN_MORAS_KONNICHIWA,
    GOLDEN_KONNICHIWA_WAV_DURATION_SEC,
    GOLDEN_PRE_PHONEME_SEC,
    GOLDEN_POST_PHONEME_SEC
  );
  // 11 生要素のうち enum 外 2（N, pau）が脱落 → 9 要素。
  assert.equal(timeline.length, 9);
  // 脱落を跨ぐ間隔は隣接（脱落なし）の間隔より広い＝時間ギャップが「間」として残る。
  const gapAcrossN = timeline[1].timeMs - timeline[0].timeMs; // o(0) → i(2): N を跨ぐ
  const adjacent = timeline[2].timeMs - timeline[1].timeMs; // i(2) → i(3): 隣接
  const gapAcrossPau = timeline[4].timeMs - timeline[3].timeMs; // a(4) → e(6): pau を跨ぐ
  assert.ok(gapAcrossN > adjacent, `gap across N (${gapAcrossN}) should exceed adjacent (${adjacent})`);
  assert.ok(gapAcrossPau > adjacent, `gap across pau (${gapAcrossPau}) should exceed adjacent (${adjacent})`);
});

test("性質: timeMs は整数・非負・厳密単調増加", () => {
  const { timeline } = buildSpeechTimeline(
    GOLDEN_MORAS_KONNICHIWA,
    GOLDEN_KONNICHIWA_WAV_DURATION_SEC,
    GOLDEN_PRE_PHONEME_SEC,
    GOLDEN_POST_PHONEME_SEC
  );
  let prev = -1;
  for (const entry of timeline) {
    assert.ok(Number.isInteger(entry.timeMs), `timeMs ${entry.timeMs} must be integer`);
    assert.ok(entry.timeMs >= 0, `timeMs ${entry.timeMs} must be non-negative`);
    assert.ok(entry.timeMs > prev, `timeMs ${entry.timeMs} must exceed previous ${prev}`);
    prev = entry.timeMs;
  }
});

test("性質: vowel は必ず a/i/u/e/o、s は必ず 0..1", () => {
  const { timeline } = buildSpeechTimeline(
    GOLDEN_MORAS_KONNICHIWA,
    GOLDEN_KONNICHIWA_WAV_DURATION_SEC,
    GOLDEN_PRE_PHONEME_SEC,
    GOLDEN_POST_PHONEME_SEC
  );
  for (const entry of timeline) {
    assert.ok(VOWELS.includes(entry.vowel), `vowel ${entry.vowel} must be in enum`);
    assert.ok(entry.s >= 0 && entry.s <= 1, `s ${entry.s} must be in 0..1`);
  }
});

test("vowel 正規化: 無声化母音の大文字 A/I/U/E/O は小文字化して残る", () => {
  const moras = [
    { vowel: "A" },
    { vowel: "I" },
    { vowel: "U" },
    { vowel: "E" },
    { vowel: "O" }
  ];
  const { timeline } = buildSpeechTimeline(moras, 1.0, 0, 0);
  assert.deepEqual(
    timeline.map((entry) => entry.vowel),
    ["a", "i", "u", "e", "o"]
  );
});

test("脱落: N/cl/pau/長音マーカ/空/非文字列 は全て落ちる（スロットは消費）", () => {
  const moras = [
    { vowel: "a" },
    { vowel: "N" },
    { vowel: "cl" },
    { vowel: "pau" },
    { vowel: "ー" },
    { vowel: "" },
    { vowel: 42 },
    {},
    { vowel: "o" }
  ];
  const { timeline } = buildSpeechTimeline(moras, 1.0, 0, 0);
  // 残るのは a と o の 2 つのみ。
  assert.deepEqual(
    timeline.map((entry) => entry.vowel),
    ["a", "o"]
  );
  // a は index0（rawTimeMs=0）、o は index8（9 スロット中の最後の直前）。スロット消費で o は末尾寄り。
  assert.equal(timeline[0].timeMs, 0);
  assert.ok(timeline[1].timeMs > timeline[0].timeMs);
});

test("既定 s は参照ドライバ流儀の母音別マップ", () => {
  const moras = VOWELS.map((vowel) => ({ vowel }));
  const { timeline } = buildSpeechTimeline(moras, 1.0, 0, 0);
  for (const entry of timeline) {
    assert.equal(entry.s, DEFAULT_S_BY_VOWEL[entry.vowel]);
  }
});

test("sConfig.vowelMap で母音別 s を差し替えられる（既定にマージ）", () => {
  const moras = [{ vowel: "a" }, { vowel: "o" }];
  const { timeline } = buildSpeechTimeline(moras, 1.0, 0, 0, {
    vowelMap: { a: 0.9 }
  });
  assert.equal(timeline[0].s, 0.9); // 上書き
  assert.equal(timeline[1].s, DEFAULT_S_BY_VOWEL.o); // 既定を維持
});

test("sConfig が 0..1 域外を含めば throw（出力 s の 0..1 不変条件を保つ）", () => {
  const moras = [{ vowel: "a" }];
  assert.throws(
    () => buildSpeechTimeline(moras, 1.0, 0, 0, { vowelMap: { a: 1.5 } }),
    /RangeError/
  );
  assert.throws(
    () => buildSpeechTimeline(moras, 1.0, 0, 0, { vowelMap: { a: -0.1 } }),
    /RangeError/
  );
});

test("pre 無音オフセット: 最初の発声モーラは prePhonemeSec 分だけ後ろにずれる", () => {
  const moras = [{ vowel: "a" }, { vowel: "o" }];
  const { timeline } = buildSpeechTimeline(moras, 1.2, 0.1, 0.1);
  // index0 の timeMs = pre(0.1s) = 100ms。
  assert.equal(timeline[0].timeMs, 100);
});

test("整数化単調: 尺が短く四捨五入が衝突しても最小 1ms 間隔で押し出す", () => {
  // 5 母音を body 0.001s に詰める → slot=0.2ms → 生の timeMs は 0,0.2,0.4,0.6,0.8ms。
  // round では 0,0,0,1,1 と衝突するが、押し出しで 0,1,2,3,4 になる。
  const moras = VOWELS.map((vowel) => ({ vowel }));
  const { timeline } = buildSpeechTimeline(moras, 0.001, 0, 0);
  assert.deepEqual(
    timeline.map((entry) => entry.timeMs),
    [0, 1, 2, 3, 4]
  );
});

test("512 上限: 512 要素は許容、513 要素は throw（切詰めない）", () => {
  const ok = Array.from({ length: MAX_TIMELINE_ITEMS }, () => ({ vowel: "a" }));
  const { timeline } = buildSpeechTimeline(ok, 600, 0, 0);
  assert.equal(timeline.length, MAX_TIMELINE_ITEMS);

  const over = Array.from({ length: MAX_TIMELINE_ITEMS + 1 }, () => ({ vowel: "a" }));
  assert.throws(() => buildSpeechTimeline(over, 600, 0, 0), /exceeding the contract maxItems/);
});

test("512 上限は「出力要素数」で判定: 脱落込み 600 生要素でも母音 512 まで許容", () => {
  // 生 1024 要素の半分が pau（脱落）→ 出力 512。許容されるべき。
  const moras = [];
  for (let i = 0; i < MAX_TIMELINE_ITEMS; i += 1) {
    moras.push({ vowel: "a" });
    moras.push({ vowel: "pau" });
  }
  const { timeline } = buildSpeechTimeline(moras, 1200, 0, 0);
  assert.equal(timeline.length, MAX_TIMELINE_ITEMS);
});

test("エッジ: 母音が 1 つも無ければ throw（contract minItems=1）", () => {
  const moras = [{ vowel: "N" }, { vowel: "pau" }, { vowel: "cl" }];
  assert.throws(() => buildSpeechTimeline(moras, 1.0, 0, 0), /no voiced moras/);
});

test("エッジ: 空 moras は throw", () => {
  assert.throws(() => buildSpeechTimeline([], 1.0, 0, 0), /empty/);
});

test("エッジ: 発話実体尺が非正（pre+post >= wav）は throw", () => {
  assert.throws(
    () => buildSpeechTimeline([{ vowel: "a" }], 0.2, 0.1, 0.1),
    /body duration/
  );
});

test("エッジ: 不正な数値入力は throw", () => {
  assert.throws(() => buildSpeechTimeline([{ vowel: "a" }], 0, 0, 0), /wavDurationSec/);
  assert.throws(() => buildSpeechTimeline([{ vowel: "a" }], NaN, 0, 0), /wavDurationSec/);
  assert.throws(() => buildSpeechTimeline([{ vowel: "a" }], 1.0, -0.1, 0), /prePhonemeSec/);
  assert.throws(() => buildSpeechTimeline([{ vowel: "a" }], 1.0, 0, -0.1), /postPhonemeSec/);
  assert.throws(
    () => buildSpeechTimeline(/** @type {any} */ ("nope"), 1.0, 0, 0),
    /must be an array/
  );
});

test("決定論: 同じ入力は同じ出力（純関数）", () => {
  const a = buildSpeechTimeline(GOLDEN_MORAS_KONNICHIWA, 1.5468, 0.1, 0.1);
  const b = buildSpeechTimeline(GOLDEN_MORAS_KONNICHIWA, 1.5468, 0.1, 0.1);
  assert.deepEqual(a, b);
});

// ── Domain A 補強（Domain B レビュー指摘・厳密単調と脱落先頭の縁）───────────────

test("512 + 極小 body: 1ms 押し出しが 512 連鎖しても厳密単調・整数・512 判定が緑", () => {
  // 512 母音を body 0.001s に詰める → slot ≈ 0.00000195s → 生 timeMs は全て ~0ms。
  // round では全 0 に潰れるが、最小 1ms 押し出しが 512 回連鎖して 0..511 になる。
  const moras = Array.from({ length: MAX_TIMELINE_ITEMS }, () => ({ vowel: "a" }));
  const { timeline } = buildSpeechTimeline(moras, 0.001, 0, 0);
  assert.equal(timeline.length, MAX_TIMELINE_ITEMS); // 512 は許容（throw しない）
  // 押し出しで 0,1,2,...,511 に整列（厳密単調・整数・非負・最後は 511）。
  let prev = -1;
  for (let i = 0; i < timeline.length; i += 1) {
    assert.equal(timeline[i].timeMs, i); // 連鎖の帰結を厳密に固定
    assert.ok(Number.isInteger(timeline[i].timeMs) && timeline[i].timeMs > prev);
    prev = timeline[i].timeMs;
  }
  assert.equal(timeline.at(-1).timeMs, MAX_TIMELINE_ITEMS - 1);

  // 513 で同じ極小 body なら 512 判定側（出力要素数 513 > 512）で throw する。
  const over = Array.from({ length: MAX_TIMELINE_ITEMS + 1 }, () => ({ vowel: "a" }));
  assert.throws(() => buildSpeechTimeline(over, 0.001, 0, 0), /exceeding the contract maxItems/);
});

test("脱落先頭: 先頭モーラが enum 外なら第一出力は prev=-1 から非ゼロ raw を取る", () => {
  // index0 の N が脱落 → 第一出力は index1 の a（raw=slot=0.5s=500ms）。
  // previousTimeMs=-1 起点で max(round(500), 0)=500 → 押し出しではなく raw そのまま。
  const moras = [{ vowel: "N" }, { vowel: "a" }];
  const { timeline } = buildSpeechTimeline(moras, 1.0, 0, 0);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].vowel, "a");
  assert.equal(timeline[0].timeMs, 500); // 非ゼロ raw（0 ではない・押し出しでもない）

  // 先頭 2 つが脱落しても同様: 第一出力は index2 の raw を素直に取る（0 に丸め込まれない）。
  const moras2 = [{ vowel: "N" }, { vowel: "pau" }, { vowel: "a" }];
  const { timeline: t2 } = buildSpeechTimeline(moras2, 1.5, 0, 0);
  // slot = 1.5/3 = 0.5s。index2 → raw = 2*0.5s = 1000ms。
  assert.equal(t2[0].timeMs, 1000);
});
