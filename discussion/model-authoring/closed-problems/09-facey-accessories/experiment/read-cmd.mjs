// Read-command helper: wraps renderView / inspectEvaluatedGeometry / validatePackage
// in the ai-command-request-v1 envelope and runs the authoring-host CLI.
//
// Usage: node read-cmd.mjs <request.json>
//   request.json = { command, payload }  (envelope added automatically)
// Full response saved as <request>.response.json; compact summary on stdout.

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, basename, join } from "node:path";

const REPO = "C:/workspace/remie/code/ai-native-live2d-editor";
const PACKAGE_DIR = "C:/workspace/remie/rigging/llm-rigging";
const STATE_DIR = "C:/workspace/remie/rigging/llm-rigging-state";

const CAPS = {
  validatePackage: ["read", "validate"],
  inspectEvaluatedGeometry: ["read", "validate"],
  renderView: ["render"]
};

const reqPath = resolve(process.argv[2]);
const req = JSON.parse(readFileSync(reqPath, "utf8"));

const envelope = {
  schemaVersion: "ai-command-request-v1",
  commandId: `cmd_${basename(reqPath, ".json")}_${Date.now()}`,
  session: { agentId: "agent_fable_cp04", capabilities: CAPS[req.command] ?? ["read"] },
  basis: { relatedAC: [], relatedScenarios: [] },
  command: req.command,
  payload: req.payload
};

const commandFile = join(dirname(reqPath), `${basename(reqPath, ".json")}.request.json`);
writeFileSync(commandFile, JSON.stringify(envelope, null, 2));
const result = spawnSync(
  "npx",
  ["-y", "tsx", "apps/authoring-host/src/cli.ts",
    "--package-dir", PACKAGE_DIR,
    "--state-dir", STATE_DIR,
    "--command-file", commandFile],
  { cwd: REPO, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 }
);
const responseFile = join(dirname(reqPath), `${basename(reqPath, ".json")}.response.json`);
writeFileSync(responseFile, result.stdout);
let parsed;
try { parsed = JSON.parse(result.stdout); } catch { parsed = undefined; }
if (parsed === undefined) {
  console.log(`UNPARSEABLE (exit ${result.status})`);
  console.log(result.stdout.slice(0, 2000));
  console.log(result.stderr.slice(0, 2000));
  process.exit(1);
}
console.log(JSON.stringify({ outcome: parsed.outcome, diagnostics: (parsed.diagnostics ?? []).length }));
if (parsed.outcome !== "success") {
  console.log(JSON.stringify(parsed.diagnostics ?? parsed, null, 1).slice(0, 3000));
  process.exit(2);
}
// Print payload summary keys for quick reading.
const p = parsed.payload ?? parsed.result ?? {};
console.log("payload keys:", Object.keys(p).join(","));
process.exit(0);
