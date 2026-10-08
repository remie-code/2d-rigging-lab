import { describe, expect, it, vi } from "vitest";

import {
  RuntimePlayerQuitController,
  attachRuntimePlayerControlWindowRecovery,
  focusRuntimePlayerStageWindow,
  showRuntimePlayerControlWindow,
  type RuntimePlayerCloseEvent,
  type RuntimePlayerWindowLike
} from "./control-window-recovery";

describe("Runtime Player Control Window recovery", () => {
  it("requests app quit and closes Stage on Control Window close", () => {
    const controlWindow = createFakeWindow();
    const requestQuit = vi.fn();
    const closeStageWindow = vi.fn();

    attachRuntimePlayerControlWindowRecovery({
      controlWindow: controlWindow.window,
      isExplicitQuitInProgress: () => false,
      requestQuit,
      closeStageWindow
    });

    const closeEvent = controlWindow.emitClose();

    expect(closeEvent.preventDefault).not.toHaveBeenCalled();
    expect(controlWindow.hide).not.toHaveBeenCalled();
    expect(requestQuit).toHaveBeenCalledTimes(1);
    expect(closeStageWindow).toHaveBeenCalledTimes(1);
  });

  it("allows Control Window close during explicit quit", () => {
    const quitController = new RuntimePlayerQuitController({
      quit: vi.fn(),
      disconnectInput: vi.fn(async () => undefined),
      flushModelMappingProfile: vi.fn(async () => undefined),
      flushWindowState: vi.fn(async () => undefined)
    });
    const controlWindow = createFakeWindow();
    const requestQuit = vi.fn();
    const closeStageWindow = vi.fn();

    attachRuntimePlayerControlWindowRecovery({
      controlWindow: controlWindow.window,
      isExplicitQuitInProgress: () => quitController.isQuitInProgress(),
      requestQuit,
      closeStageWindow
    });

    quitController.requestQuit();
    const closeEvent = controlWindow.emitClose();

    expect(closeEvent.preventDefault).not.toHaveBeenCalled();
    expect(controlWindow.hide).not.toHaveBeenCalled();
    expect(requestQuit).not.toHaveBeenCalled();
    expect(closeStageWindow).not.toHaveBeenCalled();
  });

  it("show Control restores minimized windows before showing and focusing", () => {
    const controlWindow = createFakeWindow({
      minimized: true
    });

    const result = showRuntimePlayerControlWindow(controlWindow.window);

    expect(result).toBe(true);
    expect(controlWindow.restore).toHaveBeenCalledTimes(1);
    expect(controlWindow.show).toHaveBeenCalledTimes(1);
    expect(controlWindow.focus).toHaveBeenCalledTimes(1);
  });

  it("show Control reports false for destroyed windows", () => {
    const controlWindow = createFakeWindow({
      destroyed: true
    });

    const result = showRuntimePlayerControlWindow(controlWindow.window);

    expect(result).toBe(false);
    expect(controlWindow.restore).not.toHaveBeenCalled();
    expect(controlWindow.show).not.toHaveBeenCalled();
    expect(controlWindow.focus).not.toHaveBeenCalled();
  });

  it("focus Stage mirrors the safe show/focus behavior and tolerates destroyed Stage windows", () => {
    const availableStageWindow = createFakeWindow({
      minimized: true
    });
    const destroyedStageWindow = createFakeWindow({
      destroyed: true
    });

    expect(focusRuntimePlayerStageWindow(availableStageWindow.window)).toBe(
      true
    );
    expect(availableStageWindow.restore).toHaveBeenCalledTimes(1);
    expect(availableStageWindow.show).toHaveBeenCalledTimes(1);
    expect(availableStageWindow.focus).toHaveBeenCalledTimes(1);
    expect(focusRuntimePlayerStageWindow(destroyedStageWindow.window)).toBe(
      false
    );
    expect(destroyedStageWindow.show).not.toHaveBeenCalled();
  });
});

describe("RuntimePlayerQuitController", () => {
  it("runs the existing shutdown flush operations before issuing the final quit", async () => {
    const quit = vi.fn();
    const disconnectInput = vi.fn(async () => undefined);
    const flushModelMappingProfile = vi.fn(async () => undefined);
    const flushWindowState = vi.fn(async () => undefined);
    const quitController = new RuntimePlayerQuitController({
      quit,
      disconnectInput,
      flushModelMappingProfile,
      flushWindowState
    });

    quitController.requestQuit();
    const beforeQuitEvent = createCloseEvent();
    const flush = quitController.handleBeforeQuit(beforeQuitEvent);

    expect(quitController.isQuitInProgress()).toBe(true);
    expect(beforeQuitEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(disconnectInput).toHaveBeenCalledTimes(1);
    expect(flushModelMappingProfile).toHaveBeenCalledTimes(1);
    expect(flushWindowState).toHaveBeenCalledTimes(1);

    await flush;

    expect(quitController.hasCompletedQuitFlush()).toBe(true);
    expect(quit).toHaveBeenCalledTimes(2);

    const secondBeforeQuitEvent = createCloseEvent();
    expect(quitController.handleBeforeQuit(secondBeforeQuitEvent)).toBeNull();
    expect(secondBeforeQuitEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("settles failed flush operations and still continues the quit flow", async () => {
    const quit = vi.fn();
    const quitController = new RuntimePlayerQuitController({
      quit,
      disconnectInput: vi.fn(async () => {
        throw new Error("disconnect failed");
      }),
      flushModelMappingProfile: vi.fn(async () => undefined),
      flushWindowState: vi.fn(async () => {
        throw new Error("window state failed");
      })
    });

    const flush = quitController.handleBeforeQuit(createCloseEvent());

    await flush;

    expect(quitController.hasCompletedQuitFlush()).toBe(true);
    expect(quit).toHaveBeenCalledTimes(1);
  });
});

function createFakeWindow(options: {
  readonly destroyed?: boolean;
  readonly minimized?: boolean;
} = {}) {
  const closeListeners: Array<(event: RuntimePlayerCloseEvent) => void> = [];
  let minimized = options.minimized ?? false;
  const destroyed = options.destroyed ?? false;
  const hide = vi.fn();
  const restore = vi.fn(() => {
    minimized = false;
  });
  const show = vi.fn();
  const focus = vi.fn();
  const on = vi.fn((event: string, listener: unknown) => {
    if (event === "close") {
      closeListeners.push(listener as (event: RuntimePlayerCloseEvent) => void);
    }

    return fakeWindow;
  });
  const fakeWindow = {
    focus,
    hide,
    isDestroyed: vi.fn(() => destroyed),
    isMinimized: vi.fn(() => minimized),
    on,
    restore,
    show
  } as unknown as RuntimePlayerWindowLike;

  return {
    window: fakeWindow,
    focus,
    hide,
    restore,
    show,
    emitClose: () => {
      const event = createCloseEvent();

      for (const listener of closeListeners) {
        listener(event);
      }

      return event;
    }
  };
}

function createCloseEvent(): RuntimePlayerCloseEvent & {
  readonly preventDefault: ReturnType<typeof vi.fn>;
} {
  return {
    preventDefault: vi.fn()
  };
}
