import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import { buildRuntimeEvidence } from "@private-2d-rigging-lab/runtime-core";
import type {
  NormalizedDrawable,
  NormalizedRigControlNode,
  NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { ValidationReportSchema } from "./validation-report.js";
import type {
  ValidationCheckResultDto,
  ValidationReportDto
} from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-06-01T00:00:00.000Z";
const PARENT_FIXTURE_ID = "parent-child-rigControl-diagonal";
const INVALID_FIXTURE_ID = "invalid-rigControl-cycle";

describe("rig control contract evidence fixtures", () => {
  it("validates parent-child-rigControl-diagonal with runtime hierarchy evidence", () => {
    const runtimeEvidence = buildParentFixtureRuntimeEvidence();
    const report = withReportEvidence(
      validatePackageRuntime({
        packageDocument: createParentCandidatePackage(),
        runtimeSnapshot: runtimeEvidence.candidateSnapshot,
        createdAt: CREATED_AT
      }),
      {
        reportId: "val_parent_child_rigcontrol_diagonal_candidate",
        operationLogPresent: true,
        operationLogPath: "operations/log.jsonl"
      }
    );

    expect(summarizeReport(report)).toEqual(
      loadParentFixtureJson("expected/validation-report-summary.json")
    );
  });

  it("blocks invalid-rigControl-cycle with a deterministic formal diagnostic and no runtime evaluation", () => {
    const report = validatePackageRuntime({
      packageDocument: loadInvalidFixtureJson("package.json"),
      createdAt: CREATED_AT
    });

    expect(summarizeReport(report)).toEqual(
      loadInvalidFixtureJson("expected/validation-report-summary.json")
    );
    expect({
      schemaVersion: "invalid-rigControl-cycle-expected-diagnostics-v1",
      diagnostics: report.checks.map(toDiagnosticSummary)
    }).toEqual(loadInvalidFixtureJson("expected/expected-diagnostics.json"));
    expect(loadInvalidFixtureJson("expected/runtime-blocking-summary.json")).toEqual({
      schemaVersion: "invalid-rigControl-cycle-runtime-blocking-summary-v1",
      fixtureId: INVALID_FIXTURE_ID,
      topologicalEvaluation: "blocked",
      blockingCheckId: "rigControl.cycle",
      generatedRuntimeSnapshotIds: [],
      runtimeDiff: null
    });
  });
});

const summarizeReport = (report: ValidationReportDto) => ({
  schemaVersion: report.packageId === "pkg_invalid_rigcontrol_cycle"
    ? "invalid-rigControl-cycle-validation-report-summary-v1"
    : "parent-child-rigControl-validation-report-summary-v1",
  reportId: report.reportId,
  status: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  counts: report.summary.counts,
  checkIds: report.checks.map((check) => check.checkId),
  runtimeSnapshotIds: report.evidence.runtimeSnapshotIds,
  operationLogPresent: report.evidence.operationLogPresent,
  ...(report.evidence.operationLogPath === undefined ? {} : { operationLogPath: report.evidence.operationLogPath })
});

const toDiagnosticSummary = (check: ValidationCheckResultDto) => ({
  checkId: check.checkId,
  targetId: check.target.id,
  targetPath: check.targetPath,
  severity: check.severity,
  evidence: check.evidence
});

const withReportEvidence = (
  report: ValidationReportDto,
  evidence: {
    readonly reportId: string;
    readonly operationLogPresent: boolean;
    readonly operationLogPath?: string;
  }
): ValidationReportDto =>
  ValidationReportSchema.parse({
    ...report,
    reportId: evidence.reportId,
    evidence: {
      ...report.evidence,
      operationLogPresent: evidence.operationLogPresent,
      ...(evidence.operationLogPath === undefined ? {} : { operationLogPath: evidence.operationLogPath })
    }
  });

const buildParentFixtureRuntimeEvidence = () => {
  const fixtureGraph = loadParentFixtureJson("runtime/runtime-graph.json");
  const candidateGraph = createRuntimeGraphFromFixture(fixtureGraph);
  const baselineGraph: NormalizedRuntimeGraph = {
    ...candidateGraph,
    packageRevision: 0,
    rigControls: new Map()
  };

  return buildRuntimeEvidence({
    baselineGraph,
    candidateGraph,
    baseline: {
      frame: createEvaluationFrame(0)
    },
    candidate: {
      frame: createEvaluationFrame(1)
    },
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    },
    context: {
      source: { surface: "validator", operationId: "op_fixture_bind_arm_drawable" },
      policy: { strictness: "strict" }
    },
    artifactLabel: PARENT_FIXTURE_ID
  });
};

const createEvaluationFrame = (frameIndex: number) => ({
  frameIndex,
  deltaTimeMs: 0,
  authoredParameterValues: {},
  targetIds: ["draw_arm", "rig_body_rotation", "rig_arm_rotation"]
});

const createParentCandidatePackage = () => {
  const baseline = loadParentFixtureJson("baseline-package.json");
  return {
    ...baseline,
    manifest: {
      ...baseline.manifest,
      packageRevision: 4,
      updatedAt: CREATED_AT
    },
    model: {
      ...baseline.model,
      graph: {
        ...baseline.model.graph,
        rigControlRootIds: ["rig_body_rotation"],
        stableOrder: [
          "draw_arm",
          "rig_body_rotation",
          "rig_arm_rotation"
        ]
      },
      rigControls: {
        schemaVersion: "rig-controls-file-v1",
        rigControls: [
          {
            kind: "rotation2d",
            rigControlId: "rig_body_rotation",
            displayName: "Body Rotation",
            partId: "part_root",
            childDrawableIds: [],
            childRigControlIds: ["rig_arm_rotation"],
            pivot: { x: 0, y: 0 },
            restAngleDegrees: 30,
            restTranslation: { x: 0, y: 0 },
            restScale: { x: 1, y: 1 },
            enabled: true
          },
          {
            kind: "rotation2d",
            rigControlId: "rig_arm_rotation",
            displayName: "Arm Rotation",
            partId: "part_root",
            parentId: "rig_body_rotation",
            childDrawableIds: ["draw_arm"],
            childRigControlIds: [],
            pivot: { x: 0, y: 0 },
            restAngleDegrees: 15,
            restTranslation: { x: 0, y: 0 },
            restScale: { x: 1, y: 1 },
            enabled: true
          }
        ]
      }
    }
  };
};

const createRuntimeGraphFromFixture = (fixture: any): NormalizedRuntimeGraph => ({
  packageId: PackageIdSchema.parse(fixture.packageId),
  packageRevision: fixture.packageRevision,
  packageHash: fixture.packageHash,
  coordinateSystem: fixture.coordinateSystem,
  parameters: new Map(),
  dynamicsGroups: new Map(),
  drawables: new Map(fixture.drawables.map((drawable: any) => createDrawableEntry(drawable))),
  rigControls: new Map(fixture.rigControls.map((rigControl: any) => createRigControlEntry(rigControl))),
  keyformBindings: [],
  masks: [],
  drawOrder: fixture.drawOrder,
  disabledFutureLayers: []
});

const createDrawableEntry = (
  drawable: any
): readonly [NormalizedDrawable["drawableId"], NormalizedDrawable] => {
  const drawableId = DrawableIdSchema.parse(drawable.drawableId);

  return [
    drawableId,
    {
      drawableId,
      meshId: MeshIdSchema.parse(drawable.meshId),
      visible: drawable.visible,
      opacity: drawable.opacity,
      baseDrawOrder: drawable.baseDrawOrder,
      bounds: drawable.bounds,
      vertices: drawable.vertices,
      ...(drawable.uvs === undefined ? {} : { uvs: drawable.uvs }),
      ...(drawable.triangles === undefined ? {} : { triangles: drawable.triangles }),
      ...(drawable.vertexStableIds === undefined ? {} : { vertexStableIds: drawable.vertexStableIds }),
      ...(drawable.triangleStableIds === undefined ? {} : { triangleStableIds: drawable.triangleStableIds }),
      ...(drawable.topologyRevision === undefined ? {} : { topologyRevision: drawable.topologyRevision }),
      vertexCount: drawable.vertices.length
    }
  ];
};

const createRigControlEntry = (
  rigControl: any
): readonly [NormalizedRigControlNode["rigControlId"], NormalizedRigControlNode] => {
  const rigControlId = RigControlIdSchema.parse(rigControl.rigControlId);

  return [
    rigControlId,
    {
      ...rigControl,
      rigControlId,
      ...(rigControl.parentId === undefined
        ? {}
        : { parentId: RigControlIdSchema.parse(rigControl.parentId) }),
      childDrawableIds: rigControl.childDrawableIds.map((drawableId: string) => DrawableIdSchema.parse(drawableId)),
      childRigControlIds: rigControl.childRigControlIds.map((childRigControlId: string) =>
        RigControlIdSchema.parse(childRigControlId)
      )
    }
  ];
};

const loadParentFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(parentFixtureRootDirectory, relativePath), "utf8"));

const loadInvalidFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(invalidFixtureRootDirectory, relativePath), "utf8"));

const parentFixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/parent-child-rigControl-diagonal"
);

const invalidFixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/invalid-rigControl-cycle"
);
