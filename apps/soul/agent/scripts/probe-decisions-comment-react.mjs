// @ts-check
/**
 * comment-react 実験「probe-decisions-comment-react」— apps/soul/agent。**OpenAI Decisions API を従量課金で叩く**。
 *
 * 共演配信のバッチ文字起こし(話者分離)と YouTube チャット履歴(yt-dlp の live_chat.json)を時刻で並べ、
 * コメントが届いた時点ごとに「チャッピーはこのコメントに反応するか」を二択で判定させる。
 * 入力は直近 3 分の会話(配信者・チャッピー・それまでのコメント)と、届いたコメント。
 * 設計は discussion/ai-cohost/decisions/comment-react/。
 *
 * 実行:
 *   node --env-file=apps/soul/agent/.env.decisions.local apps/soul/agent/scripts/probe-decisions-comment-react.mjs \
 *     --scribe tmp/speak-now/VJUSIcgnCmM.scribe.json --chat tmp/speak-now/VJUSIcgnCmM.live_chat.json \
 *     --out tmp/comment-react/01-chatty.jsonl --persona chatty
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { PERSONAS, segmentWords } from "./probe-decisions-speak-now.mjs";

const ENDPOINT = "https://api.openai.com/v1/decisions";
const MODEL = "gpt-6-luna";
const CONTEXT_SECS = 180;

export const INSTRUCTIONS =
  "ゲーム配信で配信者の隣にいるサポート役の AI Tuber「チャッピー」として、視聴者からこのコメントが届いた。これまでの会話の流れを踏まえて、このコメントに反応するか？";
export const CHOICES = [
  { value: "react", description: "反応する: このコメントをくれた視聴者に、チャッピーが短く反応する。" },
  { value: "ignore", description: "反応しない: このコメントには反応せず、そのままにしておく。" },
];

/** @param {string} path */
async function loadChat(path) {
  const out = [];
  for (const line of (await readFile(path, "utf8")).trim().split("\n")) {
    const j = JSON.parse(line);
    const a = j.replayChatItemAction;
    if (!a) continue;
    for (const act of a.actions ?? []) {
      const r = act.addChatItemAction?.item?.liveChatTextMessageRenderer;
      if (!r) continue;
      const text = (r.message?.runs ?? []).map((/** @type {any} */ x) => x.text ?? x.emoji?.shortcuts?.[0] ?? "").join("");
      out.push({ t: Number(a.videoOffsetTimeMsec) / 1000, name: (r.authorName?.simpleText ?? "").replace(/^@/, ""), text });
    }
  }
  return out.sort((x, y) => x.t - y.t);
}

async function main() {
  const { values } = parseArgs({
    options: { scribe: { type: "string" }, chat: { type: "string" }, out: { type: "string" }, persona: { type: "string" }, host: { type: "string", default: "speaker_0" } },
  });
  const apiKey = process.env.OPENAI_DECISIONS_API_KEY;
  if (!apiKey) throw new Error("OPENAI_DECISIONS_API_KEY is not set");
  if (!values.scribe || !values.chat || !values.out) throw new Error("--scribe --chat --out are required");
  if (values.persona && !(values.persona in PERSONAS)) throw new Error(`unknown --persona: ${values.persona}`);
  const personaLine = values.persona ? PERSONAS[/** @type {keyof typeof PERSONAS} */ (values.persona)] : "";
  const instructions = personaLine ? `${personaLine} ${INSTRUCTIONS}` : INSTRUCTIONS;
  const segs = segmentWords(JSON.parse(await readFile(resolve(values.scribe), "utf8")).words ?? []);
  const chat = await loadChat(resolve(values.chat));
  const results = [];
  for (const c of chat) {
    /** @type {Array<{ t: number; line: string }>} */
    const lines = [
      ...segs.filter((s) => s.end <= c.t && s.end >= c.t - CONTEXT_SECS).map((s) => ({ t: s.end, line: `${s.speaker === values.host ? "配信者" : "チャッピー"}: ${s.text}` })),
      ...chat.filter((x) => x.t < c.t && x.t >= c.t - CONTEXT_SECS).map((x) => ({ t: x.t, line: `視聴者(${x.name}): 「${x.text}」` })),
    ].sort((a, b) => a.t - b.t);
    const input = `これまでの会話:\n${lines.map((l) => l.line).join("\n") || "(なし)"}\n\n届いたコメント:\n視聴者(${c.name}): 「${c.text}」`;
    const started = performance.now();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input, questions: [{ type: "choice", name: "react", instructions, choices: CHOICES }] }),
      signal: AbortSignal.timeout(15_000),
    });
    const latencyMs = Math.round(performance.now() - started);
    const json = await res.json();
    const a = json.answers?.find((/** @type {any} */ x) => x.name === "react");
    const probs = Object.fromEntries((a?.probabilities ?? []).map((/** @type {any} */ p) => [p.value, p.probability]));
    const nextChappy = segs.find((s) => s.speaker !== values.host && s.start >= c.t && s.start <= c.t + 15);
    results.push({ ...c, persona: values.persona ?? null, status: res.status, latencyMs, choice: a?.choice ?? a?.type ?? null, probs, nextChappy: nextChappy ? { gapSecs: +(nextChappy.start - c.t).toFixed(1), text: nextChappy.text } : null });
    if (res.status === 401 || res.status === 429) break;
  }
  await mkdir(dirname(resolve(values.out)), { recursive: true });
  await writeFile(resolve(values.out), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const n = results.filter((r) => r.choice === "react").length;
  console.log(JSON.stringify({ persona: values.persona ?? null, comments: results.length, react: n }));
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
