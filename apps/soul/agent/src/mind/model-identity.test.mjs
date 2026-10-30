// @ts-check
/** Focused fake-only tests for the frozen model-family identity contract. */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MODEL_IDENTITY,
  MODEL_IDENTITIES,
  isRoleId,
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
