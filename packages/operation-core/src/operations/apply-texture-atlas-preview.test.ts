import {
  createInitialAuthoringRevision,
  createTextureAtlasPreview,
  getDrawableById,
  getMeshById,
  registerAuthoringSessionBinaryBytes,
  BinaryAssetReferenceSchema,
  TextureAtlasLayoutSummarySchema,
  type AuthoringSession,
  type TextureAtlasLayoutSettingsDto,
  type TextureAtlasLayoutSummaryDto,
  type RegisterAuthoringSessionBinaryBytesInput,
  type TextureAtlasPreview
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema,
  VertexIdSchema,
  type PartId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema, type OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { applyTextureAtlasPreviewOperationHandler } from "./apply-texture-atlas-preview.js";

type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];
type ReadyTextureAtlasPreview = Extract<TextureAtlasPreview, { readonly status: "ready" }>;

const PART_ROOT = PartIdSchema.parse("part_operation_atlas_root");
const PART_HIDDEN = PartIdSchema.parse("part_operation_atlas_hidden");
const DRAW_BODY = DrawableIdSchema.parse("draw_operation_atlas_body");
const DRAW_HIDDEN = DrawableIdSchema.parse("draw_operation_atlas_hidden");
const DRAW_POOL = DrawableIdSchema.parse("draw_operation_atlas_pool");
const MESH_BODY = MeshIdSchema.parse("mesh_operation_atlas_body");
const MESH_HIDDEN = MeshIdSchema.parse("mesh_operation_atlas_hidden");
const MESH_POOL = MeshIdSchema.parse("mesh_operation_atlas_pool");
const TEX_BODY = TextureIdSchema.parse("tex_operation_atlas_body");
const TEX_HIDDEN = TextureIdSchema.parse("tex_operation_atlas_hidden");
const TEX_POOL = TextureIdSchema.parse("tex_operation_atlas_pool");
const TEX_ATLAS = TextureIdSchema.parse("tex_generated_atlas_page_0");
const SRC_FIXTURE = SourceAssetIdSchema.parse("src_operation_atlas_fixture");
const PROV_FIXTURE = ProvenanceIdSchema.parse("prov_operation_atlas_fixture");
const RIG_ROOT = RigControlIdSchema.parse("rig_operation_atlas_root");
const OP_APPLY = OperationIdSchema.parse("op_apply_texture_atlas_preview_fixture");
const TEST_DIGEST_HEX = "0".repeat(64);

describe("applyTextureAtlasPreview operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("applyTextureAtlasPreview"))
      .toBe(applyTextureAtlasPreviewOperationHandler);
  });

  it("rejects sync lifecycle calls because atlas digest generation is async", () => {
    const session = createAtlasFixtureSession();
    const preview = createReadyPreview(session);
    const core = createOperationCore();

    const outcome = core.commitOperation(session, createApplyRequest(session, preview));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.applyTextureAtlasPreview.asyncLifecycleRequired"
    );
    expect(outcome.operationLogLength).toBe(0);
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.graph.textureAtlas?.layoutSummary).toBeUndefined();
  });

  it("commits atlas apply through async Operation Core with generated texture, layout, refs, UVs, and log evidence", async () => {
    const session = createAtlasFixtureSession();
    const preview = createReadyPreview(session);
    const core = createOperationCore({
      now: () => new Date("2026-06-19T00:00:00.000Z")
    });

    const outcome = await core.commitOperationAsync(session, createApplyRequest(session, preview));

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(1);
    expect(core.operationLog.entries).toHaveLength(1);
    expect(outcome.logEntry?.operationType).toBe("applyTextureAtlasPreview");
    expect(outcome.logEntry?.payload.operationType).toBe("applyTextureAtlasPreview");
    expect(outcome.logEntry?.result.modelDiff).toEqual(outcome.result.modelDiff);
    expect(JSON.stringify(outcome.logEntry?.payload)).not.toContain("textureBytes");
    expect(JSON.stringify(outcome.logEntry?.payload)).not.toContain("atlasBytes");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);

    const layoutSummary = session.graph.textureAtlas?.layoutSummary;
    expect(layoutSummary).toMatchObject({
      atlasTextureId: TEX_ATLAS,
      generatedByOperationId: OP_APPLY
    });
    const textureEntry = session.graph.textureAtlas?.textures.find(
      (entry) => entry.textureId === TEX_ATLAS
    );
    expect(textureEntry).toMatchObject({
      textureId: TEX_ATLAS,
      filePath: "assets/textures/generated_atlas_page_0.raw-rgba",
      dimensions: {
        width: 8,
        height: 4,
        pixelFormat: "rgba8"
      }
    });
    expect(textureEntry?.binaryAssetRef?.digest.hex).toMatch(/^[a-f0-9]{64}$/);

    const generatedBinary = session.binaryAssets?.binaryAssetIndex.assets.find(
      (asset) => asset.textureId === TEX_ATLAS
    );
    expect(generatedBinary).toMatchObject({
      packageRelativePath: "assets/textures/generated_atlas_page_0.raw-rgba",
      byteLength: 8 * 4 * 4,
      createdByOperationId: OP_APPLY
    });

    expect(getDrawableById(session.graph, DRAW_BODY)?.textureId).toBe(TEX_ATLAS);
    expect(getDrawableById(session.graph, DRAW_HIDDEN)?.textureId).toBe(TEX_ATLAS);
    expect(getDrawableById(session.graph, DRAW_POOL)?.textureId).toBe(TEX_POOL);
    expect(getMeshById(session.graph, MESH_BODY)?.uvs).toEqual([
      { x: 0.125, y: 0.25 },
      { x: 0.375, y: 0.25 },
      { x: 0.375, y: 0.75 },
      { x: 0.125, y: 0.75 }
    ]);
    expect(getMeshById(session.graph, MESH_HIDDEN)?.uvs).toEqual([
      { x: 0.625, y: 0.25 },
      { x: 0.875, y: 0.25 },
      { x: 0.875, y: 0.75 },
      { x: 0.625, y: 0.75 }
    ]);
    expect(getMeshById(session.graph, MESH_BODY)?.topologyRevision).toBe(1);
    expect(getMeshById(session.graph, MESH_HIDDEN)?.topologyRevision).toBe(1);

    const changedPaths = outcome.result.modelDiff?.changed.flatMap((change) =>
      change.fields.map((field) => field.path)
    );
    expect(changedPaths).toEqual(expect.arrayContaining([
      "/assets/textureAtlas/textures/tex_generated_atlas_page_0",
      "/assets/textureAtlas/layoutSummary",
      "/binaryAssets/assets/textures/generated_atlas_page_0.raw-rgba",
      "/model/drawables/draw_operation_atlas_body/textureId",
      "/model/drawables/draw_operation_atlas_hidden/textureId",
      "/model/meshes/mesh_operation_atlas_body/uvs",
      "/model/meshes/mesh_operation_atlas_hidden/uvs"
    ]));
  });

  it("dry-runs atlas apply through async Operation Core without mutating the source session", async () => {
    const session = createAtlasFixtureSession();
    const preview = createReadyPreview(session);
    const core = createOperationCore();

    const result = await core.dryRunOperationAsync(
      session,
      createApplyRequest(session, preview, { dryRun: true })
    );

    expect(result.status).toBe("dry_run");
    expect(result.modelDiff?.changed.flatMap((change) =>
      change.fields.map((field) => field.path)
    )).toEqual(expect.arrayContaining([
      "/assets/textureAtlas/layoutSummary",
      "/model/meshes/mesh_operation_atlas_body/uvs"
    ]));
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(session.graph.textureAtlas?.layoutSummary).toBeUndefined();
    expect(getDrawableById(session.graph, DRAW_BODY)?.textureId).toBe(TEX_BODY);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("rejects stale expected layouts before mutating the session", async () => {
    const session = createAtlasFixtureSession();
    const preview = createReadyPreview(session);
    const request = createApplyRequest(session, preview);
    const body = getDrawableById(session.graph, DRAW_BODY);
    if (body === undefined) {
      throw new Error("Missing fixture drawable.");
    }
    body.textureId = TEX_POOL;

    const outcome = await createOperationCore().commitOperationAsync(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.applyTextureAtlasPreview.layoutMismatch"
    );
    expect(outcome.operationLogLength).toBe(0);
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.graph.textureAtlas?.layoutSummary).toBeUndefined();
    expect(getDrawableById(session.graph, DRAW_HIDDEN)?.textureId).toBe(TEX_HIDDEN);
  });

  it("rejects payloads whose current settings recreate a failed preview", async () => {
    const session = createAtlasFixtureSession();
    const preview = createReadyPreview(session);
    const smallSettings: TextureAtlasLayoutSettingsDto = {
      ...preview.settings,
      pageWidth: 3,
      pageHeight: 3
    };
    const expectedLayoutSummary = TextureAtlasLayoutSummarySchema.parse({
      ...preview.layoutSummary,
      settings: smallSettings,
      pages: [{
        ...preview.layoutSummary.pages[0]!,
        width: 3,
        height: 3,
        placements: []
      }]
    });

    const outcome = await createOperationCore().commitOperationAsync(
      session,
      createApplyRequest(session, preview, {
        settings: smallSettings,
        expectedLayoutSummary
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.applyTextureAtlasPreview.previewNotReady",
        "operation.applyTextureAtlasPreview.cannotFit"
      ])
    );
    expect(outcome.operationLogLength).toBe(0);
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.graph.textureAtlas?.layoutSummary).toBeUndefined();
  });
});

function createApplyRequest(
  session: AuthoringSession,
  preview: ReadyTextureAtlasPreview,
  options: {
    readonly dryRun?: boolean;
    readonly settings?: TextureAtlasLayoutSettingsDto;
    readonly expectedLayoutSummary?: TextureAtlasLayoutSummaryDto;
    readonly editorHiddenPartIds?: readonly PartId[];
  } = {}
): OperationRequestDto {
  const dryRun = options.dryRun ?? false;

  return OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: OP_APPLY,
    actor: "test",
    surface: "testFixture",
    dryRun,
    basePackageRevision: session.packageRevision,
    operationType: "applyTextureAtlasPreview",
    payload: {
      settings: options.settings ?? preview.settings,
      editorHiddenPartIds: options.editorHiddenPartIds ?? [PART_HIDDEN],
      expectedLayoutSummary: options.expectedLayoutSummary ?? preview.layoutSummary,
      lockedTargetIds: []
    }
  });
}

function createReadyPreview(session: AuthoringSession): ReadyTextureAtlasPreview {
  const preview = createTextureAtlasPreview(session, {
    atlasTextureId: TEX_ATLAS,
    editorHiddenPartIds: [PART_HIDDEN],
    pageWidth: 8,
    pageHeight: 4,
    paddingPixels: 1,
    edgeExtrusionEnabled: true
  });
  if (preview.status !== "ready") {
    throw new Error(`Expected ready preview: ${preview.warnings.map((warning) => warning.code).join(",")}`);
  }

  return preview;
}

function createAtlasFixtureSession(): AuthoringSession {
  const session: AuthoringSession = {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_operation_atlas"),
      packageDisplayName: "Operation Atlas Fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: {
        width: 256,
        height: 256
      },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Atlas Root",
          childPartIds: [PART_HIDDEN],
          drawableIds: [DRAW_BODY],
          children: [
            { kind: "drawable", drawableId: DRAW_BODY },
            { kind: "part", partId: PART_HIDDEN }
          ]
        },
        {
          partId: PART_HIDDEN,
          displayName: "Hidden Part",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_HIDDEN, DRAW_POOL],
          children: [
            { kind: "drawable", drawableId: DRAW_HIDDEN },
            { kind: "drawable", drawableId: DRAW_POOL }
          ]
        }
      ],
      drawables: [
        createDrawable(DRAW_BODY, "Body", PART_ROOT, TEX_BODY, MESH_BODY, true, 0),
        createDrawable(DRAW_HIDDEN, "Hidden Sleeve", PART_HIDDEN, TEX_HIDDEN, MESH_HIDDEN, false, 1),
        createDrawable(DRAW_POOL, "Unused Pool Layer", PART_HIDDEN, TEX_POOL, MESH_POOL, true, 2)
      ],
      meshes: [
        createQuadMesh(MESH_BODY, DRAW_BODY),
        createQuadMesh(MESH_HIDDEN, DRAW_HIDDEN),
        createQuadMesh(MESH_POOL, DRAW_POOL)
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RIG_ROOT,
          displayName: "Atlas Root Rig",
          childDrawableIds: [DRAW_BODY, DRAW_HIDDEN],
          childRigControlIds: [],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        { drawableId: DRAW_BODY, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_HIDDEN, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: DRAW_POOL, baseDrawOrder: 2, stableOrder: 2 }
      ],
      rigControlRootIds: [RIG_ROOT],
      stableOrder: [PART_ROOT, PART_HIDDEN, DRAW_BODY, DRAW_HIDDEN, DRAW_POOL],
      sourceAssets: [],
      provenanceRecords: [
        {
          provenanceId: PROV_FIXTURE,
          assetId: SRC_FIXTURE,
          assetKind: "generatedFixture",
          filePath: "assets/sources/generated/operation-atlas-fixture.json",
          creator: "operation-atlas-test",
          license: "internal-authoring-generated",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: [],
          relatedOperationIds: []
        }
      ],
      rightsRecords: [
        {
          assetId: SRC_FIXTURE,
          rightsStatus: "cleared",
          license: "internal-authoring-generated",
          redistributionAllowed: false
        }
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: []
      }
    }
  };
  const bodyBytes = createSolidRgbaBytes(2, 2, [255, 0, 0, 255]);
  const hiddenBytes = createSolidRgbaBytes(2, 2, [0, 255, 0, 255]);
  const poolBytes = createSolidRgbaBytes(2, 2, [0, 0, 255, 255]);
  const bodyRef = createTextureBinaryAssetReference("body", bodyBytes);
  const hiddenRef = createTextureBinaryAssetReference("hidden", hiddenBytes);
  const poolRef = createTextureBinaryAssetReference("pool", poolBytes);

  session.graph.textureAtlas!.textures = [
    createTextureEntry(TEX_BODY, "body", bodyRef),
    createTextureEntry(TEX_HIDDEN, "hidden", hiddenRef),
    createTextureEntry(TEX_POOL, "pool", poolRef)
  ];
  registerTextureBytes(session, bodyRef, bodyBytes, TEX_BODY);
  registerTextureBytes(session, hiddenRef, hiddenBytes, TEX_HIDDEN);
  registerTextureBytes(session, poolRef, poolBytes, TEX_POOL);

  return session;
}

function createDrawable(
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  displayName: string,
  partId: ReturnType<typeof PartIdSchema.parse>,
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  runtimeVisibility: boolean,
  baseDrawOrder: number
) {
  return {
    drawableId,
    displayName,
    partId,
    sourceAssetId: SRC_FIXTURE,
    textureId,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility,
    baseDrawOrder,
    sourceProvenanceId: PROV_FIXTURE
  };
}

function createQuadMesh(
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: ReturnType<typeof DrawableIdSchema.parse>
) {
  return {
    meshId,
    drawableId,
    vertices: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ],
    triangles: [
      [0, 1, 2],
      [0, 2, 3]
    ] as [[number, number, number], [number, number, number]],
    vertexStableIds: [
      VertexIdSchema.parse(`${meshId}_v0`.replace("mesh_", "vtx_")),
      VertexIdSchema.parse(`${meshId}_v1`.replace("mesh_", "vtx_")),
      VertexIdSchema.parse(`${meshId}_v2`.replace("mesh_", "vtx_")),
      VertexIdSchema.parse(`${meshId}_v3`.replace("mesh_", "vtx_"))
    ],
    triangleStableIds: [
      TriangleIdSchema.parse(`${meshId}_t0`.replace("mesh_", "tri_")),
      TriangleIdSchema.parse(`${meshId}_t1`.replace("mesh_", "tri_"))
    ],
    topologyRevision: 0,
    bounds: { x: 0, y: 0, width: 2, height: 2 },
    generationProvenanceId: PROV_FIXTURE
  };
}

function createTextureEntry(
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  token: string,
  binaryAssetRef: BinaryAssetReference
) {
  return {
    textureId,
    filePath: `assets/textures/${token}.raw-rgba`,
    dimensions: {
      width: 2,
      height: 2,
      pixelFormat: "rgba8" as const
    },
    provenanceId: PROV_FIXTURE,
    binaryAssetRef
  };
}

function createTextureBinaryAssetReference(
  token: string,
  bytes: Uint8Array
): BinaryAssetReference {
  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_operation_atlas_${token}`,
    packageRelativePath: `assets/textures/${token}.raw-rgba`,
    digest: {
      algorithm: "sha256",
      hex: TEST_DIGEST_HEX
    },
    byteLength: bytes.byteLength,
    mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: PROV_FIXTURE,
    rightsAssetId: SRC_FIXTURE
  });
}

function registerTextureBytes(
  session: AuthoringSession,
  binaryAssetRef: BinaryAssetReference,
  bytes: Uint8Array,
  textureId: ReturnType<typeof TextureIdSchema.parse>
): void {
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes,
    role: "texture-raster-v1",
    sourceAssetId: SRC_FIXTURE,
    textureId
  });
}

function createSolidRgbaBytes(
  width: number,
  height: number,
  color: readonly [number, number, number, number]
): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    bytes[index * 4] = color[0];
    bytes[index * 4 + 1] = color[1];
    bytes[index * 4 + 2] = color[2];
    bytes[index * 4 + 3] = color[3];
  }

  return bytes;
}
