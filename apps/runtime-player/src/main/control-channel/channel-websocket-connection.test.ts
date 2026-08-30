import { EventEmitter } from "node:events";
import type { Socket } from "node:net";

import { describe, expect, it } from "vitest";

import {
  ControlChannelWebSocketConnection,
  type ControlChannelWebSocketCloseInfo,
  type ControlChannelWebSocketTransportEvent
} from "./channel-websocket-connection";

describe("ControlChannelWebSocketConnection transport diagnostics", () => {
  it("keeps the existing 4096-byte frame behavior and observes 4097 bytes as oversize", () => {
    const exactLimit = createFixture();
    exactLimit.socket.emit("data", createMaskedFrame({ payloadBytes: 4096 }));

    expect(exactLimit.messages).toHaveLength(1);
    expect(Buffer.byteLength(exactLimit.messages[0]!)).toBe(4096);
    expect(exactLimit.events.some((event) =>
      event.kind === "close-requested"
    )).toBe(false);

    const oversize = createFixture();
    oversize.socket.emit("data", createMaskedFrame({ payloadBytes: 4097 }));
    oversize.socket.emit("end");

    expect(oversize.events).toContainEqual(expect.objectContaining({
      kind: "close-requested",
      reason: "oversize",
      framePayloadBytes: 4097
    }));
    expect(oversize.closes).toEqual([{
      reason: "oversize",
      terminalEvent: "socket-end"
    }]);
  });

  it.each([
    {
      label: "an accumulation exceeding the raw incomplete-frame guard",
      send: (socket: FakeSocket) => socket.emit("data", Buffer.alloc(4111)),
      reason: "incomplete-overflow"
    },
    {
      label: "a decode error",
      send: (socket: FakeSocket) => socket.emit("data", Buffer.from([0x81, 1, 65])),
      reason: "decode-error"
    },
    {
      label: "a non-final frame",
      send: (socket: FakeSocket) => socket.emit("data", createMaskedFrame({
        payloadBytes: 1,
        final: false
      })),
      reason: "non-final-frame"
    },
    {
      label: "a peer close frame",
      send: (socket: FakeSocket) => socket.emit("data", createMaskedFrame({
        payloadBytes: 0,
        opcode: 0x8
      })),
      reason: "peer-close"
    }
  ] as const)("records close reason for $label", ({ send, reason }) => {
    const fixture = createFixture();
    send(fixture.socket);
    fixture.socket.emit("end");

    expect(fixture.events).toContainEqual(expect.objectContaining({
      kind: "close-requested",
      reason
    }));
    expect(fixture.closes).toEqual([{
      reason,
      terminalEvent: "socket-end"
    }]);
  });

  it("distinguishes socket end/error and intentional server close", () => {
    const ended = createFixture();
    ended.socket.emit("end");
    expect(ended.closes).toEqual([{
      reason: "socket-end",
      terminalEvent: "socket-end"
    }]);

    const errored = createFixture();
    errored.socket.emit("error", new Error("fixture"));
    expect(errored.closes).toEqual([{
      reason: "socket-error",
      terminalEvent: "socket-error"
    }]);

    const intentional = createFixture();
    intentional.connection.close();
    intentional.socket.emit("end");
    expect(intentional.events).toContainEqual({
      kind: "close-requested",
      reason: "intentional-server-close"
    });
    expect(intentional.closes).toEqual([{
      reason: "intentional-server-close",
      terminalEvent: "socket-end"
    }]);
  });
});

function createFixture(): {
  readonly socket: FakeSocket;
  readonly connection: ControlChannelWebSocketConnection;
  readonly messages: string[];
  readonly events: ControlChannelWebSocketTransportEvent[];
  readonly closes: ControlChannelWebSocketCloseInfo[];
} {
  const socket = new FakeSocket();
  const messages: string[] = [];
  const events: ControlChannelWebSocketTransportEvent[] = [];
  const closes: ControlChannelWebSocketCloseInfo[] = [];
  const connection = new ControlChannelWebSocketConnection({
    socket: socket as unknown as Socket,
    handlers: {
      onTextMessage: (text) => messages.push(text),
      onClose: (info) => closes.push(info),
      onTransportEvent: (event) => events.push(event)
    }
  });

  return { socket, connection, messages, events, closes };
}

class FakeSocket extends EventEmitter {
  destroyed = false;
  readonly writes: Buffer[] = [];

  write(chunk: Uint8Array): boolean {
    this.writes.push(Buffer.from(chunk));
    return true;
  }

  end(chunk?: Uint8Array): this {
    if (chunk !== undefined) {
      this.writes.push(Buffer.from(chunk));
    }
    return this;
  }
}

function createMaskedFrame(input: {
  readonly payloadBytes: number;
  readonly final?: boolean;
  readonly opcode?: number;
}): Buffer {
  const payload = Buffer.alloc(input.payloadBytes, 65);
  const mask = Buffer.from([1, 2, 3, 4]);
  const headerBytes = input.payloadBytes < 126 ? 2 : 4;
  const frame = Buffer.alloc(headerBytes + mask.byteLength + payload.byteLength);
  frame[0] = (input.final === false ? 0 : 0x80) | (input.opcode ?? 0x1);
  if (input.payloadBytes < 126) {
    frame[1] = 0x80 | input.payloadBytes;
  } else {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(input.payloadBytes, 2);
  }
  mask.copy(frame, headerBytes);
  for (let index = 0; index < payload.byteLength; index += 1) {
    frame[headerBytes + mask.byteLength + index] =
      payload[index]! ^ mask[index % mask.byteLength]!;
  }
  return frame;
}
