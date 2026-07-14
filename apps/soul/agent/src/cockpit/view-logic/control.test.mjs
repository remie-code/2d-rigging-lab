// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  soulStatusView,
  fireNoteFromSseFire,
  fireNoteFromFireResponse,
  fireRequestErrorNote,
  selfFireToggleView,
  selfFirePostErrorText,
  selfFireRequestErrorText,
  verbosityPostErrorText,
  verbosityRequestErrorText
} from "./control.mjs";

test("soulStatusView: thinking/speaking は busy（Fire disable）・他は idle（applySoulState :434-441）", () => {
  assert.deepEqual(soulStatusView("thinking"), {
    text: "thinking",
    className: "soul-state thinking",
    fireDisabled: true
  });
  assert.deepEqual(soulStatusView("speaking"), {
    text: "speaking",
    className: "soul-state speaking",
    fireDisabled: true
  });
  const idle = { text: "idle", className: "soul-state idle", fireDisabled: false };
  assert.deepEqual(soulStatusView("idle"), idle);
  assert.deepEqual(soulStatusView("somethingElse"), idle); // 未知は idle へ畳む（:435）。
  assert.deepEqual(soulStatusView(null), idle);
  assert.deepEqual(soulStatusView(undefined), idle);
});

test("fireNoteFromSseFire: 受理はクリア・非受理は reason（SSE fire :860-864）", () => {
  assert.equal(fireNoteFromSseFire({ accepted: true, includedCount: 3 }), "");
  assert.equal(fireNoteFromSseFire({ accepted: false, reason: "busy" }), "not fired: busy");
  assert.equal(fireNoteFromSseFire({ accepted: false }), "not fired: unknown"); // reason 欠落。
  assert.equal(fireNoteFromSseFire(null), "not fired: unknown");
});

test("fireNoteFromFireResponse: 503 は未結線文言・fired:false は reason・受理は null（:561-563 :580-582）", () => {
  assert.equal(
    fireNoteFromFireResponse({ status: 503, j: { error: "fire not available" } }),
    "fire not available (start cockpit with --channel)"
  );
  assert.equal(
    fireNoteFromFireResponse({ status: 200, j: { fired: false, reason: "ears-not-running" } }),
    "not fired: ears-not-running"
  );
  assert.equal(fireNoteFromFireResponse({ status: 200, j: { fired: false } }), "not fired: unknown");
  // 受理（202 {fired:true}）はノートを変えない（押下時 "" クリア済みの挙動を保存）。
  assert.equal(fireNoteFromFireResponse({ status: 202, j: { fired: true, state: "thinking" } }), null);
  assert.equal(fireNoteFromFireResponse({ status: 200, j: null }), null);
});

test("fireRequestErrorNote: fire/vision で prefix が分かれる（catch :566-567 :585-586）", () => {
  assert.equal(fireRequestErrorNote("fire", new Error("boom")), "fire error: Error: boom");
  assert.equal(fireRequestErrorNote("vision", new Error("boom")), "vision fire error: Error: boom");
});

test("selfFireToggleView: null は disable + not available（applySelfFire :327-333）", () => {
  const expected = {
    disabled: true,
    checked: false,
    statusText: "not available",
    statusClassName: "self-fire-status"
  };
  assert.deepEqual(selfFireToggleView(null), expected);
  assert.deepEqual(selfFireToggleView(undefined), expected);
});

test("selfFireToggleView: enabled の on/off 導出（:334-339・off は末尾スペース class = 原実装踏襲）", () => {
  assert.deepEqual(selfFireToggleView({ enabled: true }), {
    disabled: false,
    checked: true,
    statusText: "on",
    statusClassName: "self-fire-status on"
  });
  assert.deepEqual(selfFireToggleView({ enabled: false }), {
    disabled: false,
    checked: false,
    statusText: "off",
    statusClassName: "self-fire-status "
  });
  assert.deepEqual(selfFireToggleView({}), {
    disabled: false,
    checked: false,
    statusText: "off",
    statusClassName: "self-fire-status "
  });
});

test("selfFirePostErrorText: 503/!ok の文言・成功は null（POST /api/self-fire :645-648）", () => {
  assert.equal(selfFirePostErrorText({ status: 503, ok: false, j: null }), "self-fire control not available");
  assert.equal(selfFirePostErrorText({ status: 500, ok: false, j: { error: "boom" } }), "set failed: boom");
  assert.equal(selfFirePostErrorText({ status: 500, ok: false, j: {} }), "set failed: error");
  assert.equal(selfFirePostErrorText({ status: 200, ok: true, j: { selfFire: { enabled: true } } }), null);
});

test("selfFireRequestErrorText: catch 文言（:649-650）", () => {
  assert.equal(selfFireRequestErrorText(new Error("net")), "self-fire error: Error: net");
});

// ── 口数モード（wave 計画「口数配線」§2 裁定 A・selfFirePostErrorText/selfFireRequestErrorText の写経）───

test("verbosityPostErrorText: 503/!ok の文言・成功は null（POST /api/verbosity）", () => {
  assert.equal(verbosityPostErrorText({ status: 503, ok: false, j: null }), "verbosity control not available");
  assert.equal(verbosityPostErrorText({ status: 400, ok: false, j: { error: "invalid verbosity mode" } }), "set failed: invalid verbosity mode");
  assert.equal(verbosityPostErrorText({ status: 500, ok: false, j: {} }), "set failed: error");
  assert.equal(verbosityPostErrorText({ status: 200, ok: true, j: { verbosity: "chatty" } }), null);
});

test("verbosityRequestErrorText: catch 文言", () => {
  assert.equal(verbosityRequestErrorText(new Error("net")), "verbosity error: Error: net");
});
