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
//  (4) hooks を使わないコンポーネント（Header/FeedRow）の vnode 走査スモーク（render 不要・
//      preact 公開形状 type/props のみに依存）。
// このファイルは src/cockpit/ 直下（配信サブツリー外）に置く: 静的配信ツリー（/ui/*.mjs）へ
// node:test を import するファイルを混ぜないため。

const COCKPIT_DIR = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.join(COCKPIT_DIR, "ui");

import { SSE_EVENT_NAMES, App, mount, initialHealth, settingsFromSnapshot } from "./ui/app.mjs";
import { Header, HealthStat } from "./ui/header.mjs";
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
import { ControlBar, FireButtons, SelfFirePill, VerbositySelect, KillSwitch, BargeInPill, VERBOSITY_OPTIONS } from "./ui/control-bar.mjs";
import { SettingsDrawer, SettingsSelect, DrawerStatus } from "./ui/settings-drawer.mjs";
import { soulStatusView, selfFireToggleView, killSwitchView, bargeInToggleView } from "./view-logic/control.mjs";
import { chatStatusView, channelStatusView } from "./view-logic/status.mjs";
import { BRAIN_LABELS } from "./view-logic/health.mjs";

// ── (1) Node インポートスモーク（import 文自体が成功している時点で副作用ゼロの構造証明）──

test("ui import スモーク: 全 ui/*.mjs が Node で import でき、主要 export が関数/文字列", () => {
  for (const fn of [App, mount, Header, HealthStat, Feed, FeedRow, injectStyles,
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

// ── (3) SSE 購読リスト = ワイヤ契約 13 SSE の写像（移植漏れゼロの機械的固定点）──

test("SSE_EVENT_NAMES: 既存 13 SSE イベントと 1:1（名前・本数を固定）", () => {
  assert.deepEqual(SSE_EVENT_NAMES, [
    "state", "vad", "transcript", "expression", "discard", "diagnostic", "soul",
    "fire", "visionCaptured", "usage", "selfFire", "chatStatus", "chatDiagnostic"
  ]);
  assert.equal(SSE_EVENT_NAMES.length, 13);
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
    killed: false, // S8: サーバ既定 false（他の null 許容フィールドとは非対称）。
    brain: null // 多頭化 Domain C: audioDevice/channel と同型の null 許容。
  });
  const s = {
    channel: { configured: true, url: "ws://x — redacted" },
    visionTarget: { title: "FooGame" },
    selfFire: { enabled: true },
    verbosity: "chatty",
    audioDevice: { name: "MV7+" },
    chat: { source: "abc", connected: true, state: "live" },
    bargeIn: { enabled: false },
    killed: true,
    brain: { brain: "codex", credentialHealth: true }
  };
  assert.deepEqual(settingsFromSnapshot(s), s);
});

test("initialHealth: 初期表示 unknown（現 cockpit.html :158-159 の初期値と同値）", () => {
  assert.deepEqual(initialHealth(), {
    whisper: { status: "unknown", reason: null },
    ffmpeg: { status: "unknown", reason: null }
  });
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

test("Header vnode スモーク: 名前・ランプ・死活・声の出力先・⚙ が乗る", () => {
  const vnode = Header({
    ears: "listening",
    health: { whisper: { status: "up", reason: null }, ffmpeg: { status: "down", reason: "gone" } },
    audioDevice: { name: "MV7+" },
    onToggleSettings: () => {}
  });
  const text = collectText(vnode).join("");
  assert.ok(text.includes("こーでぃー"), "名前");
  assert.ok(text.includes("Listening"), "ears 状態文言");
  assert.ok(text.includes("whisper"), "whisper 死活ラベル");
  assert.ok(text.includes("down — gone"), "down は reason 併記（healthStatusView 経由）");
  assert.ok(text.includes("MV7+"), "声の出力先（voiceOutputLabel 経由）");
  assert.ok(text.includes("⚙"), "設定トグル");
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

// ── (10) Domain C: 運転バー + 設定引き出し（import スモーク / hooks 非使用部品の vnode 走査 / CSS）──
// ControlBar / SettingsDrawer 本体は hooks（ローカル busy・入力欄 state）を使うため collectText の
// 「関数コンポーネント展開」流儀では走査できない（domain-b レビュー §6 申し送り 8）。
// → 表示導出は view-logic fixture（control.test.mjs / settings.test.mjs）で固定し、hooks 非使用の
//   葉部品（FireButtons/SelfFirePill/KillSwitch/SettingsSelect/DrawerStatus）を vnode 走査で固定する。

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
  for (const fn of [ControlBar, FireButtons, SelfFirePill, VerbositySelect, KillSwitch, BargeInPill, SettingsDrawer, SettingsSelect, DrawerStatus]) {
    assert.equal(typeof fn, "function");
  }
  // 口数モードの選択肢（値は固定の 3 択・wave 計画「口数配線」§2 裁定 A で実配線済み）。
  assert.deepEqual(VERBOSITY_OPTIONS, [
    { value: "quiet", label: "控えめ" },
    { value: "normal", label: "ふつう" },
    { value: "chatty", label: "おしゃべり" }
  ]);
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
  // ControlBar 側・onToggleSelfFire の写経）。
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

test("KillSwitch vnode: killed=false は「■ KILL」ボタン・status 非表示（S8 実装済み）", () => {
  const vnode = KillSwitch({ view: killSwitchView(false), onClick: () => {} });
  const button = collectElements(vnode).find((n) => n.type === "button");
  assert.equal(button.props.disabled, undefined, "disabled ではない（S8 実装済み）");
  assert.equal(typeof button.props.onClick, "function");
  const text = collectText(vnode).join("");
  assert.ok(text.includes("KILL"));
  assert.ok(!text.includes("殺し中"), "通常時は殺し中 status を描かない");
});

test("KillSwitch vnode: killed=true は復帰ボタン + 「殺し中」status（バー全体の視覚化は control-bar の killing class）", () => {
  const vnode = KillSwitch({ view: killSwitchView(true), onClick: () => {} });
  const button = collectElements(vnode).find((n) => n.type === "button");
  assert.equal(button.props.class, "kill-switch killed");
  const text = collectText(vnode).join("");
  assert.ok(text.includes("復帰"));
  assert.ok(text.includes("殺し中"));
});

test("KillSwitch vnode: onClick は呼び出し側のハンドラをそのまま素通しする", () => {
  let called = false;
  const vnode = KillSwitch({ view: killSwitchView(false), onClick: () => (called = true) });
  const button = collectElements(vnode).find((n) => n.type === "button");
  button.props.onClick();
  assert.equal(called, true);
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

test("SettingsSelect vnode: 頭脳区画の選択肢（BRAIN_LABELS 由来・多頭化 Domain C・settings-drawer.mjs の BRAIN_OPTIONS と同型・2026-07-17 追撃で4項目）", () => {
  const options = Object.keys(BRAIN_LABELS).map((id) => ({ value: id, label: BRAIN_LABELS[id] }));
  const vnode = SettingsSelect({ options, value: "codex", onChange: () => {} });
  const select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "codex");
  const opts = collectElements(vnode).filter((n) => n.type === "option");
  assert.deepEqual(opts.map((o) => o.props.value), ["claude", "codex", "codex-55", "codex-56-sol"]);
  assert.equal(
    collectText(vnode).join(""),
    "Claude (Opus 4.8)Codex (GPT-5.6 Terra)Codex (GPT-5.5)Codex (GPT-5.6 Sol)"
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

test("COCKPIT_CSS: 運転バー/設定引き出しの意匠トークン（§7: KILL 赤枠・畳み・chevron・pill）", () => {
  assert.ok(COCKPIT_CSS.includes(".control-bar {"), "運転バー（常駐）");
  assert.match(COCKPIT_CSS, /\.control-bar \.kill-switch \{[^}]*border-color: var\(--down\)/, "KILL は赤枠（§7）");
  // S8: killed 中はバー全体が視覚的に「殺し中」と分かる（人間ゲート要求）。
  assert.ok(COCKPIT_CSS.includes(".control-bar .kill-switch.killed"), "killed 中はボタン自体も反転表示");
  assert.ok(COCKPIT_CSS.includes(".control-bar.killing"), "killed 中はバー全体に視覚化 class");
  assert.match(COCKPIT_CSS, /\.settings-drawer \{ display: none; \}/, "引き出しは普段畳む");
  assert.ok(COCKPIT_CSS.includes(".settings-drawer.open"), "⚙ で開く");
  assert.match(COCKPIT_CSS, /\.drawer-select,\s*\.verbosity-select \{[^}]*appearance: none/, "select は chevron 付き（§7）");
  assert.ok(COCKPIT_CSS.includes(".self-fire-pill"), "自発トグルは pill（§7）");
  assert.ok(COCKPIT_CSS.includes(".barge-in-pill"), "barge-in トグルも pill（「朗読と合いの手」・self-fire pill 写経）");
  assert.match(COCKPIT_CSS, /\.drawer-status::before \{[^}]*border-radius: 50%/, "状態は色ドット + 文言（§7）");
  assert.match(COCKPIT_CSS, /\.err \{ color: var\(--down\); \}/, "エラー欄（旧 .err の意味論継承）");
});
