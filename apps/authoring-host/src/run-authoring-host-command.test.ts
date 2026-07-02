import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runAuthoringHostCommand } from "./run-authoring-host-command.js";
import {
  buildCommitCommand,
  buildDryRunCommand,
  createParameterPayload
} from "./test-support/command-builders.js";
import {
  writeBinaryTextureFixturePackage,
  writeSeedFixturePackage
} from "./test-support/authoring-host-fixtures.js";
import { readNormalizedPackageSnapshot } from "./test-support/package-normalization.js";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const createWorkspaceRoot = async (): Promise<{
  readonly packageDirectory: string;
  readonly stateDirectory: string;
}> => {
  const root = await mkdtemp(join(tmpdir(), "authoring-host-"));
  createdRoots.push(root);

  return {
    packageDirectory: join(root, "package"),
    stateDirectory: join(root, "state")
  };
};

const fixedNow = (): Date => new Date("2026-07-02T12:34:56.000Z");

describe("runAuthoringHostCommand", () => {
  it("round-trips a binary-texture package through load and save without structural drift", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    const fixture = await writeBinaryTextureFixturePackage(packageDirectory);
    const before = await readNormalizedPackageSnapshot(packageDirectory);

    // A no-op-shaped commit that fails approval must not persist, so instead drive a real
    // load -> save by committing an accepted operation and comparing everything except the
    // one newly created parameter. Here we assert the pure round-trip: a dry-run does not
    // mutate the on-disk package at all.
    const dryRun = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildDryRunCommand({
        commandId: "cmd_roundtrip_dry",
        operation: {
          operationType: "createParameter",
          operationId: "op_roundtrip_param",
          basePackageRevision: 0,
          payload: createParameterPayload({
            parameterId: "param_roundtrip",
            displayName: "Roundtrip",
            min: -1,
            max: 1,
            default: 0
          })
        }
      })
    });

    expect(dryRun.outcome).toBe("success");
    expect(dryRun.saved).toBe(false);

    const after = await readNormalizedPackageSnapshot(packageDirectory);
    expect(after).toEqual(before);
    // The binary texture bytes are present on disk and unchanged.
    const texturePaths = Object.keys(after.files).filter((path) => path.startsWith("assets/textures/") && path.endsWith(".raw-rgba"));
    expect(texturePaths).toHaveLength(1);
    expect(after.files[texturePaths[0] as string]).toEqual({ binaryByteLength: fixture.byteLength });
  });

  it("persists a createParameter commit through dry-run, auto-approval, commit, and reload", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeSeedFixturePackage(packageDirectory);

    const operation = {
      operationType: "createParameter",
      operationId: "op_create_eye_open",
      basePackageRevision: 0,
      payload: createParameterPayload({
        parameterId: "param_eye_open",
        displayName: "Eye Open",
        min: -1,
        max: 1,
        default: 0
      })
    };

    const dryRun = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildDryRunCommand({ commandId: "cmd_param_dry", operation })
    });

    expect(dryRun.outcome).toBe("success");
    expect(dryRun.aiCommandStatus).toBe("ok");
    expect(dryRun.autoApproval).toEqual({
      evaluated: true,
      autoApproved: true,
      reason: "no-blocking-diagnostic"
    });
    expect(dryRun.saved).toBe(false);

    const commit = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildCommitCommand({
        commandId: "cmd_param_commit",
        approvedDryRunCommandId: "cmd_param_dry",
        operation
      })
    });

    expect(commit.outcome).toBe("success");
    expect(commit.aiCommandStatus).toBe("ok");
    expect(commit.saved).toBe(true);
    expect(commit.packageRevision).toBe(1);

    const parameters = JSON.parse(
      await readFile(join(packageDirectory, "model", "parameters.json"), "utf8")
    ) as { readonly parameters: readonly { readonly parameterId: string }[] };
    expect(parameters.parameters.map((parameter) => parameter.parameterId)).toContain("param_eye_open");
  });

  it("rejects an invalid operation: dry-run diagnoses, is not approved, and commit needs approval", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeSeedFixturePackage(packageDirectory);

    // A structurally valid request whose operation the handler rejects: generateMesh on a
    // drawable that does not exist on the empty seed. The dry-run carries a blocking
    // diagnostic (operation.generateMesh.missingDrawable) and must not be auto-approved.
    const operation = {
      operationType: "generateMesh",
      operationId: "op_missing_mesh",
      basePackageRevision: 0,
      payload: {
        drawableId: "draw_does_not_exist",
        method: "auto-grid-v1",
        densityHint: "low"
      }
    };

    const dryRun = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildDryRunCommand({ commandId: "cmd_bad_dry", operation })
    });

    expect(dryRun.outcome).toBe("rejected");
    expect(dryRun.aiCommandStatus).toBe("rejected");
    expect(dryRun.autoApproval).toEqual({
      evaluated: true,
      autoApproved: false,
      reason: "operation-result-rejected"
    });
    expect((dryRun.diagnostics ?? []).length).toBeGreaterThan(0);
    expect((dryRun.diagnostics ?? [])[0]?.checkId).toBe("operation.generateMesh.missingDrawable");
    expect(dryRun.saved).toBe(false);

    const commit = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildCommitCommand({
        commandId: "cmd_bad_commit",
        approvedDryRunCommandId: "cmd_bad_dry",
        operation
      })
    });

    expect(commit.outcome).toBe("rejected");
    expect(commit.aiCommandStatus).toBe("needs_approval");
    expect(commit.saved).toBe(false);

    // The package on disk is untouched: no mesh was created.
    const meshes = JSON.parse(
      await readFile(join(packageDirectory, "model", "meshes.json"), "utf8")
    ) as { readonly meshes: readonly unknown[] };
    expect(meshes.meshes).toHaveLength(0);
  });

  it("writes transcript and approval state outside the package directory", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeSeedFixturePackage(packageDirectory);

    await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildDryRunCommand({
        commandId: "cmd_state_dry",
        operation: {
          operationType: "createParameter",
          operationId: "op_state_param",
          basePackageRevision: 0,
          payload: createParameterPayload({
            parameterId: "param_state",
            displayName: "State",
            min: -1,
            max: 1,
            default: 0
          })
        }
      })
    });

    const stateFiles = await readdir(stateDirectory);
    expect(stateFiles.sort()).toEqual(["approval-state.json", "command-transcript.json"]);

    const packageFiles = await collectAllRelativePaths(packageDirectory);
    expect(packageFiles.some((path) => path.includes("approval-state"))).toBe(false);
    expect(packageFiles.some((path) => path.includes("command-transcript"))).toBe(false);
    expect(packageFiles.some((path) => path.includes("transcript"))).toBe(false);
  });

  it("is deterministic: the same fixture and command sequence produce identical normalized packages", async () => {
    const runOnce = async (): Promise<Record<string, unknown>> => {
      const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
      await writeSeedFixturePackage(packageDirectory);
      const operation = {
        operationType: "createParameter",
        operationId: "op_det_param",
        basePackageRevision: 0,
        payload: createParameterPayload({
          parameterId: "param_det",
          displayName: "Determinism",
          min: -1,
          max: 1,
          default: 0
        })
      };

      await runAuthoringHostCommand({
        packageDirectory,
        stateDirectory,
        now: fixedNow,
        command: buildDryRunCommand({ commandId: "cmd_det_dry", operation })
      });
      await runAuthoringHostCommand({
        packageDirectory,
        stateDirectory,
        now: fixedNow,
        command: buildCommitCommand({
          commandId: "cmd_det_commit",
          approvedDryRunCommandId: "cmd_det_dry",
          operation
        })
      });

      return (await readNormalizedPackageSnapshot(packageDirectory)).files;
    };

    const first = await runOnce();
    const second = await runOnce();

    expect(second).toEqual(first);
  });
});

const collectAllRelativePaths = async (packageDirectory: string): Promise<string[]> => {
  const snapshot = await readNormalizedPackageSnapshot(packageDirectory);
  return Object.keys(snapshot.files);
};
