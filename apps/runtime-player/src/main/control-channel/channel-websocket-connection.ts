import type { Socket } from "node:net";

import {
  controlChannelWebSocketOpcodes,
  controlChannelMaxClientMessageBytes,
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

export type ControlChannelWebSocketConnectionHandlers = {
  readonly onTextMessage: (text: string) => void;
  readonly onClose: () => void;
};

export class ControlChannelWebSocketConnection {
  readonly #socket: Socket;
  readonly #handlers: ControlChannelWebSocketConnectionHandlers;
  #buffer = Buffer.alloc(0);
  #closed = false;
  #closeNotified = false;

  constructor(input: {
    readonly socket: Socket;
    readonly handlers: ControlChannelWebSocketConnectionHandlers;
  }) {
    this.#socket = input.socket;
    this.#handlers = input.handlers;

    this.#socket.on("data", (chunk) => this.#handleData(chunk));
    this.#socket.on("close", () => this.#handleClosed());
    this.#socket.on("end", () => this.#handleClosed());
    this.#socket.on("error", () => this.#handleClosed());
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
    if (this.#closed) {
      return;
    }

    this.#closed = true;

    if (!this.#socket.destroyed) {
      this.#socket.end(encodeControlChannelWebSocketCloseFrame());
    }
  }

  #handleData(chunk: Buffer): void {
    if (this.#closed) {
      return;
    }

    if (this.#buffer.byteLength + chunk.byteLength >
      MAX_BUFFERED_CLIENT_FRAME_BYTES) {
      this.close();
      return;
    }

    this.#buffer = Buffer.concat([this.#buffer, chunk]);

    let decoded:
      | ReturnType<typeof decodeControlChannelWebSocketFrames>
      | null = null;

    try {
      decoded = decodeControlChannelWebSocketFrames(this.#buffer);
    } catch {
      this.close();
      return;
    }

    this.#buffer = Buffer.from(decoded.remaining);

    for (const frame of decoded.frames) {
      if (!frame.final) {
        this.close();
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
        this.close();
        return;
      }
    }
  }

  #handleClosed(): void {
    if (this.#closeNotified) {
      return;
    }

    this.#closeNotified = true;
    this.#closed = true;
    this.#handlers.onClose();
  }
}
