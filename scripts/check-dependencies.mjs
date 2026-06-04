import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { wave42NonGoalClassificationPolicy } from "./wave42-non-goal-classification-policy.mjs";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage"]);
const manifestNames = new Set(["package.json"]);
const lockfileNames = new Set(["pnpm-lock.yaml"]);
const claimScanTextExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".jsonl",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);
const claimScanExcludedPaths = [
  /^scripts\/check-dependencies(?:-[a-z0-9-]+)?\.mjs$/i,
  /^scripts\/wave42-non-goal-classification-policy\.mjs$/i
];

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundledDependencies",
  "bundleDependencies"
];

const forbiddenDependencyPatterns = [
  { pattern: /(^|[-_@/])live2d($|[-_@/])/i, reason: "Live2D model loader/runtime dependency" },
  { pattern: /cubism/i, reason: "Cubism SDK/Core/parser dependency" },
  { pattern: /moc3/i, reason: "Cubism moc3 parser/runtime dependency" },
  { pattern: /cmo3/i, reason: "Cubism cmo3 parser/runtime dependency" },
  { pattern: /model3/i, reason: "Cubism model3 parser/runtime dependency" },
  { pattern: /motion3/i, reason: "Cubism motion3 parser/runtime dependency" },
  { pattern: /physics3/i, reason: "Cubism physics3 parser/runtime dependency" },
  { pattern: /pose3/i, reason: "Cubism pose3 parser/runtime dependency" },
  { pattern: /proprietary.*(runtime|binary|asset)/i, reason: "unapproved proprietary runtime or binary asset dependency" }
];

const forbiddenAssetPatterns = [
  { pattern: /\.moc3$/i, reason: "Cubism runtime asset" },
  { pattern: /\.cmo3$/i, reason: "Cubism editor asset" },
  { pattern: /\.model3\.json$/i, reason: "Cubism model descriptor" },
  { pattern: /\.motion3\.json$/i, reason: "Cubism motion descriptor" },
  { pattern: /\.physics3\.json$/i, reason: "Cubism physics descriptor" },
  { pattern: /\.pose3\.json$/i, reason: "Cubism pose descriptor" },
  { pattern: /live2dcubismcore.*\.(wasm|js|mjs|cjs)$/i, reason: "Cubism Core runtime binary" }
];

const positiveClaimPattern =
  /\b(?:implemented|implements|supported|supports|enabled|available|passed|passes|provides|ready|ships|integrated)\b/i;
const negativeAssertionPattern =
  /\b(?:absence|absent|blocked|cannot|disabled|disallowed|does not|do not|excluded|excludes|excluding|forbids|forbidden|must not|never|no|non-goal|not|out[- ]of[- ]scope|prohibited|reject|rejects|unsafe|unsupported|unavailable|without)\b|(?:ではない|でもない|でもなく|はない|提供しない|証明しない|使わず|必要になる|必要が出る|必要が出た)/i;
const nonGoalDocumentationPattern =
  /\b(?:future scope|non-goal|non-goals|out[- ]of[- ]scope|unsupported)\b|(?:MVP外|スコープ外|対象外|非対応|未実装|将来範囲|将来スコープ|含めない|実装しない|依存しない|しないこと)/i;
const negativeAssertionContextPattern =
  /\b(?:forbidden[A-Za-z0-9]*Claims|unsupported[A-Za-z0-9]*Claims|unsafe[A-Za-z0-9]*Claims|assertNo|must not|not present|not contain|absence|absent)\b/i;
const fixtureFalseFlagPattern =
  /(?:["']?[A-Za-z0-9_.-]*(?:available|compatibility|enabled|implemented|support|supported)[A-Za-z0-9_.-]*["']?\s*[:=]\s*false\b|\bfalse\s*(?:[,}\]]|$))/i;
const historicalEvidencePathPattern =
  /^discussion\/(?:reports|implementation\/(?:reviews|reports|orchestration\/_map\.md|waves\/wave(?:[0-9]|[1-3][0-9]|4[01])\/|orchestration\/wave(?:[0-9]|[1-3][0-9]|4[01])-plan\.md))/;

async function collectFiles(directory) {
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

function checkDependencyName(name, source) {
  return forbiddenDependencyPatterns
    .filter(({ pattern }) => pattern.test(name))
    .map(({ reason }) => `${source}: ${name} (${reason})`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeClaimText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const explicitNonGoalTerms = wave42NonGoalClassificationPolicy.explicitNonGoals.flatMap((nonGoal) =>
  nonGoal.terms.map((term) => ({
    nonGoalId: nonGoal.id,
    term,
    normalizedTerm: normalizeClaimText(term),
    pattern: new RegExp(escapeRegExp(term), "i")
  }))
);

function isClaimScanExcluded(repoPath) {
  return claimScanExcludedPaths.some((pattern) => pattern.test(repoPath));
}

function shouldScanClaims(repoPath, baseName) {
  if (manifestNames.has(baseName) || lockfileNames.has(baseName) || isClaimScanExcluded(repoPath)) {
    return false;
  }

  return claimScanTextExtensions.has(path.extname(repoPath).toLowerCase());
}

function findNonGoalTermMatches(line) {
  const normalizedLine = normalizeClaimText(line);

  return explicitNonGoalTerms.filter(({ normalizedTerm, pattern }) =>
    pattern.test(line) || (normalizedTerm.length >= 4 && normalizedLine.includes(normalizedTerm))
  );
}

function classifyAllowedNonGoalContext(repoPath, line, surroundingContext) {
  if (fixtureFalseFlagPattern.test(line)) {
    return "fixtureFalseFlag";
  }

  if (negativeAssertionPattern.test(line) || negativeAssertionContextPattern.test(surroundingContext)) {
    return "negativeAssertion";
  }

  if (nonGoalDocumentationPattern.test(line)) {
    return "nonGoalDocumentation";
  }

  if (historicalEvidencePathPattern.test(repoPath)) {
    return "historicalReviewEvidence";
  }

  return null;
}

function checkNonGoalClaims(repoPath, text) {
  const claimFindings = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const matches = findNonGoalTermMatches(line);
    if (matches.length === 0) {
      return;
    }

    const surroundingContext = lines.slice(Math.max(0, index - 24), index + 2).join("\n");
    const allowedContext = classifyAllowedNonGoalContext(repoPath, line, surroundingContext);
    if (allowedContext !== null) {
      return;
    }

    if (!positiveClaimPattern.test(line)) {
      return;
    }

    const uniqueMatches = new Map(matches.map((match) => [match.nonGoalId, match]));
    for (const { nonGoalId, term } of uniqueMatches.values()) {
      claimFindings.push(
        `${repoPath}:${index + 1}: positive forbidden non-goal claim (${nonGoalId}: ${term})`
      );
    }
  });

  return claimFindings;
}

const findings = [];
const files = await collectFiles(repoRoot);

for (const file of files) {
  const repoPath = toRepoPath(file);
  const baseName = path.basename(file);

  for (const { pattern, reason } of forbiddenAssetPatterns) {
    if (pattern.test(repoPath)) {
      findings.push(`${repoPath}: ${reason}`);
    }
  }

  if (manifestNames.has(baseName)) {
    const manifest = JSON.parse(await readFile(file, "utf8"));

    for (const section of dependencySections) {
      const declarations = manifest[section];
      if (!declarations || typeof declarations !== "object") {
        continue;
      }

      const dependencyNames = Array.isArray(declarations)
        ? declarations
        : Object.keys(declarations);

      for (const dependencyName of dependencyNames) {
        findings.push(...checkDependencyName(dependencyName, `${repoPath} ${section}`));
      }
    }
  }

  if (lockfileNames.has(baseName)) {
    const lockfileText = await readFile(file, "utf8");

    for (const { pattern, reason } of forbiddenDependencyPatterns) {
      if (pattern.test(lockfileText)) {
        findings.push(`${repoPath}: lockfile mentions forbidden dependency class (${reason})`);
      }
    }
  }

  if (shouldScanClaims(repoPath, baseName)) {
    findings.push(...checkNonGoalClaims(repoPath, await readFile(file, "utf8")));
  }
}

if (findings.length > 0) {
  console.error("Forbidden dependency, asset, or non-goal claim declarations found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Dependency guard passed.");
