import { createHash } from "node:crypto";

import {
  createTutorialMiniModelSeed,
  registerAuthoringSessionBinaryBytes,
  TUTORIAL_MINI_MODEL_IDS,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import { createOperationCore } from "@private-2d-rigging-lab/operation-core";
import {
  BinaryAssetReferenceSchema,
  VariantGroupSchema,
  type BinaryAssetReferenceDto
} from "@private-2d-rigging-lab/package-format";

// Test-only fixture tooling for the perception (renderView) stack. Builds
// deterministic in-memory AuthoringSessions with texture-backed drawables whose
// texture entries carry authoritative `dimensions` and matching RGBA8 bytes, so
// the §3.4 dimension resolution + byteLength check has a trusted source.
//
// Everything here is synthetic and rights-clean (no `ref/` asset).

const RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

export const PERCEPTION_TEXTURE_WIDTH = 4;
export const PERCEPTION_TEXTURE_HEIGHT = 4;

export interface PerceptionFixtureIds {
  readonly eyeDrawableId: string;
  readonly eyeMaskDrawableId: string;
  readonly eyeMeshId: string;
  readonly eyeMaskMeshId: string;
  /**
   * The authored parameter that drives the opacity of BOTH fixture drawables
   * (eye + eye mask) via linear keyforms (see below). Exposed so tests can
   * override / sweep it and observe the pixel change.
   */
  readonly eyeRegionOpacityParameterId: string;
}

/**
 * The parameter id whose min→max sweep drives the opacity of both drawables
 * (the whole "eye region") from fully transparent (min) to fully opaque (max).
 * Both drawables are bound because the software renderer draws the mask
 * drawable on top of the eye drawable (it fully covers it), so driving only the
 * eye would never reach the final pixels; driving both guarantees the
 * deformation is visible regardless of draw order. The parameter's DEFAULT
 * value coincides with `max`, i.e. the rest pose (no override) still renders
 * everything fully opaque — keeping rest-pose renders byte-identical to a
 * keyform-free fixture — while any override toward `min` visibly fades the
 * model out.
 */
export const PERCEPTION_EYE_REGION_OPACITY_PARAMETER_ID =
  "param_perception_eye_region_opacity";
const PERCEPTION_EYE_REGION_OPACITY_MIN = -1;
const PERCEPTION_EYE_REGION_OPACITY_DEFAULT = 1;
const PERCEPTION_EYE_REGION_OPACITY_MAX = 1;

export interface PerceptionFixture {
  readonly session: AuthoringSession;
  readonly ids: PerceptionFixtureIds;
}

/**
 * A two-drawable model (eye + eye mask), each with a generated mesh and a
 * texture entry carrying explicit 4x4 RGBA8 dimensions + matching bytes, plus a
 * mask relation (eye mask clips the eye), plus parameter-driven opacity
 * keyforms on both drawables (see below). Returns an in-memory session.
 */
export const createPerceptionFixture = (): PerceptionFixture =>
  buildPerceptionFixture({ includeOpacityKeyform: true });

const buildPerceptionFixture = (
  options: { readonly includeOpacityKeyform: boolean }
): PerceptionFixture => {
  const seed = createTutorialMiniModelSeed();
  const core = createOperationCore({ now: () => new Date("2026-07-02T00:00:00.000Z") });
  const ids = TUTORIAL_MINI_MODEL_IDS;
  const commit = createSetupCommitter(core, seed.session);

  commit("createPart", { partId: ids.parts.body, displayName: "Body", lockedTargetIds: [] });
  commit("createPart", {
    partId: ids.parts.face,
    displayName: "Face",
    parentPartId: ids.parts.body,
    lockedTargetIds: []
  });
  commit("createDrawable", {
    sourceAssetId: ids.sourceAssetId,
    sourceLayerId: ids.layers.eyeMask,
    textureId: ids.textures.eyeMask,
    partId: ids.parts.face,
    displayName: "Eye Mask"
  });
  commit("createDrawable", {
    sourceAssetId: ids.sourceAssetId,
    sourceLayerId: ids.layers.eye,
    textureId: ids.textures.eye,
    partId: ids.parts.face,
    displayName: "Eye"
  });

  const eyeMaskDrawable = requireDrawable(seed.session, "Eye Mask");
  const eyeDrawable = requireDrawable(seed.session, "Eye");

  commit("generateMesh", {
    drawableId: eyeMaskDrawable.drawableId,
    method: "auto-grid-v1",
    densityHint: "low"
  });
  commit("generateMesh", {
    drawableId: eyeDrawable.drawableId,
    method: "auto-grid-v1",
    densityHint: "low"
  });

  commit("setMaskRelation", {
    maskRelationId: ids.masks.eyeMaskToEye,
    maskDrawableIds: [eyeMaskDrawable.drawableId],
    targetDrawableIds: [eyeDrawable.drawableId],
    enabled: true
  });

  if (options.includeOpacityKeyform) {
    // Parameter-driven deformation: bind the opacity of BOTH drawables to an
    // authored parameter with min→max end key sets. At `min` the whole eye
    // region is fully transparent (removed from the rendered pixels); at `max`
    // it is fully opaque. Both drawables are bound because the renderer draws
    // the mask drawable on top of the eye. The parameter's default equals
    // `max`, so the rest pose (no override) renders fully opaque and stays
    // byte-identical to a keyform-free rest render.
    commit("createParameter", {
      parameterId: PERCEPTION_EYE_REGION_OPACITY_PARAMETER_ID,
      displayName: "Perception Eye Region Opacity",
      valueSource: "authoredInput",
      min: PERCEPTION_EYE_REGION_OPACITY_MIN,
      default: PERCEPTION_EYE_REGION_OPACITY_DEFAULT,
      max: PERCEPTION_EYE_REGION_OPACITY_MAX,
      recommendedUiStep: 0.01
    });
    for (const drawableId of [eyeDrawable.drawableId, eyeMaskDrawable.drawableId]) {
      commit("editKeyformKey", {
        action: "createEnds",
        target: { kind: "drawable", id: drawableId },
        targetProperty: "opacity",
        parameterId: PERCEPTION_EYE_REGION_OPACITY_PARAMETER_ID,
        interpolation: "linear-1d-v1",
        statePatches: {
          min: { propertyPath: "opacity", value: 0 },
          max: { propertyPath: "opacity", value: 1 }
        }
      });
    }
  }

  registerTextureWithDimensions(seed.session, ids.textures.eye, {
    width: PERCEPTION_TEXTURE_WIDTH,
    height: PERCEPTION_TEXTURE_HEIGHT
  });
  registerTextureWithDimensions(seed.session, ids.textures.eyeMask, {
    width: PERCEPTION_TEXTURE_WIDTH,
    height: PERCEPTION_TEXTURE_HEIGHT
  });

  return {
    session: seed.session,
    ids: {
      eyeDrawableId: eyeDrawable.drawableId,
      eyeMaskDrawableId: eyeMaskDrawable.drawableId,
      eyeMeshId: eyeDrawable.meshId,
      eyeMaskMeshId: eyeMaskDrawable.meshId,
      eyeRegionOpacityParameterId: PERCEPTION_EYE_REGION_OPACITY_PARAMETER_ID
    }
  };
};

/**
 * An empty-parameter model: same two drawables + textures but no authored
 * parameters and no keyforms. Used to prove rest-pose evaluation and render
 * succeed with empty `graph.parameters`.
 */
export const createEmptyParameterPerceptionFixture = (): PerceptionFixture =>
  buildPerceptionFixture({ includeOpacityKeyform: false });

export const PERCEPTION_VARIANT_GROUP_ID = "vgrp_perception_outfit";
export const PERCEPTION_VARIANT_DEFAULT_ID = "var_perception_default";
export const PERCEPTION_VARIANT_ALT_ID = "var_perception_alt";

export interface VariantPerceptionFixtureIds extends PerceptionFixtureIds {
  readonly variantGroupId: string;
  readonly defaultVariantId: string;
  readonly altVariantId: string;
}

export interface VariantPerceptionFixture {
  readonly session: AuthoringSession;
  readonly ids: VariantPerceptionFixtureIds;
}

/**
 * The keyform-free two-drawable model, PLUS a `singleSelect` Variant Group over
 * both drawables (Wave105 Domain A test support). The group gates:
 *  - `Default` variant → the eye drawable is a member (visible), the eye-mask
 *    drawable is NOT (hidden by the gate).
 *  - `Alt` variant → the eye-mask drawable is a member (visible), the eye
 *    drawable is NOT.
 * So switching the active selection flips which of the two drawables the gate
 * passes — a clean, self-contained membership to assert the gate against by both
 * the snapshot `visible` flag and the rendered bytes. Keyform-free so the only
 * driver of the pixel difference between two selections is the Variant gate
 * itself. Rights-clean (synthetic).
 */
export const createVariantPerceptionFixture = (): VariantPerceptionFixture => {
  const base = buildPerceptionFixture({ includeOpacityKeyform: false });
  // Parse through the package-format schema so the drawable ids are branded and
  // every group invariant (ownership, membership coverage, mode match) is
  // enforced on the fixture itself.
  const group = VariantGroupSchema.parse({
    variantGroupId: PERCEPTION_VARIANT_GROUP_ID,
    displayName: "Perception Outfit",
    mode: "singleSelect",
    variants: [
      { variantId: PERCEPTION_VARIANT_DEFAULT_ID, displayName: "Default" },
      { variantId: PERCEPTION_VARIANT_ALT_ID, displayName: "Alt" }
    ],
    targetDrawableIds: [base.ids.eyeDrawableId, base.ids.eyeMaskDrawableId],
    memberships: [
      { drawableId: base.ids.eyeDrawableId, variantIds: [PERCEPTION_VARIANT_DEFAULT_ID] },
      { drawableId: base.ids.eyeMaskDrawableId, variantIds: [PERCEPTION_VARIANT_ALT_ID] }
    ],
    defaultActive: { kind: "singleSelect", variantId: PERCEPTION_VARIANT_DEFAULT_ID }
  });
  base.session.graph.variantGroups = [group];

  return {
    session: base.session,
    ids: {
      ...base.ids,
      variantGroupId: PERCEPTION_VARIANT_GROUP_ID,
      defaultVariantId: PERCEPTION_VARIANT_DEFAULT_ID,
      altVariantId: PERCEPTION_VARIANT_ALT_ID
    }
  };
};

/**
 * Registers a texture entry's binary bytes AND sets its declared `dimensions`.
 * When `byteLengthOverride` is given, the registered bytes intentionally do NOT
 * match width*height*4 so the §3.4 byteLength check can be exercised.
 */
export const registerTextureWithDimensions = (
  session: AuthoringSession,
  textureId: string,
  dimensions: { readonly width: number; readonly height: number },
  options: { readonly byteLengthOverride?: number } = {}
): void => {
  const byteLength =
    options.byteLengthOverride ?? dimensions.width * dimensions.height * 4;
  const bytes = createSyntheticRgbaBytes(byteLength);
  const digestHex = createHash("sha256").update(bytes).digest("hex");
  const packageRelativePath = `assets/textures/${textureId}.raw-rgba`;
  const binaryAssetRef: BinaryAssetReferenceDto = BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${textureId}`,
    packageRelativePath,
    digest: { algorithm: "sha256", hex: digestHex },
    byteLength: bytes.byteLength,
    mediaType: RAW_RGBA_MEDIA_TYPE,
    storageStatus: "stored-package-local-v1",
    provenanceId: TUTORIAL_MINI_MODEL_IDS.sourceProvenanceId,
    rightsAssetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId
  });

  const textureEntry = session.graph.textureAtlas?.textures.find(
    (entry) => entry.textureId === textureId
  );
  if (textureEntry === undefined) {
    throw new Error(`Fixture texture entry "${textureId}" was not found.`);
  }
  textureEntry.binaryAssetRef = binaryAssetRef;
  textureEntry.dimensions = {
    width: dimensions.width,
    height: dimensions.height,
    pixelFormat: "rgba8"
  };

  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes,
    role: "texture-raster-v1",
    sourceAssetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId,
    textureId
  });
};

/**
 * Registers a texture entry's binary bytes WITHOUT declaring `dimensions`, so
 * the §3.4 revised "derived-verified" ladder rung (mesh-bounds derivation +
 * strict byteLength check) can be exercised. `byteLength` controls whether the
 * derived candidate verifies (pass exactly meshBounds.width*height*4) or is
 * rejected deterministically (any other length).
 */
export const registerTextureBytesWithoutDimensions = (
  session: AuthoringSession,
  textureId: string,
  byteLength: number
): void => {
  const bytes = createSyntheticRgbaBytes(byteLength);
  const digestHex = createHash("sha256").update(bytes).digest("hex");
  const packageRelativePath = `assets/textures/${textureId}.raw-rgba`;
  const binaryAssetRef: BinaryAssetReferenceDto = BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${textureId}`,
    packageRelativePath,
    digest: { algorithm: "sha256", hex: digestHex },
    byteLength: bytes.byteLength,
    mediaType: RAW_RGBA_MEDIA_TYPE,
    storageStatus: "stored-package-local-v1",
    provenanceId: TUTORIAL_MINI_MODEL_IDS.sourceProvenanceId,
    rightsAssetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId
  });

  const textureEntry = session.graph.textureAtlas?.textures.find(
    (entry) => entry.textureId === textureId
  );
  if (textureEntry === undefined) {
    throw new Error(`Fixture texture entry "${textureId}" was not found.`);
  }
  textureEntry.binaryAssetRef = binaryAssetRef;
  delete textureEntry.dimensions;

  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes,
    role: "texture-raster-v1",
    sourceAssetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId,
    textureId
  });
};

const createSyntheticRgbaBytes = (byteLength: number): Uint8Array => {
  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < bytes.length; index += 4) {
    const pixelIndex = index / 4;
    bytes[index] = (pixelIndex * 37 + 40) % 256;
    bytes[index + 1] = (pixelIndex * 53 + 80) % 256;
    bytes[index + 2] = (pixelIndex * 71 + 120) % 256;
    bytes[index + 3] = 255;
  }
  return bytes;
};

type SetupCommitter = (operationType: string, payload: unknown) => void;

const createSetupCommitter = (
  core: ReturnType<typeof createOperationCore>,
  session: AuthoringSession
): SetupCommitter => {
  let basePackageRevision = session.packageRevision;
  let sequence = 0;

  return (operationType, payload) => {
    sequence += 1;
    const request: unknown = {
      schemaVersion: "operation-request-v1",
      operationId: `op_perception_${operationType}_${sequence}`,
      actor: "test",
      surface: "testFixture",
      dryRun: false,
      basePackageRevision,
      operationType,
      payload,
      trace: { relatedAC: [], relatedScenarios: [] }
    };

    const outcome = core.commitOperation(session, request);
    if (outcome.result.status !== "committed") {
      const diagnostics = outcome.result.diagnostics
        .map((diagnostic) => `${diagnostic.checkId}:${diagnostic.message}`)
        .join("; ");
      throw new Error(
        `Perception fixture operation ${operationType} was not committed (${outcome.result.status}): ${diagnostics}`
      );
    }
    basePackageRevision = session.packageRevision;
  };
};

const requireDrawable = (
  session: AuthoringSession,
  displayName: string
): AuthoringSession["graph"]["drawables"][number] => {
  const drawable = session.graph.drawables.find(
    (entry) => entry.displayName === displayName
  );
  if (drawable === undefined) {
    throw new Error(`Fixture drawable "${displayName}" was not created.`);
  }
  return drawable;
};
