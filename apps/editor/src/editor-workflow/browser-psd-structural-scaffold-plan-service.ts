import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  createDrawableIdFromDisplayName,
  createMeshIdFromDrawableId,
  createPartIdFromDisplayName,
  createTextureIdFromDrawableId,
  PSD_STRUCTURAL_APPROVED_GROUP_LIMIT,
  PSD_STRUCTURAL_APPROVED_LEAF_LIMIT,
  PSD_STRUCTURAL_GENERATED_NODE_LIMIT,
  PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT,
  PsdStructuralScaffoldApprovalBridgeEvidenceSchema,
  PsdStructuralScaffoldApprovalEvidenceSchema,
  PsdStructuralScaffoldPlanEvidenceSchema,
  type PsdAdapterResultDto,
  type PsdAdapterSourceGroupDto,
  type PsdAdapterSourceLayerDto,
  type PsdStructuralScaffoldApprovalBridgeEvidenceDto,
  type PsdStructuralScaffoldCapPolicyDto,
  type PsdStructuralScaffoldGroupPartDto,
  type PsdStructuralScaffoldIssueDto,
  type PsdStructuralScaffoldLeafDrawableDto,
  type PsdStructuralScaffoldSourceGroupReferenceDto,
  type PsdStructuralScaffoldSourceNodeRefDto
} from "@private-2d-rigging-lab/operation-core";
import {
  computePackageBinarySha256Digest,
  type BinaryAssetDigestDto
} from "@private-2d-rigging-lab/package-format";

import type { BrowserPsdParserBridgeParsedResult } from "./browser-psd-parser-bridge-result.js";
import type { BrowserPsdImportPlanReservedGeneratedIds } from "./browser-psd-import-plan-candidate-service.js";

export interface BrowserPsdStructuralScaffoldPlanInput {
  readonly parsedBridgeResult: BrowserPsdParserBridgeParsedResult;
  readonly sourceAssetId: string;
  readonly sourceFilePath: string;
  readonly sourceDigest: BinaryAssetDigestDto;
  readonly scopeRef: string;
  readonly destinationParentPartId: string;
  readonly approvedNodeRefs?: readonly string[];
  readonly reservedGeneratedIds?: BrowserPsdImportPlanReservedGeneratedIds;
  readonly reservedGeneratedNames?: readonly string[];
  readonly planId?: string;
  readonly approvalId?: string;
}

export interface BrowserPsdStructuralScaffoldNodePreview {
  readonly nodeRef: string;
  readonly kind: "group" | "leaf";
  readonly label: string;
  readonly fullPathLabel: string;
  readonly sourceOrder: number;
  readonly visibleInSource: boolean;
  readonly opacityInSource: number;
  readonly boundsLabel: string;
  readonly approvalEligible: boolean;
  readonly approved: boolean;
  readonly generatedParentPartId: string;
  readonly generatedPartId?: string;
  readonly generatedDrawableId?: string;
  readonly generatedTextureId?: string;
  readonly generatedMeshId?: string;
  readonly initialRuntimeVisibility?: boolean;
  readonly status: PsdStructuralScaffoldGroupPartDto["status"];
  readonly statusReasons: readonly string[];
}

export interface BrowserPsdStructuralScaffoldDiagnostic {
  readonly checkId: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
}

export interface BrowserPsdStructuralScaffoldPlan {
  readonly status: "ready" | "blocked";
  readonly structuralScaffoldBridge: PsdStructuralScaffoldApprovalBridgeEvidenceDto;
  readonly approvedNodeRefs: readonly string[];
  readonly nodes: readonly BrowserPsdStructuralScaffoldNodePreview[];
  readonly diagnostics: readonly BrowserPsdStructuralScaffoldDiagnostic[];
}

interface GroupDraft {
  readonly group: PsdAdapterSourceGroupDto;
  readonly nodeRef: string;
  readonly sourceGroupRef: PsdStructuralScaffoldSourceGroupReferenceDto;
  readonly sourceParentGroupRef?: PsdStructuralScaffoldSourceGroupReferenceDto;
  readonly generatedParentPartId: string;
  readonly generatedPartId: string;
  readonly generatedPartDisplayName: string;
  readonly statusReasons: readonly string[];
  readonly blocked: boolean;
}

interface LeafDraft {
  readonly layer: PsdAdapterSourceLayerDto;
  readonly sourceAssetId: string;
  readonly sourceParentGroupRef?: PsdStructuralScaffoldSourceGroupReferenceDto;
  readonly generatedParentPartId: string;
  readonly generatedDrawableId: string;
  readonly generatedTextureId: string;
  readonly generatedMeshId: string;
  readonly generatedDrawableDisplayName: string;
  readonly byteEstimate: number;
  readonly statusReasons: readonly string[];
  readonly blocked: boolean;
}

type CanonicalJsonValue =
  | null
  | string
  | number
  | boolean
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

const rootScopeRef = "psd:root";
const structuralNodeLimit = 256;
const structuralDepthLimit = 8;

export const createBrowserPsdStructuralScaffoldPlan = async (
  input: BrowserPsdStructuralScaffoldPlanInput
): Promise<BrowserPsdStructuralScaffoldPlan> => {
  const adapterResult = input.parsedBridgeResult.adapterResult;
  const destinationParentPartId = input.destinationParentPartId.trim();
  const structuralDestinationParentPartId =
    destinationParentPartId.length === 0 ? "part_missing_structural_destination" : destinationParentPartId;
  const scopeRef = normalizeScopeRef(input.scopeRef);
  const scope = resolveScope(adapterResult, scopeRef);
  const sourceGroupRefs = createSourceGroupRefs(adapterResult, input.sourceAssetId);
  const groupNodeRefs = createGroupNodeRefs(adapterResult);
  const groupsInScope = adapterResult.sourceGroups
    .filter((group) => groupIsInScope(group, scopeRef, groupNodeRefs, adapterResult))
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  const leavesInScope = adapterResult.sourceLayers
    .filter((layer) => layerIsInScope(layer, scopeRef, groupNodeRefs, adapterResult))
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  const capPolicy = createCapPolicy();
  const approvalRequests = normalizeApprovedNodeRefs(input.approvedNodeRefs ?? []);
  const approvedLeafIds = collectApprovedLeafIds({
    adapterResult,
    leaves: leavesInScope,
    approvedNodeRefs: approvalRequests,
    groupNodeRefs
  });
  const groupDrafts = createGroupDrafts({
    groups: groupsInScope,
    sourceGroupRefs,
    destinationParentPartId: structuralDestinationParentPartId,
    reservedGeneratedIds: input.reservedGeneratedIds,
    reservedGeneratedNames: input.reservedGeneratedNames
  });
  const groupsById = new Map(groupDrafts.map((draft) => [draft.group.sourceGroupId, draft]));
  const leafDrafts = createLeafDrafts({
    layers: leavesInScope,
    sourceAssetId: input.sourceAssetId,
    sourceGroupRefs,
    groupDraftsBySourceGroupId: groupsById,
    destinationParentPartId: structuralDestinationParentPartId,
    reservedGeneratedIds: input.reservedGeneratedIds,
    reservedGeneratedNames: input.reservedGeneratedNames
  });
  const requiredGroupIds = collectRequiredGroupIds(adapterResult, leafDrafts, approvedLeafIds);
  const plannedGroups = groupDrafts.map((draft) => createGroupScaffold(draft, "previewReady"));
  const plannedLeaves = leafDrafts.map((draft) =>
    createLeafScaffold(draft, draft.blocked ? "blocked" : "previewReady")
  );
  const approvedGroups = groupDrafts
    .filter((draft) => requiredGroupIds.has(draft.group.sourceGroupId) && !draft.blocked)
    .map((draft) => createGroupScaffold(draft, "approved"));
  const approvedLeaves = leafDrafts
    .filter((draft) => approvedLeafIds.has(draft.layer.sourceLayerId) && !draft.blocked)
    .map((draft) => createLeafScaffold(draft, "approved"));
  const summary = createSummary({
    sourceGroupCount: groupsInScope.length,
    sourceLayerCount: leavesInScope.length,
    approvedGroups,
    approvedLeaves,
    structuralDepth: createStructuralDepth(groupsInScope, leavesInScope)
  });
  const capIssues = createCapIssues(summary, capPolicy);
  const issues = [
    ...createApprovalIssues({
      approvalRequests,
      adapterResult,
      leavesInScope,
      approvedLeafIds,
      leafDrafts
    }),
    ...capIssues
  ];
  const blocked =
    destinationParentPartId.length === 0 ||
    approvedLeaves.length === 0 ||
    capIssues.length > 0 ||
    groupDrafts.some((draft) => draft.blocked && requiredGroupIds.has(draft.group.sourceGroupId)) ||
    leafDrafts.some((draft) => draft.blocked && approvedLeafIds.has(draft.layer.sourceLayerId));
  const structuralPlanId =
    input.planId?.trim() || `plan_${sanitizeIdToken(`${input.sourceAssetId}_${scopeRef}_structural`)}`;
  const approvalId =
    input.approvalId?.trim() || `approval_${sanitizeIdToken(`${input.sourceAssetId}_${scopeRef}_structural`)}`;
  const sourcePsd = {
    sourceAssetId: input.sourceAssetId,
    sourceFilePath: input.sourceFilePath,
    digest: input.sourceDigest,
    byteLength: input.parsedBridgeResult.source.byteLength,
    ...(input.parsedBridgeResult.source.declaredMediaType === undefined
      ? {}
      : { mediaType: normalizePsdMediaType(input.parsedBridgeResult.source.declaredMediaType) }),
    sourceBytePersistence: "metadataOnlyNoRawBytes",
    publicDemoAsset: false
  } as const;
  const parser = adapterResult.parser;
  const canonicalPlan = createCanonicalStructuralPlan({
    structuralPlanId,
    sourcePsd,
    parser,
    scope: canonicalScope(scope),
    plannedGroups,
    plannedLeaves,
    summary,
    capPolicy,
    issues
  });
  const structuralPlanDigest = await computeStructuralDigest(canonicalPlan, "structural plan");
  const structuralPlan = PsdStructuralScaffoldPlanEvidenceSchema.parse({
    schemaVersion: "psd-structural-scaffold-plan-evidence-v1",
    evidenceKind: "psd-structural-scaffold-plan-evidence-v1",
    structuralPlanId,
    structuralPlanDigest,
    sourcePsd,
    ...(parser === undefined ? {} : { parser }),
    scope,
    plannedGroupPartScaffolds: plannedGroups,
    plannedLeafScaffolds: plannedLeaves,
    summary,
    capPolicy,
    issues,
    boundary: {
      explicitStructuralApprovalRequired: true,
      groupsAsPartContainersOnly: true,
      groupDrawableTextureMeshRefs: "forbidden",
      rawParserObjectPersistence: "notPersisted",
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
      structuralPreviewBytePersistence: "metadataOnlyNoRawBytes",
      publicDemoAsset: false,
      semanticRecognition: "notProvided",
      repoProposalGeneration: "notProvided",
      initialGridMeshGeneration: "notProvided",
      photoshopCompositingClaim: "none"
    }
  });
  const approvalSelectionDigest = await computeStructuralDigest(
    createCanonicalApprovalSelection({
      structuralPlanDigest,
      destinationParentPartId: structuralDestinationParentPartId,
      approvedGroups,
      approvedLeaves
    }),
    "structural approval"
  );
  const approval = PsdStructuralScaffoldApprovalEvidenceSchema.parse({
    schemaVersion: "psd-structural-scaffold-approval-evidence-v1",
    evidenceKind: "psd-structural-scaffold-approval-evidence-v1",
    approvalId,
    structuralPlanDigest,
    approvalSelectionDigest,
    sourcePsd,
    destination: {
      destinationKind: "structuralScaffold",
      parentPartId: structuralDestinationParentPartId
    },
    approvalStatus: blocked
      ? capIssues.length > 0
        ? "structuralExpansionCapExceeded"
        : "preflightBlocked"
      : "approved",
    approvedGroupPartScaffolds: approvedGroups,
    approvedLeafScaffolds: approvedLeaves,
    summary,
    capPolicy,
    issues,
    boundary: {
      explicitStructuralApproval: true,
      groupsAsPartContainersOnly: true,
      groupDrawableTextureMeshRefs: "forbidden",
      rawParserObjectPersistence: "notPersisted",
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
      materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
      publicDemoAsset: false,
      semanticRecognition: "notProvided",
      repoProposalGeneration: "notProvided",
      initialGridMeshGeneration: "notProvided",
      photoshopCompositingClaim: "none"
    }
  });
  const structuralScaffoldBridge = PsdStructuralScaffoldApprovalBridgeEvidenceSchema.parse({
    schemaVersion: "psd-structural-scaffold-approval-bridge-evidence-v1",
    structuralPlan,
    approval
  });

  return {
    status: blocked ? "blocked" : "ready",
    structuralScaffoldBridge,
    approvedNodeRefs: approvedLeaves.map((leaf) => leaf.sourceLayerRef.sourceLayerId),
    nodes: createPreviewNodes({
      groupDrafts,
      leafDrafts,
      approvedLeafIds,
      approvalRequests,
      requiredGroupIds,
      groupNodeRefs,
      adapterResult
    }),
    diagnostics: createDiagnostics({
      blocked,
      summary,
      issues,
      approvedLeaves,
      approvalRequests,
      destinationParentPartId
    })
  };
};

const normalizeScopeRef = (scopeRef: string): string => {
  const normalized = scopeRef.trim();
  return normalized.length === 0 ? rootScopeRef : normalized;
};

const normalizeApprovedNodeRefs = (refs: readonly string[]): readonly string[] => [
  ...new Set(refs.map((ref) => ref.trim()).filter((ref) => ref.length > 0))
];

const resolveScope = (
  adapterResult: PsdAdapterResultDto,
  scopeRef: string
): {
  readonly scopeRef: PsdStructuralScaffoldSourceNodeRefDto;
  readonly scopeDisplayPath: readonly string[];
  readonly discoveryMode: "explicitStructuralScaffoldPreview";
} => {
  if (scopeRef === rootScopeRef) {
    return {
      scopeRef: { kind: "document", id: rootScopeRef },
      scopeDisplayPath: [],
      discoveryMode: "explicitStructuralScaffoldPreview"
    };
  }

  const group = adapterResult.sourceGroups.find((candidate) => candidate.sourceGroupId === scopeRef);
  if (group !== undefined) {
    return {
      scopeRef: { kind: "group", id: group.sourceGroupId },
      scopeDisplayPath: group.groupPath,
      discoveryMode: "explicitStructuralScaffoldPreview"
    };
  }

  const layer = adapterResult.sourceLayers.find((candidate) => candidate.sourceLayerId === scopeRef);
  if (layer !== undefined) {
    return {
      scopeRef: { kind: "layer", id: layer.sourceLayerId },
      scopeDisplayPath: [...layer.groupPath, layer.originalName],
      discoveryMode: "explicitStructuralScaffoldPreview"
    };
  }

  const groupNodeRefs = createGroupNodeRefs(adapterResult);
  const groupByNodeRef = adapterResult.sourceGroups.find(
    (candidate) => groupNodeRefs.get(candidate.sourceGroupId) === scopeRef
  );
  if (groupByNodeRef !== undefined) {
    return {
      scopeRef: { kind: "group", id: groupByNodeRef.sourceGroupId, path: scopeRef },
      scopeDisplayPath: groupByNodeRef.groupPath,
      discoveryMode: "explicitStructuralScaffoldPreview"
    };
  }

  throw new Error(`PSD structural scaffold scope was not found in parser session evidence: ${scopeRef}`);
};

const createSourceGroupRefs = (
  adapterResult: PsdAdapterResultDto,
  sourceAssetId: string
): ReadonlyMap<string, PsdStructuralScaffoldSourceGroupReferenceDto> =>
  new Map(adapterResult.sourceGroups.map((group) => [
    group.sourceGroupId,
    {
      sourceAssetId: SourceAssetIdSchema.parse(sourceAssetId),
      sourceGroupId: group.sourceGroupId,
      sourceGroupName: group.originalName,
      sourceGroupPath: group.groupPath
    }
  ]));

const createGroupNodeRefs = (
  adapterResult: PsdAdapterResultDto
): ReadonlyMap<string, string> => {
  const refs = new Map<string, string>();
  for (const layer of adapterResult.sourceLayers) {
    const groupRefs = createAncestorGroupNodeRefs(layer.sourceLayerId);
    for (const [index, groupName] of layer.groupPath.entries()) {
      const groupPath = layer.groupPath.slice(0, index + 1);
      const group = adapterResult.sourceGroups.find((candidate) =>
        sameStringArray(candidate.groupPath, groupPath) && candidate.originalName === groupName
      );
      const ref = groupRefs[index];
      if (group !== undefined && ref !== undefined) {
        refs.set(group.sourceGroupId, ref);
      }
    }
  }

  for (const group of adapterResult.sourceGroups) {
    if (refs.has(group.sourceGroupId)) {
      continue;
    }
    refs.set(group.sourceGroupId, group.sourceGroupId);
  }

  return refs;
};

const createAncestorGroupNodeRefs = (layerRef: string): readonly string[] => {
  const segments = layerRef.split("/");
  const refs: string[] = [];
  let current = segments[0] ?? rootScopeRef;

  for (const segment of segments.slice(1)) {
    if (!/^group\[(?:0|[1-9]\d*)\]$/.test(segment)) {
      continue;
    }
    current = `${current}/${segment}`;
    refs.push(current);
  }

  return refs;
};

const groupIsInScope = (
  group: PsdAdapterSourceGroupDto,
  scopeRef: string,
  groupNodeRefs: ReadonlyMap<string, string>,
  adapterResult: PsdAdapterResultDto
): boolean => {
  if (scopeRef === rootScopeRef) {
    return true;
  }
  if (group.sourceGroupId === scopeRef) {
    return true;
  }
  const nodeRef = groupNodeRefs.get(group.sourceGroupId);
  if (nodeRef === scopeRef || nodeRef?.startsWith(`${scopeRef}/`) === true) {
    return true;
  }

  return collectGroupAncestorChain(adapterResult, group).some((ancestor) => {
    const ancestorNodeRef = groupNodeRefs.get(ancestor.sourceGroupId);
    return ancestor.sourceGroupId === scopeRef ||
      ancestorNodeRef === scopeRef ||
      ancestorNodeRef?.startsWith(`${scopeRef}/`) === true;
  });
};

const layerIsInScope = (
  layer: PsdAdapterSourceLayerDto,
  scopeRef: string,
  groupNodeRefs: ReadonlyMap<string, string>,
  adapterResult: PsdAdapterResultDto
): boolean => {
  if (scopeRef === rootScopeRef) {
    return true;
  }
  if (layer.sourceLayerId === scopeRef || layer.sourceLayerId.startsWith(`${scopeRef}/`)) {
    return true;
  }
  if (layer.parentGroupId === scopeRef) {
    return true;
  }

  const parentGroups = collectLayerGroupChain(adapterResult, layer);
  return parentGroups.some((group) => {
    const nodeRef = groupNodeRefs.get(group.sourceGroupId);
    return group.sourceGroupId === scopeRef ||
      nodeRef === scopeRef ||
      nodeRef?.startsWith(`${scopeRef}/`) === true;
  });
};

const collectApprovedLeafIds = (input: {
  readonly adapterResult: PsdAdapterResultDto;
  readonly leaves: readonly PsdAdapterSourceLayerDto[];
  readonly approvedNodeRefs: readonly string[];
  readonly groupNodeRefs: ReadonlyMap<string, string>;
}): ReadonlySet<string> => {
  if (input.approvedNodeRefs.length === 0) {
    return new Set();
  }

  const approvedSet = new Set(input.approvedNodeRefs);
  const approveAll = approvedSet.has(rootScopeRef);
  const leafIds = new Set<string>();

  for (const layer of input.leaves) {
    const parentGroups = collectLayerGroupChain(input.adapterResult, layer);
    const approved =
      approveAll ||
      approvedSet.has(layer.sourceLayerId) ||
      parentGroups.some((group) => {
        const groupNodeRef = input.groupNodeRefs.get(group.sourceGroupId);
        return approvedSet.has(group.sourceGroupId) ||
          (groupNodeRef !== undefined && approvedSet.has(groupNodeRef));
      });

    if (approved) {
      leafIds.add(layer.sourceLayerId);
    }
  }

  return leafIds;
};

const createGroupDrafts = (input: {
  readonly groups: readonly PsdAdapterSourceGroupDto[];
  readonly sourceGroupRefs: ReadonlyMap<string, PsdStructuralScaffoldSourceGroupReferenceDto>;
  readonly destinationParentPartId: string;
  readonly reservedGeneratedIds: BrowserPsdImportPlanReservedGeneratedIds | undefined;
  readonly reservedGeneratedNames: readonly string[] | undefined;
}): readonly GroupDraft[] => {
  const generatedIds = new Set<string>([
    ...(input.reservedGeneratedIds?.partIds ?? []),
    ...(input.reservedGeneratedIds?.drawableIds ?? []),
    ...(input.reservedGeneratedIds?.textureIds ?? []),
    ...(input.reservedGeneratedIds?.meshIds ?? [])
  ]);
  const generatedNames = new Set((input.reservedGeneratedNames ?? []).map(normalizeDisplayName));

  return input.groups.map((group) => {
    const sourceGroupRef = requireGroupRef(input.sourceGroupRefs, group.sourceGroupId);
    const parentGroupRef = group.parentGroupId === undefined
      ? undefined
      : requireGroupRef(input.sourceGroupRefs, group.parentGroupId);
    const generatedPartDisplayName = createUniqueDisplayName({
      preferred: group.originalName,
      fallback: group.groupPath.join(" / ") || group.sourceGroupId,
      sourceRef: group.sourceGroupId
    });
    const generatedPartId = PartIdSchema.parse(createPartIdFromDisplayName(
      `${group.groupPath.join(" / ")} / ${group.sourceGroupId} / structural`
    ));
    const generatedParentPartId = parentGroupRef === undefined
      ? PartIdSchema.parse(input.destinationParentPartId)
      : PartIdSchema.parse(createPartIdFromDisplayName(
          `${group.groupPath.slice(0, -1).join(" / ")} / ${parentGroupRef.sourceGroupId} / structural`
        ));
    const statusReasons: string[] = [];
    if (generatedIds.has(generatedPartId)) {
      statusReasons.push(`Generated group part id collides with existing project id: ${generatedPartId}.`);
    }
    if (generatedNames.has(normalizeDisplayName(generatedPartDisplayName))) {
      statusReasons.push(`Generated group part display name collides with existing project name: ${generatedPartDisplayName}.`);
    }

    return {
      group,
      nodeRef: group.sourceGroupId,
      sourceGroupRef,
      ...(parentGroupRef === undefined ? {} : { sourceParentGroupRef: parentGroupRef }),
      generatedParentPartId,
      generatedPartId,
      generatedPartDisplayName,
      statusReasons,
      blocked: statusReasons.length > 0
    };
  });
};

const createLeafDrafts = (input: {
  readonly layers: readonly PsdAdapterSourceLayerDto[];
  readonly sourceAssetId: string;
  readonly sourceGroupRefs: ReadonlyMap<string, PsdStructuralScaffoldSourceGroupReferenceDto>;
  readonly groupDraftsBySourceGroupId: ReadonlyMap<string, GroupDraft>;
  readonly destinationParentPartId: string;
  readonly reservedGeneratedIds: BrowserPsdImportPlanReservedGeneratedIds | undefined;
  readonly reservedGeneratedNames: readonly string[] | undefined;
}): readonly LeafDraft[] => {
  const generatedIds = new Set<string>([
    ...(input.reservedGeneratedIds?.partIds ?? []),
    ...(input.reservedGeneratedIds?.drawableIds ?? []),
    ...(input.reservedGeneratedIds?.textureIds ?? []),
    ...(input.reservedGeneratedIds?.meshIds ?? [])
  ]);
  const generatedNames = new Set((input.reservedGeneratedNames ?? []).map(normalizeDisplayName));

  return input.layers.map((layer) => {
    const sourceParentGroupRef = layer.parentGroupId === undefined
      ? undefined
      : requireGroupRef(input.sourceGroupRefs, layer.parentGroupId);
    const generatedParentPartId =
      layer.parentGroupId === undefined
        ? PartIdSchema.parse(input.destinationParentPartId)
        : input.groupDraftsBySourceGroupId.get(layer.parentGroupId)?.generatedPartId ??
          PartIdSchema.parse(input.destinationParentPartId);
    const generatedDrawableDisplayName = createUniqueDisplayName({
      preferred: layer.originalName,
      fallback: [...layer.groupPath, layer.originalName].join(" / ") || layer.sourceLayerId,
      sourceRef: layer.sourceLayerId
    });
    const drawableId = DrawableIdSchema.parse(createDrawableIdFromDisplayName(
      `${[...layer.groupPath, layer.originalName].join(" / ")} / ${layer.sourceLayerId} / structural`
    ));
    const generatedTextureId = TextureIdSchema.parse(createTextureIdFromDrawableId(drawableId));
    const generatedMeshId = MeshIdSchema.parse(createMeshIdFromDrawableId(drawableId));
    const byteEstimate = estimateRawRgbaBytes(layer.bounds.width, layer.bounds.height);
    const statusReasons: string[] = [];

    if (layer.bounds.width <= 0 || layer.bounds.height <= 0) {
      statusReasons.push("Layer bounds have zero width or height.");
    }
    if (layer.role === "unsupported") {
      statusReasons.push("Layer role is unsupported for structural scaffold materialization.");
    }
    if (layer.unsupportedFeatures.some((feature) => !feature.rasterizeCandidate)) {
      statusReasons.push("Layer has unsupported features without rasterize-candidate evidence.");
    }
    if (byteEstimate > PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT) {
      statusReasons.push(`Layer raw RGBA estimate ${byteEstimate} exceeds structural byte cap.`);
    }
    for (const id of [drawableId, generatedTextureId, generatedMeshId]) {
      if (generatedIds.has(id)) {
        statusReasons.push(`Generated leaf id collides with existing project id: ${id}.`);
      }
    }
    if (generatedNames.has(normalizeDisplayName(generatedDrawableDisplayName))) {
      statusReasons.push(`Generated drawable display name collides with existing project name: ${generatedDrawableDisplayName}.`);
    }

    return {
      layer,
      sourceAssetId: input.sourceAssetId,
      ...(sourceParentGroupRef === undefined ? {} : { sourceParentGroupRef }),
      generatedParentPartId,
      generatedDrawableId: drawableId,
      generatedTextureId,
      generatedMeshId,
      generatedDrawableDisplayName,
      byteEstimate,
      statusReasons,
      blocked: statusReasons.length > 0
    };
  });
};

const collectRequiredGroupIds = (
  adapterResult: PsdAdapterResultDto,
  leafDrafts: readonly LeafDraft[],
  approvedLeafIds: ReadonlySet<string>
): ReadonlySet<string> => {
  const groupIds = new Set<string>();
  const groupById = new Map(adapterResult.sourceGroups.map((group) => [group.sourceGroupId, group]));

  for (const draft of leafDrafts) {
    if (!approvedLeafIds.has(draft.layer.sourceLayerId)) {
      continue;
    }
    let parentGroupId = draft.layer.parentGroupId;
    while (parentGroupId !== undefined) {
      groupIds.add(parentGroupId);
      parentGroupId = groupById.get(parentGroupId)?.parentGroupId;
    }
  }

  return groupIds;
};

const createGroupScaffold = (
  draft: GroupDraft,
  status: PsdStructuralScaffoldGroupPartDto["status"]
): PsdStructuralScaffoldGroupPartDto => ({
  scaffoldKind: "groupPartContainer",
  sourceGroupRef: draft.sourceGroupRef,
  ...(draft.sourceParentGroupRef === undefined
    ? {}
    : { sourceParentGroupRef: draft.sourceParentGroupRef }),
  sourceGroupName: draft.group.originalName,
  sourceGroupPath: [...draft.group.groupPath],
  sourceOrder: draft.group.sourceOrder,
  visibleInSource: draft.group.visibleInSource,
  opacityInSource: draft.group.opacityInSource,
  ...(draft.group.bounds === undefined ? {} : { bounds: draft.group.bounds }),
  generatedParentPartId: PartIdSchema.parse(draft.generatedParentPartId),
  generatedPartId: PartIdSchema.parse(draft.generatedPartId),
  generatedPartDisplayName: draft.generatedPartDisplayName,
  status,
  statusReasons: status === "approved" ? [] : [...draft.statusReasons]
});

const createLeafScaffold = (
  draft: LeafDraft,
  status: PsdStructuralScaffoldLeafDrawableDto["status"]
): PsdStructuralScaffoldLeafDrawableDto => ({
  scaffoldKind: "leafDrawableScaffold",
  sourceLayerRef: {
    sourceAssetId: SourceAssetIdSchema.parse(draft.sourceAssetId),
    sourceLayerId: draft.layer.sourceLayerId,
    sourceLayerName: draft.layer.originalName,
    sourceLayerPath: [...draft.layer.groupPath, draft.layer.originalName]
  },
  ...(draft.sourceParentGroupRef === undefined
    ? {}
    : { sourceParentGroupRef: draft.sourceParentGroupRef }),
  sourceLayerName: draft.layer.originalName,
  sourceLayerPath: [...draft.layer.groupPath, draft.layer.originalName],
  sourceOrder: draft.layer.sourceOrder,
  visibleInSource: draft.layer.visibleInSource,
  opacityInSource: draft.layer.opacityInSource,
  bounds: draft.layer.bounds,
  byteEstimate: draft.byteEstimate,
  generatedParentPartId: PartIdSchema.parse(draft.generatedParentPartId),
  generatedDrawableId: DrawableIdSchema.parse(draft.generatedDrawableId),
  generatedDrawableDisplayName: draft.generatedDrawableDisplayName,
  generatedTextureId: TextureIdSchema.parse(draft.generatedTextureId),
  generatedMeshId: MeshIdSchema.parse(draft.generatedMeshId),
  initialRuntimeVisibility: draft.layer.visibleInSource,
  status,
  statusReasons: status === "approved" ? [] : [...draft.statusReasons]
});

const createSummary = (input: {
  readonly sourceGroupCount: number;
  readonly sourceLayerCount: number;
  readonly approvedGroups: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly approvedLeaves: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly structuralDepth: number;
}) => ({
  sourceGroupCount: input.sourceGroupCount,
  sourceLayerCount: input.sourceLayerCount,
  approvedGroupCount: input.approvedGroups.length,
  approvedLeafCount: input.approvedLeaves.length,
  generatedGroupPartCount: input.approvedGroups.length,
  generatedDrawableCount: input.approvedLeaves.length,
  hiddenLeafCount: input.approvedLeaves.filter((leaf) => !leaf.visibleInSource).length,
  runtimeHiddenDrawableCount: input.approvedLeaves.filter((leaf) => !leaf.initialRuntimeVisibility).length,
  structuralDepth: input.structuralDepth,
  totalByteEstimate: input.approvedLeaves.reduce((sum, leaf) => sum + (leaf.byteEstimate ?? 0), 0)
});

const createCapPolicy = (): PsdStructuralScaffoldCapPolicyDto => ({
  structuralNodeLimit,
  structuralDepthLimit,
  approvedGroupLimit: PSD_STRUCTURAL_APPROVED_GROUP_LIMIT,
  approvedLeafLimit: PSD_STRUCTURAL_APPROVED_LEAF_LIMIT,
  generatedNodeLimit: PSD_STRUCTURAL_GENERATED_NODE_LIMIT,
  totalRawRgbaByteLimit: PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT
});

const createCapIssues = (
  summary: ReturnType<typeof createSummary>,
  capPolicy: PsdStructuralScaffoldCapPolicyDto
): readonly PsdStructuralScaffoldIssueDto[] => {
  const issues: PsdStructuralScaffoldIssueDto[] = [];
  if (summary.sourceGroupCount + summary.sourceLayerCount > capPolicy.structuralNodeLimit) {
    issues.push(createIssue("structuralExpansionCapExceeded", "structuralNodeLimitExceeded", "PSD structural node count exceeds preview cap."));
  }
  if (summary.structuralDepth > capPolicy.structuralDepthLimit) {
    issues.push(createIssue("structuralExpansionCapExceeded", "structuralDepthLimitExceeded", "PSD structural depth exceeds preview cap."));
  }
  if (summary.approvedGroupCount > capPolicy.approvedGroupLimit) {
    issues.push(createIssue("structuralExpansionCapExceeded", "approvedGroupLimitExceeded", "Approved PSD group count exceeds execution cap."));
  }
  if (summary.approvedLeafCount > capPolicy.approvedLeafLimit) {
    issues.push(createIssue("structuralExpansionCapExceeded", "approvedLeafLimitExceeded", "Approved PSD leaf count exceeds execution cap."));
  }
  if (summary.generatedGroupPartCount + summary.generatedDrawableCount > capPolicy.generatedNodeLimit) {
    issues.push(createIssue("structuralExpansionCapExceeded", "generatedNodeLimitExceeded", "Generated structural node count exceeds execution cap."));
  }
  if ((summary.totalByteEstimate ?? 0) > capPolicy.totalRawRgbaByteLimit) {
    issues.push(createIssue("structuralExpansionCapExceeded", "totalRawRgbaByteLimitExceeded", "Approved PSD leaf byte estimate exceeds execution cap."));
  }

  return issues;
};

const createApprovalIssues = (input: {
  readonly approvalRequests: readonly string[];
  readonly adapterResult: PsdAdapterResultDto;
  readonly leavesInScope: readonly PsdAdapterSourceLayerDto[];
  readonly approvedLeafIds: ReadonlySet<string>;
  readonly leafDrafts: readonly LeafDraft[];
}): readonly PsdStructuralScaffoldIssueDto[] => {
  const issues: PsdStructuralScaffoldIssueDto[] = [];
  const knownRefs = new Set([
    rootScopeRef,
    ...input.adapterResult.sourceGroups.map((group) => group.sourceGroupId),
    ...input.adapterResult.sourceLayers.map((layer) => layer.sourceLayerId),
    ...createGroupNodeRefs(input.adapterResult).values()
  ]);

  for (const ref of input.approvalRequests) {
    if (!knownRefs.has(ref)) {
      issues.push(createIssue("structuralPlanStale", "approvalRefMissing", `Approved PSD structural ref is not present in parser evidence: ${ref}.`));
    }
  }

  for (const draft of input.leafDrafts) {
    if (input.approvedLeafIds.has(draft.layer.sourceLayerId) && draft.blocked) {
      issues.push({
        ...createIssue("structuralPlanStale", "approvedLeafBlocked", `Approved PSD leaf cannot be materialized: ${draft.layer.sourceLayerId}.`),
        sourceLayerRef: {
          sourceAssetId: SourceAssetIdSchema.parse(draft.sourceAssetId),
          sourceLayerId: draft.layer.sourceLayerId,
          sourceLayerName: draft.layer.originalName,
          sourceLayerPath: [...draft.layer.groupPath, draft.layer.originalName]
        },
        sourceOrder: draft.layer.sourceOrder
      });
    }
  }

  if (input.approvalRequests.length > 0 && input.approvedLeafIds.size === 0 && input.leavesInScope.length > 0) {
    issues.push(createIssue("structuralPlanStale", "approvalSelectionMismatch", "No positive-size PSD leaf in scope matched the approved structural refs."));
  }

  return issues;
};

const createIssue = (
  issueKind: PsdStructuralScaffoldIssueDto["issueKind"],
  checkId: string,
  message: string
): PsdStructuralScaffoldIssueDto => ({
  issueId: `issue_${sanitizeIdToken(checkId)}`,
  issueKind,
  checkId: `editor.psdStructuralScaffold.${checkId}`,
  message
});

const createPreviewNodes = (input: {
  readonly groupDrafts: readonly GroupDraft[];
  readonly leafDrafts: readonly LeafDraft[];
  readonly approvedLeafIds: ReadonlySet<string>;
  readonly approvalRequests: readonly string[];
  readonly requiredGroupIds: ReadonlySet<string>;
  readonly groupNodeRefs: ReadonlyMap<string, string>;
  readonly adapterResult: PsdAdapterResultDto;
}): readonly BrowserPsdStructuralScaffoldNodePreview[] => {
  const approvalSet = new Set(input.approvalRequests);
  const nodes: BrowserPsdStructuralScaffoldNodePreview[] = [
    ...input.groupDrafts.map((draft) => {
      const descendantLeaves = input.leafDrafts.filter((leaf) =>
        collectLayerGroupChain(input.adapterResult, leaf.layer).some(
          (group) => group.sourceGroupId === draft.group.sourceGroupId
        )
      );
      const hasEligibleLeaf = descendantLeaves.some((leaf) => !leaf.blocked);
      const nodeRef = draft.nodeRef;
      const groupNodeRef = input.groupNodeRefs.get(draft.group.sourceGroupId);
      const approved = input.requiredGroupIds.has(draft.group.sourceGroupId);

      return {
        nodeRef,
        kind: "group" as const,
        label: draft.group.originalName,
        fullPathLabel: draft.group.groupPath.join(" / ") || draft.group.originalName,
        sourceOrder: draft.group.sourceOrder,
        visibleInSource: draft.group.visibleInSource,
        opacityInSource: draft.group.opacityInSource,
        boundsLabel: formatBoundsLabel(draft.group.bounds),
        approvalEligible: hasEligibleLeaf,
        approved: approved || approvalSet.has(nodeRef) || (groupNodeRef !== undefined && approvalSet.has(groupNodeRef)),
        generatedParentPartId: draft.generatedParentPartId,
        generatedPartId: draft.generatedPartId,
        status: draft.blocked ? "blocked" as const : "previewReady" as const,
        statusReasons: draft.statusReasons
      };
    }),
    ...input.leafDrafts.map((draft) => ({
      nodeRef: draft.layer.sourceLayerId,
      kind: "leaf" as const,
      label: draft.layer.originalName,
      fullPathLabel: [...draft.layer.groupPath, draft.layer.originalName].join(" / ") || draft.layer.originalName,
      sourceOrder: draft.layer.sourceOrder,
      visibleInSource: draft.layer.visibleInSource,
      opacityInSource: draft.layer.opacityInSource,
      boundsLabel: formatBoundsLabel(draft.layer.bounds),
      approvalEligible: !draft.blocked,
      approved: input.approvedLeafIds.has(draft.layer.sourceLayerId) && !draft.blocked,
      generatedParentPartId: draft.generatedParentPartId,
      generatedDrawableId: draft.generatedDrawableId,
      generatedTextureId: draft.generatedTextureId,
      generatedMeshId: draft.generatedMeshId,
      initialRuntimeVisibility: draft.layer.visibleInSource,
      status: draft.blocked ? "blocked" as const : "previewReady" as const,
      statusReasons: draft.statusReasons
    }))
  ];

  return nodes.sort((left, right) => left.sourceOrder - right.sourceOrder);
};

const createDiagnostics = (input: {
  readonly blocked: boolean;
  readonly summary: ReturnType<typeof createSummary>;
  readonly issues: readonly PsdStructuralScaffoldIssueDto[];
  readonly approvedLeaves: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly approvalRequests: readonly string[];
  readonly destinationParentPartId: string;
}): readonly BrowserPsdStructuralScaffoldDiagnostic[] => {
  const diagnostics: BrowserPsdStructuralScaffoldDiagnostic[] = [{
    checkId: `browserPsdStructuralScaffold.plan.${input.blocked ? "blocked" : "ready"}`,
    severity: input.blocked ? "warning" : "info",
    message: "PSD structural scaffold preview was generated from current parser evidence.",
  }];
  if (input.destinationParentPartId.length === 0) {
    diagnostics.push({
      checkId: "browserPsdStructuralScaffold.destinationParentMissing",
      severity: "error",
      message: "Destination parent part is required for structural scaffold execution."
    });
  }
  if (input.approvalRequests.length === 0) {
    diagnostics.push({
      checkId: "browserPsdStructuralScaffold.explicitApprovalMissing",
      severity: "info",
      message: "No structural nodes are approved by default; execution requires explicit approval."
    });
  } else if (input.approvedLeaves.length === 0) {
    diagnostics.push({
      checkId: "browserPsdStructuralScaffold.approvedLeafMissing",
      severity: "warning",
      message: "Approved structural refs did not resolve to executable positive-size PSD leaves."
    });
  }

  return [
    ...diagnostics,
    ...input.issues.map((issue) => ({
      checkId: issue.checkId ?? issue.issueKind,
      severity: issue.issueKind === "structuralExpansionCapExceeded" ? "error" as const : "warning" as const,
      message: issue.message
    }))
  ];
};

const createCanonicalStructuralPlan = (input: {
  readonly structuralPlanId: string;
  readonly sourcePsd: CanonicalJsonValue;
  readonly parser: PsdAdapterResultDto["parser"];
  readonly scope: CanonicalJsonValue;
  readonly plannedGroups: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly plannedLeaves: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly summary: CanonicalJsonValue;
  readonly capPolicy: CanonicalJsonValue;
  readonly issues: readonly PsdStructuralScaffoldIssueDto[];
}): CanonicalJsonValue => ({
  structuralPlanId: input.structuralPlanId,
  sourcePsd: input.sourcePsd,
  parser: canonicalParser(input.parser),
  scope: input.scope,
  groups: input.plannedGroups.map(canonicalGroup),
  leaves: input.plannedLeaves.map(canonicalLeaf),
  summary: input.summary,
  capPolicy: input.capPolicy,
  issues: input.issues.map((issue) => ({
    issueKind: issue.issueKind,
    checkId: issue.checkId ?? null,
    message: issue.message,
    targetPath: issue.targetPath ?? null
  }))
});

const createCanonicalApprovalSelection = (input: {
  readonly structuralPlanDigest: BinaryAssetDigestDto;
  readonly destinationParentPartId: string;
  readonly approvedGroups: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly approvedLeaves: readonly PsdStructuralScaffoldLeafDrawableDto[];
}): CanonicalJsonValue => ({
  structuralPlanDigest: `${input.structuralPlanDigest.algorithm}:${input.structuralPlanDigest.hex}`,
  destinationParentPartId: input.destinationParentPartId,
  approvedGroups: input.approvedGroups.map(canonicalGroup),
  approvedLeaves: input.approvedLeaves.map(canonicalLeaf)
});

const canonicalScope = (scope: {
  readonly scopeRef: PsdStructuralScaffoldSourceNodeRefDto;
  readonly scopeDisplayPath: readonly string[];
  readonly discoveryMode: "explicitStructuralScaffoldPreview";
}): CanonicalJsonValue => ({
  scopeRef: {
    kind: scope.scopeRef.kind,
    id: scope.scopeRef.id ?? null,
    path: scope.scopeRef.path ?? null
  },
  scopeDisplayPath: scope.scopeDisplayPath,
  discoveryMode: scope.discoveryMode
});

const canonicalParser = (
  parser: PsdAdapterResultDto["parser"]
): CanonicalJsonValue =>
  parser === undefined
    ? null
    : {
        evidenceKind: parser.evidenceKind,
        parserName: parser.parserName,
        parserPackageName: parser.parserPackageName ?? null,
        parserVersion: parser.parserVersion ?? null,
        adapterName: parser.adapterName ?? null,
        adapterVersion: parser.adapterVersion ?? null,
        runtime: parser.runtime ?? null,
        privateShapePolicy: parser.privateShapePolicy
      };

const canonicalSourceGroupRef = (
  ref: PsdStructuralScaffoldSourceGroupReferenceDto | undefined
): CanonicalJsonValue =>
  ref === undefined
    ? null
    : {
        sourceAssetId: ref.sourceAssetId,
        sourceGroupId: ref.sourceGroupId,
        sourceGroupName: ref.sourceGroupName ?? null,
        sourceGroupPath: ref.sourceGroupPath ?? []
      };

const canonicalSourceLayerRef = (
  ref: PsdStructuralScaffoldLeafDrawableDto["sourceLayerRef"]
): CanonicalJsonValue => ({
  sourceAssetId: ref.sourceAssetId,
  sourceLayerId: ref.sourceLayerId,
  sourceLayerName: ref.sourceLayerName ?? null,
  sourceLayerPath: ref.sourceLayerPath ?? []
});

const canonicalGroup = (group: PsdStructuralScaffoldGroupPartDto): CanonicalJsonValue => ({
  sourceGroupRef: canonicalSourceGroupRef(group.sourceGroupRef),
  sourceParentGroupRef: canonicalSourceGroupRef(group.sourceParentGroupRef),
  sourceGroupName: group.sourceGroupName ?? null,
  sourceGroupPath: group.sourceGroupPath,
  sourceOrder: group.sourceOrder,
  visibleInSource: group.visibleInSource,
  opacityInSource: group.opacityInSource,
  bounds: group.bounds ?? null,
  generatedParentPartId: group.generatedParentPartId,
  generatedPartId: group.generatedPartId,
  generatedPartDisplayName: group.generatedPartDisplayName,
  status: group.status
});

const canonicalLeaf = (leaf: PsdStructuralScaffoldLeafDrawableDto): CanonicalJsonValue => ({
  sourceLayerRef: canonicalSourceLayerRef(leaf.sourceLayerRef),
  sourceParentGroupRef: canonicalSourceGroupRef(leaf.sourceParentGroupRef),
  sourceLayerName: leaf.sourceLayerName ?? null,
  sourceLayerPath: leaf.sourceLayerPath,
  sourceOrder: leaf.sourceOrder,
  visibleInSource: leaf.visibleInSource,
  opacityInSource: leaf.opacityInSource,
  bounds: leaf.bounds,
  byteEstimate: leaf.byteEstimate ?? null,
  generatedParentPartId: leaf.generatedParentPartId,
  generatedDrawableId: leaf.generatedDrawableId,
  generatedDrawableDisplayName: leaf.generatedDrawableDisplayName,
  generatedTextureId: leaf.generatedTextureId,
  generatedMeshId: leaf.generatedMeshId,
  initialRuntimeVisibility: leaf.initialRuntimeVisibility,
  status: leaf.status
});

const computeStructuralDigest = async (
  value: CanonicalJsonValue,
  label: string
): Promise<BinaryAssetDigestDto> => {
  const bytes = new TextEncoder().encode(stringifyCanonicalJson(value));
  const digestResult = await computePackageBinarySha256Digest(bytes);
  if (digestResult.status === "unsupported") {
    throw new Error(`Unable to compute PSD ${label} digest: ${digestResult.reason}`);
  }

  return {
    algorithm: "sha256",
    hex: digestResult.digest.hex
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

const collectLayerGroupChain = (
  adapterResult: PsdAdapterResultDto,
  layer: PsdAdapterSourceLayerDto
): readonly PsdAdapterSourceGroupDto[] => {
  const groupById = new Map(adapterResult.sourceGroups.map((group) => [group.sourceGroupId, group]));
  const chain: PsdAdapterSourceGroupDto[] = [];
  let parentGroupId = layer.parentGroupId;
  while (parentGroupId !== undefined) {
    const group = groupById.get(parentGroupId);
    if (group === undefined) {
      break;
    }
    chain.unshift(group);
    parentGroupId = group.parentGroupId;
  }

  return chain;
};

const collectGroupAncestorChain = (
  adapterResult: PsdAdapterResultDto,
  group: PsdAdapterSourceGroupDto
): readonly PsdAdapterSourceGroupDto[] => {
  const groupById = new Map(adapterResult.sourceGroups.map((candidate) => [
    candidate.sourceGroupId,
    candidate
  ]));
  const chain: PsdAdapterSourceGroupDto[] = [];
  let parentGroupId = group.parentGroupId;
  while (parentGroupId !== undefined) {
    const parent = groupById.get(parentGroupId);
    if (parent === undefined) {
      break;
    }
    chain.unshift(parent);
    parentGroupId = parent.parentGroupId;
  }

  return chain;
};

const createStructuralDepth = (
  groups: readonly PsdAdapterSourceGroupDto[],
  leaves: readonly PsdAdapterSourceLayerDto[]
): number =>
  Math.max(
    0,
    ...groups.map((group) => group.groupPath.length),
    ...leaves.map((leaf) => leaf.groupPath.length + 1)
  );

const requireGroupRef = (
  refs: ReadonlyMap<string, PsdStructuralScaffoldSourceGroupReferenceDto>,
  groupId: string
): PsdStructuralScaffoldSourceGroupReferenceDto => {
  const ref = refs.get(groupId);
  if (ref === undefined) {
    throw new Error(`PSD structural scaffold group ref is missing for ${groupId}.`);
  }

  return ref;
};

const createUniqueDisplayName = (input: {
  readonly preferred: string;
  readonly fallback: string;
  readonly sourceRef: string;
}): string => {
  const preferred = input.preferred.trim();
  if (preferred.length > 0) {
    return preferred;
  }
  const fallback = input.fallback.trim();
  if (fallback.length > 0) {
    return fallback;
  }

  return input.sourceRef;
};

const normalizePsdMediaType = (mediaType: string): string => {
  const normalized = mediaType.trim().toLowerCase();
  return normalized.length === 0 ? "application/octet-stream" : normalized;
};

const estimateRawRgbaBytes = (width: number, height: number): number =>
  Math.max(0, Math.floor(width)) * Math.max(0, Math.floor(height)) * 4;

const formatBoundsLabel = (
  bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined
): string =>
  bounds === undefined
    ? "bounds unavailable"
    : `${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`;

const sameStringArray = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const normalizeDisplayName = (value: string): string =>
  value.trim().toLowerCase();

const sanitizeIdToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "structural";
