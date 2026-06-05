import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema,
  PackageIdSchema,
  RuntimeSnapshotIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ProductPreflightArtifactRefDto,
  ProductPreflightCategoryDto,
  ProductPreflightCategoryResultDto,
  ProductPreflightEvidenceRefDto
} from "@private-2d-rigging-lab/contracts";
import {
  describe,
  expect,
  it
} from "vitest";

import { buildProductPreflightReport } from "./product-preflight-report.js";
import { buildValidationReport } from "./report-builder.js";
import type { ValidationCheckResultInput } from "./validation-report.js";

const CREATED_AT = "2026-06-03T00:00:00.000Z";
const PACKAGE_ID = PackageIdSchema.parse("pkg_preflightProduct");
const SNAPSHOT_ID = RuntimeSnapshotIdSchema.parse("snap_preflightProduct");

describe("product preflight report aggregation", () => {
  it("aggregates valid MVP-like validator evidence into deterministic passing product categories", () => {
    const sourceReport = buildValidationReport({
      reportId: "val_preflightProduct_acceptance",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "acceptance",
      relatedScenarios: ["SC-MVP-003"],
      evidence: {
        operationLogPresent: true,
        operationLogPath: "operations/log.jsonl",
        runtimeSnapshotIds: [SNAPSHOT_ID],
        supplementalGuiEvidenceRefs: []
      }
    });

    const report = buildProductPreflightReport({
      reportId: "preflight_preflightProduct",
      createdAt: CREATED_AT,
      validationReports: [sourceReport],
      categoryEvidenceRefs: {
        assetBytes: [
          createEvidenceRef(
            "evidence_byteAvailability",
            {
              artifactKind: "byteAvailability",
              path: "generated/byte-availability/preflight.json"
            },
            "Byte availability evidence is supplied."
          )
        ],
        persistenceTransport: [
          createEvidenceRef(
            "evidence_transportCapability",
            {
              artifactKind: "transportCapability",
              path: "generated/transport-capability/preflight.json"
            },
            "Transport capability evidence is supplied."
          )
        ],
        tutorialDemoReadiness: [
          createEvidenceRef(
            "evidence_tutorialReadiness",
            {
              artifactKind: "tutorialReadiness",
              path: "generated/tutorial-readiness/preflight.json"
            },
            "Tutorial readiness evidence is supplied."
          )
        ]
      }
    });

    expect(ProductPreflightReportDtoSchema.parse(report).categories.map((category) => category.category)).toEqual([
      ...PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
    ]);
    expect(statusesByCategory(report.categories)).toEqual({
      modelStructure: "pass",
      authoringWorkflowEvidence: "pass",
      runtimeViewerEvidence: "pass",
      meshTopologyUv: "pass",
      composition: "pass",
      rigControlDynamics: "pass",
      assetBytes: "pass",
      persistenceTransport: "pass",
      tutorialDemoReadiness: "pass",
      unsupportedClaims: "pass"
    });
    expect(report.summary).toMatchObject({
      status: "pass",
      highestSeverity: "info",
      categoryCounts: {
        pass: 10,
        warn: 0,
        fail: 0,
        not_supported: 0,
        not_evaluated: 0
      }
    });
  });

  it("reports missing product evidence as not_evaluated instead of passing it", () => {
    const sourceReport = buildValidationReport({
      reportId: "val_preflightProduct_strict",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "strict"
    });

    const report = buildProductPreflightReport({
      reportId: "preflight_missingEvidence",
      createdAt: CREATED_AT,
      validationReports: [sourceReport]
    });

    expect(statusesByCategory(report.categories)).toMatchObject({
      modelStructure: "pass",
      authoringWorkflowEvidence: "not_evaluated",
      runtimeViewerEvidence: "not_evaluated",
      meshTopologyUv: "pass",
      composition: "pass",
      rigControlDynamics: "pass",
      assetBytes: "not_evaluated",
      persistenceTransport: "not_evaluated",
      tutorialDemoReadiness: "not_evaluated",
      unsupportedClaims: "pass"
    });
    expect(report.summary.status).toBe("not_evaluated");
    expect(report.summary.notEvaluatedClaimCount).toBe(5);
    expect(
      report.categories
        .filter((category) => category.status === "not_evaluated")
        .flatMap((category) => category.notEvaluatedClaims)
        .map((claim) => claim.requiredEvidenceKinds)
    ).toEqual([
      ["operationLog", "guiEvidence"],
      ["runtimeSnapshot"],
      ["byteAvailability", "sourceMaterialization"],
      ["transportCapability"],
      ["tutorialReadiness"]
    ]);
  });

  it("does not let wrong-kind category evidence satisfy required product evidence", () => {
    const sourceReport = buildValidationReport({
      reportId: "val_preflightProduct_wrongEvidence",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "strict"
    });

    const report = buildProductPreflightReport({
      reportId: "preflight_wrongEvidence",
      createdAt: CREATED_AT,
      validationReports: [sourceReport],
      categoryEvidenceRefs: {
        assetBytes: [
          createEvidenceRef(
            "evidence_wrongKindOperationLog",
            {
              artifactKind: "operationLog",
              path: "operations/log.jsonl"
            },
            "Wrong-kind operation log evidence must not satisfy asset byte evidence."
          )
        ]
      }
    });
    const assetBytesCategory = findCategory(report.categories, "assetBytes");

    expect(assetBytesCategory.status).toBe("not_evaluated");
    expect(assetBytesCategory.evidenceRefs).toEqual([]);
    expect(assetBytesCategory.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "byteAvailability",
        requiredEvidenceKinds: ["byteAvailability", "sourceMaterialization"]
      })
    ]);
  });

  it("accepts source materialization evidence as asset byte Product Preflight evidence", () => {
    const sourceReport = buildValidationReport({
      reportId: "val_preflightProduct_sourceMaterialization",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "strict"
    });

    const report = buildProductPreflightReport({
      reportId: "preflight_sourceMaterialization",
      createdAt: CREATED_AT,
      validationReports: [sourceReport],
      categoryEvidenceRefs: {
        assetBytes: [
          createEvidenceRef(
            "evidence_sourceMaterialization",
            {
              artifactKind: "sourceMaterialization",
              path: "generated/source-materialization/psd-body.json"
            },
            "Selected PSD layer materialization evidence is supplied."
          )
        ]
      }
    });
    const assetBytesCategory = findCategory(report.categories, "assetBytes");

    expect(assetBytesCategory.status).toBe("pass");
    expect(assetBytesCategory.evidenceRefs).toEqual([
      expect.objectContaining({
        evidenceId: "evidence_sourceMaterialization",
        artifactRef: {
          artifactKind: "sourceMaterialization",
          path: "generated/source-materialization/psd-body.json"
        }
      })
    ]);
  });

  it("keeps targeted diagnostics stable while adding product blocking reasons", () => {
    const sourceReport = buildValidationReport({
      reportId: "val_preflightProduct_mesh",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "strict",
      checks: [
        createCheck({
          checkId: "mesh.triangleIndexOutOfRange",
          status: "fail",
          severity: "blocking",
          phase: "mesh_semantic",
          message: "Triangle index is outside the vertex array."
        }),
        createCheck({
          checkId: "mesh.degenerateTriangle",
          status: "warning",
          severity: "warning",
          phase: "mesh_semantic",
          message: "Mesh triangle has repeated vertices."
        })
      ]
    });
    const originalChecks = JSON.parse(JSON.stringify(sourceReport.checks));

    const report = buildProductPreflightReport({
      reportId: "preflight_meshFailure",
      createdAt: CREATED_AT,
      validationReports: [sourceReport]
    });

    const meshCategory = findCategory(report.categories, "meshTopologyUv");
    expect(meshCategory.status).toBe("fail");
    expect(meshCategory.blockingReasons).toEqual([
      expect.objectContaining({
        reasonCode: "failingDiagnostic",
        severity: "blocking",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "mesh.triangleIndexOutOfRange",
            reportId: "val_preflightProduct_mesh",
            diagnosticIndex: 0,
            severity: "blocking"
          })
        ]
      })
    ]);
    expect(meshCategory.diagnosticRefs).toEqual([
      expect.objectContaining({
        checkId: "mesh.degenerateTriangle",
        status: "warning",
        severity: "warning"
      })
    ]);
    expect(sourceReport.checks).toEqual(originalChecks);
    expect(sourceReport.summary.status).toBe("fail");
  });

  it("omits validation report hashes that are incompatible with product preflight hash constraints", () => {
    const sourceReport = buildValidationReport({
      reportId: "val_preflightProduct_hashRegression",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      packageHash: "sha256:tutorial-mini-model-final-v1",
      profile: "strict",
      checks: [
        createCheck({
          checkId: "mesh.triangleIndexOutOfRange",
          status: "fail",
          severity: "blocking",
          phase: "mesh_semantic",
          message: "Triangle index is outside the vertex array."
        })
      ]
    });

    const report = buildProductPreflightReport({
      reportId: "preflight_hashRegression",
      createdAt: CREATED_AT,
      validationReports: [sourceReport]
    });
    const meshCategory = findCategory(report.categories, "meshTopologyUv");

    expect(sourceReport.packageHash).toBe("sha256:tutorial-mini-model-final-v1");
    expect(report.packageHash).toBeUndefined();
    expect(meshCategory.status).toBe("fail");
    expect(meshCategory.blockingReasons[0]?.diagnosticRefs).toEqual([
      expect.objectContaining({
        checkId: "mesh.triangleIndexOutOfRange",
        reportId: "val_preflightProduct_hashRegression",
        diagnosticIndex: 0
      })
    ]);
  });

  it("keeps truthful unsupported targeted claims explicit without adding forbidden claim kinds", () => {
    const sourceReport = buildValidationReport({
      reportId: "val_preflightProduct_unsupported",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "acceptance",
      checks: [
        createCheck({
          checkId: "byteIntake.unsupportedClaim",
          status: "not_applicable",
          severity: "info",
          phase: "source_import",
          message: "Byte intake claim parser is truthfully marked unsupported.",
          evidence: [
            "claimKind=parser",
            "claimStatus=unsupported"
          ]
        })
      ]
    });

    const report = buildProductPreflightReport({
      reportId: "preflight_truthfulUnsupported",
      createdAt: CREATED_AT,
      validationReports: [sourceReport]
    });
    const unsupportedCategory = findCategory(report.categories, "unsupportedClaims");

    expect(report.summary.status).toBe("not_supported");
    expect(unsupportedCategory.status).toBe("not_supported");
    expect(unsupportedCategory.unsupportedClaims).toEqual([
      expect.objectContaining({
        status: "not_supported",
        claimKind: "otherUnsupportedCapability",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "byteIntake.unsupportedClaim",
            status: "not_applicable",
            severity: "info"
          })
        ]
      })
    ]);
    expect(report.categories.flatMap((category) =>
      category.unsupportedClaims.map((claim) => claim.claimKind)
    )).not.toEqual(expect.arrayContaining([
      "aiRepair",
      "parserImageDecode",
      "archiveFilesystem",
      "rendererPixelOracle",
      "cubismCompatibility"
    ]));
  });

  it("keeps failing unsupported transport capability diagnostics as product failures", () => {
    const sourceReport = buildValidationReport({
      reportId: "val_preflightProduct_transport",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "acceptance",
      checks: [
        createCheck({
          checkId: "transportCapability.unsupported",
          status: "fail",
          severity: "blocking",
          phase: "source_import",
          message: "Package transport capability nativeFilesystemPersistenceV0 is unsupported.",
          evidence: [
            "capabilityId=nativeFilesystemPersistenceV0",
            "status=unsupported"
          ]
        })
      ]
    });

    const report = buildProductPreflightReport({
      reportId: "preflight_unsupportedTransport",
      createdAt: CREATED_AT,
      validationReports: [sourceReport]
    });
    const transportCategory = findCategory(report.categories, "persistenceTransport");

    expect(report.summary.status).toBe("fail");
    expect(transportCategory.status).toBe("fail");
    expect(transportCategory.blockingReasons).toEqual([
      expect.objectContaining({
        reasonCode: "unsupportedRequiredCapability",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "transportCapability.unsupported",
            status: "fail",
            severity: "blocking"
          })
        ]
      })
    ]);
  });

  it("maps PSD unsupported and not-evaluated feature evidence without parser or renderer claims", () => {
    const unsupportedReport = buildValidationReport({
      reportId: "val_preflightProduct_psdUnsupported",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "acceptance",
      checks: [
        createCheck({
          checkId: "asset.psd.featureUnsupported",
          status: "not_applicable",
          severity: "warning",
          phase: "source_import",
          message: "PSD feature psd.fullCompositing is unsupported.",
          evidence: [
            "featureId=psd.fullCompositing",
            "featureStatus=unsupported",
            "photoshopCompositing=notClaimed",
            "rendererPixelOracle=notClaimed"
          ]
        })
      ]
    });

    const unsupportedPreflight = buildProductPreflightReport({
      reportId: "preflight_psdUnsupported",
      createdAt: CREATED_AT,
      validationReports: [unsupportedReport]
    });
    const unsupportedAssetBytes = findCategory(unsupportedPreflight.categories, "assetBytes");

    expect(unsupportedAssetBytes.status).toBe("not_supported");
    expect(unsupportedAssetBytes.unsupportedClaims).toEqual([
      expect.objectContaining({
        claimKind: "otherUnsupportedCapability",
        capabilityLabel: "asset.psd.featureUnsupported",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.featureUnsupported",
            status: "not_applicable",
            severity: "warning"
          })
        ]
      })
    ]);

    const notEvaluatedReport = buildValidationReport({
      reportId: "val_preflightProduct_psdNotEvaluated",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 7,
      profile: "acceptance",
      checks: [
        createCheck({
          checkId: "asset.psd.featureNotEvaluated",
          status: "needs_review",
          severity: "warning",
          phase: "source_import",
          message: "PSD feature psd.layerEffects was not evaluated.",
          evidence: [
            "featureId=psd.layerEffects",
            "featureStatus=notEvaluated"
          ]
        })
      ]
    });

    const notEvaluatedPreflight = buildProductPreflightReport({
      reportId: "preflight_psdNotEvaluated",
      createdAt: CREATED_AT,
      validationReports: [notEvaluatedReport]
    });
    const notEvaluatedAssetBytes = findCategory(notEvaluatedPreflight.categories, "assetBytes");

    expect(notEvaluatedAssetBytes.status).toBe("not_evaluated");
    expect(notEvaluatedAssetBytes.diagnosticRefs).toEqual([]);
    expect(notEvaluatedAssetBytes.unsupportedClaims).toEqual([]);
    expect(notEvaluatedAssetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "validationReport",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.featureNotEvaluated",
            status: "needs_review",
            severity: "warning"
          })
        ]
      })
    ]);
  });
});

const createEvidenceRef = (
  evidenceId: string,
  artifactRef: ProductPreflightArtifactRefDto,
  summary: string
): ProductPreflightEvidenceRefDto => ({
  evidenceId,
  artifactRef,
  target: {
    kind: "package",
    id: PACKAGE_ID
  },
  summary,
  producer: "validatorCore"
});

const createCheck = (
  input: Pick<
    ValidationCheckResultInput,
    "checkId" | "status" | "severity" | "phase" | "message"
  > & {
    readonly evidence?: readonly string[];
  }
): ValidationCheckResultInput => ({
  checkId: input.checkId,
  status: input.status,
  severity: input.severity,
  phase: input.phase,
  target: {
    kind: "package",
    id: PACKAGE_ID
  },
  message: input.message,
  evidence: [...(input.evidence ?? [])],
  impact: "Focused product preflight aggregation fixture."
});

const statusesByCategory = (
  categories: readonly { readonly category: ProductPreflightCategoryDto; readonly status: string }[]
) => Object.fromEntries(categories.map((category) => [category.category, category.status]));

const findCategory = (
  categories: readonly ProductPreflightCategoryResultDto[],
  categoryId: ProductPreflightCategoryDto
) => {
  const category = categories.find((candidate) => candidate.category === categoryId);
  expect(category).toBeDefined();
  if (category === undefined) {
    throw new Error(`Missing category ${categoryId}.`);
  }

  return category;
};
