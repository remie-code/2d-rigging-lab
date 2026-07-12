// @ts-check
/**
 * 最小 WebSocket クライアント（S1 Domain B・機械テスト用）— apps/soul/agent。
 *
 * ── なぜ自作クライアントを注入するのか（設計判断・根拠）─────────────────────
 *  channel-client は本番で Node 組み込み `globalThis.WebSocket`（undici）を使う。それは実器
 *  （runtime-player の channel-server）とは疎通実績がある（参照ドライバが C6 人間ゲートで実器へ
 *  undici WebSocket で接続・合格）。しかし機械テストでは実器を起動できない（魂→器 import 禁止・
 *  確定裁定）ため、テストダブルの WS **サーバ**（ws-double.mjs）を立てる。
 *
 *  ところがこの環境の undici WebSocket **クライアント**は、RFC 6455 に厳密準拠した自作サーバの
 *  ハンドシェイク応答（Sec-WebSocket-Accept が node/openssl で検証済みに正しい）を
 *  "Incorrect hash received" として拒否する（undici バンドル内部で処理・原因は特定できず・
 *  外部エコーサーバはこの環境ではネット遮断で検証不可）。undici クライアントの実器との疎通は
 *  参照ドライバで実証済みなので、undici クライアントそのものの健全性は本課題の検証対象外。
 *
 *  → 機械テストでは channel-client に **この最小クライアントを注入**し、ws-double サーバと実 TCP
 *  で疎通させ、channel-client の**ロジック**（hello 待ち・supportedKinds ゲート・replyTo 相関・
 *  rejected 処理・close・未知イベント黙殺）を検証する。undici↔実器の**ワイヤ疎通**は人間ゲートの
 *  preflight-e2e.mjs で通す（「配線の存在 ≠ 疎通」— 実器を 1 回通すまで確定しない）。
 *
 *  実装は W3C WebSocket API のうち channel-client が使う部分だけ（addEventListener /
 *  send / close / readyState / OPEN・CLOSING・CLOSED 定数）。RFC 6455 の最小 text frame
 *  コデック（クライアント→サーバは mask 必須・サーバ→クライアントは unmask）。依存ゼロ（node:net /
 *  node:crypto のみ）。
 */

import net from "node:net";
import { randomBytes, createHash } from "node:crypto";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B39";

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

/**
 * channel-client が使う分だけの最小 WebSocket クライアント（W3C API サブセット）。
 */
export class MinimalWebSocket {
  static CONNECTING = CONNECTING;
  static OPEN = OPEN;
  static CLOSING = CLOSING;
  static CLOSED = CLOSED;

  /** @param {string} url */
  constructor(url) {
    this.CONNECTING = CONNECTING;
    this.OPEN = OPEN;
    this.CLOSING = CLOSING;
    this.CLOSED = CLOSED;
    this.readyState = CONNECTING;
    /** @type {Record<string, Array<{ cb: Function; once: boolean }>>} */
    this._listeners = { open: [], message: [], close: [], error: [] };
    this._buffer = Buffer.alloc(0);
    this._handshakeDone = false;
    this._key = randomBytes(16).toString("base64");

    const parsed = new URL(url);
    const port = Number(parsed.port) || (parsed.protocol === "wss:" ? 443 : 80);
    const pathWithQuery = `${parsed.pathname}${parsed.search}`;

    this._socket = net.connect(port, parsed.hostname, () => {
      const request =
        `GET ${pathWithQuery} HTTP/1.1\r\n` +
        `Host: ${parsed.host}\r\n` +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Key: ${this._key}\r\n` +
        "Sec-WebSocket-Version: 13\r\n\r\n";
      this._socket.write(request);
    });

    this._socket.on("data", (chunk) => this._onData(chunk));
    this._socket.on("close", () => this._onSocketClose());
    this._socket.on("error", () => {
      this._dispatch("error", { message: "socket error" });
    });
    // テスト専用クライアント: このソケット「だけ」が event loop を生かし続けないよう unref
    // （機械テストのハング回避。データ配送・close 通知には影響しない。テスト中は node:test の
    // ランナーや pending タイマーが loop を保持するので早期終了はしない）。
    this._socket.unref();
  }

  /**
   * @param {string} type
   * @param {Function} cb
   * @param {{ once?: boolean }} [opts]
   */
  addEventListener(type, cb, opts = {}) {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push({ cb, once: opts.once === true });
  }

  /** @param {string} data  text フレームとして mask して送る。 */
  send(data) {
    if (this.readyState !== OPEN) {
      throw new Error("MinimalWebSocket: send on non-open socket.");
    }
    this._socket.write(encodeMaskedTextFrame(String(data)));
  }

  close() {
    if (this.readyState === CLOSED || this.readyState === CLOSING) {
      return;
    }
    this.readyState = CLOSING;
    try {
      // close frame（opcode 0x8・mask 必須・空 payload）。
      this._socket.write(encodeMaskedFrame(0x8, Buffer.alloc(0)));
      this._socket.end();
    } catch {
      // best-effort
    }
  }

  /** @param {Buffer} chunk */
  _onData(chunk) {
    this._buffer = Buffer.concat([this._buffer, chunk]);
    if (!this._handshakeDone) {
      const headerEnd = this._buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        return; // ヘッダ未完。
      }
      const headerText = this._buffer.subarray(0, headerEnd).toString("utf8");
      this._buffer = this._buffer.subarray(headerEnd + 4);
      if (!/^HTTP\/1\.1 101/i.test(headerText)) {
        this._dispatch("error", { message: "handshake failed (non-101)." });
        this._socket.destroy();
        return;
      }
      // accept 照合（RFC 6455）。不一致はエラー。
      const match = headerText.match(/sec-websocket-accept:\s*(.+)\r?\n?/i);
      const expected = createHash("sha1").update(this._key + WS_GUID).digest("base64");
      if (!match || match[1].trim() !== expected) {
        this._dispatch("error", { message: "Incorrect Sec-WebSocket-Accept." });
        this._socket.destroy();
        return;
      }
      this._handshakeDone = true;
      this.readyState = OPEN;
      this._dispatch("open", {});
    }
    // 残りバッファからフレームを取り出す。
    for (;;) {
      const frame = decodeServerFrame(this._buffer);
      if (frame === null) {
        break;
      }
      this._buffer = frame.rest;
      if (frame.opcode === 0x8) {
        // close frame。
        this.readyState = CLOSING;
        this._socket.end();
        continue;
      }
      if (frame.opcode === 0x1) {
        this._dispatch("message", { data: frame.payload.toString("utf8") });
      }
      // 他 opcode（ping/pong 等）はテストで無視。
    }
  }

  _onSocketClose() {
    if (this.readyState === CLOSED) {
      return;
    }
    this.readyState = CLOSED;
    this._dispatch("close", { code: 1006, reason: "" });
    // ソケットの残ハンドルを確実に解放（listener 除去 + destroy）。event loop に残さない。
    try {
      this._socket.removeAllListeners();
      this._socket.destroy();
    } catch {
      // best-effort
    }
  }

  /**
   * @param {string} type
   * @param {object} event
   */
  _dispatch(type, event) {
    const listeners = this._listeners[type];
    if (!listeners || listeners.length === 0) {
      return;
    }
    const remaining = [];
    for (const entry of listeners) {
      try {
        entry.cb(event);
      } catch {
        // リスナ例外は握り潰す（テストダブルの堅牢性）。
      }
      if (!entry.once) {
        remaining.push(entry);
      }
    }
    this._listeners[type] = remaining;
  }
}

/**
 * text frame を mask して組む（クライアント→サーバ）。
 * @param {string} text
 * @returns {Buffer}
 */
export function encodeMaskedTextFrame(text) {
  return encodeMaskedFrame(0x1, Buffer.from(text, "utf8"));
}

/**
 * 1 フレームを mask して組む（FIN=1・mask bit=1・クライアント→サーバ）。
 * @param {number} opcode
 * @param {Buffer} payload
 * @returns {Buffer}
 */
function encodeMaskedFrame(opcode, payload) {
  const length = payload.length;
  /** @type {Buffer} */
  let header;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }
  const maskKey = randomBytes(4);
  const masked = Buffer.allocUnsafe(length);
  for (let i = 0; i < length; i += 1) {
    masked[i] = payload[i] ^ maskKey[i % 4];
  }
  return Buffer.concat([header, maskKey, masked]);
}

/**
 * サーバ→クライアントのフレームをデコードする（unmask 前提＝mask bit=0）。
 * フレーム未完なら null。
 * @param {Buffer} buffer
 * @returns {{ opcode: number; payload: Buffer; rest: Buffer } | null}
 */
function decodeServerFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let payloadLen = buffer[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    payloadLen = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLen === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    payloadLen = buffer.readUInt32BE(offset + 4);
    offset += 8;
  }
  let maskKey = null;
  if (masked) {
    if (buffer.length < offset + 4) {
      return null;
    }
    maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + payloadLen) {
    return null;
  }
  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLen));
  if (maskKey) {
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] ^= maskKey[i % 4];
    }
  }
  return { opcode, payload, rest: Buffer.from(buffer.subarray(offset + payloadLen)) };
}
