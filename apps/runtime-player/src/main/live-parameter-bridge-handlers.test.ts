import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import { liveParameterBridgeChannels } from "../preload/live-parameter-bridge-channels";
import type { RuntimePlayerLiveParameterFrame } from "../preload/live-parameter-bridge-contract";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";
import { registerLiveParameterBridgeHandlers } from "./live-parameter-bridge-handlers";

type IpcHandler = (event?: unknown, ...args: unknown[]) => unknown;

let handlers: Map<string, IpcHandler>;

beforeEach(() => {
  handlers = new Map();
  electronMocks.ipcMainHandle.mockReset();
  electronMocks.ipcMainHandle.mockImplementation(
    (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }
  );
});

describe("registerLiveParameterBridgeHandlers", () => {
  it("can update latest live frame without delivering it to the native Stage window", () => {
    const windows = createFakeWindows();
    const registration = registerLiveParameterBridgeHandlers({ windows });
    const frame = createLiveParameterFrame(1);

    registration.setStageWindowLiveFrameDeliveryEnabled(false);
    registration.publishFrame(frame, { deliverToStageWindow: false });

    expect(registration.getLatestFrame()).toBe(frame);
    expect(invokeHandler(liveParameterBridgeChannels.getLatestFrame)).toBeNull();
    expect(windows.stageWindow.webContents.send).not.toHaveBeenCalled();
  });

  it("replays clear plus the latest frame to the Stage window when local preview resumes", () => {
    const windows = createFakeWindows();
    const registration = registerLiveParameterBridgeHandlers({ windows });
    const frame = createLiveParameterFrame(2);

    registration.setStageWindowLiveFrameDeliveryEnabled(false);
    registration.publishFrame(frame, { deliverToStageWindow: false });
    registration.setStageWindowLiveFrameDeliveryEnabled(true);
    registration.publishLatestFrameToStageWindow({ resetBeforePublish: true });

    expect(windows.stageWindow.webContents.send).toHaveBeenNthCalledWith(
      1,
      liveParameterBridgeChannels.cleared
    );
    expect(windows.stageWindow.webContents.send).toHaveBeenNthCalledWith(
      2,
      liveParameterBridgeChannels.frame,
      frame
    );
  });
});

function invokeHandler(channel: string): unknown {
  const handler = handlers.get(channel);
  expect(handler).toBeTypeOf("function");
  return handler?.({});
}

function createFakeWindows(): RuntimePlayerWindowSet {
  return {
    controlWindow: createFakeWindow() as unknown as RuntimePlayerWindowSet["controlWindow"],
    stageWindow: createFakeWindow() as unknown as RuntimePlayerWindowSet["stageWindow"]
  };
}

function createFakeWindow() {
  return {
    webContents: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn()
    },
    isDestroyed: vi.fn(() => false)
  };
}

function createLiveParameterFrame(sequence: number): RuntimePlayerLiveParameterFrame {
  return {
    schemaVersion: "runtime-player-live-parameter-frame-v1",
    runtimeExport: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      loadedAtIso: "2026-06-23T01:00:00.000Z"
    },
    sequence,
    producedAtIso: `2026-06-23T01:00:0${sequence}.000Z`,
    sourceFrameTimestampMs: 1000 + sequence * 16,
    parameterValues: {
      ParamAngleX: sequence
    }
  };
}
