// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { encodeWav } from "./wav-encode.mjs";
import { wavDurationSec } from "./wav-duration.mjs";
import { sinePcm, silencePcm, concatInt16, int16ToBytesLE } from "./fixtures-audio.mjs";

test("ラウンドトリップ: encodeWav → wavDurationSec で尺が一致（Int16Array・16kHz mono）", () => {
  // 16000 サンプル @16kHz mono s16 → ちょうど 1.0s。
  const pcm = new Int16Array(16000);
  const wav = encodeWav(pcm, { sampleRate: 16000, channels: 1, bitsPerSample: 16 });
  assert.equal(wavDurationSec(wav), 1.0);
});

test("ラウンドトリップ: 合成正弦波 200ms が 0.2s に復元", () => {
  const pcm = sinePcm({ freq: 440, durationMs: 200, sampleRate: 16000 });
  const wav = encodeWav(pcm, { sampleRate: 16000 });
  assert.ok(Math.abs(wavDurationSec(wav) - 0.2) < 1e-9, `got ${wavDurationSec(wav)}`);
});

test("ラウンドトリップ: 無音+正弦波+無音の連結尺（発話セグメント WAV 相当）", () => {
  const pcm = concatInt16(
    silencePcm({ durationMs: 100 }),
    sinePcm({ durationMs: 300 }),
    silencePcm({ durationMs: 100 })
  );
  const wav = encodeWav(pcm);
  assert.ok(Math.abs(wavDurationSec(wav) - 0.5) < 1e-9, `got ${wavDurationSec(wav)}`);
});

test("既定は 16kHz mono 16bit（whisper/VAD 入力）", () => {
  const wav = encodeWav(new Int16Array(16000));
  const view = new DataView(wav.buffer);
  assert.equal(view.getUint16(22, true), 1); // channels
  assert.equal(view.getUint32(24, true), 16000); // sampleRate
  assert.equal(view.getUint16(34, true), 16); // bitsPerSample
  assert.equal(view.getUint32(28, true), 32000); // byteRate = 16000*1*2
});

test("ヘッダ構造: RIFF/WAVE マジック・fmt・data サイズが正しい", () => {
  const pcm = new Int16Array([1, -1, 100, -100]);
  const wav = encodeWav(pcm, { sampleRate: 16000 });
  const ascii = (o, n) => String.fromCharCode(...wav.slice(o, o + n));
  assert.equal(ascii(0, 4), "RIFF");
  assert.equal(ascii(8, 4), "WAVE");
  assert.equal(ascii(12, 4), "fmt ");
  assert.equal(ascii(36, 4), "data");
  const view = new DataView(wav.buffer);
  assert.equal(view.getUint32(40, true), 8); // dataBytes = 4 サンプル * 2
  assert.equal(view.getUint32(4, true), 36 + 8); // RIFF size
  assert.equal(wav.length, 44 + 8);
});

test("Int16Array のサンプル値が LE で書かれ、読み戻せる", () => {
  const pcm = new Int16Array([0, 32767, -32768, 12345]);
  const wav = encodeWav(pcm);
  const view = new DataView(wav.buffer, 44); // data 本体
  assert.equal(view.getInt16(0, true), 0);
  assert.equal(view.getInt16(2, true), 32767);
  assert.equal(view.getInt16(4, true), -32768);
  assert.equal(view.getInt16(6, true), 12345);
});

test("Uint8Array（生 s16le バイト列）をそのまま data に載せる", () => {
  const bytes = int16ToBytesLE(new Int16Array([256, -256]));
  const wav = encodeWav(bytes, { sampleRate: 16000 });
  const view = new DataView(wav.buffer);
  assert.equal(view.getUint32(40, true), 4); // dataBytes = 4
  assert.equal(new DataView(wav.buffer, 44).getInt16(0, true), 256);
});

test("不正: Uint8Array の長さが blockAlign 非倍数は throw", () => {
  assert.throws(() => encodeWav(new Uint8Array(3), { sampleRate: 16000 }), /multiple of blockAlign/);
});

test("不正: Int16Array 入力で bitsPerSample!=16 は throw", () => {
  assert.throws(() => encodeWav(new Int16Array(4), { bitsPerSample: 8 }), /bitsPerSample=16/);
});

test("不正: sampleRate 非正は throw", () => {
  assert.throws(() => encodeWav(new Int16Array(4), { sampleRate: 0 }), /sampleRate/);
});

test("不正: 非 typed-array 入力は throw", () => {
  assert.throws(() => encodeWav([1, 2, 3]), TypeError);
});
