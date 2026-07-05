// Single-op runner: fills basePackageRevision, applies via apply-op.mjs, git-commits.
// Usage: node run-batch-single.mjs <op-spec.json> <gitMessage>
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = "C:/workspace/remie/rigging/llm-rigging";
const specPath = resolve(process.argv[2]);
const gitMessage = process.argv[3];
const spec = JSON.parse(readFileSync(specPath, "utf8"));
spec.basePackageRevision = JSON.parse(
  readFileSync(join(PACKAGE_DIR, "manifest.json"), "utf8")
).packageRevision;
writeFileSync(specPath, JSON.stringify(spec, null, 1));
execSync(`node "${join(HERE, "apply-op.mjs")}" "${specPath}"`, { stdio: "inherit", cwd: HERE });
execSync(`git add -A && git commit -q -m "${gitMessage}"`, {
  cwd: PACKAGE_DIR, stdio: ["ignore", "ignore", "ignore"], shell: true
});
