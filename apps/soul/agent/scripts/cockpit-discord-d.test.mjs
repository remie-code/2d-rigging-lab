// @ts-check
/**
 * Discord モード Domain D: scripts/cockpit.mjs の側（discord-mode.md §4.4・§5・§10）。
 *  - createDiscordVenueExperience: main() の変数（設定の置き場・今のロールの鍵のファイル名・標準出力）を包んで Discord の体験の口を
 *    作る。準備は設定ファイル（一時フォルダ）に保存される・ログは `[cockpit] discord:` の 1 行・一覧は今のロールの鍵で読む。
 *  - createVenueRoleBundle: ロールの束が鍵のファイル名を指せる（鍵の中身は持たない）。
 *  - main() の結線（ソースの並び・前例と同じ流儀）。
 *  - discord.js / @discordjs/voice / opusscript が配信の起動の import の木に入らない（静的・実行時）。前例は
 *    src/ears/local-stt/no-sherpa-in-parent.test.mjs。
 * 本物の Discord・鍵・実データには触れない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createDiscordVenueExperience, createVenueRoleBundle } from "./cockpit.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { createFakeDiscord } from "../src/test-support/fake-discord.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_ROOT = path.resolve(HERE, "..");
const DISCORD_PACKAGES = /^(discord\.js|@discordjs\/|opusscript|prism-media|@snazzah\/davey)/;
const FAKE_TOKEN = "fake.discord-token_for-cockpit-test";

// ── createDiscordVenueExperience ─────────────────────────────────────────

test("createDiscordVenueExperience: 準備は設定ファイルへ・一覧は今のロールの鍵で読む・ログは [cockpit] discord: の 1 行（id・名前・鍵を書かない）", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "discord-d-cockpit-"));
  try {
    const settingsPath = path.join(dir, "cockpit-settings.local.json");
    const settings = createFileSettingsStore({ path: settingsPath });
    const fake = createFakeDiscord({
      guilds: [{ id: "guild-fake-1", name: "試し", channels: [{ id: "channel-fake-1", name: "一般" }], members: {} }]
    });
    /** @type {string[]} */
    const lines = [];
    /** @type {string[]} */
    const keyFiles = [];
    let keyFile = ".env.discord.local";
    const discord = createDiscordVenueExperience({
      settings,
      currentKeyFile: () => keyFile,
      write: (line) => lines.push(line),
      loadLibraries: fake.loadLibraries,
      loadToken: (fileName) => {
        keyFiles.push(fileName);
        return { ok: true, token: FAKE_TOKEN };
      }
    });
    assert.deepEqual(discord.prep.get(), { guildId: null, channelId: null, sttEngine: null });
    const set = discord.prep.set({ guildId: "guild-fake-1", channelId: "channel-fake-1", sttEngine: "elevenlabs" });
    assert.equal(set.ok, true);
    assert.deepEqual(createFileSettingsStore({ path: settingsPath }).getDiscordPrep(), {
      guildId: "guild-fake-1",
      channelId: "channel-fake-1",
      sttEngine: "elevenlabs"
    });
    keyFile = ".env.discord-cody.local";
    const loaded = await discord.catalog();
    assert.equal(loaded.ok, true);
    assert.deepEqual(keyFiles, [".env.discord-cody.local"], "一覧はその時点の今のロールの鍵");
    assert.equal(fake.record.destroyedClients, 1);
    assert.ok(lines.length > 0);
    for (const line of lines) {
      assert.match(line, /^\[cockpit\] discord: .+\n$/);
      for (const word of ["guild-fake-1", "channel-fake-1", FAKE_TOKEN, "試し", "一般"]) assert.equal(line.includes(word), false, line);
    }
    assert.equal(readFileSync(settingsPath, "utf8").includes(FAKE_TOKEN), false, "鍵は設定に入らない");
    assert.equal(discord.connectionStatus(), null);
    assert.equal(discord.wording?.venue, "通話");
    assert.equal(discord.teaching, "venue-discord");
    assert.ok(discord.judgeSet?.speakNow && discord.judgeSet?.recallAvoid);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("createDiscordVenueExperience: 同時に 2 回読み込んでもログインは 1 回（読み込み中の結果を待つ）", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "discord-d-cockpit-"));
  try {
    const fake = createFakeDiscord({ guilds: [] });
    const discord = createDiscordVenueExperience({
      settings: createFileSettingsStore({ path: path.join(dir, "s.json") }),
      currentKeyFile: () => ".env.discord.local",
      write: () => {},
      loadLibraries: fake.loadLibraries,
      loadToken: () => ({ ok: true, token: FAKE_TOKEN })
    });
    const [a, b] = await Promise.all([discord.catalog(), discord.catalog()]);
    assert.deepEqual(a, { ok: true, guilds: [] });
    assert.equal(a, b);
    assert.equal(fake.record.logins.length, 1);
    await discord.catalog();
    assert.equal(fake.record.logins.length, 2, "終わったら次はまた読む");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── createVenueRoleBundle ──────────────────────────────────────────────

test("createVenueRoleBundle: 鍵のファイル名の口（呼んだ時点の今のロール）・渡さなければ null", () => {
  let file = ".env.discord.local";
  const bundle = createVenueRoleBundle({
    currentId: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    streamHooks: {},
    prepareVoice: () => ({ ok: true }),
    startVoiceResources: () => {},
    discordBotKeyFile: () => file
  });
  assert.ok(Object.isFrozen(bundle));
  assert.equal(/** @type {any} */ (bundle).discordBotKeyFile(), ".env.discord.local");
  file = ".env.discord-2.local";
  assert.equal(/** @type {any} */ (bundle).discordBotKeyFile(), ".env.discord-2.local");
  const plain = createVenueRoleBundle({
    currentId: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    streamHooks: {},
    prepareVoice: () => ({ ok: true }),
    startVoiceResources: () => {}
  });
  assert.equal(/** @type {any} */ (plain).discordBotKeyFile, null);
});

// ── main() の結線（ソースの並び）────────────────────────────────────────────

test("場の結線（main）: Discord の体験の口を作って experiences で渡す・鍵は今のロールの指すファイル名", () => {
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const main = source.slice(source.indexOf("async function main()"));
  assert.match(main, /discordBotKeyFile: \(\) => roleDiscordBotKeyFile\(roleHooks\.current\(\)\),/);
  assert.match(
    main,
    /const discordExperience = createDiscordVenueExperience\(\{\n\s+settings,\n\s+currentKeyFile: \(\) => roleDiscordBotKeyFile\(roleHooks\.current\(\)\),\n\s+write: \(line\) => process\.stdout\.write\(line\)\n\s+\}\);/
  );
  const call = main.slice(main.indexOf("server = createCockpitServer({"), main.indexOf("const url = await server.listen();"));
  assert.match(call, /experiences: \{ discord: discordExperience \},/);
  assert.ok(main.indexOf("const discordExperience = createDiscordVenueExperience(") < main.indexOf("server = createCockpitServer({"));
});

// ── discord.js が配信の起動の import の木に入らない ────────────────────────────

/** import / require の specifier（静的と動的を分ける・check-soul-zone-boundary.mjs と同じ流儀）。 @param {string} text */
function specifiers(text) {
  const staticPatterns = [
    /\b(?:import|export)\b[^'"]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\brequire(?:\.resolve)?\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  /** @type {string[]} */
  const statics = [];
  for (const p of staticPatterns) for (const m of text.matchAll(p)) statics.push(m[1]);
  /** @type {string[]} */
  const dynamics = [];
  for (const m of text.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) dynamics.push(m[1]);
  return { statics, dynamics };
}

test("Discord の部品は静的に読まない: 操縦席の入口から辿れる静的 import に discord.js / @discordjs/voice / opusscript が無い", () => {
  const entry = path.join(AGENT_ROOT, "scripts", "cockpit.mjs");
  const seen = new Set();
  const stack = [entry];
  /** @type {string[]} */
  const offenders = [];
  while (stack.length > 0) {
    const file = /** @type {string} */ (stack.pop());
    if (seen.has(file)) continue;
    seen.add(file);
    const { statics } = specifiers(readFileSync(file, "utf8"));
    for (const spec of statics) {
      if (DISCORD_PACKAGES.test(spec)) offenders.push(`${path.relative(AGENT_ROOT, file)} -> ${spec}`);
      if (!spec.startsWith(".")) continue;
      const target = path.resolve(path.dirname(file), spec);
      if (existsSync(target) && statSync(target).isFile() && /\.(mjs|js|cjs)$/.test(target)) stack.push(target);
    }
  }
  assert.deepEqual(offenders, []);
  assert.ok(seen.has(path.join(AGENT_ROOT, "src", "discord", "discord-experience.mjs")), "Discord の体験の口は操縦席から辿れる（前提）");
  assert.ok(seen.has(path.join(AGENT_ROOT, "src", "discord", "discord-libraries.mjs")), "読み込む口も辿れる（中は動的 import だけ）");
});

test("Discord の部品を読み込むのは src/discord/discord-libraries.mjs の動的 import だけ（ほかは受信の試しの仕掛けだけ）", () => {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "vendor" || name === "tmp") continue;
      const p = path.join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(mjs|js|cjs)$/.test(name) && !/\.test\.mjs$/.test(name)) {
        const { statics, dynamics } = specifiers(readFileSync(p, "utf8"));
        if (statics.some((s) => DISCORD_PACKAGES.test(s))) found.push(`static:${path.relative(AGENT_ROOT, p)}`);
        if (dynamics.some((s) => DISCORD_PACKAGES.test(s))) found.push(`dynamic:${path.relative(AGENT_ROOT, p)}`);
      }
    }
  };
  walk(path.join(AGENT_ROOT, "src"));
  walk(path.join(AGENT_ROOT, "scripts"));
  assert.deepEqual(found.map((f) => f.replace(/\\/g, "/")).sort(), [
    "dynamic:scripts/probe-discord-receive.mjs",
    "dynamic:src/discord/discord-libraries.mjs"
  ]);
});

test("Discord の部品は読み込まない（実行時）: 操縦席のモジュールを読み込み、Discord の体験の口を作って準備を読んでも解決が起きない", { timeout: 60000 }, () => {
  const urls = ["scripts/cockpit.mjs", "src/cockpit/cockpit-server.mjs", "src/discord/discord-experience.mjs"].map(
    (m) => pathToFileURL(path.join(AGENT_ROOT, m)).href
  );
  const script = `
    import { registerHooks } from "node:module";
    const seen = [];
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (${DISCORD_PACKAGES}.test(specifier)) seen.push(specifier);
        return nextResolve(specifier, context);
      }
    });
    const urls = ${JSON.stringify(urls)};
    const mods = [];
    for (const u of urls) mods.push(await import(u));
    const discord = mods[2].createDiscordExperience({ settings: { getDiscordPrep: () => ({}), setDiscordPrep() {} } });
    discord.prep.get();
    discord.connectionStatus();
    const before = [...seen];
    // 対照: hook が効いていること（解決だけ・読み込まない）。
    import.meta.resolve("discord.js");
    process.stdout.write(JSON.stringify({ before, control: seen.length - before.length }) + "\\n");
    process.exit(0);
  `;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: AGENT_ROOT, encoding: "utf8", timeout: 50000 });
  assert.equal(r.status, 0, `child failed: ${r.stderr}`);
  const line = r.stdout.trim().split(/\r?\n/).pop() ?? "";
  const out = JSON.parse(line);
  assert.deepEqual(out.before, [], "配信の起動で Discord の部品を解決した");
  assert.ok(out.control >= 1, "解決の hook が効いていない（対照）");
});
