import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RenderViewSidecarSchema } from "@private-2d-rigging-lab/ai-interface";

import { createPerceptionFixture } from "../test-support/perception-fixtures.js";
import { writeRenderView } from "./render-view-file-output.js";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

const makeOutDir = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "perception-render-"));
  createdRoots.push(root);
  return join(root, "out");
};

describe("writeRenderView", () => {
  it("writes a PNG + schema-valid sidecar and returns file paths", async () => {
    const { session } = createPerceptionFixture();
    const outDir = await makeOutDir();

    const result = await writeRenderView({
      session,
      packagePath: "/packages/synthetic",
      payload: { parameterOverrides: {}, outDir, outputName: "rest" }
    });

    expect(result.pngPath.endsWith("rest.png")).toBe(true);
    expect(result.sidecarPath.endsWith("rest.render-view.json")).toBe(true);

    const pngBytes = await readFile(join(outDir, "rest.png"));
    expect(pngBytes.byteLength).toBeGreaterThan(0);
    // PNG signature.
    expect([...pngBytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const sidecarText = await readFile(join(outDir, "rest.render-view.json"), "utf8");
    const parsed = RenderViewSidecarSchema.parse(JSON.parse(sidecarText));
    expect(parsed.packageRevision).toBe(session.packageRevision);
    expect(parsed.packagePath).toBe("/packages/synthetic");
  });

  it("writes byte-identical PNG bytes across two runs of the same request (on disk)", async () => {
    const outDirA = await makeOutDir();
    const outDirB = await makeOutDir();

    const runA = await writeRenderView({
      session: createPerceptionFixture().session,
      packagePath: "/packages/synthetic",
      payload: { parameterOverrides: {}, outDir: outDirA, outputName: "rest" }
    });
    const runB = await writeRenderView({
      session: createPerceptionFixture().session,
      packagePath: "/packages/synthetic",
      payload: { parameterOverrides: {}, outDir: outDirB, outputName: "rest" }
    });

    const bytesA = await readFile(join(outDirA, "rest.png"));
    const bytesB = await readFile(join(outDirB, "rest.png"));
    expect(bytesA.equals(bytesB)).toBe(true);
    expect(runA.outputWidth).toBe(runB.outputWidth);
    expect(runA.outputHeight).toBe(runB.outputHeight);
  });
});
