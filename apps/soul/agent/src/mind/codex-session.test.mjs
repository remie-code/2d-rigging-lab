// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_SERVER_ARGS, MCP_CONFIG_READ_FAILED_WARNING, MODEL_LIST_FAILED_WARNING, SERVICE_TIERS, createCodexSession, mcpServerDisableOverrides, serviceTiersFromModelList, sweepCodexRollouts } from "./codex-session.mjs";

class FakeChild extends EventEmitter {
  constructor(onMessage) {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.messages = [];
    this.sentMessages = [];
    this.killSignals = [];
    this.exited = false;
    this.inputBuffer = "";
    this.stdin = {
      write: (chunk) => {
        this.inputBuffer += `${chunk}`;
        while (this.inputBuffer.includes("\n")) {
          const newline = this.inputBuffer.indexOf("\n");
          const line = this.inputBuffer.slice(0, newline);
          this.inputBuffer = this.inputBuffer.slice(newline + 1);
          if (!line) continue;
          const message = JSON.parse(line);
          this.messages.push(message);
          onMessage(message, this.api());
        }
        return true;
      }
    };
  }

  api() {
    return {
      response: (request, result) => this.send({ id: request.id, result }),
      rpcError: (request, message) => this.send({ id: request.id, error: { code: -32000, message } }),
      notification: (method, params, fragments) => this.send({ method, params }, fragments),
      message: (message, fragments) => this.send(message, fragments),
      raw: (raw) => this.stdout.emit("data", Buffer.from(raw)),
      exit: (code = 1, signal = null) => this.exit(code, signal)
    };
  }

  send(message, fragments = null) {
    this.sentMessages.push(message);
    const bytes = Buffer.from(`${JSON.stringify(message)}\n`);
    if (!Array.isArray(fragments) || fragments.length === 0) {
      this.stdout.emit("data", bytes);
      return;
    }
    let offset = 0;
    for (const length of fragments) {
      if (offset >= bytes.length) break;
      this.stdout.emit("data", bytes.subarray(offset, Math.min(bytes.length, offset + length)));
      offset += length;
    }
    if (offset < bytes.length) this.stdout.emit("data", bytes.subarray(offset));
  }

  exit(code = 0, signal = null) {
    if (this.exited) return;
    this.exited = true;
    queueMicrotask(() => this.emit("exit", code, signal));
  }

  kill(signal) {
    this.killSignals.push(signal);
    this.exit(null, signal);
    return true;
  }
}

function successfulTurn(api, request, replyText, { fragments = null, usage = null } = {}) {
  const threadId = request.params.threadId;
  const turnId = `turn-${request.id}`;
  const itemId = `agent-${request.id}`;
  api.response(request, { turn: { id: turnId, status: "inProgress", items: [] } });
  api.notification("turn/started", { threadId, turn: { id: turnId, status: "inProgress", items: [] } });
  api.notification("item/started", { threadId, turnId, startedAtMs: 1, item: { id: itemId, type: "agentMessage", text: "" } });
  for (const delta of [...replyText]) {
    api.notification("item/agentMessage/delta", { threadId, turnId, itemId, delta }, fragments);
  }
  if (usage) api.notification("thread/tokenUsage/updated", { threadId, turnId, tokenUsage: usage });
  api.notification("item/completed", { threadId, turnId, completedAtMs: 2, item: { id: itemId, type: "agentMessage", text: replyText } });
  api.notification("turn/completed", { threadId, turn: { id: turnId, status: "completed", items: [] } });
}

/** 圧縮の turn（実機の流れ: 応答 {} → turn/started → contextCompaction item → tokenUsage → turn/completed）。 */
function successfulCompaction(api, request, { usage = null, turnId = `compact-${request.id}`, respond = true } = {}) {
  const threadId = request.params.threadId;
  if (respond) api.response(request, {});
  api.notification("turn/started", { threadId, turn: { id: turnId, status: "inProgress", items: [] } });
  api.notification("item/started", { threadId, turnId, item: { id: `cc-${request.id}`, type: "contextCompaction" } });
  api.notification("item/completed", { threadId, turnId, item: { id: `cc-${request.id}`, type: "contextCompaction" } });
  if (usage) api.notification("thread/tokenUsage/updated", { threadId, turnId, tokenUsage: usage });
  api.notification("thread/compacted", { threadId, turnId });
  api.notification("turn/completed", { threadId, turn: { id: turnId, status: "completed", items: [] } });
}

function makeSpawnHarness(specForProcess = () => ({})) {
  const children = [];
  const spawnCalls = [];
  const turnRequests = [];
  const threadRequests = [];
  const spawnImpl = (command, args, options) => {
    const processIndex = children.length;
    const spec = specForProcess(processIndex);
    const child = new FakeChild((message, api) => {
      if (message.method === "initialize") {
        if (spec.onInitialize) spec.onInitialize(message, api, child);
        else api.response(message, { serverInfo: { name: "fake", version: "0.144.5" } });
      } else if (message.method === "thread/start") {
        threadRequests.push(message);
        if (spec.onThread) spec.onThread(message, api, child);
        else api.response(message, { thread: { id: spec.threadId ?? `thread-${threadRequests.length}` } });
      } else if (message.method === "turn/start") {
        turnRequests.push(message);
        if (spec.onTurn) spec.onTurn(message, api, child);
        else successfulTurn(api, message, spec.replyText ?? "はい。", spec.successOptions);
      } else if (message.method === "account/rateLimits/read") {
        if (spec.onRateLimits) spec.onRateLimits(message, api, child);
        else api.response(message, { ordinaryUsageAllowed: true, rateLimits: { primary: { usedPercent: 12, windowDurationMins: 10080, resetsAt: 1700000000 } } });
      } else if (message.method === "thread/compact/start") {
        if (spec.onCompact) spec.onCompact(message, api, child);
        else successfulCompaction(api, message);
      } else if (message.method === "thread/inject_items") {
        if (spec.onInject) spec.onInject(message, api, child);
        else api.response(message, {});
      } else if (message.method === "config/read") {
        if (spec.onConfigRead) spec.onConfigRead(message, api, child);
        else api.response(message, { config: spec.effectiveConfig ?? {}, origins: {}, layers: null });
      } else if (message.method === "model/list") {
        if (spec.onModelList) spec.onModelList(message, api, child);
        else {
          api.response(message, {
            data: spec.models ?? [{ id: "gpt-5.6-terra", model: "gpt-5.6-terra", serviceTiers: [{ id: "priority", name: "Fast", description: "2x" }], defaultServiceTier: null }],
            nextCursor: null
          });
        }
      } else if (message.method === "turn/interrupt" || message.method === "thread/delete") {
        if (spec.onCleanup) spec.onCleanup(message, api, child);
        else api.response(message, {});
      }
    });
    if (spec.neverExitOnKill) {
      child.kill = (signal) => {
        child.killSignals.push(signal);
        return true;
      };
    } else if (Number.isFinite(spec.killDelayMs)) {
      child.kill = (signal) => {
        child.killSignals.push(signal);
        setTimeout(() => child.exit(null, signal), spec.killDelayMs);
        return true;
      };
    }
    children.push(child);
    spawnCalls.push({ command, args, options });
    return child;
  };
  return { spawnImpl, children, spawnCalls, turnRequests, threadRequests };
}

async function withScratch(fn) {
  const homeDir = mkdtempSync(path.join(os.tmpdir(), "codex-app-server-test-"));
  const ledgerPath = path.join(homeDir, "codex-rollouts.local.json");
  try {
    await fn({ homeDir, ledgerPath });
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

function createTestSession(harness, scratch, extra = {}) {
  return createCodexSession({
    skipEnvGuard: true,
    codexPath: "fake-codex",
    spawnImpl: harness.spawnImpl,
    homeDir: scratch.homeDir,
    ledgerPath: scratch.ledgerPath,
    rpcTimeoutMs: 200,
    disposeRpcTimeoutMs: 20,
    shutdownTimeoutMs: 20,
    ...extra
  });
}

test("codex-session: initialize/initialized once, one persistent process/thread, ordered fragmented deltas and exact final", async () => {
  await withScratch(async (scratch) => {
    const usage = { last: { inputTokens: 10, cachedInputTokens: 2, outputTokens: 4, reasoningOutputTokens: 1, totalTokens: 14 }, total: {} };
    const harness = makeSpawnHarness(() => ({ replyText: "一回目🙂。", successOptions: { fragments: [1, 2, 3, 1], usage } }));
    const session = createTestSession(harness, scratch, { systemPrompt: "SYSTEM" });
    const deltas = [];
    const first = await session.ask("質問1", { onTextDelta: (delta) => deltas.push(delta) });
    const second = await session.ask("質問2");

    assert.equal(first.replyText, "一回目🙂。");
    assert.equal(deltas.join(""), first.replyText);
    assert.deepEqual(first.usage, { input_tokens: 10, cached_input_tokens: 2, output_tokens: 4, reasoning_output_tokens: 1, total_tokens: 14 });
    assert.ok(first.ttftMs >= 0);
    assert.ok(first.elapsedMs >= first.ttftMs);
    assert.equal(second.replyText, "一回目🙂。");
    assert.equal(harness.children.length, 1);
    assert.equal(harness.threadRequests.length, 1);
    assert.equal(harness.turnRequests.length, 2);
    assert.equal(harness.turnRequests[0].params.threadId, harness.turnRequests[1].params.threadId);
    assert.deepEqual(harness.turnRequests[0].params.input, [{ type: "text", text: "SYSTEM\n\n質問1" }]);
    assert.deepEqual(harness.turnRequests[1].params.input, [{ type: "text", text: "質問2" }]);
    assert.equal(harness.children[0].messages.filter((m) => m.method === "initialize").length, 1);
    assert.equal(harness.children[0].messages.filter((m) => m.method === "initialized").length, 1);
    assert.equal(harness.children[0].sentMessages.every((message) => !Object.hasOwn(message, "jsonrpc")), true);
    assert.deepEqual(harness.turnRequests[0].params.sandboxPolicy, { type: "readOnly", networkAccess: false });
    await session.dispose();
    assert.ok(harness.children[0].killSignals.length >= 1);
  });
});

test("codex-session: initialize-only accepts the observed 0.144.5 envelope and creates no thread or turn", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness();
    const session = createTestSession(harness, scratch);
    await session.initialize();
    assert.equal(harness.children.length, 1);
    assert.equal(harness.children[0].messages.filter((message) => message.method === "initialize").length, 1);
    assert.equal(harness.threadRequests.length, 0);
    assert.equal(harness.turnRequests.length, 0);
    await session.dispose();
  });
});

test("codex-session: safely-correlated invalid initialize response fails only that request and retries on the same process", async () => {
  await withScratch(async (scratch) => {
    let initializeAttempts = 0;
    const harness = makeSpawnHarness(() => ({
      onInitialize(request, api) {
        initializeAttempts += 1;
        if (initializeAttempts === 1) api.message({ id: request.id, additive: "ignored" });
        else api.response(request, { serverInfo: { name: "fake", version: "0.144.5" }, additive: true });
      }
    }));
    const session = createTestSession(harness, scratch);
    await assert.rejects(() => session.initialize(), /neither result nor error/);
    await session.initialize();
    assert.equal(harness.children.length, 1);
    assert.equal(initializeAttempts, 2);
    await session.dispose();
  });
});

test("codex-session: untrusted and other-turn records cannot spoof or contaminate the active turn", async () => {
  await withScratch(async (scratch) => {
    const diagnostics = [];
    const deltas = [];
    const harness = makeSpawnHarness(() => ({
      onTurn(request, api) {
        const threadId = request.params.threadId;
        const turnId = "trusted-turn";
        api.response(request, { turn: { id: turnId, status: "inProgress", items: [] }, additive: "accepted" });
        api.message(17);
        api.message({ id: 999, result: { ignored: true } });
        api.message({ jsonrpc: "1.0", method: "turn/completed", params: { threadId: "other-thread", turn: { id: "other-turn", status: "completed" } } });
        api.notification("future/additive", { arbitrary: true });
        api.notification("item/started", { threadId, turnId, item: { id: "safe-item", type: "agentMessage", text: "" } });
        api.notification("item/agentMessage/delta", { threadId, turnId, itemId: "safe-item", delta: "safe" });
        api.notification("item/completed", { threadId, turnId, item: { id: "safe-item", type: "agentMessage", text: "safe" } });
        api.notification("turn/completed", { threadId, turn: { id: turnId, status: "completed", items: [] } });
      }
    }));
    const session = createTestSession(harness, scratch, { onWarning: (warning) => diagnostics.push(warning) });
    const result = await session.ask("continue", { onTextDelta: (delta) => deltas.push(delta) });
    assert.equal(result.replyText, "safe");
    assert.deepEqual(deltas, ["safe"]);
    assert.equal(harness.children.length, 1);
    assert.ok(diagnostics.some((warning) => warning.includes("non-object")));
    assert.ok(diagnostics.some((warning) => warning.includes("unknown response id 999")));
    assert.ok(diagnostics.some((warning) => warning.includes("unowned notification turn/completed")));
    assert.ok(diagnostics.some((warning) => warning.includes("unsupported notification future/additive")));
    await session.dispose();
  });
});

test("codex-session: vision remains image-first, localImage exists during turn, and caller mutation cannot alter accepted input", async () => {
  await withScratch(async (scratch) => {
    let capturedInput;
    let imageExisted = false;
    const harness = makeSpawnHarness(() => ({
      onTurn(request, api) {
        capturedInput = request.params.input;
        imageExisted = existsSync(capturedInput[0].path);
        successfulTurn(api, request, "見えたよ。");
      }
    }));
    const session = createTestSession(harness, scratch, { systemPrompt: "SYS" });
    const blocks = [
      { type: "image", source: { type: "base64", media_type: "image/png", data: Buffer.from("image-a").toString("base64") } },
      { type: "text", text: "元の質問" }
    ];
    const pending = session.ask(blocks);
    blocks[0].source.data = Buffer.from("mutated").toString("base64");
    blocks[1].text = "変更後";
    await pending;

    assert.equal(capturedInput[0].type, "localImage");
    assert.equal(imageExisted, true);
    assert.equal(capturedInput[1].text, "SYS\n\n元の質問");
    assert.equal(existsSync(capturedInput[0].path), false);
    await session.dispose();
  });
});

test("codex-session: delta/final mismatch fails only its turn and the next ask uses a fresh thread with system prompt", async () => {
  await withScratch(async (scratch) => {
    let turnAttempt = 0;
    const harness = makeSpawnHarness(() => ({
      onTurn(request, api) {
        turnAttempt += 1;
        if (turnAttempt > 1) {
          successfulTurn(api, request, "復旧。");
          return;
        }
        const threadId = request.params.threadId;
        const turnId = "bad-turn";
        api.response(request, { turn: { id: turnId, status: "inProgress", items: [] } });
        api.notification("item/started", { threadId, turnId, startedAtMs: 1, item: { id: "a", type: "agentMessage", text: "" } });
        api.notification("item/agentMessage/delta", { threadId, turnId, itemId: "a", delta: "不一致" });
        api.notification("item/completed", { threadId, turnId, completedAtMs: 2, item: { id: "a", type: "agentMessage", text: "別本文" } });
      }
    }));
    const session = createTestSession(harness, scratch, { systemPrompt: "PROMPT" });
    await assert.rejects(() => session.ask("first"), /does not match/);
    const recovered = await session.ask("second");
    assert.equal(recovered.replyText, "復旧。");
    assert.equal(harness.children.length, 1);
    assert.equal(harness.threadRequests.length, 2);
    assert.notEqual(harness.turnRequests[0].params.threadId, harness.turnRequests[1].params.threadId);
    assert.equal(harness.turnRequests[1].params.input[0].text, "PROMPT\n\nsecond");
    await session.dispose();
  });
});

test("codex-session: failed first turn does not consume first-turn system prompt and recovers on a fresh thread", async () => {
  await withScratch(async (scratch) => {
    let turnAttempt = 0;
    const harness = makeSpawnHarness(() => ({
      onTurn(request, api) {
        turnAttempt += 1;
        if (turnAttempt > 1) {
          successfulTurn(api, request, "ok");
          return;
        }
        const turnId = "failed-turn";
        api.response(request, { turn: { id: turnId, status: "inProgress", items: [] } });
        api.notification("turn/completed", { threadId: request.params.threadId, turn: { id: turnId, status: "failed", items: [], error: { message: "backend failed" } } });
      }
    }));
    const session = createTestSession(harness, scratch, { systemPrompt: "SYS" });
    await assert.rejects(() => session.ask("one"), /backend failed/);
    await session.ask("two");
    assert.equal(harness.turnRequests[0].params.input[0].text, "SYS\n\none");
    assert.equal(harness.turnRequests[1].params.input[0].text, "SYS\n\ntwo");
    assert.equal(harness.children.length, 1);
    assert.equal(harness.threadRequests.length, 2);
    await session.dispose();
  });
});

test("codex-session: process exit rejects the in-flight ask and a later ask recovers with a fresh process", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness((index) => index === 0 ? {
      onTurn(request, api) {
        api.response(request, { turn: { id: "dying-turn", status: "inProgress", items: [] } });
        api.exit(23);
      }
    } : { replyText: "alive" });
    const session = createTestSession(harness, scratch);
    await assert.rejects(() => session.ask("die"), /process exited/);
    assert.equal((await session.ask("recover")).replyText, "alive");
    assert.equal(harness.children.length, 2);
    await session.dispose();
  });
});

test("codex-session: invalid JSONL and malformed relevant notification fail instead of committing success", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness((index) => ({
      onTurn(request, api) {
        api.response(request, { turn: { id: `turn-${index}`, status: "inProgress", items: [] } });
        if (index === 0) api.raw("{broken-json\n");
        else api.notification("item/agentMessage/delta", { threadId: request.params.threadId, turnId: `turn-${index}`, itemId: 42, delta: "x" });
      }
    }));
    const session = createTestSession(harness, scratch);
    await assert.rejects(() => session.ask("json"), /invalid JSON/);
    await assert.rejects(() => session.ask("shape"), /missing itemId\/delta/);
    assert.equal(harness.children.length, 2);
    await session.dispose();
  });
});

test("codex-session: fatal transport waits for delayed old-child exit before allowing recovery spawn", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness((index) => index === 0 ? {
      killDelayMs: 40,
      onTurn(request, api) {
        api.response(request, { turn: { id: "delayed-exit-turn", status: "inProgress", items: [] } });
        api.raw("{broken-json\n");
      }
    } : { replyText: "recovered" });
    const session = createTestSession(harness, scratch, { shutdownTimeoutMs: 100 });
    const first = session.ask("break transport");
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(harness.children.length, 1, "old child が生存中は replacement を spawn しない");
    assert.equal(harness.children[0].exited, false);
    await assert.rejects(() => first, /invalid JSON/);
    assert.equal(harness.children[0].exited, true, "fatal ask rejection beforeに old child reap が完了する");
    assert.equal((await session.ask("recover")).replyText, "recovered");
    assert.equal(harness.children.length, 2);
    await session.dispose();
  });
});

test("codex-session: unreapable fatal child blocks recovery and surfaces deterministically without unhandled rejection", async () => {
  await withScratch(async (scratch) => {
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const harness = makeSpawnHarness(() => ({
        neverExitOnKill: true,
        onTurn(request, api) {
          api.response(request, { turn: { id: "never-exit-turn", status: "inProgress", items: [] } });
          api.raw("{broken-json\n");
        }
      }));
      const session = createTestSession(harness, scratch, { shutdownTimeoutMs: 10 });
      await assert.rejects(() => session.ask("break transport"), /could not be reaped/);
      await assert.rejects(() => session.ask("must not respawn"), /could not be reaped/);
      assert.equal(harness.children.length, 1, "unreaped child がある限り replacement を spawn しない");
      await assert.rejects(() => session.dispose(), /could not be reaped/);
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(unhandled, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

test("codex-session: dispose interrupts an active turn, rejects it, kills the child, and suppresses late deltas", async () => {
  await withScratch(async (scratch) => {
    let turnContext;
    const harness = makeSpawnHarness(() => ({
      onTurn(request, api) {
        turnContext = { request, api };
        api.response(request, { turn: { id: "long-turn", status: "inProgress", items: [] } });
        api.notification("item/started", { threadId: request.params.threadId, turnId: "long-turn", startedAtMs: 1, item: { id: "a", type: "agentMessage", text: "" } });
      }
    }));
    const deltas = [];
    const session = createTestSession(harness, scratch);
    const pending = session.ask("long", { onTextDelta: (delta) => deltas.push(delta) });
    while (!turnContext) await new Promise((resolve) => setImmediate(resolve));
    await session.dispose();
    await assert.rejects(() => pending, /disposed/);
    turnContext.api.notification("item/agentMessage/delta", { threadId: turnContext.request.params.threadId, turnId: "long-turn", itemId: "a", delta: "late" });
    assert.deepEqual(deltas, []);
    assert.equal(harness.children[0].messages.some((m) => m.method === "turn/interrupt"), true);
    assert.ok(harness.children[0].killSignals.length >= 1);
    await session.dispose();
  });
});

test("codex-session: a new adapter/session creates a fresh thread and captures its own settings", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ replyText: "ok" }));
    const first = createTestSession(harness, scratch, { systemPrompt: "SETTINGS-A" });
    await first.ask("fire-a");
    await first.dispose();
    const second = createTestSession(harness, scratch, { systemPrompt: "SETTINGS-B" });
    await second.ask("fire-b");
    assert.equal(harness.children.length, 2);
    assert.notEqual(harness.turnRequests[0].params.threadId, harness.turnRequests[1].params.threadId);
    assert.equal(harness.turnRequests[0].params.input[0].text, "SETTINGS-A\n\nfire-a");
    assert.equal(harness.turnRequests[1].params.input[0].text, "SETTINGS-B\n\nfire-b");
    await second.dispose();
  });
});

test("codex-session: observed thread/delete DB failure remains best-effort and still reaps the process", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({
      replyText: "ok",
      onCleanup(request, api) {
        if (request.method === "thread/delete") api.rpcError(request, "no such table: agent_jobs");
        else api.response(request, {});
      }
    }));
    const session = createTestSession(harness, scratch);
    await session.ask("x");
    await session.dispose();
    assert.equal(harness.children[0].messages.some((message) => message.method === "thread/delete"), true);
    assert.ok(harness.children[0].killSignals.length >= 1);
  });
});

test("codex-session: env guard rejects API-key billing variables", () => {
  assert.throws(() => createCodexSession({ env: { OPENAI_API_KEY: "secret" }, codexPath: "fake" }), /OPENAI_API_KEY/);
  assert.throws(() => createCodexSession({ env: { CODEX_API_KEY: "secret" }, codexPath: "fake" }), /CODEX_API_KEY/);
});

test("codex-session: invalid input/concurrent ask/disposed ask fail deterministically", async () => {
  await withScratch(async (scratch) => {
    let pendingTurn;
    const harness = makeSpawnHarness(() => ({
      onTurn(request, api) {
        pendingTurn = { request, api };
        api.response(request, { turn: { id: "pending", status: "inProgress", items: [] } });
      }
    }));
    const session = createTestSession(harness, scratch);
    await assert.rejects(() => session.ask(""), TypeError);
    await assert.rejects(() => session.ask([]), TypeError);
    const pending = session.ask("one");
    while (!pendingTurn) await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(() => session.ask("two"), /concurrent/);
    await session.dispose();
    await assert.rejects(() => pending, /disposed/);
    await assert.rejects(() => session.ask("after"), /disposed/);
  });
});

test("codex-session: exact-id ledger sweep and dispose cleanup never delete bystander rollouts", async () => {
  await withScratch(async (scratch) => {
    const sessionsDir = path.join(scratch.homeDir, ".codex", "sessions", "2026", "08", "30");
    mkdirSync(sessionsDir, { recursive: true });
    const mine = path.join(sessionsDir, "rollout-2026-08-30T01-02-03-owned.jsonl");
    const bystander = path.join(sessionsDir, "rollout-2026-08-30T01-02-03-xxx-owned-yyy.jsonl");
    writeFileSync(mine, "{}\n");
    writeFileSync(bystander, "{}\n");
    writeFileSync(scratch.ledgerPath, JSON.stringify({ threadIds: ["owned"] }));
    const harness = makeSpawnHarness(() => ({ threadId: "new-owned", replyText: "ok" }));
    const session = createTestSession(harness, scratch);
    assert.equal(existsSync(mine), false);
    assert.equal(existsSync(bystander), true);
    await session.ask("x");
    const ownCurrent = path.join(sessionsDir, "rollout-2026-08-30T01-02-03-new-owned.jsonl");
    writeFileSync(ownCurrent, "{}\n");
    await session.dispose();
    assert.equal(existsSync(ownCurrent), false);
    assert.equal(existsSync(bystander), true);
    assert.deepEqual(JSON.parse(readFileSync(scratch.ledgerPath, "utf8")).threadIds, []);
  });
});

test("codex-session: readRateLimits は起動前は null（読むために起こさない）・起動後は account/rateLimits/read（詳細省略）を返す", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness();
    const session = createTestSession(harness, scratch);
    assert.equal(await session.readRateLimits(), null);
    assert.equal(harness.children.length, 0, "起動していなければ spawn しない");
    await session.ask("やあ");
    const read = await session.readRateLimits();
    assert.equal(read.rateLimits.primary.usedPercent, 12);
    const req = harness.children[0].messages.find((m) => m.method === "account/rateLimits/read");
    assert.deepEqual(req.params, { excludeResetCreditDetails: true });
    await session.dispose();
    assert.equal(await session.readRateLimits(), null, "畳んだ後は null");
  });
});

test("codex-session: account/rateLimits/updated 通知は onRateLimits へ（turn の外でも・警告ログに落とさない）", async () => {
  await withScratch(async (scratch) => {
    const warnings = [];
    const updates = [];
    const harness = makeSpawnHarness(() => ({
      onTurn: (request, api) => {
        api.notification("account/rateLimits/updated", { rateLimits: { primary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: null } } });
        successfulTurn(api, request, "うん。");
      }
    }));
    const session = createTestSession(harness, scratch, {
      onWarning: (w) => warnings.push(w),
      onRateLimits: (r) => updates.push(r)
    });
    await session.ask("やあ");
    assert.deepEqual(updates, [{ primary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: null } }]);
    assert.equal(warnings.some((w) => w.includes("rateLimits")), false);
    await session.dispose();
  });
});

// ── 長い配信の文脈（context-growth-2026-10.md §5・§6）────────────────────────────────

const usageOf = (input, { total = input * 3, window = 200_000, cached = 0 } = {}) => ({
  last: { inputTokens: input, cachedInputTokens: cached, cacheWriteInputTokens: 0, outputTokens: 5, reasoningOutputTokens: 0, totalTokens: input + 5 },
  total: { inputTokens: total, cachedInputTokens: cached, cacheWriteInputTokens: 0, outputTokens: 15, reasoningOutputTokens: 0, totalTokens: total + 15 },
  modelContextWindow: window
});

const turnAndInjectMethods = (child) =>
  child.messages.map((m) => m.method).filter((m) => m === "thread/inject_items" || m === "turn/start");

test("codex-session: ask の戻りに tokenUsage（last / total / modelContextWindow）を additive に載せ、usage は従来の形のまま", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ successOptions: { usage: usageOf(1200, { total: 5000, cached: 800 }) } }));
    const session = createTestSession(harness, scratch);
    const result = await session.ask("やあ");
    assert.deepEqual(result.usage, { input_tokens: 1200, cached_input_tokens: 800, output_tokens: 5, reasoning_output_tokens: 0, total_tokens: 1205 });
    assert.deepEqual(result.tokenUsage, {
      last: { inputTokens: 1200, cachedInputTokens: 800, outputTokens: 5, reasoningOutputTokens: 0, totalTokens: 1205 },
      total: { inputTokens: 5000, cachedInputTokens: 800, outputTokens: 15, reasoningOutputTokens: 0, totalTokens: 5015 },
      modelContextWindow: 200_000
    });
    assert.deepEqual(session.getContextUsage(), {
      conversationKey: harness.turnRequests[0].params.threadId,
      lastInputTokens: 1200,
      lastCachedInputTokens: 800,
      totalInputTokens: 5000,
      modelContextWindow: 200_000
    });
    await session.dispose();
    assert.equal(session.getContextUsage(), null);
  });
});

test("codex-session: conversationKey は thread が続く間は同じ・turn の失敗で捨てたら null・次の ask で新しい値", async () => {
  await withScratch(async (scratch) => {
    let turnAttempt = 0;
    const harness = makeSpawnHarness(() => ({
      onTurn(request, api) {
        turnAttempt += 1;
        if (turnAttempt === 2) {
          api.response(request, { turn: { id: "bad", status: "inProgress", items: [] } });
          api.notification("turn/completed", { threadId: request.params.threadId, turn: { id: "bad", status: "failed", items: [], error: { message: "boom" } } });
          return;
        }
        successfulTurn(api, request, "ok", { usage: usageOf(100) });
      }
    }));
    const session = createTestSession(harness, scratch);
    assert.equal(session.conversationKey(), null, "まだ thread が無い");
    await session.ask("one");
    const first = session.conversationKey();
    assert.equal(typeof first, "string");
    await assert.rejects(() => session.ask("two"), /boom/);
    assert.equal(session.conversationKey(), null, "turn の失敗で thread を捨てた");
    assert.equal(session.getContextUsage(), null);
    await session.ask("three");
    assert.notEqual(session.conversationKey(), first);
    await session.dispose();
  });
});

test("codex-session: compact は thread/compact/start → 圧縮の turn の完了を待ち → 最初と同じ人格の指示を 1 回だけ inject_items", async () => {
  await withScratch(async (scratch) => {
    const warnings = [];
    const harness = makeSpawnHarness(() => ({
      successOptions: { usage: usageOf(150_000) },
      onCompact: (request, api) => successfulCompaction(api, request, { usage: usageOf(160_000) })
    }));
    const session = createTestSession(harness, scratch, { systemPrompt: "PERSONA", onWarning: (w) => warnings.push(w) });
    assert.deepEqual(await session.compact(), { compacted: false, reason: "no-conversation" });
    await session.ask("hello");
    const threadId = session.conversationKey();
    const result = await session.compact();
    assert.equal(result.compacted, true);
    assert.equal(result.personaInjected, true);
    assert.equal(result.personaDeferred, false);
    assert.equal(result.before.lastInputTokens, 150_000);
    assert.equal(result.compactionUsage.last.inputTokens, 160_000);
    assert.ok(result.durationMs >= 0);
    const messages = harness.children[0].messages;
    const compactReq = messages.find((m) => m.method === "thread/compact/start");
    assert.deepEqual(compactReq.params, { threadId });
    const injects = messages.filter((m) => m.method === "thread/inject_items");
    assert.equal(injects.length, 1);
    assert.deepEqual(injects[0].params, {
      threadId,
      items: [{ type: "message", role: "user", content: [{ type: "input_text", text: "PERSONA" }] }]
    });
    assert.equal(session.getContextUsage(), null, "圧縮前の大きさはもう古い");
    assert.equal(session.conversationKey(), threadId, "圧縮しても会話は同じ thread");
    assert.equal(session.isCompacting(), false);
    // 圧縮の turn の通知は警告に落とさない（ask の外の turn として受ける）。
    assert.equal(warnings.length, 0, warnings.join("\n"));
    // 次の ask は普段どおり（人格の指示を連結しない・同じ thread）。
    await session.ask("after");
    const lastTurn = harness.turnRequests.at(-1);
    assert.equal(lastTurn.params.threadId, threadId);
    assert.deepEqual(lastTurn.params.input, [{ type: "text", text: "after" }]);
    assert.equal(messages.filter((m) => m.method === "thread/inject_items").length, 1, "普段の ask では差し込まない");
    await session.dispose();
  });
});

test("codex-session: 圧縮の処理中の ask は終わる（人格の差し込みまで）を待ってから turn を始める", async () => {
  await withScratch(async (scratch) => {
    let compactCtx = null;
    const harness = makeSpawnHarness(() => ({
      onCompact: (request, api) => { compactCtx = { request, api }; api.response(request, {}); }
    }));
    const session = createTestSession(harness, scratch, { systemPrompt: "P" });
    await session.ask("one");
    const compacting = session.compact();
    while (!compactCtx) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(session.isCompacting(), true);
    assert.deepEqual(await session.compact(), { compacted: false, reason: "in-progress" });
    const asking = session.ask("two");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(harness.turnRequests.length, 1, "圧縮の最中は turn を始めない");
    const threadId = compactCtx.request.params.threadId;
    compactCtx.api.notification("turn/started", { threadId, turn: { id: "ct", status: "inProgress", items: [] } });
    compactCtx.api.notification("turn/completed", { threadId, turn: { id: "ct", status: "completed", items: [] } });
    assert.equal((await compacting).compacted, true);
    await asking;
    assert.deepEqual(turnAndInjectMethods(harness.children[0]), ["turn/start", "thread/inject_items", "turn/start"], "差し込みが ask の turn より先");
    await session.dispose();
  });
});

test("codex-session: 圧縮が待ちの上限を超えたら ask は待つのをやめて turn を始め、遅れた圧縮の通知は ask を壊さない", async () => {
  await withScratch(async (scratch) => {
    let compactCtx = null;
    const harness = makeSpawnHarness(() => ({
      onCompact: (request, api) => {
        compactCtx = { request, api };
        api.response(request, {});
        api.notification("turn/started", { threadId: request.params.threadId, turn: { id: "slow-compact", status: "inProgress", items: [] } });
      }
    }));
    const session = createTestSession(harness, scratch, { systemPrompt: "P", compactionWaitMs: 15 });
    await session.ask("one");
    const compacting = session.compact();
    while (!compactCtx) await new Promise((resolve) => setImmediate(resolve));
    const second = await session.ask("two");
    assert.equal(second.replyText, "はい。", "待ちきれずに turn を始めた");
    assert.equal(harness.turnRequests.length, 2);
    // ask の turn の後に圧縮が終わる（ask は終わっているのでその場で差し込む）。
    const threadId = compactCtx.request.params.threadId;
    compactCtx.api.notification("item/completed", { threadId, turnId: "slow-compact", item: { id: "c", type: "contextCompaction" } });
    compactCtx.api.notification("turn/completed", { threadId, turn: { id: "slow-compact", status: "completed", items: [] } });
    const result = await compacting;
    assert.equal(result.compacted, true);
    assert.equal(result.personaInjected, true);
    await session.ask("three");
    assert.deepEqual(turnAndInjectMethods(harness.children[0]), ["turn/start", "turn/start", "thread/inject_items", "turn/start"]);
    await session.dispose();
  });
});

test("codex-session: ask の turn の最中に圧縮が済んだら、差し込みは次の turn の前に回す（1 回だけ）", async () => {
  await withScratch(async (scratch) => {
    let compactCtx = null;
    let heldTurn = null;
    let turnCount = 0;
    const harness = makeSpawnHarness(() => ({
      onCompact: (request, api) => {
        compactCtx = { request, api };
        api.response(request, {});
        api.notification("turn/started", { threadId: request.params.threadId, turn: { id: "cmp", status: "inProgress", items: [] } });
      },
      onTurn: (request, api) => {
        turnCount += 1;
        if (turnCount === 2) heldTurn = { request, api };
        else successfulTurn(api, request, "ok");
      }
    }));
    const session = createTestSession(harness, scratch, { systemPrompt: "P", compactionWaitMs: 10 });
    await session.ask("one");
    const compacting = session.compact();
    while (!compactCtx) await new Promise((resolve) => setImmediate(resolve));
    const asking = session.ask("two");
    while (!heldTurn) await new Promise((resolve) => setImmediate(resolve));
    const threadId = compactCtx.request.params.threadId;
    compactCtx.api.notification("turn/completed", { threadId, turn: { id: "cmp", status: "completed", items: [] } });
    const result = await compacting;
    assert.equal(result.personaInjected, false);
    assert.equal(result.personaDeferred, true);
    successfulTurn(heldTurn.api, heldTurn.request, "ok");
    await asking;
    await session.ask("three");
    await session.ask("four");
    assert.deepEqual(turnAndInjectMethods(harness.children[0]), ["turn/start", "turn/start", "thread/inject_items", "turn/start", "turn/start"]);
    await session.dispose();
  });
});

test("codex-session: 圧縮の失敗（RPC error / turn failed）は compacted:false で返し、会話はそのまま・差し込まない", async () => {
  await withScratch(async (scratch) => {
    let compactAttempt = 0;
    const harness = makeSpawnHarness(() => ({
      onCompact: (request, api) => {
        compactAttempt += 1;
        if (compactAttempt === 1) {
          api.rpcError(request, "nope");
          return;
        }
        api.response(request, {});
        const threadId = request.params.threadId;
        api.notification("turn/started", { threadId, turn: { id: "fc", status: "inProgress", items: [] } });
        api.notification("turn/completed", { threadId, turn: { id: "fc", status: "failed", items: [], error: { message: "compact backend failed" } } });
      }
    }));
    const session = createTestSession(harness, scratch);
    await session.ask("one");
    const key = session.conversationKey();
    const rpcFailed = await session.compact();
    assert.equal(rpcFailed.compacted, false);
    assert.match(rpcFailed.message, /nope/);
    const turnFailed = await session.compact();
    assert.equal(turnFailed.compacted, false);
    assert.match(turnFailed.message, /compact backend failed/);
    assert.equal(session.conversationKey(), key);
    assert.equal(harness.children[0].messages.some((m) => m.method === "thread/inject_items"), false);
    assert.equal((await session.ask("two")).replyText, "はい。");
    await session.dispose();
  });
});

test("codex-session: ask の最中は compact しない（busy）・dispose は圧縮の待ちを畳む", async () => {
  await withScratch(async (scratch) => {
    let pendingTurn = null;
    let compactCtx = null;
    let turnCount = 0;
    const harness = makeSpawnHarness(() => ({
      onTurn: (request, api) => {
        turnCount += 1;
        if (turnCount === 2) pendingTurn = { request, api };
        else successfulTurn(api, request, "ok");
      },
      onCompact: (request, api) => { compactCtx = { request, api }; api.response(request, {}); }
    }));
    const session = createTestSession(harness, scratch);
    await session.ask("one");
    const asking = session.ask("two");
    while (!pendingTurn) await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(await session.compact(), { compacted: false, reason: "busy" });
    successfulTurn(pendingTurn.api, pendingTurn.request, "ok");
    await asking;
    const compacting = session.compact();
    while (!compactCtx) await new Promise((resolve) => setImmediate(resolve));
    await session.dispose();
    const result = await compacting;
    assert.equal(result.compacted, false);
    assert.match(result.message, /disposed/);
  });
});

// ── 記憶の作り直し Wave 1 Domain A: MCP の切り離し・役ごとの設定・最後の答えだけの組み立て ──────────────

/** ツールを使う turn（実機の流れ: 前置きの agentMessage → commandExecution → fileChange → 答えの agentMessage）。 */
function toolTurn(api, request, { commentary = "読みます。", answer = "答え。", phases = ["commentary", "final_answer"] } = {}) {
  const threadId = request.params.threadId;
  const turnId = `tool-turn-${request.id}`;
  api.response(request, { turn: { id: turnId, status: "inProgress", items: [] } });
  api.notification("turn/started", { threadId, turn: { id: turnId, status: "inProgress", items: [] } });
  const agent = (id, text, phase) => {
    api.notification("item/started", { threadId, turnId, item: { id, type: "agentMessage", text: "", phase: null } });
    for (const delta of [...text]) api.notification("item/agentMessage/delta", { threadId, turnId, itemId: id, delta });
    api.notification("item/completed", { threadId, turnId, item: { id, type: "agentMessage", text, phase } });
  };
  agent("a1", commentary, phases[0]);
  api.notification("item/started", { threadId, turnId, item: { id: "c1", type: "commandExecution", status: "inProgress", command: "Get-Content x" } });
  api.notification("item/commandExecution/outputDelta", { threadId, turnId, itemId: "c1", delta: "out" });
  api.notification("item/completed", { threadId, turnId, item: { id: "c1", type: "commandExecution", status: "completed", exitCode: 0 } });
  api.notification("item/started", { threadId, turnId, item: { id: "f1", type: "fileChange", status: "inProgress", changes: [] } });
  api.notification("item/fileChange/patchUpdated", { threadId, turnId, itemId: "f1" });
  api.notification("item/completed", { threadId, turnId, item: { id: "f1", type: "fileChange", status: "completed", changes: [] } });
  api.notification("turn/diff/updated", { threadId, turnId, diff: "" });
  api.notification("turn/plan/updated", { threadId, turnId, plan: [] });
  api.notification("serverRequest/resolved", { threadId, requestId: 1 });
  agent("a2", answer, phases[1]);
  api.notification("turn/completed", { threadId, turn: { id: turnId, status: "completed", items: [] } });
}

test("codex-session: 起動引数でプラグインとアプリと notify フックを止め、既定の thread/turn は今と同じ（一時フォルダ・read-only・never）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness();
    const warnings = [];
    const session = createTestSession(harness, scratch, { onWarning: (w) => warnings.push(w) });
    await session.ask("q");
    assert.deepEqual(harness.spawnCalls[0].args, [
      "app-server", "--stdio", "-c", 'forced_login_method="chatgpt"', "-c", 'web_search="disabled"',
      "-c", "features.plugins=false", "-c", "features.apps=false",
      // ユーザー設定の notify フックを引き継がない（記憶の作り直し Wave 2・ユーザー決定）。
      "-c", "notify=[]"
    ]);
    assert.deepEqual(harness.spawnCalls[0].args, [...APP_SERVER_ARGS]);
    const spawnCwd = harness.spawnCalls[0].options.cwd;
    assert.equal(path.dirname(spawnCwd), path.resolve(os.tmpdir()));
    assert.match(path.basename(spawnCwd), /^codex-app-server-session-/);
    const thread = harness.threadRequests[0].params;
    assert.equal(thread.cwd, spawnCwd);
    assert.equal(thread.sandbox, "read-only");
    assert.equal(thread.approvalPolicy, "never");
    // MCP サーバーが設定に無ければ、thread/start の config は今までと同じ。
    assert.deepEqual(thread.config, { forced_login_method: "chatgpt", web_search: "disabled" });
    const turn = harness.turnRequests[0].params;
    assert.equal(turn.cwd, spawnCwd);
    assert.equal(turn.approvalPolicy, "never");
    assert.deepEqual(turn.sandboxPolicy, { type: "readOnly", networkAccess: false });
    const configRead = harness.children[0].messages.find((m) => m.method === "config/read");
    assert.deepEqual(configRead.params, { includeLayers: false, cwd: spawnCwd });
    assert.deepEqual(warnings, []);
    await session.dispose();
    assert.equal(existsSync(spawnCwd), false);
  });
});

test("codex-session: ユーザー設定の [mcp_servers] は名前だけ読んで thread/start で 1 つずつ止める（config/read は接続ごとに 1 回）", async () => {
  await withScratch(async (scratch) => {
    let turns = 0;
    const harness = makeSpawnHarness(() => ({
      effectiveConfig: { mcp_servers: { node_repl: { command: "secret-cmd", env: { TOKEN: "x" } }, blender: { command: "b" } } },
      onTurn(request, api) {
        turns += 1;
        if (turns === 1) {
          api.response(request, { turn: { id: "bad", status: "inProgress", items: [] } });
          api.notification("turn/completed", { threadId: request.params.threadId, turn: { id: "bad", status: "failed", error: { message: "boom" } } });
        } else successfulTurn(api, request, "ok");
      }
    }));
    const session = createTestSession(harness, scratch);
    await session.initialize();
    const messages = harness.children[0].messages;
    assert.equal(messages.filter((m) => m.method === "config/read").length, 1, "initialize で先に読む");
    await assert.rejects(() => session.ask("one"), /boom/);
    await session.ask("two");
    await session.ask("three");
    assert.equal(harness.threadRequests.length, 2, "turn の失敗で thread を作り直す");
    for (const request of harness.threadRequests) {
      assert.deepEqual(request.params.config, {
        forced_login_method: "chatgpt", web_search: "disabled",
        mcp_servers: { node_repl: { enabled: false }, blender: { enabled: false } }
      });
    }
    assert.equal(messages.filter((m) => m.method === "config/read").length, 1, "同じ接続では読み直さない");
    const configIndex = messages.findIndex((m) => m.method === "config/read");
    const threadIndex = messages.findIndex((m) => m.method === "thread/start");
    assert.ok(configIndex < threadIndex);
    await session.dispose();
  });
});

test("codex-session: 接続を作り直したら config/read も読み直す", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness((processIndex) => ({
      effectiveConfig: { mcp_servers: { [`server${processIndex}`]: {} } },
      onTurn(request, api, child) {
        if (processIndex === 0) {
          api.response(request, { turn: { id: "t", status: "inProgress", items: [] } });
          child.exit(1);
        } else successfulTurn(api, request, "ok");
      }
    }));
    const session = createTestSession(harness, scratch);
    await assert.rejects(() => session.ask("one"));
    await session.ask("two");
    assert.equal(harness.children.length, 2);
    assert.deepEqual(harness.threadRequests[1].params.config.mcp_servers, { server1: { enabled: false } });
    assert.equal(harness.children[1].messages.filter((m) => m.method === "config/read").length, 1);
    await session.dispose();
  });
});

test("codex-session: config/read が失敗しても会話は続け、警告を 1 回出す（中身は出さない）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ onConfigRead: (request, api) => api.rpcError(request, "unknown method") }));
    const warnings = [];
    const session = createTestSession(harness, scratch, { onWarning: (w) => warnings.push(w) });
    assert.equal((await session.ask("q")).replyText, "はい。");
    await session.ask("q2");
    assert.deepEqual(harness.threadRequests[0].params.config, { forced_login_method: "chatgpt", web_search: "disabled" });
    assert.deepEqual(warnings, ["codex-session: could not read the MCP server list; user MCP servers may start."]);
    // 呼び出し側が一致で判定できる決まった値（記憶の作り直し Wave 2 からの申し送り 2）。
    assert.equal(warnings[0], MCP_CONFIG_READ_FAILED_WARNING);
    await session.dispose();
  });
});

test("codex-session: mcpServerDisableOverrides は名前だけを写し、無い・形が違えば null", () => {
  assert.deepEqual(mcpServerDisableOverrides({ config: { mcp_servers: { a: { command: "x" }, b: {} } } }), { a: { enabled: false }, b: { enabled: false } });
  assert.equal(mcpServerDisableOverrides({ config: { mcp_servers: {} } }), null);
  assert.equal(mcpServerDisableOverrides({ config: {} }), null);
  assert.equal(mcpServerDisableOverrides({ config: { mcp_servers: [] } }), null);
  assert.equal(mcpServerDisableOverrides(null), null);
});

test("codex-session: 役の cwd と workspace-write を thread/start・turn/start の両方に揃えて渡し、役の cwd は消さない", async () => {
  await withScratch(async (scratch) => {
    const roleCwd = mkdtempSync(path.join(scratch.homeDir, "role-"));
    let imagePath = null;
    const harness = makeSpawnHarness(() => ({
      onTurn(request, api) {
        imagePath = request.params.input.find((item) => item.type === "localImage")?.path ?? imagePath;
        successfulTurn(api, request, "ok");
      }
    }));
    const session = createTestSession(harness, scratch, { cwd: roleCwd, sandbox: "workspace-write" });
    await session.ask([{ type: "image", source: { type: "base64", media_type: "image/png", data: "AA==" } }, { type: "text", text: "q" }]);
    await session.ask("q2");
    const thread = harness.threadRequests[0].params;
    assert.equal(thread.cwd, roleCwd);
    assert.equal(thread.sandbox, "workspace-write");
    assert.equal(thread.approvalPolicy, "never");
    for (const request of harness.turnRequests) {
      assert.equal(request.params.cwd, roleCwd);
      assert.equal(request.params.approvalPolicy, "never");
      assert.deepEqual(request.params.sandboxPolicy, {
        type: "workspaceWrite", writableRoots: [], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false
      });
    }
    const configRead = harness.children[0].messages.find((m) => m.method === "config/read");
    assert.equal(configRead.params.cwd, roleCwd, "役の cwd から見た実効の設定で MCP を読む");
    // 画像の一時ファイルとプロセスの cwd は、役の cwd（記憶のフォルダ）を汚さない。
    const spawnCwd = harness.spawnCalls[0].options.cwd;
    assert.notEqual(spawnCwd, roleCwd);
    assert.equal(path.dirname(imagePath), spawnCwd);
    await session.dispose();
    assert.equal(existsSync(roleCwd), true);
    assert.equal(existsSync(spawnCwd), false);
  });
});

test("codex-session: 役の cwd だけを指定すると sandbox は read-only のまま", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness();
    const session = createTestSession(harness, scratch, { cwd: scratch.homeDir });
    await session.ask("q");
    assert.equal(harness.threadRequests[0].params.cwd, scratch.homeDir);
    assert.equal(harness.threadRequests[0].params.sandbox, "read-only");
    assert.deepEqual(harness.turnRequests[0].params.sandboxPolicy, { type: "readOnly", networkAccess: false });
    await session.dispose();
  });
});

test("codex-session: 役の設定の誤りは起動前に TypeError（プロセスを起こさない）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness();
    assert.throws(() => createTestSession(harness, scratch, { sandbox: "danger-full-access" }), TypeError);
    assert.throws(() => createTestSession(harness, scratch, { sandbox: "workspaceWrite" }), TypeError);
    assert.throws(() => createTestSession(harness, scratch, { cwd: "relative/dir" }), TypeError);
    assert.throws(() => createTestSession(harness, scratch, { cwd: 42 }), TypeError);
    assert.equal(harness.spawnCalls.length, 0);
  });
});

test("codex-session: finalAnswerOnly は phase=final_answer だけを返し、ツールの通知は警告にしない（delta は全部流す）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ onTurn: (request, api) => toolTurn(api, request) }));
    const warnings = [];
    const deltas = [];
    const session = createTestSession(harness, scratch, { finalAnswerOnly: true, onWarning: (w) => warnings.push(w) });
    const result = await session.ask("q", { onTextDelta: (delta) => deltas.push(delta) });
    assert.equal(result.replyText, "答え。");
    assert.equal(deltas.join(""), "読みます。答え。");
    assert.deepEqual(warnings, []);
    await session.dispose();
  });
});

test("codex-session: finalAnswerOnly で phase が無ければ最後の agentMessage を答えにする", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ onTurn: (request, api) => toolTurn(api, request, { phases: [null, null] }) }));
    const session = createTestSession(harness, scratch, { finalAnswerOnly: true });
    assert.equal((await session.ask("q")).replyText, "答え。");
    await session.dispose();
  });
});

test("codex-session: 既定（finalAnswerOnly なし）は今までどおり agentMessage を全部つなげる・ツールの通知は警告にしない", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ onTurn: (request, api) => toolTurn(api, request) }));
    const warnings = [];
    const session = createTestSession(harness, scratch, { onWarning: (w) => warnings.push(w) });
    assert.equal((await session.ask("q")).replyText, "読みます。答え。");
    assert.deepEqual(warnings, []);
    await session.dispose();
  });
});

// ── 応答の遅れの直し（latency-fix-plan.md §2-1・§2-2）────────────────────────────────────────

/** テスト用の記録ファイル（~/.codex/sessions/ の下）を置く。 */
function seedRollout(homeDir, threadId) {
  const dir = path.join(homeDir, ".codex", "sessions", "2026", "10", "27");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `rollout-2026-10-27T19-10-00-${threadId}.jsonl`);
  writeFileSync(file, "{}\n");
  return file;
}

test("codex-session: 使い捨て（書き出し役・思い出し役）を作っても、生きているチャッピーの記録ファイルは消えない（sweep-repro の形）", async () => {
  await withScratch(async (scratch) => {
    const cohostId = "lf-cohost-0001";
    const cohostHarness = makeSpawnHarness(() => ({ threadId: cohostId, replyText: "そうだね。" }));
    const cohost = createTestSession(cohostHarness, scratch);
    await cohost.ask("やあ");
    // Codex が書いた①の記録（ここではテストが置く）と台帳。
    const rollout = seedRollout(scratch.homeDir, cohostId);
    assert.deepEqual(JSON.parse(readFileSync(scratch.ledgerPath, "utf8")).threadIds, [cohostId]);

    // ②書き出し役・④思い出し役（使い捨て）を作り、走らせて片付ける。
    for (const sandbox of ["workspace-write", "read-only"]) {
      const writerHarness = makeSpawnHarness(() => ({
        onThread: (request, api) => api.response(request, { thread: { id: `lf-writer-${sandbox}`, ephemeral: true } }),
        replyText: "済み"
      }));
      const writer = createTestSession(writerHarness, scratch, { ephemeral: true, sandbox, finalAnswerOnly: true });
      assert.equal(existsSync(rollout), true, "使い捨てを作っても消えない");
      await writer.ask("書いて");
      assert.equal(writerHarness.threadRequests[0].params.ephemeral, true, "thread/start に ephemeral: true");
      await writer.dispose();
      assert.equal(
        writerHarness.children[0].messages.some((m) => m.method === "thread/delete"),
        false,
        "記録の無い thread は thread/delete しない（not persisted で失敗するため）"
      );
      assert.equal(existsSync(rollout), true, "使い捨てを片付けても消えない");
      assert.deepEqual(JSON.parse(readFileSync(scratch.ledgerPath, "utf8")).threadIds, [cohostId], "使い捨ては台帳に載らない");
    }

    // 使い捨てでない 2 つ目のセッション（頭の作り直し等）を作っても、掃除は 1 回だけなので消えない。
    const secondHarness = makeSpawnHarness(() => ({ threadId: "lf-second-0001" }));
    const second = createTestSession(secondHarness, scratch);
    assert.equal(existsSync(rollout), true, "2 つ目の常駐のセッションを作っても消えない");
    assert.equal(secondHarness.threadRequests.length, 0);
    await second.dispose();

    assert.equal((await cohost.ask("続き")).replyText, "そうだね。");
    assert.equal(existsSync(rollout), true);
    await cohost.dispose();
    assert.equal(existsSync(rollout), false, "①を片付けたら自分の記録は消す（今までどおり）");
    assert.deepEqual(JSON.parse(readFileSync(scratch.ledgerPath, "utf8")).threadIds, []);
  });
});

test("codex-session: sweepCodexRollouts は 1 台帳につき 1 回だけ・生きている thread の記録は残す", async () => {
  await withScratch(async (scratch) => {
    const liveId = "lf-live-0002";
    const harness = makeSpawnHarness(() => ({ threadId: liveId }));
    const session = createTestSession(harness, scratch);
    await session.ask("x");
    const liveRollout = seedRollout(scratch.homeDir, liveId);
    const staleRollout = seedRollout(scratch.homeDir, "lf-stale-0002");
    // 別の台帳（前回の起動の取り残し + 今生きている thread）を掃除する。
    const otherLedger = path.join(scratch.homeDir, "other-ledger.json");
    writeFileSync(otherLedger, JSON.stringify({ threadIds: [liveId, "lf-stale-0002"] }));
    assert.deepEqual(sweepCodexRollouts({ homeDir: scratch.homeDir, ledgerPath: otherLedger }), { swept: true, deleted: 1, kept: 1 });
    assert.equal(existsSync(liveRollout), true, "生きている thread の記録は消さない");
    assert.equal(existsSync(staleRollout), false, "取り残しは消す");
    assert.deepEqual(JSON.parse(readFileSync(otherLedger, "utf8")).threadIds, [liveId], "生きている thread は台帳に残す");
    // 2 回目は何もしない（起動時に 1 回だけ）。
    const laterStale = seedRollout(scratch.homeDir, "lf-later-0002");
    writeFileSync(otherLedger, JSON.stringify({ threadIds: ["lf-later-0002"] }));
    assert.deepEqual(sweepCodexRollouts({ homeDir: scratch.homeDir, ledgerPath: otherLedger }), { swept: false, deleted: 0, kept: 0 });
    assert.equal(existsSync(laterStale), true);
    // createCodexSession が最初に作られたときに済ませた台帳も、2 回目は走らない。
    assert.equal(sweepCodexRollouts({ homeDir: scratch.homeDir, ledgerPath: scratch.ledgerPath }).swept, false);
    await session.dispose();
  });
});

test("codex-session: ephemeral を頼んでも応答の thread が ephemeral でなければ、今までどおり台帳に載せて片付ける", async () => {
  await withScratch(async (scratch) => {
    const id = "lf-not-ephemeral-0003";
    const harness = makeSpawnHarness(() => ({ threadId: id }));
    const session = createTestSession(harness, scratch, { ephemeral: true });
    await session.ask("x");
    assert.equal(harness.threadRequests[0].params.ephemeral, true);
    assert.deepEqual(JSON.parse(readFileSync(scratch.ledgerPath, "utf8")).threadIds, [id]);
    const rollout = seedRollout(scratch.homeDir, id);
    await session.dispose();
    assert.equal(harness.children[0].messages.some((m) => m.method === "thread/delete"), true);
    assert.equal(existsSync(rollout), false);
    assert.deepEqual(JSON.parse(readFileSync(scratch.ledgerPath, "utf8")).threadIds, []);
  });
});

test("codex-session: 既定（使い捨てでない）の thread/start は ephemeral を送らない", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ threadId: "lf-default-0004" }));
    const session = createTestSession(harness, scratch);
    await session.ask("x");
    assert.equal(Object.hasOwn(harness.threadRequests[0].params, "ephemeral"), false);
    await session.dispose();
  });
});

test("codex-session: onTextDone は本文が揃った agentMessage の item/completed で 1 回・turn/completed より前に呼ぶ（本文は渡さない）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ threadId: "lf-done-0005", replyText: "そうだね。" }));
    const session = createTestSession(harness, scratch);
    /** @type {Array<any>} */
    const events = [];
    const result = await session.ask("q", {
      onTextDelta: (delta) => events.push({ delta }),
      onTextDone: (meta) => events.push({ done: meta })
    });
    events.push("resolved");
    const doneIndexes = events.flatMap((e, i) => (e && typeof e === "object" && "done" in e ? [i] : []));
    assert.equal(doneIndexes.length, 1);
    assert.equal(doneIndexes[0], events.length - 2, "全部の delta の後・ask が返る前");
    assert.equal(events.slice(0, doneIndexes[0]).map((e) => e.delta).join(""), result.replyText);
    const meta = events[doneIndexes[0]].done;
    assert.equal(meta.phase, null, "phase の無い agentMessage も締めの合図を出す");
    assert.equal(typeof meta.itemId, "string");
    assert.equal(Object.hasOwn(meta, "text"), false);
    assert.ok(meta.elapsedMs >= 0);
    await session.dispose();
  });
});

test("codex-session: onTextDone は前置き（commentary）では呼ばず、final_answer で呼ぶ", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ threadId: "lf-done-0006", onTurn: (request, api) => toolTurn(api, request) }));
    const session = createTestSession(harness, scratch, { finalAnswerOnly: true });
    /** @type {Array<string | null>} */
    const done = [];
    await session.ask("q", { onTextDone: (meta) => done.push(meta.phase) });
    assert.deepEqual(done, ["final_answer"]);
    await session.dispose();
  });
});

test("codex-session: delta の累積と item の text が合わなければ onTextDone を呼ばずに turn を失敗にする", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({
      threadId: "lf-done-0007",
      onTurn: (request, api) => {
        const threadId = request.params.threadId;
        const turnId = `t-${request.id}`;
        api.response(request, { turn: { id: turnId, status: "inProgress", items: [] } });
        api.notification("item/started", { threadId, turnId, item: { id: "a", type: "agentMessage", text: "" } });
        api.notification("item/agentMessage/delta", { threadId, turnId, itemId: "a", delta: "そう" });
        api.notification("item/completed", { threadId, turnId, item: { id: "a", type: "agentMessage", text: "そうだね。" } });
        api.notification("turn/completed", { threadId, turn: { id: turnId, status: "completed", items: [] } });
      }
    }));
    const session = createTestSession(harness, scratch);
    let called = 0;
    await assert.rejects(() => session.ask("q", { onTextDone: () => { called += 1; } }), /does not match/);
    assert.equal(called, 0);
    await session.dispose();
  });
});

// ── 速さの段（service tier・操縦席の fast の切り替え・2026-10-27 実機確認 0.163.0）──────────────────────

const modelListRequests = (child) => child.messages.filter((m) => m.method === "model/list");

test("serviceTiersFromModelList: id か model が一致するモデルの段の id だけ・見つからなければ undefined", () => {
  const page = {
    data: [
      { id: "gpt-6.1-sol", model: "gpt-6.1-sol", serviceTiers: [{ id: "priority", name: "Fast" }], defaultServiceTier: null },
      { id: "x", model: "gpt-old", serviceTiers: [] },
      { id: "broken", serviceTiers: [{ name: "no id" }, null] }
    ]
  };
  assert.deepEqual(serviceTiersFromModelList(page, "gpt-6.1-sol"), ["priority"]);
  assert.deepEqual(serviceTiersFromModelList(page, "gpt-old"), []);
  assert.deepEqual(serviceTiersFromModelList(page, "broken"), []);
  assert.equal(serviceTiersFromModelList(page, "gpt-none"), undefined);
  assert.equal(serviceTiersFromModelList(null, "gpt-6.1-sol"), undefined);
  assert.deepEqual(SERVICE_TIERS, ["default", "priority"]);
});

test("codex-session: serviceTier を渡すと turn/start に送り、同じ thread のまま priority → default → priority と切り替わる（作り直さない）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ threadId: "tier-0001" }));
    /** @type {any[]} */
    const tierInfos = [];
    const warnings = [];
    const session = createTestSession(harness, scratch, {
      onServiceTiers: (info) => tierInfos.push(info),
      onWarning: (w) => warnings.push(w)
    });
    /** @type {any[]} */
    const started = [];
    const a = await session.ask("q1", { serviceTier: "priority", onTurnStarted: (meta) => started.push(meta) });
    const b = await session.ask("q2", { serviceTier: "default", onTurnStarted: (meta) => started.push(meta) });
    const c = await session.ask("q3", { serviceTier: "priority" });
    const d = await session.ask("q4");
    assert.deepEqual(harness.turnRequests.map((r) => r.params.serviceTier), ["priority", "default", "priority", undefined], "指定しなければ送らない");
    assert.deepEqual([a.serviceTier, b.serviceTier, c.serviceTier, d.serviceTier], ["priority", "default", "priority", null]);
    assert.equal(harness.threadRequests.length, 1, "thread は作り直さない");
    assert.equal(harness.children.length, 1);
    assert.equal("serviceTier" in harness.threadRequests[0].params, false, "thread/start には渡さない（turn/start で切り替える）");
    assert.equal(modelListRequests(harness.children[0]).length, 1, "model/list は接続ごとに 1 回");
    assert.deepEqual(modelListRequests(harness.children[0])[0].params, { includeHidden: true });
    assert.deepEqual(tierInfos, [{ model: "gpt-5.6-terra", serviceTiers: ["priority"] }]);
    assert.deepEqual(started.map((m) => [m.threadId, m.serviceTier]), [["tier-0001", "priority"], ["tier-0001", "default"]]);
    assert.ok(started.every((m) => typeof m.turnId === "string"));
    assert.deepEqual(warnings, []);
    await session.dispose();
  });
});

test("codex-session: thread/settings/updated は黙って受ける（未対応の通知の警告を出さない）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({
      threadId: "tier-0002",
      onTurn: (request, api) => {
        api.notification("thread/settings/updated", {
          threadId: request.params.threadId,
          threadSettings: { serviceTier: request.params.serviceTier ?? null, model: "gpt-5.6-terra" }
        });
        successfulTurn(api, request, "はい。");
      }
    }));
    const warnings = [];
    const session = createTestSession(harness, scratch, { onWarning: (w) => warnings.push(w) });
    const result = await session.ask("q", { serviceTier: "priority" });
    assert.equal(result.replyText, "はい。");
    assert.deepEqual(warnings, []);
    await session.dispose();
  });
});

test("codex-session: モデルが priority を持たない・一覧に無いなら priority を求めても default を送る（400 で turn を落とさない）", async () => {
  await withScratch(async (scratch) => {
    for (const models of [
      [{ id: "gpt-5.6-terra", model: "gpt-5.6-terra", serviceTiers: [] }],
      [{ id: "other", model: "other", serviceTiers: [{ id: "priority" }] }]
    ]) {
      const harness = makeSpawnHarness(() => ({ models }));
      /** @type {any[]} */
      const tierInfos = [];
      const session = createTestSession(harness, scratch, { onServiceTiers: (info) => tierInfos.push(info) });
      const result = await session.ask("q", { serviceTier: "priority" });
      assert.equal(harness.turnRequests[0].params.serviceTier, "default");
      assert.equal(result.serviceTier, "default");
      assert.deepEqual(tierInfos, [{ model: "gpt-5.6-terra", serviceTiers: [] }]);
      await session.dispose();
    }
  });
});

test("codex-session: model/list はページを辿ってモデルを探す", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({
      onModelList: (request, api) => {
        if (!request.params.cursor) api.response(request, { data: [{ id: "a", model: "a", serviceTiers: [] }], nextCursor: "p2" });
        else api.response(request, { data: [{ id: "gpt-5.6-terra", model: "gpt-5.6-terra", serviceTiers: [{ id: "priority" }] }], nextCursor: null });
      }
    }));
    const session = createTestSession(harness, scratch);
    const result = await session.ask("q", { serviceTier: "priority" });
    assert.equal(result.serviceTier, "priority");
    assert.deepEqual(modelListRequests(harness.children[0]).map((m) => m.params.cursor ?? null), [null, "p2"]);
    await session.dispose();
  });
});

test("codex-session: model/list が読めなければ警告を 1 回出し、この接続では default を送る（会話は続ける）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({ onModelList: (request, api) => api.rpcError(request, "nope") }));
    const warnings = [];
    /** @type {any[]} */
    const tierInfos = [];
    const session = createTestSession(harness, scratch, { onWarning: (w) => warnings.push(w), onServiceTiers: (info) => tierInfos.push(info) });
    const first = await session.ask("q1", { serviceTier: "priority" });
    const second = await session.ask("q2", { serviceTier: "priority" });
    assert.equal(first.replyText, "はい。");
    assert.deepEqual([first.serviceTier, second.serviceTier], ["default", "default"]);
    assert.deepEqual(warnings, [MODEL_LIST_FAILED_WARNING]);
    assert.deepEqual(tierInfos, [{ model: "gpt-5.6-terra", serviceTiers: null }]);
    assert.equal(modelListRequests(harness.children[0]).length, 1, "失敗も接続ごとに 1 回だけ");
    await session.dispose();
  });
});

test("codex-session: default だけを求めるときは model/list を待たずに送る（対応の有無は裏で読んで知らせる）", async () => {
  await withScratch(async (scratch) => {
    /** @type {any} */
    let pendingList = null;
    const harness = makeSpawnHarness(() => ({ onModelList: (request, api) => { pendingList = { request, api }; } }));
    /** @type {any[]} */
    const tierInfos = [];
    const session = createTestSession(harness, scratch, { rpcTimeoutMs: 1_000, onServiceTiers: (info) => tierInfos.push(info) });
    const result = await session.ask("q", { serviceTier: "default" });
    assert.equal(result.serviceTier, "default");
    assert.equal(harness.turnRequests[0].params.serviceTier, "default");
    assert.ok(pendingList, "model/list は出ている");
    assert.deepEqual(tierInfos, []);
    pendingList.api.response(pendingList.request, { data: [{ id: "gpt-5.6-terra", serviceTiers: [{ id: "priority" }] }], nextCursor: null });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(tierInfos, [{ model: "gpt-5.6-terra", serviceTiers: ["priority"] }]);
    await session.dispose();
  });
});

test("codex-session: serviceTier は default / priority だけ（それ以外は turn を始めずに TypeError・次の ask は通る）", async () => {
  await withScratch(async (scratch) => {
    const harness = makeSpawnHarness(() => ({}));
    const session = createTestSession(harness, scratch);
    await assert.rejects(() => session.ask("q", { serviceTier: /** @type {any} */ ("flex") }), TypeError);
    assert.equal(harness.turnRequests.length, 0);
    const ok = await session.ask("q", { serviceTier: null });
    assert.equal(ok.serviceTier, null);
    assert.equal("serviceTier" in harness.turnRequests[0].params, false);
    await session.dispose();
  });
});
