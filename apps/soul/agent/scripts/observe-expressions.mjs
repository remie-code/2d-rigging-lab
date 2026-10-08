// @ts-check
/**
 * S4 表情タグ観測「observe-expressions」（Domain B）— apps/soul/agent。**実 SDK を最小回数だけ叩く**。
 *
 * measure-fire.mjs（S3）の写経。**タグ教示入り FIRE_SYSTEM_PROMPT**（fire-orchestrator.mjs が本番結線で
 * createLlmSession に渡すのと同一）で、感情が動く独り言を注入したとき、モデルが実際に表情タグを吐くかを
 * 観測する。観測項目:
 *   (a) タグ出現率      : 何 ask 中いくつにタグが付いたか。
 *   (b) 出現位置        : 文頭 / 文末 / 文中 / 単独（タグのみ応答）。
 *   (c) 未知タグ率      : 教示外の語（語彙 6 語以外）を吐いた割合（パーサが剥がす＝声にも演出にも出ない）。
 *   (d) 翻訳層カバレッジ: 既知タグが translateExpression でスロット payload 列に写像できるか（実チャネルは
 *                        人間ゲートの領分＝ここでは envelope accepted 率まで測らず翻訳層まで）。
 *
 * ── 何が実物で何が fake か ──────────────────────────────────────────────
 *  実物: createLlmSession（Agent SDK・サブスク OAuth・claude-opus-4-8）・FIRE_SYSTEM_PROMPT・
 *        parseExpressionTags / translateExpression（本番と同じ純関数）。
 *  fake: 発火経路そのもの（orchestrator/speak/channel/player は使わない・ask の生応答だけを観測する）。
 *
 * ── SDK 実消費の上限（鉄の規律）───────────────────────────────────────────
 *  **実 ask は 5 回まで**（ハードガードで 6 回目は throw）。サブスク枠を使うため不用意に走らせない。
 *  env ガード（assertSubscriptionAuthEnv）が ANTHROPIC_API_KEY 等を検出したら起動拒否される
 *  （その場合は未実測として experiments/s4-expressions.md に正直に記録する＝数字を捏造しない）。
 *  各 ask はタイムアウト付き（既定 90s）。タイムアウト / 空応答は最大 3 回まで再試行してから正直停止。
 *
 * 実行（サブスク枠を消費するので不用意に走らせない）:
 *   node apps/soul/agent/scripts/observe-expressions.mjs
 * 前提: /login 済み・ガード対象環境変数が未設定。AivisSpeech・器・マイクは不要（発話しない）。
 * 実機での「タグが実際に目・視線・頭・体を動かすか / 符号は正しいか」は人間ゲートの領分
 * （discussion/ai-cohost/implementation/waves/s4/human-gate-procedure.md）。
 */

import { performance } from "node:perf_hooks";

import { assertSubscriptionAuthEnv } from "../src/mind/env-guard.mjs";
import { createLlmSession } from "../src/mind/llm-session.mjs";
import { FIRE_SYSTEM_PROMPT } from "../src/mind/fire-orchestrator.mjs";
import { formatFireInjection } from "../src/mind/fire-injection.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";
import { parseExpressionTags } from "../src/mind/expression-parser.mjs";
import { translateExpression } from "../src/mind/expression-translator.mjs";
import { EXPRESSION_WORDS } from "../src/mind/expression-table.mjs";

/** 実 ask のハード上限（鉄の規律・wave 計画 §4-4）。 */
const MAX_ASKS = 5;
/** 1 ask のタイムアウト（ハング保険）。 */
const ASK_TIMEOUT_MS = 90_000;
/** 空応答 / タイムアウト時の再試行上限（鉄の規律 6）。 */
const MAX_RETRIES = 3;

/** パーサと同じタグ正規表現（位置観測用・expression-parser.mjs と一致させる）。 */
const TAG_RE = /<([A-Za-z][\w-]*)(\s[^<>]*)?>/g;

/**
 * 感情が動く独り言 fixture（困った話・驚く話・同意・喜び・照れ）。タグを**強制はしない**——
 * 感情が動きやすい素直な独り言を置き、モデルがタグを添えるかを正直に観測する。
 */
const YOU_UTTERANCES = [
  "うわ、このボス強すぎて全然勝てないんだけど……回復アイテムももう残ってないし、どうしよう。",
  "えっ、今の見た!? 敵が急に3体も湧いてきたんだけど、聞いてないよそんなの!",
  "だよね、やっぱりこの装備の組み合わせが一番強いと思うんだ。君もそう思うでしょ?",
  "やった、ついにこのステージクリアできた! 何回もやり直したから本当に嬉しい!",
  "うっ、それはちょっと恥ずかしいから今はあんまり言わないでほしいな……。"
];

function log(line) {
  process.stdout.write(`${line}\n`);
}
function round1(v) {
  return v == null ? null : Number(Number(v).toFixed(1));
}

/**
 * 生応答テキストのタグを観測する（位置分類 + 既知/未知の判定）。
 * @param {string} replyText
 */
function observeTags(replyText) {
  const parsed = parseExpressionTags(replyText);
  /** @type {Array<{ word: string; known: boolean; where: "head" | "tail" | "mid" | "standalone" }>} */
  const tags = [];
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(replyText)) !== null) {
    const word = m[1];
    const known = EXPRESSION_WORDS.includes(word);
    const start = m.index;
    const end = m.index + m[0].length;
    const beforeBlank = replyText.slice(0, start).trim().length === 0;
    const afterBlank = replyText.slice(end).trim().length === 0;
    /** @type {"head" | "tail" | "mid" | "standalone"} */
    let where;
    if (beforeBlank && afterBlank) where = "standalone";
    else if (beforeBlank) where = "head";
    else if (afterBlank) where = "tail";
    else where = "mid";
    tags.push({ word, known, where });
  }
  // 既知タグの翻訳層カバレッジ（スロット数・翻訳診断）。
  let translatedSlots = 0;
  let translateDiagnostics = 0;
  for (const ev of parsed.events) {
    const { payloads, diagnostics } = translateExpression(ev.word, ev.args, 1.0);
    translatedSlots += payloads.length;
    translateDiagnostics += diagnostics.length;
  }
  return {
    speechText: parsed.speechText,
    knownEvents: parsed.events.length,
    unknownTags: parsed.diagnostics.filter((d) => d.type === "unknownTag").length,
    brokenTags: parsed.diagnostics.filter((d) => d.type === "brokenTag").length,
    tags,
    translatedSlots,
    translateDiagnostics
  };
}

/** ask をタイムアウト付きで撃つ（ハング保険）。 */
function askWithTimeout(session, text, timeoutMs) {
  return Promise.race([
    session.ask(text),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`ask timed out after ${timeoutMs}ms`)), timeoutMs).unref?.()
    )
  ]);
}

async function main() {
  const { warnings } = assertSubscriptionAuthEnv(process.env); // ガード違反はここで throw = 起動拒否。
  for (const w of warnings) {
    log(`[observe-expressions] WARN: ${w}`);
  }
  log(
    `[observe-expressions] ${new Date().toISOString()} node ${process.version} ${process.platform} — ` +
      `実 ask は最大 ${MAX_ASKS} 回。FIRE_SYSTEM_PROMPT（タグ教示入り）で表情タグの実出現を観測する。`
  );

  const buffer = createTranscriptBuffer(); // 実時計 = すべて窓内（既定 5 分）。

  /** @type {any} */
  let initMessage = null;
  const session = createLlmSession({
    systemPrompt: FIRE_SYSTEM_PROMPT, // 本番結線と同一（タグ教示入り）。
    onInit: (init) => {
      initMessage = init;
    },
    onWarning: (w) => log(`[observe-expressions] WARN: ${w}`)
  });

  // ask 計測ラッパ + ハード予算ガード（6 回目の ask は throw）。
  let askCount = 0;
  const measuringSession = {
    /** @param {string} text */
    async ask(text) {
      if (askCount >= MAX_ASKS) {
        throw new Error(`observe-expressions: ask budget (${MAX_ASKS}) exceeded — refusing further SDK calls.`);
      }
      askCount += 1;
      return session.ask(text);
    }
  };

  /** @type {any[]} */
  const observations = [];
  try {
    for (let i = 0; i < MAX_ASKS; i += 1) {
      buffer.append({ startMs: i * 5000, endMs: i * 5000 + 3000, text: YOU_UTTERANCES[i] });
      const injection = formatFireInjection(buffer.all(), { nowMs: Date.now() });

      // 空応答 / タイムアウトは最大 MAX_RETRIES 回まで再試行（鉄の規律 6）。
      /** @type {any} */
      let asked = null;
      let attempt = 0;
      for (;;) {
        attempt += 1;
        try {
          asked = await askWithTimeout(measuringSession, injection.text, ASK_TIMEOUT_MS);
        } catch (err) {
          log(`[observe-expressions] fire #${i + 1} attempt ${attempt} FAILED: ${err instanceof Error ? err.message : String(err)}`);
          if (attempt >= MAX_RETRIES) throw new Error(`fire #${i + 1}: ${MAX_RETRIES} attempts exhausted (${err instanceof Error ? err.message : String(err)})`);
          continue;
        }
        const replyText = asked && typeof asked.replyText === "string" ? asked.replyText : "";
        if (replyText.trim().length === 0) {
          log(`[observe-expressions] fire #${i + 1} attempt ${attempt}: empty/interrupted reply — retrying.`);
          if (attempt >= MAX_RETRIES) throw new Error(`fire #${i + 1}: empty reply after ${MAX_RETRIES} attempts.`);
          continue;
        }
        break;
      }

      const replyText = asked.replyText;
      const obs = observeTags(replyText);
      const record = {
        fire: i + 1,
        you: YOU_UTTERANCES[i],
        replyRaw: replyText,
        speechText: obs.speechText,
        hasTag: obs.tags.length > 0,
        tags: obs.tags,
        knownEvents: obs.knownEvents,
        unknownTags: obs.unknownTags,
        brokenTags: obs.brokenTags,
        translatedSlots: obs.translatedSlots,
        translateDiagnostics: obs.translateDiagnostics,
        ttft_ms: round1(asked.ttftMs),
        ask_ms: round1(asked.elapsedMs),
        usage: asked.usage ?? null
      };
      observations.push(record);

      log("");
      log(`=== fire #${i + 1} ===`);
      log(`you   : ${YOU_UTTERANCES[i]}`);
      log(`reply : ${replyText}`);
      log(`speech: ${obs.speechText}`);
      log(`tags  : ${JSON.stringify(obs.tags)} (known ${obs.knownEvents} / unknown ${obs.unknownTags} / broken ${obs.brokenTags})`);
      log(`xlate : ${obs.translatedSlots} slots, ${obs.translateDiagnostics} diagnostics`);
      log(`ttft_ms = ${record.ttft_ms}  ask_ms = ${record.ask_ms}`);
    }

    // ── 集計 ──────────────────────────────────────────────────────────
    const n = observations.length;
    const withTag = observations.filter((o) => o.hasTag).length;
    const withUnknown = observations.filter((o) => o.unknownTags > 0).length;
    const allTags = observations.flatMap((o) => o.tags);
    const posCount = { head: 0, tail: 0, mid: 0, standalone: 0 };
    for (const t of allTags) posCount[t.where] += 1;
    const knownTagTotal = allTags.filter((t) => t.known).length;
    const unknownTagTotal = allTags.filter((t) => !t.known).length;

    const summary = {
      recordedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      model: initMessage?.model ?? null,
      apiKeySource: initMessage?.apiKeySource ?? null,
      systemPrompt: "FIRE_SYSTEM_PROMPT (タグ教示入り)",
      asks: askCount,
      tagAppearanceRate: `${withTag}/${n}`,
      unknownReplyRate: `${withUnknown}/${n}`,
      tagTotals: { known: knownTagTotal, unknown: unknownTagTotal },
      positions: posCount,
      observations
    };
    log("");
    log("=== JSON SUMMARY (experiments/s4-expressions.md 記録用) ===");
    log(JSON.stringify(summary, null, 2));
  } finally {
    await session.dispose();
    log("");
    log(`[observe-expressions] session disposed. (SDK 実行 = ${askCount} ask で完了)`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `[observe-expressions] FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
