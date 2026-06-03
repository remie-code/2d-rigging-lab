import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema,
  type ProductPreflightCategoryDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  ObserveProductPreflightReportResultSchema,
  observeProductPreflightReport
} from "./ai-product-preflight-observation.js";

describe("AI product preflight observation", () => {
  it("observes a supplied product preflight report with deterministic category and evidence ordering", () => {
    const report = createProductPreflightReport([
      ...PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
    ].reverse());

    const first = observeProductPreflightReport({ report });
    const second = observeProductPreflightReport({ report });

    expect(ObserveProductPreflightReportResultSchema.parse(first)).toEqual(first);
    expect(first).toEqual(second);
    expect(first.categories.map((category) => category.category)).toEqual([
      ...PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
    ]);
    expect(first.evidenceRefs.map((evidenceRef) => evidenceRef.evidenceId)).toEqual([
      "evidence_manifest",
      "evidence_runtimeSnapshot"
    ]);
    expect(first.transcriptEvidenceRefs).toEqual([
      "evidence_manifest",
      "evidence_runtimeSnapshot"
    ]);
    expect(first.categories.find((category) =>
      category.category === "runtimeViewerEvidence"
    )?.evidenceRefIds).toEqual(["evidence_runtimeSnapshot"]);
    expect(first.transcriptEvidenceRefs.every((evidenceRef) => evidenceRef.length > 0)).toBe(true);
  });
});

const createProductPreflightReport = (
  categoryOrder: readonly ProductPreflightCategoryDto[] = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
): ReturnType<typeof ProductPreflightReportDtoSchema.parse> =>
  ProductPreflightReportDtoSchema.parse({
  schemaVersion: "product-preflight-report-v0",
  reportId: "preflight_aiObservation",
  createdAt: "2026-06-03T00:00:00.000Z",
  packageId: "pkg_aiObservation",
  packageRevision: 7,
  packageHash: "sha256-ai-observation",
  validatorVersion: "validator-test",
  sourceValidationReportIds: ["val_aiObservation"],
  summary: {
    status: "pass",
    highestSeverity: "info",
    categoryCounts: {
      pass: PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.length,
      warn: 0,
      fail: 0,
      not_supported: 0,
      not_evaluated: 0
    },
    blockingReasonCount: 0,
    unsupportedClaimCount: 0,
    notEvaluatedClaimCount: 0,
    evidenceRefCount: 2,
    diagnosticRefCount: 0
  },
  categories: categoryOrder.map((category) => ({
    category,
    status: "pass",
    severity: "info",
    summary: `${category} evidence is available.`,
    evidenceRefs: category === "modelStructure"
      ? [
          {
            evidenceId: "evidence_manifest",
            artifactRef: {
              artifactKind: "packageManifest",
              path: "manifest.json"
            },
            target: {
              kind: "package",
              id: "pkg_aiObservation"
            },
            summary: "Package manifest evidence is available.",
            producer: "packageFormat"
          }
        ]
      : category === "runtimeViewerEvidence"
        ? [
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
              producer: "viewer"
            }
          ]
        : []
  }))
});
