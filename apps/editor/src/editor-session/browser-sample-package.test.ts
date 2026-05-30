import { createAuthoringSessionFromPackageDocument, toRuntimeGraph } from "@private-2d-rigging-lab/authoring-core";
import { PackageDocumentSchema } from "@private-2d-rigging-lab/package-format";
import {
  compareRuntimeSnapshots,
  createInitialRuntimeState,
  defaultRuntimeEvaluationOptions,
  evaluateRuntimeFrame
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { projectEditorPreview } from "../editor-preview/preview-projection.js";
import { EDITOR_BROWSER_SAMPLE_PACKAGE_HASH, createBrowserSamplePackageDocument } from "./browser-sample-package.js";

describe("browser sample package", () => {
  it("parses as a preview-ready private prototype package with a slider parameter", () => {
    const document = createBrowserSamplePackageDocument();
    const parsed = PackageDocumentSchema.parse(document);

    expect(parsed.model.parameters.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: "param_preview_body_yaw",
        displayName: "Preview Body Yaw",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      })
    );
    expect(parsed.model.keyforms.keyformSets).toContainEqual(
      expect.objectContaining({
        evaluator: "linear-1d-v1",
        parameterId: "param_preview_body_yaw",
        target: {
          kind: "mesh",
          id: "mesh_body",
          property: "vertices"
        }
      })
    );
    expect(parsed.assets.sourceManifest.sourceAssets[0]).toEqual(
      expect.objectContaining({
        kind: "generated-fixture-v1",
        importProfile: "split-png-fallback-v1"
      })
    );
  });

  it("evaluates a runtime-visible drawable geometry change from the sample parameter", () => {
    const fixture = createSampleRuntimeFixture();
    const neutral = evaluateSampleAt(fixture, 0, 0);
    const yawRight = evaluateSampleAt(fixture, 1, 1);
    const neutralDrawable = expectBodyDrawable(neutral.snapshot.drawables.find((drawable) => drawable.drawableId === "draw_body"));
    const yawRightDrawable = expectBodyDrawable(
      yawRight.snapshot.drawables.find((drawable) => drawable.drawableId === "draw_body")
    );
    const diff = compareRuntimeSnapshots(neutral.snapshot, yawRight.snapshot).diff;

    expect(neutral.snapshot.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: "param_preview_body_yaw",
        effectiveValue: 0,
        source: "viewerOverride"
      })
    );
    expect(yawRight.snapshot.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: "param_preview_body_yaw",
        effectiveValue: 1,
        source: "viewerOverride"
      })
    );
    expect(yawRight.snapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        keyformSetId: "keyset_preview_body_yaw_vertices",
        evaluator: "linear-1d-v1",
        sampledCoordinates: {
          param_preview_body_yaw: 1
        },
        target: "mesh:mesh_body.vertices",
        samplingStatus: "exact"
      })
    );
    expect(yawRight.snapshot.diagnostics).toEqual([]);
    expect(yawRightDrawable.bounds).toEqual({ x: 30, y: 16, width: 54, height: 62 });
    expect(yawRightDrawable.vertexHash).not.toBe(neutralDrawable.vertexHash);
    expect(diff.drawableChanges).toContainEqual(
      expect.objectContaining({
        drawableId: "draw_body",
        boundsChanged: true,
        vertexHashBefore: neutralDrawable.vertexHash,
        vertexHashAfter: yawRightDrawable.vertexHash
      })
    );
  });

  it("projects the sample parameter effect through the editor preview projection", () => {
    const fixture = createSampleRuntimeFixture();
    const neutral = evaluateSampleAt(fixture, 0, 0);
    const yawRight = evaluateSampleAt(fixture, 1, 1);
    const projection = projectEditorPreview({
      snapshot: yawRight.snapshot,
      runtimeDiff: compareRuntimeSnapshots(neutral.snapshot, yawRight.snapshot).diff,
      canvasSize: createBrowserSamplePackageDocument().model.graph.canvasSize,
      drawableNames: {
        draw_body: "Body"
      }
    });
    const projectedBody = projection.drawables.find((drawable) => drawable.drawableId === "draw_body");

    expect(projection.drawList).toEqual(["draw_body"]);
    expect(projection.diff).toEqual(
      expect.objectContaining({
        drawableGeometryChangeCount: 1,
        affectedDrawableIds: ["draw_body"]
      })
    );
    expect(projection.keyformSamples.byTarget).toContainEqual({
      target: "mesh:mesh_body.vertices",
      count: 1,
      evaluators: ["linear-1d-v1"]
    });
    expect(projectedBody).toEqual(
      expect.objectContaining({
        drawableId: "draw_body",
        name: "Body",
        bounds: { x: 30, y: 16, width: 54, height: 62 }
      })
    );
  });
});

const createSampleRuntimeFixture = () => {
  const document = createBrowserSamplePackageDocument();
  const session = createAuthoringSessionFromPackageDocument(document);
  const graph = toRuntimeGraph(session, {
    packageHash: EDITOR_BROWSER_SAMPLE_PACKAGE_HASH
  });
  const state = createInitialRuntimeState(graph, {
    packageId: graph.packageId,
    packageRevision: graph.packageRevision,
    packageHash: EDITOR_BROWSER_SAMPLE_PACKAGE_HASH,
    resetReasons: ["packageLoad"]
  });

  return { graph, state };
};

const evaluateSampleAt = (
  fixture: ReturnType<typeof createSampleRuntimeFixture>,
  frameIndex: number,
  bodyYaw: number
) =>
  evaluateRuntimeFrame(
    fixture.graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex,
      deltaTimeMs: 0,
      authoredParameterValues: {
        param_preview_body_yaw: bodyYaw
      }
    },
    fixture.state,
    {
      ...defaultRuntimeEvaluationOptions(),
      snapshotDetail: "full"
    },
    { source: { surface: "preview" } }
  );

const expectBodyDrawable = <TDrawable>(drawable: TDrawable | undefined): TDrawable => {
  expect(drawable).toBeDefined();
  return drawable as TDrawable;
};
