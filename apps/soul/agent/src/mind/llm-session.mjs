// @ts-check
/**
 * Agent SDK 統合 — 常駐 LLM セッション（S1 Domain C）— apps/soul/agent。
 *
 * `@anthropic-ai/claude-agent-sdk` の `query()` を**常駐ストリーミング入力モード**で使う。魂の脳。
 *
 * ── なぜ常駐（1 プロセス）か ─────────────────────────────────────────────
 *  `query()` を毎回呼ぶと 1 回あたり ≈12 秒のサブプロセス（Claude Code バイナリ）起動が乗る
 *  （公式 Issue #34・s1-planning-inventory §4）。会話の一文ごとに 12 秒は許容外。公式推奨は
 *  **prompt に AsyncIterable<SDKUserMessage> を渡す常駐ストリーミング入力モード**で、1 つの query()
 *  が 1 プロセスを保持し、ユーザーメッセージを順に流し込む。初回 ask で 1 度だけ spawn コストを払い、
 *  以降の ask は温まったプロセスで往復する。
 *
 * ── 出力の汲み出しは手動 next()（for-await-break を使わない・重要）──────────────
 *  `query()` は AsyncGenerator。`for await ... of query` で `break` すると iterator の `.return()` が
 *  呼ばれ**セッションごと終了**してしまう（次の ask が使えなくなる）。よって出力は手動
 *  `await q.next()` で 1 メッセージずつ汲み出し、当該 ask の `result` メッセージが来たらループを抜ける
 *  （generator は生かしたまま）。次の ask は同じ generator から続きを汲む。
 *
 * ── オプション（wave 計画 §3 Domain C）─────────────────────────────────
 *  settingSources: []（明示・CLAUDE.md 等を読ませない）/ systemPrompt=会話用最小文（設定可能）/
 *  model="claude-opus-4-8" / persistSession: false / maxTurns: 1（自律多段ループ無効）/ tools: []
 *  （全ツール無効の意図・動作確認は first-light スクリプトで）/ includePartialMessages: true
 *  （stream_event の text_delta で TTFT 計測 + ストリーミング受信を配線）。
 *  S1 は文分割不要＝応答全文で 1 回の TTS でよい（文分割は S4 以降）。
 *
 * ── API ─────────────────────────────────────────────────────────────
 *  createLlmSession(options) → { ask(text) => Promise<{ replyText, usage, ttftMs, elapsedMs }>,
 *    dispose(), getInit() }。ask は 1 発話（一文入力 → 応答全文）。dispose で常駐プロセスを畳む。
 */

import { performance } from "node:perf_hooks";
import { query as defaultQuery } from "@anthropic-ai/claude-agent-sdk";
import { assertSubscriptionAuthEnv } from "./env-guard.mjs";

/** 会話相手としての最小 systemPrompt（短い日本語・一文即答）。設定で差し替え可能。 */
export const DEFAULT_SYSTEM_PROMPT =
  "あなたは配信の共演者です。視聴者やホストの一言に、短い日本語の話し言葉で、" +
  "一文だけ親しみやすく即答してください。箇条書き・記号・長い説明はしないでください。";

/** 既定モデル（wave 計画 §3 Domain C）。 */
export const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * 押し込み型の非同期入力ストリーム。ask() が push、dispose() が close する。query() へ
 * prompt: AsyncIterable<SDKUserMessage> として渡す。next 待ち中に push が来たら即解決する。
 * @returns {{
 *   push: (message: unknown) => void;
 *   close: () => void;
 *   [Symbol.asyncIterator]: () => AsyncGenerator<any, void, unknown>;
 * }}
 */
function createInputStream() {
  /** @type {unknown[]} */
  const queue = [];
  /** @type {((r: { value: unknown; done: boolean }) => void) | null} */
  let resolveNext = null;
  let closed = false;

  return {
    push(message) {
      if (closed) {
        throw new Error("llm-session input stream is closed.");
      }
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: message, done: false });
      } else {
        queue.push(message);
      }
    },
    close() {
      closed = true;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: undefined, done: true });
      }
    },
    async *[Symbol.asyncIterator]() {
      for (;;) {
        if (queue.length > 0) {
          yield queue.shift();
          continue;
        }
        if (closed) {
          return;
        }
        const result = await new Promise((resolve) => {
          resolveNext = resolve;
        });
        if (result.done) {
          return;
        }
        yield result.value;
      }
    }
  };
}

/**
 * stream_event の中身が「最初のテキストトークン（text_delta）」か判定する（TTFT 検出用）。
 * @param {any} event  BetaRawMessageStreamEvent。
 * @returns {boolean}
 */
function isTextDeltaEvent(event) {
  return (
    event != null &&
    event.type === "content_block_delta" &&
    event.delta != null &&
    event.delta.type === "text_delta"
  );
}

/**
 * assistant メッセージの content 配列から text ブロックを連結する。
 * @param {any} assistantMessage  SDKAssistantMessage。
 * @returns {string}
 */
function extractAssistantText(assistantMessage) {
  const content = assistantMessage?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  let text = "";
  for (const block of content) {
    if (block && block.type === "text" && typeof block.text === "string") {
      text += block.text;
    }
  }
  return text;
}

/**
 * 常駐 LLM セッションを起動する。
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env]  ガード検査対象（既定 process.env）。
 * @param {string} [options.systemPrompt]  会話用 systemPrompt（既定 DEFAULT_SYSTEM_PROMPT）。
 * @param {string} [options.model]  モデル ID（既定 claude-opus-4-8）。
 * @param {number} [options.maxTurns]  最大ターン（既定 1）。
 * @param {typeof defaultQuery} [options.queryImpl]  query() 差し替え注入点（テスト用・既定 SDK query）。
 * @param {boolean} [options.skipEnvGuard]  env ガードを飛ばす（テストで queryImpl 注入時のみ）。
 * @param {(init: any) => void} [options.onInit]  system/init メッセージ観測（tools[]/apiKeySource 記録用）。
 * @param {(warning: string) => void} [options.onWarning]  env ガードの warning（BASE_URL 非既定等）。
 * @returns {{
 *   ask: (text: string) => Promise<{ replyText: string; usage: any; ttftMs: number | null; elapsedMs: number }>;
 *   dispose: () => Promise<void>;
 *   getInit: () => any;
 * }}
 */
export function createLlmSession(options = {}) {
  const {
    env = process.env,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = DEFAULT_MODEL,
    maxTurns = 1,
    queryImpl = defaultQuery,
    skipEnvGuard = false,
    onInit,
    onWarning
  } = options;

  if (!skipEnvGuard) {
    const { warnings } = assertSubscriptionAuthEnv(env);
    if (onWarning) {
      for (const warning of warnings) {
        onWarning(warning);
      }
    }
  }

  const input = createInputStream();
  const abortController = new AbortController();

  const q = queryImpl({
    prompt: input,
    options: {
      systemPrompt,
      model,
      settingSources: [], // CLAUDE.md 等を読ませない（SDK 隔離モード）。明示必須。
      persistSession: false, // セッションを ~/.claude に残さない。
      maxTurns, // 自律多段ループを避ける（一文入力 → 一応答）。
      tools: [], // 全ツール無効の意図（動作確認は first-light スクリプト）。
      includePartialMessages: true, // stream_event（text_delta）で TTFT + ストリーミング受信配線。
      abortController // dispose で abort し常駐サブプロセスを確実に畳む。
    }
  });

  /** @type {any} */
  let initMessage = null;
  let disposed = false;

  return {
    /**
     * 一文を投げ、応答全文を得る。usage・TTFT・往復所要も返す。
     * @param {string} text
     * @returns {Promise<{ replyText: string; usage: any; ttftMs: number | null; elapsedMs: number }>}
     */
    async ask(text) {
      if (typeof text !== "string" || text.length === 0) {
        throw new TypeError("ask(text): text must be a non-empty string.");
      }
      if (disposed) {
        throw new Error("llm-session already disposed.");
      }

      const askStart = performance.now();
      input.push({
        type: "user",
        message: { role: "user", content: text },
        parent_tool_use_id: null
      });

      let replyText = "";
      /** @type {any} */
      let usage = null;
      /** @type {number | null} */
      let ttftMs = null;
      /** @type {number | null} */
      let resultTtftMs = null;

      for (;;) {
        const { value: message, done } = await q.next();
        if (done) {
          throw new Error(
            "llm-session ended before a result was produced (query generator finished). " +
              "残留する常駐性が maxTurns で切れた可能性（domain-c.md 参照）。"
          );
        }
        if (message == null) {
          continue;
        }
        if (message.type === "system" && message.subtype === "init") {
          initMessage = message;
          if (onInit) {
            onInit(message);
          }
          continue;
        }
        if (message.type === "stream_event") {
          if (ttftMs === null && isTextDeltaEvent(message.event)) {
            ttftMs = performance.now() - askStart;
          }
          continue;
        }
        if (message.type === "assistant") {
          replyText += extractAssistantText(message);
          continue;
        }
        if (message.type === "result") {
          usage = message.usage ?? null;
          if (typeof message.ttft_ms === "number") {
            resultTtftMs = message.ttft_ms;
          }
          // assistant テキストが取れていなければ result.result を採用。
          if (replyText.length === 0 && typeof message.result === "string") {
            replyText = message.result;
          }
          break;
        }
        // その他のシステムメッセージ（status 等）は無視して次を汲む。
      }

      const elapsedMs = performance.now() - askStart;
      return {
        replyText,
        usage,
        // 実測 TTFT（text_delta 到達）を優先。取れなければ result の ttft_ms を代替。
        ttftMs: ttftMs ?? resultTtftMs,
        elapsedMs
      };
    },

    /** 直近の system/init メッセージ（tools[]・apiKeySource・model 等の観測用）。 */
    getInit() {
      return initMessage;
    },

    /** 常駐プロセスを畳む（入力 close → generator return → abort）。event loop に残さない。 */
    async dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      input.close();
      try {
        await q.return(undefined);
      } catch {
        // best-effort（既に終了していても構わない）。
      }
      abortController.abort();
    }
  };
}
