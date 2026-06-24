import {
  applyTextureAtlasPreview,
  createDryRunAuthoringSession,
  createTextureAtlasPreview,
  type ApplyTextureAtlasPreviewResult,
  type AuthoringSession,
  type BinaryAssetReferenceDto,
  type TextureAtlasLayoutSummaryDto,
  type TextureAtlasWarning
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  TargetRefDto,
  TextureId
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
import { createLockedTargetDiagnostics } from "./locked-targets.js";
import { toModelDiffJsonValue } from "./model-diff-json-value.js";

type ApplyTextureAtlasPreviewRequest = Extract<
  OperationRequestDto,
  { operationType: "applyTextureAtlasPreview" }
>;

type AppliedTextureAtlasResult = Extract<
  ApplyTextureAtlasPreviewResult,
  { readonly status: "applied" }
>;
type TextureAtlasEntryDto = AppliedTextureAtlasResult["textureEntry"];

export const applyTextureAtlasPreviewOperationHandler: OperationHandler = {
  operationType: "applyTextureAtlasPreview",

  dryRun(session, request, operationId) {
    return rejectSyncAtlasLifecycle(session, request, operationId, "dryRunOperationAsync");
  },

  async dryRunAsync(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyTextureAtlasPreviewOperation(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return rejectSyncAtlasLifecycle(session, request, operationId, "commitOperationAsync");
  },

  async commitAsync(session, request, operationId) {
    return applyTextureAtlasPreviewOperation(session, request, operationId, "committed");
  }
};

const applyTextureAtlasPreviewOperation = async (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): Promise<OperationApplyOutcome> => {
  if (request.operationType !== "applyTextureAtlasPreview") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.applyTextureAtlasPreview.unsupportedPayload",
            message: `applyTextureAtlasPreview handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const checkedTargetRefs = createCheckedTargetRefs(session, request);
  const targetIds = checkedTargetRefs.map((target) => target.id);
  const preconditionDiagnostics = evaluatePayloadPreconditions(request, checkedTargetRefs);
  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: preconditionDiagnostics
      }),
      targetIds,
      candidateSession: session
    };
  }

  const recreatedPreview = createTextureAtlasPreview(session, {
    algorithmId: request.payload.settings.algorithmId,
    atlasTextureId: request.payload.expectedLayoutSummary.atlasTextureId,
    editorHiddenPartIds: request.payload.editorHiddenPartIds,
    pageWidth: request.payload.settings.pageWidth,
    pageHeight: request.payload.settings.pageHeight,
    paddingPixels: request.payload.settings.paddingPixels,
    edgeExtrusionEnabled: request.payload.settings.edgeExtrusion.enabled,
    edgeExtrusionPixels: request.payload.settings.edgeExtrusion.pixels
  });

  if (recreatedPreview.status !== "ready") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.applyTextureAtlasPreview.previewNotReady",
            message: "Texture Atlas Apply requires the current session to produce a ready preview.",
            target: createLayoutTarget(request.payload.expectedLayoutSummary.atlasTextureId),
            evidence: recreatedPreview.warnings.map(formatWarningEvidence)
          }),
          ...recreatedPreview.warnings.map(textureAtlasWarningToDiagnostic)
        ]
      }),
      targetIds,
      candidateSession: session
    };
  }

  if (!sameLayoutSummary(recreatedPreview.layoutSummary, request.payload.expectedLayoutSummary)) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.applyTextureAtlasPreview.layoutMismatch",
            message: "Texture Atlas Apply rejected a stale preview layout.",
            target: createLayoutTarget(request.payload.expectedLayoutSummary.atlasTextureId),
            evidence: [
              `expected=${summarizeLayout(request.payload.expectedLayoutSummary)}`,
              `actual=${summarizeLayout(recreatedPreview.layoutSummary)}`
            ]
          })
        ]
      }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const textureEntryBefore = findTextureEntry(session, request.payload.expectedLayoutSummary.atlasTextureId);
  const layoutSummaryBefore = session.graph.textureAtlas?.layoutSummary;
  const binaryAssetBefore = findBinaryAssetSummary(
    session,
    generatedAtlasPackageRelativePath(request.payload.expectedLayoutSummary.atlasTextureId)
  );
  const applied = await applyTextureAtlasPreview(session, {
    preview: recreatedPreview,
    operationId,
    freshnessValidation: {
      status: "validated-current-session",
      layoutSummary: recreatedPreview.layoutSummary
    }
  });

  if (applied.status !== "applied") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: applied.warnings.map(textureAtlasWarningToDiagnostic)
      }),
      targetIds,
      candidateSession: session
    };
  }

  return {
    result: createApplyTextureAtlasPreviewResult({
      operationId,
      status,
      baseRevision,
      applied,
      checkedTargetRefs,
      binaryAssetBefore,
      ...(textureEntryBefore === undefined ? {} : { textureEntryBefore }),
      ...(layoutSummaryBefore === undefined ? {} : { layoutSummaryBefore })
    }),
    targetIds,
    candidateSession: session
  };
};

const rejectSyncAtlasLifecycle = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  requiredLifecycle: "dryRunOperationAsync" | "commitOperationAsync"
): OperationApplyOutcome => ({
  result: createRejectedOperationResult({
    operationId,
    diagnostics: [
      createOperationDiagnostic({
        checkId: "operation.applyTextureAtlasPreview.asyncLifecycleRequired",
        message:
          `Texture Atlas Apply generates a SHA-256 binary digest asynchronously; use ${requiredLifecycle}.`,
        target: {
          kind: "operation",
          id: operationId,
          path: `/operationTypes/${request.operationType}`
        }
      })
    ]
  }),
  targetIds: [],
  candidateSession: session
});

const evaluatePayloadPreconditions = (
  request: ApplyTextureAtlasPreviewRequest,
  checkedTargetRefs: readonly TargetRefDto[]
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "applyTextureAtlasPreview",
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: checkedTargetRefs
    })
  ];

  if (!sameJson(request.payload.settings, request.payload.expectedLayoutSummary.settings)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.applyTextureAtlasPreview.settingsMismatch",
        message: "Texture Atlas Apply payload settings must match the expected layout summary settings.",
        target: createLayoutTarget(request.payload.expectedLayoutSummary.atlasTextureId),
        evidence: [
          `settings=${JSON.stringify(request.payload.settings)}`,
          `layoutSettings=${JSON.stringify(request.payload.expectedLayoutSummary.settings)}`
        ]
      })
    );
  }

  return diagnostics;
};

const createApplyTextureAtlasPreviewResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly applied: AppliedTextureAtlasResult;
  readonly checkedTargetRefs: readonly TargetRefDto[];
  readonly textureEntryBefore?: TextureAtlasEntryDto;
  readonly layoutSummaryBefore?: TextureAtlasLayoutSummaryDto;
  readonly binaryAssetBefore: BinaryAssetDiffValue | null;
}): OperationResultDto => {
  const textureTarget = createTextureTarget(input.applied.textureEntry.textureId);
  const textureFields = [
    {
      path: `/assets/textureAtlas/textures/${input.applied.textureEntry.textureId}`,
      before: input.textureEntryBefore === undefined
        ? null
        : toModelDiffJsonValue(input.textureEntryBefore),
      after: toModelDiffJsonValue(input.applied.textureEntry)
    },
    {
      path: "/assets/textureAtlas/layoutSummary",
      before: input.layoutSummaryBefore === undefined
        ? null
        : toModelDiffJsonValue(input.layoutSummaryBefore),
      after: toModelDiffJsonValue(input.applied.layoutSummary)
    },
    ...(input.applied.textureEntry.binaryAssetRef === undefined
      ? []
      : [
          {
            path: `/binaryAssets/${input.applied.textureEntry.binaryAssetRef.packageRelativePath}`,
            before: input.binaryAssetBefore === null
              ? null
              : toModelDiffJsonValue(input.binaryAssetBefore),
            after: toModelDiffJsonValue(
              createBinaryAssetDiffValue(input.applied.textureEntry.binaryAssetRef)
            )
          }
        ])
  ];
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.applied.authoringRevision,
    added: input.textureEntryBefore === undefined ? [textureTarget] : [],
    removed: [],
    changed: [
      {
        target: textureTarget,
        fields: textureFields
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], input.checkedTargetRefs),
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

const createCheckedTargetRefs = (
  session: AuthoringSession,
  request: ApplyTextureAtlasPreviewRequest
): readonly TargetRefDto[] => {
  const layout = request.payload.expectedLayoutSummary;
  const page = layout.pages[0];

  return uniqueTargetRefs([
    { kind: "package", id: session.packageIdentity.packageId },
    createLayoutTarget(layout.atlasTextureId),
    createTextureTarget(layout.atlasTextureId),
    ...(page?.placements ?? []).flatMap((placement) => [
      createDrawableTarget(placement.drawableId),
      createMeshTarget(placement.meshId),
      createTextureTarget(placement.originalTextureId)
    ])
  ]);
};

const textureAtlasWarningToDiagnostic = (warning: TextureAtlasWarning): DiagnosticDto =>
  createOperationDiagnostic({
    checkId: `operation.applyTextureAtlasPreview.${warningCodeSuffix(warning.code)}`,
    message: warning.message,
    target: warningToTargetRef(warning),
    severity: warning.severity,
    evidence: warning.details
  });

const warningToTargetRef = (warning: TextureAtlasWarning): TargetRefDto => {
  if (warning.drawableId !== undefined) {
    return { kind: "drawable", id: warning.drawableId, path: warning.targetPath };
  }

  if (warning.meshId !== undefined) {
    return { kind: "mesh", id: warning.meshId, path: warning.targetPath };
  }

  if (warning.textureId !== undefined) {
    return { kind: "texture", id: warning.textureId, path: warning.targetPath };
  }

  return {
    kind: "package",
    id: "texture-atlas",
    path: warning.targetPath
  };
};

const warningCodeSuffix = (code: string): string => {
  const suffix = code.split(".").at(-1) ?? "warning";

  return suffix.replace(/^[^a-z]+/, "") || "warning";
};

const sameLayoutSummary = (
  left: TextureAtlasLayoutSummaryDto,
  right: TextureAtlasLayoutSummaryDto
): boolean =>
  sameJson(normalizeLayoutForComparison(left), normalizeLayoutForComparison(right));

const normalizeLayoutForComparison = (
  layout: TextureAtlasLayoutSummaryDto
): TextureAtlasLayoutSummaryDto => {
  const normalized = structuredClone(layout);
  delete normalized.generatedByOperationId;

  return normalized;
};

const summarizeLayout = (layout: TextureAtlasLayoutSummaryDto): string => {
  const page = layout.pages[0];

  return JSON.stringify({
    layoutId: layout.layoutId,
    atlasTextureId: layout.atlasTextureId,
    sourceSignatureDigest: layout.sourceSignature?.digest ?? null,
    settings: layout.settings,
    placements: page?.placements.map((placement) => ({
      placementId: placement.placementId,
      drawableId: placement.drawableId,
      meshId: placement.meshId,
      originalTextureId: placement.originalTextureId,
      contentRectPixels: placement.contentRectPixels,
      paddedRectPixels: placement.paddedRectPixels
    })) ?? []
  });
};

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const formatWarningEvidence = (warning: TextureAtlasWarning): string =>
  [
    `code=${warning.code}`,
    `targetPath=${warning.targetPath}`,
    `message=${warning.message}`
  ].join(";");

const findTextureEntry = (
  session: AuthoringSession,
  textureId: TextureId
): TextureAtlasEntryDto | undefined =>
  session.graph.textureAtlas?.textures.find((texture) => texture.textureId === textureId);

type BinaryAssetDiffValue = {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly digest: BinaryAssetReferenceDto["digest"];
  readonly byteLength: number;
  readonly mediaType: string;
  readonly storageStatus: BinaryAssetReferenceDto["storageStatus"];
};

const findBinaryAssetSummary = (
  session: AuthoringSession,
  packageRelativePath: string
): BinaryAssetDiffValue | null => {
  const entry = session.binaryAssets?.binaryAssetIndex.assets.find(
    (asset) => asset.packageRelativePath === packageRelativePath
  );

  return entry === undefined
    ? null
    : createBinaryAssetDiffValue({
        binaryAssetId: entry.binaryAssetId,
        packageRelativePath: entry.packageRelativePath,
        digest: entry.digest,
        byteLength: entry.byteLength,
        mediaType: entry.mediaType,
        storageStatus: entry.storageStatus
      } as BinaryAssetReferenceDto);
};

const createBinaryAssetDiffValue = (
  binaryAssetRef: Pick<
    BinaryAssetReferenceDto,
    "binaryAssetId" | "packageRelativePath" | "digest" | "byteLength" | "mediaType" | "storageStatus"
  >
): BinaryAssetDiffValue => ({
  binaryAssetId: binaryAssetRef.binaryAssetId,
  packageRelativePath: binaryAssetRef.packageRelativePath,
  digest: binaryAssetRef.digest,
  byteLength: binaryAssetRef.byteLength,
  mediaType: binaryAssetRef.mediaType,
  storageStatus: binaryAssetRef.storageStatus
});

const generatedAtlasPackageRelativePath = (textureId: TextureId): string =>
  `assets/textures/${stripTexturePrefix(textureId)}.raw-rgba`;

const createLayoutTarget = (textureId: TextureId): TargetRefDto => ({
  kind: "texture",
  id: textureId,
  path: "/assets/textureAtlas/layoutSummary"
});

const createTextureTarget = (textureId: string): TargetRefDto => ({
  kind: "texture",
  id: textureId
});

const createDrawableTarget = (drawableId: string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

const createMeshTarget = (meshId: string): TargetRefDto => ({
  kind: "mesh",
  id: meshId
});

const uniqueTargetRefs = (targetRefs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];

  for (const targetRef of targetRefs) {
    const key = `${targetRef.kind}:${targetRef.id}:${targetRef.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(targetRef);
  }

  return unique;
};

const stripTexturePrefix = (textureId: string): string =>
  textureId.startsWith("tex_") ? textureId.slice("tex_".length) : textureId;
