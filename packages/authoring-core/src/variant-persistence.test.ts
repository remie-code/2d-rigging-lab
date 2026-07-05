import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  PackageDocumentSchema,
  VARIANTS_MODEL_FILE_PATH,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  createAuthoringSessionFromPackageDocument,
  createAuthoringWorkspaceSavePlan,
  createInitialAuthoringRevision,
  exportAuthoringSessionPortableBundle,
  importAuthoringSessionPortableBundle,
  openAuthoringWorkspaceFromTextFileSet,
  toPackageDocumentFromAuthoringSession
} from "./index.js";
import type { AuthoringSession } from "./authoring-session.js";

describe("variant persistence through authoring adapters", () => {
  it("hydrates missing variants from old PackageDocument as an empty collection", () => {
    const packageDocument = createOldPackageDocumentWithoutVariants();
    const session = createAuthoringSessionFromPackageDocument(packageDocument);

    expect(packageDocument.model.variants).toEqual({
      schemaVersion: "variants-file-v1",
      variantGroups: []
    });
    expect(session.graph.variantGroups).toEqual([]);
  });

  it("serializes variants into PackageDocument and workspace file sets", async () => {
    const session = createVariantSession();
    const save = await createAuthoringWorkspaceSavePlan({
      session,
      baseDocument: createOldPackageDocumentWithoutVariants(),
      updatedAt: "2026-06-24T01:00:00.000Z"
    });
    const opened = openAuthoringWorkspaceFromTextFileSet({
      fileSet: save.savePlan.workspaceTextFileSet
    });

    expect(save.packageDocument.manifest.modelFiles.variants).toBe(VARIANTS_MODEL_FILE_PATH);
    expect(save.savePlan.workspaceTextFileSet.map((entry) => entry.path))
      .toContain(VARIANTS_MODEL_FILE_PATH);
    expect(opened.packageDocument.model.variants?.variantGroups).toEqual(session.graph.variantGroups);
    expect(opened.session.graph.variantGroups).toEqual(session.graph.variantGroups);
  });

  it("round-trips variants through authoring Portable JSON export and import", async () => {
    const session = createVariantSession();
    const exported = await exportAuthoringSessionPortableBundle({
      session,
      baseDocument: createOldPackageDocumentWithoutVariants(),
      updatedAt: "2026-06-24T02:00:00.000Z"
    });
    const imported = await importAuthoringSessionPortableBundle({
      bundle: exported.bundleJson
    });

    expect((exported.packageDocument as PackageDocumentDto).model.variants?.variantGroups)
      .toEqual(session.graph.variantGroups);
    expect(imported.session.graph.variantGroups).toEqual(session.graph.variantGroups);
    expect(JSON.stringify(imported.packageDocument)).not.toContain("previewActive");
  });

  it("toPackageDocumentFromAuthoringSession does not persist Preview active selection", () => {
    const session = {
      ...createVariantSession(),
      previewActiveVariants: {
        vgrp_expression: "var_expression_smile"
      }
    } as AuthoringSession & {
      readonly previewActiveVariants: Record<string, string>;
    };
    const document = toPackageDocumentFromAuthoringSession(session, {
      baseDocument: createOldPackageDocumentWithoutVariants(),
      updatedAt: "2026-06-24T03:00:00.000Z"
    });

    expect(JSON.stringify(document)).not.toContain("previewActive");
    expect(JSON.stringify(document)).not.toContain("previewActiveVariants");
  });
});

const createVariantSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_variant_persistence_test"),
    packageDisplayName: "Variant Persistence Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 1024, height: 1024 },
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_face")],
        children: [{ kind: "drawable", drawableId: DrawableIdSchema.parse("draw_face") }]
      }
    ],
    drawables: [createDrawable("draw_face", "Face")],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    variantGroups: [
      {
        variantGroupId: "vgrp_expression",
        displayName: "Expression",
        mode: "singleSelect",
        variants: [
          { variantId: "var_expression_default", displayName: "Default" },
          { variantId: "var_expression_smile", displayName: "Smile" }
        ],
        targetDrawableIds: [DrawableIdSchema.parse("draw_face")],
        memberships: [
          {
            drawableId: DrawableIdSchema.parse("draw_face"),
            variantIds: ["var_expression_default", "var_expression_smile"]
          }
        ],
        defaultActive: {
          kind: "singleSelect",
          variantId: "var_expression_default"
        }
      }
    ],
    rigControlRootIds: [],
    stableOrder: ["part_root", "draw_face"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createOldPackageDocumentWithoutVariants = (): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: "pkg_variant_persistence_test",
      packageDisplayName: "Variant Persistence Test",
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
      provenanceSummary: { sourceAssetCount: 0 },
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
        sourceAssets: []
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

const createDrawable = (drawableIdText: string, displayName: string) => ({
  drawableId: DrawableIdSchema.parse(drawableIdText),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  sourceAssetId: SourceAssetIdSchema.parse("src_split_png"),
  textureId: TextureIdSchema.parse(`tex_${drawableIdText.replace(/^draw_/, "")}`),
  meshId: MeshIdSchema.parse(`mesh_${drawableIdText.replace(/^draw_/, "")}`),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: 0,
  sourceProvenanceId: ProvenanceIdSchema.parse("prov_variant_persistence")
});
