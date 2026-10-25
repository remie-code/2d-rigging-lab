// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { scanRecallTag, normalizeRecallRequest, CONTROL_TAG_WORDS, RECALL_WORD } from "./recall-tag.mjs";
import { parseExpressionTags } from "./expression-parser.mjs";
import { createIncrementalSentenceTagBuffer } from "./incremental-sentence-tag-buffer.mjs";
import { EXPRESSION_WORDS } from "./expression-table.mjs";

// 思い出しの目印 `<recall 頼みごと>`（記憶の作り直し Wave 3 Domain D）。一括（parser）と逐次（incremental buffer）の
// 両経路で、声に出ない・頼みごとが取れる・壊れたタグで中身が声に出ない、を固定する。

// ── 語彙 ──

test("recall は表情の語彙表（6 語）とは別の語彙集合", () => {
  assert.deepEqual(CONTROL_TAG_WORDS, ["recall"]);
  assert.equal(RECALL_WORD, "recall");
  assert.equal(EXPRESSION_WORDS.length, 6, "表情の 6 語は変わらない");
  assert.ok(!EXPRESSION_WORDS.includes("recall"));
});

// ── 一括（parser）──

test("parser: <recall …> は声にも events にも出さず recalls に頼みごとを返す（未知タグの診断にもしない）", () => {
  const r = parseExpressionTags("ちょっと記録見てくるね<recall エルデンリング 前回どこまで>");
  assert.equal(r.speechText, "ちょっと記録見てくるね");
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual(r.recalls, [{ request: "エルデンリング 前回どこまで", position: 11 }]);
});

test("parser: 表情タグと混ざっても両方読める（順序・position・表情の events は今まで通り）", () => {
  const r = parseExpressionTags("<nod>うん、見てくる<smile><recall 前回の ボス>");
  assert.equal(r.speechText, "うん、見てくる");
  assert.deepEqual(r.events.map((e) => e.word), ["nod", "smile"]);
  assert.deepEqual(r.recalls.map((x) => x.request), ["前回の ボス"]);
  assert.deepEqual(r.diagnostics, []);
});

test("parser: 引数の中の < はそのまま頼みごとに入り、中身が声に出ない", () => {
  const r = parseExpressionTags("見てくる<recall a<b の話>");
  assert.equal(r.speechText, "見てくる");
  assert.deepEqual(r.recalls.map((x) => x.request), ["a<b の話"]);
  assert.deepEqual(r.diagnostics, []);
});

test("parser: 引数の中の > は同じ行の最後の > まで頼みごとに含め、中身が声に出ない", () => {
  const r = parseExpressionTags("見てくる<recall 3>2 の話>");
  assert.equal(r.speechText, "見てくる");
  assert.deepEqual(r.recalls.map((x) => x.request), ["3>2 の話"]);
});

test("parser: 目印の後ろの既知のタグは飲み込まない（そこで目印を閉じる）", () => {
  const r = parseExpressionTags("見てくる<recall 前回><smile>またね");
  assert.equal(r.speechText, "見てくるまたね");
  assert.deepEqual(r.recalls.map((x) => x.request), ["前回"]);
  assert.deepEqual(r.events.map((e) => e.word), ["smile"]);
});

test("parser: 改行で目印を閉じ、次の行の本文はそのまま声になる", () => {
  const r = parseExpressionTags("見てくる<recall 前回>\nそれでさ。");
  assert.equal(r.speechText, "見てくる\nそれでさ。");
  assert.deepEqual(r.recalls.map((x) => x.request), ["前回"]);
});

test("parser: 閉じていない <recall は頼みにせず、行末までを声に出さずに捨てる（brokenTag に数える）", () => {
  const r = parseExpressionTags("見てくる<recall 前回のボス\nそれでさ");
  assert.equal(r.speechText, "見てくる\nそれでさ");
  assert.deepEqual(r.recalls, []);
  assert.deepEqual(r.diagnostics, [{ type: "brokenTag", count: 1 }]);
  // 入力の終わりで閉じていない。
  const end = parseExpressionTags("見てくる<recall 前回のボス");
  assert.equal(end.speechText, "見てくる");
  assert.deepEqual(end.recalls, []);
  // `<recall` だけで終わる（語も声に出さない）。
  assert.equal(parseExpressionTags("見てくる<recall").speechText, "見てくる");
});

test("parser: 閉じていない <recall の後ろに既知のタグがあれば、そのタグは生きる", () => {
  const r = parseExpressionTags("見てくる<recall 前回<smile>");
  assert.equal(r.speechText, "見てくる");
  assert.deepEqual(r.recalls, []);
  assert.deepEqual(r.events.map((e) => e.word), ["smile"]);
});

test("parser: <recall> は空の頼みごと / <recallx> や <recall-x> は別の語（未知タグ）", () => {
  assert.deepEqual(parseExpressionTags("<recall>").recalls, [{ request: "", position: 0 }]);
  const x = parseExpressionTags("a<recallx>b<recall-x y>c");
  assert.equal(x.speechText, "abc");
  assert.deepEqual(x.recalls, []);
  assert.deepEqual(x.diagnostics, [
    { type: "unknownTag", tag: "recallx" },
    { type: "unknownTag", tag: "recall-x" }
  ]);
});

test("parser: 目印が 2 つあれば出現順に返す・頼みごとの空白はまとめる", () => {
  const r = parseExpressionTags("<recall  A   の 話 ><recall B>");
  assert.deepEqual(r.recalls.map((x) => x.request), ["A の 話", "B"]);
  assert.equal(normalizeRecallRequest("  a \t b  "), "a b");
});

test("parser: 性質: どんな形でも speechText に < > は残らない（目印混じりの壊れ入力）", () => {
  const pieces = ["<recall", " a", "<", ">", "<smile>", "\n", "x", "<recall b>", "<nod", " y>", ">", "<re", "c"];
  // 決まった乱数で組み合わせる。
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let n = 0; n < 300; n += 1) {
    let text = "";
    const len = 1 + Math.floor(rand() * 8);
    for (let i = 0; i < len; i += 1) text += pieces[Math.floor(rand() * pieces.length)];
    const r = parseExpressionTags(text);
    assert.ok(!/[<>]/.test(r.speechText), JSON.stringify(text));
    assert.ok(!r.speechText.includes("recall "), `目印の語と引数が声に出ない: ${JSON.stringify(text)}`);
  }
});

// ── scanRecallTag の未完（逐次のため）──

test("scanRecallTag: 終わりが決まるまでは未完・final では決まる", () => {
  assert.deepEqual(scanRecallTag("<rec", 0, false), { kind: "incomplete" });
  assert.equal(scanRecallTag("<rec", 0, true), null);
  assert.deepEqual(scanRecallTag("<recall a>", 0, false), { kind: "incomplete" }, "同じ行に後から > が来うる");
  assert.deepEqual(scanRecallTag("<recall a>", 0, true), { kind: "valid", end: 9 });
  assert.deepEqual(scanRecallTag("<recall a>b\n", 0, false), { kind: "valid", end: 9 });
  assert.deepEqual(scanRecallTag("<recall a><sm", 0, false), { kind: "incomplete" }, "次が既知のタグか決まらない");
  assert.deepEqual(scanRecallTag("<recall a><smile>", 0, false), { kind: "valid", end: 9 });
  assert.equal(scanRecallTag("<smile>", 0, false), null);
});

// ── 逐次（incremental buffer）──

/** 文字列を n 文字ずつの delta にして流し、最後に flush する。 */
function streamAll(text, size) {
  const buf = createIncrementalSentenceTagBuffer();
  const sentences = [];
  const tags = [];
  for (let i = 0; i < text.length; i += size) {
    const out = buf.append(text.slice(i, i + size));
    sentences.push(...out.sentences);
    tags.push(...out.tags);
  }
  const fin = buf.flush();
  sentences.push(...fin.sentences);
  tags.push(...fin.tags);
  return { speech: sentences.join(""), recalls: tags.flatMap((t) => t.recalls), tags };
}

const SAMPLES = [
  "ちょっと記録見てくるね。<recall エルデンリング 前回どこまで>",
  "<nod>うん、見てくる。<smile><recall 前回の ボス>",
  "見てくる。<recall a<b の話>",
  "見てくる。<recall 3>2 の話>",
  "見てくる。<recall 前回><smile>またね。",
  "見てくる。<recall 前回>\nそれでさ。",
  "見てくる。<recall 前回のボス\nそれでさ。",
  "見てくる。<recall 前回のボス",
  "見てくる。<recall 前回<smile>",
  "a<recallx>b<recall-x y>c。",
  "<recall A><recall B>話そう。"
];

test("incremental: どの区切り方でも、声（文の連結）と頼みごとが一括の parser と一致する", () => {
  for (const text of SAMPLES) {
    const batch = parseExpressionTags(text);
    for (const size of [1, 2, 3, 5, 100]) {
      const streamed = streamAll(text, size);
      assert.equal(streamed.speech, batch.speechText, `${JSON.stringify(text)} / ${size}`);
      assert.deepEqual(streamed.recalls, batch.recalls, `${JSON.stringify(text)} / ${size}`);
    }
  }
});

test("incremental: 目印の前の文はすぐ声になり、目印の後ろの同じ行は行末か終わりまで待つ", () => {
  const buf = createIncrementalSentenceTagBuffer();
  let out = buf.append("見てくるね。<recall 前回>");
  assert.deepEqual(out.sentences, ["見てくるね。"]);
  assert.deepEqual(out.tags, [], "同じ行の後ろに > が来うるので、まだ閉じない");
  out = buf.append("それでさ。");
  assert.deepEqual(out.sentences, []);
  out = buf.append("\n");
  assert.deepEqual(out.tags.flatMap((t) => t.recalls).map((r) => r.request), ["前回"]);
  assert.deepEqual(out.sentences, ["それでさ。"]);
  const fin = buf.flush();
  assert.deepEqual(fin.sentences, ["\n"]);
});

test("incremental: 完結した目印の tag は raw と recalls を持ち、表情の events は持たない", () => {
  const { tags } = streamAll("見てくる。<recall 前回>", 4);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].raw, "<recall 前回>");
  assert.deepEqual(tags[0].events, []);
  assert.deepEqual(tags[0].recalls, [{ request: "前回", position: 5 }]);
});
