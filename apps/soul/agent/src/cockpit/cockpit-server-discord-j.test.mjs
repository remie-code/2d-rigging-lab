// @ts-check
/**
 * Discord モード Domain J: 人が気づく出来事（discord-mode.md §13.5・計画 §8 Domain J）— 本物の cockpit-server と
 * src/discord/discord-experience.mjs を、偽の Discord（src/test-support/fake-discord.mjs）・偽の耳・偽の orchestrator でつなぐ。
 *  - 体験の出来事の合図（vcEvent）が会話の正本に出来事の行（speaker:"event"）として積まれ、左の「会話」へ放送される
 *    （入った〔開いたとき / パネル〕・抜けた・移った・動かされた・外された・切れた・戻った・人の入ってきた・出ていった）。
 *    Bot 自身・ほかの Bot・ほかのサーバー・今いない VC の出入りは行にならない。
 *  - 頭への会話の窓（①・orchestrator の getBuffer）・記憶の最後の保存（②・saveFinal の材料）・思い出しの入力（④・getEntries）に載る。
 *  - 判定（speak-now の Discord の問い）の入力に載らず、出来事だけでは判定も発火の予定（handleTranscript）も動かない。
 *  - 場が閉じかけ・閉じたあと・次の場を開いたあとに遅れて届いた合図は正本に足さない（control にも書かない）。
 *  - ログ（体験のログの行）・session-usage（本物の記録関数と書き手を一時フォルダで）に人の名前・VC の名前・Discord の id が出ない。
 *  - 配信の場には出来事の行が無い。配信の正本に出来事の行が混ざっても発火の予定のきっかけにはならない（場の購読が飛ばす）。
 * 本物の Discord・LLM・外部 API は呼ばない。設定・記録のファイルは OS の一時フォルダだけ（終わったら消す）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCockpitServer } from "./cockpit-server.mjs";
import { createFileSettingsStore } from "./cockpit-settings-store.mjs";
import { createDiscordExperience } from "../discord/discord-experience.mjs";
import { createFakeDiscord, FAKE_CHANNEL_TYPE } from "../test-support/fake-discord.mjs";
import { createFakeClock } from "../test-support/fake-clock.mjs";
import { controlUsageRecord, createSessionUsageLog } from "../mind/session-usage-log.mjs";
import { createFireScheduler } from "../mind/fire-scheduler.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";
import { formatFireInjection } from "../mind/fire-injection.mjs";
import { formatTranscriptForDigest, buildWriterRequest } from "../mind/memory.mjs";
import { formatRecentConversation } from "../mind/recall.mjs";
import { CALL_WORDING } from "../mind/venue-wording.mjs";

const GUILD = "guild-fake-1";
const OTHER_GUILD = "guild-fake-2";
const CHANNEL = "channel-fake-1";
const CHANNEL_2 = "channel-fake-2";
const USER_A = "user-fake-a";
const USER_B = "user-fake-b";
const BOT_OTHER = "bot-fake-other";
const NAME_A = "たろう";
const NAME_B = "はなこ";
const VC_1 = "一般";
const VC_2 = "雑談";
const FAKE_TOKEN = "fake.discord-token_for-server-j";
/** ログ・記録に出てはいけない値（Discord の id・鍵）。 */
const ID_WORDS = [GUILD, OTHER_GUILD, CHANNEL, CHANNEL_2, USER_A, USER_B, BOT_OTHER, "bot-fake-1", FAKE_TOKEN];
/** ログ・session-usage に出てはいけない名前（人の名前・VC の名前）。 */
const NAME_WORDS = [NAME_A, NAME_B, VC_1, VC_2, "ほかの Bot"];

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

/** 偽の耳（人ごとの耳 = pipelineFactory の 1 回 / 配信のマイクの耳）。 */
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

/** 偽の orchestrator（fire を数える・頭への窓の口 getBuffer を覚える）。 */
function makeOrchestrator() {
  const record = { /** @type {any} */ hooks: null, /** @type {any[]} */ fires: [] };
  const factory = (/** @type {any} */ hooks) => {
    record.hooks = hooks;
    return {
      async fire(/** @type {any} */ options) {
        record.fires.push(options);
        return { fired: true, fireId: record.fires.length };
      },
      getState: () => "idle",
      async kill() {
        return { killed: true, severed: false };
      },
      revive() {},
      getKilled: () => false,
      async interrupt() {
        return { interrupted: false };
      },
      deferInstruction: () => true,
      dispose() {}
    };
  };
  return { factory, record };
}

/**
 * 本物の発火の予定（偽の時計）。handleTranscript に届いた行の種類と、発火の頼みを記録する。
 * @param {ReturnType<typeof createFakeClock>} clock
 */
function makeSpyScheduler(clock) {
  const record = { /** @type {string[]} */ transcriptSpeakers: [], /** @type {any[]} */ requests: [] };
  const factory = (/** @type {any} */ options) => {
    const real = createFireScheduler({
      ...options,
      onFireRequest: (/** @type {any} */ req) => {
        record.requests.push(req);
        options.onFireRequest(req);
      },
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
      nowImpl: clock.now,
      rng: () => 0
    });
    return {
      ...real,
      handleTranscript: (/** @type {any} */ entry) => {
        record.transcriptSpeakers.push(entry?.speaker ?? "you");
        real.handleTranscript(entry);
      }
    };
  };
  return { factory, record };
}

/** @param {string[]} events @param {{ saveGate?: Promise<void> }} [opts] */
function makeRole(events, opts = {}) {
  /** @type {any[][]} */
  const saved = [];
  return {
    saved,
    role: {
      id: () => "chappy",
      identity: () => MODEL_IDENTITIES.chappy,
      discordBotKeyFile: () => ".env.discord-chappy.local",
      hooks: {
        renewRecords: () => void events.push("renewRecords"),
        openSession: async () => ({ ok: true }),
        connectBody: () => ({ ok: true }),
        closeSession: () => void events.push("closeSession"),
        closeBody: () => {},
        saveFinal: async (/** @type {any[]} */ transcript) => {
          events.push("saveFinal");
          saved.push(transcript);
          if (opts.saveGate) await opts.saveGate;
        }
      },
      voice: { prepare: () => ({ ok: true }), startResources: () => {} },
      recall: null
    }
  };
}

/**
 * 本物の Discord の入口（偽の Discord）でつなぐ。
 * @param {{ sessionUsageDir?: string }} [p]
 */
async function startDiscordServer(p = {}) {
  const dir = mkdtempSync(join(tmpdir(), "discord-j-server-"));
  const settings = createFileSettingsStore({ path: join(dir, "cockpit-settings.local.json") });
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
          { id: "channel-fake-text", name: "文字", type: FAKE_CHANNEL_TYPE.GuildText, rawPosition: 0 }
        ],
        members: { [USER_A]: NAME_A, [USER_B]: NAME_B }
      },
      { id: OTHER_GUILD, name: "よそ", channels: [{ id: "channel-fake-other", name: "よその VC" }] }
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
    disconnectGraceMs: 30
  });
  const ears = makeFakeEars();
  const orchestrator = makeOrchestrator();
  const clock = createFakeClock();
  const scheduler = makeSpyScheduler(clock);
  const role = makeRole(events);
  /** @type {any[]} */
  const controls = [];
  /** @type {any[]} */
  const judgeRequests = [];
  /** @type {string[]} */
  const answers = [];
  const usageDir = join(dir, "session-usage");
  const usageLog = createSessionUsageLog({ dir: usageDir, startedAtMs: 1_000_000 });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (scheduler.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [role.role],
    experiences: { discord },
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true }),
    selfFireInitialEnabled: true,
    backchannelMinIntervalMs: 0,
    speakNowJudge: async (/** @type {any} */ request) => {
      judgeRequests.push(request);
      const choice = answers.shift() ?? "wait";
      return { choice, probs: { [choice]: 0.9 }, latencyMs: 5 };
    },
    // cockpit.mjs の recordSessionUsage と同じ道（純関数 → 書き手）。
    onControl: (/** @type {any} */ info) => {
      controls.push(info);
      const record = controlUsageRecord(info);
      if (record) usageLog.append(record);
    }
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    fake,
    ears,
    orchestrator,
    scheduler,
    role,
    controls,
    judgeRequests,
    answers,
    events,
    logs,
    usageLog,
    usageDir,
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

/** その人に話させて耳を起こし、1 行聞かせる。 @param {any} h @param {string} userId @param {string} text */
async function speakLine(h, userId, text) {
  const before = h.ears.ears.length;
  h.fake.speak(userId);
  await waitUntil(() => h.ears.ears.length === before + 1 && h.ears.ears[before].started);
  await waitUntil(() => h.fake.record.memberFetches.includes(userId));
  await tick(5);
  h.ears.hear(h.ears.ears[before], text);
  h.fake.endSpeech(userId);
  await tick(5);
}

/** 正本の出来事の行の本文。 @param {any} h */
const eventLines = (h) => h.server.getTranscript().filter((/** @type {any} */ e) => e.speaker === "event").map((/** @type {any} */ e) => e.text);

// ── 1. 出来事の行（本物の Discord の入口）──────────────────────────────────

test("Domain J 出来事の行: 入った・人の出入り・移った・抜けた・入った・切れた・戻った・動かされた・外されたが正本に積まれ放送される（Bot・ほかのサーバー・ほかの VC は除く）・判定も発火の予定も動かない", async () => {
  const h = await startDiscordServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    assert.deepEqual(eventLines(h), [`チャッピーが VC「${VC_1}」に入った`], "開いたときの入った（開きかけの間に届く）");
    // 人の出入り（今いる VC だけ・Bot は除く・ほかのサーバーは見ない・ほかの VC は見ない）。
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: null, to: CHANNEL, name: NAME_B });
    h.fake.voiceState({ userId: BOT_OTHER, guildId: GUILD, from: null, to: CHANNEL, name: "ほかの Bot", bot: true });
    h.fake.voiceState({ userId: USER_B, guildId: OTHER_GUILD, from: null, to: "channel-fake-other", name: NAME_B });
    h.fake.voiceState({ userId: "user-fake-c", guildId: GUILD, from: null, to: CHANNEL_2, name: "じろう" });
    await tick(10);
    // 人が話す（判定は人の行でだけ走る・入力に出来事の行は入らない）。
    h.answers.push("wait");
    await speakLine(h, USER_A, "こんばんは");
    await waitUntil(() => h.judgeRequests.length === 1);
    assert.equal(h.judgeRequests[0].input, `参加者(${NAME_A}): こんばんは`, "判定の入力に出来事の行が無い");
    h.fake.voiceState({ userId: BOT_OTHER, guildId: GUILD, from: CHANNEL, to: null, name: "ほかの Bot", bot: true });
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: CHANNEL, to: null, name: NAME_B });
    await tick(10);
    // 自分で移る・抜ける・入る。
    assert.equal((await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 })).status, 200);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL })).status, 200);
    // 切れた（猶予のあいだ戻らない）→ 戻った。
    h.fake.setConnectionStatus("disconnected");
    await tick(60);
    h.fake.setConnectionStatus("ready");
    await tick(10);
    // Discord の画面で動かされた。
    h.fake.moveBot(CHANNEL_2, { closeCode4014: true });
    await waitUntil(() => /** @type {any} */ (h.fake.connection()).joinConfig.channelId === CHANNEL_2);
    await tick(60);
    // 外から切られた（4014）。
    h.fake.kickBot({ voiceState: false });
    await waitUntil(() => /** @type {any} */ (h.fake.connection()).destroyCount === 1);
    await tick(20);
    const expected = [
      `チャッピーが VC「${VC_1}」に入った`,
      `${NAME_B}が入ってきた`,
      `${NAME_B}が出ていった`,
      `チャッピーが VC「${VC_1}」から「${VC_2}」に移った`,
      `チャッピーが VC「${VC_2}」から抜けた`,
      `チャッピーが VC「${VC_1}」に入った`,
      `チャッピーの VC「${VC_1}」への接続が切れた`,
      `チャッピーの VC「${VC_1}」への接続が戻った`,
      `チャッピーが VC「${VC_1}」から「${VC_2}」に動かされた`,
      `チャッピーが VC「${VC_2}」から外された`
    ];
    assert.deepEqual(eventLines(h), expected);
    // 正本の並び（人の行は出来事の行のあいだに入る）・出来事の行は名前と id の欄を持たない。
    const all = h.server.getTranscript();
    assert.deepEqual(all.map((/** @type {any} */ e) => e.speaker), ["event", "event", "you", ...expected.slice(2).map(() => "event")]);
    for (const e of all.filter((/** @type {any} */ e) => e.speaker === "event")) {
      assert.deepEqual([e.displayName, e.speakerId, e.startMs, e.endMs], [undefined, undefined, 0, 0]);
    }
    // 判定は人の 1 行だけ・発火の頼みも予定の発火も無い・予定（畳んだまま）に出来事の行は届かない。
    assert.equal(h.judgeRequests.length, 1, "出来事だけでは判定が走らない");
    assert.equal(h.orchestrator.record.fires.length, 0);
    assert.equal(h.scheduler.record.requests.length, 0);
    assert.equal(h.scheduler.record.transcriptSpeakers.includes("event"), false, "発火の予定に出来事の行を回さない");
    // 放送: 左の「会話」の欄へ speaker:"event" の行として届く（名前の欄は null・id は載らない）。
    const wired = sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "event");
    assert.deepEqual(wired.map((e) => e.data.text), expected);
    assert.ok(wired.every((e) => e.data.displayName === null && e.data.speakerId === undefined));
    // snapshot の履歴にも載る（開き直しでも出る）。
    const snap = await (await fetch(`${h.url}/api/state`)).json();
    assert.deepEqual(snap.transcripts.filter((/** @type {any} */ e) => e.speaker === "event").map((/** @type {any} */ e) => e.text), expected);
    const wire = JSON.stringify(sse.events) + JSON.stringify(snap);
    for (const id of ID_WORDS) assert.equal(wire.includes(id), false, `放送・snapshot に ${id}`);
  } finally {
    sse.close();
    await h.cleanup();
  }
});

test("Domain J ①②④に載る: 頭への会話の窓・記憶の最後の保存の材料・思い出しの入力（Discord の語の組）に出来事の行がある", async () => {
  const h = await startDiscordServer();
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: null, to: CHANNEL, name: NAME_B });
    await tick(10);
    h.answers.push("wait");
    await speakLine(h, USER_A, "はなこさん、いらっしゃい");
    // ①: orchestrator が読む正本（getBuffer）から作る窓。
    const buffer = h.orchestrator.record.hooks.getBuffer();
    const window = formatFireInjection(buffer.all(), { nowMs: Date.now() });
    assert.equal(
      window.text,
      [`event: チャッピーが VC「${VC_1}」に入った`, `event: ${NAME_B}が入ってきた`, `you(${NAME_A}): はなこさん、いらっしゃい`].join("\n")
    );
    // ④: 思い出しの係が読む転写（getEntries = getTranscript）から作る直近の会話。
    assert.equal(formatRecentConversation(h.server.getTranscript(), { nowMs: Date.now() }), window.text);
    // ②: 最後の保存の材料（場を閉じる段の写し）と、場の語の組（通話）で組んだ頼み。
    const wording = h.server.venueContext().wording;
    assert.deepEqual(wording, CALL_WORDING);
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    assert.equal(h.role.saved.length, 1);
    const transcriptText = formatTranscriptForDigest(h.role.saved[0]);
    assert.equal(transcriptText, window.text);
    const request = buildWriterRequest({ transcriptText, dateJst: "2026-11-01", baseName: "2026-11-01", existingFiles: [], wording });
    assert.ok(request.includes("event = 通話の中の出来事（入った・抜けたなど）。"));
    assert.ok(request.includes(`event: ${NAME_B}が入ってきた`));
  } finally {
    await h.cleanup();
  }
});

test("Domain J 守り: 体験のログの行と session-usage（本物の記録関数と書き手）に人の名前・VC の名前・Discord の id が出ない（種類だけ）", async () => {
  const h = await startDiscordServer();
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: null, to: CHANNEL, name: NAME_B });
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: CHANNEL, to: null, name: NAME_B });
    await tick(10);
    await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 });
    await post(h.url, "/api/discord/vc", { action: "leave" });
    await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL });
    h.fake.kickBot();
    await waitUntil(() => /** @type {any} */ (h.fake.connection()).destroyCount === 1);
    await tick(20);
    await post(h.url, "/api/stream/stop");
    assert.ok(eventLines(h).length === 0, "閉じたあとは正本が無い");
    assert.deepEqual(h.controls.map((c) => c.control), ["vc-join", "vc-move", "vc-leave", "vc-join", "vc-kicked"]);
    await h.usageLog.flush();
    const files = readdirSync(h.usageDir);
    assert.equal(files.length, 1);
    const usage = readFileSync(join(h.usageDir, files[0]), "utf8");
    assert.equal(usage.trim().split("\n").length, 5, "control は 5 行（人の出入りは書かない）");
    const logText = h.logs.join("\n");
    for (const [label, text] of /** @type {const} */ ([["session-usage", usage], ["control", JSON.stringify(h.controls)], ["ログ", logText]])) {
      for (const word of [...ID_WORDS, ...NAME_WORDS, "入ってきた", "出ていった", "入った", "抜けた"]) {
        assert.equal(text.includes(word), false, `${label} に ${word} が出ている`);
      }
    }
  } finally {
    await h.cleanup();
  }
});

// ── 2. 遅れて届いた合図・開いていないとき（体験の口の偽物）─────────────────────

/** Discord の体験の口の言葉と判定の組（本物の createDiscordExperience が置くもの。開かない・鍵は読まない）。 */
function realDiscordWords() {
  const real = createDiscordExperience({
    settings: { getDiscordPrep: () => ({}), setDiscordPrep() {} },
    loadToken: () => ({ ok: false, reason: "テストでは鍵を読まない" }),
    loadLibraries: async () => {
      throw new Error("テストでは Discord の部品を読み込まない");
    }
  });
  return { wording: real.wording, teaching: real.teaching, judgeSet: real.judgeSet };
}

/** 場の口（venue）を覚える Discord の体験の口の偽物（人 1 人の耳）。 */
function makeCapturingMouth() {
  /** @type {any} */
  const record = { venues: [], person: null };
  const mouth = {
    prepareEntrance: () => ({ ok: true, plan: null, voiceKind: "aivis" }),
    openEntrance: async (/** @type {any} */ _plan, /** @type {any} */ venue) => {
      record.venues.push(venue);
      const ears = venue.createEars();
      const mouthFor = venue.earTranscriptMouth({ engine: "discord-stt" });
      const person = {
        vad: ears.vadMouth("p1"),
        async start() {},
        async dispose() {},
        /** @param {string} text */
        hear(text) {
          const r = venue.transcriptBuffer.append({ startMs: 0, endMs: 900, text, displayName: NAME_A, speakerId: "fake-id-p1" });
          if (r.appended) mouthFor(r.entry, { latencyMs: 10, audioCtx: null });
        }
      };
      ears.add("p1", person);
      record.person = person;
      await ears.start();
      venue.vcEvent({ kind: "vc-join", via: "open", channelName: VC_1 });
      return { ok: true, ears };
    },
    closeEntrance: () => {},
    ...realDiscordWords()
  };
  return { mouth, record };
}

/** @param {{ saveGate?: Promise<void>; onEyesStop?: () => void }} [p] */
async function startMouthServer(p = {}) {
  const ears = makeFakeEars();
  const orchestrator = makeOrchestrator();
  const clock = createFakeClock();
  const scheduler = makeSpyScheduler(clock);
  const discord = makeCapturingMouth();
  /** @type {string[]} */
  const events = [];
  const role = makeRole(events, { saveGate: p.saveGate });
  /** @type {any[]} */
  const controls = [];
  /** @type {any[]} */
  const judgeRequests = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (scheduler.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [role.role],
    speakStartModeInitial: "classic",
    selfFireInitialEnabled: true,
    speakNowJudge: async (/** @type {any} */ request) => {
      judgeRequests.push(request);
      return { choice: "wait", probs: { wait: 0.9 }, latencyMs: 5 };
    },
    backchannelMinIntervalMs: 0,
    onControl: (/** @type {any} */ info) => controls.push(info),
    // 閉じる段の目を止める所（正本を手放す前・stream.phase は closing）。
    onEyesStop: () => p.onEyesStop?.(),
    experiences: { discord: discord.mouth }
  });
  const url = await server.listen(0);
  return { server, url, ears, orchestrator, scheduler, clock, discord, role, controls, judgeRequests, events };
}

test("Domain J 遅れて届いた合図: 閉じかけ・閉じたあと・次の場（配信）を開いたあとの合図は正本に足さず、放送も control もしない", async () => {
  /** @type {() => void} */
  let releaseSave = () => {};
  const saveGate = new Promise((resolve) => {
    releaseSave = () => resolve(undefined);
  });
  /** @type {(() => void) | null} */
  let duringClose = null;
  /** @type {any[]} */
  const closingSeen = [];
  const h = await startMouthServer({ saveGate, onEyesStop: () => duringClose?.() });
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    const venue = h.discord.record.venues[0];
    venue.vcEvent({ kind: "person-join", name: NAME_B });
    assert.deepEqual(eventLines(h), [`チャッピーが VC「${VC_1}」に入った`, `${NAME_B}が入ってきた`]);
    // 閉じかけ（正本を手放す前の目を止める所と、記憶の最後の保存を待っている間）。
    duringClose = () => {
      closingSeen.push(h.server.streamStatus().phase);
      venue.vcEvent({ kind: "person-join", name: "しろう" });
      closingSeen.push(eventLines(h).length);
    };
    const stopping = post(h.url, "/api/stream/stop");
    await waitUntil(() => h.events.includes("saveFinal"));
    assert.equal(h.server.streamStatus().phase, "closing");
    assert.deepEqual(closingSeen, ["closing", 2], "正本がまだある閉じかけでも足さない");
    duringClose = null;
    const controlsBefore = h.controls.length;
    venue.vcEvent({ kind: "person-leave", name: NAME_B });
    venue.vcEvent({ kind: "vc-leave", channelName: VC_1 });
    releaseSave();
    assert.equal((await stopping).status, 200);
    // 最後の保存の材料は閉じる前の 2 行だけ。
    assert.deepEqual(h.role.saved[0].map((/** @type {any} */ e) => e.text), [`チャッピーが VC「${VC_1}」に入った`, `${NAME_B}が入ってきた`]);
    // 閉じたあと。
    venue.vcEvent({ kind: "vc-kicked", channelName: VC_1 });
    venue.vcEvent({ kind: "person-join", name: "じろう" });
    // 次の場（配信）を開いたあと: 前の場の口から届いた合図は捨てる。
    assert.equal((await post(h.url, "/api/stream/start", { device: "Mic" })).status, 200);
    venue.vcEvent({ kind: "vc-moved", fromChannelName: VC_1, channelName: VC_2 });
    venue.vcEvent({ kind: "person-join", name: "さぶろう" });
    h.ears.hear(h.ears.ears.at(-1), "配信の発言");
    assert.deepEqual(h.server.getTranscript().map((/** @type {any} */ e) => [e.speaker, e.text]), [["you", "配信の発言"]], "配信の正本に前の場の出来事が混ざらない");
    await tick(20);
    const wired = sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "event").map((e) => e.data.text);
    assert.deepEqual(wired, [`チャッピーが VC「${VC_1}」に入った`, `${NAME_B}が入ってきた`], "遅れた合図は放送しない");
    // control: 閉じかけの vc-leave は書くが（場の段の記録・I のまま）、次の場を開いたあとの前の場の合図は書かない。
    assert.deepEqual(h.controls.slice(controlsBefore).map((c) => c.control), ["vc-leave", "vc-kicked"]);
    await post(h.url, "/api/stream/stop");
  } finally {
    sse.close();
    await h.server.close();
  }
});

test("Domain J きっかけにならない: Discord の場で出来事が続いても判定は走らず、人の行だけで走る（入力に出来事の行は入らない）", async () => {
  const h = await startMouthServer();
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    const venue = h.discord.record.venues[0];
    for (const name of ["はなこ", "じろう", "さぶろう"]) venue.vcEvent({ kind: "person-join", name });
    venue.vcEvent({ kind: "vc-disconnect", channelName: VC_1 });
    venue.vcEvent({ kind: "vc-reconnect", channelName: VC_1 });
    await tick(30);
    assert.equal(h.judgeRequests.length, 0, "出来事だけでは判定が走らない");
    h.discord.record.person.hear("チャッピー、みんな来たね");
    await waitUntil(() => h.judgeRequests.length === 1);
    assert.equal(h.judgeRequests[0].input, `参加者(${NAME_A}): チャッピー、みんな来たね`);
    venue.vcEvent({ kind: "person-leave", name: "じろう" });
    await tick(30);
    assert.equal(h.judgeRequests.length, 1);
    assert.equal(h.orchestrator.record.fires.length, 0);
    assert.equal(h.scheduler.record.transcriptSpeakers.includes("event"), false);
    assert.equal(eventLines(h).length, 7);
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});

// ── 3. 配信の場 ───────────────────────────────────────────────────────────

test("Domain J 配信の場: 出来事の行は無い・正本に出来事の行が混ざっても発火の予定のきっかけにならない（名前を含んでも呼びかけにならない）・人の呼びかけは今まで通り", async () => {
  const h = await startMouthServer();
  try {
    assert.equal((await post(h.url, "/api/stream/start", { device: "Mic" })).status, 200);
    const ear = h.ears.ears.at(-1);
    h.ears.hear(ear, "こんばんは");
    assert.deepEqual(h.server.getTranscript().map((/** @type {any} */ e) => e.speaker), ["you"], "配信には出来事の行が無い");
    // 守りの確かめ: 配信の正本に出来事の行を直に積んでも、場の購読は発火の予定へ回さない。
    ear.options.transcriptBuffer.append({ startMs: 0, endMs: 0, text: "チャッピーが VC「一般」に入った", speaker: "event" });
    assert.deepEqual(h.scheduler.record.transcriptSpeakers, ["you"]);
    assert.equal(h.scheduler.record.requests.length, 0);
    // 対照: 人の呼びかけは今まで通り（従来の予定の呼びかけ）。
    h.ears.hear(ear, "チャッピー、聞いてる？");
    assert.deepEqual(h.scheduler.record.transcriptSpeakers, ["you", "you"]);
    await waitUntil(() => h.scheduler.record.requests.length === 1);
    assert.equal(h.scheduler.record.requests[0].kind, "call");
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});
