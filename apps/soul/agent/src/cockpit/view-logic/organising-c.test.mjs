// @ts-check
/**
 * 記憶の整理 Domain C: 閉じかけの間に③整理役が走っている（snapshot の stream.organising）ときの画面の文言
 * （organization.md §7「画面には『整理中』と出す」）。配信の場・Discord の場とも、閉じの文言（「配信を終えています…」・
 * 「通話を終えています…」）に代えて「記憶を整理しています…」。状態のピルは「記録中」に代えて「整理中」。印が無ければ
 * 今の文言のまま（ほかの文言は変えない）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DISCORD_JOIN_TEXT,
  DISCORD_JOINING_TEXT,
  DISCORD_LEAVING_TEXT,
  MEMORY_ORGANISING_SHORT_TEXT,
  MEMORY_ORGANISING_TEXT,
  discordJoinView,
  isMemoryOrganising
} from "./discord.mjs";
import { statusPillView, streamStartView } from "./glance-meters.mjs";
import { ConversationPanel } from "../ui/conversation.mjs";
import { TopBar } from "../ui/header.mjs";

/** vnode ツリーからテキストを集める（関数コンポーネントは hooks 非使用前提で展開）。 */
function collectText(/** @type {any} */ node, /** @type {string[]} */ out = []) {
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

/** @returns {any[]} */
function collectElements(/** @type {any} */ node, /** @type {any[]} */ out = []) {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const c of node) collectElements(c, out);
    return out;
  }
  if (typeof node.type === "function") return collectElements(node.type(node.props), out);
  if (node.type) out.push(node);
  return collectElements(node.props && node.props.children, out);
}

test("文言: 「記憶を整理しています…」と「整理中」（閉じの文言とは別の語）", () => {
  assert.equal(MEMORY_ORGANISING_TEXT, "記憶を整理しています…");
  assert.equal(MEMORY_ORGANISING_SHORT_TEXT, "整理中");
  assert.equal(DISCORD_LEAVING_TEXT, "通話を終えています…", "Discord の閉じの文言は変えない");
});

test("isMemoryOrganising: 閉じかけで organising が true のときだけ（ほかの段階・古いサーバ・無いときは false）", () => {
  assert.equal(isMemoryOrganising({ phase: "closing", organising: true }), true);
  assert.equal(isMemoryOrganising({ phase: "closing", organising: false }), false);
  assert.equal(isMemoryOrganising({ phase: "closing" }), false, "印を持たない古いサーバ");
  for (const phase of ["closed", "opening", "open"]) assert.equal(isMemoryOrganising({ phase, organising: true }), false, phase);
  assert.equal(isMemoryOrganising(null), false);
  assert.equal(isMemoryOrganising(undefined), false);
});

test("streamStartView（配信の場）: 整理中は「記憶を整理しています…」と「整理中…」・印が無ければ今どおり", () => {
  assert.deepEqual(streamStartView({ phase: "closing", error: null, experience: "stream", organising: true }), {
    phase: "closing",
    startText: "記憶を整理しています…",
    startDisabled: true,
    noteText: "整理中…",
    errorText: ""
  });
  assert.deepEqual(streamStartView({ phase: "closing", error: null, experience: "stream", organising: false }), {
    phase: "closing",
    startText: "配信を終えています…",
    startDisabled: true,
    noteText: "記録中…",
    errorText: ""
  });
  assert.equal(streamStartView({ phase: "opening", organising: true }).startText, "配信を始めています…", "閉じかけでなければ印を見ない");
  assert.equal(streamStartView({ phase: "closed", organising: true }).startText, "配信を始める");
});

test("streamStartView（Discord の場）: 中央の「配信を始める」は押せないまま・添え書きは整理中…", () => {
  const view = streamStartView({ phase: "closing", error: null, experience: "discord", organising: true });
  assert.equal(view.startText, "配信を始める");
  assert.equal(view.startDisabled, true);
  assert.equal(view.noteText, "整理中…");
});

test("discordJoinView: Discord の場の閉じかけで整理中なら「記憶を整理しています…」・印が無ければ「通話を終えています…」", () => {
  assert.deepEqual(discordJoinView({ phase: "closing", experience: "discord", organising: true }, true), {
    show: true,
    text: MEMORY_ORGANISING_TEXT,
    disabled: true
  });
  assert.deepEqual(discordJoinView({ phase: "closing", experience: "discord", organising: false }, true), {
    show: true,
    text: DISCORD_LEAVING_TEXT,
    disabled: true
  });
  assert.equal(discordJoinView({ phase: "opening", experience: "discord", organising: true }, true).text, DISCORD_JOINING_TEXT);
  assert.equal(discordJoinView({ phase: "closing", experience: "stream", organising: true }, true).text, DISCORD_JOIN_TEXT, "配信の場の間は今どおり");
});

test("statusPillView: 閉じかけで整理中なら「整理中」（喋ってる・圧縮中・考えてるはこれまでどおり先）・印が無ければ「記録中」", () => {
  assert.deepEqual(statusPillView("idle", "stopped", false, { phase: "closing", organising: true }), {
    text: "整理中",
    className: "status-pill recording"
  });
  assert.deepEqual(statusPillView("idle", "stopped", false, { phase: "closing", organising: false }), {
    text: "記録中",
    className: "status-pill recording"
  });
  assert.equal(statusPillView("speaking", "stopped", false, { phase: "closing", organising: true }).text, "喋ってる");
  assert.equal(statusPillView("idle", "stopped", true, { phase: "closing", organising: true }).text, "圧縮中");
});

test("画面の部品: 中央に「記憶を整理しています…」と「整理中…」・上の帯のピルに「整理中」", () => {
  const stream = { phase: "closing", error: null, experience: "stream", organising: true };
  const panel = ConversationPanel({ rows: [], preStream: true, start: streamStartView(stream) });
  const start = collectElements(panel).find((n) => n.props && n.props.class === "prestream-start");
  assert.equal(start.props.disabled, true);
  assert.equal(collectText(start).join(""), "記憶を整理しています…");
  const note = collectElements(panel).find((n) => n.props && n.props.class === "prestream-note");
  assert.equal(collectText(note).join(""), "整理中…");
  const bar = TopBar({ soul: "idle", ears: "stopped", stream, warnings: [], nowMs: 0 });
  assert.ok(collectText(bar).includes("整理中"));
});
