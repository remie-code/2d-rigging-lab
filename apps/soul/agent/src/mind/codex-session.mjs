// @ts-check
/**
 * Codex App Server backed MindSession.
 *
 * One session owns one persistent stdio JSONL connection and one App Server
 * thread. Ordinary asks append one turn each to that thread. Transport loss
 * replaces the process; a safely-correlated turn failure abandons only its
 * thread so the following ask can recover on the same connection with a fresh
 * thread and the session prompt injected again.
 *
 * ── 長い配信の文脈（context-growth-2026-10.md §5・§6）──────────────────────────────
 *  - ask の戻りに `tokenUsage`（last / total / modelContextWindow・数値だけ）を additive に載せる。
 *  - `conversationKey()` は今の thread（次の ask が新しい thread なら null）。発火側が「会話の世代」の
 *    変わり目を知る口。
 *  - `compact()` は `thread/compact/start` で手動圧縮し、圧縮の turn（ask の外の turn / item 通知）の完了を
 *    待ってから、最初の turn と同じ人格の指示を `thread/inject_items` で 1 回だけ差し込み直す。圧縮の処理中に
 *    来た ask は終わるまで待ち、`compactionWaitMs`（既定 60 秒）を超えたら待つのをやめて turn を始める。
 *    Codex の自動圧縮の設定は使わない。
 */

import { spawn as defaultSpawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
import { assertSubscriptionAuthEnvOpenAI } from "./env-guard.mjs";
import { DEFAULT_SYSTEM_PROMPT } from "./llm-session.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DEFAULT_LEDGER_PATH = path.join(__dirname, "..", "..", "codex-rollouts.local.json");
const ROLLOUT_FILENAME_RE = /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.jsonl$/;

export const DEFAULT_MODEL = "gpt-5.6-terra";
export const DEFAULT_EFFORT = "none";

const TARGET_BY_PLATFORM = Object.freeze({
  "linux:x64": ["@openai/codex-linux-x64", "x86_64-unknown-linux-musl", "codex"],
  "linux:arm64": ["@openai/codex-linux-arm64", "aarch64-unknown-linux-musl", "codex"],
  "darwin:x64": ["@openai/codex-darwin-x64", "x86_64-apple-darwin", "codex"],
  "darwin:arm64": ["@openai/codex-darwin-arm64", "aarch64-apple-darwin", "codex"],
  "win32:x64": ["@openai/codex-win32-x64", "x86_64-pc-windows-msvc", "codex.exe"],
  "win32:arm64": ["@openai/codex-win32-arm64", "aarch64-pc-windows-msvc", "codex.exe"]
});

function resolveBundledCodexPath() {
  const target = TARGET_BY_PLATFORM[`${process.platform}:${process.arch}`];
  if (!target) throw new Error(`codex-session: unsupported platform ${process.platform}/${process.arch}.`);
  const [packageName, triple, executable] = target;
  let packageJsonPath;
  try {
    packageJsonPath = require.resolve(`${packageName}/package.json`);
  } catch (error) {
    throw new Error(`codex-session: bundled Codex executable is unavailable (${packageName}).`, { cause: error });
  }
  return path.join(path.dirname(packageJsonPath), "vendor", triple, "bin", executable);
}

function mediaTypeToExt(mediaType) {
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/webp") return "webp";
  return "jpg";
}

function extractThreadIdFromRolloutFilename(fileName) {
  const match = ROLLOUT_FILENAME_RE.exec(fileName);
  return match ? match[1] : null;
}

function deleteRolloutForThreadId(homeDir, threadId) {
  const sessionsDir = path.join(homeDir, ".codex", "sessions");
  let deleted = false;
  const walk = (dir) => {
    if (deleted) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (deleted) return;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(entryPath);
      else if (extractThreadIdFromRolloutFilename(entry.name) === threadId) {
        try {
          unlinkSync(entryPath);
          deleted = true;
        } catch {
          // Best effort. Never widen cleanup beyond the exact owned id.
        }
      }
    }
  };
  walk(sessionsDir);
  return deleted;
}

function readLedger(ledgerPath) {
  try {
    const parsed = JSON.parse(readFileSync(ledgerPath, "utf8"));
    return Array.isArray(parsed?.threadIds) ? parsed.threadIds.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeLedger(ledgerPath, threadIds) {
  try {
    mkdirSync(path.dirname(ledgerPath), { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({ threadIds }, null, 2), "utf8");
  } catch {
    // Cleanup bookkeeping is best effort and must not stop a session.
  }
}

function sweepLedger(homeDir, ledgerPath) {
  for (const id of readLedger(ledgerPath)) deleteRolloutForThreadId(homeDir, id);
  writeLedger(ledgerPath, []);
}

function appendLedger(ledgerPath, threadId) {
  const ids = readLedger(ledgerPath);
  if (!ids.includes(threadId)) {
    ids.push(threadId);
    writeLedger(ledgerPath, ids);
  }
}

function removeFromLedger(ledgerPath, ownedThreadIds) {
  const ids = readLedger(ledgerPath);
  writeLedger(ledgerPath, ids.filter((id) => !ownedThreadIds.includes(id)));
}

/** Snapshot caller-owned input and create local-image files before the first await. */
function snapshotInput(content, workingDirectory) {
  const tempFiles = [];
  if (typeof content === "string") {
    if (content.length === 0) throw new TypeError("ask(content): content must be non-empty.");
    return { input: [{ type: "text", text: content }], tempFiles };
  }
  if (!Array.isArray(content) || content.length === 0) {
    throw new TypeError("ask(content): content must be a non-empty string or a non-empty content block array.");
  }
  const input = [];
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") {
      input.push({ type: "text", text: `${block.text}` });
    } else if (block?.type === "image" && block.source?.type === "base64" && typeof block.source.data === "string") {
      const filePath = path.join(workingDirectory, `image-${randomUUID()}.${mediaTypeToExt(block.source.media_type)}`);
      writeFileSync(filePath, Buffer.from(`${block.source.data}`, "base64"));
      tempFiles.push(filePath);
      input.push({ type: "localImage", path: filePath });
    }
  }
  if (input.length === 0) throw new TypeError("ask(content): no supported text or image content blocks.");
  return { input, tempFiles };
}

/** Preserve image-first order by merging the prompt into the first text item. */
function withSystemPrompt(input, systemPrompt) {
  const copied = input.map((item) => ({ ...item }));
  const textIndex = copied.findIndex((item) => item.type === "text");
  if (textIndex >= 0) copied[textIndex].text = `${systemPrompt}\n\n${copied[textIndex].text}`;
  else copied.push({ type: "text", text: systemPrompt });
  return copied;
}

function normalizeUsage(tokenUsage) {
  const last = tokenUsage?.last;
  if (!last || typeof last !== "object") return null;
  return {
    input_tokens: last.inputTokens ?? 0,
    cached_input_tokens: last.cachedInputTokens ?? 0,
    output_tokens: last.outputTokens ?? 0,
    reasoning_output_tokens: last.reasoningOutputTokens ?? 0,
    total_tokens: last.totalTokens ?? 0
  };
}

/** @param {unknown} value */
function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** TokenUsageBreakdown（App Server の camelCase）を数値だけの形に写す。形が違えば null。 */
function normalizeBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  return {
    inputTokens: finiteOrNull(breakdown.inputTokens),
    cachedInputTokens: finiteOrNull(breakdown.cachedInputTokens),
    outputTokens: finiteOrNull(breakdown.outputTokens),
    reasoningOutputTokens: finiteOrNull(breakdown.reasoningOutputTokens),
    totalTokens: finiteOrNull(breakdown.totalTokens)
  };
}

/**
 * `thread/tokenUsage/updated` の tokenUsage（ThreadTokenUsage = { total, last, modelContextWindow }）を
 * そのまま数値だけで残す（context-growth-2026-10.md §1: 以前は last だけ取り total と modelContextWindow を
 * 捨てていた）。既存の `usage`（last の snake_case 写し）はそのまま残し、これは additive な別フィールド。
 * @returns {{ last: ReturnType<typeof normalizeBreakdown>; total: ReturnType<typeof normalizeBreakdown>; modelContextWindow: number | null } | null}
 */
function normalizeTokenUsage(tokenUsage) {
  if (!tokenUsage || typeof tokenUsage !== "object") return null;
  return {
    last: normalizeBreakdown(tokenUsage.last),
    total: normalizeBreakdown(tokenUsage.total),
    modelContextWindow: finiteOrNull(tokenUsage.modelContextWindow)
  };
}

/**
 * 圧縮の直後に 1 回だけ差し込み直す人格の指示（`thread/inject_items` の Responses API item）。
 * 最初の turn で user メッセージの先頭に連結している systemPrompt と同じ中身を、同じ user の
 * input_text として足す（ResponseItem の "message" 形・型は `codex app-server generate-ts` で確認）。
 * @param {string} text
 */
function personaInjectItem(text) {
  return { type: "message", role: "user", content: [{ type: "input_text", text }] };
}

function protocolError(message) {
  return new Error(`codex-session: malformed App Server message — ${message}`);
}

function turnError(message) {
  return new Error(`codex-session: turn failed — ${message}`);
}

class AppServerConnection {
  constructor(options) {
    this.spawnImpl = options.spawnImpl;
    this.command = options.command;
    this.args = options.args;
    this.spawnOptions = options.spawnOptions;
    this.rpcTimeoutMs = options.rpcTimeoutMs;
    this.shutdownTimeoutMs = options.shutdownTimeoutMs;
    this.onNotification = options.onNotification;
    this.onFatal = options.onFatal;
    this.onDiagnostic = options.onDiagnostic;
    this.child = null;
    this.nextRequestId = 1;
    this.pending = new Map();
    this.decoder = new StringDecoder("utf8");
    this.buffer = "";
    this.closed = false;
    this.closing = false;
    this.exited = false;
    this.exitPromise = Promise.resolve();
    this.closePromise = null;
    this.initialized = false;
    this.fatalError = null;
  }

  async start() {
    if (!this.child) {
      let child;
      try {
        child = this.spawnImpl(this.command, this.args, this.spawnOptions);
      } catch (error) {
        throw new Error("codex-session: failed to start App Server process.", { cause: error });
      }
      if (!child?.stdin || !child?.stdout || typeof child.stdin.write !== "function") {
        throw new Error("codex-session: App Server process is missing piped stdio.");
      }
      this.child = child;
      this.exitPromise = new Promise((resolve) => {
        child.once("exit", (code, signal) => {
          this.exited = true;
          resolve();
          if (!this.closing) this.fail(new Error(`codex-session: App Server process exited (${code ?? "null"}/${signal ?? "none"}).`));
        });
      });
      child.once("error", (error) => {
        if (!this.closing) this.fail(new Error("codex-session: App Server process error.", { cause: error }));
      });
      child.stdout.on("data", (chunk) => this.acceptChunk(chunk));
      child.stdin.once?.("error", (error) => {
        if (!this.closing) this.fail(new Error("codex-session: App Server stdin error.", { cause: error }));
      });
      child.stderr?.on?.("data", () => {
        // Drain stderr to prevent child backpressure. Response/prompt content is never retained.
      });
      child.stdout.once("error", (error) => {
        if (!this.closing) this.fail(new Error("codex-session: App Server stdout error.", { cause: error }));
      });
      child.stdout.once("end", () => {
        const tail = this.decoder.end();
        if (tail) this.buffer += tail;
        if (!this.closing) {
          this.fail(
            this.buffer.trim().length > 0
              ? protocolError("truncated JSONL at stdout end")
              : new Error("codex-session: App Server stdout ended unexpectedly.")
          );
        }
      });
    }
    if (this.initialized) return;
    await this.request("initialize", {
      clientInfo: { name: "ai-native-live2d-editor-soul", title: "AI Cohost Soul", version: "1" },
      capabilities: { experimentalApi: false }
    });
    this.notify("initialized");
    this.initialized = true;
  }

  acceptChunk(chunk) {
    if (this.closed) return;
    this.buffer += this.decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (line.trim().length === 0) continue;
      try {
        this.acceptLine(line);
      } catch (error) {
        this.fail(error instanceof Error ? error : protocolError("unknown parse error"));
        return;
      }
    }
  }

  acceptLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      throw protocolError(`invalid JSON (${error instanceof Error ? error.message : "parse error"})`);
    }
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      this.diagnose("non-object JSONL record");
      return;
    }
    if (Object.hasOwn(message, "id") && !Object.hasOwn(message, "method")) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        this.diagnose(`unknown response id ${String(message.id)}`);
        return;
      }
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        const detail = typeof message.error.message === "string" ? message.error.message : "RPC error";
        pending.reject(new Error(`codex-session: App Server RPC failed — ${detail}`));
      } else if (Object.hasOwn(message, "result")) pending.resolve(message.result);
      else pending.reject(protocolError("response has neither result nor error"));
      return;
    }
    if (Object.hasOwn(message, "id") && typeof message.method === "string") {
      this.write({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Client does not support server requests." } });
      return;
    }
    if (typeof message.method !== "string" || Object.hasOwn(message, "id")) {
      const pending = Object.hasOwn(message, "id") ? this.pending.get(message.id) : null;
      if (pending) {
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        pending.reject(protocolError("response has an invalid method field"));
      } else {
        this.diagnose("uncorrelated object without a usable method");
      }
      return;
    }
    this.onNotification(message);
  }

  diagnose(detail) {
    try { this.onDiagnostic?.(detail); } catch {}
  }

  request(method, params, timeoutMs = this.rpcTimeoutMs) {
    if (this.closed || this.closing) return Promise.reject(new Error("codex-session: App Server connection is closed."));
    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`codex-session: App Server RPC timed out (${method}).`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.write({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        this.fail(error instanceof Error ? error : new Error("codex-session: App Server write failed."));
        reject(error);
      }
    });
  }

  notify(method, params) {
    this.write({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
  }

  write(message) {
    if (this.closed || !this.child?.stdin) throw new Error("codex-session: App Server connection is closed.");
    try {
      this.child.stdin.write(`${JSON.stringify(message)}\n`);
    } catch (error) {
      const failure = new Error("codex-session: App Server stdin write failed.", { cause: error });
      this.fail(failure);
      throw failure;
    }
  }

  fail(error) {
    if (this.closed || this.closing) return;
    this.fatalError = error;
    this.onFatal(error);
  }

  close(reason = new Error("codex-session: App Server connection closed.")) {
    if (this.closePromise) return this.closePromise;
    this.closePromise = this.closeNow(reason);
    return this.closePromise;
  }

  async closeNow(reason) {
    this.closing = true;
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.pending.clear();
    if (!this.child || this.exited) return;
    try { this.child.kill("SIGTERM"); } catch {}
    await Promise.race([this.exitPromise, new Promise((resolve) => setTimeout(resolve, this.shutdownTimeoutMs))]);
    if (!this.exited) {
      try { this.child.kill("SIGKILL"); } catch {}
      await Promise.race([this.exitPromise, new Promise((resolve) => setTimeout(resolve, this.shutdownTimeoutMs))]);
      if (!this.exited) throw new Error("codex-session: App Server process could not be reaped.");
    }
  }
}

function turnIdFromNotification(message) {
  if (typeof message.params?.turnId === "string") return message.params.turnId;
  if (typeof message.params?.turn?.id === "string") return message.params.turn.id;
  return null;
}

/**
 * @param {object} [options]
 * @param {string} [options.systemPrompt]
 * @param {string} [options.model]
 * @param {string} [options.effort]
 * @param {Record<string, string | undefined>} [options.env]
 * @param {boolean} [options.skipEnvGuard]
 * @param {(warning: string) => void} [options.onWarning]
 * @param {typeof defaultSpawn} [options.spawnImpl]
 * @param {string} [options.codexPath]
 * @param {string} [options.homeDir]
 * @param {string} [options.ledgerPath]
 * @param {number} [options.rpcTimeoutMs]
 * @param {number} [options.disposeRpcTimeoutMs]
 * @param {number} [options.shutdownTimeoutMs]
 * @param {(rateLimits: any) => void} [options.onRateLimits]  App Server の `account/rateLimits/updated` 通知（使用率の
 *   差分・RateLimitSnapshot をそのまま渡す）。操縦席の残量ゲージがマージする（cockpit-glance-redesign.md §9.2）。
 * @param {number} [options.compactionWaitMs=60000]  圧縮の処理中に来た ask が待つ上限（超えたら待つのをやめて
 *   turn を始める・context-growth-2026-10.md §6）。
 * @param {number} [options.compactionTimeoutMs=300000]  圧縮の turn の完了を待つ上限（超えたら失敗として畳む）。
 */
export function createCodexSession(options = {}) {
  const systemPrompt = `${options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT}`;
  const model = `${options.model ?? DEFAULT_MODEL}`;
  const effort = `${options.effort ?? DEFAULT_EFFORT}`;
  const env = options.env ?? process.env;
  const spawnImpl = options.spawnImpl ?? defaultSpawn;
  const homeDir = options.homeDir ?? os.homedir();
  const ledgerPath = options.ledgerPath ?? DEFAULT_LEDGER_PATH;
  const rpcTimeoutMs = options.rpcTimeoutMs ?? 15_000;
  const disposeRpcTimeoutMs = options.disposeRpcTimeoutMs ?? 300;
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1_000;
  const codexPath = options.codexPath ?? resolveBundledCodexPath();

  if (!options.skipEnvGuard) {
    const { warnings } = assertSubscriptionAuthEnvOpenAI(env);
    for (const warning of warnings) options.onWarning?.(warning);
  }
  sweepLedger(homeDir, ledgerPath);
  const workingDirectory = mkdtempSync(path.join(os.tmpdir(), "codex-app-server-session-"));
  const threadIds = [];
  let disposed = false;
  let connection = null;
  let connectionGeneration = 0;
  let threadId = null;
  let threadHasSuccessfulTurn = false;
  let resetPromise = Promise.resolve();
  let activeAsk = null;
  let askInProgress = false;
  // ask が圧縮の待ちを抜けて turn を始めた（〜終わる）間だけ true。圧縮の処理が人格の指示を差し込む前に見る。
  let askTurnActive = false;
  const compactionWaitMs = options.compactionWaitMs ?? 60_000;
  const compactionTimeoutMs = options.compactionTimeoutMs ?? 300_000;
  /**
   * 直近に成功した ask の tokenUsage（その thread のもの）。圧縮の判定（文脈の大きさ）に使う。
   * thread が替わったとき・圧縮が済んだとき（もう古い）は null に戻す。
   * @type {null | { threadId: string; tokenUsage: NonNullable<ReturnType<typeof normalizeTokenUsage>> }}
   */
  let lastContext = null;
  /**
   * 今の（または直近の）圧縮の turn。settled の後も、同じ turnId の遅れた通知を黙って捨てるために残す
   * （次の圧縮で置き換わる）。
   * @type {null | { generation: number; threadId: string; turnId: string | null; settled: boolean; usage: any; sawCompactionItem: boolean; resolve: () => void; reject: (error: Error) => void }}
   */
  let compaction = null;
  /** 圧縮の処理（compact/start〜人格の差し込み）が片付いたら resolve する。処理中でなければ null。 */
  let compactionProcess = null;
  /** 圧縮が済んだが ask の turn 中で差し込めなかった thread（次の turn の前に 1 回だけ差し込む）。 */
  let pendingPersonaThreadId = null;
  const diagnose = (detail) => {
    try { options.onWarning?.(`codex-session: ignored App Server message — ${detail}`); } catch {}
  };

  /** 圧縮の turn を畳む（成功 = error なし）。二重には畳まない。 */
  const settleCompaction = (error = null) => {
    const current = compaction;
    if (!current || current.settled) return;
    current.settled = true;
    if (error) current.reject(error);
    else current.resolve();
  };

  const invalidateConnection = (error, stale = connection) => {
    if (!stale) return resetPromise;
    if (connection === stale) {
      connection = null;
      threadId = null;
      threadHasSuccessfulTurn = false;
      lastContext = null;
      pendingPersonaThreadId = null;
    }
    const reapPromise = stale.close(error);
    resetPromise = Promise.all([resetPromise, reapPromise]).then(() => undefined);
    // Keep the barrier rejected for the calling ask/dispose/next ask, while
    // registering an observer immediately so a delayed reap failure can never
    // become an unhandled rejection between protocol callbacks and await sites.
    resetPromise.catch(() => {});
    return resetPromise;
  };
  const rejectActive = (error) => {
    const active = activeAsk;
    if (!active || active.settled) return;
    active.settled = true;
    active.onTextDelta = null;
    active.reject(error);
  };
  const failTurn = (error) => {
    const active = activeAsk;
    if (active && threadId === active.threadId) {
      threadId = null;
      threadHasSuccessfulTurn = false;
      lastContext = null;
      pendingPersonaThreadId = null;
    }
    rejectActive(error);
  };

  /**
   * 圧縮の turn の通知を受ける（ask の turn の外で来る turn / item 通知）。圧縮の thread・turn のものなら
   * 処理して true、そうでなければ false（従来の経路へ）。本文は持たない（contextCompaction item は id だけ）。
   */
  const routeCompactionNotification = (generation, message) => {
    const current = compaction;
    if (!current || current.generation !== generation) return false;
    if (message.params?.threadId !== current.threadId) return false;
    const method = message.method;
    const notificationTurnId = turnIdFromNotification(message);
    const active = activeAsk;
    const askOwnsThread = !!active && !active.settled && active.threadId === current.threadId;
    if (current.turnId === null) {
      // turn/start の応答に turn id があるが、thread/compact/start の応答は空（{}）なので、圧縮の turn は
      // 最初の turn/started で知る。ask の turn と取り違えないよう、ask がこの thread を使っていない間だけ。
      if (askOwnsThread) return false;
      if (method === "turn/started" && typeof notificationTurnId === "string") {
        current.turnId = notificationTurnId;
        return true;
      }
      if (current.settled) return false;
    } else if (notificationTurnId !== current.turnId) {
      return false;
    }
    if (current.settled) return true; // 畳んだ後の遅れた通知は黙って捨てる。
    if (method === "item/started" || method === "item/completed") {
      if (message.params?.item?.type === "contextCompaction") current.sawCompactionItem = true;
      return true;
    }
    if (method === "thread/tokenUsage/updated") {
      current.usage = normalizeTokenUsage(message.params?.tokenUsage);
      return true;
    }
    if (method === "error") {
      if (message.params?.willRetry === false) {
        settleCompaction(new Error(`codex-session: compaction failed — ${message.params?.error?.message ?? "error"}`));
      }
      return true;
    }
    if (method === "turn/completed") {
      const status = message.params?.turn?.status;
      if (status === "completed") settleCompaction();
      else settleCompaction(new Error(`codex-session: compaction failed — ${message.params?.turn?.error?.message ?? status ?? "unknown"}`));
      return true;
    }
    // thread/compacted（非推奨の完了通知）・turn/started の重複・その他の turn 内通知は数えるだけで捨てる。
    return true;
  };

  const dispatchNotification = (generation, message) => {
    const active = activeAsk;
    const method = message.method;
    // 使用率の差分は turn に属さない（いつ来てもよい）。本文を含まない数値だけの通知なので、そのまま渡す。
    if (method === "account/rateLimits/updated") {
      try { options.onRateLimits?.(message.params?.rateLimits ?? null); } catch {}
      return;
    }
    if (routeCompactionNotification(generation, message)) return;
    const turnScoped = method === "turn/started" || method === "turn/completed" || method === "item/started" ||
      method === "item/completed" || method === "item/agentMessage/delta" ||
      method === "thread/tokenUsage/updated" || method === "error";
    if (!turnScoped) {
      diagnose(`unsupported notification ${method}`);
      return;
    }
    if (!active || active.settled || active.generation !== generation) {
      diagnose(`stale notification ${method}`);
      return;
    }
    if (active.turnId === null) {
      active.queued.push(message);
      return;
    }
    const notificationTurnId = turnIdFromNotification(message);
    if (notificationTurnId !== active.turnId || message.params?.threadId !== active.threadId) {
      const matchesThread = message.params?.threadId === active.threadId;
      const matchesTurn = notificationTurnId === active.turnId;
      if (matchesThread || matchesTurn) failTurn(protocolError(`${method} is missing required current thread/turn correlation`));
      else diagnose(`unowned notification ${method}`);
      return;
    }
    try {
      if (method === "item/started") {
        const item = message.params?.item;
        if (item?.type !== "agentMessage") return;
        if (typeof item.id !== "string") throw protocolError("agent item/started is missing item identity");
        if (active.items.has(item.id)) throw protocolError("duplicate agent item start");
        active.items.set(item.id, { deltaText: "", finalText: null, completed: false });
        active.itemOrder.push(item.id);
        return;
      }
      if (method === "item/agentMessage/delta") {
        const { itemId, delta } = message.params ?? {};
        if (typeof itemId !== "string" || typeof delta !== "string") throw protocolError("agent delta is missing itemId/delta");
        const item = active.items.get(itemId);
        if (!item || item.completed) throw protocolError("agent delta is outside its item lifetime");
        item.deltaText += delta;
        active.deltaText += delta;
        if (active.ttftMs === null) active.ttftMs = performance.now() - active.startedAt;
        active.onTextDelta?.(delta, { itemId, threadId: active.threadId, turnId: active.turnId, elapsedMs: performance.now() - active.startedAt });
        return;
      }
      if (method === "item/completed") {
        const item = message.params?.item;
        if (item?.type !== "agentMessage") return;
        if (typeof item.id !== "string") throw protocolError("agent item/completed is missing item identity");
        if (typeof item.text !== "string") throw protocolError("agent item is missing final text");
        const state = active.items.get(item.id);
        if (!state || state.completed) throw protocolError("agent item completed outside its lifetime");
        state.completed = true;
        state.finalText = item.text;
        if (state.deltaText !== item.text) throw turnError("agent delta accumulation does not match the completed item");
        return;
      }
      if (method === "thread/tokenUsage/updated") {
        active.usage = normalizeUsage(message.params?.tokenUsage);
        active.tokenUsage = normalizeTokenUsage(message.params?.tokenUsage);
        return;
      }
      if (method === "error") {
        const params = message.params;
        if (!params?.error || typeof params.error.message !== "string" || typeof params.willRetry !== "boolean") {
          throw protocolError("error notification has an invalid shape");
        }
        if (!params.willRetry) throw turnError(params.error.message);
        return;
      }
      if (method === "turn/completed") {
        const status = message.params?.turn?.status;
        if (typeof status !== "string") throw protocolError("turn/completed is missing status");
        if (status !== "completed") throw turnError(message.params?.turn?.error?.message ?? status);
        if (active.itemOrder.length === 0) throw turnError("completed turn has no agent message");
        const replyText = active.itemOrder.map((id) => active.items.get(id)).map((item) => {
          if (!item?.completed || typeof item.finalText !== "string") throw turnError("completed turn has an incomplete agent item");
          return item.finalText;
        }).join("");
        if (active.deltaText !== replyText) throw turnError("agent delta accumulation does not match final reply");
        active.settled = true;
        active.onTextDelta = null;
        active.resolve({ replyText, usage: active.usage, tokenUsage: active.tokenUsage, ttftMs: active.ttftMs });
      }
    } catch (error) {
      failTurn(error instanceof Error ? error : turnError("unknown notification failure"));
    }
  };

  const ensureConnection = async () => {
    await resetPromise;
    if (disposed) throw new Error("codex-session already disposed.");
    if (!connection) {
      const generation = ++connectionGeneration;
      const fresh = new AppServerConnection({
        spawnImpl,
        command: codexPath,
        args: ["app-server", "--stdio", "-c", 'forced_login_method="chatgpt"', "-c", 'web_search="disabled"'],
        spawnOptions: { cwd: workingDirectory, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
        rpcTimeoutMs,
        shutdownTimeoutMs,
        onNotification: (message) => dispatchNotification(generation, message),
        onDiagnostic: diagnose,
        onFatal: (error) => {
          invalidateConnection(error, fresh);
          rejectActive(error);
          if (compaction && compaction.generation === generation) settleCompaction(error);
        }
      });
      connection = fresh;
    }
    const current = connection;
    try {
      await current.start();
      return { connection: current, generation: connectionGeneration };
    } catch (error) {
      if (!current.child || current.fatalError) await invalidateConnection(error instanceof Error ? error : protocolError("connection start failed"), current);
      throw error;
    }
  };

  const ensureThread = async () => {
    if (connection && threadId) return { connection, threadId, generation: connectionGeneration };
    const ready = await ensureConnection();
    try {
      const result = await ready.connection.request("thread/start", {
        model, cwd: workingDirectory, approvalPolicy: "never", sandbox: "read-only",
        config: { forced_login_method: "chatgpt", web_search: "disabled" }
      });
      const id = result?.thread?.id;
      if (typeof id !== "string" || id.length === 0) throw protocolError("thread/start response is missing thread.id");
      threadId = id;
      threadHasSuccessfulTurn = false;
      lastContext = null;
      pendingPersonaThreadId = null;
      if (!threadIds.includes(id)) {
        threadIds.push(id);
        appendLedger(ledgerPath, id);
      }
      return { connection: ready.connection, threadId: id, generation: ready.generation };
    } catch (error) { throw error; }
  };

  /** getContextUsage の実体（compact からも呼ぶので this に頼らない）。 */
  const readContextUsage = () => {
    const context = lastContext;
    if (disposed || !context || !connection || threadId !== context.threadId) return null;
    return {
      conversationKey: context.threadId,
      lastInputTokens: context.tokenUsage.last?.inputTokens ?? null,
      lastCachedInputTokens: context.tokenUsage.last?.cachedInputTokens ?? null,
      totalInputTokens: context.tokenUsage.total?.inputTokens ?? null,
      modelContextWindow: context.tokenUsage.modelContextWindow
    };
  };

  return {
    /** Start and initialize the bundled App Server without creating a thread or turn. */
    async initialize() {
      await ensureConnection();
    },

    /**
     * Existing one-argument callers remain valid. Wave 2 can opt into the
     * ordered append-only stream through the additive second argument.
     * @param {string | Array<any>} content
     * @param {{onTextDelta?: (delta: string, meta: {itemId:string;threadId:string;turnId:string;elapsedMs:number}) => void}} [askOptions]
     */
    async ask(content, askOptions = {}) {
      if (disposed) throw new Error("codex-session already disposed.");
      if (askInProgress) throw new Error("codex-session: concurrent ask is not supported.");
      askInProgress = true;
      const onTextDelta = typeof askOptions?.onTextDelta === "function" ? askOptions.onTextDelta : null;
      let snapshotted;
      try {
        snapshotted = snapshotInput(content, workingDirectory);
      } catch (error) {
        askInProgress = false;
        throw error;
      }
      const startedAt = performance.now();
      try {
        // 圧縮の処理中なら終わるまで待つ（上限 compactionWaitMs。超えたら待つのをやめて turn を始める）。
        if (compactionProcess) {
          let waitTimer;
          await Promise.race([
            compactionProcess,
            new Promise((resolve) => { waitTimer = setTimeout(resolve, compactionWaitMs); })
          ]);
          clearTimeout(waitTimer);
          if (disposed) throw new Error("codex-session disposed during compaction wait.");
        }
        askTurnActive = true;
        const ready = await ensureThread();
        // 圧縮は済んだが（待ちきれずに turn を始めた等で）人格の指示をまだ差し込めていない thread なら、
        // この turn の前に 1 回だけ差し込む。失敗しても ask は続ける（差し込みは保険）。
        if (pendingPersonaThreadId !== null) {
          const pending = pendingPersonaThreadId;
          pendingPersonaThreadId = null;
          if (pending === ready.threadId && threadHasSuccessfulTurn) {
            try {
              await ready.connection.request("thread/inject_items", { threadId: pending, items: [personaInjectItem(systemPrompt)] });
            } catch {
              diagnose("deferred persona injection failed");
            }
          }
        }
        const input = threadHasSuccessfulTurn ? snapshotted.input.map((item) => ({ ...item })) : withSystemPrompt(snapshotted.input, systemPrompt);
        let terminalResolve;
        let terminalReject;
        const terminal = new Promise((resolve, reject) => { terminalResolve = resolve; terminalReject = reject; });
        const active = {
          generation: ready.generation, threadId: ready.threadId, turnId: null, queued: [], items: new Map(), itemOrder: [],
          deltaText: "", usage: null, tokenUsage: null, ttftMs: null, startedAt, onTextDelta, settled: false,
          resolve: terminalResolve, reject: terminalReject
        };
        activeAsk = active;
        let startResult;
        try {
          startResult = await ready.connection.request("turn/start", {
            threadId: ready.threadId, input, model, effort, cwd: workingDirectory, approvalPolicy: "never",
            sandboxPolicy: { type: "readOnly", networkAccess: false }
          });
        } catch (error) {
          failTurn(error instanceof Error ? error : turnError("turn/start failed"));
        }
        if (!active.settled) {
          const startedTurnId = startResult?.turn?.id;
          if (typeof startedTurnId !== "string" || startedTurnId.length === 0) failTurn(protocolError("turn/start response is missing turn.id"));
          else {
            active.turnId = startedTurnId;
            for (const message of active.queued.splice(0)) {
              dispatchNotification(ready.generation, message);
              if (active.settled) break;
            }
          }
        }
        const result = await terminal;
        threadHasSuccessfulTurn = true;
        if (result.tokenUsage && threadId === ready.threadId) lastContext = { threadId: ready.threadId, tokenUsage: result.tokenUsage };
        return { ...result, elapsedMs: performance.now() - startedAt };
      } catch (error) {
        await resetPromise;
        throw error;
      } finally {
        activeAsk = null;
        askInProgress = false;
        askTurnActive = false;
        for (const filePath of snapshotted.tempFiles) {
          try { unlinkSync(filePath); } catch {}
        }
      }
    },

    /**
     * Codex の使用率を読む（`account/rateLimits/read`・reset credit の詳細は省いて速く読む）。App Server が
     * 起動・初期化済みのときだけ読み、まだ起動していなければ null（読むためだけに起こさない）。
     * 返り値は GetAccountRateLimitsResponse そのまま（正規化は呼び出し側）。失敗は throw。
     * @returns {Promise<any | null>}
     */
    async readRateLimits() {
      if (disposed) return null;
      const live = connection;
      if (!live || !live.initialized || live.closed || live.closing) return null;
      return live.request("account/rateLimits/read", { excludeResetCreditDetails: true });
    },

    /**
     * 今の会話（App Server の thread）の識別子。次の ask が新しい thread で始まる（まだ無い・turn の失敗や
     * 接続の作り直しで捨てた）なら null。発火側はこれが前回の ask の後と同じかどうかで「会話の世代」が
     * 変わったかを知る（同じなら前回から増えた分だけ渡す・context-growth-2026-10.md §6）。
     * @returns {string | null}
     */
    conversationKey() {
      if (disposed || !connection || !threadId) return null;
      return threadId;
    },

    /**
     * 直近に成功した ask の文脈の大きさ（今の thread のもの・圧縮の判定用）。無い・古い（thread が替わった・
     * 圧縮が済んだ）なら null。数値だけ。
     * @returns {{ conversationKey: string; lastInputTokens: number | null; lastCachedInputTokens: number | null; totalInputTokens: number | null; modelContextWindow: number | null } | null}
     */
    getContextUsage() {
      return readContextUsage();
    },

    /** 圧縮の処理（compact/start〜人格の差し込み）の最中か。 */
    isCompacting() {
      return compactionProcess !== null;
    },

    /**
     * 今の thread を手動で圧縮する（`thread/compact/start`）。圧縮の turn の完了（turn/completed）を待ち、
     * 済んだら最初の turn と同じ人格の指示を `thread/inject_items` で 1 回だけ差し込み直す（普段の ask には
     * 出さない・この処理の中に閉じる）。ask の最中・会話がまだ無い・圧縮の最中は何もしない。
     * throw しない（結果を返す）。本文は返さない（数値と理由だけ）。
     * @returns {Promise<{ compacted: boolean; reason?: string; message?: string; durationMs?: number; personaInjected?: boolean; personaDeferred?: boolean; before?: any; compactionUsage?: any }>}
     */
    async compact() {
      if (disposed) return { compacted: false, reason: "disposed" };
      if (askInProgress) return { compacted: false, reason: "busy" };
      if (compactionProcess) return { compacted: false, reason: "in-progress" };
      const live = connection;
      const targetThreadId = threadId;
      if (!live || !targetThreadId || !threadHasSuccessfulTurn) return { compacted: false, reason: "no-conversation" };
      const before = readContextUsage();
      const startedAt = performance.now();
      /** @type {(value?: unknown) => void} */
      let finishProcess = () => {};
      compactionProcess = new Promise((resolve) => { finishProcess = resolve; });
      /** @type {any} */
      let current = null;
      let timeoutTimer;
      try {
        const turnDone = new Promise((resolve, reject) => {
          current = {
            generation: connectionGeneration, threadId: targetThreadId, turnId: null, settled: false,
            usage: null, sawCompactionItem: false, resolve, reject
          };
          compaction = current;
        });
        turnDone.catch(() => {});
        timeoutTimer = setTimeout(
          () => { if (compaction === current) settleCompaction(new Error("codex-session: compaction timed out.")); },
          compactionTimeoutMs
        );
        try {
          // 応答は空（{}）。完了は turn の通知で知る。応答が完了まで返らない版でも切らないよう上限は圧縮と同じ。
          await live.request("thread/compact/start", { threadId: targetThreadId }, compactionTimeoutMs);
        } catch (error) {
          if (compaction === current) settleCompaction(error instanceof Error ? error : new Error("thread/compact/start failed"));
        }
        await turnDone;
        // 圧縮前の文脈の大きさはもう古い（次の ask の usage で測り直す）。
        if (lastContext && lastContext.threadId === targetThreadId) lastContext = null;
        let personaInjected = false;
        let personaDeferred = false;
        if (!disposed && connection === live && threadId === targetThreadId) {
          if (askTurnActive) {
            // 待ちきれずに ask の turn が始まっている。差し込みはその次の turn の前に回す。
            pendingPersonaThreadId = targetThreadId;
            personaDeferred = true;
          } else {
            try {
              await live.request("thread/inject_items", { threadId: targetThreadId, items: [personaInjectItem(systemPrompt)] });
              personaInjected = true;
            } catch {
              // 差し込みに失敗したら、次の turn の前にもう一度だけ試す。
              pendingPersonaThreadId = targetThreadId;
              personaDeferred = true;
            }
          }
        }
        return {
          compacted: true,
          durationMs: performance.now() - startedAt,
          personaInjected,
          personaDeferred,
          before,
          compactionUsage: current?.usage ?? null
        };
      } catch (error) {
        return {
          compacted: false,
          reason: "failed",
          message: error instanceof Error ? error.message : String(error),
          durationMs: performance.now() - startedAt,
          before
        };
      } finally {
        clearTimeout(timeoutTimer);
        compactionProcess = null;
        finishProcess();
      }
    },

    threadIds,

    async dispose() {
      if (disposed) return;
      disposed = true;
      const live = connection;
      const liveThreadId = threadId;
      const active = activeAsk;
      if (active) rejectActive(new Error("codex-session disposed during turn."));
      if (live && active?.turnId) {
        try { await live.request("turn/interrupt", { threadId: active.threadId, turnId: active.turnId }, disposeRpcTimeoutMs); } catch {}
      }
      // 圧縮の最中なら畳む（待っている compact() を失敗で返す）。turn が分かっていれば止めてもらう（best effort）。
      const pendingCompaction = compaction && !compaction.settled ? compaction : null;
      if (pendingCompaction) {
        settleCompaction(new Error("codex-session disposed during compaction."));
        if (live && pendingCompaction.turnId) {
          try { await live.request("turn/interrupt", { threadId: pendingCompaction.threadId, turnId: pendingCompaction.turnId }, disposeRpcTimeoutMs); } catch {}
        }
      }
      if (live && liveThreadId) {
        try { await live.request("thread/delete", { threadId: liveThreadId }, disposeRpcTimeoutMs); } catch {
          // 0.144.5 may fail with the observed agent_jobs DB error. Do not mutate its DB.
        }
      }
      connection = null;
      threadId = null;
      let disposeError = null;
      try {
        if (live) await live.close(new Error("codex-session disposed."));
        await resetPromise;
      } catch (error) {
        disposeError = error;
      } finally {
        for (const id of threadIds) deleteRolloutForThreadId(homeDir, id);
        removeFromLedger(ledgerPath, threadIds);
        try { rmSync(workingDirectory, { recursive: true, force: true }); } catch {}
      }
      if (disposeError) throw disposeError;
    }
  };
}
