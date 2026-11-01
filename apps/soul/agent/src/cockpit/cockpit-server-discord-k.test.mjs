// @ts-check
/**
 * Discord モード Domain K（J の持ち越し 2 = 計画 §8 の Domain J の行の Undine の判断 (4)）: VC に入った・移った・動かされた時点で
 * もういる人を出来事の 1 行（「VC「〈VC〉」には〈名前〉・〈名前〉がいる」）にする。本物の server + 本物の Discord の体験の口 + 偽の Discord。
 *  - 開いたとき（入った）・パネルから入る・移る・Discord の画面で動かされた、の各場合。Bot 自身とほかの Bot は除く。誰もいなければ
 *    行にしない。名前の分からない人は「ほか N 人」。
 *  - 判定に渡らない・判定が走らない・発火の予定のきっかけにならない（J の出来事の行と同じ）。
 *  - 名前がログ（体験のログの行）・session-usage（本物の記録関数と書き手）に出ない。id は合図にも行にも載らない。
 * 置き場は OS の一時フォルダだけ。本物の Discord・鍵には触れない（偽の id・偽の名前）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCockpitServer } from "./cockpit-server.mjs";
import { createFileSettingsStore } from "./cockpit-settings-store.mjs";
import { createDiscordExperience } from "../discord/discord-experience.mjs";
import { createFakeDiscord } from "../test-support/fake-discord.mjs";
import { createFakeClock } from "../test-support/fake-clock.mjs";
import { controlUsageRecord, createSessionUsageLog } from "../mind/session-usage-log.mjs";
import { createFireScheduler } from "../mind/fire-scheduler.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

const GUILD = "guild-fake-k1";
const CHANNEL = "channel-fake-k1";
const CHANNEL_2 = "channel-fake-k2";
const CHANNEL_3 = "channel-fake-k3";
const BOT_SELF = "bot-fake-1";
const BOT_OTHER = "bot-fake-other-k";
const USER_B = "user-fake-k-b";
const USER_C = "user-fake-k-c";
const USER_D = "user-fake-k-d";
const NAME_B = "はなこ";
const NAME_C = "じろう";
const VC_1 = "一般";
const VC_2 = "雑談";
const VC_3 = "個別の部屋";
const FAKE_TOKEN = "fake.discord-token_for-server-k";
const ID_WORDS = [GUILD, CHANNEL, CHANNEL_2, CHANNEL_3, BOT_SELF, BOT_OTHER, USER_B, USER_C, USER_D, FAKE_TOKEN];
const NAME_WORDS = [NAME_B, NAME_C, VC_1, VC_2, VC_3, "ほかの Bot"];

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

/** 本物の発火の予定（偽の時計）。handleTranscript に届いた行の種類と発火の頼みを記録する。 @param {ReturnType<typeof createFakeClock>} clock */
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

async function startServer() {
  const dir = mkdtempSync(join(tmpdir(), "discord-k-server-"));
  const settings = createFileSettingsStore({ path: join(dir, "cockpit-settings.local.json") });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
  const fake = createFakeDiscord({
    guilds: [
      {
        id: GUILD,
        name: "試しのサーバー",
        channels: [
          { id: CHANNEL, name: VC_1, rawPosition: 1 },
          { id: CHANNEL_2, name: VC_2, rawPosition: 2 },
          { id: CHANNEL_3, name: VC_3, rawPosition: 3 }
        ],
        members: { [USER_B]: NAME_B, [USER_C]: NAME_C, [BOT_OTHER]: "ほかの Bot" },
        // 一般: はなこ・ほかの Bot・Bot 自身 / 雑談: じろう・名前の取れない人 / 個別の部屋: 誰もいない。
        voiceStates: { [USER_B]: CHANNEL, [BOT_OTHER]: CHANNEL, [BOT_SELF]: CHANNEL, [USER_C]: CHANNEL_2, [USER_D]: CHANNEL_2 },
        bots: [BOT_OTHER]
      }
    ]
  });
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
  const fires = /** @type {any[]} */ ([]);
  const orchestratorFactory = () => ({
    async fire(/** @type {any} */ options) {
      fires.push(options);
      return { fired: true, fireId: fires.length };
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
  });
  const clock = createFakeClock();
  const scheduler = makeSpyScheduler(clock);
  /** @type {any[]} */
  const judgeRequests = [];
  const usageDir = join(dir, "session-usage");
  const usageLog = createSessionUsageLog({ dir: usageDir, startedAtMs: 1_000_000 });
  /** @type {any[]} */
  const controls = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (
      (/** @type {any} */ options) => ({
        transcriptBuffer: options.transcriptBuffer,
        async start() {},
        async dispose() {},
        isDisposed: () => false,
        streamMs: () => 0,
        stats: () => ({})
      })
    ),
    fireOrchestratorFactory: /** @type {any} */ (orchestratorFactory),
    fireSchedulerFactory: /** @type {any} */ (scheduler.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [
      {
        id: () => "chappy",
        identity: () => MODEL_IDENTITIES.chappy,
        discordBotKeyFile: () => ".env.discord-chappy.local",
        hooks: {
          renewRecords: () => {},
          openSession: async () => ({ ok: true }),
          connectBody: () => ({ ok: true }),
          closeSession: () => {},
          closeBody: () => {},
          saveFinal: () => {}
        },
        voice: { prepare: () => ({ ok: true }), startResources: () => {} },
        recall: null
      }
    ],
    experiences: { discord },
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true }),
    selfFireInitialEnabled: true,
    backchannelMinIntervalMs: 0,
    speakNowJudge: async (/** @type {any} */ request) => {
      judgeRequests.push(request);
      return { choice: "wait", probs: { wait: 0.9 }, latencyMs: 5 };
    },
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
    logs,
    fires,
    scheduler,
    judgeRequests,
    controls,
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

/** 正本の出来事の行の本文。 @param {any} h */
const eventLines = (h) => h.server.getTranscript().filter((/** @type {any} */ e) => e.speaker === "event").map((/** @type {any} */ e) => e.text);

test("Domain K もういる人: 入った（開いたとき）・移る・抜けて入る・動かされたの各場合に 1 行（Bot 自身とほかの Bot は除く・誰もいなければ行なし）", async () => {
  const h = await startServer();
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    await waitUntil(() => eventLines(h).length >= 2);
    assert.deepEqual(eventLines(h), [`チャッピーが VC「${VC_1}」に入った`, `VC「${VC_1}」には${NAME_B}がいる`], "ほかの Bot と Bot 自身は除く");
    // パネルから移る（名前の取れない人は「ほか N 人」）。
    assert.equal((await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 })).status, 200);
    await waitUntil(() => eventLines(h).length >= 4);
    assert.deepEqual(eventLines(h).slice(2), [`チャッピーが VC「${VC_1}」から「${VC_2}」に移った`, `VC「${VC_2}」には${NAME_C}とほか 1 人がいる`]);
    // 抜けて、誰もいない VC に入る（行は「入った」だけ）。
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL_3 })).status, 200);
    await tick(30);
    assert.equal(eventLines(h).length, 6);
    assert.deepEqual(eventLines(h).slice(4), [`チャッピーが VC「${VC_2}」から抜けた`, `チャッピーが VC「${VC_3}」に入った`], "誰もいなければ行にしない");
    // パネルから入る（人がいる VC）: 抜けてから一般に入る。
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL })).status, 200);
    await waitUntil(() => eventLines(h).length >= 9);
    assert.deepEqual(eventLines(h).slice(6, 8), [`チャッピーが VC「${VC_3}」から抜けた`, `チャッピーが VC「${VC_1}」に入った`]);
    assert.equal(eventLines(h)[8], `VC「${VC_1}」には${NAME_B}がいる`);
    // Discord の画面で動かされた先にもういる人。
    h.fake.moveBot(CHANNEL_2, { channelName: VC_2 });
    await waitUntil(() => eventLines(h).length >= 11);
    await tick(30);
    assert.equal(eventLines(h).length, 11);
    assert.deepEqual(eventLines(h).slice(9), [`チャッピーが VC「${VC_1}」から「${VC_2}」に動かされた`, `VC「${VC_2}」には${NAME_C}とほか 1 人がいる`]);
    // 出来事の行は名前と id の欄を持たない。
    for (const e of h.server.getTranscript()) {
      assert.equal(e.speaker, "event");
      assert.deepEqual([e.displayName, e.speakerId], [undefined, undefined]);
      for (const id of ID_WORDS) assert.equal(e.text.includes(id), false);
    }
  } finally {
    await h.cleanup();
  }
});

test("Domain K もういる人: 判定に渡らない・判定も発火の予定も走らない・名前がログと session-usage に出ない", async () => {
  const h = await startServer();
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    await waitUntil(() => eventLines(h).length >= 2);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 })).status, 200);
    await waitUntil(() => eventLines(h).length >= 4);
    await tick(50);
    assert.deepEqual(h.judgeRequests, [], "判定は走らない");
    assert.deepEqual(h.fires, [], "発火しない");
    assert.equal(h.scheduler.record.transcriptSpeakers.includes("event"), false, "発火の予定に出来事の行が届かない");
    assert.deepEqual(h.scheduler.record.requests, []);
    await post(h.url, "/api/stream/stop");
  } finally {
    const logText = h.logs.join("\n");
    const usage = existsSync(h.usageDir)
      ? readdirSync(h.usageDir).map((f) => readFileSync(join(h.usageDir, f), "utf8")).join("\n")
      : "";
    const controls = JSON.stringify(h.controls);
    await h.cleanup();
    for (const word of [...NAME_WORDS, ...ID_WORDS]) {
      assert.equal(logText.includes(word), false, `ログに ${word}`);
      assert.equal(usage.includes(word), false, `session-usage に ${word}`);
      assert.equal(controls.includes(word), false, `control に ${word}`);
    }
    assert.ok(usage.includes("vc-join") && usage.includes("vc-move"), "種類だけは残る");
    assert.equal(usage.includes("vc-people"), false, "もういる人の行は control に書かない");
  }
});
