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
