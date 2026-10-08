// @ts-check
/**
 * S5 視覚発火 観測「observe-vision」（Domain C 後半）— apps/soul/agent。**実 SDK を最小回数だけ叩く**。
 *
 * observe-expressions.mjs（S4）/ measure-fire.mjs（S3）の写経。**自分で起動したメモ帳窓**を
 * Domain A の実 `captureWindow`（実 PowerShell・PrintWindow）で 1 枚撮り、Domain B が組み立てる形と
 * 同じ content 配列 `[image(先行), text]` で Domain B の実 `createLlmSession`（サブスク OAuth・
 * claude-opus-4-8）に実射する。観測項目:
 *   (a) 返事が画面内容（メモ帳に書いた特徴的なマーカーテキスト）に言及するか＝視覚が実際に効いているか。
 *   (b) レイテンシ内訳: キャプチャ elapsedMs / base64 サイズ / TTFT / ask 往復 elapsedMs。
 *   (c) 画像を注入した同一常駐セッションで以後のテキストのみ ask を重ねたときの
 *       input_tokens 推移（単調増加するか＝履歴として画像が再送され続けるか）+ usage の
 *       cache 系フィールド（cache_read_input_tokens 等）の有無。
 *
 * ── 何が実物で何が fake か ──────────────────────────────────────────────
 *  実物: listWindows / captureWindow（Domain A・実 PowerShell 起動・実 PrintWindow キャプチャ）・
 *        createLlmSession（Agent SDK・サブスク OAuth）・FIRE_SYSTEM_PROMPT・formatFireInjection
 *        （すべて S5 Domain A/B の成果物をそのまま import。一切改修していない）。
 *  fake: 発火経路そのもの（fire-orchestrator/cockpit-server/channel/player/speak は使わない・
 *        ask の生応答と usage だけを観測する）。VISION_INSTRUCTION_TEXT は fire-orchestrator.mjs
 *        内部の非 export 定数と同一文字列をこのスクリプト内にコピーして使う（Domain B のコードを
 *        改修して export を増やすのは鉄の規律 3 に抵触するため・§質問で申し送り）。
 *
 * ── キャプチャ対象（鉄の規律 8）───────────────────────────────────────────
 *  **自分で起動したメモ帳窓のみ**（実ゲーム窓は使わない＝人間ゲートの領分）。メモ帳の本文に
 *  特徴的なマーカーテキストを書き込み、返事にその内容への言及があるかで「視覚が効いたか」を判定する。
 *  キャプチャ直後に窓を閉じる（後始末を SDK 実射より先に済ませ、残留プロセスを残さない）。
 *
 * ── SDK 実消費の上限（鉄の規律・wave 計画 §4-4）───────────────────────────
 *  **実 ask は 5 回まで**（ハードガードで 6 回目は throw・リトライも 1 回の ask としてカウントする＝
 *  observe-expressions.mjs と同型）。env ガード（assertSubscriptionAuthEnv）が ANTHROPIC_API_KEY 等を
 *  検出したら起動拒否される（その場合は未実測として experiments/s5-vision.md に正直に記録する＝
 *  数字を捏造しない・ガードをバイパスしない）。各 ask はタイムアウト付き（既定 90s）。タイムアウト /
 *  空応答は最大 3 回まで再試行してから正直停止。
 *
 * ── 構成（5 ask の内訳）────────────────────────────────────────────────
 *  ask #1: 視覚発火（画像 + テキスト・[image, text] content 配列）。
 *  ask #2〜5: 同一常駐セッションでテキストのみの ask を継続（通常 Fire 相当）——
 *             画像注入後の履歴再送コスト（input_tokens 推移・cache 観測）を見るための構成。
 *
 * 実行（サブスク枠を消費するので不用意に走らせない）:
 *   node apps/soul/agent/scripts/observe-vision.mjs
 * 前提: /login 済み・ガード対象環境変数が未設定。AivisSpeech・器・マイク・実ゲームは不要
 * （発話しない・キャプチャ対象は自分で起動したメモ帳のみ）。
 * 実ゲーム窓での視認・最小化/被覆時の実挙動・DPI>100% は人間ゲート/followup の領分
 * （discussion/ai-cohost/implementation/waves/s5/human-gate-procedure.md /
 *  discussion/ai-cohost/implementation/waves/s5/s5-followup.md）。
 */

import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { assertSubscriptionAuthEnv } from "../src/mind/env-guard.mjs";
import { createLlmSession } from "../src/mind/llm-session.mjs";
import { FIRE_SYSTEM_PROMPT } from "../src/mind/fire-orchestrator.mjs";
import { formatFireInjection } from "../src/mind/fire-injection.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";
import { captureWindow } from "../src/eyes/window-capture.mjs";
import { listWindows } from "../src/eyes/window-list.mjs";

/** 実 ask のハード上限（鉄の規律・wave 計画 §4-4）。リトライも 1 ask としてカウントする。 */
const MAX_ASKS = 5;
/** 1 ask のタイムアウト（ハング保険）。 */
const ASK_TIMEOUT_MS = 90_000;
/** 空応答 / タイムアウト時の再試行上限（鉄の規律 6）。 */
const MAX_RETRIES = 3;

/**
 * 視覚発火の最小指示文。fire-orchestrator.mjs 内部の非 export 定数 VISION_INSTRUCTION_TEXT と
 * 同一文字列（Domain B のコードを改修せず import して使うだけの鉄の規律に従い、コピーで再現する）。
 */
const VISION_INSTRUCTION_TEXT = "今の画面を見て、直近の会話と合わせて自然に反応してください。";

/** メモ帳に書き込む特徴的なマーカー本文（視覚言及の判定材料）。 */
const VISION_MARKER_BODY =
  "S5視覚テスト: 紫色のタコが自転車に乗って虹をくぐっている。空はオレンジ色で、右上に緑の星が3つ浮かんでいる。";

/** マーカー本文から抽出した言及判定キーワード（返事にどれか含まれれば「画面に言及した」とみなす）。 */
const MARKER_KEYWORDS = ["タコ", "自転車", "紫", "オレンジ", "虹", "星"];

/** 視覚発火より前に積む you 発話（会話窓に何か入っている状態を再現するため）。 */
const YOU_UTTERANCE_BEFORE_VISION = "ねえ、ちょっとこの画面見てくれる？";

/** ask #2〜5（テキストのみ・同一セッション継続）用の you 発話 fixture。 */
const YOU_UTTERANCES_AFTER_VISION = [
  "さっき見てもらった画面、どう思う？",
  "今日の配信、そろそろ次の話題に行こうかな。",
  "ちょっと休憩を挟もうと思うんだけど、いいよね？",
  "そういえば、さっきの話の続きなんだけどさ。"
];

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

/** ask をタイムアウト付きで撃つ（ハング保険）。 */
function askWithTimeout(session, content, timeoutMs) {
  return Promise.race([
    session.ask(content),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`ask timed out after ${timeoutMs}ms`)), timeoutMs).unref?.()
    )
  ]);
}

/**
 * 自分で起動したメモ帳窓にマーカー本文を書かせ、listWindows() で発見し、captureWindow() で
 * 実撮影する。撮影後は即座に窓を閉じる（SDK 実射より前に後始末を済ませる）。
 * @returns {Promise<{ capture: any; title: string }>}
 */
async function captureMarkerWindow() {
  const marker = `vision-observe-${Date.now()}`;
  const tmpFile = path.join(os.tmpdir(), `${marker}.txt`);
  fs.writeFileSync(tmpFile, VISION_MARKER_BODY, "utf8");

  /** @type {import("node:child_process").ChildProcess | null} */
  let notepad = null;
  /** @type {number | null} */
  let windowOwnerPid = null;
  let title = "";
  /** @type {any} */
  let capture = null;

  try {
    log(`[observe-vision] notepad.exe 起動（マーカー本文込み）: ${tmpFile}`);
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
    log(`[observe-vision] listWindows() にメモ帳窓を確認: pid=${found.pid} title="${found.title}"`);

    capture = await captureWindow(title);
    if ("error" in capture) {
      log(`[observe-vision] captureWindow FAILED: ${JSON.stringify(capture.error)}`);
    } else {
      const approxBytes = Math.floor((capture.jpegBase64.length * 3) / 4);
      log(
        `[observe-vision] captureWindow OK: width=${capture.width} height=${capture.height} ` +
          `elapsedMs=${capture.elapsedMs} base64Len=${capture.jpegBase64.length} (~${approxBytes} bytes)`
      );
    }
  } finally {
    const pidsToKill = new Set(
      [windowOwnerPid, notepad?.pid].filter((pid) => typeof pid === "number" && pid > 0)
    );
    for (const pid of pidsToKill) {
      await new Promise((resolve) => {
        execFile("taskkill", ["/PID", String(pid), "/F", "/T"], () => resolve(undefined));
      });
      log(`[observe-vision] notepad (pid=${pid}) を後始末（taskkill）`);
    }
    if (pidsToKill.size === 0) {
      log("[observe-vision] WARN: 後始末対象の pid が無い（notepad が起動していなかった可能性）");
    }
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // best-effort
    }
  }

  return { capture, title };
}

async function main() {
  const { warnings } = assertSubscriptionAuthEnv(process.env); // ガード違反はここで throw = 起動拒否。
  for (const w of warnings) {
    log(`[observe-vision] WARN: ${w}`);
  }
  log(
    `[observe-vision] ${new Date().toISOString()} node ${process.version} ${process.platform} — ` +
      `実 ask は最大 ${MAX_ASKS} 回。自分で起動したメモ帳窓を実 captureWindow で撮り、` +
      `実 createLlmSession へ画像込みで実射する。`
  );

  // ── 1. 実キャプチャ（自分で起動したメモ帳のみ）。SDK 実射より前に窓を閉じる ──────────
  const { capture, title } = await captureMarkerWindow();
  if (capture == null || "error" in capture) {
    throw new Error(
      `observe-vision: capture failed before any SDK ask was made (no budget spent). ` +
        `error=${JSON.stringify(capture?.error)}`
    );
  }

  const buffer = createTranscriptBuffer(); // 実時計 = すべて窓内（既定 5 分）。

  /** @type {any} */
  let initMessage = null;
  const session = createLlmSession({
    systemPrompt: FIRE_SYSTEM_PROMPT, // 本番結線と同一。
    onInit: (init) => {
      initMessage = init;
    },
    onWarning: (w) => log(`[observe-vision] WARN: ${w}`)
  });

  // ask 計測ラッパ + ハード予算ガード（6 回目の ask は throw・リトライも 1 ask としてカウント）。
  let askCount = 0;
  const measuringSession = {
    /** @param {string | Array<any>} content */
    async ask(content) {
      if (askCount >= MAX_ASKS) {
        throw new Error(`observe-vision: ask budget (${MAX_ASKS}) exceeded — refusing further SDK calls.`);
      }
      askCount += 1;
      return session.ask(content);
    }
  };

  /** ask を再試行付きで撃つ共通ヘルパ（observe-expressions.mjs と同型）。 */
  async function askWithRetry(content, label) {
    let asked = null;
    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        asked = await askWithTimeout(measuringSession, content, ASK_TIMEOUT_MS);
      } catch (err) {
        log(`[observe-vision] ${label} attempt ${attempt} FAILED: ${err instanceof Error ? err.message : String(err)}`);
        if (attempt >= MAX_RETRIES) throw new Error(`${label}: ${MAX_RETRIES} attempts exhausted (${err instanceof Error ? err.message : String(err)})`);
        continue;
      }
      const replyText = asked && typeof asked.replyText === "string" ? asked.replyText : "";
      if (replyText.trim().length === 0) {
        log(`[observe-vision] ${label} attempt ${attempt}: empty/interrupted reply — retrying.`);
        if (attempt >= MAX_RETRIES) throw new Error(`${label}: empty reply after ${MAX_RETRIES} attempts.`);
        continue;
      }
      return asked;
    }
  }

  /** @type {any[]} */
  const observations = [];
  try {
    // ── 2. ask #1: 視覚発火（画像 + テキスト・画像先行）───────────────────────────
    buffer.append({ startMs: 0, endMs: 3000, text: YOU_UTTERANCE_BEFORE_VISION });
    const injection1 = formatFireInjection(buffer.all(), { nowMs: Date.now() });
    const instructionText =
      injection1.text.length > 0 ? `${injection1.text}\n${VISION_INSTRUCTION_TEXT}` : VISION_INSTRUCTION_TEXT;
    const contentBlocks = [
      { type: "image", source: { type: "base64", data: capture.jpegBase64, media_type: "image/jpeg" } },
      { type: "text", text: instructionText }
    ];

    const asked1 = await askWithRetry(contentBlocks, "vision ask #1");
    const replyText1 = asked1.replyText;
    const screenReferenced = MARKER_KEYWORDS.filter((kw) => replyText1.includes(kw));
    observations.push({
      ask: 1,
      type: "vision",
      you: YOU_UTTERANCE_BEFORE_VISION,
      replyRaw: replyText1,
      screenReferencedKeywords: screenReferenced,
      screenReferenced: screenReferenced.length > 0,
      ttft_ms: round1(asked1.ttftMs),
      ask_ms: round1(asked1.elapsedMs),
      usage: asked1.usage ?? null,
      cacheFields: cacheFieldsOf(asked1.usage)
    });
    log("");
    log("=== ask #1 (vision) ===");
    log(`marker: ${VISION_MARKER_BODY}`);
    log(`reply : ${replyText1}`);
    log(`screenReferencedKeywords: ${JSON.stringify(screenReferenced)}`);
    log(`ttft_ms = ${round1(asked1.ttftMs)}  ask_ms = ${round1(asked1.elapsedMs)}`);
    log(`usage = ${JSON.stringify(asked1.usage)}`);

    // soul の返事も会話ログに積む（後続 ask の注入窓に自然な履歴として乗せる）。
    buffer.append({ startMs: 0, endMs: 0, text: replyText1, speaker: "soul" });

    // ── 3. ask #2〜5: テキストのみ（同一セッション継続・履歴再送コストの観測）────────────
    for (let i = 0; i < YOU_UTTERANCES_AFTER_VISION.length && askCount < MAX_ASKS; i += 1) {
      const utterance = YOU_UTTERANCES_AFTER_VISION[i];
      buffer.append({ startMs: (i + 1) * 5000, endMs: (i + 1) * 5000 + 3000, text: utterance });
      const injection = formatFireInjection(buffer.all(), { nowMs: Date.now() });

      const askNum = i + 2;
      const asked = await askWithRetry(injection.text, `text ask #${askNum}`);
      const replyText = asked.replyText;
      observations.push({
        ask: askNum,
        type: "text",
        you: utterance,
        replyRaw: replyText,
        ttft_ms: round1(asked.ttftMs),
        ask_ms: round1(asked.elapsedMs),
        usage: asked.usage ?? null,
        cacheFields: cacheFieldsOf(asked.usage)
      });
      log("");
      log(`=== ask #${askNum} (text) ===`);
      log(`you   : ${utterance}`);
      log(`reply : ${replyText}`);
      log(`ttft_ms = ${round1(asked.ttftMs)}  ask_ms = ${round1(asked.elapsedMs)}`);
      log(`usage = ${JSON.stringify(asked.usage)}`);

      buffer.append({ startMs: 0, endMs: 0, text: replyText, speaker: "soul" });
    }

    // ── 集計 ──────────────────────────────────────────────────────────
    const inputTokensSequence = observations.map((o) => (o.usage && typeof o.usage.input_tokens === "number" ? o.usage.input_tokens : null));
    let monotonic = true;
    for (let i = 1; i < inputTokensSequence.length; i += 1) {
      const prev = inputTokensSequence[i - 1];
      const cur = inputTokensSequence[i];
      if (prev == null || cur == null) continue;
      if (cur < prev) monotonic = false;
    }
    const anyCacheFieldObserved = observations.some((o) => Object.keys(o.cacheFields ?? {}).length > 0);

    const summary = {
      recordedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      model: initMessage?.model ?? null,
      apiKeySource: initMessage?.apiKeySource ?? null,
      systemPrompt: "FIRE_SYSTEM_PROMPT (本番結線と同一)",
      captureTitle: title,
      captureWidth: capture.width,
      captureHeight: capture.height,
      captureElapsedMs: capture.elapsedMs,
      captureBase64Length: capture.jpegBase64.length,
      captureApproxBytes: Math.floor((capture.jpegBase64.length * 3) / 4),
      asks: askCount,
      inputTokensSequence,
      inputTokensMonotonicNonDecreasing: monotonic,
      anyCacheFieldObserved,
      observations
    };
    log("");
    log("=== JSON SUMMARY (experiments/s5-vision.md 記録用) ===");
    log(JSON.stringify(summary, null, 2));
  } finally {
    await session.dispose();
    log("");
    log(`[observe-vision] session disposed. (SDK 実行 = ${askCount} ask で完了)`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `[observe-vision] FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
