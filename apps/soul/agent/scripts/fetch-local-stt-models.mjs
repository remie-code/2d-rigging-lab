#!/usr/bin/env node
// @ts-check
/**
 * ローカルの文字起こし（Parakeet / Zipformer）のモデルを公式の配布元から取得して `vendor/models/` に置く
 * — apps/soul/agent（local-stt-wave-plan.md §1 の 7）。
 *
 *   node apps/soul/agent/scripts/fetch-local-stt-models.mjs              # 足りないものだけ取る（CED-tiny も含む）
 *   node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only zipformer
 *   node apps/soul/agent/scripts/fetch-local-stt-models.mjs --dry-run    # 取るものを表示するだけ
 *   node apps/soul/agent/scripts/fetch-local-stt-models.mjs --models-dir <dir>
 *   node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny   # 音の種類の判定（CED-tiny）だけ取る
 *
 * 配布元:
 *  - Parakeet: Hugging Face `csukuangfj/sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8`
 *    の `model.int8.onnx`（約 650MB）と `tokens.txt` → `vendor/models/parakeet-tdt_ctc-0.6b-ja-int8/`。
 *  - Zipformer: k2-fsa/sherpa-onnx の GitHub Releases（タグ `asr-models`）の
 *    `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2` から int8 の encoder / decoder / joiner と
 *    tokens.txt（と README.md）だけを取り出す → `vendor/models/zipformer-ja-reazonspeech-2024-08-01-int8/`。
 *    展開は OS の tar（Windows 10 以降は System32 の tar.exe・bz2 対応）を使う。
 *  - CED-tiny（音の種類の判定・咳払いの落とし cough-filter-stage2-plan.md §1・§4 A の 7）: k2-fsa/sherpa-onnx の GitHub Releases
 *    （タグ `audio-tagging-models`）の `sherpa-onnx-ced-tiny-audio-tagging-2024-04-19.tar.bz2`（約 28.5MB）から
 *    `model.int8.onnx`（約 6.1MB）と `class_labels_indices.csv`（と README.md）だけを取り出す
 *    → `vendor/models/ced-tiny-audio-tagging-2024-04-19-int8/`。`--only` なしの既定で、足りなければ取る。
 *    `--only` を付けたときは、そこに `ced-tiny` があるときだけ取る（`--only ced-tiny` で CED だけ）。
 *    置き場の決まりは src/ears/local-stt/audio-tagging.mjs。
 *
 * 既に揃っていれば何もしない（ファイルがあり、0 byte でなければ揃っているとみなす）。途中で落ちても
 * `.part` のまま残るだけで、揃った扱いにはならない。耳の Start は自分では取得しない（文字起こしのモデルが
 * 無ければ理由つきで失敗する。CED-tiny が無ければ判定なしで動く）。
 */

import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync, copyFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_LOCAL_STT_MODELS_DIR,
  LOCAL_STT_ENGINES,
  LOCAL_STT_MODEL_LAYOUT,
  resolveLocalSttModel
} from "../src/ears/local-stt/local-stt-engines.mjs";
import { CED_TINY_MODEL_LAYOUT, resolveCedTinyModel } from "../src/ears/local-stt/audio-tagging.mjs";

export const PARAKEET_HF_BASE =
  "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8/resolve/main";
export const ZIPFORMER_ARCHIVE_URL =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2";
/** アーカイブの中のフォルダ名。 */
export const ZIPFORMER_ARCHIVE_DIR = "sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01";
/** あれば一緒に取り出す（無くても揃った扱い）。ライセンス表記のため。 */
const ZIPFORMER_OPTIONAL_FILES = ["README.md"];

/** CED-tiny（音の種類の判定）の配布物（公式の例 nodejs-addon-examples/test_audio_tagging_ced.js と同じ並び）。 */
export const CED_TINY_ARCHIVE_URL =
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/audio-tagging-models/sherpa-onnx-ced-tiny-audio-tagging-2024-04-19.tar.bz2";
/** アーカイブの中のフォルダ名。 */
export const CED_TINY_ARCHIVE_DIR = "sherpa-onnx-ced-tiny-audio-tagging-2024-04-19";

/** `--only` で選べるもの。--only なしの既定はこの全部（足りないものだけ）。 */
export const FETCH_TARGETS = Object.freeze([...LOCAL_STT_ENGINES, "ced-tiny"]);

/** アーカイブから取り出すもの（engine → 配布元・中のフォルダ・あれば取り出すもの）。 */
const ARCHIVES = Object.freeze({
  zipformer: { url: ZIPFORMER_ARCHIVE_URL, archiveDir: ZIPFORMER_ARCHIVE_DIR, optional: ZIPFORMER_OPTIONAL_FILES, tmpPrefix: "soul-zipformer-" },
  "ced-tiny": { url: CED_TINY_ARCHIVE_URL, archiveDir: CED_TINY_ARCHIVE_DIR, optional: ["README.md"], tmpPrefix: "soul-ced-tiny-" }
});

/** @param {string} p */
function hasBytes(p) {
  try {
    return existsSync(p) && statSync(p).isFile() && statSync(p).size > 0;
  } catch {
    return false;
  }
}

/**
 * 取るものの一覧（揃っているものは載らない）。`only` が無い・空なら全部（文字起こしのエンジンと CED-tiny）、
 * あればそこに挙がったものだけ。
 * @param {{ modelsDir?: string; only?: string[]; existsImpl?: (p: string) => boolean }} [opts]
 * @returns {Array<{ engine: "parakeet" | "zipformer" | "ced-tiny"; dir: string; missing: Array<{ role: string; name: string; path: string }> }>}
 */
export function planLocalSttModelFetch(opts = {}) {
  const existsImpl = opts.existsImpl ?? hasBytes;
  const engines = /** @type {Array<"parakeet" | "zipformer">} */ (
    LOCAL_STT_ENGINES.filter((e) => !opts.only || opts.only.length === 0 || opts.only.includes(e))
  );
  const plan = [];
  for (const engine of engines) {
    const { dir, files } = resolveLocalSttModel(engine, { modelsDir: opts.modelsDir });
    const layout = LOCAL_STT_MODEL_LAYOUT[engine];
    const missing = Object.entries(files)
      .filter(([, p]) => !existsImpl(p))
      .map(([role, p]) => ({ role, name: /** @type {any} */ (layout.files)[role], path: p }));
    if (missing.length > 0) plan.push({ engine, dir, missing });
  }
  if (!opts.only || opts.only.length === 0 || opts.only.includes("ced-tiny")) {
    const { dir, files } = resolveCedTinyModel({ modelsDir: opts.modelsDir });
    const missing = Object.entries(files)
      .filter(([, p]) => !existsImpl(p))
      .map(([role, p]) => ({ role, name: /** @type {any} */ (CED_TINY_MODEL_LAYOUT.files)[role], path: p }));
    if (missing.length > 0) plan.push({ engine: /** @type {const} */ ("ced-tiny"), dir, missing });
  }
  return plan;
}

/**
 * URL → ファイル（`.part` に書いてから名前を変える）。
 * @param {string} url @param {string} dest @param {typeof fetch} fetchImpl
 */
async function download(url, dest, fetchImpl) {
  const part = `${dest}.part`;
  const res = await fetchImpl(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status} ${res.statusText} (${url})`);
  const total = Number(res.headers.get("content-length") ?? 0);
  let done = 0;
  let lastPct = -10;
  const body = Readable.fromWeb(/** @type {any} */ (res.body));
  body.on("data", (chunk) => {
    done += chunk.length;
    if (total > 0) {
      const pct = Math.floor((done / total) * 100);
      if (pct >= lastPct + 10) {
        lastPct = pct;
        process.stdout.write(`  ${path.basename(dest)} ${pct}%\n`);
      }
    }
  });
  await pipeline(body, createWriteStream(part));
  renameSync(part, dest);
}

/** OS の tar（bz2 を展開できるもの）。 */
function tarCommand() {
  if (process.platform === "win32") {
    const sys = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
    if (existsSync(sys)) return sys;
  }
  return "tar";
}

/**
 * @param {{ modelsDir?: string; only?: string[]; dryRun?: boolean; fetchImpl?: typeof fetch; log?: (line: string) => void;
 *   existsImpl?: (p: string) => boolean }} [opts]
 * @returns {Promise<{ fetched: string[]; skipped: boolean }>}
 */
export async function fetchLocalSttModels(opts = {}) {
  const log = opts.log ?? ((line) => process.stdout.write(`${line}\n`));
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const plan = planLocalSttModelFetch(opts);
  if (plan.length === 0) {
    log("[fetch-local-stt-models] 揃っている（何もしない）。");
    return { fetched: [], skipped: true };
  }
  for (const item of plan) {
    log(`[fetch-local-stt-models] ${item.engine}: 足りない ${item.missing.map((m) => m.name).join(", ")} → ${item.dir}`);
  }
  if (opts.dryRun) return { fetched: [], skipped: false };

  /** @type {string[]} */
  const fetched = [];
  for (const item of plan) {
    mkdirSync(item.dir, { recursive: true });
    if (item.engine === "parakeet") {
      for (const m of item.missing) {
        log(`[fetch-local-stt-models] parakeet: ${m.name} を取得中…`);
        await download(`${PARAKEET_HF_BASE}/${m.name}`, m.path, fetchImpl);
        fetched.push(m.path);
      }
      continue;
    }
    // zipformer / ced-tiny: アーカイブを一時フォルダに落とし、要るファイルだけ取り出して置く。
    const archiveInfo = ARCHIVES[/** @type {"zipformer" | "ced-tiny"} */ (item.engine)];
    const tmp = mkdtempSync(path.join(os.tmpdir(), archiveInfo.tmpPrefix));
    try {
      const archive = path.join(tmp, "model.tar.bz2");
      log(`[fetch-local-stt-models] ${item.engine}: アーカイブを取得中…`);
      await download(archiveInfo.url, archive, fetchImpl);
      const outDir = path.join(tmp, "out");
      mkdirSync(outDir, { recursive: true });
      const members = [...item.missing.map((m) => m.name), ...archiveInfo.optional].map(
        (name) => `${archiveInfo.archiveDir}/${name}`
      );
      for (const member of members) {
        const r = spawnSync(tarCommand(), ["-xjf", archive, "-C", outDir, member], { encoding: "utf8" });
        const required = !archiveInfo.optional.some((n) => member.endsWith(`/${n}`));
        if (r.status !== 0 && required) {
          throw new Error(`tar failed for ${member}: ${(r.stderr || r.error?.message || "").trim()}`);
        }
      }
      for (const m of item.missing) {
        const src = path.join(outDir, archiveInfo.archiveDir, m.name);
        if (!hasBytes(src)) throw new Error(`archive did not contain ${m.name}`);
        copyFileSync(src, m.path);
        fetched.push(m.path);
      }
      for (const name of archiveInfo.optional) {
        const src = path.join(outDir, archiveInfo.archiveDir, name);
        const dest = path.join(item.dir, name);
        if (hasBytes(src) && !hasBytes(dest)) copyFileSync(src, dest);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  log(`[fetch-local-stt-models] 完了（${fetched.length} ファイル）。`);
  return { fetched, skipped: false };
}

/** @param {string[]} argv */
export function parseFetchArgs(argv) {
  /** @type {{ modelsDir?: string; only?: string[]; dryRun: boolean }} */
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--models-dir") out.modelsDir = argv[++i];
    else if (a === "--only") {
      out.only = String(argv[++i] ?? "").split(",").filter(Boolean);
      for (const e of out.only) if (!FETCH_TARGETS.includes(e)) throw new Error(`unknown engine for --only: ${e}`);
    } else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    const args = parseFetchArgs(process.argv.slice(2));
    await fetchLocalSttModels({ ...args, modelsDir: args.modelsDir ?? DEFAULT_LOCAL_STT_MODELS_DIR });
  } catch (error) {
    process.stderr.write(`[fetch-local-stt-models] 失敗: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
