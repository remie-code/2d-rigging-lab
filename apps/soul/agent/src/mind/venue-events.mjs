// @ts-check
/**
 * 人が気づく出来事の行（Discord モード Domain J・discord-mode.md §13.5）— apps/soul/agent。
 *
 * 体験（Discord の入口）が場の口 `vcEvent(event)` で知らせる出来事 `{ kind, channelName?, fromChannelName?, name?, via? }`
 * （id は来ない）を、会話の正本に積む出来事の行の本文（短い日本語の 1 文）にする純関数。I/O ゼロ・依存ゼロ。
 *  - チャッピー自身: 入った（vc-join・開いたとき / パネルから）・抜けた（vc-leave）・移った（vc-move）・動かされた（vc-moved・
 *    Discord の画面で動かされた）・外された（vc-kicked・キック / チャンネルの削除 / 外へ出された）・接続が切れた（vc-disconnect・
 *    猶予のあいだ戻らなかった）・接続が戻った（vc-reconnect）。
 *  - 今いる VC の人: 入ってきた（person-join）・出ていった（person-leave）。Bot 自身とほかの Bot は体験の側で除いてある。
 * 知らない種類は null（行にしない）。
 *
 * 名前（VC の名前・人の名前）は本文の中にだけ入る。本文は正本（頭への会話の窓・②④の材料・左の「会話」の欄）にだけ載り、ログ・
 * session-usage には書かない（場は種類だけを control に残す）。
 */

/** 出来事の行にする種類（並びは固定）。 */
export const VENUE_EVENT_LINE_KINDS = Object.freeze([
  "vc-join",
  "vc-leave",
  "vc-move",
  "vc-moved",
  "vc-kicked",
  "vc-disconnect",
  "vc-reconnect",
  "person-join",
  "person-leave"
]);

/** 本文に入れる名前の上限（文字数・VC の名前は体験の側で 100 字に切ってある。人の名前は Discord の表示名の上限より余裕を持たせる）。 */
export const VENUE_EVENT_NAME_MAX_CHARS = 100;

/** 人の名前が無いときの呼び方。 */
export const VENUE_EVENT_SOMEONE = "誰か";

/** チャッピー自身の名前が無いときの呼び方。 */
export const VENUE_EVENT_SELF_FALLBACK = "相方の AI";

/**
 * 名前を 1 行の短い語にする（空白・改行は 1 つの空白に詰める・上限で切る・空なら null）。
 * @param {unknown} raw
 * @returns {string | null}
 */
function cleanName(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length === 0) return null;
  return [...name].slice(0, VENUE_EVENT_NAME_MAX_CHARS).join("");
}

/** VC の呼び方（名前が無ければ「VC 」・後ろの助詞との間に空白を 1 つ置く）。 @param {string | null} name */
const vcOf = (name) => (name ? `VC「${name}」` : "VC ");

/**
 * 出来事 → 出来事の行の本文（知らない種類・形の崩れた出来事は null）。
 * @param {unknown} event  `{ kind, channelName?, fromChannelName?, name?, via? }`
 * @param {{ soulName?: string | null }} [options]  soulName: チャッピー自身の名前（ロールの名前）。
 * @returns {string | null}
 */
export function venueEventLineText(event, options = {}) {
  if (event == null || typeof event !== "object") return null;
  const e = /** @type {Record<string, unknown>} */ (event);
  const kind = typeof e.kind === "string" ? e.kind : null;
  if (!kind || !VENUE_EVENT_LINE_KINDS.includes(kind)) return null;
  const self = cleanName(options.soulName) ?? VENUE_EVENT_SELF_FALLBACK;
  const channel = cleanName(e.channelName);
  const from = cleanName(e.fromChannelName);
  const person = cleanName(e.name) ?? VENUE_EVENT_SOMEONE;
  switch (kind) {
    case "vc-join":
      return `${self}が ${vcOf(channel)}に入った`;
    case "vc-leave":
      return `${self}が ${vcOf(channel)}から抜けた`;
    case "vc-move":
      return from && channel ? `${self}が VC「${from}」から「${channel}」に移った` : `${self}が ${vcOf(channel)}に移った`;
    case "vc-moved":
      return from && channel
        ? `${self}が VC「${from}」から「${channel}」に動かされた`
        : `${self}が ${vcOf(channel)}に動かされた`;
    case "vc-kicked":
      return `${self}が ${vcOf(channel)}から外された`;
    case "vc-disconnect":
      return `${self}の ${vcOf(channel)}への接続が切れた`;
    case "vc-reconnect":
      return `${self}の ${vcOf(channel)}への接続が戻った`;
    case "person-join":
      return `${person}が入ってきた`;
    case "person-leave":
      return `${person}が出ていった`;
    default:
      return null;
  }
}
