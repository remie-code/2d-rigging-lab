import {
  cloneAuthoringSession,
  createDryRunAuthoringSession,
  getDrawableById,
  getMeshById,
  getPartById,
  getSourceAssetById,
  getTextureAtlasEntryById,
  createDrawableChildEntry,
  createPartChildEntry,
  reorderChildrenBySourceOrder
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  OperationIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  PartId,
  SourceAssetId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { OperationRequestSchema, type OperationRequestDto } from "../operation-request.js";
import { OperationResultSchema, type OperationResultDto } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  PSD_STRUCTURAL_APPROVED_GROUP_LIMIT,
  PSD_STRUCTURAL_APPROVED_LEAF_LIMIT,
  PSD_STRUCTURAL_GENERATED_NODE_LIMIT,
  PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT,
  PsdStructuralScaffoldOperationEvidenceDtoSchema,
  type PsdStructuralScaffoldGroupPartDto,
  type PsdStructuralScaffoldIssueDto,
  type PsdStructuralScaffoldIssueKindDto,
  type PsdStructuralScaffoldLeafDrawableDto,
  type PsdStructuralScaffoldOperationEvidenceDto
} from "../psd-structural-scaffold-evidence.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { createLockedTargetDiagnostics } from "./locked-targets.js";
import { toModelDiffJsonValue } from "./model-diff-json-value.js";
import { importPsdLayerMaterializationOperationHandler } from "./import-psd-layer-materialization.js";
import { createPartOperationHandler } from "./create-part.js";
import { setRuntimeVisibilityOperationHandler } from "./set-runtime-visibility.js";

type ImportPsdStructuralScaffoldRequest = Extract<
  OperationRequestDto,
  { operationType: "importPsdStructuralScaffold" }
>;
type ImportPsdLayerMaterializationRequest = Extract<
  OperationRequestDto,
  { operationType: "importPsdLayerMaterialization" }
>;
type CreatePartRequest = Extract<OperationRequestDto, { operationType: "createPart" }>;
type SetRuntimeVisibilityRequest = Extract<
  OperationRequestDto,
  { operationType: "setRuntimeVisibility" }
>;
type SourceAsset = AuthoringSession["graph"]["sourceAssets"][number];
type MaterializationEvidence = NonNullable<
  NonNullable<SourceAsset["psdProfile"]>["materializationEvidence"]
>[number];

interface IndexedDiagnostics {
  readonly globalDiagnostics: readonly DiagnosticDto[];
  readonly groupDiagnostics: ReadonlyMap<string, readonly DiagnosticDto[]>;
  readonly leafDiagnostics: ReadonlyMap<string, readonly DiagnosticDto[]>;
}

interface PlannedStructuralExecution {
  readonly sourceAsset: SourceAsset | undefined;
  readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly materializationByLayerId: ReadonlyMap<string, MaterializationEvidence>;
  readonly checkedTargetRefs: readonly TargetRefDto[];
  readonly targetIds: readonly string[];
  readonly diagnostics: IndexedDiagnostics;
}

export const importPsdStructuralScaffoldOperationHandler: OperationHandler = {
  operationType: "importPsdStructuralScaffold",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyImportPsdStructuralScaffold(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    const candidateSession = cloneAuthoringSession(session);
    const applied = applyImportPsdStructuralScaffold(
      candidateSession,
      request,
      operationId,
      "committed"
    );

    if (applied.result.status !== "committed") {
      return {
        ...applied,
        candidateSession: session
      };
    }

    replaceAuthoringSession(session, candidateSession);

    return {
      ...applied,
      candidateSession: session
    };
  }
};

const applyImportPsdStructuralScaffold = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "importPsdStructuralScaffold") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.importPsdStructuralScaffold.unsupportedPayload",
            message: `importPsdStructuralScaffold handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const planned = planStructuralExecution(session, request, operationId);
  if (hasDiagnostics(planned.diagnostics)) {
    return {
      result: createRejectedStructuralResult({
        request,
        operationId,
        checkedTargetRefs: planned.checkedTargetRefs,
        diagnostics: planned.diagnostics
      }),
      targetIds: planned.targetIds,
      candidateSession: session
    };
  }

  const mutationSession = cloneAuthoringSession(session);
  const groupOutcomes = planned.groupScaffolds.map((group) =>
    createPartOperationHandler.commit(
      mutationSession,
      createGroupPartRequest(request, operationId, group),
      createGroupOperationId(operationId, group)
    )
  );
  const materializationOutcomes: OperationApplyOutcome[] = [];
  const visibilityOutcomes: OperationApplyOutcome[] = [];

  for (const leaf of planned.leafScaffolds) {
    const materialization = planned.materializationByLayerId.get(leaf.sourceLayerRef.sourceLayerId);
    if (materialization === undefined) {
      throw new Error(
        `Expected preconditions to resolve materialization for ${leaf.sourceLayerRef.sourceLayerId}.`
      );
    }

    const materializationOutcome = importPsdLayerMaterializationOperationHandler.commit(
      mutationSession,
      createLeafMaterializationRequest(request, operationId, leaf, materialization),
      createLeafOperationId(operationId, leaf)
    );
    materializationOutcomes.push(materializationOutcome);

    if (materializationOutcome.result.status !== "committed" || leaf.initialRuntimeVisibility) {
      continue;
    }

    visibilityOutcomes.push(
      setRuntimeVisibilityOperationHandler.commit(
        mutationSession,
        createHiddenLeafVisibilityRequest(request, operationId, leaf),
        createVisibilityOperationId(operationId, leaf)
      )
    );
  }

  const childOutcomes = [...groupOutcomes, ...materializationOutcomes, ...visibilityOutcomes];
  const childDiagnostics = collectChildDiagnostics(childOutcomes);
  if (childDiagnostics.globalDiagnostics.length > 0) {
    return {
      result: createRejectedStructuralResult({
        request,
        operationId,
        checkedTargetRefs: planned.checkedTargetRefs,
        diagnostics: childDiagnostics
      }),
      targetIds: planned.targetIds,
      candidateSession: session
    };
  }

  const importedSourceOrderEntries = createImportedSourceOrderEntries(
    planned.groupScaffolds,
    planned.leafScaffolds
  );
  const sourceOrderBefore = captureStructuralSourceOrderState(
    mutationSession,
    importedSourceOrderEntries
  );
  reorderChildrenBySourceOrder(mutationSession, importedSourceOrderEntries);
  const sourceOrderChanges = createStructuralSourceOrderChanges({
    session: mutationSession,
    before: sourceOrderBefore,
    after: captureStructuralSourceOrderState(mutationSession, importedSourceOrderEntries)
  });
  replaceAuthoringSession(session, mutationSession);

  return {
    result: createCommittedStructuralResult({
      request,
      operationId,
      status,
      checkedTargetRefs: planned.checkedTargetRefs,
      baseRevision,
      finalRevision: mutationSession.authoringRevision,
      childOutcomes,
      groupScaffolds: planned.groupScaffolds,
      leafScaffolds: planned.leafScaffolds,
      sourceOrderChanges
    }),
    targetIds: planned.targetIds,
    candidateSession: session
  };
};

const planStructuralExecution = (
  session: AuthoringSession,
  request: ImportPsdStructuralScaffoldRequest,
  operationId: OperationId
): PlannedStructuralExecution => {
  const groupScaffolds = sortGroupScaffolds(
    request.payload.structuralScaffoldBridge.approval.approvedGroupPartScaffolds
  );
  const leafScaffolds = sortLeafScaffolds(
    request.payload.structuralScaffoldBridge.approval.approvedLeafScaffolds
  );
  const checkedTargetRefs = createStructuralCheckedTargetRefs(request, groupScaffolds, leafScaffolds);
  const sourceAsset = getSourceAssetById(session.graph, request.payload.sourceAssetId);
  const materializationByLayerId = createMaterializationIndex(sourceAsset);
  const diagnostics = evaluateStructuralPreconditions({
    session,
    request,
    operationId,
    sourceAsset,
    materializationByLayerId,
    groupScaffolds,
    leafScaffolds,
    checkedTargetRefs
  });

  return {
    sourceAsset,
    groupScaffolds,
    leafScaffolds,
    materializationByLayerId,
    checkedTargetRefs,
    targetIds: createStructuralTargetIds(request, operationId, groupScaffolds, leafScaffolds),
    diagnostics
  };
};

const evaluateStructuralPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly sourceAsset: SourceAsset | undefined;
  readonly materializationByLayerId: ReadonlyMap<string, MaterializationEvidence>;
  readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly checkedTargetRefs: readonly TargetRefDto[];
}): IndexedDiagnostics => {
  const globalDiagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "importPsdStructuralScaffold",
      lockedTargetIds: input.request.payload.lockedTargetIds,
      targets: input.checkedTargetRefs
    })
  ];
  const groupDiagnostics = new Map<string, DiagnosticDto[]>();
  const leafDiagnostics = new Map<string, DiagnosticDto[]>();

  addBridgeDiagnostics({ ...input, globalDiagnostics });
  addSourceAssetDiagnostics({ ...input, globalDiagnostics });
  addCapDiagnostics({ ...input, globalDiagnostics });
  addGroupDiagnostics({ ...input, groupDiagnostics });
  addLeafDiagnostics({ ...input, leafDiagnostics });

  return { globalDiagnostics, groupDiagnostics, leafDiagnostics };
};

const addBridgeDiagnostics = (input: {
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly globalDiagnostics: DiagnosticDto[];
}): void => {
  const bridge = input.request.payload.structuralScaffoldBridge;
  const plan = bridge.structuralPlan;
  const approval = bridge.approval;

  if (!sameDigest(plan.structuralPlanDigest, approval.structuralPlanDigest)) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: "structuralPlanDigestMismatch",
        message: "Structural scaffold approval does not reference the supplied structural plan digest.",
        path: "/payload/structuralScaffoldBridge/approval/structuralPlanDigest"
      })
    );
  }

  if (approval.approvalStatus !== "approved") {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind:
          approval.approvalStatus === "structuralExpansionCapExceeded"
            ? "structuralExpansionCapExceeded"
            : "structuralPlanStale",
        checkId: "approvalNotApproved",
        message: `Structural scaffold approval status is ${approval.approvalStatus}; execution requires approved.`,
        path: "/payload/structuralScaffoldBridge/approval/approvalStatus"
      })
    );
  }

  if (plan.sourcePsd.sourceAssetId !== input.request.payload.sourceAssetId) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceIdentityMismatch",
        checkId: "planSourceAssetMismatch",
        message: `Structural plan source asset ${plan.sourcePsd.sourceAssetId} does not match payload source asset ${input.request.payload.sourceAssetId}.`,
        path: "/payload/structuralScaffoldBridge/structuralPlan/sourcePsd/sourceAssetId"
      })
    );
  }

  if (approval.sourcePsd.sourceAssetId !== input.request.payload.sourceAssetId) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceIdentityMismatch",
        checkId: "approvalSourceAssetMismatch",
        message: `Structural approval source asset ${approval.sourcePsd.sourceAssetId} does not match payload source asset ${input.request.payload.sourceAssetId}.`,
        path: "/payload/structuralScaffoldBridge/approval/sourcePsd/sourceAssetId"
      })
    );
  }

  if (!sameSourcePsdIdentity(plan.sourcePsd, approval.sourcePsd)) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceIdentityMismatch",
        checkId: "planApprovalSourcePsdMismatch",
        message: "Structural plan and approval source PSD identity do not match.",
        path: "/payload/structuralScaffoldBridge"
      })
    );
  }

  if (approval.destination.parentPartId !== input.request.payload.destination.parentPartId) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "destinationParent",
        checkId: "destinationMismatch",
        message: `Structural approval destination parent ${approval.destination.parentPartId} does not match payload destination ${input.request.payload.destination.parentPartId}.`,
        path: "/payload/structuralScaffoldBridge/approval/destination/parentPartId"
      })
    );
  }

  if (
    !sameCapPolicy(input.request.payload.capPolicy, plan.capPolicy) ||
    !sameCapPolicy(input.request.payload.capPolicy, approval.capPolicy)
  ) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralExpansionCapExceeded",
        checkId: "capPolicyMismatch",
        message: "Structural scaffold cap policy must match the plan, approval, and operation payload.",
        path: "/payload/capPolicy"
      })
    );
  }

  if (!usesDefaultExecutionCaps(input.request.payload.capPolicy)) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralExpansionCapExceeded",
        checkId: "executionCapPolicyMismatch",
        message: "Structural scaffold execution requires the Wave50 conservative default cap policy.",
        path: "/payload/capPolicy"
      })
    );
  }

  addApprovalPlanBindingDiagnostics({ ...input, plan, approval });
};

const addApprovalPlanBindingDiagnostics = (input: {
  readonly operationId: OperationId;
  readonly globalDiagnostics: DiagnosticDto[];
  readonly plan: ImportPsdStructuralScaffoldRequest["payload"]["structuralScaffoldBridge"]["structuralPlan"];
  readonly approval: ImportPsdStructuralScaffoldRequest["payload"]["structuralScaffoldBridge"]["approval"];
}): void => {
  for (const approvedGroup of input.approval.approvedGroupPartScaffolds) {
    const plannedGroups = input.plan.plannedGroupPartScaffolds.filter(
      (plannedGroup) =>
        plannedGroup.sourceGroupRef.sourceGroupId === approvedGroup.sourceGroupRef.sourceGroupId
    );
    const exactPlannedGroup = plannedGroups.find(
      (plannedGroup) => findGroupPlanMismatches(plannedGroup, approvedGroup).length === 0
    );
    if (exactPlannedGroup !== undefined) {
      continue;
    }

    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: plannedGroups.length === 0 ? "approvedGroupNotPlanned" : "approvedGroupPlanMismatch",
        message:
          plannedGroups.length === 0
            ? `Approved structural group ${approvedGroup.sourceGroupRef.sourceGroupId} is not present in the supplied structural plan.`
            : `Approved structural group ${approvedGroup.sourceGroupRef.sourceGroupId} does not match the supplied structural plan scaffold.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
      })
    );
  }

  for (const approvedLeaf of input.approval.approvedLeafScaffolds) {
    const plannedLeaves = input.plan.plannedLeafScaffolds.filter(
      (plannedLeaf) => plannedLeaf.sourceLayerRef.sourceLayerId === approvedLeaf.sourceLayerRef.sourceLayerId
    );
    const exactPlannedLeaf = plannedLeaves.find(
      (plannedLeaf) => findLeafPlanMismatches(plannedLeaf, approvedLeaf).length === 0
    );
    if (exactPlannedLeaf !== undefined) {
      continue;
    }

    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: plannedLeaves.length === 0 ? "approvedLeafNotPlanned" : "approvedLeafPlanMismatch",
        message:
          plannedLeaves.length === 0
            ? `Approved structural leaf ${approvedLeaf.sourceLayerRef.sourceLayerId} is not present in the supplied structural plan.`
            : `Approved structural leaf ${approvedLeaf.sourceLayerRef.sourceLayerId} does not match the supplied structural plan scaffold.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      })
    );
  }
};

const findGroupPlanMismatches = (
  planned: PsdStructuralScaffoldGroupPartDto,
  approved: PsdStructuralScaffoldGroupPartDto
): readonly string[] => [
  ...(sameSourceGroupRef(planned.sourceGroupRef, approved.sourceGroupRef) ? [] : ["sourceGroupRef"]),
  ...(sameOptionalSourceGroupRef(planned.sourceParentGroupRef, approved.sourceParentGroupRef)
    ? []
    : ["sourceParentGroupRef"]),
  ...(planned.sourceGroupName === approved.sourceGroupName ? [] : ["sourceGroupName"]),
  ...(sameStringArray(planned.sourceGroupPath, approved.sourceGroupPath) ? [] : ["sourceGroupPath"]),
  ...(planned.sourceOrder === approved.sourceOrder ? [] : ["sourceOrder"]),
  ...(planned.visibleInSource === approved.visibleInSource ? [] : ["visibleInSource"]),
  ...(planned.localVisibleInSource === approved.localVisibleInSource ? [] : ["localVisibleInSource"]),
  ...(planned.effectiveVisibleInSource === approved.effectiveVisibleInSource
    ? []
    : ["effectiveVisibleInSource"]),
  ...(planned.opacityInSource === approved.opacityInSource ? [] : ["opacityInSource"]),
  ...(sameOptionalRect(planned.bounds, approved.bounds) ? [] : ["bounds"]),
  ...(planned.generatedParentPartId === approved.generatedParentPartId ? [] : ["generatedParentPartId"]),
  ...(planned.generatedPartId === approved.generatedPartId ? [] : ["generatedPartId"]),
  ...(planned.generatedPartDisplayName === approved.generatedPartDisplayName
    ? []
    : ["generatedPartDisplayName"])
];

const findLeafPlanMismatches = (
  planned: PsdStructuralScaffoldLeafDrawableDto,
  approved: PsdStructuralScaffoldLeafDrawableDto
): readonly string[] => [
  ...(sameSourceLayerRef(planned.sourceLayerRef, approved.sourceLayerRef) ? [] : ["sourceLayerRef"]),
  ...(sameOptionalSourceGroupRef(planned.sourceParentGroupRef, approved.sourceParentGroupRef)
    ? []
    : ["sourceParentGroupRef"]),
  ...(planned.sourceLayerName === approved.sourceLayerName ? [] : ["sourceLayerName"]),
  ...(sameStringArray(planned.sourceLayerPath, approved.sourceLayerPath) ? [] : ["sourceLayerPath"]),
  ...(planned.sourceOrder === approved.sourceOrder ? [] : ["sourceOrder"]),
  ...(planned.visibleInSource === approved.visibleInSource ? [] : ["visibleInSource"]),
  ...(planned.localVisibleInSource === approved.localVisibleInSource ? [] : ["localVisibleInSource"]),
  ...(planned.effectiveVisibleInSource === approved.effectiveVisibleInSource
    ? []
    : ["effectiveVisibleInSource"]),
  ...(planned.opacityInSource === approved.opacityInSource ? [] : ["opacityInSource"]),
  ...(sameRect(planned.bounds, approved.bounds) ? [] : ["bounds"]),
  ...(planned.generatedParentPartId === approved.generatedParentPartId ? [] : ["generatedParentPartId"]),
  ...(planned.generatedDrawableId === approved.generatedDrawableId ? [] : ["generatedDrawableId"]),
  ...(planned.generatedTextureId === approved.generatedTextureId ? [] : ["generatedTextureId"]),
  ...(planned.generatedMeshId === approved.generatedMeshId ? [] : ["generatedMeshId"]),
  ...(planned.generatedDrawableDisplayName === approved.generatedDrawableDisplayName
    ? []
    : ["generatedDrawableDisplayName"]),
  ...(planned.initialRuntimeVisibility === approved.initialRuntimeVisibility
    ? []
    : ["initialRuntimeVisibility"])
];

const addSourceAssetDiagnostics = (input: {
  readonly session: AuthoringSession;
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly sourceAsset: SourceAsset | undefined;
  readonly globalDiagnostics: DiagnosticDto[];
}): void => {
  const sourceTarget = createSourceTarget(input.request.payload.sourceAssetId);

  if (getPartById(input.session.graph, input.request.payload.destination.parentPartId) === undefined) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "destinationParent",
        checkId: "missingDestinationParentPart",
        message: `Destination parent part does not exist: ${input.request.payload.destination.parentPartId}.`,
        target: createPartTarget(input.request.payload.destination.parentPartId),
        path: "/payload/destination/parentPartId"
      })
    );
  }

  if (input.sourceAsset === undefined) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "currentSessionSourceMissing",
        checkId: "missingSourceAsset",
        message: `PSD source asset does not exist: ${input.request.payload.sourceAssetId}.`,
        target: sourceTarget
      })
    );
    return;
  }

  const sourceIdentity = input.request.payload.structuralScaffoldBridge.approval.sourcePsd;
  const currentDigest =
    input.sourceAsset.binaryAssetRef?.digest ?? parseSourceAssetSha256ContentHash(input.sourceAsset.contentHash);
  if (currentDigest !== undefined && !sameDigest(currentDigest, sourceIdentity.digest)) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceIdentityMismatch",
        checkId: "sourcePsdDigestMismatch",
        message: "Structural scaffold evidence was derived from a different source PSD digest.",
        target: sourceTarget
      })
    );
  }

  if (
    input.sourceAsset.binaryAssetRef !== undefined &&
    input.sourceAsset.binaryAssetRef.byteLength !== sourceIdentity.byteLength
  ) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceIdentityMismatch",
        checkId: "sourcePsdByteLengthMismatch",
        message: "Structural scaffold evidence was derived from a different source PSD byte length.",
        target: sourceTarget
      })
    );
  }

  const currentParser = input.sourceAsset.psdProfile?.adapter.parser;
  const planParser = input.request.payload.structuralScaffoldBridge.structuralPlan.parser;
  if (currentParser !== undefined && planParser === undefined) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: "missingParserEvidence",
        message: "Structural scaffold plan requires parser evidence for the current PSD source profile.",
        target: sourceTarget,
        path: "/payload/structuralScaffoldBridge/structuralPlan/parser"
      })
    );
  } else if (currentParser !== undefined && planParser !== undefined && !sameParser(currentParser, planParser)) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: "parserEvidenceMismatch",
        message: "Structural scaffold parser evidence does not match the current PSD source profile.",
        target: sourceTarget,
        path: "/payload/structuralScaffoldBridge/structuralPlan/parser"
      })
    );
  }

  addStoredStructuralEvidenceDiagnostics(input);
};

const addStoredStructuralEvidenceDiagnostics = (input: {
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly sourceAsset: SourceAsset | undefined;
  readonly globalDiagnostics: DiagnosticDto[];
}): void => {
  const profile = input.sourceAsset?.psdProfile;
  if (profile === undefined) {
    return;
  }

  const plan = input.request.payload.structuralScaffoldBridge.structuralPlan;
  const approval = input.request.payload.structuralScaffoldBridge.approval;

  if (
    profile.psdStructuralScaffoldPlanEvidence !== undefined &&
    !profile.psdStructuralScaffoldPlanEvidence.some(
      (storedPlan) =>
        storedPlan.structuralPlanId === plan.structuralPlanId &&
        sameDigest(storedPlan.structuralPlanDigest, plan.structuralPlanDigest)
    )
  ) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: "storedPlanEvidenceMismatch",
        message: "Structural scaffold plan evidence does not match current source asset stored plan evidence.",
        target: createSourceTarget(input.request.payload.sourceAssetId),
        path: "/assets/sourceManifest/sourceAssets/psdProfile/psdStructuralScaffoldPlanEvidence"
      })
    );
  }

  if (
    profile.psdStructuralScaffoldApprovalEvidence !== undefined &&
    !profile.psdStructuralScaffoldApprovalEvidence.some(
      (storedApproval) =>
        storedApproval.approvalId === approval.approvalId &&
        sameDigest(storedApproval.structuralPlanDigest, approval.structuralPlanDigest) &&
        sameDigest(storedApproval.approvalSelectionDigest, approval.approvalSelectionDigest) &&
        storedApproval.approvalStatus === approval.approvalStatus
    )
  ) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: "storedApprovalEvidenceMismatch",
        message: "Structural scaffold approval evidence does not match current source asset stored approval evidence.",
        target: createSourceTarget(input.request.payload.sourceAssetId),
        path: "/assets/sourceManifest/sourceAssets/psdProfile/psdStructuralScaffoldApprovalEvidence"
      })
    );
  }
};

const addCapDiagnostics = (input: {
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly materializationByLayerId: ReadonlyMap<string, MaterializationEvidence>;
  readonly globalDiagnostics: DiagnosticDto[];
}): void => {
  const capPolicy = input.request.payload.capPolicy;
  const generatedNodeCount = input.groupScaffolds.length + input.leafScaffolds.length;
  const totalRawRgbaByteLength = input.leafScaffolds.reduce((sum, leaf) => {
    const materialization = input.materializationByLayerId.get(leaf.sourceLayerRef.sourceLayerId);
    return sum + (materialization?.byteLength ?? leaf.byteEstimate ?? 0);
  }, 0);

  if (input.groupScaffolds.length > capPolicy.approvedGroupLimit) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralExpansionCapExceeded",
        checkId: "approvedGroupCountCapExceeded",
        message: `PSD structural scaffold accepts at most ${capPolicy.approvedGroupLimit} approved groups; received ${input.groupScaffolds.length}.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
      })
    );
  }

  if (input.leafScaffolds.length > capPolicy.approvedLeafLimit) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralExpansionCapExceeded",
        checkId: "approvedLeafCountCapExceeded",
        message: `PSD structural scaffold accepts at most ${capPolicy.approvedLeafLimit} approved leaves; received ${input.leafScaffolds.length}.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      })
    );
  }

  if (generatedNodeCount > capPolicy.generatedNodeLimit) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralExpansionCapExceeded",
        checkId: "generatedNodeCountCapExceeded",
        message: `PSD structural scaffold accepts at most ${capPolicy.generatedNodeLimit} generated nodes; received ${generatedNodeCount}.`,
        path: "/payload/structuralScaffoldBridge/approval"
      })
    );
  }

  if (totalRawRgbaByteLength > capPolicy.totalRawRgbaByteLimit) {
    input.globalDiagnostics.push(
      createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "byteCapExceeded",
        checkId: "totalByteLengthCapExceeded",
        message: `PSD structural scaffold raw RGBA bytes exceed ${capPolicy.totalRawRgbaByteLimit}; received ${totalRawRgbaByteLength}.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      })
    );
  }
};

const addGroupDiagnostics = (input: {
  readonly session: AuthoringSession;
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly sourceAsset: SourceAsset | undefined;
  readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly groupDiagnostics: Map<string, DiagnosticDto[]>;
}): void => {
  const sourceGroupsById = new Map(
    (input.sourceAsset?.psdProfile?.sourceGroups ?? []).map((group) => [group.sourceGroupId, group])
  );
  const generatedGroupPartIds = new Map<string, PsdStructuralScaffoldGroupPartDto>();
  const firstBySourceGroupId = new Map<string, PsdStructuralScaffoldGroupPartDto>();
  const firstGroupByParentName = new Map<string, PsdStructuralScaffoldGroupPartDto>();

  for (const group of input.groupScaffolds) {
    const groupKey = group.sourceGroupRef.sourceGroupId;

    const firstGroupForSourceRef = firstBySourceGroupId.get(groupKey);
    if (firstGroupForSourceRef !== undefined) {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "collision",
        checkId: "duplicateApprovedSourceGroup",
        message: `Approved structural source group ${groupKey} is included more than once.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
      }));
    } else {
      firstBySourceGroupId.set(groupKey, group);
    }

    if (group.status !== "approved") {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: "groupApprovalStatusMismatch",
        message: `Approved structural group ${groupKey} has status ${group.status}; execution requires approved.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
      }));
    }

    if (group.sourceGroupRef.sourceAssetId !== input.request.payload.sourceAssetId) {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceIdentityMismatch",
        checkId: "groupSourceAssetMismatch",
        message: `Structural group ${groupKey} source asset does not match payload source asset ${input.request.payload.sourceAssetId}.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
      }));
    }

    const sourceGroup = sourceGroupsById.get(group.sourceGroupRef.sourceGroupId);
    if (sourceGroup === undefined) {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceGroupMappingMissing",
        checkId: "sourceGroupMappingMissing",
        message: `PSD source group does not exist: ${group.sourceGroupRef.sourceGroupId}.`,
        path: "/assets/sourceManifest/sourceAssets/psdProfile/sourceGroups"
      }));
    } else {
      addSourceGroupMismatchDiagnostics(input, group, sourceGroup, input.groupDiagnostics);
    }

    const firstGroupForId = generatedGroupPartIds.get(group.generatedPartId);
    if (firstGroupForId !== undefined) {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralGeneratedRefCollision",
        checkId: "duplicateGeneratedGroupPartId",
        message: `Generated group part id ${group.generatedPartId} collides with source group ${firstGroupForId.sourceGroupRef.sourceGroupId}.`,
        target: createPartTarget(group.generatedPartId),
        path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
      }));
    } else {
      generatedGroupPartIds.set(group.generatedPartId, group);
    }

    if (getPartById(input.session.graph, group.generatedPartId) !== undefined) {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralGeneratedRefCollision",
        checkId: "generatedGroupPartAlreadyExists",
        message: `Generated group part already exists: ${group.generatedPartId}.`,
        target: createPartTarget(group.generatedPartId)
      }));
    }

    if (!parentPartExistsOrWillBeGenerated(input.session, group.generatedParentPartId, generatedGroupPartIds)) {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "destinationParent",
        checkId: "missingGeneratedGroupParentPart",
        message: `Generated group parent part does not exist or is not approved for creation: ${group.generatedParentPartId}.`,
        target: createPartTarget(group.generatedParentPartId),
        path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
      }));
    }

    const nameKey = `${group.generatedParentPartId}:${normalizeDisplayName(group.generatedPartDisplayName)}`;
    const firstGroupForName = firstGroupByParentName.get(nameKey);
    if (firstGroupForName !== undefined) {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralGeneratedRefCollision",
        checkId: "generatedGroupNameCollision",
        message: `Generated group part display name ${group.generatedPartDisplayName} collides under parent ${group.generatedParentPartId}.`,
        target: createPartTarget(group.generatedPartId),
        path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
      }));
    } else {
      firstGroupByParentName.set(nameKey, group);
    }

    if (existingSiblingPartNames(input.session, group.generatedParentPartId).has(normalizeDisplayName(group.generatedPartDisplayName))) {
      addGroupDiagnostic(input.groupDiagnostics, groupKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralGeneratedRefCollision",
        checkId: "generatedGroupNameCollision",
        message: `Generated group part display name already exists under parent ${group.generatedParentPartId}: ${group.generatedPartDisplayName}.`,
        target: createPartTarget(group.generatedPartId)
      }));
    }
  }
};

const addSourceGroupMismatchDiagnostics = (
  input: {
    readonly request: ImportPsdStructuralScaffoldRequest;
    readonly operationId: OperationId;
    readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  },
  group: PsdStructuralScaffoldGroupPartDto,
  sourceGroup: NonNullable<SourceAsset["psdProfile"]>["sourceGroups"][number],
  groupDiagnostics: Map<string, DiagnosticDto[]>
): void => {
  const groupKey = group.sourceGroupRef.sourceGroupId;

  if (!sourceDisplayNameMatches(group.sourceGroupName, sourceGroup.originalName, sourceGroup.normalizedName)) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupNameMismatch",
      message: `Structural group name ${group.sourceGroupName ?? "<missing>"} does not match current source group name ${sourceGroup.originalName}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }

  if (
    !sourceDisplayNameMatches(
      group.sourceGroupRef.sourceGroupName,
      sourceGroup.originalName,
      sourceGroup.normalizedName
    )
  ) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupRefNameMismatch",
      message: `Structural group ref name ${group.sourceGroupRef.sourceGroupName ?? "<missing>"} does not match current source group name ${sourceGroup.originalName}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds/sourceGroupRef"
    }));
  }

  if (
    group.sourceGroupRef.sourceGroupPath !== undefined &&
    !sameStringArray(sourceGroup.groupPath, group.sourceGroupRef.sourceGroupPath)
  ) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupRefPathMismatch",
      message: `Structural group ref path ${group.sourceGroupRef.sourceGroupPath.join("/")} does not match current source group path ${sourceGroup.groupPath.join("/")}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds/sourceGroupRef"
    }));
  }

  if (sourceGroup.sourceOrder !== group.sourceOrder) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralSourceOrderMismatch",
      checkId: "groupSourceOrderMismatch",
      message: `Structural group sourceOrder ${group.sourceOrder} does not match current source group order ${sourceGroup.sourceOrder}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }

  if (!sameStringArray(sourceGroup.groupPath, group.sourceGroupPath)) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupPathMismatch",
      message: `Structural group path ${group.sourceGroupPath.join("/")} does not match current source group path ${sourceGroup.groupPath.join("/")}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }

  if (sourceGroup.visibleInSource !== group.visibleInSource) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupVisibilityMismatch",
      message: `Structural group visibility ${group.visibleInSource} does not match current source group visibility ${sourceGroup.visibleInSource}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }

  const sourceGroupLocalVisible = sourceGroup.localVisibleInSource ?? sourceGroup.visibleInSource;
  const groupLocalVisible = group.localVisibleInSource ?? group.visibleInSource;
  if (sourceGroupLocalVisible !== groupLocalVisible) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupLocalVisibilityMismatch",
      message: `Structural group local visibility ${groupLocalVisible} does not match current source group local visibility ${sourceGroupLocalVisible}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }

  const sourceGroupEffectiveVisible =
    sourceGroup.effectiveVisibleInSource ?? sourceGroup.visibleInSource;
  const groupEffectiveVisible = group.effectiveVisibleInSource ?? group.visibleInSource;
  if (sourceGroupEffectiveVisible !== groupEffectiveVisible) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupEffectiveVisibilityMismatch",
      message: `Structural group effective visibility ${groupEffectiveVisible} does not match current source group effective visibility ${sourceGroupEffectiveVisible}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }

  if (sourceGroup.opacityInSource !== group.opacityInSource) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupOpacityMismatch",
      message: `Structural group opacity ${group.opacityInSource} does not match current source group opacity ${sourceGroup.opacityInSource}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }

  if (!sameOptionalRect(sourceGroup.bounds, group.bounds)) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "groupBoundsMismatch",
      message: `Structural group bounds do not match current source group bounds for ${groupKey}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds/bounds"
    }));
  }

  const expectedParentGroupId = group.sourceParentGroupRef?.sourceGroupId;
  if (sourceGroup.parentGroupId !== expectedParentGroupId) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralParentageMismatch",
      checkId: "groupSourceParentageMismatch",
      message: `Structural group parent ${expectedParentGroupId ?? "<root>"} does not match current source parent ${sourceGroup.parentGroupId ?? "<root>"}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }

  const expectedGeneratedParentPartId =
    expectedParentGroupId === undefined
      ? input.request.payload.destination.parentPartId
      : input.groupScaffolds.find(
          (candidate) => candidate.sourceGroupRef.sourceGroupId === expectedParentGroupId
        )?.generatedPartId;
  if (expectedGeneratedParentPartId !== undefined && group.generatedParentPartId !== expectedGeneratedParentPartId) {
    addGroupDiagnostic(groupDiagnostics, groupKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralParentageMismatch",
      checkId: "groupGeneratedParentageMismatch",
      message: `Generated parent part ${group.generatedParentPartId} does not match structural source parent mapping ${expectedGeneratedParentPartId}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    }));
  }
};

const addLeafDiagnostics = (input: {
  readonly session: AuthoringSession;
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly sourceAsset: SourceAsset | undefined;
  readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly materializationByLayerId: ReadonlyMap<string, MaterializationEvidence>;
  readonly leafDiagnostics: Map<string, DiagnosticDto[]>;
}): void => {
  const sourceLayersById = new Map((input.sourceAsset?.layers ?? []).map((layer) => [layer.sourceLayerId, layer]));
  const profileLayersById = new Map(
    (input.sourceAsset?.psdProfile?.sourceLayers ?? []).map((layer) => [layer.sourceLayerId, layer])
  );
  const approvedGeneratedGroupPartIds = new Set(input.groupScaffolds.map((group) => group.generatedPartId));
  const firstBySourceLayerId = new Map<string, PsdStructuralScaffoldLeafDrawableDto>();
  const firstByGeneratedId = new Map<string, PsdStructuralScaffoldLeafDrawableDto>();
  const firstByDrawableName = new Map<string, PsdStructuralScaffoldLeafDrawableDto>();
  const existingDrawableNames = new Set(
    input.session.graph.drawables.map((drawable) => normalizeDisplayName(drawable.displayName))
  );

  for (const leaf of input.leafScaffolds) {
    const leafKey = leaf.sourceLayerRef.sourceLayerId;

    const firstLeafForSourceRef = firstBySourceLayerId.get(leafKey);
    if (firstLeafForSourceRef !== undefined) {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "collision",
        checkId: "duplicateApprovedSourceLayer",
        message: `Approved structural source layer ${leafKey} is included more than once.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      }));
    } else {
      firstBySourceLayerId.set(leafKey, leaf);
    }

    if (leaf.status !== "approved") {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralPlanStale",
        checkId: "leafApprovalStatusMismatch",
        message: `Approved structural leaf ${leafKey} has status ${leaf.status}; execution requires approved.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      }));
    }

    if (leaf.sourceLayerRef.sourceAssetId !== input.request.payload.sourceAssetId) {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceIdentityMismatch",
        checkId: "leafSourceAssetMismatch",
        message: `Structural leaf ${leafKey} source asset does not match payload source asset ${input.request.payload.sourceAssetId}.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      }));
    }

    if (!hasPositiveBounds(leaf.bounds)) {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "emptyCandidate",
        checkId: "nonPositiveLeafBounds",
        message: `Structural leaf ${leafKey} requires positive bounds before mesh scaffold creation.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds/bounds"
      }));
    }

    const leafLocalVisible = leaf.localVisibleInSource ?? leaf.visibleInSource;
    if (leaf.initialRuntimeVisibility !== leafLocalVisible) {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "initialRuntimeVisibilityMismatch",
        checkId: "initialRuntimeVisibilityMismatch",
        message: `Structural leaf ${leafKey} initial runtime visibility must match source local visibility.`,
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      }));
    }

    const sourceLayer = sourceLayersById.get(leaf.sourceLayerRef.sourceLayerId);
    const profileLayer = profileLayersById.get(leaf.sourceLayerRef.sourceLayerId);
    if (sourceLayer === undefined) {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "sourceLayerMappingMissing",
        checkId: "sourceLayerMappingMissing",
        message: `PSD source layer does not exist: ${leaf.sourceLayerRef.sourceLayerId}.`,
        path: "/assets/sourceManifest/sourceAssets/layers"
      }));
    } else {
      addSourceLayerMismatchDiagnostics(input, leaf, sourceLayer, profileLayer, input.leafDiagnostics);
    }

    const materialization = input.materializationByLayerId.get(leaf.sourceLayerRef.sourceLayerId);
    addMaterializationDiagnostics(input, leaf, materialization, input.leafDiagnostics);

    for (const [kind, id, exists] of [
      ["drawable", leaf.generatedDrawableId, getDrawableById(input.session.graph, leaf.generatedDrawableId) !== undefined],
      ["mesh", leaf.generatedMeshId, getMeshById(input.session.graph, leaf.generatedMeshId) !== undefined],
      [
        "texture",
        leaf.generatedTextureId,
        getTextureAtlasEntryById(input.session.graph, leaf.generatedTextureId) !== undefined
      ]
    ] as const) {
      const key = `${kind}:${id}`;
      const first = firstByGeneratedId.get(key);
      if (first !== undefined) {
        addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
          operationId: input.operationId,
          issueKind: "structuralGeneratedRefCollision",
          checkId: "duplicateGeneratedLeafId",
          message: `Generated ${kind} id ${id} collides with source layer ${first.sourceLayerRef.sourceLayerId}.`,
          target: { kind, id },
          path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
        }));
      } else {
        firstByGeneratedId.set(key, leaf);
      }

      if (exists) {
        addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
          operationId: input.operationId,
          issueKind: "structuralGeneratedRefCollision",
          checkId: "generatedLeafIdAlreadyExists",
          message: `Generated ${kind} id already exists: ${id}.`,
          target: { kind, id }
        }));
      }
    }

    if (
      getPartById(input.session.graph, leaf.generatedParentPartId) === undefined &&
      !approvedGeneratedGroupPartIds.has(leaf.generatedParentPartId)
    ) {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "destinationParent",
        checkId: "missingGeneratedLeafParentPart",
        message: `Generated leaf parent part does not exist or is not approved for creation: ${leaf.generatedParentPartId}.`,
        target: createPartTarget(leaf.generatedParentPartId),
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      }));
    }

    const drawableName = normalizeDisplayName(leaf.generatedDrawableDisplayName);
    const firstNameLeaf = firstByDrawableName.get(drawableName);
    if (firstNameLeaf !== undefined) {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralGeneratedRefCollision",
        checkId: "generatedDrawableNameCollision",
        message: `Generated drawable display name ${leaf.generatedDrawableDisplayName} collides with source layer ${firstNameLeaf.sourceLayerRef.sourceLayerId}.`,
        target: createDrawableTarget(leaf.generatedDrawableId),
        path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
      }));
    } else {
      firstByDrawableName.set(drawableName, leaf);
    }

    if (existingDrawableNames.has(drawableName)) {
      addLeafDiagnostic(input.leafDiagnostics, leafKey, createStructuralDiagnostic({
        operationId: input.operationId,
        issueKind: "structuralGeneratedRefCollision",
        checkId: "generatedDrawableNameCollision",
        message: `Generated drawable display name already exists: ${leaf.generatedDrawableDisplayName}.`,
        target: createDrawableTarget(leaf.generatedDrawableId)
      }));
    }
  }
};

const addSourceLayerMismatchDiagnostics = (
  input: {
    readonly request: ImportPsdStructuralScaffoldRequest;
    readonly operationId: OperationId;
    readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  },
  leaf: PsdStructuralScaffoldLeafDrawableDto,
  sourceLayer: SourceAsset["layers"][number],
  profileLayer: NonNullable<SourceAsset["psdProfile"]>["sourceLayers"][number] | undefined,
  leafDiagnostics: Map<string, DiagnosticDto[]>
): void => {
  const leafKey = leaf.sourceLayerRef.sourceLayerId;

  if (!sourceDisplayNameMatches(leaf.sourceLayerName, sourceLayer.originalName, sourceLayer.normalizedName)) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafNameMismatch",
      message: `Structural leaf name ${leaf.sourceLayerName ?? "<missing>"} does not match current source layer name ${sourceLayer.originalName}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }

  if (
    !sourceDisplayNameMatches(
      leaf.sourceLayerRef.sourceLayerName,
      sourceLayer.originalName,
      sourceLayer.normalizedName
    )
  ) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafRefNameMismatch",
      message: `Structural leaf ref name ${leaf.sourceLayerRef.sourceLayerName ?? "<missing>"} does not match current source layer name ${sourceLayer.originalName}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds/sourceLayerRef"
    }));
  }

  if (sourceLayer.visibleInSource !== leaf.visibleInSource) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafVisibilityMismatch",
      message: `Structural leaf visibility ${leaf.visibleInSource} does not match current source layer visibility ${sourceLayer.visibleInSource}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }

  const sourceLayerLocalVisible = sourceLayer.localVisibleInSource ?? sourceLayer.visibleInSource;
  const leafLocalVisible = leaf.localVisibleInSource ?? leaf.visibleInSource;
  if (sourceLayerLocalVisible !== leafLocalVisible) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafLocalVisibilityMismatch",
      message: `Structural leaf local visibility ${leafLocalVisible} does not match current source layer local visibility ${sourceLayerLocalVisible}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }

  const sourceLayerEffectiveVisible =
    sourceLayer.effectiveVisibleInSource ?? sourceLayer.visibleInSource;
  const leafEffectiveVisible = leaf.effectiveVisibleInSource ?? leaf.visibleInSource;
  if (sourceLayerEffectiveVisible !== leafEffectiveVisible) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafEffectiveVisibilityMismatch",
      message: `Structural leaf effective visibility ${leafEffectiveVisible} does not match current source layer effective visibility ${sourceLayerEffectiveVisible}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }

  if (sourceLayer.opacityInSource !== leaf.opacityInSource) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafOpacityMismatch",
      message: `Structural leaf opacity ${leaf.opacityInSource} does not match current source layer opacity ${sourceLayer.opacityInSource}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }

  if (!sameRect(sourceLayer.bounds, leaf.bounds)) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafBoundsMismatch",
      message: `Structural leaf bounds do not match current source layer bounds for ${leafKey}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds/bounds"
    }));
  }

  if (!sameStringArray(sourceLayer.groupPath, leaf.sourceLayerPath.slice(0, -1))) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafPathMismatch",
      message: `Structural leaf path ${leaf.sourceLayerPath.join("/")} does not match current source layer group path ${sourceLayer.groupPath.join("/")}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }

  if (
    leaf.sourceLayerRef.sourceLayerPath !== undefined &&
    !sameStringArray([...sourceLayer.groupPath, sourceLayer.originalName], leaf.sourceLayerRef.sourceLayerPath)
  ) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafRefPathMismatch",
      message: `Structural leaf ref path ${leaf.sourceLayerRef.sourceLayerPath.join("/")} does not match current source layer path ${[...sourceLayer.groupPath, sourceLayer.originalName].join("/")}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds/sourceLayerRef"
    }));
  }

  if (
    profileLayer !== undefined &&
    !sourceDisplayNameMatches(leaf.sourceLayerName, profileLayer.originalName, profileLayer.normalizedName)
  ) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafProfileNameMismatch",
      message: `Structural leaf name ${leaf.sourceLayerName ?? "<missing>"} does not match current source profile layer name ${profileLayer.originalName}.`,
      path: "/assets/sourceManifest/sourceAssets/psdProfile/sourceLayers"
    }));
  }

  if (profileLayer !== undefined && profileLayer.opacityInSource !== leaf.opacityInSource) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafProfileOpacityMismatch",
      message: `Structural leaf opacity ${leaf.opacityInSource} does not match current source profile layer opacity ${profileLayer.opacityInSource}.`,
      path: "/assets/sourceManifest/sourceAssets/psdProfile/sourceLayers"
    }));
  }

  if (profileLayer !== undefined && !sameRect(profileLayer.bounds, leaf.bounds)) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "leafProfileBoundsMismatch",
      message: `Structural leaf bounds do not match current source profile layer bounds for ${leafKey}.`,
      path: "/assets/sourceManifest/sourceAssets/psdProfile/sourceLayers"
    }));
  }

  if (profileLayer !== undefined && profileLayer.sourceOrder !== leaf.sourceOrder) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralSourceOrderMismatch",
      checkId: "leafSourceOrderMismatch",
      message: `Structural leaf sourceOrder ${leaf.sourceOrder} does not match current source layer order ${profileLayer.sourceOrder}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }

  const expectedParentGroupId = leaf.sourceParentGroupRef?.sourceGroupId;
  if (profileLayer !== undefined && profileLayer.parentGroupId !== expectedParentGroupId) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralParentageMismatch",
      checkId: "leafSourceParentageMismatch",
      message: `Structural leaf parent ${expectedParentGroupId ?? "<root>"} does not match current source parent ${profileLayer.parentGroupId ?? "<root>"}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }

  const expectedGeneratedParentPartId =
    expectedParentGroupId === undefined
      ? input.request.payload.destination.parentPartId
      : input.groupScaffolds.find(
          (candidate) => candidate.sourceGroupRef.sourceGroupId === expectedParentGroupId
        )?.generatedPartId;
  if (expectedGeneratedParentPartId !== undefined && leaf.generatedParentPartId !== expectedGeneratedParentPartId) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralParentageMismatch",
      checkId: "leafGeneratedParentageMismatch",
      message: `Generated parent part ${leaf.generatedParentPartId} does not match structural source parent mapping ${expectedGeneratedParentPartId}.`,
      path: "/payload/structuralScaffoldBridge/approval/approvedLeafScaffolds"
    }));
  }
};

const addMaterializationDiagnostics = (
  input: {
    readonly request: ImportPsdStructuralScaffoldRequest;
    readonly operationId: OperationId;
  },
  leaf: PsdStructuralScaffoldLeafDrawableDto,
  materialization: MaterializationEvidence | undefined,
  leafDiagnostics: Map<string, DiagnosticDto[]>
): void => {
  const leafKey = leaf.sourceLayerRef.sourceLayerId;
  if (materialization === undefined) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralByteUnavailable",
      checkId: "missingMaterializationEvidence",
      message: `Materialization evidence is missing for PSD source layer ${leafKey}.`,
      path: "/assets/sourceManifest/sourceAssets/psdProfile/materializationEvidence"
    }));
    return;
  }

  if (materialization.sourceLayerRef.sourceAssetId !== input.request.payload.sourceAssetId) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "materializationSourceAssetMismatch",
      message: `Materialization source asset ${materialization.sourceLayerRef.sourceAssetId} does not match structural source asset ${input.request.payload.sourceAssetId}.`,
      path: "/assets/sourceManifest/sourceAssets/psdProfile/materializationEvidence"
    }));
  }

  const approvedSource = input.request.payload.structuralScaffoldBridge.approval.sourcePsd;
  if (
    materialization.provenance.sourceDigest === undefined ||
    !sameDigest(materialization.provenance.sourceDigest, approvedSource.digest) ||
    materialization.provenance.sourceByteLength === undefined ||
    materialization.provenance.sourceByteLength !== approvedSource.byteLength
  ) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "sourceIdentityMismatch",
      checkId: "materializationSourceIdentityMismatch",
      message: `Materialized PSD source identity for ${leafKey} does not match the approved structural scaffold source PSD identity.`,
      path: "/assets/sourceManifest/sourceAssets/psdProfile/materializationEvidence"
    }));
  }

  if (materialization.binaryAssetRef === undefined) {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralByteUnavailable",
      checkId: "missingMaterializedBinaryAssetRef",
      message: `Materialized selected-layer bytes require a package-local binary asset reference for ${leafKey}.`,
      path: "/assets/sourceManifest/sourceAssets/psdProfile/materializationEvidence/binaryAssetRef"
    }));
    return;
  }

  if (materialization.binaryAssetRef.storageStatus !== "stored-package-local-v1") {
    addLeafDiagnostic(leafDiagnostics, leafKey, createStructuralDiagnostic({
      operationId: input.operationId,
      issueKind: "structuralByteUnavailable",
      checkId: "materializedBytesUnavailable",
      message: `Materialized selected-layer bytes for ${leafKey} are ${materialization.binaryAssetRef.storageStatus}.`,
      target: createTextureTarget(materialization.binaryAssetRef.binaryAssetId),
      path: "/assets/sourceManifest/sourceAssets/psdProfile/materializationEvidence/binaryAssetRef"
    }));
  }
};

const createGroupPartRequest = (
  request: ImportPsdStructuralScaffoldRequest,
  operationId: OperationId,
  group: PsdStructuralScaffoldGroupPartDto
): CreatePartRequest => {
  const parsed = OperationRequestSchema.parse({
    schemaVersion: request.schemaVersion,
    operationId: createGroupOperationId(operationId, group),
    actor: request.actor,
    surface: request.surface,
    dryRun: false,
    basePackageRevision: request.basePackageRevision,
    ...(request.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: `${request.idempotencyKey}:group:${group.sourceGroupRef.sourceGroupId}` }),
    trace: request.trace,
    operationType: "createPart",
    payload: {
      partId: group.generatedPartId,
      displayName: group.generatedPartDisplayName,
      parentPartId: group.generatedParentPartId,
      lockedTargetIds: request.payload.lockedTargetIds
    }
  });

  if (parsed.operationType !== "createPart") {
    throw new Error("Expected createPart child request.");
  }

  return parsed;
};

const createLeafMaterializationRequest = (
  request: ImportPsdStructuralScaffoldRequest,
  operationId: OperationId,
  leaf: PsdStructuralScaffoldLeafDrawableDto,
  materialization: MaterializationEvidence
): ImportPsdLayerMaterializationRequest => {
  const parsed = OperationRequestSchema.parse({
    schemaVersion: request.schemaVersion,
    operationId: createLeafOperationId(operationId, leaf),
    actor: request.actor,
    surface: request.surface,
    dryRun: false,
    basePackageRevision: request.basePackageRevision,
    ...(request.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: `${request.idempotencyKey}:leaf:${leaf.sourceLayerRef.sourceLayerId}` }),
    trace: request.trace,
    operationType: "importPsdLayerMaterialization",
    payload: {
      sourceAssetId: request.payload.sourceAssetId,
      materialization,
      textureId: leaf.generatedTextureId,
      drawableId: leaf.generatedDrawableId,
      meshId: leaf.generatedMeshId,
      drawableDisplayName: leaf.generatedDrawableDisplayName,
      destinationPart: {
        destinationKind: "existingPart",
        partId: leaf.generatedParentPartId
      },
      initialBounds: leaf.bounds,
      lockedTargetIds: request.payload.lockedTargetIds
    }
  });

  if (parsed.operationType !== "importPsdLayerMaterialization") {
    throw new Error("Expected importPsdLayerMaterialization child request.");
  }

  return parsed;
};

const createHiddenLeafVisibilityRequest = (
  request: ImportPsdStructuralScaffoldRequest,
  operationId: OperationId,
  leaf: PsdStructuralScaffoldLeafDrawableDto
): SetRuntimeVisibilityRequest => {
  const parsed = OperationRequestSchema.parse({
    schemaVersion: request.schemaVersion,
    operationId: createVisibilityOperationId(operationId, leaf),
    actor: request.actor,
    surface: request.surface,
    dryRun: false,
    basePackageRevision: request.basePackageRevision,
    ...(request.idempotencyKey === undefined
      ? {}
      : { idempotencyKey: `${request.idempotencyKey}:visibility:${leaf.sourceLayerRef.sourceLayerId}` }),
    trace: request.trace,
    operationType: "setRuntimeVisibility",
    payload: {
      target: {
        kind: "drawable",
        id: leaf.generatedDrawableId
      },
      runtimeVisibility: false
    }
  });

  if (parsed.operationType !== "setRuntimeVisibility") {
    throw new Error("Expected setRuntimeVisibility child request.");
  }

  return parsed;
};

const createCommittedStructuralResult = (input: {
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly checkedTargetRefs: readonly TargetRefDto[];
  readonly baseRevision: number;
  readonly finalRevision: number;
  readonly childOutcomes: readonly OperationApplyOutcome[];
  readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly sourceOrderChanges: ModelDiffDto["changed"];
}): OperationResultDto => {
  const structuralEvidence = createStructuralOperationEvidence({
    request: input.request,
    operationId: input.operationId,
    aggregateStatus: "success",
    groupScaffolds: input.groupScaffolds.map(resolveGroupScaffold),
    leafScaffolds: input.leafScaffolds.map(resolveLeafScaffold),
    issues: []
  });

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], input.checkedTargetRefs),
    modelDiff: combineModelDiffs({
      operationId: input.operationId,
      baseRevision: input.baseRevision,
      finalRevision: input.finalRevision,
      childOutcomes: input.childOutcomes,
      extraChanged: input.sourceOrderChanges
    }),
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    psdLayerMaterializationEvidence: input.childOutcomes.flatMap(
      (outcome) => outcome.result.psdLayerMaterializationEvidence ?? []
    ),
    psdStructuralScaffoldEvidence: [structuralEvidence],
    reversible: true
  });
};

const createRejectedStructuralResult = (input: {
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly checkedTargetRefs: readonly TargetRefDto[];
  readonly diagnostics: IndexedDiagnostics;
}): OperationResultDto => {
  const diagnostics = flattenDiagnostics(input.diagnostics);
  const issues = createStructuralIssues({
    diagnostics,
    issueIdPrefix: input.request.payload.batchId
  });
  const structuralEvidence = createStructuralOperationEvidence({
    request: input.request,
    operationId: input.operationId,
    aggregateStatus: "preflightBlocked",
    groupScaffolds: input.request.payload.structuralScaffoldBridge.approval.approvedGroupPartScaffolds.map(
      (group) => markGroupBlocked(group)
    ),
    leafScaffolds: input.request.payload.structuralScaffoldBridge.approval.approvedLeafScaffolds.map(
      (leaf) => markLeafBlocked(leaf)
    ),
    issues
  });

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: "rejected",
    precondition: createPreconditionResult(diagnostics, input.checkedTargetRefs),
    diagnostics,
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    psdStructuralScaffoldEvidence: [structuralEvidence],
    reversible: false
  });
};

const createStructuralOperationEvidence = (input: {
  readonly request: ImportPsdStructuralScaffoldRequest;
  readonly operationId: OperationId;
  readonly aggregateStatus: "success" | "preflightBlocked" | "failure";
  readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly issues: readonly PsdStructuralScaffoldIssueDto[];
}): PsdStructuralScaffoldOperationEvidenceDto =>
  PsdStructuralScaffoldOperationEvidenceDtoSchema.parse({
    schemaVersion: "psd-structural-scaffold-operation-evidence-v1",
    operationType: "importPsdStructuralScaffold",
    evidenceId: createStructuralEvidenceId(input.request.payload.batchId),
    operationId: input.operationId,
    batchId: input.request.payload.batchId,
    sourceAssetId: input.request.payload.sourceAssetId,
    destination: input.request.payload.destination,
    structuralScaffoldBridge: input.request.payload.structuralScaffoldBridge,
    aggregateStatus: input.aggregateStatus,
    generatedGroupPartScaffolds: [...input.groupScaffolds],
    generatedLeafScaffolds: [...input.leafScaffolds],
    issues: [...input.issues],
    preflightPolicy: {
      approvedLeafLimit: PSD_STRUCTURAL_APPROVED_LEAF_LIMIT,
      approvedGroupLimit: PSD_STRUCTURAL_APPROVED_GROUP_LIMIT,
      generatedNodeLimit: PSD_STRUCTURAL_GENERATED_NODE_LIMIT,
      totalRawRgbaByteLimit: PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT,
      mutationPolicy: "preflightBlocksOnAnyFailure",
      silentPartialSuccess: "forbidden"
    },
    persistenceBoundary: {
      rawParserObjectPersistence: "notPersisted",
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
      materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
      photoshopCompositingClaim: "none",
      rendererPixelOracleClaim: "none",
      initialGridMeshGeneration: "notProvided",
      semanticRecognition: "notProvided",
      repoProposalGeneration: "notProvided"
    }
  });

const collectChildDiagnostics = (childOutcomes: readonly OperationApplyOutcome[]): IndexedDiagnostics => ({
  globalDiagnostics: childOutcomes.flatMap((outcome) =>
    outcome.result.status === "committed" ? [] : outcome.result.diagnostics
  ),
  groupDiagnostics: new Map(),
  leafDiagnostics: new Map()
});

const createStructuralIssues = (input: {
  readonly diagnostics: readonly DiagnosticDto[];
  readonly issueIdPrefix: string;
}): PsdStructuralScaffoldIssueDto[] =>
  input.diagnostics.map((diagnostic, diagnosticIndex) => {
    const issueKind = resolveStructuralIssueKind(diagnostic);

    return {
      issueId: createStructuralIssueId(`${input.issueIdPrefix}_${diagnosticIndex}_${issueKind}`),
      issueKind,
      checkId: diagnostic.checkId,
      message: diagnostic.message,
      ...(diagnostic.target.path === undefined ? {} : { targetPath: diagnostic.target.path })
    };
  });

const resolveStructuralIssueKind = (diagnostic: DiagnosticDto): PsdStructuralScaffoldIssueKindDto => {
  const explicitIssueKind = diagnostic.evidence
    .find((entry) => entry.startsWith("psdStructuralIssueKind:"))
    ?.slice("psdStructuralIssueKind:".length);
  if (isStructuralIssueKind(explicitIssueKind)) {
    return explicitIssueKind;
  }

  if (diagnostic.checkId.endsWith(".lockedTarget")) {
    return "structuralGeneratedRefCollision";
  }

  switch (diagnostic.checkId) {
    case "operation.importPsdStructuralScaffold.approvedGroupCountCapExceeded":
    case "operation.importPsdStructuralScaffold.approvedLeafCountCapExceeded":
    case "operation.importPsdStructuralScaffold.generatedNodeCountCapExceeded":
    case "operation.importPsdStructuralScaffold.capPolicyMismatch":
    case "operation.importPsdStructuralScaffold.executionCapPolicyMismatch":
      return "structuralExpansionCapExceeded";
    case "operation.importPsdStructuralScaffold.totalByteLengthCapExceeded":
      return "byteCapExceeded";
    case "operation.importPsdStructuralScaffold.missingSourceAsset":
    case "operation.importPsdStructuralScaffold.sourceLayerMappingMissing":
      return "currentSessionSourceMissing";
    case "operation.importPsdStructuralScaffold.sourceGroupMappingMissing":
      return "sourceGroupMappingMissing";
    case "operation.importPsdStructuralScaffold.missingMaterializationEvidence":
    case "operation.importPsdStructuralScaffold.missingMaterializedBinaryAssetRef":
    case "operation.importPsdStructuralScaffold.materializedBytesUnavailable":
      return "structuralByteUnavailable";
    case "operation.importPsdStructuralScaffold.missingDestinationParentPart":
    case "operation.importPsdStructuralScaffold.missingGeneratedGroupParentPart":
    case "operation.importPsdStructuralScaffold.missingGeneratedLeafParentPart":
      return "destinationParent";
    default:
      return "partialFailure";
  }
};

const STRUCTURAL_ISSUE_KINDS: ReadonlySet<string> = new Set([
  "stalePlan",
  "staleApproval",
  "missingCandidate",
  "blockedCandidate",
  "notApproved",
  "collision",
  "destinationParent",
  "sourceIdentityMismatch",
  "byteUnavailable",
  "byteCapExceeded",
  "partialFailure",
  "unsupportedCandidate",
  "hiddenCandidate",
  "emptyCandidate",
  "currentSessionSourceMissing",
  "privateLocalProvenanceFailure",
  "initialRuntimeVisibilityMismatch",
  "structuralExpansionCapExceeded",
  "sourceGroupMappingMissing",
  "sourceLayerMappingMissing",
  "structuralParentageMismatch",
  "structuralSourceOrderMismatch",
  "structuralGeneratedRefCollision",
  "structuralPlanStale",
  "structuralByteUnavailable"
]);

const isStructuralIssueKind = (
  value: string | undefined
): value is PsdStructuralScaffoldIssueKindDto =>
  value !== undefined && STRUCTURAL_ISSUE_KINDS.has(value);

const combineModelDiffs = (input: {
  readonly operationId: OperationId;
  readonly baseRevision: number;
  readonly finalRevision: number;
  readonly childOutcomes: readonly OperationApplyOutcome[];
  readonly extraChanged?: ModelDiffDto["changed"];
}): ModelDiffDto => {
  const childDiffs = input.childOutcomes.flatMap((outcome) =>
    outcome.result.modelDiff === undefined ? [] : [outcome.result.modelDiff]
  );

  return {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.finalRevision,
    added: [...uniqueTargetRefs(childDiffs.flatMap((diff) => diff.added))],
    removed: [...uniqueTargetRefs(childDiffs.flatMap((diff) => diff.removed))],
    changed: [...childDiffs.flatMap((diff) => diff.changed), ...(input.extraChanged ?? [])],
    operationIds: [input.operationId, ...input.childOutcomes.map((outcome) => outcome.result.operationId)]
  };
};

const createStructuralCheckedTargetRefs = (
  request: ImportPsdStructuralScaffoldRequest,
  groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[],
  leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[]
): readonly TargetRefDto[] =>
  uniqueTargetRefs([
    createSourceTarget(request.payload.sourceAssetId),
    createPartTarget(request.payload.destination.parentPartId),
    ...groupScaffolds.flatMap((group) => [
      createPartTarget(group.generatedParentPartId),
      createPartTarget(group.generatedPartId)
    ]),
    ...leafScaffolds.flatMap((leaf) => [
      createPartTarget(leaf.generatedParentPartId),
      createDrawableTarget(leaf.generatedDrawableId),
      createMeshTarget(leaf.generatedMeshId),
      createTextureTarget(leaf.generatedTextureId)
    ])
  ]);

const createStructuralTargetIds = (
  request: ImportPsdStructuralScaffoldRequest,
  operationId: OperationId,
  groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[],
  leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[]
): readonly string[] =>
  uniqueStrings([
    operationId,
    request.payload.batchId,
    request.payload.sourceAssetId,
    request.payload.destination.parentPartId,
    request.payload.structuralScaffoldBridge.structuralPlan.structuralPlanId,
    request.payload.structuralScaffoldBridge.structuralPlan.structuralPlanDigest.hex,
    request.payload.structuralScaffoldBridge.approval.approvalId,
    request.payload.structuralScaffoldBridge.approval.approvalSelectionDigest.hex,
    ...groupScaffolds.flatMap((group) => [
      group.sourceGroupRef.sourceGroupId,
      group.generatedParentPartId,
      group.generatedPartId
    ]),
    ...leafScaffolds.flatMap((leaf) => [
      leaf.sourceLayerRef.sourceLayerId,
      leaf.generatedParentPartId,
      leaf.generatedDrawableId,
      leaf.generatedMeshId,
      leaf.generatedTextureId
    ])
  ]);

const createMaterializationIndex = (
  sourceAsset: SourceAsset | undefined
): ReadonlyMap<string, MaterializationEvidence> => {
  const indexed = new Map<string, MaterializationEvidence>();
  for (const materialization of sourceAsset?.psdProfile?.materializationEvidence ?? []) {
    indexed.set(materialization.sourceLayerRef.sourceLayerId, materialization);
  }

  return indexed;
};

const sortGroupScaffolds = (
  groups: readonly PsdStructuralScaffoldGroupPartDto[]
): readonly PsdStructuralScaffoldGroupPartDto[] => {
  const bySourceGroupId = new Map(groups.map((group) => [group.sourceGroupRef.sourceGroupId, group]));
  const sorted = [...groups].sort(compareGroupSourceOrder);
  const result: PsdStructuralScaffoldGroupPartDto[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const emitted = new Set<PsdStructuralScaffoldGroupPartDto>();

  const visit = (group: PsdStructuralScaffoldGroupPartDto): void => {
    const groupId = group.sourceGroupRef.sourceGroupId;
    if (visited.has(groupId)) {
      if (!emitted.has(group)) {
        emitted.add(group);
        result.push(group);
      }
      return;
    }

    if (visiting.has(groupId)) {
      return;
    }

    visiting.add(groupId);
    const parentGroupId = group.sourceParentGroupRef?.sourceGroupId;
    const parentGroup = parentGroupId === undefined ? undefined : bySourceGroupId.get(parentGroupId);
    if (parentGroup !== undefined) {
      visit(parentGroup);
    }

    visiting.delete(groupId);
    visited.add(groupId);
    emitted.add(group);
    result.push(group);
  };

  for (const group of sorted) {
    visit(group);
  }

  return result;
};

const sortLeafScaffolds = (
  leaves: readonly PsdStructuralScaffoldLeafDrawableDto[]
): readonly PsdStructuralScaffoldLeafDrawableDto[] =>
  [...leaves].sort((left, right) => {
    const order = left.sourceOrder - right.sourceOrder;
    if (order !== 0) {
      return order;
    }

    return left.sourceLayerRef.sourceLayerId.localeCompare(right.sourceLayerRef.sourceLayerId);
  });

const compareGroupSourceOrder = (
  left: PsdStructuralScaffoldGroupPartDto,
  right: PsdStructuralScaffoldGroupPartDto
): number => {
  const order = left.sourceOrder - right.sourceOrder;
  if (order !== 0) {
    return order;
  }

  return left.sourceGroupRef.sourceGroupId.localeCompare(right.sourceGroupRef.sourceGroupId);
};

const createImportedSourceOrderEntries = (
  groups: readonly PsdStructuralScaffoldGroupPartDto[],
  leaves: readonly PsdStructuralScaffoldLeafDrawableDto[]
) => [
  ...groups.map((group) => ({
    parentPartId: group.generatedParentPartId,
    child: createPartChildEntry(group.generatedPartId),
    sourceOrder: group.sourceOrder,
    stableId: group.sourceGroupRef.sourceGroupId
  })),
  ...leaves.map((leaf) => ({
    parentPartId: leaf.generatedParentPartId,
    child: createDrawableChildEntry(leaf.generatedDrawableId),
    sourceOrder: leaf.sourceOrder,
    stableId: leaf.sourceLayerRef.sourceLayerId
  }))
];

type ImportedSourceOrderEntry = ReturnType<typeof createImportedSourceOrderEntries>[number];

interface StructuralSourceOrderState {
  readonly parents: ReadonlyMap<string, {
    readonly children: readonly unknown[];
    readonly childPartIds: readonly string[];
    readonly drawableIds: readonly string[];
  }>;
  readonly drawOrder: readonly unknown[];
}

const captureStructuralSourceOrderState = (
  session: AuthoringSession,
  entries: readonly ImportedSourceOrderEntry[]
): StructuralSourceOrderState => {
  const parentIds = [...new Set(entries.map((entry) => entry.parentPartId))];
  return {
    parents: new Map(
      parentIds.flatMap((parentPartId) => {
        const parent = getPartById(session.graph, parentPartId);
        if (parent === undefined) {
          return [];
        }

        return [
          [
            parentPartId,
            {
              children: structuredClone(parent.children ?? []),
              childPartIds: [...parent.childPartIds],
              drawableIds: [...parent.drawableIds]
            }
          ] as const
        ];
      })
    ),
    drawOrder: structuredClone(session.graph.drawOrder)
  };
};

const createStructuralSourceOrderChanges = (input: {
  readonly session: AuthoringSession;
  readonly before: StructuralSourceOrderState;
  readonly after: StructuralSourceOrderState;
}): ModelDiffDto["changed"] => {
  const parentChanges = [...input.after.parents.entries()].flatMap(([parentPartId, afterParent]) => {
    const beforeParent = input.before.parents.get(parentPartId);
    if (beforeParent === undefined) {
      return [];
    }

    const fields = [
      {
        path: `/model/graph/parts/${parentPartId}/children`,
        before: toModelDiffJsonValue(beforeParent.children),
        after: toModelDiffJsonValue(afterParent.children)
      },
      {
        path: `/model/graph/parts/${parentPartId}/childPartIds`,
        before: toModelDiffJsonValue(beforeParent.childPartIds),
        after: toModelDiffJsonValue(afterParent.childPartIds)
      },
      {
        path: `/model/graph/parts/${parentPartId}/drawableIds`,
        before: toModelDiffJsonValue(beforeParent.drawableIds),
        after: toModelDiffJsonValue(afterParent.drawableIds)
      }
    ].filter((field) => !jsonEqual(field.before, field.after));

    return fields.length === 0
      ? []
      : [
          {
            target: createPartTarget(parentPartId),
            fields
          }
        ];
  });
  const drawOrderChanged = !jsonEqual(input.before.drawOrder, input.after.drawOrder);

  return [
    ...parentChanges,
    ...(drawOrderChanged
      ? [
          {
            target: { kind: "package", id: input.session.packageIdentity.packageId } satisfies TargetRefDto,
            fields: [
              {
                path: "/model/drawOrder/entries",
                before: toModelDiffJsonValue(input.before.drawOrder),
                after: toModelDiffJsonValue(input.after.drawOrder)
              }
            ]
          }
        ]
      : [])
  ];
};

const parentPartExistsOrWillBeGenerated = (
  session: AuthoringSession,
  partId: PartId,
  generatedGroupPartIds: ReadonlyMap<string, PsdStructuralScaffoldGroupPartDto>
): boolean =>
  getPartById(session.graph, partId) !== undefined || generatedGroupPartIds.has(partId);

const existingSiblingPartNames = (
  session: AuthoringSession,
  parentPartId: PartId
): ReadonlySet<string> => {
  const parent = getPartById(session.graph, parentPartId);
  const childPartIds = new Set(parent?.childPartIds ?? []);

  return new Set(
    session.graph.parts
      .filter((part) => part.parentPartId === parentPartId || childPartIds.has(part.partId))
      .map((part) => normalizeDisplayName(part.displayName))
  );
};

const resolveGroupScaffold = (
  group: PsdStructuralScaffoldGroupPartDto
): PsdStructuralScaffoldGroupPartDto => ({
  ...group,
  status: "resolved",
  statusReasons: []
});

const resolveLeafScaffold = (
  leaf: PsdStructuralScaffoldLeafDrawableDto
): PsdStructuralScaffoldLeafDrawableDto => ({
  ...leaf,
  status: "resolved",
  statusReasons: []
});

const markGroupBlocked = (
  group: PsdStructuralScaffoldGroupPartDto
): PsdStructuralScaffoldGroupPartDto => ({
  ...group,
  status: "blocked",
  statusReasons: group.statusReasons.length > 0 ? [...group.statusReasons] : ["Structural scaffold preflight blocked."]
});

const markLeafBlocked = (
  leaf: PsdStructuralScaffoldLeafDrawableDto
): PsdStructuralScaffoldLeafDrawableDto => ({
  ...leaf,
  status: "blocked",
  statusReasons: leaf.statusReasons.length > 0 ? [...leaf.statusReasons] : ["Structural scaffold preflight blocked."]
});

const createGroupOperationId = (
  operationId: OperationId,
  group: PsdStructuralScaffoldGroupPartDto
): OperationId =>
  OperationIdSchema.parse(
    `op_${sanitizeIdToken(`${stripIdPrefix(operationId, "op_")}_group_${stripIdPrefix(group.generatedPartId, "part_")}`)}`
  );

const createLeafOperationId = (
  operationId: OperationId,
  leaf: PsdStructuralScaffoldLeafDrawableDto
): OperationId =>
  OperationIdSchema.parse(
    `op_${sanitizeIdToken(`${stripIdPrefix(operationId, "op_")}_leaf_${stripIdPrefix(leaf.generatedDrawableId, "draw_")}`)}`
  );

const createVisibilityOperationId = (
  operationId: OperationId,
  leaf: PsdStructuralScaffoldLeafDrawableDto
): OperationId =>
  OperationIdSchema.parse(
    `op_${sanitizeIdToken(`${stripIdPrefix(operationId, "op_")}_visibility_${stripIdPrefix(leaf.generatedDrawableId, "draw_")}`)}`
  );

const createStructuralEvidenceId = (batchId: string): string => `evidence_${batchId}`;
const createStructuralIssueId = (value: string): string => `issue_${sanitizeIdToken(value)}`;

const createStructuralDiagnostic = (input: {
  readonly operationId: OperationId;
  readonly issueKind: PsdStructuralScaffoldIssueKindDto;
  readonly checkId: string;
  readonly message: string;
  readonly target?: TargetRefDto;
  readonly path?: string;
  readonly evidence?: readonly string[];
}): DiagnosticDto =>
  createOperationDiagnostic({
    checkId: `operation.importPsdStructuralScaffold.${input.checkId}`,
    message: input.message,
    target: input.target ?? {
      kind: "operation",
      id: input.operationId,
      ...(input.path === undefined ? {} : { path: input.path })
    },
    evidence: [`psdStructuralIssueKind:${input.issueKind}`, ...(input.evidence ?? [])]
  });

const addGroupDiagnostic = (
  diagnostics: Map<string, DiagnosticDto[]>,
  sourceGroupId: string,
  diagnostic: DiagnosticDto
): void => {
  const current = diagnostics.get(sourceGroupId) ?? [];
  diagnostics.set(sourceGroupId, [...current, diagnostic]);
};

const addLeafDiagnostic = (
  diagnostics: Map<string, DiagnosticDto[]>,
  sourceLayerId: string,
  diagnostic: DiagnosticDto
): void => {
  const current = diagnostics.get(sourceLayerId) ?? [];
  diagnostics.set(sourceLayerId, [...current, diagnostic]);
};

const hasDiagnostics = (diagnostics: IndexedDiagnostics): boolean =>
  diagnostics.globalDiagnostics.length > 0 ||
  diagnostics.groupDiagnostics.size > 0 ||
  diagnostics.leafDiagnostics.size > 0;

const flattenDiagnostics = (diagnostics: IndexedDiagnostics): readonly DiagnosticDto[] => [
  ...diagnostics.globalDiagnostics,
  ...[...diagnostics.groupDiagnostics.values()].flat(),
  ...[...diagnostics.leafDiagnostics.values()].flat()
];

const usesDefaultExecutionCaps = (capPolicy: ImportPsdStructuralScaffoldRequest["payload"]["capPolicy"]): boolean =>
  capPolicy.approvedLeafLimit === PSD_STRUCTURAL_APPROVED_LEAF_LIMIT &&
  capPolicy.approvedGroupLimit === PSD_STRUCTURAL_APPROVED_GROUP_LIMIT &&
  capPolicy.generatedNodeLimit === PSD_STRUCTURAL_GENERATED_NODE_LIMIT &&
  capPolicy.totalRawRgbaByteLimit === PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT;

const sameCapPolicy = (
  left: ImportPsdStructuralScaffoldRequest["payload"]["capPolicy"],
  right: ImportPsdStructuralScaffoldRequest["payload"]["capPolicy"]
): boolean =>
  left.structuralNodeLimit === right.structuralNodeLimit &&
  left.structuralDepthLimit === right.structuralDepthLimit &&
  left.approvedGroupLimit === right.approvedGroupLimit &&
  left.approvedLeafLimit === right.approvedLeafLimit &&
  left.generatedNodeLimit === right.generatedNodeLimit &&
  left.totalRawRgbaByteLimit === right.totalRawRgbaByteLimit;

const sameSourcePsdIdentity = (
  left: ImportPsdStructuralScaffoldRequest["payload"]["structuralScaffoldBridge"]["structuralPlan"]["sourcePsd"],
  right: ImportPsdStructuralScaffoldRequest["payload"]["structuralScaffoldBridge"]["approval"]["sourcePsd"]
): boolean =>
  left.sourceAssetId === right.sourceAssetId &&
  left.byteLength === right.byteLength &&
  sameDigest(left.digest, right.digest);

const sameDigest = (
  left: { readonly algorithm: "sha256"; readonly hex: string } | undefined,
  right: { readonly algorithm: "sha256"; readonly hex: string } | undefined
): boolean => left !== undefined && right !== undefined && left.algorithm === right.algorithm && left.hex === right.hex;

const sameParser = (
  left: NonNullable<NonNullable<SourceAsset["psdProfile"]>["adapter"]["parser"]>,
  right: NonNullable<ImportPsdStructuralScaffoldRequest["payload"]["structuralScaffoldBridge"]["structuralPlan"]["parser"]>
): boolean =>
  left.parserName === right.parserName &&
  left.parserVersion === right.parserVersion &&
  left.adapterName === right.adapterName &&
  left.adapterVersion === right.adapterVersion;

const sameSourceGroupRef = (
  left: PsdStructuralScaffoldGroupPartDto["sourceGroupRef"],
  right: PsdStructuralScaffoldGroupPartDto["sourceGroupRef"]
): boolean =>
  left.sourceAssetId === right.sourceAssetId &&
  left.sourceGroupId === right.sourceGroupId &&
  left.sourceGroupName === right.sourceGroupName &&
  sameOptionalStringArray(left.sourceGroupPath, right.sourceGroupPath);

const sameOptionalSourceGroupRef = (
  left: PsdStructuralScaffoldGroupPartDto["sourceParentGroupRef"],
  right: PsdStructuralScaffoldGroupPartDto["sourceParentGroupRef"]
): boolean => {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return sameSourceGroupRef(left, right);
};

const sameSourceLayerRef = (
  left: PsdStructuralScaffoldLeafDrawableDto["sourceLayerRef"],
  right: PsdStructuralScaffoldLeafDrawableDto["sourceLayerRef"]
): boolean =>
  left.sourceAssetId === right.sourceAssetId &&
  left.sourceLayerId === right.sourceLayerId &&
  left.sourceLayerName === right.sourceLayerName &&
  sameOptionalStringArray(left.sourceLayerPath, right.sourceLayerPath);

const sameStringArray = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const sameOptionalStringArray = (
  left: readonly string[] | undefined,
  right: readonly string[] | undefined
): boolean => {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return sameStringArray(left, right);
};

const sameRect = (
  left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
): boolean =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

const sameOptionalRect = (
  left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined,
  right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined
): boolean => {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return sameRect(left, right);
};

const hasPositiveBounds = (bounds: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}): boolean => bounds.width > 0 && bounds.height > 0;

const sourceDisplayNameMatches = (
  expectedName: string | undefined,
  currentOriginalName: string,
  currentNormalizedName: string
): boolean =>
  expectedName === undefined ||
  expectedName === currentOriginalName ||
  expectedName === currentNormalizedName;

const parseSourceAssetSha256ContentHash = (
  contentHash: string
): { readonly algorithm: "sha256"; readonly hex: string } | undefined => {
  const match = /^sha256:([a-f0-9]{64})$/.exec(contentHash);
  if (match?.[1] === undefined) {
    return undefined;
  }

  return { algorithm: "sha256", hex: match[1] };
};

const createSourceTarget = (sourceAssetId: SourceAssetId | string): TargetRefDto => ({
  kind: "sourceAsset",
  id: sourceAssetId
});

const createPartTarget = (partId: PartId | string): TargetRefDto => ({
  kind: "part",
  id: partId
});

const createDrawableTarget = (drawableId: string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

const createMeshTarget = (meshId: string): TargetRefDto => ({
  kind: "mesh",
  id: meshId
});

const createTextureTarget = (textureId: string): TargetRefDto => ({
  kind: "texture",
  id: textureId
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

const jsonEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const replaceAuthoringSession = (
  target: AuthoringSession,
  source: AuthoringSession
): void => {
  target.packageIdentity = source.packageIdentity;
  target.packageRevision = source.packageRevision;
  target.authoringRevision = source.authoringRevision;
  target.dirty = source.dirty;
  target.graph = source.graph;

  if (source.binaryAssets === undefined) {
    delete target.binaryAssets;
  } else {
    target.binaryAssets = source.binaryAssets;
  }
};

const normalizeDisplayName = (value: string): string => value.trim().toLocaleLowerCase();

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : sanitizeIdToken(id);

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};
