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
 * Decisions API で判定する judge を作る。
 * @param {object} [options]
 * @param {() => ({ ok: true; apiKey: string } | { ok: false; reason: string })} [options.apiKeyProvider]
 *   既定 loadDecisionsApiKey（判定のたびに読む）。
 * @param {typeof fetch} [options.fetchImpl]  既定 globalThis.fetch（テストは fake を注入）。
 * @param {number} [options.timeoutMs=DECISIONS_TIMEOUT_MS]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @param {() => number} [options.nowImpl]  遅延計測の時計（既定 performance.now）。
 * @param {string} [options.endpoint=DECISIONS_ENDPOINT]
 * @param {string} [options.model=DECISIONS_MODEL]
 * @returns {(request: JudgeRequest) => Promise<JudgeResult>}
 */
export function createDecisionsJudge(options = {}) {
  const apiKeyProvider = typeof options.apiKeyProvider === "function" ? options.apiKeyProvider : () => loadDecisionsApiKey();
  const fetchImpl = options.fetchImpl ?? ((/** @type {any} */ url, /** @type {any} */ init) => globalThis.fetch(url, init));
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : DECISIONS_TIMEOUT_MS;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const nowImpl = options.nowImpl ?? (() => performance.now());
  const endpoint = options.endpoint ?? DECISIONS_ENDPOINT;
  const model = options.model ?? DECISIONS_MODEL;
  const timeoutText = `タイムアウト（${Math.round(timeoutMs / 100) / 10} 秒）`;

  return async function judge(request) {
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
    const choices = request.choices.map((c) => ({ value: c.value, description: c.description }));
    const allowed = new Set(choices.map((c) => c.value));
    const body = JSON.stringify({
      model,
      input: request.input,
      questions: [
        { type: "choice", name: DECISIONS_QUESTION_NAME, instructions: request.instructions, choices }
      ]
    });

    const started = nowImpl();
    const elapsed = () => Math.round(nowImpl() - started);
    const controller = new AbortController();
    /** @type {any} */
    let timer = null;
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
      const answers = json && Array.isArray(json.answers) ? json.answers : [];
      const answer = answers.find((/** @type {any} */ a) => a && a.name === DECISIONS_QUESTION_NAME) ?? null;
      const choice = answer && typeof answer.choice === "string" ? answer.choice : null;
      if (choice == null || !allowed.has(choice)) {
        throw new SpeakNowJudgeError("応答の形が想定外（choice が読めない）", elapsed());
      }
      /** @type {Record<string, number>} */
      const probs = {};
      for (const p of Array.isArray(answer.probabilities) ? answer.probabilities : []) {
        if (p && typeof p.value === "string" && typeof p.probability === "number" && Number.isFinite(p.probability)) {
          probs[p.value] = p.probability;
        }
      }
      return { choice, probs, latencyMs: elapsed() };
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
