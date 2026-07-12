// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  splitFrames,
  decodeInt16LE,
  int16ToFloat32,
  createPcmFramer,
  SILERO_FRAME_SAMPLES_16K
} from "./pcm-framing.mjs";
import { int16ToBytesLE } from "./fixtures-audio.mjs";

const EMPTY = new Uint8Array(0);

test("splitFrames: ちょうど N フレームなら N 個・leftover 空", () => {
  const chunk = new Uint8Array(24); // frameBytes 8 → 3 フレーム
  const { frames, leftover } = splitFrames(EMPTY, chunk, 8);
  assert.equal(frames.length, 3);
  assert.equal(leftover.length, 0);
  for (const f of frames) assert.equal(f.length, 8);
});

test("splitFrames: 半端バイトは leftover に持ち越す", () => {
  const chunk = new Uint8Array(20); // 8*2=16 で 2 フレーム, 残り 4
  const { frames, leftover } = splitFrames(EMPTY, chunk, 8);
  assert.equal(frames.length, 2);
  assert.equal(leftover.length, 4);
});

test("splitFrames: leftover + chunk がフレーム境界を跨いで結合される", () => {
  // 5 byte 残り + 次 chunk 11 byte = 16 byte → frameBytes 8 で 2 フレーム, 残り 0。
  const leftover = new Uint8Array([1, 2, 3, 4, 5]);
  const chunk = new Uint8Array([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const { frames, leftover: next } = splitFrames(leftover, chunk, 8);
  assert.equal(frames.length, 2);
  assert.deepEqual([...frames[0]], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...frames[1]], [9, 10, 11, 12, 13, 14, 15, 16]);
  assert.equal(next.length, 0);
});

test("splitFrames: フレーム未満の chunk は全部 leftover（frames 空）", () => {
  const { frames, leftover } = splitFrames(EMPTY, new Uint8Array([1, 2, 3]), 8);
  assert.equal(frames.length, 0);
  assert.deepEqual([...leftover], [1, 2, 3]);
});

test("splitFrames: 返るフレームは内部バッファと共有しない（コピー）", () => {
  const chunk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const { frames } = splitFrames(EMPTY, chunk, 8);
  chunk[0] = 99; // 元 chunk を破壊しても
  assert.equal(frames[0][0], 1); // フレームは影響を受けない
});

test("splitFrames: 不正 frameBytes は throw", () => {
  assert.throws(() => splitFrames(EMPTY, new Uint8Array(8), 0), RangeError);
  assert.throws(() => splitFrames(EMPTY, new Uint8Array(8), 1.5), RangeError);
});

test("decodeInt16LE: s16le バイト列 → Int16Array（int16ToBytesLE の逆）", () => {
  const samples = new Int16Array([0, 32767, -32768, -1, 12345]);
  const bytes = int16ToBytesLE(samples);
  assert.deepEqual([...decodeInt16LE(bytes)], [...samples]);
});

test("decodeInt16LE: 奇数長は throw", () => {
  assert.throws(() => decodeInt16LE(new Uint8Array(3)), /odd/);
});

test("int16ToFloat32: 正規化（-32768→-1, 0→0, 16384→0.5）", () => {
  const f = int16ToFloat32(new Int16Array([-32768, 0, 16384]));
  assert.ok(Math.abs(f[0] - -1.0) < 1e-6);
  assert.equal(f[1], 0);
  assert.ok(Math.abs(f[2] - 0.5) < 1e-6);
});

test("createPcmFramer: 既定フレーム長は Silero v5 @16kHz の 512 サンプル（1024 byte）", () => {
  const framer = createPcmFramer();
  assert.equal(framer.frameBytes, SILERO_FRAME_SAMPLES_16K * 2);
  assert.equal(framer.frameBytes, 1024);
});

test("createPcmFramer: 任意分割で投入しても正しいサンプルフレームが出る", () => {
  const framer = createPcmFramer({ frameSamples: 4 }); // frameBytes = 8
  // 3 フレーム分 = 12 サンプル。値 = index。
  const all = new Int16Array(12);
  for (let i = 0; i < 12; i += 1) all[i] = i;
  const bytes = int16ToBytesLE(all);
  // バイトを 5, 5, 残り の変則分割で投入。
  const out = [];
  for (const frame of framer.push(bytes.subarray(0, 5))) out.push(frame);
  for (const frame of framer.push(bytes.subarray(5, 10))) out.push(frame);
  for (const frame of framer.push(bytes.subarray(10))) out.push(frame);
  assert.equal(out.length, 3);
  assert.deepEqual([...out[0]], [0, 1, 2, 3]);
  assert.deepEqual([...out[1]], [4, 5, 6, 7]);
  assert.deepEqual([...out[2]], [8, 9, 10, 11]);
});

test("createPcmFramer: 半端は leftoverBytes に残り、続きが来たら確定", () => {
  const framer = createPcmFramer({ frameSamples: 4 }); // 8 byte/frame
  const frames1 = framer.push(new Uint8Array(6)); // 6 byte → 0 フレーム, leftover 6
  assert.equal(frames1.length, 0);
  assert.equal(framer.leftoverBytes(), 6);
  const frames2 = framer.push(new Uint8Array(10)); // 6+10=16 → 2 フレーム, leftover 0
  assert.equal(frames2.length, 2);
  assert.equal(framer.leftoverBytes(), 0);
});

test("createPcmFramer: reset で持ち越しを捨てる", () => {
  const framer = createPcmFramer({ frameSamples: 4 });
  framer.push(new Uint8Array(6));
  assert.equal(framer.leftoverBytes(), 6);
  framer.reset();
  assert.equal(framer.leftoverBytes(), 0);
});
