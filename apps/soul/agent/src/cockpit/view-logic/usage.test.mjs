// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { usageNoteText } from "./usage.mjs";

test("usageNoteText: input/output tokens を控えめに（applyUsage 同値・cockpit.html:551-553）", () => {
  assert.equal(
    usageNoteText({ usage: { input_tokens: 1200, output_tokens: 88 } }),
    "usage: input=1200 output=88"
  );
  assert.equal(usageNoteText({ usage: { input_tokens: 0, output_tokens: 0 } }), "usage: input=0 output=0");
});

test("usageNoteText: vision:true は usage(vision) を付ける", () => {
  assert.equal(
    usageNoteText({ vision: true, usage: { input_tokens: 3400, output_tokens: 120 } }),
    "usage(vision): input=3400 output=120"
  );
});

test("usageNoteText: usage 欠落・tokens 欠落は ?", () => {
  assert.equal(usageNoteText({}), "usage: input=? output=?");
  assert.equal(usageNoteText(null), "usage: input=? output=?");
  assert.equal(usageNoteText({ usage: {} }), "usage: input=? output=?");
  assert.equal(usageNoteText({ usage: { input_tokens: 10 } }), "usage: input=10 output=?");
});

test("usageNoteText: brain 札（多頭化 Domain C・additive）", () => {
  assert.equal(
    usageNoteText({ brain: "claude", usage: { input_tokens: 1200, output_tokens: 88 } }),
    "usage[claude]: input=1200 output=88"
  );
  assert.equal(
    usageNoteText({ brain: "codex", vision: true, usage: { input_tokens: 3400, output_tokens: 120 } }),
    "usage(vision)[codex]: input=3400 output=120"
  );
  // brain 未指定/null は従来どおりの文字列（後方互換）。
  assert.equal(
    usageNoteText({ usage: { input_tokens: 1200, output_tokens: 88 } }),
    "usage: input=1200 output=88"
  );
  assert.equal(
    usageNoteText({ brain: null, usage: { input_tokens: 1200, output_tokens: 88 } }),
    "usage: input=1200 output=88"
  );
});
