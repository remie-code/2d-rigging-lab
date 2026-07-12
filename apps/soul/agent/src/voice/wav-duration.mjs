// @ts-check
/**
 * WAV ヘッダパーサ純関数（S1 Domain A）— apps/soul/agent。
 *
 * AivisSpeech `/synthesis` 出力（RIFF/WAVE リニア PCM mono 44100Hz 16bit）のバイト列から
 * 実秒を求める。個別モーラ長が全零な実機事実（s1-planning-inventory §3）の下、モーラ写像に
 * 与えられる唯一の時間材料が「合成 WAV の実長」なので、その抽出をここに閉じる。依存ゼロ・純関数。
 *
 * ── RIFF/WAVE 構造 ─────────────────────────────────────────────────
 *  - offset 0..3   : "RIFF"（マジック。不一致は throw）
 *  - offset 4..7   : RIFF chunk サイズ（LE。本パーサは信頼せず走査で data を探す）
 *  - offset 8..11  : "WAVE"（フォーマット。不一致は throw）
 *  - offset 12..   : サブチャンク列。各チャンク = 4byte id + 4byte size(LE) + data(size byte)。
 *                    data が奇数長なら 1 byte のパディングが続く（size には含まれない）。
 *                    チャンクは順不同（fmt と data の前後関係を仮定しない）。
 *
 * ── 実秒の導出 ─────────────────────────────────────────────────────
 *  realSeconds = dataChunkBytes / byteRate。
 *  byteRate は fmt チャンクの byteRate フィールドを優先し、0 や欠落時は
 *  sampleRate * blockAlign（= sampleRate * channels * bitsPerSample/8）で代替する。
 *  data / fmt が無い、マジック不一致、byteRate=0 は throw（不正ヘッダ）。
 */

const RIFF_MAGIC = 0x52494646; // "RIFF"（ビッグエンディアン読みでの 4 文字コード）
const WAVE_FORMAT = 0x57415645; // "WAVE"
const FMT_ID = 0x666d7420; // "fmt "
const DATA_ID = 0x64617461; // "data"

/**
 * 入力を DataView に正規化する（Uint8Array / Buffer / ArrayBuffer を受ける）。
 * @param {Uint8Array | ArrayBuffer} bytes
 * @returns {DataView}
 */
function toDataView(bytes) {
  if (bytes instanceof ArrayBuffer) {
    return new DataView(bytes);
  }
  if (ArrayBuffer.isView(bytes)) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  throw new TypeError("wav bytes must be a Uint8Array/Buffer or ArrayBuffer.");
}

/**
 * WAV バイト列 → 実秒。
 * @param {Uint8Array | ArrayBuffer} bytes  RIFF/WAVE PCM のバイト列。
 * @returns {number} data チャンク長 / byteRate（秒）。
 * @throws {RangeError|TypeError} マジック不一致・fmt/data 欠落・byteRate=0・ヘッダ切り詰め。
 */
export function wavDurationSec(bytes) {
  const view = toDataView(bytes);
  if (view.byteLength < 12) {
    throw new RangeError(
      `WAV too short: ${view.byteLength} bytes (need at least a 12-byte RIFF/WAVE header).`
    );
  }
  if (view.getUint32(0, false) !== RIFF_MAGIC) {
    throw new RangeError("not a RIFF file: missing 'RIFF' magic at offset 0.");
  }
  if (view.getUint32(8, false) !== WAVE_FORMAT) {
    throw new RangeError("not a WAVE file: missing 'WAVE' format at offset 8.");
  }

  /** @type {number | null} */
  let byteRate = null;
  /** @type {number | null} */
  let sampleRate = null;
  /** @type {number | null} */
  let blockAlign = null;
  /** @type {number | null} */
  let dataBytes = null;

  // サブチャンク走査（offset 12 から。各チャンクヘッダは 8 byte）。
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    const bodyOffset = offset + 8;

    if (chunkId === FMT_ID) {
      if (bodyOffset + 16 > view.byteLength) {
        throw new RangeError("fmt chunk is truncated (need >= 16 bytes of fmt body).");
      }
      // fmt: audioFormat(2), channels(2), sampleRate(4), byteRate(4), blockAlign(2), bits(2)
      sampleRate = view.getUint32(bodyOffset + 4, true);
      byteRate = view.getUint32(bodyOffset + 8, true);
      blockAlign = view.getUint16(bodyOffset + 12, true);
    } else if (chunkId === DATA_ID) {
      dataBytes = chunkSize;
    }

    // 次チャンクへ。奇数サイズは 1 byte パディングを跨ぐ（size には含まれない）。
    const advance = chunkSize + (chunkSize % 2);
    offset = bodyOffset + advance;
  }

  if (dataBytes === null) {
    throw new RangeError("WAV has no 'data' chunk.");
  }
  // byteRate フィールド優先。0/欠落なら sampleRate * blockAlign で代替。
  let effectiveByteRate = byteRate ?? 0;
  if (!(effectiveByteRate > 0)) {
    if (sampleRate !== null && blockAlign !== null && sampleRate > 0 && blockAlign > 0) {
      effectiveByteRate = sampleRate * blockAlign;
    }
  }
  if (!(effectiveByteRate > 0)) {
    throw new RangeError(
      "WAV has no usable byteRate (fmt chunk missing or byteRate/sampleRate*blockAlign = 0)."
    );
  }

  return dataBytes / effectiveByteRate;
}
