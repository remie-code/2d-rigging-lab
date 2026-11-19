import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { errMessage, sendJson, sendText } from "./http-messages.mjs";

const COCKPIT_DIR = fileURLToPath(new URL("../", import.meta.url));
const UI_ASSET_SUBDIRS = new Set(["vendor", "ui", "view-logic"]);

/** Domain A 既定の最小プレースホルダ HTML（Domain B が本体に差し替える）。 */
const PLACEHOLDER_HTML = `<!doctype html>
<meta charset="utf-8">
<title>Soul Cockpit</title>
<h1>Soul Cockpit</h1>
<p>Domain A placeholder. The real page is served by Domain B.</p>
<p>State: <code>GET /api/state</code> — Live: <code>GET /api/events</code> (SSE).</p>`;

/** Serve the HTML entry and browser module assets from the existing Cockpit base URL. */
export function createCockpitAssets(options) {
  const uiRootPath = options.uiRootPath ?? COCKPIT_DIR;

  /**
   * 操縦席 UI アセット（vendor/ui/view-logic 配下の `.mjs`）を配る静的ルート（serveIndex 同型の readFile→
   * JS MIME）。**トラバーサル防止**: `..` を含んでも path.relative で UI ルート脱出を弾き、正規化後の第一区画が
   * 許可サブツリー（vendor/ui/view-logic）に収まり、かつ拡張子が `.mjs` のものだけ 200 で返す。それ以外は 404。
   *
   * @param {import("node:http").ServerResponse} res
   * @param {string} pathname  リクエストパス（先頭 "/"）。
   * @returns {Promise<boolean>}  UI アセット宛として応答を握ったら true（握らなければ既存 404 へフォールスルー）。
   */
  async function tryServeUiAsset(res, pathname) {
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return false; // 不正な %エンコードは UI アセットとして扱わない（既存 404 へ委譲）。
    }
    rel = rel.replace(/^\/+/, "");
    const firstSeg = rel.split("/")[0];
    // このハンドラが「握る」のは第一区画が UI アセットサブツリーのリクエストのみ。それ以外（/api/... 等）は
    // false を返し、既存の 404 フォールスルーに委ねる（他ルートの 404 レスポンス形を 1 バイトも変えない）。
    if (!UI_ASSET_SUBDIRS.has(firstSeg)) return false;

    const notFound = () => sendJson(res, 404, { error: `not found: GET ${pathname}` });

    // 解決して UI ルート脱出とサブツリー逸脱を弾く（`..` / URL エンコードのトラバーサル防止）。
    const resolved = path.resolve(uiRootPath, rel);
    const relFromRoot = path.relative(uiRootPath, resolved);
    if (relFromRoot === "" || relFromRoot.startsWith("..") || path.isAbsolute(relFromRoot)) {
      notFound(); // UI ルートの外に出た（脱出）。
      return true;
    }
    // 正規化後の第一区画が許可サブツリー外なら拒否（例: /vendor/../cockpit-server.mjs → 第一区画が cockpit-server.mjs）。
    if (!UI_ASSET_SUBDIRS.has(relFromRoot.split(path.sep)[0])) {
      notFound();
      return true;
    }
    if (!resolved.endsWith(".mjs")) {
      notFound(); // 許可拡張子は .mjs のみ（module script は JS MIME 必須・他拡張子は配らない）。
      return true;
    }
    let body;
    try {
      body = await readFile(resolved);
    } catch {
      notFound(); // 存在しない .mjs。
      return true;
    }
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    res.end(body);
    return true;
  }

  async function serveIndex(res) {
    let htmlBody = options.indexHtml;
    if (htmlBody == null && options.indexHtmlPath != null) {
      try {
        htmlBody = await readFile(options.indexHtmlPath, "utf8");
      } catch (error) {
        sendText(res, 500, `failed to read index html: ${errMessage(error)}`);
        return;
      }
    }
    if (htmlBody == null) htmlBody = PLACEHOLDER_HTML;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(htmlBody);
  }

  return { serveIndex, tryServeUiAsset };
}
