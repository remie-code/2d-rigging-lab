// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runConversation } from "./cli.mjs";
import { speak } from "./speak.mjs";
import { connectChannel } from "./channel-client.mjs";
import { createAudioPlayer } from "./audio-player.mjs";
import { createChannelServerDouble } from "./test-support/ws-double.mjs";
import { MinimalWebSocket } from "./test-support/ws-client.mjs";
import {
  buildWavBytes,
  GOLDEN_KONNICHIWA_WAV_DURATION_SEC,
  AIVIS_BYTE_RATE
} from "./fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ECHO_PLAYER = path.join(here, "test-support", "echo-player.mjs");

// llm-session を実 SDK ではなくダブルに差し替え、Channel（ws-double + MinimalWebSocket）と
// プレイヤー（echo-player）を実配線して CLI の会話ループ（一文 → ask → speak → 口 + 声 → 計測）を
// 検証する。実 SDK・実器・実再生は一切使わない（人間ゲートの領分）。

/** GOLDEN と整合する実機形 audio_query（11 モーラ・9 要素 timeline になる）。 */
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

function goldenWavBytes() {
  const dataBytes = Math.round(GOLDEN_KONNICHIWA_WAV_DURATION_SEC * AIVIS_BYTE_RATE);
  return buildWavBytes({ dataBytes });
}

const fakeTts = {
  async audioQuery() {
    return goldenAudioQuery();
  },
  async synthesis() {
    return goldenWavBytes();
  }
};

/** 収集する Writable（stdout/stderr の代役）。 */
function collectingWritable(sink) {
  return new Writable({
    write(chunk, _enc, cb) {
      sink.push(String(chunk));
      cb();
    }
  });
}

test("cli.runConversation: 2 行を ask→speak して器へ intent.speech 送出・計測 JSON を出す・全 dispose", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();

  const asks = [];
  let sessionDisposed = false;
  const session = {
    async ask(text) {
      asks.push(text);
      return {
        replyText: `AI:${text}`,
        usage: { input_tokens: 3, output_tokens: 2 },
        ttftMs: 12.3,
        elapsedMs: 20.5
      };
    },
    async dispose() {
      sessionDisposed = true;
    }
  };

  const playedPaths = [];
  let playerDisposed = false;
  const echoPlayer = createAudioPlayer({ command: process.execPath, args: [ECHO_PLAYER] });
  const player = {
    play(p) {
      playedPaths.push(p); // 同期記録（決定的）。
      echoPlayer.play(p); // echo-player の実往復も踏む（無音）。
    },
    dispose() {
      playerDisposed = true;
      echoPlayer.dispose();
    }
  };

  const stdoutLines = [];
  const stderrLines = [];
  const stdin = Readable.from("こんにちは\nおやすみ\n");

  const result = await runConversation({
    url,
    createSession: () => session,
    connect: (u) => connectChannel(u, { WebSocketImpl: MinimalWebSocket }),
    createPlayer: () => player,
    speakImpl: speak,
    speakDeps: { tts: fakeTts, writeWav: () => "C:/tmp/cli-fake.wav" },
    stdin,
    stdout: collectingWritable(stdoutLines),
    stderr: collectingWritable(stderrLines)
  });

  try {
    // ask は 2 行に対して 2 回・入力文がそのまま渡る。
    assert.deepEqual(asks, ["こんにちは", "おやすみ"]);
    // 応答文が speak を通り、器へ 2 本の intent.speech が届く。
    const speeches = server.received.filter((m) => m.kind === "intent.speech");
    assert.equal(speeches.length, 2);
    assert.equal(speeches[0].payload.timeline.length, 9); // pau/N 脱落で 9 要素。
    // 応答文で play が 2 回呼ばれる。
    assert.deepEqual(playedPaths, ["C:/tmp/cli-fake.wav", "C:/tmp/cli-fake.wav"]);
    // 計測 JSON が 2 行（usage/ttft/e2e/timeline_items を含む）。
    const utter = stderrLines
      .join("")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l))
      .filter((o) => o.event === "utterance");
    assert.equal(utter.length, 2);
    for (const u of utter) {
      assert.deepEqual(u.usage, { input_tokens: 3, output_tokens: 2 });
      assert.equal(u.ttft_ms, 12.3);
      assert.equal(u.timeline_items, 9);
      assert.ok(typeof u.e2e_ms === "number" && u.e2e_ms >= 0);
    }
    // EOF で全 dispose（event loop に何も残さない）。
    assert.equal(result.utterances, 2);
    assert.equal(sessionDisposed, true);
    assert.equal(playerDisposed, true);
    // 応答テキストが stdout に出る。
    assert.match(stdoutLines.join(""), /AI:こんにちは/);
  } finally {
    await server.close();
  }
});

test("cli.runConversation: 空行はスキップ・EOF で正常終了（発話 0 でも dispose 完遂）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();

  let sessionDisposed = false;
  const session = {
    async ask() {
      throw new Error("空行では ask を呼ばないはず");
    },
    async dispose() {
      sessionDisposed = true;
    }
  };
  let playerDisposed = false;
  const player = { play() {}, dispose() { playerDisposed = true; } };

  const stdin = Readable.from("   \n\n\t\n");
  const stderrLines = [];
  const result = await runConversation({
    url,
    createSession: () => session,
    connect: (u) => connectChannel(u, { WebSocketImpl: MinimalWebSocket }),
    createPlayer: () => player,
    speakImpl: speak,
    speakDeps: { tts: fakeTts },
    stdin,
    stdout: collectingWritable([]),
    stderr: collectingWritable(stderrLines)
  });

  try {
    assert.equal(result.utterances, 0);
    assert.equal(server.received.filter((m) => m.kind === "intent.speech").length, 0);
    assert.equal(sessionDisposed, true);
    assert.equal(playerDisposed, true);
  } finally {
    await server.close();
  }
});

test("cli.runConversation: signal abort で入力ループを閉じ dispose する（Ctrl+C 経路）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();

  let sessionDisposed = false;
  const session = { async ask() { return { replyText: "x", usage: null, ttftMs: null, elapsedMs: 1 }; }, async dispose() { sessionDisposed = true; } };
  const player = { play() {}, dispose() {} };

  // 終端しない stdin（PassThrough を書き込まず開けたまま）→ abort で閉じることを確認。
  const stdin = new Readable({ read() {} });
  const controller = new AbortController();
  const run = runConversation({
    url,
    createSession: () => session,
    connect: (u) => connectChannel(u, { WebSocketImpl: MinimalWebSocket }),
    createPlayer: () => player,
    speakImpl: speak,
    speakDeps: { tts: fakeTts },
    stdin,
    stdout: collectingWritable([]),
    stderr: collectingWritable([]),
    signal: controller.signal
  });

  // 少し待ってから abort（接続完了後にループへ入る）。
  await new Promise((r) => setTimeout(r, 50));
  controller.abort();

  try {
    const result = await run;
    assert.equal(result.utterances, 0);
    assert.equal(sessionDisposed, true);
  } finally {
    stdin.destroy();
    await server.close();
  }
});
