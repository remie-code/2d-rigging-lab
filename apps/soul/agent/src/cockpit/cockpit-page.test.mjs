// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";

import { createCockpitServer } from "./cockpit-server.mjs";
import { cockpitHtmlPath } from "./cockpit-page.mjs";

// コクピット・ページの機械テスト（操縦席UI改定 Domain D で全面書き換え）。**見た目はテストしない**（人間ゲート）。
//
// 旧テスト（30 本・HTML 文字列 regex）は「単一ファイル vanilla HTML/CSS/JS の IIFE」前提の旧思想の産物で、
// preact+htm（no-build）化により cockpit.html が最薄エントリ（div#app + inline module）になった本改定で
// 意味を失った（wave-plan §2/§3 Domain D・inventory §2-4 の裁定どおり書き換え）。ここで固定するのは:
//  (1) GET / が新エントリ HTML を配ること（200 + text/html・div#app・inline module が ./ui/app.mjs の
//      mount を import して呼ぶ）。
//  (2) 自己完結の本旨 = **外部ネットワーク非依存**（旧 :69-76 の読み替え・wave-plan §2）: <script src> なし
//      （エントリは inline module の import 文のみ＝ローカル vendor/ui への相対 import は適合・外部だけ禁止）・
//      http(s) を指す src/href なし・外部 stylesheet/@import なし。
//  (3) 起動配線スモーク: 実サーバで GET / → HTML が import する /ui/app.mjs → その先の
//      /vendor/htm.preact.standalone.mjs が全て 200 + text/javascript = 「npm run cockpit 一発でブラウザが
//      解決できるツリーが配られている」ことの機械近似（shutdown = server.close まで）。
//
// ── 機能同値の説明責任: 旧 30 本が固定していた表示ロジックの新しい固定先（対応表） ──
// 旧テストの検証対象は view-logic 純関数 fixture（view-logic/*.test.mjs・Domain A/C）と ui 層テスト
// （cockpit-ui.test.mjs・Domain B/C の rows fixture + vnode 走査 + CSS 検査）へ移管済み。1 本ずつ:
//   旧 1  GET / の必須リージョン           → 本ファイル (1)（エントリ構造）+ ヘッダ/計器/行の実体は
//                                            cockpit-ui.test（Header vnode・FeedRow vnode・rows fixture）
//   旧 2  ワイヤ契約の消費（SSE+API）      → cockpit-ui.test「SSE_EVENT_NAMES 13 本 deepEqual」+
//                                            ui/{control-bar,settings-drawer}.mjs の fetch 結線（対応行コメント）+
//                                            server test（ワイヤ契約 16+13+6 の背骨）
//   旧 3  自己完結（CDN 禁止）             → 本ファイル (2)（外部ネットワーク非依存へ読み替え）
//   旧 4  履歴行に latency 無し            → view-logic/transcript.test（latencyLabel null）+
//                                            cockpit-ui.test（feedFromHistory fixture・feedAfterSseEvent
//                                            transcript ディスパッチ = W4 追加）
//   旧 5  discard ゴースト行+カウンタ      → cockpit-ui.test（feedAfterSseEvent discard fixture）
//   旧 6  asrFailure ゴースト行            → view-logic/ghost.test + cockpit-ui.test（diagnostic fixture）
//   旧 7  ゴースト行の視覚区別（muted）    → cockpit-ui.test（COCKPIT_CSS ghost italic 検査 + rows fixture）
//   旧 8  Fire ボタン+soul 表示+POST       → ui/control-bar.mjs fireWith + view-logic/control.test
//                                            （soulStatusView）+ cockpit-ui.test（FireButtons vnode）
//   旧 9  SSE soul で Fire disable         → view-logic/control.test（soulStatusView.fireDisabled）+
//                                            cockpit-ui.test（FireButtons vnode: thinking で両 disable）
//   旧 10 SSE fire 受理マーカー/非受理ノート → cockpit-ui.test（feedAfterSseEvent fire fixture）+
//                                            view-logic/control.test（fireNoteFromSseFire）
//   旧 11 発火マーカーの文字列+CSS         → view-logic/markers.test（fireMarkerText）+ rows fixture + CSS 検査
//   旧 12 fire 失敗診断のゴースト行        → view-logic/ghost.test（fireEmptyReply/fireError）
//   旧 13 soul 行の speaker クラス         → view-logic/transcript.test（speakerRowClass）+ rows fixture
//   旧 14 Channel 入力+Set+状態表示        → ui/settings-drawer.mjs（結線）+ view-logic/status.test
//                                            （channelStatusView）+ settings.test（channelPostErrorText）
//   旧 15 Set が POST /api/channel         → ui/settings-drawer.mjs onChannelSet（対応行コメント）+ server test
//   旧 16 channel 状態の色クラス           → view-logic/status.test（channelStatusView fixture）
//   旧 17 Set 後の入力欄クリア（token 秘匿）→ ui/settings-drawer.mjs onChannelSet（:766 対応）+ 人間ゲート手順書
//                                            （hooks 内の実挙動は機械では固定不能＝linkedom 梯子は台帳）
//   旧 18 SSE expression → 演出行          → markers.test（expressionRowText）+ cockpit-ui.test
//                                            （feedAfterSseEvent expression ディスパッチ = W4 追加。旧記載は
//                                            feedAfterSseEvent 経由を主張していたが実測ではディスパッチ経路が
//                                            未固定＝前のめりだった・W4 で実体化して訂正）
//   旧 19 演出行の word/counts+CSS         → view-logic/markers.test + rows fixture + CSS 検査
//   旧 20 expressionUnknownTag のみ表示    → view-logic/ghost.test（意図的非表示 3 型 null）+
//                                            cockpit-ui.test（非表示型は行を作らない fixture）
//   旧 21 Live chat 入力/ボタン/状態       → ui/settings-drawer.mjs（結線）+ status.test（chatStatusView）
//   旧 22 Connect/Disconnect の POST       → ui/settings-drawer.mjs onChatConnect/onChatDisconnect + server test
//   旧 23 chat 状態クラス+source 復元      → view-logic/status.test（chatStatusView/shouldRestoreChatSource）
//   旧 24 viewer 行のラベル+クラス         → view-logic/transcript.test（viewer(taro)）+ rows fixture
//   旧 25 SSE chatStatus → 状態表示        → view-logic/status.test（chatDisplayFromSseStatus）+
//                                            cockpit-ui.test（chatStatus はタイムライン行を作らない）
//   旧 26 dead で Disconnect 無効（駆動）  → view-logic/status.test（chatStatusView: dead →
//                                            disconnectDisabled=true の fixture＝旧 new Function 駆動の後継）
//   旧 27 Disconnect 判定の単一経路        → view-logic/status.test + ui/settings-drawer.mjs
//                                            （chatView.disconnectDisabled の単一参照）
//   旧 28 chatDiagnostic のゴースト行      → view-logic/ghost.test（chatDiagnosticGhostLabel: 表示 5 種/
//                                            観測補助 4 種 null）+ cockpit-ui.test fixture
//   旧 29 chatBufferAbsent のゴースト行    → view-logic/ghost.test（diagnosticGhostLabel）
//   旧 30 自発マーカーの kind 非依存       → view-logic/markers.test（selfFireMarkerText）+ rows fixture

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

test("cockpit page: GET / serves the control-room entry (div#app + inline module that mounts ui/app.mjs)", async () => {
  const server = createCockpitServer({ indexHtmlPath: cockpitHtmlPath });
  try {
    const url = await server.listen(0);
    const r = /** @type {any} */ (await get(`${url}/`));
    assert.equal(r.status, 200);
    assert.match(String(r.headers["content-type"]), /text\/html/);
    const html = r.body;
    // 新エントリの骨格: マウント先 div#app + inline module（type="module"）。
    assert.match(html, /<div id="app"><\/div>/);
    assert.match(html, /<script type="module">/);
    // inline module は ui/app.mjs の mount を相対 import して呼ぶ（mount 契約 = domain-b.md §2・
    // options 既定で globalThis 参照 = 引数は rootElement のみで足りる）。
    assert.match(html, /import \{ mount \} from "\.\/ui\/app\.mjs"/);
    assert.match(html, /mount\(document\.getElementById\("app"\)\)/);
  } finally {
    await server.close();
  }
});

test("cockpit page: entry HTML is free of dead legacy UI (no old IIFE / old DOM ids / old style rules)", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // 旧 UI の完全撤去（死コードゼロ・design レビュー §9-1: 新 UI が channel-url/chat-source の id を
  // 自ら生成するため、旧 DOM が残ると document 内 id 重複 = 段階移行は不可）。代表識別子で固定する。
  assert.doesNotMatch(html, /getElementById\("timeline"\)|byId\(/, "旧 IIFE（byId ヘルパ）が残っていない");
  assert.doesNotMatch(html, /id="channel-url"|id="chat-source"|id="device-select"/, "旧 DOM（新 UI と id 衝突する入力群）が残っていない");
  assert.doesNotMatch(html, /id="timeline"|id="btn-fire"|id="footer-uptime"/, "旧 DOM（timeline/fire/footer）が残っていない");
  assert.doesNotMatch(html, /\.row\.ghost|\.channel-status\.connected/, "旧 <style>（styles.mjs と同名セレクタ群）が残っていない");
  // スタイルの正本は ui/styles.mjs（mount 時注入）。HTML 側 <style> は FOUC 対策の最小限のみ
  // （:root/body の下地だけ = 行数でなく「旧セレクタ群が無い」ことを上で固定済み）。
  assert.match(html, /FOUC/, "HTML 側 <style> が最小限（FOUC 対策）である根拠コメント");
});

test("cockpit page: self-contained — no external network dependency (local vendor/ui imports are allowed)", () => {
  const html = readFileSync(cockpitHtmlPath, "utf8");
  // 自己完結の本旨 = 外部ネットワーク非依存（wave-plan §2 の読み替え）: ローカル配信の vendor/ui への
  // 相対 import は適合・外部（CDN・外部フォント/スクリプト）だけを禁止する。
  assert.doesNotMatch(html, /<script[^>]+src=/i); // エントリは inline module のみ（<script src> 不使用）
  assert.doesNotMatch(html, /<link[^>]+rel=["']?stylesheet/i); // 外部 stylesheet なし
  assert.doesNotMatch(html, /(src|href)=["']https?:/i); // http(s) を指す src/href なし
  assert.doesNotMatch(html, /@import\s+url/i); // CSS @import なし
  assert.doesNotMatch(html, /from\s+["']https?:/i); // import 文も外部 URL を指さない（相対のみ）
});

test("cockpit page: boot wiring smoke — GET / and the module tree it imports all resolve on one server", async () => {
  // 「npm run cockpit 一発でブラウザが解決できるツリーが配られている」の機械近似:
  // 実サーバを起動し、エントリ HTML → inline module が import する /ui/app.mjs → その先の
  // /vendor/htm.preact.standalone.mjs（standalone = bare import ゼロの唯一の外部部品）が同一サーバから
  // 200 + text/javascript で配られることを縦に確認する（ui/*.mjs 相互の import 閉包と全ファイルの配信は
  // cockpit-ui.test の構造テストと cockpit-static-assets.test が固定済み・ここは代表縦経路のみ）。
  const server = createCockpitServer({ indexHtmlPath: cockpitHtmlPath });
  try {
    const url = await server.listen(0);
    const page = /** @type {any} */ (await get(`${url}/`));
    assert.equal(page.status, 200);
    // HTML が実際に import する specifier を抽出して辿る（ハードコードでなく現物駆動）。
    const spec = page.body.match(/import \{ mount \} from "(\.\/ui\/app\.mjs)"/);
    assert.ok(spec, "エントリの import specifier が見つかること");
    const appJs = /** @type {any} */ (await get(`${url}/` + spec[1].replace(/^\.\//, "")));
    assert.equal(appJs.status, 200, "/ui/app.mjs が配られる");
    assert.match(String(appJs.headers["content-type"]), /text\/javascript/, "module script は JS MIME 必須");
    // app.mjs → vendor の相対 import（../vendor/…）はブラウザ解決で /vendor/… になる。
    assert.match(appJs.body, /from "\.\.\/vendor\/htm\.preact\.standalone\.mjs"/);
    const vendor = /** @type {any} */ (await get(`${url}/vendor/htm.preact.standalone.mjs`));
    assert.equal(vendor.status, 200, "/vendor/htm.preact.standalone.mjs が配られる");
    assert.match(String(vendor.headers["content-type"]), /text\/javascript/);
    assert.ok(vendor.body.length > 0, "vendor が空でない");
  } finally {
    await server.close(); // shutdown まで（起動→配信→close の一巡）。
  }
});
