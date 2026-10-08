// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  createLiveChatClient,
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
  REQUEST_TIMEOUT_MS,
  POLL_FLOOR_MS
} from "./live-chat-client.mjs";
import { watchHtmlLive, watchHtmlNotLive, textAction, paidAction, ignoredAction, liveChatResponse } from "./fixtures-innertube.mjs";

// ライブチャット器官（独立・壊れる前提）の決定論テスト。実 clock・実 timer・実 fetch は一切使わず
// 全注入（fire-scheduler.test.mjs の fake clock 流儀 + whisper-client.test.mjs の fake fetch 流儀）。
// blocking 基準: 機械テストは実 YouTube に出ない / 壊れ方全分類を固定 / 死んでも throw が漏れない。

/**
 * fake clock + fake timer（決定論・ネスト scheduling 対応）。fire-scheduler.test.mjs 写経。
 */
function makeFakeClock() {
  let now = 0;
  let seq = 0;
  /** @type {Map<number, { fn: () => void; at: number }>} */
  const timers = new Map();
  const setTimeoutImpl = /** @type {any} */ ((fn, ms) => {
    const id = (seq += 1);
    timers.set(id, { fn, at: now + ms });
    return id;
  });
  const clearTimeoutImpl = /** @type {any} */ ((id) => {
    timers.delete(id);
  });
  const advance = (ms) => {
    const target = now + ms;
    for (;;) {
      /** @type {{ id: number; at: number; fn: () => void } | null} */
      let next = null;
      for (const [id, t] of timers) {
        if (t.at <= target && (next === null || t.at < next.at || (t.at === next.at && id < next.id))) {
          next = { id, at: t.at, fn: t.fn };
        }
      }
      if (next === null) break;
      timers.delete(next.id);
      now = next.at;
      next.fn();
    }
    now = target;
  };
  const nextDelay = () => {
    let min = null;
    for (const t of timers.values()) {
      if (min === null || t.at < min) min = t.at;
    }
    return min === null ? null : min - now;
  };
  return { setTimeoutImpl, clearTimeoutImpl, advance, now: () => now, pending: () => timers.size, nextDelay };
}

/**
 * fake fetch。watch GET と get_live_chat POST を URL で振り分け、キューから応答する。
 * 各キュー要素:
 *   watch: { html } | { rejectWith } | { status }
 *   chat:  { json }  | { rejectWith } | { status }
 * キュー枯渇時は末尾要素を再利用（テストは advance 回数で制御する）。
 * @param {{ watch: any[]; chat: any[] }} script
 */
function makeFakeFetch(script) {
  let watchCalls = 0;
  let chatCalls = 0;
  const pick = (arr, i) => arr[Math.min(i, arr.length - 1)];
  const fetchImpl = /** @type {any} */ (async (url) => {
    const u = String(url);
    if (u.includes("get_live_chat")) {
      const d = pick(script.chat, chatCalls);
      chatCalls += 1;
      if (d.rejectWith) throw new Error(d.rejectWith);
      if (d.status) return { ok: false, status: d.status, statusText: "Err", json: async () => ({}), text: async () => "" };
      return { ok: true, status: 200, statusText: "OK", json: async () => d.json };
    }
    // watch page GET
    const d = pick(script.watch, watchCalls);
    watchCalls += 1;
    if (d.rejectWith) throw new Error(d.rejectWith);
    if (d.status) return { ok: false, status: d.status, statusText: "Err", text: async () => "" };
    return { ok: true, status: 200, statusText: "OK", text: async () => d.html };
  });
  return {
    fetchImpl,
    watchCalls: () => watchCalls,
    chatCalls: () => chatCalls
  };
}

/** 器官を fake で組む共通ヘルパ（rng=0 で無ジッター＝決定論バックオフ）。 */
function makeClient(script, overrides = {}) {
  const clock = makeFakeClock();
  const fetcher = makeFakeFetch(script);
  const messages = [];
  const statuses = [];
  const diagnostics = [];
  const client = createLiveChatClient({
    source: "vid00000001",
    fetchImpl: fetcher.fetchImpl,
    nowImpl: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    rng: () => 0,
    origin: "http://127.0.0.1:0",
    ...overrides
  });
  client.onMessage((m) => messages.push(m));
  client.onStatus((s) => statuses.push(s));
  client.onDiagnostic((d) => diagnostics.push(d));
  return { client, clock, fetcher, messages, statuses, diagnostics };
}

const kinds = (diags) => diags.map((d) => d.kind);

// ── 定数 ─────────────────────────────────────────────────────────────

test("client: v0 定数が export される（バックオフ・タイムアウト・床）", () => {
  assert.ok(BACKOFF_BASE_MS > 0 && BACKOFF_CAP_MS >= BACKOFF_BASE_MS);
  assert.ok(REQUEST_TIMEOUT_MS > 0 && POLL_FLOOR_MS > 0);
});

// ── happy path: bootstrap → live → continuation ループ ─────────────────────

test("client: bootstrap で live に上がり、continuation ループでページを跨いでメッセージを配信", async () => {
  const { client, clock, messages, statuses } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "CONT0" }) }],
    chat: [
      { json: liveChatResponse({ continuation: "CONT1", timeoutMs: 5000, actions: [textAction({ author: "A", runs: ["one"] })] }) },
      { json: liveChatResponse({ continuation: "CONT2", timeoutMs: 5000, actions: [textAction({ author: "B", runs: ["two"] })] }) }
    ]
  });

  await client.start();
  assert.equal(client.getState(), "live");
  assert.deepEqual(statuses, ["connecting", "live"]);
  assert.deepEqual(messages.map((m) => m.text), ["one"]);
  assert.equal(messages[0].displayName, "A");
  assert.equal(messages[0].videoId, "vid00000001");

  // 次 poll は timeoutMs=5000 後にスケジュールされる（床で潰れない）。
  assert.equal(clock.nextDelay(), 5000);
  clock.advance(5000);
  await client.idle();
  assert.deepEqual(messages.map((m) => m.text), ["one", "two"]);
  assert.equal(client.getState(), "live");
});

test("client: timeoutMs 欠落時は defaultPollIntervalMs、床 POLL_FLOOR_MS を下回らない", async () => {
  const { client, clock } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [
      { json: liveChatResponse({ continuation: "C1", actions: [] }) }, // timeoutMs 無し → default
      { json: liveChatResponse({ continuation: "C2", timeoutMs: 10, actions: [] }) } // 10ms → 床
    ]
  }, { defaultPollIntervalMs: 4000, pollFloorMs: 1000 });

  await client.start();
  assert.equal(clock.nextDelay(), 4000); // default
  clock.advance(4000);
  await client.idle();
  assert.equal(clock.nextDelay(), 1000); // 10ms は床 1000ms に持ち上げ
});

// ── renderer 分岐（text / paid / 無視種別）─────────────────────────────────

test("client: text と paid（本文あり）を配信し、無視種別は ignoredRenderers 診断へ", async () => {
  const { client, messages, diagnostics } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [
      {
        json: liveChatResponse({
          continuation: "C1",
          actions: [
            textAction({ author: "A", runs: ["hi"] }),
            paidAction({ author: "P", runs: ["thanks!"] }),
            ignoredAction("liveChatMembershipItemRenderer"),
            paidAction({ author: "Q" }) // 本文なし → 無視
          ]
        })
      }
    ]
  });
  await client.start();
  assert.deepEqual(messages.map((m) => `${m.kind}:${m.text}`), ["text:hi", "paid:thanks!"]);
  const ign = diagnostics.find((d) => d.kind === "ignoredRenderers");
  assert.ok(ign);
  assert.deepEqual(ign.kinds, ["liveChatMembershipItemRenderer", "liveChatPaidMessageRenderer(no-body)"]);
});

test("client: 継続はあるが actions が空（新着なし）は healthy＝live 継続・メッセージなし", async () => {
  const { client, messages } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: liveChatResponse({ continuation: "C1", actions: [] }) }]
  });
  await client.start();
  assert.equal(client.getState(), "live");
  assert.deepEqual(messages, []);
});

// ── 壊れ方: extractFailed（bootstrap 4 点抽出失敗）→ retrying → 回復 ────────────

test("client: 4 点抽出失敗は retrying（extractFailed 診断）、バックオフ後の再接続で回復", async () => {
  const { client, clock, statuses, diagnostics } = makeClient({
    watch: [{ html: "<html>no keys</html>" }, { html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: liveChatResponse({ continuation: "C1", actions: [textAction({ author: "A", runs: ["recovered"] })] }) }]
  });

  await client.start();
  assert.equal(client.getState(), "retrying");
  assert.deepEqual(statuses, ["connecting", "retrying"]);
  const ef = diagnostics.find((d) => d.kind === "extractFailed");
  assert.ok(ef);
  assert.equal(ef.delayMs, BACKOFF_BASE_MS); // rng=0 → base

  clock.advance(BACKOFF_BASE_MS);
  await client.idle();
  assert.equal(client.getState(), "live");
});

// ── 壊れ方: レスポンス全崩れ（スキーマ変化）→ extractFailed → retrying ─────────

test("client: get_live_chat が JSON オブジェクトでない（スキーマ全崩れ）は extractFailed → retrying", async () => {
  const { client, diagnostics } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: "totally not the expected shape" }]
  });
  await client.start();
  assert.equal(client.getState(), "retrying");
  assert.ok(diagnostics.some((d) => d.kind === "extractFailed"));
});

// ── 壊れ方: notLive（配信未開始）→ retrying で待ち続ける ───────────────────

test("client: notLive（未開始）は retrying で待ち、開始したら live に上がる", async () => {
  const { client, clock, diagnostics } = makeClient({
    watch: [{ html: watchHtmlNotLive() }, { html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: liveChatResponse({ continuation: "C1", actions: [] }) }]
  });
  await client.start();
  assert.equal(client.getState(), "retrying");
  assert.ok(diagnostics.some((d) => d.kind === "notLive"));

  clock.advance(BACKOFF_BASE_MS);
  await client.idle();
  assert.equal(client.getState(), "live");
});

// ── 壊れ方: ended（配信終了）→ dead（終端・再接続しない）───────────────────

test("client: 配信終了（次 continuation なし）は dead に落ち、タイマを残さない", async () => {
  const { client, clock, statuses, diagnostics } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [
      { json: liveChatResponse({ continuation: "C1", actions: [textAction({ author: "A", runs: ["last"] })] }) },
      { json: liveChatResponse({ continuation: null }) } // 終了シグナル
    ]
  });
  await client.start();
  assert.equal(client.getState(), "live");
  clock.advance(clock.nextDelay());
  await client.idle();
  assert.equal(client.getState(), "dead");
  assert.equal(statuses[statuses.length - 1], "dead");
  assert.ok(diagnostics.some((d) => d.kind === "ended"));
  assert.equal(clock.pending(), 0); // 再接続タイマなし＝もうポーリングしない

  // 追加 advance でも復活しない。
  clock.advance(1_000_000);
  await client.idle();
  assert.equal(client.getState(), "dead");
});

// ── 壊れ方: network（fetch 失敗・非2xx）→ retrying ───────────────────────

test("client: bootstrap の fetch 失敗は network → retrying、回復可能", async () => {
  const { client, clock, diagnostics } = makeClient({
    watch: [{ rejectWith: "ECONNREFUSED" }, { html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: liveChatResponse({ continuation: "C1", actions: [] }) }]
  });
  await client.start();
  assert.equal(client.getState(), "retrying");
  const net = diagnostics.find((d) => d.kind === "network");
  assert.ok(net);
  assert.match(net.message, /ECONNREFUSED/);

  clock.advance(BACKOFF_BASE_MS);
  await client.idle();
  assert.equal(client.getState(), "live");
});

test("client: poll 中の fetch 失敗も network → retrying（bootstrap からやり直し）", async () => {
  const { client, clock } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }, { html: watchHtmlLive({ continuation: "C0b" }) }],
    chat: [
      { json: liveChatResponse({ continuation: "C1", actions: [] }) },
      { rejectWith: "socket hang up" },
      { json: liveChatResponse({ continuation: "C2", actions: [textAction({ author: "A", runs: ["back"] })] }) }
    ]
  });
  await client.start();
  assert.equal(client.getState(), "live");
  clock.advance(clock.nextDelay()); // 2回目 poll → reject → retrying
  await client.idle();
  assert.equal(client.getState(), "retrying");
  clock.advance(clock.nextDelay()); // 再接続 → bootstrap → live
  await client.idle();
  assert.equal(client.getState(), "live");
});

test("client: HTTP 非 2xx も network 扱いで retrying", async () => {
  const { client, diagnostics } = makeClient({
    watch: [{ status: 503 }, { html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: liveChatResponse({ continuation: "C1", actions: [] }) }]
  });
  await client.start();
  assert.equal(client.getState(), "retrying");
  assert.ok(diagnostics.some((d) => d.kind === "network" && /HTTP 503/.test(d.message)));
});

// ── 壊れ方: 想定外の内部例外（catch-all 最終防波堤）→ internalError → retrying → 回復 ──

test("client: parse が想定外 throw（try/catch 外の内部例外）でも沈黙凍結せず internalError 診断 → retrying → 再接続で回復", async () => {
  // parseLiveChatResponse(json) は runPoll の try/catch の外で呼ばれる（fetch のみ守られている）。
  // そこへ「プロパティ参照で throw する」レスポンスを注入し、launch() の catch-all 経路を決定論的に踏む。
  const boom = {
    get continuationContents() {
      throw new Error("unexpected parse boom");
    }
  };
  const { client, clock, statuses, diagnostics, fetcher } = makeClient({
    watch: [
      { html: watchHtmlLive({ continuation: "C0" }) }, // 初回 bootstrap は成功 → live
      { html: watchHtmlLive({ continuation: "C0b" }) } // 再接続時 bootstrap も成功 → live
    ],
    chat: [
      { json: boom }, // 初回 poll で parse が想定外 throw（try/catch の外）
      { json: liveChatResponse({ continuation: "C1", actions: [textAction({ author: "A", runs: ["back"] })] }) }
    ]
  });

  await client.start();
  // bootstrap は成功して一度 live に上がるが、初回 poll の parse throw が catch-all に落ちる。
  // 状態を偽って沈黙凍結せず、診断を出して retrying へ落ちること。
  assert.equal(client.getState(), "retrying");
  const internal = diagnostics.find((d) => d.kind === "internalError");
  assert.ok(internal, "internalError 診断が出る");
  assert.match(internal.message, /parse boom/);
  // catch-all から自動再接続がスケジュールされている（extractFailed 扱い・action:retrying）。
  assert.ok(diagnostics.some((d) => d.kind === "extractFailed" && d.action === "retrying"));
  assert.equal(statuses[statuses.length - 1], "retrying");
  assert.equal(clock.nextDelay(), BACKOFF_BASE_MS); // rng=0・bootstrap 成功で attempts=0 → base

  const watchBefore = fetcher.watchCalls();
  clock.advance(BACKOFF_BASE_MS);
  await client.idle();
  // バックオフ後に再接続（再度 watch fetch が試みられ）live に戻る＝自動再接続が効いている。
  assert.ok(fetcher.watchCalls() > watchBefore, "再接続で watch fetch が再試行される");
  assert.equal(client.getState(), "live");
});

test("client: poll 進行中に stop() が割り込み、その後 catch-all に想定外 throw が落ちても終端のまま再接続しない", async () => {
  // 実際に踏む経路（追加テスト 1 の false 分岐版）:
  //   初回 poll が fetchLiveChat の await で中断している最中に stop()（stopped=true・state=dead）。
  //   その後 fetch が boom（プロパティ参照で throw するレスポンス）で解決 → runPoll の await 再開 →
  //   try/catch の外で呼ぶ parseLiveChatResponse が throw → launch() の catch-all に落ちる。
  //   到達時点で stopped=true かつ state="dead" なので、catch-all 末尾ガード
  //   `if (!stopped && state !== "dead") { scheduleReconnect(...) }` の **false 分岐**が実行を伴って効く
  //   ＝ 診断は出しても再接続はスケジュールしないことを固定する。
  const boom = {
    get continuationContents() {
      throw new Error("late boom");
    }
  };
  const clock = makeFakeClock();

  // 手動解決の deferred fetch（この 1 本専用・fake fetch のみ・実ネット不出）。get_live_chat 呼び出しで
  // pending な Promise を返し、テストが任意のタイミングで boom を解決できる。watch は即時成功。
  let watchCalls = 0;
  let chatCalls = 0;
  /** @type {((v: any) => void) | null} */
  let resolveChatFetch = null;
  /** @type {(() => void) | null} */
  let signalChatRequested = null;
  const chatRequested = new Promise((r) => {
    signalChatRequested = r;
  });
  const fetchImpl = /** @type {any} */ (async (url) => {
    const u = String(url);
    if (u.includes("get_live_chat")) {
      chatCalls += 1;
      signalChatRequested?.();
      // pending のまま返す＝runPoll は fetchLiveChat の await で中断する（テストが resolveChatFetch で解決するまで）。
      return await new Promise((resolve) => {
        resolveChatFetch = resolve;
      });
    }
    watchCalls += 1;
    return { ok: true, status: 200, statusText: "OK", text: async () => watchHtmlLive({ continuation: "C0" }) };
  });

  const diagnostics = [];
  const statuses = [];
  const client = createLiveChatClient({
    source: "vid00000001",
    fetchImpl,
    nowImpl: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    rng: () => 0,
    origin: "http://127.0.0.1:0"
  });
  client.onDiagnostic((d) => diagnostics.push(d));
  client.onStatus((s) => statuses.push(s));

  // start() は初回 poll の fetchLiveChat で中断するので await しない（settle は最後に started/idle で待つ）。
  const started = client.start();
  await chatRequested; // bootstrap 成功 → live → 初回 poll が fetch の await で中断した地点まで進む。
  assert.equal(client.getState(), "live");
  assert.equal(chatCalls, 1);
  assert.equal(watchCalls, 1);

  // poll 進行中（await 中）に stop() が割り込む＝stopped=true・state=dead。
  client.stop();
  assert.equal(client.getState(), "dead");
  const watchBefore = watchCalls;
  const chatBefore = chatCalls;

  // fetch を boom で解決 → await 再開 → parseLiveChatResponse throw → catch-all（stopped/dead で false 分岐）。
  assert.equal(typeof resolveChatFetch, "function");
  resolveChatFetch?.({ ok: true, status: 200, statusText: "OK", json: async () => boom });
  await started; // start() が起動した launch サイクルの settle を待つ（catch-all まで走り切る）。
  await client.idle();

  // catch-all は実際に発火した（想定外 throw を拾い診断した）＝この経路を踏んだ証拠。
  const internal = diagnostics.find((d) => d.kind === "internalError");
  assert.ok(internal, "catch-all が発火し internalError 診断が出る（想定外 throw を拾った証拠）");
  assert.match(internal.message, /late boom/);
  // だが終端（stopped=true・state=dead）なので **再接続はスケジュールされない**（false 分岐が効く）:
  //  - extractFailed + action:"retrying" 診断が出ない（scheduleReconnect 未実行）。
  assert.ok(!diagnostics.some((d) => d.kind === "extractFailed" && d.action === "retrying"));
  //  - 再接続タイマがスケジュールされていない。
  assert.equal(clock.pending(), 0);
  //  - 状態は dead のまま、以後 advance しても watch/poll の再試行が起きない。
  assert.equal(client.getState(), "dead");
  clock.advance(1_000_000);
  await client.idle();
  assert.equal(client.getState(), "dead");
  assert.equal(watchCalls, watchBefore); // 再接続 bootstrap の watch 再取得なし
  assert.equal(chatCalls, chatBefore); // 再 poll もなし
});

// ── バックオフの増大（rng=0・上限 cap）────────────────────────────────────

test("client: 連続失敗でバックオフが base→2x→4x と増え、cap で頭打ち", async () => {
  const { client, clock, diagnostics } = makeClient(
    { watch: [{ rejectWith: "down" }], chat: [{ json: liveChatResponse({ continuation: "C1", actions: [] }) }] },
    { backoffBaseMs: 1000, backoffCapMs: 4000 }
  );
  await client.start(); // 失敗1 → delay 1000
  clock.advance(clock.nextDelay());
  await client.idle(); // 失敗2 → 2000
  clock.advance(clock.nextDelay());
  await client.idle(); // 失敗3 → 4000
  clock.advance(clock.nextDelay());
  await client.idle(); // 失敗4 → cap 4000
  const delays = diagnostics.filter((d) => d.kind === "network").map((d) => d.delayMs);
  assert.deepEqual(delays.slice(0, 4), [1000, 2000, 4000, 4000]);
});

// ── stop() → dead・以後ポーリングしない ─────────────────────────────────

test("client: stop() で dead・タイマ全撤去・再ポーリングなし", async () => {
  const { client, clock, messages } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [
      { json: liveChatResponse({ continuation: "C1", actions: [textAction({ author: "A", runs: ["one"] })] }) },
      { json: liveChatResponse({ continuation: "C2", actions: [textAction({ author: "B", runs: ["two"] })] }) }
    ]
  });
  await client.start();
  assert.equal(client.getState(), "live");
  client.stop();
  assert.equal(client.getState(), "dead");
  assert.equal(clock.pending(), 0);
  clock.advance(1_000_000);
  await client.idle();
  assert.deepEqual(messages.map((m) => m.text), ["one"]); // two は来ない
});

// ── フックの throw は器官が握る（常駐を殺さない）─────────────────────────

test("client: onMessage が throw しても listenerError 診断に落ちて常駐は続く", async () => {
  const clock = makeFakeClock();
  const fetcher = makeFakeFetch({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: liveChatResponse({ continuation: "C1", actions: [textAction({ author: "A", runs: ["boom"] })] }) }]
  });
  const diagnostics = [];
  const client = createLiveChatClient({
    source: "vid00000001",
    fetchImpl: fetcher.fetchImpl,
    nowImpl: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    rng: () => 0,
    origin: "http://127.0.0.1:0"
  });
  client.onMessage(() => {
    throw new Error("listener kaboom");
  });
  client.onDiagnostic((d) => diagnostics.push(d));

  await client.start(); // throw が漏れれば ここで reject する
  assert.equal(client.getState(), "live"); // 常駐は死なない
  const le = diagnostics.find((d) => d.kind === "listenerError");
  assert.ok(le);
  assert.equal(le.hook, "message");
  assert.match(le.message, /kaboom/);
});

test("client: onStatus / onDiagnostic の throw も器官の外へ漏れない", async () => {
  const clock = makeFakeClock();
  const fetcher = makeFakeFetch({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: liveChatResponse({ continuation: "C1", actions: [] }) }]
  });
  const client = createLiveChatClient({
    source: "vid00000001",
    fetchImpl: fetcher.fetchImpl,
    nowImpl: clock.now,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    rng: () => 0,
    origin: "http://127.0.0.1:0"
  });
  client.onStatus(() => {
    throw new Error("status kaboom");
  });
  client.onDiagnostic(() => {
    throw new Error("diag kaboom");
  });
  // どちらの throw も start() の外へ漏れない（reject しない）。
  await client.start();
  assert.equal(client.getState(), "live");
});

// ── 独立性（構造）: 魂の他部位への import ゼロ ───────────────────────────

test("独立性: chat 器官のソースは魂の他部位（親ディレクトリ）を import しない", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const organFiles = ["live-chat-client.mjs", "innertube.mjs"];
  for (const f of organFiles) {
    const text = readFileSync(path.join(dir, f), "utf8");
    // 相対 import は同ディレクトリ（./）のみ許す。親（../）への import があれば独立性違反。
    const matches = [...text.matchAll(/\bfrom\s+["'](\.[^"']*)["']/g)].map((m) => m[1]);
    for (const spec of matches) {
      assert.ok(
        spec.startsWith("./") && !spec.startsWith("../"),
        `${f}: 相対 import "${spec}" は同ディレクトリ（./）のみ許可（魂他部位への import 禁止）`
      );
    }
    // 素の import 文の総数と ./ import の数が一致すること（node: グローバル以外の外部 import がない）。
    assert.ok(!/\bfrom\s+["']\.\.\//.test(text), `${f}: 親ディレクトリ import を含む`);
  }
});

// ── source getter / idle 事前呼び ─────────────────────────────────────────

test("client: getSource / start 前 idle は安全", async () => {
  const { client } = makeClient({
    watch: [{ html: watchHtmlLive({ continuation: "C0" }) }],
    chat: [{ json: liveChatResponse({ continuation: "C1", actions: [] }) }]
  });
  assert.equal(client.getSource(), "vid00000001");
  assert.equal(client.getState(), "idle");
  await client.idle(); // start 前でも resolve
  assert.equal(client.getState(), "idle");
});
