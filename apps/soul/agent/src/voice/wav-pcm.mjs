// @ts-check
/**
 * WAV から PCM 部分を取り出す純関数（声の差し替え Wave 2 Domain C）— apps/soul/agent。
 *
 * 流し込みプレイヤー（stream-player.mjs）は PCM16LE を受けて鳴らす。AivisSpeech の `/synthesis` は
 * RIFF/WAVE（リニア PCM）を返すので、ヘッダからサンプルレートとチャンネル数を読み、data チャンクの
 * 中身だけを渡す（一時 WAV ファイルは作らない）。走査の仕方は wav-duration.mjs と同じ
 * （チャンクは順不同・奇数長は 1 byte パディング）。依存ゼロ・純関数。
 *
 *  - fmt の audioFormat が 1（PCM）以外、または bitsPerSample が 16 以外は throw（再生器が PCM16LE 専用）。
 *  - data チャンクがファイル末尾で切れていたら、残っている分だけを返す（size を信じて読み越さない）。
 *  - 戻りの pcm は入力のバイト列を共有する subarray（コピーしない）。
 */

const RIFF_MAGIC = 0x52494646; // "RIFF"
const WAVE_FORMAT = 0x57415645; // "WAVE"
const FMT_ID = 0x666d7420; // "fmt "
const DATA_ID = 0x64617461; // "data"
const WAVE_FORMAT_PCM = 1;

/**
 * WAV バイト列 → { sampleRate, channels, bitsPerSample, pcm }。
 * @param {Uint8Array} bytes  RIFF/WAVE PCM のバイト列。
 * @returns {{ sampleRate: number; channels: number; bitsPerSample: number; pcm: Uint8Array }}
 * @throws {TypeError|RangeError} 入力不正・マジック不一致・fmt/data 欠落・PCM16 以外。
 */
export function readWavPcm(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("readWavPcm(bytes): bytes must be a Uint8Array/Buffer.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 12) {
    throw new RangeError(`WAV too short: ${view.byteLength} bytes (need at least a 12-byte RIFF/WAVE header).`);
  }
  if (view.getUint32(0, false) !== RIFF_MAGIC) {
    throw new RangeError("not a RIFF file: missing 'RIFF' magic at offset 0.");
  }
  if (view.getUint32(8, false) !== WAVE_FORMAT) {
    throw new RangeError("not a WAVE file: missing 'WAVE' format at offset 8.");
  }

  /** @type {null | { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number }} */
  let fmt = null;
  /** @type {Uint8Array | null} */
  let pcm = null;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    const bodyOffset = offset + 8;
    if (chunkId === FMT_ID) {
      if (bodyOffset + 16 > view.byteLength) {
        throw new RangeError("fmt chunk is truncated (need >= 16 bytes of fmt body).");
      }
      fmt = {
        audioFormat: view.getUint16(bodyOffset, true),
        channels: view.getUint16(bodyOffset + 2, true),
        sampleRate: view.getUint32(bodyOffset + 4, true),
        bitsPerSample: view.getUint16(bodyOffset + 14, true)
      };
    } else if (chunkId === DATA_ID && pcm == null) {
      const end = Math.min(bodyOffset + chunkSize, bytes.byteLength);
      pcm = bytes.subarray(bodyOffset, end);
    }
    offset = bodyOffset + chunkSize + (chunkSize % 2);
  }

  if (fmt == null) throw new RangeError("WAV has no 'fmt ' chunk.");
  if (pcm == null) throw new RangeError("WAV has no 'data' chunk.");
  if (fmt.audioFormat !== WAVE_FORMAT_PCM || fmt.bitsPerSample !== 16) {
    throw new RangeError(
      `WAV must be 16-bit linear PCM; got audioFormat=${fmt.audioFormat} bitsPerSample=${fmt.bitsPerSample}.`
    );
  }
  if (!(fmt.sampleRate > 0) || !(fmt.channels > 0)) {
    throw new RangeError(`WAV has an unusable format (sampleRate=${fmt.sampleRate}, channels=${fmt.channels}).`);
  }
  return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: fmt.bitsPerSample, pcm };
}
