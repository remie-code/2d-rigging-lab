// @ts-check
/**
 * 発火時の注入整形（S3 Domain A・純関数）— apps/soul/agent。
 *
 * Fire が来た瞬間、会話ログ（転写バッファの all()）から**直近 X 分の窓**を切り出し、話者ラベル付きの
 * 1 本のテキストへ整形して LLM セッションへ渡す入力を作る。ここは会話ログ → LLM 入力文字列の
 * **純関数**（I/O ゼロ・依存ゼロ・時計注入）——発火オーケストレータ（fire-orchestrator.mjs）から
 * 呼ばれ、fixture テストで網羅的に固定できる。
 *
 * ── 窓の時間軸は appendedAtMs（壁時計）【設計判断】────────────────────────────
 *  転写エントリは 2 つの時間軸を持つ: startMs/endMs（VAD 由来のストリーム時刻）と appendedAtMs
 *  （append 時の壁時計）。魂の発話（speaker:"soul"）は録音ストリーム上の区間を持たない
 *  （startMs/endMs=0）ため、you と soul を同一の軸で並べるには **appendedAtMs（実時間）**で窓を切る。
 *  よって窓判定は `appendedAtMs >= nowMs - windowMs`。nowMs は呼び出し側が渡す実時計（注入可）。
 *
 * ── 文字数上限は新しい方優先で古い方を落とす ────────────────────────────────
 *  窓で絞った後、話者ラベル付きの整形テキストが maxChars を超える場合、**古い（seq 小）方から**
 *  行を落として上限内に収める（直近の文脈を優先）。ただし最新 1 行だけは常に残す
 *  （安全弁はベストエフォート——単一発話が maxChars を超えても空注入にはしない・発火判定を殺さない）。
 *
 * ── 出力 ────────────────────────────────────────────────────────────────
 *  { text, includedCount, charCount, droppedByWindow, droppedByLimit, firstSeq, lastSeq }。
 *  空窓（includedCount===0・text===""）は発火オーケストレータが「ask を無駄撃ちしない」判定に使う。
 *  firstSeq / lastSeq は注入に残った行の始まりと終わりの seq（転写バッファの seq・空窓や seq が無い行は null）。
 *  操縦席の「推論に使った範囲」の材料（discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md §9.2）。
 *  includedSeqs は、既送信のゲーム画面などで途中の行が抜けた場合にも実際に渡した行を示す。
 */

import { isGameScreenEntry } from "../ears/transcript-buffer.mjs";

/** @typedef {{ seq?: number; text: string; speaker?: string; displayName?: string; appendedAtMs: number; displayOrder?: number; startedAt?: number; lastSeenAt?: number }} InjectionEntry */
/** @typedef {{ nowMs: number; windowMs?: number; maxChars?: number; hasGameScreen?: boolean; previousAskAtMs?: number; previousAskSeq?: number }} InjectionOptions */

/** 注入窓の既定（直近 5 分・wave 計画 §2 裁定 2）。設定で差し替え可能。 */
export const FIRE_WINDOW_MS = 5 * 60 * 1000;

/** 注入テキストの文字数上限（安全弁・超過時は新しい方優先で古い方を落とす）。 */
export const FIRE_MAX_CHARS = 4000;

/**
 * 話者ラベルを返す（未知話者は "you" に寄せる・防御的）。soul→"soul"・viewer→"viewer"・event→"event"（出来事の行・
 * Discord モード Domain J）・その他→"you"。
 * @param {unknown} speaker
 * @returns {"you" | "soul" | "viewer" | "event"}
 */
function labelOf(speaker) {
  if (speaker === "soul") return "soul";
  if (speaker === "viewer") return "viewer";
  if (speaker === "event") return "event";
  return "you";
}

/**
 * 会話ログの 1 エントリを話者ラベル付きの 1 行へ整形する。
 *  you  → `you: 本文`（名前があれば `you(名前): 本文`・Discord モード Domain A。配信では you に名前を入れない）
 *  soul → `soul: 本文`（ロールの名前を持っていても付けない・ロールが 1 つの間は今のまま・discord-mode.md §3.2 a）
 *  viewer → `viewer(名前): 本文`（displayName 欠落/空なら `viewer: 本文` に劣化・S7 視聴者コメント）
 *  event → `event: 本文`（出来事の行・名前は本文の中にある・Discord モード Domain J。配信には出来事の行が無い）
 * speakerId（場の中の記録にだけ持つ id）は読まない。
 * @param {InjectionEntry} e
 * @returns {string}
 */
function formatLine(e) {
  if (isGameScreenEntry(e)) return formatGameScreenLine(e);
  const label = labelOf(e.speaker);
  if (label === "viewer" || label === "you") {
    const name = typeof e.displayName === "string" ? e.displayName.trim() : "";
    return name.length > 0 ? `${label}(${name}): ${e.text}` : `${label}: ${e.text}`;
  }
  return `${label}: ${e.text}`;
}

/** @param {{ text: string; displayOrder?: number; startedAt?: number; lastSeenAt?: number }} entry */
export function formatGameScreenLine(entry) {
  const { text, displayOrder, startedAt, lastSeenAt } = entry;
  if (startedAt == null || lastSeenAt == null) return `［ゲーム画面］\n${text}`;
  const start = new Date(startedAt).toISOString();
  const end = new Date(lastSeenAt).toISOString();
  return `［ゲーム画面・表示順 ${displayOrder}・表示 ${start} ～ ${end}］\n${text}`;
}

/**
 * 話者ラベル付き行の配列を改行結合したときの総文字数（join("\n") の長さ）。
 * @param {string[]} lines
 * @returns {number}
 */
function joinedLength(lines) {
  if (lines.length === 0) return 0;
  let total = 0;
  for (const l of lines) total += l.length;
  return total + (lines.length - 1); // 改行の分。
}

/**
 * 会話ログを Fire 注入テキストへ整形する（純関数）。
 *
 * @param {ReadonlyArray<InjectionEntry>} entries
 *   転写バッファの all() が返す形（seq 昇順 = 時系列）。viewer エントリは displayName を持ちうる。
 * @param {InjectionOptions} options
 */
export function formatFireInjection(entries, options = /** @type {any} */ ({})) {
  const nowMs = options.nowMs;
  const windowMs = options.windowMs ?? FIRE_WINDOW_MS;
  const maxChars = options.maxChars ?? FIRE_MAX_CHARS;

  if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) {
    throw new TypeError(`formatFireInjection: options.nowMs must be a finite number; got ${nowMs}.`);
  }
  if (typeof windowMs !== "number" || !Number.isFinite(windowMs) || windowMs < 0) {
    throw new TypeError(`formatFireInjection: options.windowMs must be a non-negative finite number; got ${windowMs}.`);
  }
  if (typeof maxChars !== "number" || !Number.isFinite(maxChars) || maxChars < 1) {
    throw new TypeError(`formatFireInjection: options.maxChars must be a finite number >= 1; got ${maxChars}.`);
  }

  const supplied = Array.isArray(entries) ? entries : [];
  const list = supplied.filter((entry) => entry != null);
  const previousAskSeq = options.previousAskSeq ?? -1;
  /** @type {Array<{seq: number; startedAt: number | undefined; reason: "time" | "chars"}>} */
  const droppedUnsentGame = [];
  const recordDrop = (/** @type {InjectionEntry} */ entry, /** @type {"time" | "chars"} */ reason) => {
    if (isGameScreenEntry(entry) && entry.seq != null && entry.seq > previousAskSeq) {
      droppedUnsentGame.push({ seq: entry.seq, startedAt: entry.startedAt, reason });
    }
  };
  const pending = list.filter((entry) => (entry.seq ?? Infinity) > previousAskSeq);
  const pendingChars = joinedLength(pending.map(formatLine));
  const pendingSince = options.previousAskAtMs ?? pending[0]?.appendedAtMs ?? nowMs;

  // (a) appendedAtMs で窓を絞る（実時間軸）。
  const threshold = nowMs - windowMs;
  const inWindow = list.filter((entry) => {
    if (entry.appendedAtMs >= threshold) return true;
    recordDrop(entry, "time");
    return false;
  });
  const droppedByWindow = supplied.length - inWindow.length;

  // (b) 話者ラベル付き整形（seq 昇順のまま）。viewer は `viewer(名前):` で描く。
  const lines = inWindow.map(formatLine);

  // (c) 文字数上限: 超過なら古い方（先頭）から落とす。最新 1 行は常に残す。
  let keptChars = joinedLength(lines);
  let droppedByLimit = 0;
  while (lines.length - droppedByLimit > 1 && keptChars > maxChars) {
    recordDrop(inWindow[droppedByLimit], "chars");
    keptChars -= lines[droppedByLimit].length + 1;
    droppedByLimit += 1;
  }

  const text = lines.slice(droppedByLimit).join("\n");
  const keptEntries = inWindow.slice(droppedByLimit);
  const seqOf = (/** @type {any} */ e) => (e && typeof e.seq === "number" && Number.isFinite(e.seq) ? e.seq : null);
  const includedSeqs = keptEntries.map(seqOf).filter((seq) => seq !== null);
  return {
    text,
    includedCount: keptEntries.length,
    charCount: text.length,
    droppedByWindow,
    droppedByLimit,
    firstSeq: keptEntries.length > 0 ? seqOf(keptEntries[0]) : null,
    lastSeq: keptEntries.length > 0 ? seqOf(keptEntries[keptEntries.length - 1]) : null,
    includedSeqs,
    conversationWindow: {
      hasGameScreen: options.hasGameScreen === true || list.some(isGameScreenEntry),
      pendingElapsedMs: Math.max(0, nowMs - pendingSince),
      pendingChars,
      droppedUnsentGame
    }
  };
}

/** 前回の ask から新しい行が無い発火で、会話の窓の代わりに渡す一言（context-growth-2026-10.md §6）。 */
export const FIRE_NO_NEW_LINES_TEXT = "（前回から新しい発言はなし）";

/**
 * 前回の ask で渡した最後の seq より後ろの行だけで注入テキストを作る（純関数・増えた分だけ渡す）。
 *
 * 同じ会話（Codex の thread）は前の ask を全部覚えているので、発火のたびに直近 5 分を丸ごと渡すと同じ行が
 * 何度も積み上がる（context-growth-2026-10.md §1）。ここでは `afterSeq` より大きい seq の行（you / soul /
 * viewer。チャッピーの行＝実際に聞こえた分の soul 行も含む）だけを、formatFireInjection と同じ窓（直近
 * windowMs）・同じ上限（maxChars）で整形する。`afterSeq` が null（同じ会話だがまだ行を渡していない）なら
 * 窓の全部。seq を持たない行は「前回より後か」が分からないので含めない。
 *
 * 新しい行が 1 つも無ければ text は FIRE_NO_NEW_LINES_TEXT（includedCount 0・firstSeq / lastSeq null・
 * charCount はその一言の長さ）。会話が新しく始まったとき（世代が変わったとき）は呼び出し側が
 * formatFireInjection（従来の直近 5 分の全部）を使う。
 *
 * @param {ReadonlyArray<InjectionEntry>} entries
 * @param {InjectionOptions & {afterSeq: number | null}} options
 */
export function formatFireInjectionSince(entries, options) {
  const list = Array.isArray(entries) ? entries : [];
  const afterSeq = options && typeof options.afterSeq === "number" && Number.isFinite(options.afterSeq) ? options.afterSeq : null;
  const fresh =
    afterSeq == null
      ? list
      : list.filter((e) => e != null && typeof e.seq === "number" && Number.isFinite(e.seq) && e.seq > afterSeq);
  const droppedBySeq = list.length - fresh.length;
  const base = formatFireInjection(fresh, options);
  if (base.includedCount > 0) return { ...base, droppedBySeq };
  return {
    ...base,
    text: FIRE_NO_NEW_LINES_TEXT,
    charCount: FIRE_NO_NEW_LINES_TEXT.length,
    firstSeq: null,
    lastSeq: null,
    droppedBySeq
  };
}
