import { describe, expect, it } from "vitest";

import {
  INITIAL_CANVAS_AUTO_FIT_POLICY_STATE,
  resolveCanvasAutoFitPolicy
} from "./canvas-auto-fit-policy";

const READY_VIEWPORT = {
  width: 640,
  height: 480
};

describe("canvas auto-fit policy", () => {
  it("waits for a real viewport before consuming the initial artwork fit", () => {
    const waiting = resolveCanvasAutoFitPolicy({
      state: INITIAL_CANVAS_AUTO_FIT_POLICY_STATE,
      viewport: { width: 0, height: 480 },
      hasRenderableArtwork: true
    });

    expect(waiting.shouldFit).toBe(false);
    expect(waiting.nextState).toEqual(INITIAL_CANVAS_AUTO_FIT_POLICY_STATE);

    const ready = resolveCanvasAutoFitPolicy({
      state: waiting.nextState,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: true
    });

    expect(ready.shouldFit).toBe(true);
    expect(ready.nextState.renderableArtworkFitApplied).toBe(true);
  });

  it("fits the fallback canvas once, then fits the first renderable artwork once", () => {
    const fallback = resolveCanvasAutoFitPolicy({
      state: INITIAL_CANVAS_AUTO_FIT_POLICY_STATE,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: false
    });

    expect(fallback.shouldFit).toBe(true);
    expect(fallback.nextState).toEqual({
      fallbackCanvasFitApplied: true,
      renderableArtworkFitApplied: false
    });

    const repeatedFallback = resolveCanvasAutoFitPolicy({
      state: fallback.nextState,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: false
    });
    expect(repeatedFallback.shouldFit).toBe(false);

    const firstArtwork = resolveCanvasAutoFitPolicy({
      state: repeatedFallback.nextState,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: true
    });
    expect(firstArtwork.shouldFit).toBe(true);

    const repeatedArtwork = resolveCanvasAutoFitPolicy({
      state: firstArtwork.nextState,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: true
    });
    expect(repeatedArtwork.shouldFit).toBe(false);
  });

  it("does not request a fit for Apply-like renderable content changes after the first artwork fit", () => {
    const initialArtwork = resolveCanvasAutoFitPolicy({
      state: INITIAL_CANVAS_AUTO_FIT_POLICY_STATE,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: true
    });
    expect(initialArtwork.shouldFit).toBe(true);

    const afterMeshApply = resolveCanvasAutoFitPolicy({
      state: initialArtwork.nextState,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: true
    });
    expect(afterMeshApply.shouldFit).toBe(false);

    const afterWarpApply = resolveCanvasAutoFitPolicy({
      state: afterMeshApply.nextState,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: true
    });
    expect(afterWarpApply.shouldFit).toBe(false);

    const afterCommittedDeformerEdit = resolveCanvasAutoFitPolicy({
      state: afterWarpApply.nextState,
      viewport: READY_VIEWPORT,
      hasRenderableArtwork: true
    });
    expect(afterCommittedDeformerEdit.shouldFit).toBe(false);
  });
});
