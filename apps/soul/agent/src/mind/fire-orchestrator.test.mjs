// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildFireSystemPrompt,
  createFireOrchestrator,
  FIRE_SYSTEM_PROMPT,
  PROGRESSIVE_CONTINUITY_INSTRUCTION,
  PROGRESSIVE_INTERRUPTION_NOTE,
  DEFAULT_CONVERSATION_INSTRUCTION_BODY,
  CONVERSATION_INSTRUCTION_BRAIN_IDS,
  resolveConversationInstructionProfile
} from "./fire-orchestrator.mjs";
import { MODEL_IDENTITIES } from "./model-identity.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { createBargeInGate, BARGE_IN_GRACE_MS, BARGE_IN_NOTE, KILL_NOTE, MOUTH_CLOSE_TTL_MS } from "./barge-in.mjs";
import { NG_WORDS, NG_BLOCKED_NOTE } from "./ng-words.mjs";
import { createProgressiveSpeechDelivery } from "../voice/progressive-speech-delivery.mjs";
import { formatTranscriptForDigest } from "./memory.mjs";

// 発火オーケストレータの縦貫通テスト（S3 Domain A）。実 SDK・実 TTS・実器は一切使わない
// （人間ゲートの領分）。fake session（ask がカナ応答）・fake speakImpl（テキスト記録）・
// fake channel/player・実 transcript-buffer で fire の縦串（窓収集→ask→speak→soul 記録）を固定する。
// 全テストにタイムアウトを付けハングさせない。
//
// 注意（S8 Domain C・NG 最終検査節）: 下記「NG 最終検査」節のテストは検問所の照合を直接検証する
// ため、`NG_WORDS`（実際の NG 実語・差別語級）をそのまま fake ask の応答文に埋め込む。これは
// health/照合の検証に不可欠であり（プレースホルダやダミー語では機能を検証できない）、
// `src/mind/ng-words.test.mjs` 冒頭の注意と同じ理由による。

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
  let reject;
  const promise = new Promise((r, j) => {
    resolve = r;
    reject = j;
  });
  return {
    promise,
    resolve: /** @type {(v?: any) => void} */ (resolve),
    reject: /** @type {(v?: any) => void} */ (reject)
  };
}

function makeProgressivePlayer() {
  const listeners = new Set();
  const plays = [];
  const playbackIds = [];
  let stops = 0;
  return {
    plays,
    playbackIds,
    get stops() { return stops; },
    play(path, playbackId) { plays.push(path); playbackIds.push(playbackId); },
    stop() { stops += 1; },
    subscribeOutput(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(line) {
      for (const listener of [...listeners]) listener(line);
    }
  };
}

function emitProgressiveOwned(player, type, index = player.plays.length - 1) {
  player.emit(`${type}\t${player.playbackIds[index]}\t${player.plays[index]}`);
}

function progressiveArtifact(text) {
  return {
    wavPath: `${text.charCodeAt(0)}.wav`,
    timeline: [{ timeMs: 0, vowel: "a", s: 0.5 }],
    wavDurationSec: 0.1,
    rawMoraCount: 1,
    wavBytes: 100,
    speechChars: text.length
  };
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

test("FIRE_SYSTEM_PROMPT: 自己名（コーディ）を含む（呼びかけ検出 NAME_VARIANTS_V0 と一致させる）", () => {
  assert.ok(FIRE_SYSTEM_PROMPT.includes("コーディ"), "自己名「コーディ」が含まれる");
});

test("buildFireSystemPrompt: GPT family は Chappy self-name を新規セッション用に生成する", () => {
  const prompt = buildFireSystemPrompt(MODEL_IDENTITIES.chappy);
  assert.match(prompt, /^あなたの名前はチャッピー（Chappy）です。/);
  assert.match(prompt, /相方/);
  assert.ok(!prompt.includes("コーディ（Cody）"));
});

test("buildFireSystemPrompt: unknown/absent identity は Cody 既定へ戻る", () => {
  assert.equal(buildFireSystemPrompt(), FIRE_SYSTEM_PROMPT);
  assert.equal(buildFireSystemPrompt({ id: "unknown" }), FIRE_SYSTEM_PROMPT);
});

test("conversation instruction profile: five technical brain ids resolve independently and preserve default bytes", () => {
  assert.deepEqual(CONVERSATION_INSTRUCTION_BRAIN_IDS, ["claude", "codex", "codex-55", "codex-56-sol", "codex-astra"]);
  const baseline = resolveConversationInstructionProfile("claude");
  assert.equal(baseline.body, DEFAULT_CONVERSATION_INSTRUCTION_BODY);
  assert.equal(buildFireSystemPrompt(MODEL_IDENTITIES.cody), FIRE_SYSTEM_PROMPT);
  const override = resolveConversationInstructionProfile("codex-55", {
    "codex-55": "Use a short custom response."
  });
  assert.equal(override.hasOverride, true);
  assert.equal(override.body, "Use a short custom response.");
  assert.equal(resolveConversationInstructionProfile("codex").hasOverride, false);
  const unknown = resolveConversationInstructionProfile("unknown", { claude: "must-not-leak", unknown: "bad" });
  assert.equal(unknown.brainId, "claude");
  assert.equal(unknown.body, DEFAULT_CONVERSATION_INSTRUCTION_BODY);
  assert.equal(resolveConversationInstructionProfile("codex", { codex: "   " }).body, DEFAULT_CONVERSATION_INSTRUCTION_BODY);
  const customPrompt = buildFireSystemPrompt(MODEL_IDENTITIES.chappy, override.body);
  assert.ok(customPrompt.includes(override.body));
  assert.ok(customPrompt.indexOf("チャッピー（Chappy）") < customPrompt.indexOf(override.body));
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

test("Fire diagnostics: expression と speech の request events は kind で混同されず、失敗境界を残す", async () => {
  const traces = [];
  const orch = createFireOrchestrator({
    getBuffer: () => bufferWithYou(),
    session: { async ask() { return { replyText: "うん<nod>" }; } },
    speakImpl: async (_text, deps) => {
      deps.onTrace("speech.timeline.built", { timelineCount: 3 });
      throw new Error("channel closed");
    },
    channel: makeExprChannel().channel,
    player: fakePlayer,
    onTrace: (trace) => traces.push(trace)
  });
  const result = await orch.fire();
  assert.equal(result.reason, "error");
  assert.ok(traces.some((trace) => trace.event === "expression.request.started" && trace.kind === "intent.envelope"));
  assert.ok(traces.some((trace) => trace.event === "speech.timeline.built" && trace.timelineCount === 3));
  assert.ok(
    traces.some(
      (trace) =>
        trace.event === "fire.failed" &&
        trace.stage === "fire.processing.unknown" &&
        trace.failureCode === "fire_processing_unknown"
    )
  );
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
  const traces = [];
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
    onDiagnostic: (d) => diags.push(d),
    onTrace: (trace) => traces.push(trace)
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
  assert.ok(traces.some((trace) => trace.event === "fire.failed" && trace.stage === "llm.ask" && trace.failureCode === "llm_ask_failed"));

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

  // ユーザーが喋り出す → 二段構え: 第一段（200ms ノイズ弁）通過（cancel 来ない）→ 第二段（猶予）へ →
  // 猶予満了まで speechEnd が来ない（喋り続けている）→ 確定 → interrupt。二段化（barge-in.mjs）に
  // 追随して advance を 200ms（第一段）+ BARGE_IN_GRACE_MS（第二段の猶予満了）に分けた。interrupt(1300)
  // の中断時刻は advance 量と独立なので replyText === "こん" の assert は不変（elapsed 300 → 2 母音）。
  gate.handle({ type: "speechStart", tMs: 1200 });
  gateTimers.advance(200); // 第一段（ノイズ弁）通過 → 即座に第二段（猶予）へ。
  gateTimers.advance(BARGE_IN_GRACE_MS); // 第二段の猶予満了（speechEnd 未着＝喋り続け）→ onConfirm→interrupt。
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

// ── S8「キルスイッチ」（キル = 声の即切断 + 全発火 OFF + 耳/転写生存 + 一クリック復帰）───────────
// 全 fake（player.stop / channel.sendSet / 注入 timer / deferred ask）で縦検証する。実 LLM・実 TTS・
// 実マイクは一切引かない。プロセス不殺・in-memory のみ（dispose とは別物 = kill 後も orchestrator は
// 生きていて revive で復帰できる）。

test("kill: idle 中キルは fire() を reason:'killed' で弾く（speakImpl 不呼び出し・onFire 通知）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  /** @type {any[]} */ const fires = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "はい" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onFire: (f) => fires.push(f)
  });

  const killResult = await orch.kill();
  assert.equal(killResult.killed, true);
  assert.equal(killResult.severed, false); // idle 中は severance 不要。

  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "killed");
  assert.equal(fakeSpeak.spoken.length, 0);
  assert.ok(fires.some((f) => f.accepted === false && f.reason === "killed"));
  orch.dispose();
});

test("kill: 再生中キルは声を止め・口を閉じ・soul へ prefix+KILL_NOTE を 1 回追記・kill 診断", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("ねえ、聞いてる？");
  const speak = makeBargeSpeak({ wavDurationSec: 2, playbackStartedAtMs: 1000 });
  const ch = makeBargeChannel();
  const pl = makeStopPlayer();
  const timers = makeFakeTimers();
  /** @type {any[]} */ const diags = [];
  /** @type {any[]} */ const souls = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    speakImpl: speak.speakImpl,
    channel: ch.channel,
    player: pl.player,
    onDiagnostic: (d) => diags.push(d),
    onSoulTranscript: (e) => souls.push(e),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  const p = orch.fire();
  await flushMicrotasks();
  assert.equal(orch.getState(), "speaking");
  assert.equal(buffer.all().length, 1); // 完了/中断前は soul 未追記。

  // 再生開始から 350ms（=3 母音オンセット通過）でキル。
  const killResult = await orch.kill(1350);
  assert.equal(killResult.killed, true);
  assert.equal(killResult.severed, true);
  assert.equal(killResult.charsSpoken, 3);
  assert.equal(killResult.prefix, "こんに");

  const result = await p;
  assert.equal(result.fired, true);
  assert.equal(result.interrupted, true);
  assert.equal(result.replyText, "こんに");

  // ① 声を止めた。② 口を閉じた（mouth-open value=0・短 ttl）。
  assert.equal(pl.calls.stop, 1);
  assert.equal(ch.sets.length, 1);
  assert.deepEqual(ch.sets[0], { slotId: "mouth-open", value: 0, ttlMs: MOUTH_CLOSE_TTL_MS });
  // soul は「接頭辞 + KILL_NOTE」の 1 エントリ（BARGE_IN_NOTE ではない）。
  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.equal(all[1].speaker, "soul");
  assert.equal(all[1].text, "こんに" + KILL_NOTE);
  assert.equal(souls.length, 1);
  // kill 診断（bargeIn ではなく kill・切断点・声に出た文字数）。
  const killDiag = diags.find((d) => d.type === "kill");
  assert.ok(killDiag, "kill 診断が出る");
  assert.equal(killDiag.elapsedMs, 350);
  assert.equal(killDiag.charsSpoken, 3);
  assert.equal(killDiag.totalChars, 5);
  assert.ok(!diags.some((d) => d.type === "bargeIn")); // bargeIn 診断は出ない。
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("kill: ask 待ち中（in-flight）にキルすると speak せず soul 追記せず killDiscarded のみ（本文は載せない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const gate = deferred();
  /** @type {any[]} */ const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask() {
        await gate.promise;
        return { replyText: "こっそり返ってきた応答テキスト" };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onDiagnostic: (d) => diags.push(d)
  });

  const p = orch.fire(); // await しない（thinking で ask 待ち）。
  await Promise.resolve();
  assert.equal(orch.getState(), "thinking");

  const killResult = await orch.kill();
  assert.equal(killResult.killed, true);
  assert.equal(killResult.severed, false); // まだ speak していない（currentPlayback null）。

  gate.resolve(); // ask を解放 → processAskedReply が in-flight キル検査に当たる。
  const result = await p;
  assert.equal(result.fired, false);
  assert.equal(result.reason, "killed-inflight");

  // 破棄: speak せず・soul 追記せず。
  assert.equal(fakeSpeak.spoken.length, 0);
  assert.equal(buffer.all().length, 1);
  // killDiscarded 診断のみ（type だけ・応答本文はどこにも載らない）。
  const discardDiag = diags.find((d) => d.type === "killDiscarded");
  assert.ok(discardDiag, "killDiscarded 診断が出る");
  assert.deepEqual(Object.keys(discardDiag), ["type"]);
  assert.ok(!JSON.stringify(diags).includes("こっそり")); // 応答本文の秘匿。
  assert.ok(!JSON.stringify(result).includes("こっそり"));
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("revive: 再生中キル後に revive すると次の fire() が普通に動く（残留なし）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("ねえ、聞いてる？");
  const speak = makeBargeSpeak({ wavDurationSec: 2, playbackStartedAtMs: 1000 });
  const ch = makeBargeChannel();
  const pl = makeStopPlayer();
  const timers = makeFakeTimers();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    speakImpl: speak.speakImpl,
    channel: ch.channel,
    player: pl.player,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  const p = orch.fire();
  await flushMicrotasks();
  await orch.kill(1350);
  const killedFireResult = await p; // kill 由来の中断が完走するのを待つ。
  assert.equal(killedFireResult.fired, true);
  assert.equal(killedFireResult.interrupted, true);
  assert.equal(orch.getState(), "idle"); // busy 固着なし。

  // キル中は弾かれる。
  const stillKilled = await orch.fire();
  assert.equal(stillKilled.reason, "killed");

  orch.revive();
  assert.equal(orch.getKilled(), false);

  // revive 後は普通に発火する（fired:true・speak 呼ばれる・soul 追記される・interrupted 汚染なし）。
  const second = orch.fire();
  await flushMicrotasks();
  assert.equal(orch.getState(), "speaking"); // busy 固着していない証拠（thinking→speaking に進めた）。
  timers.advance(2000); // 自然完了。
  const result = await second;
  assert.equal(result.fired, true);
  assert.equal(result.interrupted, undefined); // interrupted 汚染なし。
  assert.equal(speak.spoken.length, 2); // 1 回目（キルで中断）+ 2 回目（自然完了）。
  const all = buffer.all();
  assert.equal(all.length, 3); // you + kill 中断分の soul + 自然完了分の soul。
  assert.equal(all[2].text, "こんにちは");
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("revive: idle キル後に revive すると次の fire() が普通に動く（残留なし）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "はい" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer
  });

  await orch.kill();
  const killedResult = await orch.fire();
  assert.equal(killedResult.reason, "killed");

  orch.revive();
  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.equal(fakeSpeak.spoken.length, 1);
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test('kill: manual fire()・fire({vision:true})・fire({vision:"preferred"}) の全経路がキルで弾かれる', { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const capture = makeFakeCapture({ jpegBase64: "x", width: 1, height: 1, elapsedMs: 1 });
  let askCalled = false;
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
    getVisionTarget: () => "テストゲーム"
  });

  await orch.kill();

  const r1 = await orch.fire();
  assert.equal(r1.reason, "killed");
  const r2 = await orch.fire({ vision: true });
  assert.equal(r2.reason, "killed");
  const r3 = await orch.fire({ vision: "preferred" });
  assert.equal(r3.reason, "killed");

  assert.equal(askCalled, false);
  assert.equal(capture.calls.length, 0);
  assert.equal(fakeSpeak.spoken.length, 0);
  orch.dispose();
});

test("kill: born-killed（initialKilled:true）は生成直後の fire() から reason:'killed'", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    initialKilled: true
  });

  assert.equal(orch.getKilled(), true);
  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "killed");
  assert.equal(fakeSpeak.spoken.length, 0);
  orch.dispose();
});

test("kill: 耳系（transcript-buffer）に無影響——kill 後もバッファへ you 転写を append できる", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer
  });

  await orch.kill();
  // kill が buffer を壊さない: you 転写を追記できる（耳は生きている）。
  const appended = buffer.append({ startMs: 900, endMs: 1200, text: "まだ聞いてるよ" });
  assert.ok(appended.appended);
  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.equal(all[1].text, "まだ聞いてるよ");
  assert.equal(all[1].speaker, "you");
  orch.dispose();
});

test("kill/revive: 冪等・no-op（二度 kill しても安全・speaking でない kill は severance no-op・非 killed の revive は no-op）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const pl = makeStopPlayer();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "x" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: pl.player
  });

  // 非 killed 時の revive は no-op。
  orch.revive();
  assert.equal(orch.getKilled(), false);

  // speaking でない時の kill は severance no-op（player.stop 呼ばれない）。
  const k1 = await orch.kill();
  assert.equal(k1.severed, false);
  assert.equal(pl.calls.stop, 0);

  // 二度 kill しても安全（冪等）。
  const k2 = await orch.kill();
  assert.equal(k2.killed, true);
  assert.equal(k2.severed, false);
  assert.equal(pl.calls.stop, 0);

  orch.revive();
  orch.dispose();
});

// ── Codex Progressive Speech Wave 2 C1: incremental boundary integration ──────────

test("C1: delta は pure buffer へ一度だけ入り、最初の短い safe sentence を ask 完了前に enqueue・tag を除外・remainder を一度だけ flush する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("続けて");
  const fakeSpeak = makeFakeSpeak();
  const enqueued = [];
  const traces = [];
  let askReturned = false;
  let askCount = 0;
  const replyText = "うん。<smile>次だ";
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        askCount += 1;
        assert.equal(typeof askOptions?.onTextDelta, "function");
        askOptions.onTextDelta("う");
        assert.equal(enqueued.length, 0);
        askOptions.onTextDelta("ん。");
        assert.deepEqual(enqueued.map((entry) => entry.text), ["うん。"]);
        assert.equal(enqueued[0].askReturned, false, "first safe sentence enqueues before final ask result");
        askOptions.onTextDelta("<sm");
        askOptions.onTextDelta("ile>次");
        askOptions.onTextDelta("だ");
        askReturned = true;
        return { replyText, elapsedMs: 40 };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onProgressiveSentence: (chunk) => enqueued.push({ ...chunk, askReturned }),
    onTrace: (event) => traces.push(event)
  });

  const result = await orch.fire();
  assert.equal(askCount, 1, "one Fire remains one LLM turn");
  assert.deepEqual(enqueued, [
    { text: "うん。", index: 0, final: false, askReturned: false },
    { text: "次だ", index: 1, final: true, askReturned: true }
  ]);
  assert.ok(enqueued.every((entry) => !/[<>]/.test(entry.text)), "expression/control syntax never enters sentence delivery");
  assert.equal(traces.filter((event) => event.event === "progressive.boundary.flushed").length, 1);
  assert.equal(traces.filter((event) => event.event === "progressive.sentence.enqueued").length, 2);
  // C1 production default retains the existing one-shot playback until the C2
  // coordinator adapter owns the progressive consumer. The enqueue hook itself
  // is not playback, so the response is spoken exactly once, never per sentence.
  assert.deepEqual(fakeSpeak.spoken.map((entry) => entry.text), ["うん。次だ"]);
  assert.equal(result.fired, true);
  assert.equal(result.replyText, "うん。次だ");
  orch.dispose();
});

test("C1: NG word が transport delta 境界を跨いでも unsafe sentence 以降の enqueue を止め、safe prefix は保持する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("続けて");
  const fakeSpeak = makeFakeSpeak();
  const enqueued = [];
  const traces = [];
  const ngWord = NG_WORDS[0];
  const splitAt = Math.max(1, Math.floor(ngWord.length / 2));
  const firstHalf = ngWord.slice(0, splitAt);
  const secondHalf = ngWord.slice(splitAt);
  const replyText = `安全だ。${ngWord}。後続も安全。`;
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        askOptions.onTextDelta("安全だ。");
        askOptions.onTextDelta(firstHalf);
        assert.deepEqual(enqueued.map((entry) => entry.text), ["安全だ。"]);
        askOptions.onTextDelta(`${secondHalf}。後続も`);
        askOptions.onTextDelta("安全。");
        return { replyText };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onProgressiveSentence: (chunk) => enqueued.push(chunk),
    onTrace: (event) => traces.push(event)
  });

  const result = await orch.fire();
  assert.deepEqual(enqueued.map((entry) => entry.text), ["安全だ。"], "unsafe and later chunks are not delivered");
  assert.equal(traces.filter((event) => event.event === "progressive.boundary.blocked").length, 1);
  assert.equal(traces.filter((event) => event.event === "progressive.boundary.flushed").length, 1);
  assert.equal(fakeSpeak.spoken.length, 0, "existing full-response NG gate remains enabled");
  assert.equal(result.reason, "ng-blocked");
  assert.equal(buffer.all().at(-1).text, NG_BLOCKED_NOTE);
  orch.dispose();
});

test("C1: vision Fire も image-first content の一 ask に同じ delta boundary を一度だけ接続する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("これ見て");
  const fakeSpeak = makeFakeSpeak();
  const enqueued = [];
  const calls = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input, askOptions) {
        calls.push({ input, askOptions });
        askOptions.onTextDelta("見えた。");
        return { replyText: "見えた。" };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: async () => ({ jpegBase64: "ZmFrZQ==", width: 10, height: 10, elapsedMs: 1 }),
    getVisionTarget: () => "test-window",
    onProgressiveSentence: (chunk) => enqueued.push(chunk)
  });

  const result = await orch.fire({ vision: true });
  assert.equal(calls.length, 1);
  assert.ok(Array.isArray(calls[0].input));
  assert.equal(calls[0].input[0].type, "image");
  assert.equal(typeof calls[0].askOptions.onTextDelta, "function");
  assert.deepEqual(enqueued, [{ text: "見えた。", index: 0, final: false }]);
  assert.equal(result.fired, true);
  orch.dispose();
});

test("C1: non-streaming session は enqueue せず従来の final reply fallback を一度だけ発話する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  const enqueued = [];
  let askCount = 0;
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask() {
        askCount += 1;
        return { replyText: "従来応答" };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onProgressiveSentence: (chunk) => enqueued.push(chunk)
  });

  const result = await orch.fire();
  assert.equal(askCount, 1);
  assert.deepEqual(enqueued, []);
  assert.deepEqual(fakeSpeak.spoken.map((entry) => entry.text), ["従来応答"]);
  assert.equal(result.replyText, "従来応答");
  orch.dispose();
});

test("C2: Codex delta/TTS/playback を overlapし、LLM完了後もmatching ENDEDまでFireをterminalizeせず旧speakを重複実行しない", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("二文で答えて");
  const player = makeProgressivePlayer();
  const finishAsk = deferred();
  const states = [];
  const terminals = [];
  const traces = [];
  let askCount = 0;
  let legacySpeakCount = 0;
  let requestId = 0;
  const channel = {
    async sendSpeech() {
      requestId += 1;
      return { result: "accepted", error: null, rttMs: 1, requestId: `req-${requestId}`, serializedUtf8Bytes: 300 + requestId };
    },
    async sendSet() { return { result: "accepted", error: null, rttMs: 1 }; }
  };
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        askCount += 1;
        askOptions.onTextDelta("一。");
        await finishAsk.promise;
        askOptions.onTextDelta("二。");
        return { replyText: "一。二。", elapsedMs: 55 };
      }
    },
    speakImpl: async () => { legacySpeakCount += 1; },
    channel,
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
      ...options,
      prepareSpeechImpl: async (text) => progressiveArtifact(text),
      cleanupArtifact: () => {}
    }),
    onState: (state) => states.push(state),
    onProgressiveTerminal: (outcome) => terminals.push(outcome),
    onTrace: (entry) => traces.push(entry)
  });

  const firePromise = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(player.plays, ["19968.wav"], "first sentence starts while LLM turn is still open");
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  finishAsk.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(player.plays, ["19968.wav", "20108.wav"]);
  let fireSettled = false;
  firePromise.then(() => { fireSettled = true; });
  await Promise.resolve();
  assert.equal(fireSettled, false, "LLM terminal is not Fire terminal while second playback is active");
  emitProgressiveOwned(player, "STARTED", 1);
  emitProgressiveOwned(player, "ENDED", 1);
  const result = await firePromise;

  assert.equal(askCount, 1, "sentence jobs never create extra LLM turns");
  assert.equal(legacySpeakCount, 0, "streamed Codex response never falls through to one-shot speak");
  assert.equal(result.fired, true);
  assert.equal(result.replyText, "一。二。");
  assert.equal(result.progressive.completedSentenceCount, 2);
  assert.deepEqual(states, ["thinking", "speaking", "idle"]);
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].playedText, "一。二。");
  assert.equal(buffer.all().at(-1).text, "一。二。");
  assert.equal(traces.filter((entry) => entry.event === "llm.first_delta").length, 1);
  assert.equal(traces.filter((entry) => entry.event === "progressive.first_safe_sentence").length, 1);
  assert.ok(
    traces.some(
      (entry) =>
        entry.event === "progressive.playback.activated" &&
        typeof entry.jobId === "string" &&
        typeof entry.playbackId === "string" &&
        entry.requestId === "req-1" &&
        entry.serializedUtf8Bytes === 301
    )
  );
  orch.dispose();
});

test("C2: progressive productionでもClaude/full-result snapshotはlegacy one-shotをexact once維持する", async () => {
  const buffer = bufferWithYou("Claude fallback");
  const fakeSpeak = makeFakeSpeak();
  let askCount = 0;
  const terminals = [];
  const session = {
    async ask() {
      askCount += 1;
      return { replyText: "一括応答。" };
    }
  };
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session,
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    progressivePlayback: true,
    acquireFireResources: async () => ({
      session,
      channel: fakeChannel,
      player: fakePlayer,
      configuration: { brain: "claude" }
    }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome)
  });

  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.equal(askCount, 1);
  assert.deepEqual(fakeSpeak.spoken.map((entry) => entry.text), ["一括応答。"]);
  assert.deepEqual(terminals, [], "Claude does not create a progressive delivery generation");
  orch.dispose();
});

test("C2 barge gate: ask開始後first delta前のinterruptはnot-speakingでsame Fireが正常完了する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("delta前 race");
  const player = makeProgressivePlayer();
  const releaseDelta = deferred();
  const terminals = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        await releaseDelta.promise;
        askOptions.onTextDelta("正常。");
        return { replyText: "正常。" };
      }
    },
    channel: { async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } },
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
      ...options,
      prepareSpeechImpl: () => progressiveArtifact("正常。"),
      cleanupArtifact: () => {}
    }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome)
  });

  const firePromise = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await orch.interrupt(), { interrupted: false, reason: "not-speaking" });
  assert.equal(terminals.length, 0);
  releaseDelta.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(player.plays.length, 1);
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  const result = await firePromise;
  assert.equal(result.fired, true);
  assert.equal(result.replyText, "正常。");
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].terminalCause, "completed");
  orch.dispose();
});

test("C2 barge gate: PLAY issuedでもmatching STARTED前のinterruptはno-opで正常完了する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("STARTED前 race");
  const player = makeProgressivePlayer();
  const finishAsk = deferred();
  const terminals = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        askOptions.onTextDelta("待機。");
        await finishAsk.promise;
        return { replyText: "待機。" };
      }
    },
    channel: { async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } },
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
      ...options,
      prepareSpeechImpl: () => progressiveArtifact("待機。"),
      cleanupArtifact: () => {}
    }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome)
  });

  const firePromise = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(player.plays.length, 1);
  assert.deepEqual(await orch.interrupt(), { interrupted: false, reason: "not-speaking" });
  assert.equal(player.stops, 0);
  assert.equal(terminals.length, 0);
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  finishAsk.resolve();
  const result = await firePromise;
  assert.equal(result.fired, true);
  assert.equal(result.replyText, "待機。");
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].terminalCause, "completed");
  orch.dispose();
});

test("C2 barge gate: audible prefix後のinter-sentence gapはbarge可能でlate deltaを復活させず次Fireが回復する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("gap race");
  const player = makeProgressivePlayer();
  const continueFirst = deferred();
  const terminals = [];
  const inputs = [];
  let fireCount = 0;
  const session = {
    async ask(input, askOptions) {
      inputs.push(input);
      fireCount += 1;
      if (fireCount === 1) {
        askOptions.onTextDelta("先行。");
        await continueFirst.promise;
        askOptions.onTextDelta("後続。");
        return { replyText: "先行。後続。" };
      }
      const reply = fireCount === 2 ? "復帰。" : "再復帰。";
      askOptions.onTextDelta(reply);
      return { replyText: reply };
    }
  };
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session,
    channel: { async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } },
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
      ...options,
      prepareSpeechImpl: (text) => progressiveArtifact(text),
      cleanupArtifact: () => {}
    }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome)
  });

  const firstFire = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  const interrupted = await orch.interrupt();
  assert.deepEqual(interrupted, { interrupted: true, charsSpoken: 3, prefix: "先行。" });
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].terminalCause, "barge-in");
  assert.equal(terminals[0].playedText, "先行。");

  continueFirst.resolve();
  const firstResult = await firstFire;
  assert.equal(firstResult.reason, "barge-in");
  assert.equal(player.plays.length, 1, "late delta never creates a resurrected sentence job");
  assert.equal(terminals.length, 1, "private terminal remains exactly once");
  assert.deepEqual(
    buffer.all().filter((entry) => entry.speaker === "soul").map((entry) => entry.text),
    [`先行。\n${PROGRESSIVE_INTERRUPTION_NOTE}`]
  );

  const recoveredFire = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(player.plays.length, 2);
  emitProgressiveOwned(player, "STARTED", 1);
  emitProgressiveOwned(player, "ENDED", 1);
  const recovered = await recoveredFire;
  assert.equal(recovered.fired, true);
  assert.equal(recovered.replyText, "復帰。");
  assert.equal(terminals.length, 2);
  assert.equal(terminals[1].terminalCause, "completed");

  const thirdFire = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  emitProgressiveOwned(player, "STARTED", 2);
  emitProgressiveOwned(player, "ENDED", 2);
  const third = await thirdFire;
  assert.equal(third.replyText, "再復帰。");
  assert.ok(inputs[1].startsWith(PROGRESSIVE_CONTINUITY_INSTRUCTION), "next ask alone receives continuity");
  assert.ok(!inputs[0].includes(PROGRESSIVE_CONTINUITY_INSTRUCTION));
  assert.ok(!inputs[2].includes(PROGRESSIVE_CONTINUITY_INSTRUCTION), "continuity is consumed exactly once");
  orch.dispose();
});

test("C2: progressive kill clears active/queued generation, late marker cannot commit, revive後のFireはfresh generationで回復する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("続けて");
  const player = makeProgressivePlayer();
  const firstAsk = deferred();
  let fireNumber = 0;
  const terminals = [];
  const channel = {
    async sendSpeech() {
      return { result: "accepted", error: null, rttMs: 1, requestId: "req", serializedUtf8Bytes: 250 };
    },
    async sendSet() { return { result: "accepted", error: null, rttMs: 1 }; }
  };
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        fireNumber += 1;
        if (fireNumber === 1) {
          askOptions.onTextDelta("旧。");
          await firstAsk.promise;
          return { replyText: "旧。" };
        }
        askOptions.onTextDelta("新。");
        return { replyText: "新。" };
      }
    },
    channel,
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
      ...options,
      prepareSpeechImpl: async (text) => progressiveArtifact(text),
      cleanupArtifact: () => {}
    }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome)
  });

  const oldFire = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  emitProgressiveOwned(player, "STARTED", 0);
  const killed = await orch.kill();
  assert.equal(killed.severed, true);
  assert.equal(player.stops, 1);
  firstAsk.resolve();
  const oldResult = await oldFire;
  assert.equal(oldResult.reason, "killed-inflight");
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].terminalCause, "killed");
  emitProgressiveOwned(player, "ENDED", 0);

  orch.revive();
  const freshFire = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(player.plays.at(-1), "26032.wav");
  // Repeat the old marker after fresh activation; exact path ownership rejects it.
  emitProgressiveOwned(player, "ENDED", 0);
  emitProgressiveOwned(player, "STARTED", 1);
  emitProgressiveOwned(player, "ENDED", 1);
  const freshResult = await freshFire;
  assert.equal(freshResult.fired, true);
  assert.equal(freshResult.replyText, "新。");
  assert.equal(terminals.length, 2, "old and fresh generations each report exactly once");
  assert.equal(terminals.at(-1).status, "completed");
  orch.dispose();
});

test("C2/C3: safe prefix ENDED後のcross-delta NG abortをexact once渡しpartial transcriptだけcommitする", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("安全に答えて");
  const player = makeProgressivePlayer();
  const continueLlm = deferred();
  const terminals = [];
  const ngWord = NG_WORDS[0];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        askOptions.onTextDelta("安全。");
        await continueLlm.promise;
        const split = Math.max(1, Math.floor(ngWord.length / 2));
        askOptions.onTextDelta(`危険${ngWord.slice(0, split)}`);
        askOptions.onTextDelta(`${ngWord.slice(split)}。`);
        return { replyText: `安全。危険${ngWord}。` };
      }
    },
    channel: {
      async sendSpeech() {
        return { result: "accepted", error: null, rttMs: 1, requestId: "req-ng", serializedUtf8Bytes: 200 };
      }
    },
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) =>
      createProgressiveSpeechDelivery({
        ...options,
        prepareSpeechImpl: () => progressiveArtifact("安全。"),
        cleanupArtifact: () => {}
      }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome)
  });

  const firePromise = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  continueLlm.resolve();
  const result = await firePromise;
  assert.equal(result.reason, "ng-blocked");
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].playedText, "安全。");
  assert.equal(terminals[0].completedSentenceCount, 1);
  assert.equal(terminals[0].terminalCause, "ng-blocked");
  assert.deepEqual(
    buffer.all().filter((entry) => entry.speaker === "soul").map((entry) => entry.text),
    [`安全。\n${PROGRESSIVE_INTERRUPTION_NOTE}`]
  );
  orch.dispose();
});

test("C2/C3: played prefix followed by LLM rejection reports exactly once and commits only partial transcript", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("途中で失敗して");
  const player = makeProgressivePlayer();
  const llmTerminal = deferred();
  const terminals = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        askOptions.onTextDelta("聞こえた。");
        await llmTerminal.promise;
        return { replyText: "unreachable" };
      }
    },
    channel: {
      async sendSpeech() {
        return { result: "accepted", error: null, rttMs: 1, requestId: "req", serializedUtf8Bytes: 200 };
      }
    },
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) =>
      createProgressiveSpeechDelivery({
        ...options,
        prepareSpeechImpl: () => progressiveArtifact("聞こえた。"),
        cleanupArtifact: () => {}
      }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome)
  });

  const firePromise = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  llmTerminal.reject(new Error("llm failed"));
  const result = await firePromise;
  assert.equal(result.fired, false);
  assert.equal(result.reason, "error");
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].playedText, "聞こえた。");
  assert.equal(terminals[0].completedSentenceCount, 1);
  assert.equal(terminals[0].terminalCause, "llm-failed");
  assert.deepEqual(
    buffer.all().filter((entry) => entry.speaker === "soul").map((entry) => entry.text),
    [`聞こえた。\n${PROGRESSIVE_INTERRUPTION_NOTE}`]
  );
  orch.dispose();
});

test("C2 private outcome: channel activation failure settles hook exactly once and commits no transcript", async () => {
  const buffer = bufferWithYou("channel failure");
  const terminals = [];
  const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        askOptions.onTextDelta("送信失敗。");
        return { replyText: "送信失敗。" };
      }
    },
    channel: {
      async sendSpeech() {
        const error = new Error("closed");
        error.code = "channel_closed";
        throw error;
      }
    },
    player: makeProgressivePlayer(),
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) =>
      createProgressiveSpeechDelivery({
        ...options,
        prepareSpeechImpl: () => progressiveArtifact("送信失敗。"),
        cleanupArtifact: () => {}
      }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome),
    onDiagnostic: (diag) => diags.push(diag)
  });

  const result = await orch.fire();
  assert.equal(result.reason, "error");
  assert.equal(result.message, "progressive speech delivery failed (play-failed).");
  assert.deepEqual(diags, [{ type: "fireError", message: result.message }]);
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].status, "failed");
  assert.equal(terminals[0].playedText, "");
  assert.equal(buffer.all().filter((entry) => entry.speaker === "soul").length, 0);
  orch.dispose();
});

test("C3: prefix completion後のchannel/marker failureは発話済みprefix+固定noteだけを正本化する", { timeout: 5000 }, async () => {
  for (const failure of ["channel", "marker"]) {
    const buffer = bufferWithYou(`${failure} partial`);
    const player = makeProgressivePlayer();
    const terminals = [];
    const visible = [];
    let speechRequest = 0;
    let selfSpoke = 0;
    buffer.onAppend((entry) => {
      if (entry.speaker === "soul") selfSpoke += 1;
    });
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session: {
        async ask(_input, askOptions) {
          askOptions.onTextDelta("届いた。");
          askOptions.onTextDelta("未配信。");
          return { replyText: "届いた。未配信。" };
        }
      },
      channel: {
        async sendSpeech() {
          speechRequest += 1;
          if (failure === "channel" && speechRequest === 2) {
            const error = new Error("closed after prefix");
            error.code = "channel_closed";
            throw error;
          }
          return { result: "accepted", error: null, rttMs: 1, requestId: `${failure}-${speechRequest}` };
        }
      },
      player,
      progressivePlayback: true,
      progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
        ...options,
        prepareSpeechImpl: (text) => progressiveArtifact(text),
        cleanupArtifact: () => {}
      }),
      onProgressiveTerminal: (outcome) => terminals.push(outcome),
      onSoulTranscript: (entry) => visible.push(entry)
    });

    const firePromise = orch.fire();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    emitProgressiveOwned(player, "STARTED", 0);
    emitProgressiveOwned(player, "ENDED", 0);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    if (failure === "marker") {
      assert.equal(player.plays.length, 2);
      emitProgressiveOwned(player, "STARTED", 1);
      emitProgressiveOwned(player, "ERROR", 1);
    }
    const result = await firePromise;
    const canonical = `届いた。\n${PROGRESSIVE_INTERRUPTION_NOTE}`;
    assert.equal(result.reason, "progressive-delivery-failed");
    assert.equal(terminals.length, 1);
    assert.equal(terminals[0].completedSentenceCount, 1);
    assert.equal(terminals[0].playedText, "届いた。");
    assert.deepEqual(visible.map((entry) => entry.text), [canonical]);
    assert.deepEqual(buffer.all().filter((entry) => entry.speaker === "soul").map((entry) => entry.text), [canonical]);
    assert.equal(selfSpoke, 1, "one completed chunk updates the existing soul append/refractory seam");
    const digestInput = formatTranscriptForDigest(buffer.all());
    assert.ok(digestInput.includes(canonical));
    assert.ok(!digestInput.includes("未配信。"), "unheard suffix never reaches memory/digest input");
    orch.dispose();
  }
});

test("C3: zero-completed channel/prepare failureはnormal fireErrorだけをexact once出しnote/correction/self-spokeを作らない", { timeout: 5000 }, async () => {
  for (const failure of ["channel", "prepare"]) {
    const buffer = bufferWithYou(`zero ${failure}`);
    const player = makeProgressivePlayer();
    const inputs = [];
    const diags = [];
    const terminals = [];
    let selfSpoke = 0;
    let fireNumber = 0;
    buffer.onAppend((entry) => {
      if (entry.speaker === "soul") selfSpoke += 1;
    });
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session: {
        async ask(input, askOptions) {
          inputs.push(input);
          fireNumber += 1;
          const reply = fireNumber === 1 ? "失敗。" : "回復。";
          askOptions.onTextDelta(reply);
          return { replyText: reply };
        }
      },
      channel: {
        async sendSpeech() {
          if (failure === "channel" && fireNumber === 1) throw new Error("channel closed before playback");
          return { result: "accepted", error: null, rttMs: 1 };
        }
      },
      player,
      progressivePlayback: true,
      progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
        ...options,
        prepareSpeechImpl: (text) => {
          if (failure === "prepare" && fireNumber === 1) throw new Error("prepare failed before playback");
          return progressiveArtifact(text);
        },
        cleanupArtifact: () => {}
      }),
      onDiagnostic: (diag) => diags.push(diag),
      onProgressiveTerminal: (outcome) => terminals.push(outcome)
    });

    const failed = await orch.fire();
    const expectedCause = failure === "channel" ? "play-failed" : "prepare-failed";
    assert.equal(failed.reason, "error");
    assert.equal(failed.message, `progressive speech delivery failed (${expectedCause}).`);
    assert.deepEqual(diags, [{ type: "fireError", message: failed.message }]);
    assert.equal(terminals.length, 1);
    assert.equal(terminals[0].completedSentenceCount, 0);
    assert.equal(terminals[0].terminalCause, expectedCause);
    assert.equal(selfSpoke, 0);
    assert.deepEqual(buffer.all().filter((entry) => entry.speaker === "soul"), []);

    const recoveredPromise = orch.fire();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(!inputs[1].includes(PROGRESSIVE_CONTINUITY_INSTRUCTION));
    emitProgressiveOwned(player, "STARTED", 0);
    emitProgressiveOwned(player, "ENDED", 0);
    const recovered = await recoveredPromise;
    assert.equal(recovered.replyText, "回復。");
    assert.equal(selfSpoke, 1);
    assert.equal(diags.length, 1, "recovery does not duplicate the zero-spoken diagnostic");
    orch.dispose();
  }
});

test("C3: continuityはpartial直後のnext askでexact once消費し、そのask失敗でも再送せずlater Fireが回復する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("continuity race");
  const player = makeProgressivePlayer();
  const failFirst = deferred();
  const inputs = [];
  const terminals = [];
  const visible = [];
  let fireNumber = 0;
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input, askOptions) {
        inputs.push(input);
        fireNumber += 1;
        if (fireNumber === 1) {
          askOptions.onTextDelta("聞こえた。");
          await failFirst.promise;
          return { replyText: "unreachable" };
        }
        if (fireNumber === 2) throw new Error("ambiguous ask failure after input handoff");
        askOptions.onTextDelta("回復。");
        return { replyText: "回復。" };
      }
    },
    channel: { async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } },
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
      ...options,
      prepareSpeechImpl: (text) => progressiveArtifact(text),
      cleanupArtifact: () => {}
    }),
    onProgressiveTerminal: (outcome) => terminals.push(outcome),
    onSoulTranscript: (entry) => visible.push(entry)
  });

  const partialFire = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  failFirst.reject(new Error("llm failed after prefix"));
  assert.equal((await partialFire).reason, "error");
  assert.deepEqual(visible.map((entry) => entry.text), [`聞こえた。\n${PROGRESSIVE_INTERRUPTION_NOTE}`]);

  const failedCorrectionFire = await orch.fire();
  assert.equal(failedCorrectionFire.reason, "error");
  assert.ok(inputs[1].startsWith(PROGRESSIVE_CONTINUITY_INSTRUCTION));

  const recoveredFire = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(player.plays.length, 2);
  emitProgressiveOwned(player, "ENDED", 0); // stale old-generation marker cannot affect the fresh job
  emitProgressiveOwned(player, "STARTED", 1);
  emitProgressiveOwned(player, "ENDED", 1);
  const recovered = await recoveredFire;
  assert.equal(recovered.replyText, "回復。");
  assert.ok(!inputs[2].includes(PROGRESSIVE_CONTINUITY_INSTRUCTION));
  assert.deepEqual(
    buffer.all().filter((entry) => entry.speaker === "soul").map((entry) => entry.text),
    [`聞こえた。\n${PROGRESSIVE_INTERRUPTION_NOTE}`, "回復。"]
  );
  assert.equal(terminals.length, 3, "partial, failed correction turn, and recovery each settle once");
  orch.dispose();
});

test("C3: completed prefix後のkill/disposeはlate suffixを正本化せず同一partial projectionをexact once行う", { timeout: 5000 }, async () => {
  for (const action of ["kill", "dispose"]) {
    const buffer = bufferWithYou(`${action} partial`);
    const player = makeProgressivePlayer();
    const continueLlm = deferred();
    const visible = [];
    const terminals = [];
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session: {
        async ask(_input, askOptions) {
          askOptions.onTextDelta("発話済み。");
          await continueLlm.promise;
          askOptions.onTextDelta("未配信。");
          return { replyText: "発話済み。未配信。" };
        }
      },
      channel: { async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } },
      player,
      progressivePlayback: true,
      progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
        ...options,
        prepareSpeechImpl: (text) => progressiveArtifact(text),
        cleanupArtifact: () => {}
      }),
      onSoulTranscript: (entry) => visible.push(entry),
      onProgressiveTerminal: (outcome) => terminals.push(outcome)
    });

    const firePromise = orch.fire();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    emitProgressiveOwned(player, "STARTED", 0);
    emitProgressiveOwned(player, "ENDED", 0);
    if (action === "kill") await orch.kill();
    else orch.dispose();
    continueLlm.resolve();
    const result = await firePromise;
    assert.equal(result.reason, action === "kill" ? "killed-inflight" : "disposed");
    assert.deepEqual(visible.map((entry) => entry.text), [`発話済み。\n${PROGRESSIVE_INTERRUPTION_NOTE}`]);
    assert.equal(terminals.length, 1);
    assert.equal(terminals[0].terminalCause, action === "kill" ? "killed" : "disposed");
    assert.ok(!formatTranscriptForDigest(buffer.all()).includes("未配信。"));
    emitProgressiveOwned(player, "ENDED", 0);
    await Promise.resolve();
    assert.equal(terminals.length, 1, "late callback cannot duplicate projection/terminal");
    if (action === "kill") orch.dispose();
  }
});

test("C3: resource snapshot待ちのoverlap Fireはbusyとなりpending correctionを奪わない", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("accept race");
  const player = makeProgressivePlayer();
  const failPartial = deferred();
  const acquireNext = deferred();
  const inputs = [];
  let askCount = 0;
  let acquireCount = 0;
  const session = {
    async ask(input, askOptions) {
      inputs.push(input);
      askCount += 1;
      if (askCount === 1) {
        askOptions.onTextDelta("先行。");
        await failPartial.promise;
        return { replyText: "unreachable" };
      }
      askOptions.onTextDelta("継続。");
      return { replyText: "継続。" };
    }
  };
  const resources = { session, channel: fakeChannel, player, configuration: { brain: "codex" } };
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session,
    channel: fakeChannel,
    player,
    progressivePlayback: true,
    acquireFireResources: async () => {
      acquireCount += 1;
      return acquireCount === 1 ? resources : await acquireNext.promise;
    },
    progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
      ...options,
      prepareSpeechImpl: (text) => progressiveArtifact(text),
      cleanupArtifact: () => {}
    })
  });

  const partial = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  failPartial.reject(new Error("partial"));
  assert.equal((await partial).reason, "error");

  const accepted = orch.fire();
  await Promise.resolve();
  assert.deepEqual(await orch.fire(), { fired: false, reason: "busy", state: "idle" });
  assert.equal(acquireCount, 2, "overlap never takes a second resource snapshot");
  assert.equal(inputs.length, 1, "pending correction remains unconsumed before the accepted ask");
  acquireNext.resolve(resources);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(inputs[1].startsWith(PROGRESSIVE_CONTINUITY_INSTRUCTION));
  emitProgressiveOwned(player, "STARTED", 1);
  emitProgressiveOwned(player, "ENDED", 1);
  assert.equal((await accepted).replyText, "継続。");
  orch.dispose();
});

test("C3: pre-ask vision capture failureはcorrectionを保持し、次のvision askでimage-firstのまま一度だけ渡す", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("vision continuity");
  const player = makeProgressivePlayer();
  const failPartial = deferred();
  const inputs = [];
  let askCount = 0;
  let captureCount = 0;
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input, askOptions) {
        inputs.push(input);
        askCount += 1;
        if (askCount === 1) {
          askOptions.onTextDelta("聞いた。");
          await failPartial.promise;
          return { replyText: "unreachable" };
        }
        askOptions.onTextDelta("画面継続。");
        return { replyText: "画面継続。" };
      }
    },
    getVisionTarget: () => "target",
    captureImpl: async () => {
      captureCount += 1;
      return captureCount === 1
        ? { error: { kind: "failed", message: "capture failed before ask" } }
        : { jpegBase64: "ZmFrZQ==", width: 1, height: 1, elapsedMs: 1 };
    },
    channel: fakeChannel,
    player,
    progressivePlayback: true,
    progressiveDeliveryFactory: (options) => createProgressiveSpeechDelivery({
      ...options,
      prepareSpeechImpl: (text) => progressiveArtifact(text),
      cleanupArtifact: () => {}
    })
  });

  const partial = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  failPartial.reject(new Error("partial"));
  assert.equal((await partial).reason, "error");

  const captureFailed = await orch.fire({ vision: true });
  assert.equal(captureFailed.reason, "vision-capture-failed");
  assert.equal(inputs.length, 1, "no ask means no correction consumption");

  const recoveredVision = orch.fire({ vision: true });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(Array.isArray(inputs[1]));
  assert.equal(inputs[1][0].type, "image");
  assert.equal(inputs[1][1].type, "text");
  assert.ok(inputs[1][1].text.startsWith(PROGRESSIVE_CONTINUITY_INSTRUCTION));
  emitProgressiveOwned(player, "STARTED", 1);
  emitProgressiveOwned(player, "ENDED", 1);
  assert.equal((await recoveredVision).replyText, "画面継続。");
  orch.dispose();
});

test("C2 accepted snapshot: normal/vision/preferred-degraded keep pre-publication resources until settlement", { timeout: 5000 }, async () => {
  for (const mode of ["normal", "vision", "preferred-degraded"]) {
    const buffer = bufferWithYou(`snapshot-${mode}`);
    let desired = "old";
    let acceptedCount = 0;
    let acquireCount = 0;
    const asks = [];
    const speaks = [];
    const captures = [];
    const firstCapture = deferred();
    const makeResources = (label) => ({
      session: {
        async ask() {
          asks.push(label);
          return { replyText: `${label}応答`, elapsedMs: 1 };
        }
      },
      channel: { label, async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } },
      player: { label, play() {}, stop() {} },
      speakDeps: { snapshotLabel: label },
      configuration: {
        brain: label,
        sessionContextRevision: label,
        instructionRevision: label,
        memoryEnabled: label,
        audioDevice: label,
        channelUrl: label,
        tts: label
      }
    });
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session: makeResources("fallback").session,
      channel: {},
      player: { play() {} },
      acquireFireResources: async () => {
        acquireCount += 1;
        return makeResources(desired);
      },
      getVisionTarget: () => "target",
      captureImpl: async () => {
        captures.push(desired);
        if (captures.length === 1) return firstCapture.promise;
        return mode === "preferred-degraded"
          ? { error: { kind: "failed", message: "capture failed" } }
          : { jpegBase64: "ZmFrZQ==", width: 1, height: 1, elapsedMs: 1 };
      },
      speakImpl: async (_text, deps) => {
        speaks.push({ snapshotLabel: deps.snapshotLabel, channel: deps.channel.label, player: deps.player.label });
        return { timeline: [], wavDurationSec: 0, playbackStartedAtMs: 0 };
      },
      setTimeoutImpl: (fn) => { queueMicrotask(fn); return null; },
      onFire: (info) => {
        if (info.accepted === true) {
          acceptedCount += 1;
          if (acceptedCount === 1) desired = "new";
        }
      }
    });

    const fireOptions =
      mode === "normal" ? undefined : { vision: mode === "vision" ? true : "preferred" };
    const first = orch.fire(fireOptions);
    if (mode === "normal") {
      await first;
    } else {
      await new Promise((resolve) => setImmediate(resolve));
      firstCapture.resolve(
        mode === "preferred-degraded"
          ? { error: { kind: "failed", message: "capture failed" } }
          : { jpegBase64: "ZmFrZQ==", width: 1, height: 1, elapsedMs: 1 }
      );
      await first;
    }
    assert.equal(asks[0], "old", mode);
    assert.deepEqual(speaks[0], { snapshotLabel: "old", channel: "old", player: "old" }, mode);

    await orch.fire(fireOptions);
    assert.equal(asks[1], "new", mode);
    assert.deepEqual(speaks[1], { snapshotLabel: "new", channel: "new", player: "new" }, mode);
    assert.equal(acquireCount, 2, `${mode}: one immutable acquisition per accepted Fire`);
    orch.dispose();
  }
});

// ── S8「NG 最終検査」（Domain C・キル検査と同じ検問所）─────────────────────────────

test("ngBlocked: NG 語を含む応答は丸ごと没——speakImpl 不呼び出し・soul へ NG_BLOCKED_NOTE のみ 1 件・ngBlocked 診断・戻り値 reason:'ng-blocked'（応答本文/命中語は一切漏れない）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  /** @type {any[]} */ const diags = [];
  /** @type {any[]} */ const souls = [];
  const ngWord = NG_WORDS[0];
  const replyText = `そうだね、${ngWord}って言葉はひどいよね`;
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onDiagnostic: (d) => diags.push(d),
    onSoulTranscript: (e) => souls.push(e)
  });

  const result = await orch.fire();
  assert.equal(result.fired, false);
  assert.equal(result.reason, "ng-blocked");

  // speak せず。
  assert.equal(fakeSpeak.spoken.length, 0);

  // soul は NG_BLOCKED_NOTE のみの 1 エントリ（you 発話に続く 2 件目）。
  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.equal(all[1].speaker, "soul");
  assert.equal(all[1].text, NG_BLOCKED_NOTE);
  assert.equal(souls.length, 1);
  assert.equal(souls[0].text, NG_BLOCKED_NOTE);

  // ngBlocked 診断は type のみ（命中語・本文を運ばない）。
  const ngDiag = diags.find((d) => d.type === "ngBlocked");
  assert.ok(ngDiag, "ngBlocked 診断が出る");
  assert.deepEqual(Object.keys(ngDiag), ["type"]);

  // 秘匿の直接検証: 診断・戻り値・soul 追記のどこにも応答本文/命中した NG 語が現れない。
  assert.ok(!JSON.stringify(diags).includes(ngWord), "診断に NG 語が含まれてはならない");
  assert.ok(!JSON.stringify(diags).includes(replyText), "診断に応答本文が含まれてはならない");
  assert.ok(!JSON.stringify(result).includes(ngWord), "戻り値に NG 語が含まれてはならない");
  assert.ok(!JSON.stringify(result).includes(replyText), "戻り値に応答本文が含まれてはならない");
  assert.ok(!JSON.stringify(all).includes(ngWord), "soul 追記に NG 語が含まれてはならない");
  assert.ok(!JSON.stringify(all).includes(replyText), "soul 追記に応答本文が含まれてはならない");

  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("ngBlocked: NG 語を含まない普通の応答は従来どおり speak され soul へ speechText が追記される（無退行）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  /** @type {any[]} */ const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "今日はいい天気だね" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onDiagnostic: (d) => diags.push(d)
  });

  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.equal(result.replyText, "今日はいい天気だね");

  assert.equal(fakeSpeak.spoken.length, 1);
  assert.equal(fakeSpeak.spoken[0].text, "今日はいい天気だね");

  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.equal(all[1].speaker, "soul");
  assert.equal(all[1].text, "今日はいい天気だね");

  assert.ok(!diags.some((d) => d.type === "ngBlocked"), "非命中では ngBlocked 診断は出ない");
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("ngBlocked: 視覚発火 fire({vision:true}) 経路でも NG 検査が効く（processAskedReply 共通経路の確認）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("ねえ、これ見て");
  const fakeSpeak = makeFakeSpeak();
  const capture = makeFakeCapture({ jpegBase64: "ZmFrZQ==", width: 800, height: 600, elapsedMs: 10 });
  /** @type {any[]} */ const diags = [];
  const ngWord = NG_WORDS[1];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: `画面には${ngWord}が写ってる` }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => "テストゲーム",
    onDiagnostic: (d) => diags.push(d)
  });

  const result = await orch.fire({ vision: true });
  assert.equal(result.fired, false);
  assert.equal(result.reason, "ng-blocked");
  assert.equal(fakeSpeak.spoken.length, 0);

  const all = buffer.all();
  assert.equal(all.length, 2); // you 発話 + NG_BLOCKED_NOTE のみ（画像本文もヒット語も無し）。
  assert.equal(all[1].text, NG_BLOCKED_NOTE);

  const ngDiag = diags.find((d) => d.type === "ngBlocked");
  assert.ok(ngDiag, "視覚発火経路でも ngBlocked 診断が出る");
  assert.ok(!JSON.stringify(diags).includes(ngWord));

  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

// ── 多頭化 Domain C「soul 行の応答レイテンシ実値化」(brain-swap-wave-plan.md §3・blocking #7 は
//    検問所ロジック不変=以下のテストは NG/KILL の判定条件を一切変更しない・onSoulTranscript の
//    通知内容のみを検証する) ────────────────────────────────────────────────

test("onSoulTranscript: 自然完了時、asked.elapsedMs が entry.latencyMs として additive に乗る", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("今何時？");
  const fakeSpeak = makeFakeSpeak();
  /** @type {any[]} */ const souls = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "3時だよ", elapsedMs: 1234 }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onSoulTranscript: (e) => souls.push(e)
  });

  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.equal(souls.length, 1);
  assert.equal(souls[0].latencyMs, 1234);
  // entry の既存フィールドは無変更（additive・buffer 正本と同値）。
  assert.equal(souls[0].speaker, "soul");
  assert.equal(souls[0].text, "3時だよ");
  // buffer 正本（transcriptBuffer.all()）は素の entry のまま（onSoulTranscript 通知はコピー拡張のみ）。
  const all = buffer.all();
  assert.equal(all[1].text, "3時だよ");
  assert.equal(Object.prototype.hasOwnProperty.call(all[1], "latencyMs"), false);

  orch.dispose();
});

test("onSoulTranscript: asked.elapsedMs が非数値/欠落なら entry.latencyMs は null（後方互換）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("元気？");
  const fakeSpeak = makeFakeSpeak();
  /** @type {any[]} */ const souls = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    // elapsedMs を返さない fake session（既存テストの多くと同型）。
    session: { async ask() { return { replyText: "元気だよ" }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onSoulTranscript: (e) => souls.push(e)
  });

  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.equal(souls.length, 1);
  assert.equal(souls[0].latencyMs, null);

  orch.dispose();
});

test("onSoulTranscript: NG ブロック時の entry には latencyMs フィールドが乗らない（検問所ロジックは無変更・観測配線は自然完了パスのみ additive）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const fakeSpeak = makeFakeSpeak();
  /** @type {any[]} */ const souls = [];
  const ngWord = NG_WORDS[0];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: `そうだね、${ngWord}って言葉はひどいよね`, elapsedMs: 999 }; } },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onSoulTranscript: (e) => souls.push(e)
  });

  const result = await orch.fire();
  assert.equal(result.reason, "ng-blocked");
  assert.equal(souls.length, 1);
  // NG ブロック経路の entry は buffer.append の素の戻りのまま（latencyMs を付与する変更は
  // 自然完了パスのみに限定＝検問所（containsNgWord 判定）そのものは 1 行も変更していない）。
  assert.equal(Object.prototype.hasOwnProperty.call(souls[0], "latencyMs"), false);

  orch.dispose();
});
