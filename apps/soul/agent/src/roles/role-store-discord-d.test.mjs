// @ts-check
/**
 * Discord モード Domain D: ロールの鍵の指し先（role.json の discordBotKeyFile・discord-mode.md §5）。
 * ファイル名だけを持ち、無ければ既定 `.env.discord.local`。合わない値は項目ごと持たない（= 既定）。鍵の中身はロールに入らない。
 * 置き場は一時フォルダだけ（実データの roles/ には触れない）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyRolePatch,
  copyRoleAs,
  normalizeRole,
  readRole,
  roleDiscordBotKeyFile,
  roleToJson,
  writeRole
} from "./role-store.mjs";

const FAKE_TOKEN = "fake.discord-token_for-role-test";

test("ロールの指し先: 書いていなければ持たない（今のロールの形は変わらない）・既定は .env.discord.local", () => {
  const role = normalizeRole("chappy", { name: { canonical: "チャッピー" } });
  assert.equal("discordBotKeyFile" in role, false);
  assert.equal("discordBotKeyFile" in roleToJson(role), false);
  assert.equal(roleDiscordBotKeyFile(role), ".env.discord.local");
  assert.equal(roleDiscordBotKeyFile(null), ".env.discord.local");
});

test("ロールの指し先: .env.discord*.local に合うファイル名だけ持ち、書き戻し・編集・写しでも落とさない", () => {
  const role = normalizeRole("chappy", { name: { canonical: "チャッピー" }, discordBotKeyFile: ".env.discord-chappy.local" });
  assert.equal(role.discordBotKeyFile, ".env.discord-chappy.local");
  assert.equal(roleDiscordBotKeyFile(role), ".env.discord-chappy.local");
  assert.equal(roleToJson(role).discordBotKeyFile, ".env.discord-chappy.local");
  const edited = applyRolePatch(role, { verbosity: "quiet" });
  assert.equal(edited.ok, true);
  assert.equal(/** @type {any} */ (edited).role.discordBotKeyFile, ".env.discord-chappy.local", "画面の編集で消えない");
  const copied = copyRoleAs(role, { id: "mio", name: "ミオ" });
  assert.equal(/** @type {any} */ (copied).role.discordBotKeyFile, ".env.discord-chappy.local");
  const dir = mkdtempSync(join(tmpdir(), "discord-d-role-"));
  try {
    writeRole({ dir, role });
    const back = readRole({ dir, id: "chappy" });
    assert.equal(back.ok, true);
    assert.equal(/** @type {any} */ (back).role.discordBotKeyFile, ".env.discord-chappy.local");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ロールの指し先: パスの区切り・合わない名前・ファイル名でない値は持たない（= 既定に倒す）", () => {
  for (const value of ["../.env.discord.local", "C:/keys/.env.discord.local", "sub\\.env.discord.local", ".env.local", "", 1, null, { a: 1 }]) {
    const role = normalizeRole("chappy", { discordBotKeyFile: value });
    assert.equal("discordBotKeyFile" in role, false, String(value));
    assert.equal(roleDiscordBotKeyFile(role), ".env.discord.local");
  }
});

test("鍵の中身はロールに入らない: role.json に鍵らしい値が書いてあっても読まない・書き戻さない", () => {
  const dir = mkdtempSync(join(tmpdir(), "discord-d-role-"));
  try {
    mkdirSync(join(dir, "chappy"), { recursive: true });
    writeFileSync(
      join(dir, "chappy", "role.json"),
      JSON.stringify({
        version: 1,
        name: { canonical: "チャッピー" },
        discordBotKeyFile: ".env.discord.local",
        DISCORD_BOT_TOKEN: FAKE_TOKEN,
        discordBotToken: FAKE_TOKEN
      }),
      "utf8"
    );
    const read = readRole({ dir, id: "chappy" });
    assert.equal(read.ok, true);
    const role = /** @type {any} */ (read).role;
    assert.equal(JSON.stringify(role).includes(FAKE_TOKEN), false);
    writeRole({ dir, role });
    assert.equal(readFileSync(join(dir, "chappy", "role.json"), "utf8").includes(FAKE_TOKEN), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
