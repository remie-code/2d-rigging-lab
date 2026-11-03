// @ts-check
/**
 * Discord モード 全体の突き合わせ（2 回目）§3-1 の直し（discord-mode.md §13.2・§13.3）:
 *  抜ける（leaveVoice）・外から切られる（goOutside）の foldLink が人の耳の畳みを待っている間に、場を閉じる（closeEntrance → teardown）が
 *  走っても、差し口に「VC にいない」の口（HELD_VENUE_PLAYER）を残さない。残すと同じ起動の次の配信の場で声が出ない。
 *  - 本物の cockpit-server + Discord の体験の口 + 偽の Discord + 本物の差し口（createVenuePlayerSlot）。人の耳の dispose を 80ms 遅らせて
 *    重ねる（突き合わせの再現と同じ形）。
 *  - 閉じたあとの差し口は空。同じ起動で配信の場を開くと、再生器を起こす段で差し口は空（= 手元の再生器を使う）。
 * 本物の Discord・鍵・実データには触れない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createVenuePlayerSlot, createVenueRoleBundle, HELD_VENUE_PLAYER } from "./cockpit.mjs";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { createDiscordExperience } from "../src/discord/discord-experience.mjs";
import { createDiscordStreamPlayer } from "../src/discord/discord-stream-player.mjs";
import { createFakeDiscord } from "../src/test-support/fake-discord.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";

const GUILD = "guild-fake-1";
const CHANNEL = "channel-fake-1";
const USER_A = "user-fake-a";
const EAR_DISPOSE_DELAY_MS = 80;

const sleep = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {string} url @param {string} p @param {unknown} [body] */
async function post(url, p, body = {}) {
  const r = await fetch(`${url}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

async function startVenue() {
  const dir = mkdtempSync(path.join(tmpdir(), "discord-final-2-cockpit-"));
  const settings = createFileSettingsStore({ path: path.join(dir, "cockpit-settings.local.json") });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
  const fake = createFakeDiscord({
    guilds: [{ id: GUILD, name: "試し", channels: [{ id: CHANNEL, name: "一般" }], members: { [USER_A]: "たろう" } }]
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
    loadToken: () => ({ ok: true, token: "fake.discord-token_for-cockpit-final-2" }),
    loadLibraries: fake.loadLibraries,
    loginTimeoutMs: 500,
    readyTimeoutMs: 500,
    disconnectGraceMs: 30
  });
  const ears = { delayMs: 0, made: 0, started: 0 };
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ ((/** @type {any} */ options) => {
      ears.made += 1;
      let disposed = false;
      return {
        transcriptBuffer: options.transcriptBuffer,
        async start() {
          ears.started += 1;
        },
        async dispose() {
          // 耳の畳みに本物の待ち（I/O）が入った場合の形。
          if (ears.delayMs > 0) await sleep(ears.delayMs);
          disposed = true;
        },
        isDisposed: () => disposed,
        streamMs: () => 0,
        stats: () => ({})
      };
    }),
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
    ears,
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

/**
 * Discord の場を開き、人の耳を 1 本起こしてから、耳の dispose を遅らせる。
 * @param {Awaited<ReturnType<typeof startVenue>>} h
 */
async function openWithSpeaker(h) {
  const r = await post(h.url, "/api/stream/start", { experience: "discord" });
  assert.equal(r.status, 200, JSON.stringify(r.json.error));
  assert.deepEqual(h.resources, ["discord"]);
  h.fake.speak(USER_A);
  for (let k = 0; k < 100 && h.ears.started < 1; k += 1) await sleep(5);
  assert.equal(h.ears.started, 1, "人の耳が 1 本起きた");
  h.ears.delayMs = EAR_DISPOSE_DELAY_MS;
}

/**
 * 閉じたあと: 差し口は空。同じ起動で配信の場を開くと、再生器を起こす段で差し口は空（= 手元の再生器）。
 * @param {Awaited<ReturnType<typeof startVenue>>} h
 */
async function assertNextStreamUsesLocalPlayer(h) {
  // 遅れた耳の畳みが終わるのを待つ（foldLink の残りが走り切ったあと）。
  await sleep(EAR_DISPOSE_DELAY_MS * 2);
  assert.notEqual(h.slot.current(), HELD_VENUE_PLAYER, "「VC にいない」の口を残さない");
  assert.equal(h.slot.current(), null, "閉じたら差し口は空");
  h.ears.delayMs = 0;
  const r = await post(h.url, "/api/stream/start", { device: "Mic", experience: "stream" });
  assert.equal(r.status, 200, JSON.stringify(r.json.error));
  assert.equal(r.json.stream.experience, "stream");
  assert.equal(h.resources.at(-1), "local", "配信の場の再生器を起こす段で差し口は空（手元の再生器を起こす）");
  assert.equal(h.slot.current(), null, "配信の間も差し口は空（activePlayer は手元の再生器を返す）");
  assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
}

test("final-2 §3-1 抜けるの途中に通話を終える: 人の耳の畳みを待つ間に閉じても、差し口に「VC にいない」の口を残さない・次の配信は手元の再生器", async () => {
  const h = await startVenue();
  try {
    await openWithSpeaker(h);
    const leaving = post(h.url, "/api/discord/vc", { action: "leave" });
    await sleep(10);
    const stopped = await post(h.url, "/api/stream/stop");
    assert.equal(stopped.status, 200);
    await leaving;
    await assertNextStreamUsesLocalPlayer(h);
  } finally {
    await h.cleanup();
  }
});

test("final-2 §3-1 外から切られたの途中に通話を終える: 人の耳の畳みを待つ間に閉じても、差し口に「VC にいない」の口を残さない・次の配信は手元の再生器", async () => {
  const h = await startVenue();
  try {
    await openWithSpeaker(h);
    h.fake.kickBot();
    await sleep(50);
    const stopped = await post(h.url, "/api/stream/stop");
    assert.equal(stopped.status, 200);
    await assertNextStreamUsesLocalPlayer(h);
  } finally {
    await h.cleanup();
  }
});

test("final-2 §3-1 重ならないとき（抜けてから閉じる）は今のまま: 抜けたら「VC にいない」の口・閉じたら空・次の配信は手元の再生器", async () => {
  const h = await startVenue();
  try {
    await openWithSpeaker(h);
    assert.equal((await post(h.url, "/api/discord/vc", { action: "leave" })).status, 200);
    assert.equal(h.slot.current(), HELD_VENUE_PLAYER, "抜けたら「VC にいない」の口（手元に戻さない）");
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    await assertNextStreamUsesLocalPlayer(h);
  } finally {
    await h.cleanup();
  }
});
