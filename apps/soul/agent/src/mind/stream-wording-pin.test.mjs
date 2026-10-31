// @ts-check
/**
 * 配信の文字列の固定テスト（Discord モード Domain A・設計 discord-mode.md §3.3・§3.4「配信の文面を守る形」）。
 *
 * 配信の場面の転写（fixtures/stream-wording-pin-input.mjs）から作る①への行・②④の固定の指示と頼み・④の結果の文面・
 * `skills/recall.md` の本文（①に渡る教えとして読み込まれたもの）・判定の入力が、土台の前（HEAD `6327a42b`、コードは
 * `84df62db` と同じ）と一字も違わないことを確かめる。
 *
 *  - 期待値（fixtures/stream-wording-pin-expected.mjs）は、コードに手を入れる前に HEAD の出力を書き写した文字列。
 *    今の関数で組み直して比べるのではない。**このブランチの最後まで期待値を変えない。**
 *  - 呼び出し（fixtures/stream-wording-pin-calls.mjs）は期待値と分けて持つ。組み立てが替わったら呼び出しだけを合わせる。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { streamWordingPinCases } from "./fixtures/stream-wording-pin-calls.mjs";
import { STREAM_WORDING_PIN_EXPECTED } from "./fixtures/stream-wording-pin-expected.mjs";

const cases = streamWordingPinCases();

test("stream wording pin: every pinned case has a call, and every call has a pinned string", () => {
  assert.deepEqual(cases.map(([name]) => name).sort(), Object.keys(STREAM_WORDING_PIN_EXPECTED).sort());
});

for (const [name, produce] of cases) {
  test(`stream wording pin: ${name} is unchanged from before the foundation`, () => {
    const expected = STREAM_WORDING_PIN_EXPECTED[name];
    assert.equal(typeof expected, "string", `no pinned string for ${name}`);
    assert.strictEqual(produce(), expected);
  });
}
