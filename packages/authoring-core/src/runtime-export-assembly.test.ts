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
  TriangleIdSchema,
  VertexIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  BinaryAssetReferenceSchema,
  RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION,
  computePackageBinarySha256Digest,
  createPackageBinaryFileEntry,
  getPackageBinaryByteLength,
  type BinaryAssetReferenceDto,
  type VariantGroupDto
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { registerAuthoringSessionBinaryBytes } from "./binary-byte-registration.js";
import { assembleRuntimeExport, preflightRuntimeExport } from "./runtime-export-assembly.js";
import { applyTextureAtlasPreview } from "./texture-atlas-mutations.js";
import { createTextureAtlasPreview } from "./texture-atlas-packing.js";
import { selectTextureAtlasTargets } from "./texture-atlas-targets.js";

const CREATED_AT = "2026-06-20T00:00:00.000Z";
const PART_ROOT = PartIdSchema.parse("part_root");
const PART_HIDDEN = PartIdSchema.parse("part_hidden");
const PART_POOL = PartIdSchema.parse("part_pool");
const DRAW_BODY = DrawableIdSchema.parse("draw_body");
const DRAW_HIDDEN = DrawableIdSchema.parse("draw_hidden");
const DRAW_POOL = DrawableIdSchema.parse("draw_pool");
const MESH_BODY = MeshIdSchema.parse("mesh_body");
const MESH_HIDDEN = MeshIdSchema.parse("mesh_hidden");
const MESH_POOL = MeshIdSchema.parse("mesh_pool");
const TEX_BODY = TextureIdSchema.parse("tex_body");
const TEX_HIDDEN = TextureIdSchema.parse("tex_hidden");
const TEX_POOL = TextureIdSchema.parse("tex_pool");
const SRC_FIXTURE = SourceAssetIdSchema.parse("src_runtime_export_fixture");
const PROV_FIXTURE = ProvenanceIdSchema.parse("prov_runtime_export_fixture");

describe("runtime export assembly and preflight", () => {
  it("produces Runtime Export manifest, model, atlas, and raw texture entries for a current committed atlas", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.fileSet.map((entry) => entry.path)).toEqual([
      "runtime-export.json",
      "runtime/model.json",
      "runtime/atlas.json",
      "assets/textures/atlas_page_0.raw-rgba"
    ]);
    expect(result.preflight.targetSummary).toMatchObject({
      includedDrawableCount: 2,
      excludedUnboundDrawableCount: 1,
      atlasPageCount: 1,
      texturePageCount: 1
    });
    expect(result.preflight.targetSummary.excludedUnboundDrawableIds).toEqual([DRAW_POOL]);
    expect(result.preflight.warnings).toEqual([]);
    expect(result.artifacts.manifest).toMatchObject({
      schemaVersion: "runtime-export-manifest-v0",
      exportFormatVersion: "runtime-export-v0",
      createdAt: CREATED_AT,
      paths: {
        manifest: "runtime-export.json",
        model: "runtime/model.json",
        atlas: "runtime/atlas.json",
        texturePages: ["assets/textures/atlas_page_0.raw-rgba"]
      }
    });
    expect(result.artifacts.model.drawables.map((drawable) => drawable.drawableId)).toEqual([
      DRAW_BODY,
      DRAW_HIDDEN
    ]);
    expect(result.artifacts.model.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      baseVisible: drawable.baseVisible,
      visible: drawable.visible
    }))).toEqual([
      {
        drawableId: DRAW_BODY,
        baseVisible: true,
        visible: true
      },
      {
        drawableId: DRAW_HIDDEN,
        baseVisible: false,
        visible: false
      }
    ]);
    expect(result.artifacts.model.drawables.map((drawable) => drawable.texture.path)).toEqual([
      "assets/textures/atlas_page_0.raw-rgba",
      "assets/textures/atlas_page_0.raw-rgba"
    ]);
    expect(result.artifacts.model.variants).toBeUndefined();
    expect(result.artifacts.atlas.placements.map((placement) => placement.drawableId)).toEqual([
      DRAW_BODY,
      DRAW_HIDDEN
    ]);
    expect(result.texturePageBytes[0]?.bytes.byteLength).toBe(8 * 4 * 4);
  });

  it("materializes Variant metadata and applies default active selection to initial visibility", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    const variantGroup = createOutfitVariantGroup();
    session.graph.variantGroups = [variantGroup];

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.artifacts.model.variants).toEqual({
      schemaVersion: RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION,
      variantGroups: [variantGroup],
      defaultActiveSelections: [
        {
          variantGroupId: "vgrp_outfit",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_outfit_default"
          }
        }
      ]
    });
    expect(result.artifacts.model.drawables.find((drawable) =>
      drawable.drawableId === DRAW_BODY
    )?.baseVisible).toBe(true);
    expect(result.artifacts.model.drawables.find((drawable) =>
      drawable.drawableId === DRAW_BODY
    )?.visible).toBe(false);
    expect(result.artifacts.model.drawables.find((drawable) =>
      drawable.drawableId === DRAW_HIDDEN
    )?.baseVisible).toBe(false);
    expect(result.artifacts.model.drawables.find((drawable) =>
      drawable.drawableId === DRAW_HIDDEN
    )?.visible).toBe(false);
  });

  it("filters Runtime Export Variant targets and memberships to exported drawables", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    session.graph.variantGroups = [createOutfitVariantGroupWithExcludedPool()];

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.artifacts.model.drawables.map((drawable) => drawable.drawableId)).toEqual([
      DRAW_BODY,
      DRAW_HIDDEN
    ]);
    expect(result.artifacts.model.variants?.variantGroups).toEqual([
      {
        ...createOutfitVariantGroup(),
        targetDrawableIds: [DRAW_BODY, DRAW_HIDDEN],
        memberships: [
          { drawableId: DRAW_BODY, variantIds: ["var_outfit_alt"] },
          { drawableId: DRAW_HIDDEN, variantIds: ["var_outfit_default"] }
        ]
      }
    ]);
    expect(result.artifacts.model.variants?.defaultActiveSelections).toEqual([
      {
        variantGroupId: "vgrp_outfit",
        activeSelection: {
          kind: "singleSelect",
          variantId: "var_outfit_default"
        }
      }
    ]);
  });

  it("keeps Texture Atlas targets bound-drawable based for default-hidden Variant drawables", async () => {
    const session = await createRuntimeExportFixtureSession();
    session.graph.variantGroups = [createOutfitVariantGroup()];

    const selection = selectTextureAtlasTargets(session);

    expect(selection.boundDrawableIds).toEqual([DRAW_BODY, DRAW_HIDDEN]);
    expect(selection.included.map((target) => target.drawableId)).toEqual([
      DRAW_BODY,
      DRAW_HIDDEN
    ]);
    expect(selection.packableTargets.map((target) => target.drawable.drawableId)).toEqual([
      DRAW_BODY,
      DRAW_HIDDEN
    ]);
  });

  it("does not stale Runtime Export when only Variant membership or default active changes", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();

    expect((await preflightRuntimeExport(session)).status).toBe("ready");

    session.graph.variantGroups = [createOutfitVariantGroup()];
    expect((await preflightRuntimeExport(session)).status).toBe("ready");

    session.graph.variantGroups[0]!.defaultActive = {
      kind: "singleSelect",
      variantId: "var_outfit_alt"
    };
    expect((await preflightRuntimeExport(session)).status).toBe("ready");

    session.graph.variantGroups[0]!.memberships[0]!.variantIds = ["var_outfit_default"];
    expect((await preflightRuntimeExport(session)).status).toBe("ready");
  });

  it("hard-blocks when no committed atlas exists", async () => {
    const session = await createRuntimeExportFixtureSession();

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      return;
    }
    expect(result.preflight.blockers.map((blocker) => blocker.code)).toEqual([
      "runtimeExport.noCommittedAtlas"
    ]);
  });

  it("hard-blocks stale atlases against current source inputs", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    session.graph.meshes.find((mesh) => mesh.meshId === MESH_BODY)!.uvs[1] = { x: 0.5, y: 0 };

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      return;
    }
    expect(result.preflight.blockers.map((blocker) => blocker.code)).toContain(
      "runtimeExport.staleAtlas"
    );
  });

  it("hard-blocks when committed atlas bytes are missing", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    removeGeneratedAtlasBytes(session);

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      return;
    }
    expect(result.preflight.blockers.map((blocker) => blocker.code)).toContain(
      "runtimeExport.missingAtlasBytes"
    );
  });

  it("hard-blocks digest, byte length, and media type mismatches for atlas bytes", async () => {
    const digestMismatch = await createAppliedRuntimeExportFixtureSession();
    getGeneratedAtlasBinaryEntry(digestMismatch).bytes[0] = 12;
    await expectBlocker(digestMismatch, "runtimeExport.atlasDigestMismatch");

    const byteLengthMismatch = await createAppliedRuntimeExportFixtureSession();
    replaceGeneratedAtlasBinaryEntry(byteLengthMismatch, new Uint8Array(4));
    await expectBlocker(byteLengthMismatch, "runtimeExport.atlasByteLengthMismatch");

    const mediaTypeMismatch = await createAppliedRuntimeExportFixtureSession();
    replaceGeneratedAtlasBinaryEntry(
      mediaTypeMismatch,
      getGeneratedAtlasBinaryEntry(mediaTypeMismatch).bytes,
      "application/octet-stream"
    );
    await expectBlocker(mediaTypeMismatch, "runtimeExport.atlasMediaTypeMismatch");
  });

  it("hard-blocks missing or invalid placement data", async () => {
    const missingPlacement = await createAppliedRuntimeExportFixtureSession();
    missingPlacement.graph.textureAtlas!.layoutSummary!.pages[0]!.placements =
      missingPlacement.graph.textureAtlas!.layoutSummary!.pages[0]!.placements.filter((placement) =>
        placement.drawableId !== DRAW_BODY
      );
    await expectBlocker(missingPlacement, "runtimeExport.uncoveredRuntimeTarget");

    const invalidPlacement = await createAppliedRuntimeExportFixtureSession();
    invalidPlacement.graph.textureAtlas!.layoutSummary!.pages[0]!.placements[0]!.uvRect = {
      topLeft: { x: 0.75, y: 0.25 },
      bottomRight: { x: 0.25, y: 0.75 }
    };
    await expectBlocker(invalidPlacement, "runtimeExport.invalidPlacementData");
  });

  it("accepts non-zero-inset placements whose uvRect is the content sub-rect", async () => {
    // Wave109 reconcile: since Wave108 the placement uvRect is the content
    // sub-rect (raster inset by the source texture's contentInset), not the whole
    // raster. Packing already writes the inset uvRect; before Wave109 the preflight
    // validator still required uvRect == contentRect and falsely blocked every
    // non-zero-inset placement. Here the body texture carries a real contentInset,
    // so packing writes an inset uvRect and preflight must accept it.
    const session = await createInsetRuntimeExportFixtureSession();

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      expect(result.preflight.blockers.map((blocker) => blocker.code)).toEqual([]);
    }
  });

  it("still blocks a placement whose uvRect ignores the source contentInset (old contract)", async () => {
    // Validation force: the reconcile must not weaken the check. A placement that
    // reverts to the pre-Wave108 value (the whole content rect normalized, i.e.
    // inset ignored) must still be rejected.
    const session = await createInsetRuntimeExportFixtureSession();
    const page = session.graph.textureAtlas!.layoutSummary!.pages[0]!;
    const bodyPlacement = page.placements.find((placement) => placement.drawableId === DRAW_BODY)!;
    bodyPlacement.uvRect = {
      topLeft: {
        x: bodyPlacement.contentRectPixels.x / page.width,
        y: bodyPlacement.contentRectPixels.y / page.height
      },
      bottomRight: {
        x: (bodyPlacement.contentRectPixels.x + bodyPlacement.contentRectPixels.width) / page.width,
        y: (bodyPlacement.contentRectPixels.y + bodyPlacement.contentRectPixels.height) / page.height
      }
    };

    await expectBlocker(session, "runtimeExport.invalidPlacementData");
  });

  it("materializes mesh UVs in atlas page coordinates", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    const bodyMesh = result.artifacts.model.meshes.find((mesh) => mesh.meshId === MESH_BODY);
    expect(bodyMesh?.atlasUvs).toEqual([
      { x: 1 / 8, y: 1 / 4 },
      { x: 3 / 8, y: 1 / 4 },
      { x: 3 / 8, y: 3 / 4 },
      { x: 1 / 8, y: 3 / 4 }
    ]);
  });

  it("includes only masks whose sources and targets are included drawables", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    session.graph.masks = [{
      maskRelationId: MaskRelationIdSchema.parse("maskrel_body_hidden"),
      maskDrawableIds: [DRAW_BODY],
      targetDrawableIds: [DRAW_HIDDEN],
      enabled: true
    }];

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.artifacts.model.masks).toEqual([
      {
        maskRelationId: "maskrel_body_hidden",
        sourceDrawableIds: [DRAW_BODY],
        targetDrawableIds: [DRAW_HIDDEN],
        clippingMode: "alpha-mask-v1",
        coordinateSpace: "canvas-y-down-v1"
      }
    ]);
  });

  it("fails deterministically for included masks that reference excluded drawables", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    session.graph.masks = [{
      maskRelationId: MaskRelationIdSchema.parse("maskrel_pool_body"),
      maskDrawableIds: [DRAW_POOL],
      targetDrawableIds: [DRAW_BODY],
      enabled: true
    }];

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      return;
    }
    expect(result.preflight.blockers.map((blocker) => blocker.code)).toContain(
      "runtimeExport.unsupportedMaskReference"
    );
  });

  it("keeps Validate warnings as non-blocking preflight warnings", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();

    const result = await assembleRuntimeExport(session, {
      createdAt: CREATED_AT,
      validateWarningCount: 2
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.preflight.warnings).toEqual([
      {
        code: "runtimeExport.validateWarningsPresent",
        targetPath: "/validate",
        message: "Validate has warnings. Open Validate to inspect them before exporting.",
        details: ["warningCount=2"]
      }
    ]);
    expect(result.preflight.targetSummary.validateWarningCount).toBe(2);
  });

  it("does not include source originals, workspace data, editor data, or diagnostics payloads", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    await attachSourceOriginalBytes(session);

    const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      return;
    }
    expect(result.fileSet.map((entry) => entry.path)).not.toContain("assets/sources/source.psd");
    const textPayload = result.fileSet
      .map((entry) => "text" in entry ? entry.text : "")
      .join("\n");
    expect(textPayload).not.toContain("source.psd");
    expect(textPayload).not.toContain("assets/sources");
    expect(textPayload).not.toContain("sourceAssets");
    expect(textPayload).not.toContain("editorState");
    expect(textPayload).not.toContain("workspace");
    expect(textPayload).not.toContain("diagnostics");
  });

  it("exposes a standalone preflight API", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();

    const preflight = await preflightRuntimeExport(session, { validateWarningCount: 1 });

    expect(preflight.status).toBe("ready");
    expect(preflight.warnings.map((warning) => warning.code)).toEqual([
      "runtimeExport.validateWarningsPresent"
    ]);
  });
});

const expectBlocker = async (
  session: AuthoringSession,
  code: string
): Promise<void> => {
  const result = await assembleRuntimeExport(session, { createdAt: CREATED_AT });

  expect(result.status).toBe("blocked");
  if (result.status !== "blocked") {
    return;
  }
  expect(result.preflight.blockers.map((blocker) => blocker.code)).toContain(code);
};

const createOutfitVariantGroup = (): VariantGroupDto => ({
  variantGroupId: "vgrp_outfit",
  displayName: "Outfit",
  mode: "singleSelect",
  variants: [
    { variantId: "var_outfit_default", displayName: "Default" },
    { variantId: "var_outfit_alt", displayName: "Alt" }
  ],
  targetDrawableIds: [DRAW_BODY, DRAW_HIDDEN],
  memberships: [
    { drawableId: DRAW_BODY, variantIds: ["var_outfit_alt"] },
    { drawableId: DRAW_HIDDEN, variantIds: ["var_outfit_default"] }
  ],
  defaultActive: {
    kind: "singleSelect",
    variantId: "var_outfit_default"
  }
});

const createOutfitVariantGroupWithExcludedPool = (): VariantGroupDto => ({
  ...createOutfitVariantGroup(),
  targetDrawableIds: [DRAW_BODY, DRAW_HIDDEN, DRAW_POOL],
  memberships: [
    { drawableId: DRAW_BODY, variantIds: ["var_outfit_alt"] },
    { drawableId: DRAW_HIDDEN, variantIds: ["var_outfit_default"] },
    { drawableId: DRAW_POOL, variantIds: ["var_outfit_default"] }
  ]
});

const createAppliedRuntimeExportFixtureSession = async (): Promise<AuthoringSession> => {
  const session = await createRuntimeExportFixtureSession();
  const preview = createTextureAtlasPreview(session, {
    pageWidth: 8,
    pageHeight: 4,
    paddingPixels: 1,
    edgeExtrusionEnabled: true,
    edgeExtrusionPixels: 1
  });

  const result = await applyTextureAtlasPreview(session, { preview });
  if (result.status !== "applied") {
    throw new Error(`Expected applied atlas: ${result.warnings.map((warning) => warning.code).join(",")}`);
  }

  return session;
};

const createInsetRuntimeExportFixtureSession = async (): Promise<AuthoringSession> => {
  const session = await createRuntimeExportFixtureSession();
  // Plant a non-zero contentInset on the body source texture so packing writes an
  // inset content-sub-rect uvRect (2px raster, inset {left:1,bottom:1} → 1px content).
  // The atlas bake bytes/dimensions are unchanged, so digest/byteLength stay valid and
  // the atlas source signature (which does not include contentInset) stays fresh.
  const bodyTexture = session.graph.textureAtlas!.textures.find(
    (texture) => texture.textureId === TEX_BODY
  )!;
  bodyTexture.contentInset = { left: 1, top: 0, right: 0, bottom: 1 };

  const preview = createTextureAtlasPreview(session, {
    pageWidth: 8,
    pageHeight: 4,
    paddingPixels: 1,
    edgeExtrusionEnabled: true,
    edgeExtrusionPixels: 1
  });
  const result = await applyTextureAtlasPreview(session, { preview });
  if (result.status !== "applied") {
    throw new Error(`Expected applied atlas: ${result.warnings.map((warning) => warning.code).join(",")}`);
  }

  return session;
};

const createRuntimeExportFixtureSession = async (): Promise<AuthoringSession> => {
  const bodyBytes = createSolidRgbaBytes(2, 2, [255, 0, 0, 255]);
  const hiddenBytes = createSolidRgbaBytes(2, 2, [0, 255, 0, 255]);
  const poolBytes = createSolidRgbaBytes(2, 2, [0, 0, 255, 255]);
  const bodyRef = await createTextureBinaryAssetReference("body", bodyBytes);
  const hiddenRef = await createTextureBinaryAssetReference("hidden", hiddenBytes);
  const poolRef = await createTextureBinaryAssetReference("pool", poolBytes);
  const session: AuthoringSession = {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_runtime_export_core_test"),
      packageDisplayName: "Runtime Export Core Test",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 64, height: 64 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_HIDDEN, PART_POOL],
          drawableIds: [DRAW_BODY],
          children: [
            { kind: "drawable", drawableId: DRAW_BODY },
            { kind: "part", partId: PART_HIDDEN },
            { kind: "part", partId: PART_POOL }
          ]
        },
        {
          partId: PART_HIDDEN,
          displayName: "Hidden",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_HIDDEN],
          children: [{ kind: "drawable", drawableId: DRAW_HIDDEN }]
        },
        {
          partId: PART_POOL,
          displayName: "Pool Part",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_POOL],
          children: [{ kind: "drawable", drawableId: DRAW_POOL }]
        }
      ],
      drawables: [
        createDrawable(DRAW_BODY, "Body", PART_ROOT, TEX_BODY, MESH_BODY, true, 0),
        createDrawable(DRAW_HIDDEN, "Hidden", PART_HIDDEN, TEX_HIDDEN, MESH_HIDDEN, false, 1),
        createDrawable(DRAW_POOL, "Pool", PART_POOL, TEX_POOL, MESH_POOL, true, 2)
      ],
      meshes: [
        createQuadMesh(MESH_BODY, DRAW_BODY),
        createQuadMesh(MESH_HIDDEN, DRAW_HIDDEN),
        createQuadMesh(MESH_POOL, DRAW_POOL)
      ],
      parameters: [
        {
          parameterId: ParameterIdSchema.parse("param_face_yaw"),
          displayName: "Face Yaw",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        },
        {
          parameterId: ParameterIdSchema.parse("param_hair_sway"),
          displayName: "Hair Sway",
          semanticRole: "dynamics",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      ],
      keyformSets: [
        {
          keyformSetId: KeyformSetIdSchema.parse("keyset_body_opacity"),
          target: { kind: "drawable", id: DRAW_BODY, property: "opacity" },
          parameterId: ParameterIdSchema.parse("param_face_yaw"),
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "multiplyOpacity",
          compositionOrder: 0,
          keys: [
            { value: -1, statePatch: 0.5 },
            { value: 1, statePatch: 1 }
          ]
        }
      ],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RigControlIdSchema.parse("rig_root"),
          displayName: "Root Rig",
          childDrawableIds: [DRAW_BODY, DRAW_HIDDEN],
          childRigControlIds: [],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ],
      dynamicsGroups: [
        {
          dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_hair"),
          displayName: "Hair",
          enabled: true,
          inputs: [
            {
              parameterId: ParameterIdSchema.parse("param_face_yaw"),
              kind: "angle",
              scale: 30
            }
          ],
          chain: {
            rootOffset: { x: 0, y: 0 },
            segmentLengths: [14],
            damping: 2.5,
            gravityScale: 1
          },
          outputs: [
            {
              parameterId: ParameterIdSchema.parse("param_hair_sway"),
              segmentIndex: 1,
              scale: 0.0333,
              limit: 1
            }
          ]
        }
      ],
      masks: [],
      drawOrder: [
        { drawableId: DRAW_BODY, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_HIDDEN, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: DRAW_POOL, baseDrawOrder: 2, stableOrder: 2 }
      ],
      rigControlRootIds: [RigControlIdSchema.parse("rig_root")],
      stableOrder: ["part_root", "draw_body", "draw_hidden", "draw_pool"],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          createTextureEntry(TEX_BODY, "body", bodyRef),
          createTextureEntry(TEX_HIDDEN, "hidden", hiddenRef),
          createTextureEntry(TEX_POOL, "pool", poolRef)
        ]
      },
      provenanceRecords: [
        {
          provenanceId: PROV_FIXTURE,
          assetId: SRC_FIXTURE,
          assetKind: "generatedFixture",
          filePath: "assets/sources/generated/runtime-export-fixture.json",
          creator: "runtime-export-core-test",
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
      ]
    }
  };

  registerTextureBytes(session, bodyRef, bodyBytes, TEX_BODY);
  registerTextureBytes(session, hiddenRef, hiddenBytes, TEX_HIDDEN);
  registerTextureBytes(session, poolRef, poolBytes, TEX_POOL);

  return session;
};

const createDrawable = (
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  displayName: string,
  partId: ReturnType<typeof PartIdSchema.parse>,
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  runtimeVisibility: boolean,
  baseDrawOrder: number
) => ({
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
});

const createQuadMesh = (
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: ReturnType<typeof DrawableIdSchema.parse>
) => ({
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
});

const createTextureEntry = (
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  token: string,
  binaryAssetRef: BinaryAssetReferenceDto
) => ({
  textureId,
  filePath: `assets/textures/${token}.raw-rgba`,
  dimensions: {
    width: 2,
    height: 2,
    pixelFormat: "rgba8" as const
  },
  provenanceId: PROV_FIXTURE,
  binaryAssetRef
});

const registerTextureBytes = (
  session: AuthoringSession,
  binaryAssetRef: BinaryAssetReferenceDto,
  bytes: Uint8Array,
  textureId: ReturnType<typeof TextureIdSchema.parse>
): void => {
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes,
    role: "texture-raster-v1",
    sourceAssetId: SRC_FIXTURE,
    textureId
  });
};

const createTextureBinaryAssetReference = async (
  token: string,
  bytes: Uint8Array
): Promise<BinaryAssetReferenceDto> =>
  createBinaryAssetReference({
    token,
    bytes,
    packageRelativePath: `assets/textures/${token}.raw-rgba`,
    mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8"
  });

const createBinaryAssetReference = async (input: {
  readonly token: string;
  readonly bytes: Uint8Array;
  readonly packageRelativePath: string;
  readonly mediaType: string;
}): Promise<BinaryAssetReferenceDto> => {
  const digestResult = await computePackageBinarySha256Digest(input.bytes);
  if (digestResult.status !== "computed") {
    throw new Error("SHA-256 digest support is required for runtime export tests.");
  }

  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${input.token}_rgba`,
    packageRelativePath: input.packageRelativePath,
    digest: digestResult.digest,
    byteLength: getPackageBinaryByteLength(input.bytes),
    mediaType: input.mediaType,
    storageStatus: "stored-package-local-v1",
    provenanceId: PROV_FIXTURE,
    rightsAssetId: SRC_FIXTURE
  });
};

const createSolidRgbaBytes = (
  width: number,
  height: number,
  color: readonly [number, number, number, number]
): Uint8Array => {
  const bytes = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    bytes[index * 4] = color[0];
    bytes[index * 4 + 1] = color[1];
    bytes[index * 4 + 2] = color[2];
    bytes[index * 4 + 3] = color[3];
  }

  return bytes;
};

const getGeneratedAtlasBinaryEntry = (session: AuthoringSession) => {
  const entry = session.binaryAssets?.fileEntries.find((candidate) =>
    candidate.path === "assets/textures/generated_atlas_page_0.raw-rgba"
  );
  if (entry === undefined) {
    throw new Error("Expected generated atlas binary entry.");
  }

  return entry;
};

const removeGeneratedAtlasBytes = (session: AuthoringSession): void => {
  const entries = session.binaryAssets?.fileEntries;
  if (entries === undefined) {
    return;
  }

  entries.splice(
    0,
    entries.length,
    ...entries.filter((entry) => entry.path !== "assets/textures/generated_atlas_page_0.raw-rgba")
  );
};

const replaceGeneratedAtlasBinaryEntry = (
  session: AuthoringSession,
  bytes: Uint8Array,
  mediaType = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8"
): void => {
  const entries = session.binaryAssets?.fileEntries;
  if (entries === undefined) {
    throw new Error("Expected binary assets.");
  }
  const index = entries.findIndex((entry) =>
    entry.path === "assets/textures/generated_atlas_page_0.raw-rgba"
  );
  if (index === -1) {
    throw new Error("Expected generated atlas binary entry.");
  }
  const existing = entries[index]!;

  entries.splice(index, 1, createPackageBinaryFileEntry({
    path: existing.path,
    bytes,
    mediaType,
    ...(existing.binaryAssetId === undefined ? {} : { binaryAssetId: existing.binaryAssetId })
  }));
};

const attachSourceOriginalBytes = async (session: AuthoringSession): Promise<void> => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const binaryAssetRef = await createBinaryAssetReference({
    token: "source_original",
    bytes,
    packageRelativePath: "assets/sources/source.psd",
    mediaType: "application/octet-stream"
  });

  session.graph.sourceAssets = [{
    sourceAssetId: SRC_FIXTURE,
    kind: "psd-source-v1",
    filePath: "source.psd",
    contentHash: `sha256:${binaryAssetRef.digest.hex}`,
    importProfile: "layered-character-psd-profile-v1",
    layers: [],
    diagnostics: ["source.psd.warning"],
    binaryAssetRef
  }];
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes,
    role: "source-original-v1",
    sourceAssetId: SRC_FIXTURE
  });
};
