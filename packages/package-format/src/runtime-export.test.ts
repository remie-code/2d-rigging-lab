import { describe, expect, it } from "vitest";

import {
  RUNTIME_EXPORT_ATLAS_PATH,
  RUNTIME_EXPORT_MANIFEST_PATH,
  RUNTIME_EXPORT_MODEL_PATH,
  RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
  RuntimeExportAtlasSchema,
  RuntimeExportManifestSchema,
  RuntimeExportModelSchema,
  RuntimeExportTexturePageMetadataSchema,
  assertRuntimeExportFilePath,
  assertRuntimeExportV0SinglePageArtifacts,
  createRuntimeExportBinaryTextureFileEntry,
  createRuntimeExportFileSet,
  parseRuntimeExportArtifactsFromFileSet,
  parseRuntimeExportAtlas,
  parseRuntimeExportManifest,
  parseRuntimeExportModel,
  serializeRuntimeExportArtifactsToTextFileSet
} from "./index.js";

const DIGEST_HEX = "0123456789abcdef".repeat(4);

describe("Runtime Export v0 package-format contract", () => {
  it("parses valid minimal runtime export manifest, model, and atlas DTOs", () => {
    const artifacts = createMinimalRuntimeExportArtifacts();

    expect(parseRuntimeExportManifest(artifacts.manifest)).toMatchObject({
      success: true,
      data: {
        schemaVersion: "runtime-export-manifest-v0",
        paths: {
          manifest: RUNTIME_EXPORT_MANIFEST_PATH,
          model: RUNTIME_EXPORT_MODEL_PATH,
          atlas: RUNTIME_EXPORT_ATLAS_PATH
        }
      }
    });
    expect(parseRuntimeExportModel(artifacts.model)).toMatchObject({
      success: true,
      data: {
        schemaVersion: "runtime-export-model-v0",
        meshes: [
          expect.objectContaining({
            meshId: "mesh_body",
            uvSpace: "atlas-normalized-v1"
          })
        ]
      }
    });
    expect(parseRuntimeExportAtlas(artifacts.atlas)).toMatchObject({
      success: true,
      data: {
        schemaVersion: "runtime-export-atlas-v0",
        pages: [
          expect.objectContaining({
            pageId: "atlas_page_0",
            mediaType: RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE
          })
        ]
      }
    });
  });

  it("validates raw RGBA page dimensions, byte length, media type, and digest fields", () => {
    const page = createTexturePage(0);

    expect(RuntimeExportTexturePageMetadataSchema.safeParse(page).success).toBe(true);
    expect(RuntimeExportTexturePageMetadataSchema.safeParse({
      ...page,
      width: 0
    }).success).toBe(false);
    expect(RuntimeExportTexturePageMetadataSchema.safeParse({
      ...page,
      byteLength: page.byteLength - 1
    }).success).toBe(false);
    expect(RuntimeExportTexturePageMetadataSchema.safeParse({
      ...page,
      mediaType: "image/png"
    }).success).toBe(false);
    expect(RuntimeExportTexturePageMetadataSchema.safeParse({
      ...page,
      digest: {
        algorithm: "sha256",
        hex: DIGEST_HEX.toUpperCase()
      }
    }).success).toBe(false);
    expect(RuntimeExportTexturePageMetadataSchema.safeParse({
      ...page,
      digest: {
        algorithm: "sha1",
        hex: DIGEST_HEX
      }
    }).success).toBe(false);
  });

  it("validates v0 single-page artifacts while atlas schema allows future pages arrays", () => {
    const artifacts = createMinimalRuntimeExportArtifacts();
    const secondPage = createTexturePage(1);
    const firstManifestPage = artifacts.manifest.texturePages[0]!;
    const firstModelPage = artifacts.model.texturePages[0]!;
    const firstAtlasPage = artifacts.atlas.pages[0]!;

    expect(() => assertRuntimeExportV0SinglePageArtifacts(artifacts)).not.toThrow();
    expect(RuntimeExportAtlasSchema.parse({
      ...artifacts.atlas,
      pages: [
        ...artifacts.atlas.pages,
        secondPage
      ]
    }).pages).toHaveLength(2);

    expect(() => assertRuntimeExportV0SinglePageArtifacts({
      manifest: {
        ...artifacts.manifest,
        paths: {
          ...artifacts.manifest.paths,
          texturePages: [
            firstManifestPage.path,
            secondPage.path
          ]
        },
        texturePages: [
          firstManifestPage,
          secondPage
        ]
      },
      model: {
        ...artifacts.model,
        texturePages: [
          firstModelPage,
          toTexturePageReference(secondPage)
        ]
      },
      atlas: {
        ...artifacts.atlas,
        pages: [
          firstAtlasPage,
          secondPage
        ]
      }
    })).toThrow(/exactly one texture page/);
  });

  it("accepts Runtime Export directory file-set paths and parses text artifacts", () => {
    const artifacts = assertRuntimeExportV0SinglePageArtifacts(
      createMinimalRuntimeExportArtifacts()
    );
    const textEntries = serializeRuntimeExportArtifactsToTextFileSet(artifacts);
    const fileSet = createRuntimeExportFileSet([
      ...textEntries,
      createRuntimeExportBinaryTextureFileEntry({
        path: "assets/textures/atlas_page_0.raw-rgba",
        bytes: new Uint8Array(16)
      })
    ]);

    expect(fileSet.map((entry) => entry.path)).toEqual([
      "runtime-export.json",
      "runtime/model.json",
      "runtime/atlas.json",
      "assets/textures/atlas_page_0.raw-rgba"
    ]);
    expect(parseRuntimeExportArtifactsFromFileSet(fileSet)).toEqual(artifacts);
  });

  it("rejects traversal, absolute, backslash, unsupported, and duplicate Runtime Export paths", () => {
    for (const path of [
      "../runtime-export.json",
      "/runtime-export.json",
      "C:/runtime-export.json",
      "runtime\\model.json",
      "assets/textures/atlas_page_0.png",
      "assets/textures/nested/atlas_page_0.raw-rgba",
      "runtime/model.json/extra"
    ]) {
      expect(() => assertRuntimeExportFilePath(path)).toThrow(/Unsupported Runtime Export/);
    }

    const artifacts = assertRuntimeExportV0SinglePageArtifacts(
      createMinimalRuntimeExportArtifacts()
    );
    const textEntries = serializeRuntimeExportArtifactsToTextFileSet(artifacts);

    expect(() => createRuntimeExportFileSet([
      ...textEntries,
      textEntries[0]!
    ])).toThrow(/Duplicate Runtime Export file path/);

    expect(() => createRuntimeExportFileSet([
      createRuntimeExportBinaryTextureFileEntry({
        path: "assets/textures/atlas_page_0.raw-rgba",
        bytes: new Uint8Array(16)
      }),
      createRuntimeExportBinaryTextureFileEntry({
        path: "assets/textures/atlas_page_0.raw-rgba",
        bytes: new Uint8Array(16)
      })
    ])).toThrow(/Duplicate Runtime Export file path/);
  });

  it("rejects editor and workspace-only sections when represented in DTOs", () => {
    const artifacts = createMinimalRuntimeExportArtifacts();

    expect(RuntimeExportManifestSchema.safeParse({
      ...artifacts.manifest,
      workspaceMetadata: {}
    }).success).toBe(false);
    expect(RuntimeExportModelSchema.safeParse({
      ...artifacts.model,
      editorState: {}
    }).success).toBe(false);
    expect(RuntimeExportAtlasSchema.safeParse({
      ...artifacts.atlas,
      sourceManifest: {}
    }).success).toBe(false);
  });
});

const createMinimalRuntimeExportArtifacts = () => {
  const page = createTexturePage(0);
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
};

const createTexturePage = (pageIndex: number) => ({
  pageId: `atlas_page_${pageIndex}`,
  path: `assets/textures/atlas_page_${pageIndex}.raw-rgba`,
  textureId: `tex_atlas_page_${pageIndex}`,
  width: 2,
  height: 2,
  pixelFormat: "rgba8",
  mediaType: RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
  byteLength: 16,
  digest: {
    algorithm: "sha256",
    hex: DIGEST_HEX
  },
  binaryAssetId: `bin_atlas_page_${pageIndex}`
});

const toTexturePageReference = (page: ReturnType<typeof createTexturePage>) => ({
  pageId: page.pageId,
  path: page.path,
  width: page.width,
  height: page.height,
  pixelFormat: page.pixelFormat
});

const createRenderAssumptions = () => ({
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
});
