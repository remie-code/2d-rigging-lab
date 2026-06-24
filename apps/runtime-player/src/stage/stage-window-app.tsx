import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type {
  RuntimeExportStatus,
  RuntimeExportLoadedPayload
} from "../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerStageArrangeState,
  RuntimePlayerStageViewStatusReport
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimePlayerVariantControllerStatus
} from "../preload/runtime-variant-bridge-contract";
import {
  createStaticStageCanvasRenderer,
  type StaticStageCanvasRenderer
} from "./stage-renderer/static-stage-canvas-renderer";
import {
  readStageViewTransform,
  serializeStageViewTransform,
  type StageViewTransform
} from "./stage-renderer/stage-view-transform";

type StageRenderState = "empty" | "loaded" | "error";

export function StageWindowApp(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderState, setRenderState] = useState<StageRenderState>("empty");
  const [arrangeModeEnabled, setArrangeModeEnabled] = useState(false);

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
      renderer = createStaticStageCanvasRenderer(canvas, {
        onViewTransformChanged: reportStageViewTransform
      });
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

    applyStoredStageViewTransform(renderer);
    applyActiveVariantSelection(renderer);
    reportStageViewStatus(createStageEmptyStatusReport());

    const applyArrangeState = (state: RuntimePlayerStageArrangeState): void => {
      if (!active) {
        return;
      }

      renderer.setViewInteractionEnabled(!state.arrangeModeEnabled);
      setArrangeModeEnabled(state.arrangeModeEnabled);
    };

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
    const unsubscribeVariantStatus =
      window.runtimePlayerStage.variants.onStatusChanged((status) => {
        if (!active) {
          return;
        }

        applyRuntimeVariantStatusToStageRenderer(renderer, status);
      });
    const unsubscribeStageViewTransform =
      window.runtimePlayerStage.stageView.onApplyViewTransformRequested((transform) => {
        if (!active) {
          return;
        }

        try {
          renderer.setViewTransform(readStageViewTransform(transform), {
            notify: false
          });
        } catch (error) {
          console.error("Stage view transform apply failed.", error);
          clearRendererAfterError(renderer);
          reportStageViewStatus(createStageErrorStatusReport({
            message: "Stage view transform apply failed.",
            error
          }));
          setRenderState("error");
        }
      });
    const unsubscribeStageDisplayViewTransform =
      window.runtimePlayerStage.stageView.onApplyDisplayViewTransformRequested(
        (transform) => {
          if (!active) {
            return;
          }

          try {
            renderer.setDisplayViewTransform(
              transform === null ? null : readStageViewTransform(transform)
            );
          } catch (error) {
            console.error("Stage display transform apply failed.", error);
            clearRendererAfterError(renderer);
            reportStageViewStatus(createStageErrorStatusReport({
              message: "Stage display transform apply failed.",
              error
            }));
            setRenderState("error");
          }
        }
      );
    window.runtimePlayerStage.stageView.getArrangeState()
      .then(applyArrangeState)
      .catch((error: unknown) => {
        console.error("Stage arrange state read failed.", error);
      });
    const unsubscribeArrangeState =
      window.runtimePlayerStage.stageView.onArrangeStateChanged(
        applyArrangeState
      );
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
      unsubscribeVariantStatus();
      unsubscribeStageViewTransform();
      unsubscribeStageDisplayViewTransform();
      unsubscribeArrangeState();
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
      <StageArrangeOverlay enabled={arrangeModeEnabled} />
    </main>
  );
}

function applyActiveVariantSelection(
  renderer: StaticStageCanvasRenderer
): void {
  window.runtimePlayerStage.variants.getStatus()
    .then((status) => {
      applyRuntimeVariantStatusToStageRenderer(renderer, status);
    })
    .catch((error: unknown) => {
      console.error("Stage Variant selection read failed.", error);
    });
}

export function applyRuntimeVariantStatusToStageRenderer(
  renderer: Pick<StaticStageCanvasRenderer, "setActiveVariantSelection">,
  status: RuntimePlayerVariantControllerStatus
): void {
  renderer.setActiveVariantSelection(status.activeVariantSelection);
}

export function StageArrangeOverlay({
  enabled
}: {
  readonly enabled: boolean;
}): ReactElement | null {
  if (!enabled) {
    return null;
  }

  return (
    <div className="stage-arrange-overlay" aria-hidden="true">
      <div className="stage-arrange-handle">
        <span className="stage-arrange-grip" />
      </div>
    </div>
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

function reportStageViewTransform(transform: StageViewTransform): void {
  window.runtimePlayerStage.stageView
    .reportViewTransform(serializeStageViewTransform(transform))
    .catch((error: unknown) => {
      console.error("Stage view transform report failed.", error);
    });
}

function applyStoredStageViewTransform(
  renderer: StaticStageCanvasRenderer
): void {
  window.runtimePlayerStage.stageView.getViewTransform()
    .then((transform) => {
      renderer.setViewTransform(readStageViewTransform(transform), {
        notify: false
      });
    })
    .catch((error: unknown) => {
      console.error("Stage view transform read failed.", error);
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
