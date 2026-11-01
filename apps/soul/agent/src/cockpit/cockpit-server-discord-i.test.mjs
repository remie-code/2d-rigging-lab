// @ts-check
/**
 * Discord モード Domain I: 体験と VC 接続を分ける（discord-mode.md §13.2・§13.3・計画 §8 Domain I）— 本物の cockpit-server と
 * src/discord/discord-experience.mjs を、偽の Discord（src/test-support/fake-discord.mjs）・偽の耳・偽の orchestrator でつなぐ。
 *  - POST /api/discord/vc（入る / 抜ける / 移る）: 場の段を通らない（頭のセッション・正本・判定・目は同じもの・renewRecords を
 *    呼ばない）・同じサーバーの VC だけ・準備の discordChannelId を書き換えない・場が開いていなければ断る。GET は VC の一覧。
 *  - どの VC にもいない間: 耳は「聞いていない」（文字起こしの方式・稼働時間は残る）・自発（遅れて返った判定）と手動の Fire・
 *    Fire+視覚は not-in-vc で断り、fire-refused は 1 回だけ・抜けた瞬間に鳴っている返事は止める（interrupt）。
 *  - 外から: 4014 で「VC の外で待っている」・それ以外の切れは「切れた」・自分で抜けた・移ったときに「切れた」が出ない・
 *    動かされたら今の VC が動いた先になる。
 *  - 「通話を終える」（POST /api/stream/stop）は VC にいてもいなくても場を閉じて記憶を書く。
 *  - control の記録（入る・抜ける・移る・切れた・動かされた・外から切られた）・snapshot の vcName。JSON に VC の名前（control）・
 *    Discord の id（snapshot・放送・ログ）が載らない。配信の場は変わらない。
 * 本物の Discord・LLM・外部 API は呼ばない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCockpitServer, DISCORD_VC_NOT_OPEN_MESSAGE, NOT_IN_VC_FIRE_MESSAGE } from "./cockpit-server.mjs";
import { createFileSettingsStore } from "./cockpit-settings-store.mjs";
import { createDiscordExperience, DISCORD_REASONS, DISCORD_VC_REFUSALS } from "../discord/discord-experience.mjs";
import { createFakeDiscord, FAKE_CHANNEL_TYPE } from "../test-support/fake-discord.mjs";
import { controlUsageRecord, fireRefusedUsageRecord } from "../mind/session-usage-log.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

const GUILD = "guild-fake-1";
const OTHER_GUILD = "guild-fake-2";
const CHANNEL = "channel-fake-1";
const CHANNEL_2 = "channel-fake-2";
const TEXT_CHANNEL = "channel-fake-text";
const OTHER_GUILD_CHANNEL = "channel-fake-other";
const USER_A = "user-fake-a";
const NAME_A = "たろう";
const VC_1 = "一般";
const VC_2 = "雑談";
const FAKE_TOKEN = "fake.discord-token_for-server-i";
/** snapshot・放送・ログに出てはいけない値（Discord の id・鍵・人の名前）。 */
const ID_WORDS = [GUILD, OTHER_GUILD, CHANNEL, CHANNEL_2, TEXT_CHANNEL, OTHER_GUILD_CHANNEL, USER_A, "bot-fake-1", FAKE_TOKEN];

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/** @param {() => boolean} pred @param {number} [timeoutMs] */
async function waitUntil(pred, timeoutMs = 3000) {
  const until = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > until) throw new Error("waitUntil timed out");
    await tick(5);
  }
}

/** @param {string} url @param {string} path @param {unknown} [body] */
async function post(url, path, body = {}) {
  const r = await fetch(`${url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

/** @param {string} url @param {string} path */
async function get(url, path) {
  const r = await fetch(`${url}${path}`);
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

/** SSE を読む（events に積む）。 @param {string} url */
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
          if (data) events.push({ event, data: JSON.parse(data) });
        }
      }
    } catch {
      // 閉じた。
    }
  })();
  return { events, close: () => ac.abort() };
}

/** 偽の耳（人ごとの耳 = pipelineFactory の 1 回）。 */
function makeFakeEars() {
  /** @type {Array<{ options: any; started: boolean; disposed: boolean }>} */
  const ears = [];
  const factory = (/** @type {any} */ options) => {
    const ear = { options, started: false, disposed: false };
    ears.push(ear);
    return {
      transcriptBuffer: options.transcriptBuffer,
      async start() {
        ear.started = true;
      },
      async dispose() {
        ear.disposed = true;
      },
      isDisposed: () => ear.disposed,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  /** その耳が 1 行積む（本物の耳と同じ: 積む口 → 耳ごとの口）。 @param {any} ear @param {string} text */
  const hear = (ear, text) => {
    const r = ear.options.transcriptBuffer.append({ startMs: 0, endMs: 900, text });
    if (r.appended) ear.options.onTranscript(r.entry, { latencyMs: 40, audioCtx: null });
    return r;
  };
  return { factory, ears, hear };
}

/** 偽の orchestrator（fire と interrupt を数える・状態は外から替える）。 */
function makeOrchestrator() {
  const record = { /** @type {any} */ hooks: null, /** @type {any[]} */ fires: [], interrupts: 0, state: "idle", created: 0 };
  const factory = (/** @type {any} */ hooks) => {
    record.hooks = hooks;
    record.created += 1;
    return {
      async fire(/** @type {any} */ options) {
        record.fires.push(options);
        return { fired: true, fireId: record.fires.length };
      },
      getState: () => record.state,
      async kill() {
        return { killed: true, severed: false };
      },
      revive() {},
      getKilled: () => false,
      async interrupt() {
        record.interrupts += 1;
        return { interrupted: record.state === "speaking" };
      },
      deferInstruction: () => true,
      dispose() {}
    };
  };
  return { factory, record };
}

/** @param {string[]} events */
function makeRole(events) {
  return {
    id: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    discordBotKeyFile: () => ".env.discord-chappy.local",
    hooks: {
      renewRecords: () => void events.push("renewRecords"),
      openSession: async () => {
        events.push("openSession");
        return { ok: true };
      },
      connectBody: () => ({ ok: true }),
      closeSession: () => void events.push("closeSession"),
      closeBody: () => {},
      saveFinal: (/** @type {any[]} */ transcript) => void events.push(`saveFinal:${transcript.map((e) => e.text).join("|")}`)
    },
    voice: { prepare: () => ({ ok: true }), startResources: () => {} },
    recall: null
  };
}

/**
 * @param {{ discord?: boolean; graceMs?: number }} [p]
 */
async function startServer(p = {}) {
  const dir = mkdtempSync(join(tmpdir(), "discord-i-server-"));
  const settingsPath = join(dir, "cockpit-settings.local.json");
  const settings = createFileSettingsStore({ path: settingsPath });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
  settings.setDiscordVisionTarget("偽のゲームの窓");
  const fake = createFakeDiscord({
    guilds: [
      {
        id: GUILD,
        name: "試しのサーバー",
        channels: [
          { id: CHANNEL, name: VC_1, rawPosition: 1 },
          { id: CHANNEL_2, name: VC_2, rawPosition: 2 },
          { id: TEXT_CHANNEL, name: "文字", type: FAKE_CHANNEL_TYPE.GuildText, rawPosition: 0 }
        ],
        members: { [USER_A]: NAME_A }
      },
      { id: OTHER_GUILD, name: "よそ", channels: [{ id: OTHER_GUILD_CHANNEL, name: "よその VC" }] }
    ]
  });
  /** @type {string[]} */
  const events = [];
  /** @type {string[]} */
  const logs = [];
  const discord = createDiscordExperience({
    settings,
    loadToken: () => ({ ok: true, token: FAKE_TOKEN }),
    loadLibraries: fake.loadLibraries,
    log: (line) => logs.push(line),
    loginTimeoutMs: 500,
    readyTimeoutMs: 500,
    disconnectGraceMs: p.graceMs ?? 30
  });
  const ears = makeFakeEars();
  const orchestrator = makeOrchestrator();
  /** @type {any[]} */
  const refused = [];
  /** @type {any[]} */
  const controls = [];
  /** @type {any[]} */
  const judgeRequests = [];
  /** @type {Array<(v: any) => void>} */
  const judgeWaiters = [];
  /** @type {string[]} */
  const answers = [];
  let now = 1_000_000;
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [makeRole(events)],
    ...(p.discord === false ? {} : { experiences: { discord } }),
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true }),
    selfFireInitialEnabled: true,
    backchannelMinIntervalMs: 0,
    nowImpl: () => now,
    speakNowJudge: (/** @type {any} */ request) => {
      judgeRequests.push(request);
      const answer = answers.shift();
      if (answer) return Promise.resolve({ choice: answer, probs: { [answer]: 0.9 }, latencyMs: 5 });
      // 答えを用意していなければ、テストが返すまで待つ（遅れて返った判定）。
      return new Promise((resolve) => judgeWaiters.push(resolve));
    },
    onFireRefused: (/** @type {any} */ info) => refused.push(info),
    onControl: (/** @type {any} */ info) => controls.push(info),
    onEyesStart: () => void events.push("eyes.start"),
    onEyesStop: () => void events.push("eyes.stop")
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    settings,
    settingsPath,
    fake,
    ears,
    orchestrator,
    refused,
    controls,
    judgeRequests,
    judgeWaiters,
    answers,
    events,
    logs,
    advance: (/** @type {number} */ ms) => {
      now += ms;
    },
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

/** @param {any} h */
async function openDiscord(h) {
  const r = await post(h.url, "/api/stream/start", { experience: "discord" });
  assert.equal(r.status, 200, JSON.stringify(r.json.error));
  return r.json;
}

/** その人に話させて耳を起こし、1 行聞かせる。 @param {any} h @param {string} text */
async function speakLine(h, text) {
  const before = h.ears.ears.length;
  h.fake.speak(USER_A);
  await waitUntil(() => h.ears.ears.length === before + 1 && h.ears.ears[before].started);
  h.ears.hear(h.ears.ears[before], text);
  h.fake.endSpeech(USER_A);
  await tick(5);
}

/** @param {string} text @param {string} label */
function assertNoIds(text, label) {
  for (const word of ID_WORDS) assert.equal(text.includes(word), false, `${label} に ${word} が出ている`);
}

// ── 1. 抜けて入り直す ───────────────────────────────────────────────────

test("Domain I 抜けて入り直す: 場の段を通らない（頭のセッション・正本・判定・目は同じもの・renewRecords を呼ばない）・耳は聞いていない → 聞いている・方式と稼働時間は残る", async () => {
  const h = await startServer();
  try {
    await openDiscord(h);
    h.answers.push("wait");
    await speakLine(h, "こんにちは");
    await waitUntil(() => h.judgeRequests.length === 1);
    h.advance(60_000);
    const left = await post(h.url, "/api/discord/vc", { action: "leave" });
    assert.equal(left.status, 200, JSON.stringify(left.json.error));
    assert.equal(left.json.stream.phase, "open", "体験は閉じない");
    assert.equal(left.json.stream.connection, "outside");
    assert.equal(left.json.stream.vcName, null);
    assert.equal(left.json.ears, "stopped", "耳は聞いていない");
    assert.equal(left.json.stt.engine, "elevenlabs", "文字起こしの方式は残る（配信の方式に見えない）");
    assert.equal(left.json.uptimeMs, 0);
    assert.deepEqual(left.json.transcripts.map((/** @type {any} */ e) => e.text), ["こんにちは"], "正本は続く");
    assert.equal(h.ears.ears[0].disposed, true, "人の耳は drop");
    h.advance(60_000);
    const joined = await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL });
    assert.equal(joined.status, 200, JSON.stringify(joined.json.error));
    assert.equal(joined.json.stream.connection, "joined");
    assert.equal(joined.json.stream.vcName, VC_1);
    assert.equal(joined.json.ears, "listening");
    assert.equal(joined.json.stt.status, "up");
    assert.equal(joined.json.uptimeMs, 120_000, "稼働時間は開いた時から（入り直しで数え直さない）");
    // 入り直したあとも同じ正本・同じ判定で続く。
    h.answers.push("respond");
    await speakLine(h, "続きだけど");
    await waitUntil(() => h.orchestrator.record.fires.length === 1);
    assert.equal(h.judgeRequests.length, 2, "判定は作り直さず続く");
    assert.equal(h.orchestrator.record.fires[0].cause.type, "speak-now");
    assert.deepEqual(h.server.getTranscript().map((/** @type {any} */ e) => e.text), ["こんにちは", "続きだけど"]);
    assert.deepEqual(
      h.events,
      ["renewRecords", "eyes.start", "openSession"],
      "renewRecords・頭のセッション・目は開いたときの 1 回だけ（抜ける・入るで作り直さない・閉じない）"
    );
    assert.equal(h.orchestrator.record.created, 1);
    assert.equal(h.fake.record.clients.length, 1, "ログインし直さない");
    assert.deepEqual(h.fake.record.reusedJoins, []);
    assert.deepEqual(h.controls.map((c) => c.control), ["vc-join", "vc-leave", "vc-join"]);
  } finally {
    await h.cleanup();
  }
});

// ── 2. VC にいない間の発火 ─────────────────────────────────────────────

test("Domain I VC にいない間: 遅れて返った判定の自発は not-in-vc で断る（頭へ流さない・fire-refused は 1 回）・手動の Fire / Fire+視覚も 409・入り直せば撃てる", async () => {
  const h = await startServer();
  try {
    await openDiscord(h);
    await speakLine(h, "ねえ、どう思う？");
    await waitUntil(() => h.judgeWaiters.length === 1);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    // 抜けたあとに判定が「返事する」で返る。
    h.judgeWaiters[0]({ choice: "respond", probs: { respond: 0.9 }, latencyMs: 5 });
    await waitUntil(() => h.refused.length === 1);
    await tick(20);
    assert.deepEqual(h.refused, [{ cause: "speak-now", reason: "not-in-vc", vision: false }]);
    assert.equal(h.orchestrator.record.fires.length, 0, "頭には流さない");
    // 手動の Fire・Fire+視覚。
    const fire = await post(h.url, "/api/fire");
    assert.equal(fire.status, 409);
    assert.equal(fire.json.fired, false);
    assert.equal(fire.json.reason, "not-in-vc");
    assert.equal(fire.json.error, NOT_IN_VC_FIRE_MESSAGE);
    assert.equal(fire.json.state, "idle");
    const vision = await post(h.url, "/api/vision-fire");
    assert.equal(vision.status, 409);
    assert.equal(vision.json.reason, "not-in-vc");
    assert.deepEqual(h.refused.slice(1), [
      { cause: "manual", reason: "not-in-vc", vision: false },
      { cause: "manual", reason: "not-in-vc", vision: true }
    ], "断りは 1 回ずつ（orchestrator の断りと二重にならない）");
    assert.equal(h.orchestrator.record.fires.length, 0);
    // 記録の行にしても名前・id は載らない。
    assertNoIds(JSON.stringify(h.refused.map(fireRefusedUsageRecord)), "fire-refused");
    // 入り直せば撃てる（断りは増えない）。
    await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL_2 });
    const again = await post(h.url, "/api/fire");
    assert.equal(again.status, 202);
    assert.equal(h.orchestrator.record.fires.length, 1);
    assert.equal(h.refused.length, 3);
  } finally {
    await h.cleanup();
  }
});

test("Domain I 抜けた瞬間に鳴っている返事は止める（割り込みと同じ切り方）・外から切られたときも", async () => {
  const h = await startServer();
  try {
    await openDiscord(h);
    h.orchestrator.record.state = "speaking";
    await post(h.url, "/api/discord/vc", { action: "leave" });
    assert.equal(h.orchestrator.record.interrupts, 1);
    await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL });
    h.fake.kickBot();
    await waitUntil(() => h.server.streamStatus().phase === "open" && h.orchestrator.record.interrupts === 2);
  } finally {
    await h.cleanup();
  }
});

// ── 3. 外から・自分で ───────────────────────────────────────────────────

test("Domain I 外から: 4014 は「VC の外で待っている」・それ以外の切れは「切れた」・自分で抜けた / 移ったときは「切れた」が出ない・動かされたら今の VC が動いた先", async () => {
  const h = await startServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    await openDiscord(h);
    // 自分で移る・抜ける・入る。
    assert.equal((await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 })).json.stream.vcName, VC_2);
    await post(h.url, "/api/discord/vc", { action: "leave" });
    await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL });
    await tick(60);
    const states = () => sse.events.filter((e) => e.event === "state").map((e) => e.data.stream.connection);
    assert.equal(states().includes("disconnected"), false, "自分で抜けた・移ったときは「切れた」と出さない");
    assert.ok(states().includes("outside"));
    // 4014 でない切れ。
    h.fake.setConnectionStatus("disconnected");
    await tick(60);
    let st = (await get(h.url, "/api/state")).json;
    assert.equal(st.stream.connection, "disconnected");
    assert.equal(st.stream.vcName, VC_1, "つなぎ直しを待つ間は今の VC のまま");
    h.fake.setConnectionStatus("ready");
    // 動かされた。
    h.fake.moveBot(CHANNEL_2, { closeCode4014: true });
    await waitUntil(() => /** @type {any} */ (h.fake.connection()).joinConfig.channelId === CHANNEL_2);
    await tick(60);
    st = (await get(h.url, "/api/state")).json;
    assert.equal(st.stream.connection, "joined");
    assert.equal(st.stream.vcName, VC_2, "動いた先を今の VC として追う");
    // 4014（キック）。
    h.fake.kickBot({ voiceState: false });
    await waitUntil(() => (/** @type {any} */ (h.fake.connection())).destroyCount === 1);
    st = (await get(h.url, "/api/state")).json;
    assert.equal(st.stream.connection, "outside");
    assert.equal(st.stream.phase, "open", "体験は閉じない");
    assert.equal(st.ears, "stopped");
    assert.deepEqual(h.controls.map((c) => c.control), [
      "vc-join",
      "vc-move",
      "vc-leave",
      "vc-join",
      "vc-disconnect",
      "vc-moved",
      "vc-kicked"
    ]);
    // VC の外で手動の Fire は断る。
    assert.equal((await post(h.url, "/api/fire")).json.reason, "not-in-vc");
  } finally {
    sse.close();
    await h.cleanup();
  }
});

// ── 4. API の断り ───────────────────────────────────────────────────────

test("Domain I API: 場が閉じている・配信の場・形の違う action / id・ほかのサーバー / 文字のチャンネル / 無い VC・状態の合わない操作は断る・準備の discordChannelId は書き換えない", async () => {
  const h = await startServer();
  try {
    let r = await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL });
    assert.equal(r.status, 409, "場が閉じている");
    assert.equal(r.json.error, DISCORD_VC_NOT_OPEN_MESSAGE);
    assert.equal((await get(h.url, "/api/discord/vc")).status, 409);
    await post(h.url, "/api/stream/start", { device: "Mic" });
    r = await post(h.url, "/api/discord/vc", { action: "leave" });
    assert.equal(r.status, 409, "配信の場");
    assert.equal(r.json.state.stream.vcName, null);
    await post(h.url, "/api/stream/stop");

    await openDiscord(h);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "jump", channelId: CHANNEL_2 })).status, 400);
    assert.equal((await post(h.url, "/api/discord/vc", {})).status, 400);
    r = await post(h.url, "/api/discord/vc", { action: "move", channelId: "../etc" });
    assert.equal(r.status, 400);
    assert.equal(r.json.error, DISCORD_VC_REFUSALS.channelId);
    for (const id of [TEXT_CHANNEL, OTHER_GUILD_CHANNEL, "channel-fake-none"]) {
      r = await post(h.url, "/api/discord/vc", { action: "move", channelId: id });
      assert.equal(r.status, 404, id);
      assert.equal(r.json.error, DISCORD_REASONS.channel);
      assert.equal(r.json.state.stream.vcName, VC_1, "使えない VC へは移らない");
    }
    r = await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL_2 });
    assert.equal(r.status, 409);
    assert.equal(r.json.error, DISCORD_VC_REFUSALS.inVc);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL })).status, 409, "同じ VC");
    assert.equal((await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 })).status, 200);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    r = await post(h.url, "/api/discord/vc", { action: "leave" });
    assert.equal(r.status, 409);
    assert.equal(r.json.error, DISCORD_VC_REFUSALS.notInVc);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL })).status, 409);
    // 一覧（Domain K のための口）: 同じサーバーの VC（id は応答にだけ）。
    const listed = await get(h.url, "/api/discord/vc");
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.json.channels.map((/** @type {any} */ c) => [c.id, c.name, c.current]), [
      [CHANNEL, VC_1, false],
      [CHANNEL_2, VC_2, false]
    ]);
    // 準備は書き換えない（次に「Discord の VC に入る」で入る先は準備の VC のまま）。
    assert.deepEqual((await get(h.url, "/api/discord/prep")).json.prep, { guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
    assert.equal(JSON.parse(readFileSync(h.settingsPath, "utf8")).discordChannelId, CHANNEL, "設定ファイルの準備の VC も同じ");
  } finally {
    await h.cleanup();
  }
  const none = await startServer({ discord: false });
  try {
    assert.equal((await post(none.url, "/api/discord/vc", { action: "leave" })).status, 503);
  } finally {
    await none.cleanup();
  }
});

// ── 5. 通話を終える ─────────────────────────────────────────────────────

for (const where of /** @type {const} */ (["outside", "moved"])) {
  test(`Domain I 通話を終える（${where === "outside" ? "VC にいない" : "移った先の VC にいる"}）: 場を閉じて記憶を書く・ログアウトする・入り直すと準備の VC`, async () => {
    const h = await startServer();
    try {
      await openDiscord(h);
      await speakLine(h, "今日はここまで");
      if (where === "outside") await post(h.url, "/api/discord/vc", { action: "leave" });
      else await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 });
      const r = await post(h.url, "/api/stream/stop");
      assert.equal(r.status, 200, JSON.stringify(r.json.error));
      assert.equal(r.json.stream.phase, "closed");
      assert.equal(r.json.stream.connection, null);
      assert.equal(r.json.stream.vcName, null);
      assert.ok(h.events.includes("saveFinal:今日はここまで"), JSON.stringify(h.events));
      assert.ok(h.events.includes("closeSession"));
      assert.equal(h.fake.record.destroyedClients, 1, "ログアウトする");
      assert.ok(h.fake.record.connections.every((c) => c.state.status === "destroyed"));
      // もう一度開けば準備の VC へ。
      const again = await openDiscord(h);
      assert.equal(again.stream.vcName, VC_1);
      assert.equal(h.fake.record.joins.at(-1).channelId, CHANNEL);
    } finally {
      await h.cleanup();
    }
  });
}

// ── 6. 守り ─────────────────────────────────────────────────────────────

test("Domain I 守り: control の JSON に VC の名前・Discord の id が載らない・snapshot / 放送 / ログに id が載らない・snapshot に今いる VC の名前", async () => {
  const h = await startServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    const opened = await openDiscord(h);
    assert.equal(opened.stream.vcName, VC_1);
    await speakLine(h, "やあ");
    await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 });
    h.fake.voiceState({ userId: USER_A, guildId: GUILD, from: null, to: CHANNEL_2, name: NAME_A });
    h.fake.moveBot(CHANNEL, { closeCode4014: true });
    await waitUntil(() => (/** @type {any} */ (h.fake.connection())).joinConfig.channelId === CHANNEL);
    await tick(60);
    await post(h.url, "/api/discord/vc", { action: "leave" });
    await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL });
    h.fake.kickBot();
    await waitUntil(() => (/** @type {any} */ (h.fake.connection())).destroyCount === 1);
    await tick(20);
    const records = h.controls.map(controlUsageRecord);
    assert.ok(records.every((r) => r != null), "どの種類も記録の一覧にある");
    assert.deepEqual(records.map((r) => /** @type {any} */ (r).control), ["vc-join", "vc-move", "vc-moved", "vc-leave", "vc-join", "vc-kicked"]);
    const recordJson = JSON.stringify(records) + JSON.stringify(h.controls);
    assertNoIds(recordJson, "control");
    for (const name of [VC_1, VC_2, NAME_A]) assert.equal(recordJson.includes(name), false, `control に ${name}`);
    const snap = (await get(h.url, "/api/state")).json;
    const wire = JSON.stringify(sse.events) + JSON.stringify(snap);
    assertNoIds(wire, "snapshot・放送");
    assert.ok(sse.events.some((e) => e.event === "state" && e.data.stream.vcName === VC_2), "snapshot に今いる VC の名前");
    const logText = h.logs.join("\n");
    assertNoIds(logText, "ログ");
    for (const name of [VC_1, VC_2, NAME_A]) assert.equal(logText.includes(name), false, `ログに ${name}`);
  } finally {
    sse.close();
    await h.cleanup();
  }
});

test("Domain I 配信の場は変わらない: vcName は null・connection は null・手動の Fire は撃てる（not-in-vc で断らない）", async () => {
  const h = await startServer();
  try {
    const r = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(r.status, 200);
    assert.equal(r.json.stream.vcName, null);
    assert.equal(r.json.stream.connection, null);
    const fire = await post(h.url, "/api/fire");
    assert.equal(fire.status, 202);
    assert.deepEqual(h.refused, []);
    assert.deepEqual(h.controls, []);
  } finally {
    await h.cleanup();
  }
});
