import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeStagePngCaptureFile } from "./stage-png-capture-file-writer";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "runtime-player-png-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("writeStagePngCaptureFile", () => {
  it("creates the folder and writes the bytes under the dated name", async () => {
    const folderPath = path.join(tempRoot, "Runtime Player");
    const pngBytes = new Uint8Array([1, 2, 3]);

    const written = await writeStagePngCaptureFile({
      folderPath,
      baseName: "astra-chan-runtime",
      capturedAt: new Date(2026, 9, 28, 15, 30, 12),
      pngBytes
    });

    expect(written).toEqual({
      fileName: "astra-chan-runtime-20261028-153012.png",
      filePath: path.join(folderPath, "astra-chan-runtime-20261028-153012.png")
    });
    expect(new Uint8Array(await readFile(written.filePath))).toEqual(pngBytes);
  });

  it("never overwrites: a taken name moves on to -2, -3", async () => {
    const folderPath = path.join(tempRoot, "Runtime Player");
    const capturedAt = new Date(2026, 9, 28, 15, 30, 12);
    const existing = new Uint8Array([9, 9, 9]);
    await writeStagePngCaptureFile({
      folderPath,
      baseName: "model",
      capturedAt,
      pngBytes: existing
    });

    const second = await writeStagePngCaptureFile({
      folderPath,
      baseName: "model",
      capturedAt,
      pngBytes: new Uint8Array([2])
    });
    await writeFile(path.join(folderPath, "model-20261028-153012-3.png"), "x");
    const fourth = await writeStagePngCaptureFile({
      folderPath,
      baseName: "model",
      capturedAt,
      pngBytes: new Uint8Array([4])
    });

    expect(second.fileName).toBe("model-20261028-153012-2.png");
    expect(fourth.fileName).toBe("model-20261028-153012-4.png");
    expect(
      new Uint8Array(
        await readFile(path.join(folderPath, "model-20261028-153012.png"))
      )
    ).toEqual(existing);
    expect((await readdir(folderPath)).sort()).toEqual([
      "model-20261028-153012-2.png",
      "model-20261028-153012-3.png",
      "model-20261028-153012-4.png",
      "model-20261028-153012.png"
    ]);
  });
});
