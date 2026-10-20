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
import { createSpeechStreamer } from "../voice/speech-streamer.mjs";
import { createFakeStreamPlayer } from "../test-support/fake-stream-player.mjs";
import { createFakeVoiceEngine, defaultFakeChunks } from "../test-support/fake-voice-engine.mjs";
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

/**
 * 文ごとの読み上げの流し込みプレイヤーの代役（声の差し替え Wave 2）。`plays` は open された発話 id（順）。
 * STARTED/ENDED/ERROR は emitProgressiveOwned で手で流す。
 */
function makeProgressivePlayer() {
  const player = createFakeStreamPlayer();
  return Object.assign(player, {
    get plays() { return player.opened; }
  });
}

function emitProgressiveOwned(player, type, index = player.plays.length - 1) {
  player.emitFor(type.toLowerCase(), index);
}

/** 旧 prepareSpeech の代役（文 → 何か・throw で合成失敗）。中身は捨て、決まった音と時間割を返す。 */
function progressiveArtifact(text) {
  return { text };
}

/** prepare（旧 prepareSpeechImpl 相当）を待ってから既定のかたまりを返す声の差し替え口。 */
function makeProgressiveEngine(prepare = progressiveArtifact) {
  return createFakeVoiceEngine({
    synthesizeImpl: (text) =>
      (async function* () {
        await prepare(text);
        yield* defaultFakeChunks(text);
      })()
  });
}

/**
 * 旧 sendSpeech だけを持つ偽物の channel を intent.speechStream の形に寄せる（文ごとの open = 旧 sendSpeech）。
 * append / end は accepted、口閉じ（sendSet）は元の channel のものを使う。
 */
function streamChannel(channel) {
  const accepted = async () => ({ result: "accepted", error: null, rttMs: 1 });
  return {
    ...channel,
    openSpeech: channel.openSpeech ?? (channel.sendSpeech ? (...args) => channel.sendSpeech(...args) : accepted),
    appendSpeech: channel.appendSpeech ?? accepted,
    endSpeech: channel.endSpeech ?? accepted
  };
}

/** 文ごとの読み上げの運び手（本物）を、代役の engine と channel で作る。 */
function progressiveStreamer(prepare) {
  return (options) =>
    createSpeechStreamer({ ...options, engine: makeProgressiveEngine(prepare), channel: streamChannel(options.channel) });
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

test("conversation instruction profile: six technical brain ids resolve independently and preserve default bytes", () => {
  assert.deepEqual(CONVERSATION_INSTRUCTION_BRAIN_IDS, ["claude", "claude-opus-55", "codex", "codex-56-sol", "codex-astra", "codex-61-sol"]);
  const baseline = resolveConversationInstructionProfile("claude");
  assert.equal(baseline.body, DEFAULT_CONVERSATION_INSTRUCTION_BODY);
  assert.equal(buildFireSystemPrompt(MODEL_IDENTITIES.cody), FIRE_SYSTEM_PROMPT);
  const override = resolveConversationInstructionProfile("codex-61-sol", {
    "codex-61-sol": "Use a short custom response."
  });
  assert.equal(override.hasOverride, true);
  assert.equal(override.body, "Use a short custom response.");
  assert.equal(resolveConversationInstructionProfile("codex").hasOverride, false);
  const unknown = resolveConversationInstructionProfile("unknown", { claude: "must-not-leak", unknown: "bad" });
  assert.equal(unknown.brainId, "claude");
  // 削除済みの GPT-5.5（2026-10-16）は未知 id として既定へ倒れ、保存済み上書きも引き継がない。
  const removed = resolveConversationInstructionProfile("codex-55", { "codex-55": "stale override" });
  assert.equal(removed.brainId, "claude");
  assert.equal(removed.hasOverride, false);
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

/**
 * timeline・playbackStartedAtMs と鳴り終わりの `ended` を返す fake speak（barge-in 材料込み）。
 * 声の差し替え Wave 2: 自然完了は WAV 長のタイマーではなく ended（本物は player の ENDED）。finish() で鳴り終わらせる。
 * stop / snapshot を持たないので、中断の stop と口閉じは orchestrator が player / channel へ直接送る。
 */
function makeBargeSpeak({ timeline = BARGE_TIMELINE, wavDurationSec = 2, playbackStartedAtMs = 1000 } = {}) {
  const spoken = [];
  /** @type {Array<(v: any) => void>} */
  const enders = [];
  return {
    spoken,
    finish() {
      for (const end of enders.splice(0)) end({ status: "completed", cause: "completed" });
    },
    speakImpl: async (text, deps) => {
      spoken.push({ text, deps });
      const ended = new Promise((resolve) => enders.push(resolve));
      return { timeline, rttMs: 0, wavDurationSec, wavPath: "C:/tmp/fake.wav", playbackStartedAtMs, ended };
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

  // 鳴り終わり（ENDED）→ 自然完了。
  speak.finish();
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

  // 自然完了（ENDED）で全文が積まれる。
  speak.finish();
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
  speak.finish(); // 自然完了（ENDED）。
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
    speechStreamerFactory: progressiveStreamer(async (text) => progressiveArtifact(text)),
    onState: (state) => states.push(state),
    onProgressiveTerminal: (outcome) => terminals.push(outcome),
    onTrace: (entry) => traces.push(entry)
  });

  const firePromise = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(player.plays.length, 1, "first sentence starts while LLM turn is still open");
  emitProgressiveOwned(player, "STARTED", 0);
  emitProgressiveOwned(player, "ENDED", 0);
  finishAsk.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(player.plays.length, 2);
  assert.notEqual(player.plays[0], player.plays[1], "each sentence is its own utterance id");
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
        entry.event === "speech.playback.activated" &&
        typeof entry.jobId === "string" &&
        typeof entry.playbackId === "string" &&
        entry.requestId === "req-1" &&
        entry.serializedUtf8Bytes === 301
    )
  );
  orch.dispose();
});

// 2026-10-16: Claude Opus 5.5（"claude-opus-55"）も同じ llm-session（full-result）なので同じ one-shot 経路。
for (const claudeBrain of ["claude", "claude-opus-55"]) {
test(`C2: progressive productionでもClaude/full-result snapshot（${claudeBrain}）はlegacy one-shotをexact once維持する`, async () => {
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
      configuration: { brain: claudeBrain }
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
}

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
    speechStreamerFactory: progressiveStreamer(() => progressiveArtifact("正常。")),
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
    speechStreamerFactory: progressiveStreamer(() => progressiveArtifact("待機。")),
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
    speechStreamerFactory: progressiveStreamer((text) => progressiveArtifact(text)),
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
    speechStreamerFactory: progressiveStreamer(async (text) => progressiveArtifact(text)),
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
  assert.equal(player.plays.length, 2, "fresh generation opens a fresh utterance");
  assert.match(player.plays.at(-1), /^fire-2:/);
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
    speechStreamerFactory: progressiveStreamer(() => progressiveArtifact("安全。")),
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
    speechStreamerFactory: progressiveStreamer(() => progressiveArtifact("聞こえた。")),
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
    speechStreamerFactory: progressiveStreamer(() => progressiveArtifact("送信失敗。")),
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
      speechStreamerFactory: progressiveStreamer((text) => progressiveArtifact(text)),
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
      speechStreamerFactory: progressiveStreamer((text) => {
          if (failure === "prepare" && fireNumber === 1) throw new Error("prepare failed before playback");
          return progressiveArtifact(text);
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
    speechStreamerFactory: progressiveStreamer((text) => progressiveArtifact(text)),
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
      speechStreamerFactory: progressiveStreamer((text) => progressiveArtifact(text)),
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
    speechStreamerFactory: progressiveStreamer((text) => progressiveArtifact(text))
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
    speechStreamerFactory: progressiveStreamer((text) => progressiveArtifact(text))
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

// ── コメント反応の内部指示（fire({ instruction })・discussion/ai-cohost/decisions/comment-react/integration.md §1-7）──

test("fire({instruction}): この 1 発の ask の先頭にだけ付く・会話ログには残らない・次の fire には付かない", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("このボス強い");
  buffer.append({ startMs: 0, endMs: 0, text: "その武器なに？", speaker: "viewer", displayName: "taro" });
  const fakeSpeak = makeFakeSpeak();
  /** @type {any[]} */
  const inputs = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input) {
        inputs.push(input);
        return { replyText: "それは大剣だよ" };
      }
    },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer
  });
  const instruction = "[内部の指示: 視聴者のコメントに反応してください。\n視聴者(taro): 「その武器なに？」]";
  const r = await orch.fire({ instruction });
  assert.equal(r.fired, true);
  assert.ok(inputs[0].startsWith(`${instruction}\n\n`), "先頭に付く");
  assert.match(inputs[0], /viewer\(taro\): その武器なに？/, "会話窓はそのまま続く");
  assert.equal(JSON.stringify(buffer.all()).includes("内部の指示"), false, "会話ログに残らない");
  await orch.fire();
  assert.equal(inputs[1].includes("内部の指示"), false, "次の fire には付かない");
  await orch.fire({ instruction: "   " });
  assert.equal(inputs[2].includes("内部の指示"), false, "空の指示は無し扱い");
  orch.dispose();
});

test("fire({vision:\"preferred\", instruction}): 画像付き ask でも最初の text ブロックの先頭に付く", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("見て");
  const capture = makeFakeCapture({ jpegBase64: "ZmFrZQ==", width: 8, height: 6, elapsedMs: 1 });
  /** @type {any[]} */
  const inputs = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input) {
        inputs.push(input);
        return { replyText: "うん" };
      }
    },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => "ゲーム"
  });
  await orch.fire({ vision: "preferred", instruction: "[内部の指示: X]" });
  assert.ok(Array.isArray(inputs[0]));
  assert.equal(inputs[0][0].type, "image");
  assert.ok(inputs[0][1].text.startsWith("[内部の指示: X]\n\n"));
  orch.dispose();
});

test("fire({vision:false, instruction}): 画面を撮らない通常発火の ask の先頭に付く（speak-now の相槌・backchannel.md §2）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("いやーこのボス強いんだよね");
  const capture = makeFakeCapture({ jpegBase64: "ZmFrZQ==", width: 8, height: 6, elapsedMs: 1 });
  /** @type {any[]} */
  const inputs = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(input) {
        inputs.push(input);
        return { replyText: "へー" };
      }
    },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    captureImpl: capture.captureImpl,
    getVisionTarget: () => "ゲーム" // 視覚対象があっても vision:false なら撮らない。
  });
  const r = await orch.fire({ vision: false, instruction: "今は配信者の話に相槌を打つタイミング。" });
  assert.equal(r.fired, true);
  assert.equal(capture.calls.length, 0, "撮らない");
  assert.equal(typeof inputs[0], "string", "画像なしの ask");
  assert.ok(inputs[0].startsWith("今は配信者の話に相槌を打つタイミング。\n\n"));
  assert.equal(JSON.stringify(buffer.all()).includes("相槌を打つタイミング"), false, "会話ログに残らない");
  orch.dispose();
});

// ── 操縦席の作り直し 1 回目（データの通り道）: 発火番号・きっかけ・推論の範囲・遅延 ─────────────────
//  discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md §9。

/** 手で進める単調時計（遅延の区間を決定論で測る）。 */
function makeClock(start = 0) {
  let t = start;
  return { now: () => t, set: (v) => { t = v; }, add: (d) => { t += d; } };
}

test("発火番号: 受理ごとに 1 から振り、受理・ask・soul 追記・遅延・戻り値に同じ番号ときっかけが載る", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("一つ目");
  const fires = [];
  const asks = [];
  const souls = [];
  const latencies = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { ask: async () => ({ replyText: "うん", ttftMs: 321 }) },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onFire: (f) => fires.push(f),
    onAsk: (a) => asks.push(a),
    onSoulTranscript: (e) => souls.push(e),
    onLatency: (l) => latencies.push(l)
  });
  const cause = { type: "speak-now", choice: "respond", probability: 0.72, triggerSeq: 0 };
  const r1 = await orch.fire({ cause });
  assert.equal(r1.fireId, 1);
  assert.equal(fires[0].fireId, 1);
  assert.deepEqual(fires[0].cause, cause);
  assert.equal(asks.length, 1);
  assert.deepEqual(
    { fireId: asks[0].fireId, first: asks[0].windowFirstSeq, last: asks[0].windowLastSeq, n: asks[0].includedCount, vision: asks[0].vision },
    { fireId: 1, first: 0, last: 0, n: 1, vision: false }
  );
  assert.equal(souls[0].fireId, 1);
  assert.equal(souls[0].speaker, "soul");
  assert.equal(latencies.length, 1, "1 返事 1 回");
  assert.equal(latencies[0].fireId, 1);
  assert.deepEqual(latencies[0].cause, cause);
  assert.equal(latencies[0].llmFirstMs, 321, "delta の無い頭は session の ttftMs");
  assert.equal(latencies[0].spoken, true);
  assert.equal(latencies[0].voiceMs, null, "STARTED を見られない player では声の区間は測れない");

  buffer.append({ startMs: 0, endMs: 0, text: "二つ目" });
  const r2 = await orch.fire();
  assert.equal(r2.fireId, 2);
  assert.equal(fires[1].cause, null, "cause 無しの手動は null");
  assert.deepEqual([asks[1].windowFirstSeq, asks[1].windowLastSeq], [0, 2], "窓は末尾から連続（you, soul, you）");
  orch.dispose();
});

test("発火番号: 受理しなかった発火（耳未起動・空窓）は番号を振らず、cause は棄却の通知にも載る", { timeout: 5000 }, async () => {
  const fires = [];
  /** @type {any} */
  let buffer = null;
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { ask: async () => ({ replyText: "うん" }) },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onFire: (f) => fires.push(f)
  });
  const cause = { type: "manual", vision: false };
  const r = await orch.fire({ cause });
  assert.equal(r.reason, "ears-not-running");
  assert.equal(r.fireId, undefined);
  assert.deepEqual(fires[0], { accepted: false, reason: "ears-not-running", cause });
  buffer = createTranscriptBuffer();
  const empty = await orch.fire({ cause });
  assert.equal(empty.reason, "empty-window");
  assert.deepEqual(fires[1], { accepted: false, reason: "empty-window", cause });
  buffer.append({ startMs: 0, endMs: 1, text: "やあ" });
  const ok = await orch.fire({ cause });
  assert.equal(ok.fireId, 1, "棄却は番号を消費しない");
  orch.dispose();
});

test("推論の範囲: 画面ありの発火も ask の時点で窓の始まりと終わりの seq を通知する（受理はキャプチャ前）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("画面見て");
  buffer.append({ startMs: 0, endMs: 0, text: "ほら", speaker: "you" });
  const asks = [];
  const fires = [];
  const latencies = [];
  const clock = makeClock(1000);
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { ask: async () => { clock.add(200); return { replyText: "見えた", ttftMs: 150 }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    getVisionTarget: () => "テストゲーム",
    captureImpl: async () => { clock.add(600); return { jpegBase64: "AAAA", width: 10, height: 10, elapsedMs: 580 }; },
    monotonicNowImpl: clock.now,
    onFire: (f) => fires.push(f),
    onAsk: (a) => asks.push(a),
    onLatency: (l) => latencies.push(l)
  });
  const r = await orch.fire({ vision: true, cause: { type: "manual", vision: true } });
  assert.equal(r.fired, true);
  assert.equal(fires[0].accepted, true);
  assert.equal(fires[0].fireId, 1);
  assert.equal(fires[0].includedCount, undefined, "画面ありの受理は撮影前なので窓をまだ持たない（範囲は onAsk）");
  assert.deepEqual(
    [asks[0].fireId, asks[0].windowFirstSeq, asks[0].windowLastSeq, asks[0].vision],
    [1, 0, 1, true]
  );
  assert.equal(latencies[0].screenMs, 580, "画面 = キャプチャの elapsedMs");
  assert.equal(latencies[0].vision, true);
  orch.dispose();
});

test("推論の範囲: 画面優先（preferred）の劣化フォールバックでも ask の時点で範囲を通知する", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("呼んだ？");
  const asks = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { ask: async () => ({ replyText: "うん" }) },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    getVisionTarget: () => "テストゲーム",
    captureImpl: /** @type {any} */ (async () => ({ error: { kind: "not-found", message: "x" } })),
    onAsk: (a) => asks.push(a)
  });
  const r = await orch.fire({ vision: "preferred" });
  assert.equal(r.fired, true);
  assert.equal(asks.length, 1);
  assert.deepEqual([asks[0].windowFirstSeq, asks[0].windowLastSeq, asks[0].vision], [0, 0, false]);
  orch.dispose();
});

test("遅延（一括の読み上げ）: TTS = engine に頼んだ→最初の音、声 = 最初の音→STARTED（engine に依存しない名前）、声が鳴った時点で 1 回だけ通知", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("Claude 経路");
  const clock = makeClock(0);
  const latencies = [];
  /** @type {number | null} */
  let latencyAtStart = null;
  const speakImpl = async (_text, deps) => {
    clock.set(1500);
    deps.onTrace("voice.synthesis.requested", { jobId: "fire-1:sentence-1", speechChars: 3 });
    clock.set(1900);
    deps.onTrace("voice.audio.first_chunk", { jobId: "fire-1:sentence-1", pcmBytes: 10 });
    // engine の内訳の名前は遅延の区間に使わない。
    deps.onTrace("tts.synthesis.completed", { wavBytes: 10 });
    clock.set(2100);
    deps.onTrace("voice.player.started", { jobId: "fire-1:sentence-1" });
    latencyAtStart = latencies.length;
    return { timeline: [] };
  };
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { ask: async () => { clock.set(1300); return { replyText: "はい", ttftMs: 700 }; } },
    speakImpl: /** @type {any} */ (speakImpl),
    channel: fakeChannel,
    player: fakePlayer,
    monotonicNowImpl: clock.now,
    onLatency: (l) => latencies.push(l)
  });
  const r = await orch.fire();
  assert.equal(r.fired, true);
  assert.equal(latencyAtStart, 1, "STARTED を見た時点で通知（喋り終わりを待たない）");
  assert.equal(latencies.length, 1);
  const l = latencies[0];
  assert.equal(l.llmFirstMs, 700);
  assert.equal(l.firstSentenceMs, null, "一括の読み上げには最初の文の区間がない");
  assert.equal(l.ttsMs, 400);
  assert.equal(l.voiceMs, 200);
  assert.equal(l.screenMs, null);
  assert.equal(l.inFireMs, 2100, "fire() 呼び出し→声が鳴り始めるまで");
  assert.equal(l.otherMs, 2100 - 700 - 400 - 200, "名前の付いた区間の残り（Claude は最初の文字以降の生成が主）");
  orch.dispose();
});

test("遅延（文ごとの読み上げ）: LLM 最初の文字 = ask→first delta、最初の文 = first delta→最初の安全な文、TTS = engine に頼んだ→最初の音、声 = 最初の音→STARTED", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("二文で");
  const clock = makeClock(0);
  const player = makeProgressivePlayer();
  const latencies = [];
  const channel = {
    async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; },
    async sendSet() { return { result: "accepted", error: null, rttMs: 1 }; }
  };
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        clock.set(800);
        askOptions.onTextDelta("一");
        clock.set(1000);
        askOptions.onTextDelta("。");
        return { replyText: "一。", elapsedMs: 55, ttftMs: 999 };
      }
    },
    speakImpl: /** @type {any} */ (async () => {}),
    channel,
    player,
    progressivePlayback: true,
    // TTS = 最初の文で engine に頼んだ（delta「。」で文が確定した 1000）→ 最初の音のかたまり（1400）。
    speechStreamerFactory: progressiveStreamer(async (text) => {
      clock.set(1400);
      return progressiveArtifact(text);
    }),
    monotonicNowImpl: clock.now,
    onLatency: (l) => latencies.push(l)
  });
  const firePromise = orch.fire();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  clock.set(1600);
  emitProgressiveOwned(player, "STARTED", 0);
  assert.equal(latencies.length, 1, "最初の文の STARTED で通知");
  emitProgressiveOwned(player, "ENDED", 0);
  const r = await firePromise;
  assert.equal(r.fired, true);
  assert.equal(latencies.length, 1);
  const l = latencies[0];
  assert.equal(l.llmFirstMs, 800, "orchestrator が測った first delta を session の ttftMs より優先");
  assert.equal(l.firstSentenceMs, 200);
  assert.equal(l.ttsMs, 400);
  assert.equal(l.voiceMs, 200, "声 = 最初の音のかたまり→STARTED");
  assert.equal(l.inFireMs, 1600);
  orch.dispose();
});

test("遅延: 声が鳴らずに終わった返事（空応答）も ask した回は spoken:false で 1 回だけ通知・ask 前に止まった発火は通知しない", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("空で返して");
  const latencies = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { ask: async () => ({ replyText: "" }) },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    getVisionTarget: () => null,
    onLatency: (l) => latencies.push(l)
  });
  const r = await orch.fire();
  assert.equal(r.reason, "empty-reply");
  assert.equal(latencies.length, 1);
  assert.equal(latencies[0].spoken, false);
  assert.equal(latencies[0].inFireMs, null);
  await orch.fire({ vision: true }); // 対象未設定 = ask しない。
  assert.equal(latencies.length, 1);
  orch.dispose();
});

// ── 増えた分だけ渡す（長い配信の文脈・context-growth-2026-10.md §5・§6）───────────────────────

/** conversationKey を持つ偽物の Codex 頭（ask に渡された内容を記録・key は外から替えられる）。 */
function makeConversationSession(replyText = "うん") {
  const inputs = [];
  const state = { key: /** @type {string | null} */ ("thread-a"), nextKeyOnAsk: /** @type {string | null} */ (null) };
  return {
    inputs,
    state,
    session: {
      conversationKey: () => state.key,
      ask: async (content) => {
        inputs.push(content);
        if (state.key === null) state.key = state.nextKeyOnAsk ?? "thread-new";
        return {
          replyText,
          usage: { input_tokens: 10 },
          tokenUsage: { last: { inputTokens: 10 }, total: { inputTokens: 30 }, modelContextWindow: 1000 },
          ttftMs: 42,
          elapsedMs: 80
        };
      }
    }
  };
}

test("増えた分だけ: 同じ会話の 2 回目以降は前回渡した最後の seq より後ろの行だけ（チャッピーの行も含む）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("一つ目");
  const head = makeConversationSession("はいよ");
  const asks = [];
  const fires = [];
  const records = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: head.session,
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onAsk: (a) => asks.push(a),
    onFire: (f) => fires.push(f),
    onAskRecord: (r) => records.push(r)
  });
  await orch.fire();
  assert.equal(head.inputs[0], "you: 一つ目", "最初は直近の窓の全部");
  buffer.append({ startMs: 0, endMs: 0, text: "二つ目" });
  await orch.fire();
  assert.equal(head.inputs[1], "soul: はいよ\nyou: 二つ目", "前回より後ろだけ（実際に聞こえた soul 行を含む）");
  assert.deepEqual([asks[1].windowFirstSeq, asks[1].windowLastSeq, asks[1].includedCount], [1, 2, 2], "範囲は実際に渡した分");
  assert.deepEqual([fires[1].includedCount, fires[1].injectedChars], [2, head.inputs[1].length], "受理の行数・文字数も実際に渡した分");
  assert.deepEqual(records.map((r) => r.windowMode), ["full", "delta"]);
  assert.deepEqual(
    { ...records[1], atMs: null },
    {
      fireId: 2,
      brain: null,
      vision: false,
      windowMode: "delta",
      includedCount: 2,
      injectedChars: head.inputs[1].length,
      usage: { input_tokens: 10 },
      tokenUsage: { last: { inputTokens: 10 }, total: { inputTokens: 30 }, modelContextWindow: 1000 },
      ttftMs: 42,
      elapsedMs: 80,
      atMs: null
    }
  );
  orch.dispose();
});

test("増えた分だけ: 新しい行が無い発火は「（前回から新しい発言はなし）」（画面ありは指示の前に置く）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("見て");
  const head = makeConversationSession("");
  const asks = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: head.session,
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    getVisionTarget: () => "ゲーム",
    captureImpl: async () => ({ jpegBase64: "AAAA", width: 1, height: 1, elapsedMs: 1 }),
    onAsk: (a) => asks.push(a)
  });
  await orch.fire(); // 空の返事（soul 行は増えない）
  await orch.fire();
  assert.equal(head.inputs[1], "（前回から新しい発言はなし）");
  assert.deepEqual([asks[1].windowFirstSeq, asks[1].windowLastSeq, asks[1].includedCount], [null, null, 0]);
  await orch.fire({ vision: true });
  const blocks = /** @type {any[]} */ (head.inputs[2]);
  assert.equal(blocks[0].type, "image");
  assert.equal(blocks[1].text, "（前回から新しい発言はなし）\n今の画面を見て、直近の会話と合わせて自然に反応してください。");
  orch.dispose();
});

test("増えた分だけ: 会話の世代が変わったら（thread の作り直し・頭のセッションの差し替え）直近の窓を全部渡す", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("一つ目");
  const head = makeConversationSession("");
  const other = makeConversationSession("");
  let current = head.session;
  const records = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: head.session,
    acquireFireResources: () => ({ session: current, configuration: { brain: "codex-61-sol" } }),
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onAskRecord: (r) => records.push(r)
  });
  await orch.fire();
  buffer.append({ startMs: 0, endMs: 0, text: "二つ目" });
  head.state.key = null; // Codex が内部で thread を捨てた（次の ask が新しい thread）
  await orch.fire();
  assert.equal(head.inputs[1], "you: 一つ目\nyou: 二つ目", "新しい会話には直近の窓の全部");
  buffer.append({ startMs: 0, endMs: 0, text: "三つ目" });
  await orch.fire();
  assert.equal(head.inputs[2], "you: 三つ目", "新しい会話の 2 回目からはまた増えた分だけ");
  current = other.session; // 頭のセッションの差し替え（同じ key でも別の会話）
  buffer.append({ startMs: 0, endMs: 0, text: "四つ目" });
  await orch.fire();
  assert.equal(other.inputs[0], "you: 一つ目\nyou: 二つ目\nyou: 三つ目\nyou: 四つ目");
  assert.deepEqual(records.map((r) => r.windowMode), ["full", "full", "delta", "full"]);
  assert.equal(records[3].brain, "codex-61-sol");
  orch.dispose();
});

test("増えた分だけ: ask が失敗したら目印を進めない（次の ask で同じ行をもう一度渡す）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("一つ目");
  const head = makeConversationSession("");
  let fail = false;
  const session = {
    conversationKey: head.session.conversationKey,
    ask: async (content) => {
      if (fail) {
        head.inputs.push(content);
        throw new Error("transient");
      }
      return head.session.ask(content);
    }
  };
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session,
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer
  });
  await orch.fire();
  buffer.append({ startMs: 0, endMs: 0, text: "二つ目" });
  fail = true;
  const failed = await orch.fire();
  assert.equal(failed.reason, "error");
  fail = false;
  await orch.fire();
  assert.equal(head.inputs[1], "you: 二つ目");
  assert.equal(head.inputs[2], "you: 二つ目");
  orch.dispose();
});

test("増えた分だけ: conversationKey を持たない頭（Claude）は従来どおり毎回直近の窓の全部・記録は legacy", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("一つ目");
  const inputs = [];
  const records = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { ask: async (content) => { inputs.push(content); return { replyText: "" }; } },
    speakImpl: makeFakeSpeak().speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onAskRecord: (r) => records.push(r)
  });
  await orch.fire();
  buffer.append({ startMs: 0, endMs: 0, text: "二つ目" });
  await orch.fire();
  assert.deepEqual(inputs, ["you: 一つ目", "you: 一つ目\nyou: 二つ目"]);
  assert.deepEqual(records.map((r) => [r.windowMode, r.usage, r.tokenUsage, r.ttftMs]), [["legacy", null, null, null], ["legacy", null, null, null]]);
  orch.dispose();
});

// ── 声の差し替え Wave 2: 一括の読み上げ（Claude 経路）も本物の SpeechStreamer（speakOnce）に載る ──────────
//  完了は WAV 長のタイマーではなく player の ENDED。切断点は累積の時間割と STARTED 時刻（今と同じ結果）。

function makeOneShotRig({ timeline = BARGE_TIMELINE } = {}) {
  const engine = createFakeVoiceEngine({
    chunksFor: () => [
      { type: "format", sampleRate: 24000, channels: 1 },
      { type: "timeline", entries: timeline },
      { type: "audio", pcm: new Uint8Array(480) },
      { type: "end" }
    ]
  });
  const player = createFakeStreamPlayer();
  /** @type {any[]} */
  const sent = [];
  const accepted = async () => ({ result: "accepted", error: null, rttMs: 1 });
  const channel = {
    openSpeech: async (/** @type {string} */ id) => { sent.push({ op: "open", id }); return accepted(); },
    appendSpeech: async (/** @type {string} */ id, /** @type {any} */ t) => { sent.push({ op: "append", id, count: t.length }); return accepted(); },
    endSpeech: async (/** @type {string} */ id) => { sent.push({ op: "end", id }); return accepted(); },
    sendSet: async (/** @type {any} */ intent) => { sent.push({ op: "set", intent }); return accepted(); },
    sendEnvelope: accepted
  };
  return { engine, player, channel, sent };
}

test("一括の読み上げ（本物の speakOnce）: open→append→end を送り、完了は ENDED（それまで speaking・soul 未追記）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const rig = makeOneShotRig();
  const states = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    engine: rig.engine,
    channel: rig.channel,
    player: rig.player,
    onState: (s) => states.push(s)
  });
  const p = orch.fire();
  await flushMicrotasks(200);
  assert.equal(rig.player.opened.length, 1);
  assert.deepEqual(rig.sent.map((e) => e.op), ["open", "append", "end"]);
  assert.equal(rig.sent[1].count, 5);
  rig.player.emitFor("started", 0);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(orch.getState(), "speaking", "タイマーでは終わらない（ENDED まで speaking）");
  assert.equal(buffer.all().length, 1);
  rig.player.emitFor("ended", 0);
  const result = await p;
  assert.equal(result.fired, true);
  assert.equal(result.replyText, "こんにちは");
  assert.equal(buffer.all()[1].text, "こんにちは");
  assert.equal(rig.sent.some((e) => e.op === "set"), false, "自然完了は endSpeech（release しない）");
  assert.deepEqual(states, ["thinking", "speaking", "idle"]);
  orch.dispose();
});

test("一括の読み上げ（本物の speakOnce）: barge-in の切断点は累積の時間割 × STARTED からの経過（旧と同じ結果）・stop → 口閉じ・合成に中止", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou("ねえ、聞いてる？");
  const rig = makeOneShotRig();
  const diags = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    engine: rig.engine,
    channel: rig.channel,
    player: rig.player,
    onDiagnostic: (d) => diags.push(d)
  });
  const p = orch.fire();
  await flushMicrotasks(200);
  rig.player.emit("started", rig.player.opened[0], { atMs: 1000 });
  const info = await orch.interrupt(1350);
  assert.equal(info.interrupted, true);
  assert.equal(info.prefix, "こんに");
  assert.equal(info.charsSpoken, 3);
  const result = await p;
  assert.equal(result.interrupted, true);
  assert.equal(rig.player.stops, 1);
  assert.deepEqual(rig.sent.filter((e) => e.op === "set").map((e) => e.intent), [{ slotId: "mouth-open", value: 0, ttlMs: MOUTH_CLOSE_TTL_MS }]);
  assert.equal(rig.engine.requests[0].signal?.aborted, true);
  assert.equal(buffer.all()[1].text, "こんに" + BARGE_IN_NOTE);
  const bi = diags.find((d) => d.type === "bargeIn");
  assert.equal(bi.elapsedMs, 350);
  assert.equal(bi.totalChars, 5);
  orch.dispose();
});

test("一括の読み上げ（本物の speakOnce）: STARTED 前の barge-in は 0 文字・kill も同じ経路で止める", { timeout: 5000 }, async () => {
  for (const action of ["interrupt", "kill"]) {
    const buffer = bufferWithYou();
    const rig = makeOneShotRig();
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session: { async ask() { return { replyText: "こんにちは" }; } },
      engine: rig.engine,
      channel: rig.channel,
      player: rig.player
    });
    const p = orch.fire();
    await flushMicrotasks(200);
    const info = action === "interrupt" ? await orch.interrupt(5000) : await orch.kill(5000);
    assert.equal(info.prefix, "", `${action}: まだ鳴っていない`);
    await p;
    assert.equal(rig.player.stops, 1, action);
    assert.equal(rig.sent.filter((e) => e.op === "set").length, 1, action);
    assert.equal(buffer.all()[1].text, action === "interrupt" ? BARGE_IN_NOTE : KILL_NOTE);
    orch.dispose();
  }
});

test("一括の読み上げ（本物の speakOnce）: 鳴らし始めた後の player の ERROR は「鳴った分 + 中断注記」で soul に正本化・fireError にしない・口を release", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const rig = makeOneShotRig();
  const diags = [];
  const traces = [];
  const visible = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    engine: rig.engine,
    channel: rig.channel,
    player: rig.player,
    onDiagnostic: (d) => diags.push(d),
    onTrace: (t) => traces.push(t),
    onSoulTranscript: (entry) => visible.push(entry)
  });
  const p = orch.fire();
  await flushMicrotasks(200);
  // 切断点の材料は barge-in と同じ（累積の時間割 × STARTED からの経過）。350ms 鳴って失敗 → 「こんに」。
  rig.player.emit("started", rig.player.opened[0], { atMs: 1000 });
  rig.player.emit("error", rig.player.opened[0], { atMs: 1350 });
  const result = await p;
  const canonical = `こんに
${PROGRESSIVE_INTERRUPTION_NOTE}`;
  assert.equal(result.fired, false);
  assert.equal(result.reason, "speech-playback-failed");
  assert.equal(result.charsSpoken, 3);
  assert.equal(result.elapsedMs, 350);
  assert.equal(diags.some((d) => d.type === "fireError"), false, "鳴った分を正本化したら fireError にしない");
  assert.equal(buffer.all().length, 2);
  assert.equal(buffer.all()[1].text, canonical);
  assert.equal(buffer.all()[1].speaker, "soul");
  assert.deepEqual(visible.map((entry) => entry.text), [canonical]);
  assert.equal(rig.sent.filter((e) => e.op === "set").length, 1, "口は SpeechStreamer が 1 回 release");
  const projected = traces.find((t) => t.event === "speech.partial.projected");
  assert.deepEqual(
    { playedChars: projected.playedChars, totalChars: projected.totalChars, terminalCause: projected.terminalCause },
    { playedChars: 3, totalChars: 5, terminalCause: "error" }
  );
  assert.ok(traces.every((t) => !JSON.stringify(t).includes("こんに")), "診断に本文を載せない");
  assert.equal(orch.getState(), "idle");
  orch.dispose();
});

test("一括の読み上げ（本物の speakOnce）: 鳴らし始めた後でも鳴った分が 0 文字・STARTED 前の失敗は今どおり fireError・soul に積まない", { timeout: 5000 }, async () => {
  for (const when of ["zero-chars", "before-started"]) {
    const buffer = bufferWithYou();
    const rig = makeOneShotRig();
    const diags = [];
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session: { async ask() { return { replyText: "こんにちは" }; } },
      engine: rig.engine,
      channel: rig.channel,
      player: rig.player,
      onDiagnostic: (d) => diags.push(d)
    });
    const p = orch.fire();
    await flushMicrotasks(200);
    if (when === "zero-chars") {
      // 最初のモーラ（timeMs 0）をまだ過ぎていない（経過 0ms）→ 0 文字。
      rig.player.emit("started", rig.player.opened[0], { atMs: 1000 });
      rig.player.emit("error", rig.player.opened[0], { atMs: 1000 });
    } else {
      rig.player.emit("error", rig.player.opened[0], { atMs: 1350 });
    }
    const result = await p;
    assert.equal(result.fired, false, when);
    assert.equal(result.reason, "error", when);
    assert.equal(diags.filter((d) => d.type === "fireError").length, 1, when);
    assert.equal(rig.sent.filter((e) => e.op === "set").length, 1, when);
    assert.equal(buffer.all().length, 1, `${when}: soul に積まない`);
    assert.equal(orch.getState(), "idle", when);
    orch.dispose();
  }
});

test("一括の読み上げ（本物の speakOnce）: 鳴らし始めた後の見張りの時間切れも鳴った分を正本化する（失敗の時刻は時計）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const rig = makeOneShotRig();
  let clock = 1000;
  /** @type {Array<() => void>} */
  const timers = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    engine: rig.engine,
    channel: rig.channel,
    player: rig.player,
    nowImpl: () => clock,
    setTimeoutImpl: /** @type {any} */ ((/** @type {() => void} */ fn) => {
      timers.push(fn);
      return timers.length;
    }),
    clearTimeoutImpl: /** @type {any} */ (() => {})
  });
  const p = orch.fire();
  await flushMicrotasks(200);
  rig.player.emit("started", rig.player.opened[0], { atMs: 1000 });
  await flushMicrotasks(20);
  // ENDED が来ないまま見張りが切れる（時計は 1350ms）。
  clock = 1350;
  for (const fn of timers.splice(0)) fn();
  const result = await p;
  assert.equal(result.reason, "speech-playback-failed");
  assert.equal(buffer.all()[1].text, `こんに
${PROGRESSIVE_INTERRUPTION_NOTE}`);
  orch.dispose();
});

test("一括の読み上げ（本物の speakOnce）: 器が open を拒否したら鳴らさず fireError（code speech_rejected）", { timeout: 5000 }, async () => {
  const buffer = bufferWithYou();
  const rig = makeOneShotRig();
  rig.channel.openSpeech = async () => ({ result: "rejected", error: { code: "slotNotWritable", message: "x" }, rttMs: 1 });
  const traces = [];
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "こんにちは" }; } },
    engine: rig.engine,
    channel: rig.channel,
    player: rig.player,
    onTrace: (t) => traces.push(t)
  });
  const result = await orch.fire();
  assert.equal(result.reason, "error");
  assert.equal(rig.player.opened.length, 0);
  const failed = traces.find((t) => t.event === "fire.failed");
  assert.equal(failed.stage, "control_channel.rejection");
  assert.equal(failed.failureCode, "speech_rejected");
  orch.dispose();
});
