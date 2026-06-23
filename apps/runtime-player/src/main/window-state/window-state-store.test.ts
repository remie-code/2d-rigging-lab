import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createEmptyRuntimePlayerWindowStateDocument,
  parseRuntimePlayerWindowStateDocument
} from "./window-state-document";
import { RuntimePlayerWindowStateStore } from "./window-state-store";

describe("RuntimePlayerWindowStateStore", () => {
  it("uses the Runtime Player userData window state path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-window-state-")
    );
    const store = new RuntimePlayerWindowStateStore({ userDataPath });

    expect(store.getWindowStateFilePath()).toBe(
      path.join(userDataPath, "window-state", "runtime-player.json")
    );

    await expect(store.getSnapshot()).resolves.toMatchObject({
      state: "missing",
      document: {
        stageView: {
          transform: {
            zoomScale: 1,
            pan: {
              x: 0,
              y: 0
            },
            coordinateSpace: "stage-viewport-px-v1"
          }
        }
      }
    });
  });

  it("persists Stage and Control bounds plus Stage view transform", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-window-state-")
    );
    const store = new RuntimePlayerWindowStateStore({ userDataPath });
    const document = {
      ...createEmptyRuntimePlayerWindowStateDocument(
        "2026-06-23T00:00:00.000Z"
      ),
      windows: {
        control: {
          bounds: { x: 80, y: 90, width: 1040, height: 760 }
        },
        stage: {
          bounds: { x: 1200, y: 80, width: 720, height: 900 }
        }
      },
      stageView: {
        transform: {
          zoomScale: 1.25,
          pan: { x: -32, y: 140 },
          coordinateSpace: "stage-viewport-px-v1" as const
        }
      }
    };

    await store.saveDocument(document);

    const written = JSON.parse(
      await readFile(store.getWindowStateFilePath(), "utf8")
    ) as unknown;

    expect(written).toMatchObject({
      schemaVersion: "runtime-player-window-state-v1",
      windows: {
        control: {
          bounds: { x: 80, y: 90, width: 1040, height: 760 }
        },
        stage: {
          bounds: { x: 1200, y: 80, width: 720, height: 900 }
        }
      },
      stageView: {
        transform: {
          zoomScale: 1.25,
          pan: { x: -32, y: 140 },
          coordinateSpace: "stage-viewport-px-v1"
        }
      }
    });
  });

  it("loads a valid persisted window state file directly", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-window-state-")
    );
    const windowStateFilePath = path.join(tempRoot, "runtime-player.json");
    const document = {
      ...createEmptyRuntimePlayerWindowStateDocument(
        "2026-06-23T02:00:00.000Z"
      ),
      windows: {
        control: {
          bounds: { x: 50, y: 60, width: 1040, height: 760 }
        },
        stage: {
          bounds: { x: 1120, y: 90, width: 800, height: 960 }
        }
      },
      stageView: {
        transform: {
          zoomScale: 1.75,
          pan: { x: -24, y: 36 },
          coordinateSpace: "stage-viewport-px-v1" as const
        }
      }
    };

    await mkdir(path.dirname(windowStateFilePath), { recursive: true });
    await writeFile(
      windowStateFilePath,
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8"
    );

    const store = new RuntimePlayerWindowStateStore({
      windowStateFilePath
    });

    await expect(store.getSnapshot()).resolves.toEqual({
      document,
      state: "loaded",
      warningMessages: []
    });
  });

  it("falls back safely when the window state file contains corrupt JSON", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-window-state-")
    );
    const windowStateFilePath = path.join(tempRoot, "runtime-player.json");
    await mkdir(path.dirname(windowStateFilePath), { recursive: true });
    await writeFile(windowStateFilePath, "{not-json", "utf8");
    const store = new RuntimePlayerWindowStateStore({
      windowStateFilePath
    });

    const snapshot = await store.getSnapshot();

    expect(snapshot.state).toBe("read-failed");
    expect(snapshot.document.windows).toEqual({});
    expect(snapshot.document.stageView.transform.zoomScale).toBe(1);
    expect(snapshot.warningMessages[0]).toContain("invalid JSON");
  });

  it("keeps valid partial state and falls back invalid sections", () => {
    const result = parseRuntimePlayerWindowStateDocument({
      schemaVersion: "runtime-player-window-state-v1",
      updatedAtIso: "2026-06-23T00:00:00.000Z",
      windows: {
        control: {
          bounds: { x: 1, y: 2, width: 1040, height: 760 }
        },
        stage: {
          bounds: { x: 1200, y: 80, width: "bad", height: 900 }
        }
      },
      stageView: {
        transform: {
          zoomScale: 0,
          pan: { x: -32, y: 140 },
          coordinateSpace: "stage-viewport-px-v1"
        }
      }
    });

    expect(result).toMatchObject({
      ok: true,
      document: {
        windows: {
          control: {
            bounds: { x: 1, y: 2, width: 1040, height: 760 }
          }
        },
        stageView: {
          transform: {
            zoomScale: 1,
            pan: { x: 0, y: 0 },
            coordinateSpace: "stage-viewport-px-v1"
          }
        }
      },
      warningMessages: [
        "stage window bounds were invalid and were ignored.",
        "Stage view transform was invalid and was reset."
      ]
    });
  });
});
