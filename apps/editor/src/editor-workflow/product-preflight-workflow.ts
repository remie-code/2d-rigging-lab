import type {
  BinaryAssetReferenceDto,
  PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import {
  BinaryAssetReferenceSchema,
  createByteAvailabilityProductPreflightEvidence,
  createTransportCapabilityProductPreflightEvidence,
  evaluatePackageBinaryCurrentSessionByteAvailability,
  evaluatePackageTransportBoundary,
  verifyPackageBinaryAssetBytes
} from "@private-2d-rigging-lab/package-format";
import {
  createViewerRuntimeProductPreflightEvidence,
  defaultRuntimeEvaluationOptions
} from "@private-2d-rigging-lab/runtime-core";
import {
  ProductPreflightEvidenceRefDtoSchema,
  type ProductPreflightCategoryDto,
  type ProductPreflightEvidenceRefDto,
  type ProductPreflightReportDto
} from "@private-2d-rigging-lab/contracts";
import {
  buildTutorialMiniModelReadinessReport,
  buildProductPreflightReport,
  CANONICAL_OPERATION_LOG_PATH,
  validatePackageRuntimeWithBinaryAssets,
  type ProductPreflightCategoryEvidenceRefsInput,
  type ValidationReportDto
} from "@private-2d-rigging-lab/validator-core";

import {
  evaluateViewerRuntimeFromActiveSession,
  type EditorSessionAdapter
} from "../editor-session/index.js";
import {
  createEditorStateFileFromEditorState,
  type EditorSemanticState
} from "../editor-state/index.js";

export interface EditorProductPreflightWorkflowInput {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly now?: () => Date;
}

export interface EditorProductPreflightWorkflowResult {
  readonly status: "completed";
  readonly report: ProductPreflightReportDto;
  readonly validationReport: ValidationReportDto;
}

type MutableProductPreflightCategoryEvidenceRefsInput = {
  [TCategory in ProductPreflightCategoryDto]?: ProductPreflightEvidenceRefDto[];
};

export const runEditorProductPreflightWorkflow = async (
  input: EditorProductPreflightWorkflowInput
): Promise<EditorProductPreflightWorkflowResult> => {
  const createdAt = (input.now?.() ?? new Date()).toISOString();
  const snapshot = input.adapter.createPersistenceSnapshot({
    editorState: createEditorStateFileFromEditorState(input.state)
  });
  const viewerEvaluation = evaluateViewerRuntimeFromActiveSession(input.adapter.authoringSession, {
    request: {
      targetIds: collectProductPreflightTargetIds(snapshot.document),
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      }
    }
  });
  const transportBoundary = evaluatePackageTransportBoundary({
    capabilityId: "projectDefinedJsonBundleV0",
    operation: "export"
  });
  const validationReport = await validatePackageRuntimeWithBinaryAssets({
    packageDocument: snapshot.document,
    runtimeSnapshot: viewerEvaluation.snapshot,
    viewerEvidence: viewerEvaluation.evidence,
    binaryFileSet: snapshot.packageInMemoryFileSet,
    binaryAssetIndex: snapshot.binaryByteEvidence.binaryAssetIndex,
    byteIntakePreflight: {
      ...snapshot.binaryByteEvidence.byteIntakePreflight,
      packageId: snapshot.document.manifest.packageId,
      packageRevision: snapshot.document.manifest.packageRevision
    },
    transportCapabilityEvidence: transportBoundary.capability,
    requireTransportCapabilityEvidence: true,
    createdAt
  });
  const tutorialReadinessReport = buildTutorialMiniModelReadinessReport({
    packageDocument: snapshot.document,
    runtimeSnapshot: viewerEvaluation.snapshot,
    viewerEvidence: viewerEvaluation.evidence,
    operationLogPresent: true,
    operationLogPath: CANONICAL_OPERATION_LOG_PATH,
    createdAt
  });
  const categoryEvidenceRefs = await createProductPreflightCategoryEvidenceRefs({
    snapshot,
    viewerEvidence: viewerEvaluation.evidence,
    transportBoundary,
    tutorialReadinessReport
  });
  const report = buildProductPreflightReport({
    createdAt,
    packageId: snapshot.document.manifest.packageId,
    packageRevision: snapshot.document.manifest.packageRevision,
    validationReports: [validationReport, tutorialReadinessReport],
    categoryEvidenceRefs
  });

  return {
    status: "completed",
    report,
    validationReport
  };
};

const createProductPreflightCategoryEvidenceRefs = async (input: {
  readonly snapshot: ReturnType<EditorSessionAdapter["createPersistenceSnapshot"]>;
  readonly viewerEvidence: ReturnType<typeof evaluateViewerRuntimeFromActiveSession>["evidence"];
  readonly transportBoundary: ReturnType<typeof evaluatePackageTransportBoundary>;
  readonly tutorialReadinessReport: ValidationReportDto;
}): Promise<ProductPreflightCategoryEvidenceRefsInput> => {
  const refs: MutableProductPreflightCategoryEvidenceRefsInput = {};
  appendEvidenceRefs(refs, "authoringWorkflowEvidence", [
    createOperationLogEvidenceRef(input.snapshot)
  ]);
  appendEvidenceRefs(
    refs,
    "runtimeViewerEvidence",
    createViewerRuntimeProductPreflightEvidence({
      evidence: input.viewerEvidence
    }).evidenceRefs
  );
  appendEvidenceRefs(
    refs,
    "persistenceTransport",
    createTransportCapabilityProductPreflightEvidence({
      packageId: input.snapshot.document.manifest.packageId,
      packageRevision: input.snapshot.document.manifest.packageRevision,
      boundaryResult: input.transportBoundary
    }).evidenceRefs
  );
  appendEvidenceRefs(
    refs,
    "assetBytes",
    await createByteAvailabilityEvidenceRefs(input.snapshot)
  );
  appendEvidenceRefs(refs, "tutorialDemoReadiness", [
    createTutorialReadinessEvidenceRef(input.tutorialReadinessReport)
  ]);

  return refs;
};

const createOperationLogEvidenceRef = (
  snapshot: ReturnType<EditorSessionAdapter["createPersistenceSnapshot"]>
): ProductPreflightEvidenceRefDto =>
  ProductPreflightEvidenceRefDtoSchema.parse({
    evidenceId: createEvidenceId(
      "editorOperationLog",
      snapshot.document.manifest.packageId,
      `r${snapshot.document.manifest.packageRevision}`
    ),
    artifactRef: {
      artifactKind: "operationLog",
      path: CANONICAL_OPERATION_LOG_PATH
    },
    target: {
      kind: "package",
      id: snapshot.document.manifest.packageId
    },
    summary: `${snapshot.operationLogEntries.length} editor operation log entries are available for product preflight.`,
    producer: "editor"
  });

const createByteAvailabilityEvidenceRefs = async (
  snapshot: ReturnType<EditorSessionAdapter["createPersistenceSnapshot"]>
): Promise<readonly ProductPreflightEvidenceRefDto[]> => {
  const evidenceRefs: ProductPreflightEvidenceRefDto[] = [];
  const binaryAssetRefs = collectBinaryAssetRefs(snapshot.document);

  if (binaryAssetRefs.length === 0) {
    return [createNoBinaryAssetByteAvailabilityEvidenceRef(snapshot)];
  }

  for (const binaryAssetRef of binaryAssetRefs) {
    const verificationReport = await verifyPackageBinaryAssetBytes(
      snapshot.packageInMemoryFileSet,
      binaryAssetRef
    );
    const availabilityReport = evaluatePackageBinaryCurrentSessionByteAvailability({
      packageId: snapshot.document.manifest.packageId,
      packageRevision: snapshot.document.manifest.packageRevision,
      binaryAssetRef,
      currentSessionVerificationReport: verificationReport,
      requiresReupload:
        verificationReport.status !== "pass" &&
        binaryAssetRef.storageStatus === "stored-package-local-v1"
    });
    evidenceRefs.push(
      ...createByteAvailabilityProductPreflightEvidence({
        report: availabilityReport
      }).evidenceRefs
    );
  }

  return evidenceRefs;
};

const createNoBinaryAssetByteAvailabilityEvidenceRef = (
  snapshot: ReturnType<EditorSessionAdapter["createPersistenceSnapshot"]>
): ProductPreflightEvidenceRefDto =>
  ProductPreflightEvidenceRefDtoSchema.parse({
    evidenceId: createEvidenceId(
      "byteAvailabilityNoBinaryAssets",
      snapshot.document.manifest.packageId,
      `r${snapshot.document.manifest.packageRevision}`
    ),
    artifactRef: {
      artifactKind: "byteAvailability",
      path: "generated/byte-availability/no-binary-assets.json"
    },
    target: {
      kind: "package",
      id: snapshot.document.manifest.packageId
    },
    summary: "No package binary asset references require current-session byte availability evidence.",
    producer: "editor"
  });

const createTutorialReadinessEvidenceRef = (
  report: ValidationReportDto
): ProductPreflightEvidenceRefDto =>
  ProductPreflightEvidenceRefDtoSchema.parse({
    evidenceId: createEvidenceId("tutorialReadiness", report.packageId, report.reportId),
    artifactRef: {
      artifactKind: "tutorialReadiness",
      path: `generated/tutorial-readiness/${report.reportId}.json`
    },
    target: {
      kind: "package",
      id: report.packageId
    },
    summary: `Tutorial readiness report ${report.reportId} is available for Product Preflight.`,
    producer: "editor"
  });

const collectBinaryAssetRefs = (
  packageDocument: PackageDocumentDto
): readonly BinaryAssetReferenceDto[] => {
  const refs = [
    ...packageDocument.assets.sourceManifest.sourceAssets.flatMap((sourceAsset) =>
      sourceAsset.binaryAssetRef === undefined ? [] : [sourceAsset.binaryAssetRef]
    ),
    ...(packageDocument.assets.textureAtlas?.textures.flatMap((texture) =>
      texture.binaryAssetRef === undefined ? [] : [texture.binaryAssetRef]
    ) ?? [])
  ];
  const refsByKey = new Map<string, BinaryAssetReferenceDto>();

  for (const ref of refs) {
    const parsedRef = BinaryAssetReferenceSchema.parse(ref);
    refsByKey.set(
      `${parsedRef.binaryAssetId}\n${parsedRef.packageRelativePath}`,
      parsedRef
    );
  }

  return [...refsByKey.values()];
};

const appendEvidenceRefs = (
  target: MutableProductPreflightCategoryEvidenceRefsInput,
  category: ProductPreflightCategoryDto,
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): void => {
  if (evidenceRefs.length === 0) {
    return;
  }

  target[category] = [
    ...(target[category] ?? []),
    ...evidenceRefs
  ];
};

const collectProductPreflightTargetIds = (
  packageDocument: PackageDocumentDto
): string[] =>
  uniqueStrings([
    packageDocument.manifest.packageId,
    ...packageDocument.model.parameters.parameters.map((parameter) => parameter.parameterId),
    ...packageDocument.model.graph.parts.map((part) => part.partId),
    ...packageDocument.model.drawables.drawables.map((drawable) => drawable.drawableId),
    ...packageDocument.model.meshes.meshes.map((mesh) => mesh.meshId),
    ...packageDocument.model.rigControls.rigControls.map((rigControl) => rigControl.rigControlId),
    ...packageDocument.model.rigControls.rigControls.flatMap((rigControl) => rigControl.childDrawableIds),
    ...packageDocument.model.rigControls.rigControls.flatMap((rigControl) => rigControl.childRigControlIds),
    ...packageDocument.model.masks.masks.map((relation) => relation.maskRelationId),
    ...packageDocument.model.masks.masks.flatMap((relation) => relation.maskDrawableIds),
    ...packageDocument.model.masks.masks.flatMap((relation) => relation.targetDrawableIds),
    ...packageDocument.model.dynamics.dynamicsGroups.map((group) => group.dynamicsGroupId),
    ...packageDocument.model.dynamics.dynamicsGroups.map((group) => group.output.targetParameterId)
  ]);

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};

const createEvidenceId = (...parts: readonly string[]): string =>
  `evidence_${sanitizeIdToken(parts.join("_"))}`;

const sanitizeIdToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "preflight";
