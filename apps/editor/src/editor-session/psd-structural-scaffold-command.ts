import {
  OperationRequestSchema,
  type OperationRequestDto,
  type PsdStructuralScaffoldApprovalBridgeEvidenceDto,
  type PsdStructuralScaffoldCapPolicyDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorImportPsdStructuralScaffoldCommand {
  readonly operationId?: string;
  readonly sourceAssetId: string;
  readonly batchId: string;
  readonly destinationParentPartId: string;
  readonly structuralScaffoldBridge: PsdStructuralScaffoldApprovalBridgeEvidenceDto;
  readonly capPolicy: PsdStructuralScaffoldCapPolicyDto;
  readonly lockedTargetIds?: readonly string[];
}

export const createImportPsdStructuralScaffoldOperationRequest = (
  command: EditorImportPsdStructuralScaffoldCommand,
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
      "editor-import-psd-structural-scaffold",
      command.sourceAssetId,
      command.batchId,
      command.destinationParentPartId,
      command.structuralScaffoldBridge.structuralPlan.structuralPlanId,
      command.structuralScaffoldBridge.approval.approvalId
    ].join(":"),
    trace: {
      relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-011", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-003", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "importPsdStructuralScaffold",
    payload: {
      sourceAssetId: command.sourceAssetId,
      batchId: command.batchId,
      destination: {
        destinationKind: "structuralScaffold",
        parentPartId: command.destinationParentPartId
      },
      structuralScaffoldBridge: command.structuralScaffoldBridge,
      capPolicy: command.capPolicy,
      lockedTargetIds: [...(command.lockedTargetIds ?? [])]
    }
  });
