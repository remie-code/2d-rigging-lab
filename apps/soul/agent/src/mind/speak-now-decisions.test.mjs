// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createDecisionsJudge,
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
  assert.deepEqual(calls[0].body.questions[0].choices.map((c) => c.value), ["wait", "backchannel", "respond", "initiate"]);
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
