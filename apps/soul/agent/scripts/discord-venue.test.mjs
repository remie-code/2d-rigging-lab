import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { normalizeRole, roleIdentity } from "../src/roles/role-store.mjs";
import { createDiscordVenueCommands } from "./discord-venue.mjs";

const exec = promisify(execFile);
const fixture = fileURLToPath(new URL("../src/test-support/discord-remote-venue-fixture.mjs", import.meta.url));
const target = ["--guild", "合成サーバー", "--vc", "出先のVC", "--role", "visitor", "--model", "codex-astra", "--chat", "資料"];

async function withPort(fn) {
  const guard = createServer();
  await new Promise((resolve, reject) => guard.once("error", reject).listen(0, "127.0.0.1", resolve));
  try { return await fn(guard.address().port); }
  finally { await new Promise((resolve) => guard.close(resolve)); }
}

async function until(get, check = Boolean) {
  for (let i = 0; i < 100; i += 1) {
    const result = await get();
    if (check(result)) return result;
    await delay(50);
  }
  throw new Error("fixture did not reach expected state");
}

function post(port, path, body) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
}

test("duplicate Discord candidate stops before launch", async () => {
  const port = await withPort((p) => p);
  let launches = 0;
  const commands = createDiscordVenueCommands({
    port,
    catalog: async (id) => {
      assert.equal(id, "visitor");
      return { guilds: [{ name: "同名", channels: [{ name: "VC", category: "前" }, { name: "VC", category: "後" }] }] };
    },
    launch: async () => { launches += 1; throw new Error("unexpected spawn"); }
  });
  await assert.rejects(
    commands.open({ guild: "同名", vc: "VC", role: "visitor" }),
    (error) => error.details.candidates.map((entry) => entry.category).join(",") === "前,後"
  );
  assert.equal(launches, 0);
});

test("separate calls own the same detached venue, reject other Cockpits, and retry a failed close", { timeout: 60000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), "soul-discord-remote-"));
  const [port, ordinaryPort] = await withPort((port) => withPort((other) => [port, other]));
  const cli = (args, options = {}) => exec(process.execPath, [fixture, "cli", root, port, ...args], options);
  const json = async (args) => JSON.parse((await cli(args)).stdout);
  await exec(process.execPath, [fixture, "setup", root, port]);
  writeFileSync(join(root, "fail-organiser-once"), "");
  let child;
  let id;
  t.after(async () => {
    if (child && child.exitCode === null) {
      child.stdin.end();
      await once(child, "exit");
    }
    if (existsSync(join(root, "fail-voice-exit"))) unlinkSync(join(root, "fail-voice-exit"));
    writeFileSync(join(root, "finish-task"), "");
    const current = id ?? (await json(["status"]).catch(() => null))?.venueId;
    if (current) {
      for (let i = 0; i < 3; i += 1) {
        if (await json(["close", "--venue", current, "--wait-ms", "6000"]).catch(() => null)) break;
      }
    }
    rmSync(root, { recursive: true, force: true });
  });
  const runOrdinary = async (listenPort) => {
    child = spawn(process.execPath, [fixture, "serve", root, listenPort], {
      stdio: ["pipe", "ignore", "ignore"], windowsHide: true
    });
    await until(() => fetch(`http://127.0.0.1:${listenPort}/api/state`).catch(() => null),
      (response) => response?.ok);
  };
  await runOrdinary(port);
  await assert.rejects(cli(["open", ...target]), (error) => /別の Cockpit/.test(error.stderr));
  assert.equal((await post(port, "/api/stream/start", { experience: "discord" })).status, 200);
  child.stdin.end();
  const [exit] = await once(child, "exit");
  assert.equal(exit, 0, "normal Cockpit exits on EOF");

  await assert.rejects(cli(["open", "--guild", "合成サーバー", "--vc", "出先のVC"]), (error) => /一致候補/.test(error.stderr));
  assert.equal((await json(["status"])).status, "idle");
  const both = await Promise.allSettled([json(["open", ...target]), json(["open", ...target])]);
  assert.equal(both.filter((item) => item.status === "fulfilled").length, 1);
  const opened = both.find((item) => item.status === "fulfilled").value;
  id = opened.venueId;
  assert.equal(opened.status, "open");
  assert.equal(opened.stream.vcName, "出先のVC");
  assert.deepEqual(opened.role, { id: "visitor", name: "出先テスト", model: "codex-astra" });
  assert.deepEqual([opened.chat.selectedName, opened.chat.listening], ["資料", true]);
  assert.equal((await json(["status", "--venue", id])).venueId, id);
  assert.equal(readFileSync(join(root, "conversation-model"), "utf8"), "codex-astra");
  await until(() => existsSync(join(root, "task-started")));
  const materialPath = readFileSync(join(root, "material-path"), "utf8");
  assert.equal(JSON.parse(readFileSync(join(root, "first-join"), "utf8")).channelId, opened.voice.channelId);

  await runOrdinary(ordinaryPort);
  const conflict = await post(ordinaryPort, "/api/stream/start", { experience: "discord" });
  assert.equal(conflict.status, 500);
  assert.match((await conflict.json()).error, /重複起動/);
  assert.equal((await json(["status", "--venue", id])).stream.connection, "joined");
  const wrong = randomUUID();
  await assert.rejects(cli(["leave", "--venue", wrong]));
  await assert.rejects(cli(["close", "--venue", wrong]));
  assert.equal((await post(port, "/api/stream/stop", {})).status, 409);
  writeFileSync(join(root, "fail-voice-exit"), "");
  await assert.rejects(cli(["leave", "--venue", id]), (error) =>
    JSON.parse(error.stderr).state?.stream.connection === "disconnected");
  unlinkSync(join(root, "fail-voice-exit"));
  assert.equal((await json(["leave", "--venue", id])).stream.connection, "outside");
  assert.equal((await json(["status", "--venue", id])).stream.phase, "open");

  await assert.rejects(cli(["close", "--venue", id, "--wait-ms", "250"]), (error) =>
    error.code === 2 && JSON.parse(error.stdout).closing === "in-progress");
  assert.equal(existsSync(join(root, "task-finished")), false);
  assert.equal(existsSync(join(root, "writer-first-attempt")), false);
  const drainingConflict = await post(ordinaryPort, "/api/stream/start", { experience: "discord" });
  assert.match((await drainingConflict.json()).error, /重複起動/);
  writeFileSync(join(root, "finish-task"), "");
  const failed = await until(async () => {
    try { return await json(["status", "--venue", id]); }
    catch (error) { return JSON.parse(error.stdout); }
  }, (state) => state.closing === "failed");
  assert.equal(failed.retryable, true);
  assert.match(failed.closeError, /failed/);
  assert.equal(existsSync(materialPath), true);
  assert.equal(existsSync(join(root, "organised")), false);
  const failedCloseConflict = await post(ordinaryPort, "/api/stream/start", { experience: "discord" });
  assert.match((await failedCloseConflict.json()).error, /重複起動/);
  await assert.rejects(cli(["close", "--venue", id]), (error) => {
    const state = JSON.parse(error.stderr);
    return state.retryable && /saved.*start-failed/.test(state.closeError);
  });
  assert.equal(existsSync(materialPath), true);
  const receipt = await json(["close", "--venue", id]);
  assert.deepEqual(receipt, { venueId: id, recording: "saved", organising: "organised", closing: "complete" });
  assert.deepEqual(await json(["status", "--venue", id]), receipt);
  assert.equal((await json(["status"])).status, "idle");
  assert.equal(existsSync(materialPath), false);
  assert.equal(readFileSync(join(root, "writer-model"), "utf8"), "codex-astra");
  assert.equal(readFileSync(join(root, "writer-calls"), "utf8"), "write\n", "organiser retry must not write twice");
  assert.equal(readFileSync(join(root, "organised"), "utf8"), "codex-astra");
  const saved = await exec("git", ["-C", join(root, "memories", "visitor"), "log", "-1", "--format=%s"]);
  assert.match(saved.stdout, /書き出し役/u);
  assert.deepEqual(readFileSync(join(root, "settings.json")), readFileSync(join(root, "original-settings.json")));

  const subsequent = await post(ordinaryPort, "/api/stream/start", { experience: "discord" });
  assert.equal(subsequent.status, 200);
  assert.equal((await subsequent.json()).stream.vcName, "普段のVC");

  let rejectedId;
  await assert.rejects(cli(["open", ...target]), (error) => {
    const state = JSON.parse(error.stderr);
    rejectedId = state.venueId;
    return /重複起動/.test(state.error);
  });
  const rejected = await json(["status", "--venue", rejectedId]);
  assert.equal(rejected.stream.phase, "closed");
  assert.equal((await json(["close", "--venue", rejectedId])).recording, "not-needed");
  const stillOrdinary = await fetch(`http://127.0.0.1:${ordinaryPort}/api/state`);
  assert.equal((await stillOrdinary.json()).stream.vcName, "普段のVC");
});


test("an unconfirmed writer or organiser result blocks repeated close", async (t) => {
  for (const outcome of [
    { recording: "needs-review", organising: null },
    { recording: "saved", organising: "needs-review" }
  ]) {
    await t.test(JSON.stringify(outcome), async (t) => {
      const id = randomUUID();
      let saves = 0;
      const role = normalizeRole("test", { brain: "claude" });
      const server = createCockpitServer({
        port: 0,
        remoteVenue: { id, finish: () => assert.fail("closure cannot be confirmed") },
        resolveDiscordVenueRole: () => role,
        experiences: { discord: {
          openEntrance: () => ({ ok: true }),
          closeEntrance: () => {}
        } },
        roles: [{
          id: () => role.id,
          identity: () => roleIdentity(role),
          hooks: { saveFinal: () => { saves += 1; return outcome; } }
        }]
      });
      t.after(() => server.close());
      const url = await server.listen();
      const start = await fetch(`${url}/api/stream/start`, {
        method: "POST", headers: { "content-type": "application/json", "x-soul-venue-id": id },
        body: JSON.stringify({ experience: "discord", discordVenue: {
          guildId: "100000000000000001", channelId: "100000000000000002",
          expectedBotId: "fake-bot", expectedRole: { id: role.id, model: role.brain }
        } })
      });
      assert.equal(start.status, 200, await start.text());
      const close = () => fetch(`${url}/api/remote-venue/close`, { method: "POST", headers: { "x-soul-venue-id": id } });
      assert.equal((await close()).status, 202);
      const failure = await until(async () => (await fetch(`${url}/api/remote-venue`)).json(),
        (state) => state.closing === "failed");
      assert.equal(failure.retryable, false);
      assert.equal((await close()).status, 409);
      assert.equal(saves, 1);
    });
  }
});
