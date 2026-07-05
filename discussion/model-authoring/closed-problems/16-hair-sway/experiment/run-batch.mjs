// Batch driver: runs a list of op specs through apply-op.mjs, filling
// basePackageRevision from the live manifest before each op and git-committing
// the rigging workspace after each successful commit (1 op = 1 git commit).
//
// Usage: node run-batch.mjs <batch.json>
//   batch.json = [{ file, operationId, operationType, payload, gitMessage }]
// Spec files are written under commands/ and full responses saved next to them.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";

const PACKAGE_DIR = "C:/workspace/remie/rigging/llm-rigging";
const HERE = dirname(resolve(process.argv[2]));

const batch = JSON.parse(readFileSync(resolve(process.argv[2]), "utf8"));

const currentRevision = () =>
  JSON.parse(readFileSync(join(PACKAGE_DIR, "manifest.json"), "utf8")).packageRevision;

for (const entry of batch) {
  const rev = currentRevision();
  const spec = {
    operationId: entry.operationId,
    operationType: entry.operationType,
    basePackageRevision: rev,
    payload: entry.payload
  };
  const specPath = join(HERE, "commands", entry.file);
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  console.log(`== ${entry.file} (base rev ${rev})`);
  try {
    execSync(`node "${join(HERE, "apply-op.mjs")}" "${specPath}"`, {
      stdio: "inherit",
      cwd: HERE
    });
  } catch {
    console.log(`STOP: ${entry.file} failed; batch aborted.`);
    process.exit(1);
  }
  execSync(`git add -A && git commit -q -m "${entry.gitMessage}"`, {
    cwd: PACKAGE_DIR,
    stdio: ["ignore", "ignore", "ignore"],
    shell: true
  });
}
console.log(`DONE. package revision now ${currentRevision()}`);
