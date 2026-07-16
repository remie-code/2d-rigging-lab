// @ts-check
/**
 * NG 最終検査表（S8 Domain C・配信の安全弁）— apps/soul/agent。
 *
 * 「配信中に AI（コーディ）が既知の最悪語（差別語級）を声に出す前に落とす」ための、
 * **標準的な NG ワード・ブロックリスト**（プロフィルタと同種）。目的はそれらの語を発話させない
 * ことであり、ここに語を書くのはそれを防ぐための正当かつ防御的な実装（裁定・s8-wave-plan.md §2）。
 *
 * ── これは starter（v0）である ─────────────────────────────────────────────
 * **このリストは最小限の starter list であり、ユーザーが人間ゲートで最終確認/編集することを前提と
 * する。** 差別語級の最悪語のみを最小限（3〜5 語）だけ選んでいる。URL/電話番号パターンの読み上げ
 * 抑止・軽度の悪態・NG 語の拡張・語形変化/難読化対応は v0 外（s8-wave-plan.md 裁定 2・過剰に広げ
 * ない）。**語数・語彙を触りたいときは `NG_WORDS` のこの 1 箇所だけを触る**（唯一の在り処）。
 *
 * ── 照合方式（素朴形・NFKC 正規化 + 部分一致）───────────────────────────────
 * `containsNgWord(text)` は `text` を `String.prototype.normalize("NFKC")` で正規化し、NG 各語
 * （あらかじめ NFKC 正規化済み）が部分文字列として含まれるかどうかを判定する。全角/半角・互換文字
 * の揺れを吸収する最小限の素朴形であり、凝った正規化（濁点分解対応・伏字/読み替え対応等）や
 * 語形変化対応は v0 外。
 *
 * ── 秘匿への配線（fire-orchestrator.mjs 側の責務）──────────────────────────
 * このモジュールは判定を返すだけで、命中した語やヒットした本文をログ・診断・会話ログへ出力する
 * 責務は持たない。命中時に何を残すか（秘匿）は呼び出し側（fire-orchestrator.mjs の検問所）が
 * 決める。
 */

/**
 * NG 語彙（差別語級の最悪語のみ・最小 starter list）。**このリストが唯一の在り処**。
 *
 * 注意: このファイルは NG ワードの検出という機能上、実際に配信で読み上げてはならない日本語の
 * 差別語をそのまま列挙する（プレースホルダやダミー語では機能しない）。過剰に広げない（裁定 2）。
 *
 * @type {ReadonlyArray<string>}
 */
export const NG_WORDS = Object.freeze([
  "きちがい",
  "土人",
  "支那人",
  "ガイジ",
  "つんぼ"
]);

/**
 * 文字列を NFKC 正規化する（空/非文字列は空文字にフォールバック・防御的）。
 * @param {unknown} s
 * @returns {string}
 */
function normalizeNfkc(s) {
  if (typeof s !== "string" || s.length === 0) return "";
  return s.normalize("NFKC");
}

/** NG_WORDS を NFKC 正規化済みで前計算（照合のたびに正規化し直さない）。 */
const NORMALIZED_NG_WORDS = Object.freeze(NG_WORDS.map((w) => normalizeNfkc(w)));

/**
 * `text` に NG 語が含まれるか判定する（NFKC 正規化 + 部分一致の素朴形）。
 * 空文字/非文字列は false を返す（防御的・expression-only や空応答はこの検査を素通りする）。
 * @param {unknown} text
 * @returns {boolean}
 */
export function containsNgWord(text) {
  if (typeof text !== "string" || text.length === 0) return false;
  const normalized = normalizeNfkc(text);
  if (normalized.length === 0) return false;
  return NORMALIZED_NG_WORDS.some((w) => w.length > 0 && normalized.includes(w));
}

/**
 * NG 没時に正本（soul 本文）へ追記する固定の事実文字列（本文なし・秘匿）。転写バッファは
 * append-only ゆえ、没にした発話の内容ではなく「没にした事実」だけを 1 エントリ追記する
 * （BARGE_IN_NOTE/KILL_NOTE と同じ全角括弧様式・barge-in.mjs の notes 集約とは別モジュールに
 * 置く裁量判断は domain-c.md 参照）。
 * @type {string}
 */
export const NG_BLOCKED_NOTE = "（発話を没にした: NG検査）";
