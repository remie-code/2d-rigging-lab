import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const checkDependenciesScript = path.join(repoRoot, "scripts", "check-dependencies.mjs");

const testCases = [
  {
    name: "forbidden dependency name",
    expectedStatus: 1,
    expectedOutput: "cubism-runtime",
    files: {
      "package.json": JSON.stringify(
        {
          dependencies: {
            "@vendor/cubism-runtime": "1.0.0"
          }
        },
        null,
        2
      )
    }
  },
  {
    name: "forbidden lockfile mention",
    expectedStatus: 1,
    expectedOutput: "lockfile mentions forbidden dependency class",
    files: {
      "pnpm-lock.yaml": "packages:\n  /live2d-runtime@1.0.0:\n    resolution: {}\n"
    }
  },
  {
    name: "forbidden asset path",
    expectedStatus: 1,
    expectedOutput: "Cubism model descriptor",
    files: {
      "assets/avatar.model3.json": "{}\n"
    }
  },
  {
    name: "positive forbidden non-goal claim",
    expectedStatus: 1,
    expectedOutput: "positive forbidden non-goal claim",
    files: {
      "claim.md": "Cubism compatibility is implemented and available in this package.\n"
    }
  },
  {
    name: "negative assertion allowed",
    expectedStatus: 0,
    files: {
      "claim.md": "The guard asserts that Cubism compatibility is not implemented and must not be claimed.\n"
    }
  },
  {
    name: "non-goal documentation allowed",
    expectedStatus: 0,
    files: {
      "claim.md": "Non-goal documentation: File System Access API available claims remain unsupported.\n"
    }
  },
  {
    name: "fixture false flag allowed",
    expectedStatus: 0,
    files: {
      "fixture.json": JSON.stringify(
        {
          cubismSupportAvailable: false,
          fileSystemAccessApiAvailable: false
        },
        null,
        2
      )
    }
  }
];

const writeCaseFiles = async (caseRoot, files) => {
  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = path.join(caseRoot, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }
};

const runGuard = (caseRoot) =>
  spawnSync(process.execPath, [checkDependenciesScript], {
    cwd: caseRoot,
    encoding: "utf8"
  });

const failures = [];
const tempRoot = await mkdtemp(path.join(tmpdir(), "check-dependencies-guard-"));

try {
  for (const testCase of testCases) {
    const caseRoot = path.join(tempRoot, testCase.name.replaceAll(" ", "-"));
    await writeCaseFiles(caseRoot, testCase.files);

    const result = runGuard(caseRoot);
    const output = `${result.stdout}${result.stderr}`;
    const status = result.status ?? 1;

    if (status !== testCase.expectedStatus) {
      failures.push(
        `${testCase.name}: expected exit ${testCase.expectedStatus}, got ${status}\n${output.trim()}`
      );
      continue;
    }

    if (testCase.expectedOutput && !output.includes(testCase.expectedOutput)) {
      failures.push(`${testCase.name}: output did not include "${testCase.expectedOutput}"\n${output.trim()}`);
    }
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error("Dependency guard self-test failures:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Dependency guard self-test passed: ${testCases.length} cases.`);
