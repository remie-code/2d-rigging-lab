// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createLlmSession } from "./llm-session.mjs";

// 実 SDK は使わない（サブスク枠消費・12 秒 spawn を避ける）。query() を純 JS のフェイクに差し替え、
// 常駐ストリーミング入力の汲み出しロジック（ask→result・複数 ask の常駐・dispose・TTFT・init 観測）
// だけを検証する。実 SDK 経由の tools:[] 動作確認と計測は scripts/first-light.mjs で 4 回だけ行う。

/**
 * 常駐ストリーミング query() のフェイク。prompt（AsyncIterable<SDKUserMessage>）を読み、各ユーザー
 * メッセージに init（初回のみ）→ stream_event(text_delta) → assistant → result を返す。
 * @param {object} [cfg]
 * @param {string[]} [cfg.tools]  init.tools（既定 []）。
 * @param {boolean} [cfg.endAfterInit]  init だけ出して即終了（residency 断絶の再現）。
 */
function makeFakeQuery(cfg = {}) {
  const tools = cfg.tools ?? [];
  const calls = { options: /** @type {any} */ (null), userTexts: /** @type {string[]} */ ([]) };
  /** @type {any} */
  function fakeQuery({ prompt, options }) {
    calls.options = options;
    async function* gen() {
      yield {
        type: "system",
        subtype: "init",
        tools,
        apiKeySource: "oauth",
        model: options.model,
        slash_commands: [],
        skills: [],
        session_id: "sess",
        uuid: "u0"
      };
      if (cfg.endAfterInit) {
        return;
      }
      for await (const userMsg of prompt) {
        const text = userMsg.message.content;
        calls.userTexts.push(text);
        const reply = `こたえ:${text}`;
        yield {
          type: "stream_event",
          event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: reply } },
          parent_tool_use_id: null,
          session_id: "sess",
          uuid: "u-se"
        };
        yield {
          type: "assistant",
          message: { role: "assistant", content: [{ type: "text", text: reply }] },
          parent_tool_use_id: null,
          session_id: "sess",
          uuid: "u-a"
        };
        yield {
          type: "result",
          subtype: "success",
          result: reply,
          usage: { input_tokens: 7, output_tokens: 4 },
          ttft_ms: 33,
          duration_ms: 50,
          num_turns: 1,
          is_error: false,
          session_id: "sess",
          uuid: "u-r"
        };
      }
    }
    return gen();
  }
  return { fakeQuery, calls };
}

test("llm-session: ask は応答全文・usage・TTFT・elapsed を返す（残留 generator を手動 next で汲む）", async () => {
  const { fakeQuery, calls } = makeFakeQuery();
  const session = createLlmSession({ skipEnvGuard: true, queryImpl: fakeQuery });
  try {
    const out = await session.ask("こんにちは");
    assert.equal(out.replyText, "こたえ:こんにちは");
    assert.deepEqual(out.usage, { input_tokens: 7, output_tokens: 4 });
    assert.ok(typeof out.ttftMs === "number" && out.ttftMs >= 0); // text_delta 到達で計測。
    assert.ok(typeof out.elapsedMs === "number" && out.elapsedMs >= 0);
    assert.deepEqual(calls.userTexts, ["こんにちは"]);
  } finally {
    await session.dispose();
  }
});

test("llm-session: 複数 ask が同一常駐 generator を共有する（for-await-break でセッションを殺さない）", async () => {
  const { fakeQuery, calls } = makeFakeQuery();
  const session = createLlmSession({ skipEnvGuard: true, queryImpl: fakeQuery });
  try {
    const a = await session.ask("ひとつめ");
    const b = await session.ask("ふたつめ");
    const c = await session.ask("みっつめ");
    assert.equal(a.replyText, "こたえ:ひとつめ");
    assert.equal(b.replyText, "こたえ:ふたつめ");
    assert.equal(c.replyText, "こたえ:みっつめ");
    assert.deepEqual(calls.userTexts, ["ひとつめ", "ふたつめ", "みっつめ"]);
  } finally {
    await session.dispose();
  }
});

test("llm-session: options が wave 計画どおり（settingSources:[] / tools:[] / persistSession:false / maxTurns:1 / includePartialMessages）", async () => {
  const { fakeQuery, calls } = makeFakeQuery();
  const session = createLlmSession({
    skipEnvGuard: true,
    queryImpl: fakeQuery,
    systemPrompt: "テスト用",
    model: "claude-opus-4-8"
  });
  try {
    await session.ask("x");
    const opt = calls.options;
    assert.deepEqual(opt.settingSources, []);
    assert.deepEqual(opt.tools, []);
    assert.equal(opt.persistSession, false);
    assert.equal(opt.maxTurns, 1);
    assert.equal(opt.includePartialMessages, true);
    assert.equal(opt.model, "claude-opus-4-8");
    assert.equal(opt.systemPrompt, "テスト用");
    assert.ok(opt.abortController instanceof AbortController);
  } finally {
    await session.dispose();
  }
});

test("llm-session: onInit で system/init を観測できる（tools[] 記録用）", async () => {
  const { fakeQuery } = makeFakeQuery({ tools: [] });
  let seenInit = null;
  const session = createLlmSession({
    skipEnvGuard: true,
    queryImpl: fakeQuery,
    onInit: (init) => {
      seenInit = init;
    }
  });
  try {
    await session.ask("x");
    assert.ok(seenInit);
    assert.deepEqual(seenInit.tools, []);
    assert.equal(seenInit.apiKeySource, "oauth");
    assert.deepEqual(session.getInit().tools, []);
  } finally {
    await session.dispose();
  }
});

test("llm-session: env ガードが起動経路で効く（skipEnvGuard 無しで API_KEY 設定なら throw）", () => {
  assert.throws(
    () =>
      createLlmSession({
        env: { ANTHROPIC_API_KEY: "sk" },
        queryImpl: makeFakeQuery().fakeQuery
      }),
    /ANTHROPIC_API_KEY/
  );
});

test("llm-session: env ガードの warning は onWarning に渡る（BASE_URL 非既定）", () => {
  const seen = [];
  const session = createLlmSession({
    env: { ANTHROPIC_BASE_URL: "https://proxy.local" },
    queryImpl: makeFakeQuery().fakeQuery,
    onWarning: (w) => seen.push(w)
  });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /ANTHROPIC_BASE_URL/);
  // dispose は非同期だが起動時点の検証なので待たなくてよい（generator は init を出すだけ）。
  return session.dispose();
});

test("llm-session: result 前に generator が終了したら ask は理由付き throw", async () => {
  const { fakeQuery } = makeFakeQuery({ endAfterInit: true });
  const session = createLlmSession({ skipEnvGuard: true, queryImpl: fakeQuery });
  try {
    await assert.rejects(() => session.ask("x"), /ended before a result/);
  } finally {
    await session.dispose();
  }
});

// ── S5: ask の content ブロック配列受理（視覚発火の口）─────────────────────────────

test("llm-session: ask は文字列入力で従来どおり content:<string> で push する（無退行）", async () => {
  const { fakeQuery, calls } = makeFakeQuery();
  const session = createLlmSession({ skipEnvGuard: true, queryImpl: fakeQuery });
  try {
    await session.ask("こんにちは");
    assert.equal(calls.userTexts.length, 1);
    assert.equal(typeof calls.userTexts[0], "string");
    assert.equal(calls.userTexts[0], "こんにちは");
  } finally {
    await session.dispose();
  }
});

test("llm-session: ask は content ブロック配列入力を content:<配列> のまま push する", async () => {
  const { fakeQuery, calls } = makeFakeQuery();
  const session = createLlmSession({ skipEnvGuard: true, queryImpl: fakeQuery });
  const blocks = [
    { type: "image", source: { type: "base64", data: "ZmFrZQ==", media_type: "image/jpeg" } },
    { type: "text", text: "今の画面を見て反応してください。" }
  ];
  try {
    const out = await session.ask(blocks);
    assert.equal(calls.userTexts.length, 1);
    assert.ok(Array.isArray(calls.userTexts[0]));
    assert.deepEqual(calls.userTexts[0], blocks);
    // ask 自体は通常どおり応答を返す（型分岐は push 形状だけ）。
    assert.equal(typeof out.replyText, "string");
  } finally {
    await session.dispose();
  }
});

test("llm-session: ask は空文字列/空配列/非文字列非配列を TypeError で拒否する", async () => {
  const { fakeQuery } = makeFakeQuery();
  const session = createLlmSession({ skipEnvGuard: true, queryImpl: fakeQuery });
  try {
    await assert.rejects(() => session.ask(""), TypeError);
    await assert.rejects(() => session.ask([]), TypeError);
    await assert.rejects(() => session.ask(42), TypeError);
    await assert.rejects(() => session.ask(null), TypeError);
    await assert.rejects(() => session.ask(undefined), TypeError);
  } finally {
    await session.dispose();
  }
});

test("llm-session: dispose 後の ask は throw・二重 dispose は無害", async () => {
  const { fakeQuery } = makeFakeQuery();
  const session = createLlmSession({ skipEnvGuard: true, queryImpl: fakeQuery });
  await session.ask("x");
  await session.dispose();
  await session.dispose(); // 二重呼び出しは no-op。
  await assert.rejects(() => session.ask("y"), /disposed/);
});
