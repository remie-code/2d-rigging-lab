// @ts-check
/**
 * ElevenLabs バッチ文字起こし「transcribe-elevenlabs-batch」— apps/soul/agent。**従量（クレジット）を消費する**。
 *
 * 録音ファイル 1 本を `scribe_v2`（話者分離・単語タイムスタンプ付き）で文字起こしし、生の応答 JSON を
 * そのまま保存する。speak-now 実験（discussion/ai-cohost/decisions/）の材料作り用。
 * 入力の音声と出力はリポジトリ外（tmp/ は gitignore）に置く。キーは src/ears/elevenlabs-stt.mjs と同じく
 * `.env.elevenlabs.local` からコード内で読み、process.env に入れない。
 *
 * 実行:
 *   node apps/soul/agent/scripts/transcribe-elevenlabs-batch.mjs --in tmp/speak-now/VJUSIcgnCmM.m4a \
 *     --out tmp/speak-now/VJUSIcgnCmM.scribe.json
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadElevenLabsApiKey } from "../src/ears/elevenlabs-stt.mjs";

const ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

async function main() {
  const { values } = parseArgs({
    options: {
      in: { type: "string" },
      out: { type: "string" },
      language: { type: "string", default: "ja" },
    },
  });
  if (!values.in || !values.out) throw new Error("--in and --out are required");
  const loaded = loadElevenLabsApiKey();
  if (!loaded.ok) throw new Error(loaded.reason);
  const { apiKey } = loaded;

  const form = new FormData();
  form.set("model_id", "scribe_v2");
  form.set("language_code", values.language);
  form.set("diarize", "true");
  form.set("timestamps_granularity", "word");
  form.set("tag_audio_events", "false");
  const bytes = await readFile(resolve(values.in));
  form.set("file", new Blob([bytes]), basename(values.in));

  const started = performance.now();
  const res = await fetch(ENDPOINT, { method: "POST", headers: { "xi-api-key": apiKey }, body: form });
  const elapsedMs = Math.round(performance.now() - started);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} after ${elapsedMs}ms: ${text.slice(0, 500)}`);
  await writeFile(resolve(values.out), text);
  const json = JSON.parse(text);
  const speakers = new Set((json.words ?? []).map((/** @type {any} */ w) => w.speaker_id).filter(Boolean));
  console.log(`ok ${elapsedMs}ms words=${json.words?.length ?? 0} speakers=${[...speakers].join(",")} -> ${values.out}`);
}

main().catch((error) => {
  console.error(String(error));
  process.exitCode = 1;
});
