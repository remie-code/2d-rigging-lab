// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TopBar } from "./ui/header.mjs";
import { COCKPIT_CSS } from "./ui/styles.mjs";
import { emptyFeed, feedAfterSseEvent } from "./ui/rows.mjs";
import { emptyGlance, glanceAfterSseEvent } from "./view-logic/glance-timeline.mjs";
import { emptyCoughChip, coughChipAfterDiscard } from "./view-logic/cough-chip.mjs";

// 咳払いの落とし 段階 2（Domain B）: 上の帯の「咳 ×N」の札・ログのタブのゴースト行・会話に出さないこと・結線の固定
// （cough-filter-stage2-plan.md §4 B の 1〜7）。札の数え方と消え方そのものは view-logic/cough-chip.test.mjs が固定する。

const COCKPIT_DIR = path.dirname(fileURLToPath(import.meta.url));
const T0 = 2_000_000;

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

/** vnode ツリーから要素 vnode を集める（文書順）。 */
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

/** @param {any} n @param {string} cls */
const hasClass = (n, cls) => n && n.props && typeof n.props.class === "string" && n.props.class.split(" ").includes(cls);

/** reason "cough" の SSE discard（Domain A の確定した形）。 */
function cough(/** @type {string} */ text, /** @type {number} */ speech) {
  return { startMs: 1, endMs: 2, reason: "cough", appended: 3, discarded: 4, text, speech };
}

const BASE = { identity: { id: "chappy", displayName: "チャッピー" }, soul: "idle", ears: "listening", warnings: [], onKill: () => {}, onRevive: () => {} };

test("TopBar: 咳を受けると状態のピルのすぐ隣に薄いグレーの札「咳 ×N」・title に文字と確率（新しい順）", () => {
  let chip = coughChipAfterDiscard(emptyCoughChip(), cough("うん", 0.05), T0);
  chip = coughChipAfterDiscard(chip, cough("ん", 0.02), T0 + 1000);
  const bar = TopBar({ ...BASE, coughChip: chip, nowMs: T0 + 1000 });
  const els = collectElements(bar);
  const header = els[0];
  const kids = /** @type {any[]} */ (header.props.children).flat().filter((c) => c && typeof c === "object");
  const pillAt = kids.findIndex((c) => hasClass(c, "status-pill"));
  assert.ok(pillAt >= 0);
  assert.equal(hasClass(kids[pillAt + 1], "cough-slot"), true, "札の置き場は状態のピルのすぐ隣");
  const chips = els.filter((n) => hasClass(n, "cough-chip"));
  assert.equal(chips.length, 1);
  assert.equal(chips[0].props.class, "cough-chip");
  assert.equal(collectText(chips[0]).join(""), "咳 ×2");
  assert.equal(chips[0].props.title, "「ん」 Speech 0.02\n「うん」 Speech 0.05");
  assert.equal(collectText(bar).join("").includes("うん"), false, "文字は札の文言に出さない（title だけ）");
  // 警告の欄とは別（警告の札のクラスを使わない）。
  assert.equal(els.filter((n) => hasClass(n, "warn-chip")).length, 0);
});

test("TopBar: 札が無いとき・8 秒を過ぎたときも置き場（.cough-slot）は残り、札だけが消える", () => {
  const chip = coughChipAfterDiscard(emptyCoughChip(), cough("うん", 0.05), T0);
  for (const [label, props] of /** @type {Array<[string, any]>} */ ([
    ["既定（coughChip なし）", { ...BASE, nowMs: T0 }],
    ["空の札", { ...BASE, coughChip: emptyCoughChip(), nowMs: T0 }],
    ["8 秒ちょうど", { ...BASE, coughChip: chip, nowMs: T0 + 8000 }]
  ])) {
    const els = collectElements(TopBar(props));
    assert.equal(els.filter((n) => hasClass(n, "cough-slot")).length, 1, label);
    assert.equal(els.filter((n) => hasClass(n, "cough-chip")).length, 0, label);
  }
  const live = collectElements(TopBar({ ...BASE, coughChip: chip, nowMs: T0 + 7999 }));
  assert.equal(live.filter((n) => hasClass(n, "cough-chip")).length, 1, "7999ms はまだ出す");
});

test("ログのタブ: reason cough のゴースト行は「(咳として落とした)」・blank は「(discarded)」・行に文字と確率は出さない", () => {
  const coughFeed = feedAfterSseEvent(emptyFeed(), "discard", cough("うん", 0.05), T0);
  assert.deepEqual([coughFeed.rows[0].kind, coughFeed.rows[0].text], ["ghost", "(咳として落とした)"]);
  const wire = JSON.stringify(coughFeed);
  assert.equal(wire.includes("うん"), false, "ゴースト行に文字を出さない");
  assert.equal(wire.includes("0.05"), false, "ゴースト行に確率を出さない");
  const blankFeed = feedAfterSseEvent(emptyFeed(), "discard", { startMs: 1, endMs: 2, reason: "blank", appended: 3, discarded: 4 }, T0);
  assert.deepEqual([blankFeed.rows[0].kind, blankFeed.rows[0].text], ["ghost", "(discarded)"]);
});

test("会話のタイムライン: reason cough の discard も無視する（同じ状態を返す）", () => {
  const g = emptyGlance();
  assert.equal(glanceAfterSseEvent(g, "discard", cough("うん", 0.05), T0), g);
});

test("App の結線: discard の reason cough だけ札を進め（受け取りの時刻を渡す）、上の帯へ札と 1 秒の時計を渡す", () => {
  const app = readFileSync(path.join(COCKPIT_DIR, "ui", "app.mjs"), "utf8");
  assert.match(app, /import \{ emptyCoughChip, coughChipAfterDiscard \} from "\.\.\/view-logic\/cough-chip\.mjs";/);
  assert.match(app, /const \[coughChip, setCoughChip\] = useState\(emptyCoughChip\);/);
  assert.match(app, /const applyNonFeedSseEvent = \(eventName, d, nowMs\) =>/);
  assert.match(app, /applyNonFeedSseEvent\(name, d, nowMs\);/);
  const discardCase = app.slice(app.indexOf('case "discard":'), app.indexOf('case "soul":'));
  assert.match(discardCase, /setDiscarded\(d && d\.discarded\);/);
  assert.match(discardCase, /if \(d && d\.reason === "cough"\) setCoughChip\(\(c\) => coughChipAfterDiscard\(c, d, nowMs\)\);/);
  assert.match(app, /<\$\{TopBar\}[^>]*coughChip=\$\{coughChip\}[^>]*nowMs=\$\{nowTick\}/);
  // 消すのは nowTick との比較だけ（札のための setTimeout を足さない）。setTimeout は既存の「配信を終える」の 2 回押しの 1 か所だけ。
  assert.equal((app.match(/setTimeout\(/g) || []).length, 1);
});

test("札の文字と確率はブラウザに保存しない・送り返さない・console に出さない（操縦席の画面のコード全体）", () => {
  const files = [
    ...readdirSync(path.join(COCKPIT_DIR, "ui")).filter((f) => f.endsWith(".mjs")).map((f) => path.join("ui", f)),
    ...readdirSync(path.join(COCKPIT_DIR, "view-logic")).filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs")).map((f) => path.join("view-logic", f))
  ];
  for (const f of files) {
    const src = readFileSync(path.join(COCKPIT_DIR, f), "utf8");
    for (const word of ["localStorage", "sessionStorage", "indexedDB"]) assert.equal(src.includes(word), false, `${f} に ${word}`);
  }
  const chipSrc = readFileSync(path.join(COCKPIT_DIR, "view-logic", "cough-chip.mjs"), "utf8");
  for (const word of ["console.", "fetch(", "setTimeout(", "setInterval(", "Date.now("]) assert.equal(chipSrc.includes(word), false, `cough-chip.mjs に ${word}`);
});

test("COCKPIT_CSS: 札は薄いグレー（.warn-chip.more と同じ色）・置き場は固定の幅で縮まない・アニメーションは無い", () => {
  const rule = (/** @type {string} */ sel) => {
    const at = COCKPIT_CSS.indexOf(sel + " {");
    assert.ok(at >= 0, sel);
    return COCKPIT_CSS.slice(at, COCKPIT_CSS.indexOf("}", at));
  };
  const slot = rule(".cough-slot");
  assert.match(slot, /flex: 0 0 auto;/);
  assert.match(slot, /width: \d+px;/);
  const chip = rule(".cough-chip");
  assert.match(chip, /color: var\(--muted\);/);
  assert.match(chip, /border: 1px solid var\(--border\);/);
  assert.ok(COCKPIT_CSS.includes(".warn-chip.more { color: var(--muted); border-color: var(--border);"), "「+N」と同じ色の組");
  for (const word of ["@keyframes", "animation", "transition"]) assert.equal(COCKPIT_CSS.includes(word), false, word);
});
