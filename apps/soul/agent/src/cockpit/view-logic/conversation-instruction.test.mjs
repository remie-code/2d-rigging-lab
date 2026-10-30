// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  conversationInstructionInputError,
  conversationInstructionPath,
  conversationInstructionStatusView,
  createConversationInstructionController,
  currentRoleView,
  isConversationInstructionRoleId,
  roleOptionsView,
  parseConversationInstructionResponse,
  parseSoulSkills,
  soulSkillNoticeText,
  SOUL_SKILL_LABELS
} from "./conversation-instruction.mjs";

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, async json() { return body; } };
}

function payload(roleId, instruction, isOverride = false, revision = 1) {
  return { ok: true, roleId, instruction, isOverride, revision };
}

test("conversation instruction contract: 鍵はロールの id（英小文字の形）・パスは encode する（配信の組み直し Domain A）", () => {
  for (const ok of ["chappy", "cody", "mio", "role-2", "codex-61-sol"]) assert.equal(isConversationInstructionRoleId(ok), true, ok);
  for (const ng of ["", "Chappy", "1a", "a/b", "..", "x".repeat(33), null, 3]) {
    assert.equal(isConversationInstructionRoleId(ng), false, String(ng));
  }
  assert.equal(conversationInstructionPath("chappy"), "/api/conversation-instructions/chappy");
  assert.equal(conversationInstructionPath("codex/unsafe"), "/api/conversation-instructions/codex%2Funsafe");
});

test("ロールの select の選択肢と今のロール: snapshot の role から作る（形の違う要素は落とす・名前が無ければ id）", () => {
  const status = {
    id: "chappy",
    displayName: "チャッピー",
    brain: "codex-61-sol",
    roles: [
      { id: "chappy", displayName: "チャッピー", brain: "codex-61-sol" },
      { id: "mio", displayName: "  ", brain: "codex-astra" },
      { id: "Bad", displayName: "x" },
      null
    ]
  };
  assert.deepEqual(roleOptionsView(status), [
    { value: "chappy", label: "チャッピー", brain: "codex-61-sol" },
    { value: "mio", label: "mio", brain: "codex-astra" }
  ]);
  assert.deepEqual(currentRoleView(status), { id: "chappy", displayName: "チャッピー", brain: "codex-61-sol" });
  assert.deepEqual(roleOptionsView(null), []);
  assert.equal(currentRoleView(null), null);
  assert.equal(currentRoleView({ id: "../x" }), null);
  // 名前は頭の id から作らない（頭 → 名前の表を持たない）。
  const source = readFileSync(fileURLToPath(new URL("./conversation-instruction.mjs", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /["']claude["']\s*:\s*.*(?:cody|こーでぃー)|["']codex(?:-55|-56-sol)?["']\s*:\s*.*(?:chappy|チャッピー)/i);
});

test("conversation instruction response validation rejects malformed or wrong-role payloads", () => {
  assert.deepEqual(parseConversationInstructionResponse(payload("claude", "default"), "claude"), {
    roleId: "claude", instruction: "default", isOverride: false, revision: 1
  });
  assert.equal(parseConversationInstructionResponse({ ok: true, roleId: "claude", instruction: "x" }, "claude"), null);
  assert.equal(parseConversationInstructionResponse(payload("codex", "x"), "claude"), null);
  assert.equal(parseConversationInstructionResponse({ ok: false, roleId: "claude", instruction: "x", isOverride: false }, "claude"), null);
  // 旧の応答（brainId）は受け取らない。
  assert.equal(parseConversationInstructionResponse({ ok: true, brainId: "claude", instruction: "x", isOverride: false, revision: 1 }, "claude"), null);
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
    roleId: "claude", loaded: true, draft: "default body", saved: "default body", isOverride: false,
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

// ── 魂がいつも足す教え（記憶の作り直し Wave 3 仕上げ・読むだけの表示）──

test("soul skills: 応答の soulSkills を読み、案内文を作る（配列でなければ null・形の違う要素は落とす）", () => {
  assert.equal(parseSoulSkills(undefined), null);
  assert.equal(parseSoulSkills("x"), null);
  assert.deepEqual(
    parseSoulSkills([
      { name: "recall", path: "skills/recall.md", body: "本文", extra: 1 },
      { name: "empty", path: "skills/empty.md", body: "  " },
      { name: 1, path: "x", body: "y" },
      null
    ]),
    [{ name: "recall", path: "skills/recall.md", body: "本文" }]
  );
  assert.equal(SOUL_SKILL_LABELS.recall, "思い出す教え");
  assert.equal(SOUL_SKILL_LABELS.expression, "表情タグの教え");
  assert.equal(SOUL_SKILL_LABELS.screen, "画面の教え");
  assert.equal(
    soulSkillNoticeText({ name: "expression", path: "skills/expression.md" }),
    "このほかに、表情タグの教え（skills/expression.md）がいつも足されています"
  );
  assert.equal(
    soulSkillNoticeText({ name: "recall", path: "skills/recall.md" }),
    "このほかに、思い出す教え（skills/recall.md）がいつも足されています"
  );
  assert.equal(soulSkillNoticeText({ name: "other", path: "skills/other.md" }), "このほかに、教え「other」（skills/other.md）がいつも足されています");
});

test("conversation instruction controller: soulSkills は頭に関係なく共有し、応答に無ければ前の値のまま（編集の口は無い）", async () => {
  const skills = [{ name: "recall", path: "skills/recall.md", body: "教えの本文" }];
  let withSkills = true;
  const fetchImpl = async (path, init) => {
    const brainId = path.endsWith("codex") ? "codex" : "claude";
    const body = payload(brainId, brainId + " default", init && init.method === "PUT", 1);
    return response(withSkills ? { ...body, soulSkills: skills } : body);
  };
  const controller = createConversationInstructionController({ fetchImpl });
  assert.deepEqual(controller.getSoulSkills(), []);
  await controller.load("claude");
  assert.deepEqual(controller.getSoulSkills(), skills);
  withSkills = false;
  await controller.load("codex");
  assert.deepEqual(controller.getSoulSkills(), skills, "応答に無ければ前の値のまま");
  const copy = controller.getSoulSkills();
  copy[0].body = "書き換え";
  assert.equal(controller.getSoulSkills()[0].body, "教えの本文", "外から書き換えられない");
  assert.equal(typeof (/** @type {any} */ (controller)).setSoulSkills, "undefined");
  assert.equal("soulSkills" in controller.getState("claude"), false, "頭ごとの状態には混ぜない");
});
