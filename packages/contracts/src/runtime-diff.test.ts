import { describe, expect, it } from "vitest";

import { RuntimeDiffSchema } from "./runtime-diff.js";

describe("runtime diff contract", () => {
  it("defaults dedicated drawable runtime state and drawList changes for runtime-diff-v1 payloads", () => {
    expect(
      RuntimeDiffSchema.parse({
        schemaVersion: "runtime-diff-v1",
        beforeSnapshotId: "snap_before",
        afterSnapshotId: "snap_after"
      })
    ).toMatchObject({
      schemaVersion: "runtime-diff-v1",
      beforeSnapshotId: "snap_before",
      afterSnapshotId: "snap_after",
      drawableRuntimeStateChanges: [],
      drawListChanges: []
    });
  });

  it("parses dedicated drawable runtime state and deterministic drawList details", () => {
    expect(
      RuntimeDiffSchema.parse({
        schemaVersion: "runtime-diff-v1",
        beforeSnapshotId: "snap_before",
        afterSnapshotId: "snap_after",
        drawableRuntimeStateChanges: [
          {
            drawableId: "draw_body",
            opacityBefore: 1,
            opacityAfter: 0.5,
            visibleBefore: true,
            visibleAfter: false,
            baseDrawOrderBefore: 0,
            baseDrawOrderAfter: 2,
            evaluatedDrawOrderBefore: 0,
            evaluatedDrawOrderAfter: 3
          }
        ],
        drawListChanges: [
          {
            before: ["draw_body", "draw_head"],
            after: ["draw_head"],
            membershipChanged: true,
            orderChanged: false,
            positionChanges: [
              {
                drawableId: "draw_body",
                beforeIndex: 0
              },
              {
                drawableId: "draw_head",
                beforeIndex: 1,
                afterIndex: 0
              }
            ]
          }
        ]
      })
    ).toMatchObject({
      drawableRuntimeStateChanges: [
        {
          drawableId: "draw_body",
          opacityBefore: 1,
          opacityAfter: 0.5,
          visibleBefore: true,
          visibleAfter: false,
          baseDrawOrderBefore: 0,
          baseDrawOrderAfter: 2,
          evaluatedDrawOrderBefore: 0,
          evaluatedDrawOrderAfter: 3
        }
      ],
      drawListChanges: [
        {
          before: ["draw_body", "draw_head"],
          after: ["draw_head"],
          membershipChanged: true,
          orderChanged: false,
          positionChanges: [
            {
              drawableId: "draw_body",
              beforeIndex: 0
            },
            {
              drawableId: "draw_head",
              beforeIndex: 1,
              afterIndex: 0
            }
          ]
        }
      ]
    });
  });
});
