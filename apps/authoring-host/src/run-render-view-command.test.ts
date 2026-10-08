import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RenderViewResultSchema } from "@private-2d-rigging-lab/ai-interface";

import { runAuthoringHostCommand } from "./run-authoring-host-command.js";
import { writeEyeSmokeFixturePackage } from "./test-support/authoring-host-fixtures.js";
import { registerTextureWithDimensions } from "./test-support/perception-fixtures.js";
import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import { saveAuthoringPackageDirectory } from "./package-directory-io.js";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

/**
 * Writes the eye smoke fixture to disk, then re-loads it, sets authoritative
 * texture dimensions + matching bytes on both textures, and saves it back so the
 * on-disk package can be rendered by the CLI.
 */
const writeRenderablePackage = async (): Promise<{
  readonly packageDirectory: string;
  readonly stateDirectory: string;
}> => {
  const root = await mkdtemp(join(tmpdir(), "render-view-cli-"));
  createdRoots.push(root);
  const packageDirectory = join(root, "pkg");
  const stateDirectory = join(root, "state");

  const fixture = await writeEyeSmokeFixturePackage(packageDirectory);
  const loaded = await loadAuthoringPackageDirectory(packageDirectory);
  registerTextureWithDimensions(loaded.session, "tex_tutorial_eye", { width: 2, height: 2 });
  registerTextureWithDimensions(loaded.session, "tex_tutorial_eye_mask", {
    width: 2,
    height: 2
  });
  void fixture;

  await saveAuthoringPackageDirectory({
    packageDirectory,
    session: loaded.session,
    baseDocument: loaded.packageDocument,
    workspaceMetadata: loaded.workspaceMetadata,
    updatedAt: "2026-07-02T00:00:00.000Z",
    operationLogText: ""
  });

  return { packageDirectory, stateDirectory };
};

const renderViewCommand = (capabilities: readonly string[], outDir: string): unknown => ({
  schemaVersion: "ai-command-request-v1",
  commandId: "cmd_render_view",
  session: { agentId: "agent_test", capabilities },
  basis: { relatedAC: [], relatedScenarios: [] },
  command: "renderView",
  payload: { outDir, outputName: "rest" }
});

describe("runAuthoringHostCommand renderView", () => {
  it("denies renderView when the session lacks the render capability", async () => {
    const { packageDirectory, stateDirectory } = await writeRenderablePackage();
    const outDir = join(packageDirectory, "..", "out-denied");

    const response = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      command: renderViewCommand(["read"], outDir)
    });

    expect(response.outcome).toBe("rejected");
    expect(response.aiCommandStatus).toBe("permission_denied");
    // The package revision is unchanged and nothing is saved (non-mutating).
    expect(response.saved).toBe(false);
  });

  it("renders and writes a PNG + sidecar when the render capability is present", async () => {
    const { packageDirectory, stateDirectory } = await writeRenderablePackage();
    const outDir = join(packageDirectory, "..", "out-ok");

    const response = await runAuthoringHostCommand({
      packageDirectory,
      stateDirectory,
      command: renderViewCommand(["render"], outDir)
    });

    expect(response.outcome).toBe("success");
    expect(response.aiCommandStatus).toBe("ok");
    expect(response.saved).toBe(false);

    const payload = response.aiCommandResponse?.payload;
    const result = RenderViewResultSchema.parse(payload);
    const pngBytes = await readFile(result.pngPath);
    expect(pngBytes.byteLength).toBeGreaterThan(0);
    const sidecarText = await readFile(result.sidecarPath, "utf8");
    expect(JSON.parse(sidecarText).packageRevision).toBe(result.packageRevision);
  });
});
