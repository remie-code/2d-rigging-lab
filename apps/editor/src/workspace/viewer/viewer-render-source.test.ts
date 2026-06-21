import {
  applyTextureAtlasPreview,
  createInitialAuthoringRevision,
  createTextureAtlasSourceSignature,
  createTextureAtlasPreview,
  registerAuthoringSessionBinaryBytes,
  sameTextureAtlasSourceSignature,
  selectTextureAtlasTargets,
  type AuthoringSession,
  type RegisterAuthoringSessionBinaryBytesInput
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type DrawableId,
  type RectDto,
  type TextureId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it, vi } from "vitest";

import { createCanvasRenderProjection } from "../canvas/canvas-projection";
import {
  createViewerCleanStageProjection,
  createViewerCleanStageRenderSourceProjection
} from "./viewer-clean-stage";
import {
  createViewerAtlasRuntimeSourceCache,
  createViewerRenderSourceProjection
} from "./viewer-render-source";

type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];

const PART_ROOT = PartIdSchema.parse("part_viewer_atlas_root");
const PART_POOL = PartIdSchema.parse("part_viewer_atlas_pool");
const DRAW_BODY = DrawableIdSchema.parse("draw_viewer_atlas_body");
const DRAW_SLEEVE = DrawableIdSchema.parse("draw_viewer_atlas_sleeve");
const DRAW_POOL = DrawableIdSchema.parse("draw_viewer_atlas_pool");
const MESH_BODY = MeshIdSchema.parse("mesh_viewer_atlas_body");
const MESH_SLEEVE = MeshIdSchema.parse("mesh_viewer_atlas_sleeve");
const MESH_POOL = MeshIdSchema.parse("mesh_viewer_atlas_pool");
const TEX_BODY = TextureIdSchema.parse("tex_viewer_atlas_body");
const TEX_SLEEVE = TextureIdSchema.parse("tex_viewer_atlas_sleeve");
const TEX_POOL = TextureIdSchema.parse("tex_viewer_atlas_pool");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_viewer_atlas_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_viewer_atlas_fixture");
const RIG_ROOT = RigControlIdSchema.parse("rig_viewer_atlas_root");
const PARAM_NON_SOURCE = ParameterIdSchema.parse("param_viewer_atlas_non_source");
const DYNAMICS_GROUP = DynamicsGroupIdSchema.parse("dyn_viewer_atlas_non_source");
const MASK_BODY_TO_SLEEVE = MaskRelationIdSchema.parse("maskrel_viewer_atlas_body_to_sleeve");

describe("viewer render source projection", () => {
  it("keeps Original mode on authoring texture refs and mesh UVs", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const original = createViewerCleanStageRenderSourceProjection(session, {
      renderSourceMode: "original"
    });
    const defaultProjection = createViewerCleanStageProjection(session);
    const body = requireDrawable(original.projection, DRAW_BODY);

    expect(original.requestedMode).toBe("original");
    expect(original.effectiveMode).toBe("original");
    expect(original.atlasRuntimeAvailability.status).toBe("available");
    expect(body.textureId).toBe(TEX_BODY);
    expect(body.renderWidth).toBe(2);
    expect(body.renderHeight).toBe(2);
    expect(body.evaluatedMesh.uvs).toEqual(createUnitQuadUvs());
    expect(requireDrawable(defaultProjection, DRAW_BODY).textureId).toBe(TEX_BODY);
  });

  it("keeps Original mode rendering unbound Drawable Pool drawables after atlas commit", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const original = createViewerCleanStageRenderSourceProjection(session, {
      renderSourceMode: "original"
    });
    const pool = requireDrawable(original.projection, DRAW_POOL);

    expect(original.effectiveMode).toBe("original");
    expect(original.atlasRuntimeAvailability.status).toBe("available");
    expect(pool.textureId).toBe(TEX_POOL);
    expect(pool.renderWidth).toBe(2);
    expect(pool.renderHeight).toBe(2);
    expect(pool.evaluatedMesh.uvs).toEqual(createUnitQuadUvs());
  });

  it("remaps Atlas Runtime texture refs, bytes, dimensions, and UVs without mutating graph", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const beforeGraph = structuredClone(session.graph);
    const page = requireAtlasPage(session);
    const atlasTexture = requireAtlasTextureEntry(session);
    const atlasBinaryRef = atlasTexture.binaryAssetRef;
    if (atlasBinaryRef === undefined) {
      throw new Error("Expected generated atlas binary ref.");
    }
    const atlasBinary = requireBinaryEntry(session, atlasBinaryRef);
    const bodyPlacement = requirePlacement(session, DRAW_BODY);

    const result = createViewerCleanStageRenderSourceProjection(session, {
      renderSourceMode: "atlasRuntime"
    });
    const body = requireDrawable(result.projection, DRAW_BODY);

    expect(result.requestedMode).toBe("atlasRuntime");
    expect(result.effectiveMode).toBe("atlasRuntime");
    expect(result.atlasRuntimeAvailability.status).toBe("available");
    expect(body.textureId).toBe(atlasTexture.textureId);
    expect(body.binaryAssetId).toBe(atlasBinaryRef.binaryAssetId);
    expect(body.binaryAssetPath).toBe(atlasBinaryRef.packageRelativePath);
    expect(body.renderBytes).toBe(atlasBinary.bytes);
    expect(body.renderWidth).toBe(page.width);
    expect(body.renderHeight).toBe(page.height);
    expect(body.evaluatedMesh.uvs).toEqual([
      bodyPlacement.uvRect.topLeft,
      { x: bodyPlacement.uvRect.bottomRight.x, y: bodyPlacement.uvRect.topLeft.y },
      bodyPlacement.uvRect.bottomRight,
      { x: bodyPlacement.uvRect.topLeft.x, y: bodyPlacement.uvRect.bottomRight.y }
    ]);
    expect(session.graph).toEqual(beforeGraph);
  });

  it("keeps Atlas Runtime available and omits unbound Drawable Pool drawables after atlas commit", async () => {
    const session = await createAppliedAtlasRuntimeSession();

    const result = createViewerCleanStageRenderSourceProjection(session, {
      renderSourceMode: "atlasRuntime"
    });

    expect(result.effectiveMode).toBe("atlasRuntime");
    expect(result.atlasRuntimeAvailability.status).toBe("available");
    expect(result.projection.drawables.map((drawable) => drawable.drawableId).sort()).toEqual(
      [DRAW_BODY, DRAW_SLEEVE].sort()
    );
    expect(result.projection.drawables.some((drawable) => drawable.drawableId === DRAW_POOL)).toBe(
      false
    );
  });

  it("keeps Canvas projection on original texture refs and mesh UVs after atlas commit", async () => {
    const session = await createAppliedAtlasRuntimeSession();

    const projection = createCanvasRenderProjection(session, null);
    const body = requireDrawable(projection, DRAW_BODY);
    const sleeve = requireDrawable(projection, DRAW_SLEEVE);
    const pool = requireDrawable(projection, DRAW_POOL);

    expect(session.graph.textureAtlas?.layoutSummary).toBeDefined();
    expect(body.textureId).toBe(TEX_BODY);
    expect(sleeve.textureId).toBe(TEX_SLEEVE);
    expect(pool.textureId).toBe(TEX_POOL);
    expect(body.renderWidth).toBe(2);
    expect(sleeve.renderWidth).toBe(2);
    expect(pool.renderWidth).toBe(2);
    expect(body.evaluatedMesh.uvs).toEqual(createUnitQuadUvs());
    expect(sleeve.evaluatedMesh.uvs).toEqual(createUnitQuadUvs());
    expect(pool.evaluatedMesh.uvs).toEqual(createUnitQuadUvs());
  });

  it("avoids atlas target selection and source signature work for Original projections", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const originalProjection = createCanvasRenderProjection(session, null);
    const atlasRuntimeSourceCache = createViewerAtlasRuntimeSourceCache();
    const hooks = {
      selectTextureAtlasTargets: vi.fn(() => {
        throw new Error("Original mode must not select atlas targets.");
      }),
      createTextureAtlasSourceSignature: vi.fn(() => {
        throw new Error("Original mode must not create atlas source signatures.");
      }),
      sameTextureAtlasSourceSignature: vi.fn(() => {
        throw new Error("Original mode must not compare atlas source signatures.");
      })
    };

    const result = createViewerRenderSourceProjection({
      session,
      originalProjection,
      atlasRuntimeSourceCache,
      requestedMode: "original",
      hooks
    });

    expect(result.effectiveMode).toBe("original");
    expect(result.projection).toBe(originalProjection);
    expect(result.atlasRuntimeAvailability.status).toBe("available");
    expect(hooks.selectTextureAtlasTargets).not.toHaveBeenCalled();
    expect(hooks.createTextureAtlasSourceSignature).not.toHaveBeenCalled();
    expect(hooks.sameTextureAtlasSourceSignature).not.toHaveBeenCalled();
  });

  it("caches Atlas Runtime static source resolution across unchanged projections", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const atlasRuntimeSourceCache = createViewerAtlasRuntimeSourceCache();
    const hooks = createCountingAtlasRuntimeHooks();
    const originalProjection = createCanvasRenderProjection(session, null);

    const first = createViewerRenderSourceProjection({
      session,
      originalProjection,
      atlasRuntimeSourceCache,
      requestedMode: "atlasRuntime",
      hooks
    });
    const second = createViewerRenderSourceProjection({
      session,
      originalProjection,
      atlasRuntimeSourceCache,
      requestedMode: "atlasRuntime",
      hooks
    });
    const firstBody = requireDrawable(first.projection, DRAW_BODY);
    const secondBody = requireDrawable(second.projection, DRAW_BODY);

    expect(first.effectiveMode).toBe("atlasRuntime");
    expect(second.effectiveMode).toBe("atlasRuntime");
    expect(first.atlasRuntimeAvailability.status).toBe("available");
    expect(second.atlasRuntimeAvailability.status).toBe("available");
    expect(hooks.selectTextureAtlasTargets).toHaveBeenCalledTimes(1);
    expect(hooks.createTextureAtlasSourceSignature).toHaveBeenCalledTimes(1);
    expect(hooks.sameTextureAtlasSourceSignature).toHaveBeenCalledTimes(1);
    expect(secondBody.renderBytes).toBe(firstBody.renderBytes);
    expect(secondBody.textureId).toBe(firstBody.textureId);
    expect(secondBody.evaluatedMesh.uvs).toEqual(firstBody.evaluatedMesh.uvs);
  });

  it("invalidates the Atlas Runtime source cache and preserves stale detection", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const atlasRuntimeSourceCache = createViewerAtlasRuntimeSourceCache();
    const hooks = createCountingAtlasRuntimeHooks();
    const originalProjection = createCanvasRenderProjection(session, null);
    const first = createViewerRenderSourceProjection({
      session,
      originalProjection,
      atlasRuntimeSourceCache,
      requestedMode: "atlasRuntime",
      hooks
    });
    const bodyMesh = session.graph.meshes.find((mesh) => mesh.meshId === MESH_BODY);
    if (bodyMesh === undefined) {
      throw new Error("Expected body mesh.");
    }
    bodyMesh.uvs = [
      { x: 0.25, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];

    const stale = createViewerRenderSourceProjection({
      session,
      originalProjection: createCanvasRenderProjection(session, null),
      atlasRuntimeSourceCache,
      requestedMode: "atlasRuntime",
      hooks
    });

    expect(first.effectiveMode).toBe("atlasRuntime");
    expect(stale.effectiveMode).toBe("original");
    expect(stale.atlasRuntimeAvailability).toMatchObject({
      status: "unavailable",
      code: "staleSourceSignature",
      disabledReason: "Atlas source changed; regenerate the atlas."
    });
    expect(hooks.selectTextureAtlasTargets).toHaveBeenCalledTimes(2);
    expect(hooks.createTextureAtlasSourceSignature).toHaveBeenCalledTimes(2);
    expect(hooks.sameTextureAtlasSourceSignature).toHaveBeenCalledTimes(2);
  });

  it("disables Atlas Runtime when no committed atlas layout exists", () => {
    const session = createViewerAtlasFixtureSession();

    const result = createViewerCleanStageRenderSourceProjection(session, {
      renderSourceMode: "atlasRuntime"
    });

    expect(result.effectiveMode).toBe("original");
    expect(result.atlasRuntimeAvailability).toMatchObject({
      status: "unavailable",
      code: "missingLayout",
      disabledReason: "Apply a texture atlas first."
    });
    expect(requireDrawable(result.projection, DRAW_BODY).textureId).toBe(TEX_BODY);
  });

  it("disables Atlas Runtime when source inputs become stale", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const bodyMesh = session.graph.meshes.find((mesh) => mesh.meshId === MESH_BODY);
    if (bodyMesh === undefined) {
      throw new Error("Expected body mesh.");
    }
    bodyMesh.uvs = [
      { x: 0.25, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];

    const result = createViewerCleanStageRenderSourceProjection(session, {
      renderSourceMode: "atlasRuntime"
    });

    expect(result.effectiveMode).toBe("original");
    expect(result.atlasRuntimeAvailability).toMatchObject({
      status: "unavailable",
      code: "staleSourceSignature",
      disabledReason: "Atlas source changed; regenerate the atlas."
    });
  });

  it("does not stale Atlas Runtime for deformer, keyform, or dynamics-only changes", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const rigControl = session.graph.rigControls.find(
      (candidate) => candidate.rigControlId === RIG_ROOT
    );
    if (rigControl?.kind !== "rotation2d") {
      throw new Error("Expected rotation rig control.");
    }

    rigControl.restAngleDegrees = 15;
    session.graph.parameters.push({
      parameterId: PARAM_NON_SOURCE,
      displayName: "Non Source Parameter",
      valueSource: "authoredInput",
      min: -30,
      default: 0,
      max: 30,
      recommendedUiStep: 1,
      kind: "custom",
      parameterType: "scalar",
      group: "custom",
      lockedFields: []
    });
    session.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_viewer_atlas_non_source_angle"),
      target: {
        kind: "rigControl",
        id: RIG_ROOT,
        property: "angleDegrees"
      },
      parameterId: PARAM_NON_SOURCE,
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        { value: -30, statePatch: -15 },
        { value: 30, statePatch: 15 }
      ]
    });
    session.graph.dynamicsGroups.push({
      dynamicsGroupId: DYNAMICS_GROUP,
      displayName: "Non Source Dynamics",
      enabled: true,
      presetId: "hair",
      inputs: [
        {
          parameterId: PARAM_NON_SOURCE,
          kind: "angle",
          influencePercent: 100,
          invert: false,
          normalization: {
            min: -30,
            center: 0,
            max: 30
          }
        }
      ],
      pendulums: [
        {
          length: 1,
          sway: 0.05,
          reactionSpeed: 8,
          convergenceSpeed: 10
        }
      ],
      outputs: [
        {
          parameterId: PARAM_NON_SOURCE,
          kind: "angle",
          strength: 10,
          invert: false,
          limit: 10
        }
      ]
    });

    const result = createViewerCleanStageRenderSourceProjection(session, {
      renderSourceMode: "atlasRuntime"
    });

    expect(result.effectiveMode).toBe("atlasRuntime");
    expect(result.atlasRuntimeAvailability.status).toBe("available");
  });

  it("keeps keyform projection and masks while reusing cached Atlas Runtime source", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    addRuntimeAngleKeyform(session);
    session.graph.masks.push({
      maskRelationId: MASK_BODY_TO_SLEEVE,
      maskDrawableIds: [DRAW_BODY],
      targetDrawableIds: [DRAW_SLEEVE],
      enabled: true
    });
    const atlasRuntimeSourceCache = createViewerAtlasRuntimeSourceCache();
    const hooks = createCountingAtlasRuntimeHooks();
    const left = createViewerRenderSourceProjection({
      session,
      originalProjection: createCanvasRenderProjection(session, null, {
        parameterValues: { [PARAM_NON_SOURCE]: -30 }
      }),
      atlasRuntimeSourceCache,
      requestedMode: "atlasRuntime",
      hooks
    });
    const right = createViewerRenderSourceProjection({
      session,
      originalProjection: createCanvasRenderProjection(session, null, {
        parameterValues: { [PARAM_NON_SOURCE]: 30 }
      }),
      atlasRuntimeSourceCache,
      requestedMode: "atlasRuntime",
      hooks
    });

    expect(left.effectiveMode).toBe("atlasRuntime");
    expect(right.effectiveMode).toBe("atlasRuntime");
    expect(requireDrawable(left.projection, DRAW_BODY).bounds).not.toEqual(
      requireDrawable(right.projection, DRAW_BODY).bounds
    );
    expect(right.projection.maskRelations).toEqual([
      {
        maskRelationId: MASK_BODY_TO_SLEEVE,
        sourceDrawableIds: [DRAW_BODY],
        targetDrawableIds: [DRAW_SLEEVE]
      }
    ]);
    expect(hooks.selectTextureAtlasTargets).toHaveBeenCalledTimes(1);
    expect(hooks.createTextureAtlasSourceSignature).toHaveBeenCalledTimes(1);
  });

  it("disables Atlas Runtime when a renderable drawable has no placement", async () => {
    const session = await createAppliedAtlasRuntimeSession();
    const page = requireAtlasPage(session);
    page.placements = page.placements.filter((placement) => placement.drawableId !== DRAW_SLEEVE);

    const result = createViewerCleanStageRenderSourceProjection(session, {
      renderSourceMode: "atlasRuntime"
    });

    expect(result.effectiveMode).toBe("original");
    expect(result.atlasRuntimeAvailability).toMatchObject({
      status: "unavailable",
      code: "missingPlacement",
      disabledReason: "Atlas placement is missing."
    });
  });
});

async function createAppliedAtlasRuntimeSession(): Promise<AuthoringSession> {
  const session = createViewerAtlasFixtureSession();
  const preview = createTextureAtlasPreview(session, {
    pageWidth: 8,
    pageHeight: 8,
    paddingPixels: 1,
    edgeExtrusionEnabled: true
  });
  if (preview.status !== "ready") {
    throw new Error(`Expected ready atlas preview: ${preview.warnings[0]?.message ?? "failed"}`);
  }

  const result = await applyTextureAtlasPreview(session, { preview });
  if (result.status !== "applied") {
    throw new Error(`Expected atlas apply: ${result.warnings[0]?.message ?? "failed"}`);
  }

  return result.session;
}

function createCountingAtlasRuntimeHooks() {
  return {
    selectTextureAtlasTargets: vi.fn(selectTextureAtlasTargets),
    createTextureAtlasSourceSignature: vi.fn(createTextureAtlasSourceSignature),
    sameTextureAtlasSourceSignature: vi.fn(sameTextureAtlasSourceSignature)
  };
}

function addRuntimeAngleKeyform(session: AuthoringSession): void {
  session.graph.parameters.push({
    parameterId: PARAM_NON_SOURCE,
    displayName: "Non Source Parameter",
    valueSource: "authoredInput",
    min: -30,
    default: 0,
    max: 30,
    recommendedUiStep: 1,
    kind: "custom",
    parameterType: "scalar",
    group: "custom",
    lockedFields: []
  });
  session.graph.keyformSets.push({
    keyformSetId: KeyformSetIdSchema.parse("keyset_viewer_atlas_non_source_angle"),
    target: {
      kind: "rigControl",
      id: RIG_ROOT,
      property: "angleDegrees"
    },
    parameterId: PARAM_NON_SOURCE,
    evaluator: "linear-1d-v1",
    interpolation: "linear-1d-v1",
    compositionMode: "replace",
    compositionOrder: 0,
    keys: [
      { value: -30, statePatch: -15 },
      { value: 30, statePatch: 15 }
    ]
  });
}

function createViewerAtlasFixtureSession(): AuthoringSession {
  const bodyBytes = createSolidRgbaBytes(2, 2, [255, 0, 0, 255]);
  const sleeveBytes = createSolidRgbaBytes(2, 2, [0, 255, 0, 255]);
  const poolBytes = createSolidRgbaBytes(2, 2, [0, 0, 255, 255]);
  const bodyRef = createTextureBinaryAssetReference("body", bodyBytes);
  const sleeveRef = createTextureBinaryAssetReference("sleeve", sleeveBytes);
  const poolRef = createTextureBinaryAssetReference("pool", poolBytes);
  const session: AuthoringSession = {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_viewer_atlas_fixture"),
      packageDisplayName: "Viewer atlas fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 3,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 16, height: 16 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_POOL],
          drawableIds: [DRAW_BODY, DRAW_SLEEVE],
          children: [
            { kind: "drawable", drawableId: DRAW_BODY },
            { kind: "drawable", drawableId: DRAW_SLEEVE },
            { kind: "part", partId: PART_POOL }
          ]
        },
        {
          partId: PART_POOL,
          displayName: "Drawable Pool",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_POOL],
          children: [{ kind: "drawable", drawableId: DRAW_POOL }]
        }
      ],
      drawables: [
        createDrawable(DRAW_BODY, MESH_BODY, TEX_BODY, "Body", 0),
        createDrawable(DRAW_SLEEVE, MESH_SLEEVE, TEX_SLEEVE, "Sleeve", 1),
        createDrawable(DRAW_POOL, MESH_POOL, TEX_POOL, "Pool", 2, PART_POOL)
      ],
      meshes: [
        createMesh(MESH_BODY, DRAW_BODY, { x: 0, y: 0, width: 2, height: 2 }),
        createMesh(MESH_SLEEVE, DRAW_SLEEVE, { x: 4, y: 0, width: 2, height: 2 }),
        createMesh(MESH_POOL, DRAW_POOL, { x: 8, y: 0, width: 2, height: 2 })
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RIG_ROOT,
          displayName: "Runtime Root",
          childDrawableIds: [DRAW_BODY, DRAW_SLEEVE],
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
        { drawableId: DRAW_SLEEVE, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: DRAW_POOL, baseDrawOrder: 2, stableOrder: 2 }
      ],
      rigControlRootIds: [RIG_ROOT],
      stableOrder: [PART_ROOT, DRAW_BODY, DRAW_SLEEVE, PART_POOL, DRAW_POOL],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          createTextureEntry(TEX_BODY, "body", bodyRef),
          createTextureEntry(TEX_SLEEVE, "sleeve", sleeveRef),
          createTextureEntry(TEX_POOL, "pool", poolRef)
        ]
      },
      provenanceRecords: [],
      rightsRecords: []
    }
  };

  registerTextureBytes(session, bodyRef, bodyBytes, TEX_BODY);
  registerTextureBytes(session, sleeveRef, sleeveBytes, TEX_SLEEVE);
  registerTextureBytes(session, poolRef, poolBytes, TEX_POOL);

  return session;
}

function createDrawable(
  drawableId: DrawableId,
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  textureId: TextureId,
  displayName: string,
  baseDrawOrder: number,
  partId: ReturnType<typeof PartIdSchema.parse> = PART_ROOT
) {
  return {
    drawableId,
    displayName,
    partId,
    sourceAssetId: SOURCE_ASSET,
    textureId,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder,
    sourceProvenanceId: PROVENANCE
  };
}

function createMesh(
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: DrawableId,
  bounds: RectDto
) {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  return {
    meshId,
    drawableId,
    vertices: [
      { x: bounds.x, y: bounds.y },
      { x: right, y: bounds.y },
      { x: right, y: bottom },
      { x: bounds.x, y: bottom }
    ],
    uvs: createUnitQuadUvs(),
    triangles: [
      [0, 1, 2],
      [0, 2, 3]
    ] as [number, number, number][],
    vertexStableIds: ["vtx_0", "vtx_1", "vtx_2", "vtx_3"],
    triangleStableIds: ["tri_0", "tri_1"],
    topologyRevision: 0,
    bounds,
    generationProvenanceId: PROVENANCE
  };
}

function createTextureEntry(
  textureId: TextureId,
  token: string,
  binaryAssetRef: BinaryAssetReference
) {
  return {
    textureId,
    filePath: `assets/textures/viewer-atlas-${token}.raw-rgba`,
    dimensions: {
      width: 2,
      height: 2,
      pixelFormat: "rgba8" as const
    },
    provenanceId: PROVENANCE,
    binaryAssetRef
  };
}

function createTextureBinaryAssetReference(
  token: string,
  bytes: Uint8Array
): BinaryAssetReference {
  return {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_viewer_atlas_${token}`,
    packageRelativePath: `assets/textures/viewer-atlas-${token}.raw-rgba`,
    digest: {
      algorithm: "sha256",
      hex: createDigestHex(token)
    },
    byteLength: bytes.byteLength,
    mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: PROVENANCE,
    rightsAssetId: SOURCE_ASSET
  };
}

function registerTextureBytes(
  session: AuthoringSession,
  binaryAssetRef: BinaryAssetReference,
  bytes: Uint8Array,
  textureId: TextureId
): void {
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes,
    role: "texture-raster-v1",
    sourceAssetId: SOURCE_ASSET,
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

function createUnitQuadUvs() {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ];
}

function requireDrawable(
  projection: ReturnType<typeof createCanvasRenderProjection>,
  drawableId: DrawableId
) {
  const drawable = projection.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined) {
    throw new Error(`Expected drawable ${drawableId}.`);
  }

  return drawable;
}

function requireAtlasPage(session: AuthoringSession) {
  const page = session.graph.textureAtlas?.layoutSummary?.pages[0];
  if (page === undefined) {
    throw new Error("Expected atlas page.");
  }

  return page;
}

function requireAtlasTextureEntry(session: AuthoringSession) {
  const atlasTextureId = session.graph.textureAtlas?.layoutSummary?.atlasTextureId;
  const texture = session.graph.textureAtlas?.textures.find(
    (candidate) => candidate.textureId === atlasTextureId
  );
  if (texture === undefined) {
    throw new Error("Expected atlas texture entry.");
  }

  return texture;
}

function requirePlacement(session: AuthoringSession, drawableId: DrawableId) {
  const placement = requireAtlasPage(session).placements.find(
    (candidate) => candidate.drawableId === drawableId
  );
  if (placement === undefined) {
    throw new Error(`Expected atlas placement for ${drawableId}.`);
  }

  return placement;
}

function requireBinaryEntry(session: AuthoringSession, binaryAssetRef: BinaryAssetReference) {
  const entry = session.binaryAssets?.fileEntries.find(
    (candidate) => candidate.path === binaryAssetRef.packageRelativePath
  );
  if (entry === undefined) {
    throw new Error("Expected binary entry.");
  }

  return entry;
}

function createDigestHex(seed: string): string {
  let hash = "";
  for (let index = 0; index < 64; index += 1) {
    hash += ((seed.charCodeAt(index % seed.length) + index) % 16).toString(16);
  }

  return hash;
}
