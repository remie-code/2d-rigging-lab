// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LATENCY_SEGMENTS,
  latencyBarView,
  latencyLevelOf,
  secondsText,
  quotaGaugeView,
  warningsView,
  WARNINGS_SHOWN,
  statusPillView,
  isPreStream,
  streamPhaseOf,
  streamStartView,
  endStreamButtonView,
  driveSummaryView,
  QUOTA_LOW_PERCENT,
  QUOTA_CRITICAL_PERCENT,
  DEFAULT_LATENCY_THRESHOLDS
} from "./glance-meters.mjs";
import { QUOTA_LOW_PERCENT as SERVER_LOW, QUOTA_CRITICAL_PERCENT as SERVER_CRITICAL } from "../quota.mjs";

// 横目で見る操縦席の計器（cockpit-glance-redesign.md §7〜§9 / データの形 cockpit-glance-data-contract.md）。

test("凡例は 8 つ（文字起こし・判定・画面・LLM 最初の文字・最初の文・TTS・声・その他）・棒と同じ並び", () => {
  assert.deepEqual(LATENCY_SEGMENTS.map((s) => s.label), [
    "文字起こし", "判定", "画面", "LLM 最初の文字", "最初の文", "TTS", "声", "その他"
  ]);
  assert.deepEqual(LATENCY_SEGMENTS.map((s) => s.key), [
    "transcribeMs", "judgeMs", "screenMs", "llmFirstMs", "firstSentenceMs", "ttsMs", "voiceMs", "otherMs"
  ]);
  assert.equal(new Set(LATENCY_SEGMENTS.map((s) => s.className)).size, 8, "色は 8 種");
  // 声の差し替え Wave 2 の定義（engine に依存しない）: TTS = 頼んでから最初の音・声 = 最初の音から鳴り始めるまで。
  const hints = Object.fromEntries(LATENCY_SEGMENTS.map((s) => [s.key, "hint" in s ? s.hint : null]));
  assert.equal(hints.ttsMs, "声を頼んでから最初の音が届くまで");
  assert.equal(hints.voiceMs, "最初の音が届いてから鳴り始めるまで");
});

test("latencyBarView: 区間は実測値の比（null・0 は出さない・その他は otherMs）・合計の数字", () => {
  const view = latencyBarView({
    fireId: 1,
    spoken: true,
    segments: { transcribeMs: 300, judgeMs: 400, screenMs: null, llmFirstMs: 600, firstSentenceMs: 0, ttsMs: 300, voiceMs: 200 },
    otherMs: 200,
    totalMs: 2000,
    level: "ok"
  });
  assert.ok(view);
  assert.deepEqual(view.parts.map((p) => [p.key, p.percent]), [
    ["transcribeMs", 15], ["judgeMs", 20], ["llmFirstMs", 30], ["ttsMs", 15], ["voiceMs", 10], ["otherMs", 10]
  ]);
  assert.equal(view.totalText, "2.0 秒");
  assert.equal(view.levelClassName, "lat-total");
  assert.match(view.title, /文字起こし 0\.30 秒/);
  assert.doesNotMatch(view.title, /声:/, "voice が無ければ engine を添えない");
  // 鳴らした声の engine があれば title の末尾に添える（声の差し替え Wave 3）。
  const withVoice = latencyBarView({ segments: { ttsMs: 130, voiceMs: 60 }, otherMs: null, totalMs: 900, level: "ok", voice: "elevenlabs" });
  assert.equal(withVoice?.title, "TTS 0.13 秒 / 声 0.06 秒（声: ElevenLabs）");
  assert.match(latencyBarView({ segments: { ttsMs: 100 }, totalMs: 900, level: "ok", voice: "aivis" })?.title ?? "", /（声: AivisSpeech）$/);
  // Codex の fast（service tier "priority"）で頼んだ返事は title の末尾に（fast）を添える。通常（default）・無しは添えない。
  assert.equal(
    latencyBarView({ segments: { ttsMs: 130 }, totalMs: 900, level: "ok", voice: "aivis", serviceTier: "priority" })?.title,
    "TTS 0.13 秒（声: AivisSpeech）（fast）"
  );
  assert.doesNotMatch(latencyBarView({ segments: { ttsMs: 130 }, totalMs: 900, level: "ok", serviceTier: "default" })?.title ?? "", /fast/);
  assert.doesNotMatch(view.title, /fast/);
  // 鳴らなかった返事（totalMs null）は棒を出さない。
  assert.equal(latencyBarView({ fireId: 2, spoken: false, segments: {}, otherMs: null, totalMs: null, level: null }), null);
  assert.equal(latencyBarView(null), null);
  // 区間が 1 つも取れない（全部 null）は空の棒 + 数字だけ。
  assert.deepEqual(latencyBarView({ segments: {}, otherMs: null, totalMs: 1234, level: "ok" })?.parts, []);
});

test("遅延の区分: payload の level を優先・無ければしきい値（4 秒超琥珀・6 秒超赤・設定で変わる）", () => {
  assert.equal(latencyBarView({ segments: {}, totalMs: 4100, level: "warn" })?.levelClassName, "lat-total warn");
  assert.equal(latencyBarView({ segments: {}, totalMs: 6100, level: "alert" })?.levelClassName, "lat-total alert");
  assert.equal(latencyLevelOf({ totalMs: 4000, level: null }, null), "ok", "ちょうど 4 秒は琥珀にしない（超え）");
  assert.equal(latencyLevelOf({ totalMs: 4001, level: null }, null), "warn");
  assert.equal(latencyLevelOf({ totalMs: 6001, level: null }, null), "alert");
  assert.equal(latencyLevelOf({ totalMs: 3500, level: null }, { warnSec: 3, alertSec: 5 }), "warn");
  assert.equal(latencyLevelOf({ totalMs: null }, null), null);
  assert.deepEqual({ ...DEFAULT_LATENCY_THRESHOLDS }, { warnSec: 4, alertSec: 6 });
  assert.equal(secondsText(1849), "1.8 秒");
});

test("quotaGaugeView: 「残り」の割合・20% 未満は琥珀（low）・5% 未満は赤（critical）・不明は「—」", () => {
  assert.deepEqual([QUOTA_LOW_PERCENT, QUOTA_CRITICAL_PERCENT], [SERVER_LOW, SERVER_CRITICAL], "サーバの警告と同じ境目");
  const ok = quotaGaugeView("Codex 週", { remainingPercent: 98.6, resetsAtMs: new Date(2026, 9, 23, 9, 5).getTime() });
  assert.deepEqual([ok.valueText, ok.percent, ok.className], ["98%", 98.6, "gauge"]);
  assert.match(ok.title, /残り 98\.6%・リセット 10\/23 09:05/);
  assert.equal(quotaGaugeView("x", { remainingPercent: 19.9 }).className, "gauge low");
  assert.equal(quotaGaugeView("x", { remainingPercent: 20 }).className, "gauge");
  assert.equal(quotaGaugeView("x", { remainingPercent: 4.9 }).className, "gauge critical");
  assert.equal(quotaGaugeView("x", { remainingPercent: 4.9 }).valueText, "4%");
  const unknown = quotaGaugeView("ElevenLabs 月", null);
  assert.deepEqual([unknown.valueText, unknown.percent, unknown.className], ["—", null, "gauge unknown"]);
  assert.equal(quotaGaugeView("x", { remainingPercent: null }).valueText, "—");
});

test("warningsView: 異常があるときだけ・alert が先・期限切れの出来事は落とす・回数・あふれは +N", () => {
  assert.deepEqual(warningsView([], 0), { items: [], moreText: null, moreTitle: "" });
  assert.deepEqual(warningsView(null, 0).items, []);
  const now = 1_000_000;
  const list = [
    { id: "a", severity: "warn", message: "文字起こしを繋ぎ直し中（ElevenLabs）", detail: "socket closed", count: 1, expiresAtMs: null },
    { id: "b", severity: "alert", message: "頭のエラー", detail: null, count: 3, expiresAtMs: now + 1000 },
    { id: "c", severity: "warn", message: "判定のエラー", count: 1, expiresAtMs: now - 1 },
    { id: "d", severity: "warn", message: "チャットが切れている", count: 1, expiresAtMs: null },
    { id: "e", severity: "warn", message: "ElevenLabs の残りが少ない（14%）", count: 1, expiresAtMs: null }
  ];
  const view = warningsView(list, now);
  assert.equal(WARNINGS_SHOWN, 3);
  assert.deepEqual(view.items.map((w) => [w.text, w.className, w.title]), [
    ["頭のエラー ×3", "warn-chip alert", "頭のエラー"],
    ["文字起こしを繋ぎ直し中（ElevenLabs）", "warn-chip warn", "socket closed"],
    ["チャットが切れている", "warn-chip warn", "チャットが切れている"]
  ]);
  assert.equal(view.moreText, "+1");
  assert.equal(view.moreTitle, "ElevenLabs の残りが少ない（14%）");
});

test("statusPillView: 考えてる / 喋ってる / 聞いてる（耳が止まっている間に暇なら止まってる）", () => {
  assert.deepEqual(statusPillView("thinking", "listening"), { text: "考えてる", className: "status-pill thinking" });
  assert.deepEqual(statusPillView("speaking", "listening"), { text: "喋ってる", className: "status-pill speaking" });
  assert.deepEqual(statusPillView("idle", "listening"), { text: "聞いてる", className: "status-pill listening" });
  assert.deepEqual(statusPillView("idle", "starting"), { text: "起動中", className: "status-pill starting" });
  assert.deepEqual(statusPillView(null, "stopped"), { text: "止まってる", className: "status-pill stopped" });
});

test("statusPillView: 圧縮中（優先順位 喋ってる > 圧縮中 > 考えてる > 聞いてる > 起動中 > 止まってる）", () => {
  const compacting = { text: "圧縮中", className: "status-pill compacting" };
  assert.deepEqual(statusPillView("speaking", "listening", true), { text: "喋ってる", className: "status-pill speaking" }, "喋ってるが先");
  assert.deepEqual(statusPillView("thinking", "listening", true), compacting, "圧縮の終わりを待っている発火は考えてるではなく圧縮中");
  assert.deepEqual(statusPillView("idle", "listening", true), compacting);
  assert.deepEqual(statusPillView("idle", "starting", true), compacting);
  assert.deepEqual(statusPillView(null, "stopped", true), compacting, "耳が止まっていても圧縮の最中は出す");
  // 圧縮中でなければ今までどおり（false / 欠落 / true 以外は圧縮中にしない）。
  assert.deepEqual(statusPillView("thinking", "listening", false), { text: "考えてる", className: "status-pill thinking" });
  assert.deepEqual(statusPillView("idle", "listening", undefined), { text: "聞いてる", className: "status-pill listening" });
  assert.deepEqual(statusPillView("idle", "listening", /** @type {any} */ ("true")), { text: "聞いてる", className: "status-pill listening" });
});

test("isPreStream: 耳が止まっている間だけ（起動中は配信前に数えない）", () => {
  assert.equal(isPreStream("stopped"), true);
  assert.equal(isPreStream(null), true);
  assert.equal(isPreStream("listening"), false);
  assert.equal(isPreStream("starting"), false);
});

test("driveSummaryView: 自発・口数・話し始め・忙しい間のコメント（使えないは —）", () => {
  assert.deepEqual(
    driveSummaryView({ selfFire: { enabled: true }, verbosity: "chatty", speakStart: "speak-now", commentBusy: "hold" }),
    [
      { label: "自発", value: "ON" },
      { label: "口数", value: "おしゃべり" },
      { label: "話し始め", value: "speak-now" },
      { label: "忙しい間のコメント", value: "あとで拾う" }
    ]
  );
  assert.deepEqual(
    driveSummaryView({ selfFire: { enabled: false }, verbosity: "quiet", speakStart: "classic", commentBusy: "drop" }).map((s) => s.value),
    ["OFF", "控えめ", "従来", "見逃す"]
  );
  assert.deepEqual(driveSummaryView(null).map((s) => s.value), ["—", "—", "—", "—"]);
});

// ── 配信の組み直し Domain D: 場（配信を始める / 終える）のメイン画面 ─────────────────────────────

test("streamPhaseOf / isPreStream(ears, stream): 場の状態で決める（stream の無い古いサーバは耳の状態から読む）", () => {
  assert.equal(streamPhaseOf({ phase: "open" }, "stopped"), "open");
  assert.equal(streamPhaseOf({ phase: "closing" }, "listening"), "closing");
  assert.equal(streamPhaseOf(null, "listening"), "open");
  assert.equal(streamPhaseOf(null, "stopped"), "closed");
  assert.equal(streamPhaseOf({ phase: "bogus" }, null), "closed");
  assert.equal(isPreStream("listening", { phase: "closed" }), true, "場が閉じていれば配信前");
  assert.equal(isPreStream("listening", { phase: "opening" }), true, "開きかけも中央のボタン（押せない）");
  assert.equal(isPreStream("stopped", { phase: "closing" }), true, "閉じかけ（記録中）も中央");
  assert.equal(isPreStream("listening", { phase: "open" }), false, "開いているときは今のまま（会話の列）");
  assert.equal(isPreStream("listening", null), false, "stream の無い古いサーバは耳の状態");
  assert.equal(isPreStream("stopped"), true, "stream を渡さなければ今までどおり");
});

test("streamStartView: 閉じているときは「配信を始める」（押せる）と始められなかった理由・開きかけ / 閉じかけは押せない・閉じかけは「記録中…」", () => {
  assert.deepEqual(streamStartView({ phase: "closed", error: null }), {
    phase: "closed",
    startText: "配信を始める",
    startDisabled: false,
    noteText: "",
    errorText: ""
  });
  const reason = "体の器（runtime-player）につながらない — runtime-player が起動していないか、channel が開いていない。";
  assert.equal(streamStartView({ phase: "closed", error: reason }).errorText, reason);
  assert.equal(streamStartView({ phase: "closed", error: reason }, "通信の失敗").errorText, "通信の失敗", "要求そのものの失敗を先に");
  assert.deepEqual(streamStartView({ phase: "opening", error: null }), {
    phase: "opening",
    startText: "配信を始めています…",
    startDisabled: true,
    noteText: "",
    errorText: ""
  });
  assert.deepEqual(streamStartView({ phase: "closing", error: null }), {
    phase: "closing",
    startText: "配信を終えています…",
    startDisabled: true,
    noteText: "記録中…",
    errorText: ""
  });
  assert.equal(streamStartView(null).startText, "配信を始める");
});

test("endStreamButtonView: 「配信を終える」は場が開いている間だけ・1 回目で armed（もう一度押すと終える）", () => {
  assert.deepEqual(endStreamButtonView({ phase: "open" }, false), { show: true, text: "配信を終える", className: "stream-end" });
  assert.deepEqual(endStreamButtonView({ phase: "open" }, true), { show: true, text: "もう一度押すと配信を終える", className: "stream-end armed" });
  for (const phase of ["closed", "opening", "closing"]) assert.equal(endStreamButtonView({ phase }, false).show, false, phase);
});
