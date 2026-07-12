// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createFireOrchestrator, FIRE_SYSTEM_PROMPT } from "./fire-orchestrator.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";

// 発火オーケストレータの縦貫通テスト（S3 Domain A）。実 SDK・実 TTS・実器は一切使わない
// （人間ゲートの領分）。fake session（ask がカナ応答）・fake speakImpl（テキスト記録）・
// fake channel/player・実 transcript-buffer で fire の縦串（窓収集→ask→speak→soul 記録）を固定する。
// 全テストにタイムアウトを付けハングさせない。

/** 呼ばれたテキストを記録する fake speakImpl（実 TTS/実再生なし）。 */
function makeFakeSpeak() {
  const spoken = [];
  return {
    spoken,
    speakImpl: async (text, deps) => {
      spoken.push({ text, deps });
      return { timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "C:/tmp/fake.wav" };
    }
  };
}

const fakeChannel = { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) };
const fakePlayer = { play() {} };

/** 直近に you 発話を 1 件積んだ実バッファ（appendedAtMs は実時計 = 窓内）。 */
function bufferWithYou(text = "ねえ、今日の予定は？") {
  const buffer = createTranscriptBuffer();
  buffer.append({ startMs: 100, endMs: 900, text });
  return buffer;
}

/** deferred（外から解決できる Promise）。busy 中 fire の検証に使う。 */
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve: /** @type {(v?: any) => void} */ (resolve) };
}

test("FIRE_SYSTEM_PROMPT: 最小仮面が export される", () => {
  assert.equal(typeof FIRE_SYSTEM_PROMPT, "string");
  assert.match(FIRE_SYSTEM_PROMPT, /相方/);
});

test("fire: thinking→speaking→idle・soul 記録・注入に直近 you 発話が含まれる", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("ねえ、今日の予定は？");
  const fakeSpeak = makeFakeSpeak();
  /** @type {string[]} */
  const states = [];
  /** @type {any[]} */
  const fires = [];
  /** @type {any[]} */
  const souls = [];
  let asked = "";

  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(text) {
        asked = text;
        return { replyText: "ひるごはん食べよ" };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onState: (s) => states.push(s),
    onFire: (f) => fires.push(f),
    onSoulTranscript: (e) => souls.push(e)
  });

  const result = await orch.fire();

  assert.equal(result.fired, true);
  assert.equal(result.replyText, "ひるごはん食べよ");
  // 状態列は thinking→speaking→idle。
  assert.deepEqual(states, ["thinking", "speaking", "idle"]);
  assert.equal(orch.getState(), "idle");
  // 注入に直近 you 発話が話者ラベル付きで入る。
  assert.match(asked, /you: ねえ、今日の予定は？/);
  // onFire は accepted:true（注入文字数・件数・atMs）。
  assert.equal(fires.length, 1);
  assert.equal(fires[0].accepted, true);
  assert.equal(fires[0].includedCount, 1);
  assert.ok(fires[0].injectedChars > 0);
  assert.equal(typeof fires[0].atMs, "number");
  // speak は応答テキストで呼ばれ、channel/player が渡る。
  assert.equal(fakeSpeak.spoken.length, 1);
  assert.equal(fakeSpeak.spoken[0].text, "ひるごはん食べよ");
  assert.equal(fakeSpeak.spoken[0].deps.channel, fakeChannel);
  assert.equal(fakeSpeak.spoken[0].deps.player, fakePlayer);
  // soul が会話ログへ追記され（startMs/endMs=0）、onSoulTranscript が通知する。
  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.equal(all[1].speaker, "soul");
  assert.equal(all[1].text, "ひるごはん食べよ");
  assert.equal(all[1].startMs, 0);
  assert.equal(all[1].endMs, 0);
  assert.equal(souls.length, 1);
  assert.equal(souls[0].speaker, "soul");

  orch.dispose();
});

test("fire: busy 中の 2 発目は無視（reason:'busy'）・1 発目だけが完走", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const gate = deferred();
  let askCount = 0;

  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask() {
        askCount += 1;
        await gate.promise; // 1 発目を thinking に留める。
        return { replyText: "はーい" };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer
  });

  const first = orch.fire(); // await しない（thinking で留まる）。
  // マイクロタスクを 1 周させ、ask 内の await gate に入らせる。
  await Promise.resolve();
  assert.equal(orch.getState(), "thinking");

  const second = await orch.fire(); // busy で即返る。
  assert.equal(second.fired, false);
  assert.equal(second.reason, "busy");
  assert.equal(second.state, "thinking");

  gate.resolve(); // 1 発目を解放。
  const firstResult = await first;
  assert.equal(firstResult.fired, true);
  assert.equal(askCount, 1); // ask は 1 回だけ（2 発目は撃たない）。
  assert.equal(orch.getState(), "idle");

  orch.dispose();
});

test("fire: 空窓は ask を撃たず empty-window で返す（無駄撃ち回避）", { timeout: 5000 }, async () => {
  // 窓幅 1ms・appendedAtMs は実時計 → 直近発話も窓外になる。
  const buffer = bufferWithYou();
  let askCalled = false;
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask() {
        askCalled = true;
        return { replyText: "x" };
      }
    },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    windowMs: 0,
    nowImpl: () => Date.now() + 10_000 // 全エントリを窓外へ押し出す。
  });

  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "empty-window");
  assert.equal(askCalled, false);
  assert.equal(orch.getState(), "idle");

  orch.dispose();
});

test("fire: 耳未起動（getBuffer=null）は ears-not-running", { timeout: 5000 }, async () => {
  const orch = createFireOrchestrator({
    getBuffer: () => null,
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer
  });
  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "ears-not-running");
  orch.dispose();
});

test("fire: 空応答は fireEmptyReply 診断・発話せず idle 復帰", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  /** @type {any[]} */
  const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onDiagnostic: (d) => diags.push(d)
  });

  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "empty-reply");
  assert.equal(fakeSpeak.spoken.length, 0); // 発話しない。
  assert.equal(buffer.all().length, 1); // soul 追記もしない。
  assert.deepEqual(diags, [{ type: "fireEmptyReply" }]);
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("fire: ask throw は idle 復帰 + fireError 診断（サーバを殺さない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  /** @type {string[]} */
  const states = [];
  /** @type {any[]} */
  const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask() {
        throw new Error("SDK boom");
      }
    },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onState: (s) => states.push(s),
    onDiagnostic: (d) => diags.push(d)
  });

  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "error");
  assert.match(result.message, /SDK boom/);
  // thinking へ入ってから idle へ戻る（finally 保証）。
  assert.deepEqual(states, ["thinking", "idle"]);
  assert.equal(orch.getState(), "idle");
  assert.equal(diags.length, 1);
  assert.equal(diags[0].type, "fireError");
  assert.match(diags[0].message, /SDK boom/);

  // 復帰後は再び fire できる（詰まっていない）。
  const buffer2Orch = orch;
  assert.equal(buffer2Orch.getState(), "idle");
  orch.dispose();
});

test("fire: speak throw も idle 復帰 + fireError（soul 記録はしない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  /** @type {string[]} */
  const states = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "はい" }; } },
    speakImpl: async () => {
      throw new Error("intent.speech rejected");
    },
    channel: fakeChannel,
    player: fakePlayer,
    onState: (s) => states.push(s)
  });

  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "error");
  assert.deepEqual(states, ["thinking", "speaking", "idle"]);
  assert.equal(buffer.all().length, 1); // soul 追記されない（speak が落ちたので）。
  orch.dispose();
});

test("fire: dispose 後の fire は拒否", { timeout: 5000 }, async () => {
  const orch = createFireOrchestrator({
    getBuffer: () => bufferWithYou(),
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer
  });
  orch.dispose();
  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "disposed");
});
