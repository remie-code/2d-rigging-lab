// @ts-check
/**
 * 演出表（S4 Domain A・データ駆動の宣言ファイル）— apps/soul/agent。
 *
 * 「表情が乗る」の**唯一の数値の在り処**。6 語の演出語彙それぞれを、器の intent.envelope が
 * 描く ADS カーブ束（1 語 → 1..N スロット）へ写像する宣言テーブル。パーサ・翻訳層・
 * オーケストレータには数値を一切書かない（コード埋め込み禁止・裁定 6）——数値を触りたければ
 * ここだけを触る。
 *
 * ── 各束エントリの形（器契約 channel-intent-envelope-payload-schema.json と同型）─────────
 *   { slotId, peak, attackMs, sustainMs, decayMs }
 *   - slotId : 契約 16 スロット語彙のうち演出向きの 10 個（inventory §1）。head / gaze / body の各軸は
 *              中央スロット（peak -1..1）、eye-blink-* / mouth-smile は重みスロット（peak 0..1）。
 *   - peak   : **強さ係数 1.0 時の基準値**（係数の適用は翻訳層＝表の外・裁定 6）。
 *   - attackMs/sustainMs/decayMs : ADS 各相の長さ（ms・非負・合計 > 0）。
 *              sustainMs は 2〜4 秒帯（細目中に自発瞬きが止まるトレードオフの許容裁定・裁定 4）。
 *
 * ── 符号（向き）についての正直な注記 ────────────────────────────────────────────
 *  head/gaze/body の「正 = どちらの向きか」は**リグ依存**（semantic-slot-definitions の
 *  fallbackPositiveSign が入力プロファイルの学習符号を参照する）。ここでは「軸・大きさ・意図する
 *  向き」を設計意図として固定するが、実機での見え方（例: nod の chin-down が本当に下がるか）は
 *  **人間ゲート（Domain B）で確定**する。符号が逆なら該当行の peak の符号を反転するだけ（1 行修正）。
 *  eye-blink-* は 0=開/1=閉が契約で確定しているため符号の曖昧さは無い。
 *
 * ── 素材事実（inventory §1・ユーザー白状 2026-07-13）─────────────────────────────
 *  mouth-smile は現素材で keyform 未設定（見えない）。だが「魂は標準語彙に書く・見えるかは素材の
 *  責務」の方針どおり smile の束には mouth-smile を書く。現素材で**見える本命は目・視線・頭・体**。
 */

/**
 * @typedef {object} EnvelopeBundleEntry
 * @property {string} slotId    契約スロット語彙の 1 つ。
 * @property {number} peak      係数 1.0 時の基準ピーク値（中央 -1..1 / 重み 0..1）。
 * @property {number} attackMs  立ち上がり（現在値→peak）ms。
 * @property {number} sustainMs peak 保持 ms（2〜4 秒帯）。
 * @property {number} decayMs   立ち下がり（peak→rest）ms。
 */

/**
 * 演出語彙 6 語 → スロット演出束。**このオブジェクトが唯一の数値の在り処**。
 *
 * 各語の設計意図（一行）:
 *  - smile      : 口角を上げ、目を少し細め（笑うと目が細まる）、頭をわずかに傾げる温かい笑み。
 *  - troubled   : 視線が斜め下へ泳ぎ（困った話で目が泳ぐ）、頭を傾げる困惑。
 *  - surprised  : 素早く顎を上げ体を少し引く驚き（attack を最短にして「はっ」を出す）。
 *  - nod        : 顎を下げて戻す頷き（v0 は ADS 単峰＝下げて保持して戻す近似・多峰の頷きは将来）。
 *  - look-away  : 視線を横へ大きく逸らし、頭も少し追従（気まずさ・照れ）。
 *  - look-camera: 視線・頭を正面へ戻し、体をわずかに前傾＝視聴者へ「向き直る」engage。
 *
 * @type {Readonly<Record<string, ReadonlyArray<EnvelopeBundleEntry>>>}
 */
export const EXPRESSION_TABLE = Object.freeze({
  // 笑む: 口角↑ + 細目 + 小さな傾げ。mouth-smile は現素材で見えないが標準語彙として書く。
  smile: Object.freeze([
    Object.freeze({ slotId: "mouth-smile", peak: 0.8, attackMs: 180, sustainMs: 2600, decayMs: 500 }),
    Object.freeze({ slotId: "eye-blink-left", peak: 0.35, attackMs: 180, sustainMs: 2600, decayMs: 500 }),
    Object.freeze({ slotId: "eye-blink-right", peak: 0.35, attackMs: 180, sustainMs: 2600, decayMs: 500 }),
    Object.freeze({ slotId: "head-tilt", peak: 0.12, attackMs: 200, sustainMs: 2600, decayMs: 600 })
  ]),

  // 困る: 視線が斜め下へ泳ぐ（gaze 横 + 縦下）+ 頭を傾げる。
  troubled: Object.freeze([
    Object.freeze({ slotId: "gaze-horizontal", peak: -0.4, attackMs: 220, sustainMs: 2400, decayMs: 600 }),
    Object.freeze({ slotId: "gaze-vertical", peak: -0.25, attackMs: 220, sustainMs: 2400, decayMs: 600 }),
    Object.freeze({ slotId: "head-tilt", peak: 0.2, attackMs: 220, sustainMs: 2400, decayMs: 600 })
  ]),

  // 驚く: 顎↑ + 体を引く + 目線↑。attack 最短（100ms）で「はっ」の素早さ。
  surprised: Object.freeze([
    Object.freeze({ slotId: "head-vertical", peak: 0.3, attackMs: 100, sustainMs: 2000, decayMs: 450 }),
    Object.freeze({ slotId: "body-z", peak: -0.25, attackMs: 100, sustainMs: 2000, decayMs: 450 }),
    Object.freeze({ slotId: "gaze-vertical", peak: 0.15, attackMs: 100, sustainMs: 2000, decayMs: 450 })
  ]),

  // 頷く: 顎↓（surprised と逆符号）。v0 は単峰 ADS ＝ 下げて保持して戻す近似（多峰の頷きは将来）。
  nod: Object.freeze([
    Object.freeze({ slotId: "head-vertical", peak: -0.35, attackMs: 150, sustainMs: 2000, decayMs: 500 })
  ]),

  // 逸らす: 視線を横へ大きく + 頭も少し追従。
  "look-away": Object.freeze([
    Object.freeze({ slotId: "gaze-horizontal", peak: -0.6, attackMs: 200, sustainMs: 2500, decayMs: 550 }),
    Object.freeze({ slotId: "head-horizontal", peak: -0.25, attackMs: 200, sustainMs: 2500, decayMs: 550 })
  ]),

  // 向き直る: 視線・頭を正面（peak 0＝逸らしからの復帰）+ 体をわずかに前傾で engage を可視化。
  "look-camera": Object.freeze([
    Object.freeze({ slotId: "gaze-horizontal", peak: 0, attackMs: 200, sustainMs: 2500, decayMs: 550 }),
    Object.freeze({ slotId: "head-horizontal", peak: 0, attackMs: 200, sustainMs: 2500, decayMs: 550 }),
    Object.freeze({ slotId: "body-z", peak: 0.15, attackMs: 200, sustainMs: 2500, decayMs: 550 })
  ])
});

/**
 * 演出語彙（6 語）の語リスト。パーサの既知/未知タグ判定の**単一の正**。
 * （語彙をここ 1 箇所に持たせ、パーサ・翻訳層が import する。）
 * @type {ReadonlyArray<string>}
 */
export const EXPRESSION_WORDS = Object.freeze(Object.keys(EXPRESSION_TABLE));
