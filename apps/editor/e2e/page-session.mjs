import { CdpClient } from "./cdp-client.mjs";

export const createPageSession = async ({ browserPort, viewport, url }) => {
  const target = await createTarget(browserPort);
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  const session = new PageSession({ browserPort, client, targetId: target.id });

  await client.call("Page.enable");
  await client.call("Runtime.enable");
  await client.call("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    mobile: viewport.isMobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height
  });
  await session.navigate(url);

  return session;
};

class PageSession {
  constructor({ browserPort, client, targetId }) {
    this.browserPort = browserPort;
    this.client = client;
    this.targetId = targetId;
  }

  async navigate(url) {
    await Promise.all([
      this.client.waitForEvent("Page.loadEventFired", 10_000),
      this.client.call("Page.navigate", { url })
    ]);
  }

  async reload() {
    await Promise.all([
      this.client.waitForEvent("Page.loadEventFired", 10_000),
      this.client.call("Page.reload", { ignoreCache: true })
    ]);
  }

  async evaluate(fn, ...args) {
    const expression = `Promise.resolve((${fn})(...${JSON.stringify(args)}))`;
    const result = await this.client.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });

    if (result.exceptionDetails !== undefined) {
      throw new Error(formatRuntimeException(result.exceptionDetails));
    }

    return result.result.value;
  }

  async captureScreenshot(label) {
    const result = await this.client.call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false
    });

    if (typeof result.data !== "string" || result.data.length === 0) {
      throw new Error(`Screenshot capture for ${label} returned no image data.`);
    }

    return {
      label,
      format: "png",
      base64Length: result.data.length
    };
  }

  async waitFor(label, predicate, options = {}, ...args) {
    const timeoutMs = options.timeoutMs ?? 5_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await this.evaluate(predicate, ...args)) {
        return;
      }

      await delay(100);
    }

    throw new Error(`Timed out waiting for ${label}.`);
  }

  async close() {
    this.client.close();
    await fetch(`http://127.0.0.1:${this.browserPort}/json/close/${this.targetId}`).catch(() => {});
  }
}

const createTarget = async (browserPort) => {
  const response = await fetch(
    `http://127.0.0.1:${browserPort}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" }
  );

  if (!response.ok) {
    throw new Error(`Could not create Chrome DevTools target: HTTP ${response.status}`);
  }

  const target = await response.json();

  if (typeof target.webSocketDebuggerUrl !== "string") {
    throw new Error("Chrome DevTools target did not include a websocket URL.");
  }

  return target;
};

const formatRuntimeException = (exceptionDetails) => {
  const text = exceptionDetails.exception?.description ?? exceptionDetails.text ?? "Runtime evaluation failed.";

  return text;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
