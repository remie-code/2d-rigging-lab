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
 *  窓は常に末尾から連続する（窓で絞り・古い方から落とすだけ）ので、範囲は始まりと終わりの 2 つで表せる。
 */

/** 注入窓の既定（直近 5 分・wave 計画 §2 裁定 2）。設定で差し替え可能。 */
export const FIRE_WINDOW_MS = 5 * 60 * 1000;

/** 注入テキストの文字数上限（安全弁・超過時は新しい方優先で古い方を落とす）。 */
export const FIRE_MAX_CHARS = 4000;

/**
 * 話者ラベルを返す（未知話者は "you" に寄せる・防御的）。soul→"soul"・viewer→"viewer"・その他→"you"。
 * @param {unknown} speaker
 * @returns {"you" | "soul" | "viewer"}
 */
function labelOf(speaker) {
  if (speaker === "soul") return "soul";
  if (speaker === "viewer") return "viewer";
  return "you";
}

/**
 * 会話ログの 1 エントリを話者ラベル付きの 1 行へ整形する。
 *  you  → `you: 本文`
 *  soul → `soul: 本文`
 *  viewer → `viewer(名前): 本文`（displayName 欠落/空なら `viewer: 本文` に劣化・S7 視聴者コメント）
 * @param {{ text: string; speaker?: string; displayName?: string }} e
 * @returns {string}
 */
function formatLine(e) {
  const label = labelOf(e.speaker);
  if (label === "viewer") {
    const name = typeof e.displayName === "string" ? e.displayName.trim() : "";
    return name.length > 0 ? `viewer(${name}): ${e.text}` : `viewer: ${e.text}`;
  }
  return `${label}: ${e.text}`;
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
 * @param {ReadonlyArray<{ seq?: number; text: string; speaker?: string; displayName?: string; appendedAtMs: number }>} entries
 *   転写バッファの all() が返す形（seq 昇順 = 時系列）。viewer エントリは displayName を持ちうる。
 * @param {object} options
 * @param {number} options.nowMs  現在の壁時計（窓の起点・注入必須）。
 * @param {number} [options.windowMs=FIRE_WINDOW_MS]  窓幅（ミリ秒）。
 * @param {number} [options.maxChars=FIRE_MAX_CHARS]  注入テキストの文字数上限。
 * @returns {{ text: string; includedCount: number; charCount: number; droppedByWindow: number; droppedByLimit: number; firstSeq: number | null; lastSeq: number | null }}
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

  const list = Array.isArray(entries) ? entries : [];

  // (a) appendedAtMs で窓を絞る（実時間軸）。
  const threshold = nowMs - windowMs;
  const inWindow = list.filter((e) => e != null && e.appendedAtMs >= threshold);
  const droppedByWindow = list.length - inWindow.length;

  // (b) 話者ラベル付き整形（seq 昇順のまま）。viewer は `viewer(名前):` で描く。
  const lines = inWindow.map(formatLine);

  // (c) 文字数上限: 超過なら古い方（先頭）から落とす。最新 1 行は常に残す。
  const kept = lines.slice();
  let droppedByLimit = 0;
  while (kept.length > 1 && joinedLength(kept) > maxChars) {
    kept.shift();
    droppedByLimit += 1;
  }

  const text = kept.join("\n");
  // 残った行（inWindow の末尾 kept.length 件）の始まりと終わりの seq。
  const keptEntries = inWindow.slice(inWindow.length - kept.length);
  const seqOf = (/** @type {any} */ e) => (e && typeof e.seq === "number" && Number.isFinite(e.seq) ? e.seq : null);
  return {
    text,
    includedCount: kept.length,
    charCount: text.length,
    droppedByWindow,
    droppedByLimit,
    firstSeq: keptEntries.length > 0 ? seqOf(keptEntries[0]) : null,
    lastSeq: keptEntries.length > 0 ? seqOf(keptEntries[keptEntries.length - 1]) : null
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
 * @param {ReadonlyArray<{ seq?: number; text: string; speaker?: string; displayName?: string; appendedAtMs: number }>} entries
 * @param {{ nowMs: number; windowMs?: number; maxChars?: number; afterSeq: number | null }} options
 * @returns {{ text: string; includedCount: number; charCount: number; droppedByWindow: number; droppedByLimit: number; firstSeq: number | null; lastSeq: number | null; droppedBySeq: number }}
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
