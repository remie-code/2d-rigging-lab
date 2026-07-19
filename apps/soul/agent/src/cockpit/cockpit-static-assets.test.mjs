// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCockpitServer } from "./cockpit-server.mjs";

// 操縦席 UI アセット静的配信ルートの機械テスト（操縦席 UI 改定 Domain A・A-2）。実 HTTP で駆動する
// （既存 page/server test の http.request 流儀 + トラバーサルは raw socket で送信バイトを固定）。
// **追加ルートのみ**——ワイヤ契約 22 エンドポイント×13 SSE は不変（配信間記憶 Domain B で 20→22 へ
// 更新・旧「16」表記は過去数波のエンドポイント追加に本コメントが追随していなかった棚卸し漏れの是正）。
// それは cockpit-server.test.mjs が背骨として固定する。ここは新ルートの契約:
//  (a) 実在する .mjs（vendor / view-logic）は 200 + text/javascript + 実バイト、
//  (b) トラバーサルは**防御層ごとに** 404（実測・レビュー追修正で経路を厳密化）:
//      層0: 生 `..`・`%2e%2e` は WHATWG URL パーサ（handleRequest の new URL）が pathname 段階で
//           ドットセグメント正規化して消す → 第一区画が許可サブツリー外 → tryServeUiAsset は握らず
//           既存 404 フォールスルー（**実装ガードには到達しない**）。
//      層2/層3: `..%2f`（エンコードされたスラッシュ）は URL パーサが正規化**できず** pathname に残存し、
//           decodeURIComponent 後に `../` となって初めて実装ガード（path.resolve→path.relative の
//           ルート脱出判定 = 層2 / 正規化後第一区画のサブツリー逸脱判定 = 層3）に到達する → そこで 404。
//           どの層で止まったかは 404 JSON の error が**サーバ側 pathname を echo する**ことで区別できる
//           （層0 なら `..` が消えた正規化済みの形・ガード到達なら `..%2f` が残った形が返る）。
//  (c) .mjs 以外の拡張子は 404、(d) 存在しない .mjs は 404、を固定する。

const COCKPIT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** @param {string} url  生の request-target（http.request は path を request line にそのまま書く）。 */
function rawGet(base, target) {
  return new Promise((resolve, reject) => {
    const u = new URL(base);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: target, method: "GET" },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * raw socket で HTTP/1.1 リクエスト行を手書きして送る（クライアント側のパス正規化の恐れを構造的にゼロに）。
 * `..%2f` 系は**エンコードのままサーバに届く**必要があるため（レビュー追修正指示）、net.connect で
 * request-target をバイトのまま書く。実際に届いた pathname は 404 JSON の error echo で各テストが
 * アサートする（送信手段と独立の二重固定＝将来クライアント挙動が変われば echo アサートが落ちて気づく）。
 * @param {string} base    サーバ URL（http://127.0.0.1:PORT）。
 * @param {string} target  生の request-target（正規化させたくないパス）。
 * @returns {Promise<{ status: number; body: string }>}
 */
function rawSocketGet(base, target) {
  return new Promise((resolve, reject) => {
    const u = new URL(base);
    const socket = net.connect({ host: u.hostname, port: Number(u.port) }, () => {
      socket.write(`GET ${target} HTTP/1.1\r\nHost: ${u.hostname}:${u.port}\r\nConnection: close\r\n\r\n`);
    });
    let raw = "";
    socket.setEncoding("utf8");
    socket.on("data", (c) => (raw += c));
    socket.on("error", reject);
    socket.on("end", () => {
      const statusLine = raw.split("\r\n", 1)[0] ?? "";
      const m = statusLine.match(/^HTTP\/1\.[01] (\d{3})/);
      const sep = raw.indexOf("\r\n\r\n");
      resolve({ status: m ? Number(m[1]) : 0, body: sep >= 0 ? raw.slice(sep + 4) : "" });
    });
  });
}

test("static assets: 実在する vendor .mjs は 200 + text/javascript + 実バイト", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = /** @type {any} */ (await rawGet(url, "/vendor/htm.preact.standalone.mjs"));
    assert.equal(r.status, 200);
    assert.match(String(r.headers["content-type"]), /text\/javascript/);
    // 実ファイルのバイトをそのまま返す（凍結 vendor の無改変配信）。
    const onDisk = readFileSync(path.join(COCKPIT_DIR, "vendor", "htm.preact.standalone.mjs"));
    assert.equal(r.body.length, onDisk.length);
    assert.ok(r.body.equals(onDisk), "配信バイトがディスク上の vendor と一致すること");
  } finally {
    await server.close();
  }
});

test("static assets: 実在する view-logic .mjs も 200 + text/javascript（ツリー配下限定の確認）", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = /** @type {any} */ (await rawGet(url, "/view-logic/format-time.mjs"));
    assert.equal(r.status, 200);
    assert.match(String(r.headers["content-type"]), /text\/javascript/);
    const onDisk = readFileSync(path.join(COCKPIT_DIR, "view-logic", "format-time.mjs"));
    assert.ok(r.body.equals(onDisk));
  } finally {
    await server.close();
  }
});

test("static assets: 生 `..`・`%2e%2e` は URL パーサ正規化（層0）で既存 404 — 実装ガード非到達", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    // 生の `..`: WHATWG URL（handleRequest の new URL）が pathname 段階でドットセグメント正規化して
    // /cockpit-server.mjs にする → 第一区画が許可サブツリー外 → tryServeUiAsset は握らず false →
    // 既存 404 フォールスルー。**実装ガード（resolve/relative）は実行されない**（レビュー追修正で実測訂正）。
    // 証拠: 404 JSON の error はサーバ側 pathname を echo する＝正規化済み（`..` が消えた）形が返る。
    const raw = /** @type {any} */ (await rawGet(url, "/vendor/../cockpit-server.mjs"));
    assert.equal(raw.status, 404);
    assert.match(raw.body.toString("utf8"), /not found: GET \/cockpit-server\.mjs/, "pathname は正規化済み＝層0 で消えた証拠");
    assert.doesNotMatch(raw.body.toString("utf8"), /createCockpitServer\s*\(/, "サーバ source を漏らさない");
    // `%2e%2e` も URL 仕様上「double-dot path segment」（%2e%2e は .. と同一視）として同じ層0 で正規化される
    // （＝こちらも実装ガード非到達。ガードを踏む攻撃クラスは下の `..%2f` 系テスト）。
    const enc = /** @type {any} */ (await rawGet(url, "/vendor/%2e%2e/cockpit-server.mjs"));
    assert.equal(enc.status, 404);
    assert.match(enc.body.toString("utf8"), /not found: GET \/cockpit-server\.mjs/, "%2e%2e も層0 で正規化される証拠");
    assert.doesNotMatch(enc.body.toString("utf8"), /createCockpitServer\s*\(/, "サーバ source を漏らさない");
    // 二段 %2e%2e（UI ルート脱出の試み）も層0 正規化 → /package.json → 第一区画がサブツリー外 → 既存 404。
    const escape = /** @type {any} */ (await rawGet(url, "/vendor/%2e%2e/%2e%2e/package.json"));
    assert.equal(escape.status, 404);
    assert.match(escape.body.toString("utf8"), /not found: GET \/package\.json/, "二段も層0 で正規化される証拠");
  } finally {
    await server.close();
  }
});

// ── `..%2f` 系: URL 正規化をすり抜け、実装ガードに**実際に到達する**攻撃クラス（レビュー追修正で追加）──
// %2f はエンコードされたスラッシュ。URL パーサはセグメント `..%2fxxx` をドットセグメントと**見なせず**
// pathname にそのまま残す（実測: new URL("/vendor/..%2fx").pathname === "/vendor/..%2fx"）。第一区画は
// vendor（許可サブツリー）なので tryServeUiAsset が必ず握り、decodeURIComponent 後に `../` となって
// path.resolve → path.relative のガードに到達する。raw socket で送信バイトを固定し、404 JSON の error echo
// で「サーバに届いた pathname が ..%2f を含んだまま」であることもアサートする。

test("static assets: `..%2f` 単段はサブツリー逸脱ガード（層3）を踏んで 404 — 実在ソースを漏らさない", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    // decodeURIComponent("vendor/..%2fcockpit-server.mjs") → "vendor/../cockpit-server.mjs"
    // → path.resolve = <uiRoot>/cockpit-server.mjs → path.relative = "cockpit-server.mjs"
    //   （".." 始まりでも絶対でもない＝ルート脱出判定（層2）は通過）
    // → 正規化後第一区画 "cockpit-server.mjs" が UI_ASSET_SUBDIRS 外 → **サブツリー逸脱ガード（層3）が 404**。
    // ターゲットは実在の .mjs なので、ガードが無ければ readFile が成功して 200 + ソース漏洩になるはず
    // ＝ 404 + 非漏洩がガード実行の証明。
    const r = await rawSocketGet(url, "/vendor/..%2fcockpit-server.mjs");
    assert.equal(r.status, 404);
    assert.match(r.body, /not found: GET \/vendor\/\.\.%2fcockpit-server\.mjs/, "pathname に ..%2f が残存＝ガード到達の証拠");
    assert.doesNotMatch(r.body, /createCockpitServer\s*\(/, "実在するサーバ source を漏らさない");
  } finally {
    await server.close();
  }
});

test("static assets: `..%2f` 二段は UI ルート脱出ガード（層2）を踏んで 404 — 魂の実在ソースを漏らさない", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    // decode → "vendor/../../ears/transcript-buffer.mjs" → path.resolve = <uiRoot の親>/ears/transcript-buffer.mjs
    // → path.relative(uiRoot, resolved) = "..\\ears\\transcript-buffer.mjs"（".." 始まり）
    // → **ルート脱出ガード（層2）が 404**。ターゲットは実在する魂ソース（src/ears/transcript-buffer.mjs）
    //   なので、ガードが無ければ 200 + 漏洩になるはず＝ 404 + 非漏洩がガード実行の証明。
    const r = await rawSocketGet(url, "/vendor/..%2f..%2fears%2ftranscript-buffer.mjs");
    assert.equal(r.status, 404);
    assert.match(r.body, /not found: GET \/vendor\/\.\.%2f\.\.%2fears%2ftranscript-buffer\.mjs/, "pathname に ..%2f が残存＝ガード到達の証拠");
    assert.doesNotMatch(r.body, /createTranscriptBuffer/, "UI ルート外の実在ソースを漏らさない");
  } finally {
    await server.close();
  }
});

test("static assets: `..%5C`（エンコードされたバックスラッシュ）も 404 — Windows の区切り解決経路を漏らさない", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    // decode → "vendor/..\\cockpit-server.mjs"。踏む経路は OS 依存（どちらでも 404・非漏洩）:
    //  - win32: path.resolve が `\` を区切りとして解決 → <uiRoot>/cockpit-server.mjs → relative =
    //    "cockpit-server.mjs" → **サブツリー逸脱ガード（層3）が 404**（本リポジトリの実行環境 = ここ）。
    //  - 非 win32: `..\cockpit-server.mjs` は単一ファイル名扱い → vendor/ 配下・.mjs → readFile ENOENT → 404。
    // ターゲット（win32 解決先）は実在の .mjs なので、win32 でガードが無ければ 200 + 漏洩になるはず。
    const r = await rawSocketGet(url, "/vendor/..%5Ccockpit-server.mjs");
    assert.equal(r.status, 404);
    assert.match(r.body, /not found: GET \/vendor\/\.\.%5Ccockpit-server\.mjs/, "pathname に ..%5C が残存＝層0 で消えない証拠");
    assert.doesNotMatch(r.body, /createCockpitServer\s*\(/, "サーバ source を漏らさない");
  } finally {
    await server.close();
  }
});

test("static assets: 許可サブツリーでも .mjs 以外の拡張子は 404", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    // cockpit.html は UI ルート直下だが、そもそも vendor/ui/view-logic 配下でなく .mjs でもない → 404。
    const html = /** @type {any} */ (await rawGet(url, "/vendor/cockpit.html"));
    assert.equal(html.status, 404);
    const txt = /** @type {any} */ (await rawGet(url, "/view-logic/format-time.js"));
    assert.equal(txt.status, 404);
  } finally {
    await server.close();
  }
});

test("static assets: 存在しない .mjs は 404", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const missingView = /** @type {any} */ (await rawGet(url, "/view-logic/does-not-exist.mjs"));
    assert.equal(missingView.status, 404);
    // Domain B で ui/ ツリーが実体化した（旧: /ui/app.mjs の 404 で「未生成」を固定していた・
    // 実在時の 200 配信は下の「ui/*.mjs を置くだけで配信される」テストが固定する）。
    const missingUi = /** @type {any} */ (await rawGet(url, "/ui/does-not-exist.mjs"));
    assert.equal(missingUi.status, 404);
  } finally {
    await server.close();
  }
});

// ── Domain B: ui/*.mjs は「置くだけで配信される」（サーバ無改変・許可サブツリーの事実の固定）──

test("static assets: ui/*.mjs（app/header/feed/rows/styles/control-bar/settings-drawer）は 200 + text/javascript + 実バイト", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    // Domain C で control-bar.mjs / settings-drawer.mjs が加わった（「置くだけで配信される」の固定を拡張）。
    for (const name of ["app.mjs", "header.mjs", "feed.mjs", "rows.mjs", "styles.mjs", "control-bar.mjs", "settings-drawer.mjs"]) {
      const r = /** @type {any} */ (await rawGet(url, "/ui/" + name));
      assert.equal(r.status, 200, `/ui/${name} が 200`);
      assert.match(String(r.headers["content-type"]), /text\/javascript/);
      const onDisk = readFileSync(path.join(COCKPIT_DIR, "ui", name));
      assert.ok(r.body.equals(onDisk), `/ui/${name} の配信バイトがディスクと一致`);
    }
  } finally {
    await server.close();
  }
});

test("static assets: 非アセットパスは既存 404 フォールスルー（他ルートのレスポンス形を変えない）", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    // 第一区画が許可サブツリー外 → tryServeUiAsset は握らず既存 404（"not found: GET ..." 形）。
    const r = /** @type {any} */ (await rawGet(url, "/not-an-asset.mjs"));
    assert.equal(r.status, 404);
    const j = JSON.parse(r.body.toString("utf8"));
    assert.match(j.error, /not found: GET \/not-an-asset\.mjs/);
  } finally {
    await server.close();
  }
});
