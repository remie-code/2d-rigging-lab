// @ts-check
/**
 * 配信の文字列の固定テスト（stream-wording-pin.test.mjs）の入力 — Discord モード Domain A。
 *
 * 配信の場面の転写を 1 つに決めたもの。you / soul / 名前つき viewer / 名前の無い viewer / 窓の外の行 /
 * 空白の名前を含む。転写バッファの all() が返す形（seq・startMs・endMs・text・speaker・displayName・appendedAtMs）。
 * soul の行には、Domain A からロールの名前（displayName）と id（speakerId）が載る（設計 §3.2 a）。HEAD の整形は
 * soul の名前と id を見ないので、載せたまま HEAD の出力を写した（ロールが 1 つの間は `soul: 本文` のまま、を固定する）。
 *
 * 窓（PIN_NOW_MS から）: ①は 5 分・判定（speak-now / コメント反応）は 3 分・④と避けるかの判定は 1 分。
 * seq 0 はどの窓の外。seq 1〜3 は 3 分と 5 分の窓の中で 1 分の窓の外。seq 4〜7 はどの窓の中。
 *
 * **この入力は Domain A からブランチの最後まで変えない**（変えると書き写した期待値の意味が変わる）。
 */

/** 発火・判定の基準の時刻（壁時計）。 */
export const PIN_NOW_MS = 1_800_000_000_000;

/** 配信の場面の転写。 */
export const PIN_TRANSCRIPT = Object.freeze([
  Object.freeze({ seq: 0, startMs: 1000, endMs: 2500, text: "前回のボス、どこまで行ったっけ", speaker: "you", displayName: undefined, appendedAtMs: PIN_NOW_MS - 600_000 }),
  Object.freeze({ seq: 1, startMs: 0, endMs: 0, text: "たしか二体目の手前だったよ", speaker: "soul", displayName: "チャッピー", speakerId: "chappy", appendedAtMs: PIN_NOW_MS - 170_000 }),
  Object.freeze({ seq: 2, startMs: 0, endMs: 0, text: "がんばれー", speaker: "viewer", displayName: "  山田  太郎 ", appendedAtMs: PIN_NOW_MS - 150_000 }),
  Object.freeze({ seq: 3, startMs: 480_000, endMs: 482_000, text: "よし、今日こそ倒すぞ", speaker: "you", displayName: undefined, appendedAtMs: PIN_NOW_MS - 120_000 }),
  Object.freeze({ seq: 4, startMs: 0, endMs: 0, text: "初見です", speaker: "viewer", displayName: undefined, appendedAtMs: PIN_NOW_MS - 50_000 }),
  Object.freeze({ seq: 5, startMs: 0, endMs: 0, text: "こんばんは", speaker: "viewer", displayName: "   ", appendedAtMs: PIN_NOW_MS - 40_000 }),
  Object.freeze({ seq: 6, startMs: 0, endMs: 0, text: "おっ、コメントありがとう", speaker: "soul", displayName: "チャッピー", speakerId: "chappy", appendedAtMs: PIN_NOW_MS - 30_000 }),
  Object.freeze({ seq: 7, startMs: 590_000, endMs: 593_500, text: "チャッピー、前の配信で何を話したか覚えてる？", speaker: "you", displayName: undefined, appendedAtMs: PIN_NOW_MS - 10_000 })
]);

/** 判定と④に使う頭の名前。 */
export const PIN_SOUL_NAME = "チャッピー";

/** ④の頼みごと（括弧と改行を含む。無害化の形も固定する）。 */
export const PIN_RECALL_REQUEST = "前回の「ボス」の\n名前 <と> [場所]";

/** ④の要約（複数行・空行・括弧を含む）。 */
export const PIN_RECALL_SUMMARY = "二体目のボスの手前で終わった。\r\n\r\n「次は盾を持っていく」と言っていた <メモ> [1]";

/** ②の本体がすでにあるときのファイル。 */
export const PIN_EXISTING_FILES = Object.freeze(["elden-ring/2026-10-31.md", "zatsudan/2026-10-31.md"]);

/** コメント反応の判定に届いたコメント（空白の名前と、名前つき）。 */
export const PIN_COMMENT_BLANK_NAME = Object.freeze({ id: "c-5", seq: 5, text: "こんばんは", displayName: "   ", arrivedAtMs: PIN_NOW_MS - 40_000 });
export const PIN_COMMENT_NAMED = Object.freeze({ id: "c-2", seq: 2, text: "がんばれー", displayName: "  山田  太郎 ", arrivedAtMs: PIN_NOW_MS - 150_000 });
