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
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCockpitServer, DISCORD_VC_NOT_OPEN_MESSAGE, NOT_IN_VC_FIRE_MESSAGE } from "./cockpit-server.mjs";
import { createFileSettingsStore } from "./cockpit-settings-store.mjs";
import { createDiscordExperience, DISCORD_REASONS, DISCORD_VC_REFUSALS } from "../discord/discord-experience.mjs";
import { createFakeDiscord, FAKE_CHANNEL_TYPE } from "../test-support/fake-discord.mjs";
import { controlUsageRecord, fireRefusedUsageRecord } from "../mind/session-usage-log.mjs";
import { createRoleHooks, resolveWriterBrainDef } from "../../scripts/cockpit.mjs";
import { normalizeRole, roleIdentity, writeRole } from "../roles/role-store.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";
import { createFireOrchestrator } from "../mind/fire-orchestrator.mjs";
import { runLocalTask } from "../mind/local-task.mjs";
import { makeLocalTaskPdf } from "../test-support/local-task-pdf.mjs";

const GUILD = "guild-fake-1";
const OTHER_GUILD = "guild-fake-2";
const CHANNEL = "channel-fake-1";
const CHANNEL_2 = "channel-fake-2";
const TEXT_CHANNEL = "channel-fake-text";
const CHAT_TEXT = "100000000000000001";
const CHAT_VOICE = "100000000000000002";
const CHAT_DENIED = "100000000000000003";
const CHAT_COMMAND = "100000000000000004";
const CHAT_HIDDEN = "100000000000000005";
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

/** @param {ReturnType<typeof createFakeDiscord>} fake @param {{intent?: boolean; denyOnLogin?: boolean; commands?: any[]}} options */
function companionGateway(fake, { intent = true, denyOnLogin = false, commands = [] }) {
  const { Client, Events, GatewayIntentBits } = fake.libraries.discord;
  const denied = new Set([CHAT_DENIED]);
  const requests = [];
  const replies = [];
  const route = `/applications/fake-app/guilds/${GUILD}/commands`;
  const storedCommands = [...commands];
  class CompanionClient extends Client {
    application = { id: "fake-app" };
    rest = {
      get: async (/** @type {string} */ path) => {
        assert.equal(path, route);
        requests.push({ method: "GET", path });
        return storedCommands.slice();
      },
      post: async (/** @type {string} */ path, /** @type {any} */ input) => {
        assert.equal(path, route);
        requests.push({ method: "POST", path, body: input.body });
        const command = { ...input.body, id: CHAT_COMMAND };
        storedCommands.push(command);
        return command;
      }
    };

    /** @param {any} clientOptions */
    constructor(clientOptions) {
      super(clientOptions);
      const loadGuild = this.guilds.fetch;
      this.guilds.fetch = async (id) => {
        const guild = await loadGuild(id);
        if (id === undefined) return guild;
        guild.client = this;
        guild.members.me = this.user;
        guild.channels.cache = await guild.channels.fetch();
        for (const channel of guild.channels.cache.values()) {
          channel.flags = { has: (/** @type {number} */ flag) => channel.id === CHAT_HIDDEN && flag === 131072 };
          channel.permissionsFor = (/** @type {any} */ member) => ({
            has: (/** @type {bigint} */ flag) => member === this.user && flag === 1024n && !denied.has(channel.id)
          });
        }
        return guild;
      };
    }

    /** @param {string} token */
    async login(token) {
      if (denyOnLogin && this.options.intents.includes(GatewayIntentBits.MessageContent)) {
        fake.record.logins.push(token);
        this.emit("shardDisconnect", { code: 4014 });
        return token;
      }
      return super.login(token);
    }
  }
  return {
    denied, requests, replies,
    async loadLibraries() {
      const libs = await fake.loadLibraries();
      return {
        ...libs,
        discord: {
          ...libs.discord,
          Client: CompanionClient,
          Events: { ...Events, MessageCreate: "messageCreate", InteractionCreate: "interactionCreate", ShardDisconnect: "shardDisconnect" },
          PermissionFlagsBits: { ViewChannel: 1024n },
          ChannelFlags: { ChannelObfuscated: 131072 },
          MessageFlags: { Ephemeral: 64 },
          ApplicationCommandType: { ChatInput: 1 },
          ApplicationCommandOptionType: { Subcommand: 1 },
          ApplicationFlags: { GatewayMessageContent: 1 << 18, GatewayMessageContentLimited: 1 << 19 },
          Routes: { currentApplication: () => "/applications/@me", applicationGuildCommands: (app, guild) => `/applications/${app}/guilds/${guild}/commands` },
          REST: class {
            setToken(/** @type {string} */ token) { assert.equal(token, FAKE_TOKEN); return this; }
            async get(/** @type {string} */ path) {
              assert.equal(path, "/applications/@me");
              return { flags: intent ? 1 << 19 : 0 };
            }
          }
        }
      };
    },
    message(/** @type {any} */ override = {}) {
      fake.client()?.emit("messageCreate", {
        id: "fixture-message", guildId: GUILD, channelId: CHAT_TEXT, createdTimestamp: Date.now() + 1,
        author: { id: USER_A, username: NAME_A }, content: "合成のチャット本文", ...override
      });
    },
    interact(/** @type {string} */ action, /** @type {any} */ override = {}, client = fake.client()) {
      const result = Promise.withResolvers();
      client?.emit("interactionCreate", {
        isChatInputCommand: () => true, commandName: "soul-vc", commandId: CHAT_COMMAND,
        guildId: GUILD, commandGuildId: GUILD, user: { id: USER_A }, options: { getSubcommand: () => action },
        async reply(/** @type {any} */ response) { replies.push(response); result.resolve(response.content); },
        async deferReply(/** @type {any} */ response) { replies.push(response); },
        async editReply(/** @type {string} */ content) { result.resolve(content); },
        ...override
      });
      return result.promise;
    }
  };
}

/**
 * @param {{ discord?: boolean; graceMs?: number; companion?: { intent?: boolean; denyOnLogin?: boolean; commands?: any[]; openSession?: Promise<any> };
 *   remote?: { failBody?: boolean };
 *   localTasks?: { ask: (content: any, callbacks: any) => Promise<any>; spoken: string[]; run: NonNullable<Parameters<typeof createCockpitServer>[0]["localTaskRunner"]> } }} [p]
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
          { id: TEXT_CHANNEL, name: "文字", type: FAKE_CHANNEL_TYPE.GuildText, rawPosition: 0 },
          ...(p.companion ? [
            { id: CHAT_TEXT, name: "共有資料", type: FAKE_CHANNEL_TYPE.GuildText },
            { id: CHAT_VOICE, name: "資料部屋" },
            { id: CHAT_DENIED, name: "閲覧不可", type: FAKE_CHANNEL_TYPE.GuildText },
            { id: CHAT_HIDDEN, name: "___hidden___", type: FAKE_CHANNEL_TYPE.GuildText }
          ] : [])
        ],
        members: { [USER_A]: NAME_A }
      },
      { id: OTHER_GUILD, name: "よそ", channels: [{ id: OTHER_GUILD_CHANNEL, name: "よその VC" }] }
    ]
  });
  const gateway = p.companion ? companionGateway(fake, p.companion) : null;
  /** @type {string[]} */
  const events = [];
  /** @type {string[]} */
  const logs = [];
  let server;
  const discord = createDiscordExperience({
    settings,
    getTaskResources: () => server?.getActiveVenueTaskResources() ?? null,
    loadToken: (file) => { tokenFiles.push(file); return { ok: true, token: FAKE_TOKEN }; },
    loadLibraries: gateway?.loadLibraries ?? fake.loadLibraries,
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
  const role = makeRole(events);
  let roleHooks;
  const seenVenue = [];
  const tokenFiles = [];
  if (p.remote) {
    const rolesDir = join(dir, "roles");
    writeRole({ dir: rolesDir, role: normalizeRole("chappy", { brain: "codex-56-sol", voice: { engine: "aivis" } }) });
    writeRole({ dir: rolesDir, role: normalizeRole("visitor", {
      brain: "codex-astra", name: { canonical: "Visitor", display: "ビジター" }, verbosity: "chatty",
      discordBotKeyFile: ".env.discord-visitor.local", voice: { engine: "elevenlabs" }
    }) });
    settings.setRoleChoice("chappy");
    settings.setDiscordChatChannel({ guildId: GUILD, channelId: CHAT_TEXT });
    roleHooks = createRoleHooks({ rolesDir, settings });
    const activeRole = () => server.discordVenueRole() ?? roleHooks.current();
    role.id = () => activeRole().id;
    role.identity = () => roleIdentity(activeRole());
    role.discordBotKeyFile = () => activeRole().discordBotKeyFile;
    const observe = (step) => seenVenue.push([step, activeRole().id, activeRole().brain]);
    role.hooks.renewRecords = () => void observe("records");
    role.hooks.openSession = async () => { observe("session"); return { ok: true }; };
    role.hooks.connectBody = () => ({ ok: !(p.remote.failBody && server.discordVenueRole()), reason: "fixture body failure" });
    role.hooks.saveFinal = () => void observe("save");
    role.voice.prepare = (kind) => { observe(kind); return { ok: true }; };
  }
  const openSession = role.hooks.openSession;
  if (p.companion?.openSession) {
    role.hooks.openSession = async () => {
      const result = await openSession();
      await p.companion?.openSession;
      return result;
    };
  }
  const local = p.localTasks;
  server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: local ? (hooks) => {
      orchestrator.record.hooks = hooks;
      return createFireOrchestrator({
        ...hooks,
        nowImpl: () => now,
        session: { ask: local.ask },
        speakImpl: async (text) => {
          local.spoken.push(text);
          return { timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "fake.wav" };
        },
        channel: { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) },
        player: { play() {} }
      });
    } : /** @type {any} */ (orchestrator.factory),
    localTaskRunner: local?.run,
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [role],
    resolveDiscordVenueRole: roleHooks?.resolveForVenue,
    brainStatus: roleHooks ? () => ({ brain: (server?.discordVenueRole() ?? roleHooks.current()).brain }) : undefined,
    ...(p.discord === false ? {} : { experiences: { discord } }),
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true }),
    selfFireInitialEnabled: !p.remote && !local,
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
    seenVenue,
    tokenFiles,
    fake,
    gateway,
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

test("出先から指定した場では初回の接続・チャット・自発に場の設定を使い、次の通常開場では保存値を使う", async () => {
  const h = await startServer({ companion: {}, remote: {} });
  const saved = readFileSync(h.settingsPath, "utf8");
  try {
    const opened = await post(h.url, "/api/stream/start", { experience: "discord", discordVenue: {
      guildId: GUILD, channelId: CHAT_VOICE, roleId: "visitor", model: "codex-62-sol"
    } });
    assert.equal(opened.status, 200, opened.json.error);
    assert.equal(h.fake.record.joins[0].channelId, CHAT_VOICE);
    assert.equal(opened.json.stream.vcName, "資料部屋");
    assert.equal(opened.json.brain.brain, "codex-62-sol");
    assert.equal(resolveWriterBrainDef(h.server.discordVenueRole().brain).id, "codex-62-sol");
    assert.equal(opened.json.brain.identity.id, "visitor");
    assert.equal(opened.json.tts.engine, "elevenlabs");
    assert.equal(opened.json.stt.engine, "elevenlabs");
    assert.equal(opened.json.selfFire.enabled, true);
    assert.equal(opened.json.verbosity, "chatty");
    assert.equal(h.tokenFiles[0], ".env.discord-visitor.local");
    assert.equal(h.events.includes("eyes.start"), false);
    assert.deepEqual(h.seenVenue, ["records", "elevenlabs", "session"].map((step) => [step, "visitor", "codex-62-sol"]));

    const chat = await get(h.url, "/api/discord/chat");
    assert.equal(chat.json.selectedId, CHAT_VOICE);
    assert.equal(chat.json.selectionStatus, "available");
    assert.equal(chat.json.intentStatus, "enabled");
    assert.equal((await get(h.url, "/api/discord/vision-target")).json.visionTarget.title, null);
    const hooks = h.orchestrator.record.hooks;
    h.gateway.message({ content: "以前の読む先" });
    h.gateway.message({ channelId: CHAT_VOICE, content: "今回の読む先" });
    assert.deepEqual(hooks.getChatMaterials(hooks.getBuffer()).map(({ text }) => text), ["今回の読む先"]);
    h.answers.push("respond");
    await speakLine(h, "最初の発話");
    await waitUntil(() => h.orchestrator.record.fires.length === 1);

    await post(h.url, "/api/self-fire", { enabled: false });
    await post(h.url, "/api/discord/chat", { channelId: null });
    await post(h.url, "/api/discord/vision-target", { title: "今回の窓" });
    assert.equal(h.events.includes("eyes.start"), true);
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    assert.deepEqual(h.seenVenue.at(-1), ["save", "visitor", "codex-62-sol"]);
    assert.equal(readFileSync(h.settingsPath, "utf8"), saved);

    const normal = await openDiscord(h);
    assert.equal(h.fake.record.joins[1].channelId, CHANNEL);
    assert.equal(normal.selfFire.enabled, false);
    assert.equal(normal.verbosity, "normal");
    assert.equal(normal.brain.brain, "codex-56-sol");
    assert.equal(normal.tts.engine, "aivis");
    assert.equal((await get(h.url, "/api/discord/chat")).json.selectedId, CHAT_TEXT);
    assert.equal((await get(h.url, "/api/discord/vision-target")).json.visionTarget.title, "偽のゲームの窓");
  } finally {
    await h.cleanup();
  }
});

test("出先の明示指定が会話・小タスク・最終保存に届く", async () => {
  const spoken = [];
  const models = [];
  const h = await startServer({ companion: {}, remote: {}, localTasks: {
    spoken,
    async ask(content) {
      models.push(["conversation", h.server.discordVenueRole().brain]);
      if (models.length === 1) {
        assert.match(String(content), /明示されたチャット/u);
        return { replyText: "確認するね。<local_task 提示された数を確認して>" };
      }
      return { replyText: "確認したよ。" };
    },
    run({ resources, request }) {
      const model = resolveWriterBrainDef(h.server.discordVenueRole().brain);
      return runLocalTask({ resources, request, create: () => {
        models.push(["task", model.id]);
        return {
          async ask() { return { replyText: "試験の結果。" }; },
          async dispose() {}
        };
      } });
    }
  } });
  try {
    const opened = await post(h.url, "/api/stream/start", { experience: "discord", discordVenue: {
      guildId: GUILD, channelId: CHAT_VOICE, chatChannelId: CHAT_TEXT, selfFire: false, visionTarget: "試験の窓", model: "codex-62-astra"
    } });
    assert.equal(opened.status, 200, opened.json.error);
    assert.equal(opened.json.brain.identity.id, "chappy");
    assert.equal(opened.json.selfFire.enabled, false);
    assert.equal(h.server.discordVisionTitle(), "試験の窓");
    assert.equal(h.events.includes("eyes.start"), true);
    h.gateway.message({ content: "明示されたチャット" });
    await speakLine(h, "読んで");
    assert.equal(h.judgeRequests.length, 0);
    assert.equal((await post(h.url, "/api/fire")).status, 202);
    await waitUntil(() => spoken.includes("確認したよ。"));
    assert.deepEqual(models, [
      ["conversation", "codex-62-astra"], ["task", "codex-62-astra"], ["conversation", "codex-62-astra"]
    ]);
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    assert.deepEqual(h.seenVenue.at(-1), ["save", "chappy", "codex-62-astra"]);
  } finally {
    await h.cleanup();
  }
});

test("出先の不一致と部分開場を畳み、次の通常開場に指定を漏らさない", async () => {
  const h = await startServer({ companion: {}, remote: { failBody: true } });
  const saved = readFileSync(h.settingsPath, "utf8");
  const start = (patch) => post(h.url, "/api/stream/start", { experience: "discord", discordVenue: {
    guildId: GUILD, channelId: CHAT_VOICE, roleId: "visitor", model: "codex-62-sol", ...patch
  } });
  try {
    assert.equal((await start({ roleId: "missing" })).status, 400);
    assert.equal((await start({ model: "toString" })).status, 400);
    assert.equal(h.fake.record.logins.length, 0);
    assert.equal((await start({ guildId: OTHER_GUILD })).status, 500);
    assert.equal((await start({ channelId: TEXT_CHANNEL })).status, 500);
    assert.equal(h.fake.record.joins.length, 0);
    const partial = await start({ visionTarget: "今回の窓", chatChannelId: null, selfFire: false });
    assert.equal(partial.status, 500);
    assert.match(partial.json.error, /fixture body failure/u);
    assert.equal(partial.json.state.stream.phase, "closed");
    assert.equal(h.fake.record.joins.length, 1);
    assert.equal(h.fake.connection().destroyCount, 1);
    assert.equal(h.server.discordVenueRole(), null);
    assert.equal(readFileSync(h.settingsPath, "utf8"), saved);
    const normal = await openDiscord(h);
    assert.equal(h.fake.record.joins[1].channelId, CHANNEL);
    assert.equal(normal.brain.brain, "codex-56-sol");
    assert.equal((await get(h.url, "/api/discord/chat")).json.selectedId, CHAT_TEXT);
  } finally {
    await h.cleanup();
  }
});

test("Discord の Bot が読めるテキスト・VC 付属チャットを切替、投稿は会話資料だけに届く", async () => {
  const h = await startServer({ companion: {} });
  const events = openEvents(h.url);
  try {
    assert.equal((await get(h.url, "/api/discord/chat")).status, 409);
    await openDiscord(h);
    await waitUntil(() => events.events.some((event) => event.event === "state"));
    const state = (await get(h.url, "/api/discord/chat")).json;
    assert.equal(state.intentStatus, "enabled");
    assert.equal(state.selectedId, null);
    assert.equal(state.channels.find(({ id }) => id === CHAT_TEXT).kind, "text");
    assert.equal(state.channels.find(({ id }) => id === CHAT_VOICE).kind, "voice");
    assert.equal(state.channels.some(({ id }) => id === CHAT_DENIED || id === CHAT_HIDDEN), false);
    for (const channelId of [CHAT_DENIED, CHAT_HIDDEN]) {
      assert.equal((await post(h.url, "/api/discord/chat", { channelId })).status, 403);
    }
    assert.equal((await post(h.url, "/api/discord/chat", {})).status, 400);
    assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_TEXT })).json.selectedId, CHAT_TEXT);
    assert.deepEqual(h.settings.getDiscordChatChannel(), { guildId: GUILD, channelId: CHAT_TEXT });
    assert.equal(h.settings.getDiscordPrep().channelId, CHANNEL);
    const materials = () => h.orchestrator.record.hooks.getChatMaterials(h.orchestrator.record.hooks.getBuffer());
    h.gateway.message({ guildId: OTHER_GUILD });
    h.gateway.message({ channelId: CHAT_VOICE });
    h.gateway.message({ author: { id: "bot-fake-1" } });
    assert.deepEqual(materials(), []);
    const url = "https://example.invalid/attachments/1/2/fixture.pdf?token=添付秘密";
    const attachments = new Map([["pdf", { id: "pdf", name: "fixture.pdf", contentType: "application/pdf", url }]]);
    h.gateway.message({ attachments });
    h.gateway.message({ content: "重複は追加しない" });
    await waitUntil(() => materials()?.[0]?.attachments[0]?.state === "unavailable");
    assert.equal(materials().length, 1);
    assert.equal(materials()[0].text, "合成のチャット本文");
    assert.equal(materials()[0].attachments[0].reason, "取得失敗");
    assert.equal(h.orchestrator.record.fires.length, 0);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    h.gateway.message({ id: "outside", content: "退出後の資料" });
    assert.ok(materials().some(({ text }) => text === "退出後の資料"));
    assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_VOICE })).json.selectedId, CHAT_VOICE);
    assert.deepEqual(materials(), []);
    h.gateway.message();
    assert.deepEqual(materials(), []);
    h.gateway.message({ channelId: CHAT_VOICE, id: "fixture-voice-message" });
    assert.equal(materials()[0].channelName, "資料部屋");
    assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_TEXT })).json.selectedId, CHAT_TEXT);
    h.gateway.message({ attachments });
    assert.deepEqual(materials(), [], "A → B → A でも受信済み投稿の再配送は無視する");
    h.gateway.message({ id: "fresh-in-text", content: "再選択後の新規資料" });
    assert.equal(materials()[0].text, "再選択後の新規資料");
    assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_VOICE })).json.selectedId, CHAT_VOICE);
    h.gateway.denied.add(CHAT_VOICE);
    assert.equal((await get(h.url, "/api/discord/chat")).json.selectionStatus, "unreadable");
    assert.deepEqual(materials(), []);
    h.gateway.denied.delete(CHAT_VOICE);
    const leaked = JSON.stringify([events.events, h.logs]);
    for (const value of ["合成のチャット本文", "退出後の資料", "再選択後の新規資料", "fixture.pdf", url, FAKE_TOKEN]) {
      assert.equal(leaked.includes(value), false);
    }
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    assert.equal(materials(), null);
    await openDiscord(h);
    assert.equal((await get(h.url, "/api/discord/chat")).json.selectedId, CHAT_VOICE);
    assert.deepEqual(materials(), []);
    assert.equal((await post(h.url, "/api/discord/chat", { channelId: null })).json.selectedId, null);
    assert.equal(h.settings.getDiscordChatChannel(), null);
  } finally {
    events.close();
    await h.cleanup();
  }
});

test("Message Content 未設定と Gateway 4014 の両方で準備・音声・Discord コマンドが使える", async () => {
  for (const companion of [{ intent: false }, { denyOnLogin: true }]) {
    const h = await startServer({ companion });
    try {
      assert.equal((await post(h.url, "/api/discord/catalog")).status, 200);
      assert.deepEqual(h.fake.record.clients[0].options.intents, [1, 128]);
      await openDiscord(h);
      const state = (await get(h.url, "/api/discord/chat")).json;
      assert.equal(state.intentStatus, "intent-required");
      assert.equal(state.commandStatus, "ready");
      assert.deepEqual(h.fake.client().options.intents, [1, 128]);
      if (companion.denyOnLogin) {
        assert.equal(h.fake.record.clients[1].destroyed, true);
        assert.deepEqual(h.fake.record.clients[1].options.intents, [1, 128, 512, 32768]);
      }
      assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_TEXT })).status, 200);
      assert.match(await h.gateway.interact("leave"), /退出しました/u);
    } finally {
      await h.cleanup();
    }
  }
});

test("Discord チャット切替は前のソースで処理中の画像と PDF を中断する", async (t) => {
  const h = await startServer({ companion: {} });
  const fetchLocal = globalThis.fetch;
  const requested = new Map();
  t.mock.method(globalThis, "fetch", async (input, init) => {
    if (!(input instanceof URL) || input.hostname !== "cdn.discordapp.com") return fetchLocal(input, init);
    const signal = init.signal;
    requested.set(input.pathname, signal);
    return new Response(new ReadableStream({
      start(stream) { signal.addEventListener("abort", () => stream.error(signal.reason), { once: true }); }
    }));
  });
  try {
    await openDiscord(h);
    assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_TEXT })).status, 200);
    h.gateway.message({
      attachments: new Map([
        ["image", { id: "image", name: "fixture.png", contentType: "image/png", url: "https://cdn.discordapp.com/attachments/1/2/fixture.png" }],
        ["pdf", { id: "pdf", name: "fixture.pdf", contentType: "application/pdf", url: "https://cdn.discordapp.com/attachments/1/3/fixture.pdf" }]
      ])
    });
    await waitUntil(() => requested.size === 2);
    const { getChatMaterials, getBuffer } = h.orchestrator.record.hooks;
    assert.deepEqual(getChatMaterials(getBuffer())[0].attachments.map(({ kind, state }) => [kind, state]),
      [["image", "pending"], ["pdf", "pending"]]);
    assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_VOICE })).status, 200);
    assert.ok([...requested.values()].every((signal) => signal.aborted));
    assert.deepEqual(getChatMaterials(getBuffer()), []);
    h.gateway.message({ channelId: CHAT_VOICE, id: "fixture-voice-message" });
    assert.equal(getChatMaterials(getBuffer())[0].channelId, CHAT_VOICE);
  } finally {
    await h.cleanup();
  }
});

test("Discord PDF: a progressive request starts an isolated task, live chat continues, and late replies return after rejoin", async (t) => {
  const main = [];
  const spoken = [];
  const workers = [];
  const { bytes } = makeLocalTaskPdf();
  const fetchLocal = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    if (input instanceof URL && input.hostname === "cdn.discordapp.com") return new Response(bytes);
    return fetchLocal(input, init);
  });
  const h = await startServer({ companion: {}, localTasks: {
    spoken,
    async ask(content, callbacks) {
      main.push(content);
      if (main.length === 1) {
        const id = h.server.getActiveVenueTaskResources().listDocuments()[0].id;
        const parts = ["見てくるね。<loc", "al_task " + id, " 第4ページを読んで>"];
        for (const part of parts) callbacks.onTextDelta(part);
        return { replyText: parts.join("") };
      }
      if (main.length === 2) return { replyText: "会話を続けよう。" };
      if (main.length === 3) return { replyText: "確認できたよ。" };
      return { replyText: "同じ資料を調べるね。<local_task 同じ資料の第5ページ>" };
    },
    run({ resources, request }) {
      return runLocalTask({
        resources, request,
        create(options) {
          const answer = Promise.withResolvers();
          const worker = { options, answer, content: "", disposed: false };
          workers.push(worker);
          return {
            ask(content) { worker.content = content; return answer.promise; },
            async dispose() { worker.disposed = true; }
          };
        }
      });
    }
  } });
  const manual = () => post(h.url, "/api/fire");
  try {
    await openDiscord(h);
    assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_TEXT })).status, 200);
    h.gateway.message({ attachments: new Map([["pdf", {
      id: "pdf", name: "fixture.pdf", contentType: "application/pdf",
      url: "https://cdn.discordapp.com/attachments/1/3/fixture.pdf"
    }]]) });
    const access = h.server.getActiveVenueTaskResources();
    await waitUntil(() => access.listDocuments().length === 1);
    const [document] = access.listDocuments();
    assert.deepEqual(readFileSync(document.path), bytes);
    h.orchestrator.record.hooks.getBuffer().append({ startMs: 0, endMs: 900, text: "今貼った資料を見て" });
    assert.equal((await manual()).status, 202);
    await waitUntil(() => workers.length === 1);
    assert.equal(workers.length, 1);
    assert.equal(workers[0].options.ephemeral, true);
    assert.match(workers[0].content, new RegExp(document.id));
    assert.match(String(main[0]), /合成のチャット本文/);
    assert.deepEqual(spoken, ["見てくるね。"]);
    assert.equal((await manual()).status, 202);
    await waitUntil(() => spoken.includes("会話を続けよう。") && h.server.fireState() === "idle");
    assert.equal(workers[0].disposed, false);
    assert.deepEqual(spoken, ["見てくるね。", "会話を続けよう。"]);

    assert.equal((await post(h.url, "/api/discord/chat", { channelId: CHAT_VOICE })).status, 200);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    workers[0].answer.resolve({ replyText: "第4ページの合成識別子は C94F。" });
    await waitUntil(() => workers[0].disposed);
    assert.equal(main.length, 2);
    assert.equal(existsSync(document.path), true);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL })).status, 200);
    await waitUntil(() => spoken.includes("確認できたよ。") && h.server.fireState() === "idle");
    assert.match(String(main[2]), /C94F/);
    assert.match(String(main[2]), new RegExp(document.id));
    assert.doesNotMatch(String(main[2]), /合成のチャット本文/);

    assert.equal((await manual()).status, 202);
    await waitUntil(() => workers.length === 2);
    assert.equal(workers.length, 2);
    assert.notEqual(workers[0].options.cwd, workers[1].options.cwd);
    assert.match(workers[1].content, new RegExp(document.id));
    assert.ok(JSON.parse(workers[1].content.split("（参照用）\n").at(-1)).includes(workers[0].options.cwd));
    const closing = post(h.url, "/api/stream/stop");
    await waitUntil(() => h.server.streamStatus().phase === "closing");
    assert.equal(existsSync(document.path), true);
    workers[1].answer.resolve({ replyText: "閉場中の返事。" });
    assert.equal((await closing).status, 200);
    assert.equal(main.length, 4);
    assert.equal(existsSync(document.path), false);
    assert.ok(!spoken.some((text) => text.includes("local_task") || text.includes(document.id)));
  } finally {
    for (const { answer } of workers) answer.resolve({ replyText: "試験終了" });
    await h.cleanup();
  }
});

test("the next Fire receives a local result after the automatic result ask fails", async () => {
  const asks = [];
  const spoken = [];
  const h = await startServer({ localTasks: {
    spoken,
    async ask(content) {
      asks.push(content);
      if (asks.length === 1) throw new Error("synthetic model connection failure");
      return { replyText: "担当の結果を受け取ったよ。" };
    },
    async run({ resources, request }) {
      return runLocalTask({ resources, request, create: () => ({
        ask: async () => ({ replyText: "合成結果 ZJ92" }), dispose: async () => {}
      }) });
    }
  } });
  try {
    await openDiscord(h);
    const { getBuffer, onLocalTaskRequest } = h.orchestrator.record.hooks;
    getBuffer().append({ startMs: 0, endMs: 900, text: "答えは出た？" });
    onLocalTaskRequest({ request: "合成依頼", fireId: 1 });
    await waitUntil(() => asks.length === 1 && h.server.fireState() === "idle");
    assert.deepEqual(spoken, []);
    assert.equal((await post(h.url, "/api/fire")).status, 202);
    await waitUntil(() => spoken.length === 1);
    assert.equal(asks.length, 2);
    assert.ok(asks.every((input) => String(input).includes("合成結果 ZJ92")));
  } finally {
    await h.cleanup();
  }
});

test("Discord の join・leave・再参加は PC と排他で、別 guild・opening・古い場の defer を拒む", async () => {
  const ready = Promise.withResolvers();
  const h = await startServer({ companion: { openSession: ready.promise } });
  try {
    const opened = openDiscord(h);
    await waitUntil(() => h.events.includes("openSession"));
    void h.gateway.interact("leave", { commandId: "unrelated-in-opening" });
    assert.equal(h.gateway.requests.length, 0);
    assert.equal((await get(h.url, "/api/discord/chat")).status, 409);
    assert.deepEqual(h.gateway.replies, []);
    ready.resolve();
    await opened;
    assert.equal((await get(h.url, "/api/discord/chat")).json.commandStatus, "ready");
    assert.deepEqual(h.fake.client().options.intents, [1, 128, 512, 32768]);
    assert.deepEqual(h.gateway.requests.map(({ method }) => method), ["GET", "POST"]);
    const registration = h.gateway.requests[1].body;
    assert.equal(registration.name, "soul-vc");
    assert.deepEqual(registration.options.map(({ name }) => name), ["join", "leave"]);
    assert.equal("default_member_permissions" in registration, false);
    void h.gateway.interact("leave", { guildId: OTHER_GUILD, commandGuildId: OTHER_GUILD, commandId: "unrelated-in-other-guild" });
    assert.match(await h.gateway.interact("leave", { guildId: OTHER_GUILD, commandGuildId: OTHER_GUILD }), /このサーバー/u);
    assert.equal(h.gateway.replies.length, 1, "未知 ID には別 guild でも返信しない");
    assert.match(await h.gateway.interact("leave", { commandGuildId: OTHER_GUILD }), /このサーバー/u);
    assert.equal(h.fake.record.joins.length, 1);
    h.fake.voiceState({ guildId: GUILD, userId: USER_A, from: null, to: CHANNEL_2 });
    assert.equal(await h.gateway.interact("join"), DISCORD_VC_REFUSALS.inVc);
    assert.match(await h.gateway.interact("leave", { commandGuildId: null }), /退出しました/u);
    h.fake.voiceState({ guildId: GUILD, userId: USER_A, from: CHANNEL_2, to: null });
    assert.match(await h.gateway.interact("join"), /先に/u);
    h.fake.voiceState({ guildId: GUILD, userId: USER_A, from: null, to: CHANNEL_2 });

    const entered = Promise.withResolvers();
    const unblock = Promise.withResolvers();
    const voice = h.fake.libraries.voice;
    const originalEntersState = voice.entersState;
    voice.entersState = async (...args) => {
      entered.resolve();
      await unblock.promise;
      return await originalEntersState(...args);
    };
    const join = h.gateway.interact("join");
    await entered.promise;
    try {
      assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 409);
      assert.equal(await h.gateway.interact("leave"), DISCORD_VC_REFUSALS.busy);
    } finally {
      unblock.resolve();
    }
    assert.match(await join, /参加しました/u);
    assert.equal(h.fake.record.joins.at(-1).channelId, CHANNEL_2);
    assert.equal(h.events.filter((event) => event === "openSession").length, 1);
    assert.ok(h.gateway.replies.every(({ flags }) => flags === 64));

    const deferred = Promise.withResolvers();
    const resume = Promise.withResolvers();
    const old = h.gateway.interact("leave", { async deferReply() { deferred.resolve(); await resume.promise; } });
    await deferred.promise;
    const oldClient = h.fake.client();
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    assert.equal(oldClient.listenerCount("interactionCreate"), 0);
    await openDiscord(h);
    resume.resolve();
    assert.equal(await old, DISCORD_VC_REFUSALS.notOpen);
    assert.equal(h.fake.connection().joinConfig.channelId, CHANNEL);
    assert.equal(h.fake.connection().destroyCount, 0);
    assert.deepEqual(h.gateway.requests.map(({ method }) => method), ["GET", "POST", "GET"]);
  } finally {
    ready.resolve();
    await h.cleanup();
  }
});

test("既存の /soul-vc は型・説明文・引数構造が一致するときだけ再利用する", async () => {
  const join = { name: "join", type: 1, description: "今いるボイスチャンネルに呼ぶ" };
  const leave = { name: "leave", type: 1, description: "ボイスチャンネルから退出させる" };
  const owned = { name: "soul-vc", type: 1, id: CHAT_COMMAND, description: "チャッピーのVC参加と退出", options: [join, leave] };
  for (const mismatch of [
    { type: 2 },
    { description: "別用途のコマンド" },
    { options: [join, { ...leave, description: "別用途のサブコマンド" }] },
    { options: [join, { ...leave, options: [{ name: "fixture", type: 3, description: "追加の引数" }] }] }
  ]) {
    const h = await startServer({ companion: { commands: [
      { name: "fixture", type: 1, id: "unrelated" },
      { ...owned, ...mismatch }
    ] } });
    try {
      await openDiscord(h);
      assert.equal((await get(h.url, "/api/discord/chat")).json.commandStatus, "name-conflict");
      assert.deepEqual(h.gateway.requests.map(({ method }) => method), ["GET"]);
      void h.gateway.interact("leave");
      await tick();
      assert.equal(h.fake.connection().destroyCount, 0);
      assert.deepEqual(h.gateway.replies, []);
    } finally {
      await h.cleanup();
    }
  }
});

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
    // Discord モード Domain J（§13.5）: 入った・抜けたの出来事の行も正本に並ぶ。
    assert.deepEqual(
      left.json.transcripts.map((/** @type {any} */ e) => e.text),
      [`チャッピーが VC「${VC_1}」に入った`, "こんにちは", `チャッピーが VC「${VC_1}」から抜けた`],
      "正本は続く"
    );
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
    // Domain J: 出来事の行（入った・抜けた・入った）が並ぶ。判定は人の 2 行でだけ走った（上の 2 回）。
    assert.deepEqual(h.server.getTranscript().map((/** @type {any} */ e) => e.text), [
      `チャッピーが VC「${VC_1}」に入った`,
      "こんにちは",
      `チャッピーが VC「${VC_1}」から抜けた`,
      `チャッピーが VC「${VC_1}」に入った`,
      "続きだけど"
    ]);
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
      // Discord モード Domain J（§13.5）: 記憶の最後の保存の材料には出来事の行（入った・抜けた / 移った）も載る。
      const lastEvent = where === "outside" ? `チャッピーが VC「${VC_1}」から抜けた` : `チャッピーが VC「${VC_1}」から「${VC_2}」に移った`;
      assert.ok(h.events.includes(`saveFinal:チャッピーが VC「${VC_1}」に入った|今日はここまで|${lastEvent}`), JSON.stringify(h.events));
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
