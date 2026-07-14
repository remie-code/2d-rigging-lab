// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveSpeaker, speakerLabel, speakerRowClass, latencyLabel } from "./transcript.mjs";

test("resolveSpeaker: 未指定は you（S2 挙動不変）", () => {
  assert.equal(resolveSpeaker({}), "you");
  assert.equal(resolveSpeaker({ speaker: null }), "you");
  assert.equal(resolveSpeaker({ speaker: "" }), "you");
  assert.equal(resolveSpeaker({ speaker: "soul" }), "soul");
  assert.equal(resolveSpeaker({ speaker: "viewer" }), "viewer");
});

test("speakerLabel: you/soul はそのまま・viewer は displayName があれば viewer(名前)", () => {
  assert.equal(speakerLabel({ speaker: "you" }), "you");
  assert.equal(speakerLabel({}), "you");
  assert.equal(speakerLabel({ speaker: "soul" }), "soul");
  // viewer + displayName → viewer(名前)（注入描画の `viewer(名前):` と対称・cockpit.html:396）。
  assert.equal(speakerLabel({ speaker: "viewer", displayName: "taro" }), "viewer(taro)");
  // displayName 欠落の viewer は素の viewer へ劣化。
  assert.equal(speakerLabel({ speaker: "viewer" }), "viewer");
  assert.equal(speakerLabel({ speaker: "viewer", displayName: "" }), "viewer");
});

test("speakerRowClass: 話者で色分け（.row.speaker-<speaker>）", () => {
  assert.equal(speakerRowClass({}), "row speaker-you");
  assert.equal(speakerRowClass({ speaker: "soul" }), "row speaker-soul");
  assert.equal(speakerRowClass({ speaker: "viewer" }), "row speaker-viewer");
});

test("latencyLabel: live 行のみ (Ns)・履歴行(null/undefined)は非表示（cockpit.html:401-404）", () => {
  assert.equal(latencyLabel(null), null); // 履歴行（latencyMs 無し）。
  assert.equal(latencyLabel(undefined), null); // != null は undefined も非表示。
  assert.equal(latencyLabel(0), "(0.0s)"); // 0 は live 行として表示（!= null）。
  assert.equal(latencyLabel(1500), "(1.5s)");
  assert.equal(latencyLabel(1234), "(1.2s)"); // toFixed(1) 丸め。
  assert.equal(latencyLabel(20_000), "(20.0s)");
});
