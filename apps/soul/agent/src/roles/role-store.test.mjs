// @ts-check
// ロールの置き場の読み書きの機械テスト(配信の組み直し Domain A)。全て OS temp のフォルダを使い、
// 本物の apps/soul/agent/roles/ には触れない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_ROLES_DIR,
  ROLE_DEFAULTS,
  createRoleInstructionStore,
  isRoleId,
  listRoles,
  normalizeRole,
  readRole,
  readRoleInstructions,
  roleFromIdentity,
  roleIdentity,
  roleToJson,
  writeRole,
  writeRoleInstructions
} from "./role-store.mjs";
import { DEFAULT_CONVERSATION_INSTRUCTION_BODY, buildFireSystemPrompt } from "../mind/fire-orchestrator.mjs";
import { MODEL_IDENTITIES, normalizeModelIdentity } from "../mind/model-identity.mjs";

function tmpRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "role-store-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

const FULL_ROLE = Object.freeze({
  id: "mio",
  name: { canonical: "ミオ", display: "みお", latin: "Mio" },
  nameHints: {
    whisperPrompt: "みお、ミオ。",
    voiceCallVariants: ["ミオ", "みお"],
    commentCallVariants: ["Mio", "ミオ"],
    hotwords: ["ミオ"]
  },
  brain: "codex-astra",
  voice: { engine: "elevenlabs", aivisSpeaker: 1234, elevenLabsVoiceId: "abcDEF_12-x" },
  verbosity: "chatty",
  speakStartMode: "classic",
  body: false
});

test("role store: 既定の置き場は apps/soul/agent/roles", () => {
  assert.ok(DEFAULT_ROLES_DIR.replace(/\\/g, "/").endsWith("apps/soul/agent/roles"), DEFAULT_ROLES_DIR);
});

test("role store: 書いて読むと全部の持ち物が往復する(名前・手がかり・モデル・声・口数・話し始め・体)", (t) => {
  const dir = tmpRoot(t);
  const written = writeRole({ dir, role: FULL_ROLE });
  const read = readRole({ dir, id: "mio" });
  assert.equal(read.ok, true);
  const role = /** @type {any} */ (read).role;
  assert.deepEqual(role, written);
  assert.deepEqual(roleToJson(role), {
    version: 1,
    name: { canonical: "ミオ", display: "みお", latin: "Mio" },
    nameHints: {
      whisperPrompt: "みお、ミオ。",
      voiceCallVariants: ["ミオ", "みお"],
      commentCallVariants: ["Mio", "ミオ"],
      hotwords: ["ミオ"]
    },
    brain: "codex-astra",
    voice: { engine: "elevenlabs", aivisSpeaker: 1234, elevenLabsVoiceId: "abcDEF_12-x" },
    verbosity: "chatty",
    speakStartMode: "classic",
    body: false
  });
  assert.ok(Object.isFrozen(role));
  assert.ok(Object.isFrozen(role.nameHints.voiceCallVariants));
  // 置き場の形: roles/<id>/role.json(id は中に書かない)。
  const onDisk = JSON.parse(readFileSync(join(dir, "mio", "role.json"), "utf8"));
  assert.equal(onDisk.id, undefined);
  assert.equal(onDisk.version, 1);
});

test("role store: 無い・JSON でない・オブジェクトでない role.json は読めない(理由つき)", (t) => {
  const dir = tmpRoot(t);
  assert.deepEqual(readRole({ dir, id: "nobody" }), { ok: false, reason: "role.json が無い" });
  mkdirSync(join(dir, "broken"));
  writeFileSync(join(dir, "broken", "role.json"), "{ not json", "utf8");
  assert.deepEqual(readRole({ dir, id: "broken" }), { ok: false, reason: "role.json が JSON として読めない" });
  mkdirSync(join(dir, "arr"));
  writeFileSync(join(dir, "arr", "role.json"), "[1,2]", "utf8");
  assert.deepEqual(readRole({ dir, id: "arr" }), { ok: false, reason: "role.json の形が違う" });
  assert.deepEqual(readRole({ dir, id: "../escape" }), { ok: false, reason: "invalid role id" });
});

test("role store: 読めない値はその項目だけ既定にする(ロール全体は捨てない)", () => {
  const role = normalizeRole("odd", {
    name: { canonical: "  ", display: 3 },
    nameHints: { voiceCallVariants: "x", hotwords: "y" },
    brain: "codex-55",
    voice: { engine: "openai", aivisSpeaker: -1, elevenLabsVoiceId: "bad id!" },
    verbosity: "loud",
    speakStartMode: "now",
    body: "yes"
  });
  assert.equal(role.name.canonical, "odd", "呼び名が無ければ id");
  assert.equal(role.name.display, "odd");
  assert.equal(role.name.latin, "");
  assert.deepEqual(role.nameHints.voiceCallVariants, ["odd"]);
  assert.deepEqual(role.nameHints.commentCallVariants, ["odd"]);
  assert.equal(role.nameHints.whisperPrompt, "odd。");
  assert.equal(role.nameHints.hotwords, null);
  assert.equal(role.brain, ROLE_DEFAULTS.brain);
  assert.deepEqual(role.voice, { engine: "aivis", aivisSpeaker: null, elevenLabsVoiceId: null });
  assert.equal(role.verbosity, "normal");
  assert.equal(role.speakStartMode, "speak-now");
  assert.equal(role.body, true);
  assert.throws(() => normalizeRole("Bad", {}), TypeError);
});

test("role store: listRoles は id の順に読めるロールだけを並べ、読めないものは理由と分ける", (t) => {
  const dir = tmpRoot(t);
  assert.deepEqual(listRoles({ dir: join(dir, "missing") }), { roles: [], invalid: [] });
  writeRole({ dir, role: roleFromIdentity(MODEL_IDENTITIES.cody) });
  writeRole({ dir, role: roleFromIdentity(MODEL_IDENTITIES.chappy) });
  mkdirSync(join(dir, "broken"));
  mkdirSync(join(dir, "Upper")); // id の形でないフォルダは数えない。
  writeFileSync(join(dir, "stray.txt"), "x", "utf8");
  const listed = listRoles({ dir });
  assert.deepEqual(listed.roles.map((r) => r.id), ["chappy", "cody"]);
  assert.deepEqual(listed.invalid, [{ id: "broken", reason: "role.json が無い" }]);
});

test("role store: instructions.md が無い・空(空白だけ)なら既定の本文、書けば上書き、空を書けば既定へ戻る", (t) => {
  const dir = tmpRoot(t);
  writeRole({ dir, role: FULL_ROLE });
  assert.deepEqual(readRoleInstructions({ dir, id: "mio" }), {
    body: DEFAULT_CONVERSATION_INSTRUCTION_BODY,
    override: null,
    hasOverride: false,
    defaultBody: DEFAULT_CONVERSATION_INSTRUCTION_BODY
  });
  writeRoleInstructions({ dir, id: "mio", text: "  \n\t" });
  assert.equal(readRoleInstructions({ dir, id: "mio" }).hasOverride, false);
  writeRoleInstructions({ dir, id: "mio", text: "短く元気に。" });
  assert.equal(readRoleInstructions({ dir, id: "mio" }).body, "短く元気に。");
  assert.equal(readRoleInstructions({ dir, id: "mio" }).hasOverride, true);
  writeRoleInstructions({ dir, id: "mio", text: "" });
  assert.equal(readRoleInstructions({ dir, id: "mio" }).body, DEFAULT_CONVERSATION_INSTRUCTION_BODY);
  assert.equal(existsSync(join(dir, "mio", "instructions.md")), true);
});

test("role store: 会話指示の口(createRoleInstructionStore)は知っているロールの instructions.md だけを読み書きする", (t) => {
  const dir = tmpRoot(t);
  writeRole({ dir, role: FULL_ROLE });
  const store = createRoleInstructionStore({ dir, knownIds: () => ["mio"] });
  assert.equal(store.isKnownConversationInstructionId("mio"), true);
  assert.equal(store.isKnownConversationInstructionId("cody"), false);
  assert.equal(store.isKnownConversationInstructionId("../x"), false);
  assert.equal(store.getConversationInstructionProfile("mio").hasOverride, false);
  assert.equal(store.setConversationInstruction("mio", "ミオの指示"), true);
  assert.equal(readFileSync(join(dir, "mio", "instructions.md"), "utf8"), "ミオの指示");
  assert.deepEqual(store.getConversationInstructionOverrides(), { mio: "ミオの指示" });
  assert.equal(store.resetConversationInstruction("mio"), true);
  assert.equal(store.getConversationInstructionProfile("mio").body, DEFAULT_CONVERSATION_INSTRUCTION_BODY);
  assert.throws(() => store.setConversationInstruction("cody", "x"), /unknown role/);
  assert.throws(() => store.setConversationInstruction("mio", "  "), /empty instruction/);
  assert.equal(existsSync(join(dir, "cody")), false, "知らないロールのフォルダは作らない");
});

test("role store: ロールの名前は cody / chappy 以外でもそのまま名前の一文・手がかりになる", () => {
  const role = normalizeRole(FULL_ROLE.id, FULL_ROLE);
  const identity = roleIdentity(role);
  assert.deepEqual(identity, {
    id: "mio",
    canonicalName: "ミオ",
    latinName: "Mio",
    displayName: "みお",
    whisperPrompt: "みお、ミオ。",
    voiceCallVariants: ["ミオ", "みお"],
    commentCallVariants: ["Mio", "ミオ"]
  });
  assert.equal(normalizeModelIdentity(identity).canonicalName, "ミオ");
  assert.ok(buildFireSystemPrompt(identity).startsWith("あなたの名前はミオ（Mio）です。"));
  // ローマ字が無ければ括弧ごと省く。
  const plain = roleIdentity(normalizeRole("rin", { name: { canonical: "リン" } }));
  assert.ok(buildFireSystemPrompt(plain).startsWith("あなたの名前はリンです。"));
});

test("role store: cody / chappy のひな形から作ったロールの名前は今の表と同じ", () => {
  for (const preset of [MODEL_IDENTITIES.cody, MODEL_IDENTITIES.chappy]) {
    const identity = roleIdentity(roleFromIdentity(preset));
    assert.deepEqual(identity, { ...preset });
    assert.equal(buildFireSystemPrompt(identity), buildFireSystemPrompt(preset));
  }
});

test("role store: isRoleId は英小文字で始まる 32 字までの英小文字・数字・- だけ", () => {
  for (const ok of ["chappy", "cody", "a", "role-2", "x".repeat(32)]) assert.equal(isRoleId(ok), true, ok);
  for (const ng of ["", "Chappy", "1abc", "-a", "a_b", "a.b", "a/b", "..", "x".repeat(33), 3, null]) {
    assert.equal(isRoleId(ng), false, String(ng));
  }
});
