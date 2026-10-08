import { createSocket, type RemoteInfo, type Socket } from "node:dgram";
import type { AddressInfo } from "node:net";

import type {
  RuntimePlayerInputHandshakeDiagnostics,
  RuntimePlayerInputRemoteEndpoint
} from "../../../preload/input-bridge-contract";
import {
  IFACIALMOCAP_DEFAULT_UDP_PORT,
  IFACIALMOCAP_UDP_START_REQUEST_LABEL,
  IFACIALMOCAP_UDP_START_REQUEST_V2
} from "./ifacialmocap-udp-start-request";

export type IFacialMocapUdpSocket = Pick<
  Socket,
  "address" | "bind" | "close" | "on" | "once" | "send"
>;

export type IFacialMocapUdpSocketFactory = () => IFacialMocapUdpSocket;

export type IFacialMocapUdpReceiverHandlers = {
  readonly onListening?: (address: AddressInfo) => void;
  readonly onMessage?: (
    rawFrame: string,
    remote: RuntimePlayerInputRemoteEndpoint
  ) => void;
  readonly onError?: (error: Error) => void;
  readonly onStartRequestChanged?: (
    diagnostics: RuntimePlayerInputHandshakeDiagnostics
  ) => void;
};

export type IFacialMocapUdpReceiverOptions = {
  readonly receivePort?: number;
  readonly iphoneHost?: string;
  readonly createUdpSocket?: IFacialMocapUdpSocketFactory;
  readonly nowMs?: () => number;
  readonly handlers?: IFacialMocapUdpReceiverHandlers;
};

export class IFacialMocapUdpReceiver {
  private readonly receivePort: number;
  private readonly iphoneHost: string | undefined;
  private readonly createUdpSocket: IFacialMocapUdpSocketFactory;
  private readonly nowMs: () => number;
  private readonly handlers: IFacialMocapUdpReceiverHandlers;
  private socket: IFacialMocapUdpSocket | null = null;
  private stopped = true;

  constructor(options: IFacialMocapUdpReceiverOptions = {}) {
    this.receivePort = options.receivePort ?? IFACIALMOCAP_DEFAULT_UDP_PORT;
    this.iphoneHost = options.iphoneHost;
    this.createUdpSocket =
      options.createUdpSocket ?? (() => createSocket({ type: "udp4", reuseAddr: true }));
    this.nowMs = options.nowMs ?? Date.now;
    this.handlers = options.handlers ?? {};
  }

  async start(): Promise<void> {
    if (this.socket !== null) {
      return;
    }

    const socket = this.createUdpSocket();
    this.socket = socket;
    this.stopped = false;

    socket.on("message", (message: Buffer, remoteInfo: RemoteInfo) => {
      if (this.stopped) {
        return;
      }

      this.handlers.onMessage?.(message.toString("utf8"), {
        address: remoteInfo.address,
        port: remoteInfo.port
      });
    });
    socket.on("error", (error: Error) => {
      if (this.stopped) {
        return;
      }

      this.handlers.onError?.(error);
    });

    await this.bindSocket(socket);
    await this.sendStartRequestIfConfigured(socket);
  }

  async stop(): Promise<void> {
    const socket = this.socket;

    if (socket === null) {
      return;
    }

    this.socket = null;
    this.stopped = true;

    await new Promise<void>((resolve) => {
      try {
        socket.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  private async bindSocket(socket: IFacialMocapUdpSocket): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      socket.once("listening", () => {
        const address = socket.address();
        if (typeof address !== "string") {
          this.handlers.onListening?.(address);
        }
        resolve();
      });
      socket.once("error", (error: Error) => {
        reject(error);
      });

      socket.bind(this.receivePort);
    });
  }

  private async sendStartRequestIfConfigured(
    socket: IFacialMocapUdpSocket
  ): Promise<void> {
    if (this.iphoneHost === undefined) {
      return;
    }

    const target = {
      address: this.iphoneHost,
      port: IFACIALMOCAP_DEFAULT_UDP_PORT
    };
    const attemptedAtIso = new Date(this.nowMs()).toISOString();
    this.handlers.onStartRequestChanged?.({
      attempted: true,
      result: "pending",
      target,
      requestLabel: IFACIALMOCAP_UDP_START_REQUEST_LABEL,
      requestMessage: IFACIALMOCAP_UDP_START_REQUEST_V2,
      attemptedAtIso
    });

    await new Promise<void>((resolve) => {
      try {
        socket.send(
          IFACIALMOCAP_UDP_START_REQUEST_V2,
          target.port,
          target.address,
          (error) => {
            const sendError = error ?? undefined;
            this.handlers.onStartRequestChanged?.(
              createStartRequestResult({
                target,
                attemptedAtIso,
                completedAtIso: new Date(this.nowMs()).toISOString(),
                ...(sendError === undefined ? {} : { error: sendError })
              })
            );
            resolve();
          }
        );
      } catch (error) {
        this.handlers.onStartRequestChanged?.(
          createStartRequestResult({
            target,
            attemptedAtIso,
            completedAtIso: new Date(this.nowMs()).toISOString(),
            error: toError(error)
          })
        );
        resolve();
      }
    });
  }
}

function createStartRequestResult(input: {
  readonly target: RuntimePlayerInputRemoteEndpoint;
  readonly attemptedAtIso: string;
  readonly completedAtIso: string;
  readonly error?: Error;
}): RuntimePlayerInputHandshakeDiagnostics {
  const base = {
    attempted: true,
    target: input.target,
    requestLabel: IFACIALMOCAP_UDP_START_REQUEST_LABEL,
    requestMessage: IFACIALMOCAP_UDP_START_REQUEST_V2,
    attemptedAtIso: input.attemptedAtIso,
    completedAtIso: input.completedAtIso
  };

  if (input.error === undefined) {
    return {
      ...base,
      result: "sent"
    };
  }

  return {
    ...base,
    result: "error",
    errorMessage: input.error.message
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
