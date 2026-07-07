import {
  createInitialAuthoringRevision,
  getV6MeshGenerationContractFixture,
  type AuthoringSession,
  type GeneratedMeshPreviewCommitMethod
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type RectDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createMeshToolDraft } from "./editor-session-context";
import { DEFAULT_MESH_GENERATION_METHOD } from "./model/mesh-tool-state";

const DRAW_A = DrawableIdSchema.parse("draw_a");
const PART_ROOT = PartIdSchema.parse("part_root");
const PART_A = PartIdSchema.parse("part_a");

const V6_DEFAULT_METHOD: GeneratedMeshPreviewCommitMethod =
  "auto-outline-v6d-adaptive-contour-constrainautor";
const V7_METHOD: GeneratedMeshPreviewCommitMethod = "auto-outline-v7-margin-contour";

describe("mesh tool generation method wiring", () => {
  it("bakes the v7 method into the draft when the v7 generation choice is selected", () => {
    const session = createMeshFixtureSession();

    const result = createMeshToolDraft({
      session,
      drawableId: DRAW_A,
      presetId: "standard",
      method: V7_METHOD,
      commitMode: "single"
    });

    expect(result.draft).toBeDefined();
    expect(result.draft?.method).toBe(V7_METHOD);
  });

  it("keeps the current-generation method when the default choice is selected", () => {
    const session = createMeshFixtureSession();

    const result = createMeshToolDraft({
      session,
      drawableId: DRAW_A,
      presetId: "standard",
      method: DEFAULT_MESH_GENERATION_METHOD,
      commitMode: "single"
    });

    expect(result.draft).toBeDefined();
    expect(result.draft?.method).toBe(V6_DEFAULT_METHOD);
    expect(DEFAULT_MESH_GENERATION_METHOD).toBe(V6_DEFAULT_METHOD);
  });

  it("maps mesh presets to their density hints without changing the requested method", () => {
    const session = createMeshFixtureSession();
    const cases = [
      { presetId: "largeMotion", densityHint: "high" },
      { presetId: "standard", densityHint: "medium" },
      { presetId: "lowMotion", densityHint: "low" }
    ] as const;

    for (const testCase of cases) {
      const result = createMeshToolDraft({
        session,
        drawableId: DRAW_A,
        presetId: testCase.presetId,
        method: DEFAULT_MESH_GENERATION_METHOD,
        commitMode: "single"
      });

      expect(result.draft?.presetId).toBe(testCase.presetId);
      expect(result.draft?.method).toBe(V6_DEFAULT_METHOD);
      expect(result.draft?.qualityMetrics?.v6Metrics?.preset).toBe(testCase.densityHint);
    }
  });
});

function createMeshFixtureSession(): AuthoringSession {
  const fixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
  const texturePath = "assets/textures/a.raw-rgba";
  const bytes = createAlphaBytes(
    fixture.textureSize.width,
    fixture.textureSize.height,
    fixture.opaquePixels
  );

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_mesh_tool_generation_method_fixture"),
      packageDisplayName: "Mesh Tool Generation Method Fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 128, height: 128 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_A],
          drawableIds: []
        },
        {
          partId: PART_A,
          displayName: "Part A",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_A]
        }
      ],
      drawables: [
        {
          drawableId: DRAW_A,
          displayName: "Drawable A",
          partId: PART_A,
          sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
          textureId: TextureIdSchema.parse("tex_a"),
          meshId: MeshIdSchema.parse("mesh_a"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_a")
        }
      ],
      meshes: [
        {
          meshId: MeshIdSchema.parse("mesh_a"),
          drawableId: DRAW_A,
          vertices: [],
          uvs: [],
          triangles: [],
          vertexStableIds: [],
          triangleStableIds: [],
          topologyRevision: 0,
          bounds: fixture.meshBounds as RectDto,
          generationProvenanceId: ProvenanceIdSchema.parse("prov_a")
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [{ drawableId: DRAW_A, baseDrawOrder: 0, stableOrder: 0 }],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_A, DRAW_A],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_a"),
            filePath: texturePath,
            sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
            binaryAssetRef: {
              referenceKind: "package-binary-asset-ref-v1",
              binaryAssetId: "bin_a_rgba",
              packageRelativePath: texturePath,
              digest: { algorithm: "sha256", hex: "0".repeat(64) },
              byteLength: bytes.byteLength,
              mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
              storageStatus: "stored-package-local-v1",
              provenanceId: ProvenanceIdSchema.parse("prov_a"),
              rightsAssetId: "rights_a"
            }
          }
        ]
      }
    },
    binaryAssets: {
      fileEntries: [
        {
          path: texturePath,
          bytes,
          mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
          binaryAssetId: "bin_a_rgba"
        }
      ],
      binaryAssetIndex: {
        schemaVersion: "binary-asset-index-v1",
        assets: []
      },
      byteIntakeSummaries: []
    }
  } as unknown as AuthoringSession;
}

function createAlphaBytes(
  width: number,
  height: number,
  opaquePixels: readonly (readonly [number, number])[]
): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);

  for (const [x, y] of opaquePixels) {
    const index = (y * width + x) * 4;
    bytes[index] = 255;
    bytes[index + 1] = 255;
    bytes[index + 2] = 255;
    bytes[index + 3] = 255;
  }

  return bytes;
}
