import type { BrowserWindow } from "electron";

export type RuntimePlayerCloseEvent = {
  preventDefault(): void;
};

export type RuntimePlayerWindowLike = Pick<
  BrowserWindow,
  | "focus"
  | "hide"
  | "isDestroyed"
  | "isMinimized"
  | "on"
  | "restore"
  | "show"
>;

export type RuntimePlayerQuitControllerOptions = {
  readonly quit: () => void;
  readonly disconnectInput: () => Promise<unknown>;
  readonly flushModelMappingProfile: () => Promise<unknown>;
  readonly flushWindowState: () => Promise<unknown>;
};

export class RuntimePlayerQuitController {
  readonly #options: RuntimePlayerQuitControllerOptions;
  #quitInProgress = false;
  #quitFlushCompleted = false;
  #pendingQuitFlush: Promise<void> | null = null;

  constructor(options: RuntimePlayerQuitControllerOptions) {
    this.#options = options;
  }

  isQuitInProgress(): boolean {
    return this.#quitInProgress;
  }

  hasCompletedQuitFlush(): boolean {
    return this.#quitFlushCompleted;
  }

  requestQuit(): void {
    if (this.#quitInProgress && !this.#quitFlushCompleted) {
      return;
    }

    this.#quitInProgress = true;
    this.#options.quit();
  }

  handleBeforeQuit(event: RuntimePlayerCloseEvent): Promise<void> | null {
    this.#quitInProgress = true;

    if (this.#quitFlushCompleted) {
      return null;
    }

    event.preventDefault();

    if (this.#pendingQuitFlush === null) {
      this.#pendingQuitFlush = this.#flushBeforeQuit().finally(() => {
        this.#quitFlushCompleted = true;
        this.#options.quit();
      });
    }

    return this.#pendingQuitFlush;
  }

  async #flushBeforeQuit(): Promise<void> {
    await Promise.allSettled([
      runQuitOperation(this.#options.disconnectInput),
      runQuitOperation(this.#options.flushModelMappingProfile),
      runQuitOperation(this.#options.flushWindowState)
    ]);
  }
}

export function attachRuntimePlayerControlWindowRecovery(input: {
  readonly controlWindow: RuntimePlayerWindowLike;
  readonly isExplicitQuitInProgress: () => boolean;
  readonly requestQuit: () => void;
  readonly closeStageWindow?: () => void;
}): void {
  input.controlWindow.on("close", () => {
    if (input.isExplicitQuitInProgress()) {
      return;
    }

    input.requestQuit();
    input.closeStageWindow?.();
  });
}

export function showRuntimePlayerControlWindow(
  controlWindow: RuntimePlayerWindowLike
): boolean {
  return showAndFocusRuntimePlayerWindow(controlWindow);
}

export function focusRuntimePlayerStageWindow(
  stageWindow: RuntimePlayerWindowLike
): boolean {
  return showAndFocusRuntimePlayerWindow(stageWindow);
}

function showAndFocusRuntimePlayerWindow(
  window: RuntimePlayerWindowLike
): boolean {
  if (window.isDestroyed()) {
    return false;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();

  return true;
}

async function runQuitOperation(
  operation: () => Promise<unknown>
): Promise<unknown> {
  return operation();
}
