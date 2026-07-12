// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseExpressionTags } from "./expression-parser.mjs";
import { EXPRESSION_WORDS } from "./expression-table.mjs";

// タグパーサの純関数 fixture テスト（S4 Domain A）。実 SDK/TTS/器は一切使わない。
// 性質テスト（speechText に < > が残らない）を壊れ入力・混在で網羅する。

test("parse: タグ無し応答は素通し（speechText=入力・events/diagnostics 空）", () => {
  const r = parseExpressionTags("こんにちは、今日はいい天気ですね");
  assert.equal(r.speechText, "こんにちは、今日はいい天気ですね");
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.diagnostics, []);
});

test("parse: 既知タグ 1 個を剥離し event 化（position は元位置）", () => {
  const r = parseExpressionTags("うれしい<smile>ね");
  assert.equal(r.speechText, "うれしいね");
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].word, "smile");
  assert.equal(r.events[0].position, "うれしい".length);
  assert.equal(r.events[0].args, undefined);
  assert.deepEqual(r.diagnostics, []);
});

test("parse: 複数タグは出現順・剥離後の speechText はタグ抜き", () => {
  const r = parseExpressionTags("<nod>そうだね<look-away>ちょっと<troubled>むずかしい");
  assert.equal(r.speechText, "そうだねちょっとむずかしい");
  assert.deepEqual(
    r.events.map((e) => e.word),
    ["nod", "look-away", "troubled"]
  );
  // position は元 replyText の位置（昇順）。
  assert.deepEqual(
    r.events.map((e) => e.position),
    [0, "<nod>そうだね".length, "<nod>そうだね<look-away>ちょっと".length]
  );
});

test("parse: 6 語すべてが既知として認識される（表が正）", () => {
  for (const word of EXPRESSION_WORDS) {
    const r = parseExpressionTags(`a<${word}>b`);
    assert.equal(r.speechText, "ab", `${word}: 剥離される`);
    assert.equal(r.events.length, 1, `${word}: event 化`);
    assert.equal(r.events[0].word, word);
    assert.deepEqual(r.diagnostics, [], `${word}: 診断なし`);
  }
});

test("parse: 未知タグは剥離 + unknownTag 診断（声にも演出にも出さない）", () => {
  const r = parseExpressionTags("わーい<wink>すごい<explode>");
  assert.equal(r.speechText, "わーいすごい");
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.diagnostics, [
    { type: "unknownTag", tag: "wink" },
    { type: "unknownTag", tag: "explode" }
  ]);
});

test("parse: 既知/未知タグ混在（既知だけ event・未知は診断・両方剥離）", () => {
  const r = parseExpressionTags("<smile>やあ<wink>元気<nod>？");
  assert.equal(r.speechText, "やあ元気？");
  assert.deepEqual(
    r.events.map((e) => e.word),
    ["smile", "nod"]
  );
  assert.deepEqual(r.diagnostics, [{ type: "unknownTag", tag: "wink" }]);
});

test("parse: args 付きタグ（S5 の口）は生文字列を args に保持", () => {
  // v0 の 6 語は args 不要だが、既知語に付いても event.args に生保持できる（口を開けてある）。
  const r = parseExpressionTags("む<look-away reason=shy>");
  assert.equal(r.speechText, "む");
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].word, "look-away");
  assert.equal(r.events[0].args, "reason=shy");
});

test("parse: タグのみ応答は speechText が空・events あり（発話なし・演出のみ）", () => {
  const r = parseExpressionTags("<smile>");
  assert.equal(r.speechText, "");
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].word, "smile");
});

test("parse: 未知タグのみ応答は speechText 空・events 空・診断あり", () => {
  const r = parseExpressionTags("<wink>");
  assert.equal(r.speechText, "");
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.diagnostics, [{ type: "unknownTag", tag: "wink" }]);
});

test("parse: 壊れタグ（未閉じ < / 単独 >）は throw せず括弧を剥ぐ + brokenTag 診断", () => {
  const r = parseExpressionTags("あれ< これは >だめ");
  // < と > が剥がれる（残テキストは保つ）。
  assert.ok(!r.speechText.includes("<"));
  assert.ok(!r.speechText.includes(">"));
  assert.equal(r.speechText, "あれ これは だめ");
  const broken = r.diagnostics.find((d) => d.type === "brokenTag");
  assert.ok(broken, "brokenTag 診断が返る");
  assert.equal(broken.count, 2);
});

test("parse: 空タグ <> は well-formed でない → 壊れ括弧として剥ぐ", () => {
  const r = parseExpressionTags("a<>b");
  assert.equal(r.speechText, "ab");
  assert.deepEqual(r.events, []);
  const broken = r.diagnostics.find((d) => d.type === "brokenTag");
  assert.ok(broken);
});

test("parse: 非文字列入力は空文字扱いで throw しない（防御）", () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    const r = parseExpressionTags(/** @type {any} */ (bad));
    assert.equal(r.speechText, "");
    assert.deepEqual(r.events, []);
  }
});

// ── 性質テスト（必須）: 任意のタグ込み入力に対し speechText に < > が残留しない ──────────
test("性質: speechText に < > は絶対に残らない（既知/未知/壊れ/混在を網羅）", () => {
  const fixtures = [
    "",
    "ふつうの文",
    "<smile>",
    "<wink>",
    "<>",
    "a<b",
    "a>b",
    "<<smile>>",
    "< <smile> >",
    "<nod>うん<troubled>むむ<explode>！",
    "文中に < 生の不等号 > がある",
    "<look-at x=.3 y=-.2>見て",
    "<<>>",
    "壊れ<未閉じ",
    "閉じすぎ>>>",
    "<smile><wink><look-away><zzz>",
    "😀<surprised>びっくり<><",
    "a<smile b<troubled>c"
  ];
  for (const f of fixtures) {
    const r = parseExpressionTags(f);
    assert.ok(!r.speechText.includes("<"), `"<" が残った: input=${JSON.stringify(f)} out=${JSON.stringify(r.speechText)}`);
    assert.ok(!r.speechText.includes(">"), `">" が残った: input=${JSON.stringify(f)} out=${JSON.stringify(r.speechText)}`);
    // events は既知語のみ・diagnostics も配列（throw しない）。
    assert.ok(Array.isArray(r.events));
    assert.ok(Array.isArray(r.diagnostics));
    for (const e of r.events) {
      assert.ok(EXPRESSION_WORDS.includes(e.word), `未知語が event 化: ${e.word}`);
    }
  }
});
