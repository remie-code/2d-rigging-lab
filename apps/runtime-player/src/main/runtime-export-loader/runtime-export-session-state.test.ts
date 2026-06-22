import { describe, expect, it } from "vitest";

import type {
  RuntimeExportLoadedPayload,
  RuntimeExportSummary
} from "../../preload/runtime-export-bridge-contract";
import {
  RuntimeExportLoaderError,
  toRuntimeExportLoadError
} from "./runtime-export-errors";
import { RuntimeExportSessionState } from "./runtime-export-session-state";

describe("Runtime Export session state and error mapping", () => {
  it("maps loader errors to renderer-safe error DTOs", () => {
    const mapped = toRuntimeExportLoadError(
      new RuntimeExportLoaderError(
        "runtimeExport.missingArtifact",
        "Missing model.",
        "runtime/model.json",
        ["detail=missing"]
      )
    );

    expect(mapped).toEqual({
      code: "runtimeExport.missingArtifact",
      message: "Missing model.",
      artifactPath: "runtime/model.json",
      details: ["detail=missing"]
    });
  });

  it("maps unexpected errors without leaking non-DTO objects", () => {
    expect(toRuntimeExportLoadError(new Error("boom"))).toEqual({
      code: "runtimeExport.unexpectedError",
      message: "boom",
      details: []
    });
  });

  it("tracks loading, loaded, and error states while clearing stale payloads", () => {
    const session = new RuntimeExportSessionState();
    const payload = createLoadedPayload();

    expect(session.getStatus()).toEqual({
      status: "empty",
      loaded: false,
      statusLabel: "No Runtime Export loaded"
    });
    expect(session.getLoadedPayload()).toBeNull();

    expect(session.setLoading("C:/exports/model")).toMatchObject({
      status: "loading",
      loaded: false,
      directoryPath: "C:/exports/model"
    });
    expect(session.getLoadedPayload()).toBeNull();

    expect(session.setLoaded({
      directoryPath: "C:/exports/model",
      payload
    })).toMatchObject({
      status: "loaded",
      loaded: true,
      directoryPath: "C:/exports/model",
      loadedAtIso: payload.loadedAtIso,
      summary: payload.summary
    });
    expect(session.getLoadedPayload()).toBe(payload);

    const error = toRuntimeExportLoadError(
      new RuntimeExportLoaderError(
        "runtimeExport.invalidModel",
        "Invalid model.",
        "runtime/model.json"
      )
    );
    expect(session.setError({
      directoryPath: "C:/exports/bad-model",
      error,
      failedAtIso: "2026-06-22T00:00:00.000Z"
    })).toMatchObject({
      status: "error",
      loaded: false,
      directoryPath: "C:/exports/bad-model",
      error
    });
    expect(session.getLoadedPayload()).toBeNull();
  });
});

function createLoadedPayload(): RuntimeExportLoadedPayload {
  return {
    artifacts: {
      manifest: {},
      model: {},
      atlas: {}
    },
    texturePage: {
      metadata: {},
      bytes: new Uint8Array([1, 2, 3, 4])
    },
    summary: createSummary(),
    loadedAtIso: "2026-06-22T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createSummary(): RuntimeExportSummary {
  return {
    modelDisplayName: "Fixture Model",
    packageId: "pkg_fixture",
    packageRevision: 1,
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
