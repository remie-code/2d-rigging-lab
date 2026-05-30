import {
  getPartById,
  upsertTexturePreviewAssetMetadata
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ProvenanceId,
  SourceAssetId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import type {
  SplitPngSourceAssetPayloadDto,
  SplitPngSourceLayerMetadataDto
} from "../payloads/import-source.js";
import { createOperationDiagnostic } from "../preconditions.js";

export type SplitPngTextureMaterializationResult = {
  readonly textureEntry: TextureAtlasFile["textures"][number];
  readonly previewAsset: TexturePreviewAsset;
  readonly authoringRevision: AuthoringSession["authoringRevision"];
};

export const evaluateSplitPngLayerTextureMappingPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly payload: SplitPngSourceAssetPayloadDto;
  readonly layer: SplitPngSourceLayerMetadataDto;
  readonly seenTextureIds: Set<string>;
  readonly sourceTarget: TargetRefDto;
}): DiagnosticDto[] => {
  if (!splitPngLayerRequestsTextureMaterialization(input.layer)) {
    return [];
  }

  const diagnostics: DiagnosticDto[] = [];
  const layerPath = `/payload/layers/${input.layer.sourceLayerId}`;
  const texturePreviewReference = normalizeOptionalString(input.layer.texturePreviewReference);
  const textureId = input.layer.textureId;
  const effectivePartId = input.layer.targetPartId ?? input.payload.defaultPartId;

  if (texturePreviewReference === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingTexturePreviewReference",
        message: `Layer ${input.layer.sourceLayerId} requires a texture preview reference before texture materialization.`,
        target: { ...input.sourceTarget, path: `${layerPath}/texturePreviewReference` }
      })
    );
  } else if (!isSupportedTexturePreviewReference(texturePreviewReference)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.invalidTexturePreviewReference",
        message: createInvalidTexturePreviewReferenceMessage(
          input.layer.sourceLayerId,
          texturePreviewReference
        ),
        target: { ...input.sourceTarget, path: `${layerPath}/texturePreviewReference` }
      })
    );
  }

  if (textureId === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingTextureId",
        message: `Layer ${input.layer.sourceLayerId} requires an explicit texture ID before texture materialization.`,
        target: { ...input.sourceTarget, path: `${layerPath}/textureId` }
      })
    );
  } else if (input.seenTextureIds.has(textureId)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.duplicateTextureId",
        message: `Texture ID appears more than once in the import payload: ${textureId}.`,
        target: { kind: "texture", id: textureId, path: layerPath }
      })
    );
  } else if (textureIdAlreadyExists(input.session, textureId)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.existingTextureId",
        message: `Texture ID already exists in the texture atlas: ${textureId}.`,
        target: { kind: "texture", id: textureId, path: `${layerPath}/textureId` }
      })
    );
  } else {
    input.seenTextureIds.add(textureId);
  }

  if (effectivePartId === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingLayerTargetPart",
        message: `Layer ${input.layer.sourceLayerId} requires an explicit target part or payload default part.`,
        target: { ...input.sourceTarget, path: `${layerPath}/targetPartId` }
      })
    );
  } else if (getPartById(input.session.graph, effectivePartId) === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingLayerTargetPart",
        message: `Layer target part does not exist: ${effectivePartId}.`,
        target: { kind: "part", id: effectivePartId, path: `${layerPath}/targetPartId` }
      })
    );
  }

  return diagnostics;
};

export const materializeSplitPngLayerTexturePreviewMetadata = (input: {
  readonly session: AuthoringSession;
  readonly payload: SplitPngSourceAssetPayloadDto;
  readonly sourceAssetId: SourceAssetId;
  readonly provenanceId: ProvenanceId;
}): SplitPngTextureMaterializationResult[] => {
  const materializations: SplitPngTextureMaterializationResult[] = [];

  for (const layer of input.payload.layers) {
    if (!splitPngLayerRequestsTextureMaterialization(layer)) {
      continue;
    }

    const texturePreviewReference = normalizeOptionalString(layer.texturePreviewReference);
    if (texturePreviewReference === undefined || layer.textureId === undefined) {
      throw new Error(
        `Expected importSplitPngSourceAsset preconditions to reject incomplete texture metadata for ${layer.sourceLayerId}.`
      );
    }

    const result = upsertTexturePreviewAssetMetadata(input.session, {
      textureEntry: {
        textureId: layer.textureId,
        filePath: resolveTextureEntryFilePath(layer, texturePreviewReference),
        sourceAssetId: input.sourceAssetId,
        sourceLayerId: layer.sourceLayerId,
        provenanceId: input.provenanceId
      },
      previewAsset: {
        previewAssetId: createTexturePreviewAssetId(input.sourceAssetId, layer.sourceLayerId),
        textureId: layer.textureId,
        reference: createTexturePreviewReference(texturePreviewReference),
        sourceAssetId: input.sourceAssetId,
        sourceLayerId: layer.sourceLayerId,
        provenanceId: input.provenanceId,
        rightsAssetId: input.sourceAssetId
      }
    });

    materializations.push({
      textureEntry: result.textureEntry,
      previewAsset: result.previewAsset,
      authoringRevision: result.authoringRevision
    });
  }

  return materializations;
};

export const splitPngLayerRequestsTextureMaterialization = (
  layer: SplitPngSourceLayerMetadataDto
): boolean =>
  layer.texturePreviewReference !== undefined ||
  layer.textureId !== undefined ||
  layer.targetPartId !== undefined;

const createTexturePreviewReference = (
  reference: string
): TexturePreviewAsset["reference"] => {
  if (isDeterministicImageDataUrl(reference)) {
    return {
      referenceKind: "deterministic-data-url-v1",
      dataUrl: reference
    };
  }

  return {
    referenceKind: "package-local-file-v1",
    filePath: reference
  };
};

const resolveTextureEntryFilePath = (
  layer: SplitPngSourceLayerMetadataDto,
  texturePreviewReference: string
): string => {
  if (texturePreviewReference.startsWith("assets/textures/")) {
    return texturePreviewReference;
  }

  if (layer.imagePath?.startsWith("assets/textures/") === true) {
    return layer.imagePath;
  }

  return `assets/textures/${sanitizeIdToken(layer.textureId ?? layer.sourceLayerId)}.png`;
};

const createTexturePreviewAssetId = (
  sourceAssetId: SourceAssetId,
  sourceLayerId: string
): string =>
  `preview_${sanitizeIdToken(sourceAssetId)}_${sanitizeIdToken(sourceLayerId)}`;

const normalizeOptionalString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const isSupportedTexturePreviewReference = (reference: string): boolean => {
  if (isDeterministicImageDataUrl(reference)) {
    return true;
  }

  if (
    reference.length === 0 ||
    reference.includes("\\") ||
    reference.startsWith("/") ||
    reference.endsWith("/") ||
    reference.split("/").some((part) => part.length === 0 || part === "." || part === "..") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(reference)
  ) {
    return false;
  }

  return packageLocalTexturePreviewReferencePrefixes.some((prefix) => reference.startsWith(prefix));
};

const createInvalidTexturePreviewReferenceMessage = (
  sourceLayerId: string,
  reference: string
): string => {
  if (reference.startsWith(generatedTextureReferencePrefix)) {
    return `Layer ${sourceLayerId} generated://texture-preview/ references are not supported by this operation; use a package-local asset path or deterministic image data URL.`;
  }

  return `Layer ${sourceLayerId} texture preview reference must be a package-local asset path or deterministic image data URL.`;
};

const isDeterministicImageDataUrl = (reference: string): boolean =>
  deterministicImageDataUrlPattern.test(reference);

const textureIdAlreadyExists = (
  session: AuthoringSession,
  textureId: SplitPngSourceLayerMetadataDto["textureId"]
): boolean =>
  session.graph.textureAtlas?.textures.some((texture) => texture.textureId === textureId) === true;

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};

type TextureAtlasFile = NonNullable<AuthoringSession["graph"]["textureAtlas"]>;
type TexturePreviewAsset = NonNullable<TextureAtlasFile["previewAssets"]>[number];

const packageLocalTexturePreviewReferencePrefixes = [
  "assets/sources/",
  "assets/textures/",
  "assets/thumbnails/"
] as const;
const generatedTextureReferencePrefix = "generated://texture-preview/";
const deterministicImageDataUrlPattern =
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
