import { createDiscordChatMaterials, DISCORD_ATTACHMENT_SIZE_ERROR } from "./discord-chat-materials.mjs";
import { MAX_ATTACHMENT_BYTES } from "./discord-pdf-renderer.mjs";

const ATTACHMENT_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const ATTACHMENT_TIMEOUT_MS = 10_000;
const SEEN_POST_TTL_MS = 30 * 60 * 1000;
const MAX_SEEN_POSTS = 4096;
export const SOUL_VC_COMMAND = "soul-vc";
const SOUL_VC_DESCRIPTION = "チャッピーのVC参加と退出";

/** @param {string} rawUrl @param {AbortSignal} signal @param {typeof fetch} [fetchImpl] */
export async function downloadDiscordAttachment(rawUrl, signal, fetchImpl = fetch) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !ATTACHMENT_HOSTS.has(url.hostname) || url.port ||
      url.username || url.password || url.hash || !/^\/attachments\/\d+\/\d+\/[^/]+$/u.test(url.pathname)) {
    throw new Error("invalid Discord attachment source");
  }
  const signatureExpiry = url.searchParams.get("ex");
  if (signatureExpiry !== null && (!/^[0-9a-f]+$/iu.test(signatureExpiry) ||
      Number.parseInt(signatureExpiry, 16) <= Date.now() / 1000)) {
    throw new Error("expired Discord attachment");
  }
  const controller = new AbortController();
  const requestSignal = AbortSignal.any([signal, controller.signal, AbortSignal.timeout(ATTACHMENT_TIMEOUT_MS)]);
  const tooLarge = () => Object.assign(new Error("Discord attachment too large"), { code: DISCORD_ATTACHMENT_SIZE_ERROR });
  try {
    requestSignal.throwIfAborted();
    const response = await fetchImpl(url, { redirect: "error", signal: requestSignal });
    if (!response.ok || !response.body) throw new Error("Discord attachment unavailable");
    if (Number(response.headers.get("content-length")) > MAX_ATTACHMENT_BYTES) throw tooLarge();
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        requestSignal.throwIfAborted();
        const { value, done } = await reader.read();
        requestSignal.throwIfAborted();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_ATTACHMENT_BYTES) throw tooLarge();
        chunks.push(value);
      }
      return Buffer.concat(chunks, size);
    } finally {
      reader.releaseLock();
    }
  } finally {
    controller.abort();
  }
}

/** @param {any} discord @param {string} token @param {AbortSignal} signal */
export async function discordMessageContentStatus(discord, token, signal) {
  const { REST, Routes, ApplicationFlags } = discord;
  if (!REST || !Routes?.currentApplication || !ApplicationFlags) return "unavailable";
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(2500)]);
  try {
    const rest = new REST({ timeout: 2500, retries: 0 }).setToken(token);
    const app = await rest.get(Routes.currentApplication(), { signal: deadline });
    if (!Number.isInteger(app?.flags)) return "unavailable";
    const mask = ApplicationFlags.GatewayMessageContent | ApplicationFlags.GatewayMessageContentLimited;
    return (app.flags & mask) !== 0 ? "enabled" : "intent-required";
  } catch {
    return "unavailable";
  }
}

/** @param {any} x @param {any} channel */
export function readableDiscordChat(x, channel) {
  const { ChannelFlags, ChannelType, PermissionFlagsBits } = x.discord;
  if (!channel || channel.guildId !== x.plan.guildId || x.guild.available === false || !ChannelType || !PermissionFlagsBits ||
      (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildVoice)) return false;
  if (ChannelFlags?.ChannelObfuscated && channel.flags?.has(ChannelFlags.ChannelObfuscated)) return false;
  const member = x.guild.members?.me;
  return Boolean(member && channel.permissionsFor?.(member)?.has(PermissionFlagsBits.ViewChannel));
}

/** @param {any} x @param {any} settings @param {() => boolean} isOpen
 * @param {() => import("../cockpit/venue/task-resources.mjs").VenueTaskAccess|null} [getTaskResources] */
export function createDiscordChatReceiver(x, settings, isOpen, getTaskResources) {
  const materials = createDiscordChatMaterials();
  // Gateway redelivery can follow a channel switch. Keep only IDs for the life of this venue.
  /** @type {Map<string, number>} */
  const seen = new Map();
  const scoped = x.plan.chatChannelId !== undefined;
  const saved = scoped ? null : settings.getDiscordChatChannel?.();
  let selectedId = scoped ? x.plan.chatChannelId : saved?.guildId === x.plan.guildId ? saved.channelId ?? null : null;
  /** @type {string | null} */
  let activeId = null;
  /** @type {number | null} */
  let activeSince = null;

  function sync() {
    const channel = selectedId ? x.guild.channels.cache?.get(selectedId) : null;
    const readable = readableDiscordChat(x, channel);
    const active = readable && x.chatIntent === "enabled" ? channel : null;
    const nextId = active?.id ?? null;
    if (nextId !== activeId) {
      activeId = nextId;
      // Gateway Resume may deliver unseen events from before this selection.
      activeSince = active ? Date.now() : null;
    }
    materials.setChannel(active
      ? { guildId: x.plan.guildId, channelId: active.id, channelName: active.name }
      : null);
    return readable;
  }

  // Restore the saved source at entrance. The server gate still filters opening events.
  sync();
  return {
    clear: () => {
      seen.clear();
      materials.clear();
    },
    refreshPermissions: () => {
      if (isOpen()) sync();
    },
    getChatMaterials() {
      if (!isOpen()) return [];
      sync();
      return materials.getChatMaterials();
    },
    list() {
      const readable = sync();
      const channels = Array.from(x.guild.channels.cache?.values?.() ?? [])
        .filter((channel) => readableDiscordChat(x, channel))
        .map((/** @type {any} */ channel) => ({
          id: channel.id,
          name: channel.name,
          kind: channel.type === x.discord.ChannelType.GuildVoice ? "voice" : "text"
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ja"));
      return {
        channels, selectedId, selectionStatus: selectedId && !readable ? "unreadable" : "available",
        intentStatus: x.chatIntent, commandStatus: x.commandStatus
      };
    },
    /** @param {unknown} channelId */
    select(channelId) {
      if (channelId !== null && (typeof channelId !== "string" || !/^\d{17,20}$/u.test(channelId))) {
        return { ok: false, code: "shape", reason: "読むチャットの指定が正しくない" };
      }
      if (channelId !== null && !readableDiscordChat(x, x.guild.channels.cache?.get(channelId))) {
        return { ok: false, code: "unreadable", reason: "Bot がそのチャットを閲覧できない" };
      }
      try {
        if (!scoped && settings.setDiscordChatChannel?.(channelId === null ? null : { guildId: x.plan.guildId, channelId }) !== true) {
          return { ok: false, code: "save", reason: "読むチャットを保存できない" };
        }
      } catch {
        return { ok: false, code: "save", reason: "読むチャットを保存できない" };
      }
      selectedId = channelId;
      return { ok: true, state: this.list() };
    },
    /** @param {any} message */
    accept(message) {
      if (!isOpen() || x.chatIntent !== "enabled" || !selectedId || message.guildId !== x.plan.guildId ||
          message.channelId !== selectedId || !message.author?.id || message.author.id === x.botId) return;
      if (!sync() || activeSince === null || !(message.createdTimestamp > activeSince)) return;
      const now = performance.now();
      for (const [id, expiry] of seen) {
        if (expiry > now) break;
        seen.delete(id);
      }
      if (seen.has(message.id)) return;
      const accepted = materials.acceptPost({
        guildId: message.guildId,
        channelId: message.channelId,
        messageId: message.id,
        authorId: message.author.id,
        authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
        postedAtMs: message.createdTimestamp,
        text: message.content,
        attachments: Array.from(message.attachments?.values?.() ?? [], (/** @type {any} */ attachment) => {
          const { id, name, contentType, size, url } = attachment;
          return { id, name, contentType, sizeBytes: size, load: (signal) => downloadDiscordAttachment(url, signal) };
        })
      }, getTaskResources?.());
      if (accepted) {
        seen.set(message.id, now + SEEN_POST_TTL_MS);
        if (seen.size > MAX_SEEN_POSTS) {
          const oldest = seen.keys().next().value;
          if (oldest !== undefined) seen.delete(oldest);
        }
      }
    }
  };
}

/** @param {any} guild @param {any} discord @param {AbortSignal} signal */
export async function registerSoulVcCommand(guild, discord, signal) {
  const { ApplicationCommandType, ApplicationCommandOptionType, Routes } = discord;
  const applicationId = guild.client?.application?.id;
  if (!applicationId || !ApplicationCommandType || !ApplicationCommandOptionType || !Routes) return { status: "unavailable" };
  const route = Routes.applicationGuildCommands(applicationId, guild.id);
  const options = [
    { name: "join", type: ApplicationCommandOptionType.Subcommand, description: "今いるボイスチャンネルに呼ぶ" },
    { name: "leave", type: ApplicationCommandOptionType.Subcommand, description: "ボイスチャンネルから退出させる" }
  ];
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  const rest = guild.client.rest;
  const commands = await rest.get(route, { signal: deadline });
  deadline.throwIfAborted();
  const sameName = commands.filter((/** @type {any} */ entry) => entry.name === SOUL_VC_COMMAND);
  const existing = sameName.find((/** @type {any} */ entry) => entry.type === ApplicationCommandType.ChatInput) ?? sameName[0];
  if (existing) {
    const matches = existing.type === ApplicationCommandType.ChatInput && existing.description === SOUL_VC_DESCRIPTION &&
      Array.isArray(existing.options) && existing.options.length === options.length && options.every((option) =>
      existing.options.some((/** @type {any} */ current) =>
        current.name === option.name && current.description === option.description && current.type === option.type &&
        (current.options === undefined || (Array.isArray(current.options) && current.options.length === 0))));
    return matches && typeof existing.id === "string"
      ? { status: "ready", id: existing.id }
      : { status: "name-conflict" };
  }
  const created = await rest.post(route, {
    signal: deadline,
    body: { name: SOUL_VC_COMMAND, type: ApplicationCommandType.ChatInput, description: SOUL_VC_DESCRIPTION, options }
  });
  return typeof created?.id === "string" ? { status: "ready", id: created.id } : { status: "unavailable" };
}
