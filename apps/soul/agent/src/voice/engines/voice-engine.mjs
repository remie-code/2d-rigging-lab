// @ts-check
/**
 * 声の差し替え口（VoiceEngine）の形と工場関数（声の差し替え Wave 2 Domain C）— apps/soul/agent。
 *
 * 合意: discussion/ai-cohost/implementation/orchestration/voice-swap-wave-plan.md §0。
 * 「声を発する」を 1 つの機能として差し替えられるようにする（inventory §1-4）。engine は
 * 文 → 音のかたまり + 口の時間割のかたまり、だけを担う。鳴らす順番・器への送り方・割り込みは
 * SpeechStreamer（../speech-streamer.mjs）の領分で、engine は器もプレイヤーも知らない。
 *
 * ── VoiceEngine の形 ─────────────────────────────────────────────────────
 *  - `synthesize(text, { signal, onTrace })` → 非同期の列（AsyncIterable<VoiceChunk>）:
 *      {type:"format", sampleRate, channels} … 最初に 1 回（PCM16LE の形式）
 *      {type:"audio", pcm}                    … 音のかたまり（PCM16LE・0 回以上）
 *      {type:"timeline", entries}             … 口の時間割のかたまり（{timeMs,vowel,s}・timeMs は
 *                                               その文の音声先頭からの通し値・単調増加）
 *      {type:"end"}                            … この文はもう続きがない
 *    audio と timeline の前後は engine 次第（AivisSpeech は format → audio → timeline → end を一度に出す）。
 *    失敗は列の途中で throw する（code / diagnosticStage 付き）。`signal` で中止されたら投げて終わる。
 *  - `status`（`connecting | up | reconnecting | down`・STT と同じ語彙）と `onStatus(listener)` → 解除関数。
 *  - `dispose()`: 畳む（以後の synthesize は投げる）。
 *  - `kind`: engine の種類（"aivis" など。表示・診断用）。
 *
 * ── 工場関数 ─────────────────────────────────────────────────────────────
 *  `createVoiceEngine(kind, deps)`。今は "aivis" だけ。Wave 3 で "elevenlabs" を {@link VOICE_ENGINE_FACTORIES}
 *  に 1 行足して差し込む（操縦席の設定キー `ttsEngine` の値と同じ名前）。知らない kind は投げる
 *  （設定値の正規化＝不明な値は aivis に戻す、は操縦席の設定層の領分）。
 */

import { createAivisVoiceEngine } from "./aivis-voice-engine.mjs";

export { VOICE_ENGINE_STATUSES } from "./engine-status.mjs";

/**
 * @typedef {(
 *   { type: "format"; sampleRate: number; channels: number } |
 *   { type: "audio"; pcm: Uint8Array } |
 *   { type: "timeline"; entries: Array<{ timeMs: number; vowel: string; s: number }> } |
 *   { type: "end" }
 * )} VoiceChunk
 */

/**
 * @typedef {{
 *   kind: string;
 *   readonly status: import("./engine-status.mjs").VoiceEngineStatus;
 *   onStatus: (listener: (status: import("./engine-status.mjs").VoiceEngineStatus) => void) => () => void;
 *   synthesize: (text: string, options?: { signal?: AbortSignal; onTrace?: (event: string, fields?: Record<string, unknown>) => void }) => AsyncIterable<VoiceChunk>;
 *   dispose: () => void;
 * }} VoiceEngine
 */

/** engine の種類 → 作り方。Wave 3 で `elevenlabs` を足す。 */
export const VOICE_ENGINE_FACTORIES = Object.freeze({
  /** @param {any} deps */
  aivis: (deps) => createAivisVoiceEngine(deps)
});

/** 作れる engine の種類（操縦席の既定は "aivis"）。 */
export const VOICE_ENGINE_KINDS = Object.freeze(Object.keys(VOICE_ENGINE_FACTORIES));

/** 操縦席の既定の engine。 */
export const DEFAULT_VOICE_ENGINE_KIND = "aivis";

/**
 * engine を作る。
 * @param {string} kind  "aivis"（Wave 3 で "elevenlabs"）。
 * @param {object} [deps]  engine ごとの依存（aivis: tts / ttsBaseUrl / speaker / sConfig）。
 * @returns {VoiceEngine}
 * @throws {RangeError} 知らない kind。
 */
export function createVoiceEngine(kind, deps = {}) {
  const factory = Object.hasOwn(VOICE_ENGINE_FACTORIES, kind)
    ? /** @type {Record<string, (deps: any) => VoiceEngine>} */ (VOICE_ENGINE_FACTORIES)[kind]
    : null;
  if (factory == null) {
    throw new RangeError(`unknown voice engine kind: ${String(kind)} (known: ${VOICE_ENGINE_KINDS.join(", ")}).`);
  }
  return factory(deps ?? {});
}

/**
 * engine の形を満たすか（SpeechStreamer の入口の検査用）。
 * @param {unknown} engine
 * @returns {engine is VoiceEngine}
 */
export function isVoiceEngine(engine) {
  return (
    engine != null &&
    typeof engine === "object" &&
    typeof (/** @type {any} */ (engine).synthesize) === "function" &&
    typeof (/** @type {any} */ (engine).onStatus) === "function" &&
    typeof (/** @type {any} */ (engine).dispose) === "function"
  );
}
