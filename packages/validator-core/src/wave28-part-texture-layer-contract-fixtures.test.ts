import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";
import { PackageDocumentSchema } from "@private-2d-rigging-lab/package-format";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  NormalizedDrawable,
  NormalizedPart,
  NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import {
  validatePackageRuntime,
  ValidationReportSchema
} from "./index.js";
import type { ValidationReportDto } from "./index.js";

const CREATED_AT = "2026-06-01T00:00:00.000Z";

describe("wave28 part, texture, and layer validator fixture", () => {
  it("pins the valid final report and invalid part/texture diagnostics", () => {
    const finalPackage = createFinalPackageDocument(loadBaselinePackageDocument());
    const viewerResult = evaluateViewerRuntimeSnapshot(
      createRuntimeGraphFromFixture(loadFixtureJson("runtime/final-runtime-graph.json") as RuntimeGraphFixture),
      {
        baselineFrameIndex: 10,
        frameIndex: 11,
        operationId: "op_wave28_viewer_contract_evidence",
        strictness: "strict",
        targetIds: ["draw_body", "draw_eye", "part_face"]
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
      "val_wave28_part_texture_layer_valid_final"
    );
    const invalidMissingPartReport = pinReportId(
      validatePackageRuntime({
        packageDocument: createInvalidMissingPartPackage(finalPackage),
        profile: "strict",
        createdAt: CREATED_AT
      }),
      "val_wave28_part_texture_layer_invalid_missing_part"
    );
    const invalidMissingTextureReport = pinReportId(
      validatePackageRuntime({
        packageDocument: createInvalidMissingTexturePackage(finalPackage),
        profile: "strict",
        createdAt: CREATED_AT
      }),
      "val_wave28_part_texture_layer_invalid_missing_texture"
    );

    expect({
      schemaVersion: "wave28-part-texture-layer-validation-report-summary-v1",
      validFinal: summarizeValidationReport(validFinalReport),
      invalidMissingPart: summarizeValidationReport(invalidMissingPartReport),
      invalidMissingTexture: summarizeValidationReport(invalidMissingTextureReport)
    }).toEqual(loadFixtureJson("expected/validation-report-summary.json"));
  });
});

const createFinalPackageDocument = (baselinePackage: PackageDocumentDto): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    ...baselinePackage,
    manifest: {
      ...baselinePackage.manifest,
      packageRevision: 4,
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
            childPartIds: ["part_face"],
            drawableIds: ["draw_body"]
          },
          {
            partId: "part_face",
            displayName: "Face Controls",
            parentPartId: "part_root",
            childPartIds: [],
            drawableIds: ["draw_eye"]
          }
        ],
        stableOrder: ["part_root", "draw_body", "draw_eye", "part_face"]
      },
      drawables: {
        ...baselinePackage.model.drawables,
        drawables: baselinePackage.model.drawables.drawables.map((drawable) =>
          drawable.drawableId === "draw_eye"
            ? {
                ...drawable,
                partId: "part_face",
                textureId: "tex_eye_alt"
              }
            : drawable
        )
      }
    }
  });

const createInvalidMissingPartPackage = (finalPackage: PackageDocumentDto): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    ...finalPackage,
    model: {
      ...finalPackage.model,
      graph: {
        ...finalPackage.model.graph,
        parts: finalPackage.model.graph.parts.map((part) =>
          part.partId === "part_face"
            ? {
                ...part,
                drawableIds: []
              }
            : part
        )
      },
      drawables: {
        ...finalPackage.model.drawables,
        drawables: finalPackage.model.drawables.drawables.map((drawable) =>
          drawable.drawableId === "draw_eye"
            ? {
                ...drawable,
                partId: "part_missing"
              }
            : drawable
        )
      }
    }
  });

const createInvalidMissingTexturePackage = (finalPackage: PackageDocumentDto): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    ...finalPackage,
    assets: {
      ...finalPackage.assets,
      textureAtlas: {
        ...finalPackage.assets.textureAtlas!,
        textures: finalPackage.assets.textureAtlas!.textures.filter((texture) => texture.textureId !== "tex_eye_alt")
      }
    }
  });

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

interface RuntimeGraphFixture {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly coordinateSystem: "canvas-y-down-v1";
  readonly parts: readonly NormalizedPart[];
  readonly drawables: readonly NormalizedDrawable[];
  readonly drawOrder: readonly { readonly drawableId: string; readonly drawOrder: number }[];
}

const createRuntimeGraphFromFixture = (fixture: RuntimeGraphFixture): NormalizedRuntimeGraph => ({
  packageId: PackageIdSchema.parse(fixture.packageId),
  packageRevision: fixture.packageRevision,
  ...(fixture.packageHash === undefined ? {} : { packageHash: fixture.packageHash }),
  coordinateSystem: fixture.coordinateSystem,
  parameters: new Map(),
  parts: new Map(fixture.parts.map((part) => [PartIdSchema.parse(part.partId), createPart(part)])),
  dynamicsGroups: new Map(),
  drawables: new Map(fixture.drawables.map((drawable) => createDrawableEntry(drawable))),
  rigControls: new Map(),
  keyformBindings: [],
  masks: [],
  drawOrder: fixture.drawOrder.map((entry) => ({
    drawableId: DrawableIdSchema.parse(entry.drawableId),
    drawOrder: entry.drawOrder
  })),
  disabledFutureLayers: []
});

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
      ...(drawable.partId === undefined ? {} : { partId: PartIdSchema.parse(drawable.partId) }),
      ...(drawable.texture === undefined
        ? {}
        : {
            texture: {
              ...drawable.texture,
              ...(drawable.texture.textureId === undefined ? {} : { textureId: TextureIdSchema.parse(drawable.texture.textureId) }),
              ...(drawable.texture.sourceAssetId === undefined ? {} : { sourceAssetId: SourceAssetIdSchema.parse(drawable.texture.sourceAssetId) })
            }
          })
    }
  ];
};

const loadBaselinePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json"));

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave28-part-texture-layer-contract-fixtures"
);
