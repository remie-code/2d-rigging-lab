// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCodexSession } from "./codex-session.mjs";

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
