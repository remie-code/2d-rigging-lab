// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// 親（魂の本体）で sherpa-onnx-node を import しないことの固定（local-stt-wave-plan.md §1 の 1・8）。
// sherpa-onnx-node と耳の Silero VAD（onnxruntime-node 1.27.0）は onnxruntime.dll の版がぶつかり、同じプロセスでは
// 後から読んだ方が落ちる（stt-candidates-2026-10.md §6）。sherpa を読むのは子プロセスの入口 local-stt-worker.mjs だけ。
//  (1) 実行時: 別プロセスで解決の hook を掛けてから親側のモジュールを読み込み、sherpa の解決が 1 回も起きないこと。
//  (2) 静的: 操縦席と耳 CLI の入口から辿れる import のどこにも sherpa が無く、子の入口も辿れないこと。
//      ソースの中で sherpa を import / require してよいのは子の入口だけ。

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_ROOT = path.resolve(HERE, "..", "..", "..");
const WORKER = path.join(HERE, "local-stt-worker.mjs");

const PARENT_MODULES = [
  "scripts/cockpit.mjs",
  "scripts/fetch-local-stt-models.mjs",
  "src/cockpit/cockpit-server.mjs",
  "src/cockpit/cockpit-settings-store.mjs",
  "src/ears/ear-pipeline.mjs",
  "src/ears/local-stt/local-stt-client.mjs",
  "src/ears/local-stt/local-stt-engines.mjs",
  "src/ears/local-stt/local-stt-worker-core.mjs",
  "src/cli/ears-cli.mjs"
];

test("親で sherpa を読まない（実行時）: 親側のモジュールを読み込んでも sherpa-onnx の解決が起きない", { timeout: 60000 }, () => {
  const urls = PARENT_MODULES.map((m) => pathToFileURL(path.join(AGENT_ROOT, m)).href);
  const script = `
    import { registerHooks } from "node:module";
    const seen = [];
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (/sherpa-onnx/.test(specifier)) seen.push(specifier);
        return nextResolve(specifier, context);
      }
    });
    const urls = ${JSON.stringify(urls)};
    for (const u of urls) await import(u);
    const before = [...seen];
    // 対照: hook が効いていること（解決だけ・読み込まない）。
    import.meta.resolve("sherpa-onnx-node");
    process.stdout.write(JSON.stringify({ before, control: seen.length - before.length }) + "\\n");
    process.exit(0);
  `;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: AGENT_ROOT,
    encoding: "utf8",
    timeout: 50000
  });
  assert.equal(r.status, 0, `child failed: ${r.stderr}`);
  const line = r.stdout.trim().split(/\r?\n/).pop() ?? "";
  const out = JSON.parse(line);
  assert.deepEqual(out.before, [], "親側のモジュールが sherpa-onnx を解決した");
  assert.ok(out.control >= 1, "解決の hook が効いていない（対照）");
});

/** import / require の specifier（check-soul-zone-boundary.mjs と同じ流儀）。 */
function specifiers(/** @type {string} */ text) {
  const patterns = [
    /\b(?:import|export)\b[^'"]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire(?:\.resolve)?\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  /** @type {string[]} */
  const out = [];
  for (const p of patterns) for (const m of text.matchAll(p)) out.push(m[1]);
  return out;
}

test("親で sherpa を読まない（静的）: 操縦席・耳 CLI の入口から辿れる import に sherpa も子の入口も無い", () => {
  const entries = ["scripts/cockpit.mjs", "src/cli/ears-cli.mjs"].map((m) => path.join(AGENT_ROOT, m));
  const seen = new Set();
  const stack = [...entries];
  /** @type {string[]} */
  const offenders = [];
  while (stack.length > 0) {
    const file = /** @type {string} */ (stack.pop());
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const spec of specifiers(text)) {
      if (/sherpa-onnx/.test(spec)) offenders.push(`${path.relative(AGENT_ROOT, file)} -> ${spec}`);
      if (!spec.startsWith(".")) continue;
      const target = path.resolve(path.dirname(file), spec);
      if (existsSync(target) && statSync(target).isFile() && /\.(mjs|js|cjs)$/.test(target)) stack.push(target);
    }
  }
  assert.deepEqual(offenders, []);
  assert.equal(seen.has(WORKER), false, "子の入口が親の import から辿れてしまう");
  assert.ok(seen.has(path.join(HERE, "local-stt-client.mjs")), "fork する係は親から辿れる（前提の確認）");
});

test("ソースの中で sherpa-onnx-node を読み込むのは子の入口（local-stt-worker.mjs）だけ", () => {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "vendor") continue;
      const p = path.join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(mjs|js|cjs)$/.test(name) && specifiers(readFileSync(p, "utf8")).some((s) => /sherpa-onnx/.test(s))) found.push(p);
    }
  };
  walk(path.join(AGENT_ROOT, "src"));
  walk(path.join(AGENT_ROOT, "scripts"));
  assert.deepEqual(found, [WORKER]);
});
