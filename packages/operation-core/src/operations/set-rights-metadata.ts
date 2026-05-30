import {
  createDryRunAuthoringSession,
  getSourceAssetById,
  setRightsMetadata
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  JsonValue,
  ModelDiffDto,
  OperationId,
  SourceAssetId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

export const setRightsMetadataOperationHandler: OperationHandler = {
  operationType: "setRightsMetadata",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applySetRightsMetadata(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applySetRightsMetadata(session, request, operationId, "committed");
  }
};

const applySetRightsMetadata = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "setRightsMetadata") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.setRightsMetadata.unsupportedPayload",
            message: `setRightsMetadata handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const sourceAssetId = request.payload.assetId as SourceAssetId;
  const sourceTarget: TargetRefDto = { kind: "sourceAsset", id: request.payload.assetId };
  const preconditionDiagnostics = evaluateSetRightsMetadataPreconditions({
    session,
    request,
    sourceAssetId,
    sourceTarget
  });

  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds: [request.payload.assetId],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const mutation = setRightsMetadata(session, {
    rightsRecord: {
      assetId: request.payload.assetId,
      rightsStatus: request.payload.rightsStatus,
      license: request.payload.license,
      redistributionAllowed: request.payload.redistributionAllowed
    },
    ...(request.payload.provenanceId === undefined ? {} : { provenanceId: request.payload.provenanceId }),
    relatedOperationId: operationId
  });

  return {
    result: createSetRightsMetadataResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      sourceTarget,
      rightsRecord: mutation.rightsRecord,
      ...(mutation.rightsBefore === undefined ? {} : { rightsBefore: mutation.rightsBefore }),
      ...(mutation.provenanceBefore === undefined
        ? {}
        : { provenanceBefore: mutation.provenanceBefore }),
      ...(mutation.provenanceRecord === undefined ? {} : { provenanceRecord: mutation.provenanceRecord })
    }),
    targetIds: [request.payload.assetId],
    candidateSession: session
  };
};

const evaluateSetRightsMetadataPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly request: Extract<OperationRequestDto, { operationType: "setRightsMetadata" }>;
  readonly sourceAssetId: SourceAssetId;
  readonly sourceTarget: TargetRefDto;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (getSourceAssetById(input.session.graph, input.sourceAssetId) === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setRightsMetadata.missingSourceAsset",
        message: `Source asset does not exist: ${input.request.payload.assetId}.`,
        target: input.sourceTarget
      })
    );
  }

  if (input.request.payload.rightsStatus === "blocked") {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setRightsMetadata.blockedRights",
        message: `Blocked rights cannot be applied to source asset ${input.request.payload.assetId}.`,
        target: { ...input.sourceTarget, path: "/payload/rightsStatus" }
      })
    );
  }

  const provenanceRecord = findMatchingProvenanceRecord(input.session, {
    assetId: input.request.payload.assetId,
    ...(input.request.payload.provenanceId === undefined
      ? {}
      : { provenanceId: input.request.payload.provenanceId })
  });

  if (provenanceRecord === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setRightsMetadata.missingProvenance",
        message: `Source asset ${input.request.payload.assetId} has no matching provenance record.`,
        target: { ...input.sourceTarget, path: "/payload/provenanceId" }
      })
    );
  }

  return diagnostics;
};

const findMatchingProvenanceRecord = (
  session: AuthoringSession,
  input: {
    readonly assetId: string;
    readonly provenanceId?: string;
  }
) => {
  if (input.provenanceId === undefined) {
    return session.graph.provenanceRecords.find((candidate) => candidate.assetId === input.assetId);
  }

  return session.graph.provenanceRecords.find(
    (candidate) => candidate.assetId === input.assetId && candidate.provenanceId === input.provenanceId
  );
};

const createSetRightsMetadataResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly sourceTarget: TargetRefDto;
  readonly rightsBefore?: RightsRecord;
  readonly rightsRecord: RightsRecord;
  readonly provenanceBefore?: ProvenanceRecord;
  readonly provenanceRecord?: ProvenanceRecord;
}): OperationResultDto => {
  const packageTarget: TargetRefDto = { kind: "package", id: input.packageId };
  const fields: ModelDiffDto["changed"][number]["fields"] = [
    {
      path: `/assets/rights/records/${input.rightsRecord.assetId}`,
      before: input.rightsBefore === undefined ? null : toJsonValue(input.rightsBefore),
      after: toJsonValue(input.rightsRecord)
    },
    ...(input.provenanceRecord === undefined
      ? []
      : [
          {
            path: `/assets/provenance/records/${input.provenanceRecord.provenanceId}`,
            before: input.provenanceBefore === undefined ? null : toJsonValue(input.provenanceBefore),
            after: toJsonValue(input.provenanceRecord)
          }
        ])
  ];
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: packageTarget,
        fields
      },
      {
        target: input.sourceTarget,
        fields
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], [input.sourceTarget, packageTarget]),
    modelDiff,
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    reversible: true
  });
};

type ProvenanceRecord = AuthoringSession["graph"]["provenanceRecords"][number];
type RightsRecord = AuthoringSession["graph"]["rightsRecords"][number];

const toJsonValue = (value: unknown): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;
