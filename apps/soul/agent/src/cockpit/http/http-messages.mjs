// ── HTTP レスポンスヘルパ ─────────────────────────────────────────────

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} obj
 */
export function sendJson(res, status, obj) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {string} text
 */
export function sendText(res, status, text) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

/**
 * POST の body を JSON として読む（非 JSON / 空は {} にフォールバック・上限 1MiB）。
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<Record<string, any>>}
 */
export function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    let aborted = false;
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        aborted = true;
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      if (aborted) return;
      if (data.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(data);
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

/**
 * Read a JSON object while preserving malformed-body information for strict APIs.
 * Existing routes intentionally use readJsonBody()'s permissive `{}` fallback; the conversation-instruction
 * API uses this helper so malformed JSON is rejected without changing those endpoint contracts.
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<{ ok: true; value: Record<string, any> } | { ok: false }>}
 */
export function readJsonBodyStrict(req) {
  return new Promise((resolve) => {
    let data = "";
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      resolve({ ok: false });
    };
    req.on("data", (chunk) => {
      if (settled) return;
      data += chunk;
      if (data.length > 1_000_000) {
        try {
          req.destroy();
        } catch {
          // best-effort
        }
        fail();
      }
    });
    req.on("end", () => {
      if (settled) return;
      try {
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          fail();
          return;
        }
        settled = true;
        resolve({ ok: true, value: parsed });
      } catch {
        fail();
      }
    });
    req.on("error", fail);
  });
}

/** @param {unknown} err */
export function errMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
