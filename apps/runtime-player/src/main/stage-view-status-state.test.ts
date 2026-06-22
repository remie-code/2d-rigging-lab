import { describe, expect, it } from "vitest";

import {
  RuntimePlayerStageViewStatusState,
  createInitialStageViewStatus,
  createStageViewStatus
} from "./stage-view-status-state";

describe("Runtime Player Stage view status state", () => {
  it("creates a deterministic empty initial status", () => {
    expect(createInitialStageViewStatus()).toEqual({
      status: "empty",
      tone: "neutral",
      statusLabel: "Stage empty",
      message: "No Runtime Export is currently rendered on Stage.",
      details: [],
      updatedAtIso: "1970-01-01T00:00:00.000Z"
    });
  });

  it("normalizes warning diagnostics for Control Window display", () => {
    expect(
      createStageViewStatus(
        {
          status: "warning",
          statusLabel: "Stage rendered with diagnostics",
          message: "Runtime evaluation completed with diagnostics.",
          details: [
            "warning keyform.missingParameter: Missing parameter.",
            "",
            42
          ]
        },
        "2026-06-22T01:02:03.000Z"
      )
    ).toEqual({
      status: "warning",
      tone: "warning",
      statusLabel: "Stage rendered with diagnostics",
      message: "Runtime evaluation completed with diagnostics.",
      details: [
        "warning keyform.missingParameter: Missing parameter."
      ],
      updatedAtIso: "2026-06-22T01:02:03.000Z"
    });
  });

  it("stores the latest reported status", () => {
    const state = new RuntimePlayerStageViewStatusState();

    const nextStatus = state.setReportedStatus(
      {
        status: "ready",
        statusLabel: "Stage ready",
        message: "Stage is rendering the evaluated default pose.",
        details: []
      },
      "2026-06-22T02:03:04.000Z"
    );

    expect(nextStatus).toEqual(state.getStatus());
    expect(state.getStatus()).toMatchObject({
      status: "ready",
      tone: "success",
      updatedAtIso: "2026-06-22T02:03:04.000Z"
    });
  });

  it("converts invalid reports into a human-readable error status", () => {
    expect(createStageViewStatus({ status: "busy" }, "bad-date")).toEqual({
      status: "error",
      tone: "error",
      statusLabel: "Stage error",
      message: "Stage rendering is unavailable.",
      details: [],
      updatedAtIso: "bad-date"
    });
  });
});
