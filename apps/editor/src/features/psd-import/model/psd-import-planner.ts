import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  TextureIdSchema,
  type PartId,
  type SourceAssetId
} from "@private-2d-rigging-lab/contracts";
import type {
  PsdAdapterSourceGroupDto,
  PsdAdapterSourceLayerDto,
  PsdStructuralScaffoldApprovalEvidenceDto,
  PsdStructuralScaffoldCapPolicyDto,
  PsdStructuralScaffoldGroupPartDto,
  PsdStructuralScaffoldIssueDto,
  PsdStructuralScaffoldLeafDrawableDto,
  PsdStructuralScaffoldPlanEvidenceDto,
  PsdStructuralScaffoldSourceGroupReferenceDto,
  PsdStructuralScaffoldSummaryDto
} from "@private-2d-rigging-lab/operation-core";

import {
  createPsdSourceAssetId,
  parsePsdForEditorImport
} from "../../../editor-workflow/browser-psd-parser-adapter";
import type {
  PsdImportDestination,
  PsdImportPlan,
  PsdImportReviewRow
} from "./psd-import-types";

export interface CreatePsdImportPlanInput {
  readonly fileName: string;
  readonly bytes: ArrayBuffer;
  readonly destination: PsdImportDestination;
  readonly packageRevision: number;
}

const STRUCTURAL_CAP_POLICY: PsdStructuralScaffoldCapPolicyDto = {
  structuralNodeLimit: 1024,
  structuralDepthLimit: 16,
  approvedGroupLimit: 128,
  approvedLeafLimit: 256,
  generatedNodeLimit: 512,
  totalRawRgbaByteLimit: 268435456
};

export async function createPsdImportPlan(
  input: CreatePsdImportPlanInput
): Promise<PsdImportPlan> {
  const token = createPlanToken(input.fileName, input.packageRevision);
  const importDisplayName = `${createDisplayBaseName(input.fileName)} import`;
  const sourceAssetId = createPsdSourceAssetId(token);
  const parsed = await parsePsdForEditorImport({
    bytes: input.bytes,
    fileName: input.fileName,
    importDisplayName,
    planToken: token,
    sourceAssetId,
    materializedLayerLimit: STRUCTURAL_CAP_POLICY.approvedLeafLimit
  });
  const materializedLayerIds = new Set(
    parsed.adapterResult.materializationEvidence?.map(
      (materialization) => materialization.sourceLayerRef.sourceLayerId
    ) ?? []
  );
  const plannedLayers = parsed.adapterResult.sourceLayers
    .filter((layer) => materializedLayerIds.has(layer.sourceLayerId));

  if (plannedLayers.length === 0) {
    throw new Error("No importable PSD layers were found.");
  }

  const groupsById = new Map(
    parsed.adapterResult.sourceGroups.map((group) => [group.sourceGroupId, group])
  );
  const approvedGroupIds = collectApprovedGroupIds(plannedLayers, groupsById);
  const groupPartIds = createGroupPartIdMap({
    groups: parsed.adapterResult.sourceGroups,
    approvedGroupIds,
    token
  });
  const groupScaffolds = parsed.adapterResult.sourceGroups
    .filter((group) => approvedGroupIds.has(group.sourceGroupId))
    .map((group) =>
      createGroupScaffold({
        group,
        groupsById,
        groupPartIds,
        destination: input.destination,
        sourceAssetId
      })
    );
  const leafDisplayNames = createUniqueLayerDisplayNames(plannedLayers);
  const leafScaffolds = plannedLayers.map((layer) =>
    createLeafScaffold({
      layer,
      groupsById,
      groupPartIds,
      generatedDisplayName:
        leafDisplayNames.get(layer.sourceLayerId) ?? createDisplayBaseName(layer.originalName),
      token,
      sourceAssetId
    })
  );
  const summary = createSummary({
    sourceGroupCount: parsed.adapterResult.sourceGroups.length,
    sourceLayerCount: parsed.adapterResult.sourceLayers.length,
    groupScaffolds,
    leafScaffolds
  });
  const editorHiddenPartIds = createEditorHiddenPartIds(groupScaffolds);
  const planDigest = await sha256Text(`plan:${token}:${parsed.sourceDigest.hex}`);
  const approvalDigest = await sha256Text(`approval:${token}:${plannedLayers.map((layer) => layer.sourceLayerId).join("|")}`);
  const sourcePsd = {
    sourceAssetId,
    sourceFilePath: parsed.sourceFilePath,
    digest: parsed.sourceDigest,
    byteLength: parsed.sourceByteLength,
    mediaType: "image/vnd.adobe.photoshop",
    sourceBytePersistence: "metadataOnlyNoRawBytes",
    publicDemoAsset: false
  } as const;
  const structuralPlan: PsdStructuralScaffoldPlanEvidenceDto = {
    schemaVersion: "psd-structural-scaffold-plan-evidence-v1",
    evidenceKind: "psd-structural-scaffold-plan-evidence-v1",
    structuralPlanId: `plan_${token}`,
    structuralPlanDigest: planDigest,
    sourcePsd,
    parser: parsed.adapterResult.parser,
    scope: {
      scopeRef: { kind: "document", id: "psd:root" },
      scopeDisplayPath: [],
      discoveryMode: "explicitStructuralScaffoldPreview"
    },
    plannedGroupPartScaffolds: groupScaffolds,
    plannedLeafScaffolds: leafScaffolds,
    summary,
    capPolicy: STRUCTURAL_CAP_POLICY,
    issues: [],
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
  };
  const approval: PsdStructuralScaffoldApprovalEvidenceDto = {
    schemaVersion: "psd-structural-scaffold-approval-evidence-v1",
    evidenceKind: "psd-structural-scaffold-approval-evidence-v1",
    approvalId: `approval_${token}`,
    structuralPlanDigest: planDigest,
    approvalSelectionDigest: approvalDigest,
    sourcePsd,
    destination: {
      destinationKind: "structuralScaffold",
      parentPartId: input.destination.parentPartId
    },
    approvalStatus: "approved",
    approvedGroupPartScaffolds: groupScaffolds.map(approveGroupScaffold),
    approvedLeafScaffolds: leafScaffolds.map(approveLeafScaffold),
    summary,
    capPolicy: STRUCTURAL_CAP_POLICY,
    issues: [],
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
  };
  const issues: PsdStructuralScaffoldIssueDto[] = [];
  const reviewRows = createReviewRows({
    groups: groupScaffolds,
    leaves: leafScaffolds,
    issues
  });

  return {
    token,
    fileName: input.fileName,
    sourceAssetId,
    sourceFilePath: parsed.sourceFilePath,
    sourceContentHash: `sha256:${parsed.sourceDigest.hex}`,
    adapterResult: parsed.adapterResult,
    materializedLayerBytes: parsed.materializedLayerBytes,
    bridge: {
      schemaVersion: "psd-structural-scaffold-approval-bridge-evidence-v1",
      structuralPlan,
      approval
    },
    capPolicy: STRUCTURAL_CAP_POLICY,
    destination: input.destination,
    importRootPartId: groupPartIds.get("psd:root") ?? input.destination.parentPartId,
    editorHiddenPartIds,
    reviewRows,
    hasIssues: reviewRows.some((row) => row.hasIssue),
    issues
  };
}

function collectApprovedGroupIds(
  layers: readonly PsdAdapterSourceLayerDto[],
  groupsById: ReadonlyMap<string, PsdAdapterSourceGroupDto>
): ReadonlySet<string> {
  const groupIds = new Set<string>();

  for (const layer of layers) {
    let parentGroupId = layer.parentGroupId;
    while (parentGroupId !== undefined && !groupIds.has(parentGroupId)) {
      groupIds.add(parentGroupId);
      parentGroupId = groupsById.get(parentGroupId)?.parentGroupId;
    }
  }

  return groupIds;
}

function createGroupPartIdMap(input: {
  readonly groups: readonly PsdAdapterSourceGroupDto[];
  readonly approvedGroupIds: ReadonlySet<string>;
  readonly token: string;
}): ReadonlyMap<string, PartId> {
  const groupPartIds = new Map<string, PartId>();

  for (const group of input.groups) {
    if (!input.approvedGroupIds.has(group.sourceGroupId)) {
      continue;
    }

    const idToken =
      group.sourceGroupId === "psd:root"
        ? `import_${input.token}`
        : `${input.token}_${shortHash(group.sourceGroupId)}_${sanitizeIdToken(group.originalName)}`;
    groupPartIds.set(group.sourceGroupId, PartIdSchema.parse(`part_${idToken}`));
  }

  return groupPartIds;
}

function createGroupScaffold(input: {
  readonly group: PsdAdapterSourceGroupDto;
  readonly groupsById: ReadonlyMap<string, PsdAdapterSourceGroupDto>;
  readonly groupPartIds: ReadonlyMap<string, PartId>;
  readonly destination: PsdImportDestination;
  readonly sourceAssetId: SourceAssetId;
}): PsdStructuralScaffoldGroupPartDto {
  const parentGroup =
    input.group.parentGroupId === undefined
      ? undefined
      : input.groupsById.get(input.group.parentGroupId);
  const generatedPartId = input.groupPartIds.get(input.group.sourceGroupId);
  if (generatedPartId === undefined) {
    throw new Error(`Missing generated part ID for ${input.group.sourceGroupId}.`);
  }
  const generatedParentPartId =
    parentGroup === undefined
      ? input.destination.parentPartId
      : input.groupPartIds.get(parentGroup.sourceGroupId);
  if (generatedParentPartId === undefined) {
    throw new Error(`Missing generated parent part ID for ${input.group.sourceGroupId}.`);
  }

  return {
    scaffoldKind: "groupPartContainer",
    sourceGroupRef: createGroupRef(input.group, input.sourceAssetId),
    ...(parentGroup === undefined
      ? {}
      : { sourceParentGroupRef: createGroupRef(parentGroup, input.sourceAssetId) }),
    sourceGroupName: input.group.originalName,
    sourceGroupPath: [...input.group.groupPath],
    sourceOrder: input.group.sourceOrder,
    visibleInSource: input.group.visibleInSource,
    ...(input.group.localVisibleInSource === undefined
      ? {}
      : { localVisibleInSource: input.group.localVisibleInSource }),
    ...(input.group.effectiveVisibleInSource === undefined
      ? {}
      : { effectiveVisibleInSource: input.group.effectiveVisibleInSource }),
    opacityInSource: input.group.opacityInSource,
    ...(input.group.bounds === undefined ? {} : { bounds: input.group.bounds }),
    generatedParentPartId,
    generatedPartId,
    generatedPartDisplayName: input.group.originalName,
    status: "previewReady",
    statusReasons: []
  };
}

function createLeafScaffold(input: {
  readonly layer: PsdAdapterSourceLayerDto;
  readonly groupsById: ReadonlyMap<string, PsdAdapterSourceGroupDto>;
  readonly groupPartIds: ReadonlyMap<string, PartId>;
  readonly generatedDisplayName: string;
  readonly token: string;
  readonly sourceAssetId: SourceAssetId;
}): PsdStructuralScaffoldLeafDrawableDto {
  const parentGroup = input.groupsById.get(input.layer.parentGroupId ?? "");
  const generatedParentPartId =
    parentGroup === undefined ? undefined : input.groupPartIds.get(parentGroup.sourceGroupId);
  if (parentGroup === undefined || generatedParentPartId === undefined) {
    throw new Error(`Missing generated leaf parent for ${input.layer.sourceLayerId}.`);
  }
  const leafToken = `${input.token}_${shortHash(input.layer.sourceLayerId)}_${sanitizeIdToken(input.layer.originalName)}`;

  return {
    scaffoldKind: "leafDrawableScaffold",
    sourceLayerRef: {
      sourceAssetId: input.sourceAssetId,
      sourceLayerId: input.layer.sourceLayerId,
      sourceLayerName: input.layer.originalName,
      sourceLayerPath: [...input.layer.groupPath, input.layer.originalName]
    },
    sourceParentGroupRef: createGroupRef(parentGroup, input.sourceAssetId),
    sourceLayerName: input.layer.originalName,
    sourceLayerPath: [...input.layer.groupPath, input.layer.originalName],
    sourceOrder: input.layer.sourceOrder,
    visibleInSource: input.layer.visibleInSource,
    ...(input.layer.localVisibleInSource === undefined
      ? {}
      : { localVisibleInSource: input.layer.localVisibleInSource }),
    ...(input.layer.effectiveVisibleInSource === undefined
      ? {}
      : { effectiveVisibleInSource: input.layer.effectiveVisibleInSource }),
    opacityInSource: input.layer.opacityInSource,
    bounds: input.layer.bounds,
    byteEstimate: input.layer.bounds.width * input.layer.bounds.height * 4,
    generatedParentPartId,
    generatedDrawableId: DrawableIdSchema.parse(`draw_${leafToken}`),
    generatedDrawableDisplayName: input.generatedDisplayName,
    generatedTextureId: TextureIdSchema.parse(`tex_${leafToken}`),
    generatedMeshId: MeshIdSchema.parse(`mesh_${leafToken}`),
    initialRuntimeVisibility: isSourceLocallyVisible(input.layer),
    status: "previewReady",
    statusReasons: []
  };
}

function createUniqueLayerDisplayNames(
  layers: readonly PsdAdapterSourceLayerDto[]
): ReadonlyMap<string, string> {
  const used = new Set<string>();
  const result = new Map<string, string>();

  for (const layer of layers) {
    const baseName = createDisplayBaseName(layer.originalName);
    let candidate = baseName;
    let suffix = 2;

    while (used.has(normalizeDisplayName(candidate))) {
      candidate = `${baseName} ${suffix}`;
      suffix += 1;
    }

    used.add(normalizeDisplayName(candidate));
    result.set(layer.sourceLayerId, candidate);
  }

  return result;
}

function createReviewRows(input: {
  readonly groups: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly leaves: readonly PsdStructuralScaffoldLeafDrawableDto[];
  readonly issues: readonly PsdStructuralScaffoldIssueDto[];
}): readonly PsdImportReviewRow[] {
  const groupsByParent = new Map<string, PsdStructuralScaffoldGroupPartDto[]>();
  const leavesByParent = new Map<string, PsdStructuralScaffoldLeafDrawableDto[]>();
  const issuesBySourceGroupId = new Map<string, PsdStructuralScaffoldIssueDto>();
  const issuesBySourceLayerId = new Map<string, PsdStructuralScaffoldIssueDto>();

  for (const issue of input.issues) {
    if (issue.sourceGroupRef !== undefined) {
      issuesBySourceGroupId.set(issue.sourceGroupRef.sourceGroupId, issue);
    }

    if (issue.sourceLayerRef !== undefined) {
      issuesBySourceLayerId.set(issue.sourceLayerRef.sourceLayerId, issue);
    }
  }

  for (const group of input.groups) {
    const parentId = group.sourceParentGroupRef?.sourceGroupId ?? "";
    groupsByParent.set(parentId, [...(groupsByParent.get(parentId) ?? []), group]);
  }

  for (const leaf of input.leaves) {
    const parentId = leaf.sourceParentGroupRef?.sourceGroupId ?? "";
    leavesByParent.set(parentId, [...(leavesByParent.get(parentId) ?? []), leaf]);
  }

  const rows: PsdImportReviewRow[] = [];
  const appendGroup = (group: PsdStructuralScaffoldGroupPartDto, depth: number) => {
    rows.push({
      id: group.generatedPartId,
      depth,
      kind: "Part Container",
      name: group.generatedPartDisplayName,
      localVisibleInSource: isSourceLocallyVisible(group),
      effectiveVisibleInSource: isSourceEffectivelyVisible(group),
      ...createVisibilityProjection("group", group),
      ...createIssueProjection(
        group.status,
        group.statusReasons,
        issuesBySourceGroupId.get(group.sourceGroupRef.sourceGroupId)
      )
    });

    const childGroups = [...(groupsByParent.get(group.sourceGroupRef.sourceGroupId) ?? [])].sort(
      compareGroupOrder
    );
    const childLeaves = [...(leavesByParent.get(group.sourceGroupRef.sourceGroupId) ?? [])].sort(
      compareLeafOrder
    );
    const children = [
      ...childGroups.map((child) => ({ kind: "group" as const, value: child })),
      ...childLeaves.map((child) => ({ kind: "leaf" as const, value: child }))
    ].sort((left, right) => {
      const leftOrder = left.value.sourceOrder;
      const rightOrder = right.value.sourceOrder;
      return leftOrder === rightOrder ? left.value.generatedParentPartId.localeCompare(right.value.generatedParentPartId) : leftOrder - rightOrder;
    });

    for (const child of children) {
      if (child.kind === "group") {
        appendGroup(child.value, depth + 1);
        continue;
      }

      rows.push({
        id: child.value.generatedDrawableId,
        depth: depth + 1,
        kind: child.value.initialRuntimeVisibility ? "Drawable" : "Hidden Drawable",
        name: child.value.generatedDrawableDisplayName,
        localVisibleInSource: isSourceLocallyVisible(child.value),
        effectiveVisibleInSource: isSourceEffectivelyVisible(child.value),
        ...createVisibilityProjection("leaf", child.value),
        ...createIssueProjection(
          child.value.status,
          child.value.statusReasons,
          issuesBySourceLayerId.get(child.value.sourceLayerRef.sourceLayerId)
        )
      });
    }
  };

  for (const rootGroup of [...(groupsByParent.get("") ?? [])].sort(compareGroupOrder)) {
    appendGroup(rootGroup, 0);
  }

  return rows;
}

function createIssueProjection(
  status: PsdStructuralScaffoldGroupPartDto["status"],
  statusReasons: readonly string[],
  issue: PsdStructuralScaffoldIssueDto | undefined
): Pick<PsdImportReviewRow, "hasIssue" | "issueTooltip"> {
  const hasIssue =
    status !== "previewReady" &&
    status !== "approved" &&
    status !== "resolved" ||
    statusReasons.length > 0 ||
    issue !== undefined;

  return {
    hasIssue,
    ...(hasIssue
      ? {
          issueTooltip:
            statusReasons.length > 0
              ? statusReasons.join("; ")
              : issue?.message !== undefined
                ? issue.message
              : "This row needs attention before import."
        }
      : {})
  };
}

function createVisibilityProjection(
  kind: "group" | "leaf",
  source: {
    readonly visibleInSource: boolean;
    readonly localVisibleInSource?: boolean | undefined;
    readonly effectiveVisibleInSource?: boolean | undefined;
  }
): Pick<PsdImportReviewRow, "visibilityLabel"> {
  const localVisible = isSourceLocallyVisible(source);
  if (!localVisible) {
    return {
      visibilityLabel: kind === "group" ? "Hidden Part Container" : "Layer hidden in PSD"
    };
  }

  return isSourceEffectivelyVisible(source)
    ? {}
    : {
        visibilityLabel: "Hidden by parent group"
      };
}

function createGroupRef(
  group: PsdAdapterSourceGroupDto,
  sourceAssetId: SourceAssetId
): PsdStructuralScaffoldSourceGroupReferenceDto {
  return {
    sourceAssetId,
    sourceGroupId: group.sourceGroupId,
    sourceGroupName: group.originalName,
    sourceGroupPath: [...group.groupPath]
  };
}

function approveGroupScaffold(
  group: PsdStructuralScaffoldGroupPartDto
): PsdStructuralScaffoldGroupPartDto {
  return {
    ...group,
    status: "approved",
    statusReasons: []
  };
}

function approveLeafScaffold(
  leaf: PsdStructuralScaffoldLeafDrawableDto
): PsdStructuralScaffoldLeafDrawableDto {
  return {
    ...leaf,
    status: "approved",
    statusReasons: []
  };
}

function createSummary(input: {
  readonly sourceGroupCount: number;
  readonly sourceLayerCount: number;
  readonly groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[];
  readonly leafScaffolds: readonly PsdStructuralScaffoldLeafDrawableDto[];
}): PsdStructuralScaffoldSummaryDto {
  const hiddenLeafCount = input.leafScaffolds.filter((leaf) => !isSourceLocallyVisible(leaf)).length;
  const runtimeHiddenDrawableCount = input.leafScaffolds.filter(
    (leaf) => !leaf.initialRuntimeVisibility
  ).length;

  return {
    sourceGroupCount: input.sourceGroupCount,
    sourceLayerCount: input.sourceLayerCount,
    approvedGroupCount: input.groupScaffolds.length,
    approvedLeafCount: input.leafScaffolds.length,
    generatedGroupPartCount: input.groupScaffolds.length,
    generatedDrawableCount: input.leafScaffolds.length,
    hiddenLeafCount,
    runtimeHiddenDrawableCount,
    structuralDepth: Math.max(0, ...input.groupScaffolds.map((group) => group.sourceGroupPath.length)),
    totalByteEstimate: input.leafScaffolds.reduce(
      (total, leaf) => total + (leaf.byteEstimate ?? 0),
      0
    )
  };
}

function createEditorHiddenPartIds(
  groupScaffolds: readonly PsdStructuralScaffoldGroupPartDto[]
): readonly PartId[] {
  return groupScaffolds
    .filter((group) => !isSourceLocallyVisible(group))
    .map((group) => group.generatedPartId);
}

function isSourceLocallyVisible(source: {
  readonly visibleInSource: boolean;
  readonly localVisibleInSource?: boolean | undefined;
}): boolean {
  return source.localVisibleInSource ?? source.visibleInSource;
}

function isSourceEffectivelyVisible(source: {
  readonly visibleInSource: boolean;
  readonly effectiveVisibleInSource?: boolean | undefined;
}): boolean {
  return source.effectiveVisibleInSource ?? source.visibleInSource;
}

function compareGroupOrder(
  left: PsdStructuralScaffoldGroupPartDto,
  right: PsdStructuralScaffoldGroupPartDto
): number {
  return left.sourceOrder === right.sourceOrder
    ? left.sourceGroupRef.sourceGroupId.localeCompare(right.sourceGroupRef.sourceGroupId)
    : left.sourceOrder - right.sourceOrder;
}

function compareLeafOrder(
  left: PsdStructuralScaffoldLeafDrawableDto,
  right: PsdStructuralScaffoldLeafDrawableDto
): number {
  return left.sourceOrder === right.sourceOrder
    ? left.sourceLayerRef.sourceLayerId.localeCompare(right.sourceLayerRef.sourceLayerId)
    : left.sourceOrder - right.sourceOrder;
}

async function sha256Text(value: string): Promise<{ readonly algorithm: "sha256"; readonly hex: string }> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return {
    algorithm: "sha256",
    hex: [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  };
}

function createPlanToken(fileName: string, packageRevision: number): string {
  const baseName = createDisplayBaseName(fileName);
  return sanitizeIdToken(`${baseName}_r${packageRevision}_${shortHash(fileName)}`);
}

function createDisplayBaseName(fileName: string): string {
  const trimmed = fileName.trim().replace(/\.[^.]+$/, "");
  return trimmed.length > 0 ? trimmed : "PSD";
}

function normalizeDisplayName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function shortHash(value: string): string {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }

  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

function sanitizeIdToken(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
}
