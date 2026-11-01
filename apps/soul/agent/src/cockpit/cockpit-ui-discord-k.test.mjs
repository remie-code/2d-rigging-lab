// @ts-check
/**
 * Discord モード Domain K: Discord の操作パネルの画面（ui/discord-panel.mjs・discord-mode.md §13.4）。DOM を描画せず、hooks を使わない
 * 区切りの部品は vnode を走査し、hooks を使う取りまとめ（DiscordPanel・App）はソースを照合する（G と同じ流儀）。
 *  - 接続: サーバー名・今いる VC と「抜ける」・VC の一覧（人数つき）と「入る」/「移る」（押せば action と channelId を渡す）。
 *  - しゃべり方: 「自発的にしゃべる」「かぶり判定」（運転のタブと同じ部品・同じ API）・手動の Fire（VC にいない間は押せず注記）。
 *  - 見る窓: 「使わない」と窓の一覧。
 *  - App: Discord の場の間は右の領域にパネル・配信の場はコメントの列のまま。狭い幅の並び。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DiscordConnectionSection, DiscordSpeakingSection, DiscordVisionSection } from "./ui/discord-panel.mjs";
import { SelfFirePill, BargeInPill } from "./ui/control-bar.mjs";
import { COCKPIT_CSS } from "./ui/styles.mjs";
import { discordPanelView, discordVisionOptions, discordVisionLabel } from "./view-logic/discord.mjs";
import { soulStatusView, selfFireToggleView, bargeInToggleView, manualFireStreamView } from "./view-logic/control.mjs";

/** @param {any} node @param {string[]} [out] */
function collectText(node, out = []) {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const c of node) collectText(c, out);
    return out;
  }
  if (typeof node.type === "function") return collectText(node.type(node.props), out);
  return collectText(node.props && node.props.children, out);
}

/** @param {any} node @param {any[]} [out] */
function collectElements(node, out = []) {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const c of node) collectElements(c, out);
    return out;
  }
  if (typeof node.type === "function") return collectElements(node.type(node.props), out);
  if (node.type) out.push(node);
  return collectElements(node.props && node.props.children, out);
}

/** @param {string} name */
const read = (name) => readFileSync(new URL(`./ui/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const LIST = Object.freeze({
  guildName: "試しのサーバー",
  channels: [
    { id: "channel-fake-k-1", name: "一般", people: 2, current: true },
    { id: "channel-fake-k-2", name: "雑談", people: 0, current: false }
  ]
});

/** @param {string} connection */
const stream = (connection) => ({ phase: "open", experience: "discord", connection, vcName: "一般" });

/** @param {any} vnode */
const buttonsOf = (vnode) => collectElements(vnode).filter((n) => n.type === "button");

test("DiscordConnectionSection: 入っている = サーバー名・今いる VC・「抜ける」・一覧の「いまここ」と「移る」（押せば move と channelId）", () => {
  /** @type {any[]} */
  const ops = [];
  let left = 0;
  let refreshed = 0;
  const view = /** @type {any} */ (discordPanelView(stream("joined"), LIST));
  const vnode = DiscordConnectionSection({
    view,
    onLeave: () => (left += 1),
    onChannel: (action, channelId) => ops.push([action, channelId]),
    onRefresh: () => (refreshed += 1)
  });
  const text = collectText(vnode).join("");
  for (const s of ["接続", "サーバー", "試しのサーバー", "今いる VC: 一般", "同じサーバーの VC", "一般", "2 人", "いまここ", "雑談", "0 人"]) {
    assert.ok(text.includes(s), s);
  }
  const buttons = buttonsOf(vnode);
  assert.deepEqual(buttons.map((b) => [b.props.class, collectText(b).join("").trim(), b.props.disabled]), [
    ["btn-discord-leave", "抜ける", false],
    ["btn-discord-refresh", "一覧を更新", undefined],
    ["btn-discord-move", "移る", false]
  ]);
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  buttons[2].props.onClick();
  assert.deepEqual([left, refreshed], [1, 1]);
  assert.deepEqual(ops, [["move", "channel-fake-k-2"]]);
  assert.equal(text.includes("channel-fake-k"), false, "id は画面に出さない");
});

test("DiscordConnectionSection: VC の外 = 「抜ける」なし・どの行も「入る」（join）・入っている途中と切れたの見え方・失敗の文言", () => {
  /** @type {any[]} */
  const ops = [];
  const outside = DiscordConnectionSection({
    view: /** @type {any} */ (discordPanelView({ ...stream("outside"), vcName: null }, LIST)),
    onChannel: (action, channelId) => ops.push([action, channelId]),
    error: "VC に入れない（時間切れ・権限・満員など）"
  });
  const ob = buttonsOf(outside);
  assert.deepEqual(ob.map((b) => [b.props.class, collectText(b).join("").trim()]), [
    ["btn-discord-refresh", "一覧を更新"],
    ["btn-discord-join", "入る"],
    ["btn-discord-join", "入る"]
  ]);
  ob[1].props.onClick();
  assert.deepEqual(ops, [["join", "channel-fake-k-1"]]);
  const otext = collectText(outside).join("");
  assert.ok(otext.includes("どの VC にもいない（VC の外で待っている）"));
  assert.ok(otext.includes("VC に入れない（時間切れ・権限・満員など）"));
  const joining = DiscordConnectionSection({ view: /** @type {any} */ (discordPanelView(stream("joining"), LIST)) });
  assert.ok(collectText(joining).join("").includes("VC に入っています…"));
  // 入っている途中: 抜ける・どの行も押せない（今いる行の印は VC に入りきってから）。
  assert.deepEqual(buttonsOf(joining).filter((b) => b.props.class !== "btn-discord-refresh").map((b) => b.props.disabled), [true, true, true]);
  const cut = DiscordConnectionSection({ view: /** @type {any} */ (discordPanelView(stream("disconnected"), LIST)) });
  assert.ok(collectText(cut).join("").includes("今いる VC: 一般（切れた・つなぎ直しを待っている）"));
  assert.equal(buttonsOf(cut)[0].props.disabled, false, "切れた間も抜けられる");
});

test("DiscordSpeakingSection: 「自発的にしゃべる」「かぶり判定」（運転のタブと同じ部品）・Fire は VC にいない間は押せず「VC に入ると押せる」", () => {
  let fired = 0;
  let visionFired = 0;
  const base = {
    sfView: selfFireToggleView({ enabled: true }),
    biView: bargeInToggleView({ enabled: false }),
    soulView: soulStatusView("idle"),
    onFire: () => (fired += 1),
    onVisionFire: () => (visionFired += 1)
  };
  const outside = DiscordSpeakingSection({ ...base, fireStream: manualFireStreamView(stream("outside")) });
  const text = collectText(outside).join("");
  for (const s of ["しゃべり方", "自発的にしゃべる", "かぶり判定", "手動の Fire", "🎤 Fire", "🖼 Fire+視覚", "VC に入ると押せる"]) assert.ok(text.includes(s), s);
  const fireButtons = buttonsOf(outside);
  assert.deepEqual(fireButtons.map((b) => [b.props.class, b.props.disabled]), [
    ["btn-fire", true],
    ["btn-vision-fire", true]
  ]);
  const toggles = collectElements(outside).filter((n) => n.type === "input");
  assert.deepEqual(toggles.map((t) => [t.props.class, t.props.checked]), [
    ["self-fire-toggle", true],
    ["barge-in-toggle", false]
  ]);
  const joined = DiscordSpeakingSection({ ...base, fireStream: manualFireStreamView(stream("joined")), fireNote: "not fired: busy" });
  const jb = buttonsOf(joined);
  assert.deepEqual(jb.map((b) => b.props.disabled), [false, false]);
  jb[0].props.onClick();
  jb[1].props.onClick();
  assert.deepEqual([fired, visionFired], [1, 1]);
  const jtext = collectText(joined).join("");
  assert.equal(jtext.includes("VC に入ると押せる"), false);
  assert.ok(jtext.includes("not fired: busy"));
  const joining = DiscordSpeakingSection({ ...base, fireStream: manualFireStreamView(stream("joining")) });
  assert.deepEqual(buttonsOf(joining).map((b) => b.props.disabled), [true, true], "入っている途中も押せない");
});

test("SelfFirePill / BargeInPill: ラベルの既定は運転のタブのまま（自発・かぶり）・パネルだけ替える", () => {
  const view = selfFireToggleView({ enabled: true });
  assert.ok(collectText(SelfFirePill({ view, onChange: () => {} })).join("").includes("自発"));
  assert.equal(collectText(SelfFirePill({ view, onChange: () => {} })).join("").includes("自発的にしゃべる"), false);
  assert.ok(collectText(BargeInPill({ view: bargeInToggleView({ enabled: true }), onChange: () => {} })).join("").includes("かぶり"));
  assert.equal(collectText(BargeInPill({ view: bargeInToggleView({ enabled: true }), onChange: () => {} })).join("").includes("かぶり判定"), false);
});

test("DiscordVisionSection: 先頭が「使わない」・窓の一覧・選んだ値・添え書き「次の発火から」", () => {
  /** @type {any[]} */
  const changed = [];
  const options = discordVisionOptions([{ value: "偽のゲームの窓", label: "偽のゲームの窓 (game.exe)" }], "偽の資料の窓");
  const vnode = DiscordVisionSection({
    options,
    value: "偽の資料の窓",
    onChange: (ev) => changed.push(ev.target.value),
    statusText: discordVisionLabel("偽の資料の窓")
  });
  const select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "偽の資料の窓");
  assert.deepEqual(collectElements(vnode).filter((n) => n.type === "option").map((o) => o.props.value), ["", "偽のゲームの窓", "偽の資料の窓"]);
  const text = collectText(vnode).join("");
  for (const s of ["見る窓", "使わない（目を起こさない）", "見る窓: 偽の資料の窓", "選び直すと次の発火から新しい窓を見る", "窓の一覧を更新"]) {
    assert.ok(text.includes(s), s);
  }
  select.props.onChange({ target: { value: "" } });
  assert.deepEqual(changed, [""]);
});

test("DiscordPanel（ソース）: 一覧は GET /api/discord/vc・操作は POST /api/discord/vc { action, channelId }・見る窓は POST /api/discord/vision-target・しゃべり方は useDriveControls", () => {
  const src = read("discord-panel.mjs");
  assert.match(src, /doFetch\("\/api\/discord\/vc"\)/);
  assert.match(src, /doFetch\("\/api\/discord\/vc", \{\n\s+method: "POST",[\s\S]*?body: JSON\.stringify\(channelId \? \{ action, channelId \} : \{ action \}\)/);
  assert.match(src, /doFetch\("\/api\/discord\/vision-target", \{\n\s+method: "POST",[\s\S]*?body: JSON\.stringify\(\{ title: title \|\| null \}\)/);
  assert.match(src, /const drive = useDriveControls\(\{ setSoul, setFireNote, applySnapshot, fetchImpl \}\);/);
  assert.match(src, /onFire=\$\{\(\) => drive\.fireWith\("\/api\/fire", "fire"\)\}/);
  assert.match(src, /onVisionFire=\$\{\(\) => drive\.fireWith\("\/api\/vision-fire", "vision"\)\}/);
  assert.match(src, /fireStream=\$\{manualFireStreamView\(stream\)\}/);
  // 入れないもの（VC にいる人の一覧・人ごとの聞かない・呼び名・KILL）。
  for (const gone of ["/api/kill", "onKill", "speakers", "/api/discord/mute"]) assert.equal(src.includes(gone), false, gone);
  // 運転のタブも同じ hook を使う（POST の流れは 1 つ）。
  const drive = read("control-bar.mjs");
  assert.match(drive, /export function useDriveControls\(/);
  assert.match(drive.slice(drive.indexOf("export function DrivePanel")), /useDriveControls\(\{/);
});

test("App（ソース）: Discord の場の間は右の領域に DiscordPanel（運転の値と同じ口）・配信の場はコメントの列のまま", () => {
  const app = read("app.mjs");
  assert.match(app, /import \{ DiscordPanel \} from "\.\/discord-panel\.mjs";/);
  assert.match(
    app,
    /\? html`<\$\{DiscordPanel\}\n\s+stream=\$\{settings\.stream\}\n\s+soul=\$\{soul\}\n\s+setSoul=\$\{setSoul\}\n\s+fireNote=\$\{fireNote\}\n\s+setFireNote=\$\{setFireNote\}\n\s+selfFire=\$\{settings\.selfFire\}\n\s+bargeIn=\$\{settings\.bargeIn\}\n\s+applySnapshot=\$\{applySnapshot\}\n\s+fetchImpl=\$\{props\.fetchImpl\}\n\s+\/>`\n\s+: html`<\$\{CommentsPanel\} rows=\$\{commentRows\} \/>`/
  );
});

test("styles: パネルはコメントの列と同じ割り付けの右の領域・中だけ縦にスクロール・狭い幅では余白を詰めトグルを 1 行に 1 つ・「VC の外で待っている」の色", () => {
  assert.match(COCKPIT_CSS, /\.glance-main \{[^}]*grid-template-columns: minmax\(0, 60fr\) minmax\(0, 36fr\)/, "割り付けは配信と同じ");
  assert.match(COCKPIT_CSS, /\.discord-panel \{ padding: 14px 0 10px 22px; border-left: 1px solid var\(--border\); min-width: 0; \}/);
  assert.match(COCKPIT_CSS, /\.discord-panel-body \{[^}]*overflow-y: auto/);
  assert.match(COCKPIT_CSS, /\.discord-channel \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto auto/);
  assert.match(COCKPIT_CSS, /\.discord-row \{[^}]*flex-wrap: wrap/);
  const narrow = COCKPIT_CSS.slice(COCKPIT_CSS.indexOf("@media (max-width: 1500px)"));
  assert.match(narrow, /\.discord-panel \{ padding-left: 14px; \}/);
  assert.match(narrow, /\.discord-toggles > label \{ flex: 1 1 100%; \}/);
  assert.match(COCKPIT_CSS, /\.venue-connection\.outside \{/);
});
