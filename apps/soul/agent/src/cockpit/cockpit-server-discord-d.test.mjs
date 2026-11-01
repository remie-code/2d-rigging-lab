// @ts-check
/**
 * Discord モード Domain D: Discord の入口（discord-mode.md §4.3・§5・§6・§9・§10）— 本物の cockpit-server と
 * src/discord/discord-experience.mjs を、偽の Discord（src/test-support/fake-discord.mjs）でつなぐ。
 *
 *  - 開く順（入口の下見 → 声の engine の用意 → 入口を開く → 再生器 → 目）・Intent・`group` にロールの id・snapshot の項目。
 *  - 人ごとの購読と耳（2 人で 2 本・束）・行は you + 名前 + id で正本に積まれる・3 バイトのフレームを捨てる・購読の終わりの無音。
 *  - 人が抜けたら耳を外す（正本は続く）・途中で切れても場は閉じず「切れた」・全員が抜けても Bot は抜けない。
 *  - 入れないとき場を開かず理由（鍵・準備・方式・ログイン・サーバー・チャンネル・VC）・openEntrance の失敗の後片付け・
 *    closeEntrance の冪等・想定外の例外の文面。
 *  - Discord の準備の API と一覧の API（ログイン → 取得 → ログアウト）。
 *  - ログ（Discord のログ・遅延のログ・画面のログの診断）に文字起こしの本文・名前・Discord の id・鍵が出ない。放送に speakerId が出ない。
 *  - 本物の耳（createEarPipeline）と本物の opusscript で、購読の終わりの無音で区切りが閉じる・短すぎる発話を捨てる。
 * 本物の Discord・LLM・外部 API は呼ばない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCockpitServer, VENUE_CONNECTION_STATES } from "./cockpit-server.mjs";
import { createFileSettingsStore } from "./cockpit-settings-store.mjs";
import {
  createDiscordExperience,
  DISCORD_REASONS,
  DISCORD_TAIL_SILENCE_MS
} from "../discord/discord-experience.mjs";
import {
  createFakeDiscord,
  FAKE_SPEECH_PACKET,
  OPUS_SILENCE_FRAME,
  FAKE_CHANNEL_TYPE
} from "../test-support/fake-discord.mjs";
import { DEFAULT_WHISPER_PORT } from "../ears/whisper-server.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

const GUILD = "guild-fake-1";
const CHANNEL = "channel-fake-1";
const USER_A = "user-fake-a";
const USER_B = "user-fake-b";
const NAME_A = "たろう";
const NAME_B = "はなこ";
const FAKE_TOKEN = "fake.discord-token_for-server-test";
const KEY_FILE = ".env.discord-chappy.local";
/** ログ・放送に出てはいけない値。 */
const SECRET_WORDS = [USER_A, USER_B, NAME_A, NAME_B, GUILD, CHANNEL, FAKE_TOKEN];

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

/** 偽の耳（人ごとの耳 = pipelineFactory の 1 回）。start で captureFactory を呼び、流れてきた音を記録する。 */
function makeFakeEars() {
  /** @type {Array<{ options: any; pcm: Buffer[]; started: boolean; disposed: boolean; capture: any; startShouldThrow: Error | null }>} */
  const ears = [];
  /** @type {Error | null} */
  let nextStartThrows = null;
  const factory = (/** @type {any} */ options) => {
    const ear = { options, pcm: /** @type {Buffer[]} */ ([]), started: false, disposed: false, capture: null, startShouldThrow: nextStartThrows };
    nextStartThrows = null;
    ears.push(ear);
    return {
      transcriptBuffer: options.transcriptBuffer,
      async start() {
        if (ear.startShouldThrow) {
          ear.disposed = true; // 起きなかった耳は自分で畳む（ear-pipeline の約束）。
          throw ear.startShouldThrow;
        }
        ear.started = true;
        if (typeof options.captureFactory === "function") {
          ear.capture = options.captureFactory({ onPcm: (/** @type {Buffer} */ chunk) => ear.pcm.push(chunk) });
        }
      },
      async dispose() {
        ear.disposed = true;
        ear.capture?.dispose?.();
      },
      isDisposed: () => ear.disposed,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  /** その耳が 1 行積む（本物の耳と同じ: 積む口 → 耳ごとの口）。 @param {any} ear @param {string} text */
  const hear = (ear, text, latencyMs = 40) => {
    const r = ear.options.transcriptBuffer.append({ startMs: 0, endMs: 900, text });
    if (r.appended) ear.options.onTranscript(r.entry, { latencyMs, audioCtx: null });
    return r;
  };
  return {
    factory,
    ears,
    hear,
    /** 次に作る耳の start を失敗させる。 @param {Error} error */
    failNextStart(error) {
      nextStartThrows = error;
    }
  };
}

/**
 * ロールの束の偽物（場の口・声を events に記録する）。
 * @param {string[]} events @param {{ openSession?: () => any; hooks?: any }} [opts]
 */
function makeRole(events, opts = {}) {
  return {
    id: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    discordBotKeyFile: () => KEY_FILE,
    hooks: opts.hooks ?? {
      renewRecords: () => void events.push("chappy.renewRecords"),
      openSession: async () => {
        events.push("chappy.openSession");
        return opts.openSession ? opts.openSession() : { ok: true };
      },
      connectBody: () => {
        events.push("chappy.connectBody");
        return { ok: true };
      },
      closeSession: () => void events.push("chappy.closeSession"),
      closeBody: () => void events.push("chappy.closeBody"),
      saveFinal: (/** @type {any[]} */ transcript) => void events.push(`chappy.saveFinal:${transcript.length}`)
    },
    voice: {
      prepare: (/** @type {string} */ kind) => {
        events.push(`chappy.voice.prepare:${kind}`);
        return { ok: true };
      },
      startResources: () => void events.push("chappy.voice.resources")
    },
    recall: null
  };
}

/**
 * 本物の server + 本物の Discord の体験の口 + 偽の Discord。準備は一時フォルダの設定ファイル。
 * @param {{
 *   prep?: { guildId?: string | null; channelId?: string | null; sttEngine?: string | null } | null;
 *   fake?: object;
 *   token?: { ok: boolean; token?: string; reason?: string };
 *   discordOptions?: object;
 *   serverOptions?: object;
 *   role?: any;
 *   useFakeEars?: boolean;
 * }} [p]
 */
async function startDiscordServer(p = {}) {
  const dir = mkdtempSync(join(tmpdir(), "discord-d-server-"));
  const settingsPath = join(dir, "cockpit-settings.local.json");
  const settings = createFileSettingsStore({ path: settingsPath });
  const prep = p.prep === undefined ? { guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" } : p.prep;
  if (prep) settings.setDiscordPrep(prep);
  // Discord モード Domain G: Discord の場の見る窓を選んでおく（選んでいなければ Discord の場では目を起こさない・設計 §4.3 の 7）。
  settings.setDiscordVisionTarget("偽のゲームの窓");
  /** @type {string[]} */
  const events = [];
  const fake = createFakeDiscord({
    guilds: [
      {
        id: GUILD,
        name: "試しのサーバー",
        channels: [
          { id: "channel-fake-2", name: "雑談", rawPosition: 2 },
          { id: CHANNEL, name: "一般", rawPosition: 1 },
          { id: "channel-fake-text", name: "文字", type: FAKE_CHANNEL_TYPE.GuildText, rawPosition: 0 }
        ],
        members: { [USER_A]: NAME_A, [USER_B]: NAME_B }
      }
    ],
    ...(p.fake ?? {})
  });
  /** @type {string[]} */
  const tokenFiles = [];
  /** @type {string[]} */
  const logs = [];
  const discord = createDiscordExperience({
    settings,
    currentKeyFile: () => KEY_FILE,
    loadToken: (fileName) => {
      tokenFiles.push(fileName);
      events.push("discord.token");
      return /** @type {any} */ (p.token ?? { ok: true, token: FAKE_TOKEN });
    },
    loadLibraries: async () => {
      events.push("discord.load");
      return fake.loadLibraries();
    },
    log: (line) => logs.push(line),
    loginTimeoutMs: 200,
    readyTimeoutMs: 200,
    ...(p.discordOptions ?? {})
  });
  const ears = makeFakeEars();
  /** @type {any[]} */
  const sttLogs = [];
  const server = createCockpitServer({
    ...(p.useFakeEars === false ? {} : { pipelineFactory: /** @type {any} */ (ears.factory) }),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [p.role ?? makeRole(events)],
    experiences: { discord },
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true }),
    onSttLatency: (/** @type {any} */ info) => sttLogs.push(info),
    onEyesStart: () => void events.push("eyes.start"),
    onEyesStop: () => void events.push("eyes.stop"),
    ...(p.serverOptions ?? {})
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    settings,
    settingsPath,
    fake,
    discord,
    ears,
    events,
    logs,
    sttLogs,
    tokenFiles,
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

/** @param {string} text */
function assertNoSecrets(text, label = "") {
  for (const word of SECRET_WORDS) assert.equal(text.includes(word), false, `${label} に ${word} が出ている`);
}

// ── 1. 開く ─────────────────────────────────────────────────────────────

test("Discord の場を開く: 下見（鍵）→ 声の engine → ログイン・VC → 再生器 → 目 → 頭 → 器・Intent は 2 つだけ・group はロールの id・snapshot", async () => {
  const h = await startDiscordServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    const r = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 200, JSON.stringify(r.json.error));
    assert.deepEqual(h.events, [
      "chappy.renewRecords",
      "discord.token",
      "chappy.voice.prepare:aivis",
      "discord.load",
      "chappy.voice.resources",
      "eyes.start",
      "chappy.openSession",
      "chappy.connectBody"
    ]);
    const client = /** @type {any} */ (h.fake.client());
    assert.deepEqual(client.options.intents, [1, 128], "Intent は Guilds と GuildVoiceStates だけ");
    assert.deepEqual(h.fake.record.logins, [FAKE_TOKEN]);
    assert.deepEqual(h.tokenFiles, [KEY_FILE], "鍵はロールの束が指すファイルから");
    assert.equal(h.fake.record.joins.length, 1);
    const join = h.fake.record.joins[0];
    assert.equal(join.group, "chappy", "group はロールの id");
    assert.equal(join.guildId, GUILD);
    assert.equal(join.channelId, CHANNEL);
    assert.equal(join.selfDeaf, false);
    assert.equal(join.selfMute, false);
    // snapshot の項目（G が使う）。
    const s = r.json;
    assert.equal(s.stream.phase, "open");
    assert.equal(s.stream.experience, "discord");
    assert.equal(s.stream.connection, "joined");
    assert.equal(s.ears, "listening");
    assert.deepEqual(s.stt, { engine: "elevenlabs", status: "up", reason: null });
    assert.equal(s.health.ffmpeg.status, "unknown", "Discord の場にマイクは無い");
    assert.deepEqual(s.discord, { available: true });
    assert.deepEqual([...VENUE_CONNECTION_STATES], ["joining", "joined", "disconnected", "outside"]);
    // 開く途中の snapshot: 入っている途中。
    const states = sse.events.filter((e) => e.event === "state").map((e) => e.data);
    assert.ok(states.some((d) => d.stream.experience === "discord" && d.stream.connection === "joining" && d.ears === "starting"));
    // 鍵は設定ファイルにも snapshot にも入らない。
    assert.equal(readFileSync(h.settingsPath, "utf8").includes(FAKE_TOKEN), false);
    assert.equal(JSON.stringify(sse.events).includes(FAKE_TOKEN), false);
  } finally {
    sse.close();
    await h.cleanup();
  }
});

test("配信の場は今のまま: stream.connection は null・discord は available・Discord の部品は読み込まない", async () => {
  const h = await startDiscordServer();
  try {
    const r = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(r.status, 200);
    assert.equal(r.json.stream.experience, "stream");
    assert.equal(r.json.stream.connection, null);
    assert.equal(r.json.stt.engine, "whisper", "配信は配信の文字起こしの選択");
    assert.equal(h.fake.record.loadCount, 0);
    assert.deepEqual(h.tokenFiles, []);
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.cleanup();
  }
  const bare = createCockpitServer({ pipelineFactory: /** @type {any} */ (makeFakeEars().factory) });
  const url = await bare.listen(0);
  try {
    const st = await get(url, "/api/state");
    assert.equal(st.json.discord, null, "Discord の入口が無ければ null");
    assert.equal(st.json.stream.connection, null);
  } finally {
    await bare.close();
  }
});

// ── 2. 人ごとの音 → 耳 ────────────────────────────────────────────────────

test("人ごとの購読と耳: 2 人で 2 本・行は you + 名前 + id で正本に積まれる・3 バイトのフレームを捨てる・購読の終わりに無音・放送に id が出ない", async () => {
  const h = await startDiscordServer();
  const sse = openEvents(h.url);
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    // 1 人目が話し始める → 購読（AfterSilence）・デコーダ・耳 1 本。
    h.fake.speak(USER_A);
    await waitUntil(() => h.ears.ears.length === 1 && h.ears.ears[0].started);
    const earA = h.ears.ears[0];
    assert.equal(h.fake.record.subscribes.length, 1);
    assert.equal(h.fake.record.subscribes[0].userId, USER_A);
    assert.deepEqual(h.fake.record.subscribes[0].options.end.behavior, 1, "AfterSilence");
    assert.equal(typeof earA.options.captureFactory, "function", "ffmpeg の代わりに人ごとの音を流す口");
    assert.equal(earA.options.segmenter.minSpeechMs, 400, "短すぎる発話（400ms 未満）を捨てる");
    assert.equal(earA.options.stt.engine, "elevenlabs");
    assert.equal(earA.options.stt.apiKey, "fake-elevenlabs-key");
    assert.equal(earA.options.whisper.port, undefined, "1 人目は whisper の口の番号をずらさない");
    // パケット: 話している 3 つ・無音のフレーム 2 つ → デコードして耳へ流すのは 3 つ（20ms・16kHz・モノラル = 640 バイト）。
    h.fake.send(USER_A, FAKE_SPEECH_PACKET);
    h.fake.send(USER_A, OPUS_SILENCE_FRAME);
    h.fake.send(USER_A, FAKE_SPEECH_PACKET);
    h.fake.send(USER_A, OPUS_SILENCE_FRAME);
    h.fake.send(USER_A, FAKE_SPEECH_PACKET);
    await waitUntil(() => earA.pcm.length === 3);
    assert.ok(earA.pcm.every((c) => c.length === 640));
    // 話している間にもう一度 start が来ても、購読は 1 つのまま。
    h.fake.speak(USER_A);
    assert.equal(h.fake.record.subscribes.length, 1);
    // 黙った（購読の終わり）→ 耳の区切りが閉じるよう短い無音を足す。
    h.fake.endSpeech(USER_A);
    await waitUntil(() => earA.pcm.length === 4);
    const tail = earA.pcm[3];
    assert.equal(tail.length, (16000 * 2 * DISCORD_TAIL_SILENCE_MS) / 1000);
    assert.ok(tail.every((b) => b === 0));
    // 2 人目 → 耳 2 本目（whisper の口の番号は 1 つずらす）。
    h.fake.speak(USER_B);
    await waitUntil(() => h.ears.ears.length === 2 && h.ears.ears[1].started);
    const earB = h.ears.ears[1];
    assert.equal(earB.options.whisper.port, DEFAULT_WHISPER_PORT + 1);
    await waitUntil(() => h.fake.record.memberFetches.includes(USER_A) && h.fake.record.memberFetches.includes(USER_B));
    await tick(10);
    // 行は you + Discord の名前 + ユーザー id（正本の中だけ）。
    h.ears.hear(earA, "こんにちは", 120);
    h.ears.hear(earB, "やあ", 80);
    const lines = h.server.getTranscript().map((/** @type {any} */ e) => [e.speaker, e.displayName, e.speakerId, e.text]);
    assert.deepEqual(lines, [
      ["you", NAME_A, USER_A, "こんにちは"],
      ["you", NAME_B, USER_B, "やあ"]
    ]);
    // 放送: 名前は行に載る・id は載らない。遅延のログは方式と数字だけ。
    await waitUntil(() => sse.events.filter((e) => e.event === "transcript").length >= 2);
    const you = sse.events.filter((e) => e.event === "transcript").map((e) => [e.data.displayName, e.data.text, e.data.speakerId]);
    assert.deepEqual(you, [
      [NAME_A, "こんにちは", undefined],
      [NAME_B, "やあ", undefined]
    ]);
    const wire = JSON.stringify(sse.events);
    assert.equal(wire.includes(USER_A) || wire.includes(USER_B), false, "放送に Discord の id が出ない");
    assert.equal(wire.includes(GUILD) || wire.includes(CHANNEL), false, "放送にサーバー・チャンネルの id が出ない");
    assert.deepEqual(h.sttLogs, [
      { engine: "elevenlabs", latencyMs: 120 },
      { engine: "elevenlabs", latencyMs: 80 }
    ]);
    // VAD は耳の束を通って場の VAD の口へ（放送される）。
    earA.options.onVadEvent({ type: "speechStart", tMs: 0 });
    await waitUntil(() => sse.events.some((e) => e.event === "vad" && e.data.type === "speechStart"));
    // ログには本文・名前・id・鍵が出ない（数と状態だけ）。
    const diagnostics = sse.events.filter((e) => e.event === "diagnostic");
    assertNoSecrets(JSON.stringify(diagnostics), "画面のログ（診断）");
    assertNoSecrets(h.logs.join("\n"), "Discord のログ");
    assertNoSecrets(JSON.stringify(h.sttLogs), "遅延のログ");
    for (const text of ["こんにちは", "やあ"]) {
      assert.equal(h.logs.join("\n").includes(text), false);
      assert.equal(JSON.stringify(diagnostics).includes(text), false);
    }
    assert.ok(h.logs.includes("joined"));
    assert.ok(h.logs.some((l) => l.startsWith("speaker ear started")));
  } finally {
    sse.close();
    await h.cleanup();
  }
});

test("人が抜けたら耳を束から外す（正本は続く）・ほかのサーバーの入退室は見ない・全員が抜けても Bot は抜けない", async () => {
  const h = await startDiscordServer();
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.fake.speak(USER_A);
    h.fake.speak(USER_B);
    await waitUntil(() => h.ears.ears.length === 2 && h.ears.ears.every((e) => e.started));
    const [earA, earB] = h.ears.ears;
    h.ears.hear(earB, "またね");
    h.fake.voiceState({ userId: USER_B, guildId: "guild-fake-other", from: CHANNEL, to: null });
    assert.equal(earB.disposed, false, "ほかのサーバーの出来事は見ない");
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: CHANNEL, to: null });
    await waitUntil(() => earB.disposed);
    assert.equal(earA.disposed, false);
    assert.deepEqual(h.server.getTranscript().map((/** @type {any} */ e) => e.text), ["またね"], "正本は続く");
    // 抜けた人が戻って話せば、新しい耳を作る。
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: null, to: CHANNEL });
    await tick(10); // 抜けたときに閉じた購読が片付くのを待つ。
    h.fake.speak(USER_B);
    await waitUntil(() => h.ears.ears.length === 3 && h.ears.ears[2].started);
    // 全員が抜けても Bot は抜けない（場も閉じない）。
    h.fake.voiceState({ userId: USER_A, guildId: GUILD, from: CHANNEL, to: null });
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: CHANNEL, to: "channel-fake-2" });
    await tick(20);
    assert.equal(/** @type {any} */ (h.fake.connection()).destroyCount, 0);
    assert.equal(h.server.streamStatus().phase, "open");
    assert.equal(h.fake.record.destroyedClients, 0);
  } finally {
    await h.cleanup();
  }
});

test("途中で切れたら場は閉じずに「切れた」・つながり直せば「入っている」に戻る（ライブラリのつなぎ直しに任せる）", async () => {
  const h = await startDiscordServer();
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.fake.setConnectionStatus("disconnected");
    let st = (await get(h.url, "/api/state")).json;
    assert.equal(st.stream.phase, "open");
    assert.equal(st.stream.connection, "disconnected");
    h.fake.setConnectionStatus("signalling");
    h.fake.setConnectionStatus("connecting");
    st = (await get(h.url, "/api/state")).json;
    assert.equal(st.stream.connection, "disconnected", "つながり直している間も切れたまま");
    h.fake.setConnectionStatus("ready");
    st = (await get(h.url, "/api/state")).json;
    assert.equal(st.stream.connection, "joined");
    assert.equal(/** @type {any} */ (h.fake.connection()).destroyCount, 0, "Bot は自分で抜けない");
    assert.ok(h.logs.includes("connection disconnected") && h.logs.includes("connection joined"));
  } finally {
    await h.cleanup();
  }
});

test("人の耳が起きなければ、その人は聞かない（耳を束から外す・stt は down・理由は決まった文面）・場は閉じない", async () => {
  const h = await startDiscordServer();
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.ears.failNextStart(new Error(`spawn failed for ${NAME_A} ${USER_A}`));
    h.fake.speak(USER_A);
    await waitUntil(() => h.ears.ears.length === 1 && h.ears.ears[0].disposed);
    await tick(10);
    const st = (await get(h.url, "/api/state")).json;
    assert.equal(st.stt.status, "down");
    assert.equal(st.stt.reason, DISCORD_REASONS.ear);
    assert.equal(st.stream.phase, "open");
    // 同じ人がまた話しても作り直さない（この場の間）。
    h.fake.endSpeech(USER_A);
    h.fake.speak(USER_A);
    await tick(20);
    assert.equal(h.ears.ears.length, 1);
    assertNoSecrets(h.logs.join("\n"), "Discord のログ");
  } finally {
    await h.cleanup();
  }
});

// ── 3. 閉じる ─────────────────────────────────────────────────────────

test("閉じる: VC を抜けてログアウト・耳を畳む・snapshot は閉じた形・closeEntrance は二重でも開いていなくても冪等", async () => {
  const h = await startDiscordServer();
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.fake.speak(USER_A);
    await waitUntil(() => h.ears.ears.length === 1 && h.ears.ears[0].started);
    h.events.length = 0;
    const r = await post(h.url, "/api/stream/stop");
    assert.equal(r.status, 200);
    assert.deepEqual(h.events, ["eyes.stop", "chappy.closeSession", "chappy.closeBody", "chappy.saveFinal:0"]);
    assert.equal(h.ears.ears[0].disposed, true);
    const connection = /** @type {any} */ (h.fake.connection());
    assert.equal(connection.destroyCount, 1, "VC を抜ける");
    assert.equal(h.fake.record.destroyedClients, 1, "ログアウト");
    assert.equal(r.json.stream.experience, null);
    assert.equal(r.json.stream.connection, null);
    assert.equal(r.json.ears, "stopped");
    assert.equal(r.json.stt.engine, "whisper", "配信の選択に戻る");
    assert.ok(h.logs.some((l) => l.startsWith("left (")));
    // 冪等: 開いていなくても・二重でも投げない・もう一度は畳まない。
    await h.discord.closeEntrance({ hadEars: false, shutdown: false }, null);
    await h.discord.closeEntrance({ hadEars: false, shutdown: true });
    assert.equal(connection.destroyCount, 1);
    assert.equal(h.fake.record.destroyedClients, 1);
    // 閉じたあとはまた開ける。
    const again = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(again.status, 200);
    assert.equal(h.fake.record.joins.length, 2);
  } finally {
    await h.cleanup();
  }
  // サーバを閉じたときも VC を抜けてログアウトする（場が開いたまま close）。
  const h2 = await startDiscordServer();
  try {
    await post(h2.url, "/api/stream/start", { experience: "discord" });
  } finally {
    await h2.cleanup();
  }
  assert.equal(/** @type {any} */ (h2.fake.connection()).destroyCount, 1);
  assert.equal(h2.fake.record.destroyedClients, 1);
});

// ── 4. 入れない ────────────────────────────────────────────────────────

/**
 * 入れないとき: 場を開かずに理由・耳は Stopped・接続の状態は null・頭と器は開かない・再生器と目は起こさない。
 * @param {Awaited<ReturnType<typeof startDiscordServer>>} h @param {string} reason
 */
async function assertRefused(h, reason) {
  const r = await post(h.url, "/api/stream/start", { experience: "discord" });
  assert.equal(r.status, 500);
  assert.equal(r.json.error, reason);
  assert.equal(r.json.state.stream.error, reason);
  assert.equal(r.json.state.stream.phase, "closed");
  assert.equal(r.json.state.stream.experience, null);
  assert.equal(r.json.state.stream.connection, null);
  assert.equal(r.json.state.ears, "stopped");
  assert.equal(r.json.state.stt.engine, "whisper");
  assert.equal(h.events.includes("chappy.openSession"), false);
  assert.equal(h.events.includes("chappy.voice.resources"), false);
  assert.equal(h.events.includes("eyes.start"), false);
  assertNoSecrets(r.json.error, "理由");
  assertNoSecrets(h.logs.join("\n"), "Discord のログ");
  return r;
}

test("入れない（下見）: 準備が無い・方式が知らない値・鍵が無い・ElevenLabs のキー切れ・ローカルのモデルの欠け → ログインせずに理由", async () => {
  for (const prep of [null, { guildId: GUILD, channelId: null }, { guildId: null, channelId: CHANNEL }]) {
    const h = await startDiscordServer({ prep });
    try {
      await assertRefused(h, DISCORD_REASONS.notPrepared);
      assert.equal(h.fake.record.loadCount, 0);
    } finally {
      await h.cleanup();
    }
  }
  const unknown = await startDiscordServer({ prep: { guildId: GUILD, channelId: CHANNEL, sttEngine: "nope" } });
  try {
    await assertRefused(unknown, DISCORD_REASONS.sttEngine);
  } finally {
    await unknown.cleanup();
  }
  const keyReason = "Discord の鍵が見つからない（apps/soul/agent/.env.discord-chappy.local の DISCORD_BOT_TOKEN）";
  const noKey = await startDiscordServer({ token: { ok: false, reason: keyReason } });
  try {
    await assertRefused(noKey, keyReason);
    assert.equal(noKey.fake.record.loadCount, 0);
  } finally {
    await noKey.cleanup();
  }
  const eleven = await startDiscordServer({
    serverOptions: { elevenLabsApiKeyProvider: () => ({ ok: false, reason: "ElevenLabs のキーが見つからない（テスト）" }) }
  });
  try {
    const r = await assertRefused(eleven, "ElevenLabs のキーが見つからない（テスト）");
    assert.equal(r.json.state.stt.status, "unknown", "配信の文字起こしの警告として残さない");
    assert.equal(eleven.fake.record.loadCount, 0);
    assert.equal(eleven.events.includes("chappy.voice.prepare:aivis"), false, "声の engine の用意より前に断る");
  } finally {
    await eleven.cleanup();
  }
  const local = await startDiscordServer({
    prep: { guildId: GUILD, channelId: CHANNEL, sttEngine: "zipformer" },
    serverOptions: { localSttModelCheck: () => ({ ok: false, reason: "Zipformer のモデルが見つからない（テスト）" }) }
  });
  try {
    await assertRefused(local, "Zipformer のモデルが見つからない（テスト）");
  } finally {
    await local.cleanup();
  }
});

test("入れない（開く）: ログインできない・時間切れ・サーバー / チャンネルが無い・VC に入れない → 自分で畳む（接続とログイン）・理由に鍵や生のエラーを出さない", async () => {
  const cases = /** @type {const} */ ([
    [{ loginFails: true }, null, DISCORD_REASONS.login],
    [{ neverReady: true }, null, DISCORD_REASONS.login],
    [{}, { guildId: "guild-fake-404", channelId: CHANNEL }, DISCORD_REASONS.guild],
    [{}, { guildId: GUILD, channelId: "channel-fake-404" }, DISCORD_REASONS.channel],
    [{}, { guildId: GUILD, channelId: "channel-fake-text" }, DISCORD_REASONS.channel],
    [{ joinFails: true }, null, DISCORD_REASONS.join]
  ]);
  for (const [fake, prep, reason] of cases) {
    const h = await startDiscordServer({ fake, ...(prep ? { prep: { ...prep, sttEngine: "whisper" } } : {}) });
    try {
      await assertRefused(h, reason);
      assert.equal(h.fake.record.clients.length, 1);
      assert.equal(h.fake.record.destroyedClients, 1, `ログアウトする（${reason}）`);
      for (const c of h.fake.record.connections) assert.equal(c.destroyCount, 1, "接続は畳む");
      assert.equal(h.ears.ears.length, 0, "耳は作らない");
      assert.equal(h.events.includes("chappy.closeBody"), true, "器は畳む（場の段）");
      // 閉じたあとの closeEntrance（場の close）でもう一度は畳まない。
    } finally {
      await h.cleanup();
    }
    assert.equal(h.fake.record.destroyedClients, 1);
  }
});

test("openEntrance のあとの段で止まったら、場が入口を閉じる: 人ごとの耳・接続・ログインを全部畳む", async () => {
  /** @type {(v: any) => void} */
  let release = () => {};
  /** @type {string[]} */
  const events = [];
  const role = makeRole(events, {
    openSession: () =>
      new Promise((resolve) => {
        release = resolve;
      })
  });
  const h = await startDiscordServer({ role });
  try {
    const opening = post(h.url, "/api/stream/start", { experience: "discord" });
    await waitUntil(() => events.includes("chappy.openSession"));
    h.fake.speak(USER_A);
    await waitUntil(() => h.ears.ears.length === 1 && h.ears.ears[0].started);
    release({ ok: false, reason: "頭のセッションを作れない（テスト）" });
    const r = await opening;
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "頭のセッションを作れない（テスト）");
    assert.equal(h.ears.ears[0].disposed, true);
    assert.equal(/** @type {any} */ (h.fake.connection()).destroyCount, 1);
    assert.equal(h.fake.record.destroyedClients, 1);
    assert.equal(r.json.state.stream.connection, null);
    assert.equal(r.json.state.ears, "stopped");
  } finally {
    await h.cleanup();
  }
});

test("開く途中でサーバを閉じたら、入口はログインせずに止まる（閉じたあとの入口は開かない）", async () => {
  /** @type {() => void} */
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = () => resolve(undefined);
  });
  const h = await startDiscordServer();
  const fake = h.fake;
  // 部品の読み込みを止めておく。
  const slow = createDiscordExperience({
    settings: h.settings,
    currentKeyFile: () => KEY_FILE,
    loadToken: () => ({ ok: true, token: FAKE_TOKEN }),
    loadLibraries: async () => {
      await gate;
      return fake.loadLibraries();
    }
  });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (h.ears.factory),
    roles: [makeRole([])],
    experiences: { discord: slow },
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" })
  });
  await server.listen(0);
  try {
    const opening = server.startStream({ experience: "discord" });
    await waitUntil(() => server.streamStatus().phase === "opening");
    await tick(20);
    await server.close();
    release();
    const r = /** @type {any} */ (await opening);
    assert.equal(r.ok, false);
    assert.deepEqual(fake.record.logins, [], "閉じたあとはログインしない");
    assert.equal(slow.connectionStatus(), null);
  } finally {
    await h.cleanup();
  }
});

test("想定外の例外: Discord の場は Discord の文面（生のエラー文を入れない）・配信の場は今の文面のまま", async () => {
  /** @type {string[]} */
  const events = [];
  const hooks = {
    renewRecords: () => {},
    get openSession() {
      throw new Error(`boom ${USER_A}`);
    },
    closeSession: () => {},
    closeBody: () => {}
  };
  const h = await startDiscordServer({ role: { ...makeRole(events), hooks } });
  try {
    const d = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(d.status, 500);
    assert.equal(d.json.error, DISCORD_REASONS.unexpectedOpen);
    assert.equal(/** @type {any} */ (h.fake.connection()).destroyCount, 1, "入口は畳む");
    assert.equal(h.fake.record.destroyedClients, 1);
    const s = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(s.status, 500);
    assert.match(s.json.error, /^配信を始められない（想定外のエラー: boom user-fake-a）$/);
  } finally {
    await h.cleanup();
  }
});

// ── 5. Discord の準備と一覧の API ─────────────────────────────────────────

test("Discord の準備の API: 読む・書く（一時フォルダの設定ファイル）・形の確かめ・サーバーを替えたらチャンネルを消す", async () => {
  const h = await startDiscordServer({ prep: null });
  try {
    assert.deepEqual((await get(h.url, "/api/discord/prep")).json, { prep: { guildId: null, channelId: null, sttEngine: null } });
    let r = await post(h.url, "/api/discord/prep", { guildId: GUILD, channelId: CHANNEL, sttEngine: "parakeet" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.prep, { guildId: GUILD, channelId: CHANNEL, sttEngine: "parakeet" });
    assert.deepEqual(createFileSettingsStore({ path: h.settingsPath }).getDiscordPrep(), r.json.prep, "設定ファイルに保存");
    r = await post(h.url, "/api/discord/prep", { guildId: "guild-fake-2" });
    assert.deepEqual(r.json.prep, { guildId: "guild-fake-2", channelId: null, sttEngine: "parakeet" });
    r = await post(h.url, "/api/discord/prep", { sttEngine: null });
    assert.equal(r.json.prep.sttEngine, null);
    for (const bad of [{ sttEngine: "nope" }, { guildId: "bad id!" }, { channelId: 12 }, []]) {
      const refused = await post(h.url, "/api/discord/prep", bad);
      assert.equal(refused.status, 400, JSON.stringify(bad));
      assert.equal(typeof refused.json.error, "string");
    }
    assert.equal(createFileSettingsStore({ path: h.settingsPath }).getDiscordPrep().guildId, "guild-fake-2", "断ったら書かない");
  } finally {
    await h.cleanup();
  }
});

test("一覧の API: ロールの鍵でログイン → サーバーとボイスチャンネル（声のチャンネルだけ・並び順）→ ログアウト・失敗は 502 で決まった文面", async () => {
  const h = await startDiscordServer();
  try {
    const r = await post(h.url, "/api/discord/catalog");
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, {
      guilds: [
        {
          id: GUILD,
          name: "試しのサーバー",
          channels: [
            { id: CHANNEL, name: "一般" },
            { id: "channel-fake-2", name: "雑談" }
          ]
        }
      ]
    });
    assert.deepEqual(h.tokenFiles, [KEY_FILE]);
    assert.deepEqual(/** @type {any} */ (h.fake.client()).options.intents, [1, 128]);
    assert.equal(h.fake.record.destroyedClients, 1, "読んだらログアウト");
    assert.equal(h.fake.record.joins.length, 0, "VC には入らない");
    assertNoSecrets(h.logs.join("\n"), "Discord のログ");
  } finally {
    await h.cleanup();
  }
  for (const [fake, reason] of /** @type {const} */ ([
    [{ catalogFails: true }, DISCORD_REASONS.catalog],
    [{ loginFails: true }, DISCORD_REASONS.login]
  ])) {
    const f = await startDiscordServer({ fake });
    try {
      const r = await post(f.url, "/api/discord/catalog");
      assert.equal(r.status, 502);
      assert.equal(r.json.error, reason);
      assert.equal(f.fake.record.destroyedClients, 1);
    } finally {
      await f.cleanup();
    }
  }
  const noKey = await startDiscordServer({ token: { ok: false, reason: "Discord の鍵が見つからない（テスト）" } });
  try {
    const r = await post(noKey.url, "/api/discord/catalog");
    assert.equal(r.status, 502);
    assert.equal(r.json.error, "Discord の鍵が見つからない（テスト）");
    assert.equal(noKey.fake.record.loadCount, 0);
  } finally {
    await noKey.cleanup();
  }
});

test("Discord の場の間は準備の書き換えと一覧の読み込みを断る（409）・Discord の入口が無ければ 503", async () => {
  const h = await startDiscordServer();
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal((await post(h.url, "/api/discord/prep", { sttEngine: "whisper" })).status, 409);
    assert.equal((await post(h.url, "/api/discord/catalog")).status, 409);
    assert.equal((await get(h.url, "/api/discord/prep")).status, 200, "読むのはよい");
    await post(h.url, "/api/stream/stop");
    // 配信の場の間は Discord の準備をしてよい。
    await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal((await post(h.url, "/api/discord/prep", { sttEngine: "whisper" })).status, 200);
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.cleanup();
  }
  const bare = createCockpitServer({ pipelineFactory: /** @type {any} */ (makeFakeEars().factory) });
  const url = await bare.listen(0);
  try {
    assert.equal((await get(url, "/api/discord/prep")).status, 503);
    assert.equal((await post(url, "/api/discord/prep", {})).status, 503);
    assert.equal((await post(url, "/api/discord/catalog")).status, 503);
  } finally {
    await bare.close();
  }
});

// ── 6. 本物の耳と本物の opusscript ─────────────────────────────────────────

/** 本物の opusscript で 440Hz の音を 20ms ずつ Opus にする（48kHz・ステレオ）。 @param {any} OpusScript @param {number} ms */
function encodeTone(OpusScript, ms) {
  const encoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO);
  try {
    /** @type {Buffer[]} */
    const packets = [];
    let n = 0;
    for (let f = 0; f < ms / 20; f += 1) {
      const frame = Buffer.alloc(960 * 2 * 2);
      for (let i = 0; i < 960; i += 1, n += 1) {
        const v = Math.round(Math.sin((2 * Math.PI * 440 * n) / 48000) * 0.6 * 32767);
        frame.writeInt16LE(v, i * 4);
        frame.writeInt16LE(v, i * 4 + 2);
      }
      packets.push(Buffer.from(encoder.encode(frame, 960)));
    }
    return packets;
  } finally {
    encoder.delete();
  }
}

/** 本物の耳に差す偽の VAD・whisper-server・転写（実 ONNX・実 whisper は使わない）。 */
function realEarParts() {
  /** @type {any[]} */
  const calls = [];
  return {
    calls,
    pipelineOptions: {
      vadFactory: () => ({
        async init() {},
        /** @param {Float32Array} frame */
        async process(frame) {
          let sum = 0;
          for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
          return Math.sqrt(sum / frame.length) > 0.1 ? 0.9 : 0.05;
        },
        reset() {},
        async dispose() {}
      }),
      serverFactory: () => ({ ready: Promise.resolve(), baseUrl: "http://127.0.0.1:0", dispose() {} }),
      transcribeImpl: async (/** @type {Uint8Array} */ wav) => {
        calls.push(wav.length);
        return { text: "聞こえた", rawText: " 聞こえた" };
      }
    }
  };
}

test("本物の耳と本物の opusscript: 1 秒の声 → 購読の終わりの無音で区切りが閉じて 1 行（you + 名前 + id）・200ms は捨てる", async () => {
  const o = /** @type {any} */ (await import("opusscript"));
  const OpusScript = o.default ?? o;
  const parts = realEarParts();
  const h = await startDiscordServer({
    prep: { guildId: GUILD, channelId: CHANNEL, sttEngine: "whisper" },
    fake: { OpusScript },
    useFakeEars: false,
    serverOptions: { pipelineOptions: parts.pipelineOptions }
  });
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    h.fake.speak(USER_A);
    for (const packet of encodeTone(OpusScript, 1000)) h.fake.send(USER_A, packet);
    await tick(100);
    assert.equal(parts.calls.length, 0, "黙ったと分かるまでは区切らない");
    h.fake.endSpeech(USER_A);
    await waitUntil(() => h.server.getTranscript().length === 1, 5000);
    const [line] = h.server.getTranscript();
    assert.deepEqual([line.speaker, line.displayName, line.speakerId, line.text], ["you", NAME_A, USER_A, "聞こえた"]);
    // 短すぎる発話（200ms）は捨てる（区切りの minSpeechMs = 400ms）。
    h.fake.speak(USER_A);
    for (const packet of encodeTone(OpusScript, 200)) h.fake.send(USER_A, packet);
    h.fake.endSpeech(USER_A);
    await tick(400);
    assert.equal(parts.calls.length, 1);
    assert.equal(h.server.getTranscript().length, 1);
    const st = (await get(h.url, "/api/state")).json;
    assert.equal(st.health.whisper.status, "up");
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.cleanup();
  }
});

test("本物の耳: 購読の終わりに無音を足さないと区切りが閉じない（足す理由の確かめ）", async () => {
  const o = /** @type {any} */ (await import("opusscript"));
  const OpusScript = o.default ?? o;
  const parts = realEarParts();
  const h = await startDiscordServer({
    prep: { guildId: GUILD, channelId: CHANNEL, sttEngine: "whisper" },
    fake: { OpusScript },
    useFakeEars: false,
    serverOptions: { pipelineOptions: parts.pipelineOptions },
    discordOptions: { tailSilenceMs: 0 }
  });
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.fake.speak(USER_A);
    for (const packet of encodeTone(OpusScript, 1000)) h.fake.send(USER_A, packet);
    h.fake.endSpeech(USER_A);
    await tick(400);
    assert.equal(parts.calls.length, 0);
    assert.equal(h.server.getTranscript().length, 0);
  } finally {
    await h.cleanup();
  }
});
