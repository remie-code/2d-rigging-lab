// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CONVERSATION_INSTRUCTION_BRAIN_IDS,
  CONVERSATION_INSTRUCTION_BRAIN_OPTIONS,
  conversationInstructionInputError,
  conversationInstructionPath,
  conversationInstructionStatusView,
  conversationBrainIdentity,
  createConversationInstructionController,
  parseConversationInstructionResponse
} from "./conversation-instruction.mjs";

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, async json() { return body; } };
}

function payload(brainId, instruction, isOverride = false, revision = 1) {
  return { ok: true, brainId, instruction, isOverride, revision };
}

test("conversation instruction contract: exactly five technical brain IDs and encoded paths", () => {
  assert.deepEqual(CONVERSATION_INSTRUCTION_BRAIN_IDS, ["claude", "codex", "codex-55", "codex-56-sol", "codex-astra"]);
  assert.deepEqual(CONVERSATION_INSTRUCTION_BRAIN_OPTIONS.map((item) => item.value), CONVERSATION_INSTRUCTION_BRAIN_IDS);
  assert.equal(conversationInstructionPath("codex-56-sol"), "/api/conversation-instructions/codex-56-sol");
  assert.equal(conversationInstructionPath("codex-astra"), "/api/conversation-instructions/codex-astra");
  assert.equal(conversationInstructionPath("codex/unsafe"), "/api/conversation-instructions/codex%2Funsafe");
});

test("conversation editor identity uses supplied canonical active facts without a second brain map", () => {
  const source = readFileSync(fileURLToPath(new URL("./conversation-instruction.mjs", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /CONVERSATION_BRAIN_IDENTITY_PROJECTIONS/);
  assert.doesNotMatch(source, /["']claude["']\s*:\s*.*(?:cody|こーでぃー)|["']codex(?:-55|-56-sol)?["']\s*:\s*.*(?:chappy|チャッピー)/i);
  for (const brainId of CONVERSATION_INSTRUCTION_BRAIN_IDS) {
    const canonical = { id: `canonical-${brainId}`, displayName: `Canonical ${brainId}` };
    assert.deepEqual(
      conversationBrainIdentity({ brainId, activeBrainId: brainId, activeIdentity: canonical }),
      canonical,
      `${brainId} should pass through the canonical active identity fact`
    );
    assert.equal(
      conversationBrainIdentity({ brainId, activeBrainId: "different-brain", activeIdentity: canonical }),
      null,
      `${brainId} must not display identity for a non-active profile`
    );
  }
});

test("conversation instruction response validation rejects malformed or wrong-brain payloads", () => {
  assert.deepEqual(parseConversationInstructionResponse(payload("claude", "default"), "claude"), {
    brainId: "claude", instruction: "default", isOverride: false, revision: 1
  });
  assert.equal(parseConversationInstructionResponse({ ok: true, brainId: "claude", instruction: "x" }, "claude"), null);
  assert.equal(parseConversationInstructionResponse(payload("codex", "x"), "claude"), null);
  assert.equal(parseConversationInstructionResponse({ ok: false, brainId: "claude", instruction: "x", isOverride: false }, "claude"), null);
  assert.equal(conversationInstructionInputError("  "), "会話指示を入力してください（空にする場合は「既定へ戻す」を使ってください）");
  assert.equal(conversationInstructionInputError("hello"), null);
});

test("conversation instruction controller: load/save/reset and default/override/next-Fire statuses", async () => {
  const calls = [];
  const fetchImpl = async (path, init) => {
    calls.push({ path, init });
    if (!init) return response(payload("claude", "default body", false, 4));
    if (init.method === "PUT") return response(payload("claude", "custom body", true, 5));
    return response(payload("claude", "default body", false, 6));
  };
  const controller = createConversationInstructionController({ fetchImpl });
  assert.equal((await controller.load("claude")).ok, true);
  assert.deepEqual(controller.getState("claude"), {
    brainId: "claude", loaded: true, draft: "default body", saved: "default body", isOverride: false,
    revision: 4, status: "default", error: "", dirty: false, requestSeq: 1
  });
  controller.edit("claude", "custom body");
  assert.equal(controller.isDirty("claude"), true);
  assert.equal(conversationInstructionStatusView(controller.getState("claude")).text, "未保存の変更があります。");
  assert.equal((await controller.save("claude")).ok, true);
  assert.equal(controller.getState("claude").isOverride, true);
  assert.equal(controller.getState("claude").status, "saved");
  assert.match(conversationInstructionStatusView(controller.getState("claude")).text, /次のFireから反映/);
  assert.equal((await controller.reset("claude")).ok, true);
  assert.equal(controller.getState("claude").draft, "default body");
  assert.equal(controller.getState("claude").isOverride, false);
  assert.equal(controller.getState("claude").status, "default");
  assert.deepEqual(calls.map((call) => [call.path, call.init && call.init.method]), [
    ["/api/conversation-instructions/claude", undefined],
    ["/api/conversation-instructions/claude", "PUT"],
    ["/api/conversation-instructions/claude", "DELETE"]
  ]);
});

test("conversation instruction controller: per-brain drafts stay isolated", async () => {
  const fetchImpl = async (path) => {
    const brainId = path.endsWith("codex") ? "codex" : "claude";
    return response(payload(brainId, brainId + " default", false, 1));
  };
  const controller = createConversationInstructionController({ fetchImpl });
  await controller.load("claude");
  await controller.load("codex");
  controller.edit("claude", "claude draft");
  controller.edit("codex", "codex draft");
  assert.equal(controller.getState("claude").draft, "claude draft");
  assert.equal(controller.getState("codex").draft, "codex draft");
  controller.discard("claude");
  assert.equal(controller.getState("claude").draft, "claude default");
  assert.equal(controller.getState("codex").draft, "codex draft");
});

test("conversation instruction controller: stale load responses cannot overwrite the newest response", async () => {
  const pending = [];
  const fetchImpl = (path) => new Promise((resolve) => pending.push({ path, resolve }));
  const controller = createConversationInstructionController({ fetchImpl });
  const first = controller.load("claude");
  const second = controller.load("claude");
  pending[1].resolve(response(payload("claude", "new", true, 2)));
  assert.equal((await second).ok, true);
  pending[0].resolve(response(payload("claude", "old", false, 1)));
  assert.equal((await first).stale, true);
  assert.equal(controller.getState("claude").draft, "new");
  assert.equal(controller.getState("claude").revision, 2);
});

test("conversation instruction controller: edit during save survives response and failed save/reset preserve draft", async () => {
  const pending = [];
  const fetchImpl = (path, init) => {
    if (init && (init.method === "PUT" || init.method === "DELETE")) {
      return new Promise((resolve) => pending.push({ resolve, method: init.method }));
    }
    return Promise.resolve(response(payload("claude", "default", false, 1)));
  };
  const controller = createConversationInstructionController({ fetchImpl });
  await controller.load("claude");
  controller.edit("claude", "first");
  const savePromise = controller.save("claude");
  controller.edit("claude", "newer");
  pending[0].resolve(response(payload("claude", "first", true, 2)));
  assert.equal((await savePromise).ok, true);
  assert.equal(controller.getState("claude").draft, "newer");
  assert.equal(controller.getState("claude").saved, "first");
  assert.equal(controller.getState("claude").dirty, true);

  const failedSave = controller.save("claude");
  pending[1].resolve(response({ error: "write failed" }, { ok: false, status: 500 }));
  assert.equal((await failedSave).ok, false);
  assert.equal(controller.getState("claude").draft, "newer");
  assert.equal(controller.getState("claude").dirty, true);

  const failedReset = controller.reset("claude");
  pending[2].resolve(response({ error: "reset failed" }, { ok: false, status: 500 }));
  assert.equal((await failedReset).ok, false);
  assert.equal(controller.getState("claude").draft, "newer");
  assert.equal(controller.getState("claude").dirty, true);
});

test("conversation instruction controller: overlapping PUT then DELETE keeps only the newest reset response", async () => {
  const pending = [];
  const fetchImpl = (path, init) => {
    if (init && (init.method === "PUT" || init.method === "DELETE")) {
      return new Promise((resolve) => pending.push({ resolve, method: init.method }));
    }
    return Promise.resolve(response(payload("claude", "default", false, 1)));
  };
  const controller = createConversationInstructionController({ fetchImpl });
  await controller.load("claude");
  controller.edit("claude", "custom");
  const savePromise = controller.save("claude");
  const resetPromise = controller.reset("claude");
  assert.deepEqual(pending.map((item) => item.method), ["PUT", "DELETE"]);
  pending[0].resolve(response(payload("claude", "custom", true, 2)));
  assert.equal((await savePromise).stale, true);
  assert.equal(controller.getState("claude").status, "resetting");
  pending[1].resolve(response(payload("claude", "default", false, 3)));
  assert.equal((await resetPromise).ok, true);
  assert.equal(controller.getState("claude").draft, "default");
  assert.equal(controller.getState("claude").saved, "default");
  assert.equal(controller.getState("claude").isOverride, false);
  assert.equal(controller.getState("claude").revision, 3);
  assert.equal(controller.getState("claude").dirty, false);
  assert.equal(controller.getState("claude").status, "default");
});

test("conversation instruction controller: overlapping DELETE then PUT keeps only the newest save response", async () => {
  const pending = [];
  const fetchImpl = (path, init) => {
    if (init && (init.method === "PUT" || init.method === "DELETE")) {
      return new Promise((resolve) => pending.push({ resolve, method: init.method }));
    }
    return Promise.resolve(response(payload("claude", "old", true, 7)));
  };
  const controller = createConversationInstructionController({ fetchImpl });
  await controller.load("claude");
  controller.edit("claude", "new custom");
  const resetPromise = controller.reset("claude");
  const savePromise = controller.save("claude");
  assert.deepEqual(pending.map((item) => item.method), ["DELETE", "PUT"]);
  pending[0].resolve(response(payload("claude", "default", false, 8)));
  assert.equal((await resetPromise).stale, true);
  assert.equal(controller.getState("claude").status, "saving");
  pending[1].resolve(response(payload("claude", "new custom", true, 9)));
  assert.equal((await savePromise).ok, true);
  assert.equal(controller.getState("claude").draft, "new custom");
  assert.equal(controller.getState("claude").saved, "new custom");
  assert.equal(controller.getState("claude").isOverride, true);
  assert.equal(controller.getState("claude").revision, 9);
  assert.equal(controller.getState("claude").dirty, false);
  assert.equal(controller.getState("claude").status, "saved");
});

test("conversation instruction controller: reverse-order cross-brain responses never cross-clobber drafts", async () => {
  const pending = [];
  const fetchImpl = (path, init) => {
    if (init && init.method === "PUT") {
      const brainId = path.endsWith("codex") ? "codex" : "claude";
      return new Promise((resolve) => pending.push({ resolve, brainId }));
    }
    const brainId = path.endsWith("codex") ? "codex" : "claude";
    return Promise.resolve(response(payload(brainId, brainId + " default", false, 1)));
  };
  const controller = createConversationInstructionController({ fetchImpl });
  await controller.load("claude");
  await controller.load("codex");
  controller.edit("claude", "claude custom");
  controller.edit("codex", "codex custom");
  const claudeSave = controller.save("claude");
  const codexSave = controller.save("codex");
  pending[1].resolve(response(payload("codex", "codex custom", true, 3)));
  pending[0].resolve(response(payload("claude", "claude custom", true, 2)));
  assert.equal((await codexSave).ok, true);
  assert.equal((await claudeSave).ok, true);
  assert.equal(controller.getState("claude").draft, "claude custom");
  assert.equal(controller.getState("codex").draft, "codex custom");
  assert.equal(controller.getState("claude").revision, 2);
  assert.equal(controller.getState("codex").revision, 3);
  assert.equal(controller.getState("claude").dirty, false);
  assert.equal(controller.getState("codex").dirty, false);
});

test("conversation instruction controller: local empty rejection does not call API", async () => {
  let calls = 0;
  const controller = createConversationInstructionController({
    fetchImpl: async () => { calls += 1; return response(payload("claude", "default")); }
  });
  await controller.load("claude");
  controller.edit("claude", "  ");
  const result = await controller.save("claude");
  assert.equal(result.local, true);
  assert.equal(calls, 1);
  assert.equal(controller.getState("claude").dirty, true);
  assert.equal(conversationInstructionStatusView(controller.getState("claude")).live, "assertive");
});
