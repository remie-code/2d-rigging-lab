// @ts-check
/**
 * Discord モード Domain G（E の追認 (4)）: role.json の形の合わない `discordBotKeyFile` は、操縦席がロールを書き戻すとき
 * （画面での編集・写し・roleToJson / writeRole）に `""` へ置き換えず、ユーザーが手で書いた**元の値をそのまま**残す。使うとき（入口・
 * 一覧の読み込み）に断る（roleDiscordBotKeyFileRefused）。
 *  - 編集・写し・書き戻し・読み直しを経ても元の値が残り、断るまま。
 *  - 元の値はロールの見える項目に出ない（JSON.stringify・Object.keys・spread に出ない）。断りの理由（DISCORD_REASONS.keyFileName）に
 *    値は入らない。
 * 置き場は OS の一時フォルダだけ（実データの roles/ には触れない）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyRolePatch,
  copyRoleAs,
  normalizeRole,
  readRole,
  roleDiscordBotKeyFile,
  roleDiscordBotKeyFileRefused,
  roleToJson,
  writeRole
} from "./role-store.mjs";
import { DISCORD_REASONS } from "../discord/discord-experience.mjs";

const FAKE_TOKEN = "fake.discord-token_written-by-mistake-g";

test("形の合わない値: 書き戻しの形は元の値のまま（文字列・数・真偽・配列・オブジェクト）・見える項目には出ない・断るまま", () => {
  for (const value of ["../.env.discord.local", `C:/keys/${FAKE_TOKEN}`, ".env.local", "", 7, false, ["a"], { a: 1 }]) {
    const role = normalizeRole("chappy", { discordBotKeyFile: value });
    assert.equal(roleDiscordBotKeyFileRefused(role), true, JSON.stringify(value));
    assert.equal(roleDiscordBotKeyFile(role), ".env.discord.local", "使う名前は既定のまま（入口が印で断る）");
    assert.deepEqual(roleToJson(role).discordBotKeyFile, value, "書き戻しは元の値のまま");
    assert.equal("discordBotKeyFile" in role, false);
    assert.equal(Object.keys(role).includes("discordBotKeyFile"), false);
    const text = JSON.stringify(role);
    if (typeof value === "string" && value.length > 3) assert.equal(text.includes(value), false, "JSON に出ない");
    assert.equal(JSON.stringify({ ...role }).includes(FAKE_TOKEN), false, "spread にも出ない");
  }
  assert.equal(DISCORD_REASONS.keyFileName.includes(FAKE_TOKEN), false, "断りの理由に値は入らない（決まった文面）");
});

test("元の値は書き換わらない（手で書いたオブジェクトをあとで書き換えても、ロールの書き戻しは読んだ時点の値）", () => {
  const raw = { path: "C:/keys" };
  const role = normalizeRole("chappy", { discordBotKeyFile: raw });
  raw.path = "changed";
  assert.deepEqual(roleToJson(role).discordBotKeyFile, { path: "C:/keys" });
  const out = /** @type {any} */ (roleToJson(role)).discordBotKeyFile;
  out.path = "mutated";
  assert.deepEqual(roleToJson(role).discordBotKeyFile, { path: "C:/keys" }, "書き戻しの形を書き換えても元は変わらない");
});

test("画面の編集・写し・writeRole・読み直し: どれを経ても元の値が残り、断るまま", () => {
  const dir = mkdtempSync(join(tmpdir(), "discord-g-role-"));
  try {
    const original = `C:/keys/${FAKE_TOKEN}`;
    mkdirSync(join(dir, "chappy"), { recursive: true });
    writeFileSync(join(dir, "chappy", "role.json"), JSON.stringify({ version: 1, name: { canonical: "チャッピー" }, discordBotKeyFile: original }), "utf8");
    const role = /** @type {any} */ (readRole({ dir, id: "chappy" })).role;
    assert.equal(roleDiscordBotKeyFileRefused(role), true);
    // 画面の編集（ほかの項目）。
    const edited = /** @type {any} */ (applyRolePatch(role, { verbosity: "quiet", name: { canonical: "チャッピー", display: "ちゃっぴー" } })).role;
    assert.equal(roleDiscordBotKeyFileRefused(edited), true);
    assert.equal(roleToJson(edited).discordBotKeyFile, original);
    writeRole({ dir, role: edited });
    const text = readFileSync(join(dir, "chappy", "role.json"), "utf8");
    assert.equal(JSON.parse(text).discordBotKeyFile, original, "書き戻しても手で書いた値は消えない");
    assert.equal(JSON.parse(text).verbosity, "quiet", "編集した項目は書かれる");
    // 読み直し → また編集 → 書く。
    const back = /** @type {any} */ (readRole({ dir, id: "chappy" })).role;
    assert.equal(roleDiscordBotKeyFileRefused(back), true, "読み直しても断る");
    writeRole({ dir, role: /** @type {any} */ (applyRolePatch(back, { body: false })).role });
    assert.equal(JSON.parse(readFileSync(join(dir, "chappy", "role.json"), "utf8")).discordBotKeyFile, original);
    // 写し（新しいロール）も元の値を持ち、断る（黙って既定の鍵にしない）。
    const copied = /** @type {any} */ (copyRoleAs(back, { id: "mio", name: "ミオ" })).role;
    assert.equal(roleDiscordBotKeyFileRefused(copied), true);
    writeRole({ dir, role: copied });
    assert.equal(JSON.parse(readFileSync(join(dir, "mio", "role.json"), "utf8")).discordBotKeyFile, original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("形の合う値・書いていないロールは今まで通り（印も内側の値も無い・書き戻しにも出ない）", () => {
  const good = normalizeRole("chappy", { discordBotKeyFile: ".env.discord-chappy.local" });
  assert.equal(roleDiscordBotKeyFileRefused(good), false);
  assert.equal(roleToJson(good).discordBotKeyFile, ".env.discord-chappy.local");
  const none = normalizeRole("chappy", {});
  assert.equal("discordBotKeyFile" in roleToJson(none), false);
  assert.equal(roleDiscordBotKeyFileRefused(none), false);
  assert.equal(roleDiscordBotKeyFileRefused(normalizeRole("chappy", { discordBotKeyFile: null })), false);
});

test("内側の置き場を持たない作りのロール（印だけ）は E の形（\"\"）で書く・断るまま", () => {
  const role = { ...normalizeRole("chappy", { discordBotKeyFile: "bad/name" }) };
  assert.equal(role.discordBotKeyFileInvalid, true, "spread で印は残る");
  assert.equal(roleToJson(/** @type {any} */ (role)).discordBotKeyFile, "", "元の値が無ければ \"\"（断るまま）");
  assert.equal(roleDiscordBotKeyFileRefused(normalizeRole("chappy", roleToJson(/** @type {any} */ (role)))), true);
});
