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
 *  { text, includedCount, charCount, droppedByWindow, droppedByLimit }。
 *  空窓（includedCount===0・text===""）は発火オーケストレータが「ask を無駄撃ちしない」判定に使う。
 */

/** 注入窓の既定（直近 5 分・wave 計画 §2 裁定 2）。設定で差し替え可能。 */
export const FIRE_WINDOW_MS = 5 * 60 * 1000;

/** 注入テキストの文字数上限（安全弁・超過時は新しい方優先で古い方を落とす）。 */
export const FIRE_MAX_CHARS = 4000;

/**
 * 話者ラベルを返す（未知話者は "you" に寄せる・防御的）。
 * @param {unknown} speaker
 * @returns {"you" | "soul"}
 */
function labelOf(speaker) {
  return speaker === "soul" ? "soul" : "you";
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
 * @param {ReadonlyArray<{ text: string; speaker?: string; appendedAtMs: number }>} entries
 *   転写バッファの all() が返す形（seq 昇順 = 時系列）。
 * @param {object} options
 * @param {number} options.nowMs  現在の壁時計（窓の起点・注入必須）。
 * @param {number} [options.windowMs=FIRE_WINDOW_MS]  窓幅（ミリ秒）。
 * @param {number} [options.maxChars=FIRE_MAX_CHARS]  注入テキストの文字数上限。
 * @returns {{ text: string; includedCount: number; charCount: number; droppedByWindow: number; droppedByLimit: number }}
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

  // (b) 話者ラベル付き整形（seq 昇順のまま）。
  const lines = inWindow.map((e) => `${labelOf(e.speaker)}: ${e.text}`);

  // (c) 文字数上限: 超過なら古い方（先頭）から落とす。最新 1 行は常に残す。
  const kept = lines.slice();
  let droppedByLimit = 0;
  while (kept.length > 1 && joinedLength(kept) > maxChars) {
    kept.shift();
    droppedByLimit += 1;
  }

  const text = kept.join("\n");
  return {
    text,
    includedCount: kept.length,
    charCount: text.length,
    droppedByWindow,
    droppedByLimit
  };
}
