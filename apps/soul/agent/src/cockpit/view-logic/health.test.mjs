// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  earsStatusView,
  healthStatusView,
  mergeHealth,
  voiceOutputLabel,
  BRAIN_LABELS,
  brainLabel,
  brainCredentialHealthLabel
} from "./health.mjs";

test("earsStatusView: listening/starting/stopped の文言 + ランプクラス（cockpit.html:267-270 同値）", () => {
  assert.deepEqual(earsStatusView("listening"), {
    listening: true,
    text: "Listening",
    dotClassName: "dot on"
  });
  assert.deepEqual(earsStatusView("starting"), {
    listening: false,
    text: "Starting",
    dotClassName: "dot off"
  });
  assert.deepEqual(earsStatusView("stopped"), {
    listening: false,
    text: "Stopped",
    dotClassName: "dot off"
  });
  // 未知値・欠落は Stopped へ劣化（原実装の三項の else と同値）。
  assert.deepEqual(earsStatusView(undefined), {
    listening: false,
    text: "Stopped",
    dotClassName: "dot off"
  });
});

test("healthStatusView: up/unknown はそのまま・down は reason を em-dash 併記（cockpit.html:360-366 同値）", () => {
  assert.deepEqual(healthStatusView({ status: "up", reason: null }), {
    text: "up",
    className: "hstat up",
    title: ""
  });
  assert.deepEqual(healthStatusView({ status: "unknown", reason: null }), {
    text: "unknown",
    className: "hstat unknown",
    title: ""
  });
  assert.deepEqual(healthStatusView({ status: "down", reason: "spawn ENOENT" }), {
    text: "down — spawn ENOENT",
    className: "hstat down",
    title: "spawn ENOENT"
  });
  // down でも reason 欠落なら素の "down"（原実装 `h.status === "down" && h.reason` の短絡）。
  assert.deepEqual(healthStatusView({ status: "down", reason: null }), {
    text: "down",
    className: "hstat down",
    title: ""
  });
});

test("healthStatusView: falsy は null = 表示を更新しない（原実装 `if (!h) return;`）", () => {
  assert.equal(healthStatusView(null), null);
  assert.equal(healthStatusView(undefined), null);
});

test("mergeHealth: 欠落側は前値を保持（applyState :271-274 の「更新しない」を state 遷移で同値化）", () => {
  const prev = {
    whisper: { status: "up", reason: null },
    ffmpeg: { status: "down", reason: "gone" }
  };
  // s.health ごと欠落 → 全部保持（:271 `if (s.health)`）。
  assert.equal(mergeHealth(prev, null), prev);
  assert.equal(mergeHealth(prev, undefined), prev);
  // 片側だけ更新・欠落側は前値のまま（applyHealth `if (!h) return;`）。
  const next = mergeHealth(prev, { whisper: { status: "down", reason: "died" } });
  assert.deepEqual(next, {
    whisper: { status: "down", reason: "died" },
    ffmpeg: { status: "down", reason: "gone" }
  });
  // 両方更新。
  const both = mergeHealth(prev, {
    whisper: { status: "up", reason: null },
    ffmpeg: { status: "up", reason: null }
  });
  assert.deepEqual(both, {
    whisper: { status: "up", reason: null },
    ffmpeg: { status: "up", reason: null }
  });
});

test("voiceOutputLabel: name があれば name・なければ default（applyAudioDevice :344 同値）", () => {
  assert.equal(voiceOutputLabel({ name: "ヘッドホン (MV7+)" }), "ヘッドホン (MV7+)");
  assert.equal(voiceOutputLabel({ name: "" }), "default"); // 空文字も falsy = default（原実装同値）。
  assert.equal(voiceOutputLabel(null), "default");
  assert.equal(voiceOutputLabel(undefined), "default");
});

// ── 多頭化 Domain C: 設定引き出し「頭脳」区画の表示導出（brain-swap-wave-plan.md §3）──────────

test("BRAIN_LABELS: 既存4頭 + Astra の 5 項目（BRAINS[*].label 相当）", () => {
  assert.deepEqual(Object.keys(BRAIN_LABELS), ["claude", "codex", "codex-55", "codex-56-sol", "codex-astra"]);
  assert.equal(BRAIN_LABELS.claude, "Claude (Opus 4.8)");
  assert.equal(BRAIN_LABELS.codex, "Codex (GPT-5.6 Terra)");
  assert.equal(BRAIN_LABELS["codex-55"], "Codex (GPT-5.5)");
  assert.equal(BRAIN_LABELS["codex-56-sol"], "Codex (GPT-5.6 Sol)");
  assert.equal(BRAIN_LABELS["codex-astra"], "GPT-6 Astra");
});

test("brainLabel: 既知 id は表示ラベル・未知 id/未指定は unknown", () => {
  assert.equal(brainLabel({ brain: "claude" }), "Claude (Opus 4.8)");
  assert.equal(brainLabel({ brain: "codex" }), "Codex (GPT-5.6 Terra)");
  assert.equal(brainLabel({ brain: "codex-55" }), "Codex (GPT-5.5)");
  assert.equal(brainLabel({ brain: "codex-56-sol" }), "Codex (GPT-5.6 Sol)");
  assert.equal(brainLabel({ brain: "codex-astra" }), "GPT-6 Astra");
  assert.equal(brainLabel({ brain: "gpt" }), "unknown"); // 未知 id。
  assert.equal(brainLabel({ brain: null }), "unknown");
  assert.equal(brainLabel(null), "unknown");
  assert.equal(brainLabel(undefined), "unknown");
});

test("brainCredentialHealthLabel: 健康/未検出/未指定の3分岐（credentialHealth は boolean の文言化のみ）", () => {
  assert.equal(brainCredentialHealthLabel({ credentialHealth: true }), "ログイン確認済み");
  assert.equal(brainCredentialHealthLabel({ credentialHealth: false }), "未検出（codex login してや）");
  // 未指定（brainStatus 未注入・credentialHealth 欠落）は unknown。
  assert.equal(brainCredentialHealthLabel(null), "unknown");
  assert.equal(brainCredentialHealthLabel(undefined), "unknown");
  assert.equal(brainCredentialHealthLabel({}), "unknown");
  assert.equal(brainCredentialHealthLabel({ credentialHealth: /** @type {any} */ ("true") }), "unknown"); // 非 boolean は unknown。
});
