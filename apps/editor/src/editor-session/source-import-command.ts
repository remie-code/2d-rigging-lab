import type {
  OperationId,
  PartId,
  SourceAssetId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto,
  type ImportRightsSummaryDto,
  type PsdAdapterResultDto,
  type SetRightsMetadataPayloadDto,
  type SplitPngImportProvenanceMetadataDto,
  type SplitPngImportRightsMetadataDto,
  type SplitPngSourceLayerMetadataDto
} from "@private-2d-rigging-lab/operation-core";
import type { BinaryAssetReferenceDto } from "@private-2d-rigging-lab/package-format";

export type EditorSplitPngSourceLayerMetadataCommand = Omit<
  SplitPngSourceLayerMetadataDto,
  "targetPartId" | "textureId"
> & {
  readonly targetPartId?: PartId | string;
  readonly textureId?: string;
};

export interface EditorImportSplitPngSourceAssetCommand {
  readonly operationId?: OperationId | string;
  readonly sourceAssetId?: SourceAssetId | string;
  readonly manifestPath: string;
  readonly contentHash?: string;
  readonly binaryAssetRef?: BinaryAssetReferenceDto;
  readonly defaultPartId?: PartId | string;
  readonly placementPolicy: "use-metadata" | "origin-with-warning";
  readonly layers: readonly EditorSplitPngSourceLayerMetadataCommand[];
  readonly rights: SplitPngImportRightsMetadataDto;
  readonly provenance: SplitPngImportProvenanceMetadataDto;
}

export interface EditorImportPsdSourceAssetCommand {
  readonly operationId?: OperationId | string;
  readonly sourceAssetId?: SourceAssetId | string;
  readonly fileRef: {
    readonly packageRelativePath: string;
    readonly contentHash?: string;
    readonly binaryAssetRef?: BinaryAssetReferenceDto;
  };
  readonly adapterResult: PsdAdapterResultDto;
  readonly rights: ImportRightsSummaryDto;
  readonly requestedLayerRoles?: Readonly<Record<string, "editableLayer" | "guideImage" | "referenceOnly">>;
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
      ...(command.binaryAssetRef === undefined ? {} : { binaryAssetRef: command.binaryAssetRef }),
      ...(command.defaultPartId === undefined ? {} : { defaultPartId: command.defaultPartId }),
      placementPolicy: command.placementPolicy,
      layers: [...command.layers],
      rights: command.rights,
      provenance: command.provenance
    }
  });

export const createImportPsdSourceAssetOperationRequest = (
  command: EditorImportPsdSourceAssetCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-import-psd-source-${command.sourceAssetId ?? command.fileRef.packageRelativePath}`,
    trace: {
      relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-011", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-002", "SC-IN-003", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "importPsdSourceAsset",
    payload: {
      ...(command.sourceAssetId === undefined ? {} : { sourceAssetId: command.sourceAssetId }),
      fileRef: {
        packageRelativePath: command.fileRef.packageRelativePath,
        ...(command.fileRef.contentHash === undefined ? {} : { contentHash: command.fileRef.contentHash }),
        ...(command.fileRef.binaryAssetRef === undefined
          ? {}
          : { binaryAssetRef: command.fileRef.binaryAssetRef })
      },
      importProfile: "layered-character-psd-profile-v1",
      requestedLayerRoles: command.requestedLayerRoles ?? {},
      adapterResult: command.adapterResult,
      rights: command.rights
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
