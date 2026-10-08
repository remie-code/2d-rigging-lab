import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  applyRuntimeVariantStatusToStageRenderer,
  StageArrangeOverlay
} from "./stage-window-app";
import type {
  RuntimePlayerActiveVariantSelectionState,
  RuntimePlayerVariantControllerStatus
} from "../preload/runtime-variant-bridge-contract";

describe("StageArrangeOverlay", () => {
  it("renders nothing in normal Stage mode", () => {
    expect(
      renderToStaticMarkup(
        createElement(StageArrangeOverlay, { enabled: false })
      )
    ).toBe("");
  });

  it("renders only a drag handle while arrange mode is enabled", () => {
    const markup = renderToStaticMarkup(
      createElement(StageArrangeOverlay, { enabled: true })
    );

    expect(markup).toContain("stage-arrange-overlay");
    expect(markup).toContain("stage-arrange-handle");
    expect(markup).not.toContain("<button");
  });
});

describe("StageWindowApp Variant propagation", () => {
  it("applies the current Runtime Variant selection to the native renderer", () => {
    const appliedSelections:
      Array<RuntimePlayerActiveVariantSelectionState | null> = [];
    const renderer = {
      setActiveVariantSelection: (
        selection: RuntimePlayerActiveVariantSelectionState | null
      ) => {
        appliedSelections.push(selection);
      }
    };
    const status = createVariantStatus();

    applyRuntimeVariantStatusToStageRenderer(renderer, status);

    expect(appliedSelections).toEqual([status.activeVariantSelection]);
  });
});

function createVariantStatus(): RuntimePlayerVariantControllerStatus {
  return {
    schemaVersion: "runtime-player-variant-controller-status-v1",
    state: "ready",
    statusLabel: "Variant switching ready",
    guidance: null,
    controlsEnabled: true,
    groups: [],
    activeVariantSelection: {
      schemaVersion: "runtime-player-active-variant-selection-v1",
      state: "ready",
      updatedAtIso: "2026-06-24T00:00:00.000Z",
      activeSelections: [
        {
          variantGroupId: "vgrp_expression",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_smile"
          }
        }
      ]
    },
    defaultActiveSelections: [],
    updatedAtIso: "2026-06-24T00:00:00.000Z"
  };
}
