// @ts-check
// 配信の組み直し Domain E: ロールの編集・新しいロール（cockpit.mjs の createRoleHooks.edit / create・createRoleEditHooks）と、
// 本物の cockpit-server の POST /api/role/edit・/api/role/new を一時フォルダのロールの置き場でつなぐテスト。
// 記憶の置き場の表示（createRoleMemoryPlaces.placeInfo）・起動時の引っ越しの失敗の警告（startupMigrationWarnings）・main() の
// 結線（ソースの文字列の照合・Domain B〜D と同じ流儀）も見る。実データ・本物の LLM・外部 API には触れない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createRoleHooks,
  createRoleEditHooks,
  createRoleMemoryPlaces,
  startupMigrationWarnings
} from "./cockpit.mjs";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import {
  readRole,
  readRoleInstructions,
  roleFromIdentity,
  writeRole,
  writeRoleInstructions
} from "../src/roles/role-store.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";

/** @param {any} t */
function makeRolesDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "cockpit-role-edit-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** @param {{ roleChoice?: string | null }} [init] */
function makeSettings(init = {}) {
  let roleChoice = init.roleChoice ?? null;
  return {
    getRoleChoice: () => roleChoice,
    setRoleChoice: (/** @type {string | null} */ id) => {
      roleChoice = id;
    },
    getBrainChoice: () => null
  };
}

/** chappy（GPT・体あり・性格の指示の上書きあり）と cody を置き場に書く。 @param {string} dir */
function writeTwoRoles(dir) {
  writeRole({ dir, role: roleFromIdentity(MODEL_IDENTITIES.chappy, { brain: "codex-61-sol", verbosity: "chatty", speakStartMode: "speak-now", body: true, hotwords: ["チャッピー"] }) });
  writeRole({ dir, role: roleFromIdentity(MODEL_IDENTITIES.cody, { brain: "claude-opus-55", body: true }) });
  writeRoleInstructions({ dir, id: "chappy", text: "チャッピーの性格の指示" });
}

// ── createRoleHooks.edit ─────────────────────────────────────────────────

test("createRoleHooks.edit: 体だけを編集すると roleHooks.current() がすぐ新しい値を返し、role.json にも書く（ほかの持ち物はそのまま）", (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const hooks = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "chappy" }) });
  assert.equal(hooks.current().body, true);
  const result = hooks.edit({ body: false });
  assert.equal(result.ok, true);
  assert.equal(hooks.current().body, false, "current() が新しい体を返す（currentBody() はこれを読む）");
  assert.equal(hooks.current().brain, "codex-61-sol");
  assert.equal(hooks.current().verbosity, "chatty");
  const onDisk = readRole({ dir, id: "chappy" });
  assert.equal(onDisk.ok && onDisk.role.body, false, "置き場にも書いた");
  assert.equal(onDisk.ok && onDisk.role.brain, "codex-61-sol");
});

test("createRoleHooks.edit: 名前・モデル・声・口数・話し始めを書き、名前を替えたら identity() も新しい名前になる", (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const hooks = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "cody" }) });
  const result = hooks.edit({
    name: { canonical: "コーディ", display: "コーディ先生", latin: "Cody" },
    brain: "codex-astra",
    voice: { engine: "elevenlabs", aivisSpeaker: 3, elevenLabsVoiceId: "voice_01" },
    verbosity: "quiet",
    speakStartMode: "classic"
  });
  assert.equal(result.ok, true);
  const role = hooks.current();
  assert.equal(role.name.display, "コーディ先生");
  assert.equal(role.brain, "codex-astra");
  assert.deepEqual({ ...role.voice }, { engine: "elevenlabs", aivisSpeaker: 3, elevenLabsVoiceId: "voice_01" });
  assert.equal(role.verbosity, "quiet");
  assert.equal(role.speakStartMode, "classic");
  assert.equal(hooks.identity().displayName, "コーディ先生");
  assert.deepEqual(hooks.list().find((r) => r.id === "cody"), { id: "cody", displayName: "コーディ先生", brain: "codex-astra" });
  // 読み直しても同じ。
  const reread = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "cody" }) });
  assert.equal(reread.current().name.display, "コーディ先生");
});

test("createRoleHooks.edit: 確かめに通らない書き換えは断り、置き場も今のロールも変えない", (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const hooks = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "chappy" }) });
  const before = readFileSync(join(dir, "chappy", "role.json"), "utf8");
  for (const bad of [{ brain: "nope" }, { body: "no" }, { voice: { aivisSpeaker: -3 } }, { name: { canonical: "", display: "x" } }]) {
    const result = hooks.edit(bad);
    assert.equal(result.ok, false, JSON.stringify(bad));
  }
  assert.equal(readFileSync(join(dir, "chappy", "role.json"), "utf8"), before);
  assert.equal(hooks.current().brain, "codex-61-sol");
});

test("createRoleHooks.edit / create: 置き場から読んだロールでなければ（引っ越しに失敗した起動）断り、roles/ を作らない", (t) => {
  const root = makeRolesDir(t);
  const rolesDir = join(root, "roles");
  const hooks = createRoleHooks({ rolesDir, settings: makeSettings() });
  assert.equal(hooks.isPersisted(), false);
  assert.equal(hooks.edit({ body: false }).ok, false);
  assert.equal(hooks.create({ id: "mio" }).ok, false);
  assert.equal(existsSync(rolesDir), false, "roles/ を作らない（次の起動で引っ越しがもう一度走れる）");
});

test("createRoleHooks.edit: 書き込みの失敗は投げる（API の 500）・今のロールは替えない", (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const hooks = createRoleHooks({
    rolesDir: dir,
    settings: makeSettings({ roleChoice: "chappy" }),
    writeRoleImpl: () => {
      throw new Error("disk full (fake)");
    }
  });
  assert.throws(() => hooks.edit({ body: false }), /disk full/);
  assert.equal(hooks.current().body, true);
});

// ── createRoleHooks.create ───────────────────────────────────────────────

test("createRoleHooks.create: 今のロールを写して新しいロールを作る（モデル・声・口数・話し始め・体・性格の指示を写し、名前は新しい名前）", (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const hooks = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "chappy" }) });
  const result = hooks.create({ id: "mio", name: "ミオ" });
  assert.equal(result.ok, true);
  const read = readRole({ dir, id: "mio" });
  assert.equal(read.ok, true);
  const mio = /** @type {any} */ (read).role;
  assert.deepEqual({ ...mio.name }, { canonical: "ミオ", display: "ミオ", latin: "" });
  assert.equal(mio.brain, "codex-61-sol");
  assert.equal(mio.verbosity, "chatty");
  assert.equal(mio.body, true);
  assert.deepEqual([...mio.nameHints.voiceCallVariants], ["ミオ"], "写した元の名前（チャッピー）で呼ばれたと取り違えない");
  assert.equal(readRoleInstructions({ dir, id: "mio" }).override, "チャッピーの性格の指示", "性格の指示も写す");
  assert.equal(hooks.currentId(), "chappy", "選ぶのは呼び出し側（select）");
  assert.ok(hooks.knownIds().includes("mio"), "一覧に入る");
});

test("createRoleHooks.create: 同じ id があれば conflict で断る・予約名や形の違う id は断る（置き場に書かない）", (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const hooks = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "chappy" }) });
  const dup = hooks.create({ id: "cody" });
  assert.equal(dup.ok, false);
  assert.equal(/** @type {any} */ (dup).conflict, true);
  for (const id of ["con", "lpt1", "Mio", "1a"]) {
    assert.equal(hooks.create({ id }).ok, false, id);
    assert.equal(existsSync(join(dir, id)), false, id);
  }
});

// ── createRoleEditHooks（main の onRoleEdited = 頭・声の方式を揃え、頭の文脈の revision を進める）──────────

test("createRoleEditHooks.onUpdateRole: 編集できたら onRoleEdited（revision を進める）を呼び、口数・話し始め・声の方式を返す・断ったら呼ばない", (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const roleHooks = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "chappy" }) });
  let sessionContextRevision = 0;
  /** @type {any[]} */
  const edited = [];
  const editHooks = createRoleEditHooks({
    roleHooks,
    selectRole: () => assert.fail("編集では選ばない"),
    onRoleEdited: (role) => {
      edited.push(role);
      sessionContextRevision += 1;
    }
  });
  const result = editHooks.onUpdateRole({ verbosity: "quiet", voice: { engine: "elevenlabs" } });
  assert.deepEqual(result, { ok: true, verbosity: "quiet", speakStartMode: "speak-now", ttsEngine: "elevenlabs" });
  assert.equal(sessionContextRevision, 1);
  assert.equal(edited[0].id, "chappy");
  const refused = editHooks.onUpdateRole({ verbosity: "loud" });
  assert.equal(refused.ok, false);
  assert.equal(sessionContextRevision, 1, "断ったら revision を進めない");
});

test("createRoleEditHooks.onCreateRole: 作ったロールを selectRole（main の onSetRole）で選ぶ・作れなければ選ばない", async (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const roleHooks = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "chappy" }) });
  /** @type {string[]} */
  const selected = [];
  const editHooks = createRoleEditHooks({
    roleHooks,
    selectRole: (id) => {
      selected.push(id);
      const r = roleHooks.select(id);
      return r.ok ? { ok: true, verbosity: r.role.verbosity, speakStartMode: r.role.speakStartMode, ttsEngine: r.role.voice.engine } : r;
    },
    onRoleEdited: () => assert.fail("作るときは編集の口を呼ばない")
  });
  const result = await editHooks.onCreateRole({ id: "mio", name: "ミオ" });
  assert.equal(result.ok, true);
  assert.deepEqual(selected, ["mio"]);
  assert.equal(roleHooks.currentId(), "mio");
  const dup = await editHooks.onCreateRole({ id: "mio" });
  assert.equal(dup.ok, false);
  assert.deepEqual(selected, ["mio"], "作れなければ選ばない");
});

// ── 本物の cockpit-server + 本物の createRoleHooks（一時フォルダ）──────────────────────────

/** 偽の耳（場を開くため・転写の正本は本物の transcript-buffer）。 */
function makeEars() {
  return () => ({
    transcriptBuffer: createTranscriptBuffer({ nowImpl: () => 1000 }),
    async start() {},
    async dispose() {},
    isDisposed: () => false,
    streamMs: () => 0,
    stats: () => ({})
  });
}

/** @param {string} url @param {string} path @param {unknown} [body] */
async function post(url, path, body = {}) {
  const r = await fetch(`${url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

test("POST /api/role/edit（本物の server・本物の createRoleHooks）: 体だけを編集すると roleHooks.current() が新しい値を返し、編集の API が sessionContextRevision を上げる・場の途中は 409", async (t) => {
  const dir = makeRolesDir(t);
  writeTwoRoles(dir);
  const roleHooks = createRoleHooks({ rolesDir: dir, settings: makeSettings({ roleChoice: "chappy" }) });
  let sessionContextRevision = 0;
  const editHooks = createRoleEditHooks({
    roleHooks,
    selectRole: (id) => ({ ok: roleHooks.select(id).ok }),
    onRoleEdited: () => {
      sessionContextRevision += 1;
    }
  });
  const roleStatus = () => {
    const role = roleHooks.current();
    return { id: role.id, displayName: role.name.display, brain: role.brain, body: role.body, verbosity: role.verbosity, roles: roleHooks.list() };
  };
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (makeEars()),
    onSetRole: async (id) => ({ ok: roleHooks.select(id).ok }),
    roleStatus,
    onUpdateRole: editHooks.onUpdateRole,
    onCreateRole: editHooks.onCreateRole
  });
  const url = await server.listen(0);
  try {
    const edited = await post(url, "/api/role/edit", { body: false });
    assert.equal(edited.status, 200);
    assert.equal(edited.json.role.body, false, "snapshot の role も新しい体");
    assert.equal(roleHooks.current().body, false, "roleHooks.current() が新しい値を返す");
    assert.equal(sessionContextRevision, 1, "編集の API が sessionContextRevision を上げる（次のセッションは新しい体で作る）");
    // 場の途中は断る（ロールの持ち物は場の途中で替えない）。
    const opened = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(opened.json.stream.phase, "open", JSON.stringify(opened.json.error ?? null));
    const refused = await post(url, "/api/role/edit", { body: true });
    assert.equal(refused.status, 409);
    assert.equal(roleHooks.current().body, false);
    assert.equal(sessionContextRevision, 1);
    const refusedNew = await post(url, "/api/role/new", { id: "mio" });
    assert.equal(refusedNew.status, 409);
    assert.equal(existsSync(join(dir, "mio")), false);
    await post(url, "/api/stream/stop");
    // 閉じたら作れる（作ったロールが今のロール）。
    const created = await post(url, "/api/role/new", { id: "mio", name: "ミオ" });
    assert.equal(created.status, 200);
    assert.equal(created.json.role.id, "mio");
    assert.equal(roleHooks.currentId(), "mio");
  } finally {
    await server.close();
  }
});

// ── 記憶のタブ: どのロールの記憶か（placeInfo・置き場を作らない）──────────────────────────

test("createRoleMemoryPlaces.placeInfo: 今のロールの roleId / dir を返すが、置き場を作らない・準備（git init・種）を走らせない・記憶を読み書きしない起動は null", () => {
  /** @type {any[]} */
  const prepared = [];
  let role = { id: "chappy", name: { canonical: "チャッピー" } };
  const places = createRoleMemoryPlaces({
    root: join("C:", "tmp", "placeinfo-test"),
    currentRole: () => role,
    startedAtMs: 0,
    prepareImpl: async (/** @type {any} */ options) => {
      prepared.push(options.dir);
      return { ok: true };
    },
    createIdentityImpl: () => ({ get: () => ({}) })
  });
  assert.deepEqual(places.placeInfo(), { roleId: "chappy", dir: join("C:", "tmp", "placeinfo-test", "chappy") });
  role = { id: "mio", name: { canonical: "ミオ" } };
  assert.deepEqual(places.placeInfo(), { roleId: "mio", dir: join("C:", "tmp", "placeinfo-test", "mio") });
  assert.deepEqual(prepared, [], "placeInfo は準備を走らせない");
  // place() と同じ決め方（place() を作ったあとも同じ値）。
  const place = places.place();
  assert.equal(place.roleId, "mio");
  assert.deepEqual(places.placeInfo(), { roleId: place.roleId, dir: place.dir });
  const unavailable = createRoleMemoryPlaces({ root: "x", currentRole: () => role, startedAtMs: 0, available: false });
  assert.equal(unavailable.placeInfo(), null);
});

// ── 起動時の引っ越しの失敗は上の帯の警告にも出す ─────────────────────────────────

test("startupMigrationWarnings: 記憶・ロールの引っ越しの失敗を上の帯の警告にする（失敗が無ければ空）・server の startupWarnings で snapshot の warnings に出る", async () => {
  assert.deepEqual(startupMigrationWarnings({ roles: { status: "migrated" }, memories: { status: "skipped" } }), []);
  const warnings = startupMigrationWarnings({
    roles: { status: "skipped" },
    memories: /** @type {any} */ ({ status: "failed", error: "EBUSY (fake)", backupPath: null, leftovers: [] })
  });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].kind, "memory-migration-failed");
  assert.equal(warnings[0].severity, "alert");
  assert.match(warnings[0].message, /記憶の引っ越しに失敗した/);
  assert.equal(warnings[0].detail, "EBUSY (fake)");
  const both = startupMigrationWarnings({
    roles: /** @type {any} */ ({ status: "failed", error: "x" }),
    memories: /** @type {any} */ ({ status: "failed", error: "y" })
  });
  assert.deepEqual(both.map((w) => w.kind), ["memory-migration-failed", "role-migration-failed"]);
  const server = createCockpitServer({ startupWarnings: warnings });
  const url = await server.listen(0);
  try {
    const state = /** @type {any} */ (await (await fetch(`${url}/api/state`)).json());
    const shown = state.warnings.find((/** @type {any} */ w) => w.kind === "memory-migration-failed");
    assert.ok(shown, "上の帯の警告に出る");
    assert.equal(shown.severity, "alert");
    assert.equal(shown.lifetime, "state", "起動の間ずっと出る（60 秒で消えない）");
  } finally {
    await server.close();
  }
});

// ── main() の結線（ソースの文字列の照合）─────────────────────────────────────

test("ロールの編集の結線（main）: onUpdateRole / onCreateRole / startupWarnings を server へ渡し、編集したら sessionContextRevision を進める・snapshot の role に編集の持ち物・memory に placeInfo", () => {
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const main = source.slice(source.indexOf("async function main()"));
  assert.match(main, /onUpdateRole: roleEditHooks\.onUpdateRole,/);
  assert.match(main, /onCreateRole: roleEditHooks\.onCreateRole,/);
  assert.match(main, /startupWarnings: startupMigrationWarnings\(startupMigration\),/);
  assert.match(main, /selectRole: \(id\) => onSetRole\(id\),/, "新しいロールは onSetRole と同じ道で選ぶ");
  assert.match(main, /onRoleEdited: \(role\) => \{\n\s+currentBrain = role\.brain;\n\s+desiredTtsEngine = role\.voice\.engine;\n\s+sessionContextRevision \+= 1;/, "編集したら頭の文脈の revision を進める");
  assert.match(main, /voice: \{ engine: role\.voice\.engine, aivisSpeaker: role\.voice\.aivisSpeaker, elevenLabsVoiceId: role\.voice\.elevenLabsVoiceId \},/);
  assert.match(main, /editable: roleHooks\.isPersisted\(\),/);
  assert.match(main, /const info = memoryPlaces\.placeInfo\(\);/, "記憶のタブは置き場を作らずに roleId / dir を出す");
  assert.match(main, /const currentBody = \(\) => roleHooks\.current\(\)\.body !== false;/, "体は持ち回らず今のロールから読む（編集がすぐ効く）");
});
