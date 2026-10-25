// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createDecisionsJudge,
  createDecisionsQuestionsJudge,
  loadDecisionsApiKey,
  SpeakNowJudgeError,
  DECISIONS_ENDPOINT,
  DECISIONS_MODEL,
  DECISIONS_TIMEOUT_MS,
  DEFAULT_DECISIONS_ENV_PATH
} from "./speak-now-decisions.mjs";
import { buildSpeakNowChoices } from "./speak-now.mjs";

// Decisions API 判定エンジンの機械テスト。fetch・タイマ・時計は全部 fake（実 API には繋がない）。

const SECRET = "sk-test-secret-value-never-shown";
const keyOk = () => ({ ok: /** @type {const} */ (true), apiKey: SECRET });

/** 手動タイマ（advance で期限到達分を発火）。 */
function makeTimers() {
  let now = 0;
  let seq = 0;
  /** @type {Map<number, { fn: () => void; at: number }>} */
  const timers = new Map();
  return {
    setTimeoutImpl: /** @type {any} */ ((fn, ms) => {
      seq += 1;
      timers.set(seq, { fn, at: now + ms });
      return seq;
    }),
    clearTimeoutImpl: /** @type {any} */ ((id) => timers.delete(id)),
    now: () => now,
    advance(ms) {
      now += ms;
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
      }
    },
    pending: () => timers.size
  };
}

/** fake fetch（応答を固定 or 手動で返す）。 */
function makeFetch(response) {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return typeof response === "function" ? response(init) : response;
  });
  return { fetchImpl, calls };
}

const okResponse = (choice = "initiate") => ({
  ok: true,
  status: 200,
  json: async () => ({
    answers: [
      {
        name: "reaction",
        choice,
        probabilities: [
          { value: "wait", probability: 0.2 },
          { value: "backchannel", probability: 0.15 },
          { value: "respond", probability: 0.2 },
          { value: "initiate", probability: 0.45 }
        ]
      }
    ]
  })
});

const request = () => ({ input: "配信者: やばい\nチャッピー: どうしたの", instructions: "問い", choices: buildSpeakNowChoices("チャッピー") });

test("loadDecisionsApiKey: env ファイルから OPENAI_DECISIONS_API_KEY を読む（process.env には入れない）", () => {
  const before = process.env.OPENAI_DECISIONS_API_KEY;
  const r = loadDecisionsApiKey({ readFileImpl: () => `# c\nOTHER=1\nOPENAI_DECISIONS_API_KEY="${SECRET}"\n` });
  assert.deepEqual(r, { ok: true, apiKey: SECRET });
  assert.equal(process.env.OPENAI_DECISIONS_API_KEY, before);
  assert.match(DEFAULT_DECISIONS_ENV_PATH.replace(/\\/g, "/"), /apps\/soul\/agent\/\.env\.decisions\.local$/);
});

test("loadDecisionsApiKey: ファイル無し・キー無し・空は ok:false + 理由（キー値を含まない）", () => {
  const noFile = loadDecisionsApiKey({
    readFileImpl: () => {
      throw new Error("ENOENT");
    }
  });
  assert.equal(noFile.ok, false);
  assert.match(/** @type {any} */ (noFile).reason, /Decisions API のキーが見つからない/);
  for (const body of ["OTHER=1\n", "OPENAI_DECISIONS_API_KEY=\n", "OPENAI_DECISIONS_API_KEY=  \n"]) {
    assert.equal(loadDecisionsApiKey({ readFileImpl: () => body }).ok, false, body);
  }
});

test("judge: POST /v1/decisions に gpt-6-luna・choice 1 問・Bearer キーで送り、choice/probs/latencyMs を返す", async () => {
  const timers = makeTimers();
  const { fetchImpl, calls } = makeFetch(okResponse("initiate"));
  let clock = 100;
  const judge = createDecisionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    nowImpl: () => (clock += 400)
  });
  const r = await judge(request());
  assert.equal(r.choice, "initiate");
  assert.deepEqual(r.probs, { wait: 0.2, backchannel: 0.15, respond: 0.2, initiate: 0.45 });
  assert.equal(r.latencyMs, 400);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, DECISIONS_ENDPOINT);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(calls[0].body.model, DECISIONS_MODEL);
  assert.equal(calls[0].body.model, "gpt-6-luna");
  assert.equal(calls[0].body.input, request().input);
  assert.equal(calls[0].body.questions.length, 1);
  assert.equal(calls[0].body.questions[0].type, "choice");
  assert.equal(calls[0].body.questions[0].name, "reaction");
  assert.deepEqual(calls[0].body.questions[0].choices.map((c) => c.value), ["wait", "backchannel", "respond", "initiate", "look"]);
  assert.equal(timers.pending(), 0, "成功時はタイムアウトのタイマを畳む");
});

test("judge: キーが無ければ fetch せずに SpeakNowJudgeError（理由はキー値を含まない）", async () => {
  const { fetchImpl, calls } = makeFetch(okResponse());
  const judge = createDecisionsJudge({
    apiKeyProvider: () => loadDecisionsApiKey({ readFileImpl: () => "" }),
    fetchImpl
  });
  await assert.rejects(judge(request()), (e) => e instanceof SpeakNowJudgeError && /キーが見つからない/.test(e.message));
  assert.equal(calls.length, 0);
});

test("judge: 3 秒でタイムアウト（fetch が abort を無視しても諦める）・signal は abort される", async () => {
  assert.equal(DECISIONS_TIMEOUT_MS, 3000);
  const timers = makeTimers();
  /** @type {any} */
  let seenSignal = null;
  const judge = createDecisionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: /** @type {any} */ ((_url, init) => {
      seenSignal = init.signal;
      return new Promise(() => {}); // 永遠に返らない（abort も無視）。
    }),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    nowImpl: timers.now
  });
  const p = judge(request());
  await Promise.resolve();
  timers.advance(2999);
  let settled = false;
  p.catch(() => {}).finally(() => (settled = true));
  await new Promise((r) => setImmediate(r));
  assert.equal(settled, false, "3 秒未満はまだ待つ");
  timers.advance(1);
  await assert.rejects(p, (e) => e instanceof SpeakNowJudgeError && /タイムアウト（3 秒）/.test(e.message) && e.latencyMs === 3000);
  assert.equal(seenSignal.aborted, true);
});

test("judge: HTTP エラーは status と短い文言・401 はサーバ文言を出さない・キー値は伏せる", async () => {
  const judge500 = createDecisionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: makeFetch({ ok: false, status: 500, json: async () => ({ error: { message: `boom ${SECRET}` } }) }).fetchImpl
  });
  await assert.rejects(judge500(request()), (e) => {
    assert.match(e.message, /HTTP 500: boom/);
    assert.equal(e.message.includes(SECRET), false);
    return true;
  });
  const judge401 = createDecisionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: makeFetch({ ok: false, status: 401, json: async () => ({ error: { message: "Incorrect API key provided: sk-te****" } }) }).fetchImpl
  });
  await assert.rejects(judge401(request()), (e) => e.message === "認証失敗（401）");
});

test("judge: 通信失敗・想定外の応答（choice 欠落/選択肢外）は SpeakNowJudgeError", async () => {
  const judgeNet = createDecisionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: /** @type {any} */ (async () => {
      throw new Error("ECONNRESET");
    })
  });
  await assert.rejects(judgeNet(request()), (e) => e instanceof SpeakNowJudgeError && /通信失敗: ECONNRESET/.test(e.message));
  for (const json of [{}, { answers: [{ name: "reaction" }] }, { answers: [{ name: "reaction", choice: "speak" }] }]) {
    const judge = createDecisionsJudge({ apiKeyProvider: keyOk, fetchImpl: makeFetch({ ok: true, status: 200, json: async () => json }).fetchImpl });
    await assert.rejects(judge(request()), (e) => e instanceof SpeakNowJudgeError && /想定外/.test(e.message), JSON.stringify(json));
  }
});

// ── createDecisionsQuestionsJudge（コメント判定: choice + predicate の複数問・判定拒否を区別して返す）────────

const guardQuestions = () => [
  { type: "choice", name: "verdict", instructions: "4 択", choices: [{ value: "ok", description: "a" }, { value: "hijack", description: "b" }] },
  { type: "predicate", name: "hijack", instructions: "乗っ取りか" }
];

test("questions judge: 複数問を 1 リクエストで送り、choice / predicate を名前ごとに返す", async () => {
  const timers = makeTimers();
  const { fetchImpl, calls } = makeFetch({
    ok: true,
    status: 200,
    json: async () => ({
      answers: [
        { name: "verdict", choice: "ok", probabilities: [{ value: "ok", probability: 0.9 }, { value: "hijack", probability: 0.1 }] },
        { name: "hijack", probability: 0.03 }
      ]
    })
  });
  let clock = 0;
  const judge = createDecisionsQuestionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl,
    timeoutMs: 5000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    nowImpl: () => (clock += 150)
  });
  const r = await judge({ input: "こんばんは", questions: guardQuestions() });
  assert.deepEqual(r, {
    answers: {
      verdict: { type: "choice", choice: "ok", probs: { ok: 0.9, hijack: 0.1 } },
      hijack: { type: "predicate", probability: 0.03 }
    },
    latencyMs: 150
  });
  assert.equal(calls[0].url, DECISIONS_ENDPOINT);
  assert.equal(calls[0].body.model, "gpt-6-luna");
  assert.equal(calls[0].body.input, "こんばんは");
  assert.deepEqual(calls[0].body.questions.map((q) => [q.type, q.name]), [["choice", "verdict"], ["predicate", "hijack"]]);
  assert.equal(calls[0].body.questions[1].choices, undefined, "predicate に choices は付けない");
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(timers.pending(), 0);
});

test("questions judge: 判定拒否は失敗にせず { type: refusal }・読めない答えは載せない・answers 無しは失敗", async () => {
  const judge = createDecisionsQuestionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: makeFetch({
      ok: true,
      status: 200,
      json: async () => ({ answers: [{ name: "verdict", type: "refusal" }, { name: "hijack", probability: "high" }] })
    }).fetchImpl
  });
  assert.deepEqual((await judge({ input: "草", questions: guardQuestions() })).answers, { verdict: { type: "refusal" } });
  const outOfRange = createDecisionsQuestionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: makeFetch({ ok: true, status: 200, json: async () => ({ answers: [{ name: "verdict", choice: "spam" }] }) }).fetchImpl
  });
  assert.deepEqual((await outOfRange({ input: "x", questions: guardQuestions() })).answers, {}, "選択肢外の choice は載せない");
  const noAnswers = createDecisionsQuestionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: makeFetch({ ok: true, status: 200, json: async () => ({}) }).fetchImpl
  });
  await assert.rejects(noAnswers({ input: "x", questions: guardQuestions() }), (e) => e instanceof SpeakNowJudgeError && /想定外/.test(e.message));
});

test("questions judge: timeoutMs（コメント判定は 5 秒）で諦める・キーが無ければ通信しない・401 は文言を出さない", async () => {
  const timers = makeTimers();
  const judge = createDecisionsQuestionsJudge({
    apiKeyProvider: keyOk,
    timeoutMs: 5000,
    fetchImpl: /** @type {any} */ (() => new Promise(() => {})),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    nowImpl: timers.now
  });
  const p = judge({ input: "x", questions: guardQuestions() });
  await Promise.resolve();
  timers.advance(4999);
  let settled = false;
  p.catch(() => {}).finally(() => (settled = true));
  await new Promise((r) => setImmediate(r));
  assert.equal(settled, false);
  timers.advance(1);
  await assert.rejects(p, (e) => e instanceof SpeakNowJudgeError && /タイムアウト（5 秒）/.test(e.message) && e.latencyMs === 5000);

  const { fetchImpl, calls } = makeFetch({ ok: true, status: 200, json: async () => ({ answers: [] }) });
  const noKey = createDecisionsQuestionsJudge({ apiKeyProvider: () => loadDecisionsApiKey({ readFileImpl: () => "" }), fetchImpl });
  await assert.rejects(noKey({ input: "x", questions: guardQuestions() }), /キーが見つからない/);
  assert.equal(calls.length, 0);

  const j401 = createDecisionsQuestionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: makeFetch({ ok: false, status: 401, json: async () => ({ error: { message: "Incorrect API key provided: sk-te****" } }) }).fetchImpl
  });
  await assert.rejects(j401({ input: "x", questions: guardQuestions() }), (e) => e.message === "認証失敗（401）");
});

test("judge: HTTP エラーの種類（error.code）を末尾に残す（429 の credit_balance_exhausted は操縦席の残高切れの警告の材料）", async () => {
  const judge429 = createDecisionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: makeFetch({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Your credit balance is too low.", code: "credit_balance_exhausted" } })
    }).fetchImpl
  });
  await assert.rejects(judge429(request()), (e) => {
    assert.equal(e.message, "HTTP 429: Your credit balance is too low. [credit_balance_exhausted]");
    return true;
  });
  // 種類として不自然な文字列（空白や長すぎ）は付けない。
  const judgeOdd = createDecisionsJudge({
    apiKeyProvider: keyOk,
    fetchImpl: makeFetch({ ok: false, status: 400, json: async () => ({ error: { message: "bad", code: "not a code" } }) }).fetchImpl
  });
  await assert.rejects(judgeOdd(request()), (e) => e.message === "HTTP 400: bad");
});
