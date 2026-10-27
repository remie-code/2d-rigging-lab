// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createIncrementalSentenceTagBuffer } from "./incremental-sentence-tag-buffer.mjs";

test("任意の delta 分割でも完結文は一度ずつ、flush は未終端 remainder を一度だけ出す", () => {
  const source = "最初です。次です！最後";
  const expected = ["最初です。", "次です！", "最後"];
  for (let split = 0; split <= source.length; split += 1) {
    const buffer = createIncrementalSentenceTagBuffer();
    const first = buffer.append(source.slice(0, split));
    const second = buffer.append(source.slice(split));
    const final = buffer.flush();
    assert.deepEqual([...first.sentences, ...second.sentences, ...final.sentences], expected, `split=${split}`);
    assert.deepEqual(buffer.flush().sentences, [], `flush is idempotent at split=${split}`);
  }
});

test("文末を受けた時点で発行し、最小文字数を合流しない", () => {
  const buffer = createIncrementalSentenceTagBuffer();
  assert.deepEqual(buffer.append("はい。次").sentences, ["はい。"]);
  assert.deepEqual(buffer.append("です。").sentences, ["次です。"]);
});

test("delta を跨ぐ未完成 tag も完成 tag も speech に出ず、完成順を保つ", () => {
  const buffer = createIncrementalSentenceTagBuffer();
  const one = buffer.append("<smi");
  assert.deepEqual(one.sentences, []);
  assert.deepEqual(one.tags, []);

  const two = buffer.append("le>こんにちは。<look-");
  assert.deepEqual(two.sentences, ["こんにちは。"]);
  assert.deepEqual(two.tags.map((tag) => tag.raw), ["<smile>"]);
  assert.deepEqual(two.tags[0].events.map((event) => event.word), ["smile"]);

  const three = buffer.append("away>またね！<unknown>");
  assert.deepEqual(three.sentences, ["またね！"]);
  assert.deepEqual(three.tags.map((tag) => tag.raw), ["<look-away>", "<unknown>"]);
  assert.deepEqual(three.tags[0].events.map((event) => event.word), ["look-away"]);
  assert.deepEqual(three.tags[1].events, []);
  assert.deepEqual(three.tags[1].diagnostics, [{ type: "unknownTag", tag: "unknown" }]);
});

test("flush は未完成 tag を読み上げず、既に安全な remainder だけを一度返す", () => {
  const buffer = createIncrementalSentenceTagBuffer();
  assert.deepEqual(buffer.append("途中まで<smile").sentences, []);
  const final = buffer.flush();
  assert.deepEqual(final.sentences, ["途中まで"]);
  assert.deepEqual(final.tags, []);
  assert.equal(final.sentences.join("").includes("smile"), false);
});

test("tag の stream 位置と event の位置は元 delta 連結位置を保つ", () => {
  const buffer = createIncrementalSentenceTagBuffer();
  buffer.append("ab<sm");
  const out = buffer.append("ile>cd<nod>");
  assert.deepEqual(out.tags.map((tag) => tag.position), [2, 11]);
  assert.deepEqual(out.tags.flatMap((tag) => tag.events.map((event) => event.position)), [2, 11]);
});

test("壊れた angle bracket は本文を保ち、fragmentation 後も bracket を speech に漏らさない", () => {
  const source = "😀<smile>短い。前< これは >後。応答>です。終わり";
  const expectedSentences = ["😀短い。", "前 これは 後。", "応答です。", "終わり"];
  for (const chunks of [
    [source],
    ["😀<s", "mile>短", "い。前< ", "これは >後。応", "答>です。終", "わり"],
    source.split("") // deliberately splits the surrogate pair into JS code units
  ]) {
    const buffer = createIncrementalSentenceTagBuffer();
    const output = chunks.flatMap((chunk) => buffer.append(chunk).sentences);
    output.push(...buffer.flush().sentences);
    assert.deepEqual(output, expectedSentences);
    assert.ok(!output.join("").includes("<"));
    assert.ok(!output.join("").includes(">"));
  }
});

test("valid tag prefix は flush まで control syntax として保持し、malformed/non-tag body は保持する", () => {
  const validPrefix = createIncrementalSentenceTagBuffer();
  validPrefix.append("前<smile");
  assert.deepEqual(validPrefix.flush().sentences, ["前"]);

  const malformed = createIncrementalSentenceTagBuffer();
  malformed.append("前<未閉じ");
  assert.deepEqual(malformed.flush().sentences, ["前未閉じ"]);
});

// ── 応答の遅れの直し（latency-fix-plan.md §2-3）: 文の後ろの完結したタグも文の区切り ──────────

/**
 * 1 文字ずつの偽物の delta 列を流し、最初の文が出た delta の番号（出なければ "flush"）と、出た文の全部を返す
 * （調査の buf-repro と同じ形）。
 * @param {string} text
 */
function streamByChar(text) {
  const buffer = createIncrementalSentenceTagBuffer();
  /** @type {number | "flush" | null} */
  let firstAt = null;
  /** @type {string[]} */
  const sentences = [];
  /** @type {string[]} */
  const tags = [];
  const chunks = [...text];
  chunks.forEach((ch, i) => {
    const out = buffer.append(ch);
    if (out.sentences.length > 0 && firstAt === null) firstAt = i + 1;
    sentences.push(...out.sentences);
    tags.push(...out.tags.map((tag) => tag.raw));
  });
  const final = buffer.flush();
  if (final.sentences.length > 0 && firstAt === null) firstAt = "flush";
  sentences.push(...final.sentences);
  tags.push(...final.tags.map((tag) => tag.raw));
  return { firstAt, sentences, tags, total: chunks.length };
}

test("句点の無い文の後ろの表情タグで、タグを読んだ時点で文を出す（タグは文に含めない）", () => {
  const r = streamByChar("ほんとにそれは大事なところだね<nod>");
  assert.equal(r.firstAt, r.total, "タグの閉じの delta で出る（返事の締めを待たない）");
  assert.deepEqual(r.sentences, ["ほんとにそれは大事なところだね"]);
  assert.deepEqual(r.tags, ["<nod>"]);
});

test("句点の後ろのタグ・先頭のタグは今までどおり（空の文を出さない）", () => {
  const withPeriod = streamByChar("そうだね。<nod>");
  assert.equal(withPeriod.firstAt, 5, "句点で出る");
  assert.deepEqual(withPeriod.sentences, ["そうだね。"]);
  assert.deepEqual(withPeriod.tags, ["<nod>"]);

  const leading = streamByChar("<smile>ほんとにそうだね");
  assert.equal(leading.firstAt, "flush", "先頭のタグの前には文が無い");
  assert.deepEqual(leading.sentences, ["ほんとにそうだね"]);
});

test("文の間のタグも区切り: タグの前と後ろを別の文にする（つなげた本文は変わらない）", () => {
  const r = streamByChar("えっ<surprised>ほんとに？");
  assert.equal(r.firstAt, "えっ<surprised>".length);
  assert.deepEqual(r.sentences, ["えっ", "ほんとに？"]);
  assert.equal(r.sentences.join(""), "えっほんとに？");

  const r2 = streamByChar("そうだね<nod>でもさ、それって大事だよ。");
  assert.deepEqual(r2.sentences, ["そうだね", "でもさ、それって大事だよ。"]);
});

test("6 語すべてのタグが区切りになり、events は今までどおり出る", () => {
  for (const word of ["smile", "troubled", "surprised", "nod", "look-away", "look-camera"]) {
    const buffer = createIncrementalSentenceTagBuffer();
    const out = buffer.append(`うん<${word}>`);
    assert.deepEqual(out.sentences, ["うん"], word);
    assert.deepEqual(out.tags.map((tag) => tag.events.map((event) => event.word)), [[word]], word);
  }
});

test("知らない語のタグ・壊れた山括弧・絵文字だけの前置きは区切りにしない", () => {
  assert.deepEqual(streamByChar("そうだね<unknown>ほんと").sentences, ["そうだねほんと"]);
  assert.deepEqual(streamByChar("そうだね< これは >ほんと").sentences, ["そうだね これは ほんと"]);
  assert.deepEqual(streamByChar("😀<smile>短い。").sentences, ["😀短い。"]);
});

test("思い出しの目印: <recall の後ろが決まった時点で、その前の句点の無い文を出す（目印の終わりを待たない）", () => {
  const text = "ちょっと記録見てくるね<recall 前回>";
  const r = streamByChar(text);
  assert.equal(r.firstAt, "ちょっと記録見てくるね<recall ".length, "目印だと決まった delta で出る");
  assert.deepEqual(r.sentences, ["ちょっと記録見てくるね"]);
  assert.deepEqual(r.tags, ["<recall 前回>"]);

  const buffer = createIncrementalSentenceTagBuffer();
  assert.deepEqual(buffer.append("見てくるね<recal").sentences, [], "<recall と決まるまでは区切らない");
  assert.deepEqual(buffer.append("l").sentences, [], "<recallx の可能性が残る間は区切らない");
  assert.deepEqual(buffer.append(" 前回>").sentences, ["見てくるね"]);
  const final = buffer.flush();
  assert.deepEqual(final.sentences, []);
  assert.deepEqual(final.tags.flatMap((tag) => tag.recalls.map((recall) => recall.request)), ["前回"]);
});

test("任意の delta 分割でも、タグの区切りで出た文はつなげると元の声の本文になる", () => {
  const source = "そうだね<nod>次も行こう。<smile>うん";
  const expected = ["そうだね", "次も行こう。", "うん"];
  for (let split = 0; split <= source.length; split += 1) {
    const buffer = createIncrementalSentenceTagBuffer();
    const out = [...buffer.append(source.slice(0, split)).sentences, ...buffer.append(source.slice(split)).sentences, ...buffer.flush().sentences];
    assert.deepEqual(out, expected, `split=${split}`);
  }
});
