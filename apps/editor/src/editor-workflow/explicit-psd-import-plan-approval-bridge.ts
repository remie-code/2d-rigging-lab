import {
  createDrawableIdFromDisplayName,
  createMeshIdFromDrawableId,
  createPartIdFromDisplayName,
  createTextureIdFromDrawableId,
  type PsdImportPlanApprovalBridgeEvidenceDto,
  type PsdImportPlanCandidateDto,
  type PsdImportPlanDigestDto,
  type PsdImportPlanGeneratedScaffoldDto,
  type PsdImportPlanSourcePsdIdentityDto
} from "@private-2d-rigging-lab/operation-core";
import {
  PartIdSchema,
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import { computePackageBinarySha256Digest } from "@private-2d-rigging-lab/package-format";

import type {
  BrowserPsdImportPlanCandidatePlan,
  BrowserPsdImportPlanCandidateStatus,
  BrowserPsdImportPlanLeafCandidate
} from "./browser-psd-import-plan-candidate-result.js";

type CanonicalJsonValue =
  | null
  | string
  | number
  | boolean
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

const blockingCandidateStatuses = new Set<BrowserPsdImportPlanCandidateStatus>([
  "hidden",
  "unsupported",
  "emptyZeroSize",
  "duplicateRef",
  "generatedIdCollision",
  "generatedNameCollision",
  "byteCapBlocked"
]);

export interface EditorPsdImportPlanApprovalBridgeInput {
  readonly plan: BrowserPsdImportPlanCandidatePlan;
  readonly sourceAssetId: string;
  readonly sourceFilePath: string;
  readonly destinationParentPartId: string;
}

export const collectApprovedPsdImportPlanLeafRefs = (
  plan: BrowserPsdImportPlanCandidatePlan
): readonly string[] =>
  collectApprovedCandidates(plan).map((candidate) => candidate.layerRef);

export const createEditorPsdImportPlanApprovalBridgeEvidence = async (
  input: EditorPsdImportPlanApprovalBridgeInput
): Promise<PsdImportPlanApprovalBridgeEvidenceDto> => {
  const approvedCandidates = collectApprovedCandidates(input.plan);
  if (approvedCandidates.length === 0) {
    throw new Error("Import-plan execution requires at least one explicitly approved leaf candidate.");
  }

  const sourcePsd = createSourcePsdIdentity(input);
  const candidatePlan = {
    schemaVersion: "psd-import-plan-candidate-evidence-v1" as const,
    evidenceKind: "psd-import-plan-candidate-evidence-v1" as const,
    planId: input.plan.planId,
    candidatePlanDigest: pickDigest(input.plan.candidatePlanDigest),
    sourcePsd,
    ...(input.plan.parser === undefined ? {} : { parser: input.plan.parser }),
    scope: {
      scopeRef: createScopeRef(input.plan),
      scopeDisplayPath: [...input.plan.scope.displayPath],
      discoveryMode: "recursiveLeafCandidatePreview" as const
    },
    candidates: input.plan.candidates.map((candidate, candidateIndex) =>
      createCandidateEvidence({
        candidate,
        candidateIndex,
        sourceAssetId: input.sourceAssetId,
        destinationParentPartId: input.destinationParentPartId
      })
    ),
    summary: {
      candidateCount: input.plan.summary.totalLeafCount,
      approvedCandidateCount: input.plan.summary.approvedCount,
      notApprovedCandidateCount: input.plan.summary.notApprovedCount,
      blockedCandidateCount: input.plan.candidates.filter(isBlockedCandidate).length,
      hiddenCandidateCount: input.plan.summary.hiddenCount,
      unsupportedCandidateCount: input.plan.summary.unsupportedCount,
      duplicateNameCount: input.plan.summary.duplicateNameCount,
      duplicateRefCount: input.plan.summary.duplicateRefCount,
      generatedIdCollisionCount: input.plan.summary.generatedIdCollisionCount,
      generatedNameCollisionCount: input.plan.summary.generatedNameCollisionCount,
      byteCapBlockedCount: input.plan.summary.byteCapBlockedCount,
      totalByteEstimate: input.plan.summary.totalRawRgbaByteEstimate,
      approvedByteEstimate: input.plan.summary.approvedRawRgbaByteEstimate
    },
    boundary: {
      rawParserObjectPersistence: "notPersisted" as const,
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes" as const,
      candidateDiscoveryBytePersistence: "metadataOnlyNoRawBytes" as const,
      publicDemoAsset: false as const,
      allLayerOneClickImport: "notProvided" as const,
      recursiveGroupAutoImport: "notProvided" as const
    }
  };
  const approvalSelectionDigest = await computeApprovalSelectionDigest({
    plan: input.plan,
    approvedCandidates,
    sourcePsd,
    destinationParentPartId: input.destinationParentPartId
  });
  const notApprovedCandidates = input.plan.candidates
    .filter((candidate) => !candidate.selection.approved && !isBlockedCandidate(candidate))
    .map((candidate, candidateIndex) =>
      createCandidateEvidence({
        candidate,
        candidateIndex,
        sourceAssetId: input.sourceAssetId,
        destinationParentPartId: input.destinationParentPartId
      })
    );
  const blockedCandidates = input.plan.candidates
    .filter(isBlockedCandidate)
    .map((candidate, candidateIndex) =>
      createCandidateEvidence({
        candidate,
        candidateIndex,
        sourceAssetId: input.sourceAssetId,
        destinationParentPartId: input.destinationParentPartId
      })
    );

  return {
    schemaVersion: "psd-import-plan-approval-bridge-evidence-v1",
    candidatePlan,
    approval: {
      schemaVersion: "psd-import-plan-approval-evidence-v1",
      evidenceKind: "psd-import-plan-approval-evidence-v1",
      approvalId: createApprovalId(input.plan.planId),
      candidatePlanDigest: pickDigest(input.plan.candidatePlanDigest),
      approvalSelectionDigest,
      sourcePsd,
      destination: {
        destinationKind: "generatedPartScaffold",
        parentPartId: PartIdSchema.parse(input.destinationParentPartId)
      },
      approvalStatus: input.plan.status === "ready" ? "approved" : "preflightBlocked",
      approvedLeafRefs: approvedCandidates.map((candidate, approvalOrder) => ({
        approvalOrder,
        sourceLayerRef: createSourceLayerRef(candidate, input.sourceAssetId),
        sourceLayerName: candidate.displayName,
        sourceLayerPath: [...candidate.fullPath],
        candidateStatuses: [...candidate.statuses],
        candidateStatusReasons: [...candidate.statusReasons],
        generatedScaffoldPreview: createGeneratedScaffold(
          candidate,
          input.destinationParentPartId,
          "previewReady"
        ),
        resolvedGeneratedIds: createGeneratedScaffold(
          candidate,
          input.destinationParentPartId,
          "resolved"
        )
      })),
      notApprovedCandidates,
      blockedCandidates,
      collisionPreflight: {
        duplicateRefCount: input.plan.summary.duplicateRefCount,
        duplicateNameCount: input.plan.summary.duplicateNameCount,
        generatedIdCollisionCount: input.plan.summary.generatedIdCollisionCount,
        generatedNameCollisionCount: input.plan.summary.generatedNameCollisionCount,
        byteCapBlockedCount: input.plan.summary.byteCapBlockedCount,
        blockedCandidateCount: blockedCandidates.length,
        notApprovedCandidateCount: input.plan.summary.notApprovedCount,
        preflightBlockedCount: blockedCandidates.length
      },
      boundary: {
        onlyApprovedLeafRefsPassedToBatch: true,
        rawParserObjectPersistence: "notPersisted",
        sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
        materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
        publicDemoAsset: false,
        allLayerOneClickImport: "notProvided",
        recursiveGroupAutoImport: "notProvided"
      }
    }
  };
};

const collectApprovedCandidates = (
  plan: BrowserPsdImportPlanCandidatePlan
): readonly BrowserPsdImportPlanLeafCandidate[] =>
  plan.candidates
    .filter((candidate) => candidate.selection.approved)
    .sort((left, right) =>
      (left.selection.approvedOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.selection.approvedOrder ?? Number.MAX_SAFE_INTEGER)
    );

const createSourcePsdIdentity = (
  input: EditorPsdImportPlanApprovalBridgeInput
): PsdImportPlanSourcePsdIdentityDto => {
  if (input.plan.sourceDigest === undefined) {
    throw new Error("Import-plan approval bridge requires source PSD digest evidence.");
  }

  return {
    sourceAssetId: SourceAssetIdSchema.parse(input.sourceAssetId),
    sourceFilePath: input.sourceFilePath,
    digest: pickDigest(input.plan.sourceDigest),
    byteLength: input.plan.source.byteLength,
    ...(input.plan.source.declaredMediaType === undefined
      ? {}
      : { mediaType: input.plan.source.declaredMediaType }),
    sourceBytePersistence: "metadataOnlyNoRawBytes",
    publicDemoAsset: false
  };
};

const createScopeRef = (plan: BrowserPsdImportPlanCandidatePlan) =>
  plan.scope.scopeKind === "root"
    ? {
        kind: "document" as const,
        id: plan.scope.scopeRef,
        path: plan.scope.scopeRef
      }
    : {
        kind: "group" as const,
        id: plan.scope.scopeRef,
        path: plan.scope.displayPath.join(" / ") || plan.scope.scopeRef
      };

const createCandidateEvidence = (input: {
  readonly candidate: BrowserPsdImportPlanLeafCandidate;
  readonly candidateIndex: number;
  readonly sourceAssetId: string;
  readonly destinationParentPartId: string;
}): PsdImportPlanCandidateDto => ({
  candidateIndex: input.candidateIndex,
  sourceLayerRef: createSourceLayerRef(input.candidate, input.sourceAssetId),
  sourceLayerName: input.candidate.displayName,
  sourceLayerPath: [...input.candidate.fullPath],
  sourceOrder: input.candidate.sourceOrder,
  bounds: input.candidate.bounds,
  visibleInSource: input.candidate.visibleInSource,
  opacityInSource: input.candidate.opacityInSource,
  byteEstimate: input.candidate.rawRgbaByteEstimate,
  statuses: [...input.candidate.statuses],
  statusReasons: [...input.candidate.statusReasons],
  approvalBlockedReasons: [...input.candidate.selection.approvalBlockedReasons],
  generatedScaffoldPreview: createGeneratedScaffold(
    input.candidate,
    input.destinationParentPartId,
    input.candidate.statuses.includes("generatedIdCollision")
      ? "generatedIdCollision"
      : input.candidate.statuses.includes("generatedNameCollision")
        ? "generatedNameCollision"
        : "previewReady"
  )
});

const createSourceLayerRef = (
  candidate: BrowserPsdImportPlanLeafCandidate,
  sourceAssetId: string
) => ({
  sourceAssetId: SourceAssetIdSchema.parse(sourceAssetId),
  sourceLayerId: candidate.layerRef,
  sourceLayerName: candidate.displayName,
  sourceLayerPath: [...candidate.fullPath]
});

const createGeneratedScaffold = (
  candidate: BrowserPsdImportPlanLeafCandidate,
  parentPartId: string,
  status: PsdImportPlanGeneratedScaffoldDto["status"]
): PsdImportPlanGeneratedScaffoldDto => {
  const displayName = createLayerPathDisplayName(candidate);
  const drawableId = createDrawableIdFromDisplayName(displayName);

  return {
    destinationKind: "generatedPartScaffold",
    parentPartId: PartIdSchema.parse(parentPartId),
    partId: createPartIdFromDisplayName(displayName),
    partDisplayName: displayName,
    drawableId,
    drawableDisplayName: displayName,
    textureId: createTextureIdFromDrawableId(drawableId),
    meshId: createMeshIdFromDrawableId(drawableId),
    status,
    statusReasons: status === "previewReady" || status === "resolved"
      ? []
      : [...candidate.statusReasons]
  };
};

const createLayerPathDisplayName = (
  candidate: BrowserPsdImportPlanLeafCandidate
): string => {
  const path = candidate.fullPath.filter((segment) => segment.trim().length > 0);
  return path.length === 0 ? candidate.displayName : path.join(" / ");
};

const isBlockedCandidate = (
  candidate: BrowserPsdImportPlanLeafCandidate
): boolean =>
  candidate.statuses.some((status) => blockingCandidateStatuses.has(status)) ||
  candidate.selection.approvalBlockedReasons.length > 0;

const computeApprovalSelectionDigest = async (input: {
  readonly plan: BrowserPsdImportPlanCandidatePlan;
  readonly approvedCandidates: readonly BrowserPsdImportPlanLeafCandidate[];
  readonly sourcePsd: PsdImportPlanSourcePsdIdentityDto;
  readonly destinationParentPartId: string;
}): Promise<PsdImportPlanDigestDto> => {
  const canonical = stringifyCanonicalJson({
    candidatePlanDigest: pickDigest(input.plan.candidatePlanDigest),
    sourcePsd: {
      sourceAssetId: input.sourcePsd.sourceAssetId,
      digest: input.sourcePsd.digest,
      byteLength: input.sourcePsd.byteLength
    },
    destinationParentPartId: input.destinationParentPartId,
    approvedLeafRefs: input.approvedCandidates.map((candidate, approvalOrder) => ({
      approvalOrder,
      layerRef: candidate.layerRef,
      sourceLayerPath: candidate.fullPath,
      candidateStatuses: candidate.statuses,
      generated: createGeneratedScaffold(candidate, input.destinationParentPartId, "resolved")
    }))
  });
  const bytes = new TextEncoder().encode(canonical);
  const digestResult = await computePackageBinarySha256Digest(bytes);
  if (digestResult.status === "unsupported") {
    throw new Error(`Unable to compute import-plan approval digest: ${digestResult.reason}`);
  }

  return digestResult.digest;
};

const pickDigest = (
  digest: { readonly algorithm: "sha256"; readonly hex: string }
): PsdImportPlanDigestDto => ({
  algorithm: "sha256",
  hex: digest.hex
});

const createApprovalId = (planId: string): string =>
  `approval_${sanitizeApprovalToken(planId.replace(/^plan_/, ""))}`;

const sanitizeApprovalToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "importPlan";

const stringifyCanonicalJson = (value: CanonicalJsonValue): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stringifyCanonicalJson).join(",")}]`;
  }

  const record = value as { readonly [key: string]: CanonicalJsonValue };
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stringifyCanonicalJson(record[key] ?? null)}`
  ).join(",")}}`;
};
