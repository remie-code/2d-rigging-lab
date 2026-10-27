// @ts-check
/**
 * 逐次 LLM delta 用の、文境界と expression tag を分離する純粋な小部品。
 *
 * この部品は TTS や Fire の状態を一切知らない。delta を一度だけ append し、
 * 完結した文と完結した tag を出力する。既存 expression parser と同じ tag grammar
 * だけを control syntax と見なし、その未完形は保持する。壊れた angle bracket は
 * parser と同様に bracket だけを剥ぎ、非 tag 本文を落とさない。
 *
 * 記憶の作り直し Wave 3 Domain D: 思い出しの目印 `<recall 頼みごと>` も parser と同じ関数（recall-tag.mjs の
 * scanRecallTag）で読む。完結した目印は tags に出し、その `recalls`（頼みごと）を載せる。目印の終わり（同じ行の
 * 最後の `>`）が決まるまでは未完として待たせ、閉じていない目印は声に出さずに捨てる（parser と同じ speechText）。
 *
 * 応答の遅れの直し（latency-fix-plan.md §2-3）: 文の後ろに来た完結したタグ（6 語の表情タグ・思い出しの目印）も文の
 * 区切りとみなす。タグの前に声にする文字（文字か数字が 1 つ以上・絵文字や記号だけは数えない）が溜まっていれば、
 * タグを読んだ時点でそれを 1 文として出す（タグは文に含めない）。「そうだね<nod>」のように句点の無い 1 文が、
 * 返事の締めまで声に回らないのを防ぐ。思い出しの目印は終わり（同じ行の最後の `>`）が行末か返事の終わりまで
 * 決まらないので、`<recall` の後ろに語の文字でないもの（空白・`>`）が来て目印だと決まった時点で区切る（目印は
 * 閉じていても閉じていなくても声に出ないため、その前で文が切れる）。知らない語のタグ・壊れた山括弧は区切りにしない
 * （今までどおり）。
 */

import { parseExpressionTags } from "./expression-parser.mjs";
import { scanRecallTag } from "./recall-tag.mjs";

const SENTENCE_END = new Set(["。", "！", "？", "!", "?"]);
const TAG_WORD_START = /^[A-Za-z]$/;
const TAG_WORD_CHAR = /^[\w-]$/;
/** 声にする文字（文字か数字）。タグの前で文を区切るかの判定に使う。 */
const SPEAKABLE_CHAR = /[\p{L}\p{N}]/u;
const RECALL_OPEN = "<recall";

/**
 * @typedef {{
 *   raw: string;
 *   position: number;
 *   events: Array<{ word: string; args?: string; position: number }>;
 *   diagnostics: Array<{ type: string; [k: string]: unknown }>;
 *   recalls: Array<{ request: string; position: number }>;
 * }} CompletedExpressionTag
 */

/**
 * @typedef {{ sentences: string[]; tags: CompletedExpressionTag[] }} SentenceTagDelta
 */

/**
 * @returns {{
 *   append: (delta: string) => SentenceTagDelta;
 *   flush: () => SentenceTagDelta;
 *   pendingText: () => string;
 * }}
 */
export function createIncrementalSentenceTagBuffer() {
  /** Text which is known not to be an incomplete expression tag. */
  let plain = "";
  /** Raw source waiting to be scanned. It starts at `sourceStart`. */
  let source = "";
  let sourceStart = 0;
  let receivedChars = 0;

  /** @returns {SentenceTagDelta} */
  const empty = () => ({ sentences: [], tags: [] });

  /** @param {string} text @param {SentenceTagDelta} out */
  const appendPlain = (text, out) => {
    plain += text;
    let boundary;
    while ((boundary = findSentenceBoundary(plain)) >= 0) {
      out.sentences.push(plain.slice(0, boundary + 1));
      plain = plain.slice(boundary + 1);
    }
  };

  /**
   * タグ（完結した表情タグ・目印）の前で文を区切る: 声にする文字が溜まっていれば 1 文として出す。
   * @param {SentenceTagDelta} out
   */
  const endSentenceBeforeTag = (out) => {
    if (SPEAKABLE_CHAR.test(plain)) {
      out.sentences.push(plain);
      plain = "";
    }
  };

  /** @param {string} raw @param {number} position @param {SentenceTagDelta} out */
  const appendTag = (raw, position, out) => {
    // `parseExpressionTags` supplies the established expression vocabulary and
    // diagnostic shape. The raw tag remains available even when it is unknown.
    const parsed = parseExpressionTags(raw);
    // 完結した表情タグ・思い出しの目印は文の区切り: 前に溜まった声の文字を 1 文として出す（タグは含めない）。
    if (parsed.events.length > 0 || parsed.recalls.length > 0) endSentenceBeforeTag(out);
    out.tags.push({
      raw,
      position,
      events: parsed.events.map((event) => ({ ...event, position: position + event.position })),
      diagnostics: parsed.diagnostics,
      recalls: parsed.recalls.map((recall) => ({ ...recall, position: position + recall.position }))
    });
  };

  /** @param {boolean} final @returns {SentenceTagDelta} */
  const drain = (final) => {
    const out = empty();
    let cursor = 0;
    while (cursor < source.length) {
      const nextOpen = source.indexOf("<", cursor);
      const nextClose = source.indexOf(">", cursor);
      const tagStart = firstIndex(nextOpen, nextClose);
      if (tagStart < 0) {
        appendPlain(source.slice(cursor), out);
        cursor = source.length;
        break;
      }
      appendPlain(source.slice(cursor, tagStart), out);
      if (source[tagStart] === ">") {
        // Established parser contract: a stray closing bracket is never speech.
        cursor = tagStart + 1;
        continue;
      }
      // 思い出しの目印は parser と同じ読み方（引数に `<` `>` が混ざっても声に出さない）。
      const recall = scanRecallTag(source, tagStart, final);
      if (recall && recall.kind === "valid") {
        appendTag(source.slice(tagStart, recall.end + 1), sourceStart + tagStart, out);
        cursor = recall.end + 1;
        continue;
      }
      if (recall && recall.kind === "unclosed") {
        // 閉じていない目印: 頼みにせず、声にも出さない（parser は brokenTag に数える）。
        appendTag(source.slice(tagStart, recall.end), sourceStart + tagStart, out);
        cursor = recall.end;
        continue;
      }
      if (recall && recall.kind === "incomplete") {
        // 目印だと決まった（`<recall` の後ろに語の文字でないもの）なら、終わりを待たずにその前で文を区切る。
        if (source.startsWith(RECALL_OPEN, tagStart) && source.length > tagStart + RECALL_OPEN.length) {
          endSentenceBeforeTag(out);
        }
        cursor = tagStart;
        break;
      }
      const candidate = classifyTag(source, tagStart);
      if (candidate.kind === "valid") {
        const raw = source.slice(tagStart, candidate.end + 1);
        appendTag(raw, sourceStart + tagStart, out);
        cursor = candidate.end + 1;
      } else if (candidate.kind === "incomplete") {
        // This is a prefix of the established tag grammar. It remains control
        // syntax across deltas, then is discarded once by final flush.
        if (final) cursor = source.length;
        else {
          cursor = tagStart;
          break;
        }
      } else {
        // Not a tag under the established grammar: retain its body, strip only
        // the current stray `<`, and let a later `>` take the matching branch.
        cursor = tagStart + 1;
      }
    }
    source = source.slice(cursor);
    sourceStart += cursor;
    if (final) {
      // `source` is only an incomplete tag here. It must never become speech.
      sourceStart += source.length;
      source = "";
      if (plain.length > 0) {
        out.sentences.push(plain);
        plain = "";
      }
    }
    return out;
  };

  return {
    append(delta) {
      if (typeof delta !== "string") {
        throw new TypeError("append(delta): delta must be a string.");
      }
      if (source.length === 0) sourceStart = receivedChars;
      source += delta;
      receivedChars += delta.length;
      return drain(false);
    },
    flush() {
      return drain(true);
    },
    pendingText() {
      return plain;
    }
  };
}

/** @param {number} left @param {number} right */
function firstIndex(left, right) {
  if (left < 0) return right;
  if (right < 0) return left;
  return Math.min(left, right);
}

/**
 * Classify a `<` prefix using the same shape as expression-parser's TAG_RE:
 * `<word>` or `<word + whitespace args>`, where word starts ASCII alpha and
 * args contain no angle brackets. A possible but unfinished valid prefix is
 * held; any other malformed input is prose with its brackets stripped.
 * @param {string} input @param {number} start
 * @returns {{ kind: "valid"; end: number } | { kind: "incomplete" } | { kind: "broken" }}
 */
function classifyTag(input, start) {
  let i = start + 1;
  if (i >= input.length) return { kind: "incomplete" };
  if (!TAG_WORD_START.test(input[i])) return { kind: "broken" };
  i += 1;
  while (i < input.length && TAG_WORD_CHAR.test(input[i])) i += 1;
  if (i >= input.length) return { kind: "incomplete" };
  if (input[i] === ">") return { kind: "valid", end: i };
  if (!/\s/.test(input[i])) return { kind: "broken" };
  i += 1;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ">") return { kind: "valid", end: i };
    if (ch === "<") return { kind: "broken" };
    i += 1;
  }
  return { kind: "incomplete" };
}

/** @param {string} text @returns {number} */
function findSentenceBoundary(text) {
  for (let i = 0; i < text.length; i += 1) {
    if (SENTENCE_END.has(text[i])) return i;
  }
  return -1;
}
