// @ts-check
/**
 * 逐次 LLM delta 用の、文境界と expression tag を分離する純粋な小部品。
 *
 * この部品は TTS や Fire の状態を一切知らない。delta を一度だけ append し、
 * 完結した文と完結した tag を出力する。既存 expression parser と同じ tag grammar
 * だけを control syntax と見なし、その未完形は保持する。壊れた angle bracket は
 * parser と同様に bracket だけを剥ぎ、非 tag 本文を落とさない。
 */

import { parseExpressionTags } from "./expression-parser.mjs";

const SENTENCE_END = new Set(["。", "！", "？", "!", "?"]);
const TAG_WORD_START = /^[A-Za-z]$/;
const TAG_WORD_CHAR = /^[\w-]$/;

/**
 * @typedef {{
 *   raw: string;
 *   position: number;
 *   events: Array<{ word: string; args?: string; position: number }>;
 *   diagnostics: Array<{ type: string; [k: string]: unknown }>;
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

  /** @param {string} raw @param {number} position @param {SentenceTagDelta} out */
  const appendTag = (raw, position, out) => {
    // `parseExpressionTags` supplies the established expression vocabulary and
    // diagnostic shape. The raw tag remains available even when it is unknown.
    const parsed = parseExpressionTags(raw);
    out.tags.push({
      raw,
      position,
      events: parsed.events.map((event) => ({ ...event, position: position + event.position })),
      diagnostics: parsed.diagnostics
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
