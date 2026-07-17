// @ts-check
/**
 * brains.mjs health test — フラット registry の形だけを検証する。
 * **実 create は呼ばない**（実 SDK 消費ゼロ・llm-session/codex-session を実際に起動しない）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { BRAINS, BRAIN_IDS } from "./brains.mjs";

test("brains: registry はフラット 2 項目（claude/codex）", () => {
  assert.deepEqual(Object.keys(BRAINS).sort(), ["claude", "codex"]);
  assert.deepEqual([...BRAIN_IDS].sort(), ["claude", "codex"]);
});

test("brains: registry は Object.freeze されている（唯一の宣言テーブル）", () => {
  assert.ok(Object.isFrozen(BRAINS));
  for (const key of Object.keys(BRAINS)) {
    assert.ok(Object.isFrozen(BRAINS[key]), `BRAINS.${key} is frozen`);
  }
});

for (const key of ["claude", "codex"]) {
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

test("brains: codex.credentialPath は auth.json で終わる絶対パス", () => {
  const p = BRAINS.codex.credentialPath;
  assert.ok(p.endsWith("auth.json"), p);
  assert.ok(p.includes(".codex"), p);
});
