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

// Extract the set of dependency package names referenced by a pnpm-lock.yaml
// (lockfileVersion 6/9). Only true package identifiers are collected; opaque
// value strings such as `resolution:`/`integrity:` base64 hashes and `engines:`
// ranges are intentionally excluded so that incidental substrings inside those
// hashes cannot be mistaken for forbidden dependency names.
function collectLockfilePackageNames(lockfileText) {
  const names = new Set();

  const addFromPackageKey = (rawKey) => {
    // rawKey looks like "@scope/pkg@1.2.3(peer@4.5.6)" or "pkg@1.2.3" or the
    // legacy pnpm v6 form "/pkg@1.2.3" / "/@scope/pkg@1.2.3". Any embedded peer
    // dependency identifiers are also true package names, so collect them too.
    for (const identifier of extractPackageIdentifiers(rawKey)) {
      names.add(identifier);
    }
  };

  for (const rawLine of lockfileText.split(/\r?\n/)) {
    const line = rawLine.replace(/\r$/, "");

    // Skip opaque value lines that never contain dependency names but may
    // contain arbitrary base64/hash substrings.
    const trimmed = line.trim();
    if (
      trimmed.startsWith("resolution:") ||
      trimmed.startsWith("integrity:") ||
      trimmed.startsWith("engines:") ||
      trimmed.startsWith("cpu:") ||
      trimmed.startsWith("os:") ||
      trimmed.startsWith("checksum:")
    ) {
      continue;
    }

    // Section/entry keys: `  '@scope/pkg@1.2.3(...)':` , `  pkg@1.2.3:` ,
    // legacy `  /pkg@1.2.3:` . Match a line whose non-space content is a
    // (possibly quoted) identifier terminated by a colon.
    const keyMatch = line.match(/^\s*'?\/?((?:@[^'\s:@/]+\/)?[^'\s:@/]+@[^':]+)'?:\s*(?:\{.*\})?$/);
    if (keyMatch) {
      addFromPackageKey(keyMatch[1]);
      continue;
    }

    // Snapshot dependency lines and peer-decorated version lines:
    // `      dep-name: 1.2.3(peer@4.5.6)` . The key before the colon is a
    // dependency name; the value may carry peer-decorated identifiers.
    const depMatch = line.match(/^\s+'?(@?[^'\s:@]+(?:\/[^'\s:@]+)?)'?:\s*(\S.*)?$/);
    if (depMatch) {
      const depName = depMatch[1];
      const depValue = depMatch[2] ?? "";
      // Exclude structural YAML keys (they never carry an @version and are not
      // package names): specifier, version, dependencies, etc.
      names.add(depName);
      for (const identifier of extractPackageIdentifiers(depValue)) {
        names.add(identifier);
      }
    }
  }

  return names;
}

// Pull every `name@version` (optionally scoped) identifier out of a string,
// including those nested inside peer-dependency parentheses such as
// `1.2.3(@babel/core@7.0.0)`.
function extractPackageIdentifiers(text) {
  const identifiers = [];
  const pattern = /(@[^()@\s/]+\/[^()@\s/]+|[^()@\s/]+)@[^()\s]+/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    identifiers.push(match[1]);
  }
  return identifiers;
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
    const lockfilePackageNames = collectLockfilePackageNames(lockfileText);

    const reportedReasons = new Set();
    for (const packageName of lockfilePackageNames) {
      for (const { pattern, reason } of forbiddenDependencyPatterns) {
        if (pattern.test(packageName) && !reportedReasons.has(reason)) {
          reportedReasons.add(reason);
          findings.push(
            `${repoPath}: lockfile mentions forbidden dependency class (${reason}) via ${packageName}`
          );
        }
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
