// @ts-check
/**
 * 返事の遅延の記録（操縦席の遅延の棒の材料）— apps/soul/agent。
 *
 * 合意: discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md §7・§8・§9。1 返事 1 レコードで、
 * 区間「文字起こし・判定・画面（画面を見たときだけ）・LLM 最初の文字・最初の文（Codex のみ）・TTS・声」の時間（ms）と
 * 合計を発火番号付きで画面へ届ける。実測できない区間は null。手元 VAD の 0.4 秒（定数）は含めない。
 *
 * ここは純ロジック（I/O ゼロ・時計注入）。発火の中の区間は fire-orchestrator が `createFireTiming` に
 * 既存のトレース（本文を含まない event 名と数値だけ）を食わせて測り、発火の外の区間（文字起こし・判定）は
 * 結線層（cockpit-server）が `composeReplyLatency` で足して合計と「遅い」の区分を付ける。
 *
 * ── 発火の中の区間（すべて同じ単調時計の差）────────────────────────────────────
 *  - 画面: 画面キャプチャの elapsedMs（`vision.capture.completed` の elapsedMs・撮影係の実測）。
 *  - LLM 最初の文字: `llm.ask.started` → `llm.first_delta`（Codex 系）。delta が来ない頭（Claude）は
 *    llm-session が測った ttftMs（`noteTtft`）。
 *  - 最初の文: `llm.first_delta` → `progressive.first_safe_sentence`（Codex 系の文ごとの読み上げのみ）。
 *  - TTS: 最初の文で声の差し替え口（engine）に頼んでから最初の音のかたまりまで
 *    （`voice.synthesis.requested` → `voice.audio.first_chunk`・SpeechStreamer が出す engine に依存しない名前）。
 *    文ごとの読み上げも一括の読み上げも jobId が `…:sentence-1` のものだけを見る（jobId の無いトレースも数える）。
 *  - 声: 最初の音のかたまりから声が鳴り始めるまで（`voice.audio.first_chunk` → `voice.player.started`＝
 *    流し込みプレイヤーの STARTED）。器への open の往復・プレイヤーの立ち上がりを含む。
 *  - inFireMs: fire() が呼ばれてから声が鳴り始めるまで（資源の取得・画面・LLM・TTS・声とその間の隙間すべて）。
 *  - otherMs: inFireMs のうち名前の付いた区間に入らない残り（Claude では「最初の文字」以降の生成の続きが主）。
 *
 * ── 合計（composeReplyLatency）─────────────────────────────────────────────
 *  合計 = 文字起こし + 判定 + inFireMs（声が鳴り始めたときだけ。鳴らなかった返事は null）。
 *  「遅い」は合計が warnSec 秒を超えたら "warn"（琥珀）、alertSec 秒を超えたら "alert"（赤）。
 */

/** 合計の「遅い」しきい値の既定（4 秒超で琥珀・§9.1）。 */
export const LATENCY_WARN_SEC_DEFAULT = 4;
/** 合計の「とても遅い」しきい値の既定（6 秒超で赤・§9.1）。 */
export const LATENCY_ALERT_SEC_DEFAULT = 6;

/** 区間のキー（凡例の順: 文字起こし・判定・画面・LLM 最初の文字・最初の文・TTS・声）。 */
export const LATENCY_SEGMENT_KEYS = Object.freeze([
  "transcribeMs",
  "judgeMs",
  "screenMs",
  "llmFirstMs",
  "firstSentenceMs",
  "ttsMs",
  "voiceMs"
]);

/** @param {unknown} v */
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** @param {number | null} v */
const roundMs = (v) => (v == null ? null : Math.max(0, Math.round(v)));

/**
 * しきい値（秒）を正規化する。正の有限数でなければ既定。赤が琥珀より小さければ琥珀に揃える。
 * @param {{ warnSec?: unknown; alertSec?: unknown } | null | undefined} [input]
 * @returns {{ warnSec: number; alertSec: number }}
 */
export function resolveLatencyThresholds(input) {
  const pick = (/** @type {unknown} */ v, /** @type {number} */ fallback) => (isNum(v) && /** @type {number} */ (v) > 0 ? /** @type {number} */ (v) : fallback);
  const warnSec = pick(input?.warnSec, LATENCY_WARN_SEC_DEFAULT);
  const alertSec = Math.max(warnSec, pick(input?.alertSec, LATENCY_ALERT_SEC_DEFAULT));
  return { warnSec, alertSec };
}

/**
 * 合計（ms）→ 区分。null は null。
 * @param {number | null} totalMs
 * @param {{ warnSec: number; alertSec: number }} thresholds
 * @returns {"ok" | "warn" | "alert" | null}
 */
export function latencyLevel(totalMs, thresholds) {
  if (!isNum(totalMs)) return null;
  const t = /** @type {number} */ (totalMs);
  if (t > thresholds.alertSec * 1000) return "alert";
  if (t > thresholds.warnSec * 1000) return "warn";
  return "ok";
}

/**
 * 最初の文のトレースか（jobId が `…:sentence-1`）。jobId が無いトレースも最初の文として数える。
 * @param {Record<string, unknown> | undefined} fields
 */
function isFirstSpeechJob(fields) {
  const jobId = fields && typeof fields.jobId === "string" ? fields.jobId : null;
  return jobId == null || jobId.endsWith(":sentence-1");
}

/**
 * 1 発火の中の区間を測る（fire-orchestrator が 1 発火ごとに作る）。
 * @param {{ nowImpl: () => number }} options  単調時計（既定 performance.now を orchestrator が渡す）。
 */
export function createFireTiming(options) {
  const nowImpl = options.nowImpl;
  const fireCalledAt = nowImpl();
  /** @type {Record<string, number | null>} */
  const marks = {
    askStartedAt: null,
    firstDeltaAt: null,
    firstSentenceAt: null,
    synthesisRequestedAt: null,
    firstAudioAt: null,
    voiceStartedAt: null
  };
  /** @type {number | null} */
  let screenMs = null;
  /** @type {number | null} */
  let ttftMs = null;

  const markOnce = (/** @type {string} */ key) => {
    if (marks[key] == null) marks[key] = nowImpl();
  };

  return {
    /**
     * orchestrator のトレース（event 名と数値だけ）を食わせる。知らない event は無視。
     * @param {string} event @param {Record<string, unknown>} [fields]
     */
    observe(event, fields = {}) {
      switch (event) {
        case "llm.ask.started":
          markOnce("askStartedAt");
          return;
        case "llm.first_delta":
          markOnce("firstDeltaAt");
          return;
        case "progressive.first_safe_sentence":
          markOnce("firstSentenceAt");
          return;
        case "voice.synthesis.requested":
          if (isFirstSpeechJob(fields)) markOnce("synthesisRequestedAt");
          return;
        case "voice.audio.first_chunk":
          if (isFirstSpeechJob(fields)) markOnce("firstAudioAt");
          return;
        case "voice.player.started":
          if (isFirstSpeechJob(fields)) markOnce("voiceStartedAt");
          return;
        case "vision.capture.completed":
          if (isNum(fields.elapsedMs)) screenMs = /** @type {number} */ (fields.elapsedMs);
          return;
        default:
          return;
      }
    },
    /** delta を出さない頭（Claude）の最初の文字までの実測（llm-session の ttftMs）。 */
    noteTtft(/** @type {unknown} */ ms) {
      if (ttftMs == null && isNum(ms)) ttftMs = /** @type {number} */ (ms);
    },
    hasVoiceStarted: () => marks.voiceStartedAt != null,
    hasAsked: () => marks.askStartedAt != null,
    /**
     * 発火の中の区間（ms・整数）。測れなかった区間は null。
     * @returns {{ screenMs: number | null; llmFirstMs: number | null; firstSentenceMs: number | null; ttsMs: number | null; voiceMs: number | null; inFireMs: number | null; otherMs: number | null }}
     */
    segments() {
      const diff = (/** @type {string} */ from, /** @type {string} */ to) =>
        marks[from] != null && marks[to] != null ? /** @type {number} */ (marks[to]) - /** @type {number} */ (marks[from]) : null;
      const llmFirst = diff("askStartedAt", "firstDeltaAt") ?? ttftMs;
      const firstSentence = diff("firstDeltaAt", "firstSentenceAt");
      const tts = diff("synthesisRequestedAt", "firstAudioAt");
      const voice = diff("firstAudioAt", "voiceStartedAt");
      const inFire = marks.voiceStartedAt != null ? marks.voiceStartedAt - fireCalledAt : null;
      const named = [screenMs, llmFirst, firstSentence, tts, voice].reduce((sum, v) => sum + (v ?? 0), 0);
      return {
        screenMs: roundMs(screenMs),
        llmFirstMs: roundMs(llmFirst),
        firstSentenceMs: roundMs(firstSentence),
        ttsMs: roundMs(tts),
        voiceMs: roundMs(voice),
        inFireMs: roundMs(inFire),
        otherMs: inFire != null ? roundMs(inFire - named) : null
      };
    }
  };
}

/**
 * @typedef {{
 *   fireId: number;
 *   cause: object | null;
 *   vision: boolean;
 *   spoken: boolean;
 *   screenMs: number | null;
 *   llmFirstMs: number | null;
 *   firstSentenceMs: number | null;
 *   ttsMs: number | null;
 *   voiceMs: number | null;
 *   inFireMs: number | null;
 *   otherMs: number | null;
 * }} FireLatency  orchestrator の onLatency が渡す発火の中の区間。
 */

/**
 * 発火の中の区間に、発火の外の区間（文字起こし・判定）を足して 1 返事のレコードにする。
 * @param {FireLatency} inFire
 * @param {{ transcribeMs?: number | null; judgeMs?: number | null; thresholds: { warnSec: number; alertSec: number } }} extra
 * @returns {{
 *   fireId: number;
 *   cause: object | null;
 *   spoken: boolean;
 *   segments: { transcribeMs: number | null; judgeMs: number | null; screenMs: number | null; llmFirstMs: number | null; firstSentenceMs: number | null; ttsMs: number | null; voiceMs: number | null };
 *   otherMs: number | null;
 *   totalMs: number | null;
 *   level: "ok" | "warn" | "alert" | null;
 * }}
 */
export function composeReplyLatency(inFire, extra) {
  const transcribeMs = isNum(extra.transcribeMs) ? roundMs(/** @type {number} */ (extra.transcribeMs)) : null;
  const judgeMs = isNum(extra.judgeMs) ? roundMs(/** @type {number} */ (extra.judgeMs)) : null;
  const totalMs =
    inFire.spoken && isNum(inFire.inFireMs)
      ? (transcribeMs ?? 0) + (judgeMs ?? 0) + /** @type {number} */ (inFire.inFireMs)
      : null;
  return {
    fireId: inFire.fireId,
    cause: inFire.cause ?? null,
    spoken: inFire.spoken === true,
    segments: {
      transcribeMs,
      judgeMs,
      screenMs: inFire.screenMs ?? null,
      llmFirstMs: inFire.llmFirstMs ?? null,
      firstSentenceMs: inFire.firstSentenceMs ?? null,
      ttsMs: inFire.ttsMs ?? null,
      voiceMs: inFire.voiceMs ?? null
    },
    otherMs: inFire.otherMs ?? null,
    totalMs,
    level: latencyLevel(totalMs, extra.thresholds)
  };
}
