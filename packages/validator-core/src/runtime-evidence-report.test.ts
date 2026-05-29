import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildRuntimeEvidenceReport } from "./runtime-evidence-report.js";
import { buildValidationDiff } from "./validation-diff-builder.js";

describe("validator runtime evidence reports", () => {
  it("includes runtime snapshot ids in report evidence", () => {
    const report = buildRuntimeEvidenceReport({
      reportId: "val_runtime_evidence",
      packageId: "pkg_runtimeEvidence",
      packageRevision: 1,
      createdAt: "2026-05-29T00:00:00.000Z",
      runtimeSnapshotIds: ["snap_before", "snap_after"]
    });

    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_before", "snap_after"]);
    expect(report.evidence.operationLogPresent).toBe(false);
  });

  it("reflects operation log presence and absence in report evidence", () => {
    const absentReport = buildRuntimeEvidenceReport({
      reportId: "val_operation_absent",
      packageId: "pkg_operationEvidence",
      packageRevision: 1,
      createdAt: "2026-05-29T00:00:00.000Z",
      operationLogPresent: false
    });
    const presentReport = buildRuntimeEvidenceReport({
      reportId: "val_operation_present",
      packageId: "pkg_operationEvidence",
      packageRevision: 1,
      createdAt: "2026-05-29T00:00:00.000Z",
      operationLogPresent: true,
      operationLogPath: "operations/log.jsonl"
    });

    expect(absentReport.evidence.operationLogPresent).toBe(false);
    expect(absentReport.evidence.operationLogPath).toBeUndefined();
    expect(presentReport.evidence.operationLogPresent).toBe(true);
    expect(presentReport.evidence.operationLogPath).toBe("operations/log.jsonl");
  });
});

describe("validation diff builder", () => {
  it("reports new failures, resolved failures, and severity changes", () => {
    const baseline = buildRuntimeEvidenceReport({
      reportId: "val_baseline",
      packageId: "pkg_diff",
      packageRevision: 1,
      createdAt: "2026-05-29T00:00:00.000Z",
      checks: [
        {
          checkId: "runtime.drawListEmpty",
          status: "fail",
          severity: "blocking",
          phase: "runtime_load",
          target: {
            kind: "runtimeSnapshot",
            id: "snap_before",
            path: "drawList"
          },
          message: "Runtime snapshot drawList is empty.",
          impact: "Viewer load evidence has no visible drawable to render."
        },
        {
          checkId: "mesh.triangleIndexOutOfRange",
          status: "fail",
          severity: "error",
          phase: "mesh_semantic",
          target: {
            kind: "mesh",
            id: "mesh_body"
          },
          message: "Mesh triangle index references a missing vertex.",
          impact: "Mesh cannot be evaluated safely."
        }
      ]
    });
    const candidate = buildRuntimeEvidenceReport({
      reportId: "val_candidate",
      packageId: "pkg_diff",
      packageRevision: 2,
      createdAt: "2026-05-29T00:00:00.000Z",
      checks: [
        {
          checkId: "mesh.triangleIndexOutOfRange",
          status: "fail",
          severity: "blocking",
          phase: "mesh_semantic",
          target: {
            kind: "mesh",
            id: "mesh_body"
          },
          message: "Mesh triangle index references a missing vertex.",
          impact: "Mesh cannot be evaluated safely."
        },
        {
          checkId: "runtime.loadBlocking",
          status: "fail",
          severity: "blocking",
          phase: "runtime_load",
          target: {
            kind: "package",
            id: "pkg_diff"
          },
          message: "Runtime snapshot evidence cannot be parsed.",
          impact: "Validator cannot prove the package can load into runtime evidence."
        }
      ]
    });

    const diff = buildValidationDiff({ baseline, candidate });

    expect(diff.beforeReportId).toBe("val_baseline");
    expect(diff.afterReportId).toBe("val_candidate");
    expect(diff.newFailures.map((diagnostic) => diagnostic.checkId)).toEqual(["runtime.loadBlocking"]);
    expect(diff.resolvedFailures.map((diagnostic) => diagnostic.checkId)).toEqual(["runtime.drawListEmpty"]);
    expect(diff.severityChanges).toEqual([
      {
        checkId: "mesh.triangleIndexOutOfRange",
        target: {
          kind: "mesh",
          id: "mesh_body"
        },
        before: "error",
        after: "blocking"
      }
    ]);
  });
});

describe("validator-core dependency boundary", () => {
  it("does not import forbidden implementation packages or app surfaces", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const sourceFiles = listTypeScriptFiles(sourceDirectory);
    const forbiddenImportPattern =
      /from\s+["'](?:@private-2d-rigging-lab\/(?:authoring-core|operation-core)|.*(?:editor-ui|ai-interface))["']/;
    const offenders = sourceFiles.filter((filePath) => {
      if (filePath.endsWith("runtime-evidence-report.test.ts")) {
        return false;
      }

      return forbiddenImportPattern.test(readFileSync(filePath, "utf8"));
    });

    expect(offenders).toEqual([]);
  });
});

const listTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return path.endsWith(".ts") ? [path] : [];
  });
