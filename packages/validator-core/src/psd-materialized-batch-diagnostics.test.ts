import {
  describe,
  expect,
  it
} from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  computePackageBinarySha256Digest,
  type BinaryAssetReferenceDto,
  type PackageBinaryBytes,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { ProductPreflightCategoryResultDto } from "@private-2d-rigging-lab/contracts";

import { defaultCheckCatalog } from "./check-catalog.js";
import { buildProductPreflightReport } from "./product-preflight-report.js";
import type { ValidationReportDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-06-06T00:00:00.000Z";
const PACKAGE_ID = "pkg_wave47_psd_batch_materialized_asset";
const SOURCE_ASSET_ID = "src_wave47_psd";
const SOURCE_PROVENANCE_ID = "prov_wave47_psd_source";
const SOURCE_BINARY_ID = "bin_wave47_psd_source";
const PARENT_PART_ID = "part_wave47_parent";
const RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";
const SOURCE_BYTES = new Uint8Array([0x70, 0x73, 0x64, 0x34, 0x37]);
const PLAN_DIGEST = {
  algorithm: "sha256",
  hex: "1111111111111111111111111111111111111111111111111111111111111111"
} as const;
const OTHER_PLAN_DIGEST = {
  algorithm: "sha256",
  hex: "2222222222222222222222222222222222222222222222222222222222222222"
} as const;
const APPROVAL_DIGEST = {
  algorithm: "sha256",
  hex: "3333333333333333333333333333333333333333333333333333333333333333"
} as const;
type BatchEvidenceFixture = {
  evidenceId?: string;
  operationId?: string;
  batchId: string;
  importPlanBridge?: unknown;
  aggregateStatus: "success" | "preflightBlocked" | "partialFailure" | "failure";
  selectedLayerCount: number;
  successCount: number;
  failureCount: number;
  totalMaterializedByteLength: number;
  destination: {
    destinationKind: "generatedPartScaffold";
    parentPartId: string;
  };
  entries: Array<{
    selectedIndex: number;
    sourceLayerRef: ReturnType<typeof createSourceLayerRef>;
    approvedLeafRef?: ReturnType<typeof createImportPlanSourceLayerRef>;
    approvalOrder?: number;
    materializationId: string;
    materializedByteLength: number;
    generated: {
      partId: string;
      partDisplayName: string;
      drawableId: string;
      drawableDisplayName: string;
      textureId: string;
      meshId: string;
    };
    resultRefs?: {
      batchEvidenceId: string;
      materializationEvidenceId: string;
      materializationId: string;
      operationId?: string;
      partId: string;
      drawableId: string;
      meshId: string;
      textureId: string;
    };
    status: "success" | "preflightReady" | "preflightBlocked";
    operationId?: string;
    diagnostics: Array<{
      checkId: string;
      status: "fail";
      severity: "error";
      phase: string;
      target: {
        kind: "operation";
        id: string;
        path: string;
      };
      message: string;
      evidence: string[];
      relatedAC: string[];
      relatedScenarios: string[];
    }>;
    issues?: ImportPlanIssueFixture[];
  }>;
  issues?: ImportPlanIssueFixture[];
};
type ImportPlanIssueKind =
  | "stalePlan"
  | "staleApproval"
  | "missingCandidate"
  | "blockedCandidate"
  | "notApproved"
  | "collision"
  | "destinationParent"
  | "sourceIdentityMismatch"
  | "byteUnavailable"
  | "byteCapExceeded"
  | "partialFailure"
  | "unsupportedCandidate"
  | "hiddenCandidate"
  | "emptyCandidate"
  | "currentSessionSourceMissing"
  | "privateLocalProvenanceFailure";
type ImportPlanIssueFixture = {
  issueId?: string;
  issueKind: ImportPlanIssueKind;
  checkId?: string;
  message: string;
  targetPath?: string;
  selectedIndex?: number;
  approvalOrder?: number;
  sourceLayerRef?: ReturnType<typeof createImportPlanSourceLayerRef>;
};
type ImportPlanCandidateStatus =
  | "candidate"
  | "hidden"
  | "unsupported"
  | "emptyZeroSize"
  | "duplicateRef"
  | "duplicateName"
  | "generatedIdCollision"
  | "generatedNameCollision"
  | "byteCapBlocked"
  | "notApproved";
type ImportPlanGeneratedStatus =
  | "previewReady"
  | "resolved"
  | "generatedIdCollision"
  | "generatedNameCollision";
type FixtureDigest = {
  readonly algorithm: "sha256";
  readonly hex: string;
};
type ImportPlanLayerFixture = {
  readonly sourceLayerId: string;
  readonly sourceLayerName: string;
  readonly sourceLayerPath: readonly string[];
  readonly byteLength: number;
  readonly visibleInSource: boolean;
  readonly width: number;
  readonly height: number;
  readonly partId: string;
  readonly drawableId: string;
  readonly meshId: string;
  readonly textureId: string;
};
const LAYER_FIXTURES = [
  {
    sourceLayerId: "psd_layer_headwear",
    materializationId: "mat_wave47Headwear",
    originalName: "Headwear",
    normalizedName: "headwear",
    groupPath: ["Root", "Head"],
    bytes: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]),
    width: 2,
    height: 1,
    materializedBinaryId: "bin_wave47_headwear_raw",
    materializedPath: "assets/textures/psd/headwear.raw-rgba",
    materializedProvenanceId: "prov_wave47_headwear_texture",
    partId: "part_root_head_headwear",
    drawableId: "draw_root_head_headwear",
    meshId: "mesh_root_head_headwear",
    textureId: "tex_root_head_headwear",
    displayName: "Root / Head / Headwear"
  },
  {
    sourceLayerId: "psd_layer_eyewear",
    materializationId: "mat_wave47Eyewear",
    originalName: "Eyewear",
    normalizedName: "eyewear",
    groupPath: ["Root", "Face"],
    bytes: new Uint8Array([12, 24, 36, 255]),
    width: 1,
    height: 1,
    materializedBinaryId: "bin_wave47_eyewear_raw",
    materializedPath: "assets/textures/psd/eyewear.raw-rgba",
    materializedProvenanceId: "prov_wave47_eyewear_texture",
    partId: "part_root_face_eyewear",
    drawableId: "draw_root_face_eyewear",
    meshId: "mesh_root_face_eyewear",
    textureId: "tex_root_face_eyewear",
    displayName: "Root / Face / Eyewear"
  }
] as const;
const PLAN_HIDDEN_UNSUPPORTED_LAYER: ImportPlanLayerFixture = {
  sourceLayerId: "psd_layer_hidden_shadow",
  sourceLayerName: "Hidden shadow",
  sourceLayerPath: ["Root", "Hidden shadow"],
  byteLength: 16,
  visibleInSource: false,
  width: 2,
  height: 2,
  partId: "part_hidden_shadow",
  drawableId: "draw_hidden_shadow",
  meshId: "mesh_hidden_shadow",
  textureId: "tex_hidden_shadow"
};

describe("Wave47 PSD batch materialized asset diagnostics", () => {
  it("registers batch materialized asset check ids in the catalog", () => {
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchEvidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchEvidenceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchAvailable")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchBytesMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchEntryMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchSourceCurrentBytesMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchSourceStale")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchAssetMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchProvenanceBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchDestinationParentInvalid")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchGeneratedScaffoldMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchDuplicateLayer")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchGeneratedScaffoldCollision")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchPreflightBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchPartialFailure")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanEvidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanEvidenceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanCandidateMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanCandidateStatusSummary")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanApprovalMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanNotApprovedCandidateSelected")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanCandidateBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanPreflightBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanPartialState")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanSourceCurrentBytesMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanSourceStale")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.importPlanProvenanceBlocked")).toBe(true);
  });

  it("accepts valid two-layer batch materialized bytes and generated part scaffold as Product Preflight available", async () => {
    const fixture = await createWave47BatchFixture();
    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_available");

    expect(report.summary.status).toBe("pass");
    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedAssetAvailable",
      "asset.psd.materializedBatchAvailable"
    ]));
    expect(expectCheckById(report, "asset.psd.materializedBatchAvailable").evidence).toEqual(
      expect.arrayContaining([
        "batchMaterializedAssetAvailability=available",
        "generatedPartScaffoldAvailability=available",
        "materializedBytesAvailability=package-local-binary-ref",
        "validatorBoundary=no-parser-execution",
        "rawParserObject=notPersisted",
        "allLayerImport=notClaimed",
        "recursiveGroupImport=notClaimed",
        "rendererPixelOracle=notClaimed"
      ])
    );
    expect(assetBytes.status).toBe("pass");
  });

  it("keeps missing source current bytes as a batch Product Preflight warning while batch entries remain available", async () => {
    const fixture = await createWave47BatchFixture();
    const sourceAsset = expectSourceAsset(fixture.document);
    delete sourceAsset.binaryAssetRef;

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_source_warning");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedBatchSourceCurrentBytesMissing",
      "asset.psd.materializedBatchAvailable"
    ]));
    expect(expectCheckById(report, "asset.psd.materializedBatchSourceCurrentBytesMissing")).toMatchObject({
      status: "warning",
      severity: "warning"
    });
    expect(assetBytes.status).toBe("warn");
  });

  it("blocks stale, missing, media type, digest, and byteLength batch entry evidence", async () => {
    const fixture = await createWave47BatchFixture();
    const materialization = expectMaterialization(fixture.document, 1);

    materialization.provenance.sourceDigest = {
      algorithm: "sha256",
      hex: "1111111111111111111111111111111111111111111111111111111111111111"
    };
    materialization.provenance.sourceByteLength = 999;
    materialization.mediaType = "image/png";
    materialization.byteLength = 99;
    materialization.binaryAssetRef = {
      ...materialization.binaryAssetRef!,
      digest: {
        algorithm: "sha256",
        hex: "2222222222222222222222222222222222222222222222222222222222222222"
      },
      byteLength: 4,
      mediaType: "application/octet-stream"
    };

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_stale_blocking");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedBatchSourceStale",
      "asset.psd.materializedBatchAssetMismatch"
    ]));
    expect(expectCheckById(report, "asset.psd.materializedBatchSourceStale").evidence).toEqual(
      expect.arrayContaining([
        "reasons=source-psd-digest-mismatch,source-psd-byte-length-mismatch"
      ])
    );
    expect(expectCheckById(report, "asset.psd.materializedBatchAssetMismatch").evidence).toEqual(
      expect.arrayContaining([
        "reasons=materialized-media-type-not-wave47-raw-rgba,binary-media-type-not-wave47-raw-rgba,materialized-digest-mismatch,materialized-byte-length-mismatch,batch-entry-byte-length-mismatch,materialized-media-type-mismatch,raw-rgba-byte-length-mismatch"
      ])
    );
    expect(assetBytes.status).toBe("fail");
  });

  it("blocks success aggregate evidence when entry statuses and counts are inconsistent", async () => {
    const fixture = await createWave47BatchFixture();
    const malformedBatch = clone(fixture.batchEvidence) as BatchEvidenceFixture;
    malformedBatch.aggregateStatus = "success";
    malformedBatch.successCount = 2;
    malformedBatch.failureCount = 1;
    malformedBatch.entries[1]!.status = "preflightReady";

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [malformedBatch],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_success_count_mismatch");
    const mismatch = expectCheckById(report, "asset.psd.materializedBatchEvidenceMismatch");

    expect(report.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.materializedBatchAvailable"
    );
    expect(mismatch).toMatchObject({
      status: "fail",
      severity: "error"
    });
    expect(mismatch.evidence).toEqual(expect.arrayContaining([
      "actualSuccessEntryCount=1",
      "actualPreflightBlockedEntryCount=0",
      "actualNonSuccessEntryCount=1",
      "reasons=success-count-entry-status-mismatch,failure-count-entry-status-mismatch,success-aggregate-has-non-success-entry,success-aggregate-failure-count-nonzero"
    ]));
    expect(assetBytes.status).toBe("fail");
  });

  it("blocks successful batch entries that have no matching per-layer materialization evidence", async () => {
    const fixture = await createWave47BatchFixture();
    const missingEntryBatch = clone(fixture.batchEvidence) as BatchEvidenceFixture;
    missingEntryBatch.entries[0]!.materializationId = "mat_wave47Missing";

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [missingEntryBatch],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_entry_missing");
    const missing = expectCheckById(report, "asset.psd.materializedBatchEntryMissing");

    expect(report.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.materializedBatchAvailable"
    );
    expect(missing).toMatchObject({
      status: "fail",
      severity: "error"
    });
    expect(missing.evidence).toEqual(expect.arrayContaining([
      "expectedMaterializationId=mat_wave47Missing",
      "reason=successful-entry-materialization-evidence-missing"
    ]));
    expect(assetBytes.status).toBe("fail");
  });

  it("blocks duplicate selections, generated scaffold collisions, invalid destination parent, and preflight failure", async () => {
    const fixture = await createWave47BatchFixture();
    const duplicateBatch = clone(fixture.batchEvidence) as BatchEvidenceFixture;
    duplicateBatch.aggregateStatus = "preflightBlocked";
    duplicateBatch.successCount = 0;
    duplicateBatch.failureCount = 2;
    duplicateBatch.destination.parentPartId = "part_missingParent";
    duplicateBatch.entries[1]!.sourceLayerRef = duplicateBatch.entries[0]!.sourceLayerRef;
    duplicateBatch.entries[1]!.generated = duplicateBatch.entries[0]!.generated;
    duplicateBatch.entries[1]!.status = "preflightBlocked";
    duplicateBatch.entries[1]!.diagnostics = [
      {
        checkId: "operation.importPsdLayerMaterializationBatch.duplicateLayerRef",
        status: "fail",
        severity: "error",
        phase: "precondition",
        target: {
          kind: "operation",
          id: "op_wave47_batch",
          path: "/payload/entries/1/materialization/sourceLayerRef"
        },
        message: "Duplicate PSD source layer ref.",
        evidence: [],
        relatedAC: [],
        relatedScenarios: []
      },
      {
        checkId: "operation.importPsdLayerMaterializationBatch.idNameCollision",
        status: "fail",
        severity: "error",
        phase: "precondition",
        target: {
          kind: "operation",
          id: "op_wave47_batch",
          path: "/payload/entries/1"
        },
        message: "Generated part id already exists.",
        evidence: [],
        relatedAC: [],
        relatedScenarios: []
      }
    ];

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [duplicateBatch],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_preflight_blocked");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedBatchPreflightBlocked",
      "asset.psd.materializedBatchDestinationParentInvalid",
      "asset.psd.materializedBatchDuplicateLayer",
      "asset.psd.materializedBatchGeneratedScaffoldCollision"
    ]));
    expect(assetBytes.status).toBe("fail");
  });

  it("maps required-but-missing batch evidence to Product Preflight not_evaluated", async () => {
    const fixture = await createWave47BatchFixture();
    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      requirePsdLayerMaterializationBatchEvidence: true,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_not_evaluated");

    expect(expectCheckById(report, "asset.psd.materializedBatchEvidenceMissing")).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.materializedBatchEvidenceMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("blocks missing private/local batch provenance and publicDemoAsset=true package evidence", async () => {
    const fixture = await createWave47BatchFixture();
    const materialization = expectMaterialization(fixture.document, 0);
    delete materialization.provenance.publicDemoAsset;

    const missingFlagReport = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    expect(expectCheckById(missingFlagReport, "asset.psd.materializedBatchProvenanceBlocked").evidence)
      .toEqual(expect.arrayContaining([
        "publicDemoAsset=missing",
        "reasons=public-demo-asset-flag-missing"
      ]));
    expect(findAssetBytes(missingFlagReport, "preflight_wave47_batch_missing_public_flag").status)
      .toBe("fail");

    const publicDemoDocument = clone(fixture.document) as Record<string, unknown>;
    const publicDemoMaterialization = expectMaterialization(
      publicDemoDocument as PackageDocumentDto,
      0
    ) as unknown as { provenance: { publicDemoAsset: boolean } };
    publicDemoMaterialization.provenance.publicDemoAsset = true;

    const publicDemoReport = validatePackageRuntime({
      packageDocument: publicDemoDocument,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    const check = expectCheckById(publicDemoReport, "asset.psd.materializedProvenanceBlocked");

    expect(check).toMatchObject({
      status: "fail",
      severity: "blocking"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "actual=true",
      "reason=public-demo-asset-true",
      "validatorBoundary=no-parser-execution"
    ]));
    expect(findAssetBytes(publicDemoReport, "preflight_wave47_public_demo_blocked").status)
      .toBe("fail");
  });

  it("surfaces import plan hidden, unsupported, not-approved, collision, and byte-cap candidate evidence as Product Preflight warning", async () => {
    const fixture = await createWave47BatchFixture();
    const batchWithImportPlan = {
      ...fixture.batchEvidence,
      importPlanBridge: createImportPlanBridge({
        sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
        approvedLayers: [...LAYER_FIXTURES],
        notApprovedLayers: [PLAN_HIDDEN_UNSUPPORTED_LAYER]
      })
    };

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [batchWithImportPlan],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave48_import_plan_candidate_warning");
    const summary = expectCheckById(report, "asset.psd.importPlanCandidateStatusSummary");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedBatchAvailable",
      "asset.psd.importPlanCandidateStatusSummary"
    ]));
    expect(summary).toMatchObject({
      status: "warning",
      severity: "warning"
    });
    expect(summary.evidence).toEqual(expect.arrayContaining([
      "importPlanEvidence=parser-free-session-evidence",
      "onlyApprovedLeafRefsPassedToBatch=true",
      "actualHiddenCandidateCount=1",
      "actualUnsupportedCandidateCount=1",
      "actualGeneratedIdCollisionCount=1",
      "actualByteCapBlockedCount=1",
      "collisionByteCapBlockedCount=1",
      "collisionPreflightBlockedCount=1",
      "allLayerImport=notClaimed",
      "recursiveGroupImport=notClaimed",
      "rendererPixelOracle=notClaimed"
    ]));
    expect(assetBytes.status).toBe("warn");
    expect(assetBytes.diagnosticRefs).toEqual([
      expect.objectContaining({
        checkId: "asset.psd.importPlanCandidateStatusSummary",
        status: "warning"
      })
    ]);
  });

  it("accepts Domain B generalized result refs and keeps approved leaf result evidence machine-readable", async () => {
    const fixture = await createWave47BatchFixture();
    const batchWithResultRefs = addDomainBResultRefs({
      batchEvidence: {
        ...fixture.batchEvidence,
        importPlanBridge: createImportPlanBridge({
          sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
          approvedLayers: [...LAYER_FIXTURES]
        })
      }
    });

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [batchWithResultRefs],
      createdAt: CREATED_AT
    });
    const available = expectCheckById(report, "asset.psd.materializedBatchAvailable");

    expect(report.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.materializedBatchEvidenceMismatch"
    );
    expect(available.evidence).toEqual(expect.arrayContaining([
      "batchEvidenceId=evidence_batch_wave47HeadwearEyewear",
      "batchOperationId=op_wave49_import_plan_batch",
      "batchIssueKinds=none",
      "allLayerImport=notClaimed",
      "rendererPixelOracle=notClaimed"
    ]));
    expect(available.evidence.some((entry) =>
      entry.startsWith("approvedLeafResults=") &&
      entry.includes("sourceLayerKey:src_wave47_psd:psd_layer_headwear") &&
      entry.includes("partId:part_root_head_headwear") &&
      entry.includes("drawableId:draw_root_head_headwear") &&
      entry.includes("textureId:tex_root_head_headwear")
    )).toBe(true);
  });

  it("maps Domain B import-plan issue kinds to stable validator diagnostics", async () => {
    const fixture = await createWave47BatchFixture();
    const bridge = createImportPlanBridge({
      sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
      approvedLayers: [...LAYER_FIXTURES]
    });
    bridge.approval.issues = [
      createImportPlanIssue("stalePlan", 0),
      createImportPlanIssue("staleApproval", 1),
      createImportPlanIssue("missingCandidate", 2),
      createImportPlanIssue("collision", 3),
      createImportPlanIssue("sourceIdentityMismatch", 4),
      createImportPlanIssue("byteCapExceeded", 5),
      createImportPlanIssue("partialFailure", 6),
      createImportPlanIssue("privateLocalProvenanceFailure", 7)
    ];
    const batchWithIssues = addDomainBResultRefs({
      batchEvidence: {
        ...fixture.batchEvidence,
        importPlanBridge: bridge,
        issues: [
          createImportPlanIssue("destinationParent", 8),
          createImportPlanIssue("byteUnavailable", 9)
        ]
      }
    });
    batchWithIssues.entries[0]!.issues = [
      createImportPlanIssue("blockedCandidate", 10, LAYER_FIXTURES[0]),
      createImportPlanIssue("notApproved", 11, LAYER_FIXTURES[0]),
      createImportPlanIssue("unsupportedCandidate", 12, LAYER_FIXTURES[0]),
      createImportPlanIssue("hiddenCandidate", 13, LAYER_FIXTURES[0]),
      createImportPlanIssue("emptyCandidate", 14, LAYER_FIXTURES[0]),
      createImportPlanIssue("currentSessionSourceMissing", 15, LAYER_FIXTURES[0])
    ];

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [batchWithIssues],
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.importPlanCandidateMismatch",
      "asset.psd.importPlanApprovalMismatch",
      "asset.psd.importPlanCandidateBlocked",
      "asset.psd.importPlanNotApprovedCandidateSelected",
      "asset.psd.importPlanPreflightBlocked",
      "asset.psd.materializedBatchDestinationParentInvalid",
      "asset.psd.importPlanSourceStale",
      "asset.psd.importPlanSourceCurrentBytesMissing",
      "asset.psd.importPlanPartialState",
      "asset.psd.importPlanProvenanceBlocked"
    ]));
    expect(report.checks.flatMap((check) => check.evidence)).toEqual(expect.arrayContaining([
      "reportedIssueKind=stalePlan",
      "reportedIssueKind=staleApproval",
      "reportedIssueKind=missingCandidate",
      "reportedIssueKind=blockedCandidate",
      "reportedIssueKind=notApproved",
      "reportedIssueKind=collision",
      "reportedIssueKind=destinationParent",
      "reportedIssueKind=sourceIdentityMismatch",
      "reportedIssueKind=byteUnavailable",
      "reportedIssueKind=byteCapExceeded",
      "reportedIssueKind=partialFailure",
      "reportedIssueKind=unsupportedCandidate",
      "reportedIssueKind=hiddenCandidate",
      "reportedIssueKind=emptyCandidate",
      "reportedIssueKind=currentSessionSourceMissing",
      "reportedIssueKind=privateLocalProvenanceFailure"
    ]));
    expect(findAssetBytes(report, "preflight_wave49_domain_b_issue_taxonomy").status)
      .toBe("fail");
  });

  it("maps current-session source-missing import-plan issue evidence to Product Preflight not_evaluated", async () => {
    const fixture = await createWave47BatchFixture();
    const batchWithMissingSessionIssue = addDomainBResultRefs({
      batchEvidence: {
        ...fixture.batchEvidence,
        importPlanBridge: createImportPlanBridge({
          sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
          approvedLayers: [...LAYER_FIXTURES]
        }),
        issues: [createImportPlanIssue("currentSessionSourceMissing", 0)]
      }
    });

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [batchWithMissingSessionIssue],
      createdAt: CREATED_AT
    });
    const currentSourceMissing = expectCheckById(
      report,
      "asset.psd.importPlanSourceCurrentBytesMissing"
    );
    const assetBytes = findAssetBytes(report, "preflight_wave49_current_session_source_missing");

    expect(currentSourceMissing).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
    expect(currentSourceMissing.evidence).toEqual(expect.arrayContaining([
      "reportedIssueKind=currentSessionSourceMissing",
      "importPlanEvidence=parser-free-session-evidence",
      "validatorBoundary=no-parser-execution"
    ]));
    expect(report.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.importPlanEvidenceMismatch"
    );
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.importPlanSourceCurrentBytesMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("blocks selected import plan candidates that are not approved, unsupported, collision-blocked, or approval mismatched", async () => {
    const fixture = await createWave47BatchFixture();
    const blockedSelectedBridge = createImportPlanBridge({
      sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
      approvedLayers: [...LAYER_FIXTURES],
      notApprovedLayers: [LAYER_FIXTURES[0]],
      approvalStatus: "approvalSelectionMismatch",
      approvalCandidatePlanDigest: OTHER_PLAN_DIGEST,
      approvedLeafStatusesByLayerId: {
        [LAYER_FIXTURES[0].sourceLayerId]: [
          "hidden",
          "unsupported",
          "emptyZeroSize",
          "byteCapBlocked",
          "notApproved"
        ]
      },
      candidateStatusesByLayerId: {
        [LAYER_FIXTURES[0].sourceLayerId]: [
          "hidden",
          "unsupported",
          "emptyZeroSize",
          "byteCapBlocked",
          "generatedIdCollision",
          "notApproved"
        ]
      },
      generatedStatusByLayerId: {
        [LAYER_FIXTURES[0].sourceLayerId]: "generatedIdCollision"
      }
    });
    const batchWithBlockedPlan = {
      ...fixture.batchEvidence,
      importPlanBridge: blockedSelectedBridge
    };

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [batchWithBlockedPlan],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave48_import_plan_blocked_selected");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.importPlanCandidateMismatch",
      "asset.psd.importPlanApprovalMismatch",
      "asset.psd.importPlanCandidateBlocked",
      "asset.psd.importPlanNotApprovedCandidateSelected"
    ]));
    expect(expectCheckById(report, "asset.psd.importPlanCandidateBlocked").evidence)
      .toEqual(expect.arrayContaining([
        "blockingStatuses=hidden,unsupported,emptyZeroSize,byteCapBlocked,generatedIdCollision",
        "validatorBoundary=no-parser-execution"
      ]));
    expect(expectCheckById(report, "asset.psd.importPlanNotApprovedCandidateSelected").evidence)
      .toEqual(expect.arrayContaining([
        "reason=not-approved-candidate-selected",
        "validatorBoundary=no-parser-execution"
      ]));
    expect(assetBytes.status).toBe("fail");
  });

  it("fails stale import plan source identity evidence before trusting approved candidates", async () => {
    const fixture = await createWave47BatchFixture();
    const staleSourceBridge = createImportPlanBridge({
      sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
      approvedLayers: [...LAYER_FIXTURES]
    });
    staleSourceBridge.candidatePlan.sourcePsd.digest = OTHER_PLAN_DIGEST;
    staleSourceBridge.approval.sourcePsd.byteLength =
      staleSourceBridge.approval.sourcePsd.byteLength + 1;
    const batchWithStaleSource = {
      ...fixture.batchEvidence,
      importPlanBridge: staleSourceBridge
    };

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [batchWithStaleSource],
      createdAt: CREATED_AT
    });
    const check = expectCheckById(report, "asset.psd.importPlanSourceStale");

    expect(check).toMatchObject({
      status: "fail",
      severity: "error"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "expectedSourceByteLength=5",
      "candidatePlanSourceByteLength=5",
      "approvalSourceByteLength=6",
      "validatorBoundary=no-parser-execution"
    ]));
    expect(check.evidence.some((entry) =>
      entry.includes("candidate-plan-source-digest-mismatch") &&
      entry.includes("approval-source-byte-length-mismatch")
    )).toBe(true);
    expect(findAssetBytes(report, "preflight_wave48_import_plan_source_stale").status)
      .toBe("fail");
  });

  it("warns when import plan evidence has no current package-local source PSD bytes", async () => {
    const fixture = await createWave47BatchFixture();
    const missingCurrentBytesDocument = clone(fixture.document);
    expectSourceAsset(missingCurrentBytesDocument).binaryAssetRef!.storageStatus =
      "missing-package-local-bytes-v1";
    const batchWithImportPlan = {
      ...fixture.batchEvidence,
      importPlanBridge: createImportPlanBridge({
        sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
        approvedLayers: [...LAYER_FIXTURES]
      })
    };

    const report = validatePackageRuntime({
      packageDocument: missingCurrentBytesDocument,
      psdLayerMaterializationBatchEvidence: [batchWithImportPlan],
      createdAt: CREATED_AT
    });
    const check = expectCheckById(report, "asset.psd.importPlanSourceCurrentBytesMissing");

    expect(check).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceBinaryAssetRef=bin_wave47_psd_source",
      "sourceBinaryStorageStatus=missing-package-local-bytes-v1",
      "sourcePsdBytePersistence=metadataOnlyNoRawBytes",
      "rePlanRequiresReupload=true",
      "validatorBoundary=no-parser-execution"
    ]));
    expect(findAssetBytes(report, "preflight_wave48_import_plan_current_bytes_missing").status)
      .toBe("not_evaluated");
  });

  it("fails import plan approval evidence that is explicitly preflight blocked", async () => {
    const fixture = await createWave47BatchFixture();
    const batchWithPreflightBlockedPlan = {
      ...fixture.batchEvidence,
      importPlanBridge: createImportPlanBridge({
        sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
        approvedLayers: [...LAYER_FIXTURES],
        approvalStatus: "preflightBlocked"
      })
    };

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [batchWithPreflightBlockedPlan],
      createdAt: CREATED_AT
    });
    const check = expectCheckById(report, "asset.psd.importPlanPreflightBlocked");

    expect(report.checks.map((candidate) => candidate.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.importPlanApprovalMismatch",
      "asset.psd.importPlanPreflightBlocked"
    ]));
    expect(check).toMatchObject({
      status: "fail",
      severity: "error"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "approvalStatus=preflightBlocked",
      "batchAggregateStatus=success",
      "batchMutationPolicy=preflightBlocksOnAnyFailure",
      "validatorBoundary=no-parser-execution"
    ]));
    expect(findAssetBytes(report, "preflight_wave48_import_plan_preflight_blocked").status)
      .toBe("fail");
  });

  it("maps required-but-missing import plan bridge evidence to Product Preflight not_evaluated", async () => {
    const fixture = await createWave47BatchFixture();

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      requirePsdImportPlanBridgeEvidence: true,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave48_import_plan_not_evaluated");

    expect(expectCheckById(report, "asset.psd.importPlanEvidenceMissing")).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.importPlanEvidenceMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("blocks import plan partial states and malformed private/local provenance boundary fields", async () => {
    const fixture = await createWave47BatchFixture();
    const partialBatch = clone(fixture.batchEvidence) as BatchEvidenceFixture;
    partialBatch.aggregateStatus = "partialFailure";
    partialBatch.successCount = 1;
    partialBatch.failureCount = 1;
    partialBatch.entries[1]!.status = "preflightBlocked";
    partialBatch.importPlanBridge = createImportPlanBridge({
      sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
      approvedLayers: [...LAYER_FIXTURES]
    });

    const partialReport = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [partialBatch],
      createdAt: CREATED_AT
    });
    expect(partialReport.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedBatchPartialFailure",
      "asset.psd.importPlanPartialState"
    ]));
    expect(findAssetBytes(partialReport, "preflight_wave48_import_plan_partial").status).toBe("fail");

    const malformedBatch = clone(fixture.batchEvidence) as BatchEvidenceFixture;
    malformedBatch.importPlanBridge = createImportPlanBridge({
      sourceRef: expectSourceAsset(fixture.document).binaryAssetRef!,
      approvedLayers: [...LAYER_FIXTURES]
    });
    delete (malformedBatch.importPlanBridge as {
      approval: { sourcePsd: { publicDemoAsset?: boolean } };
    }).approval.sourcePsd.publicDemoAsset;

    const malformedReport = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [malformedBatch],
      createdAt: CREATED_AT
    });

    expect(malformedReport.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.importPlanEvidenceMismatch",
      "asset.psd.importPlanProvenanceBlocked"
    ]));
    expect(findAssetBytes(malformedReport, "preflight_wave48_import_plan_malformed").status)
      .toBe("fail");
  });
});

const createWave47BatchFixture = async () => {
  const sourceRef = await createBinaryAssetReference({
    binaryAssetId: SOURCE_BINARY_ID,
    packageRelativePath: "assets/sources/wave47-character.psd",
    bytes: SOURCE_BYTES,
    mediaType: "image/vnd.adobe.photoshop",
    provenanceId: SOURCE_PROVENANCE_ID,
    rightsAssetId: SOURCE_ASSET_ID
  });
  const materializedRefs = await Promise.all(LAYER_FIXTURES.map((layer) =>
    createBinaryAssetReference({
      binaryAssetId: layer.materializedBinaryId,
      packageRelativePath: layer.materializedPath,
      bytes: layer.bytes,
      mediaType: RAW_RGBA_MEDIA_TYPE,
      provenanceId: layer.materializedProvenanceId,
      rightsAssetId: SOURCE_ASSET_ID
    })
  ));
  const document = createWave47PackageDocument({
    sourceRef,
    materializedRefs
  });
  const batchEvidence = createBatchEvidence(materializedRefs);

  return { document, batchEvidence };
};

const createBinaryAssetReference = async (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly bytes: PackageBinaryBytes;
  readonly mediaType: string;
  readonly provenanceId: string;
  readonly rightsAssetId: string;
}): Promise<BinaryAssetReferenceDto> =>
  BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: input.binaryAssetId,
    packageRelativePath: input.packageRelativePath,
    digest: await computeDigest(input.bytes),
    byteLength: input.bytes.byteLength,
    mediaType: input.mediaType,
    storageStatus: "stored-package-local-v1",
    provenanceId: input.provenanceId,
    rightsAssetId: input.rightsAssetId
  });

const computeDigest = async (bytes: PackageBinaryBytes) => {
  const result = await computePackageBinarySha256Digest(bytes);
  if (result.status === "unsupported") {
    throw new Error("Expected SHA-256 support in validator tests.");
  }

  return result.digest;
};

const createWave47PackageDocument = (input: {
  readonly sourceRef: BinaryAssetReferenceDto;
  readonly materializedRefs: readonly BinaryAssetReferenceDto[];
}): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: PACKAGE_ID,
      packageDisplayName: "Wave47 PSD Batch Materialized Asset",
      formatVersion: "open-model-package-v1",
      packageRevision: 1,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      schemaVersions: {
        manifest: "open-model-package-manifest-v1",
        sourceManifest: "source-manifest-v1",
        textureAtlas: "texture-atlas-v1"
      },
      evaluatorVersions: {},
      modelFiles: {
        graph: "model/graph.json",
        drawables: "model/drawables.json",
        meshes: "model/meshes.json",
        parameters: "model/parameters.json",
        keyforms: "model/keyforms.json",
        rigControls: "model/rig-controls.json",
        dynamics: "model/dynamics.json",
        masks: "model/masks.json",
        drawOrder: "model/draw-order.json"
      },
      assetIndex: "assets/sources/source-manifest.json",
      operationLog: "operations/log.jsonl",
      rightsSummary: {
        status: "cleared"
      },
      provenanceSummary: {
        sourceAssetCount: 1
      },
      packageStableOrderVersion: "stable-order-v1"
    },
    model: {
      graph: {
        schemaVersion: "model-graph-v1",
        coordinateSystem: "canvas-y-down-v1",
        canvasSize: {
          width: 512,
          height: 512
        },
        parts: [
          {
            partId: PARENT_PART_ID,
            displayName: "Imported PSD Layers",
            childPartIds: LAYER_FIXTURES.map((layer) => layer.partId),
            drawableIds: []
          },
          ...LAYER_FIXTURES.map((layer) => ({
            partId: layer.partId,
            displayName: layer.displayName,
            parentPartId: PARENT_PART_ID,
            childPartIds: [],
            drawableIds: [layer.drawableId]
          }))
        ],
        rigControlRootIds: [],
        stableOrder: [
          PARENT_PART_ID,
          ...LAYER_FIXTURES.flatMap((layer) => [
            layer.partId,
            layer.drawableId,
            layer.meshId
          ])
        ]
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: LAYER_FIXTURES.map((layer) => ({
          drawableId: layer.drawableId,
          displayName: layer.displayName,
          partId: layer.partId,
          sourceAssetId: SOURCE_ASSET_ID,
          textureId: layer.textureId,
          meshId: layer.meshId,
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: layer.materializedProvenanceId
        }))
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: LAYER_FIXTURES.map((layer) => ({
          meshId: layer.meshId,
          drawableId: layer.drawableId,
          vertices: [
            { x: 0, y: 0 },
            { x: layer.width, y: 0 },
            { x: 0, y: layer.height }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          triangles: [[0, 1, 2]],
          vertexStableIds: ["v0", "v1", "v2"],
          bounds: {
            x: 0,
            y: 0,
            width: layer.width,
            height: layer.height
          },
          generationProvenanceId: layer.materializedProvenanceId
        }))
      },
      parameters: {
        schemaVersion: "parameters-file-v1",
        parameters: []
      },
      keyforms: {
        schemaVersion: "keyforms-file-v1",
        keyformSets: []
      },
      rigControls: {
        schemaVersion: "rig-controls-file-v1",
        rigControls: []
      },
      dynamics: {
        schemaVersion: "dynamics-file-v1",
        dynamicsGroups: []
      },
      masks: {
        schemaVersion: "masks-file-v1",
        masks: []
      },
      drawOrder: {
        schemaVersion: "draw-order-file-v1",
        entries: LAYER_FIXTURES.map((layer, index) => ({
          drawableId: layer.drawableId,
          baseDrawOrder: index,
          stableOrder: index
        }))
      }
    },
    assets: {
      sourceManifest: {
        schemaVersion: "source-manifest-v1",
        sourceAssets: [
          {
            sourceAssetId: SOURCE_ASSET_ID,
            kind: "psd-source-v1",
            filePath: input.sourceRef.packageRelativePath,
            contentHash: `${input.sourceRef.digest.algorithm}:${input.sourceRef.digest.hex}`,
            importProfile: "layered-character-psd-profile-v1",
            binaryAssetRef: input.sourceRef,
            layers: LAYER_FIXTURES.map((layer) => ({
              sourceLayerId: layer.sourceLayerId,
              sourceAssetId: SOURCE_ASSET_ID,
              originalName: layer.originalName,
              normalizedName: layer.normalizedName,
              groupPath: layer.groupPath,
              bounds: {
                x: 0,
                y: 0,
                width: layer.width,
                height: layer.height
              },
              visibleInSource: true,
              opacityInSource: 1,
              role: "editableLayer",
              unsupportedFeatures: [],
              mappedDrawableIds: [layer.drawableId]
            })),
            diagnostics: [],
            psdProfile: {
              schemaVersion: "layered-character-psd-profile-v1",
              adapter: {
                adapterName: "wave47-browser-explicit-psd-batch-import-adapter",
                adapterVersion: "0.1.0",
                adapterResultSchemaVersion: "psd-adapter-result-v1",
                sourceProfile: "layered-character-psd-profile-v1",
                evidenceKind: "real-psd-parse-result-v1",
                intakeKind: "realPsdParseResult",
                parser: createParserEvidence()
              },
              canvas: {
                width: 512,
                height: 512
              },
              sourceGroups: [],
              sourceLayers: LAYER_FIXTURES.map((layer, sourceOrder) => ({
                sourceLayerId: layer.sourceLayerId,
                originalName: layer.originalName,
                normalizedName: layer.normalizedName,
                groupPath: layer.groupPath,
                sourceOrder,
                bounds: {
                  x: 0,
                  y: 0,
                  width: layer.width,
                  height: layer.height
                },
                visibleInSource: true,
                opacityInSource: 1,
                role: "editableLayer",
                unsupportedFeatures: [],
                textureId: layer.textureId,
                targetPartId: layer.partId
              })),
              unsupportedFeatures: [],
              diagnostics: [],
              layerTreeEvidence: {
                evidenceKind: "psd-layer-tree-evidence-v1",
                evidenceId: "layerTree_wave47Batch",
                intakeKind: "realPsdParseResult",
                groupCount: 0,
                layerCount: LAYER_FIXTURES.length,
                maxDepth: 2,
                parser: createParserEvidence(),
                privateShapePolicy: "parser-private-shape-excluded-v1"
              },
              materializationEvidence: LAYER_FIXTURES.map((layer, index) =>
                createMaterializationEvidence(layer, input.sourceRef, input.materializedRefs[index]!)
              ),
              compatibility: {
                structuredProfilePrecedence: "structured-profile-preferred-v1",
                flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
                flattenedUnsupportedFeaturesFallback:
                  "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
              }
            }
          }
        ]
      },
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: LAYER_FIXTURES.map((layer, index) => {
          const ref = input.materializedRefs[index]!;
          return {
            textureId: layer.textureId,
            filePath: ref.packageRelativePath,
            contentHash: `${ref.digest.algorithm}:${ref.digest.hex}`,
            sourceAssetId: SOURCE_ASSET_ID,
            sourceLayerId: layer.sourceLayerId,
            provenanceId: layer.materializedProvenanceId,
            binaryAssetRef: ref
          };
        }),
        previewAssets: LAYER_FIXTURES.map((layer, index) => {
          const ref = input.materializedRefs[index]!;
          return {
            previewAssetId: `preview_wave47_${layer.normalizedName}`,
            textureId: layer.textureId,
            reference: {
              referenceKind: "package-local-file-v1",
              filePath: ref.packageRelativePath
            },
            contentHash: `${ref.digest.algorithm}:${ref.digest.hex}`,
            sourceAssetId: SOURCE_ASSET_ID,
            sourceLayerId: layer.sourceLayerId,
            provenanceId: layer.materializedProvenanceId,
            rightsAssetId: SOURCE_ASSET_ID
          };
        })
      },
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: [
          {
            provenanceId: SOURCE_PROVENANCE_ID,
            assetId: SOURCE_ASSET_ID,
            assetKind: "source",
            filePath: input.sourceRef.packageRelativePath,
            contentHash: `${input.sourceRef.digest.algorithm}:${input.sourceRef.digest.hex}`,
            creator: "validator-test",
            license: "private-local-selected-psd",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: [
              "Explicit user-selected private/local PSD bytes."
            ],
            relatedOperationIds: []
          },
          ...LAYER_FIXTURES.map((layer, index) => {
            const ref = input.materializedRefs[index]!;
            return {
              provenanceId: layer.materializedProvenanceId,
              assetId: SOURCE_ASSET_ID,
              assetKind: "texture",
              filePath: ref.packageRelativePath,
              contentHash: `${ref.digest.algorithm}:${ref.digest.hex}`,
              creator: "validator-test",
              license: "private-local-selected-psd-layer",
              redistributionAllowed: false,
              aiUsed: false,
              transformHistory: [
                "importPsdLayerMaterializationBatch:selected-layer-raw-rgba"
              ],
              relatedOperationIds: ["op_wave47_psd_batch"]
            };
          })
        ]
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: [
          {
            assetId: SOURCE_ASSET_ID,
            rightsStatus: "cleared",
            license: "private-local-selected-psd",
            redistributionAllowed: false
          }
        ]
      }
    }
  });

const createMaterializationEvidence = (
  layer: typeof LAYER_FIXTURES[number],
  sourceRef: BinaryAssetReferenceDto,
  materializedRef: BinaryAssetReferenceDto
) => ({
  evidenceKind: "psd-layer-materialization-evidence-v1" as const,
  materializationId: layer.materializationId,
  sourceLayerRef: createSourceLayerRef(layer),
  mediaType: RAW_RGBA_MEDIA_TYPE,
  byteLength: materializedRef.byteLength,
  digest: materializedRef.digest,
  width: layer.width,
  height: layer.height,
  binaryAssetRef: materializedRef,
  textureId: layer.textureId,
  provenance: {
    sourceFilePath: "test_data/sample_model.psd",
    sourceDigest: sourceRef.digest,
    sourceByteLength: sourceRef.byteLength,
    sourceMediaType: sourceRef.mediaType,
    privacyLabel: "packageLocalAsset" as const,
    publicDistribution: "notPublicDistributable" as const,
    generatedBy: "wave47.browserSelectedLayerBatchMaterialization",
    publicDemoAsset: false
  },
  parser: createParserEvidence(),
  extraction: createExtractionEvidence(layer)
});

const createBatchEvidence = (
  materializedRefs: readonly BinaryAssetReferenceDto[]
) => ({
  schemaVersion: "psd-layer-materialization-batch-operation-evidence-v1" as const,
  operationType: "importPsdLayerMaterializationBatch" as const,
  batchId: "batch_wave47HeadwearEyewear",
  sourceAssetId: SOURCE_ASSET_ID,
  destination: {
    destinationKind: "generatedPartScaffold" as const,
    parentPartId: PARENT_PART_ID
  },
  aggregateStatus: "success" as const,
  selectedLayerCount: LAYER_FIXTURES.length,
  successCount: LAYER_FIXTURES.length,
  failureCount: 0,
  totalMaterializedByteLength: materializedRefs.reduce((sum, ref) => sum + ref.byteLength, 0),
  entries: LAYER_FIXTURES.map((layer, selectedIndex) => ({
    selectedIndex,
    sourceLayerRef: createSourceLayerRef(layer),
    materializationId: layer.materializationId,
    materializedByteLength: materializedRefs[selectedIndex]!.byteLength,
    status: "success" as const,
    generated: {
      partId: layer.partId,
      partDisplayName: layer.displayName,
      drawableId: layer.drawableId,
      drawableDisplayName: layer.displayName,
      textureId: layer.textureId,
      meshId: layer.meshId
    },
    operationId: `op_wave47_batch_${selectedIndex}`,
    diagnostics: []
  })),
  perLayerOperationIds: LAYER_FIXTURES.map((_, index) => `op_wave47_batch_${index}`),
  preflightPolicy: {
    selectedLayerLimit: 4,
    totalRawRgbaByteLimit: 32 * 1024 * 1024,
    mutationPolicy: "preflightBlocksOnAnyFailure" as const,
    silentPartialSuccess: "forbidden" as const
  },
  persistenceBoundary: {
    rawParserObjectPersistence: "notPersisted" as const,
    sourcePsdBytePersistence: "metadataOnlyNoRawBytes" as const,
    materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes" as const,
    photoshopCompositingClaim: "none" as const,
    rendererPixelOracleClaim: "none" as const
  }
});

const addDomainBResultRefs = (input: {
  readonly batchEvidence: BatchEvidenceFixture;
}): BatchEvidenceFixture => ({
  ...input.batchEvidence,
  evidenceId: `evidence_${input.batchEvidence.batchId}`,
  operationId: "op_wave49_import_plan_batch",
  issues: input.batchEvidence.issues ?? [],
  entries: input.batchEvidence.entries.map((entry) => ({
    ...entry,
    approvedLeafRef: createImportPlanSourceLayerRef(LAYER_FIXTURES[entry.selectedIndex]!),
    approvalOrder: entry.selectedIndex,
    resultRefs: {
      batchEvidenceId: `evidence_${input.batchEvidence.batchId}`,
      materializationEvidenceId: entry.materializationId,
      materializationId: entry.materializationId,
      partId: entry.generated.partId,
      drawableId: entry.generated.drawableId,
      meshId: entry.generated.meshId,
      textureId: entry.generated.textureId,
      ...(entry.operationId === undefined ? {} : { operationId: entry.operationId })
    },
    issues: entry.issues ?? []
  }))
});

const createImportPlanIssue = (
  issueKind: ImportPlanIssueKind,
  issueIndex: number,
  layer?: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
): ImportPlanIssueFixture => ({
  issueId: `issue_wave49_${issueIndex}_${issueKind}`,
  issueKind,
  checkId: `operation.importPsdLayerMaterializationBatch.${issueKind}`,
  message: `Synthetic ${issueKind} issue for validator taxonomy coverage.`,
  targetPath: `/payload/importPlan/issues/${issueIndex}`,
  selectedIndex: issueIndex,
  approvalOrder: issueIndex,
  ...(layer === undefined ? {} : { sourceLayerRef: createImportPlanSourceLayerRef(layer) })
});

const createImportPlanBridge = (input: {
  readonly sourceRef: BinaryAssetReferenceDto;
  readonly approvedLayers: readonly typeof LAYER_FIXTURES[number][];
  readonly notApprovedLayers?: readonly (typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture)[];
  readonly approvalStatus?:
    | "approved"
    | "candidatePlanStale"
    | "candidatePlanMismatch"
    | "approvalSelectionMismatch"
    | "preflightBlocked";
  readonly approvalCandidatePlanDigest?: FixtureDigest;
  readonly approvedLeafStatusesByLayerId?: Record<string, readonly ImportPlanCandidateStatus[]>;
  readonly candidateStatusesByLayerId?: Record<string, readonly ImportPlanCandidateStatus[]>;
  readonly generatedStatusByLayerId?: Record<string, ImportPlanGeneratedStatus>;
}) => {
  const notApprovedLayers = input.notApprovedLayers ?? [];
  const candidateLayers = uniqueImportPlanLayers([
    ...input.approvedLayers,
    ...notApprovedLayers
  ]);
  const candidates = candidateLayers.map((layer, candidateIndex) =>
    createImportPlanCandidate({
      layer,
      candidateIndex,
      statuses: input.candidateStatusesByLayerId?.[layer.sourceLayerId] ??
        defaultCandidateStatuses(layer, input.approvedLayers),
      generatedStatus: input.generatedStatusByLayerId?.[layer.sourceLayerId] ?? "previewReady"
    })
  );
  const counts = countImportPlanCandidateStatuses(candidates);
  const collisionCounts = countImportPlanCollisionPreflight(candidates, notApprovedLayers);

  return {
    schemaVersion: "psd-import-plan-approval-bridge-evidence-v1" as const,
    candidatePlan: {
      schemaVersion: "psd-import-plan-candidate-evidence-v1" as const,
      evidenceKind: "psd-import-plan-candidate-evidence-v1" as const,
      planId: "plan_wave48Root",
      candidatePlanDigest: PLAN_DIGEST,
      sourcePsd: createImportPlanSourcePsdIdentity(input.sourceRef),
      parser: createParserEvidence(),
      scope: {
        scopeRef: { kind: "document" as const, id: "psd:root" },
        scopeDisplayPath: [],
        discoveryMode: "recursiveLeafCandidatePreview" as const
      },
      candidates,
      summary: {
        candidateCount: candidates.length,
        approvedCandidateCount: 0,
        notApprovedCandidateCount: counts.notApprovedCandidateCount,
        blockedCandidateCount: counts.blockedCandidateCount,
        hiddenCandidateCount: counts.hiddenCandidateCount,
        unsupportedCandidateCount: counts.unsupportedCandidateCount,
        duplicateNameCount: counts.duplicateNameCount,
        duplicateRefCount: counts.duplicateRefCount,
        generatedIdCollisionCount: counts.generatedIdCollisionCount,
        generatedNameCollisionCount: counts.generatedNameCollisionCount,
        byteCapBlockedCount: counts.byteCapBlockedCount,
        totalByteEstimate: candidates.reduce((sum, candidate) => sum + (candidate.byteEstimate ?? 0), 0),
        approvedByteEstimate: input.approvedLayers.reduce((sum, layer) => sum + getLayerByteLength(layer), 0)
      },
      boundary: {
        rawParserObjectPersistence: "notPersisted" as const,
        sourcePsdBytePersistence: "metadataOnlyNoRawBytes" as const,
        candidateDiscoveryBytePersistence: "metadataOnlyNoRawBytes" as const,
        publicDemoAsset: false as const,
        allLayerOneClickImport: "notProvided" as const,
        recursiveGroupAutoImport: "notProvided" as const
      }
    },
    approval: {
      schemaVersion: "psd-import-plan-approval-evidence-v1" as const,
      evidenceKind: "psd-import-plan-approval-evidence-v1" as const,
      approvalId: "approval_wave48Root",
      candidatePlanDigest: input.approvalCandidatePlanDigest ?? PLAN_DIGEST,
      approvalSelectionDigest: APPROVAL_DIGEST,
      sourcePsd: createImportPlanSourcePsdIdentity(input.sourceRef),
      destination: {
        destinationKind: "generatedPartScaffold" as const,
        parentPartId: PARENT_PART_ID
      },
      approvalStatus: input.approvalStatus ?? "approved",
      approvedLeafRefs: input.approvedLayers.map((layer, approvalOrder) => ({
        approvalOrder,
        sourceLayerRef: createImportPlanSourceLayerRef(layer),
        sourceLayerName: layer.originalName,
        sourceLayerPath: [...layer.groupPath, layer.originalName],
        candidateStatuses: input.approvedLeafStatusesByLayerId?.[layer.sourceLayerId] ?? ["candidate"],
        candidateStatusReasons: [],
        generatedScaffoldPreview: createImportPlanGeneratedScaffold(
          layer,
          input.generatedStatusByLayerId?.[layer.sourceLayerId] ?? "previewReady"
        ),
        resolvedGeneratedIds: createImportPlanGeneratedScaffold(layer, "resolved")
      })),
      notApprovedCandidates: notApprovedLayers.map((layer, candidateIndex) =>
        createImportPlanCandidate({
          layer,
          candidateIndex,
          statuses: input.candidateStatusesByLayerId?.[layer.sourceLayerId] ??
            defaultNotApprovedStatuses(layer),
          generatedStatus: input.generatedStatusByLayerId?.[layer.sourceLayerId] ?? "previewReady"
        })
      ),
      blockedCandidates: notApprovedLayers
        .filter((layer) => defaultNotApprovedStatuses(layer).some((status) =>
          status !== "candidate" && status !== "notApproved" && status !== "duplicateName"
        ))
        .map((layer, candidateIndex) =>
          createImportPlanCandidate({
            layer,
            candidateIndex,
            statuses: input.candidateStatusesByLayerId?.[layer.sourceLayerId] ??
              defaultNotApprovedStatuses(layer),
            generatedStatus: input.generatedStatusByLayerId?.[layer.sourceLayerId] ?? "previewReady"
          })
        ),
      collisionPreflight: collisionCounts,
      issues: [] as ImportPlanIssueFixture[],
      boundary: {
        onlyApprovedLeafRefsPassedToBatch: true as const,
        rawParserObjectPersistence: "notPersisted" as const,
        sourcePsdBytePersistence: "metadataOnlyNoRawBytes" as const,
        materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes" as const,
        publicDemoAsset: false as const,
        allLayerOneClickImport: "notProvided" as const,
        recursiveGroupAutoImport: "notProvided" as const
      }
    }
  };
};

const createSourceLayerRef = (layer: typeof LAYER_FIXTURES[number]) => ({
  sourceAssetId: SOURCE_ASSET_ID,
  sourceLayerId: layer.sourceLayerId,
  sourceLayerName: layer.originalName,
  sourceLayerPath: [...layer.groupPath, layer.originalName]
});

const createImportPlanSourcePsdIdentity = (sourceRef: BinaryAssetReferenceDto) => ({
  sourceAssetId: SOURCE_ASSET_ID,
  sourceFilePath: "test_data/sample_model.psd",
  digest: sourceRef.digest,
  byteLength: sourceRef.byteLength,
  mediaType: "image/vnd.adobe.photoshop",
  sourceBytePersistence: "metadataOnlyNoRawBytes" as const,
  publicDemoAsset: false as const
});

const createImportPlanCandidate = (input: {
  readonly layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture;
  readonly candidateIndex: number;
  readonly statuses: readonly ImportPlanCandidateStatus[];
  readonly generatedStatus: ImportPlanGeneratedStatus;
}) => ({
  candidateIndex: input.candidateIndex,
  sourceLayerRef: createImportPlanSourceLayerRef(input.layer),
  sourceLayerName: getImportPlanLayerName(input.layer),
  sourceLayerPath: getImportPlanLayerPath(input.layer),
  sourceOrder: input.candidateIndex,
  bounds: {
    x: 0,
    y: 0,
    width: getLayerWidth(input.layer),
    height: getLayerHeight(input.layer)
  },
  visibleInSource: getLayerVisibility(input.layer),
  opacityInSource: getLayerVisibility(input.layer) ? 1 : 0,
  byteEstimate: getLayerByteLength(input.layer),
  statuses: [...input.statuses],
  statusReasons: input.statuses.filter((status) => status !== "candidate").map((status) =>
    `status:${status}`
  ),
  approvalBlockedReasons: input.statuses.includes("candidate")
    ? []
    : ["candidate-not-executable-without-explicit-approval"],
  generatedScaffoldPreview: createImportPlanGeneratedScaffold(input.layer, input.generatedStatus)
});

const createImportPlanSourceLayerRef = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
) => ({
  sourceAssetId: SOURCE_ASSET_ID,
  sourceLayerId: layer.sourceLayerId,
  sourceLayerName: getImportPlanLayerName(layer),
  sourceLayerPath: getImportPlanLayerPath(layer)
});

const createImportPlanGeneratedScaffold = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture,
  status: ImportPlanGeneratedStatus
) => ({
  destinationKind: "generatedPartScaffold" as const,
  parentPartId: PARENT_PART_ID,
  partId: layer.partId,
  partDisplayName: getImportPlanLayerPath(layer).join(" / "),
  drawableId: layer.drawableId,
  drawableDisplayName: getImportPlanLayerPath(layer).join(" / "),
  textureId: layer.textureId,
  meshId: layer.meshId,
  status,
  statusReasons: status === "generatedIdCollision" || status === "generatedNameCollision"
    ? [`status:${status}`]
    : []
});

const createParserEvidence = () => ({
  evidenceKind: "psd-parser-evidence-v1" as const,
  parserName: "@webtoon/psd",
  parserPackageName: "@webtoon/psd",
  parserVersion: "0.4.0",
  adapterName: "wave47-browser-explicit-psd-batch-import-adapter",
  adapterVersion: "0.1.0",
  runtime: "browser" as const,
  privateShapePolicy: "parser-private-shape-excluded-v1" as const
});

const createExtractionEvidence = (layer: typeof LAYER_FIXTURES[number]) => ({
  extractionKind: "selectedLayerRasterV1" as const,
  optionsSchemaVersion: "psd-layer-extraction-options-v1" as const,
  options: {
    channelOrder: "rgba",
    includeEffects: false,
    includeHiddenLayers: false,
    composeWithOtherLayers: false,
    layerSelection: layer.sourceLayerId
  }
});

const defaultCandidateStatuses = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture,
  approvedLayers: readonly typeof LAYER_FIXTURES[number][]
): readonly ImportPlanCandidateStatus[] =>
  approvedLayers.some((approvedLayer) => approvedLayer.sourceLayerId === layer.sourceLayerId)
    ? ["candidate", "notApproved"]
    : defaultNotApprovedStatuses(layer);

const defaultNotApprovedStatuses = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
): readonly ImportPlanCandidateStatus[] =>
  getLayerVisibility(layer)
    ? ["candidate", "notApproved"]
    : ["hidden", "unsupported", "byteCapBlocked", "generatedIdCollision", "notApproved"];

const uniqueImportPlanLayers = (
  layers: readonly (typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture)[]
) => {
  const seen = new Set<string>();
  const unique: (typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture)[] = [];
  for (const layer of layers) {
    if (seen.has(layer.sourceLayerId)) {
      continue;
    }
    seen.add(layer.sourceLayerId);
    unique.push(layer);
  }

  return unique;
};

const countImportPlanCandidateStatuses = (
  candidates: readonly ReturnType<typeof createImportPlanCandidate>[]
) => ({
  notApprovedCandidateCount: candidates.filter((candidate) =>
    candidate.statuses.includes("notApproved")
  ).length,
  blockedCandidateCount: candidates.filter((candidate) =>
    candidate.statuses.some((status) =>
      ["hidden", "unsupported", "emptyZeroSize", "duplicateRef", "generatedIdCollision", "generatedNameCollision", "byteCapBlocked"].includes(status)
    )
  ).length,
  hiddenCandidateCount: candidates.filter((candidate) => candidate.statuses.includes("hidden")).length,
  unsupportedCandidateCount: candidates.filter((candidate) =>
    candidate.statuses.includes("unsupported")
  ).length,
  duplicateNameCount: countDuplicateDisplayNamesFromCandidates(candidates),
  duplicateRefCount: countDuplicateSourceRefsFromCandidates(candidates),
  generatedIdCollisionCount: candidates.filter((candidate) =>
    candidate.statuses.includes("generatedIdCollision") ||
    candidate.generatedScaffoldPreview.status === "generatedIdCollision"
  ).length,
  generatedNameCollisionCount: candidates.filter((candidate) =>
    candidate.statuses.includes("generatedNameCollision") ||
    candidate.generatedScaffoldPreview.status === "generatedNameCollision"
  ).length,
  byteCapBlockedCount: candidates.filter((candidate) =>
    candidate.statuses.includes("byteCapBlocked")
  ).length
});

const countImportPlanCollisionPreflight = (
  candidates: readonly ReturnType<typeof createImportPlanCandidate>[],
  notApprovedLayers: readonly (typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture)[]
) => {
  const counts = countImportPlanCandidateStatuses(candidates);

  return {
    duplicateRefCount: counts.duplicateRefCount,
    duplicateNameCount: counts.duplicateNameCount,
    generatedIdCollisionCount: counts.generatedIdCollisionCount,
    generatedNameCollisionCount: counts.generatedNameCollisionCount,
    byteCapBlockedCount: counts.byteCapBlockedCount,
    blockedCandidateCount: counts.blockedCandidateCount,
    notApprovedCandidateCount: notApprovedLayers.length,
    preflightBlockedCount: counts.blockedCandidateCount
  };
};

const countDuplicateDisplayNamesFromCandidates = (
  candidates: readonly ReturnType<typeof createImportPlanCandidate>[]
): number => {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    const normalized = candidate.sourceLayerName.trim().toLocaleLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return [...counts.values()].filter((count) => count > 1).length;
};

const countDuplicateSourceRefsFromCandidates = (
  candidates: readonly ReturnType<typeof createImportPlanCandidate>[]
): number => {
  const counts = new Map<string, number>();
  candidates.forEach((candidate) => {
    const key = `${candidate.sourceLayerRef.sourceAssetId}:${candidate.sourceLayerRef.sourceLayerId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [...counts.values()].filter((count) => count > 1).length;
};

const getImportPlanLayerName = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
): string =>
  "originalName" in layer ? layer.originalName : layer.sourceLayerName;

const getImportPlanLayerPath = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
): readonly string[] =>
  "groupPath" in layer ? [...layer.groupPath, layer.originalName] : layer.sourceLayerPath;

const getLayerByteLength = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
): number =>
  "bytes" in layer ? layer.bytes.byteLength : layer.byteLength;

const getLayerVisibility = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
): boolean =>
  "visibleInSource" in layer ? layer.visibleInSource : true;

const getLayerWidth = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
): number =>
  layer.width;

const getLayerHeight = (
  layer: typeof LAYER_FIXTURES[number] | ImportPlanLayerFixture
): number =>
  layer.height;

const expectSourceAsset = (document: PackageDocumentDto) => {
  const sourceAsset = document.assets.sourceManifest.sourceAssets[0];
  if (sourceAsset === undefined) {
    throw new Error("Expected source asset.");
  }

  return sourceAsset;
};

const expectMaterialization = (document: PackageDocumentDto, index: number) => {
  const materialization = expectSourceAsset(document).psdProfile?.materializationEvidence?.[index];
  if (materialization === undefined) {
    throw new Error(`Expected materialization evidence ${index}.`);
  }

  return materialization;
};

const findAssetBytes = (
  validationReport: ValidationReportDto,
  reportId: string
): ProductPreflightCategoryResultDto => {
  const productPreflight = buildProductPreflightReport({
    reportId,
    createdAt: CREATED_AT,
    validationReports: [validationReport]
  });
  const category = productPreflight.categories.find((candidate) =>
    candidate.category === "assetBytes"
  );

  if (category === undefined) {
    throw new Error("Expected assetBytes category.");
  }

  return category;
};

const expectCheckById = (
  report: ValidationReportDto,
  checkId: string
): ValidationReportDto["checks"][number] => {
  const check = report.checks.find((candidate) => candidate.checkId === checkId);
  if (check === undefined) {
    throw new Error(
      `Expected validation check ${checkId}. Found: ${report.checks.map((candidate) => candidate.checkId).join(", ")}`
    );
  }

  return check;
};

const clone = <TValue>(value: TValue): TValue =>
  JSON.parse(JSON.stringify(value)) as TValue;
