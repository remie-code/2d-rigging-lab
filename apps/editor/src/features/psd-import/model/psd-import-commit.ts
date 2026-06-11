import {
  registerAuthoringSessionBinaryBytes,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import { OperationIdSchema, type DiagnosticDto } from "@private-2d-rigging-lab/contracts";
import {
  createOperationCore,
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

import type { PsdImportPlan } from "./psd-import-types";

export class PsdImportCommitError extends Error {
  readonly diagnostics: readonly DiagnosticDto[];

  constructor(message: string, diagnostics: readonly DiagnosticDto[]) {
    super(message);
    this.name = "PsdImportCommitError";
    this.diagnostics = diagnostics;
  }
}

export interface CommitPsdImportPlanResult {
  readonly session: AuthoringSession;
  readonly editorHiddenPartIds: PsdImportPlan["editorHiddenPartIds"];
}

export function commitPsdImportPlan(input: {
  readonly session: AuthoringSession;
  readonly plan: PsdImportPlan;
}): CommitPsdImportPlanResult {
  const nextSession = structuredClone(input.session);
  const operationCore = createOperationCore();
  const sourceImportOutcome = operationCore.commitOperation(
    nextSession,
    createSourceImportRequest({
      plan: input.plan,
      basePackageRevision: nextSession.packageRevision
    })
  );

  if (sourceImportOutcome.result.status !== "committed") {
    throw new PsdImportCommitError(
      "PSD source metadata could not be committed.",
      sourceImportOutcome.result.diagnostics
    );
  }

  const structuralOutcome = operationCore.commitOperation(
    nextSession,
    createStructuralImportRequest({
      plan: input.plan,
      basePackageRevision: nextSession.packageRevision
    })
  );

  if (structuralOutcome.result.status !== "committed") {
    throw new PsdImportCommitError(
      "PSD structural import could not be committed.",
      structuralOutcome.result.diagnostics
    );
  }

  registerMaterializedLayerBytes({
    session: nextSession,
    plan: input.plan,
    structuralOperationId: structuralOutcome.result.operationId
  });

  return {
    session: nextSession,
    editorHiddenPartIds: input.plan.editorHiddenPartIds
  };
}

function registerMaterializedLayerBytes(input: {
  readonly session: AuthoringSession;
  readonly plan: PsdImportPlan;
  readonly structuralOperationId: string;
}): void {
  const generatedTextureIdBySourceLayerId = new Map(
    input.plan.bridge.approval.approvedLeafScaffolds.map((leaf) => [
      leaf.sourceLayerRef.sourceLayerId,
      leaf.generatedTextureId
    ])
  );

  for (const layerBytes of input.plan.materializedLayerBytes) {
    const generatedTextureId = generatedTextureIdBySourceLayerId.get(layerBytes.sourceLayerId);
    registerAuthoringSessionBinaryBytes(input.session, {
      binaryAssetRef: layerBytes.binaryAssetRef,
      bytes: layerBytes.bytes,
      role: "texture-raster-v1",
      sourceAssetId: input.plan.sourceAssetId,
      ...(generatedTextureId === undefined ? {} : { textureId: generatedTextureId }),
      createdByOperationId: input.structuralOperationId
    });
  }
}

function createSourceImportRequest(input: {
  readonly plan: PsdImportPlan;
  readonly basePackageRevision: number;
}): OperationRequestDto {
  return OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: OperationIdSchema.parse(`op_import_psd_source_${input.plan.token}`),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: `psd-source:${input.plan.token}`,
    trace: {
      relatedAC: ["UX-FEAT-013", "UX-FEAT-019"],
      relatedScenarios: []
    },
    operationType: "importPsdSourceAsset",
    payload: {
      sourceAssetId: input.plan.sourceAssetId,
      fileRef: {
        packageRelativePath: input.plan.sourceFilePath,
        contentHash: input.plan.sourceContentHash
      },
      importProfile: "layered-character-psd-profile-v1",
      requestedLayerRoles: {},
      adapterResult: input.plan.adapterResult,
      rights: {
        creator: "local PSD import",
        license: "private-local",
        redistributionAllowed: false,
        aiUsed: false
      }
    }
  });
}

function createStructuralImportRequest(input: {
  readonly plan: PsdImportPlan;
  readonly basePackageRevision: number;
}): OperationRequestDto {
  return OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: OperationIdSchema.parse(`op_import_psd_structural_${input.plan.token}`),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: `psd-structural:${input.plan.token}`,
    trace: {
      relatedAC: ["UX-FEAT-013", "UX-FEAT-019"],
      relatedScenarios: []
    },
    operationType: "importPsdStructuralScaffold",
    payload: {
      sourceAssetId: input.plan.sourceAssetId,
      batchId: `batch_${input.plan.token}`,
      destination: {
        destinationKind: "structuralScaffold",
        parentPartId: input.plan.destination.parentPartId
      },
      structuralScaffoldBridge: input.plan.bridge,
      capPolicy: input.plan.capPolicy,
      lockedTargetIds: []
    }
  });
}
