import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  connectMotionReplay,
  loadMotionDefinition
} from "../../../../../../apps/runtime-player/scripts/replay-stage-y.mjs";

const evidence = dirname(fileURLToPath(import.meta.url));
const [exe, model, chrome] = process.argv.slice(2);
assert(exe && model, "Usage: node capture-stage-y.mjs <Runtime Player exe> <runtime-export directory> [Chrome exe]");
const workRoot = resolve("tmp", "stage-y-display");
await mkdir(workRoot, { recursive: true });
const profile = await mkdtemp(join(workRoot, "runtime-"));
const slot = join(profile, "slots", "stage-y-proof");
const manualTransform = {
  coordinateSpace: "stage-viewport-px-v1",
  pan: { x: 21, y: 34 },
  zoomScale: 0.85
};

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}

await writeJson(join(slot, "startup-state", "runtime-player-startup.json"), {
  schemaVersion: "runtime-player-startup-state-v1",
  updatedAtIso: new Date().toISOString(),
  lastRuntimeExportDirectory: resolve(model)
});
await writeJson(join(slot, "window-state", "runtime-player.json"), {
  schemaVersion: "runtime-player-window-state-v1",
  updatedAtIso: new Date().toISOString(),
  windows: {
    control: { bounds: { x: 0, y: 0, width: 790, height: 720 } },
    stage: { bounds: { x: 810, y: 20, width: 600, height: 720 } }
  },
  stageView: { transform: manualTransform }
});

async function retry(description, read, timeout = 55_000) {
  const end = Date.now() + timeout;
  do {
    try {
      const value = await read();
      if (value) return value;
    } catch {}
    await delay(200);
  } while (Date.now() < end);
  throw new Error(`Timed out waiting for ${description}.`);
}

async function attach(port, targetPath) {
  const target = await retry(targetPath, async () => {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return targets.find((item) => item.type === "page" && item.url.endsWith(targetPath));
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ready, reject) => {
    socket.addEventListener("open", ready, { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP connection failed.")), { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const response = JSON.parse(data);
    pending.get(response.id)?.(response);
  });
  function command(method, params = {}) {
    const id = ++nextId;
    return new Promise((done, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timed out on ${method}.`));
      }, 5000);
      pending.set(id, (response) => {
        pending.delete(id);
        clearTimeout(timer);
        if (response.error) reject(new Error(`CDP rejected ${method}.`));
        else done(response.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  return {
    command,
    async evaluate(expression) {
      const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error("CDP evaluation failed.");
      return result.result.value;
    },
    close: () => socket.close()
  };
}

const children = [];
const clients = [];
const launch = (file, args) => {
  const child = spawn(resolve(file), args, { windowsHide: true, stdio: "ignore" });
  child.on("error", (error) => console.error(`Could not start verification executable: ${error.code}`));
  children.push(child);
};
const connect = async (port, target) => {
  const client = await attach(port, target);
  clients.push(client);
  return client;
};
const savedMotion = await loadMotionDefinition(join(evidence, "stage-y-motion.json"));
async function localPort() {
  const server = createServer();
  return new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : done(port));
    });
  });
}
const runtimeDebugPort = await localPort();
const transforms = {};
let channel;
let control;
let browser;
let appAsarSha256;
try {
  launch(exe, [
    "--role=autonomousHost", "--profile=stage-y-proof", `--user-data-dir=${profile}`,
    `--remote-debugging-port=${runtimeDebugPort}`, "--enable-unsafe-swiftshader"
  ]);
  control = await connect(runtimeDebugPort, "/control/index.html");
  const controlFile = fileURLToPath(await control.evaluate("location.href"));
  const appAsar = await readFile(resolve(dirname(controlFile), "../../.."));
  appAsarSha256 = createHash("sha256").update(appAsar).digest("hex");
  const stage = await connect(runtimeDebugPort, "/stage/index.html");
  const modelSummary = await retry("r804 Runtime Export", () => control.evaluate(
    "window.runtimePlayer.runtimeExport.getLoadedPayload().then(payload => payload?.summary)"
  ), 15_000);
  assert.equal(modelSummary.packageRevision, 804);
  assert.deepEqual(await stage.evaluate("window.runtimePlayerStage.stageView.getViewTransform()"), manualTransform);
  await control.evaluate("window.runtimePlayer.physiology.setStagePresenceEnabled({ enabled: false })");
  const presence = await control.evaluate(
    "window.runtimePlayer.physiology.getStatus().then(status => status.sections.find(section => 'stagePresenceEnabled' in section)?.stagePresenceEnabled)"
  );
  assert.equal(presence, false);
  const endpoint = await control.evaluate("window.runtimePlayer.channel.openChannel().then(result => result.status.endpointUrl)");
  channel = await connectMotionReplay(endpoint);
  await stage.evaluate(`window.runtimePlayerStage.stageView.onApplyDisplayViewTransformRequested(
    value => { window.stageYEvidenceTransform = value; }
  ); true`);

  async function capture(client, name, expectedY, displayExpression) {
    const transform = await retry(name, async () => {
      const current = await client.evaluate(displayExpression);
      return current?.pan.y === expectedY ? current : null;
    }, 5000);
    assert.deepEqual(transform, { ...manualTransform, pan: { x: manualTransform.pan.x, y: expectedY } });
    const viewport = await client.evaluate("({ width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio })");
    transforms[name] = { viewport, transform };
    if (!chrome) return;
    const image = await client.command("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(join(evidence, name + ".png"), Buffer.from(image.data, "base64"));
  }

  async function replay(client, name, generation, displayExpression) {
    await capture(client, name + "-baseline", 34, displayExpression);
    for (let index = 0; index < 18; index += 1) {
      assert.deepEqual(await client.evaluate(displayExpression), manualTransform);
      await delay(50);
    }
    await delay(900);
    transforms[name + "-baseline-stability"] = { unchangedSamples: 18, transform: manualTransform };

    const key = { generation, sectionIndex: 1 };
    await channel.send({ op: "begin", ...key });
    await channel.send({ op: "play", ...key, ...savedMotion });
    await capture(client, name + "-up", -56, displayExpression);
    await capture(client, name + "-down", 99, displayExpression);
    await capture(client, name + "-returned", 34, displayExpression);
    await channel.send({ op: "end", ...key });
  }

  await delay(700);
  const nativeTransform = "window.stageYEvidenceTransform ?? window.runtimePlayerStage.stageView.getViewTransform()";
  await replay(stage, "native", 0, nativeTransform);
  if (chrome) {
    const browserUrl = await control.evaluate("window.runtimePlayer.browserSource.getStatus().then(status => status.browserSourceUrl)");
    const chromeDebugPort = await localPort();
    launch(chrome, [
      "--headless=new", "--enable-unsafe-swiftshader", "--no-first-run",
      `--user-data-dir=${join(profile, "chrome")}`, `--remote-debugging-port=${chromeDebugPort}`, "about:blank"
    ]);
    browser = await connect(chromeDebugPort, "about:blank");
    await browser.command("Emulation.setDeviceMetricsOverride", {
      width: 850, height: 900, deviceScaleFactor: 1, mobile: false
    });
    await browser.command("Page.navigate", { url: browserUrl });
    await retry("the Browser Source client", () => control.evaluate(
      "window.runtimePlayer.browserSource.getStatus().then(status => status.connectedClientCount > 0)"
    ));
    await delay(1500);
    const reportedTransform = await control.evaluate(
      "window.runtimePlayer.browserSource.getStatus().then(status => status.stageDisplayState.stageView.transform)"
    );
    assert.deepEqual(reportedTransform, manualTransform);
    // Browser Source has no Electron preload. Read the transport state from the Control
    // window at each sample and capture the Browser Source renderer itself.
    const browserOutput = {
      evaluate: (expression) => expression.includes("browserSource.getStatus")
        ? control.evaluate(expression) : browser.evaluate(expression),
      command: (...args) => browser.command(...args)
    };
    await replay(browserOutput, "browser", 1,
      "window.runtimePlayer.browserSource.getStatus().then(status => status.stageDisplayState.stageView.transform)");
    assert.notDeepEqual(transforms["native-baseline"].viewport, transforms["browser-baseline"].viewport);
    await writeJson(join(evidence, "display-transforms.json"), {
      appAsarSha256, packageRevision: modelSummary.packageRevision,
      stagePresenceEnabled: presence, manualTransform, transforms
    });
  }
  assert.deepEqual(await stage.evaluate("window.runtimePlayerStage.stageView.getViewTransform()"), manualTransform);
  const report = { appAsarSha256, packageRevision: modelSummary.packageRevision, stagePresenceEnabled: presence, transforms };
  if (!chrome) await writeJson(join(evidence, "portable-smoke.json"), report);
  console.log(JSON.stringify(report));
} finally {
  channel?.close();
  // Closing the debugging browsers gracefully also reaps the portable executable's
  // extracted child. Only the processes started above are eligible for termination.
  await Promise.allSettled([control, browser].filter(Boolean).map((client) => client.command("Browser.close")));
  clients.forEach((client) => client.close());
  children.forEach((child) => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  });
}
