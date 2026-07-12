// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { speak } from "./speak.mjs";
import { createChannelServerDouble } from "./test-support/ws-double.mjs";
import { connectChannel } from "./channel-client.mjs";
import { MinimalWebSocket } from "./test-support/ws-client.mjs";
import {
  buildWavBytes,
  GOLDEN_KONNICHIWA_WAV_DURATION_SEC,
  AIVIS_BYTE_RATE
} from "./fixtures.mjs";

/** 実機形の audio_query（fixtures GOLDEN と整合・11 モーラ）。 */
function goldenAudioQuery() {
  return {
    accent_phrases: [
      {
        moras: [
          { text: "コ", vowel: "o" },
          { text: "ン", vowel: "N" },
          { text: "ニ", vowel: "i" },
          { text: "チ", vowel: "i" },
          { text: "ワ", vowel: "a" },
          { text: ",", vowel: "pau" }
        ],
        pause_mora: null
      },
      {
        moras: [
          { text: "テ", vowel: "e" },
          { text: "ス", vowel: "u" },
          { text: "ト", vowel: "o" },
          { text: "デ", vowel: "e" },
          { text: "ス", vowel: "u" }
        ],
        pause_mora: null
      }
    ],
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1
  };
}

/** GOLDEN の WAV 実長（1.5468s）を再現する WAV バイト列を組む。 */
function goldenWavBytes() {
  const dataBytes = Math.round(GOLDEN_KONNICHIWA_WAV_DURATION_SEC * AIVIS_BYTE_RATE);
  return buildWavBytes({ dataBytes });
}

/** ログ順序を記録する fake tts。 */
function fakeTts(order, wavBytes = goldenWavBytes()) {
  return {
    async audioQuery() {
      order.push("audioQuery");
      return goldenAudioQuery();
    },
    async synthesis() {
      order.push("synthesis");
      return wavBytes;
    }
  };
}

test("speak: TTS→timeline→送出→accepted→即 play の順序で完走", async () => {
  const order = [];
  let playedPath = null;
  const channel = {
    async sendSpeech(timeline) {
      order.push("sendSpeech");
      channel.lastTimeline = timeline;
      return { result: "accepted", error: null, rttMs: 3.5 };
    }
  };
  const player = {
    play(wavPath) {
      order.push("play");
      playedPath = wavPath;
    }
  };
  const result = await speak("こんにちは、テストです", {
    channel,
    player,
    tts: fakeTts(order),
    writeWav: () => "C:/tmp/fake.wav"
  });

  // 順序: audioQuery → synthesis → sendSpeech → play（accepted 受領後に play）。
  assert.deepEqual(order, ["audioQuery", "synthesis", "sendSpeech", "play"]);
  assert.equal(playedPath, "C:/tmp/fake.wav");
  assert.equal(result.wavPath, "C:/tmp/fake.wav");
  assert.equal(result.rttMs, 3.5);
  // timeline は Domain A 純関数の結果（9 要素・pau/N 脱落・先頭 timeMs=100=pre 0.1s 込み）。
  assert.equal(result.timeline.length, 9);
  assert.equal(result.timeline[0].timeMs, 100);
  assert.deepEqual(
    result.timeline.map((t) => t.vowel),
    ["o", "i", "i", "a", "e", "u", "o", "e", "u"]
  );
  // timeMs は整数・厳密単調増加・非負。vowel は 5 値・s は 0..1。
  let prev = -1;
  for (const item of result.timeline) {
    assert.ok(Number.isInteger(item.timeMs) && item.timeMs > prev);
    prev = item.timeMs;
    assert.ok(["a", "i", "u", "e", "o"].includes(item.vowel));
    assert.ok(item.s >= 0 && item.s <= 1);
  }
  assert.deepEqual(channel.lastTimeline, result.timeline);
});

test("speak: rejected は throw・play は呼ばれない・接続は閉じない", async () => {
  const order = [];
  let playCalled = false;
  let closeCalled = false;
  const channel = {
    async sendSpeech() {
      order.push("sendSpeech");
      return {
        result: "rejected",
        error: { code: "slotValueOutOfRange", message: "s out of range" },
        rttMs: 2
      };
    },
    async close() {
      closeCalled = true;
    }
  };
  const player = {
    play() {
      playCalled = true;
    }
  };
  await assert.rejects(
    () =>
      speak("だめな文", {
        channel,
        player,
        tts: fakeTts(order),
        writeWav: () => "C:/tmp/fake.wav"
      }),
    /rejected.*slotValueOutOfRange/s
  );
  assert.equal(playCalled, false);
  assert.equal(closeCalled, false); // speak は接続を閉じない。
});

test("speak: timeline 512 超はそのまま伝播（buildSpeechTimeline の throw）", async () => {
  const order = [];
  // 513 個すべて母音 a のモーラ列（脱落なし → 出力 513 要素 > 512）。
  const bigQuery = {
    accent_phrases: [
      {
        moras: Array.from({ length: 513 }, () => ({ text: "ア", vowel: "a" })),
        pause_mora: null
      }
    ],
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1
  };
  const tts = {
    async audioQuery() {
      order.push("audioQuery");
      return bigQuery;
    },
    async synthesis() {
      order.push("synthesis");
      return goldenWavBytes();
    }
  };
  let sent = false;
  const channel = {
    async sendSpeech() {
      sent = true;
      return { result: "accepted", error: null, rttMs: 1 };
    }
  };
  await assert.rejects(
    () => speak("長文", { channel, player: { play() {} }, tts, writeWav: () => "x" }),
    /512|maxItems/
  );
  assert.equal(sent, false); // 送出前に throw（timeline 構築段で失敗）。
});

test("speak: 実 WS ダブル + 実 channel-client で accepted→play まで通る（配線の存在）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: MinimalWebSocket });
  const order = [];
  let playedPath = null;
  const player = {
    play(wavPath) {
      order.push("play");
      playedPath = wavPath;
    }
  };
  try {
    const result = await speak("こんにちは、テストです", {
      channel,
      player,
      tts: fakeTts(order),
      writeWav: () => "C:/tmp/e2e-fake.wav"
    });
    assert.equal(playedPath, "C:/tmp/e2e-fake.wav");
    assert.equal(order[order.length - 1], "play");
    const speechMsg = server.received.find((m) => m.kind === "intent.speech");
    assert.ok(speechMsg);
    assert.deepEqual(speechMsg.payload.timeline, result.timeline);
  } finally {
    await channel.close();
    await server.close();
  }
});
