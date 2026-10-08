import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 特区方向ルール検査（check-soul-zone-boundary.mjs）の fixture 回帰自己テスト。
 * 「違反 fixture で赤くなる / valid fixture で緑」を機械で固定する（wave plan §8 / §10
 * blocking 観点「方向ルール検査の実効」）。既存 check-source-organization-fixtures.mjs と
 * 同じ流儀: ガードを `--root <fixtureRoot>` で fixture へ向け、exit code と出力を照合する。
 */

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..");
const guardPath = path.join(repoRoot, "scripts", "check-soul-zone-boundary.mjs");
const fixtureRoot = path.join(repoRoot, "scripts", "soul-zone-boundary-fixtures");

const fixtureCases = [
  {
    id: "valid",
    root: "valid",
    expectedStatus: 0,
    expectedOutput: "Soul zone boundary guard passed"
  },
  {
    id: "invalid-vessel-imports-soul",
    root: "invalid-vessel-imports-soul",
    expectedStatus: 1,
    expectedOutput: "器のコードが特区 apps/soul を import"
  },
  {
    id: "invalid-soul-imports-vessel",
    root: "invalid-soul-imports-vessel",
    expectedStatus: 1,
    expectedOutput: "特区 apps/soul が器のコードを import"
  },
  {
    // 多行 import（prettier 折り返し）でも器→魂を捕捉する（Lane2 blocking の回帰固定）。
    id: "invalid-vessel-imports-soul-multiline",
    root: "invalid-vessel-imports-soul-multiline",
    expectedStatus: 1,
    expectedOutput: "器のコードが特区 apps/soul を import"
  },
  {
    // 多行 import（prettier 折り返し）でも魂→器コードを捕捉する（Lane2 blocking の回帰固定）。
    id: "invalid-soul-imports-vessel-multiline",
    root: "invalid-soul-imports-vessel-multiline",
    expectedStatus: 1,
    expectedOutput: "特区 apps/soul が器のコードを import"
  }
];

const failures = [];

for (const fixtureCase of fixtureCases) {
  const result = spawnSync(
    process.execPath,
    [guardPath, "--root", path.join(fixtureRoot, fixtureCase.root)],
    { cwd: repoRoot, encoding: "utf8" }
  );

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  const status = result.status ?? 1;

  if (status !== fixtureCase.expectedStatus) {
    failures.push(
      `${fixtureCase.id}: expected exit ${fixtureCase.expectedStatus}, got ${status}\n${combinedOutput}`
    );
    continue;
  }

  if (!combinedOutput.includes(fixtureCase.expectedOutput)) {
    failures.push(
      `${fixtureCase.id}: missing expected output "${fixtureCase.expectedOutput}"\n${combinedOutput}`
    );
  }
}

if (failures.length > 0) {
  console.error("Soul zone boundary fixture regression failures:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Soul zone boundary fixture regressions passed: ${fixtureCases.length} cases.`
);
