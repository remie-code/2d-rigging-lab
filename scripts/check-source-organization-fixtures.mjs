import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const guardPath = path.join(repoRoot, "scripts", "check-source-organization.mjs");
const fixtureRoot = path.join(repoRoot, "scripts", "source-organization-fixtures");

const fixtureCases = [
  {
    id: "valid-barrel-index",
    root: "valid-barrel-index",
    expectedStatus: 0,
    expectedOutput: "Source organization guard passed."
  },
  {
    id: "invalid-index-logic",
    root: "invalid-index-logic",
    expectedStatus: 1,
    expectedOutput: "index.ts must remain a barrel-only entrypoint"
  },
  {
    id: "invalid-forbidden-catch-all",
    root: "invalid-forbidden-catch-all",
    expectedStatus: 1,
    expectedOutput: "broad catch-all source file name is forbidden"
  },
  {
    id: "invalid-large-catch-all",
    root: "invalid-large-catch-all",
    expectedStatus: 1,
    extraArgs: ["--max-large-catch-all-lines", "3"],
    expectedOutput: "large catch-all source file name"
  }
];

const failures = [];

for (const fixtureCase of fixtureCases) {
  const result = spawnSync(
    process.execPath,
    [
      guardPath,
      "--root",
      path.join(fixtureRoot, fixtureCase.root),
      "--source-root",
      "packages",
      ...(fixtureCase.extraArgs ?? [])
    ],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  const combinedOutput = `${result.stdout}\n${result.stderr}`;

  if (result.status !== fixtureCase.expectedStatus) {
    failures.push(
      `${fixtureCase.id}: expected exit ${fixtureCase.expectedStatus}, got ${result.status}\n${combinedOutput}`
    );
    continue;
  }

  if (!combinedOutput.includes(fixtureCase.expectedOutput)) {
    failures.push(`${fixtureCase.id}: missing expected output "${fixtureCase.expectedOutput}"\n${combinedOutput}`);
  }
}

if (failures.length > 0) {
  console.error("Source organization fixture regression failures:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Source organization fixture regressions passed: ${fixtureCases.length} cases.`);
