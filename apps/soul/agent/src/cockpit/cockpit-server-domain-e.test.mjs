// @ts-check
// 配信の組み直し Domain E: cockpit-server の画面の組み直しに伴う口のテスト（本物の server・loopback の HTTP・偽の耳と
// orchestrator だけ）。
//  - POST /api/role/edit・/api/role/new（ロールの編集・今のロールを写して新しいロール・場の途中は 409）
//  - PUT / DELETE /api/conversation-instructions/:roleId も場の途中は 409（性格の指示はロールの持ち物）
//  - 場が閉じている間の手動の発火（POST /api/fire・/api/vision-fire）は 409
//  - openStream / closeStream が想定外の例外で opening / closing のまま固まらない
// 実データ・本物の LLM・外部 API には触れない。
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCockpitServer } from "./cockpit-server.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { createFireScheduler } from "../mind/fire-scheduler.mjs";

/** @param {string} url @param {string} path @param {unknown} [body] @param {string} [method] */
async function send(url, path, body = {}, method = "POST") {
  const r = await fetch(`${url}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

/** @param {string} url */
async function state(url) {
  return /** @type {any} */ (await (await fetch(`${url}/api/state`)).json());
}

/** 偽の耳（転写の正本は本物の transcript-buffer）。 */
function makeEars() {
  const record = { created: 0, disposed: 0, /** @type {any} */ buffer: null, allThrows: false };
  const factory = () => {
    record.created += 1;
    const buffer = createTranscriptBuffer({ nowImpl: () => 1000 });
    record.buffer = buffer;
    const all = buffer.all.bind(buffer);
    buffer.all = () => {
      if (record.allThrows) throw new Error("transcript copy failed (fake)");
      return all();
    };
    return {
      transcriptBuffer: buffer,
      async start() {},
      async dispose() {
        record.disposed += 1;
      },
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  return { factory, record };
}

/** 偽の orchestrator（発火の数を数える）。 */
function makeOrchestrator() {
  const record = { fires: /** @type {any[]} */ ([]) };
  const factory = () => ({
    async fire(/** @type {any} */ options) {
      record.fires.push(options);
      return { fired: true };
    },
    getState: () => "idle",
    async kill() {
      return { killed: true, severed: false };
    },
    revive() {},
    getKilled: () => false,
    async interrupt() {
      return { interrupted: true };
    },
    dispose() {}
  });
  return { factory, record };
}

/** 偽のロールの口（今のロールと編集・新しいロールの呼び出しを記録）。 */
function makeRoleHooks() {
  const role = { id: "chappy", displayName: "チャッピー", brain: "codex-61-sol", body: true, verbosity: "normal", speakStartMode: "speak-now" };
  const calls = { update: /** @type {any[]} */ ([]), create: /** @type {any[]} */ ([]) };
  /** @type {any} */
  let nextUpdate = null;
  /** @type {any} */
  let nextCreate = null;
  return {
    role,
    calls,
    /** @param {any} r */ setNextUpdate: (r) => (nextUpdate = r),
    /** @param {any} r */ setNextCreate: (r) => (nextCreate = r),
    options: {
      onSetRole: async (/** @type {string} */ id) => {
        role.id = id;
        return { ok: true };
      },
      roleStatus: () => ({ ...role, roles: [] }),
      onUpdateRole: async (/** @type {any} */ patch) => {
        calls.update.push(patch);
        if (typeof nextUpdate === "function") return nextUpdate(patch);
        if (nextUpdate) return nextUpdate;
        Object.assign(role, patch.body === undefined ? {} : { body: patch.body });
        return { ok: true, verbosity: "chatty", speakStartMode: "classic", ttsEngine: "elevenlabs" };
      },
      onCreateRole: async (/** @type {any} */ input) => {
        calls.create.push(input);
        if (nextCreate) return nextCreate;
        role.id = input.id;
        return { ok: true, verbosity: "quiet", speakStartMode: "speak-now", ttsEngine: "aivis" };
      }
    }
  };
}

/** @param {object} [extra] */
async function startServer(extra = {}) {
  const ears = makeEars();
  const orchestrator = makeOrchestrator();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    ...extra
  });
  const url = await server.listen(0);
  return { server, url, ears, orchestrator };
}

// ── POST /api/role/edit ────────────────────────────────────────────────────

test("POST /api/role/edit: 今のロールを編集する口を呼び、口数・話し始め・声の方式をサーバの現況に入れる（snapshot と SSE state）", async () => {
  const roles = makeRoleHooks();
  const { server, url } = await startServer(roles.options);
  try {
    const before = await state(url);
    assert.equal(before.verbosity, "normal");
    const r = await send(url, "/api/role/edit", { body: false, verbosity: "chatty" });
    assert.equal(r.status, 200);
    assert.deepEqual(roles.calls.update, [{ body: false, verbosity: "chatty" }], "画面の中身をそのまま渡す（確かめは cockpit.mjs）");
    assert.equal(r.json.role.body, false);
    assert.equal(r.json.verbosity, "chatty", "口数はロールの値");
    assert.equal(r.json.speakStart, "classic", "話し始めはロールの値");
    assert.equal(r.json.tts.engine, "elevenlabs", "声の方式（次の始めるの既定）もロールの値");
  } finally {
    await server.close();
  }
});

test("POST /api/role/edit: 断られたら 400（理由）・書けなければ 500・形の違う body は 400・未注入は 503", async () => {
  const roles = makeRoleHooks();
  const { server, url } = await startServer(roles.options);
  try {
    roles.setNextUpdate({ ok: false, reason: "知らないモデル" });
    const refused = await send(url, "/api/role/edit", { brain: "x" });
    assert.equal(refused.status, 400);
    assert.equal(refused.json.error, "知らないモデル");
    roles.setNextUpdate(() => {
      throw new Error("disk full (fake)");
    });
    const failed = await send(url, "/api/role/edit", { body: true });
    assert.equal(failed.status, 500);
    assert.match(failed.json.error, /disk full/);
    const malformed = await send(url, "/api/role/edit", "{not json");
    assert.equal(malformed.status, 400);
    const array = await send(url, "/api/role/edit", [1, 2]);
    assert.equal(array.status, 400);
  } finally {
    await server.close();
  }
  const bare = createCockpitServer({});
  const bareUrl = await bare.listen(0);
  try {
    assert.equal((await send(bareUrl, "/api/role/edit", {})).status, 503);
    assert.equal((await send(bareUrl, "/api/role/new", { id: "mio" })).status, 503);
  } finally {
    await bare.close();
  }
});

test("POST /api/role/edit・/api/role/new: 場が閉じていない間（開いている・閉じかけ）は呼ばずに 409（場の途中でロールの持ち物を替えない）・閉じたら通る", async () => {
  const roles = makeRoleHooks();
  /** @type {Array<() => void>} */
  const releases = [];
  const { server, url } = await startServer({
    ...roles.options,
    streamHooks: {
      saveFinal: () => new Promise((resolve) => releases.push(() => resolve(undefined)))
    }
  });
  try {
    await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal((await state(url)).stream.phase, "open");
    assert.equal((await send(url, "/api/role/edit", { body: false })).status, 409);
    assert.equal((await send(url, "/api/role/new", { id: "mio" })).status, 409);
    const stopping = send(url, "/api/stream/stop");
    while (releases.length === 0) await new Promise((r) => setImmediate(r));
    assert.equal((await state(url)).stream.phase, "closing");
    assert.equal((await send(url, "/api/role/edit", { body: false })).status, 409, "閉じかけ（記録中）も断る");
    releases[0]();
    await stopping;
    assert.deepEqual(roles.calls.update, []);
    assert.deepEqual(roles.calls.create, []);
    assert.equal((await send(url, "/api/role/edit", { body: false })).status, 200, "閉じたら直せる");
  } finally {
    await server.close();
  }
});

test("POST /api/role/new: id の形（Windows の予約名を含む）を確かめてから呼ぶ・同じ id は 409・作れたら新しいロールの口数などを入れる", async () => {
  const roles = makeRoleHooks();
  const { server, url } = await startServer(roles.options);
  try {
    for (const id of ["con", "NUL", "com1", "lpt9", "Mio", "1a", "", null, 3]) {
      const r = await send(url, "/api/role/new", { id });
      assert.equal(r.status, 400, String(id));
    }
    assert.equal((await send(url, "/api/role/new", { id: "mio", name: 3 })).status, 400, "名前は文字列か null");
    assert.deepEqual(roles.calls.create, [], "形の違う id では呼ばない");
    roles.setNextCreate({ ok: false, reason: "ロール mio はもうある", conflict: true });
    const dup = await send(url, "/api/role/new", { id: "mio" });
    assert.equal(dup.status, 409);
    assert.equal(dup.json.error, "ロール mio はもうある");
    roles.setNextCreate(null);
    const created = await send(url, "/api/role/new", { id: "mio", name: "ミオ" });
    assert.equal(created.status, 200);
    assert.deepEqual(roles.calls.create.at(-1), { id: "mio", name: "ミオ" });
    assert.equal(created.json.role.id, "mio");
    assert.equal(created.json.verbosity, "quiet");
  } finally {
    await server.close();
  }
});

// ── 性格の指示も場の途中は書き換えない ─────────────────────────────────────

test("PUT / DELETE /api/conversation-instructions/:roleId: 場の途中は 409（読むのは通る）・閉じたら書ける", async () => {
  /** @type {string[]} */
  const writes = [];
  const { server, url } = await startServer({
    conversationInstructionHooks: {
      isKnownId: (/** @type {string} */ id) => id === "chappy",
      getProfile: () => ({ body: "本文", hasOverride: false }),
      save: (/** @type {string} */ id, /** @type {string} */ text) => {
        writes.push(`save:${id}:${text}`);
        return true;
      },
      reset: (/** @type {string} */ id) => {
        writes.push(`reset:${id}`);
        return true;
      },
      getRevision: () => 0
    }
  });
  try {
    await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal((await send(url, "/api/conversation-instructions/chappy", {}, "GET")).status, 200);
    assert.equal((await send(url, "/api/conversation-instructions/chappy", { instruction: "x" }, "PUT")).status, 409);
    assert.equal((await send(url, "/api/conversation-instructions/chappy", {}, "DELETE")).status, 409);
    assert.deepEqual(writes, []);
    await send(url, "/api/stream/stop");
    assert.equal((await send(url, "/api/conversation-instructions/chappy", { instruction: "x" }, "PUT")).status, 200);
    assert.deepEqual(writes, ["save:chappy:x"]);
  } finally {
    await server.close();
  }
});

// ── 場が閉じている間の手動の発火は断る ───────────────────────────────────────

test("POST /api/fire・/api/vision-fire: 場が閉じている間は 409 で断り orchestrator に頼まない・開いている間は通る・終えたらまた断る", async () => {
  const { server, url, orchestrator } = await startServer();
  try {
    for (const path of ["/api/fire", "/api/vision-fire"]) {
      const r = await send(url, path);
      assert.equal(r.status, 409, path);
      assert.equal(r.json.fired, false);
      assert.equal(r.json.reason, "stream-not-open");
      assert.match(r.json.error, /配信を始めてから/);
    }
    assert.equal(orchestrator.record.fires.length, 0, "場の外では頭に頼まない（頭のセッションを場の外で立てない）");
    await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal((await send(url, "/api/fire")).status, 202);
    assert.equal((await send(url, "/api/vision-fire")).status, 202);
    assert.equal(orchestrator.record.fires.length, 2);
    await send(url, "/api/stream/stop");
    assert.equal((await send(url, "/api/fire")).status, 409);
    assert.equal(orchestrator.record.fires.length, 2);
  } finally {
    await server.close();
  }
});

// ── openStream / closeStream が想定外の例外で固まらない ────────────────────────────

test("配信を始める: 想定外の例外（工場関数の throw）でも opening のまま固まらず、起こしたものを畳んで closed + error に戻る・もう一度始められる", async () => {
  let made = 0;
  let throwOnce = true;
  const { server, url, ears } = await startServer({
    fireSchedulerFactory: (/** @type {any} */ opts) => {
      made += 1;
      // 起動時の 1 回目は通し、始めるの作り直しで 1 回だけ投げる。
      if (made === 2 && throwOnce) {
        throwOnce = false;
        throw new Error("scheduler factory exploded (fake)");
      }
      return createFireScheduler(opts);
    }
  });
  try {
    const r = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(r.status, 500);
    assert.match(r.json.error, /想定外のエラー.*scheduler factory exploded/);
    const s = await state(url);
    assert.equal(s.stream.phase, "closed", "opening のまま固まらない");
    assert.match(s.stream.error, /scheduler factory exploded/);
    assert.equal(s.ears, "stopped");
    // ロールを選び直せる・もう一度始められる。
    const again = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(again.status, 200);
    assert.equal(again.json.stream.phase, "open");
    assert.equal(again.json.stream.error, null);
    assert.equal(ears.record.created, 1);
  } finally {
    await server.close();
  }
});

test("配信を終える: 想定外の例外（写しの throw）でも closing のまま固まらず closed に戻る（耳は畳む）・もう一度始められる", async () => {
  const { server, url, ears } = await startServer();
  try {
    await send(url, "/api/stream/start", { device: "Mic" });
    ears.record.allThrows = true;
    const r = await send(url, "/api/stream/stop");
    assert.equal(r.status, 500);
    assert.match(r.json.error, /想定外のエラー.*transcript copy failed/);
    const s = await state(url);
    assert.equal(s.stream.phase, "closed", "closing のまま固まらない");
    assert.equal(s.ears, "stopped", "畳み残しをもう一度畳む");
    assert.equal(ears.record.disposed, 1);
    ears.record.allThrows = false;
    const again = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(again.json.stream.phase, "open");
    // Ctrl+C（endStream）も同じ道で閉じる。
    ears.record.allThrows = true;
    await server.endStream();
    assert.equal(server.streamStatus().phase, "closed");
  } finally {
    await server.close();
  }
});
