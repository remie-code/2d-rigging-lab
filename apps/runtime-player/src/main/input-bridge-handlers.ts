import { ipcMain, type BrowserWindow } from "electron";

import { inputBridgeChannels } from "../preload/input-bridge-channels";
import type {
  RuntimePlayerInputDiagnosticsSnapshot,
  RuntimePlayerInputHandshakeDiagnostics,
  RuntimePlayerInputRemoteEndpoint,
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import { IFacialMocapUdpReceiver } from "./input-adapters/ifacialmocap/ifacialmocap-udp-receiver";
import { readInputConnectRequest } from "./input-connect-request-validation";
import { RuntimePlayerInputDiagnosticsThrottle } from "./input-diagnostics-throttle";
import {
  RuntimePlayerInputSessionState,
  type RuntimePlayerInputSessionConfig
} from "./input-session-state";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

type RuntimePlayerInputReceiver = {
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
};

type RuntimePlayerInputReceiverFactoryInput = {
  readonly config: RuntimePlayerInputSessionConfig;
  readonly handlers: {
    readonly onListening: () => void;
    readonly onMessage: (
      rawFrame: string,
      remote: RuntimePlayerInputRemoteEndpoint
    ) => void;
    readonly onError: (error: Error) => void;
    readonly onStartRequestChanged: (
      diagnostics: RuntimePlayerInputHandshakeDiagnostics
    ) => void;
  };
};

export type RuntimePlayerInputReceiverFactory = (
  input: RuntimePlayerInputReceiverFactoryInput
) => RuntimePlayerInputReceiver;

export interface RegisterInputBridgeHandlersInput {
  readonly windows: RuntimePlayerWindowSet;
  readonly state?: RuntimePlayerInputSessionState;
  readonly createReceiver?: RuntimePlayerInputReceiverFactory;
  readonly nowMs?: () => number;
  readonly onTrackingFrame?: () => void | Promise<void>;
  readonly onInputReset?: () => void | Promise<void>;
}

export type RuntimePlayerInputBridgeHandlersRegistration = {
  readonly state: RuntimePlayerInputSessionState;
  readonly disconnect: () => Promise<RuntimePlayerInputStatus>;
};

export function registerInputBridgeHandlers(
  input: RegisterInputBridgeHandlersInput
): RuntimePlayerInputBridgeHandlersRegistration {
  const state = input.state ?? new RuntimePlayerInputSessionState({
    ...(input.nowMs === undefined ? {} : { nowMs: input.nowMs })
  });
  const createReceiver = input.createReceiver ?? createIFacialMocapUdpReceiver;
  const throttle = new RuntimePlayerInputDiagnosticsThrottle({
    emit: () => broadcastInputSnapshot(input.windows, state),
    ...(input.nowMs === undefined ? {} : { nowMs: input.nowMs })
  });
  let receiver: RuntimePlayerInputReceiver | null = null;

  async function stopReceiver(): Promise<void> {
    const receiverToStop = receiver;
    receiver = null;

    if (receiverToStop === null) {
      return;
    }

    await receiverToStop.stop();
  }

  async function connect(request: unknown): Promise<RuntimePlayerInputStatus> {
    const config = readInputConnectRequest(request);
    await stopReceiver();
    throttle.cancel();
    await input.onInputReset?.();

    const nextReceiver = createReceiver({
      config,
      handlers: {
        onListening: () => {
          state.setListening(config);
          broadcastInputSnapshot(input.windows, state);
        },
        onMessage: (rawFrame, remote) => {
          state.recordReceivedFrame({ rawFrame, remote });
          void input.onTrackingFrame?.();
          throttle.request();
        },
        onError: (error) => {
          state.setError(error.message);
          broadcastInputSnapshot(input.windows, state);
        },
        onStartRequestChanged: (diagnostics) => {
          state.setHandshakeDiagnostics(diagnostics);
          broadcastInputSnapshot(input.windows, state);
        }
      }
    });

    receiver = nextReceiver;

    try {
      await nextReceiver.start();
    } catch (error) {
      await stopReceiver();
      state.setError(toErrorMessage(error));
      broadcastInputSnapshot(input.windows, state);
    }

    return state.getStatus();
  }

  async function disconnect(): Promise<RuntimePlayerInputStatus> {
    await stopReceiver();
    throttle.cancel();
    const status = state.setIdle();
    await input.onInputReset?.();
    broadcastInputSnapshot(input.windows, state);
    return status;
  }

  ipcMain.handle(inputBridgeChannels.getStatus, () => state.getStatus());
  ipcMain.handle(inputBridgeChannels.connect, (_event, request: unknown) =>
    connect(request)
  );
  ipcMain.handle(inputBridgeChannels.disconnect, () => disconnect());
  ipcMain.handle(inputBridgeChannels.getDiagnostics, () =>
    state.getDiagnostics()
  );
  ipcMain.handle(inputBridgeChannels.copyDiagnostics, () =>
    state.createDiagnosticsCopyPayload()
  );

  return {
    state,
    disconnect
  };
}

function createIFacialMocapUdpReceiver(
  input: RuntimePlayerInputReceiverFactoryInput
): RuntimePlayerInputReceiver {
  return new IFacialMocapUdpReceiver({
    receivePort: input.config.receivePort,
    handlers: input.handlers,
    ...(input.config.iphoneHost === undefined
      ? {}
      : { iphoneHost: input.config.iphoneHost })
  });
}

function broadcastInputSnapshot(
  windows: RuntimePlayerWindowSet,
  state: RuntimePlayerInputSessionState
): void {
  const status = state.getStatus();

  sendToControlWindow(
    windows.controlWindow,
    inputBridgeChannels.statusChanged,
    status
  );
  sendToControlWindow(
    windows.controlWindow,
    inputBridgeChannels.diagnosticsChanged,
    state.getDiagnostics()
  );
}

function sendToControlWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimePlayerInputStatus | RuntimePlayerInputDiagnosticsSnapshot
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
