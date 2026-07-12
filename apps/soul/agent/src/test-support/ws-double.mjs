// @ts-check
/**
 * Control Channel サーバのテストダブル（S1 Domain B・機械テスト用）— apps/soul/agent。
 *
 * ── なぜ自作 WS サーバなのか（設計判断・根拠）─────────────────────────────
 *  Node 22 の組み込み `WebSocket` は**クライアント**のみ（サーバ側は無い）。channel-client の
 *  写経正確性を実配線で検証するには WS サーバが要る。しかし:
 *    - 器（runtime-player）の実 channel-server を import/起動するのは特区規律違反（魂→器コード
 *      import 禁止・確定裁定）。コピーも禁止。
 *    - `ws` 等の npm 依存を足すのは Domain B 規律違反（ランタイム依存は agent-sdk のみ・install 禁止）。
 *  → 依存ゼロを保つ唯一の道が「node:http の upgrade + 最小 WS フレームコデックの自作」。
 *    text frame の送受信と mask デコードだけの最小実装で、hello → intent.speech 受信 →
 *    accepted/rejected 返信という契約 examples（channel-exchange-examples.json）のやりとりを
 *    忠実に再現する。これは器コードのコピーではなく RFC 6455 の最小自前実装。
 *
 * ── これは疎通の証明ではない（重要な限界）──────────────────────────────
 *  このダブルは channel-client / speak の**配線の存在**（hello 照合・replyTo 相関・payload 形・
 *  accepted→play）を検証する。**実器とのフル疎通は人間ゲートの preflight-e2e.mjs で行う**。
 *  「配線の存在 ≠ 疎通」（C 系列の教訓）— 実器の channel-server が同じ返信をするかは、実器を
 *  起動して 1 回通すまで確定しない。
 */

import { createServer } from "node:http";
import { createHash } from "node:crypto";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B39";

/**
 * Control Channel サーバのテストダブルを作る。
 * @param {object} [options]
 * @param {string[]} [options.supportedKinds]  server.hello で広告する kinds（既定 3 種）。
 * @param {number} [options.protocol]  server.hello の protocol（既定 1）。
 * @param {boolean} [options.sendHello]  接続時に server.hello を送るか（既定 true）。false で hello 不着を再現。
 * @param {(payload: any, message: any) => { result: string; error?: unknown }} [options.onSpeech]
 *   intent.speech を受けたときの返答判断（既定 accepted）。rejected を返せば拒否も再現できる。
 *   `{ result: "drop" }` を返すと返信せず接続を落とす（応答前切断の再現＝pending reject テスト用）。
 * @param {(payload: any, message: any) => { result: string; error?: unknown }} [options.onEnvelope]
 *   intent.envelope を受けたときの返答判断（既定 accepted・S4）。onSpeech と同じ判定インタフェース。
 * @returns {{
 *   listen: (port?: number) => Promise<string>;
 *   url: () => string;
 *   close: () => Promise<void>;
 *   received: any[];
 *   connectionCount: () => number;
 *   sendServerEvent: (obj: unknown) => void;
 *   sendRawText: (text: string) => void;
 *   dropConnections: () => void;
 * }}
 */
export function createChannelServerDouble(options = {}) {
  const supportedKinds = options.supportedKinds ?? [
    "intent.set",
    "intent.envelope",
    "intent.speech"
  ];
  const protocol = options.protocol ?? 1;
  const sendHello = options.sendHello ?? true;
  const onSpeech = options.onSpeech ?? (() => ({ result: "accepted" }));
  const onEnvelope = options.onEnvelope ?? (() => ({ result: "accepted" }));

  /** @type {any[]} */
  const received = [];
  /** @type {Set<import("node:net").Socket>} */
  const sockets = new Set();
  let boundPort = 0;

  const server = createServer((_req, res) => {
    res.writeHead(426, { "content-type": "text/plain" });
    res.end("Upgrade Required");
  });

  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string") {
      socket.destroy();
      return;
    }
    const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => sockets.delete(socket));

    if (sendHello) {
      socket.write(
        encodeTextFrame(
          JSON.stringify({
            v: 1,
            kind: "server.hello",
            payload: { protocol, supportedKinds }
          })
        )
      );
    }

    let buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const frame = decodeFrame(buffer);
        if (frame === null) {
          break; // フレーム未完 → 次の data を待つ。
        }
        buffer = frame.rest;
        if (frame.opcode === 0x8) {
          // close frame → close で応答して閉じる。
          try {
            socket.write(Buffer.from([0x88, 0x00]));
          } catch {
            // best-effort
          }
          socket.end();
          return;
        }
        if (frame.opcode === 0x9) {
          // ping → pong（opcode 0xA）。テストで通常出ないが RFC 準拠で応答。
          socket.write(encodeFrame(0xa, frame.payload));
          continue;
        }
        if (frame.opcode !== 0x1) {
          continue; // text 以外は無視。
        }
        let message;
        try {
          message = JSON.parse(frame.payload.toString("utf8"));
        } catch {
          continue; // 非 JSON は黙殺。
        }
        received.push(message);
        handleMessage(socket, message);
      }
    });
  });

  /**
   * クライアントメッセージに契約どおり応答する。
   * @param {import("node:net").Socket} socket
   * @param {any} message
   */
  function handleMessage(socket, message) {
    if (!message || typeof message.id !== "string") {
      return;
    }
    if (message.kind === "intent.speech" || message.kind === "intent.envelope") {
      const verdict =
        message.kind === "intent.speech"
          ? onSpeech(message.payload, message)
          : onEnvelope(message.payload, message);
      if (verdict.result === "drop") {
        // 応答せず接続を落とす（channel-client の pending が closedError で reject される経路）。
        socket.destroy();
        return;
      }
      const reply =
        verdict.result === "accepted"
          ? { v: 1, replyTo: message.id, result: "accepted" }
          : {
              v: 1,
              replyTo: message.id,
              result: "rejected",
              error: verdict.error ?? {
                code: "invalidPayload",
                message: `${message.kind} payload is malformed.`
              }
            };
      socket.write(encodeTextFrame(JSON.stringify(reply)));
      return;
    }
    // 未知 kind は unknownKind で拒否（接続は維持・契約 §3.5）。
    socket.write(
      encodeTextFrame(
        JSON.stringify({
          v: 1,
          replyTo: message.id,
          result: "rejected",
          error: {
            code: "unknownKind",
            message: `Unsupported request kind: ${String(message.kind)}.`
          }
        })
      )
    );
  }

  return {
    listen(port = 0) {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => {
          const address = server.address();
          boundPort = typeof address === "object" && address ? address.port : 0;
          server.removeListener("error", reject);
          // テスト終了時に「サーバだけ」が event loop を生かし続けないよう unref（クリーン
          // シャットダウンの保険・機械テストのハング回避。接続処理には影響しない）。
          server.unref();
          resolve(`ws://127.0.0.1:${boundPort}/channel`);
        });
      });
    },
    url() {
      return `ws://127.0.0.1:${boundPort}/channel`;
    },
    received,
    connectionCount() {
      return sockets.size;
    },
    /** 任意のサーバ発イベント（JSON）を全接続へ送る（未知 kind 黙殺の検証用）。 */
    sendServerEvent(obj) {
      const frame = encodeTextFrame(JSON.stringify(obj));
      for (const socket of sockets) {
        socket.write(frame);
      }
    },
    /** 非 JSON の生テキストフレームを全接続へ送る（非 JSON 黙殺の検証用）。 */
    sendRawText(text) {
      const frame = encodeTextFrame(text);
      for (const socket of sockets) {
        socket.write(frame);
      }
    },
    /** 全接続を即破棄する（サーバは開いたまま）。応答前切断の再現。 */
    dropConnections() {
      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();
    },
    close() {
      return new Promise((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        sockets.clear();
        // node v18.2+/v22: 生存接続を即断（アップグレード済みソケットの取りこぼしを無くす）。
        server.closeAllConnections?.();
        server.close(() => resolve());
      });
    }
  };
}

/**
 * text frame（マスクなし・サーバ→クライアント）を組む。
 * @param {string} text
 * @returns {Buffer}
 */
export function encodeTextFrame(text) {
  return encodeFrame(0x1, Buffer.from(text, "utf8"));
}

/**
 * 1 フレームを組む（FIN=1・マスクなし）。opcode と payload を受ける。
 * @param {number} opcode
 * @param {Buffer} payload
 * @returns {Buffer}
 */
function encodeFrame(opcode, payload) {
  const length = payload.length;
  /** @type {Buffer} */
  let header;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    // 上位 32bit は 0（テストで 4GiB 超は来ない）。
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }
  return Buffer.concat([header, payload]);
}

/**
 * バッファ先頭から 1 フレームをデコードする（クライアント→サーバ＝mask 必須を unmask）。
 * フレーム未完なら null（呼び出し側は次の data を待つ）。
 * @param {Buffer} buffer
 * @returns {{ opcode: number; payload: Buffer; rest: Buffer } | null}
 */
export function decodeFrame(buffer) {
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
    // 下位 32bit のみ採用（テスト payload は小さい）。
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
  const rawPayload = buffer.subarray(offset, offset + payloadLen);
  const payload = Buffer.from(rawPayload); // コピー（元バッファの subarray を握らない）
  if (maskKey) {
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] ^= maskKey[i % 4];
    }
  }
  const rest = buffer.subarray(offset + payloadLen);
  return { opcode, payload, rest: Buffer.from(rest) };
}
