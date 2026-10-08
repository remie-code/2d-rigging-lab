// @ts-check
/**
 * PCM フレーム化純関数 + 常駐フレーマ（S2 Domain A）— apps/soul/agent。
 *
 * ffmpeg が stdout に流す s16le の**連続バイトストリーム**は、OS のパイプ都合で任意長の
 * チャンクに割れて届く（サンプル境界で割れる保証はない＝半端バイトが出る）。Silero VAD は
 * 16kHz で**厳密に 512 サンプル/フレーム**の固定長入力を要求するため、届いたバイト列を
 * 「フレーム境界に揃えて切り出し、半端を次チャンクへ持ち越す」層がここに要る。依存ゼロ・純関数
 * のコア（`splitFrames`）と、それを畳んだ常駐フレーマ（`createPcmFramer`）に分ける。
 *
 * ── なぜ Silero v5 @16kHz は 512 サンプル固定か ──────────────────────────
 *  v5 ONNX モデルの入力テンソルは 16kHz で [batch, 512]（32ms）を前提にする（8kHz なら 256）。
 *  フレーム長が違うと確率が意味をなさない。よって既定 frameSamples=512（silero-vad.mjs と対）。
 *
 * ── バイト→サンプルの変換 ────────────────────────────────────────────
 *  s16le バイト列 → Int16Array（`decodeInt16LE`）→ Float32 正規化 [-1,1]（`int16ToFloat32`）。
 *  VAD ラッパは Float32 フレームを食う。ここでは byte→int16→float の純変換を提供し、
 *  ONNX には一切触れない（この層は install 不要で単体テストできる）。
 */

/** Silero v5 @16kHz が要求する 1 フレームのサンプル数。 */
export const SILERO_FRAME_SAMPLES_16K = 512;
/** s16le の 1 サンプル = 2 byte。 */
export const BYTES_PER_S16_SAMPLE = 2;

/**
 * バイトストリームをフレーム境界で切り出す純関数（半端は leftover へ持ち越す）。
 *
 * @param {Uint8Array} leftover  前回持ち越した半端バイト（初回は空 Uint8Array）。
 * @param {Uint8Array} chunk     今回届いたバイト列。
 * @param {number} frameBytes    1 フレームのバイト長（frameSamples * bytesPerSample）。
 * @returns {{ frames: Uint8Array[]; leftover: Uint8Array }}
 *   frames = 各 frameBytes ちょうどのフレーム列（0 個以上）。leftover = フレームに満たない残り。
 * @throws {TypeError|RangeError} 型不正・frameBytes 非正整数。
 */
export function splitFrames(leftover, chunk, frameBytes) {
  if (!(leftover instanceof Uint8Array)) {
    throw new TypeError("splitFrames: leftover must be a Uint8Array.");
  }
  if (!(chunk instanceof Uint8Array)) {
    throw new TypeError("splitFrames: chunk must be a Uint8Array.");
  }
  if (!Number.isInteger(frameBytes) || frameBytes <= 0) {
    throw new RangeError(`splitFrames: frameBytes must be a positive integer; got ${frameBytes}.`);
  }

  // leftover + chunk を連結（連結は leftover があるときだけ＝多くのチャンクで割当を避ける）。
  /** @type {Uint8Array} */
  let buffer;
  if (leftover.length === 0) {
    buffer = chunk;
  } else {
    buffer = new Uint8Array(leftover.length + chunk.length);
    buffer.set(leftover, 0);
    buffer.set(chunk, leftover.length);
  }

  const frameCount = Math.floor(buffer.length / frameBytes);
  /** @type {Uint8Array[]} */
  const frames = [];
  for (let i = 0; i < frameCount; i += 1) {
    // slice でコピーを返す（呼び出し側が保持しても後続 buffer と共有しない）。
    frames.push(buffer.slice(i * frameBytes, (i + 1) * frameBytes));
  }
  const consumed = frameCount * frameBytes;
  const rest = buffer.subarray(consumed);
  // leftover はコピーで返す（内部 buffer の使い回しから切り離す）。
  const nextLeftover = rest.length === 0 ? EMPTY : rest.slice();
  return { frames, leftover: nextLeftover };
}

const EMPTY = new Uint8Array(0);

/**
 * s16le バイト列 → Int16Array（サンプル列）。長さは偶数であること。
 * @param {Uint8Array} bytes
 * @returns {Int16Array}
 * @throws {RangeError} 奇数長（半端サンプル）。
 */
export function decodeInt16LE(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("decodeInt16LE: bytes must be a Uint8Array.");
  }
  if (bytes.length % 2 !== 0) {
    throw new RangeError(`decodeInt16LE: byte length ${bytes.length} is odd (partial sample).`);
  }
  const out = new Int16Array(bytes.length / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = view.getInt16(i * 2, true); // little-endian
  }
  return out;
}

/**
 * Int16 サンプル列 → Float32 正規化 [-1,1)。VAD 入力用。
 * s16 の最小値 -32768 は -1.0 に、最大 32767 は ≈0.99997 に写す（/32768）。
 * @param {Int16Array} samples
 * @returns {Float32Array}
 */
export function int16ToFloat32(samples) {
  if (!(samples instanceof Int16Array)) {
    throw new TypeError("int16ToFloat32: samples must be an Int16Array.");
  }
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = samples[i] / 32768;
  }
  return out;
}

/**
 * 常駐 PCM フレーマ。ffmpeg stdout の 'data' チャンクを push すると、確定した固定長フレームを
 * Int16Array 列で返す（半端バイトは内部に持ち越す）。純関数 `splitFrames` を状態で畳んだ薄い層。
 *
 * @param {object} [options]
 * @param {number} [options.frameSamples=512]     1 フレームのサンプル数（既定 Silero v5 @16kHz）。
 * @param {number} [options.bytesPerSample=2]     1 サンプルのバイト数（既定 s16le = 2）。
 * @returns {{
 *   frameBytes: number;
 *   push: (chunk: Uint8Array) => Int16Array[];
 *   leftoverBytes: () => number;
 *   reset: () => void;
 * }}
 */
export function createPcmFramer(options = {}) {
  const frameSamples = options.frameSamples ?? SILERO_FRAME_SAMPLES_16K;
  const bytesPerSample = options.bytesPerSample ?? BYTES_PER_S16_SAMPLE;
  if (!Number.isInteger(frameSamples) || frameSamples <= 0) {
    throw new RangeError(`createPcmFramer: frameSamples must be a positive integer; got ${frameSamples}.`);
  }
  if (!Number.isInteger(bytesPerSample) || bytesPerSample <= 0) {
    throw new RangeError(`createPcmFramer: bytesPerSample must be a positive integer; got ${bytesPerSample}.`);
  }
  const frameBytes = frameSamples * bytesPerSample;

  let leftover = EMPTY;

  return {
    frameBytes,
    /**
     * バイトチャンクを投入し、確定したフレーム（Int16Array）列を返す。
     * @param {Uint8Array} chunk
     * @returns {Int16Array[]}
     */
    push(chunk) {
      const { frames, leftover: next } = splitFrames(leftover, chunk, frameBytes);
      leftover = next;
      return frames.map((f) => decodeInt16LE(f));
    },
    /** 現在持ち越している半端バイト数（テスト観測用）。 */
    leftoverBytes() {
      return leftover.length;
    },
    /** 内部バッファを捨てる（ffmpeg 再起動時などに呼ぶ）。 */
    reset() {
      leftover = EMPTY;
    }
  };
}
