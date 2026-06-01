import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  NormalizedDrawable,
  NormalizedPart,
  NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  validatePackageRuntime,
  ValidationReportSchema
} from "./index.js";
import type { ValidationReportDto } from "./index.js";

const CREATED_AT = "2026-06-01T00:00:00.000Z";

describe("wave29 mesh edit validator contract fixture", () => {
  it("pins valid mesh edit viewer validation and invalid topology diagnostics", () => {
    const finalPackage = createFinalPackageDocument(loadBaselinePackageDocument());
    const viewerResult = evaluateViewerRuntimeSnapshot(
      createRuntimeGraphFromFixture(loadFixtureJson("runtime/final-runtime-graph.json")),
      {
        baselineFrameIndex: 20,
        frameIndex: 21,
        operationId: "op_wave29_viewer_contract_evidence",
        strictness: "strict",
        targetIds: ["draw_wave29_mesh", "mesh_wave29_mesh"],
        options: {
          schemaVersion: "runtime-evaluation-options-v1",
          snapshotDetail: "full"
        }
      }
    );
    const validFinalReport = pinReportId(
      validatePackageRuntime({
        packageDocument: finalPackage,
        runtimeSnapshot: viewerResult.snapshot,
        viewerEvidence: viewerResult.evidence,
        profile: "viewer",
        createdAt: CREATED_AT
      }),
      "val_wave29_mesh_edit_valid_final"
    );
    const invalidTopologyReport = pinReportId(
      validatePackageRuntime({
        packageDocument: createInvalidTopologyPackage(finalPackage),
        profile: "strict",
        createdAt: CREATED_AT
      }),
      "val_wave29_mesh_edit_invalid_topology"
    );

    expect({
      schemaVersion: "wave29-mesh-edit-validation-report-summary-v1",
      validFinal: summarizeValidationReport(validFinalReport),
      invalidTopology: summarizeValidationReport(invalidTopologyReport)
    }).toEqual(loadFixtureJson("expected/validation-report-summary.json"));
  });
});

interface RuntimeGraphFixture {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly coordinateSystem: "canvas-y-down-v1";
  readonly parts: readonly NormalizedPart[];
  readonly drawables: readonly NormalizedDrawable[];
  readonly drawOrder: readonly { readonly drawableId: string; readonly drawOrder: number }[];
}

const createFinalPackageDocument = (baselinePackage: PackageDocumentDto): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    ...baselinePackage,
    manifest: {
      ...baselinePackage.manifest,
      packageRevision: 3,
      updatedAt: CREATED_AT
    },
    model: {
      ...baselinePackage.model,
      graph: {
        ...baselinePackage.model.graph,
        parts: [
          {
            partId: "part_root",
            displayName: "Root",
            childPartIds: [],
            drawableIds: ["draw_wave29_mesh"]
          }
        ],
        stableOrder: ["part_root", "draw_wave29_mesh"]
      },
      drawables: {
        ...baselinePackage.model.drawables,
        drawables: [
          {
            drawableId: "draw_wave29_mesh",
            displayName: "Wave29 Mesh",
            partId: "part_root",
            sourceAssetId: "src_wave29_generated",
            textureId: "tex_wave29_mesh",
            meshId: "mesh_wave29_mesh",
            defaultOpacity: 1,
            runtimeVisibility: true,
            baseDrawOrder: 0,
            sourceProvenanceId: "prov_wave29_create_drawable"
          }
        ]
      },
      meshes: {
        ...baselinePackage.model.meshes,
        meshes: [
          {
            meshId: "mesh_wave29_mesh",
            drawableId: "draw_wave29_mesh",
            vertices: [
              { x: 48, y: 16 },
              { x: 74, y: 12 },
              { x: 42, y: 45 },
              { x: 72, y: 40 }
            ],
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 },
              { x: 1, y: 1 }
            ],
            triangles: [
              [0, 1, 2],
              [1, 3, 2]
            ],
            vertexStableIds: [
              "vtx_wave29_mesh_0_0",
              "vtx_wave29_mesh_0_1",
              "vtx_wave29_mesh_1_0",
              "vtx_wave29_mesh_1_1"
            ],
            bounds: {
              x: 42,
              y: 12,
              width: 32,
              height: 33
            },
            generationProvenanceId: "prov_wave29_generate_mesh"
          }
        ]
      },
      drawOrder: {
        ...baselinePackage.model.drawOrder,
        entries: [
          {
            drawableId: "draw_wave29_mesh",
            baseDrawOrder: 0,
            stableOrder: 0
          }
        ]
      }
    },
    assets: {
      ...baselinePackage.assets,
      sourceManifest: {
        ...baselinePackage.assets.sourceManifest,
        sourceAssets: baselinePackage.assets.sourceManifest.sourceAssets.map((sourceAsset) => ({
          ...sourceAsset,
          layers: sourceAsset.layers.map((layer) => ({
            ...layer,
            mappedDrawableIds: ["draw_wave29_mesh"]
          }))
        }))
      },
      provenance: {
        ...baselinePackage.assets.provenance,
        records: [
          ...baselinePackage.assets.provenance.records,
          {
            provenanceId: "prov_wave29_create_drawable",
            assetId: "src_wave29_generated",
            assetKind: "generatedFixture",
            filePath: "assets/sources/wave29-mesh-source.json",
            contentHash: "sha256:wave29-generated-source",
            creator: "human",
            license: "internal-authoring-generated",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: ["createDrawable:manual-empty-mesh"],
            relatedOperationIds: ["op_wave29_create_drawable"]
          },
          {
            provenanceId: "prov_wave29_generate_mesh",
            assetId: "mesh_wave29_mesh",
            assetKind: "generatedFixture",
            filePath: "model/meshes/mesh_wave29_mesh.generated.json",
            creator: "human",
            license: "internal-authoring-generated",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: ["generateMesh:auto-grid-v1"],
            relatedOperationIds: ["op_wave29_generate_mesh"]
          }
        ]
      }
    }
  });

const createInvalidTopologyPackage = (finalPackage: PackageDocumentDto): PackageDocumentDto => {
  const invalidPackage = clonePackageDocument(finalPackage);
  const mesh = invalidPackage.model.meshes.meshes[0];

  if (mesh === undefined) {
    throw new Error("Expected final Wave29 package to contain one mesh.");
  }

  invalidPackage.model.meshes.meshes[0] = {
    ...mesh,
    uvs: mesh.uvs.slice(0, 3),
    vertexStableIds: mesh.vertexStableIds.slice(0, 3),
    triangles: [
      [0, 1, 9],
      [1, 3, 3]
    ]
  };

  return PackageDocumentSchema.parse(invalidPackage);
};

const summarizeValidationReport = (report: ValidationReportDto) => ({
  reportId: report.reportId,
  profile: report.profile,
  status: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  counts: report.summary.counts,
  runtimeSnapshotIds: report.evidence.runtimeSnapshotIds,
  checks: report.checks.map((check) => ({
    checkId: check.checkId,
    status: check.status,
    severity: check.severity,
    targetPath: check.targetPath ?? null,
    evidence: check.evidence
  }))
});

const pinReportId = (
  report: ValidationReportDto,
  reportId: string
): ValidationReportDto =>
  ValidationReportSchema.parse({
    ...report,
    reportId
  });

const createRuntimeGraphFromFixture = (fixture: unknown): NormalizedRuntimeGraph => {
  const parsed = fixture as RuntimeGraphFixture;

  return {
    packageId: PackageIdSchema.parse(parsed.packageId),
    packageRevision: parsed.packageRevision,
    ...(parsed.packageHash === undefined ? {} : { packageHash: parsed.packageHash }),
    coordinateSystem: parsed.coordinateSystem,
    parameters: new Map(),
    parts: new Map(parsed.parts.map((part) => [PartIdSchema.parse(part.partId), createPart(part)])),
    dynamicsGroups: new Map(),
    drawables: new Map(parsed.drawables.map((drawable) => createDrawableEntry(drawable))),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder: parsed.drawOrder.map((entry) => ({
      drawableId: DrawableIdSchema.parse(entry.drawableId),
      drawOrder: entry.drawOrder
    })),
    disabledFutureLayers: []
  };
};

const createPart = (part: NormalizedPart): NormalizedPart => ({
  partId: PartIdSchema.parse(part.partId),
  displayName: part.displayName,
  ...(part.parentPartId === undefined ? {} : { parentPartId: PartIdSchema.parse(part.parentPartId) }),
  childPartIds: part.childPartIds.map((partId) => PartIdSchema.parse(partId)),
  drawableIds: part.drawableIds.map((drawableId) => DrawableIdSchema.parse(drawableId))
});

const createDrawableEntry = (
  drawable: NormalizedDrawable
): readonly [NormalizedDrawable["drawableId"], NormalizedDrawable] => {
  const drawableId = DrawableIdSchema.parse(drawable.drawableId);

  return [
    drawableId,
    {
      ...drawable,
      drawableId,
      meshId: MeshIdSchema.parse(drawable.meshId),
      ...(drawable.partId === undefined ? {} : { partId: PartIdSchema.parse(drawable.partId) })
    }
  ];
};

const clonePackageDocument = (document: PackageDocumentDto): PackageDocumentDto =>
  JSON.parse(JSON.stringify(document)) as PackageDocumentDto;

const loadBaselinePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json"));

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave29-mesh-edit-contract-fixtures"
);
