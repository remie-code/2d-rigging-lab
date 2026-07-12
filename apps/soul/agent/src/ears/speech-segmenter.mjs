// @ts-check
/**
 * 発話セグメンタ純関数（S2 Domain A の心臓）— apps/soul/agent。
 *
 * Silero VAD が各フレームに付ける**発話確率**の時系列を、発話セグメント（speechStart/speechEnd）
 * に畳むヒステリシス状態機械。「いつ区切るか」は whisper-server 側ではなくクライアント（魂）の
 * 仕事（planning-inventory §1）なので、その判断をここに閉じる。onnxruntime に一切触れない純ロジック
 * ＝合成確率列 fixture で境界を完全に固定できる（install 不要でこの層は緑にできる）。
 *
 * ── VAD イベントは魂の一級市民（S2 計画 §2・裁定1）─────────────────────────
 *  出す 3 イベント（S6 barge-in / S9 相槌 / Domain B ASR が購読する継ぎ目）:
 *   - `speechStart`  : 確率が threshold を跨いだ**瞬間**に即発火（暫定オンセット）。
 *                      → S6 barge-in が「ユーザーが喋り出した」を最短で知るための信号。
 *   - `speechEnd`    : minSilence 分の無音が確定し、かつ発話長が minSpeech 以上だったときに発火。
 *                      padded な {startMs, endMs} を載せる＝Domain B がこの範囲を WAV に切って ASR へ。
 *                      → S9 相槌が「ユーザーが一区切りついた」を知る信号でもある。
 *   - `speechCancel` : 暫定オンセットが minSpeech 未満で消えた（＝スパイク棄却）とき発火。
 *                      → S6 が speechStart で始めた duck を取り消すための retraction。
 *
 * ── ヒステリシス（Silero get_speech_timestamps 準拠の語彙）──────────────────
 *  threshold で立ち上げ、negThreshold（既定 threshold-0.15）を下回って minSilence 続いたら区切る。
 *  minSpeech 未満のセグメントは棄却（speechEnd を出さず speechCancel）。maxSpeech を超えたら
 *  無音を待たず強制区切り（長い独白の安全弁。reason="maxSpeech"）。speechPad で前後を膨らませる。
 *
 * ── 時間軸 ─────────────────────────────────────────────────────────
 *  ストリーミング API `createSpeechSegmenter` は各フレームの絶対時刻 tMs を呼び出し側が与える
 *  （フレーム開始時刻）。バッチ API `segmentSpeech(probs, {frameMs})` は tMs = i*frameMs を自動付与
 *  して有限確率列を一括処理する（fixture テスト用）。
 */

/** 既定パラメータ（whisper-server / Silero の既定に相当）。 */
export const DEFAULT_SEGMENTER_OPTIONS = Object.freeze({
  threshold: 0.5, // 立ち上げ閾値（この値以上で発話オンセット）。
  // negThreshold 既定は threshold - 0.15。明示 undefined のとき解決する。
  negThreshold: undefined,
  minSpeechMs: 250, // これ未満の発話は棄却（スパイク除去）。
  minSilenceMs: 100, // この長さの無音が続いて初めて発話終了と確定。
  speechPadMs: 30, // 各セグメントの前後をこの分だけ膨らませる。
  maxSpeechMs: Infinity // これを超えたら無音を待たず強制区切り（0/未指定で無効＝Infinity）。
});

/** frameMs の既定（512 サンプル @16kHz = 32ms）。バッチ API 用。 */
export const DEFAULT_FRAME_MS = 32;

/**
 * オプションを正規化し、negThreshold を解決する。
 * @param {Partial<typeof DEFAULT_SEGMENTER_OPTIONS>} [options]
 */
function resolveOptions(options = {}) {
  const threshold = options.threshold ?? DEFAULT_SEGMENTER_OPTIONS.threshold;
  const negThreshold =
    options.negThreshold != null ? options.negThreshold : Math.max(0, threshold - 0.15);
  const minSpeechMs = options.minSpeechMs ?? DEFAULT_SEGMENTER_OPTIONS.minSpeechMs;
  const minSilenceMs = options.minSilenceMs ?? DEFAULT_SEGMENTER_OPTIONS.minSilenceMs;
  const speechPadMs = options.speechPadMs ?? DEFAULT_SEGMENTER_OPTIONS.speechPadMs;
  const rawMax = options.maxSpeechMs ?? DEFAULT_SEGMENTER_OPTIONS.maxSpeechMs;
  const maxSpeechMs = rawMax && rawMax > 0 ? rawMax : Infinity;

  if (!(threshold > 0 && threshold <= 1)) {
    throw new RangeError(`segmenter: threshold must be in (0,1]; got ${threshold}.`);
  }
  if (!(negThreshold >= 0 && negThreshold < threshold)) {
    throw new RangeError(
      `segmenter: negThreshold must be in [0, threshold); got ${negThreshold} (threshold ${threshold}).`
    );
  }
  for (const [name, value] of [
    ["minSpeechMs", minSpeechMs],
    ["minSilenceMs", minSilenceMs],
    ["speechPadMs", speechPadMs]
  ]) {
    if (!(typeof value === "number" && Number.isFinite(value) && value >= 0)) {
      throw new RangeError(`segmenter: ${name} must be a finite number >= 0; got ${value}.`);
    }
  }
  return { threshold, negThreshold, minSpeechMs, minSilenceMs, speechPadMs, maxSpeechMs };
}

/**
 * ストリーミング発話セグメンタを作る。フレーム確率を push すると、そのフレームで確定した
 * イベント列（0 個以上）を返す。実マイク経路（Domain C）はこれを VAD の後段に置く。
 *
 * @param {Partial<typeof DEFAULT_SEGMENTER_OPTIONS>} [options]
 * @param {(event: SegmenterEvent) => void} [onEvent]  発火ごとのコールバック（省略可・返り値でも受けられる）。
 * @returns {{
 *   push: (probability: number, tMs: number) => SegmenterEvent[];
 *   flush: (tMs: number) => SegmenterEvent[];
 *   isSpeaking: () => boolean;
 *   reset: () => void;
 * }}
 *
 * @typedef {{ type: "speechStart"; tMs: number }} SpeechStartEvent
 * @typedef {{ type: "speechEnd"; tMs: number; startMs: number; endMs: number; durationMs: number; reason: "silence"|"maxSpeech"|"flush" }} SpeechEndEvent
 * @typedef {{ type: "speechCancel"; tMs: number; startMs: number }} SpeechCancelEvent
 * @typedef {SpeechStartEvent | SpeechEndEvent | SpeechCancelEvent} SegmenterEvent
 */
export function createSpeechSegmenter(options = {}, onEvent) {
  const cfg = resolveOptions(options);

  let triggered = false;
  /** 現発話の生の開始時刻（padding 前）。 */
  let speechStartMs = 0;
  /** 暫定 speechStart で外へ伝えた padded 開始時刻（cancel 時の retraction 用）。 */
  let emittedStartMs = 0;
  /** 無音候補の開始時刻（negThreshold を最初に割った時刻）。null = 無音候補なし。 */
  /** @type {number | null} */
  let silenceStartMs = null;
  /** 単調性チェック用の直近 tMs。 */
  let lastTMs = -Infinity;

  const paddedStart = (raw) => Math.max(0, raw - cfg.speechPadMs);
  const paddedEnd = (raw) => raw + cfg.speechPadMs;

  /**
   * @param {SegmenterEvent[]} sink
   * @param {SegmenterEvent} event
   */
  function emit(sink, event) {
    sink.push(event);
    if (onEvent) onEvent(event);
  }

  /** 現発話を [speechStartMs, endRawMs] で確定 or 棄却する。 */
  function finalize(sink, endRawMs, tMs, reason) {
    const durationRaw = endRawMs - speechStartMs;
    if (durationRaw >= cfg.minSpeechMs) {
      const startMs = paddedStart(speechStartMs);
      const endMs = paddedEnd(endRawMs);
      emit(sink, {
        type: "speechEnd",
        tMs,
        startMs,
        endMs,
        durationMs: endMs - startMs,
        reason
      });
    } else {
      // minSpeech 未満 → 棄却。暫定オンセットを retraction。
      emit(sink, { type: "speechCancel", tMs, startMs: emittedStartMs });
    }
    triggered = false;
    silenceStartMs = null;
  }

  return {
    /**
     * 1 フレーム分の確率と時刻を投入し、確定イベント列を返す。
     * @param {number} probability  発話確率 [0,1]。
     * @param {number} tMs          このフレームの絶対時刻（フレーム開始・非減少）。
     * @returns {SegmenterEvent[]}
     */
    push(probability, tMs) {
      if (typeof probability !== "number" || !Number.isFinite(probability)) {
        throw new TypeError(`segmenter.push: probability must be a finite number; got ${probability}.`);
      }
      if (typeof tMs !== "number" || !Number.isFinite(tMs)) {
        throw new TypeError(`segmenter.push: tMs must be a finite number; got ${tMs}.`);
      }
      if (tMs < lastTMs) {
        throw new RangeError(`segmenter.push: tMs must be non-decreasing; got ${tMs} after ${lastTMs}.`);
      }
      lastTMs = tMs;

      /** @type {SegmenterEvent[]} */
      const events = [];

      if (!triggered) {
        if (probability >= cfg.threshold) {
          // 立ち上げ。暫定オンセットを即発火（barge-in 最短反応）。
          triggered = true;
          speechStartMs = tMs;
          silenceStartMs = null;
          emittedStartMs = paddedStart(tMs);
          emit(events, { type: "speechStart", tMs: emittedStartMs });
        }
        return events;
      }

      // --- triggered 中 ---
      // maxSpeech 強制区切り（無音を待たない安全弁）。padding 前の生発話長で判定。
      if (cfg.maxSpeechMs !== Infinity && tMs - speechStartMs >= cfg.maxSpeechMs) {
        finalize(events, tMs, tMs, "maxSpeech");
        // 連続する発話としてその場から次セグメントを継続（新規オンセット扱いにはしない）。
        if (probability >= cfg.negThreshold) {
          triggered = true;
          speechStartMs = tMs;
          silenceStartMs = null;
          emittedStartMs = paddedStart(tMs);
        }
        return events;
      }

      if (probability < cfg.negThreshold) {
        // 無音候補。最初の割り込み時刻を記録し、minSilence 継続で確定。
        if (silenceStartMs === null) {
          silenceStartMs = tMs;
        }
        if (tMs - silenceStartMs >= cfg.minSilenceMs) {
          finalize(events, silenceStartMs, tMs, "silence");
        }
      } else {
        // 発話継続（negThreshold 以上に戻った）→ 無音候補をリセット。
        silenceStartMs = null;
      }
      return events;
    },

    /**
     * ストリーム終端で呼ぶ。triggered 中なら endRaw=tMs で確定 or 棄却する。
     * @param {number} tMs  終端時刻（最後のフレーム時刻以上）。
     * @returns {SegmenterEvent[]}
     */
    flush(tMs) {
      /** @type {SegmenterEvent[]} */
      const events = [];
      if (triggered) {
        const endRaw = silenceStartMs ?? tMs;
        finalize(events, endRaw, tMs, "flush");
      }
      return events;
    },

    isSpeaking() {
      return triggered;
    },

    reset() {
      triggered = false;
      silenceStartMs = null;
      speechStartMs = 0;
      emittedStartMs = 0;
      lastTMs = -Infinity;
    }
  };
}

/**
 * 有限の確率列を一括でセグメントに畳むバッチ純関数（fixture テスト用）。
 * 各確率 probs[i] のフレーム時刻を tMs = i*frameMs として segmenter に流し、終端で flush する。
 *
 * @param {ArrayLike<number>} probs  発話確率列 [0,1]。
 * @param {Partial<typeof DEFAULT_SEGMENTER_OPTIONS> & { frameMs?: number }} [options]
 * @returns {{ segments: Array<{ startMs: number; endMs: number; durationMs: number; reason: string }>; events: SegmenterEvent[] }}
 */
export function segmentSpeech(probs, options = {}) {
  if (probs == null || typeof probs.length !== "number") {
    throw new TypeError("segmentSpeech: probs must be array-like of numbers.");
  }
  const frameMs = options.frameMs ?? DEFAULT_FRAME_MS;
  if (!(typeof frameMs === "number" && frameMs > 0)) {
    throw new RangeError(`segmentSpeech: frameMs must be a positive number; got ${frameMs}.`);
  }
  const segmenter = createSpeechSegmenter(options);
  /** @type {SegmenterEvent[]} */
  const events = [];
  for (let i = 0; i < probs.length; i += 1) {
    for (const e of segmenter.push(probs[i], i * frameMs)) {
      events.push(e);
    }
  }
  // 終端: 最後のフレームの「終わり」を終端時刻にする（length*frameMs）。
  for (const e of segmenter.flush(probs.length * frameMs)) {
    events.push(e);
  }
  const segments = events
    .filter((e) => e.type === "speechEnd")
    .map((e) => {
      const s = /** @type {SpeechEndEvent} */ (e);
      return { startMs: s.startMs, endMs: s.endMs, durationMs: s.durationMs, reason: s.reason };
    });
  return { segments, events };
}
