import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const parserPackageName = "@webtoon/psd";

const scanRoots = ["apps", "packages", "scripts"];
const sourceExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
const ignoredDirectoryNames = new Set([
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results"
]);
const approvedDirectImportPaths = new Set([
  "apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts",
  "scripts/wave44-psd-layer-materialization.mjs",
  "scripts/wave44-psd-parser-smoke.mjs"
]);

const directImportPatterns = [
  {
    kind: "module-specifier",
    pattern: /\b(?:import|export)\s*(?:type\s+)?(?:[^'"]*?\bfrom\s*)?["']@webtoon\/psd(?:\/[^'"]*)?["']/g
  },
  {
    kind: "dynamic-import",
    pattern: /\bimport\s*\(\s*["']@webtoon\/psd(?:\/[^'"]*)?["']\s*\)/g
  },
  {
    kind: "require",
    pattern: /\brequire\s*\(\s*["']@webtoon\/psd(?:\/[^'"]*)?["']\s*\)/g
  },
  {
    kind: "require-resolve",
    pattern: /\brequire\.resolve\s*\(\s*["']@webtoon\/psd(?:\/[^'"]*)?["']\s*\)/g
  }
];

const main = async () => {
  const findings = [];
  const matches = [];

  for (const root of scanRoots) {
    for await (const filePath of walkSourceFiles(path.join(repoRoot, root))) {
      const repoPath = toRepoPath(filePath);
      const content = await readFile(filePath, "utf8");
      const fileMatches = findDirectImports(content, repoPath);

      matches.push(...fileMatches);
      for (const match of fileMatches) {
        if (repoPath.startsWith("packages/")) {
          findings.push(
            `${repoPath}:${match.line}: packages source must not directly import ${parserPackageName} (${match.kind})`
          );
          continue;
        }

        if (!approvedDirectImportPaths.has(repoPath)) {
          findings.push(
            `${repoPath}:${match.line}: unapproved direct ${parserPackageName} import (${match.kind})`
          );
        }
      }
    }
  }

  for (const approvedPath of approvedDirectImportPaths) {
    if (!matches.some((match) => match.repoPath === approvedPath)) {
      findings.push(`approved direct parser import path has no direct import match: ${approvedPath}`);
    }
  }

  if (findings.length > 0) {
    console.error("PSD parser import boundary violations found:");
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `PSD parser import boundary check passed: ${matches.length} direct import/resolve sites limited to approved adapter and Wave44 scripts.`
  );
};

async function* walkSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectoryNames.has(entry.name)) {
        yield* walkSourceFiles(filePath);
      }
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      yield filePath;
    }
  }
}

const findDirectImports = (content, repoPath) => {
  const matches = [];

  for (const { kind, pattern } of directImportPatterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      matches.push({
        repoPath,
        kind,
        line: countLinesBeforeOffset(content, match.index ?? 0)
      });
    }
  }

  return matches;
};

const countLinesBeforeOffset = (content, offset) =>
  content.slice(0, offset).split(/\r?\n/).length;

const toRepoPath = (filePath) =>
  path.relative(repoRoot, filePath).split(path.sep).join("/");

await main();
