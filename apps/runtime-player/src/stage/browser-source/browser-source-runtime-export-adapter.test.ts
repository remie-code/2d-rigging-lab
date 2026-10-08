import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerBrowserSourceRuntimeExportPayload
} from "../../preload/browser-source-transport-contract";
import { toRuntimeExportLoadedPayload } from "./browser-source-runtime-export-adapter";

describe("toRuntimeExportLoadedPayload", () => {
  it("decodes Browser Source base64 texture bytes for the Stage renderer", () => {
    const payload = toRuntimeExportLoadedPayload(createBrowserSourcePayload());

    expect([...payload.texturePage.bytes]).toEqual([1, 2, 3, 4]);
    expect(payload.texturePage.metadata.pageId).toBe("atlas_page_0");
    expect(payload.summary.packageId).toBe("pkg_fixture");
  });

  it("rejects texture payloads whose decoded byte length is inconsistent", () => {
    expect(() =>
      toRuntimeExportLoadedPayload({
        ...createBrowserSourcePayload(),
        texturePage: {
          ...createBrowserSourcePayload().texturePage,
          byteLength: 8
        }
      })
    ).toThrow("byte length mismatch");
  });
});

function createBrowserSourcePayload(): RuntimePlayerBrowserSourceRuntimeExportPayload {
  return {
    schemaVersion: "runtime-player-browser-source-runtime-export-v1",
    artifacts: {
      manifest: {},
      model: {},
      atlas: {}
    } as RuntimePlayerBrowserSourceRuntimeExportPayload["artifacts"],
    texturePage: {
      metadata: {
        pageId: "atlas_page_0",
        path: "assets/textures/atlas_page_0.raw-rgba",
        width: 1,
        height: 1,
        pixelFormat: "rgba8",
        byteLength: 4
      } as RuntimePlayerBrowserSourceRuntimeExportPayload["texturePage"]["metadata"],
      encoding: "base64",
      bytesBase64: "AQIDBA==",
      byteLength: 4
    },
    summary: {
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
      requiredCapabilities: []
    },
    loadedAtIso: "2026-06-23T01:00:00.000Z"
  };
}
