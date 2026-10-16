// @ts-check
/**
 * gaze-target 実験「probe-decisions-gaze」— apps/soul/agent。**OpenAI Decisions API を従量課金で叩く**。
 *
 * ゲーム画面 1 枚を無加工で渡し、画面をグリッド（既定 4x3 / 16x9）に割った choice 問いで
 * 「配信者がこの画面を見たとき見ている場所」を選ばせる。同一条件を N 回繰り返し、API 自体の
 * 答えのぶれ（choice / confidence / 確率分布）と遅延を観測する。
 * 設計の合意は discussion/ai-cohost/decisions/gaze-target/ を参照。
 *
 * ── 認証（特区憲章第5条 / env-guard との棲み分け）─────────────────────────
 *  キーは `apps/soul/agent/.env.decisions.local`（gitignore 済み）の `OPENAI_DECISIONS_API_KEY` から
 *  `node --env-file` で読む。env-guard が拒否する `OPENAI_API_KEY` は使わない（Codex 頭のサブスク枠を
 *  API 課金へ切り替えないため）。キーの値はログ・結果ファイルに一切書かない。
 *
 * ── 呼び出し上限 ─────────────────────────────────────────────────────
 *  1 実行あたり最大 MAX_CALLS 回。リトライはしない（失敗はそのまま記録する）。
 *
 * 実行（従量課金なので不用意に走らせない）:
 *   node --env-file=apps/soul/agent/.env.decisions.local apps/soul/agent/scripts/probe-decisions-gaze.mjs \
 *     --image tmp/gaze-target/margit-01.png --grids 4x3,16x9 --runs 1 [--transcript "聖杯瓶あと何個だっけ？"]
 * 結果: --out（既定 tmp/gaze-target/runs）に JSON を 1 本書く。画像・結果ともリポジトリ外（tmp/ は gitignore）。
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, basename } from "node:path";
import { parseArgs } from "node:util";

const ENDPOINT = "https://api.openai.com/v1/decisions";
const MODEL = "gpt-6-luna";
const MAX_CALLS = 12;
const TIMEOUT_MS = 30_000;
/** ユーザー合意の問い（2026-10-12）。文言を変えたら実験条件が変わる。 */
const INSTRUCTIONS = "ゲーム配信をしている配信者がこのゲーム画面を見たときに見ている場所はどこか？";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** @param {number} n */
const pct = (n) => (Math.round(n * 10) / 10).toString();

/**
 * グリッドの選択肢。value=r{行}c{列}（0 始まり）、説明に行列と画面上の範囲（%）を文字で置く。
 * @param {number} cols @param {number} rows
 */
function buildGridChoices(cols, rows) {
  const choices = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = (100 * c) / cols, x1 = (100 * (c + 1)) / cols;
      const y0 = (100 * r) / rows, y1 = (100 * (r + 1)) / rows;
      choices.push({
        value: `r${r}c${c}`,
        description: `上から${r + 1}行目・左から${c + 1}列目（x ${pct(x0)}–${pct(x1)}%, y ${pct(y0)}–${pct(y1)}%）`,
      });
    }
  }
  return choices;
}

/** @param {string} spec "4x3" → { cols: 4, rows: 3 } */
function parseGrid(spec) {
  const m = /^(\d+)x(\d+)$/.exec(spec.trim());
  if (!m) throw new Error(`grid spec must look like 4x3: ${spec}`);
  return { cols: Number(m[1]), rows: Number(m[2]) };
}

async function main() {
  const { values } = parseArgs({
    options: {
      image: { type: "string" },
      grids: { type: "string", default: "4x3,16x9" },
      runs: { type: "string", default: "3" },
      out: { type: "string", default: "tmp/gaze-target/runs" },
      // 配信者の発言の文字起こし。指定時は画像の前に input_text として添える（問いの文言は変えない）。
      transcript: { type: "string" },
      // 問いの文言の差し替え（実験条件。省略時は INSTRUCTIONS）。
      instructions: { type: "string" },
    },
  });
  const apiKey = process.env.OPENAI_DECISIONS_API_KEY;
  if (!apiKey) throw new Error("OPENAI_DECISIONS_API_KEY is not set (run with --env-file=apps/soul/agent/.env.decisions.local)");
  if (!values.image) throw new Error("--image is required");

  const grids = values.grids.split(",").map(parseGrid);
  const runs = Number(values.runs);
  if (grids.length * runs > MAX_CALLS) throw new Error(`refusing ${grids.length * runs} calls (> MAX_CALLS=${MAX_CALLS})`);

  const imagePath = resolve(values.image);
  const mime = MIME[/** @type {keyof typeof MIME} */ (extname(imagePath).toLowerCase())];
  if (!mime) throw new Error(`unsupported image type: ${imagePath}`);
  const dataUrl = `data:${mime};base64,${(await readFile(imagePath)).toString("base64")}`;

  /** @type {Array<Record<string, string>>} */
  const content = [];
  if (values.transcript) content.push({ type: "input_text", text: `配信者の発言（文字起こし）: 「${values.transcript}」` });
  content.push({ type: "input_image", image_url: dataUrl });

  const instructions = values.instructions ?? INSTRUCTIONS;
  const records = [];
  outer: for (const { cols, rows } of grids) {
    const grid = `${cols}x${rows}`;
    const body = {
      model: MODEL,
      input: [{ role: "user", content }],
      questions: [{ type: "choice", name: "gaze", instructions, choices: buildGridChoices(cols, rows) }],
    };
    for (let run = 1; run <= runs; run++) {
      const started = performance.now();
      /** @type {Record<string, unknown>} */
      const record = { grid, run };
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        record.latencyMs = Math.round(performance.now() - started);
        record.status = res.status;
        record.requestId = res.headers.get("x-request-id");
        const json = await res.json();
        record.response = json;
        const answer = json?.answers?.find((/** @type {any} */ a) => a.name === "gaze");
        if (answer) {
          record.choice = answer.choice ?? null;
          record.confidence = answer.confidence ?? null;
          record.top = [...(answer.probabilities ?? [])].sort((a, b) => b.probability - a.probability).slice(0, 5);
        }
      } catch (error) {
        record.latencyMs = Math.round(performance.now() - started);
        record.error = String(error);
      }
      records.push(record);
      const top = /** @type {any[]} */ (record.top ?? []).map((p) => `${p.value}:${p.probability.toFixed(3)}`).join(" ");
      console.log(`[${grid} #${run}] status=${record.status ?? "-"} ${record.latencyMs}ms choice=${record.choice ?? "-"} conf=${record.confidence ?? "-"} top=${top}${record.error ? ` error=${record.error}` : ""}`);
      if (record.status && record.status !== 200) console.log(JSON.stringify(record.response));
      // 認証・残高・権限の失敗は後続も必ず同じ結果になるので、残りを叩かずに止める。
      if (record.status === 401 || record.status === 403 || record.status === 429) break outer;
    }
  }

  await mkdir(resolve(values.out), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(values.out, `${basename(imagePath, extname(imagePath))}-${stamp}.json`);
  await writeFile(outPath, JSON.stringify({ model: MODEL, instructions, image: basename(imagePath), transcript: values.transcript ?? null, records }, null, 2));
  console.log(`wrote ${outPath}`);
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
