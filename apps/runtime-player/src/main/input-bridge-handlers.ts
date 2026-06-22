import { ipcMain, type BrowserWindow } from "electron";

import { inputBridgeChannels } from "../preload/input-bridge-channels";
import type {
  RuntimePlayerInputConnectRequest,
  RuntimePlayerInputDiagnosticsSnapshot,
  RuntimePlayerInputHandshakeDiagnostics,
  RuntimePlayerInputRemoteEndpoint,
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import { IFacialMocapUdpReceiver } from "./input-adapters/ifacialmocap/ifacialmocap-udp-receiver";
import { IFACIALMOCAP_DEFAULT_UDP_PORT } from "./input-adapters/ifacialmocap/ifacialmocap-udp-start-request";
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
    const config = readConnectRequest(request);
    await stopReceiver();
    throttle.cancel();

    const nextReceiver = createReceiver({
      config,
      handlers: {
        onListening: () => {
          state.setListening(config);
          broadcastInputSnapshot(input.windows, state);
        },
        onMessage: (rawFrame, remote) => {
          state.recordReceivedFrame({ rawFrame, remote });
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

function readConnectRequest(
  request: unknown
): RuntimePlayerInputSessionConfig {
  const rawRequest = request === undefined ? {} : request;

  if (!isRecord(rawRequest)) {
    throw new Error("Input connect request must be an object.");
  }

  if (
    rawRequest.source !== undefined &&
    rawRequest.source !== "ifacialmocap"
  ) {
    throw new Error("Runtime Player Wave4 supports only iFacialMocap input.");
  }

  if (rawRequest.transport !== undefined && rawRequest.transport !== "udp") {
    throw new Error("Runtime Player Wave4 supports only UDP input.");
  }

  const receivePort = readReceivePort(rawRequest.receivePort);
  const iphoneHost = readOptionalHost(rawRequest.iphoneHost);

  return {
    source: "ifacialmocap",
    transport: "udp",
    receivePort,
    ...(iphoneHost === undefined ? {} : { iphoneHost })
  };
}

function readReceivePort(value: unknown): number {
  if (value === undefined) {
    return IFACIALMOCAP_DEFAULT_UDP_PORT;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw new Error("Receive port must be an integer from 1 to 65535.");
  }

  return value;
}

function readOptionalHost(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("iPhone host must be a string.");
  }

  const host = value.trim();

  if (host.length === 0) {
    return undefined;
  }

  if (host.length > 255 || /\s/.test(host)) {
    throw new Error("iPhone host must be a valid host or IP address.");
  }

  return host;
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

function isRecord(value: unknown): value is Partial<RuntimePlayerInputConnectRequest> {
  return typeof value === "object" && value !== null;
}
