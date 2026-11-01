// @ts-check
/**
 * Discord モード Domain I: 体験と VC 接続を分ける（discord-mode.md §13.2・§13.3）— Discord の体験の口（src/discord/discord-experience.mjs）を、
 * 場の口の偽物と偽の Discord（src/test-support/fake-discord.mjs）でつなぐ。
 *  - 抜ける: 接続の分だけ畳む（人の耳を束から drop・出口を hold つきで畳む・connection を destroy）。耳の束は畳まない・client は
 *    ログアウトしない・「切れた」と出さない・耳は「聞いていない」（pauseEars）・鳴っている返事を止める（hushVoice）。
 *  - 入り直す: 同じ client で新しい接続（使い回しの joinVoiceChannel にならない）・同じ耳の束・耳の番号は続き・聞いているに戻る。
 *  - 移る: 抜ける + 入る。移る先が使えなければ抜けない。人の耳と出口は新しい接続につく。
 *  - 外から: 4014 は猶予のあと VC の外で待っている・それ以外の切れは「切れた」・Bot 自身が VC の外へ = 外で待っている・
 *    Discord の画面で動かされたら動いた先を追う（4014 が先でも後でも）・前の VC の人の耳は drop。
 *  - 出来事の合図（vcEvent）は種類と名前だけ（id を載せない）・人の出入りは Bot を除く。同じサーバーの VC の一覧（人数つき）。
 *  - ログに VC の名前・人の名前・Discord の id が出ない。
 * 本物の Discord・鍵には触れない（偽の Discord・偽の鍵の値・偽の id）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createDiscordExperience,
  DISCORD_CONNECTION_STATES,
  DISCORD_VC_REFUSALS,
  DISCORD_REASONS
} from "./discord-experience.mjs";
import { createEarBundle } from "../ears/ear-bundle.mjs";
import { createFakeDiscord, FAKE_CHANNEL_TYPE, FAKE_SPEECH_PACKET } from "../test-support/fake-discord.mjs";

const GUILD = "guild-fake-1";
const OTHER_GUILD = "guild-fake-2";
const CHANNEL = "channel-fake-1";
const CHANNEL_2 = "channel-fake-2";
const CHANNEL_3 = "channel-fake-3";
const TEXT_CHANNEL = "channel-fake-text";
const STAGE_CHANNEL = "channel-fake-stage";
const OTHER_GUILD_CHANNEL = "channel-fake-other";
const USER_A = "user-fake-a";
const USER_B = "user-fake-b";
const BOT_OTHER = "bot-fake-other";
const NAME_A = "たろう";
const NAME_B = "はなこ";
const VC_1 = "一般";
const VC_2 = "雑談";
const VC_3 = "会議";
const FAKE_TOKEN = "fake.discord-token_for-discord-i";
/** ログ・合図の id に出てはいけない値。 */
const ID_WORDS = [GUILD, CHANNEL, CHANNEL_2, CHANNEL_3, USER_A, USER_B, BOT_OTHER, "bot-fake-1", FAKE_TOKEN];

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
  return createFakeDiscord({
    guilds: [
      {
        id: GUILD,
        name: "試しのサーバー",
        channels: [
          { id: CHANNEL, name: VC_1, rawPosition: 1 },
          { id: CHANNEL_2, name: VC_2, rawPosition: 2 },
          { id: CHANNEL_3, name: VC_3, rawPosition: 3 },
          { id: TEXT_CHANNEL, name: "文字", type: FAKE_CHANNEL_TYPE.GuildText, rawPosition: 0 },
          { id: STAGE_CHANNEL, name: "舞台", type: FAKE_CHANNEL_TYPE.GuildStageVoice, rawPosition: 4 }
        ],
        members: { [USER_A]: NAME_A, [USER_B]: NAME_B, [BOT_OTHER]: "ほかの Bot" },
        voiceStates: { [USER_B]: CHANNEL_2, [BOT_OTHER]: CHANNEL_2 },
        // Discord モード Domain K: もういる人の行でほかの Bot を除くため、BOT_OTHER を Bot として引けるようにする。
        bots: [BOT_OTHER]
      },
      { id: OTHER_GUILD, name: "よそのサーバー", channels: [{ id: OTHER_GUILD_CHANNEL, name: "よその VC" }] }
    ]
  });
}

/**
 * 場の口の偽物（本物の耳の束・人の耳は偽物）。呼ばれた口を calls に、出来事の合図を events に積む。
 * @param {{ outletFactory?: boolean }} [p]
 */
function makeVenue(p = {}) {
  /** @type {string[]} */
  const calls = [];
  /** @type {any[]} */
  const events = [];
  /** @type {any[]} */
  const ears = [];
  /** @type {any[]} */
  const bundles = [];
  /** @type {any[]} */
  const outlets = [];
  const roles = [
    {
      id: () => "chappy",
      voice: {
        openOutlet: (/** @type {any} */ info) => {
          const outlet = {
            connection: info.connection,
            /** @type {any[]} */ disposals: [],
            /** @param {any} [options] */
            dispose(options) {
              outlet.disposals.push({ hold: !!options?.hold, destroyCount: info.connection.destroyCount });
            }
          };
          outlets.push(outlet);
          calls.push("outlet.open");
          return outlet;
        }
      }
    }
  ];
  const venue = {
    transcriptBuffer: { append: () => ({ appended: false }) },
    createEars: () => {
      calls.push("ears.create");
      const bundle = createEarBundle();
      bundles.push(bundle);
      return bundle;
    },
    createEar: (/** @type {any} */ spec) => {
      const ear = {
        spec,
        started: false,
        disposed: false,
        async start() {
          ear.started = true;
        },
        async dispose() {
          ear.disposed = true;
        }
      };
      ears.push(ear);
      return ear;
    },
    prepareEars: () => ({ ok: true, earPlan: { engine: "whisper" } }),
    stopEars: () => calls.push("stopEars"),
    pauseEars: () => calls.push("pauseEars"),
    earsListening: () => calls.push("earsListening"),
    earStarted: () => {},
    earFailed: () => {},
    hushVoice: () => calls.push("hushVoice"),
    vcEvent: (/** @type {any} */ event) => events.push(event),
    changed: () => {},
    roles: p.outletFactory === false ? [] : roles
  };
  return { venue, calls, events, ears, bundles, outlets };
}

const plan = Object.freeze({ token: FAKE_TOKEN, guildId: GUILD, channelId: CHANNEL, groupId: "chappy", earPlan: { engine: "whisper" } });

/** @param {any} fake @param {object} [extra] */
function makeExperience(fake, extra = {}) {
  /** @type {string[]} */
  const logs = [];
  /** @type {any[]} */
  const prepWrites = [];
  const discord = createDiscordExperience({
    settings: { getDiscordPrep: () => ({ guildId: GUILD, channelId: CHANNEL }), setDiscordPrep: (patch) => void prepWrites.push(patch) },
    loadToken: () => ({ ok: true, token: FAKE_TOKEN }),
    loadLibraries: fake.loadLibraries,
    log: (line) => logs.push(line),
    loginTimeoutMs: 2000,
    readyTimeoutMs: 2000,
    disconnectGraceMs: 30,
    ...extra
  });
  return { discord, logs, prepWrites };
}

/** 開いて、人 A に話させて耳を 1 本作る。 @param {object} [extra]  createDiscordExperience に足す値。 */
async function openWithSpeaker(extra = {}) {
  const fake = makeFake();
  const v = makeVenue();
  const x = makeExperience(fake, extra);
  const r = await x.discord.openEntrance(plan, v.venue);
  assert.equal(r.ok, true);
  fake.speak(USER_A);
  fake.send(USER_A, FAKE_SPEECH_PACKET);
  await waitUntil(() => v.ears.length === 1 && v.ears[0].started);
  return { fake, ...v, ...x };
}

/** @param {string} text @param {string} label */
function assertNoIds(text, label) {
  for (const word of ID_WORDS) assert.equal(text.includes(word), false, `${label} に ${word} が出ている`);
}

// ── 0. 語彙 ─────────────────────────────────────────────────────────────

test("Domain I 語彙: 接続の状態に「VC の外で待っている」（outside）を足した", () => {
  assert.deepEqual([...DISCORD_CONNECTION_STATES], ["joining", "joined", "disconnected", "outside"]);
});

// ── 1. 抜ける ───────────────────────────────────────────────────────────

test("Domain I 抜ける: 接続の分だけ畳む（人の耳を drop・出口を hold・connection を destroy）・耳の束と client は残す・聞いていない・切れたと出ない", async () => {
  const h = await openWithSpeaker();
  try {
    const first = /** @type {any} */ (h.fake.connection());
    assert.equal(h.discord.connectionStatus(), "joined");
    assert.equal(h.discord.voiceChannelName(), VC_1);
    /** @type {string[]} */
    const statuses = [];
    const changed = h.venue.changed;
    h.venue.changed = () => {
      statuses.push(String(h.discord.connectionStatus()));
      changed();
    };
    h.calls.length = 0;
    const r = await h.discord.vc.leave();
    assert.deepEqual(r, { ok: true });
    assert.equal(h.discord.connectionStatus(), "outside");
    assert.equal(h.discord.voiceChannelName(), null);
    assert.equal(h.discord.voiceConnection(), null);
    assert.equal(first.destroyCount, 1, "connection を destroy");
    assert.equal(h.ears[0].disposed, true, "人の耳は drop");
    assert.equal(h.bundles.length, 1);
    assert.equal(h.bundles[0].isDisposed(), false, "耳の束は畳まない（体験の間 1 つ）");
    assert.equal(h.bundles[0].size(), 0);
    assert.equal(h.fake.record.destroyedClients, 0, "client はログアウトしない");
    assert.deepEqual(h.outlets[0].disposals, [{ hold: true, destroyCount: 0 }], "出口は hold つきで、VC を抜ける前に畳む");
    assert.deepEqual(h.calls, ["hushVoice", "pauseEars"], "鳴っている返事を止め、耳は聞いていない（stopEars は呼ばない）");
    assert.equal(statuses.includes("disconnected"), false, "自分で抜けたときは「切れた」と出さない");
    assert.deepEqual(h.events.at(-1), { kind: "vc-leave", channelName: VC_1 });
    // もう一度抜けるは断る（どこにもいない）。
    assert.deepEqual(await h.discord.vc.leave(), { ok: false, code: "not-in-vc", reason: DISCORD_VC_REFUSALS.notInVc });
    assert.deepEqual(await h.discord.vc.move(CHANNEL_2), { ok: false, code: "not-in-vc", reason: DISCORD_VC_REFUSALS.notInVc });
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

test("Domain I 入り直す: 同じ client で新しい接続（使い回しの joinVoiceChannel にならない）・同じ耳の束・耳の番号は続き・聞いているに戻る・準備は書き換えない", async () => {
  const h = await openWithSpeaker();
  try {
    await h.discord.vc.leave();
    h.calls.length = 0;
    const r = await h.discord.vc.join(CHANNEL);
    assert.deepEqual(r, { ok: true });
    assert.equal(h.discord.connectionStatus(), "joined");
    assert.equal(h.fake.record.clients.length, 1, "ログインし直さない");
    assert.deepEqual(h.fake.record.logins, [FAKE_TOKEN]);
    assert.equal(h.fake.record.connections.length, 2, "新しい接続");
    assert.deepEqual(h.fake.record.reusedJoins, [], "前の接続は destroy 済み（ライブラリの使い回しにならない）");
    assert.equal(h.fake.record.joins[1].group, "chappy");
    assert.equal(h.discord.voiceConnection(), h.fake.connection());
    assert.deepEqual(h.calls, ["outlet.open", "earsListening"], "耳の束は作り直さない・出口は新しい接続に");
    assert.equal(h.outlets[1].connection, h.fake.connection());
    assert.deepEqual(h.events.at(-1), { kind: "vc-join", via: "panel", channelName: VC_1 });
    // 話せば新しい接続で購読し、同じ束に新しい番号の耳を足す。
    h.fake.speak(USER_A);
    await waitUntil(() => h.ears.length === 2 && h.ears[1].started);
    assert.equal(h.ears[1].spec.ears, h.bundles[0], "同じ耳の束");
    assert.equal(h.ears[1].spec.key, "discord-2", "番号は体験の間の続き");
    assert.equal(h.ears[1].spec.whisperPortOffset, 0);
    assert.equal(h.fake.record.subscribes.length, 2);
    // もう VC にいるのに入るは断る。
    assert.deepEqual(await h.discord.vc.join(CHANNEL_2), { ok: false, code: "in-vc", reason: DISCORD_VC_REFUSALS.inVc });
    assert.deepEqual(h.prepWrites, [], "準備の discordChannelId は書き換えない");
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

// ── 2. 移る ─────────────────────────────────────────────────────────────

test("Domain I 移る: 抜ける + 入る（destroy して入り直す）・前の VC の人の耳は drop・人の耳と出口は新しい接続に・今の VC を見る", async () => {
  const h = await openWithSpeaker();
  try {
    const first = /** @type {any} */ (h.fake.connection());
    h.calls.length = 0;
    const r = await h.discord.vc.move(CHANNEL_2);
    assert.deepEqual(r, { ok: true });
    const second = /** @type {any} */ (h.fake.connection());
    assert.notEqual(second, first);
    assert.equal(first.destroyCount, 1);
    assert.equal(second.joinConfig.channelId, CHANNEL_2);
    assert.deepEqual(h.fake.record.reusedJoins, []);
    assert.equal(h.ears[0].disposed, true, "前の VC の人の耳は drop");
    assert.deepEqual(h.outlets[0].disposals, [{ hold: true, destroyCount: 0 }]);
    assert.equal(h.outlets[1].connection, second, "出口は新しい接続に");
    assert.deepEqual(h.calls, ["hushVoice", "pauseEars", "outlet.open", "earsListening"]);
    assert.equal(h.discord.voiceChannelName(), VC_2);
    // Discord モード Domain K（J の持ち越し 2）: 移った合図のあとに、移った先にもういる人（ほかの Bot は除く）の合図。
    await waitUntil(() => h.events.some((e) => e.kind === "vc-people"));
    assert.deepEqual(h.events.slice(-2), [
      { kind: "vc-move", fromChannelName: VC_1, channelName: VC_2 },
      { kind: "vc-people", channelName: VC_2, names: [NAME_B], others: 0 }
    ]);
    // 人の耳は新しい接続の receiver から作る。
    h.fake.speak(USER_B);
    await waitUntil(() => h.ears.length === 2 && h.ears[1].started);
    assert.equal(h.fake.record.subscribes.at(-1)?.userId, USER_B);
    // 今いる VC（移った先）から抜けた人の耳を外す。前の VC（開いた時の VC）の出来事は見ない。
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: CHANNEL, to: null });
    await tick(10);
    assert.equal(h.ears[1].disposed, false, "前の VC の出来事は見ない");
    h.fake.voiceState({ userId: USER_B, guildId: GUILD, from: CHANNEL_2, to: null, name: NAME_B });
    await waitUntil(() => h.ears[1].disposed);
    assert.deepEqual(h.events.at(-1), { kind: "person-leave", channelName: VC_2, name: NAME_B });
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

test("Domain I 移る・入るの断り: 同じ VC・形の違う id・文字 / ステージのチャンネル・ほかのサーバーのチャンネル・無いチャンネル（使えなければ抜けない）", async () => {
  const h = await openWithSpeaker();
  try {
    const first = h.fake.connection();
    assert.deepEqual(await h.discord.vc.move(CHANNEL), { ok: false, code: "same", reason: DISCORD_VC_REFUSALS.same });
    assert.deepEqual(await h.discord.vc.move("a/b"), { ok: false, code: "shape", reason: DISCORD_VC_REFUSALS.channelId });
    assert.deepEqual(await h.discord.vc.move(12), { ok: false, code: "shape", reason: DISCORD_VC_REFUSALS.channelId });
    for (const id of [TEXT_CHANNEL, STAGE_CHANNEL, OTHER_GUILD_CHANNEL, "channel-fake-none"]) {
      assert.deepEqual(await h.discord.vc.move(id), { ok: false, code: "channel", reason: DISCORD_REASONS.channel }, id);
    }
    assert.equal(h.fake.connection(), first, "使えない VC へは移らない（抜けない）");
    assert.equal(/** @type {any} */ (first).destroyCount, 0);
    assert.equal(h.discord.connectionStatus(), "joined");
    await h.discord.vc.leave();
    for (const id of [TEXT_CHANNEL, OTHER_GUILD_CHANNEL]) {
      assert.deepEqual(await h.discord.vc.join(id), { ok: false, code: "channel", reason: DISCORD_REASONS.channel }, id);
    }
    assert.equal(h.discord.connectionStatus(), "outside");
    assert.equal(h.fake.record.connections.length, 1);
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

test("Domain I 移る先に入れない: 前の VC からは抜けたまま VC の外で待っている（理由つき）・閉じれば畳む", async () => {
  const fake = makeFake();
  const v = makeVenue();
  const x = makeExperience(fake, { readyTimeoutMs: 30 });
  assert.equal((await x.discord.openEntrance(plan, v.venue)).ok, true);
  // 次の接続は Ready にならない（時間切れ）。
  const origJoin = fake.libraries.voice.joinVoiceChannel;
  fake.libraries.voice.joinVoiceChannel = (/** @type {any} */ config) => {
    const c = origJoin(config);
    c.setStatus = () => {}; // Ready に進まない
    return c;
  };
  try {
    const r = await x.discord.vc.move(CHANNEL_2);
    assert.deepEqual(r, { ok: false, code: "join", reason: DISCORD_REASONS.join });
    assert.equal(x.discord.connectionStatus(), "outside");
    assert.equal(x.discord.voiceChannelName(), null);
    assert.deepEqual(v.events.at(-1), { kind: "vc-leave", channelName: VC_1 });
    assert.ok(v.calls.includes("pauseEars"));
  } finally {
    fake.libraries.voice.joinVoiceChannel = origJoin;
    await x.discord.closeEntrance({}, v.venue);
  }
  assert.equal(x.discord.connectionStatus(), null);
  assert.equal(fake.record.destroyedClients, 1);
});

test("Domain I 同時の操作: 入る・抜ける・移るの途中に来た操作は断る・場が開いていなければ断る", async () => {
  const fake = makeFake();
  const v = makeVenue();
  const x = makeExperience(fake);
  assert.deepEqual(await x.discord.vc.join(CHANNEL), { ok: false, code: "not-open", reason: DISCORD_VC_REFUSALS.notOpen });
  assert.equal((await x.discord.openEntrance(plan, v.venue)).ok, true);
  try {
    const moving = x.discord.vc.move(CHANNEL_2);
    assert.deepEqual(await x.discord.vc.leave(), { ok: false, code: "busy", reason: DISCORD_VC_REFUSALS.busy });
    assert.deepEqual(await moving, { ok: true });
  } finally {
    await x.discord.closeEntrance({}, v.venue);
  }
  assert.deepEqual(await x.discord.vc.leave(), { ok: false, code: "not-open", reason: DISCORD_VC_REFUSALS.notOpen });
});

// ── 3. 外から ───────────────────────────────────────────────────────────

test("Domain I 外から 4014: 猶予のあいだ「切れた」→ 戻らなければ VC の外で待っている（接続の分を畳む・耳は聞いていない・体験は閉じない）", async () => {
  const h = await openWithSpeaker();
  try {
    h.fake.kickBot({ voiceState: false });
    assert.equal(h.discord.connectionStatus(), "disconnected", "猶予のあいだは切れた");
    await waitUntil(() => h.discord.connectionStatus() === "outside");
    assert.equal(/** @type {any} */ (h.fake.connection()).destroyCount, 1);
    assert.equal(h.ears[0].disposed, true);
    assert.equal(h.bundles[0].isDisposed(), false);
    assert.equal(h.fake.record.destroyedClients, 0);
    assert.ok(h.calls.includes("pauseEars"));
    assert.deepEqual(h.outlets[0].disposals, [{ hold: true, destroyCount: 0 }]);
    assert.deepEqual(h.events.at(-1), { kind: "vc-kicked", channelName: VC_1 });
    assert.equal(h.events.some((e) => e.kind === "vc-disconnect"), false, "4014 は「切れた」の合図ではなく外へ");
    assert.ok(h.logs.includes("outside (4014)"));
    // 外で待ったあと入り直せる。
    assert.deepEqual(await h.discord.vc.join(CHANNEL_3), { ok: true });
    assert.equal(h.discord.voiceChannelName(), VC_3);
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

test("Domain I 外から: Bot 自身が今いる VC の外へ（キック）なら猶予を待たずに VC の外で待っている", async () => {
  // 猶予を長くしても（5 秒）、Bot 自身が VC の外へ出た知らせで、猶予を待たずに外へ。
  const h = await openWithSpeaker({ disconnectGraceMs: 5000 });
  try {
    h.fake.kickBot();
    await waitUntil(() => h.discord.connectionStatus() === "outside", 1000);
    assert.deepEqual(h.events.filter((e) => e.kind === "vc-kicked"), [{ kind: "vc-kicked", channelName: VC_1 }], "1 回だけ");
    assert.ok(h.logs.includes("outside (voice-state)"));
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

test("Domain I 外から 4014 でない切れ: 「切れた」のまま（つなぎ直しを待つ・接続を畳まない）・猶予のあと切れたの合図を 1 回・戻ればつながり直しの合図", async () => {
  const h = await openWithSpeaker();
  try {
    h.fake.setConnectionStatus("disconnected");
    h.fake.setConnectionStatus("signalling");
    await tick(60);
    assert.equal(h.discord.connectionStatus(), "disconnected");
    assert.equal(/** @type {any} */ (h.fake.connection()).destroyCount, 0, "Bot は自分で抜けない");
    assert.equal(h.ears[0].disposed, false);
    assert.deepEqual(h.events.filter((e) => e.kind === "vc-disconnect"), [{ kind: "vc-disconnect", channelName: VC_1 }]);
    h.fake.setConnectionStatus("ready");
    assert.equal(h.discord.connectionStatus(), "joined");
    assert.deepEqual(h.events.at(-1), { kind: "vc-reconnect", channelName: VC_1 });
    // 短い途切れ（猶予のうちに戻った）は合図を出さない。
    h.fake.setConnectionStatus("connecting");
    h.fake.setConnectionStatus("ready");
    await tick(60);
    assert.equal(h.events.filter((e) => e.kind === "vc-disconnect").length, 1);
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

for (const order of /** @type {const} */ (["voice-state-first", "4014-first"])) {
  test(`Domain I 外から 動かされた（${order}）: 動いた先を今の VC として追う・同じ接続のまま・前の VC の人の耳は drop・外へは落とさない`, async () => {
    const h = await openWithSpeaker();
    try {
      const conn = h.fake.connection();
      h.fake.moveBot(CHANNEL_2, { closeCode4014: true, closeFirst: order === "4014-first" });
      await waitUntil(() => h.discord.voiceChannelName() === VC_2);
      await tick(60); // 猶予が過ぎても外へ落ちない。
      assert.equal(h.discord.connectionStatus(), "joined");
      assert.equal(h.fake.connection(), conn, "同じ接続（ライブラリがつなぎ直す）");
      assert.equal(/** @type {any} */ (conn).destroyCount, 0);
      assert.equal(h.ears[0].disposed, true, "前の VC の人の耳は drop");
      assert.deepEqual(h.outlets[0].disposals, [], "出口は同じ接続のまま");
      assert.deepEqual(
        h.events.filter((e) => e.kind === "vc-moved"),
        [{ kind: "vc-moved", fromChannelName: VC_1, channelName: VC_2 }]
      );
      assert.equal(h.events.some((e) => e.kind === "vc-kicked" || e.kind === "vc-disconnect"), false);
      // 動いた先の人の出入りを見る（Bot は除く）。
      h.fake.voiceState({ userId: USER_A, guildId: GUILD, from: null, to: CHANNEL_2, name: NAME_A });
      h.fake.voiceState({ userId: BOT_OTHER, guildId: GUILD, from: CHANNEL_2, to: null, name: "ほかの Bot", bot: true });
      assert.deepEqual(h.events.filter((e) => e.kind.startsWith("person-")), [{ kind: "person-join", channelName: VC_2, name: NAME_A }]);
      h.fake.speak(USER_A);
      await waitUntil(() => h.ears.length === 2 && h.ears[1].started);
      h.fake.voiceState({ userId: USER_A, guildId: GUILD, from: CHANNEL_2, to: CHANNEL, name: NAME_A });
      await waitUntil(() => h.ears[1].disposed);
      // 自分で抜けるのは動いた先から。
      assert.deepEqual(await h.discord.vc.leave(), { ok: true });
      assert.deepEqual(h.events.at(-1), { kind: "vc-leave", channelName: VC_2 });
    } finally {
      await h.discord.closeEntrance({}, h.venue);
    }
  });
}

test("Domain I 外から 動かされた先で戻らない（4014 のまま）: 猶予のあと VC の外で待っている", async () => {
  const h = await openWithSpeaker();
  try {
    h.fake.moveBot(CHANNEL_2, { closeCode4014: true, recover: false, channelName: VC_2 });
    assert.equal(h.discord.voiceChannelName(), VC_2, "名前が手元にあればすぐ追う");
    await waitUntil(() => h.discord.connectionStatus() === "outside");
    assert.deepEqual(h.events.at(-1), { kind: "vc-kicked", channelName: VC_2 });
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

test("Domain I 自分で移ったあとに遅れて届く Bot 自身の知らせ（前の VC → 外）は、今の VC ではないので見ない", async () => {
  const h = await openWithSpeaker();
  try {
    await h.discord.vc.move(CHANNEL_2);
    h.fake.voiceState({ userId: "bot-fake-1", guildId: GUILD, from: CHANNEL, to: null });
    h.fake.voiceState({ userId: "bot-fake-1", guildId: GUILD, from: null, to: CHANNEL_2 });
    await tick(60);
    assert.equal(h.discord.connectionStatus(), "joined");
    assert.equal(h.discord.voiceChannelName(), VC_2);
    assert.equal(h.events.some((e) => e.kind === "vc-kicked" || e.kind === "vc-moved"), false);
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
});

// ── 4. 閉じる・一覧・守り ────────────────────────────────────────────────

test("Domain I 閉じる: VC にいない間でも冪等に畳む（差し口に残した出口を外す・耳の束・ログアウト）", async () => {
  const h = await openWithSpeaker();
  await h.discord.vc.leave();
  h.calls.length = 0;
  await h.discord.closeEntrance({ hadEars: true, shutdown: false }, h.venue);
  assert.deepEqual(h.outlets[0].disposals, [{ hold: true, destroyCount: 0 }, { hold: false, destroyCount: 1 }], "hold で残した口を外す");
  assert.equal(h.bundles[0].isDisposed(), true);
  assert.equal(h.fake.record.destroyedClients, 1);
  assert.deepEqual(h.calls, ["stopEars"]);
  assert.equal(h.discord.connectionStatus(), null);
  await h.discord.closeEntrance({ hadEars: false, shutdown: true }, h.venue);
  assert.equal(h.fake.record.destroyedClients, 1, "二重に畳まない");
});

test("Domain I 一覧（Domain K のための口）: 体験の client の guild から同じサーバーの VC だけ（人数は Bot 自身を除く・今いる VC の印）・2 本目のログインはしない", async () => {
  const h = await openWithSpeaker();
  try {
    const listed = await h.discord.vc.list();
    assert.deepEqual(listed, {
      ok: true,
      channels: [
        { id: CHANNEL, name: VC_1, people: 0, current: true },
        { id: CHANNEL_2, name: VC_2, people: 2, current: false },
        { id: CHANNEL_3, name: VC_3, people: 0, current: false }
      ],
      // Discord モード Domain K: パネルのサーバー名（体験の client の guild の名前）。
      guildName: "試しのサーバー"
    });
    assert.equal(h.fake.record.clients.length, 1, "ログインし直さない");
    h.fake.voiceState({ userId: USER_A, guildId: GUILD, from: null, to: CHANNEL });
    await h.discord.vc.leave();
    const after = /** @type {any} */ (await h.discord.vc.list());
    assert.deepEqual(after.channels.map((/** @type {any} */ c) => [c.people, c.current]), [[1, false], [2, false], [0, false]]);
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
  assert.deepEqual(await h.discord.vc.list(), { ok: false, code: "not-open", reason: DISCORD_VC_REFUSALS.notOpen });
});

test("Domain I 守り: ログに VC の名前・人の名前・Discord の id が出ない・合図に id を載せない", async () => {
  const h = await openWithSpeaker();
  try {
    await h.discord.vc.move(CHANNEL_2);
    // Discord モード Domain K: 移った先にもういる人の合図（名前は合図の中だけ・id は載せない）を待ってから続ける。
    await waitUntil(() => h.events.some((e) => e.kind === "vc-people"));
    h.fake.voiceState({ userId: USER_A, guildId: GUILD, from: null, to: CHANNEL_2, name: NAME_A });
    h.fake.moveBot(CHANNEL_3, { closeCode4014: true });
    await waitUntil(() => h.discord.voiceChannelName() === VC_3);
    await h.discord.vc.leave();
    await h.discord.vc.join(CHANNEL);
    h.fake.kickBot();
    await waitUntil(() => h.discord.connectionStatus() === "outside");
  } finally {
    await h.discord.closeEntrance({}, h.venue);
  }
  const logText = h.logs.join("\n");
  assertNoIds(logText, "ログ");
  for (const name of [VC_1, VC_2, VC_3, NAME_A, NAME_B]) assert.equal(logText.includes(name), false, `ログに ${name}`);
  assertNoIds(JSON.stringify(h.events), "合図");
  assert.deepEqual(
    h.events.map((e) => e.kind),
    ["vc-join", "vc-move", "vc-people", "person-join", "vc-moved", "vc-leave", "vc-join", "vc-kicked"]
  );
});
