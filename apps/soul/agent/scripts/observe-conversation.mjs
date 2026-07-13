// @ts-check
/**
 * S6 会話観測「observe-conversation」（Domain D）— apps/soul/agent。**実 SDK を最小回数だけ叩く**。
 *
 * observe-vision.mjs（S5 Domain C 後半）の写経。fire-orchestrator（barge-in・soul 追記タイミング）と
 * fire-scheduler（呼びかけ/区切り/沈黙の自発 3 種判定）を**実物のまま**組み合わせ、session だけを実
 * `createLlmSession`（サブスク OAuth・claude-opus-4-8）に差し替えて駆動する。player/channel/speak は
 * fake（実 TTS・実器・実マイクは一切使わない）。
 *
 * ── 何が実物で何が fake か ──────────────────────────────────────────────
 *  実物: createFireOrchestrator / createFireScheduler / createTranscriptBuffer（S6 Domain A/B/C の
 *        成果物をそのまま import・一切改修していない）・createLlmSession（Agent SDK・サブスク OAuth）・
 *        FIRE_SYSTEM_PROMPT・listWindows/captureWindow（沈黙発火=視覚発火の実キャプチャに使う）。
 *  fake: player（play/stop を記録するだけ・実 WinRT MediaPlayer は起動しない）・channel（sendSet/
 *        sendEnvelope を記録し accepted を返すだけ・実 Control Channel には繋がない）・speakImpl
 *        （実 AivisSpeech TTS は叩かず、母音タイムラインと wavDurationSec を合成して返すだけ）。
 *  fire-scheduler のタイマ・時計・乱数は**このスクリプトが注入する fake clock/RNG**で駆動する（実際に
 *  45〜75 秒/8〜90 秒待つのではなく、fake clock を進めて発火条件を即座に成立させる。scheduler 自身の
 *  判定ロジックは本物のまま実行される＝「タイマ駆動で音声入力不要」という S6 の性質を利用した観測）。
 *
 * ── 観測項目（wave 計画 §3 Domain D・inventory §6）────────────────────────────
 *  (a) barge-in 中断 + 「遮られた事実を踏まえた」返事の実観測（ask #1: 発話開始→中断・ask #2: 中断後の
 *      次発火で LLM が中断注記を読んで反応するか）。
 *  (b) 呼びかけ（call）発火の実測（ask #3: fire-scheduler.handleTranscript が名前照合命中→
 *      fireOrchestrator.fire() が実際に実 SDK ask を撃つ）。
 *  (c) 区切り応答（turn-end）発火の実測（ask #4: fake clock を turnEndSilenceMs 分進める）。
 *  (d) 沈黙（silence）発火の実測（ask #5: fake clock を silenceBaseMs+silenceRefractoryMs 分進める・
 *      視覚発火なので自分で起動したメモ帳窓を実 captureWindow で撮る）。
 *  (e) usage 推移（S5 usage 計器と同型・ask ごとに記録）。
 *
 * ── 撃たない項目（正直な線引き・鉄の規律）───────────────────────────────────
 *  **barge-in の「体感レイテンシ」（ユーザー発話開始→魂の声が実際に止まるまで）は実マイク・実器・実
 *  TTS・実 WinRT MediaPlayer が要る**ため、このスクリプトでは測れない（fake player の stop() 呼び出しは
 *  コード実行時間のみで、実再生停止の体感とは無関係）。人間ゲート/実配信の領分として明示的に「未実施」と
 *  記録する（撃っていないものを撃ったことにしない）。
 *
 * ── SDK 実消費の上限（鉄の規律・wave 計画 §4-4・s6-wave-plan の実SDK確認枠）─────────────
 *  **実 ask は 5 回まで**（このスクリプト自身がハードガードで 6 回目は throw・リトライも 1 回の ask
 *  としてカウント）。env ガード（assertSubscriptionAuthEnv）が ANTHROPIC_API_KEY 等を検出したら起動
 *  拒否される（その場合は未実測として experiments/s6-conversation.md に正直に記録する）。
 *
 * 実行（サブスク枠を消費するので不用意に走らせない）:
 *   node apps/soul/agent/scripts/observe-conversation.mjs
 * 前提: /login 済み・ガード対象環境変数が未設定。AivisSpeech・器・マイク・実ゲームは不要
 * （fake player/channel/speak で発話経路を代替・沈黙発火のキャプチャ対象は自分で起動したメモ帳のみ）。
 */

import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertSubscriptionAuthEnv } from "../src/mind/env-guard.mjs";
import { createLlmSession } from "../src/mind/llm-session.mjs";
import { createFireOrchestrator, FIRE_SYSTEM_PROMPT } from "../src/mind/fire-orchestrator.mjs";
import { createFireScheduler } from "../src/mind/fire-scheduler.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";
import { captureWindow } from "../src/eyes/window-capture.mjs";
import { listWindows } from "../src/eyes/window-list.mjs";

/** 実 ask のハード上限（鉄の規律・wave 計画 §4-4）。リトライも 1 ask としてカウントする。 */
const MAX_ASKS = 5;
/** 1 ask のタイムアウト（ハング保険）。 */
const ASK_TIMEOUT_MS = 90_000;
/** 空応答 / タイムアウト時の再試行上限（鉄の規律 6）。 */
const MAX_RETRIES = 3;
/** barge-in で「発話の途中」まで待つ実時間（fake speak の wavDurationSec より短くする）。 */
const INTERRUPT_AFTER_MS = 1200;

/** メモ帳に書き込む特徴的なマーカー本文（沈黙=視覚発火の言及判定材料。observe-vision.mjs の写経）。 */
const VISION_MARKER_BODY =
  "S6会話観測: 青いペンギンが虹色のスケボーで宇宙を飛んでいる。背景には黄色い月が3つ並んでいる。";
const MARKER_KEYWORDS = ["ペンギン", "スケボー", "青", "黄色", "虹", "月", "宇宙"];

function log(line) {
  process.stdout.write(`${line}\n`);
}
function round1(v) {
  return v == null ? null : Number(Number(v).toFixed(1));
}
/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** usage オブジェクトから cache 系フィールドのキーだけを抽出する（観測用・形状の加工はしない）。 */
function cacheFieldsOf(usage) {
  if (usage == null || typeof usage !== "object") return {};
  const out = {};
  for (const key of Object.keys(usage)) {
    if (/cache/i.test(key)) out[key] = usage[key];
  }
  return out;
}

/**
 * fire-scheduler 専用の fake clock（実時間を進めずタイマを即座に発火させる・fire-scheduler.test.mjs の
 * makeFakeClock と同型）。fire-orchestrator 側は実時間のまま（barge-in の体感は実時間で扱う設計）。
 */
function makeFakeClock(startMs = 0) {
  let now = startMs;
  /** @type {Array<{ id: number; at: number; cb: Function }>} */
  let timers = [];
  let nextId = 1;
  return {
    nowImpl: () => now,
    /** @param {Function} cb @param {number} ms */
    setTimeoutImpl: (cb, ms) => {
      const id = nextId++;
      timers.push({ id, at: now + Math.max(0, Number(ms) || 0), cb });
      return id;
    },
    /** @param {number} id */
    clearTimeoutImpl: (id) => {
      timers = timers.filter((t) => t.id !== id);
    },
    /** 時計を ms 進め、その間に発火時刻へ到達した全タイマを時刻順に実行する（連鎖登録も追う）。 */
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let earliest = null;
        for (const t of timers) {
          if (t.at <= target && (earliest == null || t.at < earliest.at)) earliest = t;
        }
        if (earliest == null) break;
        timers = timers.filter((t) => t.id !== earliest.id);
        now = earliest.at;
        earliest.cb();
      }
      now = target;
    },
    pendingCount: () => timers.length
  };
}

/** ask をタイムアウト付きで撃つ（ハング保険）。observe-vision.mjs の写経。 */
function askWithTimeout(session, content, timeoutMs) {
  return Promise.race([
    session.ask(content),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`ask timed out after ${timeoutMs}ms`)), timeoutMs).unref?.()
    )
  ]);
}

/**
 * 自分で起動したメモ帳窓にマーカー本文を書かせ、listWindows() で発見する（撮影は fireOrchestrator の
 * fireVision 内部が captureWindow で行うので、ここではタイトル解決と後始末だけを担う）。
 * observe-vision.mjs の captureMarkerWindow の写経（撮影自体を呼ばない点のみ異なる）。
 * @returns {Promise<{ title: string; cleanup: () => Promise<void> }>}
 */
async function openMarkerNotepad() {
  const marker = `conversation-observe-${Date.now()}`;
  const tmpFile = path.join(os.tmpdir(), `${marker}.txt`);
  fs.writeFileSync(tmpFile, VISION_MARKER_BODY, "utf8");

  /** @type {import("node:child_process").ChildProcess | null} */
  let notepad = null;
  /** @type {number | null} */
  let windowOwnerPid = null;
  let title = "";

  log(`[observe-conversation] notepad.exe 起動（マーカー本文込み）: ${tmpFile}`);
  notepad = spawn("notepad.exe", [tmpFile], { stdio: "ignore" });
  if (typeof notepad.unref === "function") notepad.unref();

  const expectedTitleFragment = `${marker}.txt`;
  const deadline = Date.now() + 15000;
  /** @type {{ pid: number; processName: string; title: string } | null} */
  let found = null;
  while (Date.now() < deadline) {
    const listed = await listWindows();
    if ("error" in listed) {
      throw new Error(`listWindows failed while polling for notepad: ${JSON.stringify(listed.error)}`);
    }
    found = listed.windows.find((w) => w.title.includes(expectedTitleFragment)) ?? null;
    if (found) break;
    await sleep(300);
  }
  if (!found) {
    throw new Error(`notepad window not found in listWindows() within timeout (looked for "${expectedTitleFragment}")`);
  }
  title = found.title;
  windowOwnerPid = found.pid;
  log(`[observe-conversation] listWindows() にメモ帳窓を確認: pid=${found.pid} title="${found.title}"`);

  const cleanup = async () => {
    const pidsToKill = new Set(
      [windowOwnerPid, notepad?.pid].filter((pid) => typeof pid === "number" && pid > 0)
    );
    for (const pid of pidsToKill) {
      await new Promise((resolve) => {
        execFile("taskkill", ["/PID", String(pid), "/F", "/T"], () => resolve(undefined));
      });
      log(`[observe-conversation] notepad (pid=${pid}) を後始末（taskkill）`);
    }
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // best-effort
    }
  };

  return { title, cleanup };
}

/** fake player（実 WinRT MediaPlayer は起動しない・play/stop を記録するだけ）。 */
function makeFakePlayer() {
  const record = { plays: [], stops: 0 };
  return {
    record,
    play(wavPath) {
      record.plays.push(wavPath);
    },
    stop() {
      record.stops += 1;
    }
  };
}

/** fake channel（実 Control Channel には繋がない・sendSet/sendEnvelope を記録し accepted を返すだけ）。 */
function makeFakeChannel() {
  const record = { sets: [], envelopes: [] };
  return {
    record,
    async sendSet(intent) {
      record.sets.push(intent);
      return { result: "accepted", error: null, rttMs: 0 };
    },
    async sendEnvelope(intent) {
      record.envelopes.push(intent);
      return { result: "accepted", error: null, rttMs: 0 };
    }
  };
}

/**
 * fake speakImpl（実 AivisSpeech TTS は叩かない）。speechText の文字数から母音タイムラインと
 * wavDurationSec を合成して返す（barge-in の「途中で遮る」を実時間で再現できるだけの長さにする）。
 */
async function fakeSpeakImpl(speechText, deps) {
  const player = deps && deps.player;
  const wavPath = "(fake-wav-no-real-tts)";
  if (player && typeof player.play === "function") {
    player.play(wavPath);
  }
  const moraCount = Math.max(1, speechText.length);
  const msPerMora = 220; // 実喋りより長めに取り、barge-in を安全に「途中」で挟めるようにする。
  const timeline = [];
  for (let i = 0; i < moraCount; i += 1) {
    timeline.push({ timeMs: i * msPerMora, vowel: "a", s: 1 });
  }
  const wavDurationSec = (moraCount * msPerMora + 500) / 1000;
  return {
    timeline,
    wavDurationSec,
    wavPath,
    rttMs: 0,
    playbackStartedAtMs: Date.now()
  };
}

async function main() {
  const { warnings } = assertSubscriptionAuthEnv(process.env); // ガード違反はここで throw = 起動拒否。
  for (const w of warnings) {
    log(`[observe-conversation] WARN: ${w}`);
  }
  log(
    `[observe-conversation] ${new Date().toISOString()} node ${process.version} ${process.platform} — ` +
      `実 ask は最大 ${MAX_ASKS} 回。fire-orchestrator/fire-scheduler は実物・player/channel/speak は fake。`
  );

  const buffer = createTranscriptBuffer(); // 実時計 = すべて窓内（既定 5 分）。
  const fakePlayer = makeFakePlayer();
  const fakeChannel = makeFakeChannel();

  /** @type {any} */
  let initMessage = null;
  const session = createLlmSession({
    systemPrompt: FIRE_SYSTEM_PROMPT, // 本番結線と同一。
    onInit: (init) => {
      initMessage = init;
    },
    onWarning: (w) => log(`[observe-conversation] WARN: ${w}`)
  });

  // ask 計測ラッパ + ハード予算ガード（6 回目の ask は throw・リトライも 1 ask としてカウント）。
  // fire-orchestrator（通常 fire・視覚発火）・fire-scheduler いずれ経由でも session.ask はこの
  // measuringSession を通る一本道なので、ここで記録すれば全シナリオの ask が漏れなく捕まる。
  let askCount = 0;
  /** @type {any[]} */
  const askObservations = [];
  const measuringSession = {
    /** @param {string | Array<any>} content */
    async ask(content) {
      if (askCount >= MAX_ASKS) {
        throw new Error(`observe-conversation: ask budget (${MAX_ASKS}) exceeded — refusing further SDK calls.`);
      }
      askCount += 1;
      const askNum = askCount;
      const label = `ask #${askNum}`;
      let attempt = 0;
      for (;;) {
        attempt += 1;
        try {
          const asked = await askWithTimeout(session, content, ASK_TIMEOUT_MS);
          const replyText = asked && typeof asked.replyText === "string" ? asked.replyText : "";
          if (replyText.trim().length === 0) {
            log(`[observe-conversation] ${label} attempt ${attempt}: empty/interrupted reply — retrying.`);
            if (attempt >= MAX_RETRIES) throw new Error(`${label}: empty reply after ${MAX_RETRIES} attempts.`);
            continue;
          }
          askObservations.push({
            ask: askNum,
            replyRaw: replyText,
            ttft_ms: round1(asked.ttftMs),
            ask_ms: round1(asked.elapsedMs),
            usage: asked.usage ?? null,
            cacheFields: cacheFieldsOf(asked.usage)
          });
          return asked;
        } catch (err) {
          log(`[observe-conversation] ${label} attempt ${attempt} FAILED: ${err instanceof Error ? err.message : String(err)}`);
          if (attempt >= MAX_RETRIES) throw new Error(`${label}: ${MAX_RETRIES} attempts exhausted (${err instanceof Error ? err.message : String(err)})`);
        }
      }
    }
  };

  // ── barge-in 中断の観測状態（fireOrchestrator.onDiagnostic の bargeIn 診断を捕まえる）───────
  /** @type {any} */
  let lastBargeInDiag = null;
  let sawSpeaking = false;
  /** @type {() => void} */
  let resolveSpeaking = () => {};
  const speakingPromise = new Promise((resolve) => {
    resolveSpeaking = resolve;
  });

  /** @type {string | null} */
  let visionTargetTitle = null;

  const orchestrator = createFireOrchestrator({
    getBuffer: () => buffer,
    session: measuringSession,
    speakImpl: fakeSpeakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    getVisionTarget: () => visionTargetTitle,
    onState: (s) => {
      if (s === "speaking" && !sawSpeaking) {
        sawSpeaking = true;
        resolveSpeaking();
      }
    },
    onDiagnostic: (d) => {
      if (d && d.type === "bargeIn") lastBargeInDiag = d;
      if (d && typeof d.type === "string" && d.type.length > 0) {
        log(`[observe-conversation] diagnostic: ${JSON.stringify(d)}`);
      }
    }
  });

  // ── fire-scheduler（実物）を fake clock + rng=常に0（確率判定は必ず通過・ジッターは常に0）で駆動 ──
  const clock = makeFakeClock(0);
  /** @type {Promise<any> | null} */
  let capturedFirePromise = null;
  /** @type {string | null} */
  let lastRequestKind = null;
  const scheduler = createFireScheduler({
    enabled: true,
    isBusy: () => orchestrator.getState() !== "idle",
    nowImpl: clock.nowImpl,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    rng: () => 0, // turn-end 確率判定は必ず通過（0 < 0.35）・silence ジッターは常に 0（base のみ待つ）。
    onFireRequest: (req) => {
      lastRequestKind = req.kind;
      capturedFirePromise = req.kind === "silence" ? orchestrator.fire({ vision: true }) : orchestrator.fire();
    }
  });

  // 転写バッファへの append を fire-scheduler へ回す（cockpit-server の onAppend 配線と同型・
  // you/soul 両方が届く＝soul 発話でも不応期がリセットされる本番の挙動を再現する）。
  buffer.onAppend((entry) => {
    scheduler.handleTranscript(entry);
  });

  /** @type {any} */
  const summary = {
    recordedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    model: null,
    apiKeySource: null,
    systemPrompt: "FIRE_SYSTEM_PROMPT (本番結線と同一)",
    scenarios: {}
  };

  let notepadHandle = null;
  try {
    // ══════════════════════════════════════════════════════════════════
    // シナリオ 1（ask #1・#2）: barge-in 中断 → 次発火で「遮られた事実」への反応を観測
    // ══════════════════════════════════════════════════════════════════
    log("");
    log("=== シナリオ1: barge-in 中断 ===");
    buffer.append({ startMs: 0, endMs: 2000, text: "配信の感想を一言でいいから聞かせてよ" });
    // fire() 自体は processAskedReply が speaking window を await して初めて resolve するため、
    // ここでは Promise を保持するだけで await しない（この後の interrupt() と競走させる）。
    const fireResult1Promise = orchestrator.fire();
    await speakingPromise; // ask 完了 → speak(fake) → speaking 状態に到達するまで実際に待つ。
    log(`[observe-conversation] speaking に到達（ask #${askCount} 完了）。${INTERRUPT_AFTER_MS}ms 待って interrupt する。`);
    await sleep(INTERRUPT_AFTER_MS);
    const interruptResult = await orchestrator.interrupt();
    const fireResult1 = await fireResult1Promise;
    log(`[observe-conversation] interrupt() 結果: ${JSON.stringify(interruptResult)}`);
    log(`[observe-conversation] fire() 結果（中断済み）: ${JSON.stringify(fireResult1)}`);

    const soulEntriesAfterInterrupt = buffer.all().filter((e) => e.speaker === "soul");
    const lastSoulLine = soulEntriesAfterInterrupt[soulEntriesAfterInterrupt.length - 1];
    log(`[observe-conversation] soul 行（中断後）: "${lastSoulLine ? lastSoulLine.text : "(none)"}"`);

    summary.scenarios.bargeIn = {
      askUsed: 1,
      interruptResult,
      fireResult: fireResult1,
      bargeInDiagnostic: lastBargeInDiag,
      soulLineAfterInterrupt: lastSoulLine ? lastSoulLine.text : null,
      note:
        "barge-in の『体感レイテンシ』（実マイク発話開始→実際に声が止まるまで）は fake player/実マイク不使用のため測定していない（未実施・人間ゲート領分）。ここで測ったのは interrupt() 呼び出し自体の実行と、切断点算出・soul 追記が実際に機能することのみ。"
    };

    // 次の fire（ask #2）で「遮られた事実」を踏まえた返事が来るか観測。
    log("");
    log("=== シナリオ1続き: 中断後の次発火（『遮られた事実』への言及を観測）===");
    buffer.append({ startMs: 3000, endMs: 5000, text: "さっき遮っちゃってごめんね、続き聞かせて" });
    // 2 回目の fire は speaking に到達しても最後まで自然完了させる（await するだけでよい）。
    sawSpeaking = false;
    const fireResult2 = await orchestrator.fire();
    log(`[observe-conversation] fire() 結果（続き）: ${JSON.stringify(fireResult2)}`);
    const mentionsInterruption = /遮|中断|ごめ|さっき|途中/.test(fireResult2.replyText ?? "");
    summary.scenarios.bargeInFollowup = {
      askUsed: 1,
      you: "さっき遮っちゃってごめんね、続き聞かせて",
      replyRaw: fireResult2.replyText ?? null,
      mentionsInterruptionKeyword: mentionsInterruption,
      note:
        "LLM が中断の事実に明示的に言及するかは表現の自由度が高く機械判定が難しい。生の返事テキストをそのまま記録し、キーワード一致は参考情報に留める（人間の目で判断してほしい）。"
    };

    // ══════════════════════════════════════════════════════════════════
    // シナリオ 2（ask #3）: fire-scheduler 経由の呼びかけ（call）発火
    // ══════════════════════════════════════════════════════════════════
    log("");
    log("=== シナリオ2: 呼びかけ（call）発火（fire-scheduler 経由）===");
    lastRequestKind = null;
    capturedFirePromise = null;
    buffer.append({ startMs: 6000, endMs: 6500, text: "コーディ、聞いてる?" });
    if (capturedFirePromise == null) {
      throw new Error("observe-conversation: 呼びかけが fire 要求を出さなかった（textMatchesName 不一致?）");
    }
    const callFireResult = await capturedFirePromise;
    log(`[observe-conversation] call 発火 kind=${lastRequestKind} fire()結果: ${JSON.stringify(callFireResult)}`);
    summary.scenarios.call = {
      askUsed: 1,
      kind: lastRequestKind,
      fireResult: callFireResult,
      clockAtRequestMs: clock.nowImpl()
    };

    // ══════════════════════════════════════════════════════════════════
    // シナリオ 3（ask #4）: fire-scheduler 経由の区切り応答（turn-end）発火
    // ══════════════════════════════════════════════════════════════════
    log("");
    log("=== シナリオ3: 区切り応答（turn-end）発火（fake clock 前進）===");
    clock.advance(8500); // 不応期（8000ms）をクリアする。
    lastRequestKind = null;
    capturedFirePromise = null;
    buffer.append({ startMs: 0, endMs: 900, text: "今日はいい天気だね" }); // 呼びかけを含まない発話。
    scheduler.handleVadEvent({ type: "speechEnd" }); // 無音待ちタイマ（turnEndSilenceMs=2000）を張る。
    clock.advance(2000); // タイマ満了 → busy/不応期/確率の判定 → 条件成立で emitFire("turn-end")。
    if (capturedFirePromise == null) {
      throw new Error("observe-conversation: turn-end が fire 要求を出さなかった（不応期/確率の条件不成立?）");
    }
    const turnEndFireResult = await capturedFirePromise;
    log(`[observe-conversation] turn-end 発火 kind=${lastRequestKind} fire()結果: ${JSON.stringify(turnEndFireResult)}`);
    summary.scenarios.turnEnd = {
      askUsed: 1,
      kind: lastRequestKind,
      fireResult: turnEndFireResult,
      clockAtRequestMs: clock.nowImpl(),
      constants: { turnEndSilenceMs: 2000, turnEndProbability: 0.35, turnEndRefractoryMs: 8000 }
    };

    // ══════════════════════════════════════════════════════════════════
    // シナリオ 4（ask #5）: fire-scheduler 経由の沈黙（silence）発火 = 視覚発火
    // ══════════════════════════════════════════════════════════════════
    log("");
    log("=== シナリオ4: 沈黙（silence）発火（fake clock 前進・視覚発火・実キャプチャ）===");
    notepadHandle = await openMarkerNotepad();
    visionTargetTitle = notepadHandle.title;
    lastRequestKind = null;
    capturedFirePromise = null;
    // 長い不応期（silenceRefractoryMs=90000ms）を跨ぐ量だけ進める。進行中に silence タイマが不成立
    // （不応期内）で再武装を繰り返すのは正常（advance が連鎖処理する）。次の周期（さらに+45000ms）に
    // 入る前で止める（95000 < 90000+45000=135000）——2 回目の silence タイマ発火を advance 1 回の
    // 中で踏まないための安全マージン（fireVision の非同期性により getState() が "idle" のまま 2 回目の
    // タイマに到達しうるため、busy 判定に頼らず不応期の外形で防ぐ）。
    clock.advance(95_000);
    if (capturedFirePromise == null) {
      throw new Error(
        "observe-conversation: silence が fire 要求を出さなかった（不応期/予算/busy の条件不成立?）"
      );
    }
    const silenceFireResult = await capturedFirePromise;
    log(`[observe-conversation] silence 発火 kind=${lastRequestKind} fire()結果: ${JSON.stringify(silenceFireResult)}`);
    summary.scenarios.silence = {
      askUsed: 1,
      kind: lastRequestKind,
      fireResult: silenceFireResult,
      clockAtRequestMs: clock.nowImpl(),
      screenReferencedKeywords: MARKER_KEYWORDS.filter((kw) => (silenceFireResult.replyText ?? "").includes(kw)),
      silenceBudgetRemaining: scheduler.silenceBudgetRemaining(),
      constants: { silenceBaseMs: 45_000, silenceJitterMs: 30_000, silenceRefractoryMs: 90_000, silenceBudget: 6 }
    };

    // ── 集計 ──────────────────────────────────────────────────────────
    summary.model = initMessage?.model ?? null;
    summary.apiKeySource = initMessage?.apiKeySource ?? null;
    summary.asks = askCount;
    summary.askObservations = askObservations;
    summary.fakePlayerRecord = fakePlayer.record;
    summary.fakeChannelRecord = fakeChannel.record;

    log("");
    log("=== JSON SUMMARY (experiments/s6-conversation.md 記録用) ===");
    log(JSON.stringify(summary, null, 2));
  } finally {
    if (notepadHandle) {
      await notepadHandle.cleanup();
    }
    scheduler.dispose();
    orchestrator.dispose();
    await session.dispose();
    log("");
    log(`[observe-conversation] session disposed. (SDK 実行 = ${askCount} ask で完了)`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `[observe-conversation] FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
