import {
  createDrawableIdFromDisplayName,
  createMeshIdFromDrawableId,
  createPartIdFromDisplayName,
  createTextureIdFromDrawableId,
  type PsdAdapterResultDto,
  type PsdAdapterSourceLayerDto
} from "@private-2d-rigging-lab/operation-core";
import {
  computePackageBinarySha256Digest,
  type BinaryAssetDigestDto
} from "@private-2d-rigging-lab/package-format";

import type { BrowserPsdParserBridgeParsedResult } from "./browser-psd-parser-bridge-result.js";
import {
  browserPsdImportPlanCandidateDefaultMaxApprovedLeaves,
  browserPsdImportPlanCandidateDefaultMaxApprovedRawRgbaBytes,
  browserPsdImportPlanCandidateDefaultMaxLeafCandidates,
  browserPsdImportPlanCandidateDefaultMaxLeafRawRgbaBytes,
  browserPsdImportPlanCandidateDefaultMaxSourceBytes,
  type BrowserPsdImportPlanCandidatePlan,
  type BrowserPsdImportPlanCandidateStatus,
  type BrowserPsdImportPlanCaps,
  type BrowserPsdImportPlanDiagnostic,
  type BrowserPsdImportPlanGeneratedScaffoldPreview,
  type BrowserPsdImportPlanLeafCandidate,
  type BrowserPsdImportPlanParentGroupContext,
  type BrowserPsdImportPlanScope,
  type BrowserPsdImportPlanSummary
} from "./browser-psd-import-plan-candidate-result.js";

export interface BrowserPsdImportPlanReservedGeneratedIds {
  readonly partIds?: readonly string[];
  readonly drawableIds?: readonly string[];
  readonly textureIds?: readonly string[];
  readonly meshIds?: readonly string[];
}

export interface BrowserPsdImportPlanCandidateGenerationInput {
  readonly parsedBridgeResult: BrowserPsdParserBridgeParsedResult;
  readonly scopeRef: string;
  readonly approvedLayerNodeRefs?: readonly string[];
  readonly sourceDigest?: BinaryAssetDigestDto;
  readonly caps?: Partial<BrowserPsdImportPlanCaps>;
  readonly reservedGeneratedIds?: BrowserPsdImportPlanReservedGeneratedIds;
  readonly reservedGeneratedNames?: readonly string[];
  readonly planId?: string;
}

interface DraftCandidate {
  readonly layer: PsdAdapterSourceLayerDto;
  readonly fullPath: readonly string[];
  readonly parentGroups: readonly BrowserPsdImportPlanParentGroupContext[];
  readonly rawRgbaByteEstimate: number;
  readonly generated: BrowserPsdImportPlanGeneratedScaffoldPreview;
  readonly statuses: Set<BrowserPsdImportPlanCandidateStatus>;
  readonly statusReasons: string[];
  readonly approvalBlockedReasons: string[];
}

interface ApprovalRequest {
  readonly ref: string;
  readonly requestIndex: number;
  readonly canonicalRequestIndex: number;
  readonly duplicate: boolean;
}

type CanonicalJsonValue =
  | null
  | string
  | number
  | boolean
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

const rootScopeRef = "psd:root";
const groupScopeSegmentPattern = /^group\[(?:0|[1-9]\d*)\]$/;
const groupScopeRefPattern = /^psd:root(?:\/group\[(?:0|[1-9]\d*)\])+$/;

export const createBrowserPsdImportPlanCandidatePlan = async (
  input: BrowserPsdImportPlanCandidateGenerationInput
): Promise<BrowserPsdImportPlanCandidatePlan> => {
  const scopeRef = normalizeScopeRef(input.scopeRef);
  const caps = normalizeCaps(input.caps);
  const adapterResult = input.parsedBridgeResult.adapterResult;
  const scope = resolveScope(adapterResult, scopeRef);
  const approvalRequests = normalizeApprovalRequests(input.approvedLayerNodeRefs ?? []);
  const approvedRequestByRef = new Map<string, ApprovalRequest>();
  for (const request of approvalRequests) {
    if (!request.duplicate) {
      approvedRequestByRef.set(request.ref, request);
    }
  }

  const drafts = adapterResult.sourceLayers
    .filter((layer) => layerIsInScope(layer, scope.scopeRef))
    .sort((left, right) => left.sourceOrder - right.sourceOrder)
    .map((layer) => createDraftCandidate(layer, scope.scopeRef));

  applyBaseStatuses(drafts, caps);
  applyDuplicateStatuses(drafts);
  applyGeneratedCollisionStatuses(drafts, input.reservedGeneratedIds, input.reservedGeneratedNames);
  const canonicalCandidates = drafts.map((draft) => finalizeCandidate(draft, new Map()));
  const canonicalPlan = createCanonicalCandidatePlan({
    parsedBridgeResult: input.parsedBridgeResult,
    sourceDigest: input.sourceDigest,
    scope,
    caps,
    candidates: canonicalCandidates
  });
  const canonicalJson = stringifyCanonicalJson(canonicalPlan);
  const candidatePlanDigest = await computeCandidatePlanDigest(canonicalJson);
  applyApprovalStatuses(drafts, approvalRequests, approvedRequestByRef, caps);

  const candidates = drafts.map((draft) => finalizeCandidate(draft, approvedRequestByRef));
  const summary = createSummary({
    candidates,
    sourceByteLength: input.parsedBridgeResult.source.byteLength,
    caps
  });
  const status = summary.candidateEnumerationCap.exceeded || summary.sourceParseCap.exceeded
    ? "blocked"
    : "ready";

  return {
    evidenceKind: "browser-psd-import-plan-candidate-plan-v1",
    planId: input.planId?.trim() || createPlanId(input.parsedBridgeResult.source.sourceAssetId, scope.scopeRef),
    status,
    source: input.parsedBridgeResult.source,
    ...(input.sourceDigest === undefined ? {} : { sourceDigest: input.sourceDigest }),
    ...(adapterResult.parser === undefined ? {} : { parser: adapterResult.parser }),
    scope,
    caps,
    candidatePlanDigest,
    candidates,
    summary,
    diagnostics: createDiagnostics(status, summary, approvalRequests, approvedRequestByRef, candidates),
    persistenceBoundary: {
      rawParserObjectPersistence: "notPersisted",
      sourcePsdBytePersistence: "sessionReadOnlyNoRawBytesPersistedByImportPlan",
      materializedLayerBytePersistence: "notMaterializedByImportPlan",
      approvalExecution: "explicitApprovedLeafRefsOnly",
      publicDemoAsset: false
    }
  };
};

const normalizeCaps = (caps: Partial<BrowserPsdImportPlanCaps> | undefined): BrowserPsdImportPlanCaps => ({
  maxSourceBytes: caps?.maxSourceBytes ?? browserPsdImportPlanCandidateDefaultMaxSourceBytes,
  maxLeafCandidates: caps?.maxLeafCandidates ?? browserPsdImportPlanCandidateDefaultMaxLeafCandidates,
  maxLeafRawRgbaBytes: caps?.maxLeafRawRgbaBytes ?? browserPsdImportPlanCandidateDefaultMaxLeafRawRgbaBytes,
  maxApprovedLeaves: caps?.maxApprovedLeaves ?? browserPsdImportPlanCandidateDefaultMaxApprovedLeaves,
  maxApprovedRawRgbaBytes:
    caps?.maxApprovedRawRgbaBytes ?? browserPsdImportPlanCandidateDefaultMaxApprovedRawRgbaBytes
});

const normalizeScopeRef = (scopeRef: string): string => {
  const normalized = scopeRef.trim();
  return normalized.length === 0 ? rootScopeRef : normalized;
};

const resolveScope = (
  adapterResult: PsdAdapterResultDto,
  scopeRef: string
): BrowserPsdImportPlanScope => {
  if (scopeRef === rootScopeRef) {
    return {
      scopeRef,
      scopeKind: "root",
      discoveryMode: "recursiveLeafCandidatePreview",
      displayPath: []
    };
  }

  if (!scopeRef.startsWith(`${rootScopeRef}/group[`)) {
    throw new Error(`Browser PSD import plan scope must be psd:root or a PSD group ref: ${scopeRef}`);
  }

  if (!groupScopeRefPattern.test(scopeRef)) {
    throw new Error(`Browser PSD import plan scope must be psd:root or a valid PSD group ref: ${scopeRef}`);
  }

  if (!createKnownGroupScopeRefs(adapterResult).has(scopeRef)) {
    throw new Error(`Browser PSD import plan group scope was not found in parser session evidence: ${scopeRef}`);
  }

  return {
    scopeRef,
    scopeKind: "group",
    discoveryMode: "recursiveLeafCandidatePreview",
    displayPath: inferScopeDisplayPath(adapterResult, scopeRef)
  };
};

const createKnownGroupScopeRefs = (
  adapterResult: PsdAdapterResultDto
): ReadonlySet<string> => {
  const groupRefs = new Set<string>();
  for (const layer of adapterResult.sourceLayers) {
    for (const groupRef of createAncestorGroupRefs(layer.sourceLayerId)) {
      groupRefs.add(groupRef);
    }
  }

  for (const group of adapterResult.sourceGroups) {
    const groupRef = inferGroupRefFromGroupPath(adapterResult, group.groupPath);
    if (groupRef !== undefined) {
      groupRefs.add(groupRef);
    }
  }

  return groupRefs;
};

const inferScopeDisplayPath = (
  adapterResult: PsdAdapterResultDto,
  scopeRef: string
): readonly string[] => {
  const descendantLayer = adapterResult.sourceLayers.find((layer) =>
    layer.sourceLayerId.startsWith(`${scopeRef}/`)
  );
  if (descendantLayer !== undefined) {
    const groupDepth = countGroupSegments(scopeRef);
    return descendantLayer.groupPath.slice(0, groupDepth);
  }

  const matchingGroup = adapterResult.sourceGroups.find((group) => {
    const groupRef = inferGroupRefFromGroupPath(adapterResult, group.groupPath);
    return groupRef === scopeRef;
  });

  return matchingGroup?.groupPath ?? [scopeRef];
};

const inferGroupRefFromGroupPath = (
  adapterResult: PsdAdapterResultDto,
  groupPath: readonly string[]
): string | undefined => {
  const descendantLayer = adapterResult.sourceLayers.find((layer) =>
    groupPath.every((segment, index) => layer.groupPath[index] === segment)
  );

  return descendantLayer === undefined
    ? undefined
    : createAncestorGroupRefs(descendantLayer.sourceLayerId)[groupPath.length - 1];
};

const layerIsInScope = (layer: PsdAdapterSourceLayerDto, scopeRef: string): boolean =>
  scopeRef === rootScopeRef
    ? layer.sourceLayerId.startsWith(`${rootScopeRef}/`)
    : layer.sourceLayerId.startsWith(`${scopeRef}/`);

const createDraftCandidate = (
  layer: PsdAdapterSourceLayerDto,
  scopeRef: string
): DraftCandidate => {
  const fullPath = [...layer.groupPath, layer.originalName];
  const displayName = fullPath.length > 0 ? fullPath.join(" / ") : layer.originalName;

  return {
    layer,
    fullPath,
    parentGroups: createParentGroupContexts(layer),
    rawRgbaByteEstimate: estimateRawRgbaBytes(layer.bounds.width, layer.bounds.height),
    generated: createGeneratedScaffoldPreview(displayName, layer.sourceLayerId),
    statuses: new Set<BrowserPsdImportPlanCandidateStatus>(),
    statusReasons: [],
    approvalBlockedReasons: []
  };
};

const createParentGroupContexts = (
  layer: PsdAdapterSourceLayerDto
): readonly BrowserPsdImportPlanParentGroupContext[] => {
  const groupRefs = createAncestorGroupRefs(layer.sourceLayerId);

  return layer.groupPath.map((displayName, index) => ({
    groupRef: groupRefs[index] ?? `${rootScopeRef}/group[unknown-${index}]`,
    displayName,
    fullPath: layer.groupPath.slice(0, index + 1),
    depth: index + 1
  }));
};

const createAncestorGroupRefs = (layerRef: string): readonly string[] => {
  const segments = layerRef.split("/");
  const refs: string[] = [];
  let current = segments[0] ?? rootScopeRef;

  for (const segment of segments.slice(1)) {
    if (!groupScopeSegmentPattern.test(segment)) {
      continue;
    }
    current = `${current}/${segment}`;
    refs.push(current);
  }

  return refs;
};

const createGeneratedScaffoldPreview = (
  displayName: string,
  layerRef: string
): BrowserPsdImportPlanGeneratedScaffoldPreview => {
  const generatedIdSeed = `${displayName} / ${layerRef}`;
  const drawableId = createDrawableIdFromDisplayName(generatedIdSeed);

  return {
    destinationKind: "generatedPartScaffold",
    displayName,
    partId: createPartIdFromDisplayName(generatedIdSeed),
    drawableId,
    textureId: createTextureIdFromDrawableId(drawableId),
    meshId: createMeshIdFromDrawableId(drawableId)
  };
};

const estimateRawRgbaBytes = (width: number, height: number): number => {
  const normalizedWidth = Math.max(0, Math.floor(width));
  const normalizedHeight = Math.max(0, Math.floor(height));
  return normalizedWidth * normalizedHeight * 4;
};

const applyBaseStatuses = (
  drafts: readonly DraftCandidate[],
  caps: BrowserPsdImportPlanCaps
): void => {
  for (const draft of drafts) {
    if (!draft.layer.visibleInSource) {
      addStatus(draft, "hidden", "Layer is hidden in the PSD source tree.");
      addStatus(draft, "unsupported", "Hidden layer approval is not supported by the v0 import plan.");
      draft.approvalBlockedReasons.push("hiddenLayerUnsupported");
    }

    if (draft.layer.bounds.width <= 0 || draft.layer.bounds.height <= 0) {
      addStatus(draft, "emptyZeroSize", "Layer bounds have zero width or height.");
      draft.approvalBlockedReasons.push("emptyZeroSize");
    }

    if (draft.layer.role === "unsupported") {
      addStatus(draft, "unsupported", "Layer role is unsupported for v0 import plan materialization.");
      draft.approvalBlockedReasons.push("unsupportedLayerRole");
    }

    const blockingUnsupportedFeatures = draft.layer.unsupportedFeatures.filter(
      (feature) => !feature.rasterizeCandidate
    );
    if (blockingUnsupportedFeatures.length > 0) {
      addStatus(
        draft,
        "unsupported",
        `Layer has unsupported features without rasterize-candidate evidence: ${blockingUnsupportedFeatures
          .map((feature) => feature.featureId)
          .join(", ")}.`
      );
      draft.approvalBlockedReasons.push("unsupportedLayerFeature");
    }

    if (draft.rawRgbaByteEstimate > caps.maxLeafRawRgbaBytes) {
      addStatus(
        draft,
        "byteCapBlocked",
        `Layer raw RGBA estimate ${draft.rawRgbaByteEstimate} exceeds per-leaf cap ${caps.maxLeafRawRgbaBytes}.`
      );
      draft.approvalBlockedReasons.push("leafRawRgbaByteCapExceeded");
    }

    if (draft.approvalBlockedReasons.length === 0) {
      addStatus(draft, "candidate", "Visible positive-size leaf is eligible for explicit approval.");
    }
  }
};

const applyDuplicateStatuses = (drafts: readonly DraftCandidate[]): void => {
  const byRef = groupDraftsBy(drafts, (draft) => draft.layer.sourceLayerId);
  const byDisplayName = groupDraftsBy(drafts, (draft) => draft.layer.originalName);

  for (const duplicateRefs of byRef.values()) {
    if (duplicateRefs.length <= 1) {
      continue;
    }
    for (const draft of duplicateRefs) {
      addStatus(draft, "duplicateRef", `Layer ref appears ${duplicateRefs.length} times in this plan.`);
      draft.approvalBlockedReasons.push("duplicateLayerRef");
    }
  }

  for (const duplicateNames of byDisplayName.values()) {
    if (duplicateNames.length <= 1) {
      continue;
    }
    for (const draft of duplicateNames) {
      addStatus(
        draft,
        "duplicateName",
        `Display name appears ${duplicateNames.length} times in this plan; path/ref-aware generated IDs are required.`
      );
    }
  }
};

const applyGeneratedCollisionStatuses = (
  drafts: readonly DraftCandidate[],
  reservedGeneratedIds: BrowserPsdImportPlanReservedGeneratedIds | undefined,
  reservedGeneratedNames: readonly string[] | undefined
): void => {
  const reservedIds = new Set([
    ...(reservedGeneratedIds?.partIds ?? []),
    ...(reservedGeneratedIds?.drawableIds ?? []),
    ...(reservedGeneratedIds?.textureIds ?? []),
    ...(reservedGeneratedIds?.meshIds ?? [])
  ]);
  const reservedNames = new Set((reservedGeneratedNames ?? []).map((name) => name.trim()).filter(Boolean));

  for (const draft of drafts) {
    for (const id of [
      draft.generated.partId,
      draft.generated.drawableId,
      draft.generated.textureId,
      draft.generated.meshId
    ]) {
      if (reservedIds.has(id)) {
        addStatus(draft, "generatedIdCollision", `Generated scaffold id collides with existing project id: ${id}.`);
        draft.approvalBlockedReasons.push("generatedIdCollision");
      }
    }

    if (reservedNames.has(draft.generated.displayName)) {
      addStatus(
        draft,
        "generatedNameCollision",
        `Generated scaffold display name collides with existing project name: ${draft.generated.displayName}.`
      );
      draft.approvalBlockedReasons.push("generatedNameCollision");
    }
  }
};

const applyApprovalStatuses = (
  drafts: readonly DraftCandidate[],
  approvalRequests: readonly ApprovalRequest[],
  approvedRequestByRef: ReadonlyMap<string, ApprovalRequest>,
  caps: BrowserPsdImportPlanCaps
): void => {
  for (const request of approvalRequests) {
    if (!request.duplicate) {
      continue;
    }
    const draft = drafts.find((candidate) => candidate.layer.sourceLayerId === request.ref);
    if (draft !== undefined) {
      addStatus(
        draft,
        "duplicateRef",
        `Approval list repeats this layer ref at request #${request.requestIndex}; canonical request is #${request.canonicalRequestIndex}.`
      );
      draft.approvalBlockedReasons.push("duplicateApprovalRef");
    }
  }

  const requestedDrafts = approvalRequests
    .filter((request) => !request.duplicate)
    .map((request) => drafts.find((draft) => draft.layer.sourceLayerId === request.ref))
    .filter((draft): draft is DraftCandidate => draft !== undefined);
  if (requestedDrafts.length > caps.maxApprovedLeaves) {
    for (const draft of requestedDrafts) {
      addStatus(
        draft,
        "byteCapBlocked",
        `Approved leaf count ${requestedDrafts.length} exceeds cap ${caps.maxApprovedLeaves}.`
      );
      draft.approvalBlockedReasons.push("approvedLeafCountCapExceeded");
    }
  }

  applyApprovedGeneratedCollisions(requestedDrafts);

  let approvedByteTotal = 0;
  for (const draft of requestedDrafts) {
    const request = approvedRequestByRef.get(draft.layer.sourceLayerId);
    if (request === undefined) {
      continue;
    }
    approvedByteTotal += draft.rawRgbaByteEstimate;
    if (approvedByteTotal > caps.maxApprovedRawRgbaBytes) {
      addStatus(
        draft,
        "byteCapBlocked",
        `Approved raw RGBA estimate ${approvedByteTotal} exceeds total cap ${caps.maxApprovedRawRgbaBytes}.`
      );
      draft.approvalBlockedReasons.push("approvedRawRgbaByteCapExceeded");
    }
  }

  for (const draft of drafts) {
    if (!isDraftApproved(draft, approvedRequestByRef)) {
      addStatus(draft, "notApproved", "Leaf is listed for preview only and is not approved for execution.");
    }
  }
};

const applyApprovedGeneratedCollisions = (
  requestedDrafts: readonly DraftCandidate[]
): void => {
  const byGeneratedName = groupDraftsBy(requestedDrafts, (draft) => draft.generated.displayName);
  const byGeneratedId = new Map<string, DraftCandidate[]>();

  for (const draft of requestedDrafts) {
    for (const id of [
      draft.generated.partId,
      draft.generated.drawableId,
      draft.generated.textureId,
      draft.generated.meshId
    ]) {
      const entries = byGeneratedId.get(id) ?? [];
      entries.push(draft);
      byGeneratedId.set(id, entries);
    }
  }

  for (const [id, collisionDrafts] of byGeneratedId.entries()) {
    if (collisionDrafts.length <= 1) {
      continue;
    }
    for (const draft of collisionDrafts) {
      addStatus(draft, "generatedIdCollision", `Generated scaffold id collides among approved entries: ${id}.`);
      draft.approvalBlockedReasons.push("generatedIdCollision");
    }
  }

  for (const collisionDrafts of byGeneratedName.values()) {
    if (collisionDrafts.length <= 1) {
      continue;
    }
    for (const draft of collisionDrafts) {
      addStatus(
        draft,
        "generatedNameCollision",
        `Generated scaffold display name appears ${collisionDrafts.length} times in approved entries.`
      );
      draft.approvalBlockedReasons.push("generatedNameCollision");
    }
  }
};

const normalizeApprovalRequests = (
  approvedLayerNodeRefs: readonly string[]
): readonly ApprovalRequest[] => {
  const canonicalIndexByRef = new Map<string, number>();

  return approvedLayerNodeRefs
    .map((ref, requestIndex) => ({
      ref: ref.trim(),
      requestIndex
    }))
    .filter((request) => request.ref.length > 0)
    .map((request) => {
      const canonicalRequestIndex = canonicalIndexByRef.get(request.ref);
      if (canonicalRequestIndex !== undefined) {
        return {
          ...request,
          canonicalRequestIndex,
          duplicate: true
        };
      }

      canonicalIndexByRef.set(request.ref, request.requestIndex);
      return {
        ...request,
        canonicalRequestIndex: request.requestIndex,
        duplicate: false
      };
    });
};

const isDraftApproved = (
  draft: DraftCandidate,
  approvedRequestByRef: ReadonlyMap<string, ApprovalRequest>
): boolean =>
  approvedRequestByRef.has(draft.layer.sourceLayerId) && draft.approvalBlockedReasons.length === 0;

const finalizeCandidate = (
  draft: DraftCandidate,
  approvedRequestByRef: ReadonlyMap<string, ApprovalRequest>
): BrowserPsdImportPlanLeafCandidate => {
  const approvalRequest = approvedRequestByRef.get(draft.layer.sourceLayerId);
  const approved = isDraftApproved(draft, approvedRequestByRef);
  const statuses = new Set(draft.statuses);
  if (draft.approvalBlockedReasons.length > 0) {
    statuses.delete("candidate");
  }

  return {
    candidateId: `candidate_${sanitizeIdToken(draft.layer.sourceLayerId)}`,
    layerRef: draft.layer.sourceLayerId,
    displayName: draft.layer.originalName,
    normalizedName: draft.layer.normalizedName,
    fullPath: draft.fullPath,
    parentGroups: draft.parentGroups,
    bounds: draft.layer.bounds,
    visibleInSource: draft.layer.visibleInSource,
    opacityInSource: draft.layer.opacityInSource,
    sourceOrder: draft.layer.sourceOrder,
    role: draft.layer.role,
    rawRgbaByteEstimate: draft.rawRgbaByteEstimate,
    statuses: sortStatuses(statuses),
    statusReasons: uniqueStrings(draft.statusReasons),
    unsupportedFeatureIds: uniqueStrings(draft.layer.unsupportedFeatures.map((feature) => feature.featureId)),
    generated: draft.generated,
    selection: {
      default: "notApproved",
      requestedApproval: approvalRequest !== undefined,
      approved,
      approvedOrder: approved ? approvalRequest?.requestIndex ?? null : null,
      approvalBlockedReasons: uniqueStrings(draft.approvalBlockedReasons)
    }
  };
};

const createSummary = (input: {
  readonly candidates: readonly BrowserPsdImportPlanLeafCandidate[];
  readonly sourceByteLength: number;
  readonly caps: BrowserPsdImportPlanCaps;
}): BrowserPsdImportPlanSummary => {
  const requestedCandidates = input.candidates.filter((candidate) => candidate.selection.requestedApproval);
  const approvedCandidates = input.candidates.filter((candidate) => candidate.selection.approved);

  return {
    totalLeafCount: input.candidates.length,
    eligibleCandidateCount: countCandidatesWithStatus(input.candidates, "candidate"),
    hiddenCount: countCandidatesWithStatus(input.candidates, "hidden"),
    unsupportedCount: countCandidatesWithStatus(input.candidates, "unsupported"),
    emptyZeroSizeCount: countCandidatesWithStatus(input.candidates, "emptyZeroSize"),
    duplicateRefCount: countCandidatesWithStatus(input.candidates, "duplicateRef"),
    duplicateNameCount: countCandidatesWithStatus(input.candidates, "duplicateName"),
    generatedIdCollisionCount: countCandidatesWithStatus(input.candidates, "generatedIdCollision"),
    generatedNameCollisionCount: countCandidatesWithStatus(input.candidates, "generatedNameCollision"),
    byteCapBlockedCount: countCandidatesWithStatus(input.candidates, "byteCapBlocked"),
    notApprovedCount: countCandidatesWithStatus(input.candidates, "notApproved"),
    requestedApprovalCount: requestedCandidates.length,
    approvedCount: approvedCandidates.length,
    totalRawRgbaByteEstimate: sumByteEstimates(input.candidates),
    eligibleRawRgbaByteEstimate: sumByteEstimates(
      input.candidates.filter((candidate) => candidate.statuses.includes("candidate"))
    ),
    requestedApprovalRawRgbaByteEstimate: sumByteEstimates(requestedCandidates),
    approvedRawRgbaByteEstimate: sumByteEstimates(approvedCandidates),
    candidateEnumerationCap: {
      exceeded: input.candidates.length > input.caps.maxLeafCandidates,
      totalLeafCount: input.candidates.length,
      maxLeafCandidates: input.caps.maxLeafCandidates
    },
    sourceParseCap: {
      exceeded: input.sourceByteLength > input.caps.maxSourceBytes,
      sourceByteLength: input.sourceByteLength,
      maxSourceBytes: input.caps.maxSourceBytes
    },
    approvalCap: {
      exceeded: requestedCandidates.length > input.caps.maxApprovedLeaves,
      requestedApprovalCount: requestedCandidates.length,
      maxApprovedLeaves: input.caps.maxApprovedLeaves
    },
    approvalRawRgbaCap: {
      exceeded: sumByteEstimates(requestedCandidates) > input.caps.maxApprovedRawRgbaBytes,
      requestedApprovalRawRgbaByteEstimate: sumByteEstimates(requestedCandidates),
      maxApprovedRawRgbaBytes: input.caps.maxApprovedRawRgbaBytes
    },
    publicDemoAsset: false
  };
};

const createDiagnostics = (
  status: BrowserPsdImportPlanCandidatePlan["status"],
  summary: BrowserPsdImportPlanSummary,
  approvalRequests: readonly ApprovalRequest[],
  approvedRequestByRef: ReadonlyMap<string, ApprovalRequest>,
  candidates: readonly BrowserPsdImportPlanLeafCandidate[]
): readonly BrowserPsdImportPlanDiagnostic[] => {
  const diagnostics: BrowserPsdImportPlanDiagnostic[] = [{
    checkId: `browserPsdImportPlan.candidatePlan.${status}`,
    severity: status === "ready" ? "info" : "error",
    message: "Browser PSD import plan leaf candidates were generated from parser-free session evidence.",
    evidence: [
      `scopeLeafCount=${summary.totalLeafCount}`,
      `eligibleCandidateCount=${summary.eligibleCandidateCount}`,
      `notApprovedCount=${summary.notApprovedCount}`,
      `approvedCount=${summary.approvedCount}`,
      `totalRawRgbaByteEstimate=${summary.totalRawRgbaByteEstimate}`,
      "groupsAreContextOnly=true",
      "publicDemoAsset=false"
    ]
  }];
  const missingApprovedRefs = approvalRequests
    .filter((request) => !request.duplicate)
    .filter((request) => !candidates.some((candidate) => candidate.layerRef === request.ref));

  if (missingApprovedRefs.length > 0) {
    diagnostics.push({
      checkId: "browserPsdImportPlan.approvalRefMissing",
      severity: "warning",
      message: "Some approved leaf refs are not present in the candidate plan scope.",
      evidence: missingApprovedRefs.map((request) => `missingApprovalRef=${request.ref}`)
    });
  }

  const duplicateApprovals = approvalRequests.filter((request) => request.duplicate);
  if (duplicateApprovals.length > 0) {
    diagnostics.push({
      checkId: "browserPsdImportPlan.approvalDuplicateRef",
      severity: "warning",
      message: "Duplicate approved refs were blocked by the candidate plan preflight.",
      evidence: duplicateApprovals.map((request) =>
        `duplicateApprovalRef=${request.ref}:requestIndex=${request.requestIndex}:canonicalRequestIndex=${request.canonicalRequestIndex}`
      )
    });
  }

  if (summary.candidateEnumerationCap.exceeded) {
    diagnostics.push({
      checkId: "browserPsdImportPlan.candidateEnumerationCapExceeded",
      severity: "error",
      message: "Candidate enumeration cap was exceeded; the plan is blocked and was not silently truncated.",
      evidence: [
        `totalLeafCount=${summary.candidateEnumerationCap.totalLeafCount}`,
        `maxLeafCandidates=${summary.candidateEnumerationCap.maxLeafCandidates}`
      ]
    });
  }

  if (summary.sourceParseCap.exceeded) {
    diagnostics.push({
      checkId: "browserPsdImportPlan.sourceParseCapExceeded",
      severity: "error",
      message: "Source PSD byte length exceeds the conservative browser parse cap.",
      evidence: [
        `sourceByteLength=${summary.sourceParseCap.sourceByteLength}`,
        `maxSourceBytes=${summary.sourceParseCap.maxSourceBytes}`
      ]
    });
  }

  if (summary.approvalCap.exceeded || summary.approvalRawRgbaCap.exceeded) {
    diagnostics.push({
      checkId: "browserPsdImportPlan.approvalCapBlocked",
      severity: "warning",
      message: "Approved leaf refs exceed v0 execution caps and blocked candidates must not be materialized.",
      evidence: [
        `requestedApprovalCount=${summary.approvalCap.requestedApprovalCount}`,
        `maxApprovedLeaves=${summary.approvalCap.maxApprovedLeaves}`,
        `requestedApprovalRawRgbaByteEstimate=${summary.approvalRawRgbaCap.requestedApprovalRawRgbaByteEstimate}`,
        `maxApprovedRawRgbaBytes=${summary.approvalRawRgbaCap.maxApprovedRawRgbaBytes}`
      ]
    });
  }

  if (approvalRequests.length === 0 && approvedRequestByRef.size === 0) {
    diagnostics.push({
      checkId: "browserPsdImportPlan.defaultApproval.none",
      severity: "info",
      message: "No import plan candidates are approved by default; execution requires explicit leaf approval.",
      evidence: ["defaultSelection=notApproved", "autoApproveAll=false"]
    });
  }

  return diagnostics;
};

const createCanonicalCandidatePlan = (input: {
  readonly parsedBridgeResult: BrowserPsdParserBridgeParsedResult;
  readonly sourceDigest: BinaryAssetDigestDto | undefined;
  readonly scope: BrowserPsdImportPlanScope;
  readonly caps: BrowserPsdImportPlanCaps;
  readonly candidates: readonly BrowserPsdImportPlanLeafCandidate[];
}): CanonicalJsonValue => ({
  evidenceKind: "browser-psd-import-plan-candidate-plan-v1",
  source: {
    sourceAssetId: input.parsedBridgeResult.source.sourceAssetId,
    fileName: input.parsedBridgeResult.source.fileName,
    declaredMediaType: input.parsedBridgeResult.source.declaredMediaType ?? null,
    byteLength: input.parsedBridgeResult.source.byteLength,
    sizeCapBytes: input.parsedBridgeResult.source.sizeCapBytes,
    intakeKind: input.parsedBridgeResult.source.intakeKind,
    publicDistribution: input.parsedBridgeResult.source.privacy.publicDistribution,
    rawBytesPersistence: input.parsedBridgeResult.source.privacy.rawBytesPersistence,
    sourceDigest: input.sourceDigest === undefined
      ? null
      : `${input.sourceDigest.algorithm}:${input.sourceDigest.hex}`
  },
  parser: createCanonicalParser(input.parsedBridgeResult.adapterResult.parser),
  scope: {
    scopeRef: input.scope.scopeRef,
    scopeKind: input.scope.scopeKind,
    discoveryMode: input.scope.discoveryMode,
    displayPath: input.scope.displayPath
  },
  caps: {
    maxSourceBytes: input.caps.maxSourceBytes,
    maxLeafCandidates: input.caps.maxLeafCandidates,
    maxLeafRawRgbaBytes: input.caps.maxLeafRawRgbaBytes,
    maxApprovedLeaves: input.caps.maxApprovedLeaves,
    maxApprovedRawRgbaBytes: input.caps.maxApprovedRawRgbaBytes
  },
  candidates: input.candidates.map((candidate) => ({
    layerRef: candidate.layerRef,
    displayName: candidate.displayName,
    normalizedName: candidate.normalizedName,
    fullPath: candidate.fullPath,
    parentGroups: candidate.parentGroups.map((group) => ({
      groupRef: group.groupRef,
      displayName: group.displayName,
      fullPath: group.fullPath,
      depth: group.depth
    })),
    bounds: {
      x: candidate.bounds.x,
      y: candidate.bounds.y,
      width: candidate.bounds.width,
      height: candidate.bounds.height
    },
    visibleInSource: candidate.visibleInSource,
    opacityInSource: candidate.opacityInSource,
    sourceOrder: candidate.sourceOrder,
    role: candidate.role,
    rawRgbaByteEstimate: candidate.rawRgbaByteEstimate,
    defaultSelection: candidate.selection.default,
    unsupportedFeatureIds: candidate.unsupportedFeatureIds,
    generated: {
      destinationKind: candidate.generated.destinationKind,
      displayName: candidate.generated.displayName,
      partId: candidate.generated.partId,
      drawableId: candidate.generated.drawableId,
      textureId: candidate.generated.textureId,
      meshId: candidate.generated.meshId
    },
    baseStatuses: candidate.statuses.filter((status) => status !== "notApproved"),
    baseStatusReasons: candidate.statusReasons.filter(
      (reason) => !reason.includes("preview only") && !reason.includes("not approved")
    )
  }))
});

const computeCandidatePlanDigest = async (
  canonicalJson: string
): Promise<BrowserPsdImportPlanCandidatePlan["candidatePlanDigest"]> => {
  const bytes = new TextEncoder().encode(canonicalJson);
  const digestResult = await computePackageBinarySha256Digest(bytes);
  if (digestResult.status === "unsupported") {
    throw new Error(`Unable to compute browser PSD import plan digest: ${digestResult.reason}`);
  }

  return {
    algorithm: "sha256",
    hex: digestResult.digest.hex,
    canonicalJsonByteLength: bytes.byteLength
  };
};

const createCanonicalParser = (
  parser: PsdAdapterResultDto["parser"]
): CanonicalJsonValue => {
  if (parser === undefined) {
    return null;
  }

  return {
    evidenceKind: parser.evidenceKind,
    parserName: parser.parserName,
    parserPackageName: parser.parserPackageName ?? null,
    parserVersion: parser.parserVersion ?? null,
    adapterName: parser.adapterName ?? null,
    adapterVersion: parser.adapterVersion ?? null,
    runtime: parser.runtime ?? null,
    privateShapePolicy: parser.privateShapePolicy
  };
};

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

const addStatus = (
  draft: DraftCandidate,
  status: BrowserPsdImportPlanCandidateStatus,
  reason: string
): void => {
  draft.statuses.add(status);
  draft.statusReasons.push(reason);
};

const groupDraftsBy = (
  drafts: readonly DraftCandidate[],
  selector: (draft: DraftCandidate) => string
): Map<string, DraftCandidate[]> => {
  const groups = new Map<string, DraftCandidate[]>();
  for (const draft of drafts) {
    const key = selector(draft);
    const entries = groups.get(key) ?? [];
    entries.push(draft);
    groups.set(key, entries);
  }

  return groups;
};

const sortStatuses = (
  statuses: ReadonlySet<BrowserPsdImportPlanCandidateStatus>
): readonly BrowserPsdImportPlanCandidateStatus[] => {
  const order: readonly BrowserPsdImportPlanCandidateStatus[] = [
    "candidate",
    "hidden",
    "unsupported",
    "emptyZeroSize",
    "duplicateRef",
    "duplicateName",
    "generatedIdCollision",
    "generatedNameCollision",
    "byteCapBlocked",
    "notApproved"
  ];

  return order.filter((status) => statuses.has(status));
};

const countCandidatesWithStatus = (
  candidates: readonly BrowserPsdImportPlanLeafCandidate[],
  status: BrowserPsdImportPlanCandidateStatus
): number => candidates.filter((candidate) => candidate.statuses.includes(status)).length;

const sumByteEstimates = (
  candidates: readonly BrowserPsdImportPlanLeafCandidate[]
): number => candidates.reduce((sum, candidate) => sum + candidate.rawRgbaByteEstimate, 0);

const countGroupSegments = (ref: string): number =>
  ref.split("/").filter((segment) => groupScopeSegmentPattern.test(segment)).length;

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values)];

const createPlanId = (sourceAssetId: string, scopeRef: string): string =>
  `plan_${sanitizeIdToken(`${sourceAssetId}_${scopeRef}`)}`;

const sanitizeIdToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unnamed";
