/**
 * RFC6455 WebSocket frame codec for the Control Channel. A channel-neutral
 * duplicate of the Browser Source frame codec (C4 planning §2.1): the pure
 * transport core carries no request/reply semantics, so the channel keeps its
 * own small copy rather than editing the browser-source-named shared module and
 * risking regression in that working, tested path. The codec is byte-identical
 * in behaviour; only the names and the max-message constant are channel-scoped.
 */

export type ControlChannelDecodedWebSocketFrame = {
  readonly final: boolean;
  readonly opcode: number;
  readonly payload: Buffer;
};

const OPCODE_TEXT = 0x1;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

export const controlChannelMaxClientMessageBytes = 4096;

export const controlChannelWebSocketOpcodes = {
  text: OPCODE_TEXT,
  close: OPCODE_CLOSE,
  ping: OPCODE_PING,
  pong: OPCODE_PONG
} as const;

export function encodeControlChannelWebSocketTextFrame(text: string): Buffer {
  return encodeWebSocketFrame(OPCODE_TEXT, Buffer.from(text, "utf8"));
}

export function encodeControlChannelWebSocketPongFrame(payload: Buffer): Buffer {
  return encodeWebSocketFrame(OPCODE_PONG, payload);
}

export function encodeControlChannelWebSocketCloseFrame(): Buffer {
  return encodeWebSocketFrame(OPCODE_CLOSE, Buffer.alloc(0));
}

export function decodeControlChannelWebSocketFrames(input: Buffer): {
  readonly frames: readonly ControlChannelDecodedWebSocketFrame[];
  readonly remaining: Buffer;
} {
  const frames: ControlChannelDecodedWebSocketFrame[] = [];
  let offset = 0;

  while (offset < input.byteLength) {
    const frameStart = offset;

    if (input.byteLength - offset < 2) {
      break;
    }

    const firstByte = input[offset]!;
    const secondByte = input[offset + 1]!;
    offset += 2;

    const final = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;

    if (payloadLength === 126) {
      if (input.byteLength - offset < 2) {
        offset = frameStart;
        break;
      }
      payloadLength = input.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (input.byteLength - offset < 8) {
        offset = frameStart;
        break;
      }
      const longLength = input.readBigUInt64BE(offset);
      if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("WebSocket payload is too large.");
      }
      payloadLength = Number(longLength);
      offset += 8;
    }

    if (!masked) {
      throw new Error("Control Channel WebSocket client frames must be masked.");
    }

    if (payloadLength > controlChannelMaxClientMessageBytes) {
      throw new Error("Control Channel WebSocket client frame is too large.");
    }

    if (input.byteLength - offset < 4 + payloadLength) {
      offset = frameStart;
      break;
    }

    const mask = input.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.from(input.subarray(offset, offset + payloadLength));
    offset += payloadLength;

    for (let index = 0; index < payload.byteLength; index += 1) {
      payload[index] = payload[index]! ^ mask[index % 4]!;
    }

    frames.push({
      final,
      opcode,
      payload
    });
  }

  return {
    frames,
    remaining: input.subarray(offset)
  };
}

function encodeWebSocketFrame(opcode: number, payload: Buffer): Buffer {
  const payloadLength = payload.byteLength;
  const headerLength = payloadLength < 126
    ? 2
    : payloadLength <= 0xffff
      ? 4
      : 10;
  const frame = Buffer.alloc(headerLength + payloadLength);

  frame[0] = 0x80 | opcode;

  if (payloadLength < 126) {
    frame[1] = payloadLength;
    payload.copy(frame, 2);
    return frame;
  }

  if (payloadLength <= 0xffff) {
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
    payload.copy(frame, 4);
    return frame;
  }

  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(payloadLength), 2);
  payload.copy(frame, 10);
  return frame;
}
