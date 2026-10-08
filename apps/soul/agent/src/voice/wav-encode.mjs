// @ts-check
/**
 * WAV エンコーダ純関数（S2 Domain A）— apps/soul/agent。
 *
 * 発話セグメント単位の PCM（ffmpeg が吐く 16kHz mono s16le）を RIFF/WAVE バイト列に組み、
 * whisper-server `/inference` へ POST する発話 WAV を作るための純関数。`wav-duration.mjs` の
 * ちょうど逆写像で、依存ゼロ・I/O なし・決定論。
 *
 * ── 設計（wav-duration.mjs と対称）─────────────────────────────────────
 *  canonical 44 byte ヘッダ（RIFF + fmt(16, PCM) + data）に PCM 本体を続ける最小構成。
 *  wav-duration.mjs はチャンク順不同・未知チャンク・奇数パディングまで許容する寛容パーサだが、
 *  こちらは「魂が書き出す側」なので最も素直な canonical 形だけを出す（読む相手＝whisper-server /
 *  wav-duration の双方が受ける形）。
 *
 * ── ラウンドトリップ不変条件（テストで固定）──────────────────────────────
 *  encodeWav(pcm, {sampleRate, channels, bitsPerSample}) を wavDurationSec に通すと、
 *  尺 = (サンプル数 / channels) / sampleRate が復元される（byteRate = sampleRate*channels*bytesPerSample）。
 *
 * ── 入力形式 ───────────────────────────────────────────────────────
 *  - Int16Array: s16 サンプル列（各要素を LE 16bit で書く）。bitsPerSample は 16 固定。
 *  - Uint8Array: 既に s16le 等にシリアライズ済みの生バイト列（そのまま data 本体に載せる）。
 *    このとき length は blockAlign の倍数であること（半端サンプルは throw）。
 */

const HEADER_BYTES = 44;

/**
 * PCM → RIFF/WAVE バイト列。
 *
 * @param {Int16Array | Uint8Array} pcm  PCM サンプル（Int16Array）または生 s16le バイト列（Uint8Array）。
 * @param {object} [options]
 * @param {number} [options.sampleRate=16000]  サンプリング周波数（既定 16kHz = whisper/VAD 入力）。
 * @param {number} [options.channels=1]         チャンネル数（既定 mono）。
 * @param {number} [options.bitsPerSample=16]   量子化ビット数（既定 16bit）。Int16Array 入力では 16 のみ。
 * @returns {Uint8Array}  RIFF/WAVE リニア PCM のバイト列（44 byte ヘッダ + data 本体）。
 * @throws {TypeError|RangeError} 型不正・パラメータ非正・データ長が blockAlign 非倍数。
 */
export function encodeWav(pcm, options = {}) {
  const sampleRate = options.sampleRate ?? 16000;
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;

  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`encodeWav: sampleRate must be a positive integer; got ${sampleRate}.`);
  }
  if (!Number.isInteger(channels) || channels <= 0) {
    throw new RangeError(`encodeWav: channels must be a positive integer; got ${channels}.`);
  }
  if (!Number.isInteger(bitsPerSample) || bitsPerSample <= 0 || bitsPerSample % 8 !== 0) {
    throw new RangeError(
      `encodeWav: bitsPerSample must be a positive multiple of 8; got ${bitsPerSample}.`
    );
  }

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  // data 本体バイト列を作る。
  /** @type {Uint8Array} */
  let dataBytes;
  if (pcm instanceof Int16Array) {
    if (bitsPerSample !== 16) {
      throw new TypeError(
        `encodeWav: Int16Array input requires bitsPerSample=16; got ${bitsPerSample}.`
      );
    }
    dataBytes = new Uint8Array(pcm.length * 2);
    const view = new DataView(dataBytes.buffer);
    for (let i = 0; i < pcm.length; i += 1) {
      view.setInt16(i * 2, pcm[i], true); // little-endian
    }
  } else if (pcm instanceof Uint8Array) {
    if (pcm.length % blockAlign !== 0) {
      throw new RangeError(
        `encodeWav: byte length ${pcm.length} is not a multiple of blockAlign ${blockAlign}.`
      );
    }
    dataBytes = pcm;
  } else {
    throw new TypeError("encodeWav: pcm must be an Int16Array or Uint8Array.");
  }

  const dataLen = dataBytes.length;
  const out = new Uint8Array(HEADER_BYTES + dataLen);
  const view = new DataView(out.buffer);

  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      out[offset + i] = text.charCodeAt(i);
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true); // RIFF chunk size = 4 + (8 + 16) + (8 + dataLen)
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size（PCM）
  view.setUint16(20, 1, true); // audioFormat = 1（linear PCM）
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, dataLen, true);
  out.set(dataBytes, HEADER_BYTES);

  return out;
}
