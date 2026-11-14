import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { connectMotionReplay } from "./replay-stage-y.mjs";

const [electron, model, chrome] = process.argv.slice(2);
assert(electron && model && chrome, "Usage: node apps/runtime-player/scripts/capture-speech-motion.mjs <Electron exe> <r804 export directory> <Chrome exe>");
const workRoot = resolve("tmp", "performance-attention-display");
await mkdir(workRoot, { recursive: true });
const evidence = await mkdtemp(join(workRoot, "proof-"));
const profile = join(evidence, "profile");
const slot = join(profile, "slots", "performance-attention-proof");
const manualTransform = {
  coordinateSpace: "stage-viewport-px-v1",
  pan: { x: -522, y: -123 },
  zoomScale: 2.75
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
await cp(resolve("apps/runtime-player/assets/speech-motions"), join(slot, "speech-motions"), { recursive: true });
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
        reject(new Error(`CDP timed out on ${targetPath} ${method}.`));
      }, 15_000);
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
      const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
        .catch((error) => { throw new Error(`${error.message} Expression: ${expression}`); });
      if (result.exceptionDetails) throw new Error(`CDP evaluation failed on ${targetPath}: ${expression}`);
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

const built = resolve("apps/runtime-player/out");
const instrumented = join(evidence, "out");
await cp(built, instrumented, { recursive: true });
const assets = join(instrumented, "renderer", "assets");
const rendererAsset = (await readdir(assets)).find((name) => /^static-stage-canvas-renderer-.*\.js$/.test(name));
assert(rendererAsset, "Build Runtime Player before capturing evidence.");
const rendererPath = join(assets, rendererAsset);
const renderer = await readFile(rendererPath, "utf8");
const frameAnchor = "this.lastLiveSourceTimestampMs = liveFrame.sourceFrameTimestampMs;";
const renderAnchor = "this.renderCount += 1;";
for (const anchor of [frameAnchor, renderAnchor]) assert.equal(renderer.split(anchor).length, 2, anchor);
// Read the pixels within the render task, before compositing clears the buffer.
// Only the isolated copy lets the harness request the regular scheduled draw
// immediately, to keep hidden-window animation scheduling out of capture timing.
await writeFile(rendererPath, renderer
  .replace(frameAnchor, `${frameAnchor}
    this.motionProofAppliedFrame = liveFrame;`)
  .replace(renderAnchor, `${renderAnchor}
    if (mode === "scheduled" && this.motionProofAppliedFrame && renderInput) {
      const view = this.displayViewTransform ?? this.viewTransform;
      window.motionProofLatest = {
        frame: this.motionProofAppliedFrame,
        transform: { ...view, coordinateSpace: "stage-viewport-px-v1" },
        paintedAtMs: Date.now()
      };
      window.motionProofRenderNow = () => {
        this.renderScheduledFrame();
        return { ...window.motionProofLatest, png: this.canvas.toDataURL("image/png").split(",")[1] };
      };
    }`));
const main = join(instrumented, "main", "main.mjs");
await writeFile(main, await readFile(join(built, "main", "main.js")));
const launcher = join(evidence, "isolated-launcher.mjs");
await writeFile(launcher, `
import { BrowserWindow } from "electron";
// Keep the two isolated windows off the desktop while retaining renderer paint.
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
await import(${JSON.stringify(pathToFileURL(main).href)});
`);
const runtimeDebugPort = await localPort();
const samples = {};
const pairs = [
  ["receive", "partner"], ["interest", "partner"], ["ask", "partner"],
  ["brief-relief", "game"], ["brief-relief", "partner"], ["brief-relief", "viewers"]
];
let channel;
let control;
let browser;
let generation = 0;
try {
  launch(electron, [
    launcher, "--role=autonomousHost", "--profile=performance-attention-proof", `--user-data-dir=${profile}`,
    `--remote-debugging-port=${runtimeDebugPort}`, "--enable-unsafe-swiftshader", "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows"
  ]);
  control = await connect(runtimeDebugPort, "/control/index.html");
  const stage = await connect(runtimeDebugPort, "/stage/index.html");
  const modelSummary = await retry("r804 Runtime Export", () => control.evaluate(
    "window.runtimePlayer.runtimeExport.getStatus().then(state => state.summary)"
  ));
  assert.equal(modelSummary.packageRevision, 804);
  const initialTransform = await retry("Native Stage transform", () =>
    stage.evaluate("window.runtimePlayerStage.stageView.getViewTransform()"));
  assert.deepEqual(initialTransform, manualTransform);
  await control.evaluate("window.runtimePlayer.physiology.setStagePresenceEnabled({ enabled: false })");
  const presence = await control.evaluate(
    "window.runtimePlayer.physiology.getStatus().then(status => status.sections.find(section => 'stagePresenceEnabled' in section)?.stagePresenceEnabled)"
  );
  assert.equal(presence, false);
  const endpoint = await control.evaluate("window.runtimePlayer.channel.openChannel().then(result => result.status.endpointUrl)");
  channel = await connectMotionReplay(endpoint);
  const display = (client) => ({
    sample: () => client.evaluate("window.motionProofLatest"),
    capture: () => client.evaluate("window.motionProofRenderNow()")
  });

  async function capture(display, key, started = Date.now()) {
    const screenshotStarted = Date.now();
    const { png, ...measured } = await display.capture();
    assert(measured?.frame, `Missing ${key} live frame`);
    assert.equal(measured.transform.pan.x, manualTransform.pan.x);
    assert.equal(measured.transform.zoomScale, manualTransform.zoomScale);
    await writeFile(join(evidence, key + ".png"), Buffer.from(png, "base64"));
    samples[key] = { ...measured, timeMs: measured.frame.sourceFrameTimestampMs - started,
      screenshotStartedMs: screenshotStarted - started, screenshotLatencyMs: Date.now() - screenshotStarted };
    return measured;
  }

  async function play(performanceId, attentionTargetId) {
    const key = { generation: ++generation, sectionIndex: 0 };
    await channel.send({ op: "begin", ...key });
    const started = Date.now();
    await channel.send({ op: "play", ...key, performanceId, attentionTargetId });
    return { key, started };
  }

  async function run(display, name) {
    await retry(name + " painted frame", async () => (await display.sample())?.frame);
    await capture(display, name + "-baseline");
    for (const [performanceId, attentionTargetId] of pairs) {
      const id = [name, performanceId, attentionTargetId].join("-");
      const before = await display.sample();
      const { key, started } = await play(performanceId, attentionTargetId);
      await delay(70);
      await channel.send({ op: "end", ...key });
      if (performanceId === "brief-relief") {
        await Promise.all([[550, "entry"], [1510, "accent"], [3200, "returning"], [4430, "terminal"], [5060, "released"]].map(async ([time, phase]) => {
          await delay(Math.max(0, started + time - Date.now()));
          await capture(display, id + "-" + phase, started);
        }));
        assert(samples[id + "-accent"].transform.pan.y > manualTransform.pan.y + 10);
        assert(Math.abs(samples[id + "-terminal"].transform.pan.y - manualTransform.pan.y) < 0.2);
        assert.equal(samples[id + "-released"].transform.pan.y, manualTransform.pan.y);
        if (attentionTargetId === "partner") {
          assert(samples[id + "-accent"].frame.parameterValues.param_body_angle_x < -5.5);
          assert.equal(samples[id + "-terminal"].frame.parameterValues.param_body_angle_x, -5);
        }
      } else {
        await delay(performanceId === "receive" ? 480 : 1100);
        const measured = await capture(display, id, started);
        const parameter = performanceId === "receive" ? "param_face_angle_y" : "param_face_angle_x";
        assert(Math.abs(measured.frame.parameterValues[parameter] - (before.frame.parameterValues[parameter] ?? 0)) > 1);
        await delay(performanceId === "ask" ? 2000 : 400);
      }
    }

    await channel.send({ slotId: "head-horizontal", value: 0.55, ttlMs: 6000 }, "intent.set");
    await delay(1500);
    const posed = await capture(display, name + "-non-neutral");
    const face = posed.frame.parameterValues.param_face_angle_x;
    assert(Math.abs(face) > 5);
    const { key, started } = await play("brief-relief", "viewers");
    await channel.send({ op: "end", ...key });
    await delay(Math.max(0, started + 85 - Date.now()));
    const entered = await capture(display, name + "-non-neutral-entry", started);
    assert(entered.frame.sourceFrameTimestampMs >= started);
    assert(Math.abs(entered.frame.parameterValues.param_face_angle_x - face) < 3);
    await channel.send({
      timeline: [{ timeMs: 0, vowel: "a", s: 0.9 }, { timeMs: 1100, vowel: "o", s: 0.8 }]
    }, "intent.speech");
    await delay(Math.max(0, started + 220 - Date.now()));
    await capture(display, name + "-non-neutral-transition", started);
    await delay(Math.max(0, started + 1000 - Date.now()));
    const active = await capture(display, name + "-before-kill", started);
    assert(active.transform.pan.y > manualTransform.pan.y + 3);
    assert(active.frame.parameterValues.param_mouth_open > 0.1);
    await channel.send({ op: "cancel", ...key });
    await delay(500);
    const released = await capture(display, name + "-after-kill", started);
    assert.equal(released.transform.pan.y, manualTransform.pan.y);
  }

  await run(display(stage), "native");

  const browserUrl = await control.evaluate("window.runtimePlayer.browserSource.getStatus().then(status => status.browserSourceUrl)");
  const chromeDebugPort = await localPort();
  launch(chrome, [
    "--headless=new", "--enable-unsafe-swiftshader", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-background-networking", "--disable-component-update",
    `--user-data-dir=${join(profile, "chrome")}`, `--remote-debugging-port=${chromeDebugPort}`, "about:blank"
  ]);
  browser = await connect(chromeDebugPort, "about:blank");
  await browser.command("Emulation.setDeviceMetricsOverride", {
    width: 600, height: 720, deviceScaleFactor: 1, mobile: false
  });
  const navigation = await browser.command("Page.navigate", { url: browserUrl });
  assert(!navigation.errorText, navigation.errorText);
  try {
    await retry("Browser Source renderer", () => browser.evaluate("!!window.motionProofLatest?.frame"), 20_000);
  } catch (error) {
    await writeJson(join(evidence, "browser-diagnostic.json"), {
      browser: await browser.evaluate(`({
        path: location.pathname, title: document.title, canvasCount: document.querySelectorAll("canvas").length,
        scriptCount: document.scripts.length
      })`),
      source: await control.evaluate(`window.runtimePlayer.browserSource.getStatus().then(status => ({
        connectedClientCount: status.connectedClientCount, latestFrame: status.latestFrame,
        serverState: status.serverState, stageEndpoint: status.stageEndpoint
      }))`)
    });
    throw error;
  }
  await delay(1200);
  await run(display(browser), "browser");

  const report = {
    mainSha256: createHash("sha256").update(await readFile(main)).digest("hex"),
    uninstrumentedRendererSha256: createHash("sha256").update(renderer).digest("hex"),
    packageRevision: modelSummary.packageRevision,
    stagePresenceEnabled: presence,
    manualTransform,
    samples
  };
  await writeJson(join(evidence, "samples.json"), report);
  console.log(evidence);
} finally {
  await writeJson(join(evidence, "raw-samples.json"), samples);
  channel?.close();
  await Promise.allSettled([control, browser].filter(Boolean).map((client) => client.command("Browser.close")));
  clients.forEach((client) => client.close());
  children.forEach((child) => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  });
}
