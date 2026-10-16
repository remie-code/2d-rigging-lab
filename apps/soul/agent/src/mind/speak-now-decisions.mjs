// @ts-check
/**
 * speak-now の判定エンジン（OpenAI Decisions API 実装）— apps/soul/agent。
 *
 * speak-now（discussion/ai-cohost/decisions/speak-now/integration.md §1）の判定を
 * `judge({ input, instructions, choices }) → Promise<{ choice, probs, latencyMs }>` の形で返す。
 * 判定エンジンはこの形 1 つに閉じる（Decisions API 以外がデファクトになっても、この関数を差し替える
 * だけで speak-now 部品・結線層は作り替えずに済む）。叩き方は scripts/probe-decisions-speak-now.mjs の
 * `judge` から移した（`POST /v1/decisions`・`gpt-6-luna`・choice 1 問 `reaction`）。
 *
 * ── キー（合意 §5）────────────────────────────────────────────────────────
 *  `apps/soul/agent/.env.decisions.local` の `OPENAI_DECISIONS_API_KEY` を loadDecisionsApiKey で
 *  コード内で直接読む（ElevenLabs の loadElevenLabsApiKey と同じやり方・process.env に入れない）。
 *  判定のたびに読む（操縦席を開いたままキーを置いても次の判定から効く）。キーは Authorization ヘッダに
 *  載せるだけで、戻り値・エラー文言・ログには載せない（サーバのエラー文言にキー値が混ざっても伏せる）。
 *
 * ── タイムアウト（合意 §5）────────────────────────────────────────────────
 *  3 秒（DECISIONS_TIMEOUT_MS）。超えたら fetch を abort し、判定失敗（SpeakNowJudgeError）にする。
 *  fetch が abort を無視しても、注入タイマとの race で必ず 3 秒で諦める。fetch・タイマ・時計は全部
 *  注入可能（テストは実 API に繋がない）。
 *
 * ── コメント判定（discussion/ai-cohost/decisions/comment-react/integration.md）──────────────
 *  叩き方の共通部分（キー読み・POST・タイムアウト・HTTP エラー・キー値の伏せ）を createDecisionsTransport に
 *  切り出し、speak-now の createDecisionsJudge（choice 1 問・判定拒否は失敗）とコメント判定の
 *  createDecisionsQuestionsJudge（choice + predicate の複数問・判定拒否を区別して返す）が共有する。
 *  createDecisionsJudge の挙動は切り出し前と同じ。タイムアウトは timeoutMs で呼び出し側が決める
 *  （コメント判定は 5 秒・comment-guard.mjs）。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));

/** Decisions API のエンドポイント（probe と同じ）。 */
export const DECISIONS_ENDPOINT = "https://api.openai.com/v1/decisions";
/** 判定モデル（合意 §1）。 */
export const DECISIONS_MODEL = "gpt-6-luna";
/** 判定のタイムアウト（合意 §5）。 */
export const DECISIONS_TIMEOUT_MS = 3000;
/** choice 問の名前（probe と同じ）。 */
export const DECISIONS_QUESTION_NAME = "reaction";
/** キーの変数名。 */
export const OPENAI_DECISIONS_API_KEY_NAME = "OPENAI_DECISIONS_API_KEY";
/** キーのファイル（apps/soul/agent/.env.decisions.local・gitignore 済み）。 */
export const DEFAULT_DECISIONS_ENV_PATH = join(here, "..", "..", ".env.decisions.local");

/** 判定の失敗（表示用の短い理由 + 分かれば遅延）。message にキー値は含めない。 */
export class SpeakNowJudgeError extends Error {
  /**
   * @param {string} message  表示用の理由（フィード・ターミナルにそのまま出せる文言）。
   * @param {number | null} [latencyMs]
   */
  constructor(message, latencyMs = null) {
    super(message);
    this.name = "SpeakNowJudgeError";
    /** @type {number | null} */
    this.latencyMs = latencyMs;
  }
}

/**
 * `.env.decisions.local` から OPENAI_DECISIONS_API_KEY を読む（process.env には入れない）。
 * 失敗理由はフィードにそのまま出せる文言（キーの値は含めない）。
 * @param {object} [options]
 * @param {string} [options.path=DEFAULT_DECISIONS_ENV_PATH]
 * @param {(path: string) => string} [options.readFileImpl]  テスト注入（既定 readFileSync utf8）。
 * @returns {{ ok: true; apiKey: string } | { ok: false; reason: string }}
 */
export function loadDecisionsApiKey(options = {}) {
  const filePath = options.path ?? DEFAULT_DECISIONS_ENV_PATH;
  const readFileImpl = options.readFileImpl ?? ((/** @type {string} */ p) => readFileSync(p, "utf8"));
  const missing = {
    ok: /** @type {const} */ (false),
    reason: `Decisions API のキーが見つからない（apps/soul/agent/.env.decisions.local の ${OPENAI_DECISIONS_API_KEY_NAME}）`
  };
  let text;
  try {
    text = readFileImpl(filePath);
  } catch {
    return missing;
  }
  let parsed;
  try {
    parsed = parseEnv(String(text));
  } catch {
    return missing;
  }
  const value = parsed[OPENAI_DECISIONS_API_KEY_NAME];
  if (typeof value !== "string" || value.trim().length === 0) return missing;
  return { ok: true, apiKey: value.trim() };
}

/** @param {unknown} err */
function errText(err) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 表示用文言からキー値を伏せる（サーバのエラー文言にキーの一部が混ざる場合への保険）。
 * @param {string} text @param {string} apiKey
 */
function redactKey(text, apiKey) {
  let out = String(text);
  if (apiKey.length > 0) out = out.split(apiKey).join("<redacted>");
  // OpenAI 系のキー断片（sk-...）も伏せる。
  return out.replace(/sk-[A-Za-z0-9_*\-]{4,}/g, "<redacted>");
}

/**
 * @typedef {{ value: string; description: string }} SpeakNowChoice
 * @typedef {{ input: string; instructions: string; choices: ReadonlyArray<SpeakNowChoice> }} JudgeRequest
 * @typedef {{ choice: string; probs: Record<string, number>; latencyMs: number }} JudgeResult
 */

/**
 * @typedef {object} DecisionsTransportOptions
 * @property {() => ({ ok: true; apiKey: string } | { ok: false; reason: string })} [apiKeyProvider]
 *   既定 loadDecisionsApiKey（判定のたびに読む）。
 * @property {typeof fetch} [fetchImpl]  既定 globalThis.fetch（テストは fake を注入）。
 * @property {number} [timeoutMs=DECISIONS_TIMEOUT_MS]
 * @property {typeof setTimeout} [setTimeoutImpl]
 * @property {typeof clearTimeout} [clearTimeoutImpl]
 * @property {() => number} [nowImpl]  遅延計測の時計（既定 performance.now）。
 * @property {string} [endpoint=DECISIONS_ENDPOINT]
 * @property {string} [model=DECISIONS_MODEL]
 */

/**
 * Decisions API を 1 回叩く共通部分（キー読み・POST・タイムアウト・HTTP エラー・キー値の伏せ）。
 * 応答 JSON の読み取りは parse に任せる（parse の throw もタイムアウトと同じ race の中で扱う）。
 * speak-now の choice 1 問（createDecisionsJudge）とコメント判定の複数問（createDecisionsQuestionsJudge）
 * が共有する（コメント判定の合意 discussion/ai-cohost/decisions/comment-react/integration.md で切り出した）。
 * @param {DecisionsTransportOptions} [options]
 */
function createDecisionsTransport(options = {}) {
  const apiKeyProvider = typeof options.apiKeyProvider === "function" ? options.apiKeyProvider : () => loadDecisionsApiKey();
  const fetchImpl = options.fetchImpl ?? ((/** @type {any} */ url, /** @type {any} */ init) => globalThis.fetch(url, init));
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : DECISIONS_TIMEOUT_MS;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const nowImpl = options.nowImpl ?? (() => performance.now());
  const endpoint = options.endpoint ?? DECISIONS_ENDPOINT;
  const model = options.model ?? DECISIONS_MODEL;
  const timeoutText = `タイムアウト（${Math.round(timeoutMs / 100) / 10} 秒）`;

  /**
   * @template T
   * @param {string} input
   * @param {ReadonlyArray<object>} questions
   * @param {(json: any, elapsed: () => number) => T} parse
   * @returns {Promise<T>}
   */
  return async function send(input, questions, parse) {
    /** @type {{ ok: boolean; apiKey?: string; reason?: string }} */
    let key;
    try {
      key = apiKeyProvider();
    } catch {
      key = { ok: false };
    }
    if (!key || !key.ok || typeof key.apiKey !== "string" || key.apiKey.length === 0) {
      throw new SpeakNowJudgeError((key && key.reason) || "Decisions API のキーが見つからない");
    }
    const apiKey = key.apiKey;
    const body = JSON.stringify({ model, input, questions });

    const started = nowImpl();
    const elapsed = () => Math.round(nowImpl() - started);
    const controller = new AbortController();
    /** @type {any} */
    let timer = null;
    /** @type {Promise<never>} */
    const timeout = new Promise((_, reject) => {
      timer = setTimeoutImpl(() => {
        controller.abort();
        reject(new SpeakNowJudgeError(timeoutText, elapsed()));
      }, timeoutMs);
    });

    const work = (async () => {
      /** @type {any} */
      let res;
      try {
        res = await fetchImpl(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body,
          signal: controller.signal
        });
      } catch (error) {
        throw new SpeakNowJudgeError(redactKey(`通信失敗: ${errText(error)}`, apiKey), elapsed());
      }
      /** @type {any} */
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok) {
        const status = Number(res.status) || 0;
        // 401/403 はサーバ文言にキー断片が入りうるので出さない。
        if (status === 401 || status === 403) {
          throw new SpeakNowJudgeError(`認証失敗（${status}）`, elapsed());
        }
        const detail = json && json.error && typeof json.error.message === "string" ? json.error.message.slice(0, 200) : "no detail";
        throw new SpeakNowJudgeError(redactKey(`HTTP ${status}: ${detail}`, apiKey), elapsed());
      }
      return parse(json, elapsed);
    })();

    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeoutImpl(timer);
      // race に負けた側の rejection を未処理にしない。
      work.catch(() => {});
      timeout.catch(() => {});
    }
  };
}

/** @param {any} answer @returns {Record<string, number>} */
function readProbabilities(answer) {
  /** @type {Record<string, number>} */
  const probs = {};
  for (const p of Array.isArray(answer && answer.probabilities) ? answer.probabilities : []) {
    if (p && typeof p.value === "string" && typeof p.probability === "number" && Number.isFinite(p.probability)) {
      probs[p.value] = p.probability;
    }
  }
  return probs;
}

/**
 * Decisions API で判定する judge を作る（choice 1 問・判定拒否は失敗扱い）。
 * @param {DecisionsTransportOptions} [options]
 * @returns {(request: JudgeRequest) => Promise<JudgeResult>}
 */
export function createDecisionsJudge(options = {}) {
  const send = createDecisionsTransport(options);
  return async function judge(request) {
    const choices = request.choices.map((c) => ({ value: c.value, description: c.description }));
    const allowed = new Set(choices.map((c) => c.value));
    const questions = [{ type: "choice", name: DECISIONS_QUESTION_NAME, instructions: request.instructions, choices }];
    return send(request.input, questions, (json, elapsed) => {
      const answers = json && Array.isArray(json.answers) ? json.answers : [];
      const answer = answers.find((/** @type {any} */ a) => a && a.name === DECISIONS_QUESTION_NAME) ?? null;
      const choice = answer && typeof answer.choice === "string" ? answer.choice : null;
      if (choice == null || !allowed.has(choice)) {
        throw new SpeakNowJudgeError("応答の形が想定外（choice が読めない）", elapsed());
      }
      return { choice, probs: readProbabilities(answer), latencyMs: elapsed() };
    });
  };
}

/**
 * @typedef {{ type: "choice"; name: string; instructions: string; choices: ReadonlyArray<SpeakNowChoice> } |
 *   { type: "predicate"; name: string; instructions: string }} DecisionsQuestion
 * @typedef {{ type: "choice"; choice: string; probs: Record<string, number> } |
 *   { type: "predicate"; probability: number } |
 *   { type: "refusal" }} DecisionsAnswer
 * @typedef {{ answers: Record<string, DecisionsAnswer>; latencyMs: number }} DecisionsQuestionsResult
 */

/**
 * 複数問（choice / predicate）を 1 リクエストで聞く judge を作る（コメント判定用）。
 * createDecisionsJudge と違い、判定拒否（`type: "refusal"`）を失敗にせず `{ type: "refusal" }` として
 * 区別して返す（コメント判定の合意: 4 択が拒否なら predicate だけで決める）。読めない答え（choice が
 * 選択肢外・probability が数でない等）は answers に載せない（どう扱うかは呼び出し側が決める）。
 * answers 配列そのものが無い応答は失敗（SpeakNowJudgeError）。
 * @param {DecisionsTransportOptions} [options]
 * @returns {(request: { input: string; questions: ReadonlyArray<DecisionsQuestion> }) => Promise<DecisionsQuestionsResult>}
 */
export function createDecisionsQuestionsJudge(options = {}) {
  const send = createDecisionsTransport(options);
  return async function judgeQuestions(request) {
    const questions = request.questions.map((q) =>
      q.type === "choice"
        ? {
            type: "choice",
            name: q.name,
            instructions: q.instructions,
            choices: q.choices.map((c) => ({ value: c.value, description: c.description }))
          }
        : { type: "predicate", name: q.name, instructions: q.instructions }
    );
    return send(request.input, questions, (json, elapsed) => {
      if (!json || !Array.isArray(json.answers)) {
        throw new SpeakNowJudgeError("応答の形が想定外（answers が無い）", elapsed());
      }
      /** @type {Record<string, DecisionsAnswer>} */
      const answers = {};
      for (const q of questions) {
        const a = json.answers.find((/** @type {any} */ x) => x && x.name === q.name);
        if (!a) continue;
        if (a.type === "refusal") {
          answers[q.name] = { type: "refusal" };
        } else if (q.type === "choice") {
          const allowed = new Set(/** @type {any} */ (q).choices.map((/** @type {any} */ c) => c.value));
          if (typeof a.choice === "string" && allowed.has(a.choice)) {
            answers[q.name] = { type: "choice", choice: a.choice, probs: readProbabilities(a) };
          }
        } else if (typeof a.probability === "number" && Number.isFinite(a.probability)) {
          answers[q.name] = { type: "predicate", probability: a.probability };
        }
      }
      return { answers, latencyMs: elapsed() };
    });
  };
}
