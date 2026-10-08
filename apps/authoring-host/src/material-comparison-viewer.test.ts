import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { materialFixture } from "./material-command-test-fixtures.js";
import { readMaterialTestPng } from "./material-test-fixtures.js";

describe("same-viewport material renderer comparison", () => {
  it("evaluates real keyed poses and records pose separately from material rest", async () => {
    const f = await materialFixture("replace", true), c = await f.next("buildMaterialCandidate", await f.register());
    const make = (value: number) => f.call("previewMaterialCandidate", { candidateId: c.candidateId, mode: "working", viewport: f.viewport, parameterOverrides: { [f.ids.eyeRegionOpacityParameterId]: value } });
    const visible = await make(1), hidden = await make(-1);
    const a = await readMaterialTestPng(visible.result!.previewContext!.artifact.imageAbsolutePath), b = await readMaterialTestPng(hidden.result!.previewContext!.artifact.imageAbsolutePath);
    expect(a.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true); expect(b.data.every((v, i) => i % 4 !== 3 || v === 0)).toBe(true);
    expect(visible.result!.previewContext!.sidecar.viewport).toEqual(f.viewport);
    expect(hidden.evaluatedRender!.sidecar.parameterOverrides).toEqual([{ parameterId: f.ids.eyeRegionOpacityParameterId, value: -1 }]);
    expect(hidden.result!.previewContext!.sidecar.restPose.keyedDeformation).toBe(false);
    const html = await readFile(hidden.comparisonAbsolutePath!, "utf8"); expect(html).toContain("evaluated pose details"); expect(html.match(/width="128" height="128"/g)).toHaveLength(2);
    expect(hidden.baseEvaluatedRender!.sidecar.resolvedView).toEqual(hidden.evaluatedRender!.sidecar.resolvedView);
  }, 30000);
});
