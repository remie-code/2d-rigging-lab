// @ts-check
/**
 * コクピット疎通 preflight（S2.5 Domain B・機械ゲート）— apps/soul/agent。
 * **実マイク不使用**（耳の Start を押さない = 実デバイス非依存）。サーバをloopbackに起動し:
 *
 *   GET /            → 200 で実ページ HTML（Soul Cockpit・timeline 領域を含む）
 *   GET /api/state   → 200 で状態 JSON（ears=stopped・health 構造）
 *   GET /api/devices → 200（デバイスゼロ/列挙失敗でも 200 で返る）
 *
 * を検証し、成否を終了コードで返す（既存 preflight-*.mjs の流儀）。終了時に server.close() で
 * 全ハンドルを解放（ハングしない）。settings store は OS temp を注入して実設定ファイルを汚さない。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-cockpit.mjs
 *   exit 0 = PASS / exit 1 = 失敗。
 */

import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { cockpitHtmlPath } from "../src/cockpit/cockpit-page.mjs";

const log = (msg) => process.stdout.write(`[preflight-cockpit] ${msg}\n`);

/** @param {string} url */
function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: "GET" },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), "cockpit-preflight-"));
  const server = createCockpitServer({
    indexHtmlPath: cockpitHtmlPath,
    settingsStore: createFileSettingsStore({ path: join(tmp, "cockpit-settings.json") })
  });

  let failed = false;
  const fail = (msg) => {
    log(`FAIL: ${msg}`);
    failed = true;
  };

  try {
    const url = await server.listen(0);
    log(`server listening at ${url} (loopback)`);
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) fail(`bound URL is not loopback: ${url}`);

    // GET / — 実ページ HTML。
    const root = await get(`${url}/`);
    const rootHtml = /text\/html/.test(String(root.headers["content-type"]));
    const rootHasPage = /Soul Cockpit/.test(root.body) && /id="timeline"/.test(root.body);
    log(`GET /            → ${root.status} html=${rootHtml} hasTimeline=${/id="timeline"/.test(root.body)}`);
    if (root.status !== 200 || !rootHtml || !rootHasPage) fail("GET / did not return the cockpit HTML page");

    // GET /api/state — 状態スナップショット。
    const stateRes = await get(`${url}/api/state`);
    let state = null;
    try {
      state = JSON.parse(stateRes.body);
    } catch {
      /* leave null */
    }
    log(`GET /api/state   → ${stateRes.status} ears=${state && state.ears} health=${state && !!state.health}`);
    if (stateRes.status !== 200 || !state || state.ears !== "stopped" || !state.health) {
      fail("GET /api/state did not return a stopped-state snapshot");
    }

    // GET /api/devices — 列挙（実ffmpegを spawn するが録音しない・デバイスゼロ/失敗でも 200）。
    const devRes = await get(`${url}/api/devices`);
    let dev = null;
    try {
      dev = JSON.parse(devRes.body);
    } catch {
      /* leave null */
    }
    const devOk = devRes.status === 200 && dev && Array.isArray(dev.devices);
    log(
      `GET /api/devices → ${devRes.status} deviceCount=${dev && dev.devices ? dev.devices.length : "?"} error=${dev ? dev.error : "?"}`
    );
    if (!devOk) fail("GET /api/devices did not return 200 with a devices array");

    log(failed ? "RESULT: FAIL" : "RESULT: PASS (page served, state + devices respond; mic untouched)");
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    failed = true;
  } finally {
    await server.close();
    log("server closed (no hang)");
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* best-effort temp cleanup */
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-cockpit] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
