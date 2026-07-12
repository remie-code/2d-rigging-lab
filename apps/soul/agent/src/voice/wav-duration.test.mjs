// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { wavDurationSec } from "./wav-duration.mjs";
import { buildWavBytes, AIVIS_BYTE_RATE } from "./fixtures.mjs";

/**
 * 任意チャンク並び・パディング検証用の低レベル WAV ビルダ（テスト内専用）。
 * chunks は `{ id: 4文字, body: Uint8Array }` の配列。data チャンクは body 長を宣言サイズにする。
 * @param {Array<{ id: string; body: Uint8Array }>} chunks
 * @returns {Uint8Array}
 */
function buildRiff(chunks) {
  let bodyTotal = 0;
  for (const chunk of chunks) {
    bodyTotal += 8 + chunk.body.length + (chunk.body.length % 2);
  }
  const total = 12 + bodyTotal;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, total - 8, true);
  writeAscii(8, "WAVE");
  let offset = 12;
  for (const chunk of chunks) {
    writeAscii(offset, chunk.id);
    view.setUint32(offset + 4, chunk.body.length, true);
    bytes.set(chunk.body, offset + 8);
    offset += 8 + chunk.body.length + (chunk.body.length % 2);
  }
  return bytes;
}

/** canonical fmt(16) body を作る。 */
function fmtBody({ channels = 1, sampleRate = 44100, bitsPerSample = 16, byteRate } = {}) {
  const blockAlign = channels * (bitsPerSample / 8);
  const effectiveByteRate = byteRate ?? sampleRate * blockAlign;
  const body = new Uint8Array(16);
  const view = new DataView(body.buffer);
  view.setUint16(0, 1, true); // PCM
  view.setUint16(2, channels, true);
  view.setUint32(4, sampleRate, true);
  view.setUint32(8, effectiveByteRate, true);
  view.setUint16(12, blockAlign, true);
  view.setUint16(14, bitsPerSample, true);
  return body;
}

test("golden: 44100Hz mono 16bit の data 長 → 実秒", () => {
  // dataBytes = byteRate → 正確に 1.0s。
  assert.equal(wavDurationSec(buildWavBytes({ dataBytes: AIVIS_BYTE_RATE })), 1.0);
  // 半分 → 0.5s。
  assert.equal(wavDurationSec(buildWavBytes({ dataBytes: AIVIS_BYTE_RATE / 2 })), 0.5);
});

test("golden: 「こんにちは、テストです」相当（data≈1.5468s）を許容誤差内で復元", () => {
  // 実測 data ≈ 1.5468s → dataBytes = round(1.5468 * 88200) = 136428。
  const seconds = wavDurationSec(buildWavBytes({ dataBytes: 136428 }));
  assert.ok(Math.abs(seconds - 1.5468) < 1e-3, `expected ~1.5468s, got ${seconds}`);
});

test("パーサは宣言 data サイズを使う（本体 0 埋め有無で結果は不変）", () => {
  const declaredOnly = wavDurationSec(buildWavBytes({ dataBytes: 88200, includeBody: false }));
  const withBody = wavDurationSec(buildWavBytes({ dataBytes: 88200, includeBody: true }));
  assert.equal(declaredOnly, 1.0);
  assert.equal(withBody, 1.0);
});

test("byteRate=0 のとき sampleRate*blockAlign で代替する", () => {
  const seconds = wavDurationSec(buildWavBytes({ dataBytes: 88200, zeroByteRate: true }));
  assert.equal(seconds, 1.0);
});

test("チャンク順不同: data が fmt より前でも実秒を出す", () => {
  const bytes = buildRiff([
    { id: "data", body: new Uint8Array(88200) },
    { id: "fmt ", body: fmtBody() }
  ]);
  assert.equal(wavDurationSec(bytes), 1.0);
});

test("未知チャンク + 奇数長パディングを正しく跨いで data を見つける", () => {
  const oddChunk = { id: "LIST", body: new Uint8Array(3) }; // 奇数長 → 1 byte パディング
  const bytes = buildRiff([
    { id: "fmt ", body: fmtBody() },
    oddChunk,
    { id: "data", body: new Uint8Array(44100) } // 0.5s
  ]);
  assert.equal(wavDurationSec(bytes), 0.5);
});

test("実バイト長ではなく宣言サイズが尺を決める（buildRiff は body 長を宣言に使う）", () => {
  const bytes = buildRiff([
    { id: "fmt ", body: fmtBody({ sampleRate: 22050, bitsPerSample: 16, channels: 1 }) },
    { id: "data", body: new Uint8Array(22050) } // byteRate=44100 → 0.5s
  ]);
  assert.equal(wavDurationSec(bytes), 0.5);
});

test("Uint8Array の byteOffset を尊重する（部分ビュー）", () => {
  const base = buildWavBytes({ dataBytes: 88200 });
  const padded = new Uint8Array(base.length + 5);
  padded.set(base, 5);
  const view = padded.subarray(5); // offset 付きビュー
  assert.equal(wavDurationSec(view), 1.0);
});

test("不正: RIFF マジック不一致は throw", () => {
  const bytes = buildWavBytes({ dataBytes: 88200 });
  bytes[0] = 0x00;
  assert.throws(() => wavDurationSec(bytes), /RIFF/);
});

test("不正: WAVE フォーマット不一致は throw", () => {
  const bytes = buildWavBytes({ dataBytes: 88200 });
  bytes[8] = 0x00;
  assert.throws(() => wavDurationSec(bytes), /WAVE/);
});

test("不正: data チャンク欠落は throw", () => {
  const bytes = buildRiff([{ id: "fmt ", body: fmtBody() }]);
  assert.throws(() => wavDurationSec(bytes), /no 'data' chunk/);
});

test("不正: 短すぎるバイト列は throw", () => {
  assert.throws(() => wavDurationSec(new Uint8Array(4)), /too short/);
});

test("不正: byteRate も sampleRate*blockAlign も 0 なら throw", () => {
  // sampleRate=0, byteRate=0 の壊れた fmt。
  const bytes = buildRiff([
    { id: "fmt ", body: fmtBody({ sampleRate: 0, byteRate: 0, channels: 0 }) },
    { id: "data", body: new Uint8Array(100) }
  ]);
  assert.throws(() => wavDurationSec(bytes), /no usable byteRate/);
});

test("入力型: ArrayBuffer を直接受け付ける", () => {
  const bytes = buildWavBytes({ dataBytes: 88200 });
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  assert.equal(wavDurationSec(ab), 1.0);
});
