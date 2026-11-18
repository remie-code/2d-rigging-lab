import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createRoleHooks } from "./cockpit.mjs";
import { DEFAULT_COCKPIT_PORT } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { createDiscordExperience } from "../src/discord/discord-experience.mjs";
import { BRAIN_IDS } from "../src/mind/brains.mjs";
import { DEFAULT_ROLES_DIR, roleDiscordBotKeyFile, roleDiscordBotKeyFileRefused } from "../src/roles/role-store.mjs";
import { isRemoteVenueId, readRemoteVenueReceipt } from "../src/cockpit/remote-discord-venue.mjs";

const cockpitScript = fileURLToPath(new URL("./cockpit.mjs", import.meta.url));
const usage = `node scripts/discord-venue.mjs roles
node scripts/discord-venue.mjs catalog [--role <id>]
node scripts/discord-venue.mjs open --guild <name> --vc <name> [--vc-category <name>] [--chat <name>|--no-chat]
  [--role <id>] [--model <id>] [--vision <window title>] [--no-self-fire] [--no-body]
node scripts/discord-venue.mjs status [--venue <id>]
node scripts/discord-venue.mjs leave --venue <id>
node scripts/discord-venue.mjs close --venue <id> [--wait-ms <milliseconds>]`;

class VenueError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.details = details;
  }
}

function roleHooks() {
  return createRoleHooks({ rolesDir: DEFAULT_ROLES_DIR, settings: createFileSettingsStore() });
}

function availableRoles() {
  const roles = roleHooks();
  return { selectedRole: roles.currentId(), roles: roles.list(), models: BRAIN_IDS };
}

async function catalogForRole(roleId) {
  const role = roleHooks().resolveForVenue(roleId);
  if (!role) throw new VenueError("指定のロールを読めません。");
  const experience = createDiscordExperience({
    settings: createFileSettingsStore(),
    currentKeyFile: () => roleDiscordBotKeyFile(role),
    currentKeyFileRefused: () => roleDiscordBotKeyFileRefused(role)
  });
  const catalog = await experience.catalog({ includeChats: true });
  if (!catalog.ok) throw new VenueError(catalog.reason);
  if (!catalog.botId) throw new VenueError("候補を読んだ Bot の識別を確認できません。");
  return { guilds: catalog.guilds, botId: catalog.botId, role: { id: role.id, name: role.name.display, model: role.brain } };
}

function sameName(a, b) {
  return a.normalize("NFC").trim() === b.normalize("NFC").trim();
}

function chooseName(entries, name, label, choose = () => true) {
  const matches = entries.filter((entry) => sameName(entry.name, name) && choose(entry));
  if (matches.length === 1) return matches[0];
  throw new VenueError(
    matches.length ? `${label}の候補が複数あります。` : `${label}の一致候補が見つかりません。`,
    { candidates: (matches.length ? matches : entries).map(({ name, category, chats, channels }) =>
      ({ name, category, ...(channels ? { channels, chats } : {}) })) }
  );
}

async function startDetached(id, port, script = cockpitScript, env = process.env) {
  const child = spawn(process.execPath, [script, "--port", String(port)], {
    env: { ...env, SOUL_REMOTE_VENUE_ID: id },
    detached: true,
    windowsHide: true,
    stdio: "ignore"
  });
  let exit = null;
  child.once("exit", (code, signal) => { exit = { code, signal }; });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", resolve);
  });
  child.unref();
  return () => exit;
}

export function createDiscordVenueCommands({
  port = DEFAULT_COCKPIT_PORT, catalog = catalogForRole, launch = startDetached, receipt = readRemoteVenueReceipt, roles = availableRoles
} = {}) {
  async function request(path, { id, body, method = "GET", timeout = 3000 } = {}) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(timeout),
      redirect: "error",
      method,
      headers: {
        ...(id ? { "x-soul-venue-id": id } : {}),
        ...(body ? { "content-type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new VenueError(data?.error ?? data?.closeError ?? "Cockpit が操作を受け付けませんでした。", data ?? {});
    return data;
  }

  async function active() {
    try {
      const data = await request("/api/remote-venue");
      if (!isRemoteVenueId(data?.venueId)) throw new VenueError("既に別の Cockpit が起動しています。");
      return data;
    } catch (error) {
      if (error.cause?.code === "ECONNREFUSED") return null;
      if (error instanceof VenueError && error.details?.error === "状態が変わりました。再確認してください") throw error;
      throw new VenueError("既に別の Cockpit が起動しているか、起動状態を確認できません。");
    }
  }

  async function status(id) {
    const completed = id && await receipt(id);
    if (completed) return completed;
    const current = await active();
    if (id && current?.venueId !== id) {
      // The receipt can be published just after the listening socket closes.
      const next = await receipt(id);
      if (next) return next;
      throw new VenueError("指定の場を確認できません。完了を示す終了記録はまだありません。", { venueId: id });
    }
    return current ?? { venueId: null, status: "idle" };
  }

  return {
    roles,
    async catalog(roleId) {
      const { guilds, role } = await catalog(roleId);
      return { guilds, role };
    },
    status,
    async open(options) {
      const { guild, vc, role: roleId, model, chat, vision } = options;
      if (!guild?.trim() || !vc?.trim()) throw new VenueError("サーバー名と VC 名を指定してください。");
      if (model !== undefined && !BRAIN_IDS.includes(model)) throw new VenueError("モデルを選んでください。", { models: BRAIN_IDS });
      if (chat !== undefined && options["no-chat"]) throw new VenueError("読むチャットは一つ選んでください。");
      const running = await active();
      if (running) throw new VenueError("この Cockpit は既に別の場に割り当てられています。", running);
      const listed = await catalog(roleId);
      const matchedGuild = chooseName(listed.guilds, guild, "サーバー");
      const category = options["vc-category"];
      const matchedVoice = chooseName(matchedGuild.channels, vc, "VC", (entry) => category === undefined || sameName(entry.category ?? "", category));
      const chatChannel = chat === undefined ? null : chooseName(matchedGuild.chats ?? [], chat, "読むチャット");
      const chatChannelId = options["no-chat"] ? null : chatChannel?.id ?? matchedVoice.id;
      const id = randomUUID();
      try {
        const exit = await launch(id, port);
        const deadline = Date.now() + 20000;
        while (true) {
          if (exit()) throw new VenueError("Cockpit の起動に失敗しました。");
          // Port reservation precedes server initialization, so a timeout can mean our process is still starting.
          const current = await active().catch(() => null);
          if (current?.venueId === id) break;
          if (current || Date.now() >= deadline) throw new VenueError("今回起動した Cockpit を確認できません。");
          await delay(100);
        }
        await request("/api/stream/start", {
          id, method: "POST", timeout: 120000,
          body: {
            experience: "discord",
            discordVenue: {
              guildId: matchedGuild.id, channelId: matchedVoice.id, chatChannelId, roleId, model,
              visionTarget: vision, selfFire: !options["no-self-fire"],
              noBody: options["no-body"],
              expectedRole: { id: listed.role.id, model: model ?? listed.role.model }, expectedBotId: listed.botId
            }
          }
        });
        const result = await status(id);
        const verified = result.stream?.connection === "joined" &&
          result.voice?.guildId === matchedGuild.id && result.voice?.channelId === matchedVoice.id &&
          result.role?.id === listed.role.id && result.role?.model === (model ?? listed.role.model) &&
          result.chat && result.chat.selectedId === chatChannelId && (chatChannelId === null || result.chat.listening);
        if (!verified) throw new VenueError("開場の確認が一部できません。接続先、ロール、チャット状態を確認してください。", result);
        return { ...result, status: "open" };
      } catch (error) {
        throw new VenueError(error.message, { ...error.details, venueId: id });
      }
    },
    async leave(id) {
      return request("/api/remote-venue/leave", { id, method: "POST", timeout: 30000 });
    },
    async close(id, waitMs) {
      const previous = await receipt(id);
      if (previous?.closing === "complete") return previous;
      if (!previous) {
        const current = await status(id);
        if (current.closing !== "in-progress") {
          await request("/api/remote-venue/close", { id, method: "POST" });
        }
      }
      const deadline = Date.now() + waitMs;
      let missingSince = null;
      do {
        const outcome = await receipt(id);
        if (outcome?.closing === "complete") return outcome;
        const current = await active().catch(() => null);
        if (current?.venueId === id && current.closing === "failed") {
          throw new VenueError(current.closeError, current);
        }
        if (current?.venueId !== id && !outcome) {
          missingSince ??= Date.now();
          if (Date.now() - missingSince > 4000) {
            throw new VenueError("Cockpit と終了記録が見つかりません。保存と終了の完了を確認できません。", { venueId: id });
          }
        } else {
          missingSince = null;
        }
        if (Date.now() >= deadline) break;
        await delay(200);
      } while (true);
      return { venueId: id, closing: "in-progress" };
    }
  };
}

export async function runDiscordVenueCli(args, commands = createDiscordVenueCommands()) {
  const [command, ...rest] = args;
  if (!command || command === "--help") return usage;
  const flags = {
    roles: [],
    catalog: ["role"],
    open: ["guild", "vc", "vc-category", "chat", "no-chat", "role", "model", "vision", "no-self-fire", "no-body"],
    status: ["venue"],
    leave: ["venue"],
    close: ["venue", "wait-ms"]
  };
  if (!Object.hasOwn(flags, command)) throw new VenueError(usage);
  const { values } = parseArgs({
    args: rest,
    options: Object.fromEntries(flags[command].map((flag) => [flag, { type: flag.startsWith("no-") ? "boolean" : "string" }]))
  });
  const id = values.venue;
  if ((id !== undefined || ["leave", "close"].includes(command)) && !isRemoteVenueId(id)) {
    throw new VenueError("status で場を確認し、同じ場の識別子を --venue に指定してください。");
  }
  if (command === "roles") return commands.roles();
  if (command === "catalog") return commands.catalog(values.role);
  if (command === "open") return commands.open(values);
  if (command === "status") return commands.status(id);
  if (command === "leave") return commands.leave(id);
  const waitMs = Number(values["wait-ms"] ?? 60000);
  if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > 600000) throw new VenueError("--wait-ms は 0〜600000 を指定してください。");
  return commands.close(id, waitMs);
}

export async function printDiscordVenueResult(args, commands) {
  try {
    const result = await runDiscordVenueCli(args, commands);
    process.stdout.write(`${typeof result === "string" ? result : JSON.stringify(result, null, 2)}\n`);
    if (result?.closing === "in-progress" || result?.starting) process.exitCode = 2;
    if (result?.closing === "failed") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error.message, ...error.details }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

export { startDetached };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await printDiscordVenueResult(process.argv.slice(2));
}
