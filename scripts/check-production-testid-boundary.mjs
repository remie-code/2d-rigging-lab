import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const defaultRepoRoot = process.cwd();
const defaultSourceRoots = ["apps/editor/src"];
const sourceExtensions = new Set([".ts", ".tsx"]);
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage", "generated"]);

function parseArgs(argv) {
  const sourceRoots = [];
  const config = {
    repoRoot: defaultRepoRoot,
    sourceRoots: defaultSourceRoots
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

function toRepoPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function isExcludedProductionPath(repoPath) {
  const normalized = repoPath.toLowerCase();
  const baseName = path.basename(normalized);

  return (
    normalized.includes("/e2e/") ||
    normalized.includes("/__tests__/") ||
    normalized.includes("/test/") ||
    normalized.includes("/tests/") ||
    /\.[a-z0-9-]*(?:test|spec)\.tsx?$/.test(baseName) ||
    /\.(?:test|spec)\.tsx?$/.test(baseName)
  );
}

function shouldScanFile(repoPath) {
  return sourceExtensions.has(path.extname(repoPath).toLowerCase()) && !isExcludedProductionPath(repoPath);
}

function stripCommentsPreservingStrings(text) {
  let output = "";
  let state = "code";
  let quote = "";
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1] ?? "";

    if (state === "lineComment") {
      if (character === "\n") {
        state = "code";
        output += character;
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "blockComment") {
      if (character === "*" && nextCharacter === "/") {
        output += "  ";
        index += 1;
        state = "code";
        continue;
      }

      output += character === "\n" ? "\n" : " ";
      continue;
    }

    if (state === "string") {
      output += character;

      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        state = "code";
        quote = "";
      }
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      output += "  ";
      index += 1;
      state = "lineComment";
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      output += "  ";
      index += 1;
      state = "blockComment";
      continue;
    }

    if (character === "\"" || character === "'" || character === "`") {
      output += character;
      state = "string";
      quote = character;
      escaped = false;
      continue;
    }

    output += character;
  }

  return output;
}

function makeFinding(repoPath, lineNumber, reason, line) {
  const snippet = line.trim().replace(/\s+/g, " ").slice(0, 180);
  return `${repoPath}:${lineNumber}: ${reason}${snippet.length > 0 ? ` (${snippet})` : ""}`;
}

function findDatasetTestIdReads(repoPath, lines) {
  const findings = [];
  const datasetPattern = /\bdataset\s*(?:\.\s*testid|\[\s*["']testid["']\s*\])/g;

  lines.forEach((line, index) => {
    datasetPattern.lastIndex = 0;
    let match = datasetPattern.exec(line);

    while (match !== null) {
      const operatorContext = line.slice(match.index + match[0].length).trimStart();
      const isSimpleAssignment = operatorContext.startsWith("=") &&
        !operatorContext.startsWith("==") &&
        !operatorContext.startsWith("=>");

      if (!isSimpleAssignment) {
        findings.push(
          makeFinding(
            repoPath,
            index + 1,
            "dataset.testid read is forbidden in production behavior; keep test IDs write-only observation hooks",
            line
          )
        );
      }

      match = datasetPattern.exec(line);
    }
  });

  return findings;
}

function findProductionTestIdDependencies(repoPath, text) {
  const sanitized = stripCommentsPreservingStrings(text);
  const lines = sanitized.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (/\[\s*data-testid\b/i.test(line)) {
      findings.push(
        makeFinding(
          repoPath,
          lineNumber,
          "[data-testid] selector string is forbidden in production behavior; use explicit refs or local state",
          line
        )
      );
    }

    if (/\b(?:getAttribute|getAttributeNode|hasAttribute)\s*\(\s*["']data-testid["']\s*\)/.test(line)) {
      findings.push(
        makeFinding(
          repoPath,
          lineNumber,
          "data-testid attribute readback is forbidden in production behavior",
          line
        )
      );
    }

    if (/\battributes\s*(?:\.\s*getNamedItem\s*\(\s*["']data-testid["']\s*\)|\[\s*["']data-testid["']\s*\])/.test(line)) {
      findings.push(
        makeFinding(
          repoPath,
          lineNumber,
          "data-testid attribute readback is forbidden in production behavior",
          line
        )
      );
    }
  });

  findings.push(...findDatasetTestIdReads(repoPath, lines));
  return findings;
}

let config;
try {
  config = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const files = (await Promise.all(
  config.sourceRoots.map((sourceRoot) => collectFiles(path.join(config.repoRoot, sourceRoot)))
)).flat();
const findings = [];

for (const file of files) {
  const repoPath = toRepoPath(config.repoRoot, file);

  if (!shouldScanFile(repoPath)) {
    continue;
  }

  findings.push(...findProductionTestIdDependencies(repoPath, await readFile(file, "utf8")));
}

if (findings.length > 0) {
  console.error("Production data-testid boundary violations found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Production data-testid boundary guard passed.");
