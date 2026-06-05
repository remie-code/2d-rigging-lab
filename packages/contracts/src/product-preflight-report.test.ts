import { describe, expect, it } from "vitest";

import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightArtifactRefDtoSchema,
  ProductPreflightCategoryResultDtoSchema,
  ProductPreflightReportDtoSchema,
  ProductPreflightUnsupportedClaimDtoSchema
} from "./index.js";

describe("product preflight report contract", () => {
  it("parses an MVP-wide product preflight report with truthful product statuses", () => {
    const report = ProductPreflightReportDtoSchema.parse(createValidReport());

    expect(report.schemaVersion).toBe("product-preflight-report-v0");
    expect(report.categories.map((category) => category.category)).toEqual([
      ...PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
    ]);
    expect(report.summary).toMatchObject({
      status: "fail",
      highestSeverity: "blocking",
      categoryCounts: {
        pass: 3,
        warn: 2,
        fail: 1,
        not_supported: 2,
        not_evaluated: 2
      },
      blockingReasonCount: 1,
      unsupportedClaimCount: 2,
      notEvaluatedClaimCount: 2,
      evidenceRefCount: 2,
      diagnosticRefCount: 3
    });
  });

  it("rejects reports that omit required preflight categories", () => {
    const report = createValidReport();
    const result = ProductPreflightReportDtoSchema.safeParse({
      ...report,
      categories: report.categories.filter((category) =>
        category.category !== "assetBytes"
      )
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["categories"]
        })
      ]));
    }
  });

  it("rejects contradictory summary status and counts", () => {
    const report = createValidReport();
    const result = ProductPreflightReportDtoSchema.safeParse({
      ...report,
      summary: {
        ...report.summary,
        status: "pass",
        categoryCounts: {
          pass: 10,
          warn: 0,
          fail: 0,
          not_supported: 0,
          not_evaluated: 0
        },
        unsupportedClaimCount: 0
      }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["summary", "status"]
        }),
        expect.objectContaining({
          code: "custom",
          path: ["summary", "unsupportedClaimCount"]
        })
      ]));
    }
  });

  it("rejects unsupported categories with no unsupported claim explanation", () => {
    const result = ProductPreflightCategoryResultDtoSchema.safeParse({
      category: "persistenceTransport",
      status: "not_supported",
      severity: "warning",
      summary: "Transport support is not available.",
      unsupportedClaims: []
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["unsupportedClaims"]
        })
      ]));
    }
  });

  it("rejects unsupported claims masquerading as supported category outcomes", () => {
    const unsupportedClaim = createUnsupportedClaim({
      claimId: "claim_aiRepair",
      claimKind: "aiRepair",
      capabilityLabel: "AI repair candidate generation",
      explanation: "Wave39 does not implement AI repair candidate generation."
    });

    const result = ProductPreflightCategoryResultDtoSchema.safeParse({
      category: "unsupportedClaims",
      status: "pass",
      severity: "info",
      summary: "Incorrectly passing unsupported claims.",
      unsupportedClaims: [unsupportedClaim]
    });

    expect(ProductPreflightUnsupportedClaimDtoSchema.parse(unsupportedClaim).status).toBe(
      "not_supported"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["unsupportedClaims"]
        })
      ]));
    }
  });

  it("requires established generated evidence artifact suffixes", () => {
    expect(ProductPreflightArtifactRefDtoSchema.parse({
      artifactKind: "guiEvidence",
      path: "generated/gui-evidence/preflight.gui-evidence.json"
    })).toEqual({
      artifactKind: "guiEvidence",
      path: "generated/gui-evidence/preflight.gui-evidence.json"
    });
    expect(ProductPreflightArtifactRefDtoSchema.safeParse({
      artifactKind: "guiEvidence",
      path: "generated/gui-evidence/preflight.json"
    }).success).toBe(false);

    expect(ProductPreflightArtifactRefDtoSchema.parse({
      artifactKind: "demoSafePreflight",
      path: "generated/demo-safe/preflight.demo-safe-preflight.json"
    })).toEqual({
      artifactKind: "demoSafePreflight",
      path: "generated/demo-safe/preflight.demo-safe-preflight.json"
    });
    expect(ProductPreflightArtifactRefDtoSchema.safeParse({
      artifactKind: "demoSafePreflight",
      path: "generated/demo-safe/preflight.json"
    }).success).toBe(false);
  });

  it("allows source materialization evidence refs without parser-specific artifact shapes", () => {
    expect(ProductPreflightArtifactRefDtoSchema.parse({
      artifactKind: "sourceMaterialization",
      path: "generated/source-materialization/wave44-layer-materialization.json"
    })).toEqual({
      artifactKind: "sourceMaterialization",
      path: "generated/source-materialization/wave44-layer-materialization.json"
    });
    expect(ProductPreflightArtifactRefDtoSchema.safeParse({
      artifactKind: "sourceMaterialization",
      path: "generated/source-materialization/wave44-layer-materialization.txt"
    }).success).toBe(false);
  });

  it("rejects not-evaluated categories with no missing-evidence explanation", () => {
    const result = ProductPreflightCategoryResultDtoSchema.safeParse({
      category: "runtimeViewerEvidence",
      status: "not_evaluated",
      severity: "warning",
      summary: "Runtime evidence was not evaluated.",
      notEvaluatedClaims: []
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["notEvaluatedClaims"]
        })
      ]));
    }
  });

  it("rejects not-evaluated claims masquerading as evaluated category outcomes", () => {
    const notEvaluatedClaim = createNotEvaluatedClaim({
      category: "runtimeViewerEvidence",
      claimId: "claim_runtimeEvidenceMissing",
      evidenceKind: "runtimeSnapshot",
      reason: "No runtime snapshot evidence was supplied.",
      requiredEvidenceKinds: ["runtimeSnapshot"],
      actionId: "action_provideRuntimeEvidence"
    });

    for (const status of ["pass", "warn", "fail", "not_supported"] as const) {
      const result = ProductPreflightCategoryResultDtoSchema.safeParse({
        category: "runtimeViewerEvidence",
        status,
        severity: status === "pass" ? "info" : "warning",
        summary: `Incorrectly reporting missing runtime evidence as ${status}.`,
        notEvaluatedClaims: [notEvaluatedClaim],
        blockingReasons: status === "fail"
          ? [
              {
                reasonId: "block_runtimeEvidenceMissing",
                reasonCode: "missingRequiredEvidence",
                severity: "error",
                message: "Runtime evidence is missing.",
                recommendedNextActions: [
                  {
                    actionId: "action_inspectRuntimeEvidence",
                    actionKind: "provideEvidence",
                    summary: "Provide runtime evidence before rerunning preflight.",
                    targetCategory: "runtimeViewerEvidence"
                  }
                ]
              }
            ]
          : undefined,
        unsupportedClaims: status === "not_supported"
          ? [
              createUnsupportedClaim({
                claimId: "claim_runtimeEvidenceUnsupported",
                claimKind: "otherUnsupportedCapability",
                capabilityLabel: "Runtime evidence",
                explanation: "This test claim keeps not_supported structurally valid."
              })
            ]
          : undefined
      });

      expect(result.success, status).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: "custom",
            path: ["notEvaluatedClaims"]
          })
        ]));
      }
    }
  });
});

function createValidReport() {
  return {
    schemaVersion: "product-preflight-report-v0",
    reportId: "preflight_wave39Foundation",
    createdAt: "2026-06-03T00:00:00.000Z",
    packageId: "pkg_preflight",
    packageRevision: 7,
    validatorVersion: "validator-core-test",
    sourceValidationReportIds: ["val_strict"],
    summary: {
      status: "fail",
      highestSeverity: "blocking",
      categoryCounts: {
        pass: 3,
        warn: 2,
        fail: 1,
        not_supported: 2,
        not_evaluated: 2
      },
      blockingReasonCount: 1,
      unsupportedClaimCount: 2,
      notEvaluatedClaimCount: 2,
      evidenceRefCount: 2,
      diagnosticRefCount: 3
    },
    categories: [
      passCategory("modelStructure", "Mandatory model package files parse.", [
        {
          evidenceId: "evidence_manifest",
          artifactRef: {
            artifactKind: "packageManifest",
            path: "manifest.json"
          },
          target: {
            kind: "package",
            id: "pkg_preflight"
          },
          summary: "Package manifest evidence is available.",
          producer: "packageFormat"
        }
      ]),
      notEvaluatedCategory({
        category: "authoringWorkflowEvidence",
        claimId: "claim_guiEvidenceMissing",
        evidenceKind: "guiEvidence",
        summary: "GUI authoring evidence has not been evaluated.",
        reason: "No GUI evidence artifact was supplied for this product preflight report.",
        requiredEvidenceKinds: ["guiEvidence", "operationLog"],
        actionId: "action_provideGuiEvidence"
      }),
      warnCategory(
        "runtimeViewerEvidence",
        "Runtime/viewer evidence is present with a stale snapshot warning.",
        [
          {
            evidenceId: "evidence_runtimeSnapshot",
            artifactRef: {
              artifactKind: "runtimeSnapshot",
              path: "runtime/snapshots/preflight.runtime-snapshot.json",
              snapshotId: "snap_preflight"
            },
            target: {
              kind: "runtimeSnapshot",
              id: "snap_preflight"
            },
            summary: "Viewer runtime snapshot evidence is available.",
            producer: "runtimeCore"
          }
        ],
        [
          {
            checkId: "viewer.runtimeEvidenceStale",
            reportId: "val_strict",
            status: "warning",
            severity: "warning",
            target: {
              kind: "runtimeSnapshot",
              id: "snap_preflight"
            },
            message: "Viewer evidence references an older package revision."
          }
        ]
      ),
      {
        category: "meshTopologyUv",
        status: "fail",
        severity: "blocking",
        summary: "Mesh topology has a blocking triangle index diagnostic.",
        blockingReasons: [
          {
            reasonId: "block_meshTriangleIndex",
            reasonCode: "failingDiagnostic",
            severity: "blocking",
            message: "A mesh triangle references a vertex outside the mesh vertex array.",
            diagnosticRefs: [
              {
                checkId: "mesh.triangleIndexOutOfRange",
                reportId: "val_strict",
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
              {
                actionId: "action_inspectMeshDiagnostic",
                actionKind: "inspectDiagnostic",
                summary: "Inspect the mesh diagnostic before rerunning preflight.",
                targetCategory: "meshTopologyUv"
              }
            ]
          }
        ]
      },
      passCategory("composition", "Composition evidence has no blocking diagnostics."),
      passCategory("rigControlDynamics", "Rig-control and dynamics evidence is valid."),
      notEvaluatedCategory({
        category: "assetBytes",
        claimId: "claim_assetByteEvidenceMissing",
        evidenceKind: "byteAvailability",
        summary: "Asset byte availability has not been evaluated.",
        reason: "No byte availability evidence artifact was supplied.",
        requiredEvidenceKinds: ["byteAvailability"],
        actionId: "action_provideByteEvidence"
      }),
      unsupportedCategory(
        "persistenceTransport",
        "Filesystem package transport is not supported by this preflight report.",
        createUnsupportedClaim({
          claimId: "claim_fileSystemAccessApi",
          claimKind: "fileSystemAccessApi",
          capabilityLabel: "File System Access API package transport",
          explanation: "Wave39 does not implement File System Access API package transport."
        })
      ),
      warnCategory(
        "tutorialDemoReadiness",
        "Tutorial/demo readiness has a warning but no blocking issue.",
        [],
        [
          {
            checkId: "demo.unsafeDependencyClaim",
            reportId: "val_strict",
            status: "warning",
            severity: "warning",
            target: {
              kind: "validationReport",
              id: "val_strict"
            },
            message: "Demo readiness needs review for unsafe wording."
          }
        ]
      ),
      unsupportedCategory(
        "unsupportedClaims",
        "Unsupported product claims are recorded explicitly.",
        createUnsupportedClaim({
          claimId: "claim_aiRepair",
          claimKind: "aiRepair",
          capabilityLabel: "AI repair candidate generation",
          explanation: "Wave39 does not implement AI repair candidate generation."
        })
      )
    ]
  };
}

function passCategory(
  category: string,
  summary: string,
  evidenceRefs: readonly unknown[] = []
) {
  return {
    category,
    status: "pass",
    severity: "info",
    summary,
    evidenceRefs
  };
}

function warnCategory(
  category: string,
  summary: string,
  evidenceRefs: readonly unknown[] = [],
  diagnosticRefs: readonly unknown[] = []
) {
  return {
    category,
    status: "warn",
    severity: "warning",
    summary,
    evidenceRefs,
    diagnosticRefs
  };
}

function unsupportedCategory(category: string, summary: string, unsupportedClaim: unknown) {
  return {
    category,
    status: "not_supported",
    severity: "warning",
    summary,
    unsupportedClaims: [unsupportedClaim]
  };
}

function notEvaluatedCategory(input: {
  readonly category: string;
  readonly claimId: string;
  readonly evidenceKind: string;
  readonly summary: string;
  readonly reason: string;
  readonly requiredEvidenceKinds: readonly string[];
  readonly actionId: string;
}) {
  return {
    category: input.category,
    status: "not_evaluated",
    severity: "warning",
    summary: input.summary,
    notEvaluatedClaims: [createNotEvaluatedClaim(input)]
  };
}

function createNotEvaluatedClaim(input: {
  readonly category: string;
  readonly claimId: string;
  readonly evidenceKind: string;
  readonly reason: string;
  readonly requiredEvidenceKinds: readonly string[];
  readonly actionId: string;
}) {
  return {
    claimId: input.claimId,
    status: "not_evaluated",
    category: input.category,
    evidenceKind: input.evidenceKind,
    reason: input.reason,
    severity: "warning",
    requiredEvidenceKinds: input.requiredEvidenceKinds,
    recommendedNextActions: [
      {
        actionId: input.actionId,
        actionKind: "provideEvidence",
        summary: "Provide the missing evidence and rerun product preflight.",
        targetCategory: input.category
      }
    ]
  };
}

function createUnsupportedClaim(input: {
  readonly claimId: string;
  readonly claimKind: string;
  readonly capabilityLabel: string;
  readonly explanation: string;
}) {
  return {
    claimId: input.claimId,
    status: "not_supported",
    claimKind: input.claimKind,
    capabilityLabel: input.capabilityLabel,
    explanation: input.explanation,
    severity: "warning",
    recommendedNextActions: [
      {
        actionId: `action_${input.claimId.replace(/^claim_/, "")}`,
        actionKind: "recordUnsupportedBoundary",
        summary: "Keep the unsupported boundary explicit in product preflight output.",
        targetCategory: "unsupportedClaims"
      }
    ]
  };
}
