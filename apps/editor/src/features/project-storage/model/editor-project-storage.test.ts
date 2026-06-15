import {
  createInitialAuthoringRevision,
  registerAuthoringSessionBinaryBytes,
  type AuthoringSession,
  type RegisterAuthoringSessionBinaryBytesInput
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  exportEditorProjectBundle,
  importEditorProjectBundle
} from "./editor-project-storage";

const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const PART_STORAGE_ROOT = PartIdSchema.parse("part_root");
const PART_STORAGE_CONTAINER = PartIdSchema.parse("part_storage_container");
const PART_STORAGE_STALE = PartIdSchema.parse("part_storage_stale");
type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];

describe("editor project storage service", () => {
  it("exports and imports a portable project bundle with texture bytes", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const session = createTextureSession(binaryAssetRef);
    registerTextureBytes(session, binaryAssetRef);

    const exported = await exportEditorProjectBundle({
      session,
      now: () => new Date("2026-06-15T03:00:00.000Z")
    });
    const imported = await importEditorProjectBundle({ bundleText: exported.bundleJson });

    expect(exported.fileName).toBe("storage-service-test-rev1.portable-project.json");
    expect(exported.binaryPayloadCount).toBe(1);
    expect(imported.packageDisplayName).toBe("Storage Service Test");
    expect(imported.session.graph.drawables).toEqual(session.graph.drawables);
    expect(imported.session.binaryAssets?.fileEntries).toHaveLength(1);
    expect(Array.from(imported.session.binaryAssets?.fileEntries[0]?.bytes ?? [])).toEqual([
      0x61,
      0x62,
      0x63
    ]);
  });

  it("exports and imports editor-hidden Part Container state through package editor-state", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const session = createTextureSession(binaryAssetRef);
    registerTextureBytes(session, binaryAssetRef);

    const exported = await exportEditorProjectBundle({
      session,
      editorHiddenPartIds: new Set([PART_STORAGE_STALE, PART_STORAGE_CONTAINER]),
      now: () => new Date("2026-06-15T03:30:00.000Z")
    });
    const packageDocument = exported.packageDocument as {
      readonly manifest: {
        readonly modelFiles: { readonly editorState?: string };
      };
      readonly model: {
        readonly editorState?: {
          readonly schemaVersion: string;
          readonly editorHiddenIds: readonly string[];
        };
      };
    };
    const imported = await importEditorProjectBundle({ bundleText: exported.bundleJson });

    expect(packageDocument.manifest.modelFiles.editorState).toBe("model/editor-state.json");
    expect(packageDocument.model.editorState).toMatchObject({
      schemaVersion: "editor-state-v1",
      editorHiddenIds: [PART_STORAGE_CONTAINER]
    });
    expect(imported.editorHiddenPartIds).toEqual([PART_STORAGE_CONTAINER]);
  });

  it("classifies invalid portable bundle input", async () => {
    await expect(importEditorProjectBundle({ bundleText: "{" })).rejects.toMatchObject({
      name: "EditorProjectStorageError",
      code: "invalidBundle",
      issues: [expect.objectContaining({ code: "portableBundle.json.invalid" })]
    });
  });

  it("classifies missing export bytes and missing import payloads", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const session = createTextureSession(binaryAssetRef);

    await expect(exportEditorProjectBundle({ session })).rejects.toMatchObject({
      name: "EditorProjectStorageError",
      code: "missingBytes",
      issues: [expect.objectContaining({ code: "portableBundle.binaryBytes.missing" })]
    });

    registerTextureBytes(session, binaryAssetRef);
    const exported = await exportEditorProjectBundle({ session });
    const bundle = JSON.parse(exported.bundleJson) as {
      binaryPayloads: unknown[];
    };
    bundle.binaryPayloads = [];

    await expect(
      importEditorProjectBundle({ bundleText: JSON.stringify(bundle) })
    ).rejects.toMatchObject({
      name: "EditorProjectStorageError",
      code: "missingBytes",
      issues: [expect.objectContaining({ code: "portableBundle.binaryPayload.missing" })]
    });
  });

  it("classifies digest mismatch import failures", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const session = createTextureSession(binaryAssetRef);
    registerTextureBytes(session, binaryAssetRef);
    const exported = await exportEditorProjectBundle({ session });
    const bundle = JSON.parse(exported.bundleJson) as {
      binaryPayloads: Array<{ payloadBase64: string }>;
    };
    const firstPayload = bundle.binaryPayloads[0];
    if (firstPayload === undefined) {
      throw new Error("Expected test bundle payload.");
    }
    firstPayload.payloadBase64 = "YWJk";

    await expect(
      importEditorProjectBundle({ bundleText: JSON.stringify(bundle) })
    ).rejects.toMatchObject({
      name: "EditorProjectStorageError",
      code: "digestMismatch",
      issues: [expect.objectContaining({ code: "portableBundle.digest.mismatch" })]
    });
  });
});

function registerTextureBytes(
  session: AuthoringSession,
  binaryAssetRef: BinaryAssetReference
): void {
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes: TEST_BYTES,
    role: "texture-raster-v1",
    sourceAssetId: SourceAssetIdSchema.parse("src_storage_fixture"),
    textureId: TextureIdSchema.parse("tex_storage_fixture")
  });
}

function createBinaryAssetReference(): BinaryAssetReference {
  return {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_storage_fixture_texture",
    packageRelativePath: "assets/textures/storage-fixture.png",
    digest: {
      algorithm: "sha256",
      hex: TEST_BYTES_SHA256_HEX
    },
    byteLength: TEST_BYTES.byteLength,
    mediaType: "image/png; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: ProvenanceIdSchema.parse("prov_storage_fixture"),
    rightsAssetId: "rights_storage_fixture"
  } as BinaryAssetReference;
}

function createTextureSession(binaryAssetRef: BinaryAssetReference): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_storage_service_test"),
      packageDisplayName: "Storage Service Test",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 1,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: true,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 64, height: 64 },
      parts: [
        {
          partId: PART_STORAGE_ROOT,
          displayName: "Root",
          childPartIds: [PART_STORAGE_CONTAINER],
          drawableIds: [],
          children: [{ kind: "part", partId: PART_STORAGE_CONTAINER }]
        },
        {
          partId: PART_STORAGE_CONTAINER,
          displayName: "Storage Container",
          parentPartId: PART_STORAGE_ROOT,
          childPartIds: [],
          drawableIds: [DrawableIdSchema.parse("draw_storage_fixture")],
          children: [{ kind: "drawable", drawableId: DrawableIdSchema.parse("draw_storage_fixture") }]
        }
      ],
      drawables: [
        {
          drawableId: DrawableIdSchema.parse("draw_storage_fixture"),
          displayName: "Storage Fixture",
          partId: PART_STORAGE_CONTAINER,
          sourceAssetId: SourceAssetIdSchema.parse("src_storage_fixture"),
          textureId: TextureIdSchema.parse("tex_storage_fixture"),
          meshId: MeshIdSchema.parse("mesh_storage_fixture"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_storage_fixture")
        }
      ],
      meshes: [
        {
          meshId: MeshIdSchema.parse("mesh_storage_fixture"),
          drawableId: DrawableIdSchema.parse("draw_storage_fixture"),
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
          vertexStableIds: ["vtx_storage_0", "vtx_storage_1", "vtx_storage_2"],
          triangleStableIds: ["tri_storage_0"],
          topologyRevision: 1,
          bounds: { x: 0, y: 0, width: 8, height: 8 },
          generationProvenanceId: ProvenanceIdSchema.parse("prov_storage_fixture")
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        {
          drawableId: DrawableIdSchema.parse("draw_storage_fixture"),
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ],
      rigControlRootIds: [],
      stableOrder: [PART_STORAGE_ROOT, PART_STORAGE_CONTAINER, "draw_storage_fixture", "mesh_storage_fixture"],
      sourceAssets: [
        {
          sourceAssetId: SourceAssetIdSchema.parse("src_storage_fixture"),
          kind: "generated-fixture-v1",
          filePath: "assets/sources/storage-fixture.json",
          contentHash: "sha256:storage-fixture",
          importProfile: "split-png-fallback-v1",
          layers: [],
          diagnostics: []
        }
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_storage_fixture"),
            filePath: "assets/textures/storage-fixture.png",
            sourceAssetId: SourceAssetIdSchema.parse("src_storage_fixture"),
            sourceLayerId: "layer_storage_fixture",
            provenanceId: ProvenanceIdSchema.parse("prov_storage_fixture"),
            binaryAssetRef
          }
        ]
      },
      provenanceRecords: [
        {
          provenanceId: ProvenanceIdSchema.parse("prov_storage_fixture"),
          assetId: "tex_storage_fixture",
          assetKind: "texture",
          filePath: "assets/textures/storage-fixture.png",
          contentHash: `sha256:${TEST_BYTES_SHA256_HEX}`,
          creator: "test fixture",
          license: "private-local",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: [],
          relatedOperationIds: []
        }
      ],
      rightsRecords: [
        {
          assetId: "rights_storage_fixture",
          rightsStatus: "cleared",
          license: "private-local",
          redistributionAllowed: false
        }
      ]
    }
  };
}
