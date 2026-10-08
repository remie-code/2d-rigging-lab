// @ts-check
/**
 * PCM リングバッファ（S2 Domain C・耳パイプラインの記憶層）— apps/soul/agent。
 *
 * ffmpeg → フレーマから流れてくる PCM サンプルを**直近 capacityMs 分だけ**保持し、
 * セグメンタの `speechEnd.{startMs, endMs}` が指すストリーム時刻範囲を切り出す。
 * 依存ゼロ・I/O ゼロの純ロジック（fixture テスト対象）。
 *
 * ── ストリーム時刻の定義 ─────────────────────────────────────────────
 *  書き込んだ総サンプル数がそのままストリーム時計（tMs = totalSamples / sampleRate * 1000）。
 *  セグメンタに与える各フレームの tMs も同じサンプル数由来なので、両者の時間軸は定義から一致する
 *  （壁時計を混ぜない＝ズレない）。
 *
 * ── clamp（wave 計画 §3 Domain C 設計注記・domain-a-review note 1）──────────────
 *  セグメンタの speechEnd.endMs は flush 時に speechPadMs 分だけ実データ末尾を超え、
 *  maxSpeech 分割では隣接セグメントが 2×pad 重なる（いずれも意図された純関数契約）。
 *  さらに容量超過で古いデータは破棄済みかもしれない。よって `slice()` は要求範囲を
 *  **[保持窓の先頭, 実データ末尾]** に必ず clamp し、実際に切り出せた範囲を返す。
 */

/**
 * @param {object} [options]
 * @param {number} [options.capacityMs=40000]  保持する直近の長さ（ms）。maxSpeech(20s)+pad+余裕。
 * @param {number} [options.sampleRate=16000]
 * @returns {{
 *   write: (samples: Int16Array) => void;
 *   slice: (range: { startMs: number; endMs: number }) => { samples: Int16Array; startMs: number; endMs: number; clamped: boolean };
 *   totalMs: () => number;
 *   oldestMs: () => number;
 *   capacitySamples: number;
 *   reset: () => void;
 * }}
 */
export function createPcmRingBuffer(options = {}) {
  const capacityMs = options.capacityMs ?? 40000;
  const sampleRate = options.sampleRate ?? 16000;
  if (!(Number.isFinite(capacityMs) && capacityMs > 0)) {
    throw new RangeError(`createPcmRingBuffer: capacityMs must be > 0; got ${capacityMs}.`);
  }
  if (!(Number.isInteger(sampleRate) && sampleRate > 0)) {
    throw new RangeError(`createPcmRingBuffer: sampleRate must be a positive integer; got ${sampleRate}.`);
  }
  const capacity = Math.max(1, Math.round((capacityMs / 1000) * sampleRate));
  /** 循環バッファ本体。絶対サンプル位置 p のデータは ring[p % capacity]。 */
  const ring = new Int16Array(capacity);
  /** これまでに書き込んだ総サンプル数（= ストリーム末尾の絶対サンプル位置）。 */
  let total = 0;

  const msToSample = (ms) => Math.round((ms / 1000) * sampleRate);
  const sampleToMs = (sample) => (sample / sampleRate) * 1000;

  return {
    capacitySamples: capacity,

    /**
     * サンプル列を末尾に追記する（容量超過分は最古から破棄）。
     * @param {Int16Array} samples
     */
    write(samples) {
      if (!(samples instanceof Int16Array)) {
        throw new TypeError("pcmRingBuffer.write: samples must be an Int16Array.");
      }
      let src = samples;
      // 1 回の書き込みが容量を超えるなら末尾 capacity 分だけ残す。
      if (src.length > capacity) {
        total += src.length - capacity;
        src = src.subarray(src.length - capacity);
      }
      for (let i = 0; i < src.length; i += 1) {
        ring[(total + i) % capacity] = src[i];
      }
      total += src.length;
    },

    /**
     * ストリーム時刻範囲 [startMs, endMs] を切り出す。範囲は
     * [保持窓の先頭（容量超過で破棄済みの先）, 実データ末尾] に必ず clamp する。
     * @param {{ startMs: number; endMs: number }} range
     * @returns {{ samples: Int16Array; startMs: number; endMs: number; clamped: boolean }}
     *   samples = コピー（リングと非共有）。startMs/endMs = 実際に切り出せた範囲。
     */
    slice(range) {
      if (
        range == null ||
        typeof range.startMs !== "number" ||
        typeof range.endMs !== "number" ||
        !Number.isFinite(range.startMs) ||
        !Number.isFinite(range.endMs)
      ) {
        throw new TypeError("pcmRingBuffer.slice: range must be { startMs, endMs } finite numbers.");
      }
      if (range.endMs < range.startMs) {
        throw new RangeError(`pcmRingBuffer.slice: endMs ${range.endMs} must be >= startMs ${range.startMs}.`);
      }
      const oldest = Math.max(0, total - capacity);
      let startSample = msToSample(range.startMs);
      let endSample = msToSample(range.endMs);
      const clamped = startSample < oldest || endSample > total;
      startSample = Math.min(Math.max(startSample, oldest), total);
      endSample = Math.min(Math.max(endSample, startSample), total);
      const out = new Int16Array(endSample - startSample);
      for (let i = 0; i < out.length; i += 1) {
        out[i] = ring[(startSample + i) % capacity];
      }
      return { samples: out, startMs: sampleToMs(startSample), endMs: sampleToMs(endSample), clamped };
    },

    /** ストリーム末尾の時刻（= これまでに書いた総サンプルの ms 換算）。 */
    totalMs() {
      return sampleToMs(total);
    },

    /** 保持窓の先頭時刻（これより古い範囲は破棄済み）。 */
    oldestMs() {
      return sampleToMs(Math.max(0, total - capacity));
    },

    /** 全破棄（ffmpeg 再起動でストリーム時計を仕切り直す場合などに）。 */
    reset() {
      total = 0;
      ring.fill(0);
    }
  };
}
