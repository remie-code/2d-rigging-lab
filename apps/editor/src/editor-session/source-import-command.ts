import type {
  OperationId,
  PartId,
  SourceAssetId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto,
  type SetRightsMetadataPayloadDto,
  type SplitPngImportProvenanceMetadataDto,
  type SplitPngImportRightsMetadataDto,
  type SplitPngSourceLayerMetadataDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorImportSplitPngSourceAssetCommand {
  readonly operationId?: OperationId | string;
  readonly sourceAssetId?: SourceAssetId | string;
  readonly manifestPath: string;
  readonly contentHash?: string;
  readonly defaultPartId?: PartId | string;
  readonly placementPolicy: "use-metadata" | "origin-with-warning";
  readonly layers: readonly SplitPngSourceLayerMetadataDto[];
  readonly rights: SplitPngImportRightsMetadataDto;
  readonly provenance: SplitPngImportProvenanceMetadataDto;
}

export interface EditorSetRightsMetadataCommand {
  readonly operationId?: OperationId | string;
  readonly assetId: string;
  readonly rightsStatus: SetRightsMetadataPayloadDto["rightsStatus"];
  readonly license: string;
  readonly redistributionAllowed: boolean;
  readonly provenanceId?: SetRightsMetadataPayloadDto["provenanceId"] | string;
}

export const createImportSplitPngSourceAssetOperationRequest = (
  command: EditorImportSplitPngSourceAssetCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-import-split-png-source-${command.sourceAssetId ?? command.manifestPath}`,
    trace: {
      relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-011", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-002", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "importSplitPngSourceAsset",
    payload: {
      ...(command.sourceAssetId === undefined ? {} : { sourceAssetId: command.sourceAssetId }),
      manifestPath: command.manifestPath,
      importProfile: "split-png-fallback-v1",
      ...(command.contentHash === undefined ? {} : { contentHash: command.contentHash }),
      ...(command.defaultPartId === undefined ? {} : { defaultPartId: command.defaultPartId }),
      placementPolicy: command.placementPolicy,
      layers: [...command.layers],
      rights: command.rights,
      provenance: command.provenance
    }
  });

export const createSetRightsMetadataOperationRequest = (
  command: EditorSetRightsMetadataCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-set-rights-metadata-${command.assetId}-${command.rightsStatus}`,
    trace: {
      relatedAC: ["AC-MVP-002", "AC-MVP-011", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-002", "SC-MVP-005"]
    },
    operationType: "setRightsMetadata",
    payload: {
      assetId: command.assetId,
      rightsStatus: command.rightsStatus,
      license: command.license,
      redistributionAllowed: command.redistributionAllowed,
      ...(command.provenanceId === undefined ? {} : { provenanceId: command.provenanceId })
    }
  });
