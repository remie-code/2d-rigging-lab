import { describe, expect, it } from "vitest";

import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDiffDtoSchema,
  ProductPreflightRerunAffordanceResponseDtoSchema
} from "./index.js";
import type {
  ProductPreflightCategoryDto,
  ProductPreflightStatusDto,
  Severity
} from "./index.js";

describe("product preflight report diff contract", () => {
  it("parses deterministic session report diff changes and rerun affordance shape", () => {
    const diff = ProductPreflightReportDiffDtoSchema.parse(createValidDiff());

    expect(diff.schemaVersion).toBe("product-preflight-report-diff-v0");
    expect(diff.scope).toMatchObject({
      scopeKind: "sessionReportPair",
      sessionGeneratedReportsOnly: true,
      persistedArtifactCreated: false
    });
    expect(diff.categoryStatusTransitions.map((transition) => transition.category)).toEqual([
      ...PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
    ]);
    expect(diff.summary).toMatchObject({
      beforeStatus: "fail",
      afterStatus: "warn",
      statusChanged: true,
      categoryStatusTransitionCount: 10,
      changedCategoryStatusCount: 3,
      changedCategorySeverityCount: 3,
      changedCategoryTransitionCount: 3,
      blockingReasonChangeCount: 1,
      diagnosticRefChangeCount: 1,
      evidenceRefChangeCount: 1,
      recommendedActionChangeCount: 1,
      unsupportedClaimChangeCount: 1,
      notEvaluatedClaimChangeCount: 1,
      totalChangeCount: 9
    });
    expect(diff.rerunAffordance).toEqual(expect.objectContaining({
      canRequestRerun: true,
      allowedTriggerModes: ["manual", "callerTriggered"],
      automaticRerunAllowed: false,
      autoFixAllowed: false,
      automaticCommitAllowed: false,
      responseShape: expect.objectContaining({
        responseKind: "productPreflightReport",
        sessionGeneratedReportOnly: true,
        persistedArtifactCreated: false,
        automaticCommitAllowed: false,
        autoFixAllowed: false
      })
    }));
  });

  it("keeps not-supported and not-evaluated transitions neutral instead of judgemental", () => {
    const parsed = ProductPreflightReportDiffDtoSchema.parse(createValidDiff());

    expect(findTransition(parsed.categoryStatusTransitions, "assetBytes")).toMatchObject({
      beforeStatus: "not_evaluated",
      afterStatus: "pass",
      statusChanged: true
    });
    expect(findTransition(parsed.categoryStatusTransitions, "persistenceTransport")).toMatchObject({
      beforeStatus: "not_supported",
      afterStatus: "pass",
      statusChanged: true
    });

    const invalid = createValidDiff();
    invalid.categoryStatusTransitions = invalid.categoryStatusTransitions.map(
      (transition, index) => index === 0
        ? {
            ...transition,
            transitionJudgement: "improved"
          }
        : transition
    );

    expect(ProductPreflightReportDiffDtoSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects summary counts that do not match the diff arrays", () => {
    const diff = createValidDiff();
    const result = ProductPreflightReportDiffDtoSchema.safeParse({
      ...diff,
      summary: {
        ...diff.summary,
        evidenceRefChangeCount: 2,
        totalChangeCount: 10
      }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["summary", "evidenceRefChangeCount"]
        })
      ]));
    }
  });

  it("rejects summary before and after status that contradict category transitions", () => {
    const diff = createValidDiff();
    const result = ProductPreflightReportDiffDtoSchema.safeParse({
      ...diff,
      summary: {
        ...diff.summary,
        beforeStatus: "not_supported",
        afterStatus: "pass"
      }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["summary", "beforeStatus"]
        }),
        expect.objectContaining({
          code: "custom",
          path: ["summary", "afterStatus"]
        })
      ]));
    }
  });

  it("rejects summary before and after highest severity that contradict category transitions", () => {
    const diff = createValidDiff();
    const result = ProductPreflightReportDiffDtoSchema.safeParse({
      ...diff,
      summary: {
        ...diff.summary,
        beforeHighestSeverity: "error",
        afterHighestSeverity: "info"
      }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["summary", "beforeHighestSeverity"]
        }),
        expect.objectContaining({
          code: "custom",
          path: ["summary", "afterHighestSeverity"]
        })
      ]));
    }
  });

  it("rejects changed item ids that do not match their before or after payload", () => {
    const diff = createValidDiff();
    const result = ProductPreflightReportDiffDtoSchema.safeParse({
      ...diff,
      evidenceRefChanges: [
        {
          ...diff.evidenceRefChanges[0],
          evidenceId: "evidence_otherRef"
        }
      ]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["evidenceRefChanges", 0, "after", "evidenceId"]
        })
      ]));
    }
  });

  it("rejects rerun affordance responses that imply automatic rerun, auto-fix, or commit", () => {
    const affordance = createValidRerunAffordance();
    const result = ProductPreflightRerunAffordanceResponseDtoSchema.safeParse({
      ...affordance,
      automaticRerunAllowed: true,
      automaticCommitAllowed: true,
      responseShape: {
        ...affordance.responseShape,
        autoFixAllowed: true
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects rerun affordance responses whose available state still carries blockers", () => {
    const result = ProductPreflightRerunAffordanceResponseDtoSchema.safeParse({
      ...createValidRerunAffordance(),
      blockingReasons: [
        {
          reasonCode: "staleReport",
          message: "The report is stale."
        }
      ]
    });

    expect(result.success).toBe(false);
  });
});

function createValidDiff() {
  const categoryStatusTransitions = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map(
    createCategoryTransition
  );

  return {
    schemaVersion: "product-preflight-report-diff-v0",
    diffId: "preflightDiff_wave41DomainA",
    generatedAt: "2026-06-04T00:00:00.000Z",
    scope: {
      scopeKind: "sessionReportPair",
      beforeReportId: "preflight_beforeWave41",
      afterReportId: "preflight_afterWave41",
      packageId: "pkg_preflightDiff",
      beforePackageRevision: 7,
      afterPackageRevision: 8,
      beforePackageHash: "hashBefore",
      afterPackageHash: "hashAfter",
      sessionGeneratedReportsOnly: true,
      persistedArtifactCreated: false
    },
    summary: {
      beforeStatus: "fail",
      afterStatus: "warn",
      statusChanged: true,
      beforeHighestSeverity: "blocking",
      afterHighestSeverity: "warning",
      severityChanged: true,
      categoryStatusTransitionCount: 10,
      changedCategoryStatusCount: 3,
      changedCategorySeverityCount: 3,
      changedCategoryTransitionCount: 3,
      blockingReasonChangeCount: 1,
      diagnosticRefChangeCount: 1,
      evidenceRefChangeCount: 1,
      recommendedActionChangeCount: 1,
      unsupportedClaimChangeCount: 1,
      notEvaluatedClaimChangeCount: 1,
      totalChangeCount: 9
    },
    categoryStatusTransitions,
    blockingReasonChanges: [
      {
        changeKind: "removed",
        category: "meshTopologyUv",
        reasonId: "block_meshTriangleIndex",
        before: createBlockingReason()
      }
    ],
    diagnosticRefChanges: [
      {
        changeKind: "changed",
        container: {
          containerKind: "category",
          category: "runtimeViewerEvidence"
        },
        diagnosticRefKey: {
          checkId: "viewer.runtimeEvidenceStale",
          target: {
            kind: "runtimeSnapshot",
            id: "snap_preflightDiff"
          }
        },
        before: createDiagnosticRef("Viewer evidence references an older package revision."),
        after: createDiagnosticRef("Viewer evidence was refreshed but still has a warning.")
      }
    ],
    evidenceRefChanges: [
      {
        changeKind: "added",
        container: {
          containerKind: "category",
          category: "runtimeViewerEvidence"
        },
        evidenceId: "evidence_runtimeSnapshotAfter",
        after: createRuntimeEvidenceRef()
      }
    ],
    recommendedActionChanges: [
      {
        changeKind: "changed",
        container: {
          containerKind: "blockingReason",
          category: "meshTopologyUv",
          reasonId: "block_meshTriangleIndex"
        },
        actionId: "action_inspectMeshDiagnostic",
        before: createInspectMeshAction(
          "Inspect the mesh diagnostic before rerunning preflight."
        ),
        after: createInspectMeshAction(
          "Inspect the updated mesh diagnostic before rerunning preflight."
        )
      }
    ],
    unsupportedClaimChanges: [
      {
        changeKind: "removed",
        category: "persistenceTransport",
        claimId: "claim_fileSystemAccessApi",
        before: createUnsupportedClaim()
      }
    ],
    notEvaluatedClaimChanges: [
      {
        changeKind: "removed",
        category: "assetBytes",
        claimId: "claim_assetByteEvidenceMissing",
        before: createNotEvaluatedClaim()
      }
    ],
    rerunAffordance: createValidRerunAffordance()
  };
}

function createCategoryTransition(category: ProductPreflightCategoryDto) {
  const [beforeStatus, afterStatus] = statusPairForCategory(category);
  const beforeSeverity = severityForStatus(beforeStatus);
  const afterSeverity = severityForStatus(afterStatus);

  return {
    category,
    beforeStatus,
    afterStatus,
    beforeSeverity,
    afterSeverity,
    statusChanged: beforeStatus !== afterStatus,
    severityChanged: beforeSeverity !== afterSeverity
  };
}

function statusPairForCategory(
  category: ProductPreflightCategoryDto
): readonly [ProductPreflightStatusDto, ProductPreflightStatusDto] {
  if (category === "meshTopologyUv") {
    return ["fail", "warn"];
  }

  if (category === "assetBytes") {
    return ["not_evaluated", "pass"];
  }

  if (category === "persistenceTransport") {
    return ["not_supported", "pass"];
  }

  if (category === "runtimeViewerEvidence") {
    return ["warn", "warn"];
  }

  return ["pass", "pass"];
}

function severityForStatus(status: ProductPreflightStatusDto): Severity {
  if (status === "pass") {
    return "info";
  }

  if (status === "fail") {
    return "blocking";
  }

  return "warning";
}

function createBlockingReason() {
  return {
    reasonId: "block_meshTriangleIndex",
    reasonCode: "failingDiagnostic",
    severity: "blocking",
    message: "A mesh triangle references a vertex outside the mesh vertex array.",
    diagnosticRefs: [
      {
        checkId: "mesh.triangleIndexOutOfRange",
        reportId: "val_beforeWave41",
        diagnosticIndex: 0,
        status: "fail",
        severity: "blocking",
        target: {
          kind: "mesh",
          id: "mesh_body"
        },
        message: "Triangle index is outside the vertex array."
      }
    ],
    recommendedNextActions: [
      createInspectMeshAction("Inspect the mesh diagnostic before rerunning preflight.")
    ]
  };
}

function createDiagnosticRef(message: string) {
  return {
    checkId: "viewer.runtimeEvidenceStale",
    reportId: "val_runtimeViewer",
    diagnosticIndex: 1,
    status: "warning",
    severity: "warning",
    target: {
      kind: "runtimeSnapshot",
      id: "snap_preflightDiff"
    },
    message
  };
}

function createRuntimeEvidenceRef() {
  return {
    evidenceId: "evidence_runtimeSnapshotAfter",
    artifactRef: {
      artifactKind: "runtimeSnapshot",
      path: "runtime/snapshots/snap_preflightDiff.runtime-snapshot.json",
      snapshotId: "snap_preflightDiff"
    },
    target: {
      kind: "runtimeSnapshot",
      id: "snap_preflightDiff"
    },
    summary: "Runtime snapshot evidence is available after rerun.",
    producer: "validatorCore"
  };
}

function createInspectMeshAction(summary: string) {
  return {
    actionId: "action_inspectMeshDiagnostic",
    actionKind: "inspectDiagnostic",
    summary,
    targetCategory: "meshTopologyUv"
  };
}

function createUnsupportedClaim() {
  return {
    claimId: "claim_fileSystemAccessApi",
    status: "not_supported",
    claimKind: "fileSystemAccessApi",
    capabilityLabel: "File System Access API package transport",
    explanation: "File System Access API package transport is not implemented.",
    severity: "warning",
    recommendedNextActions: [
      {
        actionId: "action_fileSystemAccessApi",
        actionKind: "recordUnsupportedBoundary",
        summary: "Keep the unsupported boundary explicit in product preflight output.",
        targetCategory: "persistenceTransport"
      }
    ]
  };
}

function createNotEvaluatedClaim() {
  return {
    claimId: "claim_assetByteEvidenceMissing",
    status: "not_evaluated",
    category: "assetBytes",
    evidenceKind: "byteAvailability",
    reason: "No byte availability evidence artifact was supplied.",
    severity: "warning",
    requiredEvidenceKinds: ["byteAvailability"],
    recommendedNextActions: [
      {
        actionId: "action_provideByteEvidence",
        actionKind: "provideEvidence",
        summary: "Provide byte availability evidence and rerun product preflight.",
        targetCategory: "assetBytes"
      }
    ]
  };
}

function createValidRerunAffordance() {
  return {
    schemaVersion: "product-preflight-rerun-affordance-response-v0",
    affordanceId: "preflightRerun_afterWave41",
    generatedAt: "2026-06-04T00:00:00.000Z",
    sourceReportId: "preflight_afterWave41",
    packageId: "pkg_preflightDiff",
    packageRevision: 8,
    status: "available",
    summary: "Product Preflight can be rerun by a manual or caller-triggered request.",
    canRequestRerun: true,
    allowedTriggerModes: ["manual", "callerTriggered"],
    automaticRerunAllowed: false,
    autoFixAllowed: false,
    automaticCommitAllowed: false,
    requiredInputs: [],
    blockingReasons: [],
    responseShape: {
      responseKind: "productPreflightReport",
      reportSchemaVersion: "product-preflight-report-v0",
      sessionGeneratedReportOnly: true,
      persistedArtifactCreated: false,
      automaticCommitAllowed: false,
      autoFixAllowed: false
    }
  };
}

function findTransition(
  transitions: readonly ReturnType<typeof createCategoryTransition>[],
  category: ProductPreflightCategoryDto
) {
  const transition = transitions.find((candidate) => candidate.category === category);
  expect(transition).toBeDefined();
  if (transition === undefined) {
    throw new Error(`Missing transition for ${category}.`);
  }

  return transition;
}
