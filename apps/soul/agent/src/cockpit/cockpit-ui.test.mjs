// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 操縦席 UI 改定 Domain B: preact コンポーネント層（src/cockpit/ui/）の機械テスト。
//  (1) Node インポートスモーク = 「トップレベル副作用ゼロ」の構造証明（document/EventSource の無い
//      Node で import が成功する・standalone vendor が bare import ゼロで Node からも読める事実の活用）。
//  (2) 構造テスト（s7 の独立性テスト流儀）: ui/*.mjs の import が ../vendor/・../view-logic/・./（ui 内）
//      に閉じている（魂の他部位・node:* を import しない = ブラウザコード純度）。
//  (3) rows.mjs の fixture: SSE イベント → 行レコードが現 cockpit.html の表示文字列と機能同値・
//      speaking 行の規律・**意図的非表示（view-logic が null）で行を作らない**の機械的遵守。
//  (4) hooks を使わないコンポーネント（TopBar/HealthLine/FeedRow）の vnode 走査スモーク（render 不要・
//      preact 公開形状 type/props のみに依存）。
// このファイルは src/cockpit/ 直下（配信サブツリー外）に置く: 静的配信ツリー（/ui/*.mjs）へ
// node:test を import するファイルを混ぜないため。

const COCKPIT_DIR = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.join(COCKPIT_DIR, "ui");

import { SSE_EVENT_NAMES, App, mount, initialHealth, settingsFromSnapshot } from "./ui/app.mjs";
import { TopBar, HealthLine, HealthStat, identityDisplayName, cockpitDocumentTitle, NEUTRAL_COCKPIT_TITLE } from "./ui/header.mjs";
import { Feed, FeedRow, isStuckToBottom, STICK_THRESHOLD_PX } from "./ui/feed.mjs";
import {
  emptyFeed,
  feedWithTranscript,
  feedWithGhost,
  feedWithFireMarker,
  feedWithExpression,
  feedWithVisionMarker,
  feedWithBargeInMarker,
  feedWithSelfFireMarker,
  feedWithSpeaking,
  feedFromHistory,
  feedAfterSseEvent
} from "./ui/rows.mjs";
import { COCKPIT_CSS, injectStyles } from "./ui/styles.mjs";
import { DrivePanel, FireButtons, SelfFirePill, VerbositySelect, BargeInPill, VERBOSITY_OPTIONS } from "./ui/control-bar.mjs";
import {
  SettingsDrawer,
  CockpitSettingsModal,
  SETTINGS_CATEGORIES,
  settingsModalNextCategory,
  settingsModalKeyboardCategoryAction,
  settingsModalGuardedNavigation,
  settingsModalEventRoute,
  settingsModalCloseAction,
  settingsModalFocusBoundary,
  settingsModalFocusableNodes,
  settingsModalFocusEntryTarget,
  settingsModalFocusReturnTarget,
  SettingsSelect,
  DrawerStatus
} from "./ui/settings-drawer.mjs";
import { ConversationInstructionEditor } from "./ui/conversation-instruction-editor.mjs";
import { soulStatusView, selfFireToggleView, killSwitchView, bargeInToggleView } from "./view-logic/control.mjs";
import { chatStatusView, channelStatusView } from "./view-logic/status.mjs";
import { BRAIN_LABELS } from "./view-logic/health.mjs";
import { conversationBrainIdentity } from "./view-logic/conversation-instruction.mjs";

// ── (1) Node インポートスモーク（import 文自体が成功している時点で副作用ゼロの構造証明）──

test("ui import スモーク: 全 ui/*.mjs が Node で import でき、主要 export が関数/文字列", () => {
  for (const fn of [App, mount, TopBar, HealthLine, HealthStat, Feed, FeedRow, injectStyles,
    emptyFeed, feedWithTranscript, feedWithGhost, feedWithFireMarker, feedWithExpression,
    feedWithVisionMarker, feedWithBargeInMarker, feedWithSelfFireMarker, feedWithSpeaking,
    feedFromHistory, feedAfterSseEvent, isStuckToBottom, settingsFromSnapshot, initialHealth]) {
    assert.equal(typeof fn, "function");
  }
  assert.equal(typeof COCKPIT_CSS, "string");
  assert.ok(COCKPIT_CSS.length > 0);
  // ここまで到達した = ui/*.mjs のトップレベルが document/EventSource/window に触れていない
  // （触れていれば Node では ReferenceError で import 自体が落ちる）。
});

// ── (2) 構造テスト: ui のブラウザコード純度（import の閉包・s7 独立性テスト流儀）──

test("ui 構造: ui/*.mjs の import は ../vendor/・../view-logic/・./（ui 内）に閉じる", () => {
  const files = readdirSync(UI_DIR).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.length >= 5, "ui/ に .mjs が 5 つ以上ある（app/header/feed/rows/styles）");
  const importRe = /(?:^|\n)\s*import\s[^;]*?from\s+["']([^"']+)["']/g;
  for (const f of files) {
    const src = readFileSync(path.join(UI_DIR, f), "utf8");
    for (const m of src.matchAll(importRe)) {
      const spec = m[1];
      const allowed =
        spec === "../vendor/htm.preact.standalone.mjs" ||
        (spec.startsWith("../view-logic/") && spec.endsWith(".mjs")) ||
        (spec.startsWith("./") && spec.endsWith(".mjs") && !spec.includes("/../"));
      assert.ok(allowed, `${f} の import "${spec}" は許可先（vendor/view-logic/ui 内）ではない`);
      assert.ok(!spec.startsWith("node:"), `${f} が node:* を import している（ブラウザコード純度違反）`);
    }
  }
});

// ── (3) SSE 購読リスト = 既存 13 SSE + 操縦席の作り直し 1 回目の 4 本の写像（移植漏れゼロの機械的固定点）──

test("SSE_EVENT_NAMES: 既存 13 本 + fireAsk / latency / quota / warnings の 17 本と 1:1（名前・本数を固定）", () => {
  assert.deepEqual(SSE_EVENT_NAMES, [
    "state", "vad", "transcript", "expression", "discard", "diagnostic", "soul",
    "fire", "visionCaptured", "usage", "selfFire", "chatStatus", "chatDiagnostic",
    "fireAsk", "latency", "quota", "warnings"
  ]);
  assert.equal(SSE_EVENT_NAMES.length, 17);
});

// ── (4) rows fixture: 現 cockpit.html と機能同値の行レコード ──
// 時刻はローカル成分から epoch を作り TZ 非依存に検証（format-time.test.mjs の流儀）。

const T0 = new Date(2026, 6, 14, 14, 2, 11).getTime(); // ローカル 14:02:11
const T1 = new Date(2026, 6, 14, 14, 3, 40).getTime(); // ローカル 14:03:40

test("transcript: 話者ラベル・行クラス・latency が現 HTML 同値（addTranscriptRow :386-408）", () => {
  // live 行（latencyMs あり・appendedAtMs 時刻）。
  let feed = feedWithTranscript(emptyFeed(), {
    speaker: "viewer", displayName: "taro", text: "がんばれー", latencyMs: 1500, appendedAtMs: T0
  }, T1);
  assert.equal(feed.rows.length, 1);
  const row = feed.rows[0];
  assert.equal(row.kind, "transcript");
  assert.equal(row.timeText, "14:02:11"); // appendedAtMs 優先（:392）
  assert.equal(row.rowClass, "row speaker-viewer");
  assert.equal(row.whoText, "viewer(taro)");
  assert.equal(row.text, "がんばれー");
  assert.equal(row.latText, "(1.5s)");
  // speaker 欠落は you・latencyMs 無しは latText null（履歴行と同じ）。
  feed = feedWithTranscript(emptyFeed(), { text: "ボス強すぎ", appendedAtMs: T0 }, T1);
  assert.equal(feed.rows[0].rowClass, "row speaker-you");
  assert.equal(feed.rows[0].whoText, "you");
  assert.equal(feed.rows[0].latText, null);
  // appendedAtMs 欠落は nowMs へフォールバック。
  feed = feedWithTranscript(emptyFeed(), { text: "x" }, T1);
  assert.equal(feed.rows[0].timeText, "14:03:40");
});

test("transcript: brain 札（多頭化 Domain C・d.brain が additive に latText へ織り込まれる）", () => {
  // soul 行 + brain 札あり → "(Ns · brain)"。
  let feed = feedWithTranscript(emptyFeed(), {
    speaker: "soul", text: "はい", latencyMs: 2345, brain: "claude", appendedAtMs: T0
  }, T1);
  assert.equal(feed.rows[0].latText, "(2.3s · claude)");
  // brain 未搭載（you/viewer 行や brain 未注入時の soul 行）は従来どおり (Ns) のみ。
  feed = feedWithTranscript(emptyFeed(), { speaker: "soul", text: "はい", latencyMs: 2345, appendedAtMs: T0 }, T1);
  assert.equal(feed.rows[0].latText, "(2.3s)");
});

test("speaking 行の規律: transcript/ghost は除去してから積む・マーカー行は除去しない", () => {
  let feed = feedWithSpeaking(emptyFeed(), true);
  assert.deepEqual(feed.rows.map((r) => r.kind), ["speaking"]);
  // 二重 show は同一 feed（showSpeakingRow :375 `if (speakingRow) return;`）。
  assert.equal(feedWithSpeaking(feed, true), feed);
  // マーカー行（fire）は speaking を残したまま後ろに積む（原実装は removeSpeakingRow を呼ばない）。
  feed = feedWithFireMarker(feed, { includedCount: 3, injectedChars: 42 }, T0);
  assert.deepEqual(feed.rows.map((r) => r.kind), ["speaking", "fire-marker"]);
  // transcript は speaking を除去してから積む（:387）。
  feed = feedWithTranscript(feed, { text: "hello", appendedAtMs: T0 }, T0);
  assert.deepEqual(feed.rows.map((r) => r.kind), ["fire-marker", "transcript"]);
  // ghost も同様（:418）。
  feed = feedWithSpeaking(feed, true);
  feed = feedWithGhost(feed, "(discarded)", T0);
  assert.deepEqual(feed.rows.map((r) => r.kind), ["fire-marker", "transcript", "ghost"]);
  // hide: あれば除去・なければ同一 feed。
  const shown = feedWithSpeaking(feed, true);
  assert.deepEqual(feedWithSpeaking(shown, false).rows.map((r) => r.kind),
    ["fire-marker", "transcript", "ghost"]);
  assert.equal(feedWithSpeaking(feed, false), feed);
});

test("feedWithGhost: label null は行を作らない（意図的非表示の機械的遵守・同一 feed）", () => {
  const feed = feedWithSpeaking(emptyFeed(), true);
  // null → 同一 feed（speaking 行も除去しない = 何も起きない）。
  assert.equal(feedWithGhost(feed, null, T0), feed);
  // 実ラベルは ghost 行（時刻は nowMs・話者不明で text のみ）。
  const g = feedWithGhost(feed, "(asr failed)", T0);
  assert.deepEqual(g.rows.map((r) => r.kind), ["ghost"]);
  assert.equal(g.rows[0].timeText, "14:02:11");
  assert.equal(g.rows[0].text, "(asr failed)");
});

test("マーカー行: fire/expression/vision/barge-in/self-fire の文字列が現 HTML 同値", () => {
  // fire: atMs 優先の時刻（:452）+ fireMarkerText。
  let feed = feedWithFireMarker(emptyFeed(), { includedCount: 3, injectedChars: 42, atMs: T0 }, T1);
  assert.equal(feed.rows[0].timeText, "14:02:11");
  assert.deepEqual(
    [feed.rows[0].whoText, feed.rows[0].markerText, feed.rows[0].text],
    ["fire", "*", "fired (3 lines, 42 chars injected)"]
  );
  // expression: args あり形。
  feed = feedWithExpression(emptyFeed(), { word: "troubled", args: "0.8", applied: 4, rejected: 1 }, T0);
  assert.deepEqual([feed.rows[0].whoText, feed.rows[0].text], ["expr", "troubled 0.8 ✓4/✗1"]);
  // vision: サムネ data URI（非保存・<img> にだけ渡す）。
  feed = feedWithVisionMarker(emptyFeed(), {
    title: "FooGame", width: 1920, height: 1080, elapsedMs: 123, jpegBase64: "abc123"
  }, T0);
  assert.equal(feed.rows[0].text, 'saw "FooGame" (1920x1080, 123ms)');
  assert.equal(feed.rows[0].thumbSrc, "data:image/jpeg;base64,abc123");
  // jpegBase64 欠落はサムネ無し（:498 `if (d.jpegBase64)`）。
  feed = feedWithVisionMarker(emptyFeed(), { title: "F", width: 1, height: 1, elapsedMs: 1 }, T0);
  assert.equal(feed.rows[0].thumbSrc, null);
  // barge-in。
  feed = feedWithBargeInMarker(emptyFeed(), { charsSpoken: 3, totalChars: 10, elapsedMs: 250 }, T0);
  assert.deepEqual(
    [feed.rows[0].whoText, feed.rows[0].markerText, feed.rows[0].text],
    ["barge-in", "!!", "interrupted (3/10 chars spoken, 250ms)"]
  );
  // self-fire。
  feed = feedWithSelfFireMarker(emptyFeed(), { kind: "silence" }, T0);
  assert.deepEqual([feed.rows[0].whoText, feed.rows[0].markerText, feed.rows[0].text],
    ["self", "~", "self-fire (silence)"]);
});

test("feedFromHistory: 全置換・履歴行に latency 無し（renderHistory :410-413）", () => {
  const feed = feedFromHistory(
    [
      { speaker: "you", text: "a", appendedAtMs: T0 },
      { speaker: "soul", text: "b", appendedAtMs: T1 },
      { speaker: "viewer", displayName: "taro", text: "c", appendedAtMs: T1 }
    ],
    T1
  );
  assert.deepEqual(feed.rows.map((r) => [r.kind, r.whoText, r.latText]), [
    ["transcript", "you", null],
    ["transcript", "soul", null],
    ["transcript", "viewer(taro)", null]
  ]);
  // 空履歴は空フィード（timeline.innerHTML = "" と同値）。
  assert.deepEqual(feedFromHistory([], T0).rows, []);
  assert.deepEqual(feedFromHistory(undefined, T0).rows, []);
});

// ── (5) feedAfterSseEvent: SSE → タイムラインの単一経路（subscribe :814-897 の分岐移植）──

test("feedAfterSseEvent: vad は speechStart で出現・speechEnd/speechCancel で消滅・未知 type は無変化", () => {
  let feed = feedAfterSseEvent(emptyFeed(), "vad", { type: "speechStart" }, T0);
  assert.deepEqual(feed.rows.map((r) => r.kind), ["speaking"]);
  assert.deepEqual(feedAfterSseEvent(feed, "vad", { type: "speechEnd" }, T0).rows, []);
  assert.deepEqual(feedAfterSseEvent(feed, "vad", { type: "speechCancel" }, T0).rows, []);
  assert.equal(feedAfterSseEvent(feed, "vad", { type: "somethingElse" }, T0), feed);
});

// ── ディスパッチ経路の固定（W4 回帰保護の穴埋め・Orch/test レーン指摘）──
// transcript/expression/visionCaptured の 3 case は、行構築関数（feedWithTranscript 等）を**直接**呼ぶ
// fixture（上の (4) 節）では踏まれるが、**feedAfterSseEvent のディスパッチ経路**（case ラベル → 行構築
// 関数の対応）は通っていなかった。この 3 case を誤変更（case ラベル改名 → default に落ちて rows 空 /
// 内部で別の行構築関数に取り違え → kind・表示フィールドが変わる）しても緑のままになる穴を、必ず
// feedAfterSseEvent を入口にした行種 class + 表示フィールドの検証で塞ぐ。

test("feedAfterSseEvent: transcript は転写行へディスパッチ（case→feedWithTranscript の対応を固定）", () => {
  const feed = feedAfterSseEvent(emptyFeed(), "transcript", {
    speaker: "viewer", displayName: "taro", text: "がんばれー", latencyMs: 1500, appendedAtMs: T0
  }, T1);
  assert.equal(feed.rows.length, 1);
  const row = feed.rows[0];
  assert.equal(row.kind, "transcript"); //                改名なら default 落ち（rows 空）・取り違えなら別 kind で RED
  assert.equal(row.rowClass, "row speaker-viewer"); //    speakerRowClass 由来（feedWithExpression 等には無いフィールド）
  assert.equal(row.whoText, "viewer(taro)"); //           speakerLabel 由来
  assert.equal(row.text, "がんばれー");
  assert.equal(row.latText, "(1.5s)"); //                 latencyLabel 由来（live 行のみ）
  assert.equal(row.timeText, "14:02:11"); //              appendedAtMs 優先
});

test("feedAfterSseEvent: expression は演出行へディスパッチ（case→feedWithExpression の対応を固定）", () => {
  const feed = feedAfterSseEvent(emptyFeed(), "expression",
    { word: "troubled", args: "0.8", applied: 4, rejected: 1 }, T0);
  assert.equal(feed.rows.length, 1);
  const row = feed.rows[0];
  assert.equal(row.kind, "expression"); //   transcript 等へ取り違えたら kind が変わって RED
  assert.equal(row.whoText, "expr");
  assert.equal(row.text, "troubled 0.8 ✓4/✗1"); // expressionRowText 由来（誤った関数だと文字列が変わる）
});

test("feedAfterSseEvent: visionCaptured は視覚マーカー行へディスパッチ（case→feedWithVisionMarker の対応を固定）", () => {
  const feed = feedAfterSseEvent(emptyFeed(), "visionCaptured", {
    title: "FooGame", width: 1920, height: 1080, elapsedMs: 123, jpegBase64: "abc123"
  }, T0);
  assert.equal(feed.rows.length, 1);
  const row = feed.rows[0];
  assert.equal(row.kind, "vision-marker"); //             取り違えなら別 kind で RED
  assert.equal(row.text, 'saw "FooGame" (1920x1080, 123ms)'); // visionMarkerText 由来
  assert.equal(row.thumbSrc, "data:image/jpeg;base64,abc123"); // 非保存の data URI（他の行構築関数には無い）
});

test("feedAfterSseEvent: diagnostic は bargeIn を先に専用マーカー行へ分流（L0 裁定・:842）", () => {
  const feed = feedAfterSseEvent(
    emptyFeed(), "diagnostic",
    { type: "bargeIn", charsSpoken: 3, totalChars: 10, elapsedMs: 250 }, T0
  );
  assert.equal(feed.rows[0].kind, "barge-in-marker");
  assert.equal(feed.rows[0].text, "interrupted (3/10 chars spoken, 250ms)");
});

test("feedAfterSseEvent: diagnostic の表示型はゴースト行・意図的非表示型は行を作らない", () => {
  // 表示型（例: asrFailure / fireVisionError の kind+message 形）。
  let feed = feedAfterSseEvent(emptyFeed(), "diagnostic", { type: "asrFailure" }, T0);
  assert.deepEqual([feed.rows[0].kind, feed.rows[0].text], ["ghost", "(asr failed)"]);
  feed = feedAfterSseEvent(emptyFeed(), "diagnostic",
    { type: "fireVisionError", kind: "no-target", message: "not configured" }, T0);
  assert.equal(feed.rows[0].text, "(vision fire: no-target — not configured)");
  // 意図的非表示（expressionBrokenTag/expressionRejected/expressionSendError・page test :244-246 根拠）
  // + 未知型 = view-logic が null → **行を作らない**。
  const base = emptyFeed();
  for (const type of ["expressionBrokenTag", "expressionRejected", "expressionSendError", "futureUnknown"]) {
    assert.equal(feedAfterSseEvent(base, "diagnostic", { type }, T0), base, `${type} は非表示`);
  }
});

test("feedAfterSseEvent: fire は accepted:true のみマーカー行（false はタイムライン無変化）", () => {
  const feed = feedAfterSseEvent(emptyFeed(), "fire",
    { accepted: true, includedCount: 2, injectedChars: 10, atMs: T0 }, T1);
  assert.equal(feed.rows[0].kind, "fire-marker");
  const base = emptyFeed();
  assert.equal(feedAfterSseEvent(base, "fire", { accepted: false, reason: "busy" }, T0), base);
});

test("feedAfterSseEvent: selfFire は fired:true でマーカー行・fired:false でゴースト行", () => {
  let feed = feedAfterSseEvent(emptyFeed(), "selfFire", { kind: "comment-call", fired: true }, T0);
  assert.deepEqual([feed.rows[0].kind, feed.rows[0].text], ["self-fire-marker", "self-fire (comment-call)"]);
  feed = feedAfterSseEvent(emptyFeed(), "selfFire", { kind: "silence", fired: false, reason: "busy" }, T0);
  assert.deepEqual([feed.rows[0].kind, feed.rows[0].text], ["ghost", "(self-fire: silence not fired — busy)"]);
});

test("feedAfterSseEvent: discard/chatDiagnostic はゴースト行・観測補助 kind は行を作らない", () => {
  let feed = feedAfterSseEvent(emptyFeed(), "discard", { discarded: 4 }, T0);
  assert.deepEqual([feed.rows[0].kind, feed.rows[0].text], ["ghost", "(discarded)"]);
  feed = feedAfterSseEvent(emptyFeed(), "chatDiagnostic", { kind: "notLive", message: "not started" }, T0);
  assert.equal(feed.rows[0].text, "(chat: notLive — not started)");
  const base = emptyFeed();
  for (const kind of ["connected", "stopped", "ignoredRenderers", "listenerError"]) {
    assert.equal(feedAfterSseEvent(base, "chatDiagnostic", { kind }, T0), base, `${kind} は非表示`);
  }
});

test("feedAfterSseEvent: state/soul/usage/chatStatus はタイムライン行を作らない", () => {
  const base = feedWithTranscript(emptyFeed(), { text: "x", appendedAtMs: T0 }, T0);
  assert.equal(feedAfterSseEvent(base, "state", { ears: "listening" }, T0), base);
  assert.equal(feedAfterSseEvent(base, "soul", { state: "thinking" }, T0), base);
  assert.equal(feedAfterSseEvent(base, "usage", { usage: { input_tokens: 1 } }, T0), base);
  assert.equal(feedAfterSseEvent(base, "chatStatus", { status: "live" }, T0), base);
});

test("行 id: 単調増加で一意（preact の key・履歴復元後も衝突しない）", () => {
  let feed = feedFromHistory([{ text: "a" }, { text: "b" }], T0);
  feed = feedWithGhost(feed, "(discarded)", T0);
  feed = feedWithFireMarker(feed, {}, T0);
  const ids = feed.rows.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
});

// ── (6) 自動スクロールの判定純関数（モック §2: 末尾追従・上へスクロールで停止）──

test("isStuckToBottom: 末尾近傍のみ true（閾値 STICK_THRESHOLD_PX）", () => {
  assert.equal(isStuckToBottom({ scrollTop: 960, scrollHeight: 1200, clientHeight: 240 }), true); // ぴったり末尾
  assert.equal(
    isStuckToBottom({ scrollTop: 960 - STICK_THRESHOLD_PX + 1, scrollHeight: 1200, clientHeight: 240 }),
    true
  ); // 閾値内
  assert.equal(
    isStuckToBottom({ scrollTop: 960 - STICK_THRESHOLD_PX, scrollHeight: 1200, clientHeight: 240 }),
    false
  ); // 閾値ちょうどは追従しない
  assert.equal(isStuckToBottom({ scrollTop: 0, scrollHeight: 1200, clientHeight: 240 }), false); // 上端
});

// ── (7) app の純関数（snapshot → Domain C 向け設定現況・health 初期値）──

test("settingsFromSnapshot: 設定系現況の取り出し（欠落は null・applyState :279-283 の入力）", () => {
  assert.deepEqual(settingsFromSnapshot(null), {
    channel: null, visionTarget: null, selfFire: null, verbosity: null, audioDevice: null, chat: null,
    bargeIn: null, // 「朗読と合いの手」: gate 未生成なら null（selfFire と同型）。
    speakStart: null, // speak-now 合意 §5: scheduler 未生成なら null（verbosity と同型）。
    commentBusy: null, // コメント反応の合意 §2: scheduler 未生成なら null（speakStart と同型）。
    killed: false, // S8: サーバ既定 false（他の null 許容フィールドとは非対称）。
    brain: null, // 多頭化 Domain C: audioDevice/channel と同型の null 許容。
    memory: null, // 配信間記憶: brain と同型の null 許容（memoryStatus 未注入なら null）。
    compaction: null // 圧縮の目安: memory と同型の null 許容（contextCompactionStatus 未注入なら null）。
  });
  const s = {
    channel: { configured: true, url: "ws://x — redacted" },
    visionTarget: { title: "FooGame" },
    selfFire: { enabled: true },
    verbosity: "chatty",
    speakStart: "speak-now",
    commentBusy: "hold",
    audioDevice: { name: "MV7+" },
    chat: { source: "abc", connected: true, state: "live" },
    bargeIn: { enabled: false },
    killed: true,
    brain: { brain: "codex", credentialHealth: true },
    memory: { lastRecordAtMs: 1721234567890, recording: false },
    compaction: { thresholdTokens: 200_000 }
  };
  assert.deepEqual(settingsFromSnapshot(s), s);
});

test("Settings modal「頭脳・会話」: 圧縮を始める大きさの select + Set を頭脳の区画に置き、POST /api/compact-threshold → snapshot 反映", () => {
  const source = readFileSync(path.join(UI_DIR, "settings-drawer.mjs"), "utf8");
  const brainPanel = source.slice(
    source.indexOf('id="cockpit-settings-panel-brain-conversation"'),
    source.indexOf('id="cockpit-settings-panel-memory"')
  );
  assert.ok(brainPanel.length > 0);
  // 置き場所: 頭脳・会話のタブ（会話指示の編集ページではない側）。
  const listSide = brainPanel.slice(brainPanel.indexOf("` : html`"));
  assert.match(listSide, /<h3 class="drawer-subhead">会話の圧縮<\/h3>/);
  assert.match(listSide, /<label for="compact-threshold-select">圧縮を始める大きさ<\/label>/);
  assert.match(listSide, /id="compact-threshold-select"[\s\S]*?options=\$\{compactThresholdOptions\(Number\(compactSelected\)\)\}/);
  assert.match(listSide, /class="btn-compact-threshold-set"[^>]*onClick=\$\{onCompactThresholdSet\}/);
  assert.match(listSide, /compactThresholdStatusLabel\(settings && settings\.compaction\)/, "既定であることが分かる表示");
  assert.match(listSide, /\$\{COMPACT_THRESHOLD_NOTE\}/, "Codex の頭のときだけ効く旨");
  assert.match(listSide, /\$\{compactError\}/);
  // 配線: トークン数（数）で POST し、view-logic の文言で失敗を出し、成功は snapshot を適用する。
  assert.match(
    source,
    /doFetch\("\/api\/compact-threshold", \{[\s\S]*?body: JSON\.stringify\(\{ tokens \}\)[\s\S]*?compactThresholdPostErrorText\(res\)[\s\S]*?applySnapshot\(res\.j\)[\s\S]*?requestErrorText\("compactThreshold", e\)/
  );
  assert.match(source, /const tokens = Number\(compactSelected\);/);
  // 現況同期: snapshot.compaction.thresholdTokens が変わったら select へ。
  assert.match(source, /compactThresholdSelection\(settings && settings\.compaction\)[\s\S]*?if \(compactCurrent != null\) setCompactSelected\(compactCurrent\)/);
  assert.match(COCKPIT_CSS, /\.drawer-section h3\.drawer-subhead \{ margin-top: 14px; \}/);
});

test("initialHealth: 初期表示 unknown（現 cockpit.html :158-159 の初期値と同値）", () => {
  assert.deepEqual(initialHealth(), {
    whisper: { status: "unknown", reason: null },
    ffmpeg: { status: "unknown", reason: null }
  });
});

test("cockpit.html: 静的初期 title は中立 Soul Cockpit（state 前に Cody/GPT を主張しない）", () => {
  const html = readFileSync(path.join(COCKPIT_DIR, "cockpit.html"), "utf8");
  assert.match(html, /<title>Soul Cockpit<\/title>/);
  assert.doesNotMatch(html, /こーでぃー|チャッピー|Claude|GPT/);
});

// ── (8) hooks 非使用コンポーネントの vnode 走査スモーク（render 不要・公開形状 type/props のみ）──

/** vnode ツリーからテキストを集める（関数コンポーネントは hooks 非使用前提で展開）。 */
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

test("FeedRow vnode スモーク: 各行種が view-logic 導出済み文字列を描く", () => {
  const texts = (row) => collectText(FeedRow({ row })).join("");
  assert.equal(texts({ kind: "speaking" }), "you······(speaking)");
  assert.equal(
    texts({ kind: "transcript", timeText: "14:02:11", rowClass: "row speaker-you", whoText: "you", text: "hi", latText: "(1.5s)" }),
    "14:02:11youhi(1.5s)"
  );
  // latText null は (Ns) を描かない（履歴行）。
  assert.equal(
    texts({ kind: "transcript", timeText: "14:02:11", rowClass: "row speaker-you", whoText: "you", text: "hi", latText: null }),
    "14:02:11youhi"
  );
  assert.equal(texts({ kind: "ghost", timeText: "14:02:11", text: "(discarded)" }), "14:02:11(discarded)");
  assert.equal(
    texts({ kind: "expression", timeText: "14:02:18", whoText: "expr", text: "troubled ✓4/✗0" }),
    "14:02:18↳exprtroubled ✓4/✗0"
  );
  assert.equal(
    texts({ kind: "fire-marker", timeText: "14:02:14", whoText: "fire", markerText: "*", text: "fired (3 lines, 42 chars injected)" }),
    "14:02:14fire*fired (3 lines, 42 chars injected)"
  );
  // vision: サムネ img は thumbSrc があるときだけ（テキストには出ない）。
  const visionRow = { kind: "vision-marker", timeText: "14:03:40", whoText: "vision", markerText: "*", text: 'saw "F" (1x1, 1ms)', thumbSrc: "data:image/jpeg;base64,x" };
  assert.equal(texts(visionRow), '14:03:40vision*saw "F" (1x1, 1ms)');
  assert.equal(texts({ kind: "unknown-kind" }), ""); // 未知 kind は何も描かない。
});

test("TopBar identity: サーバー提供の Cody/Chappy displayName を描き、欠落/未知は中立表示", () => {
  const props = { ears: "listening", soul: "idle", warnings: [], quota: null, nowMs: 0 };
  assert.equal(identityDisplayName({ id: "cody", displayName: "こーでぃー" }), "こーでぃー");
  assert.equal(identityDisplayName({ id: "chappy", displayName: "チャッピー" }), "チャッピー");
  assert.equal(identityDisplayName(null), NEUTRAL_COCKPIT_TITLE);
  assert.equal(identityDisplayName({ id: "gpt", displayName: "チャッピー" }), NEUTRAL_COCKPIT_TITLE);
  assert.equal(identityDisplayName({ id: "chappy", displayName: "stale" }), NEUTRAL_COCKPIT_TITLE);
  assert.equal(identityDisplayName({ id: "cody", displayName: "チャッピー" }), NEUTRAL_COCKPIT_TITLE);
  assert.equal(identityDisplayName({ id: "chappy", displayName: "こーでぃー" }), NEUTRAL_COCKPIT_TITLE);
  assert.equal(identityDisplayName({ id: 1, displayName: "こーでぃー" }), NEUTRAL_COCKPIT_TITLE);
  assert.equal(identityDisplayName({ id: "cody", displayName: 1 }), NEUTRAL_COCKPIT_TITLE);
  assert.equal(collectText(TopBar({ ...props, identity: { id: "cody", displayName: "こーでぃー" } })).join("").includes("こーでぃー"), true);
  assert.equal(collectText(TopBar({ ...props, identity: { id: "chappy", displayName: "チャッピー" } })).join("").includes("チャッピー"), true);
  assert.equal(collectText(TopBar({ ...props, identity: undefined })).join("").includes(NEUTRAL_COCKPIT_TITLE), true);
  assert.equal(cockpitDocumentTitle({ id: "cody", displayName: "こーでぃー" }), "こーでぃー — Soul Cockpit");
  assert.equal(cockpitDocumentTitle({ id: "chappy", displayName: "チャッピー" }), "チャッピー — Soul Cockpit");
  assert.equal(cockpitDocumentTitle({ id: "unknown", displayName: "GPT" }), NEUTRAL_COCKPIT_TITLE);
  assert.equal(cockpitDocumentTitle({ id: "cody", displayName: "チャッピー" }), NEUTRAL_COCKPIT_TITLE);
  assert.equal(cockpitDocumentTitle({ id: "chappy", displayName: "こーでぃー" }), NEUTRAL_COCKPIT_TITLE);
});

test("HealthLine vnode スモーク（ログのタブ）: ランプ・死活・声の出力先が乗る", () => {
  const vnode = HealthLine({
    ears: "listening",
    health: { whisper: { status: "up", reason: null }, ffmpeg: { status: "down", reason: "gone" } },
    audioDevice: { name: "MV7+" }
  });
  const text = collectText(vnode).join("");
  assert.ok(text.includes("Listening"), "ears 状態文言");
  assert.ok(text.includes("whisper"), "whisper 死活ラベル");
  assert.ok(text.includes("down — gone"), "down は reason 併記（healthStatusView 経由）");
  assert.ok(text.includes("MV7+"), "声の出力先（voiceOutputLabel 経由）");
});

// ── (9) styles: CSS 文字列の骨子（§7 の配色トークンが存在する・注入は冪等関数）──

test("COCKPIT_CSS: §7 承認配色トークンを含む（you 青・viewer 紫・barge-in 赤・teal・角丸 14px）", () => {
  assert.ok(COCKPIT_CSS.includes("--speaker-you: #7fb3ff"));
  assert.ok(COCKPIT_CSS.includes("--speaker-viewer: #c99be8"));
  assert.ok(COCKPIT_CSS.includes("--marker-barge: #e0928f"));
  assert.ok(COCKPIT_CSS.includes("--teal: #56d4b0"));
  assert.ok(COCKPIT_CSS.includes("--radius: 14px"));
  // ゴースト行 = グレー斜体（§7）。
  assert.match(COCKPIT_CSS, /\.row\.ghost \.text[^}]*font-style: italic/);
});

test("injectStyles: doc なしは何もしない（Node から安全に呼べる・実 DOM 注入は人間ゲート）", () => {
  assert.doesNotThrow(() => injectStyles(null));
  assert.doesNotThrow(() => injectStyles(undefined));
});

// ── (10) Domain C: 運転タブ + 設定引き出し（import スモーク / hooks 非使用部品の vnode 走査 / CSS）──
// DrivePanel / SettingsDrawer 本体は hooks（ローカル busy・入力欄 state）を使うため collectText の
// 「関数コンポーネント展開」流儀では走査できない（domain-b レビュー §6 申し送り 8）。
// → 表示導出は view-logic fixture（control.test.mjs / settings.test.mjs）で固定し、hooks 非使用の
//   葉部品（FireButtons/SelfFirePill/SettingsSelect/DrawerStatus）と上の帯の KILL（TopBar）を vnode 走査で固定する。

/** vnode ツリーから要素 vnode を集める（関数コンポーネントは hooks 非使用前提で展開）。 */
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

test("Domain C import スモーク: control-bar/settings-drawer が Node で import でき、主要 export が揃う", () => {
  for (const fn of [DrivePanel, FireButtons, SelfFirePill, VerbositySelect, BargeInPill, SettingsDrawer, CockpitSettingsModal, SettingsSelect, DrawerStatus]) {
    assert.equal(typeof fn, "function");
  }
  // 口数モードの選択肢（値は固定の 3 択・wave 計画「口数配線」§2 裁定 A で実配線済み）。
  assert.deepEqual(VERBOSITY_OPTIONS, [
    { value: "quiet", label: "控えめ" },
    { value: "normal", label: "ふつう" },
    { value: "chatty", label: "おしゃべり" }
  ]);
});

test("Cockpit Settings modal shell: one labelled dialog, six internal tabs (運転・ログを足した), and bounded prompt slot", () => {
  assert.deepEqual(SETTINGS_CATEGORIES.map((c) => c.id), ["connections", "input-output", "brain-conversation", "memory", "drive", "log"]);
  assert.deepEqual(SETTINGS_CATEGORIES.map((c) => c.label), ["接続", "入出力", "頭脳・会話", "記憶", "運転", "ログ"]);
  const source = readFileSync(path.join(UI_DIR, "settings-drawer.mjs"), "utf8");
  assert.match(source, /role="dialog"\s+aria-modal="true"/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.equal((source.match(/role="tabpanel"/g) || []).length, 6, "one panel per category");
  assert.match(source, /driveSlot/);
  assert.match(source, /logSlot/);
  assert.match(source, />準備・設定</);
  assert.match(source, /id="cockpit-settings-panel-connections"[\s\S]*?hidden=\$\{activeCategory !== "connections"\}/);
  assert.match(source, /data-prompt-editor-slot/);
  assert.doesNotMatch(source, /role="alertdialog"/);
  assert.match(source, /ev\.key === "Escape"/);
  assert.match(source, /ev\.target === ev\.currentTarget/);
  assert.match(source, /previousFocusRef/);
  assert.match(source, /\[hidden\]/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /closeRequestRef/);
  assert.equal(settingsModalNextCategory("connections", "ArrowRight"), "input-output");
  assert.equal(settingsModalNextCategory("connections", "ArrowLeft"), "log");
  assert.equal(settingsModalNextCategory("memory", "Home"), "connections");
  assert.equal(settingsModalNextCategory("connections", "End"), "log");
  assert.equal(settingsModalCloseAction({ dirty: false }), "close");
  assert.equal(settingsModalCloseAction({ dirty: true }), "prompt");
  assert.equal(settingsModalFocusBoundary(0, 3, true), 2);
  assert.equal(settingsModalFocusBoundary(2, 3, false), 0);
  const visible = { closest: () => null, getAttribute: () => null };
  const hidden = { closest: () => ({}), getAttribute: () => null };
  assert.deepEqual(settingsModalFocusableNodes([visible, hidden]), [visible]);
  assert.equal(settingsModalFocusEntryTarget([hidden, visible]), visible);
  const trigger = { focusCalled: false, focus() { this.focusCalled = true; } };
  assert.equal(settingsModalFocusReturnTarget(trigger, false), trigger);
  assert.equal(settingsModalFocusReturnTarget(trigger, true), null);
});

test("Cockpit Settings keyboard/category seam: Arrow/Home/End uses guarded navigation and focuses only after acceptance", () => {
  const tabs = ["connections", "input-output", "brain-conversation", "memory", "drive", "log"].map((id) => ({
    id: "cockpit-settings-tab-" + id,
    focusCount: 0,
    focus() { this.focusCount += 1; }
  }));
  const navigations = [];
  for (const [index, key, expected] of [
    [0, "ArrowRight", "input-output"],
    [1, "ArrowLeft", "connections"],
    [1, "End", "log"],
    [3, "Home", "connections"],
    [3, "ArrowRight", "drive"]
  ]) {
    const result = settingsModalKeyboardCategoryAction({
      tabs,
      currentIndex: index,
      key,
      onNavigate: (nextId, after) => {
        navigations.push({ nextId, after });
      }
    });
    assert.equal(result, expected);
    assert.equal(navigations.at(-1).nextId, expected);
    assert.equal(tabs.every((tab) => tab.focusCount === 0), true, "guard seam owns focus timing");
    navigations.at(-1).after();
    const target = tabs.find((tab) => tab.id === "cockpit-settings-tab-" + expected);
    assert.equal(target.focusCount, 1);
    for (const tab of tabs) tab.focusCount = 0;
  }

  let prompted = null;
  let proceeded = false;
  const pending = () => { proceeded = true; };
  assert.equal(settingsModalGuardedNavigation({
    dirty: true,
    action: pending,
    onPrompt: (action) => { prompted = action; }
  }), "prompt");
  assert.equal(proceeded, false);
  prompted();
  assert.equal(proceeded, true);
  let cleanProceed = false;
  assert.equal(settingsModalGuardedNavigation({
    dirty: false,
    action: () => { cleanProceed = true; },
    onPrompt: () => assert.fail("clean navigation must not prompt")
  }), "proceed");
  assert.equal(cleanProceed, true);
});

test("Cockpit Settings dirty event seam: back/category/brain/header/Escape/backdrop routes all prompt or proceed through one guard", () => {
  const source = readFileSync(path.join(UI_DIR, "settings-drawer.mjs"), "utf8");
  assert.match(source, /const requestEditorBack = .*runGuardedNavigation/);
  assert.match(source, /const requestEditorBrain = .*runGuardedNavigation|runGuardedNavigation\(\(\) => setBrainSelected/);
  assert.match(source, /if \(ev\.key === "Escape"\)[\s\S]*?requestClose\(\)/);
  assert.match(source, /ev\.target === ev\.currentTarget\)[\s\S]*?requestClose\(\)/);
  assert.match(source, /closeRequestRef\.current = requestClose/);
  const eventTypes = ["back", "category-click", "category-keyboard", "brain", "close", "close"];
  const outcomes = [];
  for (const eventType of eventTypes) {
    let pending = null;
    let performed = false;
    const action = () => { performed = true; };
    outcomes.push(settingsModalEventRoute({
      eventType,
      dirty: true,
      action,
      onPrompt: (next) => { pending = next; }
    }));
    assert.equal(performed, false, `${eventType} must not silently discard a dirty draft`);
    assert.equal(typeof pending, "function", `${eventType} must provide explicit discard continuation`);
    pending();
    assert.equal(performed, true);
  }
  assert.deepEqual(outcomes, ["prompt", "prompt", "prompt", "prompt", "prompt", "prompt"]);
  assert.equal(settingsModalEventRoute({ eventType: "unknown", dirty: true, action: () => {}, onPrompt: () => {} }), null);
});

test("conversation identity seam: six editor brains consume only matching canonical active facts", () => {
  assert.deepEqual(
    ["claude", "claude-opus-55", "codex", "codex-56-sol", "codex-astra", "codex-61-sol"].map((brainId) => conversationBrainIdentity({ brainId })),
    [null, null, null, null, null, null]
  );
  for (const brainId of ["claude", "claude-opus-55", "codex", "codex-56-sol", "codex-astra", "codex-61-sol"]) {
    const canonical = { id: `canonical-${brainId}`, displayName: `Canonical ${brainId}` };
    assert.deepEqual(conversationBrainIdentity({ brainId, activeBrainId: brainId, activeIdentity: canonical }), canonical);
    assert.deepEqual(
      conversationBrainIdentity({ brainId, activeBrainId: "claude", activeIdentity: canonical }),
      brainId === "claude" ? canonical : null
    );
  }
  const source = readFileSync(path.join(COCKPIT_DIR, "view-logic", "conversation-instruction.mjs"), "utf8");
  assert.doesNotMatch(source, /CONVERSATION_BRAIN_IDENTITY_PROJECTIONS/);
});

test("conversation instruction editor vnode: six brain choices, editable body, readonly identity, no memory structure, and no dialog nesting", () => {
  const seen = { back: false, edit: false, save: false, reset: false, brain: false };
  const vnode = ConversationInstructionEditor({
    brainId: "codex",
    brainLabel: "Codex (GPT-5.6 Terra)",
    identity: { id: "chappy", displayName: "チャッピー" },
    activeBrainId: "codex",
    state: { draft: "custom", status: "saved", dirty: false, isOverride: true, revision: 1 },
    onBack: () => { seen.back = true; },
    onEdit: () => { seen.edit = true; },
    onSave: () => { seen.save = true; },
    onReset: () => { seen.reset = true; },
    onBrainChange: () => { seen.brain = true; }
  });
  const elements = collectElements(vnode);
  assert.equal(elements.some((node) => node.props && node.props.role === "dialog"), false);
  const select = elements.find((node) => node.type === "select" && node.props.id === "conversation-instruction-brain");
  assert.equal(select.props.value, "codex");
  assert.deepEqual(elements.filter((node) => node.type === "option").map((node) => node.props.value), [
    "claude", "claude-opus-55", "codex", "codex-56-sol", "codex-astra", "codex-61-sol"
  ]);
  const textarea = elements.find((node) => node.type === "textarea");
  assert.equal(textarea.props.value, "custom");
  assert.equal(typeof textarea.props.onInput, "function");
  const managed = elements.find((node) => node.props && node.props.class === "conversation-instruction-managed");
  assert.ok(managed);
  assert.match(collectText(vnode).join(""), /チャッピー/);
  // 記憶の作り直し Wave 2: 起動時に記憶を載せないので、「記憶 N 件を搭載」の記憶構造の行は無い。
  assert.doesNotMatch(collectText(vnode).join(""), /記憶|件を搭載/);
  assert.match(collectText(vnode).join(""), /次のFireから反映/);
  assert.match(collectText(vnode).join(""), /revision 1/);
  assert.match(collectText(vnode).join(""), /読み取り専用/);
  const source = readFileSync(path.join(UI_DIR, "conversation-instruction-editor.mjs"), "utf8");
  assert.doesNotMatch(source, /memory.*text|memoryBody|transcript/i);
  assert.deepEqual(seen, { back: false, edit: false, save: false, reset: false, brain: false });
});

test("conversation instruction editor vnode: 魂がいつも足す教えを案内し、本文を読むだけで見せる（編集の口は無い・Wave 3 仕上げ）", () => {
  const base = {
    brainId: "codex",
    brainLabel: "Codex (GPT-5.6 Terra)",
    identity: null,
    activeBrainId: "codex",
    state: { draft: "custom", status: "saved", dirty: false, isOverride: true, revision: 1 },
    onEdit: () => {}
  };
  const withSkills = ConversationInstructionEditor({
    ...base,
    soulSkills: [{ name: "recall", path: "skills/recall.md", body: "過去の配信の記録を思い出したいときは <recall 頼みごと> を書けます。" }]
  });
  const text = collectText(withSkills).join("");
  assert.match(text, /このほかに、思い出す教え（skills\/recall\.md）がいつも足されています/);
  assert.match(text, /<recall 頼みごと> を書けます/);
  const elements = collectElements(withSkills);
  const section = elements.find((node) => node.props && node.props.class === "conversation-instruction-soul-skills");
  assert.ok(section, "教えの欄がある");
  const body = elements.find((node) => node.type === "pre" && node.props.class === "conversation-instruction-soul-skill-body");
  assert.ok(body, "本文は pre（読むだけ）");
  assert.equal(elements.filter((node) => node.type === "textarea").length, 1, "編集できるのは会話指示本文だけ");
  assert.equal(elements.filter((node) => node.props && typeof node.props.onInput === "function").length, 1);

  const without = ConversationInstructionEditor({ ...base });
  assert.equal(
    collectElements(without).some((node) => node.props && node.props.class === "conversation-instruction-soul-skills"),
    false,
    "教えが無ければ欄を出さない"
  );
});

test("FireButtons vnode: busy（soul 由来 / ローカル連打防止）で両ボタン disable・idle で有効", () => {
  // soul busy（applySoulState :439-440 の二重の防波堤）。
  let buttons = collectElements(
    FireButtons({ soulView: soulStatusView("thinking"), localBusy: false, onFire: () => {}, onVisionFire: () => {} })
  ).filter((n) => n.type === "button");
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((b) => b.props.disabled === true), "thinking 中は両方 disable");
  // ローカル連打防止（:556 :574 の即時 disable 相当）。
  buttons = collectElements(
    FireButtons({ soulView: soulStatusView("idle"), localBusy: true, onFire: () => {}, onVisionFire: () => {} })
  ).filter((n) => n.type === "button");
  assert.ok(buttons.every((b) => b.props.disabled === true), "POST 発射中は両方 disable");
  // idle + 非発射中は有効。文言は §7（アイコン + ラベル）。
  const vnode = FireButtons({ soulView: soulStatusView("idle"), localBusy: false, onFire: () => {}, onVisionFire: () => {} });
  buttons = collectElements(vnode).filter((n) => n.type === "button");
  assert.ok(buttons.every((b) => b.props.disabled === false), "idle は有効");
  const text = collectText(vnode).join("");
  assert.ok(text.includes("Fire"), "Fire ラベル");
  assert.ok(text.includes("Fire+視覚"), "Fire+視覚 ラベル");
});

test("SelfFirePill vnode: null は disable + not available・enabled は checked + on（controlled）", () => {
  // null（scheduler 未生成）= not available（applySelfFire :327-333）。
  let vnode = SelfFirePill({ view: selfFireToggleView(null), onChange: () => {} });
  let input = collectElements(vnode).find((n) => n.type === "input");
  assert.equal(input.props.disabled, true);
  assert.equal(input.props.checked, false);
  assert.ok(collectText(vnode).join("").includes("not available"));
  // enabled: controlled（checked は view 由来・programmatic 反映で change が発火しない構造）。
  vnode = SelfFirePill({ view: selfFireToggleView({ enabled: true }), onChange: () => {} });
  input = collectElements(vnode).find((n) => n.type === "input");
  assert.equal(input.props.disabled, false);
  assert.equal(input.props.checked, true);
  assert.equal(typeof input.props.onChange, "function");
  assert.ok(collectText(vnode).join("").includes("on"));
});

test("BargeInPill vnode: null は disable + not available・enabled は checked + on（controlled・SelfFirePill と同型）", () => {
  // null（gate 未生成）= not available（bargeInToggleView）。
  let vnode = BargeInPill({ view: bargeInToggleView(null), onChange: () => {} });
  let input = collectElements(vnode).find((n) => n.type === "input");
  assert.equal(input.props.disabled, true);
  assert.equal(input.props.checked, false);
  assert.ok(collectText(vnode).join("").includes("not available"));
  // enabled: controlled（checked は view 由来）。
  vnode = BargeInPill({ view: bargeInToggleView({ enabled: true }), onChange: () => {} });
  input = collectElements(vnode).find((n) => n.type === "input");
  assert.equal(input.props.disabled, false);
  assert.equal(input.props.checked, true);
  assert.equal(typeof input.props.onChange, "function");
  assert.ok(collectText(vnode).join("").includes("on"));
});

test("VerbositySelect vnode: verbosity prop が select の value に反映される（controlled・SelfFirePill と同型）", () => {
  // controlled: value は prop 由来（wave 計画「口数配線」§2 裁定 A）。
  let vnode = VerbositySelect({ verbosity: "chatty", onChange: () => {} });
  let select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "chatty");
  assert.equal(typeof select.props.onChange, "function");
  // 未設定/null（scheduler 未生成）は "normal" 表示に畳む（server 側の未知値フォールバックと対称）。
  vnode = VerbositySelect({ verbosity: null, onChange: () => {} });
  select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "normal");
  vnode = VerbositySelect({ onChange: () => {} });
  select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "normal");
  // onChange は呼び出し側のハンドラをそのまま素通しする（ここでは fetch は起きない・POST 配線は
  // DrivePanel 側・onToggleSelfFire の写経）。
  let called = null;
  vnode = VerbositySelect({ verbosity: "quiet", onChange: (ev) => (called = ev) });
  select = collectElements(vnode).find((n) => n.type === "select");
  select.props.onChange({ target: { value: "chatty" } });
  assert.deepEqual(called, { target: { value: "chatty" } });
  // 3 択（VERBOSITY_OPTIONS）が option として描かれる。
  const opts = collectElements(vnode).filter((n) => n.type === "option");
  assert.deepEqual(opts.map((o) => o.props.value), ["quiet", "normal", "chatty"]);
  const text = collectText(vnode).join("");
  assert.ok(text.includes("口数"), "ラベル");
  assert.ok(text.includes("控えめ") && text.includes("ふつう") && text.includes("おしゃべり"), "3 択の表示文言");
});

test("TopBar の KILL: killed=false は「KILL」ボタン（onKill）・KILL 中の表示なし", () => {
  let killed = 0;
  let revived = 0;
  const vnode = TopBar({ soul: "idle", ears: "listening", nowMs: 0, killed: false, onKill: () => (killed += 1), onRevive: () => (revived += 1) });
  const header = collectElements(vnode).find((n) => n.type === "header");
  assert.equal(header.props.class, "top-bar");
  const button = collectElements(vnode).find((n) => n.type === "button");
  assert.equal(button.props.class, "kill-switch");
  assert.equal(collectText(button).join(""), "KILL");
  button.props.onClick();
  assert.deepEqual([killed, revived], [1, 0]);
  assert.ok(!collectText(vnode).join("").includes("KILL 中"));
});

test("TopBar の KILL: killed=true は帯を赤く（killing）・「KILL 中」+ 復帰ボタン（onRevive）", () => {
  let revived = 0;
  const vnode = TopBar({ soul: "idle", ears: "listening", nowMs: 0, killed: true, onKill: () => {}, onRevive: () => (revived += 1) });
  const header = collectElements(vnode).find((n) => n.type === "header");
  assert.equal(header.props.class, "top-bar killing");
  const button = collectElements(vnode).find((n) => n.type === "button");
  assert.equal(button.props.class, "kill-switch killed");
  assert.equal(collectText(button).join(""), "復帰");
  button.props.onClick();
  assert.equal(revived, 1);
  assert.ok(collectText(vnode).join("").includes("KILL 中"));
});

test("SettingsSelect vnode: view-logic の option 列（{value,label}）を機械的に描く", () => {
  const options = [
    { value: "MV7+", label: "MV7+" },
    { value: "FooGame", label: "FooGame (foo.exe)" }
  ];
  const vnode = SettingsSelect({ options, value: "MV7+", onChange: () => {} });
  const select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "MV7+");
  const opts = collectElements(vnode).filter((n) => n.type === "option");
  assert.deepEqual(opts.map((o) => o.props.value), ["MV7+", "FooGame"]);
  assert.equal(collectText(vnode).join(""), "MV7+FooGame (foo.exe)");
});

test("SettingsSelect vnode: 頭脳区画の6選択肢（BRAIN_LABELS 由来・settings-drawer.mjs の BRAIN_OPTIONS と同型）", () => {
  const options = Object.keys(BRAIN_LABELS).map((id) => ({ value: id, label: BRAIN_LABELS[id] }));
  const vnode = SettingsSelect({ options, value: "codex", onChange: () => {} });
  const select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "codex");
  const opts = collectElements(vnode).filter((n) => n.type === "option");
  assert.deepEqual(opts.map((o) => o.props.value), ["claude", "claude-opus-55", "codex", "codex-56-sol", "codex-astra", "codex-61-sol"]);
  assert.equal(
    collectText(vnode).join(""),
    "Claude (Opus 4.8)Claude (Opus 5.5)Codex (GPT-5.6 Terra)Codex (GPT-5.6 Sol)GPT-6 AstraGPT-6.1 Sol"
  );
});

test("DrawerStatus vnode: 状態構造体（chatStatusView/channelStatusView）を色ドット付き class で描く", () => {
  // chat dead（Disconnect 無効の契約は view-logic fixture が固定・ここは描画写像のみ）。
  let vnode = DrawerStatus({ view: chatStatusView("dead") });
  let span = collectElements(vnode).find((n) => n.type === "span");
  assert.equal(span.props.class, "drawer-status chat-status dead");
  assert.equal(collectText(vnode).join(""), "dead");
  // channel connected（redact 済み URL 表示）。
  vnode = DrawerStatus({ view: channelStatusView({ configured: true, url: "ws://a/channel", connection: "connected" }) });
  span = collectElements(vnode).find((n) => n.type === "span");
  assert.equal(span.props.class, "drawer-status channel-status connected");
  assert.equal(collectText(vnode).join(""), "ws://a/channel — connected");
});

test("COCKPIT_CSS: 上の帯の KILL / 運転タブ / 設定引き出しの意匠トークン（KILL 赤枠・畳み・chevron・pill）", () => {
  assert.match(COCKPIT_CSS, /\.top-bar \.kill-switch \{[^}]*border: 1px solid var\(--down\)/, "KILL は赤枠");
  assert.ok(COCKPIT_CSS.includes(".top-bar .kill-switch.killed"), "killed 中はボタン自体も反転表示");
  assert.ok(COCKPIT_CSS.includes(".top-bar.killing"), "killed 中は上の帯全体が赤い");
  assert.ok(COCKPIT_CSS.includes(".drive-panel"), "運転タブ（旧運転バー）");
  assert.match(COCKPIT_CSS, /\.settings-drawer \{ display: none; \}/, "引き出しは普段畳む");
  assert.ok(COCKPIT_CSS.includes(".settings-drawer.open"), "⚙ で開く");
  assert.match(COCKPIT_CSS, /\.drawer-select,\s*\.verbosity-select \{[^}]*appearance: none/, "select は chevron 付き（§7）");
  assert.ok(COCKPIT_CSS.includes(".self-fire-pill"), "自発トグルは pill（§7）");
  assert.ok(COCKPIT_CSS.includes(".barge-in-pill"), "barge-in トグルも pill（「朗読と合いの手」・self-fire pill 写経）");
  assert.match(COCKPIT_CSS, /\.drawer-status::before \{[^}]*border-radius: 50%/, "状態は色ドット + 文言（§7）");
  assert.match(COCKPIT_CSS, /\.err \{ color: var\(--down\); \}/, "エラー欄（旧 .err の意味論継承）");
});

// ── 操縦席の文字起こし選択（cockpit-stt-selection.md §4.2）──

test("transcript: you の行には遅延を出さない（whisper / ElevenLabs とも）・soul 行の (Ns · brain) は従来どおり", () => {
  let feed = feedWithTranscript(emptyFeed(), { speaker: "you", text: "こんにちは", latencyMs: 1500, appendedAtMs: T0 }, T1);
  assert.equal(feed.rows[0].latText, null);
  feed = feedWithTranscript(emptyFeed(), { text: "speaker 欠落も you", latencyMs: 900, appendedAtMs: T0 }, T1);
  assert.equal(feed.rows[0].latText, null);
  feed = feedAfterSseEvent(emptyFeed(), "transcript", { speaker: "you", text: "x", latencyMs: 480, appendedAtMs: T0 }, T1);
  assert.equal(feed.rows[0].latText, null);
  feed = feedWithTranscript(emptyFeed(), { speaker: "soul", text: "はい", latencyMs: 2345, brain: "claude", appendedAtMs: T0 }, T1);
  assert.equal(feed.rows[0].latText, "(2.3s · claude)");
});

test("HealthLine（ログのタブ）: stt（方式と状態）を whisper 死活に足して出し・マイク名は listening の間だけ出す", () => {
  const base = {
    health: { whisper: { status: "unknown", reason: null }, ffmpeg: { status: "up", reason: null } },
    audioDevice: { name: "MV7+" }
  };
  const listening = collectText(
    HealthLine({
      ...base,
      ears: "listening",
      stt: { engine: "elevenlabs", status: "up", reason: null },
      device: "マイク (2- Shure MV7+)"
    })
  ).join("");
  assert.ok(listening.includes("stt: ElevenLabs up"), listening);
  assert.ok(listening.includes("whisper: unknown"), "既存の whisper 死活は残す");
  assert.ok(listening.includes("mic: マイク (2- Shure MV7+)"));
  const reconnecting = collectText(
    HealthLine({ ...base, ears: "listening", stt: { engine: "elevenlabs", status: "reconnecting", reason: null }, device: "Mic" })
  ).join("");
  assert.ok(reconnecting.includes("stt: ElevenLabs reconnecting"));
  const starting = collectText(
    HealthLine({ ...base, ears: "starting", stt: { engine: "whisper", status: "unknown", reason: null }, device: "Mic" })
  ).join("");
  assert.ok(starting.includes("Starting"));
  assert.ok(!starting.includes("mic:"), "起動中・停止中はマイク名を出さない");
  const stopped = collectText(HealthLine({ ...base, ears: "stopped", stt: null, device: "Mic" })).join("");
  assert.ok(!stopped.includes("mic:"));
  assert.ok(!stopped.includes("stt:"), "stt が無ければ出さない");
});

test("COCKPIT_CSS: 文字起こしの繋ぎ直し中（.hstat.reconnecting）は黄色（--speaking）", () => {
  assert.match(COCKPIT_CSS, /\.hstat\.reconnecting \{ color: var\(--speaking\)/);
});

test("HealthLine（ログのタブ）: tts（声の方式と状態）を stt の隣に出し・engine を用意する前（unknown）は出さない", () => {
  const base = {
    health: { whisper: { status: "unknown", reason: null }, ffmpeg: { status: "up", reason: null } },
    audioDevice: { name: "MV7+" },
    ears: "listening",
    stt: { engine: "elevenlabs", status: "up", reason: null },
    device: "Mic"
  };
  const up = collectText(HealthLine({ ...base, tts: { engine: "elevenlabs", status: "up", reason: null } })).join("");
  assert.ok(up.includes("tts: ElevenLabs up"), up);
  const rec = collectText(HealthLine({ ...base, tts: { engine: "elevenlabs", status: "reconnecting", reason: null } })).join("");
  assert.ok(rec.includes("tts: ElevenLabs reconnecting"));
  const aivis = collectText(HealthLine({ ...base, tts: { engine: "aivis", status: "up", reason: null } })).join("");
  assert.ok(aivis.includes("tts: AivisSpeech up"));
  const unknown = collectText(HealthLine({ ...base, tts: { engine: "aivis", status: "unknown", reason: null } })).join("");
  assert.ok(!unknown.includes("tts:"));
  assert.ok(!collectText(HealthLine(base)).join("").includes("tts:"), "tts が無ければ出さない");
});

test("設定の入出力タブ: 文字起こしの下に声の選択（AivisSpeech / ElevenLabs）・Start の body で ttsEngine を送り・state.tts から復元", () => {
  const source = readFileSync(path.join(UI_DIR, "settings-drawer.mjs"), "utf8");
  const stt = source.indexOf('id="stt-engine-select"');
  const tts = source.indexOf('id="tts-engine-select"');
  const micErr = source.indexOf("${micError}");
  const audio = source.indexOf('id="audio-device-select"');
  assert.ok(stt > 0 && tts > stt, "声の選択は文字起こしの下");
  assert.ok(micErr > tts, "Start の失敗理由（共用のエラー欄）は声の選択の下");
  assert.ok(audio > micErr, "声の出力先はその下（並びは変えない）");
  assert.match(source, /<label for="tts-engine-select">声<\/label>/);
  assert.match(source, /options=\$\{TTS_ENGINE_OPTIONS\}/);
  assert.match(source, /JSON\.stringify\(\{ device, sttEngine: sttSelected \|\| "whisper", ttsEngine: ttsSelected \|\| "aivis" \}\)/);
  assert.match(source, /ttsEngineSelection\(ttsEngine \? \{ engine: ttsEngine \} : null\)/);
  assert.match(source, /if \(ttsRestored != null && !ttsEditedRef\.current\) setTtsSelected\(ttsRestored\)/);
  const app = readFileSync(path.join(UI_DIR, "app.mjs"), "utf8");
  assert.match(app, /ttsEngine=\$\{tts \? tts\.engine : null\}/);
  assert.match(app, /if \(s\.tts\) setTts\(s\.tts\)/);
  assert.match(app, /<\$\{HealthLine\}[^>]*tts=\$\{tts\}/);
});
