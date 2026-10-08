import { describe, expect, it } from "vitest";

import {
  PackageDocumentSchema,
  VARIANTS_MODEL_FILE_PATH,
  exportPortablePackageBundleV0,
  importPortablePackageBundleV0,
  parsePackageDocument,
  parsePackageDocumentFromFileSet,
  parseWorkspacePackageDocumentFromFileSet,
  serializePackageDocumentToFileSet,
  serializeWorkspacePackageFileSet,
  type PackageDocumentDto
} from "./index.js";
import { createPackageInMemoryFileSet } from "./package-binary-file-set.js";

describe("package-format variants model file", () => {
  it("parses an existing package without variants as an empty variants collection", () => {
    const parsed = parsePackageDocument(createMinimalPackageDocumentInput());

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.model.variants).toEqual({
        schemaVersion: "variants-file-v1",
        variantGroups: []
      });
      expect(parsed.data.manifest.modelFiles.variants).toBeUndefined();
    }
  });

  it("serializes and parses a valid package with model/variants.json", () => {
    const document = createPackageDocumentWithVariants();
    const fileSet = serializePackageDocumentToFileSet(document);
    const paths = fileSet.map((entry) => entry.path);

    expect(paths).toContain(VARIANTS_MODEL_FILE_PATH);
    expect(parsePackageDocumentFromFileSet(fileSet).model.variants).toEqual(document.model.variants);
  });

  it("does not require model/variants.json for old workspace file sets", () => {
    const oldDocument = PackageDocumentSchema.parse(createMinimalPackageDocumentInput());
    const workspaceFileSet = serializeWorkspacePackageFileSet({
      packageDocument: oldDocument
    });

    expect(workspaceFileSet.map((entry) => entry.path)).not.toContain(VARIANTS_MODEL_FILE_PATH);
    expect(parseWorkspacePackageDocumentFromFileSet(workspaceFileSet).packageDocument.model.variants)
      .toEqual({
        schemaVersion: "variants-file-v1",
        variantGroups: []
      });
  });

  it("round-trips variants through portable JSON bundles", async () => {
    const document = createPackageDocumentWithVariants();
    const bundle = await exportPortablePackageBundleV0({
      packageDocument: document,
      fileSet: createPackageInMemoryFileSet([])
    });
    const imported = await importPortablePackageBundleV0({ bundle });

    expect(imported.packageDocument.model.variants).toEqual(document.model.variants);
    expect(imported.fileSet.filter((entry) => "text" in entry).map((entry) => entry.path))
      .toContain(VARIANTS_MODEL_FILE_PATH);
  });

  it("does not represent Preview active selection in PackageDocument variants", () => {
    const document = createPackageDocumentWithVariants();
    const variants = expectVariants(document);
    const group = variants.variantGroups[0];
    if (group === undefined) {
      throw new Error("Expected variants fixture group.");
    }
    const fileSetText = serializePackageDocumentToFileSet(document)
      .map((entry) => entry.text)
      .join("\n");
    const invalidWithPreviewActive = {
      ...document,
      model: {
        ...document.model,
        variants: {
          ...variants,
          variantGroups: [
            {
              ...group,
              previewActive: {
                kind: "singleSelect",
                variantId: "var_expression_smile"
              }
            }
          ]
        }
      }
    };

    expect(fileSetText).not.toContain("previewActive");
    expect(PackageDocumentSchema.safeParse(invalidWithPreviewActive).success).toBe(false);
  });

  it("rejects variants that target unknown package drawables", () => {
    const document = createPackageDocumentWithVariants();
    const group = expectFixtureVariantGroup(document);

    expectPackageDocumentRejected(withVariantGroups(document, [
      {
        ...group,
        targetDrawableIds: ["draw_face", "draw_missing"],
        memberships: [
          ...group.memberships,
          {
            drawableId: "draw_missing",
            variantIds: ["var_expression_default"]
          }
        ]
      }
    ]));
  });

  it("rejects memberships that reference unknown Variants", () => {
    const document = createPackageDocumentWithVariants();
    const group = expectFixtureVariantGroup(document);

    expectPackageDocumentRejected(withVariantGroups(document, [
      {
        ...group,
        memberships: [
          {
            drawableId: "draw_face",
            variantIds: ["var_expression_missing"]
          }
        ]
      }
    ]));
  });

  it("rejects membership drawables that are not listed as targets", () => {
    const document = createPackageDocumentWithVariants();
    const group = expectFixtureVariantGroup(document);

    expectPackageDocumentRejected(withVariantGroups(document, [
      {
        ...group,
        targetDrawableIds: [],
        memberships: [
          {
            drawableId: "draw_face",
            variantIds: ["var_expression_default"]
          }
        ]
      }
    ]));
  });

  it("rejects duplicate target drawable ownership across Variant Groups", () => {
    const document = createPackageDocumentWithVariants();
    const group = expectFixtureVariantGroup(document);

    expectPackageDocumentRejected(withVariantGroups(document, [
      group,
      {
        variantGroupId: "vgrp_outfit",
        displayName: "Outfit",
        mode: "singleSelect",
        variants: [
          { variantId: "var_outfit_default", displayName: "Default" }
        ],
        targetDrawableIds: ["draw_face"],
        memberships: [
          {
            drawableId: "draw_face",
            variantIds: ["var_outfit_default"]
          }
        ],
        defaultActive: {
          kind: "singleSelect",
          variantId: "var_outfit_default"
        }
      }
    ]));
  });
});

const createPackageDocumentWithVariants = (): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    ...createMinimalPackageDocumentInput(),
    manifest: {
      ...createMinimalPackageDocumentInput().manifest,
      schemaVersions: {
        ...createMinimalPackageDocumentInput().manifest.schemaVersions,
        variants: "variants-file-v1"
      },
      modelFiles: {
        ...createMinimalPackageDocumentInput().manifest.modelFiles,
        variants: VARIANTS_MODEL_FILE_PATH
      }
    },
    model: {
      ...createMinimalPackageDocumentInput().model,
      graph: {
        ...createMinimalPackageDocumentInput().model.graph,
        parts: [
          {
            partId: "part_root",
            displayName: "Root",
            childPartIds: [],
            drawableIds: ["draw_face"],
            children: [{ kind: "drawable", drawableId: "draw_face" }]
          }
        ],
        stableOrder: ["part_root", "draw_face"]
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: [createDrawable("draw_face", "Face")]
      },
      variants: {
        schemaVersion: "variants-file-v1",
        variantGroups: [
          {
            variantGroupId: "vgrp_expression",
            displayName: "Expression",
            mode: "singleSelect",
            variants: [
              { variantId: "var_expression_default", displayName: "Default" },
              { variantId: "var_expression_smile", displayName: "Smile" }
            ],
            targetDrawableIds: ["draw_face"],
            memberships: [
              {
                drawableId: "draw_face",
                variantIds: ["var_expression_default", "var_expression_smile"]
              }
            ],
            defaultActive: {
              kind: "singleSelect",
              variantId: "var_expression_default"
            }
          }
        ]
      }
    }
  });

const createMinimalPackageDocumentInput = () => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: "pkg_variants_format_test",
    packageDisplayName: "Variants Format Test",
    formatVersion: "open-model-package-v1",
    packageRevision: 0,
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z",
    schemaVersions: {
      manifest: "open-model-package-manifest-v1"
    },
    evaluatorVersions: {},
    modelFiles: {
      graph: "model/graph.json",
      drawables: "model/drawables.json",
      meshes: "model/meshes.json",
      parameters: "model/parameters.json",
      keyforms: "model/keyforms.json",
      rigControls: "model/rig-controls.json",
      dynamics: "model/dynamics.json",
      masks: "model/masks.json",
      drawOrder: "model/draw-order.json"
    },
    assetIndex: "assets/sources/source-manifest.json",
    operationLog: "operations/log.jsonl",
    rightsSummary: { status: "cleared" },
    provenanceSummary: { sourceAssetCount: 1 },
    packageStableOrderVersion: "stable-order-v1"
  },
  model: {
    graph: {
      schemaVersion: "model-graph-v1",
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 1024, height: 1024 },
      parts: [],
      rigControlRootIds: [],
      stableOrder: []
    },
    drawables: {
      schemaVersion: "drawables-file-v1",
      drawables: []
    },
    meshes: {
      schemaVersion: "meshes-file-v1",
      meshes: []
    },
    parameters: {
      schemaVersion: "parameters-file-v1",
      parameters: []
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: []
    },
    rigControls: {
      schemaVersion: "rig-controls-file-v1",
      rigControls: []
    },
    dynamics: {
      schemaVersion: "dynamics-file-v3",
      dynamicsGroups: []
    },
    masks: {
      schemaVersion: "masks-file-v1",
      masks: []
    },
    drawOrder: {
      schemaVersion: "draw-order-file-v1",
      entries: []
    }
  },
  assets: {
    sourceManifest: {
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: "src_split_png",
          kind: "split-png-set-v1",
          filePath: "assets/sources/split/body.png",
          contentHash: "sha256:test",
          importProfile: "split-png-fallback-v1",
          layers: []
        }
      ]
    },
    provenance: {
      schemaVersion: "provenance-file-v1",
      records: []
    },
    rights: {
      schemaVersion: "rights-file-v1",
      records: []
    }
  }
});

const createDrawable = (drawableId: string, displayName: string) => ({
  drawableId,
  displayName,
  partId: "part_root",
  sourceAssetId: "src_split_png",
  textureId: "tex_face",
  meshId: "mesh_face",
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: 0,
  sourceProvenanceId: "prov_face"
});

const expectVariants = (document: PackageDocumentDto) => {
  const variants = document.model.variants;
  if (variants === undefined) {
    throw new Error("Expected variants fixture.");
  }

  return variants;
};

const expectFixtureVariantGroup = (document: PackageDocumentDto) => {
  const group = expectVariants(document).variantGroups[0];
  if (group === undefined) {
    throw new Error("Expected variants fixture group.");
  }

  return group;
};

const withVariantGroups = (
  document: PackageDocumentDto,
  variantGroups: ReadonlyArray<unknown>
) => ({
  ...document,
  model: {
    ...document.model,
    variants: {
      ...expectVariants(document),
      variantGroups
    }
  }
});

const expectPackageDocumentRejected = (document: unknown): void => {
  expect(PackageDocumentSchema.safeParse(document).success).toBe(false);
};
