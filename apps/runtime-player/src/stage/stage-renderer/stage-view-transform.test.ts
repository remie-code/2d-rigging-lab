import { describe, expect, it } from "vitest";

import { createStageViewport } from "./stage-viewport";
import {
  applyStagePanDelta,
  applyStageWheelZoom,
  createResetStageViewTransform
} from "./stage-view-transform";

describe("stage view transform", () => {
  it("keeps reset view equal to the exported-bounds initial fit", () => {
    const viewport = createStageViewport({
      viewportWidth: 400,
      viewportHeight: 200,
      paddingRatio: 0.1,
      modelBounds: {
        x: 10,
        y: 20,
        width: 100,
        height: 50
      },
      viewTransform: createResetStageViewTransform()
    });

    expect(viewport).toEqual({
      width: 400,
      height: 200,
      stageToViewport: {
        scale: 3.2,
        translate: {
          x: 8,
          y: -44
        }
      }
    });
  });

  it("applies wheel zoom around the pointer and then drag pan", () => {
    const zoomed = applyStageWheelZoom({
      transform: createResetStageViewTransform(),
      wheelDeltaY: -100,
      anchor: {
        x: 100,
        y: 50
      },
      zoomSensitivity: Math.log(2) / 100
    });
    const panned = applyStagePanDelta(zoomed, {
      x: 25,
      y: -10
    });
    const viewport = createStageViewport({
      viewportWidth: 400,
      viewportHeight: 200,
      paddingRatio: 0.1,
      modelBounds: {
        x: 10,
        y: 20,
        width: 100,
        height: 50
      },
      viewTransform: panned
    });

    expect(zoomed.zoomScale).toBeCloseTo(2);
    expect(zoomed.pan.x).toBeCloseTo(-100);
    expect(zoomed.pan.y).toBeCloseTo(-50);
    expect(panned.pan).toEqual({
      x: -75,
      y: -60
    });
    expect(viewport.stageToViewport.scale).toBeCloseTo(6.4);
    expect(viewport.stageToViewport.translate.x).toBeCloseTo(-59);
    expect(viewport.stageToViewport.translate.y).toBeCloseTo(-148);
  });

  it("clamps zoom while keeping the pointer anchor stable", () => {
    const zoomed = applyStageWheelZoom({
      transform: createResetStageViewTransform(),
      wheelDeltaY: -10_000,
      anchor: {
        x: 10,
        y: 20
      },
      minZoomScale: 0.5,
      maxZoomScale: 3
    });

    expect(zoomed.zoomScale).toBe(3);
    expect(zoomed.pan).toEqual({
      x: -20,
      y: -40
    });
  });
});
