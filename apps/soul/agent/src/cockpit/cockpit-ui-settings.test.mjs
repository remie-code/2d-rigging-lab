// @ts-check
// 配信の組み直し Domain E: 画面の組み直し（stream-restructure.md §6・体験の場面 2・3・5）の機械テスト。
//  - 画面側のロールの id の形（view-logic/role.mjs）が魂側（model-identity.mjs）と一致する（写しの重複を 1 か所に寄せた）
//  - view-logic の新しい導出（ロールの編集・保存した値の select・記憶のタブ・手動の発火・状態のピル・下の帯）
//  - 設定のダイアログの 5 タブの中身（配信の準備 / ロール / 運転 / 記憶）の置き場と、場の途中の固まり方
// このファイルは src/cockpit/ 直下（配信サブツリー外）に置く（静的配信ツリーへ node:test を import するファイルを混ぜない）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROLE_ID_PATTERN as SOUL_ROLE_ID_PATTERN,
  WINDOWS_RESERVED_NAMES as SOUL_WINDOWS_RESERVED_NAMES,
  isRoleId
} from "../mind/model-identity.mjs";
import {
  ROLE_ID_PATTERN,
  WINDOWS_RESERVED_NAMES,
  isRoleIdShape,
  ROLE_MODEL_OPTIONS,
  roleDraftFromStatus,
  roleDraftDirty,
  rolePatchFromDraft,
  newRoleIdError,
  channelFieldVisible,
  roleLockedNote,
  roleEditPostErrorText
} from "./view-logic/role.mjs";
import { CONVERSATION_INSTRUCTION_ROLE_ID_PATTERN, isConversationInstructionRoleId } from "./view-logic/conversation-instruction.mjs";
import {
  savedDeviceSelection,
  memoryPlaceLabel,
  memoryRecordButtonView,
  streamLocksInputs,
  STREAM_LOCKED_INPUTS_NOTE,
  chatConnectErrorText,
  chatSourceSaveErrorText,
  requestErrorText
} from "./view-logic/settings.mjs";
import { manualFireStreamView, fireNoteFromFireResponse, soulStatusView } from "./view-logic/control.mjs";
import { statusPillView, driveSummaryView } from "./view-logic/glance-meters.mjs";
import { channelStatusView, chatAutoConnectHint, CHAT_CONNECT_ON_START_HINT, CHAT_PREVIOUS_SOURCE_HINT } from "./view-logic/status.mjs";
import { BRAIN_LABELS } from "./view-logic/health.mjs";
import { TopBar, identityDisplayName } from "./ui/header.mjs";
import { roleIdentityOf } from "./ui/app.mjs";
import { BottomBar } from "./ui/bottom-bar.mjs";
import { FireButtons, VerbositySelect, SpeakStartSelect } from "./ui/control-bar.mjs";
import { ConversationInstructionEditor } from "./ui/conversation-instruction-editor.mjs";
import { COCKPIT_CSS } from "./ui/styles.mjs";

const UI_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "ui");
const read = (/** @type {string} */ name) => readFileSync(path.join(UI_DIR, name), "utf8").replace(/\r\n/g, "\n");

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

/** @param {any} node @param {string[]} [out] */
function collectText(node, out = []) {
  if (node == null || node === false || node === true) return out;
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

/** 設定のダイアログのタブ（パネル）の中身だけを切り出す。 @param {string} id @param {string} nextId */
function panel(id, nextId) {
  const source = read("settings-drawer.mjs");
  return source.slice(source.indexOf(`id="cockpit-settings-panel-${id}"`), source.indexOf(`id="cockpit-settings-panel-${nextId}"`));
}

// ── ロールの id の形: 画面側は view-logic/role.mjs の 1 か所・魂側と一致 ─────────────────────

test("ロールの id の形: 画面側（view-logic/role.mjs）の写しは model-identity.mjs と同じ（形・予約名・同じ入力に同じ答え）", () => {
  assert.equal(ROLE_ID_PATTERN.source, SOUL_ROLE_ID_PATTERN.source);
  assert.equal(ROLE_ID_PATTERN.flags, SOUL_ROLE_ID_PATTERN.flags);
  assert.deepEqual([...WINDOWS_RESERVED_NAMES], [...SOUL_WINDOWS_RESERVED_NAMES]);
  const inputs = ["chappy", "cody", "mio-2", "a", "x".repeat(32), "x".repeat(33), "", "Chappy", "1a", "-a", "a_b", "a.b", "a/b", "..",
    "con", "CON", "nul", "prn", "aux", "com0", "com1", "com9", "lpt0", "lpt1", "lpt9", "com10", "console", "con-1", 3, null, undefined];
  for (const value of inputs) {
    assert.equal(isRoleIdShape(value), isRoleId(value), String(value));
    assert.equal(isConversationInstructionRoleId(value), isRoleId(value), String(value));
  }
  assert.equal(CONVERSATION_INSTRUCTION_ROLE_ID_PATTERN, ROLE_ID_PATTERN, "会話指示の側も同じ 1 か所から引く");
});

test("ロールの id の形: ui/header.mjs は写しを持たず view-logic/role.mjs から引く（予約名の id は中立の題）", () => {
  const header = read("header.mjs");
  assert.doesNotMatch(header, /ROLE_ID_SHAPE|\/\^\[a-z\]/, "header.mjs に正規表現の写しが無い");
  assert.match(header, /import \{ isRoleIdShape \} from "\.\.\/view-logic\/role\.mjs";/);
  const ci = readFileSync(path.join(UI_DIR, "..", "view-logic", "conversation-instruction.mjs"), "utf8");
  assert.doesNotMatch(ci, /\/\^\[a-z\]/, "conversation-instruction.mjs にも写しが無い");
  assert.equal(identityDisplayName({ id: "mio", displayName: "ミオ" }), "ミオ");
  assert.equal(identityDisplayName({ id: "con", displayName: "コン" }), "Soul Cockpit", "予約名の id は中立の題");
});

// ── view-logic: ロールの編集 ─────────────────────────────────────────────

const ROLE_STATUS = Object.freeze({
  id: "chappy",
  displayName: "チャッピー",
  brain: "codex-61-sol",
  body: true,
  name: { canonical: "チャッピー", display: "チャッピー", latin: "Chappy" },
  voice: { engine: "aivis", aivisSpeaker: 888753760, elevenLabsVoiceId: null },
  verbosity: "chatty",
  speakStartMode: "speak-now",
  editable: true,
  roles: [{ id: "chappy", displayName: "チャッピー", brain: "codex-61-sol" }, { id: "cody", displayName: "こーでぃー", brain: "claude" }]
});

test("roleDraftFromStatus / roleDraftDirty / rolePatchFromDraft: snapshot の role から下書きを作り、変えたら dirty・POST /api/role/edit の中身にする", () => {
  const draft = roleDraftFromStatus(ROLE_STATUS);
  assert.deepEqual(draft, {
    id: "chappy",
    canonical: "チャッピー",
    display: "チャッピー",
    latin: "Chappy",
    brain: "codex-61-sol",
    voiceEngine: "aivis",
    aivisSpeaker: "888753760",
    elevenLabsVoiceId: "",
    verbosity: "chatty",
    speakStartMode: "speak-now",
    body: true
  });
  assert.equal(roleDraftDirty(draft, roleDraftFromStatus(ROLE_STATUS)), false);
  const changed = { .../** @type {any} */ (draft), body: false, aivisSpeaker: "", elevenLabsVoiceId: " voice_1 " };
  assert.equal(roleDraftDirty(changed, draft), true);
  assert.deepEqual(rolePatchFromDraft(changed), {
    ok: true,
    patch: {
      name: { canonical: "チャッピー", display: "チャッピー", latin: "Chappy" },
      brain: "codex-61-sol",
      voice: { engine: "aivis", aivisSpeaker: null, elevenLabsVoiceId: "voice_1" },
      verbosity: "chatty",
      speakStartMode: "speak-now",
      body: false
    }
  });
  for (const bad of [{ canonical: " " }, { display: "" }, { latin: "x".repeat(33) }, { aivisSpeaker: "-1" }, { aivisSpeaker: "1.5" }, { elevenLabsVoiceId: "has space" }]) {
    const r = rolePatchFromDraft({ .../** @type {any} */ (draft), ...bad });
    assert.equal(r.ok, false, JSON.stringify(bad));
  }
  // 古いサーバ（編集の持ち物が無い）でも id と見せる名前から下書きは作れる。名前の形が違えば null。
  assert.equal(roleDraftFromStatus({ id: "mio", displayName: "みお" })?.canonical, "みお");
  assert.equal(roleDraftFromStatus({ id: "con", displayName: "x" }), null);
  assert.equal(roleDraftFromStatus(null), null);
  assert.deepEqual(ROLE_MODEL_OPTIONS.map((o) => o.value), Object.keys(BRAIN_LABELS));
});

test("newRoleIdError / channelFieldVisible / roleLockedNote / roleEditPostErrorText", () => {
  assert.equal(newRoleIdError("mio", ["chappy", "cody"]), null);
  assert.match(String(newRoleIdError("", [])), /id を入れる/);
  assert.match(String(newRoleIdError("Mio", [])), /英小文字/);
  assert.match(String(newRoleIdError("con", [])), /Windows の予約名/);
  assert.match(String(newRoleIdError("lpt1", [])), /Windows の予約名/);
  assert.match(String(newRoleIdError("cody", ["chappy", "cody"])), /もうある/);
  // 器の URL の欄はロールに体があるときだけ（channel.body か role.body）。古いサーバは出す。
  assert.equal(channelFieldVisible({ channel: { body: true }, role: { body: true } }), true);
  assert.equal(channelFieldVisible({ channel: { body: false }, role: { body: true } }), false);
  assert.equal(channelFieldVisible({ channel: null, role: { body: false } }), false);
  assert.equal(channelFieldVisible({}), true);
  assert.equal(channelFieldVisible(null), true);
  assert.equal(roleLockedNote(false), "");
  assert.match(roleLockedNote(true), /配信の途中はロールを選べない・直せない/);
  assert.equal(roleEditPostErrorText({ status: 200, ok: true, j: {} }), null);
  assert.equal(roleEditPostErrorText({ status: 503, ok: false, j: null }), "role edit not available");
  assert.equal(roleEditPostErrorText({ status: 409, ok: false, j: { error: "配信の途中はロールを直せない" } }), "配信の途中はロールを直せない");
});

// ── view-logic: 配信の準備・記憶・手動の発火・上の帯・下の帯 ─────────────────────────

test("savedDeviceSelection: 保存した値を選んだ状態で出す（一覧と保存した値の届く順に関わらない）・選び直している間は上書きしない", () => {
  const options = [{ value: "A", label: "A" }, { value: "Game", label: "Game" }];
  assert.equal(savedDeviceSelection(options, "Game", "", false), "Game", "保存した窓を選ぶ（先頭ではない）");
  assert.equal(savedDeviceSelection(options, "Gone", "", false), "A", "保存した値が一覧に無ければ先頭");
  assert.equal(savedDeviceSelection([], "Game", "", false), "", "一覧がまだ無ければ空");
  assert.equal(savedDeviceSelection(options, "Game", "A", true), "A", "選び直している間は保存した値で上書きしない");
  assert.equal(savedDeviceSelection(options, "Game", "Old", true), "Game", "選び直した値が一覧から消えたら保存した値");
  assert.equal(savedDeviceSelection(options, null, "", false), "A");
});

test("memoryPlaceLabel / memoryRecordButtonView: どのロールの記憶か（placeInfo の roleId / dir）・「今日を記録」は場が開いている間だけ押せる見た目", () => {
  assert.equal(memoryPlaceLabel({ available: true, roleId: "chappy", roleName: "チャッピー", dir: "C:/x/memories/chappy" }), "チャッピー の記憶（C:/x/memories/chappy）");
  assert.equal(memoryPlaceLabel({ available: true, roleId: "mio", roleName: null, dir: null }), "mio の記憶（mio）");
  assert.match(memoryPlaceLabel({ available: false, roleId: null }), /記憶の引っ越しに失敗した/);
  assert.equal(memoryPlaceLabel({ lastRecordAtMs: null, recording: false }), "", "roleId を持たない古いサーバは出さない");
  assert.equal(memoryPlaceLabel(null), "");
  assert.deepEqual(memoryRecordButtonView({ phase: "open" }, false), { disabled: false, note: "" });
  for (const phase of ["closed", "opening", "closing"]) {
    const view = memoryRecordButtonView({ phase }, false);
    assert.equal(view.disabled, true, phase);
    assert.match(view.note, /配信を始めている間だけ記録できる/);
  }
  assert.equal(memoryRecordButtonView({ phase: "open" }, true).disabled, true, "連打防止");
  assert.equal(memoryRecordButtonView(null, false).disabled, false, "stream を持たない古いサーバは今までどおり");
  assert.equal(streamLocksInputs({ phase: "open" }), true);
  assert.match(STREAM_LOCKED_INPUTS_NOTE, /マイク・文字起こし/);
});

test("manualFireStreamView / fireNoteFromFireResponse / FireButtons: 場が開いていない間は手動の発火を押せない（disabled）・409 の理由を出す", () => {
  assert.deepEqual(manualFireStreamView({ phase: "open" }), { blocked: false, note: "" });
  for (const phase of ["closed", "opening", "closing"]) {
    const view = manualFireStreamView({ phase });
    assert.equal(view.blocked, true, phase);
    assert.match(view.note, /配信を始めると押せる/);
  }
  assert.equal(manualFireStreamView(null).blocked, false, "stream を持たない古いサーバは今までどおり");
  assert.equal(
    fireNoteFromFireResponse({ status: 409, j: { fired: false, reason: "stream-not-open", error: "配信を始めてから押す" } }),
    "not fired: 配信を始めてから押す"
  );
  const idle = soulStatusView("idle");
  const blocked = collectElements(FireButtons({ soulView: idle, localBusy: false, onFire() {}, onVisionFire() {}, streamBlocked: true }));
  assert.equal(blocked.filter((n) => n.type === "button").every((b) => b.props.disabled === true), true, "場の外は両方押せない");
  const open = collectElements(FireButtons({ soulView: idle, localBusy: false, onFire() {}, onVisionFire() {}, streamBlocked: false }));
  assert.equal(open.filter((n) => n.type === "button").every((b) => b.props.disabled === false), true);
  const drive = read("control-bar.mjs");
  assert.match(drive, /const fireStream = manualFireStreamView\(stream\);/);
  assert.match(drive, /streamBlocked=\$\{fireStream\.blocked\}/);
  assert.match(read("app.mjs"), /bargeIn=\$\{settings\.bargeIn\}\n\s+stream=\$\{settings\.stream\}/, "App が運転のタブへ場の状態を渡す");
});

test("statusPillView: 場の開きかけ「始めてる」・閉じかけ「記録中」だけ出し、それ以外は今のまま（喋ってる・考えてるが先）", () => {
  assert.deepEqual(statusPillView("idle", "stopped", false, { phase: "closing" }), { text: "記録中", className: "status-pill recording" });
  assert.deepEqual(statusPillView("idle", "stopped", false, { phase: "opening" }), { text: "始めてる", className: "status-pill starting" });
  assert.deepEqual(statusPillView("idle", "listening", false, { phase: "open" }), statusPillView("idle", "listening", false));
  assert.deepEqual(statusPillView("idle", "stopped", false, { phase: "closed" }), statusPillView("idle", "stopped", false));
  assert.equal(statusPillView("speaking", "stopped", false, { phase: "closing" }).text, "喋ってる");
  const bar = TopBar({ identity: { id: "chappy", displayName: "チャッピー" }, soul: "idle", ears: "stopped", stream: { phase: "closing" }, nowMs: 0 });
  const text = collectText(bar).join("");
  assert.match(text, /チャッピー/);
  assert.match(text, /記録中/);
  assert.match(COCKPIT_CSS, /\.status-pill\.recording \{ color: var\(--amber\); \}/);
});

test("上の帯の名前はロールの名前（roleIdentityOf: snapshot の role・無い古いサーバは brain.identity）", () => {
  assert.deepEqual(roleIdentityOf({ role: { id: "mio", displayName: "みお" }, brain: { identity: { id: "chappy", displayName: "チャッピー" } } }), { id: "mio", displayName: "みお" });
  assert.deepEqual(roleIdentityOf({ role: null, brain: { identity: { id: "chappy", displayName: "チャッピー" } } }), { id: "chappy", displayName: "チャッピー" });
  assert.equal(roleIdentityOf({ role: null, brain: null }), null);
  assert.equal(identityDisplayName(roleIdentityOf({ role: { id: "mio", displayName: "みお" } })), "みお");
  assert.match(read("app.mjs"), /const currentIdentity = roleIdentityOf\(settings\);/);
});

test("下の帯の運転設定の表示: 口数・話し始めはロールの値（role.verbosity / speakStartMode）・ロールが持たない古いサーバは今の値", () => {
  const settings = {
    selfFire: { enabled: true },
    verbosity: "normal",
    speakStart: "classic",
    commentBusy: "hold",
    role: { id: "chappy", verbosity: "chatty", speakStartMode: "speak-now" }
  };
  assert.deepEqual(driveSummaryView(settings), [
    { label: "自発", value: "ON" },
    { label: "口数", value: "おしゃべり" },
    { label: "話し始め", value: "speak-now" },
    { label: "忙しい間のコメント", value: "あとで拾う" }
  ]);
  assert.equal(driveSummaryView({ ...settings, role: null })[1].value, "ふつう");
  const text = collectText(BottomBar({ settings })).join("");
  assert.match(text, /口数 おしゃべり/);
});

test("器の状態「体なし」の色（.channel-status.bodyless・状態の色の流儀: 問題ではないので静かな紫）", () => {
  assert.equal(channelStatusView({ configured: true, body: false }).className, "channel-status bodyless");
  assert.match(COCKPIT_CSS, /\.channel-status\.bodyless \{ color: var\(--compacting\); \}/);
});

test("使われなくなった CSS（旧「頭脳」の会話指示の select・設定のダイアログの Stop など）を消した", () => {
  for (const unused of [".conversation-instruction-selection", ".conversation-instruction-technical-label", ".cockpit-settings-advanced", ".btn-stop", ".drawer-close"]) {
    assert.equal(COCKPIT_CSS.includes(unused), false, unused);
  }
});

// ── 設定のダイアログ: 配信の準備 ──────────────────────────────────────────────

test("配信の準備: 毎回見るもの（YouTube → ゲームの窓 → 体があるときだけ器の URL）とたたんだもの（マイク・文字起こし・声の出力先・忙しい間のコメント）の並び", () => {
  const prepare = panel("prepare", "role");
  const at = (/** @type {string} */ needle) => prepare.indexOf(needle);
  assert.ok(at('id="chat-source"') > 0);
  assert.ok(at('id="vision-target-select"') > at('id="chat-source"'), "ゲームの窓は YouTube の下");
  assert.ok(at('id="channel-url"') > at('id="vision-target-select"'), "器の URL はその下");
  assert.match(prepare, /\$\{showChannel \? html`\n\s+<div class="drawer-row channel-row">/, "器の URL はロールに体があるときだけ");
  assert.match(read("settings-drawer.mjs"), /const showChannel = channelFieldVisible\(settings\);/);
  const detailsAt = at('<details class="prepare-more">');
  assert.ok(detailsAt > at('id="channel-url"'), "たたんだものは毎回見るものの下");
  for (const id of ['id="device-select"', 'id="stt-engine-select"', 'id="audio-device-select"', "<${CommentBusySelect}"]) {
    assert.ok(at(id) > detailsAt && at(id) < at("</details>"), `${id} はたたんだものの中`);
  }
  assert.match(prepare, /<label for="vision-target-select">ゲームの窓<\/label>/);
  assert.doesNotMatch(prepare, /tts-engine-select/, "声の方式は外した（ロールの声）");
});

test("配信の準備: ゲームの窓・声の出力先の select は保存した値を選んだ状態で出す（savedDeviceSelection・選び直したら上書きしない）", () => {
  const source = read("settings-drawer.mjs");
  assert.match(source, /const savedWindow = settings && settings\.visionTarget \? settings\.visionTarget\.title \?\? null : null;/);
  assert.match(source, /setWinSelected\(\(current\) => savedDeviceSelection\(winOptions, savedWindow, current, winEditedRef\.current\)\);\n\s+\}, \[winOptions, savedWindow\]\);/);
  assert.match(source, /const savedAudioDevice = settings && settings\.audioDevice \? settings\.audioDevice\.name \?\? null : null;/);
  assert.match(source, /setAudioSelected\(\(current\) => savedDeviceSelection\(audioOptions, savedAudioDevice, current, audioEditedRef\.current\)\);\n\s+\}, \[audioOptions, savedAudioDevice\]\);/);
  assert.match(source, /onChange=\$\{\(\/\*\* @type \{any\} \*\/ ev\) => \{\n\s+winEditedRef\.current = true;/);
  assert.match(source, /onChange=\$\{\(\/\*\* @type \{any\} \*\/ ev\) => \{\n\s+audioEditedRef\.current = true;/);
  assert.doesNotMatch(source, /setWinSelected\(initialDeviceSelection\(view\.options, null\)\)/, "一覧の先頭を選ぶ旧い初期化は無い");
  assert.doesNotMatch(source, /setAudioSelected\(initialDeviceSelection\(view\.options, null\)\)/);
  assert.match(source, /setMicSelected\(initialDeviceSelection\(view\.options, j && j\.lastDevice\)\)/, "マイクは今までどおり前回のマイク");
});

test("配信の準備: 場が開いている間はマイク・文字起こしだけ触れない（YouTube の URL・Connect・ゲームの窓は触れる）", () => {
  const prepare = panel("prepare", "role");
  assert.match(prepare, /id="device-select"[\s\S]{0,200}?disabled=\$\{inputsLocked\}/);
  assert.match(prepare, /id="stt-engine-select"[\s\S]{0,200}?disabled=\$\{inputsLocked\}/);
  assert.match(prepare, /\$\{inputsLocked \? html`<span class="drawer-hint">\$\{STREAM_LOCKED_INPUTS_NOTE\}<\/span>` : null\}/);
  for (const free of ['id="chat-source"', 'class="btn-chat-connect"', 'id="vision-target-select"', 'class="btn-vision-target-set"']) {
    const start = prepare.indexOf(free);
    const tagEnd = prepare.indexOf(">", start);
    assert.doesNotMatch(prepare.slice(start, prepare.indexOf("/>", start) > 0 ? Math.min(prepare.indexOf("/>", start), tagEnd + 400) : tagEnd), /inputsLocked|roleLocked|streamLocked/, `${free} は場の途中も触れる`);
  }
});

test("配信の準備: YouTube の欄は離れたら保存する（POST /api/chat/source）・「配信を始める」は保存が済んでから頼む・欄の下に案内（配信の組み直し 仕上げ）", () => {
  const prepare = panel("prepare", "role");
  const source = read("settings-drawer.mjs");
  assert.match(prepare, /id="chat-source"[\s\S]{0,600}?onChange=\$\{onChatSourceCommit\}/, "欄の change（入れ終えて離れた・Enter）で保存する");
  assert.match(source, /const saving = postJson\("\/api\/chat\/source", \{ source \}\)/);
  assert.match(source, /chatSaveRef\.current = saving;/);
  assert.match(source, /Promise\.resolve\(chatSaveRef\.current\)\n\s+\.catch\(\(\) => \{\}\)\n\s+\.then\(\(\) => postJson\("\/api\/stream\/start", \{ device, sttEngine: sttSelected \|\| "whisper" \}\)\)/, "保存が済んでから始める（この起動で入れた URL をサーバが知っている順）");
  assert.match(source, /const chatHint = chatAutoConnectHint\(settings && settings\.chat, settings && settings\.stream\);/);
  assert.match(prepare, /\$\{chatHint \? html`<span class="drawer-hint chat-auto-connect-hint">\$\{chatHint\}<\/span>` : null\}/);
});

test("chatAutoConnectHint: 場が閉じていてつながっていないときだけ — この起動で入れた URL は「配信を始めるとつなぐ」・前回の起動から残っているだけの URL は「自動ではつながない」", () => {
  const closed = { phase: "closed" };
  assert.equal(chatAutoConnectHint({ source: "https://y/today", connected: false, enteredThisBoot: true }, closed), CHAT_CONNECT_ON_START_HINT);
  assert.equal(chatAutoConnectHint({ source: "https://y/old", connected: false, enteredThisBoot: false }, closed), CHAT_PREVIOUS_SOURCE_HINT);
  assert.match(CHAT_PREVIOUS_SOURCE_HINT, /自動ではつながない/);
  assert.equal(chatAutoConnectHint({ source: null, connected: false, enteredThisBoot: false }, closed), null, "欄が空なら出さない");
  assert.equal(chatAutoConnectHint({ source: "https://y/today", connected: true, enteredThisBoot: true }, closed), null, "つながっていれば出さない");
  for (const phase of ["opening", "open", "closing"]) {
    assert.equal(chatAutoConnectHint({ source: "https://y/old", connected: false, enteredThisBoot: false }, { phase }), null, `${phase} は出さない（場の途中は Connect）`);
  }
  assert.equal(chatAutoConnectHint(null, closed), null);
  assert.equal(chatAutoConnectHint({ source: "x", connected: false }, null), null, "stream を持たない古いサーバでは出さない");
});

test("chatConnectErrorText は 409（配信を始めている・終えている途中）でサーバの文面をそのまま出す・chatSourceSaveErrorText は失敗だけ文言にする", () => {
  assert.equal(chatConnectErrorText({ status: 409, ok: false, j: { error: "配信を終えている途中（記録中・少し待ってからもう一度）" } }), "配信を終えている途中（記録中・少し待ってからもう一度）");
  assert.match(String(chatConnectErrorText({ status: 409, ok: false, j: null })), /少し待ってから/);
  assert.equal(chatConnectErrorText({ status: 200, ok: true, j: {} }), null);
  assert.equal(chatSourceSaveErrorText({ status: 200, ok: true, j: {} }), null);
  assert.equal(chatSourceSaveErrorText({ status: 400, ok: false, j: { error: "bad" } }), "save failed: bad");
  assert.equal(requestErrorText("chatSource", "boom"), "chat source error: boom");
});

test("配信の準備: 「配信を始める」は選んだマイク・文字起こしで始め、始められなかった理由は stream.error（メイン画面と同じ値）を出す・配信中は案内だけ", () => {
  const prepare = panel("prepare", "role");
  assert.match(prepare, /\$\{startView\.phase === "open" \? html`/);
  assert.match(prepare, /配信中（終えるときは下の帯の「配信を終える」）/);
  assert.match(prepare, /class="btn-start" type="button" disabled=\$\{startBusy \|\| startView\.startDisabled\} onClick=\$\{onStart\}/);
  assert.match(prepare, /\$\{startView\.errorText\}/);
  assert.match(read("settings-drawer.mjs"), /const startView = streamStartView\(settings && settings\.stream, startRequestError\);/);
});

// ── 設定のダイアログ: ロール ───────────────────────────────────────────────

test("ロール: 今日のロールの選択は場が閉じている間だけ・ロールの編集（名前・モデル・性格の指示・声・口数・話し始め・体）と新しいロール", () => {
  const role = panel("role", "drive");
  const list = role.slice(role.indexOf("` : html`"));
  assert.match(list, /id="role-select"[\s\S]{0,300}?disabled=\$\{roleLocked\}/);
  assert.match(list, /class="btn-role-set" type="button" disabled=\$\{roleLocked\}/);
  const order = [
    '<label for="role-display">見せる名前</label>',
    '<label for="role-canonical">呼び名</label>',
    '<label for="role-latin">ローマ字</label>',
    '<label for="role-model-select">モデル</label>',
    "性格の指示を編集",
    '<label for="role-voice-engine-select">声</label>',
    '<label for="role-aivis-speaker">AivisSpeech の話者</label>',
    '<label for="role-elevenlabs-voice">ElevenLabs の声の id</label>',
    "<${VerbositySelect}",
    "<${SpeakStartSelect}",
    'class="role-body-toggle"',
    'class="btn-role-save"',
    '<h3 class="drawer-subhead">新しいロール</h3>',
    "今のロールを写して作る",
    '<h3 class="drawer-subhead">会話の圧縮</h3>'
  ];
  let last = -1;
  for (const needle of order) {
    const at = list.indexOf(needle);
    assert.ok(at > last, `${needle} の並び`);
    last = at;
  }
  // 編集の入力はどれも場の途中は固まる（roleInputsDisabled = roleLocked || 置き場が無い || 下書きが無い）。
  assert.equal((list.match(/disabled=\$\{roleInputsDisabled\}/g) || []).length, 10, "見せる名前・呼び名・ローマ字・モデル・声・話者・声の id・口数・話し始め・体");
  assert.match(read("settings-drawer.mjs"), /const roleInputsDisabled = roleLocked \|\| !roleEditable \|\| !roleDraft;/);
  assert.match(list, /disabled=\$\{roleInputsDisabled \|\| roleEditBusy \|\| !roleDraftIsDirty\} onClick=\$\{onRoleSave\}/, "変えていなければ保存を押せない");
  assert.match(list, /disabled=\$\{roleLocked \|\| !roleEditable \|\| newRoleBusy\} onClick=\$\{onRoleCreate\}/);
});

test("ロール: 保存は POST /api/role/edit（rolePatchFromDraft）・新しいロールは POST /api/role/new（今のロールを写す）・どちらも成功で snapshot を適用", () => {
  const source = read("settings-drawer.mjs");
  assert.match(source, /const built = rolePatchFromDraft\(roleDraft\);[\s\S]*?postJson\("\/api\/role\/edit", built\.patch\)[\s\S]*?roleEditPostErrorText\(res\)[\s\S]*?applySnapshot\(res\.j\)/);
  assert.match(source, /const err = newRoleIdError\(newRoleId, existing\);[\s\S]*?postJson\("\/api\/role\/new", \{ id: newRoleId\.trim\(\), name: newRoleName\.trim\(\) \|\| null \}\)[\s\S]*?applySnapshot\(res\.j\)/);
  // 下書きは snapshot の role から作り、未保存の間は上書きしない。
  assert.match(source, /const roleBaseline = roleDraftFromStatus\(settings && settings\.role\);/);
  assert.match(source, /return roleDraftDirty\(draft, previous\) \? draft : next;/);
});

test("ロール: 今の会話指示の編集はロールの編集の「性格の指示」に収めた（同じタブの中のページ・戻り先はロール・場の途中は書けない）", () => {
  const role = panel("role", "drive");
  const editorSide = role.slice(0, role.indexOf("` : html`"));
  assert.match(editorSide, /<\$\{ConversationInstructionEditor\}/);
  assert.match(editorSide, /locked=\$\{roleLocked\}/);
  assert.equal(panel("prepare", "role").includes("ConversationInstructionEditor"), false);
  const locked = ConversationInstructionEditor({ roleId: "chappy", roleName: "チャッピー", brainLabel: "GPT-6.1 Sol", state: { draft: "x", status: "idle", dirty: true }, locked: true });
  const elements = collectElements(locked);
  assert.equal(elements.find((n) => n.type === "textarea").props.disabled, true, "場の途中は書けない");
  assert.ok(elements.filter((n) => n.type === "button" && /conversation-instruction-(save|reset)/.test(n.props.class)).every((b) => b.props.disabled === true));
  const text = collectText(locked).join("");
  assert.match(text, /← ロール/);
  assert.match(text, /配信の途中は性格の指示を直せない/);
  const unlocked = collectElements(ConversationInstructionEditor({ roleId: "chappy", state: { draft: "x", status: "idle", dirty: true } }));
  assert.equal(unlocked.find((n) => n.type === "textarea").props.disabled, false);
});

test("ロールの編集の口数・話し始め: 場の途中は固まる（VerbositySelect / SpeakStartSelect の disabled）", () => {
  const v = collectElements(VerbositySelect({ verbosity: "quiet", onChange() {}, disabled: true })).find((n) => n.type === "select");
  assert.equal(v.props.disabled, true);
  assert.equal(v.props.value, "quiet");
  const s = collectElements(SpeakStartSelect({ speakStart: "classic", onChange() {}, disabled: true })).find((n) => n.type === "select");
  assert.equal(s.props.disabled, true);
  const free = collectElements(SpeakStartSelect({ speakStart: "classic", onChange() {} })).find((n) => n.type === "select");
  assert.equal(free.props.disabled, false);
});

// ── 設定のダイアログ: 運転・記憶 ─────────────────────────────────────────────

test("運転: 自発・かぶり・手動の発火だけ（口数・話し始め・忙しい間のコメントは外した）", () => {
  const drive = read("control-bar.mjs");
  const body = drive.slice(drive.indexOf("export function DrivePanel"));
  assert.match(body, /<\$\{SelfFirePill\}/);
  assert.match(body, /<\$\{BargeInPill\}/);
  assert.match(body, /<\$\{FireButtons\}/);
  for (const gone of ["<${VerbositySelect}", "<${SpeakStartSelect}", "<${CommentBusySelect}", "/api/verbosity", "/api/speak-start", "/api/comment-busy"]) {
    assert.equal(body.includes(gone), false, gone);
  }
  const app = read("app.mjs");
  assert.doesNotMatch(app, /verbosity=\$\{settings\.verbosity\}|speakStart=\$\{settings\.speakStart\}/, "App も運転のタブへ口数・話し始めを渡さない");
});

test("記憶: そのロールの記憶（memoryPlaceLabel）と「今日を記録」（場が開いている間だけ押せる見た目）", () => {
  const memory = panel("memory", "log");
  assert.match(memory, /\$\{memoryPlaceLabel\(settings && settings\.memory\)\}/);
  assert.match(memory, /class="btn-memory-record" type="button" disabled=\$\{recordView\.disabled\} onClick=\$\{onMemoryRecord\}/);
  assert.match(memory, /\$\{recordView\.note \? html`<span class="drawer-hint">\$\{recordView\.note\}<\/span>` : null\}/);
  assert.match(read("settings-drawer.mjs"), /const recordView = memoryRecordButtonView\(settings && settings\.stream, recordBusy\);/);
});
