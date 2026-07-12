// @ts-check
/**
 * 合成音声 fixture（S2 Domain A のテスト土台）— apps/soul/agent。
 *
 * 実マイク・実 WAV を一切使わず、決定論的な合成 PCM（正弦波 + 無音）でエンコーダ／フレーマ／
 * セグメンタの境界を固定する（S2 計画 §4 プライバシー: 録音物をテストに使わない）。すべて
 * in-memory で、ディスクにも成果物にも音声を残さない。S1 の `fixtures.mjs` は不変のまま、S2 用は
 * この別ファイルに置く。
 */

/** 魂の耳の PCM 形式（16kHz mono s16le）。 */
export const EARS_SAMPLE_RATE = 16000;
export const EARS_CHANNELS = 1;
export const EARS_BITS_PER_SAMPLE = 16;

/**
 * 正弦波 PCM を Int16Array で生成する（発話に見立てた「音がある」区間）。
 * @param {object} [opts]
 * @param {number} [opts.freq=440]        周波数 Hz。
 * @param {number} [opts.durationMs=100]  長さ ms。
 * @param {number} [opts.sampleRate=16000]
 * @param {number} [opts.amplitude=0.6]   振幅 [0,1]（s16 フルスケール比）。
 * @returns {Int16Array}
 */
export function sinePcm(opts = {}) {
  const freq = opts.freq ?? 440;
  const durationMs = opts.durationMs ?? 100;
  const sampleRate = opts.sampleRate ?? EARS_SAMPLE_RATE;
  const amplitude = opts.amplitude ?? 0.6;
  const n = Math.round((durationMs / 1000) * sampleRate);
  const out = new Int16Array(n);
  const peak = Math.round(amplitude * 32767);
  for (let i = 0; i < n; i += 1) {
    out[i] = Math.round(peak * Math.sin((2 * Math.PI * freq * i) / sampleRate));
  }
  return out;
}

/**
 * 無音 PCM（全ゼロ）を Int16Array で生成する（「音がない」区間）。
 * @param {object} [opts]
 * @param {number} [opts.durationMs=100]
 * @param {number} [opts.sampleRate=16000]
 * @returns {Int16Array}
 */
export function silencePcm(opts = {}) {
  const durationMs = opts.durationMs ?? 100;
  const sampleRate = opts.sampleRate ?? EARS_SAMPLE_RATE;
  const n = Math.round((durationMs / 1000) * sampleRate);
  return new Int16Array(n);
}

/**
 * 複数の Int16Array を連結する。
 * @param {...Int16Array} chunks
 * @returns {Int16Array}
 */
export function concatInt16(...chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Int16Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Int16Array → s16le バイト列（Uint8Array）。ffmpeg stdout のバイトストリーム模擬に使う。
 * @param {Int16Array} samples
 * @returns {Uint8Array}
 */
export function int16ToBytesLE(samples) {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(i * 2, samples[i], true);
  }
  return out;
}

/**
 * 発話確率の矩形列を作る（無音 lo → 発話 hi → 無音 lo …）。セグメンタ fixture 用。
 * 各セグメントは `{ n, p }`（フレーム数 n、確率 p）で与える。
 * @param {Array<{ n: number; p: number }>} segments
 * @returns {number[]}
 */
export function probSequence(segments) {
  /** @type {number[]} */
  const out = [];
  for (const seg of segments) {
    for (let i = 0; i < seg.n; i += 1) out.push(seg.p);
  }
  return out;
}
