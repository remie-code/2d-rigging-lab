// @ts-check
/**
 * Discord モード Domain K: Discord の操作パネルの表示の導出（view-logic/discord.mjs・control.mjs・discord-mode.md §13.4・§13.3）。
 *  - パネルの状態ごと（入っている・入っています…・外で待っている・切れた）のボタン（抜ける・入る・移る）と注記。
 *  - 手動の Fire は VC にいない間・入っている途中に押せない（注記「VC に入ると押せる」）・切れた間は押せる（サーバも断らない）。
 *  - 配信の場・閉じている間はパネルを出さない（null）。配信の手動の Fire の見え方は今のまま。
 *  - 下の帯の「通話を終える」・上の帯の「VC の外で待っている」。
 * 表示の文字列に Discord の id が出ない（id は押す口の引数と key にだけ）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  discordPanelView,
  discordFireBlockedByVc,
  discordPeopleText,
  discordVcPostErrorText,
  discordVcListErrorText,
  venueConnectionView,
  DISCORD_LEAVE_TEXT,
  DISCORD_LEAVE_ARMED_TEXT,
  DISCORD_LEAVING_TEXT,
  DISCORD_JOINING_TEXT,
  DISCORD_FIRE_NOT_IN_VC_NOTE,
  DISCORD_PANEL_LIST_LOADING,
  DISCORD_PANEL_LIST_EMPTY,
  DISCORD_PANEL_NOT_OPEN_NOTE,
  DISCORD_PANEL_OP_BUSY_NOTE,
  DISCORD_PANEL_SERVER_UNKNOWN,
  DISCORD_UNAVAILABLE_NOTE
} from "./discord.mjs";
import { manualFireStreamView } from "./control.mjs";
import { endStreamButtonView } from "./glance-meters.mjs";

const CH_1 = "channel-fake-k-1";
const CH_2 = "channel-fake-k-2";
const CH_3 = "channel-fake-k-3";
const LIST = Object.freeze({
  guildName: "試しのサーバー",
  channels: [
    { id: CH_1, name: "一般", people: 2, current: true },
    { id: CH_2, name: "雑談", people: 0, current: false },
    { id: CH_3, name: "個別の部屋", people: 1, current: false }
  ]
});

/** @param {string | null} connection @param {object} [extra] */
const discordStream = (connection, extra = {}) => ({ phase: "open", experience: "discord", connection, vcName: "一般", ...extra });

/** @param {any} view */
const rowsOf = (view) => view.channels.map((/** @type {any} */ r) => [r.name, r.peopleText, r.actionText, r.action, r.disabled]);

test("Domain K パネル: 入っている（joined）= 今いる VC と「抜ける」・今いる行は「いまここ」・ほかは「移る」（1 回押し）", () => {
  const view = /** @type {any} */ (discordPanelView(discordStream("joined"), LIST));
  assert.equal(view.serverText, "試しのサーバー");
  assert.deepEqual(view.current, { text: "今いる VC: 一般", className: "discord-current joined", showLeave: true, leaveDisabled: false });
  assert.deepEqual(rowsOf(view), [
    ["一般", "2 人", "いまここ", null, true],
    ["雑談", "0 人", "移る", "move", false],
    ["個別の部屋", "1 人", "移る", "move", false]
  ]);
  assert.deepEqual(view.channels.map((/** @type {any} */ r) => r.current), [true, false, false]);
  assert.equal(view.listNote, "");
  assert.equal(view.note, "");
});

test("Domain K パネル: 入っています…（joining）= 抜ける・移るは押せない", () => {
  const view = /** @type {any} */ (discordPanelView(discordStream("joining"), LIST));
  assert.deepEqual(view.current, { text: DISCORD_JOINING_TEXT, className: "discord-current joining", showLeave: true, leaveDisabled: true });
  assert.ok(view.channels.every((/** @type {any} */ r) => r.disabled), "入っている途中はどの行も押せない");
});

test("Domain K パネル: VC の外で待っている（outside）= 「抜ける」は出さず、どの行も「入る」・古い一覧の current は信じない", () => {
  const view = /** @type {any} */ (discordPanelView(discordStream("outside", { vcName: null }), LIST));
  assert.deepEqual(view.current, {
    text: "どの VC にもいない（VC の外で待っている）",
    className: "discord-current outside",
    showLeave: false,
    leaveDisabled: true
  });
  assert.deepEqual(rowsOf(view), [
    ["一般", "2 人", "入る", "join", false],
    ["雑談", "0 人", "入る", "join", false],
    ["個別の部屋", "1 人", "入る", "join", false]
  ]);
});

test("Domain K パネル: 切れた（disconnected）= 名前に「切れた」を添えて「抜ける」は押せる・ほかの行は「移る」", () => {
  const view = /** @type {any} */ (discordPanelView(discordStream("disconnected"), LIST));
  assert.deepEqual(view.current, {
    text: "今いる VC: 一般（切れた・つなぎ直しを待っている）",
    className: "discord-current disconnected",
    showLeave: true,
    leaveDisabled: false
  });
  assert.deepEqual(rowsOf(view).map((/** @type {any} */ r) => r[2]), ["いまここ", "移る", "移る"]);
});

test("Domain K パネル: 操作の応答待ち（busy）・開きかけ・閉じかけの間は押せない（注記つき）・一覧を読む前と空の一覧", () => {
  const busy = /** @type {any} */ (discordPanelView(discordStream("joined"), LIST, { busy: true }));
  assert.equal(busy.current.leaveDisabled, true);
  assert.ok(busy.channels.every((/** @type {any} */ r) => r.disabled));
  assert.equal(busy.note, DISCORD_PANEL_OP_BUSY_NOTE);
  for (const phase of ["opening", "closing"]) {
    const v = /** @type {any} */ (discordPanelView(discordStream("joined", { phase }), LIST));
    assert.equal(v.current.leaveDisabled, true, phase);
    assert.ok(v.channels.every((/** @type {any} */ r) => r.disabled), phase);
    assert.equal(v.note, DISCORD_PANEL_NOT_OPEN_NOTE, phase);
  }
  const loading = /** @type {any} */ (discordPanelView(discordStream("joined"), null));
  assert.equal(loading.serverText, DISCORD_PANEL_SERVER_UNKNOWN);
  assert.deepEqual(loading.channels, []);
  assert.equal(loading.listNote, DISCORD_PANEL_LIST_LOADING);
  const empty = /** @type {any} */ (discordPanelView(discordStream("joined"), { channels: [], guildName: "試しのサーバー" }));
  assert.equal(empty.listNote, DISCORD_PANEL_LIST_EMPTY);
  const unknown = /** @type {any} */ (discordPanelView(discordStream(null), LIST));
  assert.equal(unknown.current.showLeave, false);
  assert.ok(unknown.channels.every((/** @type {any} */ r) => r.disabled), "状態が分からなければ押せない");
});

test("Domain K パネル: 配信の場・閉じている間・stream が無いときはパネルを出さない（null）", () => {
  assert.equal(discordPanelView({ phase: "open", experience: "stream", connection: null }, LIST), null);
  assert.equal(discordPanelView({ phase: "closed", experience: null }, LIST), null);
  assert.equal(discordPanelView(null, LIST), null);
  assert.equal(discordPanelView(undefined, null), null);
});

test("Domain K パネル: 表示の文字列に Discord の id が出ない（id は押す口の引数と key だけ）", () => {
  for (const c of ["joined", "joining", "outside", "disconnected"]) {
    const view = /** @type {any} */ (discordPanelView(discordStream(c), LIST));
    const { channels, ...rest } = view;
    const shown = JSON.stringify([rest, channels.map((/** @type {any} */ r) => [r.name, r.peopleText, r.actionText])]);
    for (const id of [CH_1, CH_2, CH_3]) assert.equal(shown.includes(id), false, `${c}: ${id}`);
    assert.deepEqual(channels.map((/** @type {any} */ r) => r.channelId), [CH_1, CH_2, CH_3]);
  }
});

test("Domain K 手動の Fire: Discord の場で VC にいない間・入っている途中は押せない（「VC に入ると押せる」）・入っている / 切れた間は押せる", () => {
  assert.deepEqual(manualFireStreamView(discordStream("outside")), { blocked: true, note: DISCORD_FIRE_NOT_IN_VC_NOTE });
  assert.deepEqual(manualFireStreamView(discordStream("joining")), { blocked: true, note: "VC に入ると押せる" });
  assert.deepEqual(manualFireStreamView(discordStream("joined")), { blocked: false, note: "" });
  assert.deepEqual(manualFireStreamView(discordStream("disconnected")), { blocked: false, note: "" }, "切れた間はサーバも断らない");
  // 場が開いていない間は今までどおり「配信を始めると押せる」（Discord の場の開きかけ・閉じかけも）。
  assert.deepEqual(manualFireStreamView({ phase: "opening", experience: "discord", connection: "joining" }), {
    blocked: true,
    note: "配信を始めると押せる"
  });
  assert.equal(discordFireBlockedByVc(discordStream("outside")), true);
  assert.equal(discordFireBlockedByVc(discordStream("joined")), false);
});

test("Domain K 手動の Fire（配信は変わらない）: 配信の場・閉じている間・古いサーバ（null）は今までどおり", () => {
  assert.deepEqual(manualFireStreamView({ phase: "open", experience: "stream", connection: null }), { blocked: false, note: "" });
  assert.deepEqual(manualFireStreamView({ phase: "open", experience: "stream", connection: "outside" }), { blocked: false, note: "" });
  assert.deepEqual(manualFireStreamView({ phase: "closed" }), { blocked: true, note: "配信を始めると押せる" });
  assert.deepEqual(manualFireStreamView(null), { blocked: false, note: "" });
  assert.equal(discordFireBlockedByVc({ phase: "open", experience: "stream", connection: "outside" }), false);
});

test("Domain K 下の帯: Discord の場は「通話を終える」（2 回押し）・閉じかけは「通話を終えています…」・配信は「配信を終える」のまま", () => {
  assert.equal(DISCORD_LEAVE_TEXT, "通話を終える");
  assert.equal(DISCORD_LEAVE_ARMED_TEXT, "もう一度押すと通話を終える");
  assert.equal(DISCORD_LEAVING_TEXT, "通話を終えています…");
  assert.equal(endStreamButtonView({ phase: "open", experience: "discord", connection: "outside" }, false).text, "通話を終える", "VC の外でも押せる");
  assert.equal(endStreamButtonView({ phase: "open", experience: "stream" }, false).text, "配信を終える");
});

test("Domain K 上の帯: 「VC の外で待っている」のチップ（色の class は outside）", () => {
  assert.deepEqual(venueConnectionView(discordStream("outside")), {
    text: "VC の外で待っている",
    className: "venue-connection outside",
    title: "どの VC にもいない。通話は続いている（右のパネルの「入る」で VC に入る）"
  });
  assert.equal(venueConnectionView({ phase: "open", experience: "stream", connection: "outside" }), null, "配信の場には出さない");
});

test("Domain K 文言: 人数・入る / 抜ける / 移るの失敗・一覧の失敗", () => {
  assert.equal(discordPeopleText(3), "3 人");
  assert.equal(discordPeopleText(-1), "0 人");
  assert.equal(discordPeopleText("2"), "0 人");
  assert.equal(discordVcPostErrorText({ ok: true, status: 200 }), null);
  assert.equal(discordVcPostErrorText({ ok: false, status: 503 }), DISCORD_UNAVAILABLE_NOTE);
  assert.equal(discordVcPostErrorText({ ok: false, status: 409, j: { error: "VC に入っている途中" } }), "VC に入っている途中");
  assert.equal(discordVcPostErrorText({ ok: false, status: 502, j: null }), "VC の操作ができない");
  assert.equal(discordVcListErrorText({ ok: true, status: 200 }), null);
  assert.equal(discordVcListErrorText({ ok: false, status: 409, j: { error: "Discord の場が開いていない" } }), "Discord の場が開いていない");
  assert.equal(discordVcListErrorText({ ok: false, status: 502 }), "ボイスチャンネルの一覧を読めない");
});
