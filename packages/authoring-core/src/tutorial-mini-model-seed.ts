import {
  PackageIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  PackageDocumentSchema,
  type PackageDocumentDto,
  type SourceLayerDto,
  type TextureAtlasEntryDto,
  type TexturePreviewAssetDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import { createAuthoringSessionFromPackageDocument } from "./from-package-document.js";

export const TUTORIAL_MINI_MODEL_CREATED_AT = "2026-06-02T00:00:00.000Z";
export const TUTORIAL_MINI_MODEL_UPDATED_AT = "2026-06-02T00:00:00.000Z";

export const TUTORIAL_MINI_MODEL_IDS = {
  packageId: "pkg_tutorial_mini_model",
  sourceAssetId: "src_tutorial_synthetic_layers",
  sourceProvenanceId: "prov_tutorial_synthetic_seed",
  parts: {
    body: "part_tutorial_body",
    head: "part_tutorial_head",
    face: "part_tutorial_face",
    frontHair: "part_tutorial_front_hair",
    arm: "part_tutorial_arm"
  },
  layers: {
    body: "layer_body",
    head: "layer_head",
    face: "layer_face",
    mouth: "layer_mouth",
    eyeMask: "layer_eye_mask",
    eye: "layer_eye",
    frontHair: "layer_front_hair",
    arm: "layer_arm"
  },
  drawables: {
    body: "draw_tutorial_body",
    head: "draw_tutorial_head",
    face: "draw_tutorial_face",
    mouth: "draw_tutorial_mouth",
    eyeMask: "draw_tutorial_eye_mask",
    eye: "draw_tutorial_eye",
    frontHair: "draw_tutorial_front_hair",
    arm: "draw_tutorial_arm"
  },
  meshes: {
    body: "mesh_tutorial_body",
    head: "mesh_tutorial_head",
    face: "mesh_tutorial_face",
    mouth: "mesh_tutorial_mouth",
    eyeMask: "mesh_tutorial_eye_mask",
    eye: "mesh_tutorial_eye",
    frontHair: "mesh_tutorial_front_hair",
    arm: "mesh_tutorial_arm"
  },
  textures: {
    bodyDraft: "tex_tutorial_body_draft",
    body: "tex_tutorial_body",
    head: "tex_tutorial_head",
    face: "tex_tutorial_face",
    mouth: "tex_tutorial_mouth",
    eyeMask: "tex_tutorial_eye_mask",
    eye: "tex_tutorial_eye",
    frontHair: "tex_tutorial_front_hair",
    arm: "tex_tutorial_arm"
  },
  parameters: {
    faceYaw: "param_face_yaw",
    bodyBob: "param_body_bob",
    mouthOpen: "param_mouth_open",
    hairSway: "param_hair_sway"
  },
  rigControls: {
    headRotation: "rig_tutorial_head_rotation"
  },
  dynamicsGroups: {
    hairSway: "dyn_tutorial_hair_sway"
  },
  masks: {
    eyeMaskToEye: "maskrel_tutorial_eye_mask_to_eye"
  },
  keyformSets: {
    headRotationAngle:
      "keyset_rigcontrol_rig_tutorial_head_rotation_angledegrees_face_yaw_1",
    mouthOpacity: "keyset_drawable_draw_tutorial_mouth_opacity_mouth_open_1",
    frontHairSway: "keyset_mesh_mesh_tutorial_front_hair_vertices_hair_sway_1"
  }
} as const;

export interface TutorialMiniModelSeedPackageOptions {
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface TutorialMiniModelSeed {
  readonly packageDocument: PackageDocumentDto;
  readonly session: AuthoringSession;
}

export const createTutorialMiniModelSeedPackageDocument = (
  options: TutorialMiniModelSeedPackageOptions = {}
): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: PackageIdSchema.parse(TUTORIAL_MINI_MODEL_IDS.packageId),
      packageDisplayName: "Tutorial Mini Model",
      formatVersion: "open-model-package-v1",
      packageRevision: 0,
      createdAt: options.createdAt ?? TUTORIAL_MINI_MODEL_CREATED_AT,
      updatedAt: options.updatedAt ?? options.createdAt ?? TUTORIAL_MINI_MODEL_UPDATED_AT,
      schemaVersions: {
        manifest: "open-model-package-manifest-v1",
        sourceManifest: "source-manifest-v1",
        modelGraph: "model-graph-v1",
        textureAtlas: "texture-atlas-v1"
      },
      evaluatorVersions: {
        runtimeCore: "wave30-tutorial-mini-model-recipe-foundation"
      },
      modelFiles: {
        graph: "model/graph.json",
        drawables: "model/drawables.json",
        meshes: "model/meshes.json",
        parameters: "model/parameters.json",
        keyforms: "model/keyforms.json",
        rigControls: "model/rig-controls.json",
        dynamics: "model/dynamics.json",
        masks: "model/masks.json",
        drawOrder: "model/draw-order.json"
      },
      assetIndex: "assets/sources/source-manifest.json",
      operationLog: "operations/log.jsonl",
      rightsSummary: {
        status: "cleared"
      },
      provenanceSummary: {
        sourceAssetCount: 1
      },
      packageStableOrderVersion: "stable-order-v1"
    },
    model: {
      graph: {
        schemaVersion: "model-graph-v1",
        coordinateSystem: "canvas-y-down-v1",
        canvasSize: {
          width: 320,
          height: 420
        },
        parts: [],
        rigControlRootIds: [],
        stableOrder: []
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: []
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: []
      },
      parameters: {
        schemaVersion: "parameters-file-v1",
        parameters: []
      },
      keyforms: {
        schemaVersion: "keyforms-file-v1",
        keyformSets: []
      },
      rigControls: {
        schemaVersion: "rig-controls-file-v1",
        rigControls: []
      },
      dynamics: {
        schemaVersion: "dynamics-file-v3",
        dynamicsGroups: []
      },
      masks: {
        schemaVersion: "masks-file-v1",
        masks: []
      },
      drawOrder: {
        schemaVersion: "draw-order-file-v1",
        entries: []
      }
    },
    assets: {
      sourceManifest: {
        schemaVersion: "source-manifest-v1",
        sourceAssets: [
          {
            sourceAssetId: SourceAssetIdSchema.parse(TUTORIAL_MINI_MODEL_IDS.sourceAssetId),
            kind: "generated-fixture-v1",
            filePath: "assets/sources/generated/tutorial-mini-model.synthetic.json",
            contentHash: "sha256:tutorial-mini-model-synthetic-seed-v1",
            importProfile: "split-png-fallback-v1",
            layers: createTutorialMiniModelSourceLayers(),
            diagnostics: []
          }
        ]
      },
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: createTutorialMiniModelTextureEntries(),
        previewAssets: createTutorialMiniModelTexturePreviewAssets()
      },
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: [
          {
            provenanceId: ProvenanceIdSchema.parse(
              TUTORIAL_MINI_MODEL_IDS.sourceProvenanceId
            ),
            assetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId,
            assetKind: "generatedFixture",
            filePath: "assets/sources/generated/tutorial-mini-model.synthetic.json",
            contentHash: "sha256:tutorial-mini-model-synthetic-seed-v1",
            creator: "wave30-tutorial-mini-model-recipe",
            license: "internal-authoring-generated",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: [
              "Authored as deterministic metadata-only synthetic tutorial seed.",
              "No real PSD, PNG, parser, image decode, or external asset bytes."
            ],
            relatedOperationIds: []
          }
        ]
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: [
          {
            assetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId,
            rightsStatus: "cleared",
            license: "internal-authoring-generated",
            redistributionAllowed: false,
            notes:
              "Rights-clean synthetic metadata seed for private tutorial workflow evidence; no public sample distribution claim."
          }
        ]
      }
    }
  });

export const createTutorialMiniModelSeed = (
  options: TutorialMiniModelSeedPackageOptions = {}
): TutorialMiniModelSeed => {
  const packageDocument = createTutorialMiniModelSeedPackageDocument(options);

  return {
    packageDocument,
    session: createAuthoringSessionFromPackageDocument(packageDocument)
  };
};

const createTutorialMiniModelSourceLayers = (): SourceLayerDto[] =>
  tutorialLayerSpecs.map((spec) => ({
    sourceLayerId: spec.sourceLayerId,
    sourceAssetId: SourceAssetIdSchema.parse(TUTORIAL_MINI_MODEL_IDS.sourceAssetId),
    originalName: spec.originalName,
    normalizedName: spec.normalizedName,
    groupPath: [...spec.groupPath],
    bounds: { ...spec.bounds },
    visibleInSource: true,
    opacityInSource: spec.opacityInSource,
    role: "editableLayer",
    unsupportedFeatures: [],
    mappedDrawableIds: []
  }));

const createTutorialMiniModelTextureEntries = (): TextureAtlasEntryDto[] =>
  tutorialTextureSpecs.map((spec) => ({
    textureId: TextureIdSchema.parse(spec.textureId),
    filePath: `assets/textures/${spec.fileToken}.synthetic.png`,
    contentHash: `sha256:tutorial-mini-model-texture-${spec.fileToken}-metadata`,
    sourceAssetId: SourceAssetIdSchema.parse(TUTORIAL_MINI_MODEL_IDS.sourceAssetId),
    sourceLayerId: spec.sourceLayerId,
    provenanceId: ProvenanceIdSchema.parse(TUTORIAL_MINI_MODEL_IDS.sourceProvenanceId)
  }));

const createTutorialMiniModelTexturePreviewAssets = (): TexturePreviewAssetDto[] =>
  tutorialTextureSpecs
    .filter((spec) => !("draft" in spec && spec.draft))
    .map((spec) => ({
      previewAssetId: `preview_${spec.fileToken}`,
      textureId: TextureIdSchema.parse(spec.textureId),
      reference: {
        referenceKind: "package-local-file-v1",
        filePath: `assets/thumbnails/${spec.fileToken}.preview.png`
      },
      contentHash: `sha256:tutorial-mini-model-preview-${spec.fileToken}-metadata`,
      sourceAssetId: SourceAssetIdSchema.parse(TUTORIAL_MINI_MODEL_IDS.sourceAssetId),
      sourceLayerId: spec.sourceLayerId,
      provenanceId: ProvenanceIdSchema.parse(TUTORIAL_MINI_MODEL_IDS.sourceProvenanceId),
      rightsAssetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId
    }));

const tutorialLayerSpecs = [
  {
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.body,
    originalName: "Body",
    normalizedName: "body",
    groupPath: ["tutorial-mini-model", "body"],
    bounds: { x: 112, y: 210, width: 96, height: 140 },
    opacityInSource: 1
  },
  {
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.head,
    originalName: "Head",
    normalizedName: "head",
    groupPath: ["tutorial-mini-model", "head"],
    bounds: { x: 92, y: 82, width: 136, height: 136 },
    opacityInSource: 1
  },
  {
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.face,
    originalName: "Face",
    normalizedName: "face",
    groupPath: ["tutorial-mini-model", "head", "face"],
    bounds: { x: 110, y: 116, width: 100, height: 82 },
    opacityInSource: 1
  },
  {
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.mouth,
    originalName: "Mouth",
    normalizedName: "mouth",
    groupPath: ["tutorial-mini-model", "head", "face"],
    bounds: { x: 142, y: 166, width: 36, height: 16 },
    opacityInSource: 0.9
  },
  {
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.eyeMask,
    originalName: "Eye Mask",
    normalizedName: "eye_mask",
    groupPath: ["tutorial-mini-model", "head", "face"],
    bounds: { x: 126, y: 130, width: 68, height: 28 },
    opacityInSource: 1
  },
  {
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.eye,
    originalName: "Eye",
    normalizedName: "eye",
    groupPath: ["tutorial-mini-model", "head", "face"],
    bounds: { x: 132, y: 132, width: 56, height: 22 },
    opacityInSource: 1
  },
  {
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.frontHair,
    originalName: "Front Hair",
    normalizedName: "front_hair",
    groupPath: ["tutorial-mini-model", "head", "hair"],
    bounds: { x: 82, y: 54, width: 156, height: 94 },
    opacityInSource: 1
  },
  {
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.arm,
    originalName: "Arm",
    normalizedName: "arm",
    groupPath: ["tutorial-mini-model", "body", "arm"],
    bounds: { x: 194, y: 220, width: 54, height: 106 },
    opacityInSource: 1
  }
] as const;

const tutorialTextureSpecs = [
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.bodyDraft,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.body,
    fileToken: "tutorial-body-draft",
    draft: true
  },
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.body,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.body,
    fileToken: "tutorial-body"
  },
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.head,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.head,
    fileToken: "tutorial-head"
  },
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.face,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.face,
    fileToken: "tutorial-face"
  },
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.mouth,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.mouth,
    fileToken: "tutorial-mouth"
  },
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.eyeMask,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.eyeMask,
    fileToken: "tutorial-eye-mask"
  },
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.eye,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.eye,
    fileToken: "tutorial-eye"
  },
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.frontHair,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.frontHair,
    fileToken: "tutorial-front-hair"
  },
  {
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.arm,
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.arm,
    fileToken: "tutorial-arm"
  }
] as const;
