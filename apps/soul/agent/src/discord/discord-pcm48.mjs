// @ts-check
/**
 * 声の PCM を Discord の Raw（48kHz・ステレオ・s16le）に変える（Discord モード Domain E・discord-mode.md §7.2）— apps/soul/agent。
 *
 * @discordjs/voice の `StreamType.Raw` は 48kHz・2ch・s16le の PCM を前提に Opus へエンコードする（サンプルレートを渡す口が無い。
 * 変換を忘れると速く高い声になる。外部 §1.1）。声の engine の形（open の `{ sampleRate, channels }`）に従って変える。
 *
 *  - 48kHz: そのまま（モノラルは左右に同じ値）。
 *  - 48kHz の整数分の 1（24kHz = ElevenLabs の pcm_24000・16kHz・12kHz・8kHz）: 各サンプルを整数倍の回数だけ繰り返し、
 *    左右に同じ値で書く（24kHz なら 2 回。外部で実測した形）。
 *  - それ以外（44.1kHz = AivisSpeech の WAV など）: 線形の補間。出力の n 番目は入力の位置 n × 入力のレート / 48000。
 *
 * **状態を持つ**（チャンクの境目をまたいでも途切れ・ずれが出ない）:
 *  - 1 フレーム（モノラル 2 バイト・ステレオ 4 バイト）に満たない端数のバイトは次のチャンクへ持ち越す（奇数バイトのチャンクも可）。
 *  - 線形の補間は、入力の通し番号と出力の通し番号を整数で持ち（位置 = 出力の番号 × 入力のレート ÷ 48000）、直前のチャンクの最後の
 *    フレームを覚えて境目の補間に使う。誤差が積もらない（浮動小数で位置を足していかない）。
 *  - flush（end）で、まだ出していない分を最後のフレームで埋めて出し、出力の合計を 20ms（3840 バイト）の倍数まで無音で埋める
 *    （prism-media の Encoder は 1 フレームに満たない端数を捨てるため・最大 19ms の尻切れを防ぐ）。
 *
 * 新しい依存（ffmpeg など）は使わない。
 */

/** Discord の Raw のサンプルレート。 */
export const DISCORD_PCM_SAMPLE_RATE = 48000;
/** Discord の Raw のチャンネル数。 */
export const DISCORD_PCM_CHANNELS = 2;
/** Discord の 1 フレーム（20ms・48kHz・ステレオ・16bit）のバイト数。 */
export const DISCORD_PCM_FRAME_BYTES = (DISCORD_PCM_SAMPLE_RATE / 1000) * 20 * DISCORD_PCM_CHANNELS * 2;

/** @param {number} v */
function clamp16(v) {
  return v > 32767 ? 32767 : v < -32768 ? -32768 : v;
}

/**
 * 1 本の発話の変換器（発話ごとに作る）。
 * @param {{ sampleRate: number; channels: number }} format
 * @returns {{ push: (pcm: Uint8Array) => Buffer; flush: () => Buffer; readonly mode: "copy" | "repeat" | "linear"; readonly outputBytes: number }}
 */
export function createPcm48kStereoConverter(format) {
  const sampleRate = format?.sampleRate;
  const channels = format?.channels;
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new RangeError("createPcm48kStereoConverter: sampleRate must be an integer in 8000..192000.");
  }
  if (channels !== 1 && channels !== 2) {
    throw new RangeError("createPcm48kStereoConverter: channels must be 1 or 2.");
  }
  const inFrameBytes = channels * 2;
  /** @type {"copy" | "repeat" | "linear"} */
  const mode =
    sampleRate === DISCORD_PCM_SAMPLE_RATE
      ? "copy"
      : sampleRate < DISCORD_PCM_SAMPLE_RATE && DISCORD_PCM_SAMPLE_RATE % sampleRate === 0
        ? "repeat"
        : "linear";
  const factor = mode === "repeat" ? DISCORD_PCM_SAMPLE_RATE / sampleRate : 1;

  /** 1 フレームに満たない端数（次のチャンクの頭に足す）。 */
  let carry = Buffer.alloc(0);
  let outputBytes = 0;
  let flushed = false;
  // 線形の補間の状態: 受け取った入力のフレーム数・出した出力のフレーム数・最後に受け取った入力のフレーム（左右）。
  let inCount = 0;
  let outCount = 0;
  let lastL = 0;
  let lastR = 0;

  /**
   * 端数を足して、フレームに揃った部分と次へ持ち越す端数に分ける。
   * @param {Uint8Array} pcm
   */
  const takeFrames = (pcm) => {
    const incoming = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const all = carry.length > 0 ? Buffer.concat([carry, incoming]) : incoming;
    const usable = all.length - (all.length % inFrameBytes);
    // 持ち越す端数は写しておく（呼び出し側が渡した配列を後で書き換えても影響を受けない）。
    carry = Buffer.from(all.subarray(usable));
    return all.subarray(0, usable);
  };

  /** @param {Buffer} frames @param {number} i @param {number} ch */
  const sampleAt = (frames, i, ch) => frames.readInt16LE(i * inFrameBytes + (channels === 2 ? ch * 2 : 0));

  /** @param {Buffer} frames */
  const convertCopyOrRepeat = (frames) => {
    const count = frames.length / inFrameBytes;
    const out = Buffer.allocUnsafe(count * factor * 4);
    let o = 0;
    for (let i = 0; i < count; i += 1) {
      const l = sampleAt(frames, i, 0);
      const r = channels === 2 ? sampleAt(frames, i, 1) : l;
      for (let k = 0; k < factor; k += 1) {
        out.writeInt16LE(l, o);
        out.writeInt16LE(r, o + 2);
        o += 4;
      }
    }
    return out;
  };

  /**
   * 線形の補間（出力 n の位置 = n × sampleRate / 48000。整数 i と端数 frac に分ける）。
   * @param {Buffer} frames  新しく受け取った入力（フレームに揃っている）。
   * @param {boolean} final  最後（次のフレームが無い所は最後のフレームで埋める）。
   */
  const convertLinear = (frames, final) => {
    const count = frames.length / inFrameBytes;
    const base = inCount; // このチャンクの最初のフレームの通し番号（base - 1 は lastL / lastR）。
    const total = inCount + count;
    /** @param {number} idx @param {number} ch */
    const at = (idx, ch) => {
      if (idx < base) return ch === 0 ? lastL : lastR;
      return sampleAt(frames, idx - base, channels === 2 ? ch : 0);
    };
    /** @type {number[]} */
    const values = [];
    for (;;) {
      const scaled = outCount * sampleRate;
      const i = Math.floor(scaled / DISCORD_PCM_SAMPLE_RATE);
      if (final ? i >= total : i + 1 >= total) break;
      const frac = (scaled - i * DISCORD_PCM_SAMPLE_RATE) / DISCORD_PCM_SAMPLE_RATE;
      const next = i + 1 < total ? i + 1 : i;
      for (let ch = 0; ch < 2; ch += 1) {
        const a = at(i, ch);
        const b = at(next, ch);
        values.push(clamp16(Math.round(a + (b - a) * frac)));
      }
      outCount += 1;
    }
    if (count > 0) {
      lastL = sampleAt(frames, count - 1, 0);
      lastR = channels === 2 ? sampleAt(frames, count - 1, 1) : lastL;
    }
    inCount = total;
    const out = Buffer.allocUnsafe(values.length * 2);
    for (let k = 0; k < values.length; k += 1) out.writeInt16LE(values[k], k * 2);
    return out;
  };

  return {
    mode,
    get outputBytes() {
      return outputBytes;
    },
    push(pcm) {
      if (flushed) throw new Error("createPcm48kStereoConverter: already flushed.");
      if (!(pcm instanceof Uint8Array)) throw new TypeError("push(pcm): pcm must be a Uint8Array.");
      const frames = takeFrames(pcm);
      const out = mode === "linear" ? convertLinear(frames, false) : convertCopyOrRepeat(frames);
      outputBytes += out.length;
      return out;
    },
    flush() {
      if (flushed) return Buffer.alloc(0);
      flushed = true;
      // 1 フレームに満たない端数（壊れた尻）は捨てる。
      carry = Buffer.alloc(0);
      const rest = mode === "linear" && inCount > 0 ? convertLinear(Buffer.alloc(0), true) : Buffer.alloc(0);
      const total = outputBytes + rest.length;
      const pad = total > 0 && total % DISCORD_PCM_FRAME_BYTES !== 0 ? DISCORD_PCM_FRAME_BYTES - (total % DISCORD_PCM_FRAME_BYTES) : 0;
      const out = pad > 0 ? Buffer.concat([rest, Buffer.alloc(pad)]) : rest;
      outputBytes += out.length;
      return out;
    }
  };
}
