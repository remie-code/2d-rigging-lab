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

// ── S3: Fire ボタン + soul busy 表示 + 発火マーカー + soul 行（拡張予約の実体化）───────────

test("cockpit page: has a Fire button and soul status, and POSTs /api/fire", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /id="btn-fire"/);
  assert.match(html, /id="soul-status"/);
  assert.match(html, /id="fire-note"/);
  // Fire ボタンは POST /api/fire を叩く（domain-a.md §2.1 のワイヤ契約を消費）。
  assert.match(html, /fetch\(["']\/api\/fire["'],\s*\{\s*method:\s*["']POST["']/);
});

test("cockpit page: subscribes SSE soul events and disables Fire while thinking/speaking", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /addEventListener\(["']soul["']/);
  // busy 連動: applySoulState が idle 以外で btn-fire を disable する。
  assert.match(html, /function applySoulState\(/);
  const fn = html.match(/function applySoulState\([\s\S]*?\n    \}/);
  assert.ok(fn, "applySoulState 本体が見つかること");
  assert.match(fn[0], /btn-fire["']\)\.disabled\s*=\s*st\s*!==\s*["']idle["']/);
});

test("cockpit page: subscribes SSE fire events — accepted adds a marker row, rejected shows a quiet reason", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  const m = html.match(/addEventListener\(["']fire["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(m, "fire リスナーが見つかること");
  const body = m[1];
  assert.match(body, /accepted\s*===\s*true/);
  assert.match(body, /addFireMarkerRow\(/);
  assert.match(body, /setFireNote\(/); // 非受理 reason の控えめ表示。
});

test("cockpit page: fire marker rows carry injectedChars/includedCount and a distinct class + CSS", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /function addFireMarkerRow\(/);
  const fn = html.match(/function addFireMarkerRow\([\s\S]*?\n    \}/);
  assert.ok(fn, "addFireMarkerRow 本体が見つかること");
  assert.match(fn[0], /className\s*=\s*["']row fire-marker["']/);
  assert.match(fn[0], /includedCount/);
  assert.match(fn[0], /injectedChars/);
  // CSS: マーカー行は既存トークン（--speaking）で視覚的に区別される。
  assert.match(html, /\.row\.fire-marker\s*\{[^}]*var\(--speaking\)/);
});

test("cockpit page: fire failure diagnostics (fireError/fireEmptyReply) reuse the ghost-row idiom", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  const m = html.match(/addEventListener\(["']diagnostic["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(m, "diagnostic リスナーが見つかること");
  const body = m[1];
  // Domain A 引き継ぎ Q3 の裁量: empty-reply/error は diagnostic 経由 → ゴースト行で一貫表示。
  assert.match(body, /type\s*===\s*["']fireEmptyReply["']/);
  assert.match(body, /type\s*===\s*["']fireError["']/);
});

test("cockpit page: soul transcript rows are drawable (speaker-soul class + speaker-driven row class)", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // 既存 addTranscriptRow が speaker を行クラスに反映する（soul 行は S2.5 からの受け口で描ける）。
  assert.match(html, /className\s*=\s*["']row speaker-["']\s*\+\s*speaker/);
  assert.match(html, /\.row\.speaker-soul\s+\.who/);
});

// ── S3 追撃 domain-c: Channel URL の操縦席入力 + 接続状態表示 ─────────────────

test("cockpit page: has a Channel URL input, a Set button, and a status display", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /id="channel-url"/);
  assert.match(html, /id="btn-channel-set"/);
  assert.match(html, /id="channel-status"/);
});

test("cockpit page: Channel Set button POSTs /api/channel with the entered url", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /fetch\(["']\/api\/channel["'],\s*\{\s*method:\s*["']POST["']/);
  // 送信 body は入力欄の値（url）。
  assert.match(html, /channel-url["']\)\.value/);
});

test("cockpit page: applies channel status from state (connection-driven class)", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /function applyChannel\(/);
  // applyState が channel を反映する（state.channel は redact 済み）。
  assert.match(html, /applyChannel\(s\.channel\)/);
  // 接続状態の色分けクラス（connected/error/connecting）が CSS にある。
  assert.match(html, /\.channel-status\.connected/);
  assert.match(html, /\.channel-status\.error/);
});

test("cockpit page: does not keep the raw channel URL (token) in the input after Set", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // Set 成功後に入力欄を空へ（token を DOM に残さない）。
  assert.match(html, /channel-url["']\)\.value\s*=\s*["']["']/);
});
