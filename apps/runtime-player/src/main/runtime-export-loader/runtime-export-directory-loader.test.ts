import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE } from "@private-2d-rigging-lab/package-format";

import { loadRuntimeExportDirectory } from "./runtime-export-directory-loader";
import { resolveRuntimeExportArtifactPath } from "./runtime-export-paths";

const temporaryDirectories: string[] = [];

describe("Runtime Export directory loader", () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directoryPath) =>
        rm(directoryPath, { recursive: true, force: true })
      )
    );
  });

  it("loads a valid Runtime Export from any selected directory name", async () => {
    const fixture = await createRuntimeExportFixture();

    const loaded = await loadRuntimeExportDirectory(
      fixture.directoryPath,
      "2026-06-22T00:00:00.000Z"
    );

    expect(path.basename(loaded.directoryPath)).toMatch(/^runtime-player-any-name-/);
    expect(loaded.payload.loadedAtIso).toBe("2026-06-22T00:00:00.000Z");
    expect(loaded.payload.summary).toMatchObject({
      modelDisplayName: "Runtime Export Model",
      drawableCount: 1,
      meshCount: 1,
      parameterCount: 1,
      texturePage: {
        path: "assets/textures/atlas_page_0.raw-rgba",
        width: 2,
        height: 2,
        byteLength: 16
      }
    });
    expect([...loaded.payload.texturePage.bytes]).toEqual([...fixture.textureBytes]);
  });

  it("reports a missing runtime-export.json artifact", async () => {
    const directoryPath = await createTemporaryDirectory();

    await expect(loadRuntimeExportDirectory(directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.missingArtifact",
      artifactPath: "runtime-export.json"
    });
  });

  it("reports a missing referenced runtime model artifact", async () => {
    const fixture = await createRuntimeExportFixture();
    await rm(path.join(fixture.directoryPath, "runtime", "model.json"));

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.missingArtifact",
      artifactPath: "runtime/model.json"
    });
  });

  it("reports a missing referenced raw texture page artifact", async () => {
    const fixture = await createRuntimeExportFixture();
    await rm(path.join(
      fixture.directoryPath,
      "assets",
      "textures",
      "atlas_page_0.raw-rgba"
    ));

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.missingArtifact",
      artifactPath: "assets/textures/atlas_page_0.raw-rgba"
    });
  });

  it("reports invalid JSON in a referenced text artifact", async () => {
    const fixture = await createRuntimeExportFixture();
    await writeRuntimeExportTextFile(
      fixture.directoryPath,
      "runtime/model.json",
      "{"
    );

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.invalidJson",
      artifactPath: "runtime/model.json"
    });
  });

  it("reports an invalid runtime-export.json schema", async () => {
    const fixture = await createRuntimeExportFixture();
    await writeRuntimeExportJsonFile(
      fixture.directoryPath,
      "runtime-export.json",
      {
        ...fixture.artifacts.manifest,
        schemaVersion: "not-runtime-export-manifest-v0"
      }
    );

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.invalidManifest",
      artifactPath: "runtime-export.json"
    });
  });

  it("reports an invalid runtime model schema", async () => {
    const fixture = await createRuntimeExportFixture();
    await writeRuntimeExportJsonFile(
      fixture.directoryPath,
      "runtime/model.json",
      {
        ...fixture.artifacts.model,
        schemaVersion: "not-runtime-export-model-v0"
      }
    );

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.invalidModel",
      artifactPath: "runtime/model.json"
    });
  });

  it("reports an invalid runtime atlas schema", async () => {
    const fixture = await createRuntimeExportFixture();
    await writeRuntimeExportJsonFile(
      fixture.directoryPath,
      "runtime/atlas.json",
      {
        ...fixture.artifacts.atlas,
        schemaVersion: "not-runtime-export-atlas-v0"
      }
    );

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.invalidAtlas",
      artifactPath: "runtime/atlas.json"
    });
  });

  it("reports a missing referenced atlas artifact", async () => {
    const fixture = await createRuntimeExportFixture();
    await rm(path.join(fixture.directoryPath, "runtime", "atlas.json"));

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.missingArtifact",
      artifactPath: "runtime/atlas.json"
    });
  });

  it("rejects manifests missing a required Runtime Export load capability", async () => {
    const fixture = await createRuntimeExportFixture();
    await writeRuntimeExportJsonFile(
      fixture.directoryPath,
      "runtime-export.json",
      {
        ...fixture.artifacts.manifest,
        requiredCapabilities:
          fixture.artifacts.manifest.requiredCapabilities.filter((capability) =>
            capability !== "materialized-atlas-uvs-v1"
          )
      }
    );

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.unsupportedCapability",
      artifactPath: "runtime-export.json",
      message: expect.stringContaining("materialized-atlas-uvs-v1")
    });
  });

  it("rejects unsupported v0 multi-page Runtime Exports", async () => {
    const fixture = await createRuntimeExportFixture();
    const secondPage = createTexturePage(1, fixture.textureBytes);

    fixture.artifacts.manifest.paths.texturePages.push(secondPage.path);
    fixture.artifacts.manifest.texturePages.push(secondPage);
    await writeRuntimeExportJsonFile(
      fixture.directoryPath,
      "runtime-export.json",
      fixture.artifacts.manifest
    );

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.unsupportedSingleTexturePage",
      artifactPath: "runtime-export.json"
    });
  });

  it("rejects texture pages whose byte length does not match metadata", async () => {
    const fixture = await createRuntimeExportFixture();
    await writeRuntimeExportBinaryFile(
      fixture.directoryPath,
      "assets/textures/atlas_page_0.raw-rgba",
      fixture.textureBytes.slice(0, 12)
    );

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.textureByteLengthMismatch",
      artifactPath: "assets/textures/atlas_page_0.raw-rgba"
    });
  });

  it("rejects texture pages whose digest does not match metadata", async () => {
    const fixture = await createRuntimeExportFixture();
    const corruptedBytes = Uint8Array.from(fixture.textureBytes);
    corruptedBytes[0] = 0;
    await writeRuntimeExportBinaryFile(
      fixture.directoryPath,
      "assets/textures/atlas_page_0.raw-rgba",
      corruptedBytes
    );

    await expect(loadRuntimeExportDirectory(fixture.directoryPath)).rejects.toMatchObject({
      code: "runtimeExport.textureDigestMismatch",
      artifactPath: "assets/textures/atlas_page_0.raw-rgba"
    });
  });

  it("rejects path traversal before resolving artifact paths", async () => {
    const directoryPath = await createTemporaryDirectory();

    expect(() =>
      resolveRuntimeExportArtifactPath(directoryPath, "../runtime-export.json")
    ).toThrowError(/outside the selected directory/);
  });
});

async function createRuntimeExportFixture(): Promise<{
  readonly directoryPath: string;
  readonly artifacts: ReturnType<typeof createMinimalRuntimeExportArtifacts>;
  readonly textureBytes: Uint8Array;
}> {
  const directoryPath = await createTemporaryDirectory();
  const textureBytes = Uint8Array.from([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    255, 255, 255, 255
  ]);
  const artifacts = createMinimalRuntimeExportArtifacts(textureBytes);

  await writeRuntimeExportTextFile(
    directoryPath,
    "runtime-export.json",
    JSON.stringify(artifacts.manifest)
  );
  await writeRuntimeExportTextFile(
    directoryPath,
    "runtime/model.json",
    JSON.stringify(artifacts.model)
  );
  await writeRuntimeExportTextFile(
    directoryPath,
    "runtime/atlas.json",
    JSON.stringify(artifacts.atlas)
  );
  await writeRuntimeExportBinaryFile(
    directoryPath,
    "assets/textures/atlas_page_0.raw-rgba",
    textureBytes
  );

  return {
    directoryPath,
    artifacts,
    textureBytes
  };
}

async function createTemporaryDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(
    path.join(os.tmpdir(), "runtime-player-any-name-")
  );
  temporaryDirectories.push(directoryPath);

  return directoryPath;
}

async function writeRuntimeExportTextFile(
  directoryPath: string,
  artifactPath: string,
  text: string
): Promise<void> {
  const filePath = path.join(directoryPath, ...artifactPath.split("/"));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
}

async function writeRuntimeExportJsonFile(
  directoryPath: string,
  artifactPath: string,
  value: unknown
): Promise<void> {
  await writeRuntimeExportTextFile(
    directoryPath,
    artifactPath,
    JSON.stringify(value)
  );
}

async function writeRuntimeExportBinaryFile(
  directoryPath: string,
  artifactPath: string,
  bytes: Uint8Array
): Promise<void> {
  const filePath = path.join(directoryPath, ...artifactPath.split("/"));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

function createMinimalRuntimeExportArtifacts(textureBytes: Uint8Array) {
  const page = createTexturePage(0, textureBytes);
  const sourcePackage = {
    packageId: "pkg_runtime_export",
    packageDisplayName: "Runtime Export Model",
    packageRevision: 4
  };
  const canvas = {
    coordinateSystem: "canvas-y-down-v1",
    size: {
      width: 128,
      height: 128
    },
    bounds: {
      x: 0,
      y: 0,
      width: 128,
      height: 128
    }
  };
  const renderAssumptions = createRenderAssumptions();

  return {
    manifest: {
      schemaVersion: "runtime-export-manifest-v0",
      exportFormatVersion: "runtime-export-v0",
      sourcePackage,
      createdAt: "2026-06-20T00:00:00.000Z",
      paths: {
        manifest: "runtime-export.json",
        model: "runtime/model.json",
        atlas: "runtime/atlas.json",
        texturePages: [page.path]
      },
      canvas,
      modelBounds: canvas.bounds,
      texturePages: [page],
      requiredCapabilities: [
        "directory-runtime-export-v0",
        "raw-rgba8-texture-pages-v1",
        "materialized-atlas-uvs-v1",
        "transparent-background-v1",
        "alpha-mask-clipping-v1",
        "dynamics-pendulum-solver-v1"
      ],
      renderAssumptions
    },
    model: {
      schemaVersion: "runtime-export-model-v0",
      sourcePackage,
      canvas,
      modelBounds: canvas.bounds,
      texturePages: [toTexturePageReference(page)],
      parameters: [
        {
          parameterId: "param_angle_x",
          displayName: "Angle X",
          valueSource: "authoredInput",
          runtimeRole: "external-input",
          externalInput: true,
          readOnly: false,
          min: -30,
          max: 30,
          default: 0
        }
      ],
      inputManifest: {
        externalInputParameterIds: ["param_angle_x"],
        computedDynamicsOutputParameterIds: [],
        hiddenDirectControlParameterIds: []
      },
      drawables: [
        {
          drawableId: "draw_body",
          displayName: "Body",
          meshId: "mesh_body",
          partId: "part_root",
          includeReason: "runtime-target-v1",
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          bounds: {
            x: 0,
            y: 0,
            width: 32,
            height: 32
          },
          texture: {
            pageId: page.pageId,
            path: page.path,
            placementId: "atlas_place_body"
          }
        }
      ],
      meshes: [
        {
          meshId: "mesh_body",
          drawableId: "draw_body",
          vertices: [
            { x: 0, y: 0 },
            { x: 32, y: 0 },
            { x: 0, y: 32 }
          ],
          atlasUvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          uvSpace: "atlas-normalized-v1",
          triangles: [[0, 1, 2]],
          vertexStableIds: ["v0", "v1", "v2"],
          bounds: {
            x: 0,
            y: 0,
            width: 32,
            height: 32
          },
          texture: {
            pageId: page.pageId,
            path: page.path,
            placementId: "atlas_place_body"
          }
        }
      ],
      drawOrder: [
        {
          drawableId: "draw_body",
          drawOrder: 0
        }
      ],
      masks: [],
      rigControls: [],
      keyforms: [],
      dynamicsSolver: renderAssumptions.dynamics,
      dynamicsGroups: [],
      renderAssumptions
    },
    atlas: {
      schemaVersion: "runtime-export-atlas-v0",
      sourceSignature: {
        schemaVersion: "texture-atlas-source-signature-v1",
        inputVersion: "atlas-source-inputs-v1",
        algorithmId: "stable-json-fnv1a32-v1",
        digest: "fnv1a32:0123abcd",
        boundDrawableIds: ["draw_body"],
        packableDrawableIds: ["draw_body"]
      },
      settings: {
        algorithmId: "single-page-shelf-v1",
        pageWidth: 2,
        pageHeight: 2,
        paddingPixels: 0,
        edgeExtrusion: {
          enabled: true,
          pixels: 0
        }
      },
      pages: [page],
      placements: [
        {
          placementId: "atlas_place_body",
          pageId: page.pageId,
          drawableId: "draw_body",
          meshId: "mesh_body",
          originalTextureId: "tex_body",
          atlasTextureId: page.textureId,
          sourceTextureSize: {
            width: 2,
            height: 2
          },
          sourceRectPixels: {
            x: 0,
            y: 0,
            width: 2,
            height: 2
          },
          contentRectPixels: {
            x: 0,
            y: 0,
            width: 2,
            height: 2
          },
          paddedRectPixels: {
            x: 0,
            y: 0,
            width: 2,
            height: 2
          },
          uvRect: {
            topLeft: {
              x: 0,
              y: 0
            },
            bottomRight: {
              x: 1,
              y: 1
            }
          },
          hiddenAtApply: false,
          hiddenReasons: [],
          runtimeTexturePagePath: page.path
        }
      ]
    }
  };
}

function createTexturePage(pageIndex: number, textureBytes: Uint8Array) {
  return {
    pageId: `atlas_page_${pageIndex}`,
    path: `assets/textures/atlas_page_${pageIndex}.raw-rgba`,
    textureId: `tex_atlas_page_${pageIndex}`,
    width: 2,
    height: 2,
    pixelFormat: "rgba8",
    mediaType: RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
    byteLength: textureBytes.byteLength,
    digest: {
      algorithm: "sha256",
      hex: createHash("sha256").update(textureBytes).digest("hex")
    },
    binaryAssetId: `bin_atlas_page_${pageIndex}`
  };
}

function toTexturePageReference(page: ReturnType<typeof createTexturePage>) {
  return {
    pageId: page.pageId,
    path: page.path,
    width: page.width,
    height: page.height,
    pixelFormat: page.pixelFormat
  };
}

function createRenderAssumptions() {
  return {
    transparentBackground: true,
    pixelFormat: "rgba8",
    alphaMode: "straight-alpha-v1",
    colorSpace: "srgb-v1",
    textureFiltering: "linear-v1",
    blendMode: "source-over-v1",
    masking: {
      clippingMode: "alpha-mask-v1",
      coordinateSpace: "canvas-y-down-v1",
      maskChannels: "alpha-v1"
    },
    dynamics: {
      solverVersion: "runtime-dynamics-pendulum-v1",
      fixedStepMs: 1000 / 60,
      resetPolicy: "reset-to-default-parameters-v1"
    }
  };
}
