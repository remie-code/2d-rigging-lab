// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { emptyFeed, feedAfterSseEvent } from "./ui/rows.mjs";
import { FeedRow } from "./ui/feed.mjs";
import { SpeakStartSelect, SPEAK_START_OPTIONS, DrivePanel } from "./ui/control-bar.mjs";
import { SSE_EVENT_NAMES, settingsFromSnapshot } from "./ui/app.mjs";
import { COCKPIT_CSS } from "./ui/styles.mjs";
import { speakNowJudgmentText, SPEAK_NOW_CHOICE_LABELS } from "./view-logic/markers.mjs";
import { speakNowErrorGhostLabel } from "./view-logic/ghost.mjs";
import { speakStartPostErrorText, speakStartRequestErrorText } from "./view-logic/control.mjs";
import { SPEAK_NOW_CHOICE_LABELS as MIND_LABELS } from "../mind/speak-now.mjs";

// 操縦席 UI の speak-now 部分（speak-now 合意 §5: 運転バーの「話し始め」切替・フィードの判定行）。

const T0 = Date.UTC(2026, 9, 16, 3, 4, 5);

/** vnode を平坦化して要素を集める（関数コンポーネントは展開）。 */
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

/** vnode 内のテキストを集める。 */
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

test("speakNowJudgmentText: 「判定: 自発 0.45」・表示名は mind 側と同じ・欠落は ?", () => {
  assert.deepEqual({ ...SPEAK_NOW_CHOICE_LABELS }, { ...MIND_LABELS });
  assert.equal(speakNowJudgmentText({ choice: "initiate", probability: 0.4512 }), "判定: 自発 0.45");
  assert.equal(speakNowJudgmentText({ choice: "respond", probability: 0.8 }), "判定: 応答 0.80");
  assert.equal(speakNowJudgmentText({ choice: "backchannel", probability: null }), "判定: 相槌 ?");
  assert.equal(speakNowJudgmentText({ choice: "look", probability: 0.58 }), "判定: 画面を見る 0.58");
  assert.equal(speakNowJudgmentText({ choice: "mystery", probability: 0.1 }), "判定: mystery 0.10");
});

test("speakNowErrorGhostLabel: 「(判定エラー: 理由)」", () => {
  assert.equal(speakNowErrorGhostLabel({ error: "タイムアウト（3 秒）" }), "(判定エラー: タイムアウト（3 秒）)");
  assert.equal(speakNowErrorGhostLabel({}), "(判定エラー: ?)");
});

test("feedAfterSseEvent: selfFire kind:speak-now-judgment は判定行 / error はゴースト行・発火結果（kind:speak-now）は従来の自発マーカー", () => {
  let feed = feedAfterSseEvent(emptyFeed(), "selfFire", { kind: "speak-now-judgment", choice: "initiate", probability: 0.45, latencyMs: 800 }, T0);
  assert.equal(feed.rows.length, 1);
  assert.equal(feed.rows[0].kind, "judgment-marker");
  assert.equal(feed.rows[0].text, "判定: 自発 0.45");
  assert.equal(feed.rows[0].whoText, "judge");
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "speak-now-judgment", error: "Decisions API のキーが見つからない" }, T0);
  assert.equal(feed.rows[1].kind, "ghost");
  assert.equal(feed.rows[1].text, "(判定エラー: Decisions API のキーが見つからない)");
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "speak-now", fired: true, reason: null }, T0);
  assert.equal(feed.rows[2].kind, "self-fire-marker");
  assert.equal(feed.rows[2].text, "self-fire (speak-now)");
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "speak-now", fired: false, reason: "busy" }, T0);
  assert.equal(feed.rows[3].text, "(self-fire: speak-now not fired — busy)");
  // 判定行も FeedRow が描く（マーカー行と同じ器・class に行種）。
  const vnode = FeedRow({ row: feed.rows[0] });
  assert.ok(vnode && /** @type {any} */ (vnode).props.class.includes("judgment-marker"));
  assert.ok(collectText(vnode).join("").includes("判定: 自発 0.45"));
});

test("SSE は speak-now のために増やさない（selfFire に相乗り・作り直しの 4 本を足して 17 本）", () => {
  assert.equal(SSE_EVENT_NAMES.length, 17);
  assert.ok(SSE_EVENT_NAMES.includes("selfFire"));
});

test("settingsFromSnapshot: speakStart を取り出す（欠落は null）", () => {
  assert.equal(settingsFromSnapshot({ speakStart: "speak-now" }).speakStart, "speak-now");
  assert.equal(settingsFromSnapshot({}).speakStart, null);
});

test("SpeakStartSelect vnode: 「話し始め: 従来 / speak-now」・controlled・null は disable", () => {
  assert.deepEqual(SPEAK_START_OPTIONS, [
    { value: "classic", label: "従来" },
    { value: "speak-now", label: "speak-now" }
  ]);
  let vnode = SpeakStartSelect({ speakStart: "speak-now", onChange: () => {} });
  let select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "speak-now");
  assert.equal(select.props.disabled, false);
  assert.ok(collectText(vnode).join("").includes("話し始め"));
  assert.deepEqual(collectElements(vnode).filter((n) => n.type === "option").map((o) => o.props.value), ["classic", "speak-now"]);
  vnode = SpeakStartSelect({ speakStart: null, onChange: () => {} });
  select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "classic");
  assert.equal(select.props.disabled, true);
  let called = null;
  vnode = SpeakStartSelect({ speakStart: "classic", onChange: (ev) => (called = ev) });
  collectElements(vnode).find((n) => n.type === "select").props.onChange({ target: { value: "speak-now" } });
  assert.deepEqual(called, { target: { value: "speak-now" } });
});

test("speakStartPostErrorText / speakStartRequestErrorText: 503/!ok の文言・成功は null", () => {
  assert.equal(speakStartPostErrorText({ status: 503, ok: false, j: null }), "speak-start control not available");
  assert.equal(speakStartPostErrorText({ status: 400, ok: false, j: { error: "invalid speak-start mode" } }), "set failed: invalid speak-start mode");
  assert.equal(speakStartPostErrorText({ status: 200, ok: true, j: {} }), null);
  assert.equal(speakStartRequestErrorText(new Error("net")), "speak-start error: Error: net");
});

test("ロールの編集（配信の組み直し Domain E で運転のタブから移した）: 口数の隣に話し始めのプルダウンが並び、ロールの下書きに書く（POST /api/role/edit）・運転のタブには無い", async () => {
  const { readFileSync } = await import("node:fs");
  const drawer = readFileSync(new URL("./ui/settings-drawer.mjs", import.meta.url), "utf8");
  const rolePanel = drawer.slice(drawer.indexOf('id="cockpit-settings-panel-role"'), drawer.indexOf('id="cockpit-settings-panel-drive"'));
  const verbosityAt = rolePanel.indexOf("<${VerbositySelect}");
  const speakAt = rolePanel.indexOf("<${SpeakStartSelect}");
  assert.ok(verbosityAt > 0 && speakAt > verbosityAt, "口数の直後");
  assert.ok(rolePanel.includes('onChange=${onRoleText("speakStartMode")}'), "話し始めはロールの下書き");
  const drive = readFileSync(new URL("./ui/control-bar.mjs", import.meta.url), "utf8");
  const panel = drive.slice(drive.indexOf("export function DrivePanel"));
  assert.ok(!panel.includes("<${SpeakStartSelect}") && !panel.includes("<${VerbositySelect}"), "運転のタブから外した（配信中に替えない）");
  assert.ok(!drive.includes('doFetch("/api/speak-start"'), "運転のタブから話し始めの POST を外した");
  assert.equal(typeof DrivePanel, "function");
  assert.ok(COCKPIT_CSS.includes(".row.judgment-marker"), "判定行の意匠");
});
