import { createAuthoringSessionFromPackageDocument } from "@private-2d-rigging-lab/authoring-core";
import { describe, expect, it } from "vitest";

import {
  createBrowserSamplePackageDocument,
  EDITOR_BROWSER_SAMPLE_PACKAGE_HASH
} from "./browser-sample-package.js";
import {
  evaluateViewerRuntimeFromActiveSession,
  evaluateViewerRuntimeFromPackageDocument
} from "./viewer-session-adapter.js";

describe("editor viewer session adapter", () => {
  it("evaluates the same viewer snapshot from an active session and a saved package document", () => {
    const packageDocument = createBrowserSamplePackageDocument();
    const activeSession = createAuthoringSessionFromPackageDocument(packageDocument);
    const request = {
      parameterOverrides: {
        param_preview_body_yaw: 1
      },
      targetIds: ["draw_body", "mesh_body"]
    };

    const activeResult = evaluateViewerRuntimeFromActiveSession(activeSession, {
      packageHash: EDITOR_BROWSER_SAMPLE_PACKAGE_HASH,
      request
    });
    const savedPackageResult = evaluateViewerRuntimeFromPackageDocument(packageDocument, {
      packageHash: EDITOR_BROWSER_SAMPLE_PACKAGE_HASH,
      request
    });

    expect(activeResult.snapshot).toEqual(savedPackageResult.snapshot);
    expect(activeResult.runtimeDiff).toEqual(savedPackageResult.runtimeDiff);
    expect(activeResult.snapshot.context.source.surface).toBe("viewer");
    expect(activeResult.evidence.surface).toBe("viewer");
    expect(activeResult.snapshot.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: "param_preview_body_yaw",
        authoredValue: 1,
        effectiveValue: 1,
        source: "viewerOverride"
      })
    );
    expect(activeResult.runtimeDiff.parameterChanges).toEqual([
      {
        path: "/parameters/param_preview_body_yaw/effectiveValue",
        before: 0,
        after: 1
      }
    ]);
    expect(activeResult.runtimeDiff.drawableChanges).toEqual([
      expect.objectContaining({
        drawableId: "draw_body"
      })
    ]);
  });
});
