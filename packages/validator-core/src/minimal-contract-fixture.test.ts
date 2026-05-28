import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validatePackageRuntime } from "./validators/package-runtime.js";

describe("minimal-valid-package contract fixture", () => {
  it("builds the expected pass report from the fixture package and summary snapshot", () => {
    const fixture = loadMinimalFixture();
    const report = validatePackageRuntime({
      packageDocument: fixture.packageDocument,
      runtimeSnapshot: fixture.runtimeSnapshot,
      createdAt: fixture.expectedReport.createdAt
    });

    expect(report.summary).toEqual(fixture.expectedReport.summary);
    expect(report.checks).toEqual([]);
    expect(report.evidence).toEqual(fixture.expectedReport.evidence);
    expect(report).toMatchObject({
      schemaVersion: "validation-report-v1",
      reportId: fixture.expectedReport.reportId,
      packageId: "pkg_minimal-valid-package",
      packageRevision: 0,
      profile: "strict"
    });
  });
});

interface MinimalFixture {
  readonly packageDocument: unknown;
  readonly runtimeSnapshot: unknown;
  readonly expectedReport: {
    readonly reportId: string;
    readonly createdAt: string;
    readonly summary: unknown;
    readonly evidence: unknown;
  };
}

const loadMinimalFixture = (): MinimalFixture => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );

  return {
    packageDocument: {
      manifest: readJson(join(fixtureDirectory, "manifest.json")),
      model: {
        graph: readJson(join(fixtureDirectory, "model/graph.json")),
        drawables: readJson(join(fixtureDirectory, "model/drawables.json")),
        meshes: readJson(join(fixtureDirectory, "model/meshes.json")),
        parameters: readJson(join(fixtureDirectory, "model/parameters.json")),
        keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")),
        rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")),
        dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")),
        masks: readJson(join(fixtureDirectory, "model/masks.json")),
        drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json"))
      },
      assets: {
        sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")),
        provenance: readJson(join(fixtureDirectory, "assets/provenance.json")),
        rights: readJson(join(fixtureDirectory, "assets/rights.json"))
      }
    },
    runtimeSnapshot: readJson(join(fixtureDirectory, "runtime/snapshots/summary.runtime-snapshot.json")),
    expectedReport: readJson(
      join(fixtureDirectory, "validation/reports/minimal.validation.json")
    ) as MinimalFixture["expectedReport"]
  };
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
