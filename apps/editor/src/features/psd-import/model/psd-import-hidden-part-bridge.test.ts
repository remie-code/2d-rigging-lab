import { getDrawableById } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  type SourceAssetId
} from "@private-2d-rigging-lab/contracts";
import {
  PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  type PsdAdapterLayerMaterializationEvidenceDto,
  type PsdAdapterParserEvidenceDto,
  type PsdAdapterResultDto
} from "@private-2d-rigging-lab/operation-core";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  parsePsdForEditorImport,
  type BrowserPsdMaterializedLayerBytes,
  type BrowserPsdParserInput,
  type BrowserPsdParserResult
} from "../../../editor-workflow/browser-psd-parser-adapter";
import { ROOT_PART_ID, createEmptyAuthoringSession } from "../../editor-session/model/empty-authoring-session";
import { mergeEditorHiddenPartIds } from "../../editor-session/model/editor-hidden-part-state";
import { createStructureTreeRows } from "../../editor-session/model/session-tree";
import { commitPsdImportPlan } from "./psd-import-commit";
import { createPsdImportPlan } from "./psd-import-planner";

const parsePsdForEditorImportMock = vi.hoisted(() => vi.fn());

vi.mock("../../../editor-workflow/browser-psd-parser-adapter", () => ({
  createPsdSourceAssetId: (planToken: string) => `src_${planToken}`,
  parsePsdForEditorImport: parsePsdForEditorImportMock
}));

const HIDDEN_GROUP_ID = "psd:root/group[0]";
const LOCAL_VISIBLE_CHILD_LAYER_ID = "psd:root/group[0]/layer[0]";
const SOURCE_DIGEST = {
  algorithm: "sha256" as const,
  hex: "abababababababababababababababababababababababababababababababab"
};
const MATERIALIZED_DIGEST = {
  algorithm: "sha256" as const,
  hex: "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"
};
const PARSER_EVIDENCE: PsdAdapterParserEvidenceDto = {
  evidenceKind: "psd-parser-evidence-v1",
  parserName: "bridge-test-parser",
  parserPackageName: "bridge-test-parser",
  parserVersion: "0.0.0",
  adapterName: "bridge-test-adapter",
  adapterVersion: "0.0.0",
  runtime: "browser",
  privateShapePolicy: "parser-private-shape-excluded-v1"
};

describe("PSD import hidden Part Container bridge", () => {
  beforeEach(() => {
    vi.mocked(parsePsdForEditorImport).mockReset();
  });

  it("initializes editor-hidden Part IDs from locally hidden PSD groups without hiding local-visible child drawables at runtime", async () => {
    vi.mocked(parsePsdForEditorImport).mockImplementation(async (input) =>
      createHiddenGroupParserResult(input)
    );

    const plan = await createPsdImportPlan({
      fileName: "hidden-group.psd",
      bytes: new ArrayBuffer(16),
      destination: {
        parentPartId: ROOT_PART_ID,
        label: "Project Root"
      },
      packageRevision: 0
    });

    expect(plan.editorHiddenPartIds).toHaveLength(1);
    expect(plan.reviewRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "Part Container",
        localVisibleInSource: false,
        effectiveVisibleInSource: false,
        visibilityLabel: "Hidden Part Container"
      }),
      expect.objectContaining({
        kind: "Drawable",
        localVisibleInSource: true,
        effectiveVisibleInSource: false,
        visibilityLabel: "Hidden by parent group"
      })
    ]));

    const commitResult = commitPsdImportPlan({
      session: createEmptyAuthoringSession(),
      plan
    });
    expect(commitResult.editorHiddenPartIds).toEqual(plan.editorHiddenPartIds);

    const importedHiddenPartId = plan.editorHiddenPartIds[0]!;
    const mergedHiddenPartIds = mergeEditorHiddenPartIds(
      new Set([PartIdSchema.parse("part_already_hidden")]),
      commitResult.editorHiddenPartIds
    );
    expect(mergedHiddenPartIds.has(importedHiddenPartId)).toBe(true);
    expect(mergedHiddenPartIds.has(PartIdSchema.parse("part_already_hidden"))).toBe(true);

    const childDrawableId = plan.bridge.approval.approvedLeafScaffolds.find((leaf) =>
      leaf.sourceLayerRef.sourceLayerId === LOCAL_VISIBLE_CHILD_LAYER_ID
    )?.generatedDrawableId;
    expect(childDrawableId).toBeDefined();
    if (childDrawableId === undefined) {
      throw new Error("Expected generated child drawable ID.");
    }
    const childDrawable = commitResult.session.graph.drawables.find((drawable) =>
      drawable.drawableId === childDrawableId
    );
    expect(childDrawable).toBeDefined();
    if (childDrawable === undefined) {
      throw new Error("Expected imported child drawable.");
    }

    expect(getDrawableById(
      commitResult.session.graph,
      DrawableIdSchema.parse(childDrawableId)
    )).toMatchObject({
      runtimeVisibility: true,
      partId: importedHiddenPartId
    });

    const rows = createStructureTreeRows(commitResult.session, null, {
      editorHiddenPartIds: mergedHiddenPartIds
    });
    expect(rows.find((row) =>
      row.kind === "part" && row.id === importedHiddenPartId
    )).toMatchObject({
      editorHidden: true,
      effectiveHidden: true
    });
    expect(rows.find((row) =>
      row.kind === "drawable" && row.id === childDrawable.drawableId
    )).toMatchObject({
      runtimeVisible: true,
      effectiveHidden: true
    });
  });
});

function createHiddenGroupParserResult(
  input: BrowserPsdParserInput
): BrowserPsdParserResult {
  const materialization = createMaterializationEvidence(input.sourceAssetId, input.planToken);
  const layerBytes = createLayerBytes(materialization);

  return {
    adapterResult: createAdapterResult(materialization),
    materializedLayerBytes: [layerBytes],
    sourceDigest: SOURCE_DIGEST,
    sourceByteLength: input.bytes.byteLength,
    sourceFilePath: `assets/sources/private/${input.planToken}/${input.fileName}`
  };
}

function createAdapterResult(
  materialization: PsdAdapterLayerMaterializationEvidenceDto
): PsdAdapterResultDto {
  return {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: "bridge-test-adapter",
    adapterVersion: "0.0.0",
    intakeKind: "realPsdParseResult",
    parser: PARSER_EVIDENCE,
    canvas: {
      width: 64,
      height: 64,
      bounds: { x: 0, y: 0, width: 64, height: 64 }
    },
    sourceGroups: [
      {
        sourceGroupId: "psd:root",
        originalName: "hidden-group import",
        normalizedName: "hidden-group import",
        groupPath: ["hidden-group import"],
        sourceOrder: 0,
        visibleInSource: true,
        localVisibleInSource: true,
        effectiveVisibleInSource: true,
        opacityInSource: 1,
        bounds: { x: 0, y: 0, width: 64, height: 64 },
        unsupportedFeatures: []
      },
      {
        sourceGroupId: HIDDEN_GROUP_ID,
        originalName: "Hidden Group",
        normalizedName: "hidden group",
        parentGroupId: "psd:root",
        groupPath: ["hidden-group import", "Hidden Group"],
        sourceOrder: 1,
        visibleInSource: false,
        localVisibleInSource: false,
        effectiveVisibleInSource: false,
        opacityInSource: 1,
        bounds: { x: 8, y: 8, width: 16, height: 16 },
        unsupportedFeatures: []
      }
    ],
    sourceLayers: [
      {
        sourceLayerId: LOCAL_VISIBLE_CHILD_LAYER_ID,
        originalName: "Visible Child",
        normalizedName: "visible child",
        parentGroupId: HIDDEN_GROUP_ID,
        groupPath: ["hidden-group import", "Hidden Group"],
        sourceOrder: 2,
        bounds: { x: 8, y: 8, width: 2, height: 2 },
        visibleInSource: false,
        localVisibleInSource: true,
        effectiveVisibleInSource: false,
        opacityInSource: 1,
        role: "editableLayer",
        unsupportedFeatures: []
      }
    ],
    unsupportedFeatures: [],
    materializationEvidence: [materialization],
    diagnostics: []
  };
}

function createMaterializationEvidence(
  sourceAssetId: SourceAssetId,
  planToken: string
): PsdAdapterLayerMaterializationEvidenceDto {
  const binaryAssetRef: NonNullable<PsdAdapterLayerMaterializationEvidenceDto["binaryAssetRef"]> = {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${planToken}_hidden_child_rgba`,
    packageRelativePath: `assets/textures/psd/${planToken}/hidden_child.raw-rgba`,
    digest: MATERIALIZED_DIGEST,
    byteLength: 16,
    mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
    storageStatus: "stored-package-local-v1",
    provenanceId: ProvenanceIdSchema.parse(`prov_${planToken}_hidden_child`),
    rightsAssetId: sourceAssetId
  };

  return {
    evidenceKind: "psd-layer-materialization-evidence-v1",
    materializationId: `mat_${planToken}_hidden_child`,
    sourceLayerRef: {
      sourceAssetId,
      sourceLayerId: LOCAL_VISIBLE_CHILD_LAYER_ID,
      sourceLayerName: "Visible Child",
      sourceLayerPath: ["hidden-group import", "Hidden Group", "Visible Child"]
    },
    mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
    byteLength: 16,
    digest: MATERIALIZED_DIGEST,
    width: 2,
    height: 2,
    binaryAssetRef,
    provenance: {
      sourceFilePath: "hidden-group.psd",
      sourceDigest: SOURCE_DIGEST,
      sourceByteLength: 16,
      sourceMediaType: "image/vnd.adobe.photoshop",
      privacyLabel: "packageLocalAsset",
      publicDistribution: "notPublicDistributable",
      generatedBy: "bridge-test-adapter",
      publicDemoAsset: false
    },
    parser: PARSER_EVIDENCE,
    extraction: {
      extractionKind: "selectedLayerRasterV1",
      optionsSchemaVersion: "psd-layer-extraction-options-v1",
      options: {
        channelOrder: "rgba",
        includeEffects: false,
        includeHiddenLayers: false,
        composeWithOtherLayers: false,
        layerSelection: LOCAL_VISIBLE_CHILD_LAYER_ID
      }
    }
  };
}

function createLayerBytes(
  materialization: PsdAdapterLayerMaterializationEvidenceDto
): BrowserPsdMaterializedLayerBytes {
  return {
    sourceLayerId: LOCAL_VISIBLE_CHILD_LAYER_ID,
    materializationId: materialization.materializationId,
    binaryAssetRef: materialization.binaryAssetRef!,
    width: 2,
    height: 2,
    bytes: new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255
    ])
  };
}
