// @ts-check
/**
 * Discord モード Domain G: 画面（discord-mode.md §9・scope §21〜§23）。DOM を描画せず、hooks 非使用の部品は vnode を走査し、
 * hooks を使う部品（App・設定のダイアログ）は ui/*.mjs のソースを照合する（棚卸し §3.1 の流儀）。
 *  - メイン画面: 場が閉じているとき「配信を始める」の横に「Discord の VC に入る」（入口があるときだけ）。
 *  - 下の帯: Discord の場の間は「VC から抜ける」（2 回押し）・話し始めは「speak-now（固定）」・忙しい間のコメントは出さない。
 *  - 上の帯: Discord の場の間だけ接続の状態。
 *  - 準備・設定: 「Discord の準備」のタブ（サーバー・ボイスチャンネル・見る窓・文字起こし・いちばん下に「Discord の VC に入る」）。
 *    Discord の場の間は YouTube の Connect を出さない。ロールのタブの話し始めは Discord の場では選ばせない。
 *  - 配信の側が変わっていないこと（「配信者」・方式が選べる・Connect が出る・配信の準備のタブが先頭・ボタンは今のまま）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TopBar } from "./ui/header.mjs";
import { ConversationPanel } from "./ui/conversation.mjs";
import { BottomBar } from "./ui/bottom-bar.mjs";
import { SpeakStartSelect } from "./ui/control-bar.mjs";
import { SETTINGS_CATEGORIES } from "./ui/settings-drawer.mjs";
import { venueExtrasFromSnapshot, settingsFromSnapshot } from "./ui/app.mjs";
import { COCKPIT_CSS } from "./ui/styles.mjs";
import { streamStartView } from "./view-logic/glance-meters.mjs";
import { discordJoinView, DISCORD_SPEAK_START_FIXED_NOTE, DISCORD_CHAT_HIDDEN_NOTE } from "./view-logic/discord.mjs";

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

// ── 1. メイン画面: 体験は場を開くときに選ぶ ───────────────────────────────────────────

test("ConversationPanel: 入口があれば「配信を始める」の横に「Discord の VC に入る」（押せば onJoinDiscord）・入口が無ければ今のまま", () => {
  let joined = 0;
  let started = 0;
  const closed = { phase: "closed", error: null, experience: null };
  const vnode = ConversationPanel({
    rows: [],
    preStream: true,
    start: streamStartView(closed),
    join: discordJoinView(closed, true),
    onStartStream: () => (started += 1),
    onJoinDiscord: () => (joined += 1),
    onOpenSettings: () => {}
  });
  const buttons = collectElements(vnode).filter((n) => n.type === "button");
  assert.deepEqual(buttons.map((b) => b.props.class), ["prestream-start", "prestream-start prestream-discord", "prestream-open"], "「配信を始める」の横・準備・設定の前");
  assert.deepEqual(buttons.map((b) => collectText(b).join("")), ["配信を始める", "Discord の VC に入る", "準備・設定"]);
  buttons[1].props.onClick();
  assert.equal(joined, 1);
  assert.equal(started, 0);
  // 入口が無い（discord が null のサーバ）: 今の 2 つのまま。
  const without = ConversationPanel({ rows: [], preStream: true, start: streamStartView(closed), join: discordJoinView(closed, false) });
  assert.deepEqual(collectElements(without).filter((n) => n.type === "button").map((b) => b.props.class), ["prestream-start", "prestream-open"]);
});

test("ConversationPanel: Discord の開きかけは「VC に入っています…」・閉じかけは「VC から抜けています…」と「記録中…」・入れなかった理由は中央に", () => {
  const opening = { phase: "opening", error: null, experience: "discord" };
  const o = ConversationPanel({ rows: [], preStream: true, start: streamStartView(opening), join: discordJoinView(opening, true) });
  const ob = collectElements(o).filter((n) => n.type === "button");
  assert.deepEqual(ob.map((b) => [collectText(b).join(""), b.props.disabled]), [
    ["配信を始める", true],
    ["VC に入っています…", true],
    ["準備・設定", undefined]
  ]);
  const closing = { phase: "closing", error: null, experience: "discord" };
  const c = ConversationPanel({ rows: [], preStream: true, start: streamStartView(closing), join: discordJoinView(closing, true) });
  assert.deepEqual(collectElements(c).filter((n) => n.type === "button").map((b) => collectText(b).join("")), ["配信を始める", "VC から抜けています…", "準備・設定"]);
  assert.equal(collectText(collectElements(c).find((n) => n.props && n.props.class === "prestream-note")).join(""), "記録中…");
  const reason = "VC に入れない（時間切れ・権限・満員など）";
  const failed = { phase: "closed", error: reason, experience: null };
  const f = ConversationPanel({ rows: [], preStream: true, start: streamStartView(failed), join: discordJoinView(failed, true) });
  const err = collectElements(f).find((n) => n.props && n.props.class === "prestream-error");
  assert.equal(collectText(err).join(""), reason, "入れない理由（DISCORD_REASONS の文面）を名指しで");
});

// ── 2. 下の帯と上の帯 ─────────────────────────────────────────────────────────────

test("BottomBar: Discord の場の間は同じ置き場に「VC から抜ける」（2 回押し）・話し始めは「speak-now（固定）」・忙しい間のコメントは出さない", () => {
  let ended = 0;
  const settings = {
    stream: { phase: "open", experience: "discord", connection: "joined" },
    selfFire: { enabled: true },
    role: { verbosity: "normal", speakStartMode: "classic" },
    speakStart: "speak-now",
    commentBusy: "hold"
  };
  const bar = BottomBar({ settings, endArmed: false, onEndStream: () => (ended += 1), speakStartFixed: true });
  const buttons = collectElements(bar).filter((n) => n.type === "button");
  assert.deepEqual(buttons.map((b) => b.props.class), ["stream-end", "settings-toggle"]);
  assert.equal(collectText(buttons[0]).join(""), "VC から抜ける");
  buttons[0].props.onClick();
  assert.equal(ended, 1);
  const text = collectText(bar).join("");
  assert.ok(text.includes("speak-now（固定）"));
  assert.equal(text.includes("従来"), false, "Discord の場で「従来」と出さない");
  assert.equal(text.includes("忙しい間のコメント"), false);
  const armed = BottomBar({ settings, endArmed: true, speakStartFixed: true });
  assert.equal(collectText(collectElements(armed).find((n) => n.type === "button")).join(""), "もう一度押すと VC から抜ける");
});

test("BottomBar（配信は変わらない）: 「配信を終える」・ロールの方式（従来）・忙しい間のコメント", () => {
  const settings = {
    stream: { phase: "open", experience: "stream", connection: null },
    selfFire: { enabled: true },
    role: { verbosity: "normal", speakStartMode: "classic" },
    speakStart: "classic",
    commentBusy: "hold"
  };
  const bar = BottomBar({ settings, speakStartFixed: false });
  const text = collectText(bar).join("");
  assert.equal(collectText(collectElements(bar).find((n) => n.type === "button")).join(""), "配信を終える");
  for (const s of ["話し始め", "従来", "忙しい間のコメント", "あとで拾う"]) assert.ok(text.includes(s), s);
  assert.equal(text.includes("（固定）"), false);
});

test("TopBar: Discord の場の間だけ状態のピルの横に接続の状態（入っている途中 / 入っている / 切れた）・配信の場では何も足さない", () => {
  const base = { identity: null, soul: "idle", ears: "listening", warnings: [], quota: null, nowMs: 0 };
  /** @param {any} stream */
  const chipOf = (stream) =>
    collectElements(TopBar({ ...base, stream })).find((n) => n.props && typeof n.props.class === "string" && n.props.class.startsWith("venue-connection"));
  assert.equal(collectText(chipOf({ phase: "opening", experience: "discord", connection: "joining" })).join(""), "VC に入っている途中");
  assert.equal(collectText(chipOf({ phase: "open", experience: "discord", connection: "joined" })).join(""), "VC に入っている");
  const cut = chipOf({ phase: "open", experience: "discord", connection: "disconnected" });
  assert.equal(cut.props.class, "venue-connection disconnected");
  assert.equal(collectText(cut).join(""), "VC から切れた（つなぎ直しを待っている）");
  assert.equal(chipOf({ phase: "open", experience: "stream", connection: null }), undefined, "配信の場は足さない");
  assert.equal(chipOf(null), undefined);
  assert.match(COCKPIT_CSS, /\.venue-connection\.disconnected \{[^}]*color: var\(--alert-text\)/);
});

// ── 3. 話し始めの方式を選ばせない ──────────────────────────────────────────────────

test("SpeakStartSelect: fixed（Discord の場）は speak-now を出して押せない・断りの文面を title に・fixed でなければ今まで通り選べる", () => {
  const fixed = collectElements(SpeakStartSelect({ speakStart: "classic", onChange() {}, fixed: true })).find((n) => n.type === "select");
  assert.equal(fixed.props.value, "speak-now", "ロールの方式が従来でも speak-now を出す");
  assert.equal(fixed.props.disabled, true);
  assert.equal(fixed.props.title, DISCORD_SPEAK_START_FIXED_NOTE);
  const free = collectElements(SpeakStartSelect({ speakStart: "classic", onChange() {} })).find((n) => n.type === "select");
  assert.equal(free.props.value, "classic");
  assert.equal(free.props.disabled, false, "配信（固定でない）は選べる");
  assert.notEqual(free.props.title, DISCORD_SPEAK_START_FIXED_NOTE);
});

test("ロールのタブ: 話し始めの select に fixed を渡し、Discord の場では断りの文面を出す（ロールは体験の外の共通の場所のまま）", () => {
  const src = read("settings-drawer.mjs");
  assert.match(src, /<\$\{SpeakStartSelect\} speakStart=\$\{roleDraft \? roleDraft\.speakStartMode : null\} disabled=\$\{roleInputsDisabled\}\n\s+fixed=\$\{speakStartIsFixed\}/);
  assert.match(src, /const speakStartIsFixed = speakStartFixed === true;/);
  assert.match(src, /speakStartIsFixed \? html`<div class="drawer-note"><span class="drawer-hint speak-start-fixed-note">\$\{DISCORD_SPEAK_START_FIXED_NOTE\}<\/span><\/div>`/);
});

// ── 4. 準備・設定: Discord の準備のタブ ─────────────────────────────────────────────

test("タブ: 配信の準備 / Discord の準備 / ロール / 運転 / 記憶 / ログ（配信の準備が先頭・開くと配信の準備・増えたのは 1 つだけ）", () => {
  assert.deepEqual(SETTINGS_CATEGORIES.map((c) => c.label), ["配信の準備", "Discord の準備", "ロール", "運転", "記憶", "ログ"]);
  const src = read("settings-drawer.mjs");
  assert.match(src, /useState\("prepare"\)/);
  assert.match(src, /id="cockpit-settings-panel-discord"[^>]*role="tabpanel" aria-labelledby="cockpit-settings-tab-discord" hidden=\$\{activeCategory !== "discord"\}/);
});

test("Discord の準備のタブ: サーバー（読み込む）→ ボイスチャンネル → 見る窓（目）→ 文字起こし → いちばん下に「Discord の VC に入る」", () => {
  const src = read("settings-drawer.mjs");
  const panel = src.slice(src.indexOf('id="cockpit-settings-panel-discord"'), src.indexOf('id="cockpit-settings-panel-role"'));
  const order = [
    "<h3>Discord の準備</h3>",
    '<label for="discord-guild-select">サーバー</label>',
    'class="btn-discord-catalog"',
    "読み込む",
    '<label for="discord-channel-select">ボイスチャンネル</label>',
    '<label for="discord-vision-select">見る窓（目）</label>',
    '<label for="discord-stt-engine-select">文字起こし</label>',
    'class="btn-discord-join"'
  ];
  let last = -1;
  for (const needle of order) {
    const at = panel.indexOf(needle);
    assert.ok(at > last, `${needle} の並び`);
    last = at;
  }
  // 選択肢は view-logic（名前で出す・id は value だけ）。表示に id を直書きしない。
  assert.match(panel, /options=\$\{discordGuildOptions\(discordCatalog, discordPrep\.guildId\)\}/);
  assert.match(panel, /options=\$\{discordChannelOptions\(discordCatalog, discordPrep\.guildId, discordPrep\.channelId\)\}/);
  assert.match(panel, /options=\$\{discordVisionOptions\(winOptions, discordVision\)\}/);
  assert.match(panel, /options=\$\{STT_ENGINE_OPTIONS\}/);
  assert.doesNotMatch(panel, /\$\{discordPrep\.(guildId|channelId)\}<\/|>\$\{discordPrep\./, "id を文字として描かない");
  // Discord の場の間は替えられない（サーバも 409）・入口が無ければ案内だけ。
  assert.match(panel, /disabled=\$\{discordLocked\}/);
  assert.match(panel, /DISCORD_UNAVAILABLE_NOTE/);
  assert.match(src, /const discordLocked = discordVenue;/);
});

test("Discord の準備のタブの API: 準備は GET / POST /api/discord/prep・一覧は POST /api/discord/catalog・見る窓は /api/discord/vision-target・入るは experience: discord", () => {
  const src = read("settings-drawer.mjs");
  assert.match(src, /doFetch\("\/api\/discord\/prep"\)/);
  assert.match(src, /doFetch\("\/api\/discord\/vision-target"\)/);
  assert.match(src, /postJson\("\/api\/discord\/prep", patch\)/);
  assert.match(src, /postJson\("\/api\/discord\/catalog", \{\}\)/);
  assert.match(src, /postJson\("\/api\/discord\/vision-target", \{ title: title \|\| null \}\)/);
  assert.match(src, /postJson\("\/api\/stream\/start", \{ experience: "discord" \}\)/);
  // 保存は選び直したときに（サーバーを替えるとチャンネルはサーバ側で消える）。
  assert.match(src, /saveDiscordPrep\(\{ guildId: /);
  assert.match(src, /saveDiscordPrep\(\{ channelId: /);
  assert.match(src, /saveDiscordPrep\(\{ sttEngine: /);
});

test("配信の準備のタブ: Discord の場の間は YouTube の Connect を出さず案内を出す・配信の場 / 閉じている間は今まで通り Connect", () => {
  const src = read("settings-drawer.mjs");
  assert.match(
    src,
    /\$\{discordVenue \? null : html`\n\s+<button class="btn-chat-connect" type="button" disabled=\$\{connectBusy\} onClick=\$\{onChatConnect\}>\n\s+Connect\n\s+<\/button>`\}/
  );
  assert.match(src, /\$\{discordVenue \? html`<span class="drawer-hint discord-chat-hidden-hint">\$\{DISCORD_CHAT_HIDDEN_NOTE\}<\/span>` : null\}/);
  assert.match(src, /const discordVenue = isDiscordVenue\(settings && settings\.stream\);/);
  assert.equal(DISCORD_CHAT_HIDDEN_NOTE.length > 0, true);
  // 配信の始めるは今のまま（選んだマイク・文字起こしで POST /api/stream/start・experience は付けない）。
  assert.match(src, /postJson\("\/api\/stream\/start", \{ device, sttEngine: sttSelected \|\| "whisper" \}\)/);
  assert.match(src, /discordVenue \? DISCORD_OPEN_NOTE_IN_STREAM_PREP : "配信中（終えるときは下の帯の「配信を終える」）"/);
});

// ── 5. App の結線 ──────────────────────────────────────────────────────────────

test("App: 「Discord の VC に入る」は POST /api/stream/start { experience: discord }・配信の始めるは今のまま body {}・Discord の場はコメントの列を出さない・you の行は体験で", () => {
  const app = read("app.mjs");
  assert.match(app, /doFetch\("\/api\/stream\/start", \{ method: "POST", headers: \{ "content-type": "application\/json" \}, body: JSON\.stringify\(\{ experience: "discord" \}\) \}\)/);
  assert.match(app, /doFetch\("\/api\/stream\/start", \{ method: "POST", headers: \{ "content-type": "application\/json" \}, body: "\{\}" \}\)/, "配信は今のまま");
  assert.match(app, /join=\$\{discordJoinView\(settings\.stream, extras\.discordAvailable\)\}/);
  assert.match(app, /onJoinDiscord=\$\{joinDiscord\}/);
  assert.match(app, /\$\{discordVenue \? null : html`<\$\{CommentsPanel\} rows=\$\{commentRows\} \/>`\}/);
  assert.match(app, /<main class=\$\{"glance-main" \+ \(discordVenue \? " solo" : ""\)\}>/);
  assert.match(app, /experience: settings\.stream \? settings\.stream\.experience \?\? null : null/);
  assert.match(app, /speakStartFixed=\$\{extras\.speakStartFixed\}/);
  assert.match(app, /discordAvailable=\$\{extras\.discordAvailable\}/);
  assert.match(COCKPIT_CSS, /\.glance-main\.solo \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(COCKPIT_CSS, /\.glance-main \{[^}]*grid-template-columns: minmax\(0, 60fr\) minmax\(0, 36fr\)/, "配信の割り付けは今のまま");
});

test("venueExtrasFromSnapshot: Discord の入口の有無と話し始めの固定（settingsFromSnapshot の項目は増やさない）", () => {
  assert.deepEqual(venueExtrasFromSnapshot(null), { discordAvailable: false, speakStartFixed: null });
  assert.deepEqual(venueExtrasFromSnapshot({ discord: { available: true }, speakStartFixed: true }), { discordAvailable: true, speakStartFixed: true });
  assert.deepEqual(venueExtrasFromSnapshot({ discord: null, speakStartFixed: false }), { discordAvailable: false, speakStartFixed: false });
  assert.equal("discord" in settingsFromSnapshot({ discord: { available: true } }), false);
  assert.equal("speakStartFixed" in settingsFromSnapshot({ speakStartFixed: true }), false);
});
