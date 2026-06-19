import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
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
  computePackageBinarySha256Digest,
  getPackageBinaryByteLength,
  type BinaryAssetReferenceDto
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import {
  getAuthoringSessionBinaryFileEntries,
  registerAuthoringSessionBinaryBytes
} from "./binary-byte-registration.js";
import {
  exportAuthoringSessionPortableBundle,
  importAuthoringSessionPortableBundle
} from "./portable-project-bundle.js";
import { createTextureAtlasPreview } from "./texture-atlas-packing.js";
import { selectTextureAtlasTargets } from "./texture-atlas-targets.js";
import { applyTextureAtlasPreview } from "./texture-atlas-mutations.js";

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
const SRC_FIXTURE = SourceAssetIdSchema.parse("src_texture_atlas_fixture");
const PROV_FIXTURE = ProvenanceIdSchema.parse("prov_texture_atlas_fixture");

describe("texture atlas core mutation", () => {
  it("selects bound runtime drawables, marks hidden targets, and excludes Drawable Pool drawables", async () => {
    const session = await createTextureAtlasFixtureSession();

    const selection = selectTextureAtlasTargets(session, {
      editorHiddenPartIds: [PART_HIDDEN]
    });

    expect(selection.included.map((target) => target.drawableId)).toEqual([
      DRAW_BODY,
      DRAW_HIDDEN
    ]);
    expect(selection.included.find((target) => target.drawableId === DRAW_HIDDEN)).toMatchObject({
      currentlyHidden: true,
      hiddenReasons: ["runtime-visibility-off", "editor-part-hidden"],
      packable: true
    });
    expect(selection.excluded).toEqual([
      {
        drawableId: DRAW_POOL,
        displayName: "Pool",
        reason: "unboundDrawablePool",
        targetPath: "/model/drawables/draw_pool"
      }
    ]);
    expect(selection.warnings).toEqual([]);
    const bodyBytes = session.binaryAssets?.fileEntries.find((entry) =>
      entry.path === "assets/textures/body.raw-rgba"
    )?.bytes;
    expect(selection.packableTargets.find((target) =>
      target.drawable.drawableId === DRAW_BODY
    )?.textureBytes).toBe(bodyBytes);
  });

  it("emits deterministic target warnings for missing texture, mesh, binary, and invalid UV inputs", async () => {
    const missingTexture = await createTextureAtlasFixtureSession();
    missingTexture.graph.textureAtlas!.textures = missingTexture.graph.textureAtlas!.textures
      .filter((texture) => texture.textureId !== TEX_BODY);
    expect(selectTextureAtlasTargets(missingTexture).warnings.map(pickWarning)).toContainEqual({
      code: "atlas.target.missingTextureEntry",
      targetPath: "/assets/textureAtlas/textures/tex_body",
      drawableId: DRAW_BODY
    });

    const missingMesh = await createTextureAtlasFixtureSession();
    missingMesh.graph.meshes = missingMesh.graph.meshes
      .filter((mesh) => mesh.meshId !== MESH_BODY);
    expect(selectTextureAtlasTargets(missingMesh).warnings.map(pickWarning)).toContainEqual({
      code: "atlas.target.missingMesh",
      targetPath: "/model/meshes/mesh_body",
      drawableId: DRAW_BODY
    });

    const missingBinaryRef = await createTextureAtlasFixtureSession();
    delete missingBinaryRef.graph.textureAtlas!.textures[0]!.binaryAssetRef;
    expect(selectTextureAtlasTargets(missingBinaryRef).warnings.map(pickWarning)).toContainEqual({
      code: "atlas.target.missingTextureBinaryRef",
      targetPath: "/assets/textureAtlas/textures/tex_body/binaryAssetRef",
      drawableId: DRAW_BODY
    });

    const missingBytes = await createTextureAtlasFixtureSession();
    const missingByteEntries = missingBytes.binaryAssets!.fileEntries;
    missingByteEntries.splice(
      0,
      missingByteEntries.length,
      ...missingByteEntries.filter((entry) => entry.path !== "assets/textures/body.raw-rgba")
    );
    expect(selectTextureAtlasTargets(missingBytes).warnings.map(pickWarning)).toContainEqual({
      code: "atlas.target.missingTextureBytes",
      targetPath: "/binaryAssets/assets/textures/body.raw-rgba",
      drawableId: DRAW_BODY
    });

    const invalidUvs = await createTextureAtlasFixtureSession();
    invalidUvs.graph.meshes[0]!.uvs = invalidUvs.graph.meshes[0]!.uvs.slice(0, 3);
    expect(selectTextureAtlasTargets(invalidUvs).warnings.map(pickWarning)).toContainEqual({
      code: "atlas.target.invalidMeshUvCardinality",
      targetPath: "/model/meshes/mesh_body/uvs",
      drawableId: DRAW_BODY
    });
  });

  it("packs a deterministic single page and fails safely when a target cannot fit", async () => {
    const session = await createTextureAtlasFixtureSession();
    const first = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1,
      edgeExtrusionEnabled: true,
      edgeExtrusionPixels: 1
    });
    const second = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1,
      edgeExtrusionEnabled: true,
      edgeExtrusionPixels: 1
    });

    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") {
      return;
    }

    expect(first.layoutSummary).toEqual(second.layoutSummary);
    expect(first.layoutSummary.pages[0]?.placements.map((placement) => ({
      drawableId: placement.drawableId,
      contentRectPixels: placement.contentRectPixels,
      paddedRectPixels: placement.paddedRectPixels
    }))).toEqual([
      {
        drawableId: DRAW_BODY,
        contentRectPixels: { x: 1, y: 1, width: 2, height: 2 },
        paddedRectPixels: { x: 0, y: 0, width: 4, height: 4 }
      },
      {
        drawableId: DRAW_HIDDEN,
        contentRectPixels: { x: 5, y: 1, width: 2, height: 2 },
        paddedRectPixels: { x: 4, y: 0, width: 4, height: 4 }
      }
    ]);

    const cannotFit = createTextureAtlasPreview(session, {
      pageWidth: 3,
      pageHeight: 3,
      paddingPixels: 1
    });

    expect(cannotFit.status).toBe("failed");
    expect(cannotFit.warnings.map((warning) => warning.code)).toContain("atlas.pack.cannotFit");
  });

  it("tracks atlas source signature freshness from source inputs only", async () => {
    const session = await createTextureAtlasFixtureSession();
    const baseDigest = createReadySourceSignatureDigest(session);

    const uvChanged = structuredClone(session);
    uvChanged.graph.meshes[0]!.uvs[1] = { x: 0.75, y: 0 };
    expect(createReadySourceSignatureDigest(uvChanged)).not.toBe(baseDigest);

    const topologyChanged = structuredClone(session);
    topologyChanged.graph.meshes[0]!.topologyRevision = 7;
    expect(createReadySourceSignatureDigest(topologyChanged)).not.toBe(baseDigest);

    const sourceTextureBytesChanged = structuredClone(session);
    const bodyBytes = sourceTextureBytesChanged.binaryAssets?.fileEntries.find((entry) =>
      entry.path === "assets/textures/body.raw-rgba"
    )?.bytes;
    if (bodyBytes === undefined) {
      throw new Error("Expected fixture body texture bytes.");
    }
    bodyBytes[0] = 128;
    expect(createReadySourceSignatureDigest(sourceTextureBytesChanged)).not.toBe(baseDigest);

    const membershipChanged = structuredClone(session);
    membershipChanged.graph.rigControls[0]!.childDrawableIds = [DRAW_BODY];
    expect(createReadySourceSignatureDigest(membershipChanged)).not.toBe(baseDigest);

    const settingsChanged = createTextureAtlasPreview(session, {
      pageWidth: 16,
      pageHeight: 4,
      paddingPixels: 1,
      edgeExtrusionEnabled: true,
      edgeExtrusionPixels: 1
    });
    expect(settingsChanged.status).toBe("ready");
    if (settingsChanged.status !== "ready") {
      return;
    }
    expect(settingsChanged.layoutSummary.sourceSignature?.digest).not.toBe(baseDigest);

    const nonSourceChanged = structuredClone(session);
    const nonSourceRigControl = nonSourceChanged.graph.rigControls[0];
    if (nonSourceRigControl?.kind !== "rotation2d") {
      throw new Error("Expected fixture rotation rig control.");
    }
    nonSourceRigControl.restAngleDegrees = 45;
    nonSourceChanged.graph.keyformSets = [
      {
        keyformSetId: KeyformSetIdSchema.parse("keyset_atlas_non_source"),
        target: {
          kind: "drawable",
          id: DRAW_BODY,
          property: "opacity"
        },
        parameterId: ParameterIdSchema.parse("param_atlas_non_source"),
        evaluator: "linear-1d-v1",
        interpolation: "linear-1d-v1",
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          { value: 0, statePatch: 0.5 },
          { value: 1, statePatch: 1 }
        ]
      }
    ];
    nonSourceChanged.graph.dynamicsGroups = [
      {
        dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_atlas_non_source"),
        displayName: "Atlas Non Source Dynamics",
        enabled: true,
        inputs: [
          {
            parameterId: ParameterIdSchema.parse("param_atlas_non_source"),
            kind: "angle",
            influencePercent: 100,
            invert: false,
            normalization: { min: 0, center: 0.5, max: 1 }
          }
        ],
        pendulums: [
          {
            length: 1,
            sway: 0.25,
            reactionSpeed: 6,
            convergenceSpeed: 3
          }
        ],
        outputs: [
          {
            parameterId: ParameterIdSchema.parse("param_atlas_non_source_output"),
            kind: "angle",
            strength: 1,
            invert: false,
            limit: 1
          }
        ]
      }
    ];

    expect(createReadySourceSignatureDigest(nonSourceChanged)).toBe(baseDigest);
  });

  it("registers generated atlas bytes while preserving drawable texture refs, mesh UVs, and topology revisions", async () => {
    const session = await createTextureAtlasFixtureSession();
    const drawablesBefore = structuredClone(session.graph.drawables);
    const meshesBefore = structuredClone(session.graph.meshes);
    const preview = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1,
      edgeExtrusionEnabled: true,
      edgeExtrusionPixels: 1
    });

    const result = await applyTextureAtlasPreview(session, { preview });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      return;
    }

    expect(result.textureEntry).toMatchObject({
      textureId: "tex_generated_atlas_page_0",
      filePath: "assets/textures/generated_atlas_page_0.raw-rgba",
      dimensions: {
        width: 8,
        height: 4,
        pixelFormat: "rgba8"
      }
    });
    expect(result.atlasBytes.byteLength).toBe(8 * 4 * 4);
    expect(readPixel(result.atlasBytes, 8, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(readPixel(result.atlasBytes, 8, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(readPixel(result.atlasBytes, 8, 5, 1)).toEqual([0, 255, 0, 255]);
    expect(session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_BODY)?.textureId)
      .toBe(TEX_BODY);
    expect(session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_HIDDEN)?.textureId)
      .toBe(TEX_HIDDEN);
    expect(session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_POOL)?.textureId)
      .toBe(TEX_POOL);
    expect(session.graph.drawables).toEqual(drawablesBefore);
    expect(session.graph.meshes).toEqual(meshesBefore);
    expect(result.drawableChanges).toEqual([]);
    expect(result.meshUvChanges).toEqual([]);
    expect(getAuthoringSessionBinaryFileEntries(session).some((entry) =>
      entry.path === "assets/textures/generated_atlas_page_0.raw-rgba"
    )).toBe(true);
    expect(session.graph.textureAtlas?.layoutSummary?.pages[0]?.placements).toHaveLength(2);
    expect(session.graph.textureAtlas?.layoutSummary?.sourceSignature).toMatchObject({
      schemaVersion: "texture-atlas-source-signature-v1",
      inputVersion: "atlas-source-inputs-v1",
      algorithmId: "stable-json-fnv1a32-v1",
      boundDrawableIds: [DRAW_BODY, DRAW_HIDDEN],
      packableDrawableIds: [DRAW_BODY, DRAW_HIDDEN]
    });
  });

  it("keeps the direct authoring-core Apply freshness guard when source bytes change", async () => {
    const session = await createTextureAtlasFixtureSession();
    const preview = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1,
      edgeExtrusionEnabled: true,
      edgeExtrusionPixels: 1
    });
    if (preview.status !== "ready") {
      throw new Error("Expected ready preview.");
    }
    const bodyBytes = session.binaryAssets?.fileEntries.find((entry) =>
      entry.path === "assets/textures/body.raw-rgba"
    )?.bytes;
    if (bodyBytes === undefined) {
      throw new Error("Expected fixture body texture bytes.");
    }
    bodyBytes[0] = 127;

    const result = await applyTextureAtlasPreview(session, { preview });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      return;
    }
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "atlas.apply.stalePreview"
    );
    expect(session.graph.textureAtlas?.layoutSummary).toBeUndefined();
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
  });

  it("preserves generated atlas metadata and binary bytes through portable bundle round-trip", async () => {
    const session = await createTextureAtlasFixtureSession();
    const preview = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1,
      edgeExtrusionEnabled: true,
      edgeExtrusionPixels: 1
    });
    const applied = await applyTextureAtlasPreview(session, { preview });

    expect(applied.status).toBe("applied");
    const exported = await exportAuthoringSessionPortableBundle({
      session,
      updatedAt: "2026-06-19T00:00:00.000Z"
    });
    const imported = await importAuthoringSessionPortableBundle({
      bundle: exported.bundleJson
    });

    expect(imported.session.graph.textureAtlas?.layoutSummary)
      .toEqual(session.graph.textureAtlas?.layoutSummary);
    expect(imported.session.graph.textureAtlas?.layoutSummary?.sourceSignature?.digest)
      .toMatch(/^fnv1a32:[a-f0-9]{8}$/);
    expect(imported.session.graph.textureAtlas?.textures.some((texture) =>
      texture.textureId === "tex_generated_atlas_page_0" &&
      texture.binaryAssetRef?.packageRelativePath ===
        "assets/textures/generated_atlas_page_0.raw-rgba"
    )).toBe(true);
    expect(getAuthoringSessionBinaryFileEntries(imported.session).some((entry) =>
      entry.path === "assets/textures/generated_atlas_page_0.raw-rgba" &&
      entry.bytes.byteLength === 8 * 4 * 4
    )).toBe(true);
  });

  it("regenerates and replaces an existing atlas artifact from preserved source authoring state", async () => {
    const session = await createTextureAtlasFixtureSession();
    const preview = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1
    });
    const applied = await applyTextureAtlasPreview(session, { preview });

    expect(applied.status).toBe("applied");
    expect(session.graph.textureAtlas?.layoutSummary?.settings.pageHeight).toBe(4);

    const reappliedPreview = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 8,
      paddingPixels: 0
    });

    expect(reappliedPreview.status).toBe("ready");
    expect(reappliedPreview.warnings.map((warning) => warning.code)).not.toContain(
      "atlas.target.alreadyAtlasApplied"
    );
    if (reappliedPreview.status !== "ready") {
      return;
    }

    const replaced = await applyTextureAtlasPreview(session, { preview: reappliedPreview });

    expect(replaced.status).toBe("applied");
    if (replaced.status !== "applied") {
      return;
    }

    expect(session.graph.textureAtlas?.layoutSummary?.settings).toMatchObject({
      pageWidth: 8,
      pageHeight: 8,
      paddingPixels: 0
    });
    expect(session.graph.textureAtlas?.textures.find((texture) =>
      texture.textureId === "tex_generated_atlas_page_0"
    )?.dimensions).toEqual({
      width: 8,
      height: 8,
      pixelFormat: "rgba8"
    });
    expect(session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_BODY)?.textureId)
      .toBe(TEX_BODY);
    expect(session.graph.meshes.find((mesh) => mesh.meshId === MESH_BODY)?.uvs).toEqual(
      createQuadMesh(MESH_BODY, DRAW_BODY).uvs
    );
  });
});

const pickWarning = (warning: {
  readonly code: string;
  readonly targetPath: string;
  readonly drawableId?: unknown;
}) => ({
  code: warning.code,
  targetPath: warning.targetPath,
  drawableId: warning.drawableId
});

const createReadySourceSignatureDigest = (session: AuthoringSession): string => {
  const preview = createTextureAtlasPreview(session, {
    pageWidth: 8,
    pageHeight: 4,
    paddingPixels: 1,
    edgeExtrusionEnabled: true,
    edgeExtrusionPixels: 1
  });

  if (preview.status !== "ready") {
    throw new Error(`Expected ready atlas preview: ${preview.warnings.map((warning) => warning.code).join(",")}`);
  }

  const digest = preview.layoutSummary.sourceSignature?.digest;
  if (digest === undefined) {
    throw new Error("Expected atlas source signature digest.");
  }

  return digest;
};

const createTextureAtlasFixtureSession = async (): Promise<AuthoringSession> => {
  const bodyBytes = createSolidRgbaBytes(2, 2, [255, 0, 0, 255]);
  const hiddenBytes = createSolidRgbaBytes(2, 2, [0, 255, 0, 255]);
  const poolBytes = createSolidRgbaBytes(2, 2, [0, 0, 255, 255]);
  const bodyRef = await createTextureBinaryAssetReference("body", bodyBytes);
  const hiddenRef = await createTextureBinaryAssetReference("hidden", hiddenBytes);
  const poolRef = await createTextureBinaryAssetReference("pool", poolBytes);
  const session: AuthoringSession = {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_texture_atlas_core_test"),
      packageDisplayName: "Texture Atlas Core Test",
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
      parameters: [],
      keyformSets: [],
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
      dynamicsGroups: [],
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
          filePath: "assets/sources/generated/texture-atlas-fixture.json",
          creator: "texture-atlas-core-test",
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
): Promise<BinaryAssetReferenceDto> => {
  const digestResult = await computePackageBinarySha256Digest(bytes);
  if (digestResult.status !== "computed") {
    throw new Error("SHA-256 digest support is required for texture atlas tests.");
  }

  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${token}_rgba`,
    packageRelativePath: `assets/textures/${token}.raw-rgba`,
    digest: digestResult.digest,
    byteLength: getPackageBinaryByteLength(bytes),
    mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
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

const readPixel = (
  bytes: Uint8Array,
  width: number,
  x: number,
  y: number
): [number, number, number, number] => {
  const index = (y * width + x) * 4;

  return [
    bytes[index] ?? 0,
    bytes[index + 1] ?? 0,
    bytes[index + 2] ?? 0,
    bytes[index + 3] ?? 0
  ];
};
