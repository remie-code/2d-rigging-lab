/** Publish Cockpit events without coupling a browser tab's lifetime to the venue. */
export function createCockpitSse(snapshot) {
  /** @type {Set<import("node:http").ServerResponse>} */
  const sseClients = new Set();

  /**
   * @param {string} event
   * @param {unknown} data
   */
  function broadcast(event, data) {
    if (sseClients.size === 0) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(frame);
      } catch {
        // best-effort（切断済みは req 'close' で除去される）。
      }
    }
  }

  /**
   * SSE 接続を開き、購読者集合へ加える。接続が切れても pipeline は畳まない（UI は使い捨て）。
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   */
  function openSse(req, res) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive"
    });
    // 接続直後に現在状態を 1 発（タブ開き直しの復元）。
    res.write(": connected\n\n");
    res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
    sseClients.add(res);
    // クライアント切断 = 購読解除のみ。魂は生き続ける（blocking 基準 5）。
    req.on("close", () => {
      sseClients.delete(res);
    });
  }

  function close() {
    for (const res of sseClients) {
      try {
        res.end();
      } catch {
        // best-effort
      }
    }
    sseClients.clear();
  }

  return { broadcast, openSse, close };
}
