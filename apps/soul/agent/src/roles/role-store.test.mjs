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
  applyRolePatch,
  copyRoleAs,
  createRoleInstructionStore,
  isRoleId,
  listRoles,
  normalizeRole,
  readRole,
  readRoleInstructions,
  roleDir,
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

test("role store: isRoleId は Windows の予約名（con・nul・prn・aux・com0〜9・lpt0〜9）を通さない・ロールの置き場に書けない（配信の組み直し Domain E）", () => {
  for (const reserved of ["con", "nul", "prn", "aux", "com1", "com9", "com0", "lpt1", "lpt9", "lpt0"]) {
    assert.equal(isRoleId(reserved), false, reserved);
    assert.throws(() => roleDir("x", reserved), TypeError, reserved);
    assert.equal(readRole({ dir: "x", id: reserved }).ok, false, reserved);
  }
  // 予約名を含むだけの id・予約名に似た id は通す。
  for (const ok of ["con-1", "console", "com10", "lpt", "nul2x", "auxx"]) assert.equal(isRoleId(ok), true, ok);
});

// ── ロールの編集・新しいロール（配信の組み直し Domain E）────────────────────────────

test("applyRolePatch: 名前・モデル・声・口数・話し始め・体を書き換える（書き換えない項目は今のまま・凍っている）", () => {
  const base = normalizeRole("mio", FULL_ROLE);
  const result = applyRolePatch(base, {
    brain: "claude-opus-55",
    voice: { engine: "aivis", aivisSpeaker: 7, elevenLabsVoiceId: "" },
    verbosity: "quiet",
    speakStartMode: "speak-now",
    body: true
  });
  assert.equal(result.ok, true);
  const role = /** @type {any} */ (result).role;
  assert.equal(role.brain, "claude-opus-55");
  assert.deepEqual({ ...role.voice }, { engine: "aivis", aivisSpeaker: 7, elevenLabsVoiceId: null });
  assert.equal(role.verbosity, "quiet");
  assert.equal(role.speakStartMode, "speak-now");
  assert.equal(role.body, true);
  // 名前を書き換えていなければ名前と手がかりはそのまま。
  assert.deepEqual({ ...role.name }, { ...base.name });
  assert.deepEqual([...role.nameHints.voiceCallVariants], [...base.nameHints.voiceCallVariants]);
  assert.ok(Object.isFrozen(role));
  // 体だけの書き換え。
  const bodyOnly = applyRolePatch(base, { body: true });
  assert.equal(/** @type {any} */ (bodyOnly).role.body, true);
  assert.equal(/** @type {any} */ (bodyOnly).role.brain, base.brain);
});

test("applyRolePatch: 呼び名かローマ字を替えたら名前の手がかり（呼ばれ方・whisper・hotwords）を新しい名前から作り直す", () => {
  const base = normalizeRole("mio", FULL_ROLE);
  const renamed = /** @type {any} */ (applyRolePatch(base, { name: { canonical: "ソラ", display: "そら", latin: "Sora" } })).role;
  assert.deepEqual({ ...renamed.name }, { canonical: "ソラ", display: "そら", latin: "Sora" });
  assert.equal(renamed.nameHints.whisperPrompt, "ソラ。");
  assert.deepEqual([...renamed.nameHints.voiceCallVariants], ["ソラ"]);
  assert.deepEqual([...renamed.nameHints.commentCallVariants], ["Sora", "ソラ"]);
  assert.deepEqual([...renamed.nameHints.hotwords], ["ソラ"]);
  // 見せる名前だけを替えたときは手がかりを触らない。
  const displayOnly = /** @type {any} */ (applyRolePatch(base, { name: { canonical: "ミオ", display: "ミオちゃん", latin: "Mio" } })).role;
  assert.equal(displayOnly.name.display, "ミオちゃん");
  assert.deepEqual([...displayOnly.nameHints.voiceCallVariants], ["ミオ", "みお"]);
});

test("applyRolePatch: 型の違う・範囲外の値は既定へ倒さず理由を返して断る", () => {
  const base = normalizeRole("mio", FULL_ROLE);
  for (const bad of [
    null,
    [],
    "x",
    { brain: "gpt-unknown" },
    { brain: 3 },
    { voice: "aivis" },
    { voice: { engine: "openai" } },
    { voice: { aivisSpeaker: -1 } },
    { voice: { aivisSpeaker: 1.5 } },
    { voice: { aivisSpeaker: "12" } },
    { voice: { elevenLabsVoiceId: "has space" } },
    { verbosity: "loud" },
    { speakStartMode: "now" },
    { body: "yes" },
    { name: "ミオ" },
    { name: { canonical: "", display: "みお" } },
    { name: { canonical: "ミオ", display: "" } },
    { name: { canonical: "ミオ", display: "みお", latin: 3 } },
    { name: { canonical: "x".repeat(33), display: "みお" } }
  ]) {
    const result = applyRolePatch(base, bad);
    assert.equal(result.ok, false, JSON.stringify(bad));
    assert.equal(typeof (/** @type {any} */ (result).reason), "string");
  }
});

test("copyRoleAs: 今のロールのモデル・声・口数・話し始め・体を写し、名前は新しい名前（無ければ id）で手がかりを作り直す", () => {
  const base = normalizeRole("chappy", { ...FULL_ROLE, name: { canonical: "チャッピー", display: "チャッピー", latin: "Chappy" } });
  const copied = /** @type {any} */ (copyRoleAs(base, { id: "mio", name: "ミオ" })).role;
  assert.equal(copied.id, "mio");
  assert.deepEqual({ ...copied.name }, { canonical: "ミオ", display: "ミオ", latin: "" });
  assert.deepEqual([...copied.nameHints.voiceCallVariants], ["ミオ"]);
  assert.deepEqual([...copied.nameHints.hotwords], ["ミオ"]);
  assert.equal(copied.brain, base.brain);
  assert.deepEqual({ ...copied.voice }, { ...base.voice });
  assert.equal(copied.verbosity, base.verbosity);
  assert.equal(copied.speakStartMode, base.speakStartMode);
  assert.equal(copied.body, base.body);
  const unnamed = /** @type {any} */ (copyRoleAs(base, { id: "sora" })).role;
  assert.equal(unnamed.name.canonical, "sora");
  for (const id of ["con", "NUL", "Mio", "", "a/b"]) assert.equal(copyRoleAs(base, { id }).ok, false, id);
  assert.equal(copyRoleAs(base, { id: "mio", name: "x".repeat(33) }).ok, false);
});
