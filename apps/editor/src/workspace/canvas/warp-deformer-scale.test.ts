import { describe, expect, it } from "vitest";

import type { CanvasPoint } from "./canvas-projection";
import {
  computeWarpDeformerScaledControlPointOffsets,
  type WarpDeformerScaleHandle,
  type WarpDeformerScaleResult
} from "./warp-deformer-scale";

describe("Warp Deformer keyed scale geometry", () => {
  it.each([
    {
      handle: "leftEdge" as const,
      dragDeltaCanvas: { x: -5, y: 99 },
      expectedOffsets: [
        { x: -5, y: 0 },
        { x: 0, y: 0 },
        { x: -5, y: 0 },
        { x: 0, y: 0 }
      ]
    },
    {
      handle: "rightEdge" as const,
      dragDeltaCanvas: { x: 5, y: 99 },
      expectedOffsets: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ]
    },
    {
      handle: "topEdge" as const,
      dragDeltaCanvas: { x: 99, y: -5 },
      expectedOffsets: [
        { x: 0, y: -5 },
        { x: 0, y: -5 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ]
    },
    {
      handle: "bottomEdge" as const,
      dragDeltaCanvas: { x: 99, y: 5 },
      expectedOffsets: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 5 },
        { x: 0, y: 5 }
      ]
    }
  ])(
    "scales all 2x2 points for $handle while keeping the orthogonal axis unchanged",
    ({ handle, dragDeltaCanvas, expectedOffsets }) => {
      const result = expectScaleOk(
        computeWarpDeformerScaledControlPointOffsets({
          restControlPoints: create2x2RestPoints(),
          controlPointOffsets: createOffsets(4, 0, 0),
          latticeColumns: 2,
          latticeRows: 2,
          handle,
          dragDeltaCanvas
        })
      );

      expect(result.nextOffsets).toEqual(expectedOffsets);
    }
  );

  it.each([
    {
      handle: "topLeftCorner" as const,
      dragDeltaCanvas: { x: -5, y: -5 },
      expectedOffsets: [
        { x: -5, y: -5 },
        { x: 0, y: -5 },
        { x: -5, y: 0 },
        { x: 0, y: 0 }
      ]
    },
    {
      handle: "topRightCorner" as const,
      dragDeltaCanvas: { x: 5, y: -5 },
      expectedOffsets: [
        { x: 0, y: -5 },
        { x: 5, y: -5 },
        { x: 0, y: 0 },
        { x: 5, y: 0 }
      ]
    },
    {
      handle: "bottomLeftCorner" as const,
      dragDeltaCanvas: { x: -5, y: 5 },
      expectedOffsets: [
        { x: -5, y: 0 },
        { x: 0, y: 0 },
        { x: -5, y: 5 },
        { x: 0, y: 5 }
      ]
    },
    {
      handle: "bottomRightCorner" as const,
      dragDeltaCanvas: { x: 5, y: 5 },
      expectedOffsets: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 0, y: 5 },
        { x: 5, y: 5 }
      ]
    }
  ])("scales both axes for $handle with the opposite corner fixed", ({
    handle,
    dragDeltaCanvas,
    expectedOffsets
  }) => {
    const result = expectScaleOk(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints: create2x2RestPoints(),
        controlPointOffsets: createOffsets(4, 0, 0),
        latticeColumns: 2,
        latticeRows: 2,
        handle,
        dragDeltaCanvas
      })
    );

    expect(result.nextOffsets).toEqual(expectedOffsets);
  });

  it("scales a 3x2 lattice from current point bounds and returns a full offset array", () => {
    const result = expectScaleOk(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
          { x: 0, y: 10 },
          { x: 10, y: 10 },
          { x: 20, y: 10 }
        ],
        controlPointOffsets: createOffsets(6, 0, 0),
        latticeColumns: 3,
        latticeRows: 2,
        handle: "rightEdge",
        dragDeltaCanvas: { x: 10, y: 500 }
      })
    );

    expect(result.nextOffsets).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 }
    ]);
  });

  it("uses rest plus current offsets as source points instead of scaling raw offsets", () => {
    const result = expectScaleOk(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints: create2x2RestPoints(),
        controlPointOffsets: [
          { x: 10, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 0 }
        ],
        latticeColumns: 2,
        latticeRows: 2,
        handle: "rightEdge",
        dragDeltaCanvas: { x: 10, y: 0 }
      })
    );

    expect(result.nextOffsets).toEqual([
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 }
    ]);
  });

  it("does not mutate rest points or current offsets", () => {
    const restControlPoints = create2x2RestPoints();
    const controlPointOffsets = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
      { x: 7, y: 8 }
    ];
    const restBefore = structuredClone(restControlPoints);
    const offsetsBefore = structuredClone(controlPointOffsets);

    const result = expectScaleOk(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints,
        controlPointOffsets,
        latticeColumns: 2,
        latticeRows: 2,
        handle: "bottomRightCorner",
        dragDeltaCanvas: { x: 2, y: 3 }
      })
    );

    expect(result.nextOffsets).toHaveLength(4);
    expect(restControlPoints).toEqual(restBefore);
    expect(controlPointOffsets).toEqual(offsetsBefore);
    expect(result.nextOffsets[0]).not.toBe(controlPointOffsets[0]);
  });

  it("guards cardinality mismatch deterministically", () => {
    expect(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints: create2x2RestPoints(),
        controlPointOffsets: createOffsets(3, 0, 0),
        latticeColumns: 2,
        latticeRows: 2,
        handle: "rightEdge",
        dragDeltaCanvas: { x: 1, y: 0 }
      })
    ).toEqual({
      ok: false,
      reason: "cardinalityMismatch",
      expectedControlPointCount: 4,
      actualRestControlPointCount: 4,
      actualOffsetCount: 3
    });
  });

  it("guards non-finite values deterministically", () => {
    expect(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints: create2x2RestPoints(),
        controlPointOffsets: [
          { x: 0, y: 0 },
          { x: Number.NaN, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ],
        latticeColumns: 2,
        latticeRows: 2,
        handle: "rightEdge",
        dragDeltaCanvas: { x: 1, y: 0 }
      })
    ).toEqual({
      ok: false,
      reason: "nonFiniteInput"
    });
  });

  it("guards zero and near-zero source spans on the scaled axis", () => {
    expect(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 10 },
          { x: 0, y: 10 }
        ],
        controlPointOffsets: createOffsets(4, 0, 0),
        latticeColumns: 2,
        latticeRows: 2,
        handle: "leftEdge",
        dragDeltaCanvas: { x: -1, y: 0 }
      })
    ).toEqual({
      ok: false,
      reason: "degenerateSourceSpan",
      axis: "x",
      span: 0,
      minimumSpan: 0.000001
    });

    const nearZeroResult = computeWarpDeformerScaledControlPointOffsets({
      restControlPoints: [
        { x: 0, y: 0 },
        { x: 0.0000005, y: 0 },
        { x: 0, y: 10 },
        { x: 0.0000005, y: 10 }
      ],
      controlPointOffsets: createOffsets(4, 0, 0),
      latticeColumns: 2,
      latticeRows: 2,
      handle: "rightEdge",
      dragDeltaCanvas: { x: 1, y: 0 }
    });

    expect(nearZeroResult).toMatchObject({
      ok: false,
      reason: "degenerateSourceSpan",
      axis: "x",
      minimumSpan: 0.000001
    });
    if (nearZeroResult.ok === true) {
      throw new Error("Expected near-zero source span to be rejected.");
    }
    expect(nearZeroResult.span).toBeCloseTo(0.0000005);
  });

  it("guards invalid lattice dimensions and handle values without throwing", () => {
    expect(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints: create2x2RestPoints(),
        controlPointOffsets: createOffsets(4, 0, 0),
        latticeColumns: 1,
        latticeRows: 2,
        handle: "rightEdge",
        dragDeltaCanvas: { x: 1, y: 0 }
      })
    ).toEqual({
      ok: false,
      reason: "invalidLatticeDimensions"
    });

    expect(
      computeWarpDeformerScaledControlPointOffsets({
        restControlPoints: create2x2RestPoints(),
        controlPointOffsets: createOffsets(4, 0, 0),
        latticeColumns: 2,
        latticeRows: 2,
        handle: "invalidHandle" as WarpDeformerScaleHandle,
        dragDeltaCanvas: { x: 1, y: 0 }
      })
    ).toEqual({
      ok: false,
      reason: "invalidHandle"
    });
  });
});

function create2x2RestPoints(): readonly CanvasPoint[] {
  return [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
    { x: 10, y: 10 }
  ];
}

function createOffsets(count: number, x: number, y: number): readonly CanvasPoint[] {
  return Array.from({ length: count }, () => ({ x, y }));
}

function expectScaleOk(result: WarpDeformerScaleResult): Extract<
  WarpDeformerScaleResult,
  { readonly ok: true }
> {
  expect(result.ok).toBe(true);
  if (result.ok === false) {
    throw new Error(`Expected scale result to succeed: ${result.reason}`);
  }

  return result;
}
