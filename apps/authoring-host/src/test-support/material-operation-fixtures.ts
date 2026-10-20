import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { createOperationCore, serializeOperationLogEntriesToJsonl } from "@private-2d-rigging-lab/operation-core";
import { encodeRgba8ToPng } from "@private-2d-rigging-lab/render-software";

import { runAuthoringHostCli } from "../cli.js";
import type { AuthoringHostCommandResponse } from "../authoring-host-response.js";
import { loadAuthoringPackageDirectory, saveAuthoringPackageDirectory } from "../package-directory-io.js";
import { writeEyeSmokeFixturePackage } from "./authoring-host-fixtures.js";
import { HEADLESS_AGENT_ID } from "./command-builders.js";
import { registerTextureWithDimensions } from "./perception-fixtures.js";

// Test-only fixture tooling for the image operations (addDrawableFromImage / replaceDrawableImage) driven through the
// CLI. Everything is synthetic and lives under one OS temp root: <root>/package, <root>/state, <root>/images.

export const MATERIAL_FIXTURE_NOW = "2026-10-20T00:00:00.000Z";

export interface MaterialOperationFixtureIds {
  /** Top-most drawable (the eye mask): replacement target, so its new image is visible in renders. */
  readonly targetDrawableId: string;
  readonly targetMeshId: string;
  /** The eye, drawn below the target. */
  readonly otherDrawableId: string;
  readonly otherMeshId: string;
  readonly partId: string;
  readonly parameterId: string;
  /** Direct geometry key of the target: the only key a replacement of the target may (and must) declare. */
  readonly targetGeometryKeyformSetId: string;
  readonly targetOpacityKeyformSetId: string;
  readonly otherGeometryKeyformSetId: string;
}

export interface MaterialOperationFixture {
  readonly root: string;
  readonly packageDirectory: string;
  readonly stateDirectory: string;
  readonly imageDirectory: string;
  readonly ids: MaterialOperationFixtureIds;
  readonly packageRevision: number;
  /** Rest-stage bounds of the target mesh. */
  readonly targetBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/**
 * The eye smoke package with renderable textures whose size matches the source layer bounds, a parameter and three
 * single-key keyforms: target (eye mask) mesh vertices = its direct geometry key, target opacity (1, so renders stay
 * opaque), and the eye's mesh vertices.
 */
export const writeMaterialOperationFixture = async (): Promise<MaterialOperationFixture> => {
  const root = await mkdtemp(join(tmpdir(), "material-operation-"));
  const packageDirectory = join(root, "package"), stateDirectory = join(root, "state"), imageDirectory = join(root, "images");
  await mkdir(imageDirectory, { recursive: true });
  const smoke = await writeEyeSmokeFixturePackage(packageDirectory);
  const loaded = await loadAuthoringPackageDirectory(packageDirectory);
  const session = loaded.session;
  const meshOf = (meshId: string) => session.graph.meshes.find((mesh) => mesh.meshId === meshId)!;
  for (const drawableId of [smoke.ids.eyeDrawableId, smoke.ids.eyeMaskDrawableId]) {
    const drawable = session.graph.drawables.find((item) => item.drawableId === drawableId)!;
    const bounds = meshOf(drawable.meshId).bounds;
    registerTextureWithDimensions(session, drawable.textureId, { width: bounds.width, height: bounds.height });
    for (const asset of session.graph.sourceAssets) {
      for (const layer of asset.layers) if (layer.mappedDrawableIds.includes(drawable.drawableId)) layer.bounds = { ...bounds };
    }
  }
  const core = createOperationCore({ now: () => new Date(MATERIAL_FIXTURE_NOW), initialOperationLogEntries: loaded.operationLogEntries });
  const commit = (operationType: string, payload: unknown): void => {
    const outcome = core.commitOperation(session, { schemaVersion: "operation-request-v1", operationId: `op_material_fixture_${core.operationLog.entries.length}`,
      actor: "test", surface: "testFixture", dryRun: false, basePackageRevision: session.packageRevision, operationType, payload,
      trace: { relatedAC: [], relatedScenarios: [] } });
    if (outcome.result.status !== "committed") throw new Error(`${operationType}: ${JSON.stringify(outcome.result.diagnostics)}`);
  };
  const parameterId = "param_material_fixture";
  commit("createParameter", { parameterId, displayName: "Material Fixture", valueSource: "authoredInput", min: -1, max: 1, default: 0, recommendedUiStep: 0.1 });
  const shifted = (meshId: string) => meshOf(meshId).vertices.map((vertex) => ({ x: vertex.x + 0.5, y: vertex.y }));
  const addKey = (target: { kind: string; id: string }, property: string, value: unknown) => commit("addKeyform", { target, targetProperty: property,
    parameterId, keyValue: 1, interpolation: "linear-1d-v1", statePatch: { propertyPath: property, value } });
  addKey({ kind: "mesh", id: smoke.ids.eyeMaskMeshId }, "vertices", shifted(smoke.ids.eyeMaskMeshId));
  addKey({ kind: "drawable", id: smoke.ids.eyeMaskDrawableId }, "opacity", 1);
  addKey({ kind: "mesh", id: smoke.ids.eyeMeshId }, "vertices", shifted(smoke.ids.eyeMeshId));
  const keyOf = (kind: string, id: string, property: string) =>
    session.graph.keyformSets.find((key) => key.target.kind === kind && key.target.id === id && key.target.property === property)!.keyformSetId;
  await saveAuthoringPackageDirectory({ packageDirectory, session, baseDocument: loaded.packageDocument, workspaceMetadata: loaded.workspaceMetadata,
    updatedAt: MATERIAL_FIXTURE_NOW, operationLogText: serializeOperationLogEntriesToJsonl(core.operationLog.entries) });
  const target = session.graph.drawables.find((item) => item.drawableId === smoke.ids.eyeMaskDrawableId)!;
  return { root, packageDirectory, stateDirectory, imageDirectory, packageRevision: session.packageRevision, targetBounds: { ...meshOf(target.meshId).bounds },
    ids: { targetDrawableId: target.drawableId, targetMeshId: target.meshId, otherDrawableId: smoke.ids.eyeDrawableId, otherMeshId: smoke.ids.eyeMeshId,
      partId: target.partId, parameterId,
      targetGeometryKeyformSetId: keyOf("mesh", target.meshId, "vertices"),
      targetOpacityKeyformSetId: keyOf("drawable", target.drawableId, "opacity"),
      otherGeometryKeyformSetId: keyOf("mesh", smoke.ids.eyeMeshId, "vertices") } };
};

export interface MaterialTestImage {
  readonly imagePath: string;
  readonly rgbaSha256: string;
  readonly width: number;
  readonly height: number;
  readonly rgbaBytes: Uint8Array;
}

/** Writes an opaque single-color PNG and returns the reference facts a payload declares for it. */
export const writeMaterialTestPng = async (directory: string, name: string, color: readonly [number, number, number],
  size: { readonly width: number; readonly height: number } = { width: 4, height: 4 }): Promise<MaterialTestImage> => {
  const rgbaBytes = new Uint8Array(size.width * size.height * 4);
  for (let offset = 0; offset < rgbaBytes.length; offset += 4) rgbaBytes.set([...color, 255], offset);
  const imagePath = join(directory, `${name}.png`);
  await writeFile(imagePath, encodeRgba8ToPng(rgbaBytes, size.width, size.height));
  return { imagePath, rgbaSha256: createHash("sha256").update(rgbaBytes).digest("hex"), ...size, rgbaBytes };
};

export const imageFileRef = (image: MaterialTestImage) => ({ imagePath: image.imagePath, rgbaSha256: image.rgbaSha256, width: image.width, height: image.height });

export const operationRequest = (input: { operationType: string; operationId?: string; basePackageRevision: number; dryRun: boolean; payload: unknown }) => ({
  schemaVersion: "operation-request-v1",
  ...(input.operationId === undefined ? {} : { operationId: input.operationId }),
  actor: "ai", surface: "structuredApi", dryRun: input.dryRun, basePackageRevision: input.basePackageRevision,
  operationType: input.operationType, payload: input.payload, trace: { relatedAC: [], relatedScenarios: [] }
});

export const aiCommand = (commandId: string, command: string, payload: unknown, capabilities: readonly string[] = ["dryRunEdit", "commitWithApproval", "render", "read"]) => ({
  schemaVersion: "ai-command-request-v1", commandId, session: { agentId: HEADLESS_AGENT_ID, capabilities },
  basis: { relatedAC: [], relatedScenarios: [] }, command, payload
});

/** One CLI invocation with --command-file, exactly as an external caller runs it (each call reloads the package). */
export const runMaterialCli = async (fixture: MaterialOperationFixture, command: unknown): Promise<{ exitCode: number; response: AuthoringHostCommandResponse }> => {
  const commandFile = join(fixture.root, `command-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await writeFile(commandFile, JSON.stringify(command));
  let stdout = "";
  const result = await runAuthoringHostCli({ argv: ["--package-dir", fixture.packageDirectory, "--state-dir", fixture.stateDirectory, "--command-file", commandFile],
    readStdin: async () => "", writeStdout: (text) => { stdout += text; }, now: () => new Date(MATERIAL_FIXTURE_NOW) });
  const printed = JSON.parse(stdout) as AuthoringHostCommandResponse;
  if (printed.outcome !== result.response.outcome) throw new Error("CLI stdout and result disagree.");
  return { exitCode: result.exitCode, response: printed };
};

/** dry-run, then commit approved by that dry-run (the host auto-approves a clean dry-run). */
export const dryRunThenCommit = async (fixture: MaterialOperationFixture, input: { operationType: string; operationId?: string; basePackageRevision: number; payload: unknown; name: string }) => {
  const dryRunCommandId = `cmd_${input.name}_dry`;
  const dryRun = await runMaterialCli(fixture, aiCommand(dryRunCommandId, "dryRunOperation", operationRequest({ ...input, dryRun: true })));
  const commit = await runMaterialCli(fixture, aiCommand(`cmd_${input.name}_commit`, "commitOperation",
    { approvedDryRunCommandId: dryRunCommandId, operation: operationRequest({ ...input, dryRun: false }) }));
  return { dryRun, commit };
};

/** Every file under `directory` as relative path -> SHA-256, to prove a package did not change by a single byte. */
export const snapshotDirectory = async (directory: string): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  const visit = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else result[relative(directory, path).replaceAll("\\", "/")] = createHash("sha256").update(await readFile(path)).digest("hex");
    }
  };
  await visit(directory);
  return result;
};

/** Every path (files and directories) under `directory`, relative and sorted. */
export const listDirectoryTree = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { recursive: true });
  return entries.map((entry) => String(entry).replaceAll("\\", "/")).sort();
};
