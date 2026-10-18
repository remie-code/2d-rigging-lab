// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createAlignmentTimelineBuilder,
  kanaMoraMatches,
  planSentence,
  readingGroupsFromAccentPhrases,
  segmentText,
  SILENCE_REOPEN_LEAD_MS,
  splitByWeights,
  splitKanaMoras,
  textForReading
} from "./elevenlabs-timeline.mjs";
import { DEFAULT_S_BY_VOWEL } from "../mora-timeline.mjs";

// ElevenLabs の文字時刻 + AivisSpeech の読み → 口の時間割（純関数）。読みの形は AivisSpeech 実機
// （127.0.0.1:10101 /accent_phrases、2026-10-18）の返りを写したもの。

/** @param {Array<Array<[string, string]>>} phrases  [[text, vowel], ...] のフレーズ列 */
function accentPhrases(phrases) {
  return phrases.map((moras) => ({ moras: moras.map(([text, vowel]) => ({ text, vowel })), pause_mora: null }));
}

/** @param {string} text @param {ReturnType<typeof planSentence>} plan */
function describe(text, plan) {
  const chars = Array.from(text);
  return plan.units.map((unit) => {
    const body = chars.slice(unit.start, unit.end).join("");
    if (unit.kind === "voiced") return `${body}=${unit.vowels.map((v) => v ?? "-").join("")}`;
    return `${unit.kind}:${body}`;
  });
}

/** @param {string[]} chars @param {number[]} starts @param {number[]} durations */
function alignment(chars, starts, durations) {
  return { chars, char_start_times_ms: starts, char_durations_ms: durations };
}

/** @param {Array<{ timeMs: number; vowel: string; s: number }>} entries */
function short(entries) {
  return entries.map((e) => `${e.timeMs}${e.vowel}${e.s === 0 ? "_" : ""}`);
}

test("segmentText: 句読点・タグ（後ろの空白込み）・かなと漢字/英数字の切れ目で区切る", () => {
  const text = "[laughs] 今日は3時、FPS やるよ！[x";
  const chars = Array.from(text);
  const got = segmentText(text).map((seg) => `${seg.kind}:${chars.slice(seg.start, seg.end).join("")}`);
  assert.deepEqual(got, [
    "tag:[laughs] ",
    "word:今日",
    "kana:は",
    "word:3時",
    "pause:、",
    "word:FPS",
    "sep: ",
    "kana:やるよ",
    "pause:！",
    "sep:[",
    "word:x"
  ]);
  assert.equal(textForReading("[laughs] ちょっと、[sighs]今の"), "ちょっと、今の");
});

test("splitKanaMoras: 拗音は前に付く・っ/ん は母音なし・ー は前の母音・へぇ は 2 モーラ・ティ は 1 モーラ", () => {
  const got = splitKanaMoras("きょうはちょっとへぇーてぃーん").map((m) => `${m.text}:${m.vowel ?? "-"}`);
  assert.deepEqual(got, ["キョ:o", "ウ:u", "ハ:a", "チョ:o", "ッ:-", "ト:o", "ヘ:e", "エ:e", "ー:e", "ティ:i", "ー:i", "ン:-"]);
});

test("readingGroupsFromAccentPhrases: pau と pause_mora で分ける・無声化の大文字は小文字・形が違えば TypeError", () => {
  const groups = readingGroupsFromAccentPhrases([
    { moras: [{ text: "ソ", vowel: "o" }, { text: ",", vowel: "pau" }], pause_mora: null },
    { moras: [{ text: "ス", vowel: "U" }, { text: "ン", vowel: "N" }], pause_mora: { text: "、", vowel: "pau" } },
    { moras: [{ text: "ミ", vowel: "i" }], pause_mora: null }
  ]);
  assert.deepEqual(groups, [[{ text: "ソ", vowel: "o" }], [{ text: "ス", vowel: "u" }, { text: "ン", vowel: null }], [{ text: "ミ", vowel: "i" }]]);
  assert.throws(() => readingGroupsFromAccentPhrases({}), TypeError);
  assert.throws(() => readingGroupsFromAccentPhrases([{ moras: null }]), TypeError);
});

test("kanaMoraMatches / splitByWeights: は→ワ・を→オ・長音↔母音のゆるい一致、比で分けて各 1 以上", () => {
  assert.ok(kanaMoraMatches({ text: "ハ", vowel: "a" }, { text: "ワ", vowel: "a" }));
  assert.ok(kanaMoraMatches({ text: "ヲ", vowel: "o" }, { text: "オ", vowel: "o" }));
  assert.ok(kanaMoraMatches({ text: "ウ", vowel: "u" }, { text: "オ", vowel: "o" }), "よう → ヨオ");
  assert.ok(kanaMoraMatches({ text: "ー", vowel: "e" }, { text: "エ", vowel: "e" }));
  assert.equal(kanaMoraMatches({ text: "カ", vowel: "a" }, { text: "サ", vowel: "a" }), false);
  assert.deepEqual(splitByWeights(7, [1, 1, 1, 1]), [2, 2, 2, 1]);
  assert.deepEqual(splitByWeights(3, [1, 3]), [1, 2]);
  assert.deepEqual(splitByWeights(1, [1, 1]), [1, 0]);
  assert.deepEqual(splitByWeights(0, []), []);
});

test("planSentence（読みあり）: かなを錨にして漢字・数字の区間へ読みのモーラを渡す", () => {
  const text = "今日は3時から配信するよ！";
  const readings = readingGroupsFromAccentPhrases(
    accentPhrases([
      [["キョ", "o"], ["オ", "o"], ["ワ", "a"]],
      [["サ", "a"], ["ン", "N"], ["ジ", "i"], ["カ", "a"], ["ラ", "a"]],
      [["ハ", "a"], ["イ", "i"], ["シ", "i"], ["ン", "N"]],
      [["ス", "u"], ["ル", "u"], ["ヨ", "o"], ["!", "pau"]]
    ])
  );
  const plan = planSentence(text, readings);
  assert.equal(plan.mode, "readings");
  assert.deepEqual(describe(text, plan), ["今日=oo", "は=a", "3時=a-i", "から=aa", "配信=aii-", "するよ=uuo", "silent:！"]);
});

test("planSentence（読みあり）: 句読点で分けた組ごとに割り付ける・組の数が合わなければ文全体で 1 組", () => {
  const text = "それならさ、先に右の道を見てみようよ。";
  const real = accentPhrases([
    [["ソ", "o"], ["レ", "e"], ["ナ", "a"], ["ラ", "a"], ["サ", "a"], [",", "pau"]],
    [["サ", "a"], ["キ", "i"], ["ニ", "i"]],
    [["ミ", "i"], ["ギ", "i"], ["ノ", "o"]],
    [["ミ", "i"], ["チ", "i"], ["オ", "o"], ["ミ", "i"], ["テ", "e"], ["ミ", "i"], ["ヨ", "o"], ["オ", "o"], ["ヨ", "o"], [".", "pau"]]
  ]);
  const expected = ["それならさ=oeaaa", "silent:、", "先=ai", "に=i", "右=ii", "の=o", "道=ii", "を=o", "見=i", "てみようよ=eiooo", "silent:。"];
  assert.deepEqual(describe(text, planSentence(text, readingGroupsFromAccentPhrases(real))), expected);
  // 読みに句切れが無くても（組の数が合わない）、文全体の 1 組で同じに割り付く。
  const noPause = real.map((phrase) => ({ ...phrase, moras: phrase.moras.filter((m) => m.vowel !== "pau") }));
  assert.deepEqual(describe(text, planSentence(text, readingGroupsFromAccentPhrases(noPause))), expected);
});

test("planSentence（読みあり）: 錨が見つからない組は数の比で順に配る", () => {
  const text = "見たの";
  // 読みが本文のかなと合わない（「の」が無い）→ 見(1字×2) : たの(2) = 2:2。
  const readings = readingGroupsFromAccentPhrases(accentPhrases([[["ミ", "i"], ["タ", "a"], ["ネ", "e"], ["コ", "o"]]]));
  assert.deepEqual(describe(text, planSentence(text, readings)), ["見=ia", "たの=eo"]);
});

test("planSentence（読みなし＝簡易版）: かなは表で母音、漢字/英数字は区間ごとに開け閉め", () => {
  const text = "先にFPSやろう。";
  const plan = planSentence(text, null);
  assert.equal(plan.mode, "simple");
  assert.deepEqual(describe(text, plan), ["openClose:先", "に=i", "openClose:FPS", "やろう=aou", "silent:。"]);
});

/** 先に、[laughs] 見て。 の文字時刻（3 かたまり・各かたまりは 0 から数え直す）。 */
function laughsAlignments() {
  return [
    alignment(["先", "に", "、"], [0, 320, 480], [320, 160, 240]),
    alignment(["[", "l", "a", "u", "g", "h", "s", "]", " "], [0, 40, 80, 120, 160, 200, 240, 280, 320], [40, 40, 40, 40, 40, 40, 40, 40, 400]),
    alignment(["見", "て", "。"], [0, 160, 320], [160, 160, 400])
  ];
}

const LAUGHS_TEXT = "先に、[laughs] 見て。";
const LAUGHS_READINGS = readingGroupsFromAccentPhrases(
  accentPhrases([
    [["サ", "a"], ["キ", "i"], ["ニ", "i"], [",", "pau"]],
    [["ミ", "i"], ["テ", "e"], [".", "pau"]]
  ])
);

test("時間割: alignment を通し値に直し、区間が揃った所から出す・区間の中は均等・タグは母音を出さず口を閉じる", () => {
  const plan = planSentence(LAUGHS_TEXT, LAUGHS_READINGS);
  const builder = createAlignmentTimelineBuilder({ plan });
  const [a1, a2, a3] = laughsAlignments();
  // 1 かたまり目: 先（0〜320 にサ・キを均等）・に。読点〜タグの黙る区間はまだ揃っていない。
  assert.deepEqual(short(builder.pushAlignment(a1)), ["0a", "160i", "320i"]);
  // 2 かたまり目（通し値 720 から）: 黙る区間 480〜1440 が揃う → 始まりで閉じ、次の「見」の 80ms 前まで閉じたまま。
  assert.deepEqual(short(builder.pushAlignment(a2)), ["480i_", `${1440 - SILENCE_REOPEN_LEAD_MS}i_`]);
  // 3 かたまり目（通し値 1440 から）: 見・て、文末の句点の始まりで閉じる。
  assert.deepEqual(short(builder.pushAlignment(a3)), ["1440i", "1600e", "1760e_"]);
  assert.deepEqual(builder.finish(), [], "閉じ終わっているので足さない");
  const stats = builder.stats();
  assert.equal(stats.totalMs, 2160);
  assert.equal(stats.mode, "readings");
  assert.equal(stats.timelineCount, 8);
  // 開き量は母音ごとの固定値（mora-timeline と同じ）。
  const again = createAlignmentTimelineBuilder({ plan: planSentence(LAUGHS_TEXT, LAUGHS_READINGS) });
  const first = again.pushAlignment(a1);
  assert.deepEqual(first.map((e) => e.s), [DEFAULT_S_BY_VOWEL.a, DEFAULT_S_BY_VOWEL.i, DEFAULT_S_BY_VOWEL.i]);
});

test("時間割: alignmentLeadMs を全要素に足す・timeMs は整数で厳密に増える", () => {
  const builder = createAlignmentTimelineBuilder({ plan: planSentence(LAUGHS_TEXT, LAUGHS_READINGS), leadMs: 150 });
  const all = laughsAlignments().flatMap((a) => builder.pushAlignment(a)).concat(builder.finish());
  assert.deepEqual(short(all), ["150a", "310i", "470i", "630i_", "1510i_", "1590i", "1750e", "1910e_"]);
  for (let k = 1; k < all.length; k += 1) {
    assert.ok(Number.isInteger(all[k].timeMs) && all[k].timeMs > all[k - 1].timeMs);
  }
});

test("時間割: かたまりをまたぐ区間は揃ってから出す・文頭のタグは長さによらず閉じて始まる", () => {
  const text = "[laughs] それならさ";
  const builder = createAlignmentTimelineBuilder({ plan: planSentence(text, null) });
  const tag = Array.from("[laughs] ");
  assert.deepEqual(
    short(builder.pushAlignment(alignment(tag, tag.map((_, k) => k * 40), tag.map(() => 40)))),
    ["0o_", `${360 - SILENCE_REOPEN_LEAD_MS}o_`]
  );
  assert.deepEqual(builder.pushAlignment(alignment(["そ", "れ", "な"], [0, 80, 160], [80, 80, 80])), [], "「それならさ」はまだ途中");
  const rest = builder.pushAlignment(alignment(["ら", "さ"], [0, 80], [80, 80]));
  assert.deepEqual(short(rest), ["360o", "440e", "520a", "600a", "680a"]);
  // 文末に句読点が無ければ、音の終わり（通し値の合計）で閉じる。
  assert.deepEqual(short(builder.finish()), ["760a_"]);
});

test("時間割（簡易版）: 漢字は区間の始まりで開き真ん中で閉じる", () => {
  const builder = createAlignmentTimelineBuilder({ plan: planSentence(LAUGHS_TEXT, null) });
  const all = laughsAlignments().flatMap((a) => builder.pushAlignment(a)).concat(builder.finish());
  assert.deepEqual(short(all), ["0a", "160a_", "320i", "480i_", "1360a_", "1440a", "1520a_", "1600e", "1760e_"]);
  assert.equal(builder.stats().mode, "simple");
});

test("時間割: 本文と alignment の文字が食い違ったら、その先は文の終わりで簡易版にする", () => {
  const builder = createAlignmentTimelineBuilder({ plan: planSentence("あい、うえ", null) });
  // 「あい」と読点は一致 → 出る（読点で閉じ、次の区間の手前まで閉じたまま）。その後ろで食い違う（「うお」）。
  assert.deepEqual(
    short(builder.pushAlignment(alignment(["あ", "い", "、"], [0, 100, 200], [100, 100, 200]))),
    ["0a", "100i", "200i_", "320u_"]
  );
  assert.deepEqual(builder.pushAlignment(alignment(["う", "お"], [0, 100], [100, 100])), []);
  assert.equal(builder.stats().mismatchAt, 4);
  assert.deepEqual(short(builder.finish()), ["400u", "500o", "600o_"]);
});

test("時間割: 発話全体の上限を超えない（最後の 1 枠で口を閉じて打ち切る）", () => {
  const text = "あいうえおかきくけこ";
  const builder = createAlignmentTimelineBuilder({ plan: planSentence(text, null), maxEntries: 4 });
  const chars = Array.from(text);
  const entries = builder.pushAlignment(alignment(chars, chars.map((_, k) => k * 100), chars.map(() => 100)));
  entries.push(...builder.finish());
  assert.equal(entries.length, 4);
  assert.equal(entries[3].s, 0);
  assert.equal(builder.stats().capped, true);
});
