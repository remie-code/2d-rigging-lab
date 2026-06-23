import { useEffect, useRef, useState } from "react";
import type { ReactElement, Ref } from "react";

import {
  BrowserSourceStageClient,
  type BrowserSourceStageRenderStatus
} from "./browser-source-stage-client";
import { readBrowserSourcePageWindowConfig } from "./browser-source-page-config";
import { createBrowserSourceStageRenderer } from "./browser-source-stage-renderer";

export function BrowserSourceStageApp(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderStatus, setRenderStatus] =
    useState<BrowserSourceStageRenderStatus>("idle");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }

    const config = readBrowserSourcePageWindowConfig();
    if (config === null) {
      console.error("Browser Source page config was not found.");
      setRenderStatus("error");
      return undefined;
    }

    const rendererSetup = createBrowserSourceStageRenderer(canvas);
    const client = new BrowserSourceStageClient({
      config,
      renderer: rendererSetup.renderer,
      webgl2Available: rendererSetup.webgl2Available,
      initialMessage: rendererSetup.message
    });
    const unsubscribe = client.onSnapshotChanged((snapshot) => {
      setRenderStatus(snapshot.renderStatus);
    });

    client.start();

    return () => {
      unsubscribe();
      client.stop();
    };
  }, []);

  return (
    <BrowserSourceStageSurface
      canvasRef={canvasRef}
      renderStatus={renderStatus}
    />
  );
}

export function BrowserSourceStageSurface({
  canvasRef,
  renderStatus
}: {
  readonly canvasRef?: Ref<HTMLCanvasElement>;
  readonly renderStatus: BrowserSourceStageRenderStatus;
}): ReactElement {
  return (
    <main
      aria-hidden="true"
      data-browser-source-stage-render-status={renderStatus}
      className="browser-source-stage-shell"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="browser-source-stage-canvas"
      />
    </main>
  );
}
