// @ts-check
/**
 * ElevenLabs の文字時刻 + AivisSpeech の読み → 口の時間割（声の差し替え Wave 3 Domain D）— apps/soul/agent。
 *
 * 方針: discussion/ai-cohost/elevenlabs/research/lipsync-inputs-2026-10.md §4・§5、
 * discussion/ai-cohost/implementation/orchestration/voice-swap-wave-plan.md §3 Domain D「口の時間割」1〜6。
 * I/O なしの純関数と、文字時刻を受け取りながら時間割を少しずつ出す組み立て器だけを置く。
 *
 * ── 作り方 ─────────────────────────────────────────────────────────────
 *  1. 本文を区間に束ねる（{@link segmentText}）。区切りは句読点・タグ（`[...]` と後ろの空白）・
 *     かなと漢字/英数字の切れ目。区間の種類は kana / word（漢字・英数字）/ pause（句読点）/ sep（空白・括弧等）/ tag。
 *     声の区間（kana / word）は 1 つずつ、黙る区間（pause / sep / tag）は続いた分を 1 つにまとめる。
 *  2. 読み（AivisSpeech `/accent_phrases` のモーラ。タグを除いた本文で取る）を `pau`（と pause_mora）で
 *     まとまりに分け、本文の句読点で分けたまとまりと数が合えば組ごとに、合わなければ文全体を 1 組にして割り付ける。
 *     組の中では、かなの区間を読みの中から探して錨にし（は→ワ・を→オ・長音↔母音のゆるい一致）、
 *     錨の間のモーラを漢字/英数字の区間へ渡す（複数あるときは字数の比で分ける）。錨が見つからない組は
 *     数の比（かな＝モーラ数、漢字等＝字数 ×2）でモーラを順に配る。
 *  3. 声の区間の中は均等にモーラを置く（ん・っ など母音のないモーラは要素を出さず、時間の枠だけ使う）。
 *  4. 開き量は母音ごとの固定値（mora-timeline の DEFAULT_S_BY_VOWEL を共有）。
 *  5. 読みが無いときは簡易版: かなは表で母音を引き、漢字/英数字の区間は区間ごとに開け閉めする
 *     （始まりで a に開き、真ん中で閉じる）。
 *  6. すべての timeMs に alignmentLeadMs を足す（既定 0）。
 *
 * ── 口を閉じる（器の補間に合わせた裁量）─────────────────────────────────────
 *  器は隣り合う要素の間を補間する（speech-timeline-state.ts）。要素を出さないだけでは口は開いたまま次の
 *  母音へ移るので、黙る区間（タグ・句読点の間など）では開き量 0 の要素で口を閉じる:
 *   - 区間の始まりに `s:0`（直前の母音の形のまま閉じる）。
 *   - 次の声の区間の {@link SILENCE_REOPEN_LEAD_MS} 前に、もう一度 `s:0`（次の母音の形で閉じたまま待つ）。
 *  文頭の黙る区間は長さによらず閉じ、文中は {@link SILENCE_CLOSE_MIN_MS} 以上のときだけ閉じる。文末は始まりで閉じる。
 *  タグの区間に母音の要素は出さない。
 *
 * ── 文字時刻 ───────────────────────────────────────────────────────────
 *  TTD WebSocket の alignment は `{chars, char_start_times_ms, char_durations_ms}` で、届くかたまりごとに 0 から
 *  数え直す。これまでのかたまりの長さ（最後の文字の開始 + 長さ）を足して通し値にする（inventory §3）。
 *  入力 1 文字に 1 組（コードポイント単位で照合）。本文と食い違ったら、その先は文の終わりで簡易版に切り替える。
 */

import { DEFAULT_S_BY_VOWEL, MAX_UTTERANCE_TIMELINE_LENGTH } from "../mora-timeline.mjs";

/** 文中の黙る区間で口を閉じる最短の長さ（ms）。これより短い間は補間に任せる。 */
export const SILENCE_CLOSE_MIN_MS = 100;

/** 黙る区間のあと、次の声の区間の何 ms 前から口を開き始めるか。 */
export const SILENCE_REOPEN_LEAD_MS = 80;

/** 句読点（読みの `pau` に当たる区切り）。 */
const PAUSE_CHARS = new Set([..."、。，．,.!?！？…‥;；:："]);

/** タグの長さの上限（`[` から `]` まで。これより長い `[` はただの記号として扱う）。 */
const MAX_TAG_LENGTH = 64;

/** @typedef {"a"|"i"|"u"|"e"|"o"} Vowel */
/** @typedef {{ timeMs: number; vowel: Vowel; s: number }} TimelineEntry */
/** @typedef {{ text: string; vowel: Vowel | null }} Mora */
/** @typedef {"kana"|"word"|"pause"|"sep"|"tag"} SegmentKind */
/** @typedef {{ kind: SegmentKind; start: number; end: number }} Segment */
/**
 * 時間割の単位。voiced はモーラの母音列（null = 母音なし・時間の枠だけ）を持つ。openClose は簡易版の
 * 漢字/英数字の区間（開いて閉じる）。silent は黙る区間（hasPause = 句読点を含む）。
 * @typedef {(
 *   { kind: "voiced"; start: number; end: number; segKind: "kana" | "word"; vowels: Array<Vowel | null> } |
 *   { kind: "openClose"; start: number; end: number } |
 *   { kind: "silent"; start: number; end: number; hasPause: boolean }
 * )} PlanUnit
 */
/** @typedef {{ chars: string[]; units: PlanUnit[]; mode: "readings" | "simple" }} SentencePlan */

// ── かなの表 ───────────────────────────────────────────────────────────

const VOWEL_OF_KATAKANA = (() => {
  /** @type {Map<string, Vowel>} */
  const map = new Map();
  /** @type {Array<[Vowel, string]>} */
  const rows = [
    ["a", "アカサタナハマヤラワガザダバパァャヮヵ"],
    ["i", "イキシチニヒミリギジヂビピィヰ"],
    ["u", "ウクスツヌフムユルグズヅブプゥュヴ"],
    ["e", "エケセテネヘメレゲゼデベペェヱヶ"],
    ["o", "オコソトノホモヨロヲゴゾドボポォョ"]
  ];
  for (const [vowel, chars] of rows) for (const ch of chars) map.set(ch, vowel);
  return map;
})();

const SMALL_YOON = new Set([..."ャュョヮ"]);
const SMALL_VOWEL = new Map([
  ["ァ", "ア"],
  ["ィ", "イ"],
  ["ゥ", "ウ"],
  ["ェ", "エ"],
  ["ォ", "オ"]
]);
const PURE_VOWEL = new Set([..."アイウエオ"]);

/** @param {string} ch */
function isKanaChar(ch) {
  const code = /** @type {number} */ (ch.codePointAt(0));
  return (code >= 0x3041 && code <= 0x3096) || (code >= 0x309d && code <= 0x309f) || (code >= 0x30a1 && code <= 0x30ff);
}

/** ひらがな → カタカナ（それ以外はそのまま）。 @param {string} ch */
function toKatakana(ch) {
  const code = /** @type {number} */ (ch.codePointAt(0));
  if (code >= 0x3041 && code <= 0x3096) return String.fromCodePoint(code + 0x60);
  return ch;
}

/** @param {string} ch */
function classifyChar(ch) {
  if (isKanaChar(ch)) return "kana";
  if (PAUSE_CHARS.has(ch)) return "pause";
  if (/[\p{L}\p{N}]/u.test(ch)) return "word";
  return "sep";
}

/** @param {string} ch */
function isSpace(ch) {
  return /\s/u.test(ch);
}

/**
 * 本文を区間に分ける（コードポイント単位の添字）。
 * @param {string | string[]} text
 * @returns {Segment[]}
 */
export function segmentText(text) {
  const chars = Array.isArray(text) ? text : Array.from(text);
  /** @type {Segment[]} */
  const segments = [];
  let index = 0;
  while (index < chars.length) {
    const ch = chars[index];
    if (ch === "[") {
      let close = -1;
      for (let probe = index + 1; probe < chars.length && probe - index <= MAX_TAG_LENGTH; probe += 1) {
        if (chars[probe] === "[") break;
        if (chars[probe] === "]") {
          close = probe;
          break;
        }
      }
      if (close > index) {
        let end = close + 1;
        while (end < chars.length && isSpace(chars[end])) end += 1;
        segments.push({ kind: "tag", start: index, end });
        index = end;
        continue;
      }
    }
    const kind = classifyChar(ch);
    let end = index + 1;
    while (end < chars.length && chars[end] !== "[" && classifyChar(chars[end]) === kind) end += 1;
    segments.push({ kind, start: index, end });
    index = end;
  }
  return segments;
}

/**
 * タグを除いた本文（読みを聞く用）。
 * @param {string} text
 * @returns {string}
 */
export function textForReading(text) {
  const chars = Array.from(text);
  return segmentText(chars)
    .filter((segment) => segment.kind !== "tag")
    .map((segment) => chars.slice(segment.start, segment.end).join(""))
    .join("");
}

/**
 * かなの並びをモーラに分ける（カタカナに直す）。小さいャュョは前に付ける。小さいァィゥェォは前の母音と
 * 違うときだけ前に付ける（ティ・ファ）。同じときは伸ばしの 1 モーラ（へぇ → ヘ・エ）。ッ・ンは母音なし、
 * ーは前の母音。
 * @param {string | string[]} kana
 * @returns {Mora[]}
 */
export function splitKanaMoras(kana) {
  const chars = (Array.isArray(kana) ? kana : Array.from(kana)).map(toKatakana);
  /** @type {Mora[]} */
  const moras = [];
  for (const ch of chars) {
    const previous = moras.length > 0 ? moras[moras.length - 1] : null;
    if (SMALL_YOON.has(ch) && previous && previous.vowel !== null) {
      previous.text += ch;
      previous.vowel = /** @type {Vowel} */ (VOWEL_OF_KATAKANA.get(ch));
      continue;
    }
    if (SMALL_VOWEL.has(ch)) {
      const vowel = /** @type {Vowel} */ (VOWEL_OF_KATAKANA.get(ch));
      if (previous && previous.vowel !== null && previous.vowel !== vowel && !PURE_VOWEL.has(previous.text)) {
        previous.text += ch;
        previous.vowel = vowel;
        continue;
      }
      moras.push({ text: /** @type {string} */ (SMALL_VOWEL.get(ch)), vowel });
      continue;
    }
    if (ch === "ー") {
      moras.push({ text: ch, vowel: previous ? previous.vowel : null });
      continue;
    }
    if (ch === "ッ" || ch === "ン") {
      moras.push({ text: ch, vowel: null });
      continue;
    }
    moras.push({ text: ch, vowel: VOWEL_OF_KATAKANA.get(ch) ?? null });
  }
  return moras;
}

/** @param {unknown} raw @returns {Vowel | null} */
function normalizeReadingVowel(raw) {
  if (typeof raw !== "string") return null;
  const lower = raw.toLowerCase();
  return lower === "a" || lower === "i" || lower === "u" || lower === "e" || lower === "o" ? lower : null;
}

/**
 * `/accent_phrases` の返り → 句切れ（`pau` のモーラ・非 null の pause_mora）で分けたモーラのまとまり。
 * 空のまとまりは捨てる。
 * @param {unknown} accentPhrases
 * @returns {Mora[][]}
 * @throws {TypeError} 形が違う。
 */
export function readingGroupsFromAccentPhrases(accentPhrases) {
  if (!Array.isArray(accentPhrases)) throw new TypeError("accent_phrases must be an array.");
  /** @type {Mora[][]} */
  const groups = [];
  /** @type {Mora[]} */
  let current = [];
  const cut = () => {
    if (current.length > 0) groups.push(current);
    current = [];
  };
  for (const phrase of accentPhrases) {
    if (phrase == null || typeof phrase !== "object" || !Array.isArray(/** @type {any} */ (phrase).moras)) {
      throw new TypeError("each accent_phrase must have a moras array.");
    }
    for (const mora of /** @type {any} */ (phrase).moras) {
      if (mora == null || typeof mora !== "object") throw new TypeError("each mora must be an object.");
      if (typeof mora.vowel === "string" && mora.vowel.toLowerCase() === "pau") {
        cut();
        continue;
      }
      current.push({ text: typeof mora.text === "string" ? mora.text : "", vowel: normalizeReadingVowel(mora.vowel) });
    }
    if (/** @type {any} */ (phrase).pause_mora != null) cut();
  }
  cut();
  return groups;
}

// ── 割り付け ───────────────────────────────────────────────────────────

/** @param {string} text */
function normalizeMoraText(text) {
  return text.replace(/ヂ/g, "ジ").replace(/ヅ/g, "ズ").replace(/ヲ/g, "オ");
}

/** @param {string} text */
function isLongish(text) {
  return text === "ー" || PURE_VOWEL.has(text);
}

/**
 * 本文のかなのモーラが読みのモーラと同じ音か（ゆるい一致）。
 * @param {Mora} kanaMora @param {Mora} readingMora
 */
export function kanaMoraMatches(kanaMora, readingMora) {
  const k = normalizeMoraText(kanaMora.text);
  const r = normalizeMoraText(readingMora.text);
  if (k === r) return true;
  if ((k === "ハ" && r === "ワ") || (k === "ヘ" && r === "エ")) return true;
  return isLongish(k) && isLongish(r);
}

/**
 * n 個を重みの比で分ける（最大剰余）。n が個数以上なら各 1 以上。
 * @param {number} n @param {number[]} weights
 * @returns {number[]}
 */
export function splitByWeights(n, weights) {
  const count = weights.length;
  if (count === 0) return [];
  const base = n >= count ? 1 : 0;
  const rest = n - base * count;
  const total = weights.reduce((sum, w) => sum + Math.max(w, 0), 0);
  const shares = weights.map((w) => (total > 0 ? (rest * Math.max(w, 0)) / total : rest / count));
  const out = shares.map((share) => base + Math.floor(share));
  let left = n - out.reduce((sum, v) => sum + v, 0);
  const order = shares
    .map((share, index) => ({ index, frac: share - Math.floor(share) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let k = 0; left > 0; k = (k + 1) % count, left -= 1) out[order[k].index] += 1;
  return out;
}

/**
 * 錨を使った割り付け。成功すれば区間ごとのモーラ列、失敗なら null。
 * @param {Array<{ segKind: "kana" | "word"; kanaMoras: Mora[]; charCount: number }>} units
 * @param {Mora[]} moras
 * @returns {Mora[][] | null}
 */
function allocateByAnchors(units, moras) {
  /** @type {Mora[][]} */
  const out = units.map(() => []);
  let pos = 0;
  /** @type {number[]} */
  let pending = [];
  const givePending = (/** @type {number} */ until) => {
    const counts = splitByWeights(until - pos, pending.map((index) => units[index].charCount));
    for (let k = 0; k < pending.length; k += 1) {
      out[pending[k]] = moras.slice(pos, pos + counts[k]);
      pos += counts[k];
    }
    pending = [];
  };
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (unit.segKind === "word") {
      pending.push(index);
      continue;
    }
    const want = unit.kanaMoras;
    const from = pos + pending.length;
    let found = -1;
    const lastStart = pending.length > 0 ? moras.length - want.length : from;
    for (let start = from; start <= lastStart && start + want.length <= moras.length; start += 1) {
      let ok = true;
      for (let k = 0; k < want.length; k += 1) {
        if (!kanaMoraMatches(want[k], moras[start + k])) {
          ok = false;
          break;
        }
      }
      if (ok) {
        found = start;
        break;
      }
    }
    if (found < 0) return null;
    givePending(found);
    out[index] = moras.slice(pos, pos + want.length);
    pos += want.length;
  }
  if (pending.length > 0) {
    if (moras.length - pos < pending.length) return null;
    givePending(moras.length);
  }
  if (pos !== moras.length) return null;
  return out;
}

/**
 * 錨が使えないときの割り付け: 数の比でモーラを順に配る。
 * @param {Array<{ segKind: "kana" | "word"; kanaMoras: Mora[]; charCount: number }>} units
 * @param {Mora[]} moras
 * @returns {Mora[][]}
 */
function allocateByWeights(units, moras) {
  const counts = splitByWeights(
    moras.length,
    units.map((unit) => (unit.segKind === "kana" ? unit.kanaMoras.length : unit.charCount * 2))
  );
  /** @type {Mora[][]} */
  const out = [];
  let pos = 0;
  for (const count of counts) {
    out.push(moras.slice(pos, pos + count));
    pos += count;
  }
  return out;
}

/**
 * 1 文の段取りを作る（時刻はまだ無い）。readings が null なら簡易版。
 * @param {string} text
 * @param {Mora[][] | null} readings  {@link readingGroupsFromAccentPhrases} の返り。
 * @returns {SentencePlan}
 */
export function planSentence(text, readings) {
  const chars = Array.from(text);
  const segments = segmentText(chars);
  /** @type {PlanUnit[]} */
  const units = [];
  /** 声の区間の元情報（units の添字と対応）。 */
  /** @type {Array<{ unitIndex: number; segKind: "kana" | "word"; kanaMoras: Mora[]; charCount: number; group: number }>} */
  const voiced = [];
  let group = 0;
  for (const segment of segments) {
    if (segment.kind === "kana" || segment.kind === "word") {
      const kanaMoras = segment.kind === "kana" ? splitKanaMoras(chars.slice(segment.start, segment.end)) : [];
      voiced.push({ unitIndex: units.length, segKind: segment.kind, kanaMoras, charCount: segment.end - segment.start, group });
      units.push({ kind: "voiced", start: segment.start, end: segment.end, segKind: segment.kind, vowels: [] });
      continue;
    }
    const isPause = segment.kind === "pause";
    if (isPause && voiced.length > 0 && voiced[voiced.length - 1].group === group) group += 1;
    const last = units.length > 0 ? units[units.length - 1] : null;
    if (last && last.kind === "silent") {
      last.end = segment.end;
      last.hasPause = last.hasPause || isPause;
    } else {
      units.push({ kind: "silent", start: segment.start, end: segment.end, hasPause: isPause });
    }
  }
  const textGroupCount = voiced.length > 0 ? voiced[voiced.length - 1].group + 1 : 0;

  /** 簡易版で埋める。 @param {number} k */
  const fillSimple = (k) => {
    const info = voiced[k];
    const unit = units[info.unitIndex];
    if (info.segKind === "kana") {
      /** @type {any} */ (unit).vowels = info.kanaMoras.map((mora) => mora.vowel);
    } else {
      units[info.unitIndex] = { kind: "openClose", start: unit.start, end: unit.end };
    }
  };

  const usable = Array.isArray(readings) && readings.some((g) => g.length > 0);
  if (!usable) {
    for (let k = 0; k < voiced.length; k += 1) fillSimple(k);
    return { chars, units, mode: "simple" };
  }
  const readingGroups = /** @type {Mora[][]} */ (readings).filter((g) => g.length > 0);
  /** @type {Array<{ members: number[]; moras: Mora[] }>} */
  const pairs = [];
  if (readingGroups.length === textGroupCount) {
    for (let g = 0; g < textGroupCount; g += 1) {
      pairs.push({ members: [], moras: readingGroups[g] });
    }
    voiced.forEach((info, k) => pairs[info.group].members.push(k));
  } else {
    pairs.push({ members: voiced.map((_, k) => k), moras: readingGroups.flat() });
  }
  for (const pair of pairs) {
    const members = pair.members.map((k) => voiced[k]);
    const allocated = allocateByAnchors(members, pair.moras) ?? allocateByWeights(members, pair.moras);
    pair.members.forEach((k, m) => {
      const moras = allocated[m];
      if (moras.length === 0) {
        fillSimple(k);
        return;
      }
      /** @type {any} */ (units[voiced[k].unitIndex]).vowels = moras.map((mora) => mora.vowel);
    });
  }
  return { chars, units, mode: "readings" };
}

// ── 時刻を当てて出す ─────────────────────────────────────────────────────

/**
 * 文字時刻を受け取りながら、段取りの区間が揃った所から時間割を出す組み立て器。
 * @param {object} options
 * @param {SentencePlan} options.plan
 * @param {Record<Vowel, number>} [options.sByVowel]  母音別の開き量（既定 DEFAULT_S_BY_VOWEL）。
 * @param {number} [options.leadMs]  すべての timeMs に足す ms（alignmentLeadMs・既定 0）。
 * @param {number} [options.maxEntries]  発話全体の上限（既定 MAX_UTTERANCE_TIMELINE_LENGTH）。
 */
export function createAlignmentTimelineBuilder(options) {
  const sByVowel = options.sByVowel ?? DEFAULT_S_BY_VOWEL;
  const leadMs = Number.isFinite(options.leadMs) ? /** @type {number} */ (options.leadMs) : 0;
  const maxEntries = options.maxEntries ?? MAX_UTTERANCE_TIMELINE_LENGTH;
  let plan = options.plan;

  /** 受け取った文字（コードポイント）と通し時刻。 */
  /** @type {string[]} */
  const actualChars = [];
  /** @type {Array<{ startMs: number; endMs: number }>} */
  const charTimes = [];
  let offsetMs = 0;
  /** 次に出す段取りの単位。 */
  let cursor = 0;
  /** 本文と食い違った所（以後は文の終わりで簡易版）。 */
  let mismatchAt = -1;
  let emittedCount = 0;
  let capped = false;
  let previousTimeMs = -1;
  /** @type {Vowel | null} */
  let lastVowel = null;
  let lastS = 0;

  /** @param {number} rawMs @param {Vowel} vowel @param {number} s @param {TimelineEntry[]} out */
  const push = (rawMs, vowel, s, out) => {
    if (capped) return;
    const timeMs = Math.max(Math.round(rawMs + leadMs), previousTimeMs + 1, 0);
    if (emittedCount >= maxEntries - 1 && s > 0) {
      // 上限の手前: 最後の 1 枠で口を閉じて打ち切る。
      out.push({ timeMs, vowel, s: 0 });
      emittedCount += 1;
      previousTimeMs = timeMs;
      lastS = 0;
      capped = true;
      return;
    }
    out.push({ timeMs, vowel, s });
    emittedCount += 1;
    previousTimeMs = timeMs;
    lastVowel = vowel;
    lastS = s;
    if (emittedCount >= maxEntries) capped = true;
  };

  /** 段取り中の位置 k 以降で最初に口を開く母音。 @param {SentencePlan} p @param {number} k */
  const nextVowelFrom = (p, k) => {
    for (let index = k; index < p.units.length; index += 1) {
      const unit = p.units[index];
      if (unit.kind === "openClose") return "a";
      if (unit.kind === "voiced") {
        const found = unit.vowels.find((v) => v !== null);
        if (found) return found;
      }
    }
    return null;
  };

  /**
   * 段取りの単位を 1 つ出す。
   * @param {SentencePlan} p @param {number} k @param {number} base  文字添字のずらし（簡易版の続き用）
   * @param {TimelineEntry[]} out
   */
  const emitUnit = (p, k, base, out) => {
    const unit = p.units[k];
    const startMs = charTimes[base + unit.start].startMs;
    const endMs = charTimes[base + unit.end - 1].endMs;
    if (unit.kind === "voiced") {
      const n = unit.vowels.length;
      if (n === 0) return;
      const slot = (endMs - startMs) / n;
      unit.vowels.forEach((vowel, index) => {
        if (vowel !== null) push(startMs + index * slot, vowel, sByVowel[vowel], out);
      });
      return;
    }
    if (unit.kind === "openClose") {
      push(startMs, "a", sByVowel.a, out);
      push(startMs + (endMs - startMs) / 2, "a", 0, out);
      return;
    }
    const next = nextVowelFrom(p, k + 1);
    const isFirst = emittedCount === 0;
    if (next === null) {
      // 文末: 始まりで閉じる（もう開かない）。
      if (!isFirst && lastS > 0) push(startMs, /** @type {Vowel} */ (lastVowel), 0, out);
      return;
    }
    if (!isFirst && endMs - startMs < SILENCE_CLOSE_MIN_MS) return;
    if (isFirst) push(startMs, next, 0, out);
    else if (lastS > 0) push(startMs, /** @type {Vowel} */ (lastVowel), 0, out);
    const holdMs = endMs - SILENCE_REOPEN_LEAD_MS;
    if (holdMs > startMs) push(holdMs, next, 0, out);
  };

  /** 揃った単位を出す。 @param {TimelineEntry[]} out */
  const drain = (out) => {
    while (cursor < plan.units.length) {
      const unit = plan.units[cursor];
      if (charTimes.length < unit.end) return;
      if (mismatchAt >= 0 && unit.end > mismatchAt) return;
      emitUnit(plan, cursor, 0, out);
      cursor += 1;
    }
  };

  return {
    /**
     * TTD の alignment 1 かたまりを受け取り、新しく出せる要素を返す。
     * @param {{ chars?: unknown; char_start_times_ms?: unknown; char_durations_ms?: unknown } | null | undefined} alignment
     * @returns {TimelineEntry[]}
     */
    pushAlignment(alignment) {
      /** @type {TimelineEntry[]} */
      const out = [];
      if (!alignment || !Array.isArray(alignment.chars)) return out;
      const chars = alignment.chars;
      const starts = Array.isArray(alignment.char_start_times_ms) ? alignment.char_start_times_ms : [];
      const durations = Array.isArray(alignment.char_durations_ms) ? alignment.char_durations_ms : [];
      let chunkEnd = 0;
      for (let index = 0; index < chars.length; index += 1) {
        const start = Number(starts[index]);
        const duration = Number(durations[index]);
        const startMs = Number.isFinite(start) ? start : chunkEnd;
        const endMs = startMs + (Number.isFinite(duration) && duration > 0 ? duration : 0);
        chunkEnd = Math.max(chunkEnd, endMs);
        const ch = String(chars[index]);
        // 1 要素に複数のコードポイントが来ても、コードポイントごとに同じ時刻で扱う。
        for (const point of Array.from(ch)) {
          const position = actualChars.length;
          actualChars.push(point);
          charTimes.push({ startMs: offsetMs + startMs, endMs: offsetMs + endMs });
          if (mismatchAt < 0 && position < plan.chars.length && plan.chars[position] !== point) {
            mismatchAt = position;
          }
        }
      }
      offsetMs += chunkEnd;
      drain(out);
      return out;
    },

    /**
     * 文の終わり（is_final_audio_for_turn）。残りを出し、口が開いたままなら音の終わりで閉じる。
     * @returns {TimelineEntry[]}
     */
    finish() {
      /** @type {TimelineEntry[]} */
      const out = [];
      drain(out);
      if (mismatchAt >= 0 || cursor < plan.units.length) {
        // 食い違い・文字時刻の不足: 出していない所から先を、届いた文字で簡易版にして出す。
        const from = cursor < plan.units.length ? plan.units[cursor].start : plan.chars.length;
        if (from < actualChars.length) {
          const rest = planSentence(actualChars.slice(from).join(""), null);
          for (let k = 0; k < rest.units.length; k += 1) {
            if (from + rest.units[k].end > charTimes.length) break;
            emitUnit(rest, k, from, out);
          }
        }
        cursor = plan.units.length;
      }
      if (emittedCount > 0 && lastS > 0 && !capped) push(offsetMs, /** @type {Vowel} */ (lastVowel), 0, out);
      return out;
    },

    /** 診断用（本文を含まない）。 */
    stats() {
      return {
        mode: plan.mode,
        alignmentChars: actualChars.length,
        timelineCount: emittedCount,
        totalMs: offsetMs,
        mismatchAt,
        capped
      };
    }
  };
}
