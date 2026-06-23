import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRuntimePlayerStartupStateDocument,
  parseRuntimePlayerStartupStateDocument
} from "./runtime-player-startup-state-document";
import { RuntimePlayerStartupStateStore } from "./runtime-player-startup-state-store";

describe("RuntimePlayerStartupStateStore", () => {
  it("uses the Runtime Player userData startup state path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-startup-state-")
    );
    const store = new RuntimePlayerStartupStateStore({ userDataPath });

    expect(store.getStartupStateFilePath()).toBe(
      path.join(
        userDataPath,
        "startup-state",
        "runtime-player-startup.json"
      )
    );

    await expect(store.getSnapshot()).resolves.toMatchObject({
      state: "missing",
      document: {
        schemaVersion: "runtime-player-startup-state-v1",
        lastRuntimeExportDirectory: null
      }
    });
  });

  it("persists the last successful Runtime Export directory", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-startup-state-")
    );
    const store = new RuntimePlayerStartupStateStore({ userDataPath });

    await store.saveLastRuntimeExportDirectory(
      "C:/exports/fixture.runtime-export",
      "2026-06-23T00:00:00.000Z"
    );

    const written = JSON.parse(
      await readFile(store.getStartupStateFilePath(), "utf8")
    ) as unknown;

    expect(written).toEqual({
      schemaVersion: "runtime-player-startup-state-v1",
      updatedAtIso: "2026-06-23T00:00:00.000Z",
      lastRuntimeExportDirectory: "C:/exports/fixture.runtime-export"
    });
  });

  it("loads a valid persisted startup state file directly", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-startup-state-")
    );
    const startupStateFilePath = path.join(
      tempRoot,
      "runtime-player-startup.json"
    );
    const document = createRuntimePlayerStartupStateDocument({
      lastRuntimeExportDirectory: "D:/exports/valid.runtime-export",
      updatedAtIso: "2026-06-23T02:00:00.000Z"
    });

    await mkdir(path.dirname(startupStateFilePath), { recursive: true });
    await writeFile(
      startupStateFilePath,
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8"
    );

    const store = new RuntimePlayerStartupStateStore({
      startupStateFilePath
    });

    await expect(store.getSnapshot()).resolves.toEqual({
      document,
      state: "loaded",
      warningMessages: []
    });
  });

  it("falls back safely when the startup state file contains corrupt JSON", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-startup-state-")
    );
    const startupStateFilePath = path.join(
      tempRoot,
      "runtime-player-startup.json"
    );
    await mkdir(path.dirname(startupStateFilePath), { recursive: true });
    await writeFile(startupStateFilePath, "{not-json", "utf8");
    const store = new RuntimePlayerStartupStateStore({
      startupStateFilePath
    });

    const snapshot = await store.getSnapshot();

    expect(snapshot.state).toBe("read-failed");
    expect(snapshot.document.lastRuntimeExportDirectory).toBeNull();
    expect(snapshot.warningMessages[0]).toContain("invalid JSON");
  });

  it("keeps a saved missing path as a retryable string", () => {
    const result = parseRuntimePlayerStartupStateDocument({
      schemaVersion: "runtime-player-startup-state-v1",
      updatedAtIso: "2026-06-23T00:00:00.000Z",
      lastRuntimeExportDirectory: "Z:/missing/model.runtime-export"
    });

    expect(result).toEqual({
      ok: true,
      document: {
        schemaVersion: "runtime-player-startup-state-v1",
        updatedAtIso: "2026-06-23T00:00:00.000Z",
        lastRuntimeExportDirectory: "Z:/missing/model.runtime-export"
      },
      warningMessages: []
    });
  });
});
