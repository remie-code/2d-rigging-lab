import type { Socket } from "node:net";

import type {
  RuntimePlayerBrowserSourceServerMessage
} from "../../preload/browser-source-transport-contract";
import {
  browserSourceWebSocketOpcodes,
  browserSourceMaxClientMessageBytes,
  decodeBrowserSourceWebSocketFrames,
  encodeBrowserSourceWebSocketCloseFrame,
  encodeBrowserSourceWebSocketPongFrame,
  encodeBrowserSourceWebSocketTextFrame
} from "./browser-source-websocket-frame";

const MAX_BUFFERED_CLIENT_FRAME_BYTES = browserSourceMaxClientMessageBytes + 14;

export type BrowserSourceWebSocketConnectionHandlers = {
  readonly onTextMessage: (text: string) => void;
  readonly onClose: () => void;
};

export class BrowserSourceWebSocketConnection {
  readonly #socket: Socket;
  readonly #handlers: BrowserSourceWebSocketConnectionHandlers;
  #buffer = Buffer.alloc(0);
  #closed = false;
  #closeNotified = false;

  constructor(input: {
    readonly socket: Socket;
    readonly handlers: BrowserSourceWebSocketConnectionHandlers;
  }) {
    this.#socket = input.socket;
    this.#handlers = input.handlers;

    this.#socket.on("data", (chunk) => this.#handleData(chunk));
    this.#socket.on("close", () => this.#handleClosed());
    this.#socket.on("end", () => this.#handleClosed());
    this.#socket.on("error", () => this.#handleClosed());
  }

  send(message: RuntimePlayerBrowserSourceServerMessage): void {
    if (this.#closed || this.#socket.destroyed) {
      return;
    }

    this.#socket.write(
      encodeBrowserSourceWebSocketTextFrame(JSON.stringify(message))
    );
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;

    if (!this.#socket.destroyed) {
      this.#socket.end(encodeBrowserSourceWebSocketCloseFrame());
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
      | ReturnType<typeof decodeBrowserSourceWebSocketFrames>
      | null = null;

    try {
      decoded = decodeBrowserSourceWebSocketFrames(this.#buffer);
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

      if (frame.opcode === browserSourceWebSocketOpcodes.text) {
        this.#handlers.onTextMessage(frame.payload.toString("utf8"));
        continue;
      }

      if (frame.opcode === browserSourceWebSocketOpcodes.ping) {
        this.#socket.write(encodeBrowserSourceWebSocketPongFrame(frame.payload));
        continue;
      }

      if (frame.opcode === browserSourceWebSocketOpcodes.close) {
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
