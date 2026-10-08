// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fireMarkerText,
  expressionRowText,
  visionMarkerText,
  bargeInMarkerText,
  selfFireMarkerText
} from "./markers.mjs";

test("fireMarkerText: fired (N lines, M chars injected)・欠落は ?（cockpit.html:456-457）", () => {
  assert.equal(fireMarkerText({ includedCount: 3, injectedChars: 42 }), "fired (3 lines, 42 chars injected)");
  assert.equal(fireMarkerText({ includedCount: 0, injectedChars: 0 }), "fired (0 lines, 0 chars injected)");
  assert.equal(fireMarkerText({}), "fired (? lines, ? chars injected)");
});

test("expressionRowText: word args ✓A/✗R・欠落フォールバック（cockpit.html:474-478）", () => {
  assert.equal(expressionRowText({ word: "smile", applied: 2, rejected: 0 }), "smile ✓2/✗0");
  assert.equal(expressionRowText({ word: "troubled", args: "0.8", applied: 4, rejected: 1 }), "troubled 0.8 ✓4/✗1");
  // word 欠落 → "?"・applied/rejected 欠落 → 0・args 欠落 → 付かない。
  assert.equal(expressionRowText({}), "? ✓0/✗0");
});

test('visionMarkerText: saw "title" (WxH, Nms)・title/elapsed 欠落は ?（cockpit.html:495-496）', () => {
  assert.equal(
    visionMarkerText({ title: "FooGame", width: 1920, height: 1080, elapsedMs: 123 }),
    'saw "FooGame" (1920x1080, 123ms)'
  );
  // title 欠落 → "?"・elapsedMs 欠落 → "?"。
  assert.equal(visionMarkerText({ width: 800, height: 600 }), 'saw "?" (800x600, ?ms)');
});

test("bargeInMarkerText: interrupted (X/Y chars spoken, Nms)・欠落は ?（cockpit.html:520-521）", () => {
  assert.equal(
    bargeInMarkerText({ charsSpoken: 3, totalChars: 10, elapsedMs: 250 }),
    "interrupted (3/10 chars spoken, 250ms)"
  );
  assert.equal(bargeInMarkerText({}), "interrupted (?/? chars spoken, ?ms)");
});

test("selfFireMarkerText: self-fire (kind)・kind 非依存・欠落は ?（cockpit.html:539）", () => {
  assert.equal(selfFireMarkerText({ kind: "silence" }), "self-fire (silence)");
  assert.equal(selfFireMarkerText({ kind: "comment-call" }), "self-fire (comment-call)");
  assert.equal(selfFireMarkerText({}), "self-fire (?)");
});
