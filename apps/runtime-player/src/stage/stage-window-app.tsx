import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type {
  RuntimeExportStatus,
  RuntimeExportLoadedPayload
} from "../preload/runtime-export-bridge-contract";
import type { RuntimePlayerStageViewStatusReport } from "../preload/runtime-player-bridge-contract";
import {
  createStaticStageCanvasRenderer,
  type StaticStageCanvasRenderer
} from "./stage-renderer/static-stage-canvas-renderer";

type StageRenderState = "empty" | "loaded" | "error";

export function StageWindowApp(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderState, setRenderState] = useState<StageRenderState>("empty");

  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (canvas === null) {
      return () => {
        active = false;
      };
    }

    let renderer: StaticStageCanvasRenderer;
    try {
      renderer = createStaticStageCanvasRenderer(canvas);
    } catch (error) {
      console.error("Stage renderer setup failed.", error);
      reportStageViewStatus(createStageErrorStatusReport({
        message: "Stage renderer setup failed.",
        error
      }));
      setRenderState("error");
      return () => {
        active = false;
      };
    }

    reportStageViewStatus(createStageEmptyStatusReport());

    const renderPayload = (payload: RuntimeExportLoadedPayload): void => {
      if (!active) {
        return;
      }

      try {
        const result = renderer.setPayload(payload);
        reportStageViewStatus(createStageLoadedStatusReport(result));
        setRenderState("loaded");
        applyLatestLiveParameterFrame(renderer);
      } catch (error) {
        console.error("Stage render failed.", error);
        clearRendererAfterError(renderer);
        reportStageViewStatus(createStageErrorStatusReport({
          message: "Stage render failed.",
          error
        }));
        setRenderState("error");
      }
    };

    const clearStage = (): void => {
      if (!active) {
        return;
      }

      try {
        renderer.clear();
        reportStageViewStatus(createStageEmptyStatusReport());
        setRenderState("empty");
      } catch (error) {
        console.error("Stage clear failed.", error);
        reportStageViewStatus(createStageErrorStatusReport({
          message: "Stage clear failed.",
          error
        }));
        setRenderState("error");
      }
    };

    window.runtimePlayerStage.runtimeExport.getLoadedPayload()
      .then((payload) => {
        if (payload === null) {
          clearStage();
          return;
        }

        renderPayload(payload);
      })
      .catch(clearStage);

    const unsubscribe =
      window.runtimePlayerStage.runtimeExport.onLoadedPayload((payload) => {
        renderPayload(payload);
      });
    const unsubscribeStatus =
      window.runtimePlayerStage.runtimeExport.onStatusChanged((status) => {
        handleStatusChange(status, clearStage);
      });
    const unsubscribeStageViewReset =
      window.runtimePlayerStage.stageView.onResetViewRequested(() => {
        if (!active) {
          return;
        }

        try {
          renderer.resetView();
        } catch (error) {
          console.error("Stage view reset failed.", error);
          clearRendererAfterError(renderer);
          reportStageViewStatus(createStageErrorStatusReport({
            message: "Stage view reset failed.",
            error
          }));
          setRenderState("error");
        }
      });
    const unsubscribeLiveParameters =
      window.runtimePlayerStage.liveParameters.onFrame((frame) => {
        if (!active) {
          return;
        }

        renderer.setLiveParameterFrame(frame);
      });
    const unsubscribeLiveParameterClear =
      window.runtimePlayerStage.liveParameters.onCleared(() => {
        if (!active) {
          return;
        }

        renderer.clearLiveParameterFrame();
      });

    return () => {
      active = false;
      unsubscribe();
      unsubscribeStatus();
      unsubscribeStageViewReset();
      unsubscribeLiveParameters();
      unsubscribeLiveParameterClear();
      renderer.dispose();
    };
  }, []);

  return (
    <main
      aria-label="Transparent capture stage"
      data-stage-render-state={renderState}
      className="stage-window-shell"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="stage-render-canvas"
      />
    </main>
  );
}

function handleStatusChange(
  status: RuntimeExportStatus,
  clearStage: () => void
): void {
  if (status.status !== "loaded") {
    clearStage();
  }
}

function createStageLoadedStatusReport(input: {
  readonly runtimeDiagnosticDetails: readonly string[];
}): RuntimePlayerStageViewStatusReport {
  if (input.runtimeDiagnosticDetails.length > 0) {
    return {
      status: "warning",
      statusLabel: "Stage rendered with diagnostics",
      message: "Runtime evaluation completed with diagnostics.",
      details: input.runtimeDiagnosticDetails
    };
  }

  return {
    status: "ready",
    statusLabel: "Stage ready",
    message: "Stage is rendering the model.",
    details: []
  };
}

function createStageEmptyStatusReport(): RuntimePlayerStageViewStatusReport {
  return {
    status: "empty",
    statusLabel: "Stage empty",
    message: "No model is currently rendered on Stage.",
    details: []
  };
}

function createStageErrorStatusReport(input: {
  readonly message: string;
  readonly error: unknown;
}): RuntimePlayerStageViewStatusReport {
  return {
    status: "error",
    statusLabel: "Stage render error",
    message: input.message,
    details: [toErrorDetail(input.error)]
  };
}

function reportStageViewStatus(status: RuntimePlayerStageViewStatusReport): void {
  window.runtimePlayerStage.stageView.reportStatus(status).catch((error: unknown) => {
    console.error("Stage status report failed.", error);
  });
}

function applyLatestLiveParameterFrame(
  renderer: StaticStageCanvasRenderer
): void {
  window.runtimePlayerStage.liveParameters.getLatestFrame()
    .then((frame) => {
      if (frame !== null) {
        renderer.setLiveParameterFrame(frame);
      }
    })
    .catch((error: unknown) => {
      console.error("Stage live parameter frame read failed.", error);
    });
}

function clearRendererAfterError(renderer: StaticStageCanvasRenderer): void {
  try {
    renderer.clear();
  } catch (error) {
    console.error("Stage clear after error failed.", error);
  }
}

function toErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string"
    ? error
    : "Unknown Stage rendering error.";
}
