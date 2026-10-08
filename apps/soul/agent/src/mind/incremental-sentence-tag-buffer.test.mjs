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
