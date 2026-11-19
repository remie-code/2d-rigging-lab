import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  createDiscordVenueExperience,
  createMemoryRecorder,
  createRoleMemoryPlaces,
  createStreamVenueHooks,
  createVenueRoleBundle
} from "./cockpit.mjs";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { DEFAULT_MEMORY_DIR, prepareMemoryFolder } from "../src/memory/memory-store.mjs";
import { createFireOrchestrator } from "../src/mind/fire-orchestrator.mjs";
import { writeStreamRecord } from "../src/mind/memory.mjs";
import { normalizeRole, roleIdentity } from "../src/roles/role-store.mjs";
import { createFakeDiscord } from "../src/test-support/fake-discord.mjs";

const guildId = "100000000000000001";
const channelId = "100000000000000002";
const speakerId = "100000000000000003";
const question = "合成の発話。今日の予定は？";
const answer = "合成の返答。動作確認を進めよう。";

async function post(url, path, expectedStatus, body = {}) {
  const response = await fetch(url + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(result));
  return result;
}

function git(dir, ...args) {
  return execFileSync("git", ["--no-optional-locks", `--git-dir=${join(dir, ".git")}`, `--work-tree=${dir}`, ...args],
    { cwd: dir, encoding: "utf8", windowsHide: true, timeout: 30_000 }).trimEnd();
}

for (const experience of ["stream", "discord"]) {
  test(`${experience}: conversation is committed to the isolated role when the Cockpit closes the venue`, { timeout: 30_000 }, async (t) => {
    const temporaryParent = realpathSync(tmpdir());
    const root = realpathSync(mkdtempSync(join(temporaryParent, "soul-venue-memory-")));
    assert.equal(dirname(root), temporaryParent);
    const memoryRoot = join(root, "memories");
    const role = normalizeRole(`wave-one-${experience}`, { body: false });
    const expectedDir = join(memoryRoot, role.id);
    const productionRelative = relative(DEFAULT_MEMORY_DIR, expectedDir);
    assert.ok(productionRelative.startsWith(`..${sep}`) || isAbsolute(productionRelative), expectedDir);

    let server;
    t.after(async () => {
      try {
        await server?.close();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    const settings = createFileSettingsStore({ path: join(root, "settings.json") });
    settings.setDiscordPrep({ guildId, channelId, sttEngine: "elevenlabs" });
    const discord = createFakeDiscord({
      guilds: [{ id: guildId, name: "合成サーバー", channels: [{ id: channelId, name: "合成VC" }],
        members: { [speakerId]: "合成参加者" } }]
    });
    const places = createRoleMemoryPlaces({
      root: memoryRoot,
      currentRole: () => role,
      startedAtMs: Date.now(),
      prepareImpl: async (options) => {
        assert.equal(options.dir, expectedDir);
        return prepareMemoryFolder(options);
      }
    });
    assert.deepEqual(places.placeInfo(), { roleId: role.id, dir: expectedDir });

    const writerErrors = [];
    const writerRequests = [];
    const spoken = [];
    let ear;
    let sessionOpen = false;
    const recorder = createMemoryRecorder({
      getLiveEntries: () => server.getTranscript(),
      getPlace: places.place,
      getWording: () => server?.venueContext()?.wording ?? null,
      onError: (error) => writerErrors.push(error),
      onSaved: (info) => stream.noteSaved(info),
      writeImpl: async (entries, place, wording, materials, onUnconfirmedExit) => {
        assert.equal(place.dir, expectedDir);
        await place.ready;
        return writeStreamRecord({
          entries, record: place.streamRecord, dir: place.dir, wording, materials, onUnconfirmedExit,
          create: ({ cwd }) => {
            assert.equal(realpathSync(cwd), expectedDir);
            return {
              async ask(request) {
                writerRequests.push(request);
                mkdirSync(join(cwd, "fixture-topic"));
                writeFileSync(join(cwd, "fixture-topic", "conversation.md"), request);
                return { replyText: "記録済み" };
              },
              dispose() {}
            };
          }
        });
      }
    });
    const stream = createStreamVenueHooks({
      memoryPlaces: places,
      memoryRecorder: recorder,
      getEntries: () => server.getTranscript(),
      isStreamOpen: () => server?.streamStatus().phase === "open",
      openSession: () => { sessionOpen = true; },
      closeSession: () => { sessionOpen = false; },
      hasBody: () => role.body,
      channel: { getUrl: () => null, close() {} }
    });
    const bundle = createVenueRoleBundle({
      currentId: () => role.id,
      identity: () => roleIdentity(role),
      streamHooks: stream.hooks,
      prepareVoice: () => ({ ok: true }),
      startVoiceResources() {}
    });
    server = createCockpitServer({
      settingsStore: settings,
      roles: [bundle],
      experiences: {
        discord: createDiscordVenueExperience({
          settings,
          currentKeyFile: () => null,
          write() {},
          loadToken: () => ({ ok: true, token: "fixture-token" }),
          loadLibraries: discord.loadLibraries
        })
      },
      elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fixture-stt" }),
      localSttModelCheck: () => ({ ok: true }),
      pipelineFactory: (options) => ({
        transcriptBuffer: options.transcriptBuffer,
        start() { ear = options.transcriptBuffer; },
        dispose() { ear = undefined; },
        isDisposed: () => false,
        streamMs: () => 0,
        stats: () => ({})
      }),
      fireOrchestratorFactory: (hooks) => createFireOrchestrator({
        ...hooks,
        session: {
          async ask(request) {
            assert.equal(sessionOpen, true);
            assert.ok(request.includes(question));
            return { replyText: answer };
          }
        },
        player: { play() {} },
        speakImpl: async (value) => {
          spoken.push(value);
          return { timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: null };
        }
      })
    });
    const url = await server.listen(0);
    await post(url, "/api/stream/start", 200, { experience, ...(experience === "stream" ? { device: "Fixture mic" } : {}) });
    assert.equal(server.streamStatus().experience, experience);
    assert.equal(places.place().dir, expectedDir);
    const seedHead = git(expectedDir, "rev-parse", "HEAD");
    assert.equal(git(expectedDir, "ls-tree", "--name-only", "HEAD"), "_conventions.md");
    if (experience === "discord") {
      discord.speak(speakerId);
      for (let attempt = 0; !ear && attempt < 100; attempt += 1) await delay(5);
    }
    assert.ok(ear, "the venue's ear was opened");
    ear.append({ text: question, startMs: 100, endMs: 200 });
    assert.equal(server.getTranscript().find((entry) => entry.text === question)?.speaker, "you");
    if (experience === "discord") {
      assert.equal(server.getTranscript().find((entry) => entry.text === question)?.speakerId, speakerId);
    }
    const fire = await post(url, "/api/fire", 202);
    assert.equal(fire.replyText, answer);
    assert.deepEqual(spoken, [answer]);
    assert.equal(server.getTranscript().find((entry) => entry.text === answer)?.speaker, "soul");

    await post(url, "/api/stream/stop", 200);
    assert.equal(server.streamStatus().phase, "closed");
    assert.equal(sessionOpen, false);
    assert.deepEqual(writerErrors, []);
    assert.equal(writerRequests.length, 1);
    assert.ok(writerRequests[0].includes(question));
    assert.ok(writerRequests[0].includes(answer));
    assert.equal(git(expectedDir, "rev-parse", "HEAD^"), seedHead);
    assert.match(git(expectedDir, "log", "-1", "--format=%s"), /書き出し役/);
    assert.equal(git(expectedDir, "status", "--porcelain=v1", "--untracked-files=all"), "");
    const memoryPath = "fixture-topic/conversation.md";
    const record = readFileSync(join(expectedDir, memoryPath), "utf8").trimEnd();
    assert.equal(git(expectedDir, "show", `HEAD:${memoryPath}`), record);
    assert.ok(record.includes(question));
    assert.ok(record.includes(answer));
  });
}
