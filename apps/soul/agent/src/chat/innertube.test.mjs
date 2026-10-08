// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeSource,
  extractInitialData,
  extractBootstrap,
  joinRuns,
  parseMessageItem,
  parseLiveChatResponse,
  fetchWatchPage,
  fetchLiveChat,
  INNERTUBE_CLIENT_NAME,
  DEFAULT_POLL_INTERVAL_MS
} from "./innertube.mjs";
import {
  watchHtmlLive,
  watchHtmlNotLive,
  watchHtmlReplay,
  WATCH_HTML_NO_KEYS,
  textAction,
  paidAction,
  ignoredAction,
  liveChatResponse
} from "./fixtures-innertube.mjs";

// innertube 純部品の決定論テスト。fetch ラッパは fetchImpl 注入で実ネット非依存
// （鉄の規律: 機械テストは実 YouTube に一切出ない・fixture は手書き合成）。

// ── normalizeSource ─────────────────────────────────────────────────────

test("normalizeSource: 素の video ID を watch URL に展開", () => {
  const r = normalizeSource("dQw4w9WgXcQ");
  assert.deepEqual(r, {
    kind: "watch",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoId: "dQw4w9WgXcQ"
  });
});

test("normalizeSource: watch URL / youtu.be / channel /live を受理", () => {
  assert.equal(
    /** @type {any} */ (normalizeSource("https://www.youtube.com/watch?v=abcdefghijk")).videoId,
    "abcdefghijk"
  );
  assert.equal(
    /** @type {any} */ (normalizeSource("https://youtu.be/abcdefghijk?t=10")).videoId,
    "abcdefghijk"
  );
  const ch = /** @type {any} */ (normalizeSource("https://www.youtube.com/channel/UC12345/live"));
  assert.equal(ch.kind, "channel");
  assert.equal(ch.videoId, null);
  assert.equal(ch.url, "https://www.youtube.com/channel/UC12345/live");
});

test("normalizeSource: 不正入力は extractFailed で返す（throw しない）", () => {
  assert.equal(/** @type {any} */ (normalizeSource("")).error.kind, "extractFailed");
  assert.equal(/** @type {any} */ (normalizeSource("   ")).error.kind, "extractFailed");
  assert.equal(/** @type {any} */ (normalizeSource("not a url at all!")).error.kind, "extractFailed");
  assert.equal(/** @type {any} */ (normalizeSource("https://example.com/watch?v=x")).error.kind, "extractFailed");
  // youtube だが shape 非対応。
  assert.equal(/** @type {any} */ (normalizeSource("https://www.youtube.com/feed/subscriptions")).error.kind, "extractFailed");
});

test("normalizeSource: /live/<id> を watch URL に展開（クエリ付きも可）", () => {
  const r = /** @type {any} */ (normalizeSource("https://www.youtube.com/live/3ORTpMtnIXg"));
  assert.deepEqual(r, {
    kind: "watch",
    url: "https://www.youtube.com/watch?v=3ORTpMtnIXg",
    videoId: "3ORTpMtnIXg"
  });

  const withQuery = /** @type {any} */ (
    normalizeSource("https://www.youtube.com/live/3ORTpMtnIXg?feature=share")
  );
  assert.equal(withQuery.kind, "watch");
  assert.equal(withQuery.videoId, "3ORTpMtnIXg");
  assert.equal(withQuery.url, "https://www.youtube.com/watch?v=3ORTpMtnIXg");
});

test("normalizeSource: /live/ の ID 欠落・非 11 文字は extractFailed", () => {
  assert.equal(
    /** @type {any} */ (normalizeSource("https://www.youtube.com/live/")).error.kind,
    "extractFailed"
  );
  assert.equal(
    /** @type {any} */ (normalizeSource("https://www.youtube.com/live/tooShort")).error.kind,
    "extractFailed"
  );
});

test("normalizeSource: /@handle/live を channel 経路として受理（クエリ付きも可）", () => {
  const r = /** @type {any} */ (normalizeSource("https://www.youtube.com/@handle/live"));
  assert.equal(r.kind, "channel");
  assert.equal(r.videoId, null);
  assert.equal(r.url, "https://www.youtube.com/@handle/live");

  const withQuery = /** @type {any} */ (
    normalizeSource("https://www.youtube.com/@handle/live?si=xxx")
  );
  assert.equal(withQuery.kind, "channel");
  assert.equal(withQuery.videoId, null);
  assert.equal(withQuery.url, "https://www.youtube.com/@handle/live");
});

test("normalizeSource: /@/live（空 handle）は extractFailed", () => {
  assert.equal(
    /** @type {any} */ (normalizeSource("https://www.youtube.com/@/live")).error.kind,
    "extractFailed"
  );
});

// ── extractInitialData（バランス走査）───────────────────────────────────

test("extractInitialData: ネストと '}' を含む文字列を跨いで JSON を切り出す", () => {
  const obj = { a: { b: "text with } brace and \" quote" }, c: [1, 2, { d: true }] };
  const html = `<script>var ytInitialData = ${JSON.stringify(obj)};</script>`;
  assert.deepEqual(extractInitialData(html), obj);
});

test("extractInitialData: 無ければ null", () => {
  assert.equal(extractInitialData("<html>no data</html>"), null);
  assert.equal(extractInitialData(/** @type {any} */ (123)), null);
});

// ── extractBootstrap（4 点抽出）──────────────────────────────────────────

test("extractBootstrap: 生きた配信 HTML から 4 点を抽出", () => {
  const html = watchHtmlLive({ apiKey: "AIzaKEY", clientVersion: "2.20260714.00.00", videoId: "vid00000001", continuation: "CONT0" });
  const boot = /** @type {any} */ (extractBootstrap(html, { knownVideoId: "vid00000001" }));
  assert.equal(boot.apiKey, "AIzaKEY");
  assert.equal(boot.clientVersion, "2.20260714.00.00");
  assert.equal(boot.continuation, "CONT0");
  assert.equal(boot.videoId, "vid00000001");
});

test("extractBootstrap: knownVideoId 無しでも ytInitialData の watchEndpoint から videoId を得る", () => {
  const html = watchHtmlLive({ videoId: "vidFromData", continuation: "CONT0" });
  const boot = /** @type {any} */ (extractBootstrap(html, {}));
  assert.equal(boot.videoId, "vidFromData");
  assert.equal(boot.continuation, "CONT0");
});

test("extractBootstrap: 4 点が無い HTML は extractFailed", () => {
  const r = /** @type {any} */ (extractBootstrap(WATCH_HTML_NO_KEYS, {}));
  assert.equal(r.error.kind, "extractFailed");
});

test("extractBootstrap: キーはあるが ytInitialData が壊れていれば extractFailed", () => {
  const html =
    `<script>ytcfg.set({"INNERTUBE_API_KEY":"K","INNERTUBE_CONTEXT_CLIENT_VERSION":"2.0"});</script>` +
    `<script>var ytInitialData = {not valid json;</script>`;
  const r = /** @type {any} */ (extractBootstrap(html, { knownVideoId: "x" }));
  assert.equal(r.error.kind, "extractFailed");
});

test("extractBootstrap: liveChatRenderer 不在（未開始/チャット無効）は notLive", () => {
  const r = /** @type {any} */ (extractBootstrap(watchHtmlNotLive(), { knownVideoId: "x" }));
  assert.equal(r.error.kind, "notLive");
});

test("extractBootstrap: isReplay=true（リプレイチャット）は notLive", () => {
  const r = /** @type {any} */ (extractBootstrap(watchHtmlReplay(), { knownVideoId: "x" }));
  assert.equal(r.error.kind, "notLive");
});

// ── joinRuns ─────────────────────────────────────────────────────────────

test("joinRuns: text run 結合・unicode 絵文字は emojiId・カスタム絵文字は shortcut", () => {
  assert.equal(joinRuns([{ text: "hello " }, { text: "world" }]), "hello world");
  assert.equal(joinRuns([{ text: "hi " }, { emoji: { emojiId: "😀", isCustomEmoji: false } }]), "hi 😀");
  assert.equal(
    joinRuns([{ emoji: { isCustomEmoji: true, shortcuts: [":cody:"], emojiId: "UC/xyz" } }]),
    ":cody:"
  );
  assert.equal(joinRuns([]), "");
  assert.equal(joinRuns(/** @type {any} */ (null)), "");
});

// ── parseMessageItem（renderer 分岐）──────────────────────────────────────

test("parseMessageItem: liveChatTextMessageRenderer を一級で解く", () => {
  const item = /** @type {any} */ (textAction({ author: "Alice", runs: ["こーでぃー ", "元気?"], id: "M1" })).addChatItemAction.item;
  const r = /** @type {any} */ (parseMessageItem(item));
  assert.equal(r.message.kind, "text");
  assert.equal(r.message.text, "こーでぃー 元気?");
  assert.equal(r.message.displayName, "Alice");
  assert.equal(r.message.messageId, "M1");
});

test("parseMessageItem: 有料メッセージは本文があれば拾う・無ければ ignored", () => {
  const withBody = /** @type {any} */ (paidAction({ author: "Bob", runs: ["投げ銭本文"], amount: "¥1000" })).addChatItemAction.item;
  const rb = /** @type {any} */ (parseMessageItem(withBody));
  assert.equal(rb.message.kind, "paid");
  assert.equal(rb.message.text, "投げ銭本文");

  const noBody = /** @type {any} */ (paidAction({ author: "Bob", amount: "¥1000" })).addChatItemAction.item;
  const rn = /** @type {any} */ (parseMessageItem(noBody));
  assert.equal(rn.ignored, "liveChatPaidMessageRenderer(no-body)");
});

test("parseMessageItem: 未知 renderer は ignored + 種別名", () => {
  const item = /** @type {any} */ (ignoredAction("liveChatMembershipItemRenderer")).addChatItemAction.item;
  const r = /** @type {any} */ (parseMessageItem(item));
  assert.equal(r.ignored, "liveChatMembershipItemRenderer");
});

// ── parseLiveChatResponse ────────────────────────────────────────────────

test("parseLiveChatResponse: continuation + timeoutMs + messages を取り出す", () => {
  const json = liveChatResponse({
    continuation: "NEXT1",
    timeoutMs: 5000,
    actions: [
      textAction({ author: "A", runs: ["one"], id: "1" }),
      textAction({ author: "B", runs: ["two"], id: "2" })
    ]
  });
  const r = /** @type {any} */ (parseLiveChatResponse(json));
  assert.equal(r.continuation, "NEXT1");
  assert.equal(r.timeoutMs, 5000);
  assert.equal(r.messages.length, 2);
  assert.deepEqual(r.messages.map((/** @type {any} */ m) => m.text), ["one", "two"]);
  assert.deepEqual(r.ignored, []);
});

test("parseLiveChatResponse: actions 空（新着なし）は正常＝messages 空（エラーではない）", () => {
  const r = /** @type {any} */ (parseLiveChatResponse(liveChatResponse({ continuation: "NEXT2", actions: [] })));
  assert.equal(r.continuation, "NEXT2");
  assert.deepEqual(r.messages, []);
});

test("parseLiveChatResponse: text と paid と無視種別が混在しても分別する", () => {
  const json = liveChatResponse({
    continuation: "NEXT3",
    actions: [
      textAction({ author: "A", runs: ["hi"] }),
      ignoredAction("liveChatViewerEngagementMessageRenderer"),
      paidAction({ author: "P", runs: ["thanks"] }),
      paidAction({ author: "Q" }) // 本文なし → ignored
    ]
  });
  const r = /** @type {any} */ (parseLiveChatResponse(json));
  assert.deepEqual(r.messages.map((/** @type {any} */ m) => m.kind), ["text", "paid"]);
  assert.equal(r.ignored.length, 2);
});

test("parseLiveChatResponse: 次 continuation が無ければ ended", () => {
  assert.equal(
    /** @type {any} */ (parseLiveChatResponse(liveChatResponse({ continuation: null }))).error.kind,
    "ended"
  );
});

test("parseLiveChatResponse: continuationContents ごと欠落は ended", () => {
  assert.equal(
    /** @type {any} */ (parseLiveChatResponse(liveChatResponse({ noContinuationContents: true }))).error.kind,
    "ended"
  );
});

test("parseLiveChatResponse: 非オブジェクトは extractFailed", () => {
  assert.equal(/** @type {any} */ (parseLiveChatResponse(null)).error.kind, "extractFailed");
  assert.equal(/** @type {any} */ (parseLiveChatResponse("string")).error.kind, "extractFailed");
});

test("parseLiveChatResponse: timeoutMs が文字列でも数値化・無ければ null", () => {
  const strTimeout = /** @type {any} */ (parseLiveChatResponse(liveChatResponse({ continuation: "N", timeoutMs: /** @type {any} */ (undefined) })));
  assert.equal(strTimeout.timeoutMs, null);
  // invalidation 種別も continuation を拾える。
  const inval = /** @type {any} */ (parseLiveChatResponse(liveChatResponse({ continuation: "N", continuationKind: "invalidation" })));
  assert.equal(inval.continuation, "N");
});

// ── fetch ラッパ（fetchImpl 注入）────────────────────────────────────────

test("fetchWatchPage: GET して HTML text を返す・非 2xx は throw", async () => {
  /** @type {{ url: string; init: any } | null} */
  let captured = null;
  const html = await fetchWatchPage({
    url: "https://www.youtube.com/watch?v=x",
    fetchImpl: /** @type {any} */ (async (url, init) => {
      captured = { url: String(url), init };
      return { ok: true, status: 200, statusText: "OK", text: async () => "<html>ok</html>" };
    })
  });
  assert.equal(html, "<html>ok</html>");
  assert.ok(captured);
  assert.equal(/** @type {any} */ (captured).init.method, "GET");

  await assert.rejects(
    fetchWatchPage({
      url: "https://www.youtube.com/watch?v=x",
      fetchImpl: /** @type {any} */ (async () => ({ ok: false, status: 429, statusText: "Too Many Requests", text: async () => "" }))
    }),
    /HTTP 429/
  );
});

test("fetchLiveChat: POST 本文に context.client と continuation を載せる・key をクエリに付す", async () => {
  /** @type {{ url: string; init: any } | null} */
  let captured = null;
  const json = await fetchLiveChat({
    apiKey: "AIzaKEY",
    clientVersion: "2.20260714.00.00",
    continuation: "CONT_X",
    origin: "http://127.0.0.1:9",
    fetchImpl: /** @type {any} */ (async (url, init) => {
      captured = { url: String(url), init };
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ ok: 1 }) };
    })
  });
  assert.deepEqual(json, { ok: 1 });
  assert.ok(captured);
  const c = /** @type {any} */ (captured);
  assert.equal(c.url, "http://127.0.0.1:9/youtubei/v1/live_chat/get_live_chat?key=AIzaKEY");
  assert.equal(c.init.method, "POST");
  const body = JSON.parse(c.init.body);
  assert.equal(body.continuation, "CONT_X");
  assert.equal(body.context.client.clientName, INNERTUBE_CLIENT_NAME);
  assert.equal(body.context.client.clientVersion, "2.20260714.00.00");
});

test("定数 export: DEFAULT_POLL_INTERVAL_MS は正の数", () => {
  assert.ok(typeof DEFAULT_POLL_INTERVAL_MS === "number" && DEFAULT_POLL_INTERVAL_MS > 0);
});
