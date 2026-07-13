// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createFireOrchestrator, FIRE_SYSTEM_PROMPT } from "./fire-orchestrator.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { createBargeInGate, BARGE_IN_NOTE, MOUTH_CLOSE_TTL_MS } from "./barge-in.mjs";

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

test("FIRE_SYSTEM_PROMPT: S4 タグ 6 語の教示を含む", () => {
  for (const tag of ["<smile>", "<troubled>", "<surprised>", "<nod>", "<look-away>", "<look-camera>"]) {
    assert.ok(FIRE_SYSTEM_PROMPT.includes(tag), `教示に ${tag} が含まれる`);
  }
});

// ── S4 表情演出の縦検証（fake channel/session/speak）─────────────────────────────

/** envelope を記録する fake channel。slot 毎に accepted/rejected/throw を切り替えられる。 */
function makeExprChannel(options = {}) {
  const envelopes = [];
  const rejectSlots = new Set(options.rejectSlots ?? []);
  const throwSlots = new Set(options.throwSlots ?? []);
  return {
    envelopes,
    channel: {
      sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }),
      sendEnvelope: async (/** @type {any} */ intent) => {
        envelopes.push(intent);
        if (throwSlots.has(intent.slotId)) throw new Error(`boom:${intent.slotId}`);
        if (rejectSlots.has(intent.slotId)) {
          return { result: "rejected", error: { code: "slotValueOutOfRange" }, rttMs: 0 };
        }
        return { result: "accepted", error: null, rttMs: 0 };
      }
    }
  };
}

test("fire: タグ込み応答は speechText のみ speak+soul 記録・演出は envelope へ（タグは声に出さない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("それでいい？");
  const fakeSpeak = makeFakeSpeak();
  const expr = makeExprChannel();
  /** @type {any[]} */
  const expressions = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "そうだね<nod>" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: expr.channel,
    player: fakePlayer,
    onExpression: (e) => expressions.push(e)
  });

  const result = await orch.fire();
  assert.equal(result.fired, true);
  // speak は speechText（タグ抜き）で呼ばれる。
  assert.equal(fakeSpeak.spoken.length, 1);
  assert.equal(fakeSpeak.spoken[0].text, "そうだね");
  assert.equal(result.replyText, "そうだね");
  // soul 記録も speechText のみ（タグ込み記録のバグ修正）。
  const all = buffer.all();
  assert.equal(all[1].text, "そうだね");
  assert.ok(!all[1].text.includes("<"));
  // envelope は nod のスロット束（head-vertical）へ送られる。
  assert.equal(expr.envelopes.length, 1);
  assert.equal(expr.envelopes[0].slotId, "head-vertical");
  // onExpression は語ごとに applied/rejected を通知。
  assert.deepEqual(expressions, [{ word: "nod", applied: 1, rejected: 0 }]);
  orch.dispose();
});

test("fire: 演出はスロット毎に envelope 送出（smile は 4 スロット）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const expr = makeExprChannel();
  /** @type {any[]} */
  const expressions = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "<smile>やあ" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: expr.channel,
    player: fakePlayer,
    onExpression: (e) => expressions.push(e)
  });

  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.equal(result.replyText, "やあ");
  // smile = mouth-smile + eye-blink-left + eye-blink-right + head-tilt = 4 スロット。
  assert.equal(expr.envelopes.length, 4);
  assert.deepEqual(
    expr.envelopes.map((e) => e.slotId).sort(),
    ["eye-blink-left", "eye-blink-right", "head-tilt", "mouth-smile"]
  );
  // 各 payload は器契約 5 フィールド。
  for (const p of expr.envelopes) {
    assert.deepEqual(Object.keys(p).sort(), ["attackMs", "decayMs", "peak", "slotId", "sustainMs"]);
  }
  assert.deepEqual(expressions, [{ word: "smile", applied: 4, rejected: 0 }]);
  orch.dispose();
});

test("fire: envelope rejected は発話を止めない（診断へ握る・部分適用は正常系）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const expr = makeExprChannel({ rejectSlots: ["eye-blink-left"] });
  /** @type {any[]} */
  const diags = [];
  /** @type {any[]} */
  const expressions = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "<smile>ね" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: expr.channel,
    player: fakePlayer,
    onDiagnostic: (d) => diags.push(d),
    onExpression: (e) => expressions.push(e)
  });

  const result = await orch.fire();
  // 発話は走る・soul 記録される（rejected でも止まらない）。
  assert.equal(result.fired, true);
  assert.equal(fakeSpeak.spoken.length, 1);
  assert.equal(buffer.all()[1].text, "ね");
  // 部分適用: 4 スロット中 1 rejected・3 applied。
  assert.deepEqual(expressions, [{ word: "smile", applied: 3, rejected: 1 }]);
  const rejDiag = diags.find((d) => d.type === "expressionRejected");
  assert.ok(rejDiag);
  assert.equal(rejDiag.slotId, "eye-blink-left");
  orch.dispose();
});

test("fire: envelope 送出 throw も発話を止めない（診断へ握る）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const expr = makeExprChannel({ throwSlots: ["head-vertical"] });
  /** @type {any[]} */
  const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "うん<nod>" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: expr.channel,
    player: fakePlayer,
    onDiagnostic: (d) => diags.push(d)
  });

  const result = await orch.fire();
  assert.equal(result.fired, true); // speak は走る。
  assert.equal(fakeSpeak.spoken[0].text, "うん");
  const errDiag = diags.find((d) => d.type === "expressionSendError");
  assert.ok(errDiag);
  assert.equal(errDiag.slotId, "head-vertical");
  assert.match(errDiag.message, /boom/);
  orch.dispose();
});

test("fire: タグのみ応答は発話せず演出のみ実行（expression-only・soul 追記なし）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const expr = makeExprChannel();
  /** @type {any[]} */
  const expressions = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "<look-away>" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: expr.channel,
    player: fakePlayer,
    onExpression: (e) => expressions.push(e)
  });

  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "expression-only");
  assert.equal(result.expressed, true);
  // 発話しない・soul 追記しない。
  assert.equal(fakeSpeak.spoken.length, 0);
  assert.equal(buffer.all().length, 1);
  // 演出は実行される（look-away = gaze-horizontal + head-horizontal）。
  assert.equal(expr.envelopes.length, 2);
  assert.deepEqual(expressions, [{ word: "look-away", applied: 2, rejected: 0 }]);
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("fire: 未知タグは剥離 + expressionUnknownTag 診断・speechText は発話される", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const expr = makeExprChannel();
  /** @type {any[]} */
  const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "やあ<wink>げんき？" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: expr.channel,
    player: fakePlayer,
    onDiagnostic: (d) => diags.push(d)
  });

  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.equal(fakeSpeak.spoken[0].text, "やあげんき？"); // 未知タグは声に出ない。
  assert.equal(expr.envelopes.length, 0); // 未知タグは演出もしない。
  assert.deepEqual(diags, [{ type: "expressionUnknownTag", tag: "wink" }]);
  orch.dispose();
});

test("fire: 未知タグのみ応答は fireEmptyReply（発話も演出もしない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const expr = makeExprChannel();
  /** @type {any[]} */
  const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "<wink>" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: expr.channel,
    player: fakePlayer,
    onDiagnostic: (d) => diags.push(d)
  });

  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "empty-reply");
  assert.equal(fakeSpeak.spoken.length, 0);
  assert.equal(expr.envelopes.length, 0);
  assert.equal(buffer.all().length, 1);
  // 未知タグ診断 + fireEmptyReply 両方が出る。
  assert.ok(diags.some((d) => d.type === "expressionUnknownTag" && d.tag === "wink"));
  assert.ok(diags.some((d) => d.type === "fireEmptyReply"));
  orch.dispose();
});

test("fire: 強さ係数で全 peak がスケールされて envelope へ乗る", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const expr = makeExprChannel();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "うん<nod>" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: expr.channel,
    player: fakePlayer,
    expressionIntensity: 0.5
  });

  await orch.fire();
  assert.equal(expr.envelopes.length, 1);
  // nod.head-vertical=-0.35 → ×0.5 = -0.175。
  assert.ok(Math.abs(expr.envelopes[0].peak - -0.175) < 1e-9);
  orch.dispose();
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

// ── usage 計器（S5・通常 Fire でも発火する・wave 計画 §2 裁定 2）───────────────────

test("fire: 通常 Fire でも usage が onUsage へ {usage, vision:false} で通知される", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  /** @type {any[]} */
  const usages = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "うん", usage: { input_tokens: 42 } }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onUsage: (u) => usages.push(u)
  });
  await orch.fire();
  assert.deepEqual(usages, [{ usage: { input_tokens: 42 }, vision: false }]);
  orch.dispose();
});

test("fire: usage が null/undefined のときは onUsage を発火しない", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  /** @type {any[]} */
  const usages = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "うん" }; } }, // usage 省略。
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onUsage: (u) => usages.push(u)
  });
  await orch.fire();
  assert.equal(usages.length, 0);
  orch.dispose();
});

// ── S5「目が開く」視覚発火（fire({ vision: true })）の縦検証 ────────────────────────
// 通常 fire() の署名・挙動は上のテスト群で不変が担保済み（無退行）。ここでは第二発火種別のみを検証する。
// capture/session/channel は全て fake（実 SDK・実 PowerShell は一切引かない）。

/** captureImpl の fake（呼び出しタイトルを記録し、固定結果を返す）。 */
function makeFakeCapture(result) {
  /** @type {string[]} */
  const calls = [];
  return {
    calls,
    captureImpl: async (/** @type {string} */ title) => {
      calls.push(title);
      return result;
    }
  };
}

test("fire(vision): 成功時は [image(先行), text] を session.ask へ渡し・speak は speechText のみ・会話ログに画像を積まず・onVisionCaptured が base64 付きで発火する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("ねえ、これ見て");
  const fakeSpeak = makeFakeSpeak();
  const capture = makeFakeCapture({ jpegBase64: "ZmFrZQ==", width: 800, height: 600, elapsedMs: 123 });
  /** @type {any[]} */
  const askCalls = [];
  /** @type {any[]} */
  const visionCaptures = [];
  /** @type {any[]} */
  const usages = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input) {
        askCalls.push(input);
        return { replyText: "画面見えるよ<nod>", usage: { input_tokens: 900 } };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => "テストゲーム",
    onVisionCaptured: (info) => visionCaptures.push(info),
    onUsage: (u) => usages.push(u)
  });

  const result = await orch.fire({ vision: true });
  assert.equal(result.fired, true);
  assert.equal(result.vision, true);
  assert.equal(result.replyText, "画面見えるよ");

  // captureImpl は解決されたタイトルで 1 回だけ呼ばれる。
  assert.deepEqual(capture.calls, ["テストゲーム"]);

  // session.ask には content 配列（画像が先頭・text が続く）が渡る。
  assert.equal(askCalls.length, 1);
  const contentBlocks = askCalls[0];
  assert.ok(Array.isArray(contentBlocks));
  assert.equal(contentBlocks.length, 2);
  assert.equal(contentBlocks[0].type, "image");
  assert.equal(contentBlocks[0].source.type, "base64");
  assert.equal(contentBlocks[0].source.data, "ZmFrZQ==");
  assert.equal(contentBlocks[0].source.media_type, "image/jpeg");
  assert.equal(contentBlocks[1].type, "text");
  assert.match(contentBlocks[1].text, /you: ねえ、これ見て/);
  assert.match(contentBlocks[1].text, /今の画面を見て/);

  // speak は speechText のみ（タグ抜き）。
  assert.equal(fakeSpeak.spoken.length, 1);
  assert.equal(fakeSpeak.spoken[0].text, "画面見えるよ");

  // 会話ログ正本は speechText のみ・画像 base64 は一切積まれない（ディスク非保存の流儀を会話ログにも適用）。
  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.equal(all[1].text, "画面見えるよ");
  assert.equal(all[1].speaker, "soul");
  assert.ok(!JSON.stringify(all).includes("ZmFrZQ=="));

  // 「見た」事実は onVisionCaptured にだけ base64 付きで通知される。
  assert.equal(visionCaptures.length, 1);
  assert.deepEqual(visionCaptures[0], {
    title: "テストゲーム",
    width: 800,
    height: 600,
    jpegBase64: "ZmFrZQ==",
    elapsedMs: 123
  });

  // usage は {usage, vision:true} で通知される。
  assert.deepEqual(usages, [{ usage: { input_tokens: 900 }, vision: true }]);

  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

for (const kind of ["notFound", "minimized", "failed", "timeout"]) {
  test(`fire(vision): キャプチャ失敗(${kind})は session.ask を呼ばず正直に中止する（成功を捏造しない）`, { timeout: 5000 }, async () => {
    const buffer = bufferWithYou();
    const fakeSpeak = makeFakeSpeak();
    const capture = makeFakeCapture({ error: { kind, message: `boom:${kind}` } });
    let askCalled = false;
    /** @type {any[]} */
    const diags = [];
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session: {
        async ask() {
          askCalled = true;
          return { replyText: "x" };
        }
      },
      speakImpl: fakeSpeak.speakImpl,
      channel: fakeChannel,
      player: fakePlayer,
      captureImpl: capture.captureImpl,
      getVisionTarget: () => "テストゲーム",
      onDiagnostic: (d) => diags.push(d)
    });

    const result = await orch.fire({ vision: true });
    assert.equal(result.fired, false);
    assert.equal(result.reason, "vision-capture-failed");
    assert.equal(result.kind, kind);
    // 盲目のまま撃たない: session.ask は呼ばれない・発話しない。
    assert.equal(askCalled, false);
    assert.equal(fakeSpeak.spoken.length, 0);
    assert.equal(buffer.all().length, 1); // soul 追記なし。
    const visionDiag = diags.find((d) => d.type === "fireVisionError");
    assert.ok(visionDiag, "fireVisionError 診断が出る");
    assert.equal(visionDiag.kind, kind);
    assert.match(visionDiag.message, new RegExp(kind));
    assert.equal(orch.getState(), "idle");
    orch.dispose();
  });
}

test("fire(vision): 対象未設定（getVisionTarget→null）は session.ask を呼ばず fireVisionError(no-target)・ゴースト", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  let askCalled = false;
  /** @type {any[]} */
  const diags = [];
  /** @type {any[]} */
  const fires = [];
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
    getVisionTarget: () => null,
    onDiagnostic: (d) => diags.push(d),
    onFire: (f) => fires.push(f)
  });

  const result = await orch.fire({ vision: true });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "vision-no-target");
  assert.equal(askCalled, false);
  const visionDiag = diags.find((d) => d.type === "fireVisionError");
  assert.ok(visionDiag);
  assert.equal(visionDiag.kind, "no-target");
  assert.ok(fires.some((f) => f.accepted === false && f.reason === "vision-no-target"));
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("fire(vision): getVisionTarget 未注入（既定）も対象未設定として正直に中止する", { timeout: 5000 }, async () => {
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
    player: fakePlayer
    // getVisionTarget を注入しない。
  });
  const result = await orch.fire({ vision: true });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "vision-no-target");
  assert.equal(askCalled, false);
  orch.dispose();
});

test("fire(vision): getVisionTarget が throw しても no-target として正直に中止する（盲目のまま撃たない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  let askCalled = false;
  /** @type {any[]} */
  const diags = [];
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
    getVisionTarget: () => {
      throw new Error("boom");
    },
    onDiagnostic: (d) => diags.push(d)
  });
  const result = await orch.fire({ vision: true });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "vision-no-target");
  assert.equal(askCalled, false);
  assert.ok(diags.some((d) => d.type === "fireVisionError" && d.kind === "no-target"));
  orch.dispose();
});

test("fire(vision): busy 中（通常 Fire の thinking 中）は無視される・キャプチャすら呼ばれない", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const gate = deferred();
  let askCount = 0;
  const capture = makeFakeCapture({ jpegBase64: "ZmFrZQ==", width: 100, height: 100, elapsedMs: 1 });

  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask() {
        askCount += 1;
        await gate.promise; // 通常 Fire を thinking に留める。
        return { replyText: "はーい" };
      }
    },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => "テストゲーム"
  });

  const first = orch.fire(); // 通常 Fire・await しない（thinking で留まる）。
  await Promise.resolve();
  assert.equal(orch.getState(), "thinking");

  const second = await orch.fire({ vision: true }); // busy で即返る。
  assert.equal(second.fired, false);
  assert.equal(second.reason, "busy");
  assert.equal(capture.calls.length, 0); // キャプチャすら呼ばれない。

  gate.resolve();
  const firstResult = await first;
  assert.equal(firstResult.fired, true);
  assert.equal(askCount, 1);
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("fire(vision): 耳未起動（getBuffer=null）は通常 Fire 同様 ears-not-running", { timeout: 5000 }, async () => {
  const orch = createFireOrchestrator({
    getBuffer: () => null,
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    getVisionTarget: () => "テストゲーム"
  });
  const result = await orch.fire({ vision: true });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "ears-not-running");
  orch.dispose();
});

test("fire(vision): dispose 後の視覚発火は拒否", { timeout: 5000 }, async () => {
  const orch = createFireOrchestrator({
    getBuffer: () => bufferWithYou(),
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    getVisionTarget: () => "テストゲーム"
  });
  orch.dispose();
  const result = await orch.fire({ vision: true });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "disposed");
});

test("FIRE_SYSTEM_PROMPT: 画面が渡ることがある旨の最小追記を含む", () => {
  assert.match(FIRE_SYSTEM_PROMPT, /画面/);
});

// ── S6 追撃「自発発火に画像同乗」視覚優先モード（fire({ vision: "preferred" })）の縦検証 ──────────
// 人間ゲート裁定: 自発 call/turn-end を、対象設定済みなら画像付き発火へ格上げ。対象未設定/キャプチャ失敗は
// **中止せず画像なしの通常発火へ静かに劣化**（fireVision の「見えなければ中止」とは違う）。手動 Fire・
// 手動視覚 Fire・沈黙（fire({vision:true})）の挙動は上のテスト群で不変を担保済み（無退行）。全 fake。

test('fire(vision:"preferred"): 対象あり+キャプチャ成功は画像付き発火へ格上げ（手動視覚 Fire と同経路・vision:true）', { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("ねえ、これ見て");
  const fakeSpeak = makeFakeSpeak();
  const capture = makeFakeCapture({ jpegBase64: "ZmFrZQ==", width: 800, height: 600, elapsedMs: 42 });
  /** @type {any[]} */ const askCalls = [];
  /** @type {any[]} */ const visionCaptures = [];
  /** @type {any[]} */ const usages = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input) {
        askCalls.push(input);
        return { replyText: "見えるよ<nod>", usage: { input_tokens: 700 } };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => "テストゲーム",
    onVisionCaptured: (info) => visionCaptures.push(info),
    onUsage: (u) => usages.push(u)
  });

  const result = await orch.fire({ vision: "preferred" });
  assert.equal(result.fired, true);
  assert.equal(result.vision, true); // 実際に画像を撃った → 正直に vision:true。
  assert.equal(result.replyText, "見えるよ");
  // キャプチャ 1 回・content 配列（画像先行）で ask。
  assert.deepEqual(capture.calls, ["テストゲーム"]);
  const contentBlocks = askCalls[0];
  assert.ok(Array.isArray(contentBlocks));
  assert.equal(contentBlocks[0].type, "image");
  assert.equal(contentBlocks[0].source.data, "ZmFrZQ==");
  assert.match(contentBlocks[1].text, /今の画面を見て/);
  // onVisionCaptured 発火・usage vision:true。
  assert.equal(visionCaptures.length, 1);
  assert.deepEqual(usages, [{ usage: { input_tokens: 700 }, vision: true }]);
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test('fire(vision:"preferred"): 対象未設定は中止せず画像なしの通常発火（vision-no-target ではない・vision:false）', { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("きょうは良い天気");
  const fakeSpeak = makeFakeSpeak();
  const capture = makeFakeCapture({ jpegBase64: "x", width: 1, height: 1, elapsedMs: 1 });
  /** @type {any[]} */ const askCalls = [];
  /** @type {any[]} */ const visionCaptures = [];
  /** @type {any[]} */ const usages = [];
  /** @type {any[]} */ const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input) {
        askCalls.push(input);
        return { replyText: "そうだね", usage: { input_tokens: 30 } };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => null, // 対象未設定。
    onVisionCaptured: (info) => visionCaptures.push(info),
    onUsage: (u) => usages.push(u),
    onDiagnostic: (d) => diags.push(d)
  });

  const result = await orch.fire({ vision: "preferred" });
  // 中止しない: 通常発火が成立する（fireVision の vision-no-target 中止とは違う挙動）。
  assert.equal(result.fired, true);
  assert.equal(result.vision, undefined); // 画像なし ask → vision フラグは立たない（正直）。
  assert.equal(result.replyText, "そうだね");
  // キャプチャは呼ばれない・画像なしの文字列 ask。
  assert.equal(capture.calls.length, 0);
  assert.equal(typeof askCalls[0], "string");
  assert.match(askCalls[0], /you: きょうは良い天気/);
  // onVisionCaptured 非発火・usage vision:false・vision-no-target 診断なし。
  assert.equal(visionCaptures.length, 0);
  assert.deepEqual(usages, [{ usage: { input_tokens: 30 }, vision: false }]);
  assert.ok(!diags.some((d) => d.type === "fireVisionError"));
  assert.equal(fakeSpeak.spoken[0].text, "そうだね");
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test('fire(vision:"preferred"): getVisionTarget 未注入（既定）も通常発火へ劣化（中止しない）', { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  let askInput = /** @type {any} */ (null);
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input) {
        askInput = input;
        return { replyText: "うん" };
      }
    },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer
    // getVisionTarget を注入しない。
  });
  const result = await orch.fire({ vision: "preferred" });
  assert.equal(result.fired, true);
  assert.equal(result.vision, undefined);
  assert.equal(typeof askInput, "string"); // 画像なしの文字列 ask。
  orch.dispose();
});

for (const kind of ["notFound", "minimized", "failed", "timeout"]) {
  test(`fire(vision:"preferred"): キャプチャ失敗(${kind})は中止せず画像なし通常発火へ劣化+fireVisionDegraded 診断`, { timeout: 5000 }, async () => {
    const buffer = bufferWithYou("これどう？");
    const fakeSpeak = makeFakeSpeak();
    const capture = makeFakeCapture({ error: { kind, message: `boom:${kind}` } });
    /** @type {any[]} */ const askCalls = [];
    /** @type {any[]} */ const visionCaptures = [];
    /** @type {any[]} */ const usages = [];
    /** @type {any[]} */ const diags = [];
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session: {
        async ask(input) {
          askCalls.push(input);
          return { replyText: "いいね", usage: { input_tokens: 55 } };
        }
      },
      speakImpl: fakeSpeak.speakImpl,
      channel: fakeChannel,
      player: fakePlayer,
      captureImpl: capture.captureImpl,
      getVisionTarget: () => "テストゲーム",
      onVisionCaptured: (info) => visionCaptures.push(info),
      onUsage: (u) => usages.push(u),
      onDiagnostic: (d) => diags.push(d)
    });

    const result = await orch.fire({ vision: "preferred" });
    // 劣化して通常発火が成立する（vision-capture-failed 中止とは違う）。
    assert.equal(result.fired, true);
    assert.equal(result.vision, undefined); // 実際は画像なし ask → 正直に vision なし。
    assert.equal(result.replyText, "いいね");
    // キャプチャは 1 回試みたが、以降は画像なしの文字列 ask。
    assert.deepEqual(capture.calls, ["テストゲーム"]);
    assert.equal(typeof askCalls[0], "string");
    assert.match(askCalls[0], /you: これどう？/);
    // 劣化痕跡: fireVisionDegraded 診断（kind + message・ゴースト行の材料）。
    const deg = diags.find((d) => d.type === "fireVisionDegraded");
    assert.ok(deg, "fireVisionDegraded 診断が出る");
    assert.equal(deg.kind, kind);
    assert.match(deg.message, new RegExp(kind));
    // vision-capture-failed の中止診断（fireVisionError）は出ない。
    assert.ok(!diags.some((d) => d.type === "fireVisionError"));
    // onVisionCaptured 非発火（見えていない）・usage vision:false（正直）。
    assert.equal(visionCaptures.length, 0);
    assert.deepEqual(usages, [{ usage: { input_tokens: 55 }, vision: false }]);
    assert.equal(orch.getState(), "idle");
    orch.dispose();
  });
}

test('fire(vision:"preferred"): 劣化フォールバックでも onFire accept は 1 回だけ（二重受理しない）', { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const capture = makeFakeCapture({ error: { kind: "failed", message: "boom" } });
  /** @type {any[]} */ const fires = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "はい" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => "テストゲーム",
    onFire: (f) => fires.push(f)
  });
  await orch.fire({ vision: "preferred" });
  // accept は 1 回（vision:true の受理）。劣化後の通常 ask は accept を再 emit しない。
  const accepts = fires.filter((f) => f.accepted === true);
  assert.equal(accepts.length, 1);
  assert.equal(accepts[0].vision, true);
  orch.dispose();
});

test('fire(vision:"preferred"): 対象未設定+空窓は通常 Fire と同じ empty-window で中止（フォールバックが空窓ガードを通る）', { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  let askCalled = false;
  /** @type {any[]} */ const fires = [];
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
    getVisionTarget: () => null, // 対象未設定 → 通常 Fire フォールバック。
    windowMs: 0,
    nowImpl: () => Date.now() + 10_000, // 全エントリを窓外へ。
    onFire: (f) => fires.push(f)
  });
  const result = await orch.fire({ vision: "preferred" });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "empty-window");
  assert.equal(askCalled, false);
  assert.ok(fires.some((f) => f.accepted === false && f.reason === "empty-window"));
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test('fire(vision:"preferred"): busy 中は無視・キャプチャすら呼ばれない（通常 Fire と共有の判定）', { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const gate = deferred();
  const capture = makeFakeCapture({ jpegBase64: "x", width: 1, height: 1, elapsedMs: 1 });
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask() {
        await gate.promise;
        return { replyText: "はーい" };
      }
    },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => "テストゲーム"
  });
  const first = orch.fire(); // 通常 Fire を thinking に留める。
  await Promise.resolve();
  assert.equal(orch.getState(), "thinking");
  const second = await orch.fire({ vision: "preferred" });
  assert.equal(second.fired, false);
  assert.equal(second.reason, "busy");
  assert.equal(capture.calls.length, 0);
  gate.resolve();
  await first;
  orch.dispose();
});

test('fire(vision:"preferred"): 耳未起動は ears-not-running（通常 Fire と共有）', { timeout: 5000 }, async () => {
  const orch = createFireOrchestrator({
    getBuffer: () => null,
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    getVisionTarget: () => "テストゲーム"
  });
  const result = await orch.fire({ vision: "preferred" });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "ears-not-running");
  orch.dispose();
});

// ── S6「会話が続く」barge-in（interrupt・再生実区間追跡・切断点・soul 追記タイミング）───────────
// 全 fake（player.stop / channel.sendSet / 注入 timer / 注入 nowImpl 相当の atMs）で縦検証する。
// 実マイク・実器・実 SDK は一切引かない。soul 追記タイミングの変更（速speak 直後 → 完了/中断時）を固定する。

/** 「こんにちは」5 母音の等間隔タイムライン（pre 100ms・100ms 間隔）。切断点算出の材料。 */
const BARGE_TIMELINE = [
  { timeMs: 100, vowel: "o", s: 0.6 },
  { timeMs: 200, vowel: "o", s: 0.6 },
  { timeMs: 300, vowel: "i", s: 0.5 },
  { timeMs: 400, vowel: "i", s: 0.5 },
  { timeMs: 500, vowel: "a", s: 0.85 }
];

/** timeline・wavDurationSec・playbackStartedAtMs を返す fake speak（barge-in 材料込み）。 */
function makeBargeSpeak({ timeline = BARGE_TIMELINE, wavDurationSec = 2, playbackStartedAtMs = 1000 } = {}) {
  const spoken = [];
  return {
    spoken,
    speakImpl: async (text, deps) => {
      spoken.push({ text, deps });
      return { timeline, rttMs: 0, wavDurationSec, wavPath: "C:/tmp/fake.wav", playbackStartedAtMs };
    }
  };
}

/** sendSpeech/sendSet を記録する fake channel。setResult で口閉じの accepted/rejected/throw を切替。 */
function makeBargeChannel({ setResult } = {}) {
  const sets = [];
  return {
    sets,
    channel: {
      sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }),
      sendSet: async (/** @type {any} */ intent) => {
        sets.push(intent);
        if (typeof setResult === "function") return setResult(intent);
        return setResult ?? { result: "accepted", error: null, rttMs: 0 };
      }
    }
  };
}

/** play/stop 回数を記録する fake player。 */
function makeStopPlayer() {
  const calls = { play: 0, stop: 0 };
  return { calls, player: { play() { calls.play += 1; }, stop() { calls.stop += 1; } } };
}

/** 手動 fake タイマ（barge-in.test.mjs と同型・決定論）。 */
function makeFakeTimers() {
  let now = 0;
  let seq = 0;
  /** @type {Map<number, { fn: () => void; at: number }>} */
  const timers = new Map();
  const setTimeoutImpl = /** @type {any} */ ((fn, ms) => {
    const id = (seq += 1);
    timers.set(id, { fn, at: now + ms });
    return id;
  });
  const clearTimeoutImpl = /** @type {any} */ ((id) => {
    timers.delete(id);
  });
  const advance = (ms) => {
    const target = now + ms;
    for (;;) {
      /** @type {{ id: number; at: number; fn: () => void } | null} */
      let next = null;
      for (const [id, t] of timers) {
        if (t.at <= target && (next === null || t.at < next.at || (t.at === next.at && id < next.id))) {
          next = { id, at: t.at, fn: t.fn };
        }
      }
      if (next === null) break;
      timers.delete(next.id);
      now = next.at;
      next.fn();
    }
    now = target;
  };
  return { setTimeoutImpl, clearTimeoutImpl, advance, pending: () => timers.size };
}

/** マイクロタスクを十分に流す（fire の内部 await を進めて speaking/再生追跡へ到達させる）。 */
async function flushMicrotasks(n = 40) {
  for (let i = 0; i < n; i += 1) await Promise.resolve();
}

test("interrupt: 再生中の barge-in で声を止め・口を閉じ・接頭辞+注記を soul に 1 回追記・bargeIn 診断", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("ねえ、聞いてる？");
  const speak = makeBargeSpeak({ wavDurationSec: 2, playbackStartedAtMs: 1000 });
  const ch = makeBargeChannel();
  const pl = makeStopPlayer();
  const timers = makeFakeTimers();
  /** @type {any[]} */ const diags = [];
  /** @type {any[]} */ const souls = [];
  /** @type {string[]} */ const states = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    speakImpl: speak.speakImpl,
    channel: ch.channel,
    player: pl.player,
    onState: (s) => states.push(s),
    onDiagnostic: (d) => diags.push(d),
    onSoulTranscript: (e) => souls.push(e),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  const p = orch.fire();
  await flushMicrotasks();
  // 再生実区間の間 speaking を保つ（従来は speak 直後 idle だった）。
  assert.equal(orch.getState(), "speaking");
  // まだ soul は積まれていない（追記は完了/中断時・タイミング変更）。
  assert.equal(buffer.all().length, 1);

  // 再生開始から 350ms（=3 母音オンセット通過）で barge-in。
  const info = await orch.interrupt(1350);
  assert.equal(info.interrupted, true);
  assert.equal(info.charsSpoken, 3);
  assert.equal(info.prefix, "こんに");

  const result = await p;
  assert.equal(result.fired, true);
  assert.equal(result.interrupted, true);
  assert.equal(result.replyText, "こんに");

  // ① 声を止めた。
  assert.equal(pl.calls.stop, 1);
  // ② 口を閉じた（mouth-open value=0・短 ttl）。
  assert.equal(ch.sets.length, 1);
  assert.deepEqual(ch.sets[0], { slotId: "mouth-open", value: 0, ttlMs: MOUTH_CLOSE_TTL_MS });
  // ③④ soul は「接頭辞 + 中断注記」の 1 エントリ（append-only・上書きなし）。
  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.equal(all[1].speaker, "soul");
  assert.equal(all[1].text, "こんに" + BARGE_IN_NOTE);
  assert.equal(souls.length, 1);
  // ⑤ bargeIn 診断（切断点・声に出た文字数）。
  const bi = diags.find((d) => d.type === "bargeIn");
  assert.ok(bi, "bargeIn 診断が出る");
  assert.equal(bi.elapsedMs, 350);
  assert.equal(bi.charsSpoken, 3);
  assert.equal(bi.totalChars, 5);
  // 状態は speaking を経て idle。
  assert.equal(orch.getState(), "idle");
  assert.deepEqual(states, ["thinking", "speaking", "idle"]);

  // 二度目の interrupt は no-op（冪等）。
  const info2 = await orch.interrupt(1400);
  assert.equal(info2.interrupted, false);
  assert.equal(buffer.all().length, 2); // 追記は増えない。
  orch.dispose();
});

test("interrupt なし: 自然完了で全文を soul 追記（完了時タイミング・中断注記なし・stop/口閉じなし）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const speak = makeBargeSpeak({ wavDurationSec: 2, playbackStartedAtMs: 1000 });
  const ch = makeBargeChannel();
  const pl = makeStopPlayer();
  const timers = makeFakeTimers();
  /** @type {any[]} */ const souls = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    speakImpl: speak.speakImpl,
    channel: ch.channel,
    player: pl.player,
    onSoulTranscript: (e) => souls.push(e),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  const p = orch.fire();
  await flushMicrotasks();
  assert.equal(orch.getState(), "speaking");
  // 完了前は soul 未追記（タイミング変更の要）。
  assert.equal(buffer.all().length, 1);

  // 再生尺 2000ms 経過 → 自然完了。
  timers.advance(2000);
  const result = await p;
  assert.equal(result.fired, true);
  assert.equal(result.interrupted, undefined);
  assert.equal(result.replyText, "こんにちは");

  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.equal(all[1].text, "こんにちは"); // 全文・注記なし。
  assert.equal(souls.length, 1);
  assert.equal(pl.calls.stop, 0); // 止めていない。
  assert.equal(ch.sets.length, 0); // 口閉じもしていない。
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("interrupt: 発話中でなければ no-op（idle 時・声を止めない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const pl = makeStopPlayer();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: pl.player
  });
  const info = await orch.interrupt(1000);
  assert.equal(info.interrupted, false);
  assert.equal(info.reason, "not-speaking");
  assert.equal(pl.calls.stop, 0);
  orch.dispose();
});

test("interrupt: 口閉じ rejected でも中断は続く（診断に握る・接頭辞は soul へ追記）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const speak = makeBargeSpeak({ wavDurationSec: 2, playbackStartedAtMs: 1000 });
  const ch = makeBargeChannel({
    setResult: () => ({ result: "rejected", error: { code: "slotValueOutOfRange" }, rttMs: 0 })
  });
  const pl = makeStopPlayer();
  const timers = makeFakeTimers();
  /** @type {any[]} */ const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    speakImpl: speak.speakImpl,
    channel: ch.channel,
    player: pl.player,
    onDiagnostic: (d) => diags.push(d),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  const p = orch.fire();
  await flushMicrotasks();
  const info = await orch.interrupt(1250); // elapsed 250 → 2 母音 → "こん"
  assert.equal(info.interrupted, true);
  assert.equal(info.prefix, "こん");
  await p;
  // 声は止めた・soul は接頭辞+注記が積まれた（rejected でも中断は完了する）。
  assert.equal(pl.calls.stop, 1);
  assert.equal(buffer.all()[1].text, "こん" + BARGE_IN_NOTE);
  // 口閉じ rejected 診断が出る。
  assert.ok(diags.some((d) => d.type === "bargeInMouthCloseRejected" && d.slotId === "mouth-open"));
  orch.dispose();
});

test("interrupt/dispose: 再生中に dispose すると await を安全に解放（soul 追記せず disposed で畳む）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const speak = makeBargeSpeak({ wavDurationSec: 5, playbackStartedAtMs: 1000 });
  const timers = makeFakeTimers();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    speakImpl: speak.speakImpl,
    channel: makeBargeChannel().channel,
    player: makeStopPlayer().player,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  const p = orch.fire();
  await flushMicrotasks();
  assert.equal(orch.getState(), "speaking");
  orch.dispose();
  const result = await p;
  assert.equal(result.fired, false);
  assert.equal(result.reason, "disposed");
  assert.equal(buffer.all().length, 1); // soul 追記なし。
  // dispose 後の interrupt も安全（no-op）。
  const info = await orch.interrupt(2000);
  assert.equal(info.interrupted, false);
});

test("結線: createBargeInGate 確定 → orchestrator.interrupt（VAD 縦検証・全 fake）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const speak = makeBargeSpeak({ wavDurationSec: 3, playbackStartedAtMs: 1000 });
  const ch = makeBargeChannel();
  const pl = makeStopPlayer();
  const orchTimers = makeFakeTimers();
  const gateTimers = makeFakeTimers();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    speakImpl: speak.speakImpl,
    channel: ch.channel,
    player: pl.player,
    setTimeoutImpl: orchTimers.setTimeoutImpl,
    clearTimeoutImpl: orchTimers.clearTimeoutImpl
  });
  // 結線層と同じ形: VAD イベント → 機械弁 → 確定 → interrupt。
  const gate = createBargeInGate({
    onConfirm: () => { void orch.interrupt(1300); }, // 中断時刻 1300 → elapsed 300 → 2 母音 → "こん"
    minSpeechMs: 200,
    setTimeoutImpl: gateTimers.setTimeoutImpl,
    clearTimeoutImpl: gateTimers.clearTimeoutImpl
  });

  const p = orch.fire();
  await flushMicrotasks();
  assert.equal(orch.getState(), "speaking");

  // ユーザーが喋り出す → 機械弁通過（cancel 来ない）→ 確定 → interrupt。
  gate.handle({ type: "speechStart", tMs: 1200 });
  gateTimers.advance(200);
  await flushMicrotasks();

  const result = await p;
  assert.equal(result.interrupted, true);
  assert.equal(result.replyText, "こん");
  assert.equal(pl.calls.stop, 1);
  assert.equal(ch.sets.length, 1);
  gate.dispose();
  orch.dispose();
});

test("結線: 窓内 speechCancel は interrupt を呼ばず自然完了する（瞬間スパイクでは声を止めない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const speak = makeBargeSpeak({ wavDurationSec: 3, playbackStartedAtMs: 1000 });
  const ch = makeBargeChannel();
  const pl = makeStopPlayer();
  const orchTimers = makeFakeTimers();
  const gateTimers = makeFakeTimers();
  let interruptCount = 0;
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    speakImpl: speak.speakImpl,
    channel: ch.channel,
    player: pl.player,
    setTimeoutImpl: orchTimers.setTimeoutImpl,
    clearTimeoutImpl: orchTimers.clearTimeoutImpl
  });
  const gate = createBargeInGate({
    onConfirm: () => { interruptCount += 1; void orch.interrupt(1300); },
    minSpeechMs: 200,
    setTimeoutImpl: gateTimers.setTimeoutImpl,
    clearTimeoutImpl: gateTimers.clearTimeoutImpl
  });

  const p = orch.fire();
  await flushMicrotasks();
  assert.equal(orch.getState(), "speaking");

  // 瞬間スパイク: speechStart → 窓内で speechCancel → 確定しない。
  gate.handle({ type: "speechStart", tMs: 1100 });
  gateTimers.advance(150);
  gate.handle({ type: "speechCancel", tMs: 1250 });
  gateTimers.advance(200);
  await flushMicrotasks();
  assert.equal(interruptCount, 0);
  assert.equal(pl.calls.stop, 0); // 声は止まっていない。

  // 自然完了で全文が積まれる。
  orchTimers.advance(3000);
  const result = await p;
  assert.equal(result.fired, true);
  assert.equal(result.interrupted, undefined);
  assert.equal(buffer.all()[1].text, "こんにちは");
  gate.dispose();
  orch.dispose();
});
