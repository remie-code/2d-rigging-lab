import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const sourceRoots = ["packages", "apps", "tests", "scripts"];
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", "generated"]);
const forbiddenCatchAllNames = new Set(["types.ts", "schemas.ts", "utils.ts", "helpers.ts"]);

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

  return /^export\s+(type\s+)?(\{[^}]*\}|\*)\s+from\s+["'][^"']+["'];?$/.test(trimmed);
}

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

  if (baseName === "index.ts") {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);
    const invalidLine = lines.find((line) => !isAllowedBarrelLine(line));

    if (invalidLine !== undefined) {
      findings.push(`${repoPath}: index.ts must remain a barrel-only entrypoint`);
    }
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
