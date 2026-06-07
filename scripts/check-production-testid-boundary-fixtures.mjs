import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const guardPath = path.join(repoRoot, "scripts", "check-production-testid-boundary.mjs");
const fixtureRoot = path.join(repoRoot, "scripts", "production-testid-boundary-fixtures");

const fixtureCases = [
  {
    id: "valid-assignments",
    root: "valid-assignments",
    expectedStatus: 0,
    expectedOutput: "Production data-testid boundary guard passed."
  },
  {
    id: "valid-excluded-tests-and-e2e",
    root: "valid-excluded-tests-and-e2e",
    sourceRoot: "apps/editor",
    expectedStatus: 0,
    expectedOutput: "Production data-testid boundary guard passed."
  },
  {
    id: "invalid-selector-string",
    root: "invalid-selector-string",
    expectedStatus: 1,
    expectedOutput: "[data-testid] selector string is forbidden"
  },
  {
    id: "invalid-attribute-readback",
    root: "invalid-attribute-readback",
    expectedStatus: 1,
    expectedOutput: "data-testid attribute readback is forbidden"
  },
  {
    id: "invalid-dataset-read",
    root: "invalid-dataset-read",
    expectedStatus: 1,
    expectedOutput: "dataset.testid read is forbidden"
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
      fixtureCase.sourceRoot ?? "apps/editor/src"
    ],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  const combinedOutput = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n");
  const status = result.status ?? 1;

  if (status !== fixtureCase.expectedStatus) {
    failures.push(
      `${fixtureCase.id}: expected exit ${fixtureCase.expectedStatus}, got ${status}\n${combinedOutput}`
    );
    continue;
  }

  if (!combinedOutput.includes(fixtureCase.expectedOutput)) {
    failures.push(`${fixtureCase.id}: missing expected output "${fixtureCase.expectedOutput}"\n${combinedOutput}`);
  }
}

if (failures.length > 0) {
  console.error("Production data-testid boundary fixture regression failures:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Production data-testid boundary fixture regressions passed: ${fixtureCases.length} cases.`);
