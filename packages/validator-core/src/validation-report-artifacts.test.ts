import {
  readdirSync,
  readFileSync,
  statSync
} from "node:fs";
import {
  dirname,
  join
} from "node:path";
import { fileURLToPath } from "node:url";

import {
  describe,
  expect,
  it
} from "vitest";

import { buildRuntimeEvidenceReport } from "./runtime-evidence-report.js";
import {
  CANONICAL_OPERATION_LOG_PATH,
  createValidationReportArtifactPath,
  materializeValidationReportArtifact,
  serializeValidationReportArtifactContent
} from "./validation-report-artifacts.js";
import { ValidationReportSchema } from "./validation-report.js";

describe("validation report artifacts", () => {
  it("uses the validation report id as the package-relative artifact path", () => {
    expect(createValidationReportArtifactPath("val_materialized")).toBe(
      "validation/reports/val_materialized.validation.json"
    );
  });

  it("materializes schema-parseable validation report JSON content", () => {
    const report = createReport();
    const artifact = materializeValidationReportArtifact(report);
    const parsedReport = ValidationReportSchema.parse(JSON.parse(artifact.content));

    expect(artifact.path).toBe("validation/reports/val_materialized.validation.json");
    expect(artifact.content.endsWith("\n")).toBe(true);
    expect(parsedReport.reportId).toBe(report.reportId);
    expect(parsedReport.summary.status).toBe("pass");
  });

  it("preserves the canonical operation log evidence path when present", () => {
    const artifact = materializeValidationReportArtifact(createReport());
    const parsedReport = ValidationReportSchema.parse(JSON.parse(artifact.content));

    expect(parsedReport.evidence.operationLogPresent).toBe(true);
    expect(parsedReport.evidence.operationLogPath).toBe(CANONICAL_OPERATION_LOG_PATH);
  });

  it("serializes validation report DTOs deterministically after schema parsing", () => {
    const report = createReport();

    expect(serializeValidationReportArtifactContent(report)).toBe(
      serializeValidationReportArtifactContent({
        ...report,
        evidence: {
          supplementalGuiEvidenceRefs: [],
          runtimeSnapshotIds: ["snap_materialized"],
          operationLogPath: CANONICAL_OPERATION_LOG_PATH,
          operationLogPresent: true
        }
      })
    );
  });
});

describe("validator-core artifact dependency boundary", () => {
  it("does not import forbidden implementation packages or app surfaces", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const sourceFiles = listTypeScriptFiles(sourceDirectory);
    const forbiddenImportPattern =
      /from\s+["'](?:@private-2d-rigging-lab\/(?:authoring-core|operation-core)|.*(?:editor-ui|ai-interface))["']/;
    const offenders = sourceFiles.filter((filePath) =>
      forbiddenImportPattern.test(readFileSync(filePath, "utf8"))
    );

    expect(offenders).toEqual([]);
  });
});

const createReport = () =>
  buildRuntimeEvidenceReport({
    reportId: "val_materialized",
    packageId: "pkg_materializer",
    packageRevision: 4,
    createdAt: "2026-05-29T00:00:00.000Z",
    operationLogPresent: true,
    operationLogPath: CANONICAL_OPERATION_LOG_PATH,
    runtimeSnapshotIds: ["snap_materialized"]
  });

const listTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return path.endsWith(".ts") ? [path] : [];
  });
