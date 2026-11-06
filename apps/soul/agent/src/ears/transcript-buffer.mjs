// @ts-check
/**
 * 転写バッファ（S2 Domain B の心臓・会話の記憶の正本）— apps/soul/agent。
 *
 * 発話単位の転写 `{startMs, endMs, text}` が append-only で積もる列。上位文書の位置づけ:
 *  - wave 計画 §2: 「転写バッファは S3（発火判定）が消費する継ぎ目」。
 *  - アーキ方向 §2.7: 「転写バッファが正、SDK セッションは使い捨てキャッシュ」。
 * つまりこの列が**会話の記憶の正本**であり、外部から書き換え・削除できてはならない。
 *
 * ── append-only 保証 ─────────────────────────────────────────────────
 *  - 公開 API に削除・上書き・clear は無い（append と読み取り・購読のみ）。
 *  - 各エントリは Object.freeze 済み。読み取り API は配列の防御的コピーを返す
 *    （エントリ自体は frozen なので共有してよい）。
 *  - エントリには単調増加の `seq`（append 順）と `appendedAtMs`（壁時計・注入可）が付く。
 *    startMs は VAD 由来のストリーム時刻、appendedAtMs は実時間——S3 が「最近の発話」を
 *    どちらの軸でも判断できるように両方持つ。
 *
 * ── 空転写（無音幻聴）の扱い【設計判断】───────────────────────────────
 *  空文字・空白のみの転写は**バッファに積まない（捨てる）**。理由: バッファは S3 の発火判定
 *  と将来の会話記憶の正本であり、無内容エントリはノイズにしかならない。ただし「捨てたこと」
 *  自体は診断上意味がある（無音幻聴の頻度 = VAD 閾値調整の材料）ので、onDiscard 購読と
 *  stats().discarded で観測可能にする。判断は isBlankTranscript 純関数に閉じる。
 *
 * ── 咳払いの落とし（段階 2・cough-filter-stage2-plan.md §2 の 3〜5）【設計判断】────────────────
 *  耳（ear-pipeline.mjs の transcribeAndAppend）が「咳や咳払いが短い言葉に化けた」と判じた区間は、積まずに
 *  `discard({ startMs, endMs, text, reason: "cough", speech })` で捨てる。空転写と同じ口（discarded の数・onDiscard）に
 *  乗せ、info に reason "cough" と Speech の確率（speech）を載せる。空転写の info の形（`{startMs,endMs,text,reason:"blank"}`）は
 *  変えない。discard は人の名前・id を受け取らない（Discord の人ごとの口は append だけを包むので、誰の咳かは載らない）。
 *
 * ── S3 が消費する形 ───────────────────────────────────────────────
 *  - `all()` 全件 / `last(n)` 直近 n 件 / `inRange({fromMs,toMs})` ストリーム時刻範囲（重なり判定）
 *  - `onAppend(listener)` 追加購読（S3 の発火判定はこれを入口にできる）
 *  依存ゼロ・I/O ゼロの純ロジック（fixture テスト対象）。
 *
 * ── 話者ラベル（S3 で会話ログへ昇格・S7 で視聴者が混ざる・追加的）【設計判断】──────────────
 *  append の入力に任意の `speaker`（"you" | "soul" | "viewer"・**既定 "you"**）を足し、各エントリが
 *  speaker を持つ。既定 "you" ゆえ S2 の呼び出し（speaker を渡さない耳の結線）は挙動不変——転写バッファは
 *  単一話者の転写列のまま振る舞い、S3 が魂の発話（speaker:"soul"）を同じ列へ追記できるように
 *  なるだけ。不正な speaker 値は throw（呼び出し側のバグを黙殺しない）。
 *
 *  **S7「視聴者が混ざる」**: YouTube Live のコメントを `speaker:"viewer"` として同じ列へ合流する
 *  （単一タイムライン・inventory §1 裁定 3「箱を分けない」）。viewer エントリは投稿者名を持つため、
 *  append の入力に任意の `displayName`（string）を足す。
 *  viewer コメントも soul と同型で startMs/endMs=0（録音ストリーム区間を持たない）・窓は appendedAtMs。
 *
 *  **Discord モード Domain A（discord-mode.md §3.2 案 A）**: 種類（speaker）は you / soul / viewer のまま意味を広げる
 *  （you = 声で話す人・soul = ロール自身・viewer = 文字のコメント）。名前（displayName）は you と soul にも許す
 *  （Discord の人の名前・ロールの名前）。配信では you に名前を入れないので、you の行の形は従来どおり。
 *  加えて任意の `speakerId`（string）を持つ（Discord の人はユーザー id・soul はロールの id・YouTube の視聴者は今は
 *  入れない）。**id は場の中の記録にだけ持ち、①②④・判定・ログ・放送には出さない**（整形と放送はこの欄を読まない）。
 *  省略時はどちらも undefined。
 *
 *  **Discord モード Domain J（discord-mode.md §13.5）**: 話者の 3 種類とは別の行の種類「出来事」（`speaker:"event"`・EVENT_SPEAKER）を
 *  足す。人が通話の中で気づく出来事（チャッピーが VC に入った・抜けた・移った・切られた、今いる VC の人が入ってきた・出ていった）を
 *  短い日本語の 1 文（text）で持つ。soul / viewer と同じく startMs/endMs=0・窓は appendedAtMs。名前は本文の中にだけあり、displayName・
 *  speakerId は持たない。頭への会話の窓・②④の材料には載るが、判定の入力には入れず、判定・発火の予定のきっかけにもしない（場の購読が
 *  出来事の行を発火の予定と speak-now へ回さない・判定の入力の組み立ては出来事の行を飛ばす）。配信では出来事の行を積まない。
 *
 *  正本の持ち主は場（cockpit-server の「配信を始める」が作る）。耳は外から渡された正本に積む（ear-pipeline.mjs の
 *  `transcriptBuffer`）。渡されなければ耳が自分で作る（従来どおり）。
 *  下流の注入整形（fire-injection.mjs）は viewer 行を `viewer(名前): 本文` として描く。合流は Domain A の
 *  チャット器官の**外から** hooks 経由（cockpit-server の取り込み経路）——器官からの逆流路は無い。
 *
 *  soul エントリは VAD ストリーム時刻（startMs/endMs）を持たない（魂の発話は録音ストリーム上の
 *  区間ではなく、Fire に応じて生成したテキストだから）。よって発火オーケストレータは
 *  soul 追記時に `startMs:0, endMs:0` を渡す。窓の時間軸としては startMs ではなく壁時計
 *  `appendedAtMs`（append 時刻・注入可）を使う——you と soul を同一の実時間軸で並べられる。
 *  下流の注入整形（fire-injection.mjs）は appendedAtMs で窓を切る。
 *
 * ── listener 例外契約（S2 Domain C で明文化・domain-b-review note 4 の線引き）────────
 *  **listener は throw しない契約**。listener の throw は同期のまま append の呼び出し元へ
 *  伝播し、後続の listener はスキップされる（バッファ自体は push 済みなので正本は壊れない）。
 *  バッファは診断イベントの発行元を持たないため、この吸収は購読者側/結線層の責務:
 *  耳の結線層（ear-pipeline.mjs）は append を発話単位の try/catch で包み、外部購読者の
 *  契約違反を診断イベント（listenerError 相当）に落として常駐を続ける。
 */

/**
 * 空転写（無音幻聴）判定の純関数。
 * @param {string} text
 * @returns {boolean}
 */
export function isBlankTranscript(text) {
  if (typeof text !== "string") {
    throw new TypeError(`isBlankTranscript: text must be a string; got ${typeof text}.`);
  }
  return text.trim().length === 0;
}

/**
 * @typedef {"you" | "soul" | "viewer" | "event"} Speaker
 */

/**
 * @typedef {Readonly<{ seq: number; startMs: number; endMs: number; text: string; speaker: Speaker; displayName: string | undefined; speakerId: string | undefined; appendedAtMs: number }>} TranscriptEntry
 */

/**
 * @typedef {{ startMs: number; endMs: number; text: string; speaker?: Speaker; displayName?: string; speakerId?: string }} TranscriptInput
 */

/** 出来事の行の種類（話者の 3 種類とは別・Discord モード Domain J）。 */
export const EVENT_SPEAKER = "event";

/**
 * 出来事の行か（Discord モード Domain J）。判定の入力の組み立て・発火のきっかけはこれで出来事の行を飛ばす。
 * @param {unknown} entry
 * @returns {boolean}
 */
export function isEventEntry(entry) {
  return entry != null && typeof entry === "object" && /** @type {any} */ (entry).speaker === EVENT_SPEAKER;
}

/** 正本の外から渡せる破棄の理由（空転写の "blank" は append が決める）。 */
const EXTERNAL_DISCARD_REASONS = new Set(["cough"]);

/**
 * @typedef {Readonly<{ startMs: number; endMs: number; text: string; reason: "blank" }> | Readonly<{ startMs: number; endMs: number; text: string; reason: "cough"; speech: number }>} DiscardInfo
 */

/** 許容する話者ラベル（既定 you = S2 挙動不変・soul = S3 の魂発話・viewer = S7 の視聴者コメント・event = 出来事の行〔Domain J〕）。 */
const VALID_SPEAKERS = new Set(["you", "soul", "viewer", EVENT_SPEAKER]);

/**
 * 転写バッファを作る。
 * @param {object} [options]
 * @param {() => number} [options.nowImpl]  appendedAtMs の時計（テスト用注入）。既定 Date.now。
 * @returns {{
 *   append: (input: TranscriptInput) => { appended: boolean; entry: TranscriptEntry | null; reason: "appended" | "blank" };
 *   all: () => TranscriptEntry[];
 *   last: (n: number) => TranscriptEntry[];
 *   inRange: (range: { fromMs?: number; toMs?: number }) => TranscriptEntry[];
 *   size: () => number;
 *   discard: (input: { startMs: number; endMs: number; text: string; reason: "cough"; speech: number }) => { appended: false; entry: null; reason: "cough" };
 *   stats: () => { appended: number; discarded: number };
 *   onAppend: (listener: (entry: TranscriptEntry) => void) => () => void;
 *   onDiscard: (listener: (info: DiscardInfo) => void) => () => void;
 * }}
 */
export function createTranscriptBuffer(options = {}) {
  const nowImpl = options.nowImpl ?? Date.now;

  /** @type {TranscriptEntry[]} */
  const entries = [];
  let discarded = 0;
  /** @type {Set<(entry: TranscriptEntry) => void>} */
  const appendListeners = new Set();
  /** @type {Set<(info: any) => void>} */
  const discardListeners = new Set();

  /**
   * 入力を検証する（不正は throw = 呼び出し側のバグを黙殺しない）。
   * @param {TranscriptInput} input
   */
  function validate(input) {
    if (input == null || typeof input !== "object") {
      throw new TypeError("transcriptBuffer.append: input must be an object { startMs, endMs, text }.");
    }
    const { startMs, endMs, text, speaker, displayName, speakerId } = input;
    if (typeof startMs !== "number" || !Number.isFinite(startMs)) {
      throw new TypeError(`transcriptBuffer.append: startMs must be a finite number; got ${startMs}.`);
    }
    if (typeof endMs !== "number" || !Number.isFinite(endMs)) {
      throw new TypeError(`transcriptBuffer.append: endMs must be a finite number; got ${endMs}.`);
    }
    if (endMs < startMs) {
      throw new RangeError(`transcriptBuffer.append: endMs ${endMs} must be >= startMs ${startMs}.`);
    }
    if (typeof text !== "string") {
      throw new TypeError(`transcriptBuffer.append: text must be a string; got ${typeof text}.`);
    }
    // speaker は任意（既定 "you"）。渡された場合のみ検証する（不正値は throw）。
    if (speaker !== undefined && !VALID_SPEAKERS.has(speaker)) {
      throw new RangeError(
        `transcriptBuffer.append: speaker must be "you", "soul", "viewer" or "event"; got ${JSON.stringify(speaker)}.`
      );
    }
    // displayName は任意（どの話者にも許す・Discord モード Domain A）。渡された場合のみ軽く型検証する。
    if (displayName !== undefined && typeof displayName !== "string") {
      throw new TypeError(
        `transcriptBuffer.append: displayName must be a string when present; got ${typeof displayName}.`
      );
    }
    // speakerId は任意（場の中の記録にだけ持つ id）。渡された場合のみ軽く型検証する。
    if (speakerId !== undefined && typeof speakerId !== "string") {
      throw new TypeError(
        `transcriptBuffer.append: speakerId must be a string when present; got ${typeof speakerId}.`
      );
    }
  }

  return {
    /**
     * 転写を積む。空転写（空白のみ）は積まずに捨て、onDiscard で観測可能にする。
     * @param {TranscriptInput} input
     * @returns {{ appended: boolean; entry: TranscriptEntry | null; reason: "appended" | "blank" }}
     */
    append(input) {
      validate(input);
      const { startMs, endMs, text } = input;
      const speaker = /** @type {Speaker} */ (input.speaker ?? "you");
      // 名前と id は省略時 undefined（配信の you の行は従来と同形）。
      const displayName = input.displayName;
      const speakerId = input.speakerId;
      if (isBlankTranscript(text)) {
        discarded += 1;
        const info = Object.freeze({ startMs, endMs, text, reason: /** @type {const} */ ("blank") });
        for (const listener of discardListeners) {
          listener(info);
        }
        return { appended: false, entry: null, reason: "blank" };
      }
      const entry = Object.freeze({
        seq: entries.length,
        startMs,
        endMs,
        text,
        speaker,
        displayName,
        speakerId,
        appendedAtMs: nowImpl()
      });
      entries.push(entry);
      for (const listener of appendListeners) {
        listener(entry);
      }
      return { appended: true, entry, reason: "appended" };
    },

    /**
     * 正本の外で判じた区間を積まずに捨てる（咳払いの落とし・段階 2）。空転写と同じく discarded を数え、onDiscard に流す。
     * 不正な入力は throw（呼び出し側のバグを黙殺しない）。
     * @param {{ startMs: number; endMs: number; text: string; reason: "cough"; speech: number }} input
     * @returns {{ appended: false; entry: null; reason: "cough" }}
     */
    discard(input) {
      if (input == null || typeof input !== "object") {
        throw new TypeError("transcriptBuffer.discard: input must be an object { startMs, endMs, text, reason, speech }.");
      }
      const { startMs, endMs, text, reason, speech } = input;
      if (typeof startMs !== "number" || !Number.isFinite(startMs)) {
        throw new TypeError(`transcriptBuffer.discard: startMs must be a finite number; got ${startMs}.`);
      }
      if (typeof endMs !== "number" || !Number.isFinite(endMs)) {
        throw new TypeError(`transcriptBuffer.discard: endMs must be a finite number; got ${endMs}.`);
      }
      if (endMs < startMs) {
        throw new RangeError(`transcriptBuffer.discard: endMs ${endMs} must be >= startMs ${startMs}.`);
      }
      if (typeof text !== "string") {
        throw new TypeError(`transcriptBuffer.discard: text must be a string; got ${typeof text}.`);
      }
      if (!EXTERNAL_DISCARD_REASONS.has(reason)) {
        throw new RangeError(`transcriptBuffer.discard: reason must be "cough"; got ${JSON.stringify(reason)}.`);
      }
      if (typeof speech !== "number" || !Number.isFinite(speech)) {
        throw new TypeError(`transcriptBuffer.discard: speech must be a finite number; got ${speech}.`);
      }
      discarded += 1;
      const info = Object.freeze({ startMs, endMs, text, reason: /** @type {const} */ ("cough"), speech });
      for (const listener of discardListeners) {
        listener(info);
      }
      return { appended: false, entry: null, reason: "cough" };
    },

    /** 全件（append 順）。配列は防御的コピー・エントリは frozen。 */
    all() {
      return entries.slice();
    },

    /**
     * 直近 n 件（append 順のまま末尾 n 件）。
     * @param {number} n
     */
    last(n) {
      if (!Number.isInteger(n) || n < 0) {
        throw new RangeError(`transcriptBuffer.last: n must be a non-negative integer; got ${n}.`);
      }
      if (n === 0) {
        return [];
      }
      return entries.slice(-n);
    },

    /**
     * ストリーム時刻範囲 [fromMs, toMs] に**重なる**エントリ（endMs >= fromMs かつ startMs <= toMs）。
     * 省略側は無限（fromMs 既定 -Infinity / toMs 既定 +Infinity）。
     * @param {{ fromMs?: number; toMs?: number }} [range]
     */
    inRange(range = {}) {
      const fromMs = range.fromMs ?? -Infinity;
      const toMs = range.toMs ?? Infinity;
      if (typeof fromMs !== "number" || Number.isNaN(fromMs)) {
        throw new TypeError(`transcriptBuffer.inRange: fromMs must be a number; got ${fromMs}.`);
      }
      if (typeof toMs !== "number" || Number.isNaN(toMs)) {
        throw new TypeError(`transcriptBuffer.inRange: toMs must be a number; got ${toMs}.`);
      }
      if (toMs < fromMs) {
        throw new RangeError(`transcriptBuffer.inRange: toMs ${toMs} must be >= fromMs ${fromMs}.`);
      }
      return entries.filter((e) => e.endMs >= fromMs && e.startMs <= toMs);
    },

    size() {
      return entries.length;
    },

    /** 積んだ件数と捨てた件数（無音幻聴の頻度観測 = VAD 閾値調整の診断材料）。 */
    stats() {
      return { appended: entries.length, discarded };
    },

    /**
     * 追加購読（S3 発火判定の入口）。返り値は購読解除関数。
     * @param {(entry: TranscriptEntry) => void} listener
     */
    onAppend(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("transcriptBuffer.onAppend: listener must be a function.");
      }
      appendListeners.add(listener);
      return () => {
        appendListeners.delete(listener);
      };
    },

    /**
     * 破棄の購読（空転写 "blank" と咳払いの落とし "cough"・診断用）。返り値は購読解除関数。
     * @param {(info: DiscardInfo) => void} listener
     */
    onDiscard(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("transcriptBuffer.onDiscard: listener must be a function.");
      }
      discardListeners.add(listener);
      return () => {
        discardListeners.delete(listener);
      };
    }
  };
}
