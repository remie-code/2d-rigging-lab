import {
  OperationRequestSchema,
  type OperationRequestDto,
  type PsdAdapterLayerMaterializationEvidenceDto,
  type PsdLayerMaterializationDestinationPartDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorImportPsdLayerMaterializationCommand {
  readonly operationId?: string;
  readonly sourceAssetId: string;
  readonly materialization: PsdAdapterLayerMaterializationEvidenceDto;
  readonly textureId?: string;
  readonly drawableId?: string;
  readonly meshId?: string;
  readonly drawableDisplayName?: string;
  readonly destinationPart: PsdLayerMaterializationDestinationPartDto;
  readonly lockedTargetIds?: readonly string[];
}

export interface EditorImportPsdLayerMaterializationBatchCommand {
  readonly operationId?: string;
  readonly sourceAssetId: string;
  readonly batchId: string;
  readonly destinationParentPartId: string;
  readonly entries: readonly {
    readonly materialization: PsdAdapterLayerMaterializationEvidenceDto;
  }[];
  readonly lockedTargetIds?: readonly string[];
}

export const createImportPsdLayerMaterializationOperationRequest = (
  command: EditorImportPsdLayerMaterializationCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: [
      "editor-import-psd-layer-materialization",
      command.sourceAssetId,
      command.materialization.materializationId,
      command.destinationPart.destinationKind,
      "partId" in command.destinationPart ? command.destinationPart.partId : command.destinationPart.displayName
    ].join(":"),
    trace: {
      relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-011", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-003", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "importPsdLayerMaterialization",
    payload: {
      sourceAssetId: command.sourceAssetId,
      materialization: command.materialization,
      ...(command.textureId === undefined ? {} : { textureId: command.textureId }),
      ...(command.drawableId === undefined ? {} : { drawableId: command.drawableId }),
      ...(command.meshId === undefined ? {} : { meshId: command.meshId }),
      ...(command.drawableDisplayName === undefined
        ? {}
        : { drawableDisplayName: command.drawableDisplayName }),
      destinationPart: command.destinationPart,
      lockedTargetIds: [...(command.lockedTargetIds ?? [])]
    }
  });

export const createImportPsdLayerMaterializationBatchOperationRequest = (
  command: EditorImportPsdLayerMaterializationBatchCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: [
      "editor-import-psd-layer-materialization-batch",
      command.sourceAssetId,
      command.batchId,
      command.destinationParentPartId,
      command.entries.map((entry) => entry.materialization.materializationId).join("_")
    ].join(":"),
    trace: {
      relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-011", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-003", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "importPsdLayerMaterializationBatch",
    payload: {
      sourceAssetId: command.sourceAssetId,
      batchId: command.batchId,
      destination: {
        destinationKind: "generatedPartScaffold",
        parentPartId: command.destinationParentPartId
      },
      entries: command.entries.map((entry) => ({
        materialization: entry.materialization
      })),
      lockedTargetIds: [...(command.lockedTargetIds ?? [])]
    }
  });
