// @ts-check
/**
 * Discord モード Domain E: scripts/cockpit.mjs の側（discord-mode.md §4.3「再生器を作る（ロールごと）」・§5・§7）。
 *  - createVenuePlayerSlot: その場の再生器の差し口。Discord の場では Bot の接続に結んだ Discord 向けの再生器が入り、閉じたら空
 *    （次の配信の場は手元の再生器）。
 *  - createVenueRoleBundle: ロールの束の voice.openOutlet（Discord の出口）と discordBotKeyFileRefused（鍵のファイル名の形）。
 *  - 本物の cockpit-server + Discord の体験の口 + 偽の Discord で: VC に入ると再生器が Bot の接続に結ばれ（再生器を起こす段より前）、
 *    声は VC の resource に流れる。閉じる順は「声を止める → 目 → 正本・耳の束 → 入口を閉じる（出口を畳む → VC を抜ける）」。
 *    進行中の発話は場を閉じると stopped で終わる。形の合わない鍵のファイル名は入口で断る（鍵を読まない・ログインしない）。
 *  - main() の結線（ソースの並び）: ensureVoiceResources は Discord の場で手元の再生器を起こさない・受理の player はその場の再生器・
 *    ロールの束に出口と断りの印を渡す。
 * 本物の Discord・鍵・実データには触れない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createVenuePlayerSlot, createVenueRoleBundle } from "./cockpit.mjs";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { createDiscordExperience, DISCORD_REASONS } from "../src/discord/discord-experience.mjs";
import { createDiscordStreamPlayer } from "../src/discord/discord-stream-player.mjs";
import { createFakeDiscord } from "../src/test-support/fake-discord.mjs";
import { createFakeDiscordAudio, fakeSubscribe } from "../src/test-support/fake-discord-audio.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";
import { normalizeRole, roleDiscordBotKeyFile, roleDiscordBotKeyFileRefused } from "../src/roles/role-store.mjs";

const GUILD = "guild-fake-1";
const CHANNEL = "channel-fake-1";
const FAKE_TOKEN = "fake.discord-token_for-cockpit-e";

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** @param {string} url @param {string} p @param {unknown} [body] */
async function post(url, p, body = {}) {
  const r = await fetch(`${url}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

// ── createVenuePlayerSlot ──────────────────────────────────────────────────

test("createVenuePlayerSlot: 空（配信）→ open で再生器を作って置く → 返り値の dispose で畳んで空に戻す・二重 open は前を畳む・冪等", () => {
  /** @type {any[]} */
  const made = [];
  const slot = createVenuePlayerSlot({
    createPlayer: (info) => {
      const p = { info, disposed: 0, dispose() { this.disposed += 1; } };
      made.push(p);
      return p;
    }
  });
  assert.equal(slot.current(), null, "配信の場では空（手元の再生器を使う）");
  const info = { connection: { id: "c1" }, voice: {}, groupId: "chappy" };
  const outlet = slot.open(info);
  assert.equal(slot.current(), made[0]);
  assert.equal(made[0].info, info);
  outlet.dispose();
  assert.equal(slot.current(), null, "閉じたら空（次の配信の場は手元の再生器）");
  assert.equal(made[0].disposed, 1);
  outlet.dispose();
  assert.equal(made[0].disposed, 2, "dispose は再生器の冪等に任せる");
  const first = slot.open(info);
  const second = slot.open(info);
  assert.equal(made[1].disposed, 1, "前の場の残りは畳む");
  assert.equal(slot.current(), made[2]);
  first.dispose(); // 古い出口の dispose は今の再生器を外さない
  assert.equal(slot.current(), made[2]);
  second.dispose();
  assert.equal(slot.current(), null);
  slot.dispose();
});

test("createVenuePlayerSlot（既定）: Discord 向けの再生器を作り、その接続に結ぶ・started の遅れを渡せる", () => {
  const audio = createFakeDiscordAudio();
  const connection = { state: { status: "ready" }, subscribe(/** @type {any} */ p) { return fakeSubscribe(this, p); } };
  /** @type {string[]} */
  const traces = [];
  const slot = createVenuePlayerSlot({ startedDelayMs: 250, onTrace: (e) => traces.push(e) });
  const outlet = slot.open({ connection, voice: audio, groupId: "chappy" });
  const player = slot.current();
  assert.equal(audio.players.length, 1);
  assert.equal(audio.players[0].subscribers[0].connection, connection);
  assert.equal(player.settings.startedDelayMs, 250);
  for (const m of ["open", "write", "end", "stop", "onEvent", "isAlive", "dispose"]) assert.equal(typeof player[m], "function", m);
  player.open("u1", { sampleRate: 24000, channels: 1 });
  assert.ok(traces.includes("discord.player.opened"));
  outlet.dispose();
  assert.equal(player.isAlive(), false);
  assert.equal(audio.players[0].subscribers.length, 0);
});

// ── createVenueRoleBundle ──────────────────────────────────────────────

test("createVenueRoleBundle: voice.openOutlet と discordBotKeyFileRefused（渡したときだけ・渡さなければ null）", () => {
  /** @type {any[]} */
  const opened = [];
  let refused = false;
  const bundle = /** @type {any} */ (
    createVenueRoleBundle({
      currentId: () => "chappy",
      identity: () => MODEL_IDENTITIES.chappy,
      streamHooks: {},
      prepareVoice: () => ({ ok: true }),
      startVoiceResources: () => {},
      discordBotKeyFileRefused: () => refused,
      openVoiceOutlet: (info) => {
        opened.push(info);
        return { dispose() {} };
      }
    })
  );
  const info = { connection: {}, voice: {}, groupId: "chappy" };
  assert.equal(typeof bundle.voice.openOutlet(info).dispose, "function");
  assert.deepEqual(opened, [info]);
  assert.equal(bundle.discordBotKeyFileRefused(), false);
  refused = true;
  assert.equal(bundle.discordBotKeyFileRefused(), true, "呼んだ時点の今のロール");
  const plain = /** @type {any} */ (
    createVenueRoleBundle({
      currentId: () => "chappy",
      identity: () => MODEL_IDENTITIES.chappy,
      streamHooks: {},
      prepareVoice: () => ({ ok: true }),
      startVoiceResources: () => {}
    })
  );
  assert.equal(plain.voice.openOutlet, null);
  assert.equal(plain.discordBotKeyFileRefused, null);
});

// ── 本物の server + Discord の体験の口 + 偽の Discord ─────────────────────────────

/** 偽の耳（人ごとの耳）。 */
function fakeEarFactory() {
  return (/** @type {any} */ options) => {
    let disposed = false;
    return {
      transcriptBuffer: options.transcriptBuffer,
      async start() {},
      async dispose() {
        disposed = true;
      },
      isDisposed: () => disposed,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
}

/**
 * @param {{ roleRaw?: object }} [p]
 */
async function startVenue(p = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "discord-e-cockpit-"));
  const settings = createFileSettingsStore({ path: path.join(dir, "cockpit-settings.local.json") });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
  const fake = createFakeDiscord({ guilds: [{ id: GUILD, name: "試し", channels: [{ id: CHANNEL, name: "一般" }], members: {} }] });
  /** @type {string[]} */
  const events = [];
  /** @type {string[]} */
  const tokenFiles = [];
  const role = normalizeRole("chappy", p.roleRaw ?? {});
  const slot = createVenuePlayerSlot({
    createPlayer: (info) => {
      events.push("outlet.open");
      const player = createDiscordStreamPlayer({ voice: info.voice, connection: info.connection });
      const dispose = player.dispose;
      player.dispose = () => {
        events.push(`outlet.dispose:destroyCount=${info.connection.destroyCount}`);
        dispose();
      };
      return player;
    }
  });
  const bundle = createVenueRoleBundle({
    currentId: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    streamHooks: {
      renewRecords: () => {},
      openSession: async () => ({ ok: true }),
      connectBody: () => ({ ok: true }),
      closeSession: () => void events.push("closeSession"),
      closeBody: () => {},
      saveFinal: () => {}
    },
    prepareVoice: () => ({ ok: true }),
    // cockpit.mjs の ensureVoiceResources と同じ見分け（その場の再生器があれば手元の再生器を起こさない）。
    startVoiceResources: () => void events.push(`voice.resources:${slot.current() ? "discord" : "local"}`),
    discordBotKeyFile: () => roleDiscordBotKeyFile(role),
    discordBotKeyFileRefused: () => roleDiscordBotKeyFileRefused(role),
    openVoiceOutlet: (info) => slot.open(info)
  });
  const discord = createDiscordExperience({
    settings,
    loadToken: (fileName) => {
      tokenFiles.push(fileName);
      return { ok: true, token: FAKE_TOKEN };
    },
    loadLibraries: fake.loadLibraries,
    loginTimeoutMs: 500,
    readyTimeoutMs: 500
  });
  const earFactory = fakeEarFactory();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ ((/** @type {any} */ options) => {
      const ear = earFactory(options);
      const dispose = ear.dispose;
      ear.dispose = async () => {
        events.push("ear.dispose");
        await dispose();
      };
      return ear;
    }),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [bundle],
    experiences: { discord },
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true }),
    onEyesStart: () => void events.push("eyes.start"),
    onEyesStop: () => void events.push("eyes.stop")
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    fake,
    slot,
    events,
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

test("Discord の場: VC に入ると再生器がそのロールの Bot の接続に結ばれ（再生器を起こす段より前）、声は VC の resource に流れる", async () => {
  const h = await startVenue();
  try {
    const r = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 200, JSON.stringify(r.json.error));
    assert.deepEqual(h.events.slice(0, 3), ["outlet.open", "voice.resources:discord", "eyes.start"], "再生器を起こす段では Discord の再生器がある");
    const player = h.slot.current();
    assert.ok(player);
    const audioPlayer = h.fake.audio.players[0];
    assert.equal(audioPlayer.subscribers[0].connection, h.fake.connection(), "その場のロールの Bot の接続に結ぶ");
    assert.deepEqual(audioPlayer.behaviors, { noSubscriber: "pause", maxMissedFrames: 75 });
    // 声（運び手が呼ぶのと同じ口）は VC の resource へ（48kHz ステレオ）。
    player.open("v1", { sampleRate: 24000, channels: 1 });
    player.write("v1", new Uint8Array(24 * 100 * 2));
    await settle();
    assert.equal(h.fake.audio.resources[0].received, 48 * 100 * 4);
    assert.equal(h.fake.audio.resources[0].inputType, "raw");
  } finally {
    await h.cleanup();
  }
});

test("閉じる: 声を止める → 目 → 耳の束 → 入口（出口を畳む → VC を抜ける）・進行中の発話は stopped・閉じたら差し口は空（次は手元の再生器）", async () => {
  const h = await startVenue();
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    const player = h.slot.current();
    /** @type {any[]} */
    const playerEvents = [];
    player.onEvent((/** @type {any} */ e) => playerEvents.push([e.type, e.id]));
    player.open("v1", { sampleRate: 24000, channels: 1 });
    player.write("v1", new Uint8Array(24 * 500 * 2));
    // 人の耳を 1 本（話し始め）。
    h.fake.speak("user-fake-a");
    for (let k = 0; k < 20; k += 1) await settle();
    h.events.length = 0;
    const r = await post(h.url, "/api/stream/stop");
    assert.equal(r.status, 200);
    const i = (/** @type {string} */ name) => h.events.findIndex((e) => e.startsWith(name));
    assert.ok(i("eyes.stop") >= 0 && i("eyes.stop") < i("ear.dispose"), JSON.stringify(h.events));
    assert.ok(i("ear.dispose") < i("outlet.dispose"), JSON.stringify(h.events));
    assert.equal(h.events.find((e) => e.startsWith("outlet.dispose")), "outlet.dispose:destroyCount=0", "VC を抜ける前に出口を畳む");
    assert.ok(i("outlet.dispose") < i("closeSession"));
    assert.deepEqual(playerEvents, [["started", "v1"], ["stopped", "v1"]], "進行中の発話は stopped で終わる");
    assert.equal(player.isAlive(), false);
    assert.equal(h.fake.audio.players[0].subscribers.length, 0);
    assert.equal(h.slot.current(), null, "閉じたら空（次の配信の場は手元の再生器）");
    assert.equal(/** @type {any} */ (h.fake.connection()).destroyCount, 1);
    // もう一度入れば新しい再生器を作る。
    const again = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(again.status, 200);
    assert.notEqual(h.slot.current(), player);
    assert.equal(h.fake.audio.players.length, 2);
  } finally {
    await h.cleanup();
  }
  assert.equal(h.slot.current(), null, "サーバを閉じても畳む");
});

test("直し (a): role.json の discordBotKeyFile の形が合わなければ入口で断る（鍵を読まない・ログインしない・値を出さない）・項目が無ければ既定の鍵", async () => {
  const bad = await startVenue({ roleRaw: { discordBotKeyFile: "C:/keys/.env.discord.local" } });
  try {
    const r = await post(bad.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 500);
    assert.equal(r.json.error, DISCORD_REASONS.keyFileName);
    assert.equal(r.json.state.stream.phase, "closed");
    assert.equal(r.json.error.includes("C:/keys"), false);
    assert.deepEqual(bad.tokenFiles, [], "鍵を読みに行かない");
    assert.deepEqual(bad.fake.record.logins, []);
    assert.equal(bad.slot.current(), null);
  } finally {
    await bad.cleanup();
  }
  const plain = await startVenue();
  try {
    const r = await post(plain.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 200);
    assert.deepEqual(plain.tokenFiles, [".env.discord.local"], "項目が無ければ今どおり既定");
  } finally {
    await plain.cleanup();
  }
});

// ── main() の結線（ソースの並び）────────────────────────────────────────────

test("場の結線（main）: Discord の場では手元の再生器を起こさない・受理の player はその場の再生器・ロールの束に出口と断りの印", () => {
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const main = source.slice(source.indexOf("async function main()"));
  assert.match(main, /const venuePlayers = createVenuePlayerSlot\(\{/);
  assert.match(main, /const activePlayer = \(\) => venuePlayers\.current\(\) \?\? player;/);
  assert.match(
    main,
    /const ensureVoiceResources = \(\) => \{\n(?:\s*\/\/[^\n]*\n)*\s+if \(venuePlayers\.current\(\) != null\) \{\n\s+voiceEngines\.ensure\(desiredTtsEngine\);\n\s+return;\n\s+\}/,
    "Discord の場では手元の再生器（常駐 PowerShell）を作らない"
  );
  assert.match(main, /const acceptedPlayer = activePlayer\(\);/);
  assert.match(main, /discordBotKeyFileRefused: \(\) => roleDiscordBotKeyFileRefused\(roleHooks\.current\(\)\),/);
  assert.match(main, /openVoiceOutlet: \(info\) => venuePlayers\.open\(info\),/);
  // playerProxy も今の場の再生器へ。
  const proxy = main.slice(main.indexOf("const playerProxy = {"), main.indexOf("const productionSpeakDeps"));
  assert.ok(proxy.length > 0);
  assert.doesNotMatch(proxy, /\(player\)\.open|player\.write\(|player\.end\(|player\.stop\(\)/, "手元の再生器を直に触らない");
  assert.match(proxy, /activePlayer\(\)/);
});
