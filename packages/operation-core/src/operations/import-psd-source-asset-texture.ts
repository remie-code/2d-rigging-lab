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
  ImportPsdSourceAssetPayloadDto,
  PsdAdapterSourceLayerDto
} from "../payloads/import-source.js";
import { createOperationDiagnostic } from "../preconditions.js";
import {
  evaluateTextureBinaryAssetReferencePreconditions,
  resolveBinaryBackedTexturePreviewReference
} from "./import-binary-asset-references.js";

export type PsdTextureMaterializationResult = {
  readonly textureEntry: TextureAtlasFile["textures"][number];
  readonly previewAsset: TexturePreviewAsset;
  readonly authoringRevision: AuthoringSession["authoringRevision"];
};

export const evaluatePsdLayerTextureMappingPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly layer: PsdAdapterSourceLayerDto;
  readonly seenTextureIds: Set<string>;
  readonly sourceTarget: TargetRefDto;
  readonly expectedProvenanceId: ProvenanceId;
  readonly expectedRightsAssetId: SourceAssetId;
}): DiagnosticDto[] => {
  if (!psdLayerRequestsTextureMaterialization(input.layer)) {
    return [];
  }

  const diagnostics: DiagnosticDto[] = [];
  const layerPath = createLayerPayloadPath(input.layer.sourceLayerId);
  const texturePreviewReference = normalizeOptionalString(input.layer.texturePreviewReference);
  const resolvedTexturePreviewReference = resolveBinaryBackedTexturePreviewReference({
    texturePreviewReference,
    texturePreviewBinaryAssetRef: input.layer.texturePreviewBinaryAssetRef
  });
  const textureId = input.layer.textureId;

  if (resolvedTexturePreviewReference === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.missingTexturePreviewReference",
        message: `PSD source layer ${input.layer.sourceLayerId} requires a texture preview reference before texture metadata materialization.`,
        target: { ...input.sourceTarget, path: `${layerPath}/texturePreviewReference` }
      })
    );
  } else if (!isSupportedTexturePreviewReference(resolvedTexturePreviewReference)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.invalidTexturePreviewReference",
        message: createInvalidTexturePreviewReferenceMessage(
          input.layer.sourceLayerId,
          resolvedTexturePreviewReference
        ),
        target: { ...input.sourceTarget, path: `${layerPath}/texturePreviewReference` }
      })
    );
  }

  diagnostics.push(
    ...evaluateTextureBinaryAssetReferencePreconditions({
      operationCheckIdPrefix: "operation.importPsdSourceAsset",
      sourceTarget: input.sourceTarget,
      sourceLayerId: input.layer.sourceLayerId,
      texturePreviewReference,
      texturePreviewBinaryAssetRef: input.layer.texturePreviewBinaryAssetRef,
      expectedProvenanceId: input.expectedProvenanceId,
      expectedRightsAssetId: input.expectedRightsAssetId,
      payloadPath: `${layerPath}/texturePreviewBinaryAssetRef`
    })
  );

  if (textureId === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.missingTextureId",
        message: `PSD source layer ${input.layer.sourceLayerId} requires an explicit texture ID before texture metadata materialization.`,
        target: { ...input.sourceTarget, path: `${layerPath}/textureId` }
      })
    );
  } else if (input.seenTextureIds.has(textureId)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.duplicateTextureId",
        message: `Texture ID appears more than once in the PSD adapter result: ${textureId}.`,
        target: { kind: "texture", id: textureId, path: layerPath }
      })
    );
  } else if (textureIdAlreadyExists(input.session, textureId)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.existingTextureId",
        message: `Texture ID already exists in the texture atlas: ${textureId}.`,
        target: { kind: "texture", id: textureId, path: `${layerPath}/textureId` }
      })
    );
  } else {
    input.seenTextureIds.add(textureId);
  }

  return diagnostics;
};

export const evaluatePsdTargetPartMappingPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly layer: PsdAdapterSourceLayerDto;
  readonly sourceTarget: TargetRefDto;
}): DiagnosticDto[] => {
  if (input.layer.targetPartId === undefined) {
    return [];
  }

  if (getPartById(input.session.graph, input.layer.targetPartId) !== undefined) {
    return [];
  }

  return [
    createOperationDiagnostic({
      checkId: "operation.importPsdSourceAsset.missingLayerTargetPart",
      message: `PSD source layer target part does not exist: ${input.layer.targetPartId}.`,
      target: {
        kind: "part",
        id: input.layer.targetPartId,
        path: `${createLayerPayloadPath(input.layer.sourceLayerId)}/targetPartId`
      }
    })
  ];
};

export const materializePsdLayerTexturePreviewMetadata = (input: {
  readonly session: AuthoringSession;
  readonly payload: ImportPsdSourceAssetPayloadDto;
  readonly sourceAssetId: SourceAssetId;
  readonly provenanceId: ProvenanceId;
}): PsdTextureMaterializationResult[] => {
  const materializations: PsdTextureMaterializationResult[] = [];

  for (const layer of input.payload.adapterResult?.sourceLayers ?? []) {
    if (!psdLayerRequestsTextureMaterialization(layer)) {
      continue;
    }

    const texturePreviewReference = normalizeOptionalString(layer.texturePreviewReference);
    const resolvedTexturePreviewReference = resolveBinaryBackedTexturePreviewReference({
      texturePreviewReference,
      texturePreviewBinaryAssetRef: layer.texturePreviewBinaryAssetRef
    });
    if (resolvedTexturePreviewReference === undefined || layer.textureId === undefined) {
      throw new Error(
        `Expected importPsdSourceAsset preconditions to reject incomplete texture metadata for ${layer.sourceLayerId}.`
      );
    }

    const result = upsertTexturePreviewAssetMetadata(input.session, {
      textureEntry: {
        textureId: layer.textureId,
        filePath: resolveTextureEntryFilePath(layer, resolvedTexturePreviewReference),
        sourceAssetId: input.sourceAssetId,
        sourceLayerId: layer.sourceLayerId,
        provenanceId: input.provenanceId,
        ...(layer.texturePreviewBinaryAssetRef === undefined
          ? {}
          : { binaryAssetRef: structuredClone(layer.texturePreviewBinaryAssetRef) })
      },
      previewAsset: {
        previewAssetId: createTexturePreviewAssetId(input.sourceAssetId, layer.sourceLayerId),
        textureId: layer.textureId,
        reference: createTexturePreviewReference(resolvedTexturePreviewReference),
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

export const psdLayerRequestsTextureMaterialization = (
  layer: PsdAdapterSourceLayerDto
): boolean =>
  layer.texturePreviewReference !== undefined ||
  layer.texturePreviewBinaryAssetRef !== undefined ||
  layer.textureId !== undefined;

export const createLayerPayloadPath = (sourceLayerId: string): string =>
  `/payload/adapterResult/sourceLayers/${sourceLayerId}`;

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
  layer: PsdAdapterSourceLayerDto,
  texturePreviewReference: string
): string => {
  if (texturePreviewReference.startsWith("assets/textures/")) {
    return texturePreviewReference;
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
    return `PSD source layer ${sourceLayerId} generated://texture-preview/ references are not supported by this operation; use a package-local asset path or deterministic image data URL supplied by the adapter.`;
  }

  return `PSD source layer ${sourceLayerId} texture preview reference must be a package-local asset path or deterministic image data URL supplied by the adapter.`;
};

const isDeterministicImageDataUrl = (reference: string): boolean =>
  deterministicImageDataUrlPattern.test(reference);

const textureIdAlreadyExists = (
  session: AuthoringSession,
  textureId: PsdAdapterSourceLayerDto["textureId"]
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
