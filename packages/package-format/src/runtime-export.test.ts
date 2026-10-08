import { describe, expect, it } from "vitest";

import {
  RUNTIME_EXPORT_ATLAS_PATH,
  RUNTIME_EXPORT_MANIFEST_PATH,
  RUNTIME_EXPORT_MODEL_PATH,
  RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
  RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION,
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

  it("keeps runtime variants optional while accepting Variant metadata", () => {
    const artifacts = createMinimalRuntimeExportArtifacts();

    expect(RuntimeExportModelSchema.parse(artifacts.model).variants).toBeUndefined();

    const parsed = parseRuntimeExportModel({
      ...artifacts.model,
      variants: createRuntimeExportVariants()
    });

    expect(parsed).toMatchObject({
      success: true,
      data: {
        variants: {
          schemaVersion: RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION,
          defaultActiveSelections: [
            {
              variantGroupId: "vgrp_expression",
              activeSelection: {
                kind: "singleSelect",
                variantId: "var_expression_default"
              }
            }
          ]
        }
      }
    });
  });

  it("accepts new drawable baseVisible while legacy drawables without it remain parseable", () => {
    const artifacts = createMinimalRuntimeExportArtifacts();
    const parsedLegacy = parseRuntimeExportModel(artifacts.model);

    expect(parsedLegacy).toMatchObject({
      success: true,
      data: {
        drawables: [
          expect.objectContaining({
            drawableId: "draw_body",
            visible: true
          })
        ]
      }
    });
    if (parsedLegacy.success) {
      expect(parsedLegacy.data.drawables[0]?.baseVisible).toBeUndefined();
    }

    const parsedNew = parseRuntimeExportModel({
      ...artifacts.model,
      drawables: artifacts.model.drawables.map((drawable) => ({
        ...drawable,
        baseVisible: true,
        visible: false
      }))
    });

    expect(parsedNew).toMatchObject({
      success: true,
      data: {
        drawables: [
          expect.objectContaining({
            drawableId: "draw_body",
            baseVisible: true,
            visible: false
          })
        ]
      }
    });
  });

  it("rejects inconsistent Runtime Export Variant metadata", () => {
    const { defaultActiveSelections: _missingSelections, ...missingDefaultActiveSelections } =
      createRuntimeExportVariants();
    const missingGroupSelection = {
      ...createRuntimeExportVariants(),
      defaultActiveSelections: [
        ...createRuntimeExportVariants().defaultActiveSelections,
        {
          variantGroupId: "vgrp_missing",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_expression_default"
          }
        }
      ]
    };
    const groupDefaultSelectionMismatch = {
      ...createRuntimeExportVariants(),
      defaultActiveSelections: [
        {
          variantGroupId: "vgrp_expression",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_expression_smile"
          }
        }
      ]
    };
    const wrongSelectionKind = {
      ...createRuntimeExportVariants(),
      defaultActiveSelections: [
        {
          variantGroupId: "vgrp_expression",
          activeSelection: {
            kind: "multiToggle",
            variantIds: ["var_expression_default"]
          }
        }
      ]
    };
    const missingVariantSelection = {
      ...createRuntimeExportVariants(),
      defaultActiveSelections: [
        {
          variantGroupId: "vgrp_expression",
          activeSelection: {
            kind: "singleSelect",
            variantId: "var_expression_missing"
          }
        }
      ]
    };

    for (const testCase of [
      {
        label: "missing defaultActiveSelections",
        variants: missingDefaultActiveSelections,
        issuePath: "variants/defaultActiveSelections"
      },
      {
        label: "selection references missing group",
        variants: missingGroupSelection,
        issuePath: "variants/defaultActiveSelections/1/variantGroupId"
      },
      {
        label: "group default and explicit selection mismatch",
        variants: groupDefaultSelectionMismatch,
        issuePath: "variants/variantGroups/0/defaultActive"
      },
      {
        label: "explicit selection kind does not match group mode",
        variants: wrongSelectionKind,
        issuePath: "variants/defaultActiveSelections/0/activeSelection/kind"
      },
      {
        label: "explicit selection references missing Variant",
        variants: missingVariantSelection,
        issuePath: "variants/defaultActiveSelections/0/activeSelection/variantId"
      }
    ]) {
      const parsed = parseRuntimeExportModel({
        ...createMinimalRuntimeExportArtifacts().model,
        variants: testCase.variants
      });

      expect(parsed.success, testCase.label).toBe(false);
      if (parsed.success) {
        continue;
      }
      expect(
        parsed.issues.map((issue) => issue.path.join("/")),
        testCase.label
      ).toContain(testCase.issuePath);
    }
  });

  it("rejects Runtime Export Variant metadata that references non-exported drawables", () => {
    const artifacts = createMinimalRuntimeExportArtifacts();
    const parsed = parseRuntimeExportModel({
      ...artifacts.model,
      variants: {
        ...createRuntimeExportVariants(),
        variantGroups: [
          {
            ...createRuntimeExportVariants().variantGroups[0]!,
            targetDrawableIds: ["draw_body", "draw_missing"],
            memberships: [
              {
                drawableId: "draw_body",
                variantIds: ["var_expression_default"]
              },
              {
                drawableId: "draw_missing",
                variantIds: ["var_expression_smile"]
              }
            ]
          }
        ]
      }
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.issues.map((issue) => issue.path.join("/"))).toEqual(
      expect.arrayContaining([
        "variants/variantGroups/0/targetDrawableIds/1",
        "variants/variantGroups/0/memberships/1/drawableId"
      ])
    );
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
        "dynamics-chain-solver-v1"
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

const createRuntimeExportVariants = () => ({
  schemaVersion: RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION,
  variantGroups: [
    {
      variantGroupId: "vgrp_expression",
      displayName: "Expression",
      mode: "singleSelect",
      variants: [
        { variantId: "var_expression_default", displayName: "Default" },
        { variantId: "var_expression_smile", displayName: "Smile" }
      ],
      targetDrawableIds: ["draw_body"],
      memberships: [
        {
          drawableId: "draw_body",
          variantIds: ["var_expression_default"]
        }
      ],
      defaultActive: {
        kind: "singleSelect",
        variantId: "var_expression_default"
      }
    }
  ],
  defaultActiveSelections: [
    {
      variantGroupId: "vgrp_expression",
      activeSelection: {
        kind: "singleSelect",
        variantId: "var_expression_default"
      }
    }
  ]
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
    solverVersion: "runtime-dynamics-chain-v1",
    fixedStepMs: 1000 / 60,
    resetPolicy: "reset-to-default-parameters-v1"
  }
});
