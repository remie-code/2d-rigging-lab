// @ts-check
/** Focused fake-only tests for the frozen model-family identity contract. */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MODEL_IDENTITY,
  MODEL_IDENTITIES,
  WINDOWS_RESERVED_NAMES,
  isRoleId,
  isWindowsReservedName,
  normalizeModelIdentity,
  resolveModelIdentity
} from "./model-identity.mjs";

test("model identity: Cody contract has the exact frozen values and variants", () => {
  const cody = MODEL_IDENTITIES.cody;
  assert.deepEqual(cody, {
    id: "cody",
    canonicalName: "コーディ",
    latinName: "Cody",
    displayName: "こーでぃー",
    whisperPrompt: "こーでぃー、コーディ。",
    voiceCallVariants: ["コーディ", "コーディー", "コーティ", "コーティー"],
    commentCallVariants: [
      "Cody",
      "cody",
      "CODY",
      "コーディ",
      "コーディー",
      "コーティ",
      "コーティー",
      "こーでぃー"
    ]
  });
  assert.equal(cody.commentCallVariants.length, 8);
});

test("model identity: Chappy contract has only the accepted variants", () => {
  const chappy = MODEL_IDENTITIES.chappy;
  assert.deepEqual(chappy, {
    id: "chappy",
    canonicalName: "チャッピー",
    latinName: "Chappy",
    displayName: "チャッピー",
    whisperPrompt: "ちゃっぴー、チャッピー。",
    voiceCallVariants: ["チャッピー", "ちゃっぴー"],
    commentCallVariants: ["Chappy", "chappy", "CHAPPY", "チャッピー", "ちゃっぴー"]
  });
  assert.equal(chappy.commentCallVariants.length, 5);
});

test("model identity: contract, identities, and variant arrays are deeply frozen", () => {
  assert.ok(Object.isFrozen(MODEL_IDENTITIES));
  for (const identity of Object.values(MODEL_IDENTITIES)) {
    assert.ok(Object.isFrozen(identity));
    assert.ok(Object.isFrozen(identity.voiceCallVariants));
    assert.ok(Object.isFrozen(identity.commentCallVariants));
  }
  assert.throws(() => {
    MODEL_IDENTITIES.cody.displayName = "mutated";
  }, TypeError);
  assert.throws(() => {
    MODEL_IDENTITIES.chappy.voiceCallVariants.push("invented");
  }, TypeError);
  assert.equal(resolveModelIdentity("cody"), MODEL_IDENTITIES.cody);
  assert.equal(resolveModelIdentity("chappy"), MODEL_IDENTITIES.chappy);
  assert.equal(DEFAULT_MODEL_IDENTITY, MODEL_IDENTITIES.cody);
});

test("model identity: unknown and absent identity ids retain Claude/Cody fallback", () => {
  for (const value of [undefined, null, "", "claude", "codex", "gpt", 0, {}, []]) {
    assert.equal(resolveModelIdentity(value), DEFAULT_MODEL_IDENTITY);
  }
});

test("model identity: normalizeModelIdentity はロールの名前を形だけ確かめて通す（cody / chappy 以外も・配信の組み直し Domain A）", () => {
  assert.equal(normalizeModelIdentity(MODEL_IDENTITIES.chappy), MODEL_IDENTITIES.chappy, "表そのものは同じものを返す");
  const mio = normalizeModelIdentity({
    id: "mio",
    canonicalName: " ミオ ",
    displayName: "みお",
    voiceCallVariants: ["ミオ", "ミオ", 3, ""],
    commentCallVariants: "x"
  });
  assert.deepEqual(mio, {
    id: "mio",
    canonicalName: "ミオ",
    latinName: "",
    displayName: "みお",
    whisperPrompt: "",
    voiceCallVariants: ["ミオ"],
    commentCallVariants: []
  });
  assert.ok(Object.isFrozen(mio));
  assert.ok(Object.isFrozen(mio.voiceCallVariants));
  for (const bad of [null, "chappy", {}, { id: "Mio", canonicalName: "ミオ", displayName: "みお" },
    { id: "mio", canonicalName: "", displayName: "みお" }, { id: "mio", canonicalName: "ミオ" }]) {
    assert.equal(normalizeModelIdentity(bad), DEFAULT_MODEL_IDENTITY);
  }
  assert.equal(isRoleId("chappy"), true);
  assert.equal(isRoleId("../chappy"), false);
});

test("isRoleId: Windows の予約名は大文字小文字を問わず通さない（isWindowsReservedName・配信の組み直し Domain E）", () => {
  for (const reserved of ["con", "CON", "Nul", "prn", "aux", "com0", "com1", "COM9", "lpt0", "lpt1", "LPT9"]) {
    assert.equal(isWindowsReservedName(reserved), true, reserved);
    assert.equal(isRoleId(reserved), false, reserved);
  }
  for (const ok of ["console", "com10", "lpt", "con-1", "nul2"]) {
    assert.equal(isWindowsReservedName(ok), false, ok);
    assert.equal(isRoleId(ok), true, ok);
  }
  assert.equal(WINDOWS_RESERVED_NAMES.length, 24);
  assert.ok(Object.isFrozen(WINDOWS_RESERVED_NAMES));
  // 名前を受け取る側も予約名の id は既定へ倒す。
  assert.equal(normalizeModelIdentity({ id: "con", canonicalName: "コン", displayName: "コン" }), DEFAULT_MODEL_IDENTITY);
});
