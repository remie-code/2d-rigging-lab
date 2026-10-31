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

// ── 配信の組み直し 仕上げ ─────────────────────────────────────────────────────
//  - POST /api/verbosity・/api/speak-start も場が閉じていなければ 409（ロールの持ち物・何も変えない）
//  - 開きかけ・閉じかけの間の YouTube の Connect は 409（全体の突き合わせの持ち越し 2）
//  - closeStream で想定外の例外が出ても、記憶の最後の保存がまだなら 1 回だけ頼む
//  - openStream で耳を起こしたあとの想定外の例外でも、耳・目・頭のセッション・器を畳む（全体の突き合わせの持ち越し 1）

/** 偽のチャット器官（工場の呼び出しと stop を記録）。 */
function makeChat() {
  const record = { created: 0, stopped: 0 };
  const factory = (/** @type {{ source: string }} */ { source }) => {
    record.created += 1;
    return {
      async start() {},
      stop() {
        record.stopped += 1;
      },
      getState: () => "live",
      getSource: () => source,
      onMessage: () => () => {},
      onStatus: () => () => {},
      onDiagnostic: () => () => {}
    };
  };
  return { factory, record };
}

/** 場の口の偽物（saveFinal を手で待たせられる・呼び出しを記録）。 */
function makeHeldStreamHooks() {
  const calls = { saveFinal: /** @type {any[]} */ ([]) };
  /** @type {Array<() => void>} */
  const releases = [];
  const hooks = {
    saveFinal: (/** @type {any} */ transcript) => {
      calls.saveFinal.push(transcript);
      return new Promise((resolve) => releases.push(() => resolve(undefined)));
    }
  };
  return { hooks, calls, releases };
}

test("POST /api/verbosity・/api/speak-start: 場が閉じていない間（開いている・閉じかけ）は 409 で何も変えない（永続化も呼ばない）・閉じていれば通る", async () => {
  /** @type {string[]} */
  const persisted = [];
  const held = makeHeldStreamHooks();
  const { server, url } = await startServer({
    streamHooks: held.hooks,
    onSetVerbosity: (/** @type {string} */ m) => persisted.push(`verbosity:${m}`),
    onSetSpeakStartMode: (/** @type {string} */ m) => persisted.push(`speak:${m}`)
  });
  try {
    const before = await state(url);
    const otherSpeak = before.speakStart === "classic" ? "speak-now" : "classic";
    await send(url, "/api/stream/start", { device: "Mic" });
    for (const [path, mode] of [["/api/verbosity", "chatty"], ["/api/speak-start", otherSpeak]]) {
      const r = await send(url, path, { mode });
      assert.equal(r.status, 409, `${path} は場の途中は断る`);
      assert.match(r.json.error, /配信の途中は/);
      assert.equal(r.json.state.stream.phase, "open", "/api/role/edit と同じ返し方（error と state）");
    }
    // 閉じかけ（記録中）も断る。
    const stopping = send(url, "/api/stream/stop");
    while (held.releases.length === 0) await new Promise((r) => setImmediate(r));
    assert.equal((await state(url)).stream.phase, "closing");
    assert.equal((await send(url, "/api/verbosity", { mode: "chatty" })).status, 409, "閉じかけも断る");
    assert.equal((await send(url, "/api/speak-start", { mode: otherSpeak })).status, 409, "閉じかけも断る");
    held.releases[0]();
    await stopping;
    const after = await state(url);
    assert.equal(after.verbosity, before.verbosity, "口数は替わっていない");
    assert.equal(after.speakStart, before.speakStart, "話し始めは替わっていない");
    assert.deepEqual(persisted, [], "永続化も呼ばない");
    // 閉じていれば通る。
    const v = await send(url, "/api/verbosity", { mode: "chatty" });
    assert.equal(v.status, 200);
    assert.equal(v.json.verbosity, "chatty");
    const s = await send(url, "/api/speak-start", { mode: otherSpeak });
    assert.equal(s.status, 200);
    assert.equal(s.json.speakStart, otherSpeak);
    assert.deepEqual(persisted, ["verbosity:chatty", `speak:${otherSpeak}`]);
  } finally {
    await server.close();
  }
});

test("POST /api/chat/connect: 閉じかけ（記録中）の間は 409 で器官を作らない（場の外に残さない）・開きかけも 409・開いている間は通る", async () => {
  const chat = makeChat();
  const held = makeHeldStreamHooks();
  /** @type {Array<() => void>} */
  const openReleases = [];
  let holdOpening = false;
  const { server, url } = await startServer({
    chatClientFactory: /** @type {any} */ (chat.factory),
    streamHooks: {
      ...held.hooks,
      renewRecords: () => (holdOpening ? new Promise((resolve) => openReleases.push(() => resolve(undefined))) : undefined)
    }
  });
  try {
    await send(url, "/api/stream/start", { device: "Mic" });
    const stopping = send(url, "/api/stream/stop");
    while (held.releases.length === 0) await new Promise((r) => setImmediate(r));
    assert.equal((await state(url)).stream.phase, "closing");
    const refused = await send(url, "/api/chat/connect", { source: "https://youtube.example/today" });
    assert.equal(refused.status, 409);
    assert.match(refused.json.error, /終えている途中/);
    assert.equal(chat.record.created, 0, "閉じかけの間は器官を作らない");
    assert.equal(refused.json.state.chat.enteredThisBoot, false, "何も変えない（入れたことにもしない）");
    held.releases[0]();
    await stopping;
    const closedState = await state(url);
    assert.equal(closedState.stream.phase, "closed");
    assert.equal(closedState.chat.connected, false, "場の外に器官が残らない");
    // 開きかけも断る（始める 7 のつなぎと競らない）。
    holdOpening = true;
    const opening = send(url, "/api/stream/start", { device: "Mic" });
    while (openReleases.length === 0) await new Promise((r) => setImmediate(r));
    assert.equal((await state(url)).stream.phase, "opening");
    assert.equal((await send(url, "/api/chat/connect", { source: "https://youtube.example/today" })).status, 409);
    assert.equal(chat.record.created, 0);
    openReleases[0]();
    await opening;
    holdOpening = false;
    // 開いている間は通る（ふだんの流れ）。
    const connected = await send(url, "/api/chat/connect", { source: "https://youtube.example/today" });
    assert.equal(connected.status, 200);
    assert.equal(connected.json.chat.connected, true);
    assert.equal(chat.record.created, 1);
  } finally {
    await server.close();
  }
});

test("配信を終える: 畳む途中で想定外の例外が出ても、記憶の最後の保存を 1 回だけ（その場の写しで）頼み、残りも畳んで closed に戻る・もう一度始められる", async () => {
  /** @type {any[]} */
  const saves = [];
  const calls = { closeBody: 0, eyesStopped: 0 };
  let throwOnCloseSession = false;
  const { server, url, ears } = await startServer({
    onEarsStopped: () => {
      calls.eyesStopped += 1;
    },
    streamHooks: {
      // 頭のセッションを畳む口を引いた瞬間に想定外に投げる（runStreamHook の try の外 = 想定外の例外）。
      get closeSession() {
        if (throwOnCloseSession) throw new Error("closeSession exploded (fake)");
        return async () => {};
      },
      closeBody: async () => {
        calls.closeBody += 1;
      },
      saveFinal: async (/** @type {any} */ transcript) => {
        saves.push(transcript);
      }
    }
  });
  try {
    await send(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 900, text: "今日はありがとう" });
    throwOnCloseSession = true;
    const closeBodyBefore = calls.closeBody;
    const r = await send(url, "/api/stream/stop");
    assert.equal(r.status, 500);
    assert.match(r.json.error, /想定外のエラー.*closeSession exploded/);
    assert.equal(saves.length, 1, "最後の保存は 1 回だけ頼む（記憶を落とさない・二重に頼まない）");
    assert.deepEqual(saves[0].map((/** @type {any} */ e) => e.text), ["今日はありがとう"], "畳む前に取った写しで頼む");
    const s = await state(url);
    assert.equal(s.stream.phase, "closed", "closing のまま固まらない");
    assert.equal(s.ears, "stopped", "投げた段の前の耳も畳む");
    assert.equal(ears.record.disposed, 1);
    assert.ok(calls.eyesStopped >= 1, "目も畳む");
    assert.ok(calls.closeBody > closeBodyBefore, "投げた段の後の器も畳む");
    throwOnCloseSession = false;
    const again = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(again.status, 200);
    assert.equal(again.json.stream.phase, "open");
    await send(url, "/api/stream/stop");
    assert.equal(saves.length, 2, "次の場の終わりはふだんどおり 1 回");
  } finally {
    await server.close();
  }
});

test("配信を終える: 最後の保存を頼んだあとで投げても二度は頼まない・写しが取れずに投げたら空で 1 回だけ頼む・どちらも closed に戻る", async () => {
  /** @type {any[]} */
  const saves = [];
  let saveThrows = false;
  const { server, url, ears } = await startServer({
    streamHooks: {
      saveFinal: async (/** @type {any} */ transcript) => {
        saves.push(transcript);
        if (saveThrows) throw new Error("save exploded (fake)");
      }
    }
  });
  try {
    // 頼んだあとで投げる（保存の口が投げる）→ 二度は頼まない。
    await send(url, "/api/stream/start", { device: "Mic" });
    saveThrows = true;
    await send(url, "/api/stream/stop");
    assert.equal(saves.length, 1, "頼んだあとで投げても二度頼まない");
    assert.equal(server.streamStatus().phase, "closed");
    saveThrows = false;
    // 写しを取るところで投げる → 頼む前なので 1 回だけ頼む（写しは取れないので空）。
    await send(url, "/api/stream/start", { device: "Mic" });
    ears.record.allThrows = true;
    const r = await send(url, "/api/stream/stop");
    assert.equal(r.status, 500);
    assert.equal(saves.length, 2, "まだ頼んでいなければ 1 回だけ頼む");
    assert.deepEqual(saves[1], [], "写しが取れなければ空で頼む（保存の口がどうするかは cockpit.mjs）");
    assert.equal(server.streamStatus().phase, "closed");
    ears.record.allThrows = false;
    assert.equal((await send(url, "/api/stream/start", { device: "Mic" })).status, 200, "もう一度始められる");
  } finally {
    await server.close();
  }
});

test("配信を始める: 耳を起こしたあとの想定外の例外でも、耳・目・頭のセッション・器を畳んで closed + error に戻る・もう一度始められる", async () => {
  const calls = { openSession: 0, closeSession: 0, closeBody: 0, eyesStarted: 0, eyesStopped: 0 };
  let throwOnOpenSession = true;
  const { server, url, ears } = await startServer({
    onEarsStarted: () => {
      calls.eyesStarted += 1;
    },
    onEarsStopped: () => {
      calls.eyesStopped += 1;
    },
    streamHooks: {
      // 頭のセッションを作る口を引いた瞬間に 1 回だけ想定外に投げる（耳・目・声はもう起きている）。
      get openSession() {
        if (throwOnOpenSession) {
          throwOnOpenSession = false;
          throw new Error("openSession exploded (fake)");
        }
        return async () => {
          calls.openSession += 1;
        };
      },
      closeSession: async () => {
        calls.closeSession += 1;
      },
      closeBody: async () => {
        calls.closeBody += 1;
      }
    }
  });
  try {
    const r = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(r.status, 500);
    assert.match(r.json.error, /想定外のエラー.*openSession exploded/);
    assert.equal(ears.record.created, 1, "耳は起きていた");
    assert.equal(calls.eyesStarted, 1, "目と声の出口も起きていた");
    assert.equal(ears.record.disposed, 1, "耳を畳む");
    assert.equal(calls.eyesStopped, 1, "目を畳む");
    assert.equal(calls.closeSession, 1, "頭のセッションを畳む");
    assert.equal(calls.closeBody, 1, "器を畳む");
    const s = await state(url);
    assert.equal(s.stream.phase, "closed", "opening のまま固まらない");
    assert.match(s.stream.error, /openSession exploded/);
    assert.equal(s.ears, "stopped");
    const again = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(again.status, 200);
    assert.equal(again.json.stream.phase, "open");
    assert.equal(again.json.stream.error, null);
    assert.equal(calls.openSession, 1);
    assert.equal(ears.record.created, 2);
  } finally {
    await server.close();
  }
});

// ── 人間ゲート前の直し: YouTube は場を開いてから後ろでつなぐ・場が開いていない間の自発の発火は捨てる ──────────────
//  設計 stream-restructure.md §3 の 7「つながらなくても場は開く」。始めるは YouTube の start() を待たない。

/** @param {number} [ms] */
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/** @param {() => boolean} pred @param {number} [timeoutMs] */
async function waitUntil(pred, timeoutMs = 2000) {
  const until = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > until) throw new Error("waitUntil timed out");
    await tick(5);
  }
}

/**
 * 偽のチャット器官（start() は手で片付ける）。hang(source) が true の source は start が返ってこない（resolve / reject を
 * テストが呼ぶまで）。それ以外はすぐ片付く（Connect の HTTP を待たせないため）。
 * @param {{ hang?: (source: string) => boolean }} [opts]
 */
function makeDeferredChat(opts = {}) {
  const hang = opts.hang ?? (() => true);
  /** @type {any[]} */
  const clients = [];
  const factory = (/** @type {{ source: string }} */ { source }) => {
    /** @type {(v?: unknown) => void} */
    let resolve = () => {};
    /** @type {(e: unknown) => void} */
    let reject = () => {};
    const started = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const client = {
      source,
      startCalls: 0,
      stopped: 0,
      resolve,
      reject,
      start() {
        client.startCalls += 1;
        if (!hang(source)) return Promise.resolve();
        return started;
      },
      stop() {
        client.stopped += 1;
      },
      getState: () => (client.stopped > 0 ? "dead" : "connecting"),
      getSource: () => source,
      onMessage: () => () => {},
      onStatus: () => () => {},
      onDiagnostic: () => () => {}
    };
    clients.push(client);
    return client;
  };
  return { factory, clients };
}

/** SSE を読む（event と data を貯める）。 @param {string} url */
function openEvents(url) {
  /** @type {Array<{ event: string; data: any }>} */
  const events = [];
  const ac = new AbortController();
  (async () => {
    try {
      const r = await fetch(`${url}/api/events`, { signal: ac.signal });
      const reader = /** @type {any} */ (r.body).getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          try {
            events.push({ event, data: JSON.parse(data) });
          } catch {
            events.push({ event, data });
          }
        }
      }
    } catch {
      // 閉じた（abort・server close）。
    }
  })();
  return { events, close: () => ac.abort() };
}

/** 未処理の reject を数える（テストの間だけ）。 */
function watchUnhandled() {
  /** @type {unknown[]} */
  const seen = [];
  const onUnhandled = (/** @type {unknown} */ reason) => seen.push(reason);
  process.on("unhandledRejection", onUnhandled);
  return { seen, stop: () => process.off("unhandledRejection", onUnhandled) };
}

test("配信を始める: YouTube の start() が返ってこなくても場はすぐ開き、配信を終えられる（断られない）。あとから start が片付いても器官は畳んで残さない", async () => {
  const unhandled = watchUnhandled();
  const chat = makeDeferredChat();
  const { server, url } = await startServer({ chatClientFactory: chat.factory });
  try {
    await send(url, "/api/chat/source", { source: "https://youtube.example/today" });
    const started = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 200, "YouTube の応答を待たずに始めるが返る");
    assert.equal(started.json.stream.phase, "open", "場は先に開く");
    assert.equal(chat.clients.length, 1);
    assert.equal(chat.clients[0].startCalls, 1, "つなぎには行っている（後ろで）");
    const stopped = await send(url, "/api/stream/stop");
    assert.equal(stopped.status, 200, "後ろでつないでいる間も「配信を終える」は断られない");
    assert.equal(stopped.json.stream.phase, "closed");
    assert.equal(stopped.json.chat.connected, false, "終えると後ろでつないでいた器官も畳む");
    assert.equal(chat.clients[0].stopped >= 1, true);
    // あとから start が成功しても、閉じた場の器官は残さない。
    chat.clients[0].resolve();
    await tick();
    const s = await state(url);
    assert.equal(s.chat.connected, false, "あとからつながっても状態に残らない");
    assert.equal(s.stream.phase, "closed");
    assert.equal(chat.clients[0].stopped >= 1, true, "stop が呼ばれている");
    // あとから失敗しても警告は出さない・未処理の reject を出さない（閉じた場のつなぎ）。
    await send(url, "/api/stream/start", { device: "Mic" });
    await send(url, "/api/stream/stop");
    assert.equal(chat.clients.length, 2);
    chat.clients[1].reject(new Error("timeout (fake)"));
    await tick();
    assert.equal((await state(url)).chat.connected, false);
    assert.deepEqual(unhandled.seen, [], "未処理の reject を出さない");
  } finally {
    unhandled.stop();
    await server.close();
  }
});

test("配信を始める: 前の場の後ろのつなぎが、次の場が開いてから片付いても残さない（次の場のつなぎはそのまま）", async () => {
  const chat = makeDeferredChat();
  const { server, url } = await startServer({ chatClientFactory: chat.factory });
  try {
    await send(url, "/api/chat/source", { source: "https://youtube.example/today" });
    await send(url, "/api/stream/start", { device: "Mic" });
    await send(url, "/api/stream/stop");
    const second = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(second.json.stream.phase, "open");
    assert.equal(chat.clients.length, 2, "次の場は新しい器官でつなぎにいく");
    // 前の場のつなぎがあとから成功する。
    chat.clients[0].resolve();
    await tick();
    assert.equal(chat.clients[0].stopped >= 1, true, "前の場の器官は畳む");
    assert.equal(chat.clients[1].stopped, 0, "次の場の器官は畳まない");
    let s = await state(url);
    assert.equal(s.chat.connected, true, "次の場の器官は残る");
    // 次の場のつなぎが成功する → そのまま。
    chat.clients[1].resolve();
    await tick();
    s = await state(url);
    assert.equal(s.chat.connected, true);
    assert.equal(chat.clients[1].stopped, 0);
    assert.equal(s.stream.phase, "open");
  } finally {
    await server.close();
  }
});

test("配信を始める: 後ろのつなぎが失敗したら警告（ログの行）を出し、場は開いたまま・器官は畳む・未処理の reject を出さない", async () => {
  const unhandled = watchUnhandled();
  const chat = makeDeferredChat();
  const { server, url } = await startServer({ chatClientFactory: chat.factory });
  const sse = openEvents(url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    await send(url, "/api/chat/source", { source: "https://youtube.example/today" });
    const started = await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.json.stream.phase, "open");
    chat.clients[0].reject(new Error("timeout (fake)"));
    await waitUntil(() => sse.events.some((e) => e.event === "chatDiagnostic"));
    const diag = /** @type {any} */ (sse.events.find((e) => e.event === "chatDiagnostic"));
    assert.equal(diag.data.kind, "internalError");
    assert.match(diag.data.message, /配信を始めるときに YouTube につなげなかった（timeout \(fake\)・Connect でつなぎ直せる）/);
    const s = await state(url);
    assert.equal(s.stream.phase, "open", "つながらなくても場は開いたまま");
    assert.equal(s.stream.error, null);
    assert.equal(s.chat.connected, false, "つながらなかった器官は畳む");
    assert.equal(chat.clients[0].stopped, 1);
    assert.equal(s.chat.enteredThisBoot, true, "入れたことは覚えている");
    assert.deepEqual(unhandled.seen, []);
  } finally {
    unhandled.stop();
    sse.close();
    await server.close();
  }
});

test("配信を始める: 後ろのつなぎの間に Connect / Disconnect を押したら押した方を優先する（後ろのつなぎは黙って捨てる・押した器官を畳まない）", async () => {
  const unhandled = watchUnhandled();
  const chat = makeDeferredChat({ hang: (source) => source.includes("slow") });
  const { server, url } = await startServer({ chatClientFactory: chat.factory });
  const sse = openEvents(url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    await send(url, "/api/chat/source", { source: "https://youtube.example/slow" });
    await send(url, "/api/stream/start", { device: "Mic" });
    // 後ろでつないでいる間に別の URL へ Connect する。
    const connected = await send(url, "/api/chat/connect", { source: "https://youtube.example/fast" });
    assert.equal(connected.status, 200);
    assert.equal(chat.clients.length, 2);
    assert.equal(chat.clients[0].stopped, 1, "後ろでつないでいた器官は Connect が畳む");
    // 後ろのつなぎがあとから失敗しても、押した方の器官は畳まない・警告も出さない。
    chat.clients[0].reject(new Error("timeout (fake)"));
    await tick();
    let s = await state(url);
    assert.equal(s.chat.connected, true, "Connect した器官は残る");
    assert.equal(chat.clients[1].stopped, 0);
    assert.equal(sse.events.some((e) => e.event === "chatDiagnostic"), false, "押した方を優先したので警告は出さない");
    await send(url, "/api/stream/stop");
    // Disconnect: 後ろでつないでいる間に切ったら、あとからつながっても残さない。
    await send(url, "/api/chat/source", { source: "https://youtube.example/slow-again" });
    await send(url, "/api/stream/start", { device: "Mic" });
    assert.equal(chat.clients.length, 3);
    const disconnected = await send(url, "/api/chat/disconnect");
    assert.equal(disconnected.json.chat.connected, false);
    chat.clients[2].resolve();
    await tick();
    s = await state(url);
    assert.equal(s.chat.connected, false, "切ったものはあとからつながっても残さない");
    assert.equal(chat.clients[2].stopped >= 1, true);
    assert.equal(s.stream.phase, "open");
    assert.deepEqual(unhandled.seen, []);
  } finally {
    unhandled.stop();
    sse.close();
    await server.close();
  }
});

/** 発火の予定の偽物（onFireRequest を捕まえるだけ・他は何もしない）。 */
function makeSchedulerCapture() {
  /** @type {any} */
  const record = { onFireRequest: null };
  const factory = (/** @type {any} */ opts) => {
    record.onFireRequest = opts.onFireRequest;
    return {
      handleVadEvent() {},
      handleTranscript() {},
      handleChatMessage() {},
      setEnabled() {},
      isEnabled: () => true,
      setVerbosity() {},
      getVerbosity: () => "normal",
      silenceBudgetRemaining: () => 0,
      commentBudgetRemaining: () => 0,
      dispose() {}
    };
  };
  return { factory, record };
}

test("自発の発火: 場が開いていない間（閉じている・開きかけ・閉じかけ）は捨てる（頭に流さない）。開いている間だけ通す（手動の Fire と揃える）", async () => {
  const cap = makeSchedulerCapture();
  /** @type {(v?: unknown) => void} */
  let releaseSession = () => {};
  /** @type {(v?: unknown) => void} */
  let releaseSave = () => {};
  const { server, url, orchestrator } = await startServer({
    fireSchedulerFactory: /** @type {any} */ (cap.factory),
    streamHooks: {
      openSession: () =>
        new Promise((r) => {
          releaseSession = r;
        }),
      saveFinal: () =>
        new Promise((r) => {
          releaseSave = r;
        })
    }
  });
  const sse = openEvents(url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    // 閉じている間。
    cap.record.onFireRequest({ kind: "interjection" });
    await tick(20);
    assert.equal(orchestrator.record.fires.length, 0, "閉じている間の自発は捨てる");
    // 開きかけ（耳は起きている・頭のセッションの準備で止めている）。
    const starting = send(url, "/api/stream/start", { device: "Mic" });
    await waitUntil(() => server.streamStatus().phase === "opening" && server.earsStatus() === "listening");
    cap.record.onFireRequest({ kind: "interjection" });
    cap.record.onFireRequest({ kind: "silence" });
    await tick(20);
    assert.equal(orchestrator.record.fires.length, 0, "開きかけの間の自発は頭に流れない");
    releaseSession();
    const started = await starting;
    assert.equal(started.json.stream.phase, "open");
    // 開いている間は通す。
    cap.record.onFireRequest({ kind: "interjection" });
    await waitUntil(() => orchestrator.record.fires.length === 1);
    await waitUntil(() => sse.events.some((e) => e.event === "selfFire" && e.data.kind === "interjection"));
    // 閉じかけ（記憶の最後の保存で止めている）。
    const stopping = send(url, "/api/stream/stop");
    await waitUntil(() => server.streamStatus().phase === "closing");
    cap.record.onFireRequest({ kind: "interjection" });
    await tick(20);
    assert.equal(orchestrator.record.fires.length, 1, "閉じかけの間の自発は捨てる");
    releaseSave();
    assert.equal((await stopping).json.stream.phase, "closed");
    assert.equal(
      sse.events.filter((e) => e.event === "selfFire").length,
      1,
      "捨てた自発はフィードの行にもしない（開いている間の 1 回だけ）"
    );
  } finally {
    sse.close();
    await server.close();
  }
});
