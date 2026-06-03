import { describe, expect, it } from "vitest";
import {
  buildProductPreflightReport,
  buildValidationReport
} from "@private-2d-rigging-lab/validator-core";

import { projectProductPreflightState } from "./product-preflight-state.js";

describe("product preflight state projection", () => {
  it("preserves fail, warn, not_supported, and not_evaluated report vocabulary", () => {
    const validationReport = buildValidationReport({
      reportId: "val_editor_product_preflight_fixture",
      createdAt: "2026-06-04T00:00:00.000Z",
      packageId: "pkg_editor_product_preflight",
      packageRevision: 4,
      checks: [
        {
          checkId: "pkg.schema.fixtureInvalid",
          status: "fail",
          severity: "error",
          phase: "package_schema",
          target: { kind: "package", id: "pkg_editor_product_preflight" },
          message: "Fixture package schema check failed.",
          evidence: ["fixture=product-preflight"],
          relatedAC: [],
          relatedScenarios: [],
          impact: "The package cannot pass product preflight while schema evidence fails."
        },
        {
          checkId: "pkg.schema.fixtureNeedsReview",
          status: "needs_review",
          severity: "warning",
          phase: "package_schema",
          target: { kind: "package", id: "pkg_editor_product_preflight" },
          message: "Fixture package schema evidence needs review.",
          evidence: ["fixture=product-preflight"],
          relatedAC: [],
          relatedScenarios: [],
          impact: "The failed model structure category should still expose warning diagnostics."
        },
        {
          checkId: "mesh.fixtureNeedsReview",
          status: "needs_review",
          severity: "warning",
          phase: "mesh_semantic",
          target: { kind: "mesh", id: "mesh_fixture" },
          message: "Fixture mesh evidence needs review.",
          evidence: ["fixture=product-preflight"],
          relatedAC: [],
          relatedScenarios: [],
          impact: "The mesh category should remain a warning."
        },
        {
          checkId: "byteIntake.unsupportedClaim",
          status: "not_applicable",
          severity: "info",
          phase: "source_import",
          target: { kind: "package", id: "pkg_editor_product_preflight" },
          message: "Parser support is truthfully marked unsupported.",
          evidence: ["claimKind=parser", "claimStatus=unsupported"],
          relatedAC: [],
          relatedScenarios: [],
          impact: "Unsupported parser support must not be treated as pass."
        }
      ]
    });
    const report = buildProductPreflightReport({
      createdAt: "2026-06-04T00:00:00.000Z",
      validationReports: [validationReport]
    });

    const state = projectProductPreflightState(report);

    expect(state.status).toBe("ready");
    expect(state.overallStatus).toBe("fail");
    expect(state.categoryCounts.fail).toBe(1);
    expect(state.categoryCounts.warn).toBe(1);
    expect(state.categoryCounts.not_supported).toBe(1);
    expect(state.categoryCounts.not_evaluated).toBeGreaterThan(0);
    expect(state.blockingIssues).toEqual([
      expect.objectContaining({
        category: "modelStructure",
        reasonCode: "invalidPackageData",
        message: "Fixture package schema check failed."
      })
    ]);
    expect(state.warnings).toHaveLength(2);
    expect(state.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: "modelStructure",
        status: "needs_review",
        message: "Fixture package schema evidence needs review."
      }),
      expect.objectContaining({
        category: "meshTopologyUv",
        status: "needs_review",
        message: "Fixture mesh evidence needs review."
      })
    ]));
    expect(state.unsupportedClaims).toEqual([
      expect.objectContaining({
        category: "unsupportedClaims",
        claimKind: "otherUnsupportedCapability"
      })
    ]);
    expect(state.notEvaluatedClaims.map((claim) => claim.category)).toContain(
      "runtimeViewerEvidence"
    );
  });
});
