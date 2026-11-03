// @ts-check
/**
 * Discord モード Domain E: Discord の体験の口（src/discord/discord-experience.mjs）の出口と、D からの直し 2 つ。
 *  - 出口: VC が Ready になった直後に、その場のロールの束の voice.openOutlet（group = ロールの id のロール）を呼ぶ。
 *    deps.outletFactory が渡されていればそちら。出口を作れなければ場を開かずに理由（自分で畳む）。閉じるときに dispose。
 *  - 直し (b): ログインの途中で closeEntrance が呼ばれたら、ログインし終えた Bot を destroy する（D のレビューの再現と同じ形）。
 *  - 直し (a): ロールの束が「鍵のファイル名の形が合わない」と言えば、鍵を読まずにログインもせず、決まった文面で断る。
 * 本物の Discord・鍵には触れない（偽の Discord・偽の鍵の値）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createDiscordExperience, DISCORD_REASONS, roleOutletFactory } from "./discord-experience.mjs";
import { createFakeDiscord } from "../test-support/fake-discord.mjs";

const GUILD = "guild-fake-1";
const CHANNEL = "channel-fake-1";
const FAKE_TOKEN = "fake.discord-token_for-discord-e";

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
/** @param {() => boolean} pred */
async function waitUntil(pred, timeoutMs = 3000) {
  const until = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > until) throw new Error("waitUntil timed out");
    await tick();
  }
}

function makeFake() {
  return createFakeDiscord({ guilds: [{ id: GUILD, name: "試し", channels: [{ id: CHANNEL, name: "一般" }], members: {} }] });
}

/** 場の口の最小の偽物（耳の束は空・人の耳は作らない）。 @param {any[]} [roles] */
function makeVenue(roles = []) {
  /** @type {string[]} */
  const calls = [];
  return {
    calls,
    venue: {
      transcriptBuffer: { append: () => ({ appended: false }) },
      createEars: () => {
        calls.push("ears.create");
        let disposed = false;
        return {
          add() {},
          drop: async () => {},
          isDisposed: () => disposed,
          dispose: async () => {
            disposed = true;
            calls.push("ears.dispose");
          }
        };
      },
      createEar: () => {
        throw new Error("not used");
      },
      stopEars: () => calls.push("stopEars"),
      earsListening: () => calls.push("earsListening"),
      changed: () => {},
      roles
    }
  };
}

const plan = Object.freeze({ token: FAKE_TOKEN, guildId: GUILD, channelId: CHANNEL, groupId: "chappy", earPlan: { engine: "whisper" } });

/** @param {any} fake @param {object} [extra] */
function makeExperience(fake, extra = {}) {
  /** @type {string[]} */
  const logs = [];
  const discord = createDiscordExperience({
    settings: { getDiscordPrep: () => ({ guildId: GUILD, channelId: CHANNEL }), setDiscordPrep() {} },
    loadToken: () => ({ ok: true, token: FAKE_TOKEN }),
    loadLibraries: fake.loadLibraries,
    log: (line) => logs.push(line),
    loginTimeoutMs: 2000,
    readyTimeoutMs: 2000,
    ...extra
  });
  return { discord, logs };
}

// ── 出口 ───────────────────────────────────────────────────────────────

test("出口: VC が Ready になった直後に、group と同じ id のロールの voice.openOutlet を呼ぶ（接続と voice の束）・閉じるときに dispose", async () => {
  const fake = makeFake();
  /** @type {any[]} */
  const opened = [];
  /** @type {string[]} */
  const order = [];
  const makeRole = (/** @type {string} */ id) => ({
    id: () => id,
    voice: {
      openOutlet: (/** @type {any} */ info) => {
        opened.push({ role: id, ...info });
        order.push(`outlet.open:${info.connection.state.status}`);
        return {
          dispose: () => order.push(`outlet.dispose:destroyCount=${info.connection.destroyCount}`)
        };
      }
    }
  });
  const { venue, calls } = makeVenue([makeRole("other"), makeRole("chappy")]);
  const { discord, logs } = makeExperience(fake);
  const r = await discord.openEntrance(plan, venue);
  assert.equal(r.ok, true);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].role, "chappy", "group（ロールの id）のロールの出口");
  assert.equal(opened[0].connection, fake.connection());
  assert.equal(opened[0].voice, fake.libraries.voice, "動的 import した @discordjs/voice の束");
  assert.equal(opened[0].groupId, "chappy");
  assert.deepEqual(order, ["outlet.open:ready"]);
  assert.ok(logs.includes("outlet ready"));
  await discord.closeEntrance({ hadEars: true, shutdown: false }, venue);
  assert.deepEqual(order, ["outlet.open:ready", "outlet.dispose:destroyCount=0"], "出口は VC を抜ける前に畳む");
  assert.ok(calls.indexOf("ears.dispose") >= 0);
  assert.equal(/** @type {any} */ (fake.connection()).destroyCount, 1);
  await discord.closeEntrance({ hadEars: false, shutdown: true }, venue);
  assert.equal(order.length, 2, "二重に畳まない");
});

test("出口: deps.outletFactory が渡されていればロールの口より先・どちらも無ければ出口なし（D のふるまい）", async () => {
  const fake = makeFake();
  /** @type {string[]} */
  const used = [];
  const role = { id: () => "chappy", voice: { openOutlet: () => used.push("role") } };
  const { venue } = makeVenue([role]);
  const { discord } = makeExperience(fake, { outletFactory: () => (used.push("deps"), null) });
  assert.equal((await discord.openEntrance(plan, venue)).ok, true);
  assert.deepEqual(used, ["deps"]);
  await discord.closeEntrance({}, venue);
  const plain = makeExperience(makeFake());
  const r = await plain.discord.openEntrance(plan, makeVenue([{ id: () => "chappy", voice: {} }]).venue);
  assert.equal(r.ok, true);
  assert.equal(plain.logs.some((l) => l.startsWith("outlet")), false);
  await plain.discord.closeEntrance({}, null);
});

test("出口を作れなければ場を開かない: 決まった文面・自分で畳む（耳の束・VC・ログイン）", async () => {
  const fake = makeFake();
  const role = {
    id: () => "chappy",
    voice: {
      openOutlet: () => {
        throw new Error(`createAudioPlayer failed ${FAKE_TOKEN}`);
      }
    }
  };
  const { venue, calls } = makeVenue([role]);
  const { discord, logs } = makeExperience(fake);
  const r = await discord.openEntrance(plan, venue);
  assert.deepEqual(r, { ok: false, reason: DISCORD_REASONS.outlet });
  assert.ok(calls.includes("ears.dispose"));
  assert.equal(/** @type {any} */ (fake.connection()).destroyCount, 1);
  assert.equal(fake.record.destroyedClients, 1);
  assert.equal(discord.connectionStatus(), null);
  assert.equal(discord.voiceConnection(), null);
  assert.equal(logs.join("\n").includes(FAKE_TOKEN), false);
});

test("roleOutletFactory: id の合うロール・無ければ先頭・口が無ければ null・一覧でなければ null", () => {
  const a = { id: () => "a", voice: { openOutlet: () => "A" } };
  const b = { id: () => "b", voice: { openOutlet: () => "B" } };
  assert.equal(roleOutletFactory([a, b], "b")?.(/** @type {any} */ ({})), "B");
  assert.equal(roleOutletFactory([a, b], "zzz")?.(/** @type {any} */ ({})), "A");
  assert.equal(roleOutletFactory([{ id: () => "a", voice: {} }], "a"), null);
  assert.equal(roleOutletFactory(null, "a"), null);
  assert.equal(roleOutletFactory([], "a"), null);
  const throwing = { id: () => { throw new Error("x"); }, voice: { openOutlet: () => "T" } };
  assert.equal(roleOutletFactory([throwing], "a")?.(/** @type {any} */ ({})), "T");
});

// ── 直し (b): ログインの途中で閉じる ─────────────────────────────────────────

test("直し (b): ログインの途中で closeEntrance が呼ばれたら、ログインし終えた Bot を destroy する（D のレビューの再現）", async () => {
  const fake = makeFake();
  /** @type {() => void} */
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = () => resolve(undefined);
  });
  const libs = fake.libraries;
  class SlowClient extends /** @type {any} */ (libs.discord.Client) {
    /** @param {string} token */
    async login(token) {
      await gate;
      return super.login(token);
    }
  }
  const { discord, logs } = makeExperience(fake, {
    loadLibraries: async () => ({ ...libs, discord: { ...libs.discord, Client: SlowClient } })
  });
  const { venue } = makeVenue();
  const opening = discord.openEntrance(plan, venue);
  await waitUntil(() => fake.record.clients.length === 1);
  await discord.closeEntrance({ hadEars: false, shutdown: true }, null);
  assert.equal(fake.record.destroyedClients, 0, "閉じた時点ではまだ client が無い");
  release();
  const r = await opening;
  assert.deepEqual(r, { ok: false, reason: DISCORD_REASONS.closed });
  assert.deepEqual(fake.record.logins, [FAKE_TOKEN], "ログインは済んでいた");
  assert.equal(fake.record.destroyedClients, 1, "ログインした Bot を destroy した");
  assert.equal(/** @type {any} */ (fake.client()).destroyed, true);
  assert.equal(fake.record.joins.length, 0, "VC には入らない");
  assert.equal(discord.connectionStatus(), null);
  assert.equal(logs.join("\n").includes(FAKE_TOKEN), false);
});

test("直し (b) の対照: ログインの前（部品の読み込み中）に閉じたらログインしない・VC に入る途中で閉じたら接続とログインを畳む", async () => {
  const fake = makeFake();
  /** @type {() => void} */
  let release = () => {};
  const gate = new Promise((resolve) => {
    release = () => resolve(undefined);
  });
  const early = makeExperience(fake, {
    loadLibraries: async () => {
      await gate;
      return fake.libraries;
    }
  });
  const opening = early.discord.openEntrance(plan, makeVenue().venue);
  await tick(10);
  await early.discord.closeEntrance({}, null);
  release();
  assert.deepEqual(await opening, { ok: false, reason: DISCORD_REASONS.closed });
  assert.deepEqual(fake.record.logins, []);
  assert.equal(fake.record.destroyedClients, 0);

  const neverReady = createFakeDiscord({ guilds: [{ id: GUILD, name: "試し", channels: [{ id: CHANNEL, name: "一般" }] }] });
  const libs = neverReady.libraries;
  const stuck = makeExperience(neverReady, {
    loadLibraries: async () => ({
      ...libs,
      voice: {
        ...libs.voice,
        // Ready にならない接続（閉じられるまで待つ・destroy の Destroyed だけは通す）。
        joinVoiceChannel: (/** @type {any} */ config) => {
          const c = libs.voice.joinVoiceChannel(config);
          const original = c.setStatus.bind(c);
          c.setStatus = (/** @type {string} */ status) => {
            if (status === "destroyed") original(status);
          };
          return c;
        }
      }
    })
  });
  const joining = stuck.discord.openEntrance(plan, makeVenue().venue);
  await waitUntil(() => neverReady.record.joins.length === 1);
  await stuck.discord.closeEntrance({}, null);
  const r = await Promise.race([joining, tick(3000).then(() => "hung")]);
  assert.notEqual(r, "hung");
  assert.equal(neverReady.record.destroyedClients, 1);
});
