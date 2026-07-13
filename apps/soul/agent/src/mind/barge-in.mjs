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
 * 中断注記（soul 行の接頭辞末尾に付ける「ここで遮られた」印）。転写バッファは append-only ゆえ
 * 上書きではなく **接頭辞 + この注記** の 1 エントリを追記して「遮られた事実」を会話の記憶に残す。
 * 次の発火の注入で「soul: こんに…（遮られた）」と読め、遮られた事実を踏まえた会話が続く。
 */
export const BARGE_IN_NOTE = "…（遮られた）";

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
 * barge-in の機械弁を作る。speechStart 受信で待機タイマを張り、minSpeechMs 経過までに speechCancel が
 * 来なければ onConfirm を発火する（= barge-in 確定）。speechCancel が来たら待機を取り消す（瞬間スパイク
 * では声を止めない）。時計を持たず timer 制御のみ（注入 setTimeout/clearTimeout で決定論テスト）。
 *
 * @param {object} options
 * @param {(event: VadEvent) => void} options.onConfirm  barge-in 確定時に呼ぶ（結線層が orchestrator.interrupt を呼ぶ）。
 * @param {number} [options.minSpeechMs=BARGE_IN_MIN_SPEECH_MS]  機械弁の待機時間。
 * @param {typeof setTimeout} [options.setTimeoutImpl=setTimeout]  テスト注入。
 * @param {typeof clearTimeout} [options.clearTimeoutImpl=clearTimeout]  テスト注入。
 * @returns {{ handle: (event: VadEvent) => void; isPending: () => boolean; dispose: () => void }}
 */
export function createBargeInGate(options) {
  if (options == null || typeof options !== "object" || typeof options.onConfirm !== "function") {
    throw new TypeError("createBargeInGate: options.onConfirm function is required.");
  }
  const onConfirm = options.onConfirm;
  const minSpeechMs = isFiniteNumber(options.minSpeechMs) ? options.minSpeechMs : BARGE_IN_MIN_SPEECH_MS;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let pending = null;
  /** @type {VadEvent | null} 待機中の speechStart（confirm へ渡す）。 */
  let pendingEvent = null;
  let disposed = false;

  const clearPending = () => {
    if (pending != null) {
      clearTimeoutImpl(/** @type {any} */ (pending));
      pending = null;
    }
    pendingEvent = null;
  };

  return {
    /**
     * VAD イベントを 1 個食わせる。speechStart → 待機開始、speechCancel → 待機取消、他は無視。
     * @param {VadEvent} event
     */
    handle(event) {
      if (disposed || event == null || typeof event.type !== "string") return;
      if (event.type === "speechStart") {
        // 直前の待機が残っていれば張り替える（新しい発話オンセットを優先）。
        clearPending();
        pendingEvent = event;
        pending = setTimeoutImpl(() => {
          pending = null;
          const confirmed = pendingEvent;
          pendingEvent = null;
          // minSpeechMs の間 speechCancel が来なかった = 確定。
          onConfirm(confirmed ?? event);
        }, minSpeechMs);
      } else if (event.type === "speechCancel") {
        // 瞬間スパイク棄却 = 譲らない（待機を取り消す）。
        clearPending();
      }
      // speechEnd は機械弁に無関係（確定済みの発話・タイマは既に発火済み）。
    },
    isPending() {
      return pending != null;
    },
    dispose() {
      disposed = true;
      clearPending();
    }
  };
}
