// @ts-check
/**
 * Discord モード Domain E: 48kHz ステレオ s16le への変換（discord-mode.md §7.2）。
 *  - 24kHz モノラル（ElevenLabs）は各サンプルを 2 回・左右同値。48kHz の整数分の 1 は整数倍の繰り返し。48kHz はそのまま。
 *  - 44.1kHz モノラル（AivisSpeech）などは線形の補間。出力の数・値・正弦波の形。
 *  - 状態を持つ: チャンクの切り方（奇数バイト・1 フレーム未満を含む）に依らず同じ出力（途切れ・ずれが出ない）。
 *  - end で 20ms（3840 バイト）の倍数まで無音で埋める。音が無ければ何も出さない。
 * 音はファイルに保存しない（メモリの中だけ）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createPcm48kStereoConverter,
  DISCORD_PCM_FRAME_BYTES,
  DISCORD_PCM_SAMPLE_RATE
} from "./discord-pcm48.mjs";

/** @param {number[]} samples */
function pcm16(samples) {
  const b = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => b.writeInt16LE(v, i * 2));
  return b;
}

/** @param {Buffer} b @returns {number[]} */
function read16(b) {
  const out = [];
  for (let i = 0; i + 1 < b.length; i += 2) out.push(b.readInt16LE(i));
  return out;
}

/** 決まった種の擬似乱数（テストの再現性）。 @param {number} seed */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * 全部を 1 度に変換した出力と、ばらばらに切って変換した出力を比べる材料。
 * @param {{ sampleRate: number; channels: number }} format @param {Buffer} input @param {number[]} cuts  切れ目のバイト位置。
 */
function convertInPieces(format, input, cuts) {
  const c = createPcm48kStereoConverter(format);
  /** @type {Buffer[]} */
  const parts = [];
  let at = 0;
  for (const cut of [...cuts, input.length]) {
    parts.push(c.push(new Uint8Array(input.subarray(at, cut))));
    at = cut;
  }
  parts.push(c.flush());
  return Buffer.concat(parts);
}

test("24kHz モノラル: 各サンプルを 2 回・左右に同じ値（ElevenLabs の pcm_24000）", () => {
  const c = createPcm48kStereoConverter({ sampleRate: 24000, channels: 1 });
  assert.equal(c.mode, "repeat");
  const out = c.push(pcm16([100, -200, 32767, -32768]));
  assert.deepEqual(read16(out), [100, 100, 100, 100, -200, -200, -200, -200, 32767, 32767, 32767, 32767, -32768, -32768, -32768, -32768]);
});

test("48kHz の整数分の 1（16kHz・8kHz）は整数倍の繰り返し・48kHz はそのまま（モノラルは左右同値・ステレオは左右そのまま）", () => {
  const c16 = createPcm48kStereoConverter({ sampleRate: 16000, channels: 1 });
  assert.equal(c16.mode, "repeat");
  assert.deepEqual(read16(c16.push(pcm16([7]))), [7, 7, 7, 7, 7, 7]);
  const c8 = createPcm48kStereoConverter({ sampleRate: 8000, channels: 2 });
  assert.deepEqual(read16(c8.push(pcm16([1, 2]))), [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2]);
  const m48 = createPcm48kStereoConverter({ sampleRate: 48000, channels: 1 });
  assert.equal(m48.mode, "copy");
  assert.deepEqual(read16(m48.push(pcm16([5, -6]))), [5, 5, -6, -6]);
  const s48 = createPcm48kStereoConverter({ sampleRate: 48000, channels: 2 });
  assert.deepEqual(read16(s48.push(pcm16([5, -6, 7, -8]))), [5, -6, 7, -8]);
});

test("44.1kHz モノラル: 線形の補間（出力の数は ceil(入力 × 48000 / 44100)・値は前後の 2 点の間）", () => {
  const n = 441; // 10ms
  const input = pcm16(Array.from({ length: n }, (_, i) => i * 10));
  const c = createPcm48kStereoConverter({ sampleRate: 44100, channels: 1 });
  assert.equal(c.mode, "linear");
  const body = c.push(input);
  const tail = c.flush();
  const all = read16(Buffer.concat([body, tail]));
  const frames = Math.ceil((n * DISCORD_PCM_SAMPLE_RATE) / 44100); // 480
  assert.equal(frames, 480);
  // 出力の頭 480 フレーム（左右同値）・残りは 20ms の倍数までの無音。
  for (let k = 0; k < frames; k += 1) {
    const l = all[k * 2];
    const r = all[k * 2 + 1];
    assert.equal(l, r, `左右同値 ${k}`);
    const pos = (k * 44100) / 48000;
    const i = Math.floor(pos);
    const a = i * 10;
    const b = Math.min(i + 1, n - 1) * 10;
    assert.ok(Math.abs(l - (a + (b - a) * (pos - i))) <= 0.5, `補間 ${k}: ${l}`);
  }
  assert.equal((body.length + tail.length) % DISCORD_PCM_FRAME_BYTES, 0, "20ms の倍数まで埋める");
  assert.ok(all.slice(frames * 2).every((v) => v === 0), "埋めた所は無音");
});

test("44.1kHz の 1kHz の正弦波: 48kHz にしても同じ高さ（速く高い声にならない）・形の誤差は小さい", () => {
  const seconds = 0.2;
  const inRate = 44100;
  const n = Math.round(inRate * seconds);
  const amp = 12000;
  const input = pcm16(Array.from({ length: n }, (_, i) => Math.round(amp * Math.sin((2 * Math.PI * 1000 * i) / inRate))));
  const out = read16(convertInPieces({ sampleRate: inRate, channels: 1 }, input, [1001, 4410, 4411, 7777]));
  const frames = Math.ceil((n * 48000) / inRate);
  let maxErr = 0;
  for (let k = 0; k < frames - 1; k += 1) {
    const ideal = amp * Math.sin((2 * Math.PI * 1000 * k) / 48000);
    maxErr = Math.max(maxErr, Math.abs(out[k * 2] - ideal));
  }
  assert.ok(maxErr < amp * 0.03, `誤差 ${maxErr}`);
  // 長さ（再生時間）が変わらない: 0.2 秒 = 9600 フレーム。
  assert.equal(frames, 9600);
});

test("状態を持つ: チャンクの切り方（奇数バイト・1 フレーム未満・空）に依らず、全部を 1 度に変えたのと同じ出力", () => {
  const random = rng(42);
  for (const format of [
    { sampleRate: 44100, channels: 1 },
    { sampleRate: 22050, channels: 2 },
    { sampleRate: 24000, channels: 1 },
    { sampleRate: 32000, channels: 1 },
    { sampleRate: 48000, channels: 2 }
  ]) {
    const frames = 3001;
    const input = pcm16(Array.from({ length: frames * format.channels }, () => Math.round((random() - 0.5) * 60000)));
    const whole = convertInPieces(format, input, []);
    for (let trial = 0; trial < 5; trial += 1) {
      /** @type {number[]} */
      const cuts = [];
      let at = 0;
      while (at < input.length) {
        at += Math.floor(random() * 700); // 0 も含む（空のチャンク）・奇数も含む
        if (at < input.length) cuts.push(at);
      }
      const pieces = convertInPieces(format, input, cuts);
      assert.equal(Buffer.compare(pieces, whole), 0, `${format.sampleRate}/${format.channels} の切り方 ${trial}`);
    }
  }
});

test("奇数バイトのチャンク: 端数は次へ持ち越す（1 バイトずつ渡しても同じ）・最後の壊れた端数は捨てる", () => {
  const input = pcm16([1000, -1000, 2000, -2000]);
  const c = createPcm48kStereoConverter({ sampleRate: 24000, channels: 1 });
  /** @type {Buffer[]} */
  const parts = [];
  for (const byte of input) parts.push(c.push(new Uint8Array([byte])));
  parts.push(c.push(new Uint8Array([0x7f]))); // 半端な 1 バイト（捨てる）
  const body = Buffer.concat(parts);
  assert.deepEqual(read16(body), [1000, 1000, 1000, 1000, -1000, -1000, -1000, -1000, 2000, 2000, 2000, 2000, -2000, -2000, -2000, -2000]);
  const tail = c.flush();
  assert.equal((body.length + tail.length) % DISCORD_PCM_FRAME_BYTES, 0);
  assert.ok(read16(tail).every((v) => v === 0));
});

test("音が無ければ end でも何も出さない・flush は 1 度だけ・flush の後の push は投げる", () => {
  const c = createPcm48kStereoConverter({ sampleRate: 44100, channels: 1 });
  assert.equal(c.flush().length, 0);
  assert.equal(c.flush().length, 0);
  assert.throws(() => c.push(new Uint8Array(2)));
  const d = createPcm48kStereoConverter({ sampleRate: 24000, channels: 1 });
  d.push(new Uint8Array(1)); // 1 フレームに満たない
  assert.equal(d.flush().length, 0);
});

test("ちょうど 20ms の倍数なら埋めない・大きい値は飽和せず範囲内（補間で桁あふれしない）", () => {
  const c = createPcm48kStereoConverter({ sampleRate: 24000, channels: 1 });
  const body = c.push(pcm16(new Array(480).fill(32767))); // 20ms
  assert.equal(body.length, DISCORD_PCM_FRAME_BYTES);
  assert.equal(c.flush().length, 0);
  const l = createPcm48kStereoConverter({ sampleRate: 44100, channels: 2 });
  const out = read16(Buffer.concat([l.push(pcm16([32767, -32768, -32768, 32767, 32767, -32768])), l.flush()]));
  assert.ok(out.every((v) => v >= -32768 && v <= 32767));
});

test("形の確かめ: サンプルレートは 8000〜192000 の整数・チャンネルは 1 か 2（open の { sampleRate, channels } に従う）", () => {
  for (const format of [{ sampleRate: 7999, channels: 1 }, { sampleRate: 44100.5, channels: 1 }, { sampleRate: 44100, channels: 3 }, null]) {
    assert.throws(() => createPcm48kStereoConverter(/** @type {any} */ (format)), RangeError);
  }
  assert.throws(() => createPcm48kStereoConverter({ sampleRate: 24000, channels: 1 }).push(/** @type {any} */ ("x")), TypeError);
});
