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
import { createFakeWorkspaceDirectoryHandle } from "./fake-workspace-directory";
import {
  detectWorkspaceDirectoryAccess,
  writeWorkspaceTextEntries,
  type WorkspaceDirectoryHandleLike
} from "./workspace-directory-io";
import {
  createEditorWorkspace,
  openEditorWorkspace,
  saveEditorWorkspace,
  saveEditorWorkspaceAs
} from "./workspace-session-storage";

const TEXTURE_PATH = "assets/textures/psd/test-layer.raw-rgba";
const TEXTURE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEXTURE_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const SOURCE_ORIGINAL_PATH = "assets/sources/originals/workspace-source.psd";
const SOURCE_ORIGINAL_BYTES_SHA256_HEX =
  "1111111111111111111111111111111111111111111111111111111111111111";
type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];

describe("workspace session storage", () => {
  it("creates, opens, and hydrates a fake directory workspace roundtrip", async () => {
    const directory = createFakeWorkspaceDirectoryHandle({ name: "roundtrip.ail2d-workspace" });
    const session = createTextureSession();

    const created = await createEditorWorkspace({
      session,
      picker: { pickDirectory: async () => directory }
    });
    const opened = await openEditorWorkspace({
      picker: { pickDirectory: async () => directory }
    });

    expect(created.target.workspaceName).toBe("roundtrip.ail2d-workspace");
    expect(directory.readTextFile("workspace.json")).toContain("directory-workspace-v1");
    expect(directory.readTextFile("manifest.json")).toContain("Workspace Storage Test");
    expect(opened.session.packageIdentity.packageDisplayName).toBe("Workspace Storage Test");
    expect(opened.session.binaryAssets?.fileEntries).toHaveLength(1);
    expect(Array.from(opened.session.binaryAssets?.fileEntries[0]?.bytes ?? [])).toEqual([
      0x61,
      0x62,
      0x63
    ]);
  });

  it("reports unsupported File System Access capability", () => {
    expect(detectWorkspaceDirectoryAccess({}).supported).toBe(false);
    expect(
      detectWorkspaceDirectoryAccess({
        showDirectoryPicker: async () => createFakeWorkspaceDirectoryHandle()
      }).supported
    ).toBe(true);
  });

  it("reports permission denied and permission lost errors", async () => {
    const deniedDirectory = createFakeWorkspaceDirectoryHandle({
      permissionState: "denied"
    });

    await expect(
      saveEditorWorkspace({
        target: { directory: deniedDirectory, workspaceName: deniedDirectory.name },
        session: createEmptyAuthoringSession()
      })
    ).rejects.toMatchObject({ code: "permission-denied" });

    const lostDirectory = createPermissionLostOnWriteDirectory();
    await expect(
      saveEditorWorkspace({
        target: { directory: lostDirectory, workspaceName: lostDirectory.name },
        session: createEmptyAuthoringSession()
      })
    ).rejects.toMatchObject({ code: "permission-lost" });
  });

  it("writes Save As to a new workspace file-set", async () => {
    const firstDirectory = createFakeWorkspaceDirectoryHandle({ name: "first.ail2d-workspace" });
    const secondDirectory = createFakeWorkspaceDirectoryHandle({ name: "second.ail2d-workspace" });
    const session = createTextureSession();

    await createEditorWorkspace({
      session,
      picker: { pickDirectory: async () => firstDirectory }
    });
    const savedAs = await saveEditorWorkspaceAs({
      session,
      picker: { pickDirectory: async () => secondDirectory }
    });

    expect(savedAs.target.workspaceName).toBe("second.ail2d-workspace");
    expect(firstDirectory.readTextFile("workspace.json")).toContain("directory-workspace-v1");
    expect(secondDirectory.readTextFile("workspace.json")).toContain("directory-workspace-v1");
    expect(secondDirectory.readBinaryFile(TEXTURE_PATH)).toEqual(TEXTURE_BYTES);
  });

  it("creates safe nested paths and rejects traversal", async () => {
    const directory = createFakeWorkspaceDirectoryHandle();

    await writeWorkspaceTextEntries({
      directory,
      entries: [{ path: "model/nested/editor-state.json", text: "{}" }]
    });

    expect(directory.readTextFile("model/nested/editor-state.json")).toBe("{}");
    await expect(
      writeWorkspaceTextEntries({
        directory,
        entries: [{ path: "../outside.json", text: "{}" }]
      })
    ).rejects.toMatchObject({ code: "path-traversal" });
  });

  it("does not rewrite verified binary bytes during a JSON-only dirty save", async () => {
    const directory = createFakeWorkspaceDirectoryHandle();
    const session = createTextureSession();
    const created = await createEditorWorkspace({
      session,
      picker: { pickDirectory: async () => directory }
    });

    const writeCountAfterCreate = directory.getWriteCount(TEXTURE_PATH);
    const dirtySession = structuredClone(created.session);
    dirtySession.dirty = true;
    dirtySession.graph.parts[0] = {
      ...dirtySession.graph.parts[0]!,
      displayName: "Renamed Root"
    };

    const saved = await saveEditorWorkspace({
      target: created.target,
      session: dirtySession,
      baseDocument: created.packageDocument
    });

    expect(saved.binarySkipCount).toBe(1);
    expect(saved.binaryWriteCount).toBe(0);
    expect(directory.getWriteCount(TEXTURE_PATH)).toBe(writeCountAfterCreate);
  });

  it("rewrites a digest-mismatched workspace binary from verified session bytes", async () => {
    const directory = createFakeWorkspaceDirectoryHandle();
    const session = createTextureSession();
    const created = await createEditorWorkspace({
      session,
      picker: { pickDirectory: async () => directory }
    });
    directory.setBinaryFile(TEXTURE_PATH, new Uint8Array([0x62, 0x61, 0x64]));

    const saved = await saveEditorWorkspace({
      target: created.target,
      session: created.session,
      baseDocument: created.packageDocument
    });

    expect(saved.binaryWriteCount).toBe(1);
    expect(directory.readBinaryFile(TEXTURE_PATH)).toEqual(TEXTURE_BYTES);
  });

  it("rejects opening a workspace with a missing referenced binary", async () => {
    const directory = createFakeWorkspaceDirectoryHandle();
    await createEditorWorkspace({
      session: createTextureSession(),
      picker: { pickDirectory: async () => directory }
    });

    expect(directory.deleteFile(TEXTURE_PATH)).toBe(true);

    await expect(
      openEditorWorkspace({
        picker: { pickDirectory: async () => directory }
      })
    ).rejects.toMatchObject({
      code: "workspace.binary.missing",
      path: TEXTURE_PATH
    });
  });

  it("rejects opening a workspace with digest-mismatched referenced binary bytes", async () => {
    const directory = createFakeWorkspaceDirectoryHandle();
    await createEditorWorkspace({
      session: createTextureSession(),
      picker: { pickDirectory: async () => directory }
    });
    directory.setBinaryFile(TEXTURE_PATH, new Uint8Array([0x62, 0x61, 0x64]));

    await expect(
      openEditorWorkspace({
        picker: { pickDirectory: async () => directory }
      })
    ).rejects.toMatchObject({
      code: "workspace.binary.digestMismatch",
      path: TEXTURE_PATH
    });
  });

  it("opens when an optional source original binary ref is absent but texture bytes are present", async () => {
    const directory = createFakeWorkspaceDirectoryHandle();
    await createEditorWorkspace({
      session: createTextureSessionWithSourceOriginalRef(),
      picker: { pickDirectory: async () => directory }
    });

    expect(directory.readBinaryFile(TEXTURE_PATH)).toEqual(TEXTURE_BYTES);
    expect(directory.readBinaryFile(SOURCE_ORIGINAL_PATH)).toBeUndefined();

    const opened = await openEditorWorkspace({
      picker: { pickDirectory: async () => directory }
    });

    expect(opened.session.packageIdentity.packageDisplayName).toBe("Workspace Storage Test");
    expect(opened.session.binaryAssets?.fileEntries).toHaveLength(1);
    expect(opened.session.binaryAssets?.fileEntries.map((entry) => entry.path)).toEqual([
      TEXTURE_PATH
    ]);
  });

  it("rejects opening workspace metadata that fails the authoring-core adapter schema path", async () => {
    const directory = createFakeWorkspaceDirectoryHandle();
    await createEditorWorkspace({
      session: createTextureSession(),
      picker: { pickDirectory: async () => directory }
    });
    const metadata = JSON.parse(readRequiredTextFile(directory, "workspace.json")) as Record<
      string,
      unknown
    >;
    metadata.unexpectedAppLocalField = true;
    directory.setTextFile("workspace.json", JSON.stringify(metadata));

    await expect(
      openEditorWorkspace({
        picker: { pickDirectory: async () => directory }
      })
    ).rejects.toMatchObject({
      code: "workspace.invalidFileSet"
    });
  });

  it("rejects opening package file sets that fail package-format validation", async () => {
    const directory = createFakeWorkspaceDirectoryHandle();
    await createEditorWorkspace({
      session: createTextureSession(),
      picker: { pickDirectory: async () => directory }
    });
    const manifest = JSON.parse(readRequiredTextFile(directory, "manifest.json")) as Record<
      string,
      unknown
    >;
    manifest.packageRevision = "not-a-number";
    directory.setTextFile("manifest.json", JSON.stringify(manifest));

    await expect(
      openEditorWorkspace({
        picker: { pickDirectory: async () => directory }
      })
    ).rejects.toMatchObject({
      code: "workspace.invalidFileSet"
    });
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

function createTextureSessionWithSourceOriginalRef(): AuthoringSession {
  const session = createTextureSession();
  const sourceAsset = session.graph.sourceAssets[0];
  if (sourceAsset === undefined) {
    throw new Error("Expected texture fixture to include a source asset.");
  }

  session.graph.sourceAssets[0] = {
    ...sourceAsset,
    filePath: SOURCE_ORIGINAL_PATH,
    contentHash: `sha256:${SOURCE_ORIGINAL_BYTES_SHA256_HEX}`,
    binaryAssetRef: createSourceOriginalBinaryAssetReference()
  };
  session.graph.provenanceRecords.push({
    provenanceId: ProvenanceIdSchema.parse("prov_workspace_source_original"),
    assetId: "src_workspace_texture",
    assetKind: "source",
    filePath: SOURCE_ORIGINAL_PATH,
    contentHash: `sha256:${SOURCE_ORIGINAL_BYTES_SHA256_HEX}`,
    creator: "test fixture",
    license: "private-local",
    redistributionAllowed: false,
    aiUsed: false,
    transformHistory: [],
    relatedOperationIds: []
  });
  session.graph.rightsRecords.push({
    assetId: "rights_workspace_source_original",
    rightsStatus: "cleared",
    license: "private-local",
    redistributionAllowed: false
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

function createSourceOriginalBinaryAssetReference(): BinaryAssetReference {
  return {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_workspace_source_original",
    packageRelativePath: SOURCE_ORIGINAL_PATH,
    digest: {
      algorithm: "sha256",
      hex: SOURCE_ORIGINAL_BYTES_SHA256_HEX
    },
    byteLength: 1024,
    mediaType: "application/octet-stream",
    storageStatus: "stored-package-local-v1",
    provenanceId: ProvenanceIdSchema.parse("prov_workspace_source_original"),
    rightsAssetId: "rights_workspace_source_original"
  } as BinaryAssetReference;
}

function readRequiredTextFile(
  directory: ReturnType<typeof createFakeWorkspaceDirectoryHandle>,
  path: string
): string {
  const text = directory.readTextFile(path);
  if (text === undefined) {
    throw new Error(`Expected fake workspace to include "${path}".`);
  }

  return text;
}

function createPermissionLostOnWriteDirectory(): WorkspaceDirectoryHandleLike {
  const error = new Error("Permission lost during write.");
  Object.defineProperty(error, "name", { value: "NotAllowedError" });

  return {
    kind: "directory",
    name: "permission-lost.ail2d-workspace",
    queryPermission: async () => "granted",
    requestPermission: async () => "granted",
    getDirectoryHandle: async () => {
      throw error;
    },
    getFileHandle: async () => {
      throw error;
    },
    values: async function* () {
      return;
    }
  };
}
