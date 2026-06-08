import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", "dist", "coverage"]);
const manifestNames = new Set(["package.json"]);
const lockfileNames = new Set(["pnpm-lock.yaml"]);

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

}

if (findings.length > 0) {
  console.error("Forbidden dependency or asset declarations found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Dependency guard passed.");
