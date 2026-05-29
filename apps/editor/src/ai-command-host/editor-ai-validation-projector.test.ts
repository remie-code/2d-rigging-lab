import { describe, expect, it } from "vitest";

import { createEditorSessionAdapter } from "../editor-session/index.js";
import { projectEditorAiValidation } from "./editor-ai-validation-projector.js";

describe("editor AI validation projector", () => {
  it("projects the current editor package document into a validatePackage result", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T05:00:00.000Z")
    });
    const snapshot = adapter.createPersistenceSnapshot();

    const result = projectEditorAiValidation({
      packageDocument: snapshot.document,
      payload: {
        profile: "editorIncremental",
        packageRevision: snapshot.packageRevision
      },
      createdAt: "2026-05-29T05:00:00.000Z"
    });

    expect(result).toMatchObject({
      reportId: "val_editor_browser_sample_editorIncremental",
      report: {
        schemaVersion: "validation-report-v1",
        reportId: "val_editor_browser_sample_editorIncremental",
        createdAt: "2026-05-29T05:00:00.000Z",
        packageId: "pkg_editor_browser_sample",
        packageRevision: 0,
        profile: "editorIncremental",
        summary: {
          status: "pass"
        },
        checks: []
      }
    });
  });

  it("uses validator-core package schema checks for strict validation failures", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T05:00:00.000Z")
    });
    const snapshot = adapter.createPersistenceSnapshot();
    const invalidPackageDocument = {
      ...snapshot.document,
      model: {
        ...snapshot.document.model,
        drawables: undefined
      }
    };

    const result = projectEditorAiValidation({
      packageDocument: invalidPackageDocument,
      payload: {
        profile: "strict"
      },
      createdAt: "2026-05-29T05:00:00.000Z"
    });

    expect(result.reportId).toBe(result.report.reportId);
    expect(result.report).toMatchObject({
      packageId: "pkg_editor_browser_sample",
      packageRevision: 0,
      profile: "strict",
      summary: {
        status: "fail",
        highestSeverity: "blocking"
      }
    });
    expect(result.report.checks.map((check) => check.checkId)).toContain(
      "pkg.schema.requiredFileMissing"
    );
  });
});
