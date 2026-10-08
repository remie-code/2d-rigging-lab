import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  RuntimePlayerControlChannelDiagnosticLog,
  runtimePlayerControlChannelDiagnosticRelativePath
} from "./fire-diagnostics";

describe("RuntimePlayerControlChannelDiagnosticLog", () => {
  it("writes bounded content-free JSONL at the deterministic app-data path", async () => {
    const userDataPath = await mkdtemp(path.join(
      os.tmpdir(),
      "runtime-player-fire-diagnostics-"
    ));
    const log = await RuntimePlayerControlChannelDiagnosticLog.create({
      userDataPath,
      wallNowMs: () => Date.parse("2026-08-30T01:02:03.000Z"),
      monotonicNowMs: () => 123.5
    });
    log.record({
      event: "request.observed",
      connectionId: "control-channel-1",
      connectionGeneration: 1,
      requestId: "req-42",
      requestBytes: 1024,
      result: "accepted"
    });
    await log.flush();

    expect(log.getFilePath()).toBe(path.join(
      userDataPath,
      runtimePlayerControlChannelDiagnosticRelativePath
    ));
    expect(JSON.parse(await readFile(log.getFilePath(), "utf8"))).toEqual({
      schema: "runtime-player-control-channel-diagnostic-v1",
      atIso: "2026-08-30T01:02:03.000Z",
      monotonicMs: 123.5,
      event: "request.observed",
      connectionId: "control-channel-1",
      connectionGeneration: 1,
      requestId: "req-42",
      requestBytes: 1024,
      result: "accepted"
    });

    await writeFile(log.getFilePath(), "old run", "utf8");
    const nextRun = await RuntimePlayerControlChannelDiagnosticLog.create({
      userDataPath
    });
    expect(await readFile(nextRun.getFilePath(), "utf8")).toBe("");
  });

  it("contains initialization/write failures without throwing", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "runtime-player-fire-diagnostics-"
    ));
    const fileInsteadOfDirectory = path.join(root, "not-a-directory");
    await writeFile(fileInsteadOfDirectory, "fixture", "utf8");

    const log = await RuntimePlayerControlChannelDiagnosticLog.create({
      userDataPath: fileInsteadOfDirectory
    });
    expect(() => log.record({ event: "request.observed" })).not.toThrow();
    await expect(log.flush()).resolves.toBeUndefined();
  });
});
