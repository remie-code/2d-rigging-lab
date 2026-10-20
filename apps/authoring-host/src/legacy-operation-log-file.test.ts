import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import { runAuthoringHostCommand } from "./run-authoring-host-command.js";
import {
  buildCommitCommand,
  buildDryRunCommand,
  createParameterPayload
} from "./test-support/command-builders.js";
import { writeSeedFixturePackage } from "./test-support/authoring-host-fixtures.js";

// Packages saved before the operation record was dropped carry `operations/log.jsonl` and a manifest
// `operationLog` field. The host neither reads, writes nor deletes that file, and a save drops the field.
const LEGACY_LOG_PATH = ["operations", "log.jsonl"] as const;
// Not valid JSONL on purpose: opening the package must not parse it.
const LEGACY_LOG_BYTES = Buffer.from("{\"operationId\":\"op_legacy\"}\nnot json at all\n", "utf8");

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const createWorkspaceRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), "authoring-host-legacy-log-"));
  createdRoots.push(root);
  return { packageDirectory: join(root, "package"), stateDirectory: join(root, "state") };
};

const fixedNow = (): Date => new Date("2026-10-20T00:00:00.000Z");

const readManifest = async (packageDirectory: string): Promise<Record<string, unknown>> =>
  JSON.parse(await readFile(join(packageDirectory, "manifest.json"), "utf8")) as Record<string, unknown>;

const addLegacyOperationLog = async (packageDirectory: string): Promise<void> => {
  await mkdir(join(packageDirectory, LEGACY_LOG_PATH[0]), { recursive: true });
  await writeFile(join(packageDirectory, ...LEGACY_LOG_PATH), LEGACY_LOG_BYTES);
  const manifest = await readManifest(packageDirectory);
  await writeFile(
    join(packageDirectory, "manifest.json"),
    `${JSON.stringify({ ...manifest, operationLog: LEGACY_LOG_PATH.join("/") }, null, 2)}\n`
  );
};

const commitCreateParameter = async (packageDirectory: string, stateDirectory: string) => {
  const operation = {
    operationType: "createParameter",
    operationId: "op_create_history_param",
    basePackageRevision: 0,
    payload: createParameterPayload({
      parameterId: "param_history",
      displayName: "History",
      min: -1,
      max: 1,
      default: 0
    })
  };
  const dryRun = await runAuthoringHostCommand({
    packageDirectory,
    stateDirectory,
    now: fixedNow,
    command: buildDryRunCommand({ commandId: "cmd_history_dry", operation })
  });
  expect(dryRun.outcome).toBe("success");
  expect(dryRun.saved).toBe(false);

  return runAuthoringHostCommand({
    packageDirectory,
    stateDirectory,
    now: fixedNow,
    command: buildCommitCommand({
      commandId: "cmd_history_commit",
      approvedDryRunCommandId: "cmd_history_dry",
      operation
    })
  });
};

describe("packages with and without a legacy operation record file", () => {
  it("opens and commits a package that still has the record file and manifest field, leaving the file untouched", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeSeedFixturePackage(packageDirectory);
    await addLegacyOperationLog(packageDirectory);
    expect(await readManifest(packageDirectory)).toHaveProperty("operationLog");

    const loaded = await loadAuthoringPackageDirectory(packageDirectory);
    expect(loaded.packageDocument.manifest).not.toHaveProperty("operationLog");

    const commit = await commitCreateParameter(packageDirectory, stateDirectory);

    expect(commit.outcome).toBe("success");
    expect(commit.saved).toBe(true);
    expect(commit.packageRevision).toBe(1);
    expect(await readFile(join(packageDirectory, ...LEGACY_LOG_PATH))).toEqual(LEGACY_LOG_BYTES);
    expect(await readdir(join(packageDirectory, LEGACY_LOG_PATH[0]))).toEqual([LEGACY_LOG_PATH[1]]);
    const savedManifest = await readManifest(packageDirectory);
    expect(savedManifest).not.toHaveProperty("operationLog");
    expect(savedManifest.packageRevision).toBe(1);

    const reloaded = await loadAuthoringPackageDirectory(packageDirectory);
    expect(reloaded.session.graph.parameters.map((parameter) => parameter.parameterId)).toEqual(["param_history"]);
  }, 60_000);

  it("creates and commits a package without ever writing a record file", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeSeedFixturePackage(packageDirectory);
    expect(await readdir(packageDirectory)).not.toContain(LEGACY_LOG_PATH[0]);
    expect(await readManifest(packageDirectory)).not.toHaveProperty("operationLog");

    const commit = await commitCreateParameter(packageDirectory, stateDirectory);

    expect(commit.outcome).toBe("success");
    expect(commit.saved).toBe(true);
    expect(await readdir(packageDirectory)).not.toContain(LEGACY_LOG_PATH[0]);
    expect(await readManifest(packageDirectory)).not.toHaveProperty("operationLog");
  }, 60_000);
});
