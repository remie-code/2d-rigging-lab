// @ts-check
/**
 * 発火スケジューラ（S6 Domain C・「いつ喋るか」を機械信号だけで決める心臓）— apps/soul/agent。
 *
 * 「こーでぃー」と呼ばれたら返す（呼びかけ）／実況の区切りでたまに拾う（区切り応答）／しばらく無言なら
 * そのうち画面を見て一言（沈黙）——この自発 3 種を、**LLM を一切使わず**機械信号（VAD イベント時刻・
 * タイマ・文字列照合・注入 RNG）だけで判定する純ロジック。判定結果は発火「要求」として onFireRequest で
 * 結線層へ通知し、結線層が対応する fire を呼ぶ（call/turn-end → 通常 Fire・silence → 視覚発火）。
 *
 * ── この Domain の絶対原則（wave 計画 §2 原則・§4 blocking 基準 3）──────────────────
 *  **「いつ喋るか」は機械信号のみ。LLM は「何を言うか」だけ。判断のための ask は打たない。**
 *  このモジュールは依存ゼロ（import 文が 1 つも無い）＝LLM/SDK/session への到達経路が構造的に存在しない。
 *  発火要求を出すだけで、実際の ask/発話は結線層の fire-orchestrator が担う（スケジューラは ask しない）。
 *  fake clock（nowImpl）+ 注入 setTimeout/clearTimeout + 注入 RNG で全分岐を決定論的にテストできる。
 *
 * ── 自発の判定規則（wave 計画 §3 Domain C・inventory §1 裁定 4 / S7 §3 Domain B・裁定 5）─────────
 *  1. **呼びかけ（call）**: 転写（you・**soul 除外**）が来たら名前の文字列照合（正規化 + 揺れ集合）。
 *     命中したら**確実に**発火要求（不応期・確率は掛けない = 呼ばれたら返す・裁定 4）。busy 中は出さない。
 *  2. **区切り応答（turn-end）**: speechEnd 後、turnEndSilenceMs の無音が続き（間に speechStart が来ない）、
 *     かつ**不応期**（直近発火からの経過 ≥ turnEndRefractoryMs）を過ぎ、かつ**確率**（注入 RNG）に当たったら
 *     ——即発火せず**armed（構え）**状態に入る（追撃修正・TURN_END_ARM_TIMEOUT_MS 定数コメント参照）。
 *     armed 中にその発話の転写（speaker "you"）が handleTranscript に届いたら、その時点で発火要求を出す
 *     （呼びかけ call に命中した場合は call が勝ち、pending turn-end は破棄 = 二重発火させない）。
 *     turnEndArmTimeoutMs 内に転写が届かなければタイムアウトで静かに armed を解除する（発火しない）。
 *     全部には返さない（裁定 4「実況の区切りでたまに拾う」）。
 *  3. **沈黙（silence）**: 最後の活動（you 発話 / 魂発火 / VAD / **viewer コメント**）から silenceBaseMs +
 *     **ジッター**（注入 RNG）経過し、かつ**長い不応期**（≥ silenceRefractoryMs）を過ぎ、かつ**予算**
 *     （セッション内の沈黙発火回数上限）が残っていたら発火要求（silence は視覚発火相当 = 画面を見て一言）。
 *     頻度がうるさくならないよう予算 + 長不応期 + ジッターで希釈する（人間ゲート ④）。
 *
 *  ── S7「視聴者が混ざる」第 5・第 6 の語彙（handleChatMessage・inventory §1 裁定 5）────────────
 *  4. **コメント応答（comment）**: YouTube Live コメントが到着したら、**不応期**（≥ commentRefractoryMs）+
 *     **確率**（注入 RNG）+ **予算**（commentBudget）を満たしたときだけ発火要求（区切り応答の写経）。
 *     全コメントには返さない（うるさくならない・費用も嵩まない希釈弁）。busy/OFF は沈黙。
 *  5. **コメント内呼びかけ（comment-call）**: コメント本文に名前（**テキスト用揺れ集合**）が含まれたら
 *     **確実に**発火要求（不応期・確率・予算を掛けない = 呼ばれたら返す・裁定 5。音声呼びかけと対称）。
 *     テキストは ASR 揺れと無縁だが視聴者の表記揺れは別集合（NAME_VARIANTS_TEXT_V0）。busy/OFF は沈黙。
 *
 *  **viewer コメントの活動扱い（S7 裁定）**: コメントは「場が動いた」活動だが**魂の発話ではない**——
 *  沈黙タイマは armSilence で再武装する（活発なチャットは「画面を見て一言」を先送りする）が、不応期の基点
 *  `lastFireAtMs` は**実際に発火要求を出したときだけ**更新する（コメント到着そのものでは更新しない）。
 *  ★ 二重発火の断ち（cockpit-server の接ぎ目）: viewer コメントは同じ転写バッファへ append されるため
 *  handleTranscript も通るが、handleTranscript は viewer を**無視**（no-op）し、発火は handleChatMessage
 *  だけが担う（you 経路の call 照合/armSilence を viewer で誤起動させない）。
 *
 *  数値は全部 v0 コード内定数（下記 export 定数・BARGE_IN_MIN_SPEECH_MS 型）。**ツマミは作らない**
 *  （ゲインの教訓・裁定 8）。人間ゲートの体感で定数を直す前提。
 *
 * ── busy / 自発 OFF ─────────────────────────────────────────────────────────
 *  busy 中（isBusy() 真・orchestrator が thinking/speaking）・自発 OFF 中は発火要求を出さない。busy 無視は
 *  既存状態機械（fire-orchestrator）も担うが、無駄な発火要求を減らすためスケジューラ側でも出さない。
 *  自発 OFF（setEnabled(false)）で 3 種とも黙り、タイマも畳む（手動 Fire はスケジューラ非経由 = 影響なし）。
 *
 * ── 直近発火の基点（lastFireAtMs）─────────────────────────────────────────────
 *  不応期の基点は「直近発火からの経過」。スケジューラが発火要求を出したとき（call/turn-end/silence）に
 *  更新するほか、**魂の転写 append（speaker:"soul"）でも更新**する——これにより手動 Fire・呼びかけ・区切り・
 *  沈黙のいずれの発火でも、実際に魂が喋った時点で不応期がリセットされる（自発が直後に重ならない）。
 */

/**
 * 区切り応答の無音待ち（v0 定数・wave 計画 §2 裁定 8）。speechEnd（セグメンタは既に minSilenceMs=常駐 400ms の
 * 無音を確定済み）から**さらに**この時間の無音が続いたら区切り応答の候補にする。ASR の warm レイテンシ
 * （≈1.5〜1.8s・experiments/s2-ears.md）より長めに取り、区切り応答が撃つ時点で直前 you 発話の転写が
 * 会話ログ（転写バッファ）に載っている確度を上げる（発火は buffer.all() を読むため）。人間ゲートで直す。
 */
export const TURN_END_SILENCE_MS = 2000;

/**
 * 区切り応答の発火確率（v0 定数）。無音・不応期を満たしても、この確率に当たったときだけ発火要求を出す
 * （注入 RNG）。「全部には返さない」（裁定 4）を機械的に実現する希釈弁。独り言への誤応答は味（裁定 9）。
 */
export const TURN_END_PROBABILITY = 0.35;

/**
 * 区切り応答の不応期（v0 定数）。直近発火からこの時間を過ぎていないと区切り応答は出さない
 * （立て続けの相槌でうるさくならないように）。call/turn-end/silence・魂発話すべてが基点を更新する。
 */
export const TURN_END_REFRACTORY_MS = 8000;

/**
 * 区切り応答の arm タイムアウト（v0 定数・追撃修正・実配信で観測されたバグの是正・L0 裁定で 5000ms へ
 * 引き上げ）。
 *
 * **バグ**: 旧実装は speechEnd 後 turnEndSilenceMs の無音 + 不応期 + 確率判定を通過したら**即** emitFire
 * していた。しかし whisper の文字起こしは転写バッファ（正本）へ 1.5〜2s 遅れて届く（実測・
 * experiments/s2-ears.md）ため、発火時の注入に「引き金になった発話そのもの」がまだ載っておらず、
 * 直近の一言を知らんまま返事する事故が実配信で確認された（例: 発火 12:27:57 → 当該発話の正本着地
 * 12:28:00）。
 *
 * **修正**: VAD 判定（不応期・確率・enabled）を通過しても即発火せず armed（構え）状態に入り、その発話の
 * 転写（speaker "you"）が handleTranscript に届いた瞬間に発火する。この定数は armed から転写到着までの
 * 最大待ち時間——超えたら**静かに取り下げる**（発火しない）。
 *
 * **5000ms への引き上げ根拠（L0 裁定）**: 動機になった実配信の実例（上記 12:27:57 → 12:28:00）は発火から
 * 当該転写の正本着地まで**約 3 秒**かかっており、旧値 2000ms ではその実例自体を取りこぼす（直そうとした
 * バグの当の観測例が救えないのでは修正の体を成さない）。加えて、長い発話ほど whisper の処理時間も伸びる
 * 傾向があるため、一番助けたいケース（長めの発話の後の区切り応答）ほど短いタイムアウトに殺されるという
 * 逆向きの力学がある。この窓は「armed 状態で転写到着を待つ上限」であり、**通常の応答遅延には一切
 * 影響しない**——発火そのものは常に転写到着の瞬間に起きるため、窓を広げても「待たされる」時間が増える
 * わけではない。窓を広げる代償は「whisper が遅い時に区切り応答も遅れて出る（最悪 armed のまま 5 秒）」
 * だけであり、これは「言われたことを踏まえた正しい返事が遅れて来る」ことを意味する = ユーザー裁定
 * （待って正しい返事 > 即座のトンチンカン）にそのまま整合する。トンチンカンな即答より無反応の方がまし、
 * が安全側の判断（引き上げ後も維持）。人間ゲートの体感で直す前提。
 */
export const TURN_END_ARM_TIMEOUT_MS = 5000;

/**
 * 沈黙発火の基礎無音長（v0 定数）。最後の活動からこの時間 + ジッター経過で沈黙発火の候補にする。
 * 45s = 会話が途切れて「間」が持たなくなる手前の目安（人間ゲート ④「頻度がうるさくない」で直す）。
 */
export const SILENCE_BASE_MS = 45_000;

/**
 * 沈黙発火のジッター幅（v0 定数）。base に [0, この値) の乱数（注入 RNG）を足して発火間隔を揺らす
 * （規則的な自発発火の不自然さを避ける・裁定 4）。実効の沈黙待ちは 45〜75s。
 */
export const SILENCE_JITTER_MS = 30_000;

/**
 * 沈黙発火の長い不応期（v0 定数）。直近発火からこの時間を過ぎていないと沈黙発火は出さない
 * （沈黙発火が連発しない・視覚発火は S5 usage 計器で代金も見えるため保守的に長く取る）。
 */
export const SILENCE_REFRACTORY_MS = 90_000;

/**
 * 沈黙発火のセッション予算（v0 定数）。1 セッション（スケジューラの生存中）に沈黙発火を出す回数の上限。
 * 予算切れで沈黙タイマは回さない（イベントループに残さない）。うるさくならないための最終弁。
 */
export const SILENCE_BUDGET_V0 = 6;

/**
 * コメント応答の不応期（v0 定数・S7）。直近発火からこの時間を過ぎていないと確率コメント応答（comment）は
 * 出さない（コメント洪水でも立て続けに撃たない希釈）。**comment-call（呼びかけ）には掛けない**（裁定 5）。
 * 区切り応答 TURN_END_REFRACTORY_MS の写経（同尺）。人間ゲートで直す。
 */
export const COMMENT_REFRACTORY_MS = 8000;

/**
 * コメント応答の発火確率（v0 定数・S7）。不応期・予算を満たしても、この確率に当たったときだけ発火要求を
 * 出す（注入 RNG）。「全コメントには返さない」を機械的に実現する希釈弁（区切り応答 TURN_END_PROBABILITY
 * の写経）。**comment-call には掛けない**（命中即発火・裁定 5）。
 */
export const COMMENT_PROBABILITY = 0.35;

/**
 * コメント応答のセッション予算（v0 定数・S7）。1 セッション（スケジューラ生存中）に確率コメント応答
 * （comment）を出す回数の上限。予算切れで comment は出さない（費用・頻度の最終弁・沈黙予算の写経）。
 * **comment-call（呼びかけ）は予算を消費しない**（呼ばれたら確実に返す・裁定 5）。配信 1 本ぶんの
 * コメント量を見越して沈黙予算（6）より大きく取る（活発なチャットで即枯れない）。人間ゲートで直す。
 */
export const COMMENT_BUDGET_V0 = 30;

/**
 * コメント内呼びかけ照合の**テキスト用**揺れ集合 v0（データ定数・S7・inventory §1 裁定 5）。
 * 音声用 NAME_VARIANTS_V0（コーディ系・ASR 揺れ対応）に加え、視聴者のテキスト表記揺れを別集合で持つ。
 *
 * **英字の畳み方**（normalizeForMatch は NFKC + かな→カナ + 濁点剥がしのみで、英字の**大小は畳まない**・
 * 音声照合を変えないため normalizeForMatch は不変）。NFKC は全半角のみ吸収（`Ｃｏｄｙ`→`Cody`）するので、
 * 大小の揺れは**集合側に小文字化等を織り込む**（`Cody`/`cody`/`CODY`）。日本語表記は音声集合と同形
 * （`コーディ`/`コーディー`/`コーティ`/`コーティー`）+ ひらがな `こーでぃー`（正規化でカナに畳まれる）。
 * `コーピー`（「コピー」誤爆）は音声同様に見送り。混在ケース（`CoDy` 等）は followup で拡張（データ定数）。
 */
export const NAME_VARIANTS_TEXT_V0 = Object.freeze([
  "Cody",
  "cody",
  "CODY",
  "コーディ",
  "コーディー",
  "コーティ",
  "コーティー",
  "こーでぃー"
]);

/**
 * 呼びかけ照合の揺れ集合 v0（データ定数・inventory §4-2 の実測 7 種のうち採用分）。
 * 名前 =「こーでぃー」（Claude Code → Cody）。`コーディ(ー)/コーティ(ー)` を軸に正規化照合する
 * （末尾長音の有無・ディ/ティの清濁は normalizeForMatch が吸収するため、正規化後は同一の needle に畳まれる）。
 *
 * **採否**（precision 重視。call は不応期・確率の希釈が無く命中即発火なので誤爆コストが高い）:
 *  - 採用: `コーディ` / `コーディー` / `コーティ` / `コーティー`（ディ/ティ軸 + 末尾長音）。
 *  - 見送り `コーピー`: 「コピー」との誤爆リスク（inventory §4-2 明記・wave 計画 §2）。
 *  - 見送り `コーキー`: まれな子音誤認（キ）。ディ/ティ軸から外れ、precision を優先して不採用。
 *  - 見送り `こうて` / `こうで`: 名前単独発話の崩壊形だが、「こうです」「買うて」等の本文部分文字列と衝突する
 *    誤爆リスクが高い（照合は部分文字列 = 呼びかけ直後の読点が消えて本文と連結する実測に対応するため）。
 *
 * **実人声・マイク経由の揺れは未採取**（実マイク規律）→ 人間ゲートで補完。データ定数ゆえ後から拡張可能。
 */
export const NAME_VARIANTS_V0 = Object.freeze(["コーディ", "コーディー", "コーティ", "コーティー"]);

/**
 * 照合用の正規化純関数（決定論・呼びかけ照合の心臓）。転写文字列と揺れ集合を同じ規則で正規化し、
 * 正規化後の needle が正規化後テキストの**部分文字列**であれば命中とする（呼びかけ直後の読点が消えて
 * 本文と連結する実測「コーディこれどう思う?」に対応するため部分一致）。
 *
 * 規則（この順で適用）:
 *  1. NFKC: 全角/半角・互換文字を統一。
 *  2. ひらがな → カタカナ（かな種別の揺れを吸収）。
 *  3. 濁点・半濁点を剥がす（ディ↔ティ の清濁を吸収）: NFD 分解 → 結合マーク（U+3099/U+309A）除去 → NFC 再結合。
 *  末尾長音（ー）は剥がさない——揺れ集合に `コーディ`（長音なし）と `コーディー`（長音あり）の両方を持ち、
 *  短い needle が長い方の部分文字列になるため、部分一致で末尾長音の有無を自然に吸収できる。
 *
 * @param {string} text
 * @returns {string}
 * @throws {TypeError} text が文字列でない。
 */
export function normalizeForMatch(text) {
  if (typeof text !== "string") {
    throw new TypeError(`normalizeForMatch: text must be a string; got ${typeof text}.`);
  }
  // 1. NFKC。
  let t = text.normalize("NFKC");
  // 2. ひらがな → カタカナ（U+3041..U+3096 を +0x60）。
  t = t.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  // 3. 濁点・半濁点を剥がす（清濁の吸収）: NFD 分解 → 結合マーク（U+3099/U+309A）除去 → NFC 再結合。
  t = t.normalize("NFD").replace(/[゙゚]/g, "").normalize("NFC");
  return t;
}

/**
 * 揺れ集合を正規化 needle 配列へ畳む（重複除去）。
 * @param {ReadonlyArray<string>} variants
 * @returns {string[]}
 */
function buildNeedles(variants) {
  const set = new Set();
  for (const v of variants) {
    if (typeof v !== "string") continue;
    const n = normalizeForMatch(v);
    if (n.length > 0) set.add(n);
  }
  return [...set];
}

/**
 * テキストが名前（needle 集合のいずれか）を部分文字列として含むか（正規化後に判定）。
 * @param {string} text
 * @param {ReadonlyArray<string>} needles  正規化済み needle。
 * @returns {boolean}
 */
export function textMatchesName(text, needles) {
  if (typeof text !== "string" || text.length === 0) return false;
  const norm = normalizeForMatch(text);
  for (const n of needles) {
    if (n.length > 0 && norm.includes(n)) return true;
  }
  return false;
}

/** 有限数なら第 1 引数、でなければ既定。 */
function numberOr(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** 非負整数なら第 1 引数、でなければ既定。 */
function intOr(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** [0,1] にクランプ（注入 RNG の異常値を防御）。 */
function clamp01(x) {
  if (typeof x !== "number" || !Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * @typedef {{ kind: "call" | "turn-end" | "silence" | "comment" | "comment-call" }} FireRequest
 */

/**
 * ── 口数モード（v0・wave 計画「口数配線+コーディ語彙登録」§2 裁定 A・inventory §A-2 の表）─────────
 *  運転バーの口数プルダウン（控えめ/ふつう/おしゃべり）が実行時に差し替える定数束。触るのは
 *  turn-end 確率/不応期・silence 基礎/ジッター/不応期/予算・comment 確率/不応期/予算の **9 値だけ**。
 *  **turn 検出（TURN_END_SILENCE_MS）・name variants（呼びかけ/comment-call の揺れ集合）・
 *  barge-in は不変**（この束が触らない = 口数の影響を受けない構造）。
 *
 *  normal 束は既存 export const（TURN_END_PROBABILITY 等）を**参照**する（リテラルを重複させない）。
 *  これにより normal は「現行値の単一の源」であり続け、mode 未指定時の既定挙動（S6/S7 無退行）が
 *  値の二重管理によるズレを起こしえない。quiet/chatty は新規リテラル（人間ゲート未実施・untested
 *  扱い・inventory §A-2 の非発火率の裏取り参照。人間ゲートの体感で直す前提）。
 */
export const VERBOSITY_BUNDLES = Object.freeze({
  /** 控えめ（quiet）。 */
  quiet: Object.freeze({
    turnEndProbability: 0.15,
    turnEndRefractoryMs: 15_000,
    silenceBaseMs: 90_000,
    silenceJitterMs: 30_000,
    silenceRefractoryMs: 120_000,
    silenceBudget: 3,
    commentProbability: 0.15,
    commentRefractoryMs: 15_000,
    commentBudget: 15
  }),
  /** ふつう（normal・現行値）。既存 export 定数への参照 = 値の単一の源。 */
  normal: Object.freeze({
    turnEndProbability: TURN_END_PROBABILITY,
    turnEndRefractoryMs: TURN_END_REFRACTORY_MS,
    silenceBaseMs: SILENCE_BASE_MS,
    silenceJitterMs: SILENCE_JITTER_MS,
    silenceRefractoryMs: SILENCE_REFRACTORY_MS,
    silenceBudget: SILENCE_BUDGET_V0,
    commentProbability: COMMENT_PROBABILITY,
    commentRefractoryMs: COMMENT_REFRACTORY_MS,
    commentBudget: COMMENT_BUDGET_V0
  }),
  /** おしゃべり（chatty）。 */
  chatty: Object.freeze({
    turnEndProbability: 0.70,
    turnEndRefractoryMs: 4_000,
    silenceBaseMs: 25_000,
    silenceJitterMs: 20_000,
    silenceRefractoryMs: 60_000,
    silenceBudget: 12,
    commentProbability: 0.70,
    commentRefractoryMs: 4_000,
    commentBudget: 60
  })
});

/**
 * 口数モード文字列が既知3モード（quiet/normal/chatty）のいずれかか。未知値は setVerbosity の
 * no-op 判定・初期 mode 解決の「既定 normal へのフォールバック」判定に使う（防御的）。
 * @param {unknown} mode
 * @returns {mode is "quiet" | "normal" | "chatty"}
 */
function isValidVerbosityMode(mode) {
  return mode === "quiet" || mode === "normal" || mode === "chatty";
}

/**
 * 発火スケジューラを作る。VAD イベントと転写 append を食わせると、自発 3 種の判定に応じて onFireRequest で
 * 発火要求を通知する。時刻・タイマ・RNG は全て注入可能（決定論テスト）。**LLM には一切触れない。**
 *
 * @param {object} options
 * @param {(request: FireRequest) => void} options.onFireRequest  発火要求の通知（結線層が対応する fire を呼ぶ）。
 * @param {() => boolean} [options.isBusy]  orchestrator が busy（thinking/speaking）か。既定 () => false。
 * @param {boolean} [options.enabled=false]  自発発火の初期 ON/OFF。既定 OFF（Domain D が永続トグルで制御）。
 * @param {() => number} [options.nowImpl=Date.now]  現在時刻（不応期・活動時刻の基点。注入可）。
 * @param {() => number} [options.rng=Math.random]  乱数 [0,1)（区切り確率・沈黙ジッター。注入可）。
 * @param {typeof setTimeout} [options.setTimeoutImpl=setTimeout]  タイマ注入（無音待ち・沈黙待ち）。
 * @param {typeof clearTimeout} [options.clearTimeoutImpl=clearTimeout]  タイマ解除注入。
 * @param {number} [options.turnEndSilenceMs=TURN_END_SILENCE_MS]
 * @param {number} [options.turnEndProbability=TURN_END_PROBABILITY]
 * @param {number} [options.turnEndRefractoryMs=TURN_END_REFRACTORY_MS]
 * @param {number} [options.turnEndArmTimeoutMs=TURN_END_ARM_TIMEOUT_MS]  armed（構え）から転写到着までの
 *   最大待ち時間。turn 検出・name variants 同様に口数モード不変（追撃修正・定数コメント参照）。
 * @param {number} [options.silenceBaseMs=SILENCE_BASE_MS]
 * @param {number} [options.silenceJitterMs=SILENCE_JITTER_MS]
 * @param {number} [options.silenceRefractoryMs=SILENCE_REFRACTORY_MS]
 * @param {number} [options.silenceBudget]  既定は初期 mode（options.verbosity）の束の値。
 * @param {ReadonlyArray<string>} [options.nameVariants=NAME_VARIANTS_V0]  音声呼びかけ照合の揺れ集合。
 * @param {number} [options.commentRefractoryMs]  S7 コメント応答の不応期。既定は初期 mode の束の値。
 * @param {number} [options.commentProbability]   S7 コメント応答の確率。既定は初期 mode の束の値。
 * @param {number} [options.commentBudget]        S7 コメント応答のセッション予算。既定は初期 mode の束の値。
 * @param {ReadonlyArray<string>} [options.commentNameVariants=NAME_VARIANTS_TEXT_V0]  S7 コメント内呼びかけの
 *   テキスト用揺れ集合。
 * @param {"quiet" | "normal" | "chatty"} [options.verbosity="normal"]  口数モードの初期値
 *   （運転バーのプルダウン・wave 計画「口数配線」§2 裁定 A）。未知値は "normal" にフォールバック
 *   （防御的）。turnEndProbability/turnEndRefractoryMs/silenceBaseMs/silenceJitterMs/
 *   silenceRefractoryMs/silenceBudget/commentRefractoryMs/commentProbability/commentBudget の
 *   既定値を VERBOSITY_BUNDLES[mode] から解決する（上記オプションを明示指定すればそちらが優先
 *   される = 既存テストの明示 options は従来どおり効く・無退行の鍵）。
 * @returns {{
 *   handleVadEvent: (event: { type: string }) => void;
 *   handleTranscript: (entry: { text?: string; speaker?: string }) => void;
 *   handleChatMessage: (msg: { text?: string; displayName?: string }) => void;
 *   setEnabled: (enabled: boolean) => void;
 *   isEnabled: () => boolean;
 *   setVerbosity: (mode: string) => void;
 *   getVerbosity: () => "quiet" | "normal" | "chatty";
 *   silenceBudgetRemaining: () => number;
 *   commentBudgetRemaining: () => number;
 *   dispose: () => void;
 * }}
 */
export function createFireScheduler(options) {
  if (options == null || typeof options !== "object") {
    throw new TypeError("createFireScheduler: options is required.");
  }
  const onFireRequest = options.onFireRequest;
  if (typeof onFireRequest !== "function") {
    throw new TypeError("createFireScheduler: options.onFireRequest must be a function.");
  }
  const isBusy = typeof options.isBusy === "function" ? options.isBusy : () => false;
  const nowImpl = options.nowImpl ?? Date.now;
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;

  // turn 検出（TURN_END_SILENCE_MS）は口数モード不変（wave 計画「口数配線」§2 裁定 A）。
  const turnEndSilenceMs = numberOr(options.turnEndSilenceMs, TURN_END_SILENCE_MS);
  // armed→転写到着の最大待ち（TURN_END_ARM_TIMEOUT_MS）も turn 検出同様に口数モード不変（追撃修正）。
  const turnEndArmTimeoutMs = numberOr(options.turnEndArmTimeoutMs, TURN_END_ARM_TIMEOUT_MS);

  // 口数モード（wave 計画「口数配線」§2 裁定 A・inventory §A-2）: 初期 mode を options.verbosity から
  // 解決する（既定 "normal"・未知値も "normal" にフォールバック = 防御的）。9 個の tunable let の初期値は
  // `numberOr(options.x, BUNDLE[initialMode].x)` の形にする — normal 束は既存 export const への参照
  // ゆえ、mode 未指定時のフォールバックは現行値と完全同値。かつ options.x を明示指定すればそちらが
  // 優先される（numberOr/intOr は明示値を最優先）ため、既存テストが渡す明示 options は従来どおり効く
  // （無退行の鍵）。
  const initialMode = isValidVerbosityMode(options.verbosity) ? options.verbosity : "normal";
  const initialBundle = VERBOSITY_BUNDLES[initialMode];
  /** 現在の口数モード（getVerbosity が返す・setVerbosity が更新）。 */
  let currentVerbosity = initialMode;

  let turnEndProbability = numberOr(options.turnEndProbability, initialBundle.turnEndProbability);
  let turnEndRefractoryMs = numberOr(options.turnEndRefractoryMs, initialBundle.turnEndRefractoryMs);
  let silenceBaseMs = numberOr(options.silenceBaseMs, initialBundle.silenceBaseMs);
  let silenceJitterMs = numberOr(options.silenceJitterMs, initialBundle.silenceJitterMs);
  let silenceRefractoryMs = numberOr(options.silenceRefractoryMs, initialBundle.silenceRefractoryMs);
  const needles = buildNeedles(Array.isArray(options.nameVariants) ? options.nameVariants : NAME_VARIANTS_V0);
  let commentRefractoryMs = numberOr(options.commentRefractoryMs, initialBundle.commentRefractoryMs);
  let commentProbability = numberOr(options.commentProbability, initialBundle.commentProbability);
  const commentNeedles = buildNeedles(
    Array.isArray(options.commentNameVariants) ? options.commentNameVariants : NAME_VARIANTS_TEXT_V0
  );

  let enabled = options.enabled === true;
  let disposed = false;
  /** 直近発火の時刻（不応期の基点）。初期は -Infinity = 最初の不応期は必ず通過。 */
  let lastFireAtMs = -Infinity;
  /** 残り沈黙予算（セッション内）。 */
  let silenceBudget = intOr(options.silenceBudget, initialBundle.silenceBudget);
  /** 残りコメント応答予算（セッション内・S7・comment-call は消費しない）。 */
  let commentBudget = intOr(options.commentBudget, initialBundle.commentBudget);

  /** @type {ReturnType<typeof setTimeout> | null} */
  let turnEndTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let silenceTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let turnEndArmTimer = null;
  /** pending turn-end の armed（構え）状態。VAD 終端の判定通過後、転写到着を待つ（追撃修正）。 */
  let turnEndArmed = false;

  const clearTurnEnd = () => {
    if (turnEndTimer != null) {
      clearTimeoutImpl(/** @type {any} */ (turnEndTimer));
      turnEndTimer = null;
    }
  };
  const clearSilence = () => {
    if (silenceTimer != null) {
      clearTimeoutImpl(/** @type {any} */ (silenceTimer));
      silenceTimer = null;
    }
  };
  const clearTurnEndArmTimer = () => {
    if (turnEndArmTimer != null) {
      clearTimeoutImpl(/** @type {any} */ (turnEndArmTimer));
      turnEndArmTimer = null;
    }
  };
  /** armed（構え）へ入る（onTurnEndTimer からのみ呼ばれる）。転写到着 / タイムアウトで解除されるまで
   *  turnEndArmed = true が続く。 */
  const armTurnEnd = () => {
    turnEndArmed = true;
    clearTurnEndArmTimer();
    turnEndArmTimer = setTimeoutImpl(onTurnEndArmTimeout, turnEndArmTimeoutMs);
  };
  /** pending turn-end を解除する（発火せず・タイマも畳む）。転写到着 / タイムアウト / OFF / 口数切替 /
   *  soul 発話 / dispose のいずれからも呼ばれる（多重呼び出しは自己ガードで安全）。 */
  const disarmTurnEnd = () => {
    turnEndArmed = false;
    clearTurnEndArmTimer();
  };
  /** armed のタイムアウト（転写が届かなかった） = 静かに解除する（発火しない）。 */
  const onTurnEndArmTimeout = () => {
    turnEndArmTimer = null;
    turnEndArmed = false;
  };

  /** 発火要求を出す（onFireRequest の throw は握って常駐を殺さない）。 */
  const emitFire = (/** @type {"call" | "turn-end" | "silence" | "comment" | "comment-call"} */ kind) => {
    try {
      onFireRequest({ kind });
    } catch {
      // best-effort（通知先の失敗で判定経路を壊さない）。
    }
  };

  /** 沈黙タイマの(再)武装。最後の活動から silenceBase + jitter で発火。 */
  const armSilence = () => {
    clearSilence();
    if (disposed || !enabled) return;
    if (silenceBudget <= 0) return; // 予算切れ = これ以上沈黙発火はしない（タイマを回さない）。
    const jitter = Math.floor(clamp01(rng()) * silenceJitterMs);
    silenceTimer = setTimeoutImpl(onSilenceTimer, silenceBaseMs + jitter);
  };

  function onSilenceTimer() {
    silenceTimer = null;
    if (disposed || !enabled || silenceBudget <= 0) return;
    const now = nowImpl();
    // busy 中・長不応期内 → 出さずに再武装（後で条件を満たしうる）。
    if (isBusy() || now - lastFireAtMs < silenceRefractoryMs) {
      armSilence();
      return;
    }
    silenceBudget -= 1;
    lastFireAtMs = now;
    emitFire("silence");
    armSilence(); // 予算が残っていれば次周期を張る（切れていれば armSilence が張らない）。
  }

  function onTurnEndTimer() {
    turnEndTimer = null;
    if (disposed || !enabled) return;
    const now = nowImpl();
    if (isBusy()) return; // busy 中は要求を出さない。
    if (now - lastFireAtMs < turnEndRefractoryMs) return; // 不応期内。
    if (clamp01(rng()) >= turnEndProbability) return; // 確率外れ。
    // 判定通過 → 即 emitFire せず armed（構え）へ。その発話の転写（handleTranscript の you）到着で
    // 発火する（lastFireAtMs は emitFire 実行時に更新する = まだ発火していないので基点は動かさない）。
    armTurnEnd();
  }

  /**
   * VAD イベント（speechStart/speechEnd/speechCancel）を 1 個食わせる。
   * @param {{ type: string }} event
   */
  const handleVadEvent = (event) => {
    if (disposed || event == null || typeof event.type !== "string") return;
    if (event.type === "speechStart") {
      // 新しい発話オンセット = まだ喋っている → 区切り応答タイマを取り消す。活動 → 沈黙タイマ再武装。
      // armed 中（前の発話の転写待ち）はここでは触らない = 据え置き（まだ届いていない転写を待ち続ける）。
      clearTurnEnd();
      armSilence();
    } else if (event.type === "speechEnd") {
      // 一区切り → 活動として沈黙タイマ再武装 + 区切り応答タイマを張る（無音待ち）。
      armSilence();
      clearTurnEnd();
      // armed 中に新たな speechEnd が来た場合は据え置く（裁量・二重 arm や確率の二重消費を避ける）:
      // 既に armed（前の発話の転写待ち）なら新しい VAD タイマーは起動しない。armed 解除（転写到着 /
      // タイムアウト）後の次の speechEnd から新たに測り直す。
      if (enabled && !turnEndArmed) {
        turnEndTimer = setTimeoutImpl(onTurnEndTimer, turnEndSilenceMs);
      }
    }
    // speechCancel はスパイク棄却の retraction（barge-in gate の領分）。スケジューラは触らない
    // （speechStart で張り替えた区切りタイマは既に取り消し済み。1 スパイクで区切り応答を落とすのは免罪符・裁定 2）。
  };

  /**
   * 転写 append（you = 呼びかけ照合 + pending turn-end ゲート発火 + 活動 / soul = 発火実績 = 不応期リセット +
   * 活動）を 1 個食わせる。**話者無差別に届く**（transcript-buffer は you も soul も同じ列）ので speaker で
   * 分岐する。
   *
   * **pending turn-end のゲート発火（追撃修正）**: armed（構え）中に you の転写が届いたら、まず呼びかけ
   * （call）照合を行い、命中すれば call が勝つ（emitFire("call") のみ・pending turn-end は破棄 = 二重発火
   * させない）。call に負けなければ、この転写到着そのものが turn-end の発火トリガーになる（引き金になった
   * 発話が転写バッファに載った状態で発火する）。
   * @param {{ text?: string; speaker?: string }} entry
   */
  const handleTranscript = (entry) => {
    if (disposed || entry == null || typeof entry !== "object") return;
    const now = nowImpl();
    if (entry.speaker === "soul") {
      // 魂が実際に喋った（手動 Fire を含む任意の発火の結果）= 不応期の基点 + 活動。
      // pending turn-end はもう古い（別の発火が既に起きた後に発火するのはおかしい）ので解除する。
      lastFireAtMs = now;
      armSilence();
      disarmTurnEnd();
      return;
    }
    if (entry.speaker === "viewer") {
      // ★ S7 二重発火の断ち: viewer コメントは同じ転写バッファへ append されるため handleTranscript も
      // 通るが、発火・活動反映は handleChatMessage が担う。ここで you 経路（call 照合/armSilence）を
      // 誤起動させないよう完全な no-op で抜ける（cockpit-server の接ぎ目リスクの根を断つ）。
      return;
    }
    // you（既定）: 活動 → 沈黙タイマ再武装。
    armSilence();
    // 呼びかけ照合（命中即発火・不応期/確率は掛けない = 裁定 4）。OFF/busy 中は出さない。
    let calledOut = false;
    if (enabled && !isBusy() && typeof entry.text === "string" && entry.text.length > 0) {
      if (textMatchesName(entry.text, needles)) {
        lastFireAtMs = now;
        emitFire("call");
        calledOut = true;
      }
    }
    // pending turn-end（armed 中）のゲート発火。同じ転写が call に命中していたら call が勝ち、ここでは
    // 発火しない（disarm のみ）。call に負けなければ、この転写到着が発火のトリガー（本追撃修正の核心）。
    // busy 再チェック: armed 成立（VAD タイマー時点）から転写到着までの間に busy になった場合は、
    // call 判定と同様に静かに諦める（fire-orchestrator 側の busy 無視でも二重に保護される）。
    if (turnEndArmed) {
      disarmTurnEnd();
      if (!calledOut && enabled && !isBusy()) {
        lastFireAtMs = now;
        emitFire("turn-end");
      }
    }
  };

  /**
   * S7「視聴者が混ざる」: YouTube Live コメント 1 件を食わせる（handleTranscript 同型）。コメント内呼びかけ
   * 照合（comment-call・確実）→ 確率コメント応答（comment・不応期 + 確率 + 予算）の順で判定する。
   *
   * **活動扱い（裁定）**: コメントは「場が動いた」活動なので沈黙タイマを再武装する（活発なチャットは
   * 「画面を見て一言」を先送りする）が、魂の発話ではないので不応期の基点 lastFireAtMs は**発火要求を
   * 出したときだけ**更新する（コメント到着そのものでは更新しない）。busy/OFF は沈黙。displayName は
   * 照合には使わない（合流描画・下流用に受けるだけ）。
   * @param {{ text?: string; displayName?: string }} msg
   */
  const handleChatMessage = (msg) => {
    if (disposed || msg == null || typeof msg !== "object") return;
    // 活動 → 沈黙タイマ再武装（armSilence は enabled/disposed/予算を自己ガード）。
    armSilence();
    if (!enabled || isBusy()) return;
    if (typeof msg.text !== "string" || msg.text.length === 0) return;
    const now = nowImpl();
    // comment-call: コメント内呼びかけ照合が命中したら確実に発火（不応期/確率/予算は掛けない = 裁定 5）。
    if (textMatchesName(msg.text, commentNeedles)) {
      lastFireAtMs = now;
      emitFire("comment-call");
      return;
    }
    // comment: 予算 → 不応期 → 確率 の順で希釈（区切り応答の写経）。
    if (commentBudget <= 0) return; // 予算切れ = これ以上の確率コメント応答はしない。
    if (now - lastFireAtMs < commentRefractoryMs) return; // 不応期内。
    if (clamp01(rng()) >= commentProbability) return; // 確率外れ。
    commentBudget -= 1;
    lastFireAtMs = now;
    emitFire("comment");
  };

  /**
   * 自発発火の ON/OFF。OFF で 3 種とも黙りタイマも畳む（手動 Fire は非経由 = 影響なし）。ON で沈黙カウント開始。
   * pending turn-end（armed 中）も OFF で解除する（追撃修正・解除が自然 = 再 ON しても復活しない）。
   * @param {boolean} next
   */
  const setEnabled = (next) => {
    const value = next === true;
    if (value === enabled) return;
    enabled = value;
    if (!enabled) {
      clearTurnEnd();
      clearSilence();
      disarmTurnEnd();
    } else {
      armSilence(); // 有効化で沈黙カウント開始（活動が無くてもいずれ「画面を見て一言」に至る）。
    }
  };

  /**
   * 口数モードの切替（wave 計画「口数配線」§2 裁定 A・inventory §A-2）。既知 mode（quiet/normal/
   * chatty）なら 7 個の tunable let（turn-end 確率/不応期・silence 基礎/ジッター/不応期・comment
   * 確率/不応期）を VERBOSITY_BUNDLES[mode] へ再代入し、silenceBudget/commentBudget を新モードの
   * **満額へリセット**する（= モード切替 = そのモードの間で仕切り直す・inventory §A-2 の意味論）。
   * 未知 mode は **no-op**（currentVerbosity も束も変えず return・防御的）。
   *
   * turn 検出（turnEndSilenceMs）・name variants（needles/commentNeedles）は触らない（口数モード不変）。
   *
   * 再代入後 enabled なら armSilence() する（setEnabled の流儀の写経）: 新しい silence 基礎/ジッター/
   * 予算を即座に反映するため（mode 切替はそのモードの間で仕切り直す、という意味論を沈黙タイマにも
   * 適用する）。turn-end/comment はイベント駆動（次の speechEnd / 次のコメント到着）で自然に新値を
   * 拾う（armSilence 相当の「即時再武装するタイマ」を turn-end/comment は持たない）。
   *
   * pending turn-end（armed 中）も切替で解除する（追撃修正・setEnabled(false) の写経・解除が自然 =
   * 「そのモードの間で仕切り直す」に pending も含める）。
   * @param {string} mode
   */
  const setVerbosity = (mode) => {
    if (!isValidVerbosityMode(mode)) return; // 未知 mode は防御的 no-op。
    const bundle = VERBOSITY_BUNDLES[mode];
    turnEndProbability = bundle.turnEndProbability;
    turnEndRefractoryMs = bundle.turnEndRefractoryMs;
    silenceBaseMs = bundle.silenceBaseMs;
    silenceJitterMs = bundle.silenceJitterMs;
    silenceRefractoryMs = bundle.silenceRefractoryMs;
    commentRefractoryMs = bundle.commentRefractoryMs;
    commentProbability = bundle.commentProbability;
    silenceBudget = bundle.silenceBudget; // 残予算を新モードの満額へリセット。
    commentBudget = bundle.commentBudget;
    currentVerbosity = mode;
    disarmTurnEnd(); // pending turn-end も仕切り直し（解除）。
    if (enabled) armSilence(); // 新しい silence 基礎/ジッター/予算を即座に反映。
  };

  // 有効化状態で構築されたら沈黙カウントを開始する（活動が無くてもいずれ「画面を見て一言」に至る）。
  if (enabled) armSilence();

  return {
    handleVadEvent,
    handleTranscript,
    handleChatMessage,
    setEnabled,
    isEnabled: () => enabled,
    setVerbosity,
    /** 現在の口数モード（quiet/normal/chatty・既定 "normal"）。 */
    getVerbosity: () => currentVerbosity,
    /** 残り沈黙予算（診断・テスト用）。 */
    silenceBudgetRemaining: () => silenceBudget,
    /** 残りコメント応答予算（診断・テスト用・S7）。 */
    commentBudgetRemaining: () => commentBudget,
    /** 畳む（タイマを解除しイベントループに残さない・以後のイベントは無視）。 */
    dispose: () => {
      disposed = true;
      clearTurnEnd();
      clearSilence();
      disarmTurnEnd();
    }
  };
}
