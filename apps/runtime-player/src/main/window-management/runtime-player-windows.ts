import { BrowserWindow } from "electron";

import {
  createControlWindowOptions,
  createStageWindowOptions
} from "./browser-window-options";
import {
  type RuntimePlayerRendererEntry,
  getControlPreloadFilePath,
  getRendererDevUrl,
  getRendererHtmlFilePath,
  getStagePreloadFilePath
} from "./renderer-entry-url";
import type { RuntimePlayerWindowStateController } from "../window-state/window-state-controller";
import type { RuntimePlayerWindowStateDocument } from "../window-state/window-state-document";

export type RuntimePlayerWindowSet = {
  readonly controlWindow: BrowserWindow;
  readonly stageWindow: BrowserWindow;
};

export type RuntimePlayerStageWindowLifecycleChangedEvent = {
  readonly reason: "created" | "closed";
  readonly window: BrowserWindow;
};

export type RuntimePlayerStageWindowLifecycleChangedListener = (
  event: RuntimePlayerStageWindowLifecycleChangedEvent
) => void;

export type RuntimePlayerStageWindowLifecycle = {
  getStageWindow(): BrowserWindow;
  reopenStageWindow(): Promise<BrowserWindow>;
  closeStageWindow(): void;
  onStageWindowChanged(
    listener: RuntimePlayerStageWindowLifecycleChangedListener
  ): () => void;
};

export type RuntimePlayerWindowSetWithLifecycle = RuntimePlayerWindowSet & {
  readonly stageWindowLifecycle: RuntimePlayerStageWindowLifecycle;
};

export type CreateRuntimePlayerWindowsOptions = {
  readonly windowState?: RuntimePlayerWindowStateDocument;
  readonly getWindowStateDocument?: () => RuntimePlayerWindowStateDocument;
  readonly controlWindowTitle?: string;
  readonly stageWindowTitle?: string;
};

export function createRuntimePlayerWindows(
  options: CreateRuntimePlayerWindowsOptions = {}
): RuntimePlayerWindowSetWithLifecycle {
  const controlPreloadFilePath = getControlPreloadFilePath();
  const stagePreloadFilePath = getStagePreloadFilePath();
  const controlWindow = new BrowserWindow(
    createControlWindowOptions(
      controlPreloadFilePath,
      options.windowState?.windows.control?.bounds,
      options.controlWindowTitle === undefined
        ? {}
        : { title: options.controlWindowTitle }
    )
  );
  const stageWindowLifecycle = createStageWindowLifecycle({
    stagePreloadFilePath,
    getWindowStateDocument: () =>
      options.getWindowStateDocument?.() ?? options.windowState,
    ...(options.stageWindowTitle === undefined
      ? {}
      : { stageWindowTitle: options.stageWindowTitle })
  });

  controlWindow.once("ready-to-show", () => {
    controlWindow.show();
  });

  return {
    controlWindow,
    get stageWindow() {
      return stageWindowLifecycle.getStageWindow();
    },
    stageWindowLifecycle
  };
}

export function attachRuntimePlayerWindowStateTracking(input: {
  readonly windows: RuntimePlayerWindowSet;
  readonly windowState: RuntimePlayerWindowStateController;
}): void {
  attachWindowBoundsTracking(input.windows.controlWindow, "control", input);
  attachWindowBoundsTracking(input.windows.stageWindow, "stage", input);
  getRuntimePlayerStageWindowLifecycle(input.windows)
    ?.onStageWindowChanged((event) => {
      if (event.reason === "created") {
        attachWindowBoundsTracking(event.window, "stage", input);
      }
    });
}

export async function loadRuntimePlayerWindows(
  windows: RuntimePlayerWindowSet
): Promise<void> {
  await Promise.all([
    loadRendererEntry(windows.controlWindow, "control"),
    loadRendererEntry(windows.stageWindow, "stage")
  ]);
}

async function loadRendererEntry(
  window: BrowserWindow,
  entry: RuntimePlayerRendererEntry
): Promise<void> {
  const devUrl = getRendererDevUrl(entry);

  if (devUrl) {
    await window.loadURL(devUrl);
    return;
  }

  await window.loadFile(getRendererHtmlFilePath(entry));
}

export function getRuntimePlayerStageWindowLifecycle(
  windows: RuntimePlayerWindowSet
): RuntimePlayerStageWindowLifecycle | null {
  const maybeLifecycle = (
    windows as Partial<RuntimePlayerWindowSetWithLifecycle>
  ).stageWindowLifecycle;

  return maybeLifecycle ?? null;
}

function createStageWindowLifecycle(input: {
  readonly stagePreloadFilePath: string;
  readonly getWindowStateDocument: () =>
    RuntimePlayerWindowStateDocument | undefined;
  readonly stageWindowTitle?: string;
}): RuntimePlayerStageWindowLifecycle {
  const listeners = new Set<RuntimePlayerStageWindowLifecycleChangedListener>();
  const stageWindowTitleOption =
    input.stageWindowTitle === undefined
      ? {}
      : { stageWindowTitle: input.stageWindowTitle };
  let stageWindow = createStageWindow({
    stagePreloadFilePath: input.stagePreloadFilePath,
    getWindowStateDocument: input.getWindowStateDocument,
    ...stageWindowTitleOption,
    onClosed: (window) => {
      notifyStageWindowLifecycleChanged({
        listeners,
        event: {
          reason: "closed",
          window
        }
      });
    }
  });

  return {
    getStageWindow: () => stageWindow,
    reopenStageWindow: async () => {
      if (!stageWindow.isDestroyed()) {
        return stageWindow;
      }

      stageWindow = createStageWindow({
        stagePreloadFilePath: input.stagePreloadFilePath,
        getWindowStateDocument: input.getWindowStateDocument,
        ...stageWindowTitleOption,
        onClosed: (window) => {
          notifyStageWindowLifecycleChanged({
            listeners,
            event: {
              reason: "closed",
              window
            }
          });
        }
      });
      notifyStageWindowLifecycleChanged({
        listeners,
        event: {
          reason: "created",
          window: stageWindow
        }
      });

      try {
        await loadRendererEntry(stageWindow, "stage");
      } catch (error) {
        if (!stageWindow.isDestroyed()) {
          stageWindow.close();
        }
        throw error;
      }

      return stageWindow;
    },
    closeStageWindow: () => {
      if (!stageWindow.isDestroyed()) {
        stageWindow.close();
      }
    },
    onStageWindowChanged: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function createStageWindow(input: {
  readonly stagePreloadFilePath: string;
  readonly getWindowStateDocument: () =>
    RuntimePlayerWindowStateDocument | undefined;
  readonly stageWindowTitle?: string;
  readonly onClosed: (window: BrowserWindow) => void;
}): BrowserWindow {
  const windowState = input.getWindowStateDocument();
  const stageWindow = new BrowserWindow(
    createStageWindowOptions(
      input.stagePreloadFilePath,
      windowState?.windows.stage?.bounds,
      {
        alwaysOnTop: windowState?.stageEnvironment.alwaysOnTop ?? false,
        ...(input.stageWindowTitle === undefined
          ? {}
          : { title: input.stageWindowTitle })
      }
    )
  );

  stageWindow.once("ready-to-show", () => {
    if (!stageWindow.isDestroyed()) {
      stageWindow.showInactive();
    }
  });
  stageWindow.once("closed", () => {
    input.onClosed(stageWindow);
  });

  return stageWindow;
}

function notifyStageWindowLifecycleChanged(input: {
  readonly listeners: Set<RuntimePlayerStageWindowLifecycleChangedListener>;
  readonly event: RuntimePlayerStageWindowLifecycleChangedEvent;
}): void {
  for (const listener of input.listeners) {
    listener(input.event);
  }
}

function attachWindowBoundsTracking(
  window: BrowserWindow,
  windowKey: "control" | "stage",
  input: {
    readonly windowState: RuntimePlayerWindowStateController;
  }
): void {
  const updateBounds = (): void => {
    if (window.isDestroyed()) {
      return;
    }

    input.windowState.updateWindowBounds(windowKey, window.getBounds());
  };

  updateBounds();
  window.on("move", updateBounds);
  window.on("resize", updateBounds);
  window.on("close", () => {
    updateBounds();
    void input.windowState.flush();
  });
}
