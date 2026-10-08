import { RigControlSchema } from "@private-2d-rigging-lab/package-format";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createAuthoringWorkspaceSavePlan } from "@private-2d-rigging-lab/authoring-core";
import { createMaterialImageFixture, MaterialIntentSchema, type MaterialCandidate } from "@private-2d-rigging-lab/contracts";
import { AiMaterialCommandResultSchema } from "@private-2d-rigging-lab/ai-interface";
import { encodeRgba8ToPng } from "@private-2d-rigging-lab/render-software";
import { createEmptyParameterPerceptionFixture, createPerceptionFixture } from "./test-support/perception-fixtures.js";
import { writeMaterialFiles } from "./material-package-transaction.js";
import { runAuthoringHostCommand } from "./run-authoring-host-command.js";
import { loadMaterialCandidate } from "./material-candidate-store.js";
export const materialEnvelope = (command: string, payload: unknown, capabilities = ["read", "render", "commitWithApproval"]) => ({ schemaVersion: "ai-command-request-v1", commandId: `cmd_${randomUUID()}`, session: { agentId: "material_test", capabilities }, command, payload });
export const materialFixture = async (kind: "add" | "replace" = "replace", shared = false) => {
  const artifactsRoot = resolve(process.env.MATERIAL_WAVE2_ARTIFACTS ?? "llm-workspace/material-interface-wave-2/implementation");
  await mkdir(artifactsRoot, { recursive: true }); const root = await mkdtemp(join(artifactsRoot, `${kind}-`));
  const packageDirectory = join(root, "package"), stateDirectory = join(root, "state");
  const { session, ids } = shared ? createPerceptionFixture() : createEmptyParameterPerceptionFixture();
  if (shared) { session.graph.rigControls.push(RigControlSchema.parse({ rigControlId: "rig_shared", kind: "rotation2d", displayName: "Shared", childDrawableIds: [ids.eyeDrawableId, ids.eyeMaskDrawableId], childRigControlIds: [], pivot: { x: 12, y: 12 }, restAngleDegrees: 0, restTranslation: { x: 0, y: 0 }, restScale: { x: 1, y: 1 }, enabled: true })); session.graph.rigControlRootIds.push("rig_shared" as never); }
  session.graph.masks = [];
  // The perception-only seed uses illustrative PNG paths alongside real raw binary refs.
  // This saved-package fixture needs the normal owner/index paths to agree.
  for (const texture of session.graph.textureAtlas?.textures ?? []) {
    if (texture.binaryAssetRef) texture.filePath = texture.binaryAssetRef.packageRelativePath;
  }
  for (const [index, drawable] of session.graph.drawables.entries()) {
    const mesh = session.graph.meshes.find(m => m.meshId === drawable.meshId)!;
    const x = 12 + index * 6, y = 12;
    mesh.vertices = [{ x, y }, { x: x + 4, y }, { x: x + 4, y: y + 4 }, { x, y: y + 4 }];
    mesh.uvs = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]; mesh.triangles = [[0, 1, 2], [0, 2, 3]]; mesh.vertexStableIds = ["v0", "v1", "v2", "v3"]; mesh.bounds = { x, y, width: 4, height: 4 };
    for (const asset of session.graph.sourceAssets) for (const layer of asset.layers) if (layer.mappedDrawableIds.includes(drawable.drawableId)) layer.bounds = { ...mesh.bounds };
  }
  const plan = await createAuthoringWorkspaceSavePlan({ session, updatedAt: "2026-09-26T00:00:00.000Z" });
  await writeMaterialFiles(packageDirectory, [...plan.savePlan.workspaceTextFileSet.map(f => ({ path: f.path, bytes: Buffer.from(f.text) })),
    ...plan.savePlan.binaryDecisions.flatMap(d => d.action === "write" ? [d.binaryEntry] : []), { path: plan.packageDocument.manifest.operationLog, bytes: new Uint8Array() }]);
  const fixture = createMaterialImageFixture("wide"), imagePath = join(root, "image.png");
  await writeFile(imagePath, encodeRgba8ToPng(fixture.image.rgbaBytes, fixture.image.descriptor.width, fixture.image.descriptor.height));
  const drawableId = kind === "replace" ? ids.eyeDrawableId : "draw_material_added";
  const intent = MaterialIntentSchema.parse(kind === "replace" ? { kind, drawableId, preserveLogicalDrawableId: true, geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds: [] }, preserveExistingDeformers: true, sharedControlPolicy: "reject-shared-control-key-parameter-deletion" } :
    { kind, drawableId, displayName: "Added synthetic", parentPartId: session.graph.drawables[0]!.partId, insertion: { position: "last" }, rigControlIds: [], maskBindings: [], runtimeVisibility: true, defaultOpacity: 1 });
  const viewport = { stageRect: { space: "rest-stage-canvas-y-down-v1", x: 4, y: 4, width: 32, height: 32 }, outputWidth: 128, outputHeight: 128 };
  const invoke = (command: string, payload: unknown) => runAuthoringHostCommand({ packageDirectory, stateDirectory, command: materialEnvelope(command, payload), now: () => new Date("2026-09-26T00:00:00.000Z") });
  const call = async (command: string, payload: unknown) => {
    const response = await invoke(command, payload);
    if (response.outcome !== "success") throw new Error(JSON.stringify(response));
    return AiMaterialCommandResultSchema.parse(response.aiCommandResponse?.payload);
  };
  const register = async (requestedIntent = intent) => (await call("registerMaterialCandidate", { imagePath, placement: fixture.placement, intent: requestedIntent, provenanceNote: "Self-created synthetic test image", restPose: { kind: "undeformed-rest", coordinateSystem: "canvas-y-down-v1", keyedDeformation: false, dynamics: false } })).result!.candidate!;
  const next = async (command: string, c: MaterialCandidate, other = {}) => (await call(command, { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision, ...other })).result!.candidate!;
  const load = (c: MaterialCandidate) => loadMaterialCandidate({ store: { basePackageDirectory: packageDirectory, storeDirectory: join(stateDirectory, "material-candidates") }, candidateId: c.candidateId });
  const edit = async (c: MaterialCandidate, operationType: string, payload: unknown) => next("editMaterialCandidate", c, { operation: { schemaVersion: "operation-request-v1", operationId: `op_${randomUUID().replaceAll("-", "")}`, actor: "ai", surface: "structuredApi", dryRun: false, basePackageRevision: (await load(c)).workingPackage!.session.packageRevision, operationType, payload } });
  return { root, packageDirectory, stateDirectory, session, ids, intent, imagePath, viewport, drawableId, call, invoke, register, next, load, edit };
};
