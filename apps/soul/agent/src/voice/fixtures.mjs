// @ts-check
/**
 * ゴールデン fixture（S1 Domain A のテスト土台）。ネットワーク非依存＝固定値。
 *
 * ── モーラ fixture の接地（実機 1 回・/synthesis なし）───────────────────
 *  AivisSpeech 実機（http://127.0.0.1:10101, engine 1.1.0-dev）の `/audio_query`
 *  （text=「こんにちは、テストです」, speaker=888753760）を **1 回だけ** 叩いて得た moras 構造
 *  をそのまま固定した（POST /audio_query のみ。/synthesis での音声生成・再生はしていない）。
 *  取得は 2026-07-12。この fixture 化により以後のテストは実機非依存で回る。
 *
 *  実機が返した事実（このデータ自体がその証拠）:
 *    - accent_phrases を平坦化した moras 列は 11 要素。prePhonemeLength=0.1, postPhonemeLength=0.1。
 *    - consonant_length / vowel_length / pitch は全零（null 含む）＝個別モーラ長は使えない（裁定2の前提）。
 *    - vowel ラベルの実形: o, N, i, i, a, pau, e, u, o, e, u。
 *      「ン」= vowel "N"（enum 外）、句読点「、」= {text:",", vowel:"pau"}（enum 外）。
 *      → この 2 つが脱落し、時間ギャップ（間）として残る。
 */

/**
 * 「こんにちは、テストです」の実機 audio_query moras（平坦化・11 要素）。
 * consonant_length/vowel_length/pitch は写像に不要なので省き、写像が使う vowel と参考の text のみ。
 * @type {ReadonlyArray<{ text: string; vowel: string }>}
 */
export const GOLDEN_MORAS_KONNICHIWA = Object.freeze([
  { text: "コ", vowel: "o" },
  { text: "ン", vowel: "N" }, // enum 外 → 脱落（時間ギャップ）
  { text: "ニ", vowel: "i" },
  { text: "チ", vowel: "i" },
  { text: "ワ", vowel: "a" },
  { text: ",", vowel: "pau" }, // 句読点 enum 外 → 脱落（時間ギャップ）
  { text: "テ", vowel: "e" },
  { text: "ス", vowel: "u" },
  { text: "ト", vowel: "o" },
  { text: "デ", vowel: "e" },
  { text: "ス", vowel: "u" }
].map((mora) => Object.freeze(mora)));

/**
 * 実機で 1 回得た WAV 実長の **実測一例**（s1-planning-inventory §3。data≈1.5468s、pre/post 各 0.1s）。
 *
 * ── 重要（裁定3・合成尺は決定論でない）───────────────────────────────────
 *  AivisSpeech の /synthesis 合成尺は**実行毎に変動する**。同テキスト・同話者でも、ライブ実測で
 *  2.1389s / 2.1156s / 2.1272s と、この 1.5468s とは異なる値が観測されている（engine の既定
 *  speedScale やバージョン差の可能性・S1 スコープ外）。したがって発話の写像パイプラインは
 *  **常に WAV 実長（wavDurationSec の返り）に追従**して timeline を組むこと。特定の秒数を
 *  ハードコードしてはならない。
 *
 *  この定数の存在意義は「ネットワーク非依存の固定テスト土台」— 実機を叩かずに buildSpeechTimeline
 *  の golden 出力を決定論的に再現するための固定値であって、ライブ合成尺の予測値ではない。
 *  この値と実機ライブ値が乖離しても異常ではない（＝裁定3 の事実）。
 */
export const GOLDEN_KONNICHIWA_WAV_DURATION_SEC = 1.5468;
export const GOLDEN_PRE_PHONEME_SEC = 0.1;
export const GOLDEN_POST_PHONEME_SEC = 0.1;

/** AivisSpeech /synthesis の PCM 形式（RIFF/WAVE mono 44100Hz 16bit）。 */
export const AIVIS_SAMPLE_RATE = 44100;
export const AIVIS_CHANNELS = 1;
export const AIVIS_BITS_PER_SAMPLE = 16;
export const AIVIS_BYTE_RATE =
  AIVIS_SAMPLE_RATE * AIVIS_CHANNELS * (AIVIS_BITS_PER_SAMPLE / 8); // 88200

/**
 * 既知構造の WAV バイト列を手で組む（テスト用・音声データは 0 埋めでよい／省略可）。
 * canonical 44 byte ヘッダ（RIFF + fmt(16) + data）に、宣言 data サイズ dataBytes を書く。
 * includeBody=false のときは data 本体を付けず、パーサが宣言サイズを使うことを検証できる。
 *
 * @param {object} [opts]
 * @param {number} [opts.dataBytes=88200]  data チャンクの宣言サイズ（byte）。
 * @param {number} [opts.sampleRate=44100]
 * @param {number} [opts.channels=1]
 * @param {number} [opts.bitsPerSample=16]
 * @param {boolean} [opts.includeBody=false]  true なら dataBytes 分の 0 本体を実際に付ける。
 * @param {boolean} [opts.zeroByteRate=false] true なら fmt の byteRate を 0 にする（代替経路の検証）。
 * @returns {Uint8Array}
 */
export function buildWavBytes(opts = {}) {
  const dataBytes = opts.dataBytes ?? 88200;
  const sampleRate = opts.sampleRate ?? 44100;
  const channels = opts.channels ?? 1;
  const bitsPerSample = opts.bitsPerSample ?? 16;
  const includeBody = opts.includeBody ?? false;
  const zeroByteRate = opts.zeroByteRate ?? false;

  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = zeroByteRate ? 0 : sampleRate * blockAlign;

  const bodyLen = includeBody ? dataBytes : 0;
  const totalLen = 44 + bodyLen;
  const buffer = new ArrayBuffer(totalLen);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      bytes[offset + i] = text.charCodeAt(i);
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true); // RIFF chunk size（本パーサは信頼しない値）
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audioFormat = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true); // data chunk 宣言サイズ

  return bytes;
}
