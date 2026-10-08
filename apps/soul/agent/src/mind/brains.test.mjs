// @ts-check
/**
 * brains.mjs health test — フラット registry の形だけを検証する。
 * **実 create は呼ばない**（実 SDK 消費ゼロ・llm-session/codex-session を実際に起動しない）。
 *
 * 2026-07-17 追撃: Codex 側 2 頭（GPT-5.5 / GPT-5.6 Sol）を追加し claude/codex の 2 項目から 4 項目へ。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { BRAINS, BRAIN_IDS, resolveBrainIdentity } from "./brains.mjs";
import { DEFAULT_MODEL_IDENTITY, MODEL_IDENTITIES } from "./model-identity.mjs";

const EXPECTED_IDS = ["claude", "codex", "codex-55", "codex-56-sol", "codex-astra"];

test("brains: registry はフラット 5 項目（既存4頭 + Astra）", () => {
  assert.deepEqual(Object.keys(BRAINS).sort(), [...EXPECTED_IDS].sort());
  assert.deepEqual([...BRAIN_IDS].sort(), [...EXPECTED_IDS].sort());
});

test("brains: registry は Object.freeze されている（唯一の宣言テーブル）", () => {
  assert.ok(Object.isFrozen(BRAINS));
  for (const key of Object.keys(BRAINS)) {
    assert.ok(Object.isFrozen(BRAINS[key]), `BRAINS.${key} is frozen`);
  }
});

test("brains: 5 brain entries bind to the exact frozen Cody/Chappy identities", () => {
  assert.equal(BRAINS.claude.identity, MODEL_IDENTITIES.cody);
  for (const key of ["codex", "codex-55", "codex-56-sol", "codex-astra"]) {
    assert.equal(BRAINS[key].identity, MODEL_IDENTITIES.chappy);
  }
  for (const key of EXPECTED_IDS) {
    assert.ok(Object.isFrozen(BRAINS[key].identity));
  }
});

test("brains: identity resolver preserves Cody fallback for unknown or absent persisted selections", () => {
  assert.equal(resolveBrainIdentity("claude"), MODEL_IDENTITIES.cody);
  assert.equal(resolveBrainIdentity("codex"), MODEL_IDENTITIES.chappy);
  assert.equal(resolveBrainIdentity("codex-55"), MODEL_IDENTITIES.chappy);
  assert.equal(resolveBrainIdentity("codex-56-sol"), MODEL_IDENTITIES.chappy);
  assert.equal(resolveBrainIdentity("codex-astra"), MODEL_IDENTITIES.chappy);
  assert.equal(BRAINS["codex-astra"].label, "GPT-6 Astra");
  assert.equal(resolveBrainIdentity(undefined), DEFAULT_MODEL_IDENTITY);
  assert.equal(resolveBrainIdentity("removed-brain"), DEFAULT_MODEL_IDENTITY);
});

for (const key of EXPECTED_IDS) {
  test(`brains: ${key} エントリは {id,label,create,credentialPath} を持つ`, () => {
    const entry = BRAINS[key];
    assert.equal(entry.id, key, "key === entry.id");
    assert.equal(typeof entry.label, "string");
    assert.ok(entry.label.length > 0, "label は非空");
    assert.equal(typeof entry.create, "function");
    assert.equal(typeof entry.credentialPath, "string");
    assert.ok(entry.credentialPath.length > 0);
  });
}

test("brains: claude.credentialPath は .credentials.json で終わる絶対パス", () => {
  const p = BRAINS.claude.credentialPath;
  assert.ok(p.endsWith(".credentials.json"), p);
  assert.ok(p.includes(".claude"), p);
});

for (const key of ["codex", "codex-55", "codex-56-sol", "codex-astra"]) {
  test(`brains: ${key}.credentialPath は auth.json で終わる絶対パス（Codex 系は資格情報を共有）`, () => {
    const p = BRAINS[key].credentialPath;
    assert.ok(p.endsWith("auth.json"), p);
    assert.ok(p.includes(".codex"), p);
  });
}

// ── Codex 三頭の共通 App Server route と model/effort 配線 ─────────────────────

function makeFakeAppServer(onTurnStart) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      write(chunk) {
        const request = JSON.parse(`${chunk}`.trim());
        const send = (message) => child.stdout.emit("data", Buffer.from(`${JSON.stringify(message)}\n`));
        const response = (result) => send({ id: request.id, result });
        const notify = (method, params) => send({ method, params });
        if (request.method === "initialize") response({});
        else if (request.method === "thread/start") response({ thread: { id: "fake-thread-id" } });
        else if (request.method === "turn/start") {
          onTurnStart(request.params);
          const turnId = "turn-1";
          response({ turn: { id: turnId, status: "inProgress", items: [] } });
          notify("item/started", { threadId: "fake-thread-id", turnId, startedAtMs: 1, item: { id: "a", type: "agentMessage", text: "" } });
          notify("item/agentMessage/delta", { threadId: "fake-thread-id", turnId, itemId: "a", delta: "ok" });
          notify("item/completed", { threadId: "fake-thread-id", turnId, completedAtMs: 2, item: { id: "a", type: "agentMessage", text: "ok" } });
          notify("turn/completed", { threadId: "fake-thread-id", turn: { id: turnId, status: "completed", items: [] } });
        } else if (request.method === "thread/delete" || request.method === "turn/interrupt") response({});
        return true;
      }
    };
    child.kill = (signal) => {
      queueMicrotask(() => child.emit("exit", null, signal));
      return true;
    };
    return child;
  };
}

/** テスト専用のスクラッチ homeDir + ledgerPath（codex-session.test.mjs の withScratchHome と同型・
 * 本物の ~/.codex には絶対に触れない）。finally で必ず削除する。 */
async function withScratchHome(fn) {
  const homeDir = mkdtempSync(path.join(os.tmpdir(), "brains-test-home-"));
  const ledgerPath = path.join(homeDir, "codex-rollouts.local.json");
  try {
    await fn({ homeDir, ledgerPath });
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

for (const [brainId, expectedModel, expectedEffort] of [
  ["codex", "gpt-5.6-terra", "none"],
  ["codex-55", "gpt-5.5", "none"],
  ["codex-56-sol", "gpt-5.6-sol", "low"],
  ["codex-astra", "gpt-6-astra", "low"]
]) {
test(`brains: ${brainId}.create は共通 App Server route で model=${expectedModel}, effort=${expectedEffort}`, async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    let captured = null;
    const spawnImpl = makeFakeAppServer((params) => { captured = params; });
    const session = BRAINS[brainId].create({
      skipEnvGuard: true,
      spawnImpl,
      codexPath: "fake-codex",
      homeDir,
      ledgerPath,
      disposeRpcTimeoutMs: 20,
      shutdownTimeoutMs: 20
    });
    await session.ask("hi");
    assert.equal(captured.model, expectedModel);
    assert.equal(captured.effort, expectedEffort);
    await session.dispose();
  });
});
}
