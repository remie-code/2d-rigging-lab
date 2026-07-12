// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

import { createCockpitServer } from "./cockpit-server.mjs";
import { cockpitHtmlPath } from "./cockpit-page.mjs";

// コクピット・ページの機械テスト（S2.5 Domain B）。**見た目はテストしない**（人間ゲート）。
// 構造の存在（ヘッダ状態・device ドロップダウン・timeline・footer・Start/Stop の識別子）と、
// 消費するワイヤ契約（SSE + 制御エンドポイント）が単一ファイルに含まれることだけを固定する。

/** @param {string} url */
function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: "GET" }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("cockpit page: GET / serves the real page HTML with every required region", async () => {
  const server = createCockpitServer({ indexHtmlPath: cockpitHtmlPath });
  try {
    const url = await server.listen(0);
    const r = /** @type {any} */ (await get(`${url}/`));
    assert.equal(r.status, 200);
    assert.match(String(r.headers["content-type"]), /text\/html/);
    const html = r.body;
    // ヘッダ: Ears 状態 + whisper/ffmpeg 死活。
    assert.match(html, /id="ears-status"/);
    assert.match(html, /id="health-whisper"/);
    assert.match(html, /id="health-ffmpeg"/);
    // Microphone: ドロップダウン + Start/Stop。
    assert.match(html, /id="device-select"/);
    assert.match(html, /id="btn-start"/);
    assert.match(html, /id="btn-stop"/);
    // Timeline。
    assert.match(html, /id="timeline"/);
    // footer: discarded + uptime。
    assert.match(html, /id="footer-discarded"/);
    assert.match(html, /id="footer-uptime"/);
  } finally {
    await server.close();
  }
});

test("cockpit page: consumes the Domain A wire contract (SSE + control API) via browser built-ins", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // SSE 購読は EventSource(/api/events)、制御は fetch(/api/...)。
  assert.match(html, /new EventSource\(["']\/api\/events["']\)/);
  assert.match(html, /\/api\/devices/);
  assert.match(html, /\/api\/state/);
  assert.match(html, /\/api\/ears\/start/);
  assert.match(html, /\/api\/ears\/stop/);
  // 消費する SSE イベント種別（domain-a.md §4）を購読していること。
  for (const evt of ["state", "vad", "transcript", "discard"]) {
    assert.match(html, new RegExp(`addEventListener\\(["']${evt}["']`));
  }
});

test("cockpit page: self-contained — no external scripts/styles/fonts (no CDN)", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // 外部リソース禁止（CDN・外部フォント/スクリプト・npm 依存ゼロ）。
  assert.doesNotMatch(html, /<script[^>]+src=/i); // 外部 <script src>
  assert.doesNotMatch(html, /<link[^>]+rel=["']?stylesheet/i); // 外部 stylesheet
  assert.doesNotMatch(html, /(src|href)=["']https?:/i); // http(s) を指す src/href
  assert.doesNotMatch(html, /@import\s+url/i); // CSS @import
});

test("cockpit page: history transcript rows carry no latency (live-only), by contract", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // レイテンシは live 行のみ（履歴エントリには載らない・domain-a.md §3.3 注）。
  // 実装は latencyMs が付いているときだけ (Ns) を描く条件分岐であること。
  assert.match(html, /latencyMs\s*!=\s*null/);
});

// ── ゴースト行（破棄/ASR失敗の無言の消失を可視化・S2.5 追撃 domain-f）─────────────

test("cockpit page: discard SSE event adds a ghost row (in addition to footer counter update)", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  const m = html.match(/addEventListener\(["']discard["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(m, "discard リスナーが見つかること");
  const body = m[1];
  // footer カウンタ更新は維持。
  assert.match(body, /footer-discarded/);
  // ゴースト行追加を維持（無言の消失にしない）。
  assert.match(body, /addGhostRow\(/);
});

test("cockpit page: diagnostic asrFailure adds a ghost row; other diagnostic types do not", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  const m = html.match(/addEventListener\(["']diagnostic["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(m, "diagnostic リスナーが見つかること");
  const body = m[1];
  assert.match(body, /type\s*===\s*["']asrFailure["']/);
  assert.match(body, /addGhostRow\(/);
});

test("cockpit page: ghost rows are visually distinct (muted class) from normal transcript rows", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // addGhostRow は通常行と違う "ghost" クラスを付ける関数として定義されていること。
  assert.match(html, /function addGhostRow\(/);
  const fn = html.match(/function addGhostRow\([\s\S]*?\n    \}/);
  assert.ok(fn, "addGhostRow 本体が見つかること");
  assert.match(fn[0], /className\s*=\s*["']row ghost["']/);
  // CSS: ghost 行は既存の淡色トークン（--muted）を使う（transcript 行の既定色と区別できる）。
  assert.match(html, /\.row\.ghost\s+\.text\s*\{[^}]*var\(--muted\)/);
});
