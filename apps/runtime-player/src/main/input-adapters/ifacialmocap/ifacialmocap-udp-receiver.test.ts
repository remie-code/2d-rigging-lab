import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerInputHandshakeDiagnostics,
  RuntimePlayerInputRemoteEndpoint
} from "../../../preload/input-bridge-contract";
import {
  IFacialMocapUdpReceiver,
  type IFacialMocapUdpSocket
} from "./ifacialmocap-udp-receiver";
import { IFACIALMOCAP_UDP_START_REQUEST_V2 } from "./ifacialmocap-udp-start-request";

type Listener = (...args: never[]) => void;

class FakeUdpSocket {
  readonly sentMessages: Array<{
    readonly message: string;
    readonly port: number;
    readonly address: string;
  }> = [];
  bindPort: number | null = null;
  closed = false;
  sendError: Error | null = null;
  private readonly listeners = new Map<string, Listener[]>();
  private readonly onceListeners = new Map<string, Listener[]>();

  on(eventName: string, listener: Listener): this {
    this.listeners.set(eventName, [
      ...(this.listeners.get(eventName) ?? []),
      listener
    ]);
    return this;
  }

  once(eventName: string, listener: Listener): this {
    this.onceListeners.set(eventName, [
      ...(this.onceListeners.get(eventName) ?? []),
      listener
    ]);
    return this;
  }

  bind(port: number): void {
    this.bindPort = port;
  }

  close(callback?: () => void): void {
    this.closed = true;
    callback?.();
  }

  send(
    message: string | Uint8Array,
    port: number,
    address: string,
    callback?: (error: Error | null, bytes: number) => void
  ): void {
    const messageText = typeof message === "string"
      ? message
      : Buffer.from(message).toString("utf8");
    this.sentMessages.push({
      message: messageText,
      port,
      address
    });
    callback?.(this.sendError, Buffer.byteLength(messageText));
  }

  address(): AddressInfo {
    return {
      address: "0.0.0.0",
      family: "IPv4",
      port: this.bindPort ?? 0
    };
  }

  emitListening(): void {
    this.emit("listening");
  }

  emitMessage(rawFrame: string, remote: RuntimePlayerInputRemoteEndpoint): void {
    this.emit(
      "message",
      Buffer.from(rawFrame, "utf8"),
      {
        address: remote.address,
        port: remote.port,
        family: "IPv4",
        size: Buffer.byteLength(rawFrame)
      }
    );
  }

  emitError(error: Error): void {
    this.emit("error", error);
  }

  private emit(eventName: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(...(args as never[]));
    }

    const onceListeners = this.onceListeners.get(eventName) ?? [];
    this.onceListeners.delete(eventName);
    for (const listener of onceListeners) {
      listener(...(args as never[]));
    }
  }
}

describe("iFacialMocap UDP receiver", () => {
  it("binds the passive UDP listener without sending a start request", async () => {
    const socket = new FakeUdpSocket();
    const listeningAddresses: AddressInfo[] = [];
    const receiver = new IFacialMocapUdpReceiver({
      receivePort: 49983,
      createUdpSocket: () => socket as unknown as IFacialMocapUdpSocket,
      handlers: {
        onListening: (address) => listeningAddresses.push(address)
      }
    });

    const startPromise = receiver.start();
    socket.emitListening();
    await startPromise;

    expect(socket.bindPort).toBe(49983);
    expect(socket.sentMessages).toEqual([]);
    expect(listeningAddresses).toEqual([
      {
        address: "0.0.0.0",
        family: "IPv4",
        port: 49983
      }
    ]);
  });

  it("sends the v2 UDP start request when an iPhone host is configured", async () => {
    const socket = new FakeUdpSocket();
    const handshakes: RuntimePlayerInputHandshakeDiagnostics[] = [];
    const receiver = new IFacialMocapUdpReceiver({
      receivePort: 49983,
      iphoneHost: "192.168.1.30",
      nowMs: () => 1000,
      createUdpSocket: () => socket as unknown as IFacialMocapUdpSocket,
      handlers: {
        onStartRequestChanged: (diagnostics) => handshakes.push(diagnostics)
      }
    });

    const startPromise = receiver.start();
    socket.emitListening();
    await startPromise;

    expect(socket.sentMessages).toEqual([
      {
        message: IFACIALMOCAP_UDP_START_REQUEST_V2,
        port: 49983,
        address: "192.168.1.30"
      }
    ]);
    expect(handshakes.map((handshake) => handshake.result)).toEqual([
      "pending",
      "sent"
    ]);
  });

  it("keeps listening when the optional start request send fails", async () => {
    const socket = new FakeUdpSocket();
    socket.sendError = new Error("network unreachable");
    const handshakes: RuntimePlayerInputHandshakeDiagnostics[] = [];
    const receiver = new IFacialMocapUdpReceiver({
      receivePort: 49983,
      iphoneHost: "192.168.1.30",
      nowMs: () => 1000,
      createUdpSocket: () => socket as unknown as IFacialMocapUdpSocket,
      handlers: {
        onStartRequestChanged: (diagnostics) => handshakes.push(diagnostics)
      }
    });

    const startPromise = receiver.start();
    socket.emitListening();
    await startPromise;

    expect(handshakes.at(-1)).toMatchObject({
      result: "error",
      errorMessage: "network unreachable"
    });
    expect(socket.closed).toBe(false);
  });

  it("emits UTF-8 frame text and closes the socket", async () => {
    const socket = new FakeUdpSocket();
    const messages: Array<{
      readonly rawFrame: string;
      readonly remote: RuntimePlayerInputRemoteEndpoint;
    }> = [];
    const receiver = new IFacialMocapUdpReceiver({
      createUdpSocket: () => socket as unknown as IFacialMocapUdpSocket,
      handlers: {
        onMessage: (rawFrame, remote) => messages.push({ rawFrame, remote })
      }
    });

    const startPromise = receiver.start();
    socket.emitListening();
    await startPromise;
    socket.emitMessage("jawOpen-50|", {
      address: "192.168.1.30",
      port: 49983
    });
    await receiver.stop();

    expect(messages).toEqual([
      {
        rawFrame: "jawOpen-50|",
        remote: {
          address: "192.168.1.30",
          port: 49983
        }
      }
    ]);
    expect(socket.closed).toBe(true);
  });
});
