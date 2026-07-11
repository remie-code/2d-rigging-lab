import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 特区方向ルール検査（C4 Domain D, 裁定 6 / 憲章 §6 訂正）。
 *
 * 特区 `apps/soul`（魂）と器（それ以外の本リポジトリ）の間の依存の向きを機械強制する。
 * 検査は **2 ルールのみ**（汎用 DAG 検証は作らない。裁定 6）:
 *
 *   ルール 1（器 → 魂の禁止, 憲章 §6.3）: 特区外のコードが `apps/soul` を import したら違反。
 *                                          「器側の何ものも魂を import しない」。
 *   ルール 2（魂 → 器コードの禁止, 憲章 §6.2）: 特区内のコードが器のコードを import したら違反。
 *                                          魂が import してよいのは契約（型・fixture=JSON）だけ。
 *
 * 契約 JSON の扱い（設計判断・重要）:
 *   本検査が見るのは **import 文の specifier**（static import / export-from / side-effect
 *   import / dynamic import / require）だけである。参照ドライバは契約 JSON を `readFileSync`
 *   で読むが、それは import 文ではないので本検査の対象にすらならない（＝「器コード import」で
 *   はなく「契約の参照」）。加えて、仮に `.json` を import 文で読んだ場合でも、ルール 2 は
 *   `.json`（契約=fixture）への特区外参照を **許容** する。よって契約 JSON の参照は器コード
 *   import と区別され、憲章 §6.2 の「契約は読むだけ許される」と両立する。
 *
 * 既存 `check:*` スクリプト群の流儀（`--root` で fixture を指せる standalone スキャナ）に
 * 合わせてある。純関数 {@link findSoulZoneBoundaryViolations} を export し、fixture 注入で
 * 単体検証できる（`check-soul-zone-boundary-fixtures.mjs` が違反 fixture で赤・valid で緑を固定）。
 */

export const DEFAULT_SOUL_ZONE_PREFIX = "apps/soul";

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs"
]);

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".turbo",
  "node_modules",
  "dist",
  "coverage",
  "generated",
  // 本検査自身の fixture（意図的な違反 import を含む）は実リポジトリ走査から除外する。
  "soul-zone-boundary-fixtures"
]);

const DEFAULT_SCAN_ROOTS = ["apps", "packages", "tests", "scripts"];

// import specifier を取り出すパターン群（先行 scripts/check-psd-parser-import-boundary.mjs と
// 同じ流儀を一般化）。import 節と `from` の間は改行込みで許す（`[^'"]*?`）: prettier で
// 折り返された多行 named import（`import {\n  foo,\n  bar\n} from "..."`）を取りこぼさない。
// `[^'"]` は引用符のみ除外＝specifier の境界で確実に停止するので、跨ぎ過ぎない。
const IMPORT_SPECIFIER_PATTERNS = [
  // import X from "spec" / export ... from "spec" / import type X from "spec"（多行対応）
  /\b(?:import|export)\b[^'"]*?\bfrom\s*["']([^"']+)["']/g,
  // side-effect import "spec"
  /\bimport\s*["']([^"']+)["']/g,
  // dynamic import("spec")
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  // require("spec") / require.resolve("spec")
  /\brequire(?:\.resolve)?\s*\(\s*["']([^"']+)["']\s*\)/g
];

/**
 * 1 ファイルのテキストから import specifier を（行番号つきで）抽出する純関数。
 * @param {string} text
 * @returns {{ specifier: string; line: number }[]}
 */
export function extractImportSpecifiers(text) {
  const found = [];
  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1];
      if (typeof specifier !== "string") {
        continue;
      }
      found.push({
        specifier,
        line: text.slice(0, match.index ?? 0).split(/\r?\n/).length
      });
    }
  }
  return found;
}

function isRelativeSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

/** POSIX 正規化した「repoPath からの相対 import」の解決先 repoPath。 */
function resolveRelativeRepoPath(importerRepoPath, specifier) {
  const importerDir = path.posix.dirname(importerRepoPath);
  return path.posix.normalize(path.posix.join(importerDir, specifier));
}

function isInsideZone(repoPath, soulZonePrefix) {
  return (
    repoPath === soulZonePrefix || repoPath.startsWith(`${soulZonePrefix}/`)
  );
}

/**
 * 2 ルールの純検査。`files` は `{ repoPath, text }`（repoPath は POSIX 区切り）の配列。
 * fixture を注入して単体検証できるよう、I/O から切り離してある。
 *
 * @param {{ files: { repoPath: string; text: string }[]; soulZonePrefix?: string }} input
 * @returns {string[]} 違反メッセージ（空配列 = 緑）
 */
export function findSoulZoneBoundaryViolations(input) {
  const soulZonePrefix = input.soulZonePrefix ?? DEFAULT_SOUL_ZONE_PREFIX;
  const findings = [];

  for (const file of input.files) {
    const importerInsideZone = isInsideZone(file.repoPath, soulZonePrefix);

    for (const { specifier, line } of extractImportSpecifiers(file.text)) {
      // 相対 import 以外（node:*, bare npm パッケージ, tsconfig alias 等）は path 解決できない
      // のでこの 2 ルールの対象外。ルールはあくまで「魂↔器」の path 越え依存に限る。
      if (!isRelativeSpecifier(specifier)) {
        continue;
      }
      const resolved = resolveRelativeRepoPath(file.repoPath, specifier);
      const targetInsideZone = isInsideZone(resolved, soulZonePrefix);

      if (!importerInsideZone && targetInsideZone) {
        // ルール 1: 器 → 魂の import。
        findings.push(
          `${file.repoPath}:${line}: 器のコードが特区 ${soulZonePrefix} を import しています` +
            `（"${specifier}" → ${resolved}）。憲章 §6.3: 器側の何ものも魂を import しない。`
        );
        continue;
      }

      if (importerInsideZone && !targetInsideZone) {
        // ルール 2: 魂 → 器の import。ただし契約（.json = 型/fixture）への参照は許容。
        if (resolved.endsWith(".json")) {
          continue;
        }
        findings.push(
          `${file.repoPath}:${line}: 特区 ${soulZonePrefix} が器のコードを import しています` +
            `（"${specifier}" → ${resolved}）。憲章 §6.2: 魂は契約（型・fixture=JSON）だけを import できる。`
        );
      }
    }
  }

  return findings;
}

// ── CLI（既存 check:* と同じ、standalone スキャナ）─────────────────────────

function parseArgs(argv) {
  const config = { repoRoot: process.cwd(), scanRoots: DEFAULT_SCAN_ROOTS };
  const scanRoots = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === "--root") {
      if (next === undefined) {
        throw new Error("--root requires a path");
      }
      config.repoRoot = path.resolve(next);
      index += 1;
      continue;
    }
    if (argument === "--scan-root") {
      if (next === undefined) {
        throw new Error("--scan-root requires a path");
      }
      scanRoots.push(next);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (scanRoots.length > 0) {
    config.scanRoots = scanRoots;
  }
  return config;
}

async function directoryExists(directory) {
  try {
    await readdir(directory);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function collectSourceFiles(directory) {
  if (!(await directoryExists(directory))) {
    return [];
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      files.push(...(await collectSourceFiles(path.join(directory, entry.name))));
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

async function runCli(argv) {
  let config;
  try {
    config = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
    return;
  }

  const filePaths = (
    await Promise.all(
      config.scanRoots.map((root) =>
        collectSourceFiles(path.join(config.repoRoot, root))
      )
    )
  ).flat();

  const files = await Promise.all(
    filePaths.map(async (filePath) => ({
      repoPath: path
        .relative(config.repoRoot, filePath)
        .split(path.sep)
        .join("/"),
      text: await readFile(filePath, "utf8")
    }))
  );

  const findings = findSoulZoneBoundaryViolations({ files });

  if (findings.length > 0) {
    console.error("Soul zone boundary violations found:");
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exit(1);
    return;
  }

  console.log(
    `Soul zone boundary guard passed: ${files.length} source files scanned; ` +
      "no 器→魂 imports and no 魂→器 code imports."
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;
if (invokedPath === import.meta.url) {
  await runCli(process.argv.slice(2));
}
