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

// ── S4「表情が乗る」: 演出イベント行 + 未知タグのゴースト行 ───────────────────────

test("cockpit page: subscribes SSE expression events and draws an expression row", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // 演出適用の通知（domain-a.md §7・{word, args?, applied, rejected}）を expression イベントで購読。
  assert.match(html, /addEventListener\(["']expression["']/);
  assert.match(html, /addExpressionRow\(/);
});

test("cockpit page: expression rows carry word + applied/rejected slot counts, distinct class + CSS", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /function addExpressionRow\(/);
  const fn = html.match(/function addExpressionRow\([\s\S]*?\n    \}/);
  assert.ok(fn, "addExpressionRow 本体が見つかること");
  // 発火マーカーと同型の行（距離のある class）。
  assert.match(fn[0], /className\s*=\s*["']row expression["']/);
  // 語 + 適用/拒否スロット数を描く（applied/rejected を参照する）。
  assert.match(fn[0], /d\.word/);
  assert.match(fn[0], /d\.applied/);
  assert.match(fn[0], /d\.rejected/);
  // CSS: 演出行は既存トークン（--accent）で視覚的に区別される。
  assert.match(html, /\.row\.expression\s*\{[^}]*var\(--accent\)/);
});

test("cockpit page: expressionUnknownTag diagnostic adds a ghost row (word left as a trace); other expression diagnostics do not", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  const m = html.match(/addEventListener\(["']diagnostic["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(m, "diagnostic リスナーが見つかること");
  const body = m[1];
  // 語彙外タグはゴースト行の型で痕跡を残す（声にも演出にも出ないが「無言の消失」にしない）。
  assert.match(body, /type\s*===\s*["']expressionUnknownTag["']/);
  assert.match(body, /addGhostRow\(/);
  // 過剰表示を避ける裁定: broken/rejected/sendError は分岐を持たない（演出行の ✗N が伝える）。
  // （説明コメントで語には触れるが、type === "…" の分岐＝表示はしないことを固定する。）
  assert.doesNotMatch(body, /===\s*["']expressionBrokenTag["']/);
  assert.doesNotMatch(body, /===\s*["']expressionRejected["']/);
  assert.doesNotMatch(body, /===\s*["']expressionSendError["']/);
});

// ── S7「視聴者が混ざる」: Live chat の Connect/Disconnect UI + viewer 行 + 状態表示 + 取得死ゴースト ─────

test("cockpit page: has a Live chat source input, Connect/Disconnect buttons, and a status display", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /id="chat-source"/);
  assert.match(html, /id="btn-chat-connect"/);
  assert.match(html, /id="btn-chat-disconnect"/);
  assert.match(html, /id="chat-status"/);
});

test("cockpit page: Connect chat POSTs /api/chat/connect with the entered source; Disconnect POSTs /api/chat/disconnect", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /fetch\(["']\/api\/chat\/connect["'],\s*\{\s*method:\s*["']POST["']/);
  assert.match(html, /chat-source["']\)\.value/); // 送信 body は入力欄の値（source）。
  assert.match(html, /fetch\(["']\/api\/chat\/disconnect["'],\s*\{\s*method:\s*["']POST["']/);
});

test("cockpit page: applies chat status from state (connection-driven class) and restores remembered source", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /function applyChat\(/);
  assert.match(html, /applyChat\(s\.chat\)/);
  // 状態別クラス（live/connecting/retrying/dead）が CSS にある。
  assert.match(html, /\.chat-status\.live/);
  assert.match(html, /\.chat-status\.retrying/);
  assert.match(html, /\.chat-status\.dead/);
});

test("cockpit page: viewer transcript rows render viewer(displayName) label and have a distinct class + CSS", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // addTranscriptRow は viewer のとき displayName を viewer(名前) で描く（注入描画と対称）。
  assert.match(html, /speaker\s*===\s*["']viewer["']\s*&&\s*d\.displayName/);
  assert.match(html, /viewer\(/);
  // CSS: viewer 行は you/soul と区別できる別トークンを持つ。
  assert.match(html, /\.row\.speaker-viewer\s+\.who/);
});

test("cockpit page: subscribes SSE chatStatus and updates the status display", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /addEventListener\(["']chatStatus["']/);
  const m = html.match(/addEventListener\(["']chatStatus["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(m, "chatStatus リスナーが見つかること");
  // 状態表示 + Disconnect 制御は applyChat と同じ単一経路（renderChatStatus）を通す（二重管理を避ける）。
  assert.match(m[1], /renderChatStatus\(/);
});

// ── S7 追修正: Disconnect の有効/無効は chat state 値で一貫決定（dead→無効・snapshot 再送で誤再有効化しない）─────
// design レビュー検出の契約 FAIL（applyChat が connected 真偽で無条件に Disconnect を再有効化）を閉じる。
// applyChat と SSE chatStatus が同じ renderChatStatus 経路を通ることを、実ロジックを HTML から切り出して駆動して固定する。

test("cockpit page: Disconnect enable/disable is chat-state-driven (dead disables even when connected) — applyChat drives renderChatStatus", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  const renderSrc = html.match(/function renderChatStatus\([\s\S]*?\n    \}/);
  const applySrc = html.match(/function applyChat\([\s\S]*?\n    \}/);
  assert.ok(renderSrc, "renderChatStatus 本体が見つかること");
  assert.ok(applySrc, "applyChat 本体が見つかること");
  // HTML の実ロジックをそのまま切り出して駆動する（DOM ライブラリ非依存・fake byId で要素を代替）。
  const build = new Function(
    "byId",
    `"use strict"; var chatSourceEdited = false; ${renderSrc[0]} ${applySrc[0]} return applyChat;`
  );
  /** @param {any} chat */
  function drive(chat) {
    const els = {
      "chat-source": { value: "" },
      "chat-status": { textContent: "", className: "" },
      "btn-chat-disconnect": { disabled: null }
    };
    const applyChat = build((/** @type {string} */ id) => els[/** @type {"chat-source"|"chat-status"|"btn-chat-disconnect"} */ (id)]);
    applyChat(chat);
    return els;
  }
  // dead は connected=true でも Disconnect を無効化する（契約 FAIL の修正・snapshot 再送で誤再有効化しない）。
  assert.equal(drive({ connected: true, state: "dead", source: null })["btn-chat-disconnect"].disabled, true);
  // 稼働状態（connecting/live/retrying）は Disconnect 有効 + 状態別クラス。
  for (const st of ["connecting", "live", "retrying"]) {
    const els = drive({ connected: true, state: st, source: null });
    assert.equal(els["btn-chat-disconnect"].disabled, false, `${st} は Disconnect 有効`);
    assert.equal(els["chat-status"].className, "chat-status " + st);
  }
  // 未接続（connected=false）も Disconnect 無効・"not connected" 表示。
  const off = drive({ connected: false, source: null });
  assert.equal(off["btn-chat-disconnect"].disabled, true);
  assert.equal(off["chat-status"].textContent, "not connected");
});

test("cockpit page: applyChat and chatStatus SSE share one disconnect-decision path (state-driven, no connected-truthiness enable)", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // 単一経路 renderChatStatus が Disconnect の有効/無効を state 値で決める（connected 真偽ではない）。
  const rfn = html.match(/function renderChatStatus\([\s\S]*?\n    \}/);
  assert.ok(rfn, "renderChatStatus 本体が見つかること");
  assert.match(rfn[0], /btn-chat-disconnect["']\)\.disabled\s*=/);
  assert.match(rfn[0], /state\s*===\s*["']connecting["']/);
  assert.match(rfn[0], /state\s*===\s*["']live["']/);
  assert.match(rfn[0], /state\s*===\s*["']retrying["']/);
  // applyChat は renderChatStatus に委譲する（disabled を直接 false にしない＝二重管理の食い違いを断つ）。
  const afn = html.match(/function applyChat\([\s\S]*?\n    \}/);
  assert.ok(afn, "applyChat 本体が見つかること");
  assert.match(afn[0], /renderChatStatus\(/);
  assert.doesNotMatch(afn[0], /disabled\s*=\s*false/);
  // SSE chatStatus ハンドラも同じ単一経路を通す（dead の扱いが二経路で食い違わない）。
  const sse = html.match(/addEventListener\(["']chatStatus["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(sse, "chatStatus リスナーが見つかること");
  assert.match(sse[1], /renderChatStatus\(/);
});

test("cockpit page: subscribes SSE chatDiagnostic and draws ghost rows for fetch-death kinds", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  assert.match(html, /addEventListener\(["']chatDiagnostic["']/);
  const m = html.match(/addEventListener\(["']chatDiagnostic["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(m, "chatDiagnostic リスナーが見つかること");
  const body = m[1];
  // 取得死の分類（notLive/ended/extractFailed/network）をゴースト行で可視化する。
  assert.match(body, /notLive/);
  assert.match(body, /ended/);
  assert.match(body, /extractFailed/);
  assert.match(body, /network/);
  assert.match(body, /addGhostRow\(/);
});

test("cockpit page: chatBufferAbsent diagnostic (ears not running) adds a ghost row", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  const m = html.match(/addEventListener\(["']diagnostic["'],\s*function\s*\(ev\)\s*\{([\s\S]*?)\}\);/);
  assert.ok(m, "diagnostic リスナーが見つかること");
  // 耳未起動でコメントが合流できなかった事実を「無言の消失」にせずゴースト行に残す。
  assert.match(m[1], /type\s*===\s*["']chatBufferAbsent["']/);
});

test("cockpit page: self-fire marker row is kind-agnostic (comment/comment-call flow through with kind label)", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // addSelfFireMarkerRow は kind をそのまま描く（comment/comment-call も call/turn-end/silence と同型に載る）。
  const fn = html.match(/function addSelfFireMarkerRow\([\s\S]*?\n    \}/);
  assert.ok(fn, "addSelfFireMarkerRow 本体が見つかること");
  assert.match(fn[0], /d\.kind/);
});
