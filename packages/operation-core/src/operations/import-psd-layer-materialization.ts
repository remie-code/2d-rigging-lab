import {
  createDrawableWithMesh,
  createDryRunAuthoringSession,
  createManualEmptyMesh,
  createNextDrawOrderEntry,
  createPart,
  getDrawableById,
  getMeshById,
  getPartById,
  getSourceAssetById,
  getTextureAtlasEntryById,
  upsertProvenanceRecord,
  upsertTexturePreviewAssetMetadata
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
  MeshId,
  ModelDiffDto,
  OperationId,
  PartId,
  ProvenanceId,
  RectDto,
  SourceAssetId,
  TargetRefDto,
  TextureId
} from "@private-2d-rigging-lab/contracts";

import {
  createDrawableIdFromDisplayName,
  createMeshIdFromDrawableId,
  createPartIdFromDisplayName,
  createTextureIdFromDrawableId
} from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import { OperationResultSchema, type OperationResultDto } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createPsdLayerMaterializationOperationEvidence,
  PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  type PsdLayerMaterializationOperationEvidenceDto
} from "../psd-layer-materialization-operation-evidence.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { createLockedTargetDiagnostics } from "./locked-targets.js";
import { toModelDiffJsonValue } from "./model-diff-json-value.js";

type ImportPsdLayerMaterializationRequest = Extract<
  OperationRequestDto,
  { operationType: "importPsdLayerMaterialization" }
>;

type SourceAsset = AuthoringSession["graph"]["sourceAssets"][number];
type SourceLayer = SourceAsset["layers"][number];
type ModelPart = AuthoringSession["graph"]["parts"][number];
type Drawable = AuthoringSession["graph"]["drawables"][number];
type Mesh = AuthoringSession["graph"]["meshes"][number];
type ProvenanceRecord = AuthoringSession["graph"]["provenanceRecords"][number];

const SOURCE_ASSET_SHA256_CONTENT_HASH_PATTERN = /^sha256:([a-f0-9]{64})$/;

interface ResolvedImportPsdLayerMaterializationTargets {
  readonly sourceAssetId: SourceAssetId;
  readonly sourceLayerId: string;
  readonly partId: PartId;
  readonly textureId: TextureId;
  readonly drawableId: DrawableId;
  readonly meshId: MeshId;
  readonly drawableDisplayName: string;
  readonly destinationKind: "existingPart" | "newPart";
  readonly checkedTargetRefs: readonly TargetRefDto[];
}

interface PsdLayerMaterializationMutation {
  readonly part?: ModelPart;
  readonly textureEntry: NonNullable<AuthoringSession["graph"]["textureAtlas"]>["textures"][number];
  readonly previewAsset: NonNullable<
    NonNullable<AuthoringSession["graph"]["textureAtlas"]>["previewAssets"]
  >[number];
  readonly drawable: Drawable;
  readonly mesh: Mesh;
  readonly provenanceRecord: ProvenanceRecord;
  readonly partBefore?: ModelPart;
  readonly partAfter: ModelPart;
  readonly sourceLayerBefore: SourceLayer;
  readonly sourceLayerAfter: SourceLayer;
  readonly candidateRevision: number;
}

export const importPsdLayerMaterializationOperationHandler: OperationHandler = {
  operationType: "importPsdLayerMaterialization",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyImportPsdLayerMaterialization(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyImportPsdLayerMaterialization(session, request, operationId, "committed");
  }
};

const applyImportPsdLayerMaterialization = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "importPsdLayerMaterialization") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.importPsdLayerMaterialization.unsupportedPayload",
            message: `importPsdLayerMaterialization handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const targets = resolveTargets(request);
  const diagnostics = evaluateImportPsdLayerMaterializationPreconditions({
    session,
    request,
    targets
  });
  const targetIds = uniqueStrings([
    targets.sourceAssetId,
    targets.sourceLayerId,
    targets.partId,
    targets.textureId,
    targets.drawableId,
    targets.meshId,
    request.payload.materialization.materializationId,
    request.payload.materialization.binaryAssetRef?.binaryAssetId
  ].filter((value): value is string => value !== undefined));

  if (diagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const sourceAsset = getRequiredSourceAsset(session, targets.sourceAssetId);
  const sourceLayer = getRequiredSourceLayer(sourceAsset, targets.sourceLayerId);
  const baseRevision = session.authoringRevision;
  const mutation = materializeLayerIntoSession({
    session,
    request,
    operationId,
    targets,
    sourceAsset,
    sourceLayer
  });
  const evidence = createPsdLayerMaterializationOperationEvidence({
    sourceAssetId: targets.sourceAssetId,
    materialization: request.payload.materialization,
    sourceLayerRef: {
      ...request.payload.materialization.sourceLayerRef,
      sourceLayerName:
        request.payload.materialization.sourceLayerRef.sourceLayerName ??
        sourceLayer.originalName
    },
    destinationKind: targets.destinationKind,
    partId: targets.partId,
    textureId: targets.textureId,
    drawableId: targets.drawableId,
    meshId: targets.meshId,
    materializedByteStorage: "packageLocalBinaryAssetRef"
  });

  return {
    result: createImportPsdLayerMaterializationResult({
      operationId,
      status,
      baseRevision,
      packageId: session.packageIdentity.packageId,
      mutation,
      targets,
      evidence
    }),
    targetIds,
    candidateSession: session
  };
};

const materializeLayerIntoSession = (input: {
  readonly session: AuthoringSession;
  readonly request: ImportPsdLayerMaterializationRequest;
  readonly operationId: OperationId;
  readonly targets: ResolvedImportPsdLayerMaterializationTargets;
  readonly sourceAsset: SourceAsset;
  readonly sourceLayer: SourceLayer;
}): PsdLayerMaterializationMutation => {
  const binaryAssetRef = input.request.payload.materialization.binaryAssetRef;
  if (binaryAssetRef === undefined) {
    throw new Error("Expected preconditions to reject missing materialized binary asset reference.");
  }

  const sourceLayerBefore = structuredClone(input.sourceLayer);
  const partBefore =
    input.targets.destinationKind === "existingPart"
      ? structuredClone(getPartById(input.session.graph, input.targets.partId))
      : undefined;
  const provenanceRecord = createMaterializedLayerProvenanceRecord({
    request: input.request,
    operationId: input.operationId,
    sourceAsset: input.sourceAsset,
    sourceLayer: input.sourceLayer
  });
  upsertProvenanceRecord(input.session, provenanceRecord);

  const partMutation =
    input.targets.destinationKind === "newPart"
      ? createPart(input.session, {
          part: {
            partId: input.targets.partId,
            displayName: input.request.payload.destinationPart.destinationKind === "newPart"
              ? input.request.payload.destinationPart.displayName
              : input.targets.partId,
            ...(input.request.payload.destinationPart.destinationKind !== "newPart" ||
            input.request.payload.destinationPart.parentPartId === undefined
              ? {}
              : { parentPartId: input.request.payload.destinationPart.parentPartId }),
            childPartIds: [],
            drawableIds: []
          }
        })
      : undefined;

  const textureResult = upsertTexturePreviewAssetMetadata(input.session, {
    textureEntry: {
      textureId: input.targets.textureId,
      filePath: binaryAssetRef.packageRelativePath,
      sourceAssetId: input.targets.sourceAssetId,
      sourceLayerId: input.targets.sourceLayerId,
      provenanceId: binaryAssetRef.provenanceId,
      binaryAssetRef: structuredClone(binaryAssetRef)
    },
    previewAsset: {
      previewAssetId: createTexturePreviewAssetId(
        input.targets.sourceAssetId,
        input.targets.sourceLayerId,
        input.targets.textureId
      ),
      textureId: input.targets.textureId,
      reference: {
        referenceKind: "package-local-file-v1",
        filePath: binaryAssetRef.packageRelativePath
      },
      sourceAssetId: input.targets.sourceAssetId,
      sourceLayerId: input.targets.sourceLayerId,
      provenanceId: binaryAssetRef.provenanceId,
      rightsAssetId: input.targets.sourceAssetId
    }
  });

  const drawOrderEntry = createNextDrawOrderEntry(input.session.graph, input.targets.drawableId);
  const drawable = {
    drawableId: input.targets.drawableId,
    displayName: input.targets.drawableDisplayName,
    partId: input.targets.partId,
    sourceAssetId: input.targets.sourceAssetId,
    textureId: input.targets.textureId,
    meshId: input.targets.meshId,
    defaultOpacity: clampOpacity(input.sourceLayer.opacityInSource),
    runtimeVisibility: true,
    baseDrawOrder: drawOrderEntry.baseDrawOrder,
    sourceProvenanceId: binaryAssetRef.provenanceId
  };
  const mesh = createManualEmptyMesh({
    meshId: input.targets.meshId,
    drawableId: input.targets.drawableId,
    bounds: resolveInitialBounds(input.request, input.sourceLayer),
    provenanceId: binaryAssetRef.provenanceId
  });
  const drawableResult = createDrawableWithMesh(input.session, {
    drawable,
    mesh,
    sourceLayerId: input.targets.sourceLayerId,
    sourceProvenanceRecord: provenanceRecord,
    meshProvenanceRecord: provenanceRecord
  });
  const sourceLayerAfter = structuredClone(
    getRequiredSourceLayer(input.sourceAsset, input.targets.sourceLayerId)
  );
  const partAfter = structuredClone(getRequiredPart(input.session, input.targets.partId));

  return {
    ...(partMutation === undefined ? {} : { part: partMutation.part }),
    textureEntry: textureResult.textureEntry,
    previewAsset: textureResult.previewAsset,
    drawable: drawableResult.drawable,
    mesh: drawableResult.mesh,
    provenanceRecord,
    ...(partBefore === undefined ? {} : { partBefore }),
    partAfter,
    sourceLayerBefore,
    sourceLayerAfter,
    candidateRevision: drawableResult.authoringRevision
  };
};

const evaluateImportPsdLayerMaterializationPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly request: ImportPsdLayerMaterializationRequest;
  readonly targets: ResolvedImportPsdLayerMaterializationTargets;
}): DiagnosticDto[] => {
  const sourceTarget = createSourceTarget(input.targets.sourceAssetId);
  const materialization = input.request.payload.materialization;
  const binaryAssetRef = materialization.binaryAssetRef;
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "importPsdLayerMaterialization",
      lockedTargetIds: input.request.payload.lockedTargetIds,
      targets: input.targets.checkedTargetRefs
    })
  ];
  const sourceAsset = getSourceAssetById(input.session.graph, input.targets.sourceAssetId);

  if (sourceAsset === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingSourceAsset",
        message: `PSD source asset does not exist: ${input.targets.sourceAssetId}.`,
        target: sourceTarget
      })
    );
  } else {
    diagnostics.push(
      ...evaluateSourceLayerIdentity({
        sourceAsset,
        request: input.request,
        targets: input.targets
      })
    );
    diagnostics.push(
      ...evaluateSourcePsdIdentity({
        sourceAsset,
        request: input.request,
        sourceTarget
      })
    );
  }

  diagnostics.push(...evaluateMaterializedAssetIdentity(input.request));
  diagnostics.push(...evaluateDestinationPreconditions(input.session, input.request, input.targets));

  if (binaryAssetRef !== undefined && binaryAssetRef.rightsAssetId !== input.targets.sourceAssetId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.materializedRightsAssetMismatch",
        message: `Materialized layer binary asset rights ${binaryAssetRef.rightsAssetId} must match source asset ${input.targets.sourceAssetId}.`,
        target: createBinaryAssetTarget(binaryAssetRef.binaryAssetId)
      })
    );
  }

  if (
    binaryAssetRef !== undefined &&
    !input.session.graph.rightsRecords.some(
      (record) => record.assetId === input.targets.sourceAssetId && record.rightsStatus !== "blocked"
    )
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingUsableRightsRecord",
        message: `Materialized layer intake requires an unblocked rights record for source asset ${input.targets.sourceAssetId}.`,
        target: sourceTarget
      })
    );
  }

  return diagnostics;
};

const evaluateSourceLayerIdentity = (input: {
  readonly sourceAsset: SourceAsset;
  readonly request: ImportPsdLayerMaterializationRequest;
  readonly targets: ResolvedImportPsdLayerMaterializationTargets;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];
  const materializationLayerRef = input.request.payload.materialization.sourceLayerRef;
  const sourceLayer = input.sourceAsset.layers.find(
    (layer) => layer.sourceLayerId === input.targets.sourceLayerId
  );
  const sourceTarget = {
    ...createSourceTarget(input.targets.sourceAssetId),
    path: `/layers/${input.targets.sourceLayerId}`
  };

  if (materializationLayerRef.sourceAssetId !== input.targets.sourceAssetId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.sourceAssetMismatch",
        message: `Materialization source asset ${materializationLayerRef.sourceAssetId} does not match payload source asset ${input.targets.sourceAssetId}.`,
        target: createSourceTarget(input.targets.sourceAssetId)
      })
    );
  }

  if (sourceLayer === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingSourceLayer",
        message: `PSD source layer does not exist: ${input.targets.sourceLayerId}.`,
        target: sourceTarget
      })
    );
    return diagnostics;
  }

  if (
    materializationLayerRef.sourceLayerName !== undefined &&
    materializationLayerRef.sourceLayerName !== sourceLayer.originalName &&
    materializationLayerRef.sourceLayerName !== sourceLayer.normalizedName
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.sourceLayerNameMismatch",
        message: `Materialization source layer name ${materializationLayerRef.sourceLayerName} does not match source layer ${sourceLayer.sourceLayerId}.`,
        target: sourceTarget
      })
    );
  }

  if (
    materializationLayerRef.sourceLayerPath !== undefined &&
    materializationLayerRef.sourceLayerPath.length > 0
  ) {
    const expectedTail = [...sourceLayer.groupPath, sourceLayer.originalName].join("/");
    const actualPath = materializationLayerRef.sourceLayerPath.join("/");
    if (actualPath !== expectedTail && !actualPath.endsWith(`/${expectedTail}`)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importPsdLayerMaterialization.sourceLayerPathMismatch",
          message: `Materialization source layer path ${actualPath} does not match source layer ${sourceLayer.sourceLayerId}.`,
          target: sourceTarget
        })
      );
    }
  }

  return diagnostics;
};

const evaluateSourcePsdIdentity = (input: {
  readonly sourceAsset: SourceAsset;
  readonly request: ImportPsdLayerMaterializationRequest;
  readonly sourceTarget: TargetRefDto;
}): DiagnosticDto[] => {
  const provenance = input.request.payload.materialization.provenance;
  const diagnostics: DiagnosticDto[] = [];

  if (provenance.sourceDigest === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingSourcePsdDigest",
        message: "Materialized PSD layer evidence requires the source PSD SHA-256 digest.",
        target: { ...input.sourceTarget, path: "/payload/materialization/provenance/sourceDigest" }
      })
    );
  }

  if (provenance.sourceByteLength === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingSourcePsdByteLength",
        message: "Materialized PSD layer evidence requires the source PSD byte length.",
        target: { ...input.sourceTarget, path: "/payload/materialization/provenance/sourceByteLength" }
      })
    );
  }

  const sourceBinaryAssetRef = input.sourceAsset.binaryAssetRef;
  const sourceContentHashDigest = parseSourceAssetSha256ContentHash(input.sourceAsset.contentHash);
  const expectedSourceDigest = sourceBinaryAssetRef?.digest ?? sourceContentHashDigest;
  if (
    provenance.sourceDigest !== undefined &&
    expectedSourceDigest !== undefined &&
    (expectedSourceDigest.algorithm !== provenance.sourceDigest.algorithm ||
      expectedSourceDigest.hex !== provenance.sourceDigest.hex)
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.sourcePsdDigestMismatch",
        message: "Materialized PSD layer evidence was derived from a different source PSD digest.",
        target: input.sourceTarget
      })
    );
  }

  if (
    provenance.sourceByteLength !== undefined &&
    sourceBinaryAssetRef !== undefined &&
    sourceBinaryAssetRef.byteLength !== provenance.sourceByteLength
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.sourcePsdByteLengthMismatch",
        message: "Materialized PSD layer evidence was derived from a different source PSD byte length.",
        target: input.sourceTarget
      })
    );
  }

  const sourceParser = input.sourceAsset.psdProfile?.adapter.parser;
  const materializationParser = input.request.payload.materialization.parser;
  if (materializationParser === undefined || materializationParser.parserVersion === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingParserVersion",
        message: "Materialized PSD layer evidence requires parser evidence with parserVersion.",
        target: { ...input.sourceTarget, path: "/payload/materialization/parser" }
      })
    );
  } else if (
    sourceParser !== undefined &&
    (sourceParser.parserName !== materializationParser.parserName ||
      sourceParser.parserVersion !== materializationParser.parserVersion)
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.parserEvidenceMismatch",
        message: "Materialized PSD layer parser evidence does not match the source PSD parser evidence.",
        target: { ...input.sourceTarget, path: "/payload/materialization/parser" }
      })
    );
  }

  const extraction = input.request.payload.materialization.extraction;
  if (extraction === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingExtractionOptions",
        message: "Materialized PSD layer evidence requires selected-layer extraction options.",
        target: { ...input.sourceTarget, path: "/payload/materialization/extraction" }
      })
    );
  } else {
    diagnostics.push(
      ...evaluateSelectedLayerExtractionOptions({
        extraction,
        sourceLayerId: input.request.payload.materialization.sourceLayerRef.sourceLayerId,
        sourceTarget: input.sourceTarget
      })
    );
  }

  return diagnostics;
};

const parseSourceAssetSha256ContentHash = (contentHash: string | undefined) => {
  const match = SOURCE_ASSET_SHA256_CONTENT_HASH_PATTERN.exec(contentHash ?? "");
  if (match === null) {
    return undefined;
  }

  return {
    algorithm: "sha256" as const,
    hex: match[1]
  };
};

const evaluateSelectedLayerExtractionOptions = (input: {
  readonly extraction: NonNullable<
    ImportPsdLayerMaterializationRequest["payload"]["materialization"]["extraction"]
  >;
  readonly sourceLayerId: string;
  readonly sourceTarget: TargetRefDto;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];
  const extractionTarget = { ...input.sourceTarget, path: "/payload/materialization/extraction" };

  if (input.extraction.extractionKind !== "selectedLayerRasterV1") {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.unsupportedExtractionKind",
        message:
          "Selected PSD layer materialization requires selectedLayerRasterV1 extraction evidence.",
        target: { ...extractionTarget, path: "/payload/materialization/extraction/extractionKind" }
      })
    );
  }

  if (input.extraction.optionsSchemaVersion !== "psd-layer-extraction-options-v1") {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.extractionOptionMismatch",
        message:
          "Selected PSD layer materialization requires psd-layer-extraction-options-v1 option evidence.",
        target: { ...extractionTarget, path: "/payload/materialization/extraction/optionsSchemaVersion" }
      })
    );
  }

  const options = input.extraction.options ?? {};
  const expectedOptions: ReadonlyArray<readonly [string, string | boolean]> = [
    ["channelOrder", "rgba"],
    ["includeEffects", false],
    ["includeHiddenLayers", false],
    ["composeWithOtherLayers", false],
    ["layerSelection", input.sourceLayerId]
  ];
  const mismatchedOptions = expectedOptions
    .filter(([optionName, expectedValue]) => options[optionName] !== expectedValue)
    .map(([optionName]) => optionName);

  if (mismatchedOptions.length > 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.extractionOptionMismatch",
        message: `Selected PSD layer materialization extraction options must match canonical selected-layer RGBA intake: ${mismatchedOptions.join(", ")}.`,
        target: { ...extractionTarget, path: "/payload/materialization/extraction/options" }
      })
    );
  }

  return diagnostics;
};

const evaluateMaterializedAssetIdentity = (
  request: ImportPsdLayerMaterializationRequest
): DiagnosticDto[] => {
  const materialization = request.payload.materialization;
  const binaryAssetRef = materialization.binaryAssetRef;
  const target = createMaterializationTarget(materialization.materializationId);
  const diagnostics: DiagnosticDto[] = [];

  if (materialization.mediaType !== PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.unsupportedMaterializedMediaType",
        message: `Selected PSD layer materialization requires ${PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE}.`,
        target: { ...target, path: "/payload/materialization/mediaType" }
      })
    );
  }

  if (materialization.width === undefined || materialization.height === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingMaterializedDimensions",
        message: "Raw RGBA selected-layer materialization requires width and height evidence.",
        target: { ...target, path: "/payload/materialization" }
      })
    );
  } else if (materialization.byteLength !== materialization.width * materialization.height * 4) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.rawRgbaByteLengthMismatch",
        message: "Raw RGBA selected-layer byte length must equal width * height * 4.",
        target: { ...target, path: "/payload/materialization/byteLength" }
      })
    );
  }

  if (binaryAssetRef === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingMaterializedBinaryAssetRef",
        message: "Materialized selected-layer bytes require a package-local binary asset reference; re-materialize, reupload, or re-select the source PSD layer.",
        target: { ...target, path: "/payload/materialization/binaryAssetRef" }
      })
    );
    return diagnostics;
  }

  if (!binaryAssetRef.packageRelativePath.startsWith("assets/textures/")) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.materializedTexturePathMismatch",
        message: "Materialized layer texture bytes must use a package-local assets/textures path.",
        target: createBinaryAssetTarget(binaryAssetRef.binaryAssetId)
      })
    );
  }

  if (
    binaryAssetRef.digest.hex !== materialization.digest.hex ||
    binaryAssetRef.byteLength !== materialization.byteLength ||
    binaryAssetRef.mediaType !== materialization.mediaType
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.materializedBinaryAssetRefMismatch",
        message: "Materialized binary asset ref digest, byteLength, or mediaType does not match selected-layer materialization evidence.",
        target: createBinaryAssetTarget(binaryAssetRef.binaryAssetId)
      })
    );
  }

  if (binaryAssetRef.storageStatus !== "stored-package-local-v1") {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.materializedBytesUnavailable",
        message: `Materialized selected-layer bytes are ${binaryAssetRef.storageStatus}; re-materialize, reupload, or re-select the source PSD layer.`,
        target: createBinaryAssetTarget(binaryAssetRef.binaryAssetId)
      })
    );
  }

  return diagnostics;
};

const evaluateDestinationPreconditions = (
  session: AuthoringSession,
  request: ImportPsdLayerMaterializationRequest,
  targets: ResolvedImportPsdLayerMaterializationTargets
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (getTextureAtlasEntryById(session.graph, targets.textureId) !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.duplicateTexture",
        message: `Texture already exists: ${targets.textureId}.`,
        target: createTextureTarget(targets.textureId)
      })
    );
  }

  if (getDrawableById(session.graph, targets.drawableId) !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.duplicateDrawable",
        message: `Drawable already exists: ${targets.drawableId}.`,
        target: createDrawableTarget(targets.drawableId)
      })
    );
  }

  if (getMeshById(session.graph, targets.meshId) !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.duplicateMesh",
        message: `Mesh already exists: ${targets.meshId}.`,
        target: createMeshTarget(targets.meshId)
      })
    );
  }

  if (request.payload.destinationPart.destinationKind === "existingPart") {
    if (getPartById(session.graph, targets.partId) === undefined) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importPsdLayerMaterialization.missingDestinationPart",
          message: `Destination part does not exist: ${targets.partId}.`,
          target: createPartTarget(targets.partId)
        })
      );
    }
    return diagnostics;
  }

  if (getPartById(session.graph, targets.partId) !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.duplicateDestinationPart",
        message: `Destination part already exists: ${targets.partId}.`,
        target: createPartTarget(targets.partId)
      })
    );
  }

  const parentPartId = request.payload.destinationPart.parentPartId;
  if (parentPartId !== undefined && getPartById(session.graph, parentPartId) === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.missingDestinationParentPart",
        message: `Destination parent part does not exist: ${parentPartId}.`,
        target: createPartTarget(parentPartId)
      })
    );
  }

  if (parentPartId !== undefined && parentPartId === targets.partId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdLayerMaterialization.destinationPartCycle",
        message: `Destination part ${targets.partId} cannot parent itself.`,
        target: createPartTarget(targets.partId)
      })
    );
  }

  return diagnostics;
};

const createImportPsdLayerMaterializationResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly packageId: string;
  readonly mutation: PsdLayerMaterializationMutation;
  readonly targets: ResolvedImportPsdLayerMaterializationTargets;
  readonly evidence: PsdLayerMaterializationOperationEvidenceDto;
}): OperationResultDto => {
  const packageTarget: TargetRefDto = { kind: "package", id: input.packageId };
  const sourceTarget = createSourceTarget(input.targets.sourceAssetId);
  const textureTarget = createTextureTarget(input.targets.textureId);
  const drawableTarget = createDrawableTarget(input.targets.drawableId);
  const meshTarget = createMeshTarget(input.targets.meshId);
  const partTarget = createPartTarget(input.targets.partId);
  const added = [
    ...(input.mutation.part === undefined ? [] : [partTarget]),
    textureTarget,
    drawableTarget,
    meshTarget
  ];
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.mutation.candidateRevision,
    added,
    removed: [],
    changed: [
      {
        target: packageTarget,
        fields: [
          ...(input.mutation.part === undefined
            ? []
            : [
                {
                  path: "/model/graph/parts",
                  before: null,
                  after: input.mutation.part.partId
                },
                {
                  path: "/model/graph/stableOrder",
                  before: null,
                  after: input.mutation.part.partId
                }
              ]),
          {
            path: "/assets/textureAtlas/textures",
            before: null,
            after: input.mutation.textureEntry.textureId
          },
          {
            path: "/assets/textureAtlas/previewAssets",
            before: null,
            after: input.mutation.previewAsset.previewAssetId
          },
          {
            path: "/model/drawables/drawables",
            before: null,
            after: input.mutation.drawable.drawableId
          },
          {
            path: "/model/meshes/meshes",
            before: null,
            after: input.mutation.mesh.meshId
          },
          {
            path: "/model/drawOrder/entries",
            before: null,
            after: input.mutation.drawable.drawableId
          }
        ]
      },
      ...(input.mutation.part === undefined
        ? []
        : [
            {
              target: partTarget,
              fields: [
                {
                  path: `/model/graph/parts/${input.mutation.part.partId}`,
                  before: null,
                  after: toModelDiffJsonValue(input.mutation.part)
                }
              ]
            }
          ]),
      {
        target: textureTarget,
        fields: [
          {
            path: `/assets/textureAtlas/textures/${input.mutation.textureEntry.textureId}`,
            before: null,
            after: toModelDiffJsonValue(input.mutation.textureEntry)
          },
          {
            path: `/assets/textureAtlas/previewAssets/${input.mutation.previewAsset.previewAssetId}`,
            before: null,
            after: toModelDiffJsonValue(input.mutation.previewAsset)
          }
        ]
      },
      {
        target: drawableTarget,
        fields: [
          {
            path: `/model/drawables/${input.mutation.drawable.drawableId}`,
            before: null,
            after: toModelDiffJsonValue(input.mutation.drawable)
          }
        ]
      },
      {
        target: meshTarget,
        fields: [
          {
            path: `/model/meshes/${input.mutation.mesh.meshId}`,
            before: null,
            after: toModelDiffJsonValue(input.mutation.mesh)
          }
        ]
      },
      {
        target: partTarget,
        fields: [
          {
            path: `/model/graph/parts/${input.targets.partId}/children`,
            before: toModelDiffJsonValue(input.mutation.partBefore?.children ?? []),
            after: toModelDiffJsonValue(input.mutation.partAfter.children ?? [])
          },
          {
            path: `/model/graph/parts/${input.targets.partId}/drawableIds`,
            before: input.mutation.partBefore?.drawableIds ?? [],
            after: input.mutation.partAfter.drawableIds
          }
        ]
      },
      {
        target: sourceTarget,
        fields: [
          {
            path: `/assets/sourceManifest/sourceAssets/${input.targets.sourceAssetId}/layers/${input.targets.sourceLayerId}/mappedDrawableIds`,
            before: input.mutation.sourceLayerBefore.mappedDrawableIds,
            after: input.mutation.sourceLayerAfter.mappedDrawableIds
          },
          {
            path: "/assets/provenance/records",
            before: null,
            after: toModelDiffJsonValue(input.mutation.provenanceRecord)
          }
        ]
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], input.targets.checkedTargetRefs),
    modelDiff,
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    psdLayerMaterializationEvidence: [input.evidence],
    reversible: true
  });
};

const resolveTargets = (
  request: ImportPsdLayerMaterializationRequest
): ResolvedImportPsdLayerMaterializationTargets => {
  const sourceAssetId = request.payload.sourceAssetId;
  const sourceLayerId = request.payload.materialization.sourceLayerRef.sourceLayerId;
  const drawableDisplayName =
    request.payload.drawableDisplayName ??
    request.payload.materialization.sourceLayerRef.sourceLayerName ??
    sourceLayerId;
  const drawableId =
    request.payload.drawableId ?? createDrawableIdFromDisplayName(drawableDisplayName);
  const meshId = request.payload.meshId ?? createMeshIdFromDrawableId(drawableId);
  const textureId =
    request.payload.textureId ??
    request.payload.materialization.textureId ??
    createTextureIdFromDrawableId(drawableId);
  const destinationKind = request.payload.destinationPart.destinationKind;
  const partId =
    destinationKind === "existingPart"
      ? request.payload.destinationPart.partId
      : request.payload.destinationPart.partId ??
        createPartIdFromDisplayName(request.payload.destinationPart.displayName);
  const checkedTargetRefs = uniqueTargetRefs([
    createSourceTarget(sourceAssetId),
    createTextureTarget(textureId),
    createDrawableTarget(drawableId),
    createMeshTarget(meshId),
    createPartTarget(partId),
    ...(destinationKind === "newPart" &&
    request.payload.destinationPart.parentPartId !== undefined
      ? [createPartTarget(request.payload.destinationPart.parentPartId)]
      : [])
  ]);

  return {
    sourceAssetId,
    sourceLayerId,
    partId,
    textureId,
    drawableId,
    meshId,
    drawableDisplayName,
    destinationKind,
    checkedTargetRefs
  };
};

const createMaterializedLayerProvenanceRecord = (input: {
  readonly request: ImportPsdLayerMaterializationRequest;
  readonly operationId: OperationId;
  readonly sourceAsset: SourceAsset;
  readonly sourceLayer: SourceLayer;
}): ProvenanceRecord => {
  const materialization = input.request.payload.materialization;
  const binaryAssetRef = materialization.binaryAssetRef;
  if (binaryAssetRef === undefined) {
    throw new Error("Expected preconditions to reject missing materialized binary asset reference.");
  }

  return {
    provenanceId: binaryAssetRef.provenanceId,
    assetId: input.sourceAsset.sourceAssetId,
    assetKind: "texture",
    filePath: binaryAssetRef.packageRelativePath,
    contentHash: `${binaryAssetRef.digest.algorithm}:${binaryAssetRef.digest.hex}`,
    creator: input.request.actor,
    license: "private-local-selected-psd-layer",
    redistributionAllowed: false,
    aiUsed: input.request.actor === "ai",
    transformHistory: [
      "importPsdLayerMaterialization:selected-layer-raw-rgba",
      `sourcePsd:${materialization.provenance.sourceFilePath}`,
      `sourceLayer:${input.sourceLayer.sourceLayerId}:${input.sourceLayer.originalName}`,
      `materialization:${materialization.materializationId}`,
      `mediaType:${materialization.mediaType}`,
      ...(materialization.parser?.parserVersion === undefined
        ? []
        : [`parserVersion:${materialization.parser.parserVersion}`])
    ],
    relatedOperationIds: [input.operationId]
  };
};

const resolveInitialBounds = (
  request: ImportPsdLayerMaterializationRequest,
  sourceLayer: SourceLayer
): RectDto => {
  if (request.payload.initialBounds !== undefined) {
    return structuredClone(request.payload.initialBounds);
  }

  return structuredClone(sourceLayer.bounds);
};

const clampOpacity = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, Math.min(1, value));
};

const getRequiredSourceAsset = (
  session: AuthoringSession,
  sourceAssetId: SourceAssetId
): SourceAsset => {
  const sourceAsset = getSourceAssetById(session.graph, sourceAssetId);
  if (sourceAsset === undefined) {
    throw new Error(`Expected preconditions to reject missing source asset ${sourceAssetId}.`);
  }

  return sourceAsset;
};

const getRequiredSourceLayer = (
  sourceAsset: SourceAsset,
  sourceLayerId: string
): SourceLayer => {
  const sourceLayer = sourceAsset.layers.find((layer) => layer.sourceLayerId === sourceLayerId);
  if (sourceLayer === undefined) {
    throw new Error(`Expected preconditions to reject missing source layer ${sourceLayerId}.`);
  }

  return sourceLayer;
};

const getRequiredPart = (
  session: AuthoringSession,
  partId: PartId
): ModelPart => {
  const part = getPartById(session.graph, partId);
  if (part === undefined) {
    throw new Error(`Expected preconditions to reject missing part ${partId}.`);
  }

  return part;
};

const createTexturePreviewAssetId = (
  sourceAssetId: SourceAssetId,
  sourceLayerId: string,
  textureId: TextureId
): string =>
  `preview_${sanitizeIdToken(sourceAssetId)}_${sanitizeIdToken(sourceLayerId)}_${sanitizeIdToken(textureId)}`;

const createSourceTarget = (sourceAssetId: SourceAssetId | string): TargetRefDto => ({
  kind: "sourceAsset",
  id: sourceAssetId
});

const createTextureTarget = (textureId: TextureId | string): TargetRefDto => ({
  kind: "texture",
  id: textureId
});

const createDrawableTarget = (drawableId: DrawableId | string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

const createMeshTarget = (meshId: MeshId | string): TargetRefDto => ({
  kind: "mesh",
  id: meshId
});

const createPartTarget = (partId: PartId | string): TargetRefDto => ({
  kind: "part",
  id: partId
});

const createBinaryAssetTarget = (binaryAssetId: string): TargetRefDto => ({
  kind: "texture",
  id: binaryAssetId
});

const createMaterializationTarget = (materializationId: string): TargetRefDto => ({
  kind: "sourceAsset",
  id: materializationId
});

const uniqueTargetRefs = (refs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];

  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}:${ref.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(ref);
  }

  return unique;
};

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values)];

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};
