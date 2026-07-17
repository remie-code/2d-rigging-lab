// @ts-check
/**
 * brains.mjs health test — フラット registry の形だけを検証する。
 * **実 create は呼ばない**（実 SDK 消費ゼロ・llm-session/codex-session を実際に起動しない）。
 *
 * 2026-07-17 追撃: Codex 側 2 頭（GPT-5.5 / GPT-5.6 Sol）を追加し claude/codex の 2 項目から 4 項目へ。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { BRAINS, BRAIN_IDS } from "./brains.mjs";

const EXPECTED_IDS = ["claude", "codex", "codex-55", "codex-56-sol"];

test("brains: registry はフラット 4 項目（claude/codex/codex-55/codex-56-sol）", () => {
  assert.deepEqual(Object.keys(BRAINS).sort(), [...EXPECTED_IDS].sort());
  assert.deepEqual([...BRAIN_IDS].sort(), [...EXPECTED_IDS].sort());
});

test("brains: registry は Object.freeze されている（唯一の宣言テーブル）", () => {
  assert.ok(Object.isFrozen(BRAINS));
  for (const key of Object.keys(BRAINS)) {
    assert.ok(Object.isFrozen(BRAINS[key]), `BRAINS.${key} is frozen`);
  }
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

for (const key of ["codex", "codex-55", "codex-56-sol"]) {
  test(`brains: ${key}.credentialPath は auth.json で終わる絶対パス（Codex 系 3 頭は資格情報を共有）`, () => {
    const p = BRAINS[key].credentialPath;
    assert.ok(p.endsWith("auth.json"), p);
    assert.ok(p.includes(".codex"), p);
  });
}

// ── 追撃固有: model/effort の配線を fake sdkImpl 注入で固定（実 SDK 消費ゼロ）───────────────────
// codex-session.mjs 本体は無変更（要件どおり）。brains.mjs の create ラッパが model/effort を正しく
// createCodexSession へ渡していることを、startThread に渡された options で確認する。

/** @param {(threadOptions: any) => void} onStartThread */
function makeFakeCodexSdk(onStartThread) {
  return class FakeCodexSdk {
    constructor() {}
    startThread(threadOptions) {
      onStartThread(threadOptions);
      return {
        id: "fake-thread-id",
        async runStreamed() {
          return {
            events: (async function* () {
              yield { type: "item.completed", item: { type: "agent_message", text: "ok" } };
              yield { type: "turn.completed", usage: {} };
            })()
          };
        }
      };
    }
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

test("brains: codex-55.create は model=gpt-5.5, effort=none で startThread する", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    /** @type {any} */
    let captured = null;
    const sdkImpl = makeFakeCodexSdk((opts) => {
      captured = opts;
    });
    const session = BRAINS["codex-55"].create({
      skipEnvGuard: true,
      sdkImpl,
      homeDir,
      ledgerPath
    });
    await session.ask("hi");
    assert.equal(captured.model, "gpt-5.5");
    assert.equal(captured.modelReasoningEffort, "none");
  });
});

test("brains: codex-56-sol.create は model=gpt-5.6-sol, effort=none で startThread する", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    /** @type {any} */
    let captured = null;
    const sdkImpl = makeFakeCodexSdk((opts) => {
      captured = opts;
    });
    const session = BRAINS["codex-56-sol"].create({
      skipEnvGuard: true,
      sdkImpl,
      homeDir,
      ledgerPath
    });
    await session.ask("hi");
    assert.equal(captured.model, "gpt-5.6-sol");
    assert.equal(captured.modelReasoningEffort, "none");
  });
});
