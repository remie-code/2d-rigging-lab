// @ts-check
/**
 * Discord モード Domain I: scripts/cockpit.mjs の側（discord-mode.md §13.3「どの VC にもいない間に、手元のスピーカーで鳴らない」）。
 *  - createVenuePlayerSlot: 出口の dispose({ hold: true })（VC から抜けた）で再生器を畳み、差し口に「VC にいない」の口
 *    （HELD_VENUE_PLAYER）を残す。差し口が空にならないので、main() の ensureVoiceResources・activePlayer は手元の再生器を作らない・
 *    使わない。次の open で置き換わり、hold なしの dispose（場を閉じた）・slot.dispose（サーバを閉じた）で空に戻る。出口を作れない
 *    ときは「VC にいない」の口を残す。
 *  - 本物の cockpit-server + Discord の体験の口 + 偽の Discord + 本物の Discord 向けの再生器で: 抜けた瞬間に鳴っている途中の発話は
 *    stopped で終わり、差し口は「VC にいない」の口（遅れて届いた声は open で投げる = 手元に落ちない）。入り直すと新しい接続に結んだ
 *    再生器。移っても同じ。「通話を終える」で空に戻る（次の配信の場は手元の再生器）。
 * 本物の Discord・鍵・実データには触れない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createVenuePlayerSlot, createVenueRoleBundle, HELD_VENUE_PLAYER, HELD_VENUE_PLAYER_MESSAGE } from "./cockpit.mjs";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { createDiscordExperience } from "../src/discord/discord-experience.mjs";
import { createDiscordStreamPlayer } from "../src/discord/discord-stream-player.mjs";
import { createFakeDiscord } from "../src/test-support/fake-discord.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";

const GUILD = "guild-fake-1";
const CHANNEL = "channel-fake-1";
const CHANNEL_2 = "channel-fake-2";

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** @param {string} url @param {string} p @param {unknown} [body] */
async function post(url, p, body = {}) {
  const r = await fetch(`${url}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

// ── createVenuePlayerSlot の hold ─────────────────────────────────────────

test("Domain I createVenuePlayerSlot: dispose({ hold: true }) で「VC にいない」の口を残す → 次の open で置き換え → hold なしの dispose・slot.dispose で空", () => {
  /** @type {any[]} */
  const made = [];
  const slot = createVenuePlayerSlot({
    createPlayer: (info) => {
      const p = { info, disposed: 0, dispose() { this.disposed += 1; } };
      made.push(p);
      return p;
    }
  });
  const first = slot.open({ connection: { id: "c1" }, voice: {}, groupId: "chappy" });
  first.dispose({ hold: true });
  assert.equal(made[0].disposed, 1);
  assert.equal(slot.current(), HELD_VENUE_PLAYER, "差し口は空にならない（手元の再生器に戻さない）");
  const second = slot.open({ connection: { id: "c2" }, voice: {}, groupId: "chappy" });
  assert.equal(slot.current(), made[1], "入り直したら新しい再生器");
  first.dispose(); // 前の出口の dispose は今の再生器を外さない
  assert.equal(slot.current(), made[1]);
  second.dispose({ hold: true });
  assert.equal(slot.current(), HELD_VENUE_PLAYER);
  second.dispose();
  assert.equal(slot.current(), null, "場を閉じた（hold なしの dispose）ら空");
  const third = slot.open({ connection: { id: "c3" }, voice: {}, groupId: "chappy" });
  third.dispose({ hold: true });
  slot.dispose();
  assert.equal(slot.current(), null, "サーバを閉じたら空");
});

test("Domain I createVenuePlayerSlot: 出口を作れないときは「VC にいない」の口を残す（手元に戻さない）・前の再生器は作れてから畳む", () => {
  let fail = false;
  /** @type {any[]} */
  const made = [];
  const slot = createVenuePlayerSlot({
    createPlayer: () => {
      if (fail) throw new Error("no outlet");
      const p = { disposed: 0, dispose() { this.disposed += 1; } };
      made.push(p);
      return p;
    }
  });
  const outlet = slot.open({ connection: {}, voice: {}, groupId: "chappy" });
  outlet.dispose({ hold: true });
  fail = true;
  assert.throws(() => slot.open({ connection: {}, voice: {}, groupId: "chappy" }), /no outlet/);
  assert.equal(slot.current(), HELD_VENUE_PLAYER);
  fail = false;
  const live = slot.open({ connection: {}, voice: {}, groupId: "chappy" });
  assert.throws(() => (fail = true, slot.open({ connection: {}, voice: {}, groupId: "chappy" })));
  assert.equal(slot.current(), made[1], "作れなければ今の再生器のまま");
  assert.equal(made[1].disposed, 0);
  live.dispose();
});

test("Domain I 「VC にいない」の口: 鳴らさない（open / write / end は決まった文面で投げる）・stop / onEvent / dispose は何もしない", () => {
  assert.throws(() => HELD_VENUE_PLAYER.open("v1", { sampleRate: 24000, channels: 1 }), new RegExp(HELD_VENUE_PLAYER_MESSAGE.slice(0, 20)));
  assert.throws(() => HELD_VENUE_PLAYER.write("v1", new Uint8Array(4)));
  assert.throws(() => HELD_VENUE_PLAYER.end("v1"));
  assert.doesNotThrow(() => HELD_VENUE_PLAYER.stop());
  const off = HELD_VENUE_PLAYER.onEvent(() => {});
  assert.equal(typeof off, "function");
  assert.equal(HELD_VENUE_PLAYER.isAlive(), false);
  assert.doesNotThrow(() => HELD_VENUE_PLAYER.dispose());
});

// ── 本物の server + Discord の体験の口 + 本物の Discord 向けの再生器 ───────────────────

async function startVenue() {
  const dir = mkdtempSync(path.join(tmpdir(), "discord-i-cockpit-"));
  const settings = createFileSettingsStore({ path: path.join(dir, "cockpit-settings.local.json") });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
  const fake = createFakeDiscord({
    guilds: [{ id: GUILD, name: "試し", channels: [{ id: CHANNEL, name: "一般" }, { id: CHANNEL_2, name: "雑談" }], members: {} }]
  });
  /** @type {string[]} */
  const resources = [];
  const slot = createVenuePlayerSlot({
    createPlayer: (info) => createDiscordStreamPlayer({ voice: info.voice, connection: info.connection })
  });
  const bundle = createVenueRoleBundle({
    currentId: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    streamHooks: {
      renewRecords: () => {},
      openSession: async () => ({ ok: true }),
      connectBody: () => ({ ok: true }),
      closeSession: () => {},
      closeBody: () => {},
      saveFinal: () => {}
    },
    prepareVoice: () => ({ ok: true }),
    // cockpit.mjs の ensureVoiceResources と同じ見分け（差し口が空でなければ手元の再生器を起こさない）。
    startVoiceResources: () => void resources.push(slot.current() ? "discord" : "local"),
    discordBotKeyFile: () => null,
    discordBotKeyFileRefused: () => false,
    openVoiceOutlet: (info) => slot.open(info)
  });
  const discord = createDiscordExperience({
    settings,
    loadToken: () => ({ ok: true, token: "fake.discord-token_for-cockpit-i" }),
    loadLibraries: fake.loadLibraries,
    loginTimeoutMs: 500,
    readyTimeoutMs: 500,
    disconnectGraceMs: 30
  });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (() => ({
      transcriptBuffer: null,
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    })),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [bundle],
    experiences: { discord },
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true })
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    fake,
    slot,
    resources,
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

test("Domain I 抜けた瞬間: 鳴っている途中の発話は stopped で終わり、差し口は「VC にいない」の口（遅れて届いた声は手元に落ちない）・入り直す / 移ると新しい接続の再生器・通話を終えると空", async () => {
  const h = await startVenue();
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    assert.deepEqual(h.resources, ["discord"]);
    const player = h.slot.current();
    /** @type {any[]} */
    const playerEvents = [];
    player.onEvent((/** @type {any} */ e) => playerEvents.push([e.type, e.id]));
    player.open("v1", { sampleRate: 24000, channels: 1 });
    player.write("v1", new Uint8Array(24 * 500 * 2));
    await settle();
    // 抜ける。
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    assert.deepEqual(playerEvents, [["started", "v1"], ["stopped", "v1"]], "鳴っている途中の発話は stopped で終わる");
    assert.equal(player.isAlive(), false);
    assert.equal(h.slot.current(), HELD_VENUE_PLAYER, "差し口は空にならない = 手元の再生器を作らない・使わない");
    // 遅れて届いた声（受理の時点で差し口の口を引いた発火）は鳴らずに投げる。
    assert.throws(() => h.slot.current().open("v2", { sampleRate: 24000, channels: 1 }));
    assert.equal(h.fake.audio.resources.length, 1, "新しい resource は作らない");
    // 入り直す → 新しい接続に結んだ再生器。
    assert.equal((await post(h.url, "/api/discord/vc", { action: "join", channelId: CHANNEL })).status, 200);
    const rejoined = h.slot.current();
    assert.notEqual(rejoined, HELD_VENUE_PLAYER);
    assert.notEqual(rejoined, player);
    assert.equal(h.fake.audio.players.at(-1).subscribers[0].connection, h.fake.connection());
    // 移る → また新しい接続の再生器。
    assert.equal((await post(h.url, "/api/discord/vc", { action: "move", channelId: CHANNEL_2 })).status, 200);
    const moved = h.slot.current();
    assert.notEqual(moved, rejoined);
    assert.equal(rejoined.isAlive(), false);
    assert.equal(h.fake.audio.players.at(-1).subscribers[0].connection, h.fake.connection());
    assert.equal(/** @type {any} */ (h.fake.connection()).joinConfig.channelId, CHANNEL_2);
    // 外から切られても手元に戻らない。
    h.fake.kickBot();
    for (let k = 0; k < 20 && h.slot.current() !== HELD_VENUE_PLAYER; k += 1) await new Promise((r) => setTimeout(r, 10));
    assert.equal(h.slot.current(), HELD_VENUE_PLAYER);
    // 通話を終える（VC にいないまま）→ 空（次の配信の場は手元の再生器）。
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    assert.equal(h.slot.current(), null);
  } finally {
    await h.cleanup();
  }
});
