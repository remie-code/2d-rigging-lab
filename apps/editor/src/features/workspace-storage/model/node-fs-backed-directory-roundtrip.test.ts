import {
  registerAuthoringSessionBinaryBytes,
  type AuthoringSession,
  type RegisterAuthoringSessionBinaryBytesInput
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createEmptyAuthoringSession } from "../../editor-session/model/empty-authoring-session";
import { NodeFsBackedDirectoryHandle } from "./node-fs-backed-directory-handle";
import { createInMemoryWorkspaceFsBridge } from "./node-fs-bridge-in-memory.test-support";
import {
  createEditorWorkspace,
  openEditorWorkspace,
  type WorkspaceDirectoryPicker
} from "./workspace-session-storage";

// Round-trip through the *unmodified* consumer (`workspace-session-storage.ts`):
// save with the node:fs-backed adapter, then open a fresh adapter over the same
// virtual filesystem and assert the recovered PackageDocument is identical.

const TEXTURE_PATH = "assets/textures/psd/test-layer.raw-rgba";
const TEXTURE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEXTURE_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];

function createAdapterPicker(
  bridge: ReturnType<typeof createInMemoryWorkspaceFsBridge>
): WorkspaceDirectoryPicker {
  return {
    pickDirectory: async () =>
      new NodeFsBackedDirectoryHandle(bridge, bridge.rootPath, "", bridge.name)
  };
}

describe("NodeFsBackedDirectoryHandle round-trip through the consumer", () => {
  it("saves and reopens an empty workspace with an identical PackageDocument", async () => {
    const bridge = createInMemoryWorkspaceFsBridge();
    const picker = createAdapterPicker(bridge);

    const created = await createEditorWorkspace({
      session: createEmptyAuthoringSession(),
      picker
    });
    const opened = await openEditorWorkspace({ picker });

    expect(bridge.readStoredText("workspace.json")).toContain(
      "directory-workspace-v1"
    );
    expect(opened.packageDocument).toEqual(created.packageDocument);
  });

  it("round-trips a texture workspace including binary hydration", async () => {
    const bridge = createInMemoryWorkspaceFsBridge();
    const picker = createAdapterPicker(bridge);

    const created = await createEditorWorkspace({
      session: createTextureSession(),
      picker
    });
    const opened = await openEditorWorkspace({ picker });

    expect(opened.packageDocument).toEqual(created.packageDocument);
    expect(opened.session.packageIdentity.packageDisplayName).toBe(
      "Workspace Storage Test"
    );
    expect(bridge.readStoredBytes(TEXTURE_PATH)).toEqual(TEXTURE_BYTES);
    expect(opened.session.binaryAssets?.fileEntries).toHaveLength(1);
    expect(
      Array.from(opened.session.binaryAssets?.fileEntries[0]?.bytes ?? [])
    ).toEqual([0x61, 0x62, 0x63]);
  });
});

function createTextureSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  const binaryAssetRef = createBinaryAssetReference();
  const partId = PartIdSchema.parse("part_workspace_texture");
  const drawableId = DrawableIdSchema.parse("draw_workspace_texture");
  const meshId = MeshIdSchema.parse("mesh_workspace_texture");

  session.packageIdentity.packageDisplayName = "Workspace Storage Test";
  session.packageRevision = 1;
  session.graph.parts[0] = {
    ...session.graph.parts[0]!,
    childPartIds: [partId],
    children: [{ kind: "part", partId }]
  };
  session.graph.parts.push({
    partId,
    displayName: "Texture Part",
    parentPartId: session.graph.parts[0]!.partId,
    childPartIds: [],
    drawableIds: [drawableId],
    children: [{ kind: "drawable", drawableId }]
  });
  session.graph.drawables.push({
    drawableId,
    displayName: "Texture Drawable",
    partId,
    sourceAssetId: SourceAssetIdSchema.parse("src_workspace_texture"),
    textureId: TextureIdSchema.parse("tex_workspace_texture"),
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: ProvenanceIdSchema.parse("prov_workspace_texture")
  });
  session.graph.meshes.push({
    meshId,
    drawableId,
    vertices: [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 0, y: 8 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    triangles: [[0, 1, 2]],
    vertexStableIds: ["vtx_workspace_0", "vtx_workspace_1", "vtx_workspace_2"],
    triangleStableIds: [TriangleIdSchema.parse("tri_workspace_0")],
    topologyRevision: 1,
    bounds: { x: 0, y: 0, width: 8, height: 8 },
    generationProvenanceId: ProvenanceIdSchema.parse("prov_workspace_texture")
  });
  session.graph.drawOrder.push({ drawableId, baseDrawOrder: 0, stableOrder: 0 });
  session.graph.stableOrder.push(partId, drawableId, meshId);
  session.graph.sourceAssets.push({
    sourceAssetId: SourceAssetIdSchema.parse("src_workspace_texture"),
    kind: "generated-fixture-v1",
    filePath: "assets/sources/workspace-texture.json",
    contentHash: "sha256:workspace-texture",
    importProfile: "split-png-fallback-v1",
    layers: [],
    diagnostics: []
  });
  session.graph.textureAtlas = {
    schemaVersion: "texture-atlas-v1",
    textures: [
      {
        textureId: TextureIdSchema.parse("tex_workspace_texture"),
        filePath: TEXTURE_PATH,
        sourceAssetId: SourceAssetIdSchema.parse("src_workspace_texture"),
        sourceLayerId: "layer_workspace_texture",
        provenanceId: ProvenanceIdSchema.parse("prov_workspace_texture"),
        binaryAssetRef
      }
    ]
  };
  session.graph.provenanceRecords.push({
    provenanceId: ProvenanceIdSchema.parse("prov_workspace_texture"),
    assetId: "tex_workspace_texture",
    assetKind: "texture",
    filePath: TEXTURE_PATH,
    contentHash: `sha256:${TEXTURE_BYTES_SHA256_HEX}`,
    creator: "test fixture",
    license: "private-local",
    redistributionAllowed: false,
    aiUsed: false,
    transformHistory: [],
    relatedOperationIds: []
  });
  session.graph.rightsRecords.push({
    assetId: "rights_workspace_texture",
    rightsStatus: "cleared",
    license: "private-local",
    redistributionAllowed: false
  });
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes: TEXTURE_BYTES,
    role: "texture-raster-v1",
    sourceAssetId: SourceAssetIdSchema.parse("src_workspace_texture"),
    textureId: TextureIdSchema.parse("tex_workspace_texture")
  });

  return session;
}

function createBinaryAssetReference(): BinaryAssetReference {
  return {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_workspace_texture",
    packageRelativePath: TEXTURE_PATH,
    digest: {
      algorithm: "sha256",
      hex: TEXTURE_BYTES_SHA256_HEX
    },
    byteLength: TEXTURE_BYTES.byteLength,
    mediaType: "image/png; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: ProvenanceIdSchema.parse("prov_workspace_texture"),
    rightsAssetId: "rights_workspace_texture"
  } as BinaryAssetReference;
}
