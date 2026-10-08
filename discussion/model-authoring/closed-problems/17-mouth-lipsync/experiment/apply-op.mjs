// Closed-problem-01 experiment runner: dry-run → (auto-approve) → commit through the
// authoring-host CLI, as two separate one-shot processes sharing the state directory.
//
// Usage: node apply-op.mjs <op-spec.json>
//   op-spec.json = { operationId, operationType, basePackageRevision, payload }
// Prints a compact result summary to stdout; full responses land next to the spec
// as <spec>.dryrun-response.json / <spec>.commit-response.json.

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, basename, join } from "node:path";

const REPO = "C:/workspace/remie/code/ai-native-live2d-editor";
const PACKAGE_DIR = "C:/workspace/remie/rigging/llm-rigging";
const STATE_DIR = "C:/workspace/remie/rigging/llm-rigging-state";

const specPath = resolve(process.argv[2]);
const spec = JSON.parse(readFileSync(specPath, "utf8"));

const envelope = (command, commandId, payload) => ({
  schemaVersion: "ai-command-request-v1",
  commandId,
  session: { agentId: "agent_fable_cp01", capabilities: ["dryRunEdit", "commitWithApproval"] },
  basis: { relatedAC: [], relatedScenarios: [] },
  command,
  payload
});

const operationRequest = (dryRun) => ({
  schemaVersion: "operation-request-v1",
  operationId: spec.operationId,
  actor: "ai",
  surface: "structuredApi",
  dryRun,
  basePackageRevision: spec.basePackageRevision,
  operationType: spec.operationType,
  payload: spec.payload,
  trace: { relatedAC: [], relatedScenarios: [] }
});

const runCli = (command, label) => {
  const commandFile = join(dirname(specPath), `${basename(specPath, ".json")}.${label}-request.json`);
  writeFileSync(commandFile, JSON.stringify(command, null, 2));
  const result = spawnSync(
    "npx",
    ["-y", "tsx", "apps/authoring-host/src/cli.ts",
      "--package-dir", PACKAGE_DIR,
      "--state-dir", STATE_DIR,
      "--command-file", commandFile],
    { cwd: REPO, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 }
  );
  const responseFile = join(dirname(specPath), `${basename(specPath, ".json")}.${label}-response.json`);
  writeFileSync(responseFile, result.stdout);
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { parsed = undefined; }
  if (parsed === undefined) {
    console.log(`${label}: UNPARSEABLE (exit ${result.status})`);
    console.log(result.stdout.slice(0, 2000));
    console.log(result.stderr.slice(0, 2000));
    process.exit(1);
  }
  return { exit: result.status, response: parsed };
};

const dryRunId = `cmd_${spec.operationId}_dry`;
const dry = runCli(envelope("dryRunOperation", dryRunId, operationRequest(true)), "dryrun");
const dryInfo = {
  outcome: dry.response.outcome,
  autoApproval: dry.response.autoApproval,
  diagnostics: (dry.response.diagnostics ?? []).length
};
console.log(`dryrun: ${JSON.stringify(dryInfo)}`);
if (dry.response.outcome !== "success" || dry.response.autoApproval?.autoApproved !== true) {
  console.log("STOP: dry-run not auto-approved; full response saved.");
  const diags = dry.response.aiCommandResponse?.diagnostics ?? dry.response.diagnostics ?? [];
  console.log(JSON.stringify(diags, null, 1).slice(0, 3000));
  process.exit(2);
}

const commit = runCli(
  envelope("commitOperation", `cmd_${spec.operationId}_commit`, {
    approvedDryRunCommandId: dryRunId,
    operation: operationRequest(false)
  }),
  "commit"
);
console.log(`commit: ${JSON.stringify({
  outcome: commit.response.outcome,
  saved: commit.response.saved,
  packageRevision: commit.response.packageRevision
})}`);
process.exit(commit.response.outcome === "success" && commit.response.saved === true ? 0 : 3);
