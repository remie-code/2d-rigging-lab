// @ts-check
/**
 * speak-now 実験「probe-decisions-speak-now」— apps/soul/agent。**OpenAI Decisions API を従量課金で叩く**。
 *
 * 話者分離付きのバッチ文字起こし（transcribe-elevenlabs-batch.mjs の出力）から、配信者の発言を
 * 無音 GAP_SECS で区切り、その区切りごとに「commit が確定した瞬間」と見なして、
 * 「チャッピーは今どう反応するのが自然か」を 4 択（続きを待つ / 相槌を打つ / 話し始める / 見送る）で判定させる。
 * 入力は直近 CONTEXT_SECS 秒・最大 CONTEXT_LINES 行の会話（配信者とチャッピーの両方）。
 * 設計の合意は discussion/ai-cohost/decisions/ を参照。
 *
 * 判定エンジンは `judge(input)` の 1 関数に閉じる（本番では差し替え可能にする方針の小さな先取り）。
 * キーは `apps/soul/agent/.env.decisions.local` の `OPENAI_DECISIONS_API_KEY`（--env-file で渡す）。
 * 結果（文字起こし本文を含む）は tmp/（gitignore）にだけ書く。
 *
 * 実行:
 *   node --env-file=apps/soul/agent/.env.decisions.local apps/soul/agent/scripts/probe-decisions-speak-now.mjs \
 *     --in tmp/speak-now/VJUSIcgnCmM.scribe.json --out tmp/speak-now/VJUSIcgnCmM.speak-now.jsonl \
 *     [--host speaker_0] [--limit 30] [--until 360] [--concurrency 4] [--choices v2] [--persona chatty]
 *  --choices: v1（待つ/相槌/話し始める/見送る）| v2（待つ/相槌/応答/自発。見送るは待つに統合。2026-10-16 合意）。
 *  --persona: quiet | normal | chatty（操縦席の口数と同じ 3 つ）。問いの頭に性格の 1 文を足す。省略で付けない。
 *  --question: v1（「ひと区切りついた今」）| a（前提を外す）| b（a + 途中かもしれない、を明示）| c / c2（途中なら待つ・終わっていれば選ぶ、の条件分岐）。2026-10-16。
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const ENDPOINT = "https://api.openai.com/v1/decisions";
const MODEL = "gpt-6-luna";
const GAP_SECS = 0.5; // ElevenLabs の実効 VAD 無音しきい値と同じ。
const CONTEXT_SECS = 180;
const CONTEXT_LINES = 20;
const MAX_CALLS = 1000;

/** ユーザー合意の問い（2026-10-16）。 */
export const INSTRUCTIONS =
  "ゲーム配信で配信者の隣にいるサポート役の AI Tuber「チャッピー」として、配信者の発言がひと区切りついた今、どう反応するのが自然か？";

/** 問いの版。v1 は区切りがついた前提を含む。判定点は 0.5 秒の無音ごとで文の途中も含むため a / b を試す。 */
export const QUESTIONS = {
  v1: INSTRUCTIONS,
  a: "ゲーム配信で配信者の隣にいるサポート役の AI Tuber「チャッピー」として、配信者の発言をここまで聞いた今、どう反応するのが自然か？",
  b: "ゲーム配信で配信者の隣にいるサポート役の AI Tuber「チャッピー」として、配信者の発言をここまで聞いた今、どう反応するのが自然か？ 配信者はまだ話している途中かもしれない。",
  c: "ゲーム配信で配信者の隣にいるサポート役の AI Tuber「チャッピー」として、配信者の発言をここまで聞いた今、どう反応するのが自然か？ 配信者の話がまだ途中なら待ち、話し終えていればどう反応するかを選ぶ。",
  c2: "ゲーム配信で配信者の隣にいるサポート役の AI Tuber「チャッピー」として、まず配信者の話がここで終わったのか、まだ続くのかを見極めること。続くなら待ち、終わったならどう反応するのが自然かを選ぶ。",
};

/** v1: 最初の 4 択（2026-10-16）。 */
export const CHOICES_V1 = [
  { value: "wait", description: "続きを待つ: 配信者はまだ話しそう（言いかけ・考え中・「えーと」の途中）なので、何もせず続きを待つ。" },
  { value: "backchannel", description: "相槌を打つ: 聞いているサインだけ返す（「うん」「へー」「なるほど」）。話の主導権は取らない。" },
  { value: "speak", description: "話し始める: 自分の番だと感じる（質問された・話を振られた・言いたいことがある）ので、ちゃんと返事をする。" },
  { value: "pass", description: "見送る: チャッピーに向けた発言ではない（独り言・ゲームへの悪態・読み上げ）ので、会話として扱わず何もしない。" },
];

/** v2: 「話し始める」を応答と自発に分け、「見送る」を「待つ」に統合（ユーザー合意 2026-10-16）。 */
export const CHOICES_V2 = [
  { value: "wait", description: "待つ: 何もしない。配信者がまだ話しそう（言いかけ・考え中・「えーと」の途中）なときや、チャッピーに向けた発言ではない（独り言・ゲームへの悪態・読み上げ・視聴者への説明）とき。" },
  { value: "backchannel", description: "相槌を打つ: 聞いているサインだけ返す（「うん」「へー」「なるほど」）。話の主導権は取らない。" },
  { value: "respond", description: "応答する: 配信者の発言に答える必要がある（質問された・話を振られた・同意や意見を求められた）ので、ちゃんと返事をする。" },
  { value: "initiate", description: "自発的に話す: 答える必要はないが、自分から言いたいことがある（感想・ツッコミ・補足・話題）ので話し始める。" },
];

/** 口数の性格（操縦席の口数モードと同じ 3 つ）。問いの頭に足す 1 文。 */
export const PERSONAS = {
  quiet: "チャッピーは聞き役に徹する控えめな性格で、自分から話すのは本当に言いたいことがあるときだけ。",
  normal: "チャッピーはふつうの相方で、話を振られたら答え、ときどき自分からも感想を言う。",
  chatty: "チャッピーは話好きなおしゃべりな性格で、思ったことはすぐ口に出し、自分からどんどん話題を出す。",
};

/**
 * 単語列 → 発話区切り（同じ話者・無音 GAP_SECS 未満で連結）。
 * @param {Array<{ text: string; start: number; end: number; type: string; speaker_id?: string }>} words
 */
export function segmentWords(words) {
  /** @type {Array<{ speaker: string; start: number; end: number; text: string }>} */
  const segs = [];
  for (const w of words) {
    if (w.type !== "word") continue;
    const cur = segs.at(-1);
    if (cur && cur.speaker === w.speaker_id && w.start - cur.end < GAP_SECS) {
      cur.text += w.text;
      cur.end = w.end;
    } else {
      segs.push({ speaker: w.speaker_id ?? "unknown", start: w.start, end: w.end, text: w.text });
    }
  }
  return segs;
}

/**
 * 判定時刻 t までに終わっている発話から、直近 CONTEXT_SECS 秒・最大 CONTEXT_LINES 行の会話文を作る。
 * @param {ReturnType<typeof segmentWords>} segs @param {number} t @param {string} host
 */
export function buildContext(segs, t, host) {
  const lines = segs
    .filter((s) => s.end <= t + 1e-6 && s.end >= t - CONTEXT_SECS)
    .slice(-CONTEXT_LINES)
    .map((s) => `${s.speaker === host ? "配信者" : "チャッピー"}: ${s.text}`);
  return lines.join("\n");
}

/** Decisions API の choice 1 問。差し替えるときはこの関数だけを替える。 */
async function judge(/** @type {string} */ input, /** @type {string} */ apiKey, /** @type {{ instructions: string; choices: typeof CHOICES_V1 }} */ q) {
  const started = performance.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input,
      questions: [{ type: "choice", name: "reaction", instructions: q.instructions, choices: q.choices }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const latencyMs = Math.round(performance.now() - started);
  const json = await res.json();
  if (!res.ok) return { ok: false, status: res.status, latencyMs, error: json?.error?.message ?? "unknown" };
  const a = json.answers?.find((/** @type {any} */ x) => x.name === "reaction");
  const probs = Object.fromEntries((a?.probabilities ?? []).map((/** @type {any} */ p) => [p.value, p.probability]));
  return { ok: true, latencyMs, choice: a?.choice ?? a?.type ?? null, confidence: a?.confidence ?? null, probs, inputTokens: json.usage?.input_tokens ?? null };
}

async function main() {
  const { values } = parseArgs({
    options: {
      in: { type: "string" },
      out: { type: "string" },
      host: { type: "string", default: "speaker_0" },
      limit: { type: "string" },
      concurrency: { type: "string", default: "4" },
      until: { type: "string" },
      choices: { type: "string", default: "v1" },
      persona: { type: "string" },
      question: { type: "string", default: "v1" },
    },
  });
  const apiKey = process.env.OPENAI_DECISIONS_API_KEY;
  if (!apiKey) throw new Error("OPENAI_DECISIONS_API_KEY is not set (run with --env-file=apps/soul/agent/.env.decisions.local)");
  if (!values.in || !values.out) throw new Error("--in and --out are required");
  const scribe = JSON.parse(await readFile(resolve(values.in), "utf8"));
  const segs = segmentWords(scribe.words ?? []);
  const host = values.host;

  // 判定点 = 配信者の発話区切りの終わり。実際の次の発話（参考: 当時のチャッピーは旧方式で動いていた）も添える。
  const points = segs
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.speaker === host)
    .map(({ s, i }) => {
      const next = segs[i + 1];
      return {
        t: s.end,
        utterance: s.text,
        next: next ? { speaker: next.speaker === host ? "host" : "chappy", gapSecs: +(next.start - s.end).toFixed(2), text: next.text } : null,
      };
    });
  const limit = values.limit ? Number(values.limit) : points.length;
  const until = values.until ? Number(values.until) : Infinity;
  const todo = points.filter((p) => p.t <= until).slice(0, limit);
  const choices = values.choices === "v2" ? CHOICES_V2 : CHOICES_V1;
  if (values.persona && !(values.persona in PERSONAS)) throw new Error(`unknown --persona: ${values.persona}`);
  const personaLine = values.persona ? PERSONAS[/** @type {keyof typeof PERSONAS} */ (values.persona)] : "";
  if (!(values.question in QUESTIONS)) throw new Error(`unknown --question: ${values.question}`);
  const body = QUESTIONS[/** @type {keyof typeof QUESTIONS} */ (values.question)];
  const q = { instructions: personaLine ? `${personaLine} ${body}` : body, choices };
  if (todo.length > MAX_CALLS) throw new Error(`refusing ${todo.length} calls (> MAX_CALLS=${MAX_CALLS})`);

  /** @type {any[]} */
  const results = new Array(todo.length);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < todo.length) {
      const k = cursor++;
      const p = todo[k];
      const context = buildContext(segs, p.t, host);
      let r;
      try {
        r = await judge(context, apiKey, q);
      } catch (error) {
        r = { ok: false, error: String(error) };
      }
      results[k] = { ...p, choicesVersion: values.choices, persona: values.persona ?? null, questionVersion: values.question, context, ...r };
      done += 1;
      if (!r.ok) console.log(`[${k}] error ${r.status ?? ""} ${r.error}`);
      if (done % 50 === 0) console.log(`${done}/${todo.length}`);
      if (r.status === 401 || r.status === 429) { cursor = todo.length; }
    }
  };
  await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));

  await writeFile(resolve(values.out), results.filter(Boolean).map((r) => JSON.stringify(r)).join("\n") + "\n");
  const ok = results.filter((r) => r?.ok);
  const counts = ok.reduce((m, r) => ((m[r.choice] = (m[r.choice] ?? 0) + 1), m), /** @type {Record<string, number>} */ ({}));
  const lat = ok.map((r) => r.latencyMs).sort((a, b) => a - b);
  const tokens = ok.reduce((n, r) => n + (r.inputTokens ?? 0), 0);
  console.log(JSON.stringify({ points: todo.length, ok: ok.length, counts, latencyMs: { p50: lat[Math.floor(lat.length / 2)], p90: lat[Math.floor(lat.length * 0.9)] }, inputTokens: tokens }));
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
