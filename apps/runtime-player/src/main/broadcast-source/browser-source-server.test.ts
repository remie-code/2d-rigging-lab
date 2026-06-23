import {
  connect,
  createServer as createNetServer,
  type AddressInfo,
  type Server as NetServer,
  type Socket
} from "node:net";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type {
  RuntimeExportLoadedPayload,
  RuntimeExportSummary
} from "../../preload/runtime-export-bridge-contract";
import { RuntimePlayerBrowserSourceServer } from "./browser-source-server";
import type {
  BrowserSourceStageDevAssetFetch
} from "./browser-source-stage-client-assets";

const TEST_TOKEN = "token_fixture";

const runningServers: RuntimePlayerBrowserSourceServer[] = [];
const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map((server) => server.stop()));
  for (const directoryPath of tempDirectories.splice(0)) {
    rmSync(directoryPath, { recursive: true, force: true });
  }
});

describe("Runtime Player Browser Source server", () => {
  it("starts on loopback and exposes a tokenized Browser Source URL", async () => {
    const server = await startTestServer();
    const status = server.getStatus();

    expect(status.state).toBe("running");
    expect(status.bindAddress).toBe("127.0.0.1");
    expect(status.port).toEqual(expect.any(Number));
    expect(status.browserSourceUrl).toBe(
      `http://127.0.0.1:${status.port}/stage?token=${TEST_TOKEN}`
    );
  });

  it("rejects missing and invalid tokens before serving protected routes", async () => {
    const server = await startTestServer();

    expect(await readResponseStatus(server, "/stage", null)).toBe(401);
    expect(await readResponseStatus(server, "/stage", "bad-token")).toBe(401);
    expect(await readResponseStatus(server, "/runtime-export/payload", null))
      .toBe(401);

    const response = await fetch(createHttpUrl(server, "/stage"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("runtime-player-browser-source-root");
    expect(html).toContain("background: transparent");
    expect(html).not.toContain("TrackingFrame");
    expect(html).not.toContain("rawFrame");
    expect(html).not.toContain("Debug");
  });

  it("serves dev stage html with same-origin Browser Source client assets", async () => {
    const server = await startTestServer({
      rendererServerUrl: "http://127.0.0.1:5173/"
    });

    const response = await fetch(createHttpUrl(server, "/stage"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(
      'src="/browser-source-dev-assets/stage/browser-source/browser-source-stage-entry.tsx"'
    );
    expect(html).toContain(
      'import RefreshRuntime from "/browser-source-dev-assets/@react-refresh";'
    );
    expect(html).toContain(
      "window.__vite_plugin_react_preamble_installed__ = true;"
    );
    expect(html.indexOf("__vite_plugin_react_preamble_installed__"))
      .toBeLessThan(html.indexOf("browser-source-stage-entry.tsx"));
    expect(html).not.toContain("http://127.0.0.1:5173");
    expect(html).not.toContain(
      "stage/browser-source/browser-source-stage-entry.tsx?token="
    );
    expect(server.getStatus().requestDiagnostics.lastStageRequest)
      .toMatchObject({
        statusCode: 200,
        statusLabel: "served"
      });
  });

  it("accepts only tokenized Browser Source client diagnostics and redacts URL tokens", async () => {
    const server = await startTestServer();
    const diagnosticsPath = "/browser-source/client-diagnostics";

    expect(await postJsonStatus(server, diagnosticsPath, {
      event: "html-inline-boot"
    }, null)).toBe(401);
    expect(await postJsonStatus(server, diagnosticsPath, {
      event: "html-inline-boot"
    }, "bad-token")).toBe(401);
    expect(server.getStatus().latestClientDiagnostic).toBeNull();

    expect(await postJsonStatus(server, diagnosticsPath, {
      event: "html-inline-boot"
    })).toBe(200);
    expect(server.getStatus().latestClientDiagnostic).toMatchObject({
      event: "html-inline-boot",
      message: null,
      source: null,
      line: null,
      column: null
    });

    expect(await postJsonStatus(server, diagnosticsPath, {
      event: "window-error",
      message: `module failed with token=${TEST_TOKEN}`,
      source: `http://127.0.0.1:49200/stage?token=${TEST_TOKEN}&v=1`,
      line: 12,
      column: 8
    })).toBe(200);

    const diagnostic = server.getStatus().latestClientDiagnostic;
    expect(diagnostic).toMatchObject({
      event: "window-error",
      message: "module failed with token=[redacted]",
      source: "http://127.0.0.1:49200/stage?token=[redacted]&v=1",
      line: 12,
      column: 8
    });
    expect(JSON.stringify(diagnostic)).not.toContain(TEST_TOKEN);
  });

  it("serves current Runtime Export payload to authorized Browser Source clients", async () => {
    const server = await startTestServer();

    const emptyResponse = await readJson(server, "/runtime-export/payload");
    expect(emptyResponse).toStrictEqual({
      status: "not-loaded",
      runtimeExport: null,
      stageDisplayState: {
        stageWindow: {
          bounds: null
        },
        stageView: {
          transform: null
        },
        updatedAtIso: null
      },
      runtimeExportStatus: {
        state: "empty",
        loaded: false,
        statusLabel: "No Runtime Export loaded",
        loadedAtIso: null,
        summary: null
      }
    });

    server.publishRuntimeExportLoaded(createLoadedPayload());

    const loadedResponse = await readJson(server, "/runtime-export/payload");

    expect(loadedResponse).toStrictEqual({
      status: "loaded",
      runtimeExportStatus: {
        state: "loaded",
        loaded: true,
        statusLabel: "Runtime Export loaded",
        loadedAtIso: "2026-06-23T01:00:00.000Z",
        summary: {
          modelDisplayName: "Fixture Model",
          packageId: "pkg_fixture",
          packageRevision: 7,
          drawableCount: 1,
          meshCount: 1,
          parameterCount: 1,
          maskCount: 0
        }
      },
      stageDisplayState: {
        stageWindow: {
          bounds: null
        },
        stageView: {
          transform: null
        },
        updatedAtIso: null
      },
      runtimeExport: {
        schemaVersion: "runtime-player-browser-source-runtime-export-v1",
        artifacts: {
          manifest: {},
          model: {},
          atlas: {}
        },
        texturePage: {
          metadata: {
            pageId: "atlas_page_0",
            path: "assets/textures/atlas_page_0.raw-rgba",
            width: 1,
            height: 1,
            pixelFormat: "rgba8",
            byteLength: 4
          },
          encoding: "base64",
          bytesBase64: "AQIDBA==",
          byteLength: 4
        },
        summary: createSummary(),
        loadedAtIso: "2026-06-23T01:00:00.000Z"
      }
    });
    expectBrowserSourcePayloadDoesNotLeakControlOrDebug(loadedResponse);
  });

  it("does not serve arbitrary files or raw tracking/debug routes", async () => {
    const server = await startTestServer();

    expect(await readResponseStatus(server, "/package.json")).toBe(404);
    expect(await readResponseStatus(server, "/../../package.json")).toBe(404);
    expect(await readResponseStatus(server, "/tracking")).toBe(404);
    expect(await readResponseStatus(server, "/debug")).toBe(404);
    expect(await readResponseStatus(server, "/input/diagnostics")).toBe(404);
  });

  it("serves generated Browser Source static JS/CSS without exposing protected routes", async () => {
    const rendererDirectoryPath = createRendererAssetFixture();
    const server = await startTestServer({
      stageStaticAssetRendererDirectoryPath: rendererDirectoryPath
    });

    const entryScriptResponse = await fetch(createHttpUrl(
      server,
      "/browser-source-assets/browser-source-stage-fixture.js",
      null
    ));
    expect(entryScriptResponse.status).toBe(200);
    expect(entryScriptResponse.headers.get("content-type")).toContain(
      "text/javascript"
    );
    expect(await entryScriptResponse.text()).toContain("split-fixture");
    expect(server.getStatus().requestDiagnostics.lastAssetRequest)
      .toMatchObject({
        routeKind: "built",
        statusCode: 200,
        statusLabel: "served"
      });

    const splitChunkResponse = await fetch(createHttpUrl(
      server,
      "/browser-source-assets/split-fixture.js",
      null
    ));
    expect(splitChunkResponse.status).toBe(200);
    expect(await splitChunkResponse.text()).toContain("split chunk");

    const cssResponse = await fetch(createHttpUrl(
      server,
      "/browser-source-assets/browser-source-stage-fixture.css",
      null
    ));
    expect(cssResponse.status).toBe(200);
    expect(cssResponse.headers.get("content-type")).toContain("text/css");

    expect(await readResponseStatus(server, "/stage", null)).toBe(401);
    expect(await readResponseStatus(server, "/runtime-export/status", null))
      .toBe(401);
    expect(await readResponseStatus(server, "/runtime-export/payload", null))
      .toBe(401);
    expect(await readResponseStatus(
      server,
      "/browser-source-assets/model.wasm",
      null
    )).toBe(404);
    expect(server.getStatus().requestDiagnostics.lastAssetRequest)
      .toMatchObject({
        routeKind: "built",
        statusCode: 404,
        statusLabel: "not-found"
      });
    expect(await readResponseStatus(
      server,
      "/browser-source-assets/%2e%2e%2fpackage.json",
      null
    )).toBe(404);
  });

  it("serves allowlisted dev proxy assets and records missing dev assets", async () => {
    const requestedUrls: string[] = [];
    const runtimePlayerViteDepPath = toPosixPath(path.resolve(
      resolveWorkspaceRootPath(),
      "apps/runtime-player/node_modules/.vite/deps/react.js"
    ));
    const server = await startTestServer({
      rendererServerUrl: "http://127.0.0.1:5173/",
      stageDevAssetFetcher: async (url) => {
        requestedUrls.push(url);
        return createFetchResponse(
          200,
          "text/javascript; charset=utf-8",
          'import "/@vite/client";'
        );
      }
    });

    const response = await fetch(createHttpUrl(
      server,
      "/browser-source-dev-assets/stage/browser-source/browser-source-stage-entry.tsx",
      null
    ));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      'import "/browser-source-dev-assets/@vite/client";'
    );
    expect(requestedUrls).toEqual([
      "http://127.0.0.1:5173/stage/browser-source/browser-source-stage-entry.tsx"
    ]);
    expect(server.getStatus().requestDiagnostics.lastAssetRequest)
      .toMatchObject({
        routeKind: "dev",
        statusCode: 200,
        statusLabel: "served"
      });

    const viteDepResponse = await fetch(createHttpUrl(
      server,
      `/browser-source-dev-assets/@fs/${runtimePlayerViteDepPath}?v=fixture`,
      null
    ));

    expect(viteDepResponse.status).toBe(200);
    expect(requestedUrls).toEqual([
      "http://127.0.0.1:5173/stage/browser-source/browser-source-stage-entry.tsx",
      `http://127.0.0.1:5173/@fs/${runtimePlayerViteDepPath}?v=fixture`
    ]);
    expect(server.getStatus().requestDiagnostics.lastAssetRequest)
      .toMatchObject({
        routeKind: "dev",
        statusCode: 200,
        statusLabel: "served"
      });

    expect(await readResponseStatus(
      server,
      "/browser-source-dev-assets/main/main.ts",
      null
    )).toBe(404);
    expect(server.getStatus().requestDiagnostics.lastAssetRequest)
      .toMatchObject({
        routeKind: "dev",
        statusCode: 404,
        statusLabel: "not-found"
      });
  });

  it("rejects missing or invalid WebSocket tokens", async () => {
    const server = await startTestServer();
    const responses = [
      await readRawWebSocketUpgradeResponse(server, "/ws"),
      await readRawWebSocketUpgradeResponse(server, "/ws?token="),
      await readRawWebSocketUpgradeResponse(server, "/ws?token=bad-token")
    ];

    expect(responses).toEqual([
      expect.stringContaining("HTTP/1.1 401 Unauthorized"),
      expect.stringContaining("HTTP/1.1 401 Unauthorized"),
      expect.stringContaining("HTTP/1.1 401 Unauthorized")
    ]);
    expect(server.getStatus().connectedClientCount).toBe(0);
    expect(server.getStatus().requestDiagnostics.lastWsUpgradeRejected)
      .toMatchObject({
        statusCode: 401,
        statusLabel: "Unauthorized",
        reason: "invalid-token"
      });
    expect(JSON.stringify(server.getStatus())).not.toContain("bad-token");
  });

  it("does not overwrite app WebSocket diagnostics with unrelated dev upgrade paths", async () => {
    const server = await startTestServer();

    await readRawWebSocketUpgradeResponse(server, "/ws?token=bad-token");
    const appReject =
      server.getStatus().requestDiagnostics.lastWsUpgradeRejected;

    expect(appReject).toMatchObject({
      statusCode: 401,
      statusLabel: "Unauthorized",
      reason: "invalid-token"
    });

    expect(
      await readRawWebSocketUpgradeResponse(server, "/@vite/client")
    ).toContain("HTTP/1.1 401 Unauthorized");
    expect(server.getStatus().requestDiagnostics.lastWsUpgradeRejected)
      .toEqual(appReject);
  });

  it("falls back to an available port when the preferred port is occupied", async () => {
    const occupiedServer = createNetServer();
    const occupiedPort = await listenTestNetServer(occupiedServer, 0);

    try {
      const server = await startTestServer({
        port: occupiedPort
      });
      const status = server.getStatus();

      expect(status.state).toBe("running");
      expect(status.port).toEqual(expect.any(Number));
      expect(status.port).not.toBe(occupiedPort);
      expect(status.statusLabel).toBe(
        "Browser Source server running on fallback port"
      );
      expect(status.browserSourceUrl).toBe(
        `http://127.0.0.1:${status.port}/stage?token=${TEST_TOKEN}`
      );
    } finally {
      await closeTestNetServer(occupiedServer);
    }
  });

  it("tracks WebSocket connect, heartbeat, diagnostics, and disconnect", async () => {
    const server = await startTestServer();
    const socket = new WebSocket(createWebSocketUrl(server));

    await waitForWebSocketOpen(socket);
    await waitFor(() => server.getStatus().connectedClientCount === 1);
    expect(server.getStatus().requestDiagnostics.lastWsConnectedAtIso)
      .not.toBeNull();

    socket.send(JSON.stringify({
      type: "browser-source-client-heartbeat",
      sentAtIso: "2026-06-23T00:00:00.000Z"
    }));
    await waitFor(() =>
      server.getStatus().lastClientHeartbeatAtIso !== null
    );

    socket.send(JSON.stringify({
      type: "browser-source-renderer-diagnostics",
      webgl2Available: "available",
      runtimeExportLoaded: true,
      renderStatus: "rendering",
      fps: 60,
      frameAgeMs: 12,
      rawFrame: "must-not-be-stored"
    }));
    await waitFor(() =>
      server.getStatus().latestRendererDiagnostics?.renderStatus ===
      "rendering"
    );

    expect(server.getStatus().latestRendererDiagnostics).toMatchObject({
      webgl2Available: "available",
      runtimeExportLoaded: true,
      fps: 60,
      frameAgeMs: 12
    });
    expect(JSON.stringify(server.getStatus())).not.toContain(
      "must-not-be-stored"
    );

    socket.close();
    await waitFor(() => server.getStatus().connectedClientCount === 0);
    expect(server.getStatus().requestDiagnostics.lastWsDisconnectedAtIso)
      .not.toBeNull();
  });

  it("closes connected WebSocket clients that send oversized input", async () => {
    const server = await startTestServer();
    const socket = new WebSocket(createWebSocketUrl(server));

    await waitForWebSocketOpen(socket);
    await waitFor(() => server.getStatus().connectedClientCount === 1);

    socket.send("x".repeat(4097));

    await waitFor(() =>
      server.getStatus().connectedClientCount === 0 &&
      socket.readyState === WebSocket.CLOSED
    );
  });

  it("broadcasts Runtime Export changes and live frame updates to connected clients", async () => {
    const server = await startTestServer();
    const socket = new WebSocket(createWebSocketUrl(server));
    const messages = collectMessages(socket);

    await waitForWebSocketOpen(socket);
    await waitFor(() =>
      messages.some((message) => message.type === "runtime-export-resync")
    );

    server.publishRuntimeExportLoaded(createLoadedPayload());
    await waitFor(() =>
      messages.some((message) => message.type === "runtime-export-changed")
    );

    server.publishLiveParameterFrame(createLiveParameterFrame());
    await waitFor(() =>
      messages.some((message) => message.type === "live-parameter-frame")
    );

    server.clearLatestFrame();
    await waitFor(() =>
      messages.some((message) => message.type === "live-parameter-cleared")
    );

    expect(messages.find((message) =>
      message.type === "runtime-export-changed"
    )).toMatchObject({
      runtimeExport: {
        summary: {
          packageId: "pkg_fixture"
        }
      }
    });
    expect(messages.find((message) =>
      message.type === "live-parameter-frame"
    )).toMatchObject({
      frame: {
        sequence: 42,
        parameterValues: {
          ParamAngleX: 12.5
        }
      }
    });
    expect(messages.find((message) =>
      message.type === "live-parameter-cleared"
    )).toMatchObject({
      type: "live-parameter-cleared"
    });
    expectBrowserSourcePayloadDoesNotLeakControlOrDebug(messages);

    socket.close();
  });

  it("publishes Stage display state to status, payload, resync, and connected clients", async () => {
    const server = await startTestServer();
    server.publishStageDisplayState(createStageDisplayState({
      width: 1280,
      height: 720,
      zoomScale: 1.5,
      pan: { x: 24, y: -16 }
    }));

    expect(server.getStatus().stageDisplayState).toMatchObject({
      stageWindow: {
        bounds: {
          x: 100,
          y: 80,
          width: 1280,
          height: 720
        }
      },
      stageView: {
        transform: {
          zoomScale: 1.5,
          pan: {
            x: 24,
            y: -16
          },
          coordinateSpace: "stage-viewport-px-v1"
        }
      },
      updatedAtIso: expect.any(String)
    });

    expect(await readJson(server, "/runtime-export/payload")).toMatchObject({
      stageDisplayState: {
        stageWindow: {
          bounds: {
            width: 1280,
            height: 720
          }
        },
        stageView: {
          transform: {
            zoomScale: 1.5,
            pan: {
              x: 24,
              y: -16
            }
          }
        }
      }
    });

    const socket = new WebSocket(createWebSocketUrl(server));
    const messages = collectMessages(socket);

    await waitForWebSocketOpen(socket);
    await waitFor(() =>
      messages.some((message) => message.type === "runtime-export-resync")
    );

    expect(messages.find((message) =>
      message.type === "runtime-export-resync"
    )).toMatchObject({
      stageDisplayState: {
        stageWindow: {
          bounds: {
            width: 1280,
            height: 720
          }
        },
        stageView: {
          transform: {
            zoomScale: 1.5,
            pan: {
              x: 24,
              y: -16
            }
          }
        }
      }
    });

    server.publishStageDisplayState(createStageDisplayState({
      width: 1920,
      height: 1080,
      zoomScale: 2,
      pan: { x: -40, y: 32 }
    }));
    await waitFor(() =>
      messages.some((message) =>
        message.type === "stage-display-state-changed"
      )
    );

    expect(messages.find((message) =>
      message.type === "stage-display-state-changed"
    )).toMatchObject({
      stageDisplayState: {
        stageWindow: {
          bounds: {
            width: 1920,
            height: 1080
          }
        },
        stageView: {
          transform: {
            zoomScale: 2,
            pan: {
              x: -40,
              y: 32
            }
          }
        }
      }
    });

    expectBrowserSourcePayloadDoesNotLeakControlOrDebug(messages);
    socket.close();
  });

  it("resyncs Runtime Export and latest sanitized parameter frame on connection and request", async () => {
    const server = await startTestServer();
    const payload = createLoadedPayload();
    const frame = createLiveParameterFrame();
    server.publishRuntimeExportLoaded(payload);
    server.publishLiveParameterFrame(frame);

    const socket = new WebSocket(createWebSocketUrl(server));
    const messages = collectMessages(socket);

    await waitForWebSocketOpen(socket);
    await waitFor(() =>
      messages.some((message) => message.type === "runtime-export-resync")
    );

    expect(messages.find((message) =>
      message.type === "browser-source-server-hello"
    )).toStrictEqual({
      type: "browser-source-server-hello",
      protocolVersion: 1,
      sentAtIso: expect.any(String)
    });

    const initialResync = messages.find((message) =>
      message.type === "runtime-export-resync"
    );
    expect(initialResync).toMatchObject({
      runtimeExport: {
        summary: {
          packageId: "pkg_fixture"
        }
      },
      latestFrame: {
        sequence: 42,
        parameterValues: {
          ParamAngleX: 12.5
        }
      }
    });
    expectBrowserSourcePayloadDoesNotLeakControlOrDebug(messages);

    socket.send(JSON.stringify({ type: "browser-source-resync-request" }));
    await waitFor(() =>
      messages.filter((message) => message.type === "runtime-export-resync")
        .length >= 2
    );

    socket.close();
  });
});

async function startTestServer(options: {
  readonly port?: number;
  readonly stageStaticAssetRendererDirectoryPath?: string;
  readonly rendererServerUrl?: string;
  readonly stageDevAssetFetcher?: BrowserSourceStageDevAssetFetch;
} = {}): Promise<RuntimePlayerBrowserSourceServer> {
  const server = new RuntimePlayerBrowserSourceServer({
    token: TEST_TOKEN,
    port: options.port ?? 0,
    heartbeatIntervalMs: 0,
    ...(options.stageStaticAssetRendererDirectoryPath === undefined
      ? {}
      : {
          stageStaticAssetRendererDirectoryPath:
            options.stageStaticAssetRendererDirectoryPath
        }),
    ...(options.rendererServerUrl === undefined
      ? {}
      : { rendererServerUrl: options.rendererServerUrl }),
    ...(options.stageDevAssetFetcher === undefined
      ? {}
      : { stageDevAssetFetcher: options.stageDevAssetFetcher })
  });
  runningServers.push(server);
  await server.start();
  return server;
}

async function readResponseStatus(
  server: RuntimePlayerBrowserSourceServer,
  path: string,
  token: string | null = TEST_TOKEN
): Promise<number> {
  const response = await fetch(createHttpUrl(server, path, token));
  await response.arrayBuffer();
  return response.status;
}

async function readJson(
  server: RuntimePlayerBrowserSourceServer,
  path: string
): Promise<unknown> {
  const response = await fetch(createHttpUrl(server, path));
  expect(response.status).toBe(200);
  return response.json();
}

async function postJsonStatus(
  server: RuntimePlayerBrowserSourceServer,
  path: string,
  body: unknown,
  token: string | null = TEST_TOKEN
): Promise<number> {
  const response = await fetch(createHttpUrl(server, path, token), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  await response.arrayBuffer();
  return response.status;
}

function createFetchResponse(
  status: number,
  contentType: string,
  body: string
): Awaited<ReturnType<BrowserSourceStageDevAssetFetch>> {
  return {
    status,
    headers: {
      get: (name) => name.toLowerCase() === "content-type"
        ? contentType
        : null
    },
    arrayBuffer: async () => {
      const bytes = Buffer.from(body, "utf8");
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
    }
  };
}

function createHttpUrl(
  server: RuntimePlayerBrowserSourceServer,
  path: string,
  token: string | null = TEST_TOKEN
): string {
  const port = server.getStatus().port;
  expect(port).toEqual(expect.any(Number));
  const url = new URL(`http://127.0.0.1:${port}${path}`);
  if (token !== null) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

function createWebSocketUrl(
  server: RuntimePlayerBrowserSourceServer,
  token = TEST_TOKEN
): string {
  const port = server.getStatus().port;
  expect(port).toEqual(expect.any(Number));
  const url = new URL(`ws://127.0.0.1:${port}/ws`);
  url.searchParams.set("token", token);
  return url.toString();
}

async function readRawWebSocketUpgradeResponse(
  server: RuntimePlayerBrowserSourceServer,
  path: string
): Promise<string> {
  const port = server.getStatus().port;
  expect(port).toEqual(expect.any(Number));

  const socket = connect({
    host: "127.0.0.1",
    port: port as number
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });

  const chunks: Buffer[] = [];
  socket.on("data", (chunk) => chunks.push(chunk));
  socket.write([
    `GET ${path} HTTP/1.1`,
    `Host: 127.0.0.1:${port}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Sec-WebSocket-Version: 13",
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
    "",
    ""
  ].join("\r\n"));

  await waitForSocketClose(socket);
  return Buffer.concat(chunks).toString("utf8");
}

async function waitForSocketClose(socket: Socket): Promise<void> {
  if (socket.closed || socket.destroyed) {
    return;
  }

  await new Promise<void>((resolve) => {
    socket.once("close", resolve);
  });
}

async function listenTestNetServer(
  server: NetServer,
  port: number
): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({
      host: "127.0.0.1",
      port
    }, resolve);
  });

  const address = server.address();
  if (typeof address === "object" && address !== null) {
    return (address as AddressInfo).port;
  }

  throw new Error("Test server did not expose a TCP port.");
}

async function closeTestNetServer(server: NetServer): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function waitForWebSocketOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onOpen = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error("WebSocket open failed."));
    };
    const cleanup = (): void => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
    };
    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);
  });
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await delay(10);
  }

  throw new Error("Timed out waiting for Browser Source server test condition.");
}

function collectMessages(socket: WebSocket): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  socket.addEventListener("message", (event) => {
    messages.push(JSON.parse(String(event.data)) as Record<string, unknown>);
  });
  return messages;
}

function expectBrowserSourcePayloadDoesNotLeakControlOrDebug(
  payload: unknown
): void {
  const serialized = JSON.stringify(payload);
  const forbiddenFragments = [
    "browserSourceUrl",
    "connectedClientCount",
    "latestRendererDiagnostics",
    "lastClientConnectedAtIso",
    "lastClientDisconnectedAtIso",
    "lastClientHeartbeatAtIso",
    "lastServerHeartbeatAtIso",
    "directoryPath",
    "C:/exports/private.runtime-export",
    "rawFrame",
    "TrackingFrame",
    "blendshapes",
    "Debug",
    "input/diagnostics"
  ];

  for (const fragment of forbiddenFragments) {
    expect(serialized).not.toContain(fragment);
  }
}

function createLoadedPayload(): RuntimeExportLoadedPayload {
  return {
    artifacts: {
      manifest: {},
      model: {},
      atlas: {}
    },
    texturePage: {
      metadata: {
        pageId: "atlas_page_0",
        path: "assets/textures/atlas_page_0.raw-rgba",
        width: 1,
        height: 1,
        pixelFormat: "rgba8",
        byteLength: 4
      },
      bytes: Uint8Array.from([1, 2, 3, 4])
    },
    summary: createSummary(),
    loadedAtIso: "2026-06-23T01:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createSummary(): RuntimeExportSummary {
  return {
    modelDisplayName: "Fixture Model",
    packageId: "pkg_fixture",
    packageRevision: 7,
    drawableCount: 1,
    meshCount: 1,
    parameterCount: 1,
    maskCount: 0,
    texturePage: {
      pageId: "atlas_page_0",
      path: "assets/textures/atlas_page_0.raw-rgba",
      width: 1,
      height: 1,
      pixelFormat: "rgba8",
      byteLength: 4
    },
    requiredCapabilities: [
      "directory-runtime-export-v0",
      "raw-rgba8-texture-pages-v1",
      "materialized-atlas-uvs-v1",
      "transparent-background-v1"
    ]
  };
}

function createLiveParameterFrame(): RuntimePlayerLiveParameterFrame {
  return {
    schemaVersion: "runtime-player-live-parameter-frame-v1",
    runtimeExport: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      loadedAtIso: "2026-06-23T01:00:00.000Z"
    },
    sequence: 42,
    producedAtIso: "2026-06-23T01:00:01.000Z",
    sourceFrameTimestampMs: 1000,
    parameterValues: {
      ParamAngleX: 12.5
    }
  };
}

function createStageDisplayState(input: {
  readonly width: number;
  readonly height: number;
  readonly zoomScale: number;
  readonly pan: {
    readonly x: number;
    readonly y: number;
  };
}) {
  return {
    stageWindow: {
      bounds: {
        x: 100,
        y: 80,
        width: input.width,
        height: input.height
      }
    },
    stageView: {
      transform: {
        zoomScale: input.zoomScale,
        pan: input.pan,
        coordinateSpace: "stage-viewport-px-v1" as const
      }
    }
  };
}

function createRendererAssetFixture(): string {
  const root = mkdtempSync(path.join(
    tmpdir(),
    "runtime-player-browser-source-server-assets-"
  ));
  tempDirectories.push(root);
  mkdirSync(path.join(root, "assets"), { recursive: true });
  writeFileSync(
    path.join(root, "assets", "browser-source-stage-fixture.js"),
    'import "./split-fixture.js";',
    "utf8"
  );
  writeFileSync(
    path.join(root, "assets", "split-fixture.js"),
    'export const fixture = "split chunk";',
    "utf8"
  );
  writeFileSync(
    path.join(root, "assets", "browser-source-stage-fixture.css"),
    "body { background: transparent; }",
    "utf8"
  );
  writeFileSync(
    path.join(root, "assets", "model.wasm"),
    "not allowed",
    "utf8"
  );
  return root;
}

function resolveWorkspaceRootPath(): string {
  let currentPath = path.resolve(process.cwd());

  while (true) {
    if (existsSync(path.join(currentPath, "pnpm-workspace.yaml"))) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      throw new Error("Unable to find workspace root for Browser Source tests.");
    }
    currentPath = parentPath;
  }
}

function toPosixPath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}
