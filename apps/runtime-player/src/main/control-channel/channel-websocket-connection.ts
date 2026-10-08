import type { Socket } from "node:net";

import {
  controlChannelWebSocketOpcodes,
  controlChannelMaxClientMessageBytes,
  ControlChannelWebSocketDecodeError,
  decodeControlChannelWebSocketFrames,
  encodeControlChannelWebSocketCloseFrame,
  encodeControlChannelWebSocketPongFrame,
  encodeControlChannelWebSocketTextFrame
} from "./channel-websocket-frame";

/**
 * Per-socket WebSocket connection wrapper for the Control Channel. A
 * channel-neutral duplicate of the Browser Source connection wrapper (C4
 * planning §2.1): same buffering / ping-pong / close behaviour, but `send`
 * accepts any serializable message (the channel serializes response envelopes
 * and server.hello) rather than the browser-source-bound message type.
 */

const MAX_BUFFERED_CLIENT_FRAME_BYTES = controlChannelMaxClientMessageBytes + 14;

export type ControlChannelWebSocketCloseReason =
  | "oversize"
  | "incomplete-overflow"
  | "decode-error"
  | "non-final-frame"
  | "peer-close"
  | "intentional-server-close"
  | "socket-end"
  | "socket-error"
  | "socket-close";

export type ControlChannelWebSocketTransportEvent =
  | {
      readonly kind: "frame";
      readonly opcode: number;
      readonly final: boolean;
      readonly payloadBytes: number;
    }
  | {
      readonly kind: "close-requested";
      readonly reason: Exclude<
        ControlChannelWebSocketCloseReason,
        "socket-end" | "socket-error" | "socket-close"
      >;
      readonly framePayloadBytes?: number;
      readonly bufferedBytes?: number;
      readonly chunkBytes?: number;
    };

export type ControlChannelWebSocketCloseInfo = {
  readonly reason: ControlChannelWebSocketCloseReason;
  readonly terminalEvent: "socket-end" | "socket-error" | "socket-close";
};

export type ControlChannelWebSocketConnectionHandlers = {
  readonly onTextMessage: (text: string) => void;
  readonly onClose: (info: ControlChannelWebSocketCloseInfo) => void;
  readonly onTransportEvent?: (event: ControlChannelWebSocketTransportEvent) => void;
};

export class ControlChannelWebSocketConnection {
  readonly #socket: Socket;
  readonly #handlers: ControlChannelWebSocketConnectionHandlers;
  #buffer = Buffer.alloc(0);
  #closed = false;
  #closeNotified = false;
  #closeReason: Exclude<
    ControlChannelWebSocketCloseReason,
    "socket-end" | "socket-error" | "socket-close"
  > | null = null;

  constructor(input: {
    readonly socket: Socket;
    readonly handlers: ControlChannelWebSocketConnectionHandlers;
  }) {
    this.#socket = input.socket;
    this.#handlers = input.handlers;

    this.#socket.on("data", (chunk) => this.#handleData(chunk));
    this.#socket.on("close", () => this.#handleClosed("socket-close"));
    this.#socket.on("end", () => this.#handleClosed("socket-end"));
    this.#socket.on("error", () => this.#handleClosed("socket-error"));
  }

  send(message: unknown): void {
    if (this.#closed || this.#socket.destroyed) {
      return;
    }

    this.#socket.write(
      encodeControlChannelWebSocketTextFrame(JSON.stringify(message))
    );
  }

  close(): void {
    this.#requestClose("intentional-server-close");
  }

  #handleData(chunk: Buffer): void {
    if (this.#closed) {
      return;
    }

    if (this.#buffer.byteLength + chunk.byteLength >
      MAX_BUFFERED_CLIENT_FRAME_BYTES) {
      this.#requestClose("incomplete-overflow", {
        bufferedBytes: this.#buffer.byteLength,
        chunkBytes: chunk.byteLength
      });
      return;
    }

    this.#buffer = Buffer.concat([this.#buffer, chunk]);

    let decoded:
      | ReturnType<typeof decodeControlChannelWebSocketFrames>
      | null = null;

    try {
      decoded = decodeControlChannelWebSocketFrames(this.#buffer);
    } catch (error) {
      const decodeError = error instanceof ControlChannelWebSocketDecodeError
        ? error
        : null;
      this.#requestClose(
        decodeError?.kind === "oversize"
          ? "oversize"
          : "decode-error",
        ...(decodeError?.payloadBytes === undefined
          ? []
          : [{ framePayloadBytes: decodeError.payloadBytes }])
      );
      return;
    }

    this.#buffer = Buffer.from(decoded.remaining);

    for (const frame of decoded.frames) {
      this.#handlers.onTransportEvent?.({
        kind: "frame",
        opcode: frame.opcode,
        final: frame.final,
        payloadBytes: frame.payload.byteLength
      });

      if (!frame.final) {
        this.#requestClose("non-final-frame");
        return;
      }

      if (frame.opcode === controlChannelWebSocketOpcodes.text) {
        this.#handlers.onTextMessage(frame.payload.toString("utf8"));
        continue;
      }

      if (frame.opcode === controlChannelWebSocketOpcodes.ping) {
        this.#socket.write(encodeControlChannelWebSocketPongFrame(frame.payload));
        continue;
      }

      if (frame.opcode === controlChannelWebSocketOpcodes.close) {
        this.#requestClose("peer-close");
        return;
      }
    }
  }

  #requestClose(
    reason: Exclude<
      ControlChannelWebSocketCloseReason,
      "socket-end" | "socket-error" | "socket-close"
    >,
    metadata: {
      readonly framePayloadBytes?: number;
      readonly bufferedBytes?: number;
      readonly chunkBytes?: number;
    } = {}
  ): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#closeReason = reason;
    this.#handlers.onTransportEvent?.({
      kind: "close-requested",
      reason,
      ...metadata
    });

    if (!this.#socket.destroyed) {
      this.#socket.end(encodeControlChannelWebSocketCloseFrame());
    }
  }

  #handleClosed(
    terminalEvent: "socket-end" | "socket-error" | "socket-close"
  ): void {
    if (this.#closeNotified) {
      return;
    }

    this.#closeNotified = true;
    this.#closed = true;
    this.#handlers.onClose({
      reason: this.#closeReason ?? terminalEvent,
      terminalEvent
    });
  }
}
