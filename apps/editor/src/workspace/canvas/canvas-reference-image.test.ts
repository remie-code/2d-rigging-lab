import {
  createReferenceImageState,
  referenceImagePointToModel,
  updateReferenceImageState
} from "@private-2d-rigging-lab/authoring-core";
import { describe, expect, it } from "vitest";

import { canvasToScreenPoint } from "./canvas-projection";
import { getReferenceImageGesture, previewReferenceImageGesture } from "./canvas-reference-image";

const state = updateReferenceImageState(createReferenceImageState({
  sha256: "0".repeat(64),
  width: 640,
  height: 480,
  byteLength: 100
}), {
  scale: 1.25,
  rotationDegrees: 20,
  translation: { x: -22, y: 84 }
});

describe("reference image canvas gestures", () => {
  it("repositions the pivot without changing the location of any image pixel", () => {
    const imagePoint = { x: 123, y: 85 };
    const modelPoint = referenceImagePointToModel(state.transform, imagePoint);
    const movedPivot = previewReferenceImageGesture({
      state, gesture: "pivot", start: modelPoint, current: modelPoint
    });
    expect(movedPivot.transform.pivot.x).toBeCloseTo(imagePoint.x);
    expect(movedPivot.transform.pivot.y).toBeCloseTo(imagePoint.y);
    expect(movedPivot.transform.origin).toEqual(state.transform.origin);
    expect(referenceImagePointToModel(movedPivot.transform, { x: 640, y: 480 }))
      .toEqual(referenceImagePointToModel(state.transform, { x: 640, y: 480 }));
  });

  it("uniformly scales from each corner and rotates around the same off-center pivot", () => {
    const before = updateReferenceImageState(state, { pivot: { x: 123, y: 85 } });
    const pivot = referenceImagePointToModel(before.transform, before.transform.pivot);
    const view = { zoom: 1.8, pan: { x: 25, y: -120 } };
    for (const x of [0, before.image.width]) {
      for (const y of [0, before.image.height]) {
        const start = referenceImagePointToModel(before.transform, { x, y });
        expect(getReferenceImageGesture(before, view, canvasToScreenPoint(start, view), false))
          .toBe("scale");
        const current = { x: pivot.x + (start.x - pivot.x) * 1.5, y: pivot.y + (start.y - pivot.y) * 1.5 };
        const scaled = previewReferenceImageGesture({ state: before, gesture: "scale", start, current });
        const scaledPivot = referenceImagePointToModel(scaled.transform, before.transform.pivot);
        expect(scaled.transform.scale).toBeCloseTo(before.transform.scale * 1.5);
        expect(scaledPivot.x).toBeCloseTo(pivot.x);
        expect(scaledPivot.y).toBeCloseTo(pivot.y);
      }
    }
    const rotated = previewReferenceImageGesture({
      state: before,
      gesture: "rotate",
      start: { x: pivot.x + 100, y: pivot.y },
      current: { x: pivot.x, y: pivot.y + 100 }
    });
    const rotatedPivot = referenceImagePointToModel(rotated.transform, before.transform.pivot);
    expect(rotated.transform.rotationDegrees).toBeCloseTo(110);
    expect(rotatedPivot.x).toBeCloseTo(pivot.x);
    expect(rotatedPivot.y).toBeCloseTo(pivot.y);
  });
});
