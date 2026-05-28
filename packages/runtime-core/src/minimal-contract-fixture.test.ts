import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type {
  NormalizedDrawOrderEntry,
  NormalizedDrawable,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";

describe("minimal-valid-package contract fixture", () => {
  it("evaluates the fixture graph as a summary runtime snapshot", () => {
    const fixture = loadMinimalFixture();
    const graph = createRuntimeGraphFromFixture(fixture.packageDocument);
    const initialState = createInitialRuntimeState(graph, {
      packageId: graph.packageId,
      packageRevision: graph.packageRevision,
      packageHash: graph.packageHash,
      resetReasons: ["validationRunStart"]
    });

    const result = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 0,
        deltaTimeMs: 0
      },
      initialState,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "validator" }, policy: { strictness: "strict" } }
    );

    expect(result.snapshot.drawList).toEqual(fixture.expectedSnapshot.drawList);
    expect(result.snapshot.drawables).toEqual(fixture.expectedSnapshot.drawables);
    expect(result.snapshot.diagnostics).toEqual([]);
    expect(result.snapshot).toMatchObject({
      schemaVersion: "runtime-snapshot-v1",
      snapshotId: fixture.expectedSnapshot.snapshotId,
      packageId: "pkg_minimal-valid-package",
      packageHash: "sha256:minimal-valid-package-v1"
    });
  });
});

interface MinimalFixture {
  readonly packageDocument: MinimalPackageDocument;
  readonly expectedSnapshot: {
    readonly snapshotId: string;
    readonly drawables: readonly unknown[];
    readonly drawList: readonly string[];
  };
}

interface MinimalPackageDocument {
  readonly manifest: {
    readonly packageId: string;
    readonly packageRevision: number;
  };
  readonly model: {
    readonly drawables: {
      readonly drawables: readonly FixtureDrawable[];
    };
    readonly meshes: {
      readonly meshes: readonly FixtureMesh[];
    };
    readonly drawOrder: {
      readonly entries: readonly FixtureDrawOrderEntry[];
    };
  };
}

interface FixtureDrawable {
  readonly drawableId: string;
  readonly meshId: string;
  readonly runtimeVisibility: boolean;
  readonly defaultOpacity: number;
  readonly baseDrawOrder: number;
}

interface FixtureMesh {
  readonly meshId: string;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly vertices: readonly unknown[];
}

interface FixtureDrawOrderEntry {
  readonly drawableId: string;
  readonly stableOrder: number;
}

const loadMinimalFixture = (): MinimalFixture => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );

  return {
    packageDocument: {
      manifest: readJson(join(fixtureDirectory, "manifest.json")) as MinimalPackageDocument["manifest"],
      model: {
        drawables: readJson(join(fixtureDirectory, "model/drawables.json")) as MinimalPackageDocument["model"]["drawables"],
        meshes: readJson(join(fixtureDirectory, "model/meshes.json")) as MinimalPackageDocument["model"]["meshes"],
        drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json")) as MinimalPackageDocument["model"]["drawOrder"]
      }
    },
    expectedSnapshot: readJson(
      join(fixtureDirectory, "runtime/snapshots/summary.runtime-snapshot.json")
    ) as MinimalFixture["expectedSnapshot"]
  };
};

const createRuntimeGraphFromFixture = (packageDocument: MinimalPackageDocument): NormalizedRuntimeGraph => {
  const meshesById = new Map(packageDocument.model.meshes.meshes.map((mesh) => [mesh.meshId, mesh]));
  const drawables: [DrawableId, NormalizedDrawable][] = packageDocument.model.drawables.drawables.map((drawable) => {
    const mesh = meshesById.get(drawable.meshId);
    if (mesh === undefined) {
      throw new Error(`Fixture drawable ${drawable.drawableId} references missing mesh ${drawable.meshId}.`);
    }
    const drawableId = DrawableIdSchema.parse(drawable.drawableId);
    const meshId = MeshIdSchema.parse(drawable.meshId);

    return [
      drawableId,
      {
        drawableId,
        meshId,
        visible: drawable.runtimeVisibility,
        opacity: drawable.defaultOpacity,
        baseDrawOrder: drawable.baseDrawOrder,
        bounds: mesh.bounds,
        vertexCount: mesh.vertices.length
      }
    ];
  });
  const drawOrder: NormalizedDrawOrderEntry[] = packageDocument.model.drawOrder.entries.map((entry) => ({
    drawableId: DrawableIdSchema.parse(entry.drawableId),
    drawOrder: entry.stableOrder
  }));

  return {
    packageId: PackageIdSchema.parse(packageDocument.manifest.packageId),
    packageRevision: packageDocument.manifest.packageRevision,
    packageHash: "sha256:minimal-valid-package-v1",
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map(),
    dynamicsGroups: new Map(),
    drawables: new Map(drawables),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder,
    disabledFutureLayers: []
  };
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
