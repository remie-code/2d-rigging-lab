// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TopBar, QuotaGauge } from "./ui/header.mjs";
import { ConversationPanel, ConversationRow, LatencyBar } from "./ui/conversation.mjs";
import { CommentsPanel } from "./ui/comments.mjs";
import { BottomBar } from "./ui/bottom-bar.mjs";
import { COCKPIT_CSS } from "./ui/styles.mjs";
import { emptyGlance, glanceAfterSseEvent, conversationRowsView, commentRowsView } from "./view-logic/glance-timeline.mjs";
import { latencyBarView, quotaGaugeView } from "./view-logic/glance-meters.mjs";

// 操縦席の作り直し（2 回目: 画面・cockpit-glance-redesign.md）の部品の vnode 走査（render 不要・hooks 非使用の部品だけ）。
// 表示の結び付けと文言は view-logic（glance-timeline / glance-meters の fixture）が固定し、ここは「描くだけ」の写像を固定する。

/** vnode ツリーからテキストを集める（関数コンポーネントは hooks 非使用前提で展開）。 */
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

/** vnode ツリーから要素 vnode を集める。 */
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

const T0 = new Date(2026, 9, 17, 21, 34, 36).getTime();

/** 模型の終わりの数行に相当する状態。 */
function sampleGlance() {
  let g = emptyGlance();
  const ev = (/** @type {string} */ name, /** @type {any} */ d) => (g = glanceAfterSseEvent(g, name, d, T0));
  ev("transcript", { seq: 1, speaker: "viewer", displayName: "moco", text: "その先に宝箱ありそう！", commentId: "c1", appendedAtMs: T0 });
  ev("chatDiagnostic", { kind: "commentRejected", reject: "hijack", commentId: "c2", atMs: T0 });
  ev("transcript", { seq: 2, speaker: "you", text: "チャッピー、これどう思う？", appendedAtMs: T0 });
  ev("selfFire", { kind: "speak-now-judgment", choice: "respond", probability: 0.72, action: "fire", trigger: "transcript", triggerSeq: 2 });
  ev("fire", { accepted: true, fireId: 1, cause: { type: "speak-now", choice: "respond", probability: 0.72, triggerSeq: 2 } });
  ev("fireAsk", { fireId: 1, windowFirstSeq: 1, windowLastSeq: 2, includedCount: 2, vision: false, atMs: T0 });
  ev("transcript", { seq: 3, speaker: "soul", text: "右の足跡が気になる。", appendedAtMs: T0 + 2000, fireId: 1 });
  ev("latency", { fireId: 1, spoken: true, segments: { judgeMs: 400, llmFirstMs: 800, ttsMs: 400 }, otherMs: 200, totalMs: 4500, level: "warn" });
  ev("fire", { accepted: true, fireId: 2, cause: { type: "comment-react", commentIds: ["c1"] } });
  ev("transcript", { seq: 4, speaker: "soul", text: "宝箱につながってるかも。", appendedAtMs: T0 + 4000, fireId: 2 });
  return g;
}

test("ConversationPanel: 会話の行・判定の札・遅延の棒・反応の札・推論の範囲の見出しを描く", () => {
  const g = sampleGlance();
  const rows = conversationRowsView(g, { soulName: "チャッピー", latencyView: (rec) => latencyBarView(rec, null) });
  const vnode = ConversationPanel({ rows, preStream: false, onOpenSettings: () => {} });
  const text = collectText(vnode).join("");
  assert.ok(text.includes("会話"));
  assert.ok(text.includes("推論に使った範囲"));
  assert.ok(text.includes("配信者") && text.includes("チャッピー"));
  assert.ok(text.includes("応答 0.72"), "判定の札");
  assert.ok(text.includes("4.5 秒"), "遅延の合計");
  assert.ok(text.includes("💬 moco に反応"), "コメント反応の札");
  const els = collectElements(vnode);
  const list = els.find((n) => n.props && n.props.class === "convo-list");
  assert.ok(list, "会話の列（入る分だけ・スクロールしない）");
  const total = els.find((n) => n.props && typeof n.props.class === "string" && n.props.class.startsWith("lat-total"));
  assert.equal(total.props.class, "lat-total warn", "4 秒超は琥珀");
  const segs = els.filter((n) => n.props && typeof n.props.class === "string" && n.props.class.startsWith("lat-seg "));
  assert.deepEqual(segs.map((s) => s.props.class), ["lat-seg seg-judge", "lat-seg seg-llm-first", "lat-seg seg-tts", "lat-seg seg-other"]);
  assert.deepEqual(segs.map((s) => s.props.style), ["width:22.2%", "width:44.4%", "width:22.2%", "width:11.1%"]);
  // 最新の返事・範囲の行の class。
  const rowClasses = els.filter((n) => n.props && typeof n.props.class === "string" && n.props.class.startsWith("convo-row")).map((n) => n.props.class);
  assert.deepEqual(rowClasses, [
    "convo-row you in-range range-start range-end",
    "convo-row soul",
    "convo-row soul latest"
  ]);
});

test("ConversationPanel: 配信前は会話の場所の中央に「準備・設定を開く」（押すと onOpenSettings）", () => {
  let opened = 0;
  const vnode = ConversationPanel({ rows: [], preStream: true, onOpenSettings: () => (opened += 1) });
  const button = collectElements(vnode).find((n) => n.type === "button");
  assert.equal(button.props.class, "prestream-open");
  assert.equal(collectText(button).join(""), "準備・設定を開く");
  button.props.onClick();
  assert.equal(opened, 1);
  assert.equal(collectElements(vnode).some((n) => n.props && n.props.class === "convo-list"), false);
});

test("ConversationRow: 相槌の間隔の薄い行・種類の札（手動）", () => {
  const note = ConversationRow({ row: /** @type {any} */ ({ key: 1, kind: "note", text: "(相槌したかった 0.41 · 間隔)", inRange: false }) });
  assert.equal(/** @type {any} */ (note).props.class, "convo-row note");
  assert.equal(collectText(note).join(""), "(相槌したかった 0.41 · 間隔)");
  const manual = ConversationRow({ row: /** @type {any} */ ({ key: 2, kind: "soul", timeText: "21:34:20", whoText: "チャッピー", text: "左の道は。", kindText: "手動", latency: null }) });
  assert.ok(collectText(manual).join("").includes("手動"));
  const lat = LatencyBar({ view: { parts: [], totalText: "1.0 秒", levelClassName: "lat-total alert", title: "" } });
  assert.ok(collectText(lat).join("").includes("1.0 秒"));
});

test("CommentsPanel: 新しいものが上・普通のコメントは札なし・反応したコメントは印・弾いたものは種類だけ", () => {
  const g = sampleGlance();
  const vnode = CommentsPanel({ rows: commentRowsView(g) });
  const els = collectElements(vnode);
  const rowEls = els.filter((n) => n.props && typeof n.props.class === "string" && n.props.class.startsWith("comment-row"));
  assert.deepEqual(rowEls.map((r) => r.props.class), ["comment-row rejected", "comment-row reacted"]);
  assert.deepEqual(rowEls.map((r) => collectText(r).join("")), ["弾いた: 乗っ取り", "mocoその先に宝箱ありそう！反応"]);
  const plain = CommentsPanel({ rows: [{ key: 1, kind: "comment", nameText: "かなた", text: "右のルート", reacted: false, rejectText: null }] });
  assert.equal(collectText(plain).join(""), "コメントかなた右のルート", "普通のコメントには札を付けない");
});

test("TopBar: 名前・モデル名・状態のピル・異常時だけの警告・残量ゲージ 2 本・KILL", () => {
  const props = {
    identity: { id: "chappy", displayName: "チャッピー" },
    modelText: "GPT-6.1 Sol",
    soul: "speaking",
    ears: "listening",
    quota: { codex: { remainingPercent: 99 }, elevenlabs: { remainingPercent: 14.2 } },
    nowMs: 0,
    onKill: () => {},
    onRevive: () => {}
  };
  const calm = TopBar({ ...props, warnings: [] });
  const text = collectText(calm).join("");
  for (const s of ["チャッピー", "GPT-6.1 Sol", "喋ってる", "Codex 週 99%", "ElevenLabs 月 14%", "KILL"]) assert.ok(text.includes(s), s);
  const els = collectElements(calm);
  assert.equal(els.filter((n) => n.props && typeof n.props.class === "string" && n.props.class.startsWith("warn-chip")).length, 0, "異常が無ければ何も出さない");
  assert.deepEqual(
    els.filter((n) => n.props && typeof n.props.class === "string" && n.props.class.startsWith("gauge") && !n.props.class.startsWith("gauge-")).map((n) => n.props.class),
    ["gauge", "gauge low"]
  );
  const warned = TopBar({ ...props, warnings: [{ id: "w", severity: "alert", message: "文字起こしが止まっている", count: 1, expiresAtMs: null }] });
  const chip = collectElements(warned).find((n) => n.props && n.props.class === "warn-chip alert");
  assert.equal(collectText(chip).join(""), "文字起こしが止まっている");
  // 残量が不明は「—」。
  const unknown = QuotaGauge({ view: quotaGaugeView("Codex 週", null) });
  assert.equal(collectText(unknown).join(""), "Codex 週 —");
});

test("BottomBar: 運転設定の表示・遅延の凡例 8 つ・歯車「準備・設定」（ホットキーの案内は置かない）", () => {
  let opened = 0;
  const vnode = BottomBar({
    settings: { selfFire: { enabled: true }, verbosity: "chatty", speakStart: "speak-now", commentBusy: "hold" },
    onOpenSettings: () => (opened += 1)
  });
  const text = collectText(vnode).join("");
  for (const s of ["自発", "ON", "口数", "おしゃべり", "話し始め", "speak-now", "忙しい間のコメント", "あとで拾う", "準備・設定"]) assert.ok(text.includes(s), s);
  for (const s of ["文字起こし", "判定", "画面", "LLM 最初の文字", "最初の文", "TTS", "声", "その他"]) assert.ok(text.includes(s), s);
  assert.ok(!/Ctrl|ホットキー/.test(text), "ホットキーの案内は消した（§7）");
  const swatches = collectElements(vnode).filter((n) => n.props && typeof n.props.class === "string" && n.props.class.startsWith("legend-swatch"));
  assert.equal(swatches.length, 8);
  const gear = collectElements(vnode).find((n) => n.type === "button");
  assert.equal(gear.props.id, "cockpit-settings-trigger");
  gear.props.onClick();
  assert.equal(opened, 1);
});

test("App の結線: 初回の自動展開をしない・手動の発火はメイン画面から外し運転タブへ・ログのタブに今のフィード", () => {
  const app = readFileSync(new URL("./ui/app.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(app, /shouldAutoOpenSettings/, "設定の初回自動展開はやめる（§7・§9.2）");
  assert.match(app, /driveSlot=\$\{html`\s*<\$\{DrivePanel\}/);
  assert.match(app, /logSlot=/);
  assert.match(app, /<\$\{Feed\} rows=\$\{feed\.rows\}/);
  assert.match(app, /setGlance\(\(g\) => glanceAfterSseEvent\(g, name, d, nowMs\)\)/);
  assert.match(app, /"\/api\/kill"/);
  const drive = readFileSync(new URL("./ui/control-bar.mjs", import.meta.url), "utf8");
  assert.match(drive, /<\$\{FireButtons\}/, "手動の発火ボタンは運転タブ");
  assert.doesNotMatch(drive, /\/api\/kill/, "KILL は上の帯（App）");
});

test("COCKPIT_CSS: 1 画面（縦スクロールなし）・会話は下寄せで古い行を切る・コメントは上から・遅延 8 色", () => {
  assert.match(COCKPIT_CSS, /html, body \{ overflow: hidden; \}/);
  assert.match(COCKPIT_CSS, /\.convo-list \{[^}]*overflow: hidden;[^}]*justify-content: flex-end;/);
  assert.match(COCKPIT_CSS, /\.comments-list \{[^}]*overflow: hidden;/);
  assert.match(COCKPIT_CSS, /\.glance-main \{[^}]*grid-template-columns: minmax\(0, 60fr\) minmax\(0, 36fr\)/);
  for (const c of ["seg-transcribe", "seg-judge", "seg-screen", "seg-llm-first", "seg-first-sentence", "seg-tts", "seg-voice", "seg-other"]) {
    assert.ok(COCKPIT_CSS.includes("." + c + " { background: var(--" + c + "); }"), c);
  }
  assert.match(COCKPIT_CSS, /\.lat-bar \{[^}]*width: 132px;/, "遅延の棒は長さ固定（§8）");
  assert.match(COCKPIT_CSS, /\.lat-total\.warn \{ color: var\(--amber\)/);
  assert.match(COCKPIT_CSS, /\.lat-total\.alert \{ color: var\(--down\)/);
});
