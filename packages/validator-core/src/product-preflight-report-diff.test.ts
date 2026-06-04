import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  PackageIdSchema,
  RuntimeSnapshotIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ProductPreflightArtifactRefDto,
  ProductPreflightCategoryDto,
  ProductPreflightCategoryStatusTransitionDto,
  ProductPreflightEvidenceRefDto,
  ProductPreflightReportDto
} from "@private-2d-rigging-lab/contracts";
import {
  describe,
  expect,
  it
} from "vitest";

import { buildProductPreflightReportDiff } from "./product-preflight-report-diff.js";
import {
  buildProductPreflightReport,
  type ProductPreflightCategoryEvidenceRefsInput
} from "./product-preflight-report.js";
import { buildValidationReport } from "./report-builder.js";
import type {
  ValidationCheckResultInput,
  ValidationReportDto
} from "./validation-report.js";

const CREATED_AT = "2026-06-04T00:00:00.000Z";
const AFTER_CREATED_AT = "2026-06-04T00:01:00.000Z";
const PACKAGE_ID = PackageIdSchema.parse("pkg_preflightDiffProduct");
const SNAPSHOT_ID = RuntimeSnapshotIdSchema.parse("snap_preflightDiffProduct");

describe("product preflight report diff", () => {
  it("returns deterministic no-change report transitions independent of category input order", () => {
    const sourceReport = createValidationReport({
      reportId: "val_preflightDiff_stable"
    });
    const beforeReport = buildProductReport({
      reportId: "preflight_beforeStable",
      createdAt: CREATED_AT,
      packageRevision: 7,
      validationReports: [sourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs()
    });
    const afterReport = reorderCategories(buildProductReport({
      reportId: "preflight_afterStable",
      createdAt: AFTER_CREATED_AT,
      packageRevision: 8,
      validationReports: [sourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs()
    }));

    const diff = buildProductPreflightReportDiff({
      beforeReport,
      afterReport
    });

    expect(diff.diffId).toBe("preflightDiff_preflight_beforeStable_preflight_afterStable");
    expect(diff.generatedAt).toBe(AFTER_CREATED_AT);
    expect(diff.scope).toMatchObject({
      scopeKind: "sessionReportPair",
      beforeReportId: "preflight_beforeStable",
      afterReportId: "preflight_afterStable",
      packageId: PACKAGE_ID,
      beforePackageRevision: 7,
      afterPackageRevision: 8,
      sessionGeneratedReportsOnly: true,
      persistedArtifactCreated: false
    });
    expect(diff.categoryStatusTransitions.map((transition) => transition.category)).toEqual([
      ...PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
    ]);
    expect(diff.summary).toMatchObject({
      beforeStatus: "pass",
      afterStatus: "pass",
      statusChanged: false,
      changedCategoryTransitionCount: 0,
      totalChangeCount: 0
    });
    expect(diff.blockingReasonChanges).toEqual([]);
    expect(diff.diagnosticRefChanges).toEqual([]);
    expect(diff.evidenceRefChanges).toEqual([]);
    expect(diff.recommendedActionChanges).toEqual([]);
    expect(diff.unsupportedClaimChanges).toEqual([]);
    expect(diff.notEvaluatedClaimChanges).toEqual([]);
  });

  it("reports category, blocking reason, diagnostic ref, and recommended action transitions", () => {
    const beforeSourceReport = createValidationReport({
      reportId: "val_preflightDiff_mesh",
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
    const afterSourceReport = createValidationReport({
      reportId: "val_preflightDiff_mesh"
    });
    const beforeReport = buildProductReport({
      reportId: "preflight_meshBefore",
      createdAt: CREATED_AT,
      packageRevision: 7,
      validationReports: [beforeSourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs()
    });
    const afterReport = buildProductReport({
      reportId: "preflight_meshAfter",
      createdAt: AFTER_CREATED_AT,
      packageRevision: 8,
      validationReports: [afterSourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs()
    });

    const diff = buildProductPreflightReportDiff({
      beforeReport,
      afterReport
    });

    expect(findTransition(diff.categoryStatusTransitions, "meshTopologyUv")).toMatchObject({
      beforeStatus: "fail",
      afterStatus: "pass",
      beforeSeverity: "blocking",
      afterSeverity: "info",
      statusChanged: true,
      severityChanged: true
    });
    expect(diff.summary).toMatchObject({
      beforeStatus: "fail",
      afterStatus: "pass",
      statusChanged: true,
      changedCategoryTransitionCount: 1,
      blockingReasonChangeCount: 1,
      diagnosticRefChangeCount: 1,
      evidenceRefChangeCount: 0,
      recommendedActionChangeCount: 3
    });
    expect(diff.blockingReasonChanges).toEqual([
      expect.objectContaining({
        changeKind: "removed",
        category: "meshTopologyUv",
        reasonId: "block_meshTopologyUv_0"
      })
    ]);
    expect(diff.diagnosticRefChanges).toEqual([
      expect.objectContaining({
        changeKind: "removed",
        container: {
          containerKind: "blockingReason",
          category: "meshTopologyUv",
          reasonId: "block_meshTopologyUv_0"
        },
        diagnosticRefKey: {
          checkId: "mesh.triangleIndexOutOfRange",
          reportId: "val_preflightDiff_mesh",
          diagnosticIndex: 0,
          target: {
            kind: "package",
            id: PACKAGE_ID
          }
        }
      })
    ]);
    expect(diff.recommendedActionChanges.map((change) => ({
      changeKind: change.changeKind,
      containerKind: change.container.containerKind,
      actionId: change.actionId,
      actionKind: "before" in change ? change.before.actionKind : change.after.actionKind
    }))).toEqual([
      {
        changeKind: "removed",
        containerKind: "report",
        actionId: "action_meshTopologyUv_mesh_triangleIndexOutOfRange_0",
        actionKind: "inspectDiagnostic"
      },
      {
        changeKind: "removed",
        containerKind: "category",
        actionId: "action_meshTopologyUv_mesh_triangleIndexOutOfRange_0",
        actionKind: "inspectDiagnostic"
      },
      {
        changeKind: "removed",
        containerKind: "blockingReason",
        actionId: "action_meshTopologyUv_mesh_triangleIndexOutOfRange_0",
        actionKind: "inspectDiagnostic"
      }
    ]);
  });

  it("reports changed evidence refs with explicit before and after refs", () => {
    const sourceReport = createValidationReport({
      reportId: "val_preflightDiff_evidence"
    });
    const beforeReport = buildProductReport({
      reportId: "preflight_evidenceBefore",
      createdAt: CREATED_AT,
      packageRevision: 7,
      validationReports: [sourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs({
        byteAvailabilityPath: "generated/byte-availability/before.json",
        byteAvailabilitySummary: "Before byte availability evidence."
      })
    });
    const afterReport = buildProductReport({
      reportId: "preflight_evidenceAfter",
      createdAt: AFTER_CREATED_AT,
      packageRevision: 8,
      validationReports: [sourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs({
        byteAvailabilityPath: "generated/byte-availability/after.json",
        byteAvailabilitySummary: "After byte availability evidence."
      })
    });

    const diff = buildProductPreflightReportDiff({
      beforeReport,
      afterReport
    });

    expect(diff.evidenceRefChanges).toEqual([
      expect.objectContaining({
        changeKind: "changed",
        container: {
          containerKind: "category",
          category: "assetBytes"
        },
        evidenceId: "evidence_byteAvailability",
        before: expect.objectContaining({
          artifactRef: {
            artifactKind: "byteAvailability",
            path: "generated/byte-availability/before.json"
          },
          summary: "Before byte availability evidence."
        }),
        after: expect.objectContaining({
          artifactRef: {
            artifactKind: "byteAvailability",
            path: "generated/byte-availability/after.json"
          },
          summary: "After byte availability evidence."
        })
      })
    ]);
    expect(diff.summary.evidenceRefChangeCount).toBe(1);
    expect(diff.summary.totalChangeCount).toBe(1);
  });

  it("keeps not-evaluated claim changes neutral and sourced from report actions", () => {
    const sourceReport = createValidationReport({
      reportId: "val_preflightDiff_notEvaluated"
    });
    const beforeReport = buildProductReport({
      reportId: "preflight_notEvaluatedBefore",
      createdAt: CREATED_AT,
      packageRevision: 7,
      validationReports: [sourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs()
    });
    const afterReport = buildProductReport({
      reportId: "preflight_notEvaluatedAfter",
      createdAt: AFTER_CREATED_AT,
      packageRevision: 8,
      validationReports: [sourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs({
        includeByteAvailability: false
      })
    });

    const diff = buildProductPreflightReportDiff({
      beforeReport,
      afterReport
    });

    expect(findTransition(diff.categoryStatusTransitions, "assetBytes")).toMatchObject({
      beforeStatus: "pass",
      afterStatus: "not_evaluated"
    });
    expect(diff.notEvaluatedClaimChanges).toEqual([
      expect.objectContaining({
        changeKind: "added",
        category: "assetBytes",
        claimId: "claim_assetBytes_notEvaluated",
        after: expect.objectContaining({
          status: "not_evaluated",
          evidenceKind: "byteAvailability",
          recommendedNextActions: [
            expect.objectContaining({
              actionKind: "provideEvidence"
            })
          ]
        })
      })
    ]);
    expect(diff.recommendedActionChanges.map((change) =>
      "before" in change ? change.before.actionKind : change.after.actionKind
    )).toEqual([
      "provideEvidence",
      "provideEvidence",
      "provideEvidence"
    ]);
  });

  it("keeps unsupported claim changes explicit without generating repair actions", () => {
    const beforeSourceReport = createValidationReport({
      reportId: "val_preflightDiff_unsupported"
    });
    const afterSourceReport = createValidationReport({
      reportId: "val_preflightDiff_unsupported",
      checks: [
        createCheck({
          checkId: "byteIntake.unsupportedClaim",
          status: "not_applicable",
          severity: "info",
          phase: "source_import",
          message: "Parser import is truthfully recorded as unsupported.",
          evidence: [
            "claimKind=parser",
            "claimStatus=unsupported"
          ]
        })
      ]
    });
    const beforeReport = buildProductReport({
      reportId: "preflight_unsupportedBefore",
      createdAt: CREATED_AT,
      packageRevision: 7,
      validationReports: [beforeSourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs()
    });
    const afterReport = buildProductReport({
      reportId: "preflight_unsupportedAfter",
      createdAt: AFTER_CREATED_AT,
      packageRevision: 8,
      validationReports: [afterSourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs()
    });

    const diff = buildProductPreflightReportDiff({
      beforeReport,
      afterReport
    });

    expect(findTransition(diff.categoryStatusTransitions, "unsupportedClaims")).toMatchObject({
      beforeStatus: "pass",
      afterStatus: "not_supported"
    });
    expect(diff.unsupportedClaimChanges).toEqual([
      expect.objectContaining({
        changeKind: "added",
        category: "unsupportedClaims",
        after: expect.objectContaining({
          status: "not_supported",
          claimKind: "otherUnsupportedCapability",
          recommendedNextActions: [
            expect.objectContaining({
              actionKind: "recordUnsupportedBoundary"
            })
          ]
        })
      })
    ]);
    expect(diff.recommendedActionChanges.map((change) =>
      "before" in change ? change.before.actionKind : change.after.actionKind
    )).toEqual([
      "recordUnsupportedBoundary",
      "recordUnsupportedBoundary",
      "recordUnsupportedBoundary"
    ]);
    expect(diff.recommendedActionChanges.map((change) =>
      "before" in change ? change.before.actionKind : change.after.actionKind
    )).not.toEqual(expect.arrayContaining([
      "manualAuthoringChange",
      "removeUnsupportedClaim",
      "rerunPreflight"
    ]));
  });

  it("rejects reports with different package ids because the diff scope has one package id", () => {
    const sourceReport = createValidationReport({
      reportId: "val_preflightDiff_packageMismatch"
    });
    const beforeReport = buildProductReport({
      reportId: "preflight_packageBefore",
      createdAt: CREATED_AT,
      packageRevision: 7,
      validationReports: [sourceReport],
      categoryEvidenceRefs: createCompleteEvidenceRefs()
    });
    const afterReport = {
      ...buildProductReport({
        reportId: "preflight_packageAfter",
        createdAt: AFTER_CREATED_AT,
        packageRevision: 8,
        validationReports: [sourceReport],
        categoryEvidenceRefs: createCompleteEvidenceRefs()
      }),
      packageId: PackageIdSchema.parse("pkg_otherPreflightDiffProduct")
    };

    expect(() => buildProductPreflightReportDiff({
      beforeReport,
      afterReport
    })).toThrow(/same package id/);
  });
});

const buildProductReport = (input: {
  readonly reportId: string;
  readonly createdAt: string;
  readonly packageRevision: number;
  readonly validationReports: readonly ValidationReportDto[];
  readonly categoryEvidenceRefs: ProductPreflightCategoryEvidenceRefsInput;
}): ProductPreflightReportDto =>
  buildProductPreflightReport({
    reportId: input.reportId,
    createdAt: input.createdAt,
    packageId: PACKAGE_ID,
    packageRevision: input.packageRevision,
    validationReports: input.validationReports,
    categoryEvidenceRefs: input.categoryEvidenceRefs
  });

const createValidationReport = (input: {
  readonly reportId: string;
  readonly checks?: readonly ValidationCheckResultInput[];
}) =>
  buildValidationReport({
    reportId: input.reportId,
    createdAt: CREATED_AT,
    packageId: PACKAGE_ID,
    packageRevision: 7,
    profile: "acceptance",
    relatedScenarios: ["SC-MVP-003"],
    checks: [...(input.checks ?? [])],
    evidence: {
      operationLogPresent: true,
      operationLogPath: "operations/log.jsonl",
      runtimeSnapshotIds: [SNAPSHOT_ID],
      supplementalGuiEvidenceRefs: []
    }
  });

const createCompleteEvidenceRefs = (input: {
  readonly includeByteAvailability?: boolean;
  readonly byteAvailabilityPath?: string;
  readonly byteAvailabilitySummary?: string;
} = {}): ProductPreflightCategoryEvidenceRefsInput => ({
  ...(input.includeByteAvailability === false
    ? {}
    : {
        assetBytes: [
          createEvidenceRef(
            "evidence_byteAvailability",
            {
              artifactKind: "byteAvailability",
              path: input.byteAvailabilityPath ?? "generated/byte-availability/preflight.json"
            },
            input.byteAvailabilitySummary ?? "Byte availability evidence is supplied."
          )
        ]
      }),
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
  impact: "Focused Product Preflight report diff fixture."
});

const reorderCategories = (report: ProductPreflightReportDto): ProductPreflightReportDto => ({
  ...report,
  categories: [...report.categories].reverse()
});

const findTransition = (
  transitions: readonly ProductPreflightCategoryStatusTransitionDto[],
  category: ProductPreflightCategoryDto
) => {
  const transition = transitions.find((candidate) => candidate.category === category);
  expect(transition).toBeDefined();
  if (transition === undefined) {
    throw new Error(`Missing transition ${category}.`);
  }

  return transition;
};
