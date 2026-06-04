import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const defaultRepoRoot = process.cwd();
const defaultSourceRoots = ["packages", "apps", "tests", "scripts"];
const defaultLargeCatchAllLineLimit = 1200;
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "generated",
  "source-organization-fixtures"
]);
const forbiddenCatchAllNames = new Set(["types.ts", "schemas.ts", "utils.ts", "helpers.ts"]);

function parseArgs(argv) {
  const sourceRoots = [];
  const config = {
    repoRoot: defaultRepoRoot,
    sourceRoots: defaultSourceRoots,
    largeCatchAllLineLimit: defaultLargeCatchAllLineLimit
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextArgument = argv[index + 1];

    if (argument === "--root") {
      if (nextArgument === undefined) {
        throw new Error("--root requires a path");
      }
      config.repoRoot = path.resolve(nextArgument);
      index += 1;
      continue;
    }

    if (argument === "--source-root") {
      if (nextArgument === undefined) {
        throw new Error("--source-root requires a path");
      }
      sourceRoots.push(nextArgument);
      index += 1;
      continue;
    }

    if (argument === "--max-large-catch-all-lines") {
      if (nextArgument === undefined || !/^\d+$/.test(nextArgument)) {
        throw new Error("--max-large-catch-all-lines requires a non-negative integer");
      }
      config.largeCatchAllLineLimit = Number(nextArgument);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (sourceRoots.length > 0) {
    config.sourceRoots = sourceRoots;
  }

  return config;
}

async function exists(directory) {
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

async function collectFiles(directory) {
  if (!await exists(directory)) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      files.push(...await collectFiles(path.join(directory, entry.name)));
      continue;
    }

    files.push(path.join(directory, entry.name));
  }

  return files;
}

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function isAllowedBarrelLine(line) {
  const trimmed = line.trim();

  if (
    trimmed === "" ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.endsWith("*/")
  ) {
    return true;
  }

  return (
    /^export\s+(type\s+)?(\{[^}]*\}|\*)\s+from\s+["'][^"']+["'];?$/.test(trimmed) ||
    /^export\s+\*\s+as\s+[A-Za-z_$][\w$]*\s+from\s+["'][^"']+["'];?$/.test(trimmed)
  );
}

function isLargeCatchAllCandidate(baseName) {
  const stem = path.basename(baseName, ".ts").toLowerCase();
  const tokens = stem.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
  const tokenSet = new Set(tokens);

  if (
    [
      "all",
      "common",
      "shared",
      "misc",
      "miscellaneous",
      "everything",
      "catchall",
      "kitchensink"
    ].includes(stem)
  ) {
    return true;
  }

  return (
    (tokenSet.has("all") && tokens.length > 1) ||
    tokenSet.has("common") ||
    tokenSet.has("shared") ||
    tokenSet.has("misc") ||
    tokenSet.has("miscellaneous") ||
    tokenSet.has("everything") ||
    tokenSet.has("catchall") ||
    (tokenSet.has("catch") && tokenSet.has("all")) ||
    (tokenSet.has("kitchen") && tokenSet.has("sink"))
  );
}

let config;
try {
  config = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const repoRoot = config.repoRoot;
const sourceRoots = config.sourceRoots;
const findings = [];
const files = (await Promise.all(
  sourceRoots.map((sourceRoot) => collectFiles(path.join(repoRoot, sourceRoot)))
)).flat();

for (const file of files) {
  if (!file.endsWith(".ts")) {
    continue;
  }

  const baseName = path.basename(file);
  const repoPath = toRepoPath(file);

  if (forbiddenCatchAllNames.has(baseName)) {
    findings.push(`${repoPath}: broad catch-all source file name is forbidden`);
  }

  const lines = (await readFile(file, "utf8")).split(/\r?\n/);

  if (baseName === "index.ts") {
    const invalidLine = lines.find((line) => !isAllowedBarrelLine(line));

    if (invalidLine !== undefined) {
      findings.push(`${repoPath}: index.ts must remain a barrel-only entrypoint`);
    }
  }

  if (isLargeCatchAllCandidate(baseName) && lines.length > config.largeCatchAllLineLimit) {
    findings.push(
      `${repoPath}: large catch-all source file name has ${lines.length} lines; split by responsibility`
    );
  }
}

if (findings.length > 0) {
  console.error("Source organization violations found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Source organization guard passed.");
