// @ts-check
/**
 * Codex App Server backed MindSession.
 *
 * One session owns one persistent stdio JSONL connection and one App Server
 * thread. Ordinary asks append one turn each to that thread. Transport loss
 * replaces the process; a safely-correlated turn failure abandons only its
 * thread so the following ask can recover on the same connection with a fresh
 * thread and the session prompt injected again.
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
  const diagnose = (detail) => {
    try { options.onWarning?.(`codex-session: ignored App Server message — ${detail}`); } catch {}
  };

  const invalidateConnection = (error, stale = connection) => {
    if (!stale) return resetPromise;
    if (connection === stale) {
      connection = null;
      threadId = null;
      threadHasSuccessfulTurn = false;
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
    }
    rejectActive(error);
  };

  const dispatchNotification = (generation, message) => {
    const active = activeAsk;
    const method = message.method;
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
        active.resolve({ replyText, usage: active.usage, ttftMs: active.ttftMs });
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
      if (!threadIds.includes(id)) {
        threadIds.push(id);
        appendLedger(ledgerPath, id);
      }
      return { connection: ready.connection, threadId: id, generation: ready.generation };
    } catch (error) { throw error; }
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
        const ready = await ensureThread();
        const input = threadHasSuccessfulTurn ? snapshotted.input.map((item) => ({ ...item })) : withSystemPrompt(snapshotted.input, systemPrompt);
        let terminalResolve;
        let terminalReject;
        const terminal = new Promise((resolve, reject) => { terminalResolve = resolve; terminalReject = reject; });
        const active = {
          generation: ready.generation, threadId: ready.threadId, turnId: null, queued: [], items: new Map(), itemOrder: [],
          deltaText: "", usage: null, ttftMs: null, startedAt, onTextDelta, settled: false,
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
        return { ...result, elapsedMs: performance.now() - startedAt };
      } catch (error) {
        await resetPromise;
        throw error;
      } finally {
        activeAsk = null;
        askInProgress = false;
        for (const filePath of snapshotted.tempFiles) {
          try { unlinkSync(filePath); } catch {}
        }
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
