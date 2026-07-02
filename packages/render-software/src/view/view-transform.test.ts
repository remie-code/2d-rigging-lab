import { describe, it, expect } from "vitest";

import {
  resolveSoftwareRenderView,
  stagePointToImagePixel,
  imagePixelToStagePoint,
  pixelCenterToStagePoint,
  type SoftwareRenderView
} from "./view-transform.js";

const baseView: SoftwareRenderView = {
  stageViewport: { minX: -1, minY: -1, width: 2, height: 2 },
  outputWidth: 4,
  outputHeight: 4
};

describe("view-transform", () => {
  it("maps the stage viewport corners to the image edges", () => {
    const view = resolveSoftwareRenderView(baseView);
    // Top-left stage corner -> image pixel edge (0,0).
    expect(stagePointToImagePixel(view, { x: -1, y: -1 })).toEqual({ x: 0, y: 0 });
    // Bottom-right stage corner -> image pixel edge (W,H).
    expect(stagePointToImagePixel(view, { x: 1, y: 1 })).toEqual({ x: 4, y: 4 });
  });

  it("keeps stage +Y pointing down (increasing image rows)", () => {
    const view = resolveSoftwareRenderView(baseView);
    const top = stagePointToImagePixel(view, { x: 0, y: -1 });
    const bottom = stagePointToImagePixel(view, { x: 0, y: 1 });
    expect(bottom.y).toBeGreaterThan(top.y);
  });

  it("maps a known stage point to the expected pixel", () => {
    const view = resolveSoftwareRenderView(baseView);
    // Stage origin (0,0) is the center of a 2x2 stage rect -> image center (2,2).
    expect(stagePointToImagePixel(view, { x: 0, y: 0 })).toEqual({ x: 2, y: 2 });
  });

  it("round-trips stage <-> pixel deterministically (forward then inverse)", () => {
    const view = resolveSoftwareRenderView(baseView);
    const samples = [
      { x: -1, y: -1 },
      { x: 0, y: 0 },
      { x: 0.37, y: -0.42 },
      { x: 0.9, y: 0.9 }
    ];
    for (const stagePoint of samples) {
      const pixel = stagePointToImagePixel(view, stagePoint);
      const roundTripped = imagePixelToStagePoint(view, pixel);
      expect(roundTripped.x).toBeCloseTo(stagePoint.x, 12);
      expect(roundTripped.y).toBeCloseTo(stagePoint.y, 12);
    }
  });

  it("round-trips pixel <-> stage deterministically (inverse then forward)", () => {
    const view = resolveSoftwareRenderView(baseView);
    const pixels = [
      { x: 0.5, y: 0.5 },
      { x: 2.5, y: 1.5 },
      { x: 3.5, y: 3.5 }
    ];
    for (const pixel of pixels) {
      const stagePoint = imagePixelToStagePoint(view, pixel);
      const roundTripped = stagePointToImagePixel(view, stagePoint);
      expect(roundTripped.x).toBeCloseTo(pixel.x, 12);
      expect(roundTripped.y).toBeCloseTo(pixel.y, 12);
    }
  });

  it("pixelCenterToStagePoint maps pixel index center back to stage", () => {
    const view = resolveSoftwareRenderView(baseView);
    // Pixel (0,0) center is image (0.5,0.5) -> stage.
    const stage = pixelCenterToStagePoint(view, 0, 0);
    const backToPixel = stagePointToImagePixel(view, stage);
    expect(backToPixel.x).toBeCloseTo(0.5, 12);
    expect(backToPixel.y).toBeCloseTo(0.5, 12);
  });

  it("normalizes degenerate view specs so the transform stays invertible", () => {
    const view = resolveSoftwareRenderView({
      stageViewport: { minX: Number.NaN, minY: 0, width: 0, height: Number.NaN },
      outputWidth: 0,
      outputHeight: -5
    });
    expect(view.outputWidth).toBe(1);
    expect(view.outputHeight).toBe(1);
    expect(Number.isFinite(view.pixelsPerStageX)).toBe(true);
    expect(Number.isFinite(view.pixelsPerStageY)).toBe(true);
    // Round trip still works.
    const pixel = stagePointToImagePixel(view, { x: 0.25, y: 0.25 });
    const back = imagePixelToStagePoint(view, pixel);
    expect(back.x).toBeCloseTo(0.25, 12);
    expect(back.y).toBeCloseTo(0.25, 12);
  });
});
