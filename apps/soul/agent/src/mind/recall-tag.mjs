// @ts-check
/**
 * 目印 `<recall 頼みごと>` の読み取り（記憶の作り直し Wave 3 Domain D・純関数）— apps/soul/agent。
 *
 * 上位文書:
 *  - [recall-flow.md](../../../../discussion/ai-cohost/memory/recall-flow.md) §4・§6（目印は山括弧の演出タグの仕組みに足す）。
 *  - [memory-recall-wave-plan.md](../../../../discussion/ai-cohost/implementation/orchestration/memory-recall-wave-plan.md) §3 Domain D。
 *
 * ── 語彙 ───────────────────────────────────────────────────────────────────
 *  表情の語彙表（expression-table の 6 語）とは**別の語彙集合**として持つ（CONTROL_TAG_WORDS）。表情の 6 語は
 *  演出（envelope）になり、`recall` は魂への頼み（思い出しの係）になる。どちらも声と会話ログからは剥がす。
 *
 * ── `recall` だけの書式 ─────────────────────────────────────────────────────
 *  `<recall` の直後が語の文字（英数字・`_`・`-`）でなければ（空白・`>`・`<`・行末・入力の終わりなど）、`recall` の
 *  目印として読む。引数（頼みごと）は自由文で、
 *  `<` `>` が混ざっても中身が声に出ないように、表情タグより広く取る:
 *   - 目印の終わりは、**同じ行の中で最後の `>`**。ただし、途中に既知のタグ（表情の 6 語か `recall`）の始まりが
 *     来たら、そこで探すのをやめる（次のタグを飲み込まない）。
 *   - 引数の中の `<` はそのまま引数に入る（既知のタグの始まりでない限り）。
 *   - 同じ行に `>` が無い（閉じていない）目印は、行末・次の既知のタグ・入力の終わりまでを声に出さずに捨てる
 *     （頼みとしては使わない）。
 *  逐次の読み上げ（incremental-sentence-tag-buffer）でも同じ関数で読む。終わりが決まるまで（行末・次の既知の
 *  タグ・入力の終わりを見るまで）は「未完」として待たせる。そのため、目印の後ろの同じ行の文は、行末か返事の
 *  終わりまで声になるのが遅れる（目印は返事の最後に書くよう教えている）。
 */

import { EXPRESSION_WORDS } from "./expression-table.mjs";

/** 思い出しの目印の語。 */
export const RECALL_WORD = "recall";

/** 表情とは別の語彙集合（魂への頼みになる目印）。 */
export const CONTROL_TAG_WORDS = Object.freeze([RECALL_WORD]);

/** 目印の終わりを探すのをやめる「既知のタグ」の語（表情の 6 語 + 目印の語）。 */
const KNOWN_TAG_WORDS = new Set([...EXPRESSION_WORDS, ...CONTROL_TAG_WORDS]);

const RECALL_OPEN = `<${RECALL_WORD}`;
const WORD_START = /^[A-Za-z]$/;
const WORD_CHAR = /^[\w-]$/;
const SPACE = /^\s$/;

/**
 * `input[at]` の `<` が既知のタグ（表情の 6 語か `recall`）の始まりか。語の後ろが `>` か空白なら始まりとみなす。
 * 入力の終わりで決まらないときは、final なら false、そうでなければ "incomplete"。
 * @param {string} input  @param {number} at  @param {boolean} final
 * @returns {boolean | "incomplete"}
 */
function knownTagStartAt(input, at, final) {
  let i = at + 1;
  if (i >= input.length) return final ? false : "incomplete";
  if (!WORD_START.test(input[i])) return false;
  const wordStart = i;
  while (i < input.length && WORD_CHAR.test(input[i])) i += 1;
  if (i >= input.length) return final ? false : "incomplete";
  const next = input[i];
  if (next !== ">" && !SPACE.test(next)) return false;
  return KNOWN_TAG_WORDS.has(input.slice(wordStart, i));
}

/**
 * `input[start]` から `recall` の目印を読む。
 *  - null: `recall` の目印ではない（呼び出し側の表情タグの読み方に任せる）。
 *  - { kind: "valid", end }: `input.slice(start, end + 1)` が目印。
 *  - { kind: "unclosed", end }: 閉じていない目印。`input.slice(start, end)` を声に出さずに捨てる（頼みにしない）。
 *  - { kind: "incomplete" }: まだ決まらない（逐次の読み上げは続きを待つ）。final なら返さない。
 * @param {string} input  @param {number} start  @param {boolean} [final=true]
 * @returns {null | { kind: "valid"; end: number } | { kind: "unclosed"; end: number } | { kind: "incomplete" }}
 */
export function scanRecallTag(input, start, final = true) {
  if (input[start] !== "<") return null;
  for (let k = 1; k < RECALL_OPEN.length; k += 1) {
    const i = start + k;
    if (i >= input.length) return final ? null : { kind: "incomplete" };
    if (input[i] !== RECALL_OPEN[k]) return null;
  }
  const p = start + RECALL_OPEN.length;
  if (p >= input.length) return final ? { kind: "unclosed", end: input.length } : { kind: "incomplete" };
  const c = input[p];
  if (WORD_CHAR.test(c)) return null; // `<recallx>`・`<recall-x>` は別の語。
  let lastClose = -1;
  for (let j = p; j < input.length; j += 1) {
    const ch = input[j];
    if (ch === "\n" || ch === "\r") return lastClose >= 0 ? { kind: "valid", end: lastClose } : { kind: "unclosed", end: j };
    if (ch === "<") {
      const known = knownTagStartAt(input, j, final);
      if (known === "incomplete") return { kind: "incomplete" };
      if (known) return lastClose >= 0 ? { kind: "valid", end: lastClose } : { kind: "unclosed", end: j };
    }
    if (ch === ">") lastClose = j;
  }
  if (!final) return { kind: "incomplete" };
  return lastClose >= 0 ? { kind: "valid", end: lastClose } : { kind: "unclosed", end: input.length };
}

/**
 * 目印 `<recall …>` の引数（頼みごと）を整える。空白をまとめ、前後を落とす。
 * @param {string} raw  `<recall` と閉じの `>` の間。
 * @returns {string}
 */
export function normalizeRecallRequest(raw) {
  return String(raw).replace(/\s+/g, " ").trim();
}
