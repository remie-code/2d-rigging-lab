// @ts-check
/**
 * Discord モード Domain G: 画面の表示導出（view-logic/discord.mjs と、体験で文言を替える glance-meters / glance-timeline）。
 * 配信の見え方が変わらないこと（配信の場・体験を持たない古いサーバ）も同じ表で確かめる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DISCORD_CONNECTION_LABELS,
  DISCORD_JOIN_TEXT,
  DISCORD_JOINING_TEXT,
  DISCORD_LEAVING_TEXT,
  DISCORD_NO_VISION_LABEL,
  DISCORD_NOT_CHOSEN_LABEL,
  DISCORD_PARTICIPANT_LABEL,
  DISCORD_SAVED_CHANNEL_LABEL,
  DISCORD_SAVED_GUILD_LABEL,
  DISCORD_SPEAK_START_FIXED_NOTE,
  DISCORD_CHAT_HIDDEN_NOTE,
  discordAvailable,
  discordCatalogErrorText,
  discordChannelOptions,
  discordGuildOptions,
  discordJoinView,
  discordPrepPostErrorText,
  discordVisionLabel,
  discordVisionOptions,
  isDiscordVenue,
  venueConnectionView,
  youLabelFor
} from "./discord.mjs";
import { driveSummaryView, endStreamButtonView, streamStartView, SPEAK_START_FIXED_SUFFIX } from "./glance-meters.mjs";
import { STREAMER_LABEL, conversationRowsView, emptyGlance, glanceAfterSseEvent, glanceFromHistory } from "./glance-timeline.mjs";
import { speakerLabel } from "./transcript.mjs";
import {
  DISCORD_SPEAK_START_FIXED_MESSAGE,
  DISCORD_CHAT_CONNECT_REFUSED_MESSAGE,
  VENUE_CONNECTION_STATES
} from "../cockpit-server.mjs";

const GUILD = "guild-fake-v1";
const CHANNEL = "channel-fake-v1";
const CATALOG = {
  guilds: [
    { id: GUILD, name: "試しのサーバー", channels: [{ id: CHANNEL, name: "一般" }, { id: "channel-fake-v2", name: "雑談" }] },
    { id: "guild-fake-v2", name: "別のサーバー", channels: [] }
  ]
};

// ── 1. 体験は場を開くときに選ぶ（「Discord の VC に入る」）──────────────────────────────

test("discordJoinView: 入口があれば閉じている間は押せる「Discord の VC に入る」・Discord の開きかけ / 閉じかけは体験の語・配信の場の間は押せない・入口が無ければ出さない", () => {
  assert.deepEqual(discordJoinView({ phase: "closed", experience: null }, true), { show: true, text: DISCORD_JOIN_TEXT, disabled: false });
  assert.deepEqual(discordJoinView(null, true), { show: true, text: DISCORD_JOIN_TEXT, disabled: false }, "stream の無い古いサーバ");
  assert.deepEqual(discordJoinView({ phase: "opening", experience: "discord" }, true), { show: true, text: DISCORD_JOINING_TEXT, disabled: true });
  assert.deepEqual(discordJoinView({ phase: "closing", experience: "discord" }, true), { show: true, text: DISCORD_LEAVING_TEXT, disabled: true });
  assert.deepEqual(discordJoinView({ phase: "opening", experience: "stream" }, true), { show: true, text: DISCORD_JOIN_TEXT, disabled: true });
  assert.deepEqual(discordJoinView({ phase: "open", experience: "stream" }, true), { show: true, text: DISCORD_JOIN_TEXT, disabled: true });
  assert.equal(discordJoinView({ phase: "closed" }, false).show, false, "入口が無ければ出さない（今の配信の画面のまま）");
  assert.equal(discordAvailable({ available: true }), true);
  for (const v of [null, undefined, {}, { available: false }, "x"]) assert.equal(discordAvailable(v), false, String(v));
});

test("streamStartView: Discord の場の開きかけ / 閉じかけは「配信を始める」を押せないまま（途中の文言は Discord の側）・配信の場は今まで通り", () => {
  assert.deepEqual(streamStartView({ phase: "opening", experience: "discord" }), {
    phase: "opening",
    startText: "配信を始める",
    startDisabled: true,
    noteText: "",
    errorText: ""
  });
  assert.deepEqual(streamStartView({ phase: "closing", experience: "discord" }), {
    phase: "closing",
    startText: "配信を始める",
    startDisabled: true,
    noteText: "記録中…",
    errorText: ""
  });
  // 配信（experience "stream"・体験を持たない古いサーバ）は今まで通り。
  for (const extra of [{ experience: "stream" }, {}]) {
    assert.equal(streamStartView({ phase: "opening", ...extra }).startText, "配信を始めています…");
    assert.equal(streamStartView({ phase: "closing", ...extra }).startText, "配信を終えています…");
    assert.equal(streamStartView({ phase: "closed", ...extra }).startText, "配信を始める");
  }
  // 入れなかった理由（stream.error）は閉じたあとに出る（体験に依らない）。
  assert.equal(streamStartView({ phase: "closed", error: "VC に入れない（時間切れ・権限・満員など）", experience: null }).errorText, "VC に入れない（時間切れ・権限・満員など）");
});

// ── 2. 入る / 抜ける（下の帯）───────────────────────────────────────────────────

test("endStreamButtonView: Discord の場の間は同じ置き場に「通話を終える」（2 回押し・Domain K で「VC から抜ける」から改めた）・配信は「配信を終える」のまま", () => {
  assert.deepEqual(endStreamButtonView({ phase: "open", experience: "discord" }, false), { show: true, text: "通話を終える", className: "stream-end" });
  assert.deepEqual(endStreamButtonView({ phase: "open", experience: "discord" }, true), {
    show: true,
    text: "もう一度押すと通話を終える",
    className: "stream-end armed"
  });
  for (const phase of ["closed", "opening", "closing"]) assert.equal(endStreamButtonView({ phase, experience: "discord" }, false).show, false, phase);
  assert.deepEqual(endStreamButtonView({ phase: "open", experience: "stream" }, false), { show: true, text: "配信を終える", className: "stream-end" });
  assert.deepEqual(endStreamButtonView({ phase: "open", experience: "stream" }, true), {
    show: true,
    text: "もう一度押すと配信を終える",
    className: "stream-end armed"
  });
});

// ── 3. 接続の状態 ─────────────────────────────────────────────────────────────

test("venueConnectionView: Discord の場の間だけ、入っている途中・入っている・切れたを名指しで（配信・閉じている・知らない値は出さない）", () => {
  assert.deepEqual([...VENUE_CONNECTION_STATES].sort(), Object.keys(DISCORD_CONNECTION_LABELS).sort(), "サーバの語彙と同じ");
  assert.deepEqual(venueConnectionView({ experience: "discord", connection: "joining" }), {
    text: "VC に入っている途中",
    className: "venue-connection joining",
    title: "VC に入っている途中"
  });
  assert.equal(venueConnectionView({ experience: "discord", connection: "joined" })?.text, "VC に入っている");
  const cut = venueConnectionView({ experience: "discord", connection: "disconnected" });
  assert.equal(cut?.text, "VC から切れた（つなぎ直しを待っている）");
  assert.equal(cut?.className, "venue-connection disconnected");
  assert.equal(venueConnectionView({ experience: "discord", connection: null }), null);
  assert.equal(venueConnectionView({ experience: "discord", connection: "weird" }), null);
  assert.equal(venueConnectionView({ experience: "stream", connection: "joined" }), null);
  assert.equal(venueConnectionView(null), null);
  assert.equal(isDiscordVenue({ experience: "discord" }), true);
  assert.equal(isDiscordVenue({ experience: "stream" }), false);
  assert.equal(isDiscordVenue(null), false);
});

// ── 4. 会話の行のあなたの名前 ─────────────────────────────────────────────────

test("会話の行: Discord の場では you の行を Discord の名前（無ければ「参加者」）で出す・配信は「配信者」のまま（名前が載っていても）", () => {
  let g = emptyGlance();
  g = glanceAfterSseEvent(g, "transcript", { seq: 1, speaker: "you", displayName: "たろう", text: "こんにちは", appendedAtMs: 1 }, 1);
  g = glanceAfterSseEvent(g, "transcript", { seq: 2, speaker: "you", text: "名前の取れなかった人", appendedAtMs: 2 }, 2);
  g = glanceAfterSseEvent(g, "transcript", { seq: 3, speaker: "soul", text: "やあ", appendedAtMs: 3 }, 3);
  const discord = conversationRowsView(g, { soulName: "チャッピー", experience: "discord" });
  assert.deepEqual(discord.map((r) => r.whoText), ["たろう", DISCORD_PARTICIPANT_LABEL, "チャッピー"]);
  for (const experience of ["stream", null, undefined]) {
    const stream = conversationRowsView(g, { soulName: "チャッピー", experience });
    assert.deepEqual(stream.map((r) => r.whoText), [STREAMER_LABEL, STREAMER_LABEL, "チャッピー"], String(experience));
  }
  assert.deepEqual(conversationRowsView(g, { soulName: "チャッピー" }).map((r) => r.whoText), [STREAMER_LABEL, STREAMER_LABEL, "チャッピー"], "既定は配信");
  // 開き直し（snapshot の履歴）でも名前を持つ。
  const restored = glanceFromHistory([{ seq: 1, speaker: "you", displayName: "はなこ", text: "x", appendedAtMs: 1 }], 1);
  assert.equal(conversationRowsView(restored, { experience: "discord" })[0].whoText, "はなこ");
  assert.equal(youLabelFor("discord", "  ", STREAMER_LABEL), DISCORD_PARTICIPANT_LABEL);
  assert.equal(youLabelFor("stream", "たろう", STREAMER_LABEL), STREAMER_LABEL);
  // ログのタブの話者ラベル（transcript.mjs）は you に名前を足さない（ログに名前を出さない・設計 §10）。
  assert.equal(speakerLabel({ speaker: "you", displayName: "たろう" }), "you");
});

// ── 5. 話し始めの方式（下の帯のメーター）──────────────────────────────────────────────

test("driveSummaryView: speakStartFixed のとき「speak-now（固定）」（ロールの方式が従来でも「従来」と出さない）・Discord の場は「忙しい間のコメント」を出さない・配信は今まで通り", () => {
  const role = { verbosity: "normal", speakStartMode: "classic" };
  const discord = driveSummaryView(
    /** @type {any} */ ({ selfFire: { enabled: true }, role, speakStart: "speak-now", commentBusy: "hold", stream: { phase: "open", experience: "discord" } }),
    { speakStartFixed: true }
  );
  assert.deepEqual(discord, [
    { label: "自発", value: "ON" },
    { label: "口数", value: "ふつう" },
    { label: "話し始め", value: "speak-now" + SPEAK_START_FIXED_SUFFIX }
  ]);
  assert.equal(SPEAK_START_FIXED_SUFFIX, "（固定）");
  const stream = driveSummaryView(
    /** @type {any} */ ({ selfFire: { enabled: true }, role, speakStart: "classic", commentBusy: "hold", stream: { phase: "open", experience: "stream" } }),
    { speakStartFixed: false }
  );
  assert.deepEqual(stream, [
    { label: "自発", value: "ON" },
    { label: "口数", value: "ふつう" },
    { label: "話し始め", value: "従来" },
    { label: "忙しい間のコメント", value: "あとで拾う" }
  ]);
  assert.deepEqual(driveSummaryView(/** @type {any} */ ({ selfFire: { enabled: true }, role, commentBusy: "hold" })), stream, "第 2 引数なし（今の呼び方）も同じ");
});

// ── 6. Discord の準備の選択肢（名前で選ぶ・id は表示しない）──────────────────────────────────

test("discordGuildOptions / discordChannelOptions: 名前で出し、id は value にだけ・保存した値が一覧に無ければ決まった文面で残す", () => {
  const guilds = discordGuildOptions(CATALOG, GUILD);
  assert.deepEqual(guilds, [
    { value: "", label: DISCORD_NOT_CHOSEN_LABEL },
    { value: GUILD, label: "試しのサーバー" },
    { value: "guild-fake-v2", label: "別のサーバー" }
  ]);
  const channels = discordChannelOptions(CATALOG, GUILD, CHANNEL);
  assert.deepEqual(channels.map((o) => o.label), [DISCORD_NOT_CHOSEN_LABEL, "一般", "雑談"]);
  // まだ読み込んでいない（保存した値だけ）。
  const unloadedGuilds = discordGuildOptions(null, GUILD);
  assert.deepEqual(unloadedGuilds, [{ value: "", label: DISCORD_NOT_CHOSEN_LABEL }, { value: GUILD, label: DISCORD_SAVED_GUILD_LABEL }]);
  const unloadedChannels = discordChannelOptions(null, GUILD, CHANNEL);
  assert.deepEqual(unloadedChannels, [{ value: "", label: DISCORD_NOT_CHOSEN_LABEL }, { value: CHANNEL, label: DISCORD_SAVED_CHANNEL_LABEL }]);
  for (const o of [...guilds, ...channels, ...unloadedGuilds, ...unloadedChannels]) {
    assert.equal(o.label.includes("fake"), false, `表示に id を出さない: ${o.label}`);
  }
  assert.deepEqual(discordChannelOptions(CATALOG, null, null), [{ value: "", label: DISCORD_NOT_CHOSEN_LABEL }]);
});

test("discordVisionOptions: 「使わない（目を起こさない）」+ 窓の一覧・保存した窓が無ければ添えて残す・空の行は除く", () => {
  const windows = [{ value: "", label: "(no windows)" }];
  assert.deepEqual(discordVisionOptions(windows, null), [{ value: "", label: DISCORD_NO_VISION_LABEL }]);
  const list = [{ value: "ココフォリア", label: "ココフォリア (chrome)" }];
  assert.deepEqual(discordVisionOptions(list, "ココフォリア"), [{ value: "", label: DISCORD_NO_VISION_LABEL }, ...list]);
  assert.deepEqual(discordVisionOptions(list, "前の窓").at(-1), { value: "前の窓", label: "前の窓（今は見当たらない）" });
  assert.equal(discordVisionLabel(null), "見る窓: 使わない（Discord の場では目を起こさない）");
  assert.equal(discordVisionLabel("ココフォリア"), "見る窓: ココフォリア");
});

test("Discord の準備の失敗文言: 503 は入口なし・それ以外はサーバの決まった文面・成功は null", () => {
  assert.equal(discordPrepPostErrorText({ ok: true, status: 200 }), null);
  assert.match(String(discordPrepPostErrorText({ ok: false, status: 503 })), /Discord の入口が無い/);
  assert.equal(discordPrepPostErrorText({ ok: false, status: 409, j: { error: "VC に入っている" } }), "VC に入っている");
  assert.equal(discordCatalogErrorText({ ok: true, status: 200 }), null);
  assert.equal(discordCatalogErrorText({ ok: false, status: 502, j: { error: "Discord にログインできない" } }), "Discord にログインできない");
});

test("ui の写しの文面はサーバの文面と一字も違わない（ui は cockpit-server を import しない）", () => {
  assert.equal(DISCORD_SPEAK_START_FIXED_NOTE, DISCORD_SPEAK_START_FIXED_MESSAGE);
  assert.equal(DISCORD_CHAT_HIDDEN_NOTE, DISCORD_CHAT_CONNECT_REFUSED_MESSAGE);
});
