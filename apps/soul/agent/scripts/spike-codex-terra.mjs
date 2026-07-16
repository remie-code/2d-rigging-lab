// @ts-check
/**
 * スパイク（使い捨て）: Codex SDK + GPT-5.6 Terra 縦貫通の実測 — apps/soul/agent。
 *
 * 目的: 魂（相方こーでぃー）の頭脳を Claude(Opus 常駐) から Codex SDK + GPT-5.6 Terra へ
 * 差し替えられるかの速度スパイク。brain-swap.md §6 の S-1〜S-4。実 Terra 消費（ユーザーの
 * ChatGPT サブスク枠）はユーザー了承済みの実験。**呼び出し予算は合計 20 発以内**。
 *
 * 依存: `@openai/codex-sdk` + Node 組み込みのみ（main / effort / sessions フェーズ）。
 *       image フェーズのみ設計 S-4 の明示指示に従い `../src/eyes/window-capture.mjs` を
 *       dynamic import する（本体コードは変更しない・読むだけ）。
 *
 * 安全の要（brain-swap.md 厳守事項）:
 *   - sandbox=read-only / approval=never / web_search=disabled でエージェント行動を封じる。
 *   - workingDirectory はスクラッチ（os.tmpdir 配下に mkdtemp）でリポジトリを触らせない。
 *   - OPENAI_API_KEY / apiKey / baseUrl は一切渡さない（サブスク OAuth のみ）。
 *   - forced_login_method="chatgpt" を global config で固定（従量課金への化け防止・未知キーは
 *     --strict-config 未指定のため無害に無視される安全側）。
 *   - 一時ファイル（スクラッチ dir・S-4 画像）は finally で必ず削除。
 *   - ~/.codex/auth.json は読まない・~/.codex 配下は変更しない（設定はプロセス内 override のみ）。
 *
 * 使い方（予算管理のためフェーズ分割実行）:
 *   node apps/soul/agent/scripts/spike-codex-terra.mjs sessions       # 枠消費0（~/.codex/sessions 件数）
 *   node apps/soul/agent/scripts/spike-codex-terra.mjs main [turns]   # S-1/S-2: 1 thread × N 往復(既定10) effort=none(Terra最速)
 *   node apps/soul/agent/scripts/spike-codex-terra.mjs effort         # S-1 effort比較: low×2 + medium×2（新スレッド）
 *   node apps/soul/agent/scripts/spike-codex-terra.mjs image [title]  # S-4: 1 枚キャプチャ→local_image→即削除
 */

import { Codex } from "@openai/codex-sdk";
import { performance } from "node:perf_hooks";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** GPT-5.6 Terra のモデル ID（brain-swap.md §3: codex で -m gpt-5.6-terra 選択可）。 */
const MODEL = "gpt-5.6-terra";

/** 1 発話の上限時間（ms）。ハング時に枠スロットを無駄にしないための AbortSignal 保険。 */
const TURN_TIMEOUT_MS = 120000;

/**
 * 発火用ペルソナ。fire-orchestrator.mjs:147 FIRE_SYSTEM_PROMPT の写し（正本はあちら）。
 * 本スパイクでは「セッション生成時固定」に相当する注入として turn 1 の入力先頭へ埋め込む
 * （現行 Claude 契約も createLlmSession({systemPrompt}) で起動時固定＝brain-swap.md §4）。
 */
const FIRE_SYSTEM_PROMPT =
  "あなたの名前はコーディ（Cody）です。" +
  "あなたは配信の相方です。直前の会話を踏まえ、短く自然な日本語で一言だけ返してください。" +
  "箇条書き・記号・長い説明はしないでください。" +
  "感情が動いたときだけ、返事にごく短い表情タグを添えてよいです（無理に付けなくてよい）。" +
  "使えるタグは <smile> <troubled> <surprised> <nod> <look-away> <look-camera> の 6 つだけです。" +
  "例: 「そうだね<nod>」「えっ<surprised>ほんとに？」。タグは半角の山括弧で書き、読み上げ文には含めません。" +
  "画面（画像）が渡されることがあります。その場合は画面を見て、自然に反応してください。";

/** S-1/S-2 主計測の日本語短文 10 本（配信の相方への一言＝視聴者/ホストの発話想定）。 */
const USER_LINES = [
  "こんばんは、配信始まったね！",
  "今日はちょっと疲れてるんだ。",
  "この後どのゲームやるの？",
  "コメント速すぎて追えないね（笑）",
  "さっきのプレイすごかった！",
  "お腹すいてきたなあ。",
  "急に雨降ってきたよ、そっちはどう？",
  "初見です、よろしく！",
  "なんだか眠くなってきちゃった。",
  "そろそろ終わりの時間かな？"
];

/** effort 比較用の短文（新スレッドごとに使う）。 */
const EFFORT_LINES = {
  low: ["好きな食べ物は何？", "今日は何して過ごしたの？", "最近笑ったことある？"],
  medium: ["最近ハマってることある？", "この配信の見どころを教えて！", "明日の予定は？"]
};

const round1 = (/** @type {number|null} */ n) => (n === null ? null : Math.round(n * 10) / 10);

/** サブスク OAuth 固定・従量課金化けを防いだ Codex クライアントを作る。 */
function makeCodex() {
  return new Codex({
    // 未知キーでも --strict-config 未指定なら無害に無視される安全側の固定。
    config: { forced_login_method: "chatgpt" }
    // env / apiKey / baseUrl は渡さない（process.env 継承・OPENAI_API_KEY は unset を事前確認済み）。
  });
}

/**
 * エージェント行動を封じた ThreadOptions を作る。
 * @param {string} workingDirectory スクラッチ dir（リポジトリ外）。
 * @param {"none"|"minimal"|"low"|"medium"|"high"|"xhigh"} effort
 *   NOTE: gpt-5.6-terra は 'minimal' 非対応（実測 400: none/low/medium/high/xhigh のみ）。最速は 'none'。
 *   SDK の ModelReasoningEffort 型に 'none' は無いが CLI は素通しするため .mjs では問題ない。
 */
function threadOptions(workingDirectory, effort) {
  return {
    model: MODEL,
    sandboxMode: /** @type {const} */ ("read-only"),
    approvalPolicy: /** @type {const} */ ("never"),
    webSearchEnabled: false,
    workingDirectory,
    skipGitRepoCheck: true,
    modelReasoningEffort: effort
  };
}

/** ツール混入とみなす item タイプ（S-2: エージェント行動の漏れ検出）。 */
const TOOL_ITEM_TYPES = ["command_execution", "file_change", "mcp_tool_call", "web_search", "todo_list"];

/**
 * 1 往復を runStreamed で実行し、イベント時刻・応答・usage を採取する。
 * Codex は --experimental-json でトークン delta を刻まない（agent_message は完成テキストで届く）ため、
 * 「TTFT」は厳密には取れない。代替として first-event / first-agent_message / turn.completed の各到達を記録。
 * @param {import("@openai/codex-sdk").Thread} thread
 * @param {import("@openai/codex-sdk").Input} input
 * @param {{ captureTimeline?: boolean }} [opts]
 */
async function runTurn(thread, input, opts = {}) {
  const captureTimeline = opts.captureTimeline ?? false;
  const t0 = performance.now();
  const marks = {
    firstEvent: /** @type {number|null} */ (null),
    threadStarted: /** @type {number|null} */ (null),
    turnStarted: /** @type {number|null} */ (null),
    firstReasoning: /** @type {number|null} */ (null),
    firstAgentMsg: /** @type {number|null} */ (null),
    turnCompleted: /** @type {number|null} */ (null)
  };
  /** @type {Array<{dt:number, type:string, itemType?:string}>} */
  const timeline = [];
  /** @type {any[]} */
  const items = [];
  let finalResponse = "";
  /** @type {any} */
  let usage = null;
  /** @type {string|null} */
  let errorMsg = null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TURN_TIMEOUT_MS);
  try {
    const { events } = await thread.runStreamed(input, { signal: ac.signal });
    for await (const ev of events) {
      const dt = performance.now() - t0;
      if (marks.firstEvent === null) marks.firstEvent = dt;
      if (captureTimeline) {
        timeline.push({ dt: round1(dt), type: ev.type, itemType: /** @type any */ (ev).item?.type });
      }
      switch (ev.type) {
        case "thread.started":
          marks.threadStarted = dt;
          break;
        case "turn.started":
          marks.turnStarted = dt;
          break;
        case "item.started":
        case "item.updated":
        case "item.completed": {
          const it = /** @type any */ (ev).item;
          if (it?.type === "reasoning" && marks.firstReasoning === null) marks.firstReasoning = dt;
          if (it?.type === "agent_message" && marks.firstAgentMsg === null) marks.firstAgentMsg = dt;
          if (ev.type === "item.completed") {
            items.push(it);
            if (it?.type === "agent_message") finalResponse = it.text;
          }
          break;
        }
        case "turn.completed":
          marks.turnCompleted = dt;
          usage = /** @type any */ (ev).usage;
          break;
        case "turn.failed":
          errorMsg = /** @type any */ (ev).error?.message ?? "turn.failed";
          break;
        case "error":
          errorMsg = /** @type any */ (ev).message ?? "stream error";
          break;
      }
    }
  } catch (e) {
    errorMsg = errorMsg ?? (e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }

  const elapsedMs = performance.now() - t0;
  return { elapsedMs, marks, timeline, finalResponse, items, usage, errorMsg };
}

/** S-2: 応答の逸脱を数値化する（原文はそのまま記録側へ）。 */
function analyzeReply(/** @type string */ text, /** @type any[] */ items) {
  const toolItems = items.filter((it) => TOOL_ITEM_TYPES.includes(it?.type));
  const hasReasoning = items.some((it) => it?.type === "reasoning");
  const stripped = text.replace(/<[a-z-]+>/g, ""); // 表情タグを除いて英字を数える
  const asciiLetters = (stripped.match(/[A-Za-z]/g) || []).length;
  const jpChars = (stripped.match(/[぀-ヿ一-鿿]/g) || []).length;
  return {
    charCount: [...text].length,
    jpChars,
    asciiLetters,
    toolItemCount: toolItems.length,
    toolTypes: toolItems.map((i) => i.type),
    itemTypes: items.map((i) => i?.type),
    hasReasoning
  };
}

/** 1 往復ぶんの計測を 1 行に要約（表示 + サマリ JSON 兼用）。 */
function summarize(/** @type any */ r) {
  const a = analyzeReply(r.finalResponse, r.items);
  return {
    elapsedMs: round1(r.elapsedMs),
    firstEventMs: round1(r.marks.firstEvent),
    firstAgentMsgMs: round1(r.marks.firstAgentMsg),
    turnCompletedMs: round1(r.marks.turnCompleted),
    reply: r.finalResponse,
    ...a,
    usage: r.usage,
    error: r.errorMsg
  };
}

function printTurnLine(/** @type number */ n, /** @type string */ line, /** @type any */ s) {
  console.log(
    `#${n} in="${line}" | elapsed=${s.elapsedMs}ms firstEvt=${s.firstEventMs}ms firstMsg=${s.firstAgentMsgMs}ms ` +
      `turnDone=${s.turnCompletedMs}ms | chars=${s.charCount} jp=${s.jpChars} ascii=${s.asciiLetters} ` +
      `tools=${s.toolItemCount}[${s.toolTypes.join(",")}] reasoning=${s.hasReasoning}` +
      (s.error ? ` | ERROR=${s.error}` : "")
  );
  console.log(`   reply: ${JSON.stringify(s.reply)}`);
  if (s.usage) console.log(`   usage: ${JSON.stringify(s.usage)}`);
}

function emitSummary(/** @type any */ obj) {
  console.log("\n===SUMMARY_JSON===");
  console.log(JSON.stringify(obj, null, 2));
}

async function phaseMain(/** @type number */ turns) {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "spike-codex-terra-main-"));
  const codex = makeCodex();
  const thread = codex.startThread(threadOptions(scratch, "none"));
  const lines = USER_LINES.slice(0, turns);
  /** @type any[] */
  const rows = [];
  /** @type any */
  let turn1Timeline = null;
  let threadId = null;
  try {
    for (let i = 0; i < lines.length; i++) {
      const isFirst = i === 0;
      const input = isFirst ? `${FIRE_SYSTEM_PROMPT}\n\n${lines[i]}` : lines[i];
      const r = await runTurn(thread, input, { captureTimeline: isFirst });
      if (isFirst) turn1Timeline = r.timeline;
      threadId = thread.id;
      const s = summarize(r);
      rows.push({ turn: i + 1, line: lines[i], ...s });
      printTurnLine(i + 1, lines[i], s);
      if (r.errorMsg) {
        console.error(`\n!! turn ${i + 1} でエラー。予算保護のため中断: ${r.errorMsg}`);
        break;
      }
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  emitSummary({ phase: "main", model: MODEL, effort: "none", threadId, turn1Timeline, rows });
}

async function phaseEffort() {
  const codex = makeCodex();
  /** @type any[] */
  const rows = [];
  /** @type Record<string, any> */
  const timelines = {};
  outer: for (const [effort, count] of /** @type {[keyof typeof EFFORT_LINES, number][]} */ ([
    ["low", 2],
    ["medium", 2]
  ])) {
    const scratch = await mkdtemp(path.join(os.tmpdir(), `spike-codex-terra-${effort}-`));
    const thread = codex.startThread(threadOptions(scratch, effort));
    try {
      for (let i = 0; i < count; i++) {
        const isFirst = i === 0;
        const line = EFFORT_LINES[effort][i];
        const input = isFirst ? `${FIRE_SYSTEM_PROMPT}\n\n${line}` : line;
        const r = await runTurn(thread, input, { captureTimeline: isFirst });
        if (isFirst) timelines[effort] = r.timeline;
        const s = summarize(r);
        rows.push({ effort, turn: i + 1, line, ...s });
        console.log(`[${effort}]`);
        printTurnLine(i + 1, line, s);
        if (r.errorMsg) {
          console.error(`\n!! ${effort} turn ${i + 1} でエラー。中断: ${r.errorMsg}`);
          break outer;
        }
      }
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }
  emitSummary({ phase: "effort", model: MODEL, timelines, rows });
}

/** MainWindowTitle が空でないウインドウのタイトル一覧を得る（列挙のみ・枠消費なし）。 */
function listWindowTitles() {
  try {
    const ps =
      "Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -ExpandProperty MainWindowTitle";
    const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function phaseImage(/** @type string|undefined */ titleArg) {
  const modUrl = pathToFileURL(path.join(__dirname, "..", "src", "eyes", "window-capture.mjs")).href;
  const { captureWindow } = await import(modUrl);

  let title = titleArg;
  if (!title) {
    const titles = listWindowTitles();
    console.log(`検出ウインドウ ${titles.length} 件: ${JSON.stringify(titles.slice(0, 12))}`);
    title = titles[0];
  }
  if (!title) {
    emitSummary({ phase: "image", status: "未実施", reason: "キャプチャ可能なウインドウが見つからない" });
    return;
  }
  console.log(`キャプチャ対象: ${JSON.stringify(title)}`);
  const cap = await captureWindow(title);
  if ("error" in cap) {
    emitSummary({ phase: "image", status: "未実施", reason: `capture失敗: ${cap.error.kind} ${cap.error.message}` });
    return;
  }
  console.log(`capture OK: ${cap.width}x${cap.height} base64=${cap.jpegBase64.length}chars captureMs=${round1(cap.elapsedMs)}`);

  const scratch = await mkdtemp(path.join(os.tmpdir(), "spike-codex-terra-img-"));
  const imgPath = path.join(scratch, "capture.jpg");
  await writeFile(imgPath, Buffer.from(cap.jpegBase64, "base64"));
  const codex = makeCodex();
  const thread = codex.startThread(threadOptions(scratch, "none"));
  /** @type any */
  let s = null;
  try {
    const r = await runTurn(
      thread,
      [
        { type: "local_image", path: imgPath },
        { type: "text", text: `${FIRE_SYSTEM_PROMPT}\n\nこの画面を見て、短く一言。` }
      ],
      { captureTimeline: true }
    );
    s = { ...summarize(r), timeline: r.timeline };
    printTurnLine(1, "(画像+この画面を見て、短く一言。)", s);
  } finally {
    await rm(scratch, { recursive: true, force: true }); // 画像を即削除
  }
  emitSummary({
    phase: "image",
    status: s?.error ? "エラー" : "実施",
    capturedTitle: title,
    capture: { width: cap.width, height: cap.height, base64Chars: cap.jpegBase64.length, captureMs: round1(cap.elapsedMs) },
    result: s
  });
}

function phaseSessions() {
  const dir = path.join(os.homedir(), ".codex", "sessions");
  let count = 0;
  /** @type {(d:string)=>void} */
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else count++;
    }
  };
  try {
    walk(dir);
    console.log(`sessions_file_count=${count}`);
    emitSummary({ phase: "sessions", dir, sessions_file_count: count });
  } catch (e) {
    emitSummary({ phase: "sessions", dir, error: e instanceof Error ? e.message : String(e) });
  }
}

async function main() {
  const [, , phase, arg1] = process.argv;
  console.log(`spike-codex-terra: phase=${phase ?? "(none)"} model=${MODEL} node=${process.version}`);
  switch (phase) {
    case "main":
      await phaseMain(arg1 ? Math.max(1, Math.min(10, Number(arg1))) : 10);
      break;
    case "effort":
      await phaseEffort();
      break;
    case "image":
      await phaseImage(arg1);
      break;
    case "sessions":
      phaseSessions();
      break;
    default:
      console.log("usage: node scripts/spike-codex-terra.mjs <sessions|main [turns]|effort|image [title]>");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
