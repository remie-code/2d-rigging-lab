import type {
  DrawableDto,
  PackageDocumentDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export const validateDrawableReferences = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const sourceAssetsById = new Map(
    packageDocument.assets.sourceManifest.sourceAssets.map((sourceAsset) => [
      sourceAsset.sourceAssetId,
      sourceAsset
    ])
  );
  const textureIds = new Set(
    packageDocument.assets.textureAtlas?.textures.map((texture) => texture.textureId) ?? []
  );
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.model.drawables.drawables.forEach((drawable, drawableIndex) => {
    const sourceAsset = sourceAssetsById.get(drawable.sourceAssetId);

    if (sourceAsset === undefined) {
      checks.push(createMissingSourceAssetCheck(drawable, drawableIndex));
    }

    if (shouldValidateTextureReference(packageDocument, drawable, sourceAsset) && !textureIds.has(drawable.textureId)) {
      checks.push(createMissingTextureCheck(packageDocument, drawable, drawableIndex, sourceAsset));
    }
  });

  return checks;
};

const shouldValidateTextureReference = (
  packageDocument: PackageDocumentDto,
  drawable: DrawableDto,
  sourceAsset: SourceAssetDto | undefined
): boolean => {
  if (!drawable.runtimeVisibility) {
    return false;
  }

  return !isLegacyGeneratedFixtureWithoutTextureAtlas(packageDocument, sourceAsset);
};

const isLegacyGeneratedFixtureWithoutTextureAtlas = (
  packageDocument: PackageDocumentDto,
  sourceAsset: SourceAssetDto | undefined
): boolean =>
  packageDocument.assets.textureAtlas === undefined && sourceAsset?.kind === "generated-fixture-v1";

const createMissingSourceAssetCheck = (
  drawable: DrawableDto,
  drawableIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/model/drawables/drawables/${drawableIndex}/sourceAssetId`;

  return ValidationCheckResultSchema.parse({
    checkId: "ref.drawableSourceMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "sourceAsset",
      id: drawable.sourceAssetId,
      path: targetPath
    },
    targetPath,
    message: `Drawable ${drawable.drawableId} references missing source asset ${drawable.sourceAssetId}.`,
    evidence: [
      `drawableId=${drawable.drawableId}`,
      `sourceAssetId=${drawable.sourceAssetId}`,
      "sourceManifestMatch=missing"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The drawable cannot be traced back to a package source asset."
  });
};

const createMissingTextureCheck = (
  packageDocument: PackageDocumentDto,
  drawable: DrawableDto,
  drawableIndex: number,
  sourceAsset: SourceAssetDto | undefined
): ValidationCheckResultDto => {
  const targetPath = `/model/drawables/drawables/${drawableIndex}/textureId`;
  const textureAtlasPresent = packageDocument.assets.textureAtlas !== undefined;

  return ValidationCheckResultSchema.parse({
    checkId: "ref.drawableTextureMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "texture",
      id: drawable.textureId,
      path: targetPath
    },
    targetPath,
    message: `Visible drawable ${drawable.drawableId} references missing texture ${drawable.textureId}.`,
    evidence: [
      `drawableId=${drawable.drawableId}`,
      `textureId=${drawable.textureId}`,
      `runtimeVisibility=${drawable.runtimeVisibility}`,
      `sourceAssetId=${drawable.sourceAssetId}`,
      `sourceKind=${sourceAsset?.kind ?? "missing"}`,
      `textureAtlasPresent=${textureAtlasPresent}`,
      `textureAtlasMatch=${textureAtlasPresent ? "missing" : "texture-atlas-missing"}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "A visible drawable cannot be accepted as renderable MVP package content until its texture reference resolves."
  });
};
