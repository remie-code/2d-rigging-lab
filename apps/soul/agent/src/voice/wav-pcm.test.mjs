// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { readWavPcm } from "./wav-pcm.mjs";
import { buildWavBytes } from "./fixtures.mjs";
import { encodeWav } from "./wav-encode.mjs";

test("readWavPcm: AivisSpeech 形（44100Hz mono 16bit）のヘッダと data の中身を返す", () => {
  const bytes = buildWavBytes({ dataBytes: 8, includeBody: true });
  bytes.set([1, 2, 3, 4, 5, 6, 7, 8], 44);
  const out = readWavPcm(bytes);
  assert.equal(out.sampleRate, 44100);
  assert.equal(out.channels, 1);
  assert.equal(out.bitsPerSample, 16);
  assert.deepEqual([...out.pcm], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(out.pcm.buffer, bytes.buffer, "コピーせず subarray を返す");
});

test("readWavPcm: サンプルレートとチャンネル数はヘッダから読む（24kHz ステレオ）", () => {
  const bytes = buildWavBytes({ dataBytes: 4, includeBody: true, sampleRate: 24000, channels: 2 });
  const out = readWavPcm(bytes);
  assert.equal(out.sampleRate, 24000);
  assert.equal(out.channels, 2);
  assert.equal(out.pcm.byteLength, 4);
});

test("readWavPcm: encodeWav の出力を往復できる", () => {
  const samples = new Int16Array([0, 1000, -1000, 32767]);
  const wav = encodeWav(samples, { sampleRate: 16000 });
  const out = readWavPcm(wav);
  assert.equal(out.sampleRate, 16000);
  assert.deepEqual([...new Int16Array(out.pcm.buffer.slice(out.pcm.byteOffset, out.pcm.byteOffset + out.pcm.byteLength))], [0, 1000, -1000, 32767]);
});

test("readWavPcm: data が末尾で切れていたら残っている分だけ（宣言サイズで読み越さない）", () => {
  const bytes = buildWavBytes({ dataBytes: 48000 });
  assert.equal(readWavPcm(bytes).pcm.byteLength, 0);
});

test("readWavPcm: fmt の前に別チャンク（LIST）があっても走査で見つける", () => {
  const head = buildWavBytes({ dataBytes: 2, includeBody: true });
  const list = new Uint8Array([0x4c, 0x49, 0x53, 0x54, 3, 0, 0, 0, 9, 9, 9, 0]); // "LIST" size 3 + pad
  const bytes = new Uint8Array(12 + list.length + head.length - 12);
  bytes.set(head.subarray(0, 12), 0);
  bytes.set(list, 12);
  bytes.set(head.subarray(12), 12 + list.length);
  const out = readWavPcm(bytes);
  assert.equal(out.sampleRate, 44100);
  assert.equal(out.pcm.byteLength, 2);
});

test("readWavPcm: 不正（短い・マジック不一致・PCM16 以外・型違い）は throw", () => {
  assert.throws(() => readWavPcm(new Uint8Array([1, 2, 3])), RangeError);
  const notRiff = buildWavBytes();
  notRiff[0] = 0x58;
  assert.throws(() => readWavPcm(notRiff), /RIFF/);
  assert.throws(() => readWavPcm(buildWavBytes({ bitsPerSample: 8 })), /16-bit/);
  assert.throws(() => readWavPcm(/** @type {any} */ ("wav")), TypeError);
});
