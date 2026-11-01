// @ts-check
/**
 * Discord モード Domain G: 画面が使うサーバの口（discord-mode.md §9・§4.3 の 7・§8、計画 §1 Domain G と D・E・F の追認の持ち越し）—
 * 本物の cockpit-server と本物の src/discord/discord-experience.mjs を、偽の Discord（src/test-support/fake-discord.mjs）でつなぐ。
 *
 *  - Discord の場の見る窓（目）: GET / POST /api/discord/vision-target（配信の見る窓とは別に保存・Discord の場の間は 409・形が違えば
 *    400）。選んでいなければ Discord の場では目を起こさない、選んでいれば起こす。配信の目は今まで通り（いつも起こす）。
 *  - 一覧の読み込み（POST /api/discord/catalog）も、ロールの鍵のファイル名の形が合わなければ鍵を読まずログインせずに断る（E の追認 (1)）。
 *  - YouTube の Connect（POST /api/chat/connect）は Discord の場の間は 409 で断る（F の追認 (2)）。配信の場・閉じている間は今まで通り。
 *  - コメント反応は Discord の場では判定しない（F の裁量 5 の守り）。配信（speak-now）は今まで通り判定する。
 *  - chatBufferAbsent の文面は「場が開いていない」（正本は場のもの）。
 *  - snapshot の stream.experience / connection / discord / speakStartFixed（画面が読む値）が Discord の場と配信で正しい。
 * 本物の Discord・LLM・外部 API は呼ばない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。テストの id は明らかな偽の値。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCockpitServer,
  CHAT_BUFFER_ABSENT_MESSAGE,
  DISCORD_CHAT_CONNECT_REFUSED_MESSAGE
} from "./cockpit-server.mjs";
import { createFileSettingsStore } from "./cockpit-settings-store.mjs";
import { createDiscordExperience, DISCORD_REASONS, DISCORD_VISION_TARGET_MAX_CHARS } from "../discord/discord-experience.mjs";
import { createFakeDiscord } from "../test-support/fake-discord.mjs";
import { createFakeClock } from "../test-support/fake-clock.mjs";
import { createFireScheduler } from "../mind/fire-scheduler.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

const GUILD = "guild-fake-g1";
const CHANNEL = "channel-fake-g1";
const FAKE_TOKEN = "fake.discord-token_for-domain-g";
const KEY_FILE = ".env.discord-chappy.local";
const WINDOW = "偽のゲームの窓";
const STREAM_WINDOW = "配信の偽の窓";

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

/** 偽の耳（配信のマイクの耳と Discord の人ごとの耳）。 */
function makeFakeEars() {
  const factory = (/** @type {any} */ options) => ({
    transcriptBuffer: options.transcriptBuffer,
    async start() {
      if (typeof options.captureFactory === "function") options.captureFactory({ onPcm: () => {} });
    },
    async dispose() {},
    isDisposed: () => false,
    streamMs: () => 0,
    stats: () => ({})
  });
  return { factory };
}

/** 偽の orchestrator（fire を記録する）。 */
function makeOrchestrator() {
  const record = { /** @type {any[]} */ fires: [] };
  const factory = () => ({
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
      return { interrupted: true };
    },
    deferInstruction: () => true,
    dispose() {}
  });
  return { factory, record };
}

/** 本物の発火の予定（偽の時計・タイマは実時間で走らない）。 @param {ReturnType<typeof createFakeClock>} clock */
function makeScheduler(clock) {
  return (/** @type {any} */ options) =>
    createFireScheduler({
      ...options,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
      nowImpl: clock.now,
      rng: () => 0
    });
}

/** 偽のチャット器官（Connect されたかだけを数える）。 */
function makeChat() {
  const record = { /** @type {string[]} */ sources: [] };
  const factory = (/** @type {{ source: string }} */ opts) => {
    record.sources.push(opts.source);
    let state = "idle";
    return {
      async start() {
        state = "connecting";
      },
      stop() {
        state = "dead";
      },
      getState: () => state,
      getSource: () => opts.source,
      onMessage: () => () => {},
      onStatus: () => () => {},
      onDiagnostic: () => () => {},
      async idle() {}
    };
  };
  return { factory, record };
}

/** ロールの束の偽物（events に記録・鍵のファイル名の形は refused で替える）。 @param {string[]} events @param {{ refused?: boolean }} [o] */
function makeRole(events, o = {}) {
  return {
    id: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    discordBotKeyFile: () => KEY_FILE,
    discordBotKeyFileRefused: () => o.refused === true,
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
  };
}

/**
 * 本物の server + 本物の Discord の体験の口 + 偽の Discord。
 * @param {{ visionTarget?: string | null; keyFileRefused?: boolean; speakStartModeInitial?: "classic" | "speak-now" }} [p]
 */
async function startServer(p = {}) {
  const dir = mkdtempSync(join(tmpdir(), "discord-g-server-"));
  const settingsPath = join(dir, "cockpit-settings.local.json");
  const settings = createFileSettingsStore({ path: settingsPath });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
  if (p.visionTarget) settings.setDiscordVisionTarget(p.visionTarget);
  settings.setVisionTarget(STREAM_WINDOW);
  /** @type {string[]} */
  const events = [];
  /** @type {string[]} */
  const tokenFiles = [];
  /** @type {string[]} */
  const logs = [];
  const fake = createFakeDiscord({
    guilds: [{ id: GUILD, name: "試しのサーバー", channels: [{ id: CHANNEL, name: "一般" }], members: {} }]
  });
  const discord = createDiscordExperience({
    settings,
    currentKeyFile: () => KEY_FILE,
    currentKeyFileRefused: () => p.keyFileRefused === true,
    loadToken: (fileName) => {
      tokenFiles.push(fileName);
      return { ok: true, token: FAKE_TOKEN };
    },
    loadLibraries: fake.loadLibraries,
    log: (line) => logs.push(line),
    loginTimeoutMs: 300,
    readyTimeoutMs: 300
  });
  const clock = createFakeClock();
  const orchestrator = makeOrchestrator();
  const chat = makeChat();
  /** @type {any[]} */
  const reactCalls = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (makeFakeEars().factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (makeScheduler(clock)),
    chatClientFactory: /** @type {any} */ (chat.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    commentReactJudge: async (/** @type {any} */ request) => {
      reactCalls.push(request);
      return { choice: "ignore", probs: { react: 0.1, ignore: 0.9 }, latencyMs: 5 };
    },
    speakNowJudge: async () => ({ choice: "wait", probs: { wait: 0.9 }, latencyMs: 5 }),
    speakStartModeInitial: p.speakStartModeInitial ?? "speak-now",
    selfFireInitialEnabled: true,
    roles: [makeRole(events, { refused: p.keyFileRefused })],
    experiences: { discord },
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true }),
    onEyesStart: () => void events.push("eyes.start"),
    onEyesStop: () => void events.push("eyes.stop"),
    onSetVisionTarget: (/** @type {string | null} */ title) => settings.setVisionTarget(title),
    visionTargetStatus: () => ({ title: settings.getVisionTarget() })
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    settings,
    settingsPath,
    fake,
    events,
    tokenFiles,
    logs,
    chat,
    reactCalls,
    orchestrator,
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

// ── 1. Discord の場の見る窓（目）─────────────────────────────────────────────

test("Domain G 見る窓: GET / POST /api/discord/vision-target は配信の見る窓と別に保存（null / \"\" で消す）・形が違えば 400・Discord の場の間は 409", async () => {
  const h = await startServer();
  try {
    assert.deepEqual((await get(h.url, "/api/discord/vision-target")).json, { visionTarget: { title: null } });
    const set = await post(h.url, "/api/discord/vision-target", { title: `  ${WINDOW}  ` });
    assert.equal(set.status, 200);
    assert.deepEqual(set.json, { visionTarget: { title: WINDOW } }, "前後の空白は落とす");
    assert.equal(createFileSettingsStore({ path: h.settingsPath }).getDiscordVisionTarget(), WINDOW, "設定ファイルに保存");
    assert.equal(createFileSettingsStore({ path: h.settingsPath }).getVisionTarget(), STREAM_WINDOW, "配信の見る窓は変わらない");
    const snap = await get(h.url, "/api/state");
    assert.deepEqual(snap.json.visionTarget, { title: STREAM_WINDOW }, "snapshot の visionTarget は配信の見る窓のまま");
    // 形が違う・長すぎるは 400（保存しない）。
    assert.equal((await post(h.url, "/api/discord/vision-target", { title: 12 })).status, 400);
    const long = await post(h.url, "/api/discord/vision-target", { title: "窓".repeat(DISCORD_VISION_TARGET_MAX_CHARS + 1) });
    assert.equal(long.status, 400);
    assert.equal(createFileSettingsStore({ path: h.settingsPath }).getDiscordVisionTarget(), WINDOW);
    // Discord の場の間は 409（準備と同じく場が閉じている間に選ぶ）。
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    const busy = await post(h.url, "/api/discord/vision-target", { title: null });
    assert.equal(busy.status, 409);
    assert.equal(createFileSettingsStore({ path: h.settingsPath }).getDiscordVisionTarget(), WINDOW, "断ったら書かない");
    await post(h.url, "/api/stream/stop");
    // 消す（目を起こさない）。
    assert.deepEqual((await post(h.url, "/api/discord/vision-target", { title: "" })).json, { visionTarget: { title: null } });
    assert.equal(createFileSettingsStore({ path: h.settingsPath }).getDiscordVisionTarget(), null);
  } finally {
    await h.cleanup();
  }
});

test("Domain G 目: Discord の場で見る窓を選んでいなければ目を起こさない（止める口は冪等に呼ぶ）", async () => {
  const h = await startServer({ visionTarget: null });
  try {
    const r = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 200, JSON.stringify(r.json.error));
    assert.equal(r.json.stream.experience, "discord");
    assert.equal(h.events.includes("eyes.start"), false, "選んでいなければ起こさない（設計 §4.3 の 7）");
    await post(h.url, "/api/stream/stop");
    assert.equal(h.events.includes("eyes.stop"), true, "閉じる段の止める口は今まで通り");
  } finally {
    await h.cleanup();
  }
});

test("Domain G 目: Discord の場で見る窓を選んでいれば目を起こす・配信の場は今まで通りいつも起こす", async () => {
  const h = await startServer({ visionTarget: WINDOW });
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    assert.deepEqual(h.events.filter((e) => e.startsWith("eyes")), ["eyes.start"]);
    await post(h.url, "/api/stream/stop");
    h.events.length = 0;
    // 配信: Discord の見る窓を消しても、配信の目は今まで通り起こす。
    await post(h.url, "/api/discord/vision-target", { title: null });
    assert.equal((await post(h.url, "/api/stream/start", { device: "Mic" })).status, 200);
    assert.deepEqual(h.events.filter((e) => e.startsWith("eyes")), ["eyes.start"], "配信の目は変えない");
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.cleanup();
  }
});

// ── 2. 一覧の読み込みも合わない鍵のファイル名で断る（E の追認 (1)）─────────────────────────

test("Domain G catalog: ロールの鍵のファイル名の形が合わなければ、鍵を読まずログインせずに断る（入口と同じ理由・値は出さない）", async () => {
  const h = await startServer({ keyFileRefused: true });
  try {
    const r = await post(h.url, "/api/discord/catalog");
    assert.equal(r.status, 502);
    assert.equal(r.json.error, DISCORD_REASONS.keyFileName);
    assert.deepEqual(h.tokenFiles, [], "鍵を読まない");
    assert.equal(h.fake.record.logins.length, 0, "ログインしない");
    assert.equal(JSON.stringify(r.json).includes(KEY_FILE), false);
    // 入口も同じく断る（E のまま）。
    const start = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.notEqual(start.status, 200);
    assert.equal(start.json.state.stream.error, DISCORD_REASONS.keyFileName);
    assert.equal(h.fake.record.logins.length, 0);
    for (const line of h.logs) assert.equal(line.includes(KEY_FILE) || line.includes(FAKE_TOKEN), false, line);
  } finally {
    await h.cleanup();
  }
});

test("Domain G catalog: 形が合う鍵のファイル名なら今まで通り読み込む（ログイン → 取得 → ログアウト）", async () => {
  const h = await startServer();
  try {
    const r = await post(h.url, "/api/discord/catalog");
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(r.json.guilds.map((/** @type {any} */ g) => g.name), ["試しのサーバー"]);
    assert.deepEqual(h.tokenFiles, [KEY_FILE]);
    assert.equal(h.fake.record.destroyedClients, 1);
  } finally {
    await h.cleanup();
  }
});

// ── 3. YouTube の Connect は Discord の場の間は断る（F の追認 (2)）───────────────────────────

test("Domain G Connect: Discord の場の間は POST /api/chat/connect を 409 で断る（器官を作らない）・配信の場と閉じている間は今まで通り", async () => {
  const h = await startServer();
  try {
    // 閉じている間は今まで通りつなぐ。
    assert.equal((await post(h.url, "/api/chat/connect", { source: "fake-video-closed" })).status, 200);
    await post(h.url, "/api/chat/disconnect");
    // Discord の場の間は断る。
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    const refused = await post(h.url, "/api/chat/connect", { source: "fake-video-discord" });
    assert.equal(refused.status, 409);
    assert.equal(refused.json.error, DISCORD_CHAT_CONNECT_REFUSED_MESSAGE);
    assert.equal(refused.json.state.stream.experience, "discord", "断るときも snapshot を返す（既存の 409 の流儀）");
    assert.deepEqual(h.chat.record.sources, ["fake-video-closed"], "器官を作らない");
    await post(h.url, "/api/stream/stop");
    // 配信の場は今まで通りつなぐ。
    assert.equal((await post(h.url, "/api/stream/start", { device: "Mic" })).status, 200);
    assert.equal((await post(h.url, "/api/chat/connect", { source: "fake-video-stream" })).status, 200);
    assert.deepEqual(h.chat.record.sources, ["fake-video-closed", "fake-video-stream"]);
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.cleanup();
  }
});

// ── 4. コメント反応は Discord の場では判定しない（F の裁量 5 の守り）──────────────────────────────

test("Domain G コメント反応: Discord の場ではコメントが届いても反応する判定を呼ばない・配信（speak-now）は今まで通り呼ぶ", async () => {
  const h = await startServer({ speakStartModeInitial: "speak-now" });
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    const snap = (await get(h.url, "/api/state")).json;
    assert.equal(snap.speakStartFixed, true);
    // 閉じている間に器官をつないでおいた場合などに届くコメント（器官の onMessage と同じ口）。
    h.server.ingestChatMessage({ text: "チャッピー見てる？", displayName: "偽の視聴者", messageId: "msg-g-1" });
    await tick(30);
    assert.equal(h.reactCalls.length, 0, "Discord の場では判定しない");
    assert.equal(h.orchestrator.record.fires.filter((f) => f.cause && f.cause.type === "comment-react").length, 0);
    await post(h.url, "/api/stream/stop");

    assert.equal((await post(h.url, "/api/stream/start", { device: "Mic" })).status, 200);
    assert.equal((await get(h.url, "/api/state")).json.speakStartFixed, false);
    h.server.ingestChatMessage({ text: "チャッピー見てる？", displayName: "偽の視聴者", messageId: "msg-g-2" });
    await waitUntil(() => h.reactCalls.length === 1);
    assert.equal(h.reactCalls.length, 1, "配信（speak-now）は今まで通り判定する");
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.cleanup();
  }
});

// ── 5. chatBufferAbsent の文面 ───────────────────────────────────────────────────────

test("Domain G chatBufferAbsent: 場が閉じている間のコメントは「場が開いていない」の診断（耳ではなく場）", async () => {
  const h = await startServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    h.server.ingestChatMessage({ text: "こんにちは", displayName: "偽の視聴者" });
    await waitUntil(() => sse.events.some((e) => e.event === "diagnostic" && e.data.type === "chatBufferAbsent"));
    const diag = /** @type {any} */ (sse.events.find((e) => e.event === "diagnostic" && e.data.type === "chatBufferAbsent"));
    assert.equal(diag.data.message, CHAT_BUFFER_ABSENT_MESSAGE);
    assert.match(CHAT_BUFFER_ABSENT_MESSAGE, /^venue not open/);
    assert.equal(CHAT_BUFFER_ABSENT_MESSAGE.includes("ears not running"), false);
  } finally {
    sse.close();
    await h.cleanup();
  }
});

// ── 6. 画面が読む snapshot ──────────────────────────────────────────────────────────

test("Domain G snapshot: Discord の場は experience / connection / speakStartFixed、配信は stream / null / false・discord.available・準備の id は載せない", async () => {
  const h = await startServer({ visionTarget: WINDOW, speakStartModeInitial: "classic" });
  const sse = openEvents(h.url);
  try {
    const closedSnap = (await get(h.url, "/api/state")).json;
    assert.deepEqual(closedSnap.discord, { available: true });
    assert.equal(closedSnap.stream.experience, null);
    const opened = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(opened.json.stream.experience, "discord");
    assert.equal(opened.json.stream.connection, "joined");
    assert.equal(opened.json.speakStart, "speak-now", "ロールの方式が従来でも Discord の場では speak-now");
    assert.equal(opened.json.speakStartFixed, true);
    await post(h.url, "/api/stream/stop");
    const stream = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(stream.json.stream.experience, "stream");
    assert.equal(stream.json.stream.connection, null);
    assert.equal(stream.json.speakStart, "classic", "配信はロールの方式のまま");
    assert.equal(stream.json.speakStartFixed, false);
    await post(h.url, "/api/stream/stop");
    // snapshot・放送に準備の id・鍵・見る窓の Discord 側の値（id でないが snapshot の項目ではない）を載せない。
    const wire = JSON.stringify(sse.events) + JSON.stringify(closedSnap);
    for (const word of [GUILD, CHANNEL, FAKE_TOKEN]) assert.equal(wire.includes(word), false, word);
    const file = readFileSync(h.settingsPath, "utf8");
    assert.equal(file.includes(FAKE_TOKEN), false, "鍵は設定に入らない");
  } finally {
    sse.close();
    await h.cleanup();
  }
});
