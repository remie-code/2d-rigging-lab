import {
  PackageIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  BinaryAssetReferenceSchema,
  type BinaryAssetReferenceDto
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  createAuthoringWorkspaceSavePlan,
  createInitialAuthoringRevision,
  registerAuthoringSessionBinaryBytes,
  type AuthoringSession
} from "./index.js";

const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const RAW_RGBA_MEDIA_TYPE = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

describe("authoring workspace save adapter", () => {
  it("builds a workspace save plan from PackageDocument refs and current session bytes", async () => {
    const binaryAssetRef = createTextureBinaryAssetReference();
    const session = createTextureSession(binaryAssetRef);

    registerAuthoringSessionBinaryBytes(session, {
      binaryAssetRef,
      bytes: TEST_BYTES,
      role: "texture-raster-v1",
      sourceAssetId: SourceAssetIdSchema.parse("src_workspace_fixture"),
      textureId: TextureIdSchema.parse("tex_workspace_body")
    });

    const result = await createAuthoringWorkspaceSavePlan({
      session,
      updatedAt: "2026-06-20T00:00:00.000Z"
    });
    const decision = result.savePlan.binaryDecisions[0];

    expect(result.packageDocument.assets.textureAtlas?.textures[0]?.binaryAssetRef)
      .toEqual(binaryAssetRef);
    expect(result.savePlan.workspaceTextFileSet.map((entry) => entry.path))
      .toContain("workspace.json");
    expect(decision?.action).toBe("write");
    if (decision?.action !== "write") {
      throw new Error("Expected workspace save plan to write missing texture bytes.");
    }
    expect(decision.reason).toBe("existing-missing");
    expect(decision.binaryEntry.path).toBe("assets/textures/workspace-body.raw-rgba");
  });
});

const createTextureBinaryAssetReference = (): BinaryAssetReferenceDto =>
  BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_workspace_body_rgba",
    packageRelativePath: "assets/textures/workspace-body.raw-rgba",
    digest: { algorithm: "sha256", hex: TEST_BYTES_SHA256_HEX },
    byteLength: TEST_BYTES.byteLength,
    mediaType: RAW_RGBA_MEDIA_TYPE,
    storageStatus: "stored-package-local-v1",
    provenanceId: ProvenanceIdSchema.parse("prov_workspace_body"),
    rightsAssetId: "rights_workspace_body"
  });

const createTextureSession = (
  binaryAssetRef: BinaryAssetReferenceDto
): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_workspace_save_adapter"),
    packageDisplayName: "Workspace Save Adapter",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 1,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: true,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 64, height: 64 },
    parts: [],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [
      {
        sourceAssetId: SourceAssetIdSchema.parse("src_workspace_fixture"),
        kind: "generated-fixture-v1",
        filePath: "assets/sources/workspace-fixture.json",
        contentHash: "sha256:workspace-fixture",
        importProfile: "split-png-fallback-v1",
        layers: [
          {
            sourceLayerId: "layer_workspace_body",
            sourceAssetId: SourceAssetIdSchema.parse("src_workspace_fixture"),
            originalName: "Body",
            normalizedName: "body",
            groupPath: [],
            bounds: { x: 0, y: 0, width: 64, height: 64 },
            visibleInSource: true,
            opacityInSource: 1,
            role: "editableLayer",
            unsupportedFeatures: [],
            mappedDrawableIds: []
          }
        ],
        diagnostics: []
      }
    ],
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: [
        {
          textureId: TextureIdSchema.parse("tex_workspace_body"),
          filePath: binaryAssetRef.packageRelativePath,
          contentHash: `sha256:${binaryAssetRef.digest.hex}`,
          sourceAssetId: SourceAssetIdSchema.parse("src_workspace_fixture"),
          sourceLayerId: "layer_workspace_body",
          provenanceId: ProvenanceIdSchema.parse("prov_workspace_body"),
          binaryAssetRef
        }
      ]
    },
    provenanceRecords: [
      {
        provenanceId: ProvenanceIdSchema.parse("prov_workspace_body"),
        assetId: "tex_workspace_body",
        assetKind: "texture",
        filePath: binaryAssetRef.packageRelativePath,
        contentHash: `sha256:${binaryAssetRef.digest.hex}`,
        creator: "workspace-save-adapter-test",
        license: "internal-test-fixture",
        redistributionAllowed: false,
        aiUsed: false,
        transformHistory: [],
        relatedOperationIds: []
      }
    ],
    rightsRecords: [
      {
        assetId: "rights_workspace_body",
        rightsStatus: "cleared",
        license: "internal-test-fixture",
        redistributionAllowed: false
      }
    ]
  }
});
