// @ts-check
/**
 * Discord モード Domain E: role.json の discordBotKeyFile の形が合わないとき、Discord の入口が断れるようにする印
 * （D の追認 (2)・discord-mode.md §5「パスの区切りを含む値は断る」）。
 *  - 書いていない（undefined）・null は今どおり既定 `.env.discord.local`（断らない）。
 *  - 書いてあって形が合わない値は、値を持たずに印だけ（`discordBotKeyFileInvalid: true`）。roleDiscordBotKeyFile は今どおり既定を返す
 *    （D のテストの期待値のまま）が、roleDiscordBotKeyFileRefused が true になる。
 *  - 書き戻し・画面の編集・写しでも断るまま。Discord モード Domain G（E の追認 (4)）: 書き戻しでは手で書いた元の値をそのまま
 *    残す（"" に置き換えない）。読み直しても形が合わないので断る。
 *  - 形が合う名前は今どおり（断らない）。
 * 置き場は一時フォルダだけ（実データの roles/ には触れない）。
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

const FAKE_TOKEN = "fake.discord-token_written-by-mistake";

test("書いていない・null は断らない（既定 .env.discord.local）・形が合う名前も断らない・どちらも印を持たない", () => {
  for (const raw of [{}, { discordBotKeyFile: null }, { discordBotKeyFile: ".env.discord-chappy.local" }]) {
    const role = normalizeRole("chappy", raw);
    assert.equal(roleDiscordBotKeyFileRefused(role), false, JSON.stringify(raw));
    assert.equal("discordBotKeyFileInvalid" in role, false);
  }
  assert.equal(roleDiscordBotKeyFile(normalizeRole("chappy", {})), ".env.discord.local");
  assert.equal(roleDiscordBotKeyFileRefused(null), false);
});

test("形が合わない値: 値は持たず印だけ・roleDiscordBotKeyFile は今どおり既定を返すが、入口は断る", () => {
  for (const value of ["../.env.discord.local", "C:/keys/.env.discord.local", "sub\\.env.discord.local", ".env.local", "", 1, false, { a: 1 }, FAKE_TOKEN]) {
    const role = normalizeRole("chappy", { discordBotKeyFile: value });
    assert.equal("discordBotKeyFile" in role, false, String(value));
    assert.equal(roleDiscordBotKeyFile(role), ".env.discord.local", "D の期待値のまま");
    assert.equal(roleDiscordBotKeyFileRefused(role), true, String(value));
    assert.equal(JSON.stringify(role).includes(String(value)) && String(value).length > 3, false, "値はロールに残さない");
  }
});

test("書き戻し・画面の編集・写し: 断るまま（Domain G: 元の値をそのまま書き戻す・\"\" に置き換えない）・読み直しても断る", () => {
  const dir = mkdtempSync(join(tmpdir(), "discord-e-role-"));
  try {
    mkdirSync(join(dir, "chappy"), { recursive: true });
    writeFileSync(
      join(dir, "chappy", "role.json"),
      JSON.stringify({ version: 1, name: { canonical: "チャッピー" }, discordBotKeyFile: `C:/keys/${FAKE_TOKEN}` }),
      "utf8"
    );
    const read = readRole({ dir, id: "chappy" });
    assert.equal(read.ok, true);
    const role = /** @type {any} */ (read).role;
    assert.equal(roleDiscordBotKeyFileRefused(role), true);
    assert.equal(roleToJson(role).discordBotKeyFile, `C:/keys/${FAKE_TOKEN}`, "Domain G: 元の値のまま");
    // 画面の編集（ほかの項目）でも黙って既定に戻らない。
    const edited = applyRolePatch(role, { verbosity: "quiet" });
    assert.equal(edited.ok, true);
    assert.equal(roleDiscordBotKeyFileRefused(/** @type {any} */ (edited).role), true);
    writeRole({ dir, role: /** @type {any} */ (edited).role });
    const text = readFileSync(join(dir, "chappy", "role.json"), "utf8");
    assert.equal(JSON.parse(text).discordBotKeyFile, `C:/keys/${FAKE_TOKEN}`, "Domain G: ユーザーが手で書いた値を黙って消さない");
    const back = readRole({ dir, id: "chappy" });
    assert.equal(roleDiscordBotKeyFileRefused(/** @type {any} */ (back).role), true, "読み直しても断る");
    const copied = copyRoleAs(role, { id: "mio", name: "ミオ" });
    assert.equal(roleDiscordBotKeyFileRefused(/** @type {any} */ (copied).role), true, "写しも断る（黙って既定の鍵にしない）");
    // 手で直せば断らない。
    writeFileSync(join(dir, "chappy", "role.json"), JSON.stringify({ version: 1, discordBotKeyFile: ".env.discord-chappy.local" }), "utf8");
    const fixed = /** @type {any} */ (readRole({ dir, id: "chappy" })).role;
    assert.equal(roleDiscordBotKeyFileRefused(fixed), false);
    assert.equal(roleDiscordBotKeyFile(fixed), ".env.discord-chappy.local");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("印の無いロールの形は今のまま（role.json に項目が無ければ書き戻しにも出ない）", () => {
  const role = normalizeRole("chappy", { name: { canonical: "チャッピー" } });
  assert.equal("discordBotKeyFile" in roleToJson(role), false);
  assert.equal("discordBotKeyFileInvalid" in roleToJson(role), false);
});
