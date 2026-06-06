import type {
  DiagnosticDto,
  OperationId,
  PartId
} from "@private-2d-rigging-lab/contracts";

import type { PsdLayerMaterializationBatchGeneratedTargetsDto } from "../psd-layer-materialization-batch-operation-evidence.js";
import type {
  PsdImportPlanApprovalBridgeEvidenceDto,
  PsdImportPlanCandidateDto,
  PsdImportPlanCandidateStatusDto,
  PsdImportPlanGeneratedScaffoldDto,
  PsdImportPlanSourceLayerReferenceDto
} from "../psd-import-plan-approval-evidence.js";
import { createOperationDiagnostic } from "../preconditions.js";

const IMPORT_PLAN_BLOCKING_CANDIDATE_STATUSES = new Set([
  "hidden",
  "unsupported",
  "emptyZeroSize",
  "duplicateRef",
  "generatedIdCollision",
  "generatedNameCollision",
  "byteCapBlocked"
]);
const IMPORT_PLAN_NOT_APPROVED_STATUS: PsdImportPlanCandidateStatusDto = "notApproved";

export interface ImportPlanBatchEntryForPreflight {
  readonly selectedIndex: number;
  readonly sourceLayerKey: string;
  readonly generated: PsdLayerMaterializationBatchGeneratedTargetsDto;
  readonly sourceDigest?: {
    readonly algorithm: "sha256";
    readonly hex: string;
  };
  readonly sourceByteLength?: number;
}

export interface ImportPlanApprovalBridgeDiagnostics {
  readonly globalDiagnostics: readonly DiagnosticDto[];
  readonly entryDiagnostics: ReadonlyMap<number, readonly DiagnosticDto[]>;
}

export const evaluateImportPlanApprovalBridgeDiagnostics = (input: {
  readonly operationId: OperationId;
  readonly sourceAssetId: string;
  readonly destinationParentPartId: PartId;
  readonly importPlanBridge?: PsdImportPlanApprovalBridgeEvidenceDto;
  readonly entries: readonly ImportPlanBatchEntryForPreflight[];
}): ImportPlanApprovalBridgeDiagnostics => {
  const globalDiagnostics: DiagnosticDto[] = [];
  const entryDiagnostics = new Map<number, DiagnosticDto[]>();
  const bridge = input.importPlanBridge;
  if (bridge === undefined) {
    return { globalDiagnostics, entryDiagnostics };
  }

  addImportPlanGlobalDiagnostics({
    operationId: input.operationId,
    sourceAssetId: input.sourceAssetId,
    destinationParentPartId: input.destinationParentPartId,
    entryCount: input.entries.length,
    bridge,
    globalDiagnostics
  });

  const candidateByLayerKey = createCandidatePlanIndex(bridge.candidatePlan.candidates);
  const notApprovedLayerKeys = createCandidateLayerKeySet(bridge.approval.notApprovedCandidates);
  const blockedLayerKeys = createCandidateLayerKeySet(bridge.approval.blockedCandidates);

  input.entries.forEach((entry) => {
    const approvedLeaf = bridge.approval.approvedLeafRefs[entry.selectedIndex];
    if (approvedLeaf === undefined) {
      addEntryDiagnostic(
        entryDiagnostics,
        entry.selectedIndex,
        createBatchDiagnostic({
          operationId: input.operationId,
          checkId: "operation.importPsdLayerMaterializationBatch.importPlanApprovalMissingLeaf",
          message: `Import plan approval is missing approved leaf at batch entry ${entry.selectedIndex}.`,
          path: `/payload/importPlanBridge/approval/approvedLeafRefs/${entry.selectedIndex}`
        })
      );
      return;
    }

    const approvedLayerKey = createSourceLayerKey(approvedLeaf.sourceLayerRef);
    if (approvedLayerKey !== entry.sourceLayerKey || approvedLeaf.approvalOrder !== entry.selectedIndex) {
      addEntryDiagnostic(
        entryDiagnostics,
        entry.selectedIndex,
        createBatchDiagnostic({
          operationId: input.operationId,
          checkId: "operation.importPsdLayerMaterializationBatch.importPlanApprovedLeafMismatch",
          message: `Batch entry ${entry.selectedIndex} does not match import plan approved leaf ${approvedLayerKey}.`,
          path: `/payload/entries/${entry.selectedIndex}/materialization/sourceLayerRef`
        })
      );
    }

    const candidate = candidateByLayerKey.get(entry.sourceLayerKey);
    if (candidate === undefined) {
      addEntryDiagnostic(
        entryDiagnostics,
        entry.selectedIndex,
        createBatchDiagnostic({
          operationId: input.operationId,
          checkId: "operation.importPsdLayerMaterializationBatch.importPlanCandidateMissing",
          message: `Approved PSD source layer ${entry.sourceLayerKey} is not present in the candidate plan evidence.`,
          path: "/payload/importPlanBridge/candidatePlan/candidates"
        })
      );
    } else {
      addImportPlanCandidateStatusDiagnostics({
        operationId: input.operationId,
        selectedIndex: entry.selectedIndex,
        sourceLayerKey: entry.sourceLayerKey,
        candidate,
        entryDiagnostics
      });
    }

    addImportPlanApprovedLeafStatusDiagnostics({
      operationId: input.operationId,
      selectedIndex: entry.selectedIndex,
      sourceLayerKey: entry.sourceLayerKey,
      statuses: approvedLeaf.candidateStatuses,
      entryDiagnostics
    });

    if (notApprovedLayerKeys.has(entry.sourceLayerKey)) {
      addEntryDiagnostic(
        entryDiagnostics,
        entry.selectedIndex,
        createBatchDiagnostic({
          operationId: input.operationId,
          checkId: "operation.importPsdLayerMaterializationBatch.importPlanNotApprovedCandidateSelected",
          message: `PSD source layer ${entry.sourceLayerKey} is listed as not approved and cannot be imported.`,
          path: "/payload/importPlanBridge/approval/notApprovedCandidates"
        })
      );
    }

    if (blockedLayerKeys.has(entry.sourceLayerKey)) {
      addEntryDiagnostic(
        entryDiagnostics,
        entry.selectedIndex,
        createBatchDiagnostic({
          operationId: input.operationId,
          checkId: "operation.importPsdLayerMaterializationBatch.importPlanBlockedCandidateSelected",
          message: `PSD source layer ${entry.sourceLayerKey} is listed as blocked and cannot be imported.`,
          path: "/payload/importPlanBridge/approval/blockedCandidates"
        })
      );
    }

    if (
      entry.sourceDigest === undefined ||
      !sameDigest(bridge.approval.sourcePsd.digest, entry.sourceDigest) ||
      entry.sourceByteLength === undefined ||
      bridge.approval.sourcePsd.byteLength !== entry.sourceByteLength
    ) {
      addEntryDiagnostic(
        entryDiagnostics,
        entry.selectedIndex,
        createBatchDiagnostic({
          operationId: input.operationId,
          checkId: "operation.importPsdLayerMaterializationBatch.importPlanMaterializationSourceMismatch",
          message: `Materialized PSD source identity for ${entry.sourceLayerKey} does not match the approved import plan source PSD identity.`,
          path: `/payload/entries/${entry.selectedIndex}/materialization/provenance`
        })
      );
    }

    const expectedGenerated =
      approvedLeaf.resolvedGeneratedIds ??
      approvedLeaf.generatedScaffoldPreview ??
      candidate?.generatedScaffoldPreview;
    if (expectedGenerated !== undefined && !generatedScaffoldMatches(entry.generated, expectedGenerated)) {
      addEntryDiagnostic(
        entryDiagnostics,
        entry.selectedIndex,
        createBatchDiagnostic({
          operationId: input.operationId,
          checkId: "operation.importPsdLayerMaterializationBatch.importPlanGeneratedScaffoldMismatch",
          message: `Generated scaffold for ${entry.sourceLayerKey} does not match the approved import plan preview.`,
          path: `/payload/importPlanBridge/approval/approvedLeafRefs/${entry.selectedIndex}/generatedScaffoldPreview`
        })
      );
    }
  });

  return { globalDiagnostics, entryDiagnostics };
};

const addImportPlanGlobalDiagnostics = (input: {
  readonly operationId: OperationId;
  readonly sourceAssetId: string;
  readonly destinationParentPartId: PartId;
  readonly entryCount: number;
  readonly bridge: PsdImportPlanApprovalBridgeEvidenceDto;
  readonly globalDiagnostics: DiagnosticDto[];
}): void => {
  if (!sameDigest(input.bridge.candidatePlan.candidatePlanDigest, input.bridge.approval.candidatePlanDigest)) {
    input.globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.importPlanCandidateDigestMismatch",
        message: "Import plan approval does not reference the supplied candidate plan digest.",
        path: "/payload/importPlanBridge/approval/candidatePlanDigest"
      })
    );
  }

  if (input.bridge.approval.approvalStatus !== "approved") {
    input.globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.importPlanApprovalNotApproved",
        message: `Import plan approval status is ${input.bridge.approval.approvalStatus}; execution requires approved.`,
        path: "/payload/importPlanBridge/approval/approvalStatus"
      })
    );
  }

  if (input.bridge.approval.approvedLeafRefs.length !== input.entryCount) {
    input.globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.importPlanApprovedLeafCountMismatch",
        message: `Import plan approval contains ${input.bridge.approval.approvedLeafRefs.length} approved leaves for ${input.entryCount} batch entries.`,
        path: "/payload/importPlanBridge/approval/approvedLeafRefs"
      })
    );
  }

  if (input.bridge.candidatePlan.sourcePsd.sourceAssetId !== input.sourceAssetId) {
    input.globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.importPlanSourceAssetMismatch",
        message: `Candidate plan source asset ${input.bridge.candidatePlan.sourcePsd.sourceAssetId} does not match batch source asset ${input.sourceAssetId}.`,
        path: "/payload/importPlanBridge/candidatePlan/sourcePsd/sourceAssetId"
      })
    );
  }

  if (input.bridge.approval.sourcePsd.sourceAssetId !== input.sourceAssetId) {
    input.globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.importPlanSourceAssetMismatch",
        message: `Approval source asset ${input.bridge.approval.sourcePsd.sourceAssetId} does not match batch source asset ${input.sourceAssetId}.`,
        path: "/payload/importPlanBridge/approval/sourcePsd/sourceAssetId"
      })
    );
  }

  if (!sameSourcePsdIdentity(input.bridge.candidatePlan.sourcePsd, input.bridge.approval.sourcePsd)) {
    input.globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.importPlanSourcePsdMismatch",
        message: "Candidate plan and approval source PSD identity do not match.",
        path: "/payload/importPlanBridge"
      })
    );
  }

  if (input.bridge.approval.destination.parentPartId !== input.destinationParentPartId) {
    input.globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.importPlanDestinationMismatch",
        message: `Import plan destination parent ${input.bridge.approval.destination.parentPartId} does not match batch destination ${input.destinationParentPartId}.`,
        path: "/payload/importPlanBridge/approval/destination/parentPartId"
      })
    );
  }
};

const addImportPlanCandidateStatusDiagnostics = (input: {
  readonly operationId: OperationId;
  readonly selectedIndex: number;
  readonly sourceLayerKey: string;
  readonly candidate: PsdImportPlanCandidateDto;
  readonly entryDiagnostics: Map<number, DiagnosticDto[]>;
}): void => {
  const blockingStatuses = input.candidate.statuses.filter((status) =>
    IMPORT_PLAN_BLOCKING_CANDIDATE_STATUSES.has(status)
  );
  if (blockingStatuses.length === 0) {
    return;
  }

  addEntryDiagnostic(
    input.entryDiagnostics,
    input.selectedIndex,
    createBatchDiagnostic({
      operationId: input.operationId,
      checkId: "operation.importPsdLayerMaterializationBatch.importPlanBlockedCandidateSelected",
      message: `Approved PSD source layer ${input.sourceLayerKey} has blocking candidate statuses: ${blockingStatuses.join(", ")}.`,
      path: `/payload/importPlanBridge/candidatePlan/candidates/${input.candidate.candidateIndex}/statuses`,
      evidence: [
        "importPlanIssueKind:blockedCandidate",
        ...blockingStatuses.map((status) => `candidateStatus:${status}`)
      ]
    })
  );
};

const addImportPlanApprovedLeafStatusDiagnostics = (input: {
  readonly operationId: OperationId;
  readonly selectedIndex: number;
  readonly sourceLayerKey: string;
  readonly statuses: readonly string[];
  readonly entryDiagnostics: Map<number, DiagnosticDto[]>;
}): void => {
  if (input.statuses.includes(IMPORT_PLAN_NOT_APPROVED_STATUS)) {
    addEntryDiagnostic(
      input.entryDiagnostics,
      input.selectedIndex,
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.importPlanNotApprovedCandidateSelected",
        message: `Approved PSD source layer ${input.sourceLayerKey} still carries notApproved approval status.`,
        path: `/payload/importPlanBridge/approval/approvedLeafRefs/${input.selectedIndex}/candidateStatuses`,
        evidence: ["importPlanIssueKind:notApproved", "candidateStatus:notApproved"]
      })
    );
  }

  const blockingStatuses = input.statuses.filter((status) =>
    IMPORT_PLAN_BLOCKING_CANDIDATE_STATUSES.has(status)
  );
  if (blockingStatuses.length === 0) {
    return;
  }

  addEntryDiagnostic(
    input.entryDiagnostics,
    input.selectedIndex,
    createBatchDiagnostic({
      operationId: input.operationId,
      checkId: "operation.importPsdLayerMaterializationBatch.importPlanBlockedCandidateSelected",
      message: `Approved PSD source layer ${input.sourceLayerKey} carries blocking approval statuses: ${blockingStatuses.join(", ")}.`,
      path: `/payload/importPlanBridge/approval/approvedLeafRefs/${input.selectedIndex}/candidateStatuses`,
      evidence: [
        "importPlanIssueKind:blockedCandidate",
        ...blockingStatuses.map((status) => `candidateStatus:${status}`)
      ]
    })
  );
};

const createCandidatePlanIndex = (
  candidates: readonly PsdImportPlanCandidateDto[]
): ReadonlyMap<string, PsdImportPlanCandidateDto> => {
  const indexed = new Map<string, PsdImportPlanCandidateDto>();
  for (const candidate of candidates) {
    indexed.set(createSourceLayerKey(candidate.sourceLayerRef), candidate);
  }

  return indexed;
};

const createCandidateLayerKeySet = (
  candidates: readonly PsdImportPlanCandidateDto[]
): ReadonlySet<string> =>
  new Set(candidates.map((candidate) => createSourceLayerKey(candidate.sourceLayerRef)));

const createSourceLayerKey = (sourceLayerRef: PsdImportPlanSourceLayerReferenceDto): string =>
  `${sourceLayerRef.sourceAssetId}:${sourceLayerRef.sourceLayerId}`;

const createBatchDiagnostic = (input: {
  readonly operationId: OperationId;
  readonly checkId: string;
  readonly message: string;
  readonly path: string;
  readonly evidence?: readonly string[];
}): DiagnosticDto =>
  createOperationDiagnostic({
    checkId: input.checkId,
    message: input.message,
    ...(input.evidence === undefined ? {} : { evidence: input.evidence }),
    target: {
      kind: "operation",
      id: input.operationId,
      path: input.path
    }
  });

const addEntryDiagnostic = (
  entryDiagnostics: Map<number, DiagnosticDto[]>,
  selectedIndex: number,
  diagnostic: DiagnosticDto
): void => {
  const diagnostics = entryDiagnostics.get(selectedIndex) ?? [];
  entryDiagnostics.set(selectedIndex, [...diagnostics, diagnostic]);
};

const sameDigest = (
  left: { readonly algorithm: "sha256"; readonly hex: string } | undefined,
  right: { readonly algorithm: "sha256"; readonly hex: string } | undefined
): boolean => left !== undefined && right !== undefined && left.algorithm === right.algorithm && left.hex === right.hex;

const sameSourcePsdIdentity = (
  left: PsdImportPlanApprovalBridgeEvidenceDto["candidatePlan"]["sourcePsd"],
  right: PsdImportPlanApprovalBridgeEvidenceDto["approval"]["sourcePsd"]
): boolean =>
  left.sourceAssetId === right.sourceAssetId &&
  left.byteLength === right.byteLength &&
  sameDigest(left.digest, right.digest);

const generatedScaffoldMatches = (
  actual: PsdLayerMaterializationBatchGeneratedTargetsDto,
  expected: PsdImportPlanGeneratedScaffoldDto
): boolean =>
  expected.destinationKind === "generatedPartScaffold" &&
  actual.partId === expected.partId &&
  actual.partDisplayName === expected.partDisplayName &&
  actual.drawableId === expected.drawableId &&
  actual.drawableDisplayName === expected.drawableDisplayName &&
  actual.textureId === expected.textureId &&
  actual.meshId === expected.meshId;
