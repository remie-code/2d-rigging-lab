import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createDiscordVenueCommands, printDiscordVenueResult, startDetached } from "../../scripts/discord-venue.mjs";
import { createMemoryRecorder, createRoleHooks, createRoleMemoryPlaces, createStreamVenueHooks } from "../../scripts/cockpit.mjs";
import { createCockpitServer } from "../cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../cockpit/cockpit-settings-store.mjs";
import { readRemoteVenueReceipt, reserveRemoteVenuePort, writeRemoteVenueReceipt } from "../cockpit/remote-discord-venue.mjs";
import { createDiscordExperience } from "../discord/discord-experience.mjs";
import { acquireDiscordGuildLease } from "../discord/discord-guild-lease.mjs";
import { writeStreamRecord } from "../mind/memory.mjs";
import { normalizeRole, roleDiscordBotKeyFile, roleIdentity, writeRole } from "../roles/role-store.mjs";
import { createFakeDiscord } from "./fake-discord.mjs";

const [command, root, portText, ...args] = process.argv.slice(2);
const port = Number(portText);
const script = fileURLToPath(import.meta.url);
if (!root || !port) throw new Error("usage: discord-remote-venue-fixture.mjs <setup|cli|serve> <temp directory> <port> [...]");
const id = process.env.SOUL_REMOTE_VENUE_ID;
const path = (name) => join(root, name);
const settings = createFileSettingsStore({ path: path("settings.json") });
const rolesDir = path("roles");
const BOT = `fixture-${root}`;
const GUILD = "100000000000000001";
const SAVED = "100000000000000002";
const VC = "100000000000000003";
const CHAT = "100000000000000004";
const lockedProfile = (token) => token === "other-fake-bot" ? "通常" : "出先";

function makeDiscord(role, lease) {
  const base = createFakeDiscord({
    botUserId: BOT,
    guilds: [{ id: GUILD, name: "合成サーバー", channels: [
      { id: SAVED, name: "普段のVC" },
      { id: VC, name: "出先のVC" },
      { id: CHAT, name: "資料", type: 0 }
    ] }]
  });
  return {
    base,
    experience: createDiscordExperience({
      settings,
      acquireGuildLease: lease ? acquireDiscordGuildLease : undefined,
      currentKeyFile: () => roleDiscordBotKeyFile(role()),
      loadToken: (file) => file === ".env.discord-visitor.local" ? { ok: true, token: "visitor-fake-bot" }
        : file === ".env.discord-normal.local" ? { ok: true, token: "other-fake-bot" }
          : { ok: false, reason: "fixture unknown key" },
      loadLibraries: async () => {
        const libs = await base.loadLibraries();
        class Client extends libs.discord.Client {
          application = {};
          async login(token) {
            this.profile = lockedProfile(token);
            const result = await super.login(token);
            return result;
          }
          constructor(options) {
            super(options);
            const getGuild = this.guilds.fetch;
            const decorate = async (promise) => {
              const guild = await promise;
              guild.members.me = this.user;
              guild.channels.cache = await guild.channels.fetch();
              for (const channel of guild.channels.cache.values()) {
                channel.permissionsFor = () => ({ has: () => this.profile === "出先" || channel.id === SAVED });
              }
              return guild;
            };
            this.guilds.fetch = async (id) => {
              if (id != null) return decorate(getGuild(id));
              const partials = await getGuild();
              return new Map(Array.from(partials).map(([key, partial]) =>
                [key, { ...partial, fetch: () => decorate(partial.fetch()) }]));
            };
          }
        }
        return { ...libs, voice: {
          ...libs.voice,
          joinVoiceChannel(...args) {
            const connection = libs.voice.joinVoiceChannel(...args);
            const destroy = connection.destroy.bind(connection);
            connection.destroy = () => {
              if (id && existsSync(path("fail-voice-exit"))) throw new Error("fixture voice exit failed");
              return destroy();
            };
            return connection;
          }
        }, discord: {
          ...libs.discord, Client, PermissionFlagsBits: { ViewChannel: 1n },
          ApplicationFlags: { GatewayMessageContentLimited: 1 << 19 },
          Routes: { currentApplication: () => "/fake" },
          REST: class {
            setToken() { return this; }
            async get() { return { flags: 1 << 19 }; }
          }
        } };
      }
    })
  };
}

if (command === "setup") {
  mkdirSync(root, { recursive: true });
  writeRole({ dir: rolesDir, role: normalizeRole("normal", {
    brain: "claude", discordBotKeyFile: ".env.discord-normal.local", voice: { engine: "aivis" }
  }) });
  writeRole({ dir: rolesDir, role: normalizeRole("visitor", {
    name: { canonical: "出先テスト", display: "出先テスト" }, brain: "codex-56-sol",
    discordBotKeyFile: ".env.discord-visitor.local", voice: { engine: "aivis" }
  }) });
  settings.setRoleChoice("normal");
  settings.setDiscordPrep({ guildId: GUILD, channelId: SAVED, sttEngine: "elevenlabs" });
  settings.setDiscordChatChannel({ guildId: GUILD, channelId: SAVED });
  settings.setDiscordVisionTarget("合成の見る窓");
  writeFileSync(path("original-settings.json"), readFileSync(path("settings.json")));
} else if (command === "cli") {
  const hooks = createRoleHooks({ rolesDir, settings });
  const commands = createDiscordVenueCommands({
    port,
    roles: () => ({ selectedRole: hooks.currentId(), roles: hooks.list() }),
    catalog: async (roleId) => {
      const role = hooks.resolveForVenue(roleId);
      if (!role) throw new Error("fixture role missing");
      const { experience } = makeDiscord(() => role, false);
      const result = await experience.catalog({ includeChats: true });
      if (!result.ok) throw new Error(result.reason);
      return { ...result, role: { id: role.id, name: role.name.display, model: role.brain } };
    },
    launch: (id, port) => startDetached(id, port, fileURLToPath(new URL("./discord-remote-venue-fixture-child.mjs", import.meta.url)),
      { ...process.env, SOUL_VENUE_FIXTURE_ROOT: root }),
    receipt: (id) => readRemoteVenueReceipt(id, path("receipts"))
  });
  await printDiscordVenueResult(args, commands);
} else if (command === "serve") {
  const hooks = createRoleHooks({ rolesDir, settings });
  let server;
  const role = () => server?.discordVenueRole() ?? hooks.current();
  const { experience, base } = makeDiscord(role, true);
  const place = createRoleMemoryPlaces({ root: path("memories"), currentRole: role, startedAtMs: Date.now() });
  const stamp = (file, value = "yes") => writeFileSync(path(file), value);
  const recorder = createMemoryRecorder({
    getLiveEntries: () => server.getTranscript(),
    getPlace: place.place, getWriterBrain: () => role().brain,
    onError: (error) => stamp("writer-error", error.message),
    writeImpl: async (entries, location, wording, materials, onUnconfirmedExit, brain) => {
      if (!existsSync(path("writer-first-attempt"))) {
        stamp("writer-first-attempt");
        throw new Error("fixture transient writer failure");
      }
      if (!materials.replies.length || !materials.documents.every((document) => existsSync(document.path))) {
        throw new Error("fixture work was not drained before saving");
      }
      return writeStreamRecord({
        entries, record: location.streamRecord, dir: location.dir, wording, materials, onUnconfirmedExit, strictOutcome: true,
        create: ({ cwd }) => ({
          async ask() {
            stamp("writer-model", brain);
            writeFileSync(path("writer-calls"), "write\n", { flag: "a" });
            mkdirSync(join(cwd, "fixture-topic"), { recursive: true });
            const day = location.streamRecord.dateJst;
            writeFileSync(join(cwd, "fixture-topic", `${day}.md`), "# 合成の記憶\n\n- 合成小タスクの答え\n");
            writeFileSync(join(cwd, "fixture-topic", "_map.md"), "- 合成の記憶\n");
            return { replyText: "記録済み" };
          },
          dispose() {}
        })
      });
    }
  });
  const stream = createStreamVenueHooks({
    memoryPlaces: place, memoryRecorder: recorder, hasBody: () => false,
    openSession: () => { stamp("conversation-model", role().brain); }, closeSession: () => {},
    channel: { getUrl: () => null, close: () => {} },
    organiser: { async organiseIfDue() {
      if (!id) return "not-due";
      if (existsSync(path("fail-organiser-once")) && !existsSync(path("organiser-first-attempt"))) {
        stamp("organiser-first-attempt");
        return "start-failed";
      }
      stamp("organised", role().brain);
      return "organised";
    } }
  });
  server = createCockpitServer({
    port,
    ...(id ? {
      reservedServer: await reserveRemoteVenuePort(port),
      remoteVenue: { id, async finish(outcome) {
        await server.close();
        await writeRemoteVenueReceipt(id, outcome, path("receipts"));
        process.exit(0);
      } }
    } : {}),
    settingsStore: settings,
    experiences: { discord: experience },
    resolveDiscordVenueRole: hooks.resolveForVenue,
    roles: [{
      id: () => role().id, identity: () => roleIdentity(role()), discordBotKeyFile: () => roleDiscordBotKeyFile(role()),
      hooks: stream.hooks, voice: { prepare: () => ({ ok: true }), startResources() {} }
    }],
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fixture-stt" }),
    localSttModelCheck: () => ({ ok: true }),
    pipelineFactory: (options) => ({ transcriptBuffer: options.transcriptBuffer, start() {}, dispose() {} })
  });
  await server.listen();
  if (id) {
    // Simulate accepted work in the same venue task scope used by production.
    const interval = setInterval(() => {
      const resources = server.getActiveVenueTaskResources();
      if (!resources) return;
      clearInterval(interval);
      const document = resources.storeDocument({ name: "合成資料.pdf", bytes: Buffer.from("fixture"), kind: "pdf" });
      stamp("material-path", document.path);
      stamp("first-join", JSON.stringify(base.record.joins[0]));
      void resources.runTask({
        kind: "local", request: "合成小タスク", sessionOptions: {}, content: "合成資料",
        create: () => ({
          async ask() {
            stamp("task-started");
            while (!existsSync(path("finish-task"))) await delay(50);
            return { replyText: "合成小タスクの答え" };
          },
          dispose() { stamp("task-finished"); }
        })
      });
    }, 10);
    interval.unref();
  }
  if (!id) {
    const { createInterface } = await import("node:readline");
    createInterface({ input: process.stdin }).on("close", async () => {
      await server.endStream();
      await server.close();
    });
  }
}
