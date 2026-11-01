// @ts-check
/**
 * Discord の Bot の鍵を読む（Discord モード Domain D・discord-mode.md §5・§10・棚卸し §6 の案 a）— apps/soul/agent。
 *
 * 受信の試し（scripts/probe-discord-receive.mjs）の loadDiscordBotToken をここへ移し、鍵のファイル名を引数に取る形にした。
 *
 *  - 鍵の置き場は `apps/soul/agent/` 直下の `.env.discord*.local`（gitignore 済み・ユーザーが置く）。ロールの `role.json` の
 *    `discordBotKeyFile` がファイル名だけを指す（無ければ既定 `.env.discord.local`）。パスの区切りを含む値・`..` を含む値・
 *    `.env.discord*.local` に合わない名前は断る（ほかのファイルを読ませない）。
 *  - 変数名は `DISCORD_BOT_TOKEN` で固定。ファイルはコードの中で直に読み、**process.env に入れない**（`--env-file` も使わない）。
 *  - 失敗の理由は決まった短い日本語（鍵の値・読み込みの生のエラーを入れない）。ファイル名は入れてよい（秘密ではない）。
 *
 * テストは readFileImpl を差し替えるか、一時フォルダの偽ファイルを dir で指す（本物の鍵を読まない）。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));

/** 鍵を置く env ファイルの変数名。 */
export const DISCORD_BOT_TOKEN_NAME = "DISCORD_BOT_TOKEN";

/** ロールが鍵のファイル名を指していないときの既定。 */
export const DEFAULT_DISCORD_BOT_KEY_FILE = ".env.discord.local";

/** 鍵のファイルを置くフォルダ（`apps/soul/agent/`）。 */
export const DISCORD_BOT_KEY_DIR = join(here, "..", "..");

/** 鍵のファイル名の長さの上限。 */
const KEY_FILE_NAME_MAX_CHARS = 64;

/** `.env.discord*.local`（`*` は英数字・`.`・`_`・`-` だけ）。 */
const KEY_FILE_NAME_PATTERN = /^\.env\.discord[A-Za-z0-9._-]*\.local$/;

/**
 * 鍵のファイル名として受け付けるか（`apps/soul/agent/` 直下の `.env.discord*.local` に合う名前だけ）。
 * パスの区切り（`/`・`\`）・`..`・ドライブの印（`:`）を含む値は断る。
 * @param {unknown} value
 * @returns {value is string}
 */
export function isDiscordBotKeyFileName(value) {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > KEY_FILE_NAME_MAX_CHARS) return false;
  if (/[\\/:]/.test(value) || value.includes("..")) return false;
  return KEY_FILE_NAME_PATTERN.test(value);
}

/** ファイル名が使えないときの理由（値は入れない）。 */
export const DISCORD_KEY_FILE_NAME_REFUSED =
  "Discord の鍵のファイル名が使えない（apps/soul/agent/ 直下の .env.discord*.local の名前だけ）";

/**
 * 鍵のファイル（パス指定）から DISCORD_BOT_TOKEN を読む（process.env には入れない）。失敗の理由に鍵の値は入れない。
 * 受信の試しの loadDiscordBotToken はこれを呼ぶ（理由の文面は試しのものと同じ）。
 * @param {object} options
 * @param {string} options.path
 * @param {string} [options.label]  理由に出すファイルの呼び名（既定 path）。
 * @param {(path: string) => string} [options.readFileImpl]  テスト注入（既定 readFileSync utf8）。
 * @returns {{ ok: true; token: string } | { ok: false; reason: string }}
 */
export function readDiscordBotTokenFile(options) {
  const filePath = options.path;
  const label = options.label ?? filePath;
  const readFileImpl = options.readFileImpl ?? ((/** @type {string} */ p) => readFileSync(p, "utf8"));
  let text;
  try {
    text = readFileImpl(filePath);
  } catch {
    return { ok: false, reason: `Discord の鍵のファイルが読めない（${label}）` };
  }
  let parsed;
  try {
    parsed = parseEnv(String(text));
  } catch {
    return { ok: false, reason: `Discord の鍵のファイルが読めない形になっている（${label}）` };
  }
  const value = parsed[DISCORD_BOT_TOKEN_NAME];
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, reason: `Discord の鍵が見つからない（${label} の ${DISCORD_BOT_TOKEN_NAME}）` };
  }
  return { ok: true, token: value.trim() };
}

/**
 * ロールの指す鍵のファイル名から DISCORD_BOT_TOKEN を読む（`apps/soul/agent/<fileName>`・process.env に入れない）。
 * @param {object} [options]
 * @param {unknown} [options.fileName=DEFAULT_DISCORD_BOT_KEY_FILE]  `.env.discord*.local` に合う名前だけ。
 * @param {string} [options.dir=DISCORD_BOT_KEY_DIR]  鍵を置くフォルダ（テストは一時フォルダ）。
 * @param {(path: string) => string} [options.readFileImpl]  テスト注入。
 * @returns {{ ok: true; token: string } | { ok: false; reason: string }}
 */
export function loadDiscordBotToken(options = {}) {
  const fileName = options.fileName === undefined || options.fileName === null ? DEFAULT_DISCORD_BOT_KEY_FILE : options.fileName;
  if (!isDiscordBotKeyFileName(fileName)) return { ok: false, reason: DISCORD_KEY_FILE_NAME_REFUSED };
  const dir = options.dir ?? DISCORD_BOT_KEY_DIR;
  return readDiscordBotTokenFile({
    path: join(dir, fileName),
    label: `apps/soul/agent/${fileName}`,
    readFileImpl: options.readFileImpl
  });
}
