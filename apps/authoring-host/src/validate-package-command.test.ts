import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runAuthoringHostCommand } from "./run-authoring-host-command.js";
import { buildValidatePackageCommand } from "./test-support/command-builders.js";
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
  const root = await mkdtemp(join(tmpdir(), "authoring-host-validate-"));
  createdRoots.push(root);

  return {
    packageDirectory: join(root, "package"),
    stateDirectory: join(root, "state")
  };
};

const fixedNow = (): Date => new Date("2026-07-02T12:34:56.000Z");

describe("validatePackage through the headless host", () => {
  it("returns an ok response with a validation report for a healthy synthetic package", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeBinaryTextureFixturePackage(packageDirectory);

    const response = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildValidatePackageCommand({
        commandId: "cmd_validate_healthy",
        profile: "strict"
      })
    });

    expect(response.outcome).toBe("success");
    expect(response.aiCommandStatus).toBe("ok");
    expect(response.command).toBe("validatePackage");

    expect(response.aiCommandResponse).toBeDefined();
    const payload = response.aiCommandResponse!.payload as {
      readonly reportId: string;
      readonly report: {
        readonly reportId: string;
        readonly schemaVersion: string;
        readonly profile: string;
        readonly summary: { readonly status: string; readonly counts: Record<string, number> };
        readonly evidence: { readonly runtimeSnapshotIds: readonly string[]; readonly operationLogPresent: boolean };
        readonly checks: readonly unknown[];
      };
    };

    // The result's top-level reportId matches the report's own reportId.
    expect(payload.reportId).toBe(payload.report.reportId);
    expect(payload.report.schemaVersion).toBe("validation-report-v1");
    expect(payload.report.profile).toBe("strict");
    // A healthy package must have no error / blocking diagnostics.
    expect(payload.report.summary.counts.error).toBe(0);
    expect(payload.report.summary.counts.blocking).toBe(0);
    expect(payload.report.summary.status).not.toBe("fail");
    // The document-only validate path records that no runtime snapshot backed the report.
    expect(payload.report.evidence.runtimeSnapshotIds).toEqual([]);
    expect(payload.report.evidence.operationLogPresent).toBe(false);
  });

  it("validates without dry-running, committing, or writing to the package directory", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeSeedFixturePackage(packageDirectory);
    const before = await readNormalizedPackageSnapshot(packageDirectory);

    const response = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildValidatePackageCommand({
        commandId: "cmd_validate_no_side_effects",
        profile: "editorIncremental"
      })
    });

    expect(response.aiCommandStatus).toBe("ok");
    expect(response.saved).toBe(false);

    const after = await readNormalizedPackageSnapshot(packageDirectory);
    expect(after).toEqual(before);
  });

  it("returns permission_denied when the session lacks the validate capability", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeSeedFixturePackage(packageDirectory);

    const response = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildValidatePackageCommand({
        commandId: "cmd_validate_denied",
        profile: "strict",
        capabilities: ["read"]
      })
    });

    expect(response.aiCommandStatus).toBe("permission_denied");
    expect(response.command).toBe("validatePackage");
  });

  it("records the validatePackage response in the persisted transcript", async () => {
    const { packageDirectory, stateDirectory } = await createWorkspaceRoot();
    await writeSeedFixturePackage(packageDirectory);

    await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      now: fixedNow,
      command: buildValidatePackageCommand({
        commandId: "cmd_validate_transcript",
        profile: "strict"
      })
    });

    // The executor dispatches read commands through the shared read mechanism with the
    // executor's transcript, so the validate command is recorded and persisted to the
    // state directory's transcript file (proving the read path records like other paths).
    const transcriptText = await readFile(join(stateDirectory, "command-transcript.json"), "utf8");
    expect(transcriptText).toContain("validatePackage");
    expect(transcriptText).toContain("cmd_validate_transcript");
  });
});
