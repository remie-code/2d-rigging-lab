import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type {
  RuntimeExportStatus,
  RuntimeExportLoadedPayload
} from "../preload/runtime-export-bridge-contract";
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
      setRenderState("error");
      return () => {
        active = false;
      };
    }

    const renderPayload = (payload: RuntimeExportLoadedPayload): void => {
      if (!active) {
        return;
      }

      try {
        renderer.setPayload(payload);
        setRenderState("loaded");
      } catch (error) {
        console.error("Stage render failed.", error);
        renderer.clear();
        setRenderState("error");
      }
    };

    const clearStage = (): void => {
      if (!active) {
        return;
      }

      try {
        renderer.clear();
        setRenderState("empty");
      } catch (error) {
        console.error("Stage clear failed.", error);
        setRenderState("error");
      }
    };

    window.runtimePlayer.runtimeExport.getLoadedPayload()
      .then((payload) => {
        if (payload === null) {
          clearStage();
          return;
        }

        renderPayload(payload);
      })
      .catch(clearStage);

    const unsubscribe =
      window.runtimePlayer.runtimeExport.onLoadedPayload((payload) => {
        renderPayload(payload);
      });
    const unsubscribeStatus =
      window.runtimePlayer.runtimeExport.onStatusChanged((status) => {
        handleStatusChange(status, clearStage);
      });

    return () => {
      active = false;
      unsubscribe();
      unsubscribeStatus();
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
