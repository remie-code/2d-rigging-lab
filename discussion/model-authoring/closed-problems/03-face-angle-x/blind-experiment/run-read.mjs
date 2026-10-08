// Blind-experiment read-command runner: wraps a read command (renderView,
// inspectEvaluatedGeometry, validatePackage) in the ai-command-request-v1
// envelope and runs it through the authoring-host CLI.
//
// Usage: node run-read.mjs <command> <payload.json> [outLabel]
//   command = renderView | inspectEvaluatedGeometry | validatePackage
// Prints the parsed response JSON to stdout (compact summary + saves full).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join, basename } from "node:path";

const REPO = "C:/workspace/remie/code/ai-native-live2d-editor";
const PACKAGE_DIR = "C:/workspace/remie/rigging/llm-rigging";
const STATE_DIR = "C:/workspace/remie/rigging/llm-rigging-state";

const CAPS = {
  validatePackage: ["read", "validate"],
  inspectEvaluatedGeometry: ["read", "validate"],
  renderView: ["render"]
};

const command = process.argv[2];
const payloadPath = resolve(process.argv[3]);
const label = process.argv[4] ?? basename(payloadPath, ".json");
const payload = JSON.parse(readFileSync(payloadPath, "utf8"));

const envelope = {
  schemaVersion: "ai-command-request-v1",
  commandId: `cmd_read_${label}_${Date.now()}`,
  session: { agentId: "agent_fable_blind03", capabilities: CAPS[command] },
  basis: { relatedAC: [], relatedScenarios: [] },
  command,
  payload
};

const dir = dirname(payloadPath);
const commandFile = join(dir, `${label}.request.json`);
writeFileSync(commandFile, JSON.stringify(envelope, null, 2));

const result = spawnSync(
  "npx",
  ["-y", "tsx", "apps/authoring-host/src/cli.ts",
    "--package-dir", PACKAGE_DIR,
    "--state-dir", STATE_DIR,
    "--command-file", commandFile],
  { cwd: REPO, encoding: "utf8", shell: true, maxBuffer: 256 * 1024 * 1024 }
);

const responseFile = join(dir, `${label}.response.json`);
writeFileSync(responseFile, result.stdout);
let parsed;
try { parsed = JSON.parse(result.stdout); } catch {
  console.log(`UNPARSEABLE (exit ${result.status})`);
  console.log(result.stdout.slice(0, 3000));
  console.log(result.stderr.slice(0, 3000));
  process.exit(1);
}
console.log(JSON.stringify(parsed, null, 1).slice(0, 6000));
console.log(`--- full response: ${responseFile}`);
