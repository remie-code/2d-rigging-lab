// @ts-check
/**
 * 発話同期オーケストレーション（S1 Domain B）— apps/soul/agent。一文 → 口 + 声。
 *
 * 一文を受け取り、TTS で声を合成しつつ器へ口の動き（intent.speech timeline）を送り、両者を
 * 同期して開始させる。S1 の歩くスケルトンの縦串の一区間（Domain C の LLM 応答文 → ここ →
 * 器の口 + スピーカー）。
 *
 * ── パイプライン ───────────────────────────────────────────────────────
 *   1. `/audio_query` で moras 平坦化列 + prePhonemeSec/postPhonemeSec を得る（tts-client）。
 *   2. `/synthesis` で WAV バイト列を得る。
 *   3. `wavDurationSec(wav)` で WAV 実長を測る（Domain A 純関数の再利用）。
 *   4. `buildSpeechTimeline(moras, wavSec, pre, post, sConfig)` で timeline を組む
 *      （Domain A 純関数の再利用。timeMs は WAV 実時間軸・先頭無音 pre 込み）。
 *   5. WAV を temp ファイルに書き出しておく（再生を最速化するため送出前に準備）。
 *   6. channel へ intent.speech を送る。
 *   7. **accepted を受けた瞬間に player.play(wavPath)** — 器の口が動き始めた t=0 に声を合わせる。
 *      WAV 先頭 0.1s の無音が器の口の立ち上がり（attack）と概ね相殺する（同期方式・§3 Domain B）。
 *
 * ── 失敗の扱い ─────────────────────────────────────────────────────────
 *   - rejected: throw（呼び出し側が拾う）。接続は閉じない（維持したまま次の一文を試せる）。
 *   - timeline 512 超: buildSpeechTimeline がそのまま throw（S1 は文分割しない・裁定4）。
 */

import { wavDurationSec } from "./wav-duration.mjs";
import { buildSpeechTimeline } from "./mora-timeline.mjs";
import { parseAudioQuery, createTtsClient } from "./tts-client.mjs";
import { writeTempWav } from "./audio-player.mjs";

/**
 * 一文を喋る（口 + 声を同期開始する）。
 *
 * @param {string} text  合成・発話する一文。
 * @param {object} deps
 * @param {{ sendSpeech: (timeline: unknown) => Promise<{ result: string; error: unknown; rttMs: number }> }} deps.channel
 *   接続済みチャネル（connectChannel の返り）。
 * @param {{ play: (wavPath: string) => void }} deps.player  常駐プレイヤー（createAudioPlayer の返り）。
 * @param {{ audioQuery: (text: string) => Promise<any>; synthesis: (query: any) => Promise<Uint8Array> }} [deps.tts]
 *   TTS クライアント。省略時は ttsBaseUrl/speaker から生成。
 * @param {string} [deps.ttsBaseUrl]  tts 省略時のベース URL。
 * @param {number|string} [deps.speaker]  tts 省略時の話者 ID。
 * @param {undefined | { vowelMap?: Record<string, number> }} [deps.sConfig]  母音別 s の差し替え。
 * @param {(bytes: Uint8Array) => string} [deps.writeWav]  WAV → temp パス（テスト差し替え用）。既定 writeTempWav。
 * @returns {Promise<{
 *   timeline: Array<{ timeMs: number; vowel: string; s: number }>;
 *   wavDurationSec: number;
 *   wavPath: string;
 *   rttMs: number;
 * }>}
 * @throws {Error} rejected（接続は維持）/ timeline 過大 / TTS・合成の失敗。
 */
export async function speak(text, deps) {
  if (typeof text !== "string" || text.length === 0) {
    throw new TypeError("speak(text): text must be a non-empty string.");
  }
  if (deps == null || typeof deps !== "object") {
    throw new TypeError("speak(text, deps): deps is required.");
  }
  const { channel, player, sConfig } = deps;
  if (!channel || typeof channel.sendSpeech !== "function") {
    throw new TypeError("deps.channel with sendSpeech() is required.");
  }
  if (!player || typeof player.play !== "function") {
    throw new TypeError("deps.player with play() is required.");
  }
  const tts =
    deps.tts ??
    createTtsClient({ baseUrl: deps.ttsBaseUrl, speaker: deps.speaker });
  const writeWav = deps.writeWav ?? writeTempWav;

  // 1. audio_query → moras 平坦化 + pre/post 無音秒。
  const query = await tts.audioQuery(text);
  const { moras, prePhonemeSec, postPhonemeSec } = parseAudioQuery(query);

  // 2. synthesis → WAV バイト列。
  const wav = await tts.synthesis(query);

  // 3. WAV 実長。
  const wavSec = wavDurationSec(wav);

  // 4. timeline（WAV 実時間軸・pre 込み）。512 超はここで throw（伝播）。
  const { timeline } = buildSpeechTimeline(
    moras,
    wavSec,
    prePhonemeSec,
    postPhonemeSec,
    sConfig
  );

  // 5. WAV を temp に書き出しておく（accepted 直後の play を最速化）。
  const wavPath = writeWav(wav);

  // 6. intent.speech を送出。
  const outcome = await channel.sendSpeech(timeline);

  // 7. accepted → 即再生。rejected は throw（接続は維持）。
  if (outcome.result !== "accepted") {
    const detail =
      outcome.error && typeof outcome.error === "object"
        ? `${/** @type {any} */ (outcome.error).code ?? "unknown"}: ${
            /** @type {any} */ (outcome.error).message ?? ""
          }`
        : String(outcome.error ?? outcome.result);
    throw new Error(`intent.speech rejected: ${detail}`);
  }
  player.play(wavPath);

  return { timeline, wavDurationSec: wavSec, wavPath, rttMs: outcome.rttMs };
}
