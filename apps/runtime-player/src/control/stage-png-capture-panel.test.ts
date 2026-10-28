import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getStagePngCaptureAvailability,
  StagePngCapturePanel
} from "./stage-png-capture-panel";
import type {
  RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";
import type { RuntimeExportStatus } from "../preload/runtime-export-bridge-contract";

describe("getStagePngCaptureAvailability", () => {
  it("is available only with a loaded model and a live Stage Window", () => {
    expect(
      getStagePngCaptureAvailability({
        runtimeExportStatus: createLoadedStatus(),
        stageState: createStageState("created"),
        busy: false
      })
    ).toEqual({ available: true, label: "Ready" });
  });

  it("is held while the model is not loaded", () => {
    for (const runtimeExportStatus of [
      null,
      createEmptyStatus(),
      createLoadingStatus()
    ]) {
      expect(
        getStagePngCaptureAvailability({
          runtimeExportStatus,
          stageState: createStageState("created"),
          busy: false
        })
      ).toEqual({ available: false, label: "Load a model to capture" });
    }
  });

  it("is held while the Stage Window is closed or not known yet", () => {
    expect(
      getStagePngCaptureAvailability({
        runtimeExportStatus: createLoadedStatus(),
        stageState: createStageState("destroyed"),
        busy: false
      })
    ).toEqual({ available: false, label: "Stage Window closed" });
    expect(
      getStagePngCaptureAvailability({
        runtimeExportStatus: createLoadedStatus(),
        stageState: null,
        busy: false
      })
    ).toEqual({ available: false, label: "Checking" });
  });

  it("is held while a capture is in flight", () => {
    expect(
      getStagePngCaptureAvailability({
        runtimeExportStatus: createLoadedStatus(),
        stageState: createStageState("created"),
        busy: true
      })
    ).toEqual({ available: false, label: "Capturing" });
  });
});

describe("StagePngCapturePanel", () => {
  it("renders Capture PNG enabled and Open Folder when capture is available", () => {
    const markup = renderPanel({
      runtimeExportStatus: createLoadedStatus(),
      stageState: createStageState("created")
    });

    expect(markup).toContain("Thumbnail Capture");
    expect(markup).toContain("Pictures\\Runtime Player");
    expect(readButton(markup, "Capture PNG")).not.toContain('disabled=""');
    expect(readButton(markup, "Open Folder")).not.toContain('disabled=""');
  });

  it("disables only Capture PNG while no model is loaded", () => {
    const markup = renderPanel({
      runtimeExportStatus: createEmptyStatus(),
      stageState: createStageState("created")
    });

    expect(readButton(markup, "Capture PNG")).toContain('disabled=""');
    expect(readButton(markup, "Open Folder")).not.toContain('disabled=""');
  });
});

function renderPanel(input: {
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly busy?: boolean;
}): string {
  return renderToStaticMarkup(
    createElement(StagePngCapturePanel, {
      runtimeExportStatus: input.runtimeExportStatus,
      stageState: input.stageState,
      busy: input.busy ?? false,
      onCapturePng: () => undefined,
      onOpenFolder: () => undefined
    })
  );
}

function readButton(markup: string, label: string): string {
  const labelIndex = markup.indexOf(`>${label}<`);
  expect(labelIndex).toBeGreaterThanOrEqual(0);
  const buttonStart = markup.lastIndexOf("<button", labelIndex);

  return markup.slice(buttonStart, labelIndex);
}

function createStageState(
  windowState: "created" | "destroyed"
): RuntimePlayerStageStateSnapshot {
  return {
    stageWindow: {
      windowState,
      bounds: null
    }
  } as RuntimePlayerStageStateSnapshot;
}

function createEmptyStatus(): RuntimeExportStatus {
  return {
    status: "empty",
    loaded: false,
    statusLabel: "No Runtime Export loaded"
  };
}

function createLoadingStatus(): RuntimeExportStatus {
  return {
    status: "loading",
    loaded: false,
    statusLabel: "Loading Runtime Export",
    directoryPath: "C:\\exports\\astra-chan-runtime",
    operation: "manual-open"
  };
}

function createLoadedStatus(): RuntimeExportStatus {
  return {
    status: "loaded",
    loaded: true,
    statusLabel: "Runtime Export loaded",
    directoryPath: "C:\\exports\\astra-chan-runtime",
    loadedAtIso: "2026-10-28T06:00:00.000Z",
    summary: {} as never,
    operation: "manual-open"
  };
}
