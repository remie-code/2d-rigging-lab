// @ts-check
/**
 * barge-in の純部品（S6 Domain B・「会話が続く」の心臓）— apps/soul/agent。
 *
 * 「こーでぃーが喋っとる最中に君が話し始める→声が止まり、器の口が閉じる。次の発火で遮られた事実を
 * 踏まえた会話が続く」（wave 計画 §1 ①）を成立させるための、依存ゼロ・純ロジックの 2 部品:
 *   1. `computeSpokenPrefix(...)` — モーラタイムライン × 再生経過時間から「実際に声に出た接頭辞」を
 *      **正直に**（過大評価しない側に floor して）算出する純関数。切断点記録の正本材料。
 *   2. `createBargeInGate(...)` — speechStart を起点に「最小持続時間の機械弁」（Nms 内に speechCancel が
 *      来なければ確定 = 瞬間スパイクでは声を止めない）を回すタイマ制御。注入 clock/timer で決定論テスト。
 *
 * ここには器コード・SDK・I/O は一切無い（fake で全分岐を固定できる）。orchestrator の interrupt() が
 * これらを消費し、cockpit-server の onVadEvent 結線が gate を回す（結線層は薄い）。
 *
 * ── 設計の由来（inventory §3-3, §4-1・wave 計画 §2）────────────────────────────
 *  - VAD セグメンタは speechStart（閾値跨ぎ即発火）/ speechCancel（minSpeech 未満のスパイク棄却）/
 *    speechEnd を出す。barge-in は speechStart で最短に反応したいが、瞬間スパイクで声を止めるのは
 *    やり過ぎ。そこで「speechStart を受けても Nms は待ち、その間に speechCancel が来たら譲らない」
 *    という機械弁を挟む（誤爆は wave 計画 §2 裁定 2 の「起きてよい失敗」= 免罪符）。
 *  - 「どこまで声に出たか」は再生 Position を器から取り戻すのではなく、speak() が返す
 *    モーラタイムライン（timeMs = WAV 実時間軸の母音オンセット）× 再生経過時間（中断時刻 −
 *    playbackStartedAtMs）で算出する（Domain A が POSITION 応答を作らなかった申し送りの回収）。
 */

/**
 * 機械弁の最小持続時間（v0 コード内定数・wave 計画 §2 裁定 8「ツマミは作らない」）。
 * speechStart を受けてからこの時間 speechCancel が来なければ barge-in を確定する。
 * 短いほど barge-in は速いが瞬間スパイクを拾いやすい（誤爆は免罪符）。人間ゲートの体感で直す。
 */
export const BARGE_IN_MIN_SPEECH_MS = 200;

/**
 * 切断猶予（v0 コード内定数・「朗読と合いの手」裁定 2・L0 設計裁定 2）。第一段（BARGE_IN_MIN_SPEECH_MS の
 * ノイズ弁）を通過した後、即 onConfirm（切断）せずこの時間だけ「見合う」。猶予中に speechEnd が届けば
 * こーでぃーは切られず続行し（短い相槌が無害になる副次効能）、猶予が満了して発話が継続中（speechEnd 未着）
 * なら onConfirm（切断）する。人間ゲートの体感で直す前提（ツマミは作らない・裁定 8 の写経）。
 */
export const BARGE_IN_GRACE_MS = 2000;

/**
 * 中断注記（soul 行の接頭辞末尾に付ける「ここで遮られた」印）。転写バッファは append-only ゆえ
 * 上書きではなく **接頭辞 + この注記** の 1 エントリを追記して「遮られた事実」を会話の記憶に残す。
 * 次の発火の注入で「soul: こんに…（遮られた）」と読め、遮られた事実を踏まえた会話が続く。
 */
export const BARGE_IN_NOTE = "…（遮られた）";

/**
 * キル注記（soul 行の接頭辞末尾に付ける「ここで強制停止された」印・S8 キルスイッチ）。BARGE_IN_NOTE と
 * 同じ全角括弧様式（対称）。キル状態で再生中の魂発話を即切断する severSpeaking 共有ヘルパが、interrupt
 * （bargeIn）との差分として note を切り替える先。転写バッファは append-only ゆえ、こちらも
 * 「接頭辞 + この注記」の 1 エントリを追記して「強制停止された事実」を会話の記憶に残す。
 */
export const KILL_NOTE = "…（強制停止）";

/**
 * 口を閉じる intent.set の宛先スロット（inventory §2）。mouth-open へ value=0 を着弾させると
 * speech タイムライン全体が現在値から releaseMs（器既定 400ms）かけて基底（閉口）へ強制 release される。
 * 契約に停止専用 kind は無いが、この既存意味論で「口を閉じる」を器コード不変のまま実現できる。
 */
export const MOUTH_CLOSE_SLOT_ID = "mouth-open";

/**
 * 口を閉じる intent.set の ttlMs（短命・器既定の release 窓と同尺）。mouth-open の基底は 0（閉口）
 * なので ttl 満了後もそのまま閉じたまま。契約 payload は 0..1 域内・exclusiveMinimum:0 の ttlMs。
 */
export const MOUTH_CLOSE_TTL_MS = 400;

/**
 * 有限な number か。
 * @param {unknown} v
 * @returns {v is number}
 */
function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * 「実際に声に出た接頭辞」を正直に算出する純関数（切断点算出・blocking 基準 4 の心臓）。
 *
 * ── 写像規則（成果物 domain-b.md §切断点の写像規則に明記）──────────────────────
 *  入力はモーラタイムライン（voiced 母音のオンセット時刻 timeMs・WAV 実時間軸）と、発話全文 speechText、
 *  再生経過 elapsedMs（= 中断時刻 − playbackStartedAtMs）。timeline は母音のみ（脱落モーラは要素を持たず
 *  時間スロットだけ消費）で speechText は文字列なので、両者の直接アラインメントは持たない。そこで:
 *    startedMoras = timeMs < elapsedMs を満たすタイムライン要素数（オンセットを **厳密に** 過ぎたモーラ）
 *    fraction     = startedMoras / totalMoras            （発声が進んだ割合）
 *    charsSpoken  = floor(fraction × speechText.length)  （文字位置へ比例写像・端数は切り捨て）
 *
 * ── 「過大評価しない」根拠（声に出とらん文字を出たことにしない）────────────────────
 *  1. **厳密不等号 `<`**: モーラはオンセット時刻を「厳密に」過ぎて初めて「発声が始まった」と数える。
 *     elapsedMs=0 なら timeMs<0 を満たす要素は無く 0 文字（経過0 = 何も出ていない）。オンセット丁度
 *     （elapsedMs = timeMs）でも数えない（その母音は今まさに立ち上がる瞬間で、まだ音になっていない）。
 *  2. **floor**: 比例写像の端数は必ず切り捨てる（四捨五入や切り上げをしない = 多めに言わない）。
 *  3. **オンセット基準**: 「始まったモーラ」を数える（「終わったモーラ」ではなく）が、脱落文字
 *     （っ/ー/ん など timeline に出ない文字）は voiced モーラ間に散在するため、始まった voiced モーラの
 *     割合を全文長へ比例させることでそれらも按分される。曖昧な端（最後の母音が立ち上がった瞬間に
 *     全文を主張する等）は 1・2 が保守側へ倒す。
 *  経過 > 最後の母音オンセット → startedMoras = totalMoras → fraction=1 → 全文（経過≥全長 = 全文）。
 *
 * @param {object} input
 * @param {string} input.speechText  発話全文（声に出そうとした文字列）。
 * @param {ReadonlyArray<{ timeMs?: unknown }>} input.timeline  speak() が返す母音タイムライン（timeMs 昇順）。
 * @param {number} input.elapsedMs  再生経過ms（中断時刻 − playbackStartedAtMs）。負や 0 は 0 文字。
 * @returns {{ prefix: string; charsSpoken: number; fraction: number; startedMoras: number; totalMoras: number }}
 * @throws {TypeError} speechText が文字列でない / timeline が配列でない / elapsedMs が有限数でない。
 */
export function computeSpokenPrefix(input) {
  if (input == null || typeof input !== "object") {
    throw new TypeError("computeSpokenPrefix: input object is required.");
  }
  const { speechText, timeline, elapsedMs } = input;
  if (typeof speechText !== "string") {
    throw new TypeError(`computeSpokenPrefix: speechText must be a string; got ${typeof speechText}.`);
  }
  if (!Array.isArray(timeline)) {
    throw new TypeError("computeSpokenPrefix: timeline must be an array.");
  }
  if (!isFiniteNumber(elapsedMs)) {
    throw new TypeError(`computeSpokenPrefix: elapsedMs must be a finite number; got ${String(elapsedMs)}.`);
  }

  const totalMoras = timeline.length;
  const textLen = speechText.length;

  // 経過0以下・タイムライン無し・空文字 → 何も声に出ていない（保守側の下限）。
  if (elapsedMs <= 0 || totalMoras === 0 || textLen === 0) {
    return { prefix: "", charsSpoken: 0, fraction: 0, startedMoras: 0, totalMoras };
  }

  // オンセットを「厳密に」過ぎたモーラ数（timeMs が数でない要素は数えない = 保守側）。
  let startedMoras = 0;
  for (const m of timeline) {
    const t = m == null ? undefined : m.timeMs;
    if (isFiniteNumber(t) && t < elapsedMs) {
      startedMoras += 1;
    }
  }

  const fraction = startedMoras / totalMoras;
  let charsSpoken = Math.floor(fraction * textLen);
  if (charsSpoken < 0) charsSpoken = 0;
  if (charsSpoken > textLen) charsSpoken = textLen;

  return {
    prefix: speechText.slice(0, charsSpoken),
    charsSpoken,
    fraction,
    startedMoras,
    totalMoras
  };
}

/**
 * @typedef {{ type: string; tMs?: number }} VadEvent  VAD セグメンタのイベント（speechStart/End/Cancel）。
 */

/**
 * barge-in の機械弁を作る（二段構え・「朗読と合いの手」裁定 1/2・L0 設計裁定 1/2）。
 *
 * ── 二段構え ────────────────────────────────────────────────────────
 *  **第一段（既存・不変）**: speechStart 受信で待機タイマ（minSpeechMs）を張る。窓内に speechCancel が
 *  来たら取消（瞬間スパイクでは声を止めない）。この弁の存在意義・挙動は従来どおり不変——第一段を通過
 *  しても**即 onConfirm はしない**（第二段へ引き継ぐ）。
 *  **第二段（新設・猶予段）**: 第一段通過（窓内に speechCancel が来なかった）で即座に猶予タイマ
 *  （graceMs）を起動する。猶予中に speechEnd が届いたら猶予を取り消す（= 見合い成立・onConfirm を呼ば
 *  ない・切らない。短い相槌（<graceMs）が無害になる副次効能）。猶予が満了して発話が継続中（speechEnd
 *  未着）なら onConfirm（= barge-in 確定・切断）を呼ぶ。
 *
 * speechCancel は**両段の取消弁**として効く（followup #1・L0 裁定改訂）。第一段中は従来どおり瞬間スパイ
 * ク棄却（譲らない）、猶予段（第二段）中も見合い成立と同じ扱い（onConfirm を呼ばない・切らない）で猶予
 * を取り消す——speechCancel は VAD にとって「あれは発話ではなかった」という取消宣言であり、どちらの段
 * にいてもその意味は変わらないため（当初裁定「第一段のみ」は VAD の minSpeechMs=250ms と barge-in 第一
 * 段の minSpeechMs=200ms が独立した別定数であることに起因する 200〜250ms 帯の穴を見落としており、狭す
 * ぎた）。speechEnd は**第二段のみ**に効く（第一段中に来ても無視——VAD 契約上 minSpeechMs 未満で終わる
 * 発話は speechCancel が先に来るはずで、防御的に無視する）。猶予段中に新たな speechStart が来た場合は
 * 無視する（裁量・成果物に根拠明記——猶予段は既に「話し始めた」ことが確定した状態であり、次の一巡は
 * speechEnd/speechCancel による見合い成立後の新オンセットからのみ始まる）。
 *
 * onConfirm のコールバック契約は不変（渡すのは確定した speechStart イベント・意味は「barge-in 確定 = 切
 * 断」）。変わるのは発火タイミング（第一段 minSpeechMs → 第一段+第二段 graceMs の合成・発話継続時）と
 * speechEnd の役割（無視 → 猶予段の取消弁）のみ。
 *
 * ── トグル（setEnabled/isEnabled・L0 設計裁定 1） ────────────────────────────
 *  gate 自身が enabled 状態を持つ（selfFire が fireScheduler 自身に setEnabled を持つのと対称）。既定
 *  enabled=true（裁定 1「既定 ON」・fire-scheduler の自発 OFF 既定とは非対称でよい）。OFF 遷移時は進行
 *  中の第一段・第二段タイマを両方畳む（OFF で onConfirm に至る経路を完全にゼロにする）。OFF 中に来る
 *  VAD イベントは全て無視する。
 *
 * @param {object} options
 * @param {(event: VadEvent) => void} options.onConfirm  barge-in 確定時に呼ぶ（結線層が orchestrator.interrupt を呼ぶ）。
 * @param {number} [options.minSpeechMs=BARGE_IN_MIN_SPEECH_MS]  第一段（ノイズ弁）の待機時間。
 * @param {number} [options.graceMs=BARGE_IN_GRACE_MS]  第二段（猶予）の待機時間。
 * @param {boolean} [options.enabled=true]  初期 ON/OFF（既定 ON・裁定 1）。
 * @param {typeof setTimeout} [options.setTimeoutImpl=setTimeout]  テスト注入。
 * @param {typeof clearTimeout} [options.clearTimeoutImpl=clearTimeout]  テスト注入。
 * @returns {{
 *   handle: (event: VadEvent) => void;
 *   isPending: () => boolean;
 *   setEnabled: (enabled: boolean) => void;
 *   isEnabled: () => boolean;
 *   dispose: () => void;
 * }}
 */
export function createBargeInGate(options) {
  if (options == null || typeof options !== "object" || typeof options.onConfirm !== "function") {
    throw new TypeError("createBargeInGate: options.onConfirm function is required.");
  }
  const onConfirm = options.onConfirm;
  const minSpeechMs = isFiniteNumber(options.minSpeechMs) ? options.minSpeechMs : BARGE_IN_MIN_SPEECH_MS;
  const graceMs = isFiniteNumber(options.graceMs) ? options.graceMs : BARGE_IN_GRACE_MS;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;

  /** @type {ReturnType<typeof setTimeout> | null} 第一段（ノイズ弁）のタイマ。 */
  let valveTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} 第二段（猶予）のタイマ。 */
  let graceTimer = null;
  /** @type {VadEvent | null} 確定候補の speechStart（onConfirm へ渡す）。 */
  let pendingEvent = null;
  /** enabled の既定は true（裁定 1「既定 ON」・fire-scheduler の自発 OFF 既定とは非対称）。 */
  let enabled = options.enabled !== false;
  let disposed = false;

  const clearValve = () => {
    if (valveTimer != null) {
      clearTimeoutImpl(/** @type {any} */ (valveTimer));
      valveTimer = null;
    }
  };
  const clearGrace = () => {
    if (graceTimer != null) {
      clearTimeoutImpl(/** @type {any} */ (graceTimer));
      graceTimer = null;
    }
  };
  /** 両段のタイマと確定候補を畳む（OFF 遷移・dispose から呼ばれる）。 */
  const clearAll = () => {
    clearValve();
    clearGrace();
    pendingEvent = null;
  };

  /** 第一段通過 → 第二段（猶予）へ入る。猶予満了かつ発話継続（speechEnd 未着）で onConfirm。 */
  const startGrace = () => {
    graceTimer = setTimeoutImpl(() => {
      graceTimer = null;
      const confirmed = pendingEvent;
      pendingEvent = null;
      // graceMs の間 speechEnd が来なかった（見合い不成立） = 確定（切断）。
      onConfirm(/** @type {VadEvent} */ (confirmed));
    }, graceMs);
  };

  return {
    /**
     * VAD イベントを 1 個食わせる。speechStart → 第一段待機開始、speechCancel → 第一段中なら第一段取消・
     * 猶予段中なら猶予取消（両段の取消弁・followup #1 裁定改訂）、speechEnd → 第二段（猶予中）なら取消
     * （見合い成立）、他は無視。OFF 中・dispose 後は全イベント無視。
     * @param {VadEvent} event
     */
    handle(event) {
      if (disposed || !enabled || event == null || typeof event.type !== "string") return;
      if (event.type === "speechStart") {
        if (graceTimer != null) {
          // 猶予段（第二段）進行中の新オンセットは無視する（裁量）。猶予段は既に「話し始めた」ことが
          // 確定した状態であり、次の一巡は speechEnd による見合い成立後の新オンセットからのみ始まる。
          return;
        }
        // 第一段: 直前の待機が残っていれば張り替える（新しい発話オンセットを優先・既存挙動不変）。
        clearValve();
        pendingEvent = event;
        valveTimer = setTimeoutImpl(() => {
          valveTimer = null;
          // minSpeechMs の間 speechCancel が来なかった = 第一段通過 → 即 onConfirm せず第二段（猶予）へ。
          startGrace();
        }, minSpeechMs);
      } else if (event.type === "speechCancel") {
        // 両段の取消弁（followup #1・L0 裁定改訂）。第一段中は従来どおり瞬間スパイク棄却（譲らない）。
        // 猶予段（第二段）中も見合い成立と同じ扱い（onConfirm を呼ばない = 切らない）で取り消す——
        // speechCancel は VAD の「あれは発話ではなかった」宣言であり、どちらの段でも意味は変わらない。
        if (valveTimer != null) {
          clearValve();
          pendingEvent = null;
        } else if (graceTimer != null) {
          clearGrace();
          pendingEvent = null;
        }
      } else if (event.type === "speechEnd") {
        // 第二段（猶予）のみに効く（見合い成立 = 切らない）。第一段中は無視（VAD 契約上 speechCancel が
        // 先に来るはずで、防御的に無視する・第一段の挙動は不変）。
        if (graceTimer != null) {
          clearGrace();
          pendingEvent = null;
        }
      }
    },
    /** 第一段・第二段いずれかが進行中なら true。 */
    isPending() {
      return valveTimer != null || graceTimer != null;
    },
    /**
     * ON/OFF の切替。OFF 遷移時は進行中の第一段・第二段タイマを両方畳む（OFF で onConfirm に至る経路を
     * 完全にゼロにする）。ON への復帰では新規イベント待ち（既存の待機は復元しない）。
     * @param {boolean} next
     */
    setEnabled(next) {
      const value = next === true;
      if (value === enabled) return;
      enabled = value;
      if (!enabled) {
        clearAll();
      }
    },
    isEnabled() {
      return enabled;
    },
    dispose() {
      disposed = true;
      clearAll();
    }
  };
}
