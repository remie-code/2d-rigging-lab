import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const agentRoot = fileURLToPath(new URL("../", import.meta.url));

test("the public Cockpit CLI starts the production server from an isolated copy and shuts down on EOF", {
  timeout: 20000
}, async (t) => {
  const sdkName = "@anthropic-ai/claude-agent-sdk";
  const sdkSource = dirname(fileURLToPath(import.meta.resolve(sdkName)));
  const parent = await realpath(tmpdir());
  const root = await realpath(await mkdtemp(join(parent, "soul-cockpit-startup-")));
  assert.equal(dirname(root), parent);
  let child;
  let exited;
  let deadline;
  t.after(async () => {
    clearTimeout(deadline);
    if (child?.exitCode === null && child.signalCode === null) child.kill();
    await exited?.catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, "scripts"));
  await cp(join(agentRoot, "scripts", "cockpit.mjs"), join(root, "scripts", "cockpit.mjs"));
  await cp(join(agentRoot, "src"), join(root, "src"), { recursive: true });
  // The Claude SDK is imported by the composition, but its CLI starts at session open.
  await cp(sdkSource, join(root, "node_modules", sdkName), { recursive: true, dereference: true });
  // No operator settings, role data, memory, secrets, diagnostics or rollout ledger enter the copy.
  assert.deepEqual((await readdir(root)).sort(), ["node_modules", "scripts", "src"]);
  const preload = join(root, "isolated-home.mjs");
  await writeFile(preload, `
    import os from "node:os";
    import { syncBuiltinESMExports } from "node:module";
    os.homedir = () => process.cwd();
    syncBuiltinESMExports();
    globalThis.fetch = () => { throw new Error("unexpected outbound fetch during Cockpit startup"); };
  `);

  child = spawn(process.execPath, [
    "--permission", `--allow-fs-read=${root}`,
    `--allow-fs-write=${root}`, "--import", pathToFileURL(preload).href,
    join(root, "scripts", "cockpit.mjs"), "--port", "0"
  ], {
    cwd: root,
    env: process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {},
    windowsHide: true,
    stdio: "pipe"
  });
  exited = once(child, "close");
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (data) => { stderr += data; });
  const listening = new Promise((resolve) => {
    child.stdout.on("data", (data) => {
      stdout += data;
      const match = /\[cockpit\] listening on (http:\/\/127\.0\.0\.1:\d+) \(loopback only\)/.exec(stdout);
      if (match) resolve(match[1]);
    });
  });
  const url = await Promise.race([
    listening,
    exited.then(([code]) => { throw new Error(`Cockpit exited before listening (${code}): ${stderr}`); }),
    new Promise((_, reject) => {
      deadline = setTimeout(() => reject(new Error(`Cockpit did not listen: ${stderr}`)), 10000);
    })
  ]);
  clearTimeout(deadline);
  const page = await fetch(url + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<!doctype html>/i);
  const state = await fetch(url + "/api/state");
  assert.equal(state.status, 200, await state.clone().text());
  const snapshot = await state.json();
  assert.equal(snapshot.stream.phase, "closed");
  assert.equal(snapshot.memory.dir, join(root, "memories", snapshot.memory.roleId));
  assert.equal(snapshot.brain.credentialHealth, false);
  const events = await fetch(url + "/api/events");
  assert.equal(events.status, 200);
  const reader = events.body.getReader();
  try {
    let initial = "";
    const stateEvent = /^event: state\ndata: (.+)\n\n/m;
    while (!stateEvent.test(initial)) {
      const { done, value } = await reader.read();
      assert.equal(done, false);
      initial += Buffer.from(value).toString("utf8");
    }
    assert.equal(JSON.parse(initial.match(stateEvent)[1]).stream.phase, "closed");
  } finally {
    await reader.cancel();
  }

  child.stdin.end();
  const [code, signal] = await exited;
  assert.deepEqual([code, signal], [0, null], stderr);
  assert.match(stdout, /Ctrl\+C \/ EOF/);
});
