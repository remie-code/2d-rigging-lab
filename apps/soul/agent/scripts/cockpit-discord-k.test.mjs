// @ts-check
/**
 * Discord モード Domain K: cockpit.mjs 側の 2 つ（discord-mode.md §13.4・計画 §8 の Domain J の行の Undine の判断 (1)）。
 *  1. 保存するかの数え方から出来事の行を除く（countSpokenEntries）: 出来事の行だけ（誰も話していない）の通話では最後の保存・
 *     途中保存を走らせない。人の行が 1 つでもあれば走り、②に渡す中身には出来事の行が載ったまま。出来事の行が増えただけでは
 *     途中保存を頼み直さない。配信（出来事の行が無い）の数えは今と同じ。
 *  2. 見る窓を場の途中で替えたら、次の発火から新しい窓を撮る（本物の server・本物の Discord の体験の口・偽の Discord・本物の
 *     発火の係〔fire-orchestrator〕と偽の撮る係）。窓を選ばずに開いた場で窓を選べば目を起こし、「使わない」にすれば止める。
 * 置き場は OS の一時フォルダだけ。実データ・本物の Discord・LLM には触れない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { countSpokenEntries, createMemoryRecorder, createStreamVenueHooks, createVenueVisionTarget } from "./cockpit.mjs";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { createDiscordExperience } from "../src/discord/discord-experience.mjs";
import { createFakeDiscord } from "../src/test-support/fake-discord.mjs";
import { EVENT_SPEAKER } from "../src/ears/transcript-buffer.mjs";
import { createFireOrchestrator } from "../src/mind/fire-orchestrator.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";

const TWENTY_MIN = 20 * 60_000;

/** 出来事の行。 @param {string} text */
const eventEntry = (text) => ({ startMs: 0, endMs: 0, text, speaker: EVENT_SPEAKER });
/** 人の行。 @param {string} text */
const youEntry = (text) => ({ startMs: 0, endMs: 900, text, speaker: "you", displayName: "たろう" });

// ── 1. 保存するかの数え方から出来事の行を除く ─────────────────────────────────────────

test("countSpokenEntries: 出来事の行を除いた件数（配信の行は全部数える・配列でなければ 0）", () => {
  assert.equal(countSpokenEntries([]), 0);
  assert.equal(countSpokenEntries([eventEntry("チャッピーが VC「一般」に入った"), eventEntry("VC「一般」にははなこがいる")]), 0);
  assert.equal(countSpokenEntries([eventEntry("入った"), youEntry("こんばんは"), { text: "やあ", speaker: "soul" }]), 2);
  assert.equal(countSpokenEntries([{ text: "配信者の行" }, { text: "コメント", speaker: "viewer" }]), 2, "配信の行（speaker の無い you・viewer）");
  assert.equal(countSpokenEntries(/** @type {any} */ (null)), 0);
});

/**
 * 場の口（本物の createStreamVenueHooks + 本物の保存の係）。②の書き出しは偽物（材料を written に残す）。
 */
function makeVenue() {
  /** @type {any[][]} */
  const written = [];
  /** @type {any[]} */
  let entries = [];
  let open = false;
  let clock = Date.UTC(2026, 10, 1, 3, 0, 0);
  const place = { ready: Promise.resolve(), streamNo: 1 };
  /** @type {any} */
  let venue = null;
  const recorder = createMemoryRecorder({
    getLiveEntries: () => entries,
    getPlace: () => place,
    writeImpl: async (/** @type {ReadonlyArray<any>} */ material) => {
      written.push(material.map((e) => e.text));
      return { written: true };
    },
    onSaved: (info) => venue.noteSaved(info),
    nowImpl: () => clock
  });
  venue = createStreamVenueHooks({
    memoryPlaces: { beginStream: () => {}, place: () => place, streamNo: () => 1 },
    memoryRecorder: recorder,
    openSession: () => {},
    closeSession: () => {},
    hasBody: () => false,
    channel: { getUrl: () => null, connect: async () => {}, close: async () => {} },
    isStreamOpen: () => open,
    getEntries: () => entries,
    nowImpl: () => clock,
    // 最後の保存を待つ上限のタイマ（既定 90 秒）でテストの終わりを待たせない。
    memoryTimeoutMs: 200
  });
  return {
    venue,
    recorder,
    written,
    /** @param {any[]} next */
    setEntries(next) {
      entries = next;
    },
    async openVenue() {
      open = true;
      await venue.hooks.renewRecords();
    },
    /** @param {number} ms */
    advance(ms) {
      clock += ms;
    }
  };
}

test("Domain K 保存: 出来事の行だけの通話（誰も話していない）では途中保存も最後の保存も走らない", async () => {
  const v = makeVenue();
  await v.openVenue();
  const onlyEvents = [eventEntry("チャッピーが VC「一般」に入った"), eventEntry("はなこが入ってきた"), eventEntry("はなこが出ていった")];
  v.setEntries(onlyEvents);
  v.advance(TWENTY_MIN);
  assert.equal(v.venue.checkpoint(), false, "20 分たっても出来事の行だけなら頼まない");
  v.advance(TWENTY_MIN);
  assert.equal(v.venue.checkpoint(), false);
  await v.venue.hooks.saveFinal(onlyEvents);
  await v.recorder.whenIdle();
  assert.deepEqual(v.written, [], "②は 1 回も走らない");
  assert.equal(v.venue.lastRecordAtMs(), null);
});

test("Domain K 保存: 人の行が 1 つでもあれば途中保存・最後の保存が走り、②の中身には出来事の行が載ったまま", async () => {
  const v = makeVenue();
  await v.openVenue();
  const first = [eventEntry("チャッピーが VC「一般」に入った"), youEntry("こんばんは"), eventEntry("はなこが入ってきた")];
  v.setEntries(first);
  v.advance(TWENTY_MIN);
  assert.equal(v.venue.checkpoint(), true, "人の行があれば頼む");
  await v.recorder.whenIdle();
  assert.deepEqual(v.written, [["チャッピーが VC「一般」に入った", "こんばんは", "はなこが入ってきた"]], "中身には出来事の行が載る");
  assert.equal(v.venue.lastRecordedSeq(), 1, "数えは人の行だけ");
  // 出来事の行が増えただけでは頼み直さない（20 分たっても）。
  const moreEvents = [...first, eventEntry("はなこが出ていった"), eventEntry("チャッピーが VC「一般」から抜けた")];
  v.setEntries(moreEvents);
  v.advance(TWENTY_MIN);
  assert.equal(v.venue.checkpoint(), false, "出来事の行が増えただけでは頼まない");
  // 最後の保存も同じ（人の行が増えていなければ頼まない）。
  await v.venue.hooks.saveFinal(moreEvents);
  await v.recorder.whenIdle();
  assert.equal(v.written.length, 1, "最後の保存も走らない");
  // 人の行が増えれば走る（中身は出来事の行も全部）。
  const withSpeech = [...moreEvents, youEntry("また来たよ")];
  await v.venue.hooks.saveFinal(withSpeech);
  await v.recorder.whenIdle();
  assert.equal(v.written.length, 2);
  assert.deepEqual(v.written[1], withSpeech.map((e) => e.text));
  assert.equal(v.venue.lastRecordedSeq(), 2);
});

test("Domain K 保存（配信は変わらない）: 出来事の行の無い転写は件数そのもので数える（増えれば保存・同じなら飛ばす）", async () => {
  const v = makeVenue();
  await v.openVenue();
  const two = [{ startMs: 0, endMs: 1, text: "配信者 A" }, { startMs: 0, endMs: 1, text: "コメント", speaker: "viewer" }];
  v.setEntries(two);
  v.advance(TWENTY_MIN);
  assert.equal(v.venue.checkpoint(), true);
  await v.recorder.whenIdle();
  assert.equal(v.venue.lastRecordedSeq(), 2, "配信の数え = 件数");
  await v.venue.hooks.saveFinal(two);
  await v.recorder.whenIdle();
  assert.equal(v.written.length, 1, "同じ件数なら最後の保存は飛ばす（今まで通り）");
  const three = [...two, { startMs: 0, endMs: 1, text: "配信者 B" }];
  await v.venue.hooks.saveFinal(three);
  await v.recorder.whenIdle();
  assert.deepEqual(v.written, [["配信者 A", "コメント"], ["配信者 A", "コメント", "配信者 B"]]);
});

test("createMemoryRecorder: onSaved に spokenLength（出来事の行を除いた件数）を渡す（entriesLength は件数のまま）", async () => {
  /** @type {any[]} */
  const saved = [];
  const recorder = createMemoryRecorder({
    getLiveEntries: () => [],
    writeImpl: async () => ({ written: true }),
    onSaved: (info) => saved.push(info),
    nowImpl: () => 7
  });
  await recorder.record([eventEntry("入った"), youEntry("やあ"), eventEntry("VC「一般」にはたろうがいる")]);
  assert.deepEqual(saved, [{ atMs: 7, entriesLength: 3, spokenLength: 1, commit: undefined }]);
});

// ── 2. 見る窓を場の途中で替える → 次の発火から新しい窓 ─────────────────────────────────

const GUILD = "guild-fake-k1";
const CHANNEL = "channel-fake-k1";
const FAKE_TOKEN = "fake.discord-token_for-domain-k";
const WINDOW_A = "偽のゲームの窓";
const WINDOW_B = "偽の資料の窓";
const STREAM_WINDOW = "配信の偽の窓";

/** @param {string} url @param {string} path @param {unknown} [body] */
async function post(url, path, body = {}) {
  const r = await fetch(`${url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

/** 偽の耳（Discord の人ごとの耳）。 */
function fakeEarFactory() {
  return (/** @type {any} */ options) => ({
    transcriptBuffer: options.transcriptBuffer,
    async start() {},
    async dispose() {},
    isDisposed: () => false,
    streamMs: () => 0,
    stats: () => ({})
  });
}

/**
 * 本物の server + 本物の Discord の体験の口 + 偽の Discord + 本物の発火の係（頭・声・器・撮る係は偽物）。
 * @param {{ visionTarget: string | null }} p
 */
async function startVisionServer(p) {
  const dir = mkdtempSync(join(tmpdir(), "discord-k-vision-"));
  const settings = createFileSettingsStore({ path: join(dir, "cockpit-settings.local.json") });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
  if (p.visionTarget) settings.setDiscordVisionTarget(p.visionTarget);
  settings.setVisionTarget(STREAM_WINDOW);
  const fake = createFakeDiscord({ guilds: [{ id: GUILD, name: "試しのサーバー", channels: [{ id: CHANNEL, name: "一般" }], members: {} }] });
  const discord = createDiscordExperience({
    settings,
    currentKeyFile: () => ".env.discord-chappy.local",
    loadToken: () => ({ ok: true, token: FAKE_TOKEN }),
    loadLibraries: fake.loadLibraries,
    log: () => {},
    loginTimeoutMs: 500,
    readyTimeoutMs: 500
  });
  /** @type {string[]} */
  const captures = [];
  /** @type {string[]} */
  const eyes = [];
  /** @type {any} */
  let server = null;
  // cockpit.mjs の main と同じ見る窓の選び方（発火のたびに読む）。
  const getVisionTarget = createVenueVisionTarget({
    stream: () => settings.getVisionTarget(),
    discord: () => settings.getDiscordVisionTarget(),
    experience: () => server?.venueContext()?.experience ?? null
  });
  server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakeEarFactory()),
    fireOrchestratorFactory: /** @type {any} */ (
      (/** @type {any} */ hooks) =>
        createFireOrchestrator({
          ...hooks,
          session: { ask: async () => ({ replyText: "見えたよ", usage: { input_tokens: 10 } }) },
          speakImpl: async () => ({ timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "C:/tmp/fake-k.wav" }),
          channel: { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) },
          player: { play() {} },
          getVisionTarget,
          captureImpl: async (/** @type {string} */ title) => {
            captures.push(title);
            return { jpegBase64: "ZmFrZQ==", width: 8, height: 6, elapsedMs: 1 };
          }
        })
    ),
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
    selfFireInitialEnabled: false,
    onEyesStart: () => void eyes.push("start"),
    onEyesStop: () => void eyes.push("stop"),
    onSetVisionTarget: (/** @type {string | null} */ title) => settings.setVisionTarget(title),
    visionTargetStatus: () => ({ title: settings.getVisionTarget() })
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    settings,
    captures,
    eyes,
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

test("Domain K 見る窓: Discord の場の途中で選び直したら、次の発火（Fire+視覚）から新しい窓を撮る・「使わない」なら撮らない", async () => {
  const h = await startVisionServer({ visionTarget: WINDOW_A });
  try {
    const opened = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(opened.status, 200, JSON.stringify(opened.json.error));
    assert.equal(opened.json.stream.connection, "joined");
    assert.deepEqual(h.eyes, ["start"], "窓を選んで開いたので目を起こした");
    const first = await post(h.url, "/api/vision-fire");
    assert.equal(first.json.fired, true, JSON.stringify(first.json));
    assert.deepEqual(h.captures, [WINDOW_A]);
    // 場の途中で選び直す（G の 409 を外した）→ 次の発火から新しい窓。
    const changed = await post(h.url, "/api/discord/vision-target", { title: WINDOW_B });
    assert.equal(changed.status, 200);
    assert.deepEqual(changed.json, { visionTarget: { title: WINDOW_B } });
    const second = await post(h.url, "/api/vision-fire");
    assert.equal(second.json.fired, true, JSON.stringify(second.json));
    assert.deepEqual(h.captures, [WINDOW_A, WINDOW_B], "開いたときの窓のままにならない");
    assert.deepEqual(h.eyes, ["start", "start"], "目はもう起きている（起こす口は冪等）");
    // 「使わない」: 目を止め、Fire+視覚は撮らずに断る（見る窓が無い）。配信の見る窓は撮らない。
    assert.equal((await post(h.url, "/api/discord/vision-target", { title: null })).status, 200);
    assert.deepEqual(h.eyes, ["start", "start", "stop"]);
    const third = await post(h.url, "/api/vision-fire");
    assert.equal(third.json.fired, false);
    assert.deepEqual(h.captures, [WINDOW_A, WINDOW_B], "撮らない（配信の窓も撮らない）");
    assert.equal(h.settings.getVisionTarget(), STREAM_WINDOW, "配信の見る窓は書き換えない");
  } finally {
    await h.cleanup();
  }
});

test("Domain K 見る窓: 窓を選ばずに開いた Discord の場で、途中で窓を選べば目を起こしてその窓を撮る", async () => {
  const h = await startVisionServer({ visionTarget: null });
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    assert.deepEqual(h.eyes, [], "選んでいなければ起こさない（G のまま）");
    const none = await post(h.url, "/api/vision-fire");
    assert.equal(none.json.fired, false);
    assert.deepEqual(h.captures, []);
    assert.equal((await post(h.url, "/api/discord/vision-target", { title: WINDOW_B })).status, 200);
    assert.deepEqual(h.eyes, ["start"], "途中で選んだら目を起こす");
    const fired = await post(h.url, "/api/vision-fire");
    assert.equal(fired.json.fired, true, JSON.stringify(fired.json));
    assert.deepEqual(h.captures, [WINDOW_B]);
    await post(h.url, "/api/stream/stop");
    assert.equal(h.eyes.at(-1), "stop", "閉じる段で目を止める（今まで通り）");
    // 閉じている間の選び直しは目を触らない（開く段が保存した窓を読む）。
    const before = h.eyes.length;
    assert.equal((await post(h.url, "/api/discord/vision-target", { title: WINDOW_A })).status, 200);
    assert.equal(h.eyes.length, before);
  } finally {
    await h.cleanup();
  }
});
