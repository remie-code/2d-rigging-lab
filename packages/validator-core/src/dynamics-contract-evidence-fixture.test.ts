import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DynamicsGroupIdSchema,
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import { buildRuntimeEvidence } from "@private-2d-rigging-lab/runtime-core";
import type {
  KeyformBinding,
  NormalizedDrawable,
  NormalizedDynamicsGroup,
  NormalizedParameter,
  NormalizedRuntimeGraph,
  RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { buildValidationDiff } from "./validation-diff-builder.js";
import { ValidationReportSchema } from "./validation-report.js";
import type {
  ValidationCheckResultDto,
  ValidationReportDto
} from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-05-31T00:00:00.000Z";
const PACKAGE_HASH = "sha256:minimum-open-dynamics-v1-evidence";
const ARTIFACT_LABEL = "minimum-open-dynamics-v1-evidence";
const DRIVER_PARAMETER_ID = "param_face_yaw";
const OUTPUT_PARAMETER_ID = "param_hair_sway";
const DRAWABLE_ID = "draw_hair";
const MESH_ID = "mesh_hair";

describe("minimum-open-dynamics-v1-evidence validator contract fixture", () => {
  it("reports the fixture baseline failures and candidate pass deterministically", () => {
    const runtimeEvidence = buildFixtureRuntimeEvidence();
    const baselineReport = withReportEvidence(
      validatePackageRuntime({
        packageDocument: loadBaselinePackage(),
        runtimeSnapshot: runtimeEvidence.baselineSnapshot,
        createdAt: CREATED_AT
      }),
      {
        reportId: "val_minimum_open_dynamics_v1_baseline",
        operationLogPresent: false
      }
    );
    const candidateReport = withReportEvidence(
      validatePackageRuntime({
        packageDocument: createCandidatePackage(),
        runtimeSnapshot: runtimeEvidence.candidateSnapshot,
        createdAt: CREATED_AT
      }),
      {
        reportId: "val_minimum_open_dynamics_v1_candidate",
        operationLogPresent: true,
        operationLogPath: "operations/log.jsonl"
      }
    );
    const validationDiff = buildValidationDiff({
      baseline: baselineReport,
      candidate: candidateReport
    });

    expect({
      schemaVersion: "minimum-open-dynamics-validation-report-summary-v1",
      baseline: summarizeReport(baselineReport),
      candidate: summarizeReport(candidateReport),
      validationDiff: {
        schemaVersion: validationDiff.schemaVersion,
        beforeReportId: validationDiff.beforeReportId,
        afterReportId: validationDiff.afterReportId,
        newFailureCount: validationDiff.newFailures.length,
        resolvedFailureCount: validationDiff.resolvedFailures.length,
        severityChangeCount: validationDiff.severityChanges.length
      }
    }).toEqual(loadFixtureJson("expected/validation-report-summary.json"));
  });

  it("pins Domain C residual dynamics diagnostics against the contract fixture", () => {
    const runtimeEvidence = buildFixtureRuntimeEvidence();
    const validPackage = createCandidatePackage();
    const validSnapshot = runtimeEvidence.candidateSnapshot;
    const actual = {
      schemaVersion: "minimum-open-dynamics-validator-edge-diagnostics-summary-v1",
      cases: [
        summarizeCase(
          "duplicate-output-target",
          validatePackageRuntime({
            packageDocument: withDynamicsGroups(validPackage, [
              createPackageDynamicsGroup(),
              {
                ...createPackageDynamicsGroup(),
                dynamicsGroupId: "dyn_hair_sway_duplicate",
                displayName: "Hair Sway Duplicate",
                enabled: false,
                output: {
                  ...createPackageDynamicsGroup().output,
                  outputId: "output_hair_sway_duplicate"
                }
              }
            ]),
            runtimeSnapshot: validSnapshot,
            createdAt: CREATED_AT
          }).checks
        ),
        summarizeCase(
          "wrong-source-type",
          validatePackageRuntime({
            packageDocument: withParameters(
              withDynamicsGroups(validPackage, [
                {
                  ...createPackageDynamicsGroup(),
                  drivers: [
                    {
                      driverId: "driver_debug_override",
                      sourceParameterId: "param_debug_override",
                      inputScale: 1,
                      inputOffset: 0,
                      invert: false
                    }
                  ]
                }
              ]),
              [
                ...validPackage.model.parameters.parameters,
                {
                  parameterId: "param_debug_override",
                  displayName: "Debug Override",
                  semanticRole: "custom",
                  valueSource: "debugOverride",
                  min: -1,
                  max: 1,
                  default: 0,
                  recommendedUiStep: 0.01
                }
              ]
            ),
            runtimeSnapshot: validSnapshot,
            createdAt: CREATED_AT
          }).checks
        ),
        summarizeCase(
          "output-as-driver",
          validatePackageRuntime({
            packageDocument: withDynamicsGroups(validPackage, [
              {
                ...createPackageDynamicsGroup(),
                drivers: [
                  {
                    driverId: "driver_hair_sway",
                    sourceParameterId: OUTPUT_PARAMETER_ID,
                    inputScale: 1,
                    inputOffset: 0,
                    invert: false
                  }
                ]
              }
            ]),
            runtimeSnapshot: validSnapshot,
            createdAt: CREATED_AT
          }).checks
        ),
        summarizeCase(
          "runtime-output-parameter-mismatch",
          validatePackageRuntime({
            packageDocument: validPackage,
            runtimeSnapshot: withRuntimeDynamics(validSnapshot, {
              outputParameterId: "param_other_output"
            }),
            createdAt: CREATED_AT
          }).checks
        ),
        summarizeCase(
          "runtime-output-out-of-range",
          validatePackageRuntime({
            packageDocument: validPackage,
            runtimeSnapshot: withRuntimeDynamics(validSnapshot, {
              outputValue: 2
            }),
            createdAt: CREATED_AT
          }).checks
        ),
        summarizeCase(
          "runtime-output-clamped",
          validatePackageRuntime({
            packageDocument: validPackage,
            runtimeSnapshot: withRuntimeDynamics(validSnapshot, {
              debug: {
                ...validSnapshot.dynamics[0]?.debug,
                outputClamped: true
              }
            }),
            createdAt: CREATED_AT
          }).checks
        )
      ]
    };

    expect(actual).toEqual(loadFixtureJson("expected/validation-edge-diagnostics-summary.json"));
  });
});

const summarizeReport = (report: ValidationReportDto) => ({
  reportId: report.reportId,
  status: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  counts: report.summary.counts,
  checkIds: report.checks.map((check) => check.checkId),
  runtimeSnapshotIds: report.evidence.runtimeSnapshotIds,
  operationLogPresent: report.evidence.operationLogPresent,
  ...(report.evidence.operationLogPath === undefined ? {} : { operationLogPath: report.evidence.operationLogPath })
});

const summarizeCase = (
  caseId: string,
  checks: readonly ValidationCheckResultDto[]
) => ({
  caseId,
  checks: checks.map((check) => ({
    checkId: check.checkId,
    targetId: check.target.id,
    targetPath: check.targetPath,
    evidence: check.evidence
  }))
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

const createCandidatePackage = () =>
  withDynamicsGroups(
    {
      ...loadBaselinePackage(),
      manifest: {
        ...loadBaselinePackage().manifest,
        packageRevision: 1,
        updatedAt: CREATED_AT
      }
    },
    [createPackageDynamicsGroup()]
  );

const withDynamicsGroups = (
  packageDocument: any,
  dynamicsGroups: readonly any[]
) => ({
  ...packageDocument,
  model: {
    ...packageDocument.model,
    graph: {
      ...packageDocument.model.graph,
      stableOrder: [
        ...packageDocument.model.graph.stableOrder.filter((id: string) => !id.startsWith("dyn_")),
        ...dynamicsGroups.map((group) => group.dynamicsGroupId)
      ]
    },
    dynamics: {
      ...packageDocument.model.dynamics,
      dynamicsGroups
    }
  }
});

const withParameters = (
  packageDocument: any,
  parameters: readonly any[]
) => ({
  ...packageDocument,
  model: {
    ...packageDocument.model,
    parameters: {
      ...packageDocument.model.parameters,
      parameters
    }
  }
});

const withRuntimeDynamics = (
  snapshot: RuntimeSnapshotDto,
  overrides: Record<string, unknown>
): RuntimeSnapshotDto => ({
  ...snapshot,
  dynamics: [
    {
      ...snapshot.dynamics[0],
      ...overrides
    } as RuntimeSnapshotDto["dynamics"][number]
  ]
});

const buildFixtureRuntimeEvidence = () => {
  const baselinePackage = loadBaselinePackage();
  const request = loadFixtureJson("request/create-dynamics-group-commit.request.json");
  const baselineGraph = createRuntimeGraphFromPackage(baselinePackage, []);
  const candidateGraph = createRuntimeGraphFromPackage(
    {
      ...baselinePackage,
      manifest: {
        ...baselinePackage.manifest,
        packageRevision: 1
      }
    },
    [createRuntimeDynamicsGroup(request.payload)]
  );

  return buildRuntimeEvidence({
    baselineGraph,
    candidateGraph,
    baseline: createEvaluationInput(0),
    candidate: createEvaluationInput(1),
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    },
    context: {
      source: { surface: "validator", operationId: request.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: ARTIFACT_LABEL
  });
};

const createEvaluationInput = (frameIndex: number) => ({
  frame: {
    frameIndex,
    deltaTimeMs: 16.6666667,
    authoredParameterValues: {
      [DRIVER_PARAMETER_ID]: 1
    },
    targetIds: [OUTPUT_PARAMETER_ID, DRAWABLE_ID, MESH_ID]
  }
});

const createPackageDynamicsGroup = () => {
  const request = loadFixtureJson("request/create-dynamics-group-commit.request.json");
  return structuredClone(request.payload);
};

const createRuntimeGraphFromPackage = (
  packageDocument: any,
  dynamicsGroups: readonly NormalizedDynamicsGroup[]
): NormalizedRuntimeGraph => {
  const drawablesById = new Map(
    packageDocument.model.drawables.drawables.map((drawable: any) => [drawable.drawableId, drawable])
  );
  const meshesByDrawableId = new Map(
    packageDocument.model.meshes.meshes.map((mesh: any) => [mesh.drawableId, mesh])
  );

  return {
    packageId: PackageIdSchema.parse(packageDocument.manifest.packageId),
    packageRevision: packageDocument.manifest.packageRevision,
    packageHash: PACKAGE_HASH,
    coordinateSystem: packageDocument.model.graph.coordinateSystem,
    parameters: new Map(
      packageDocument.model.parameters.parameters.map((parameter: any) => createParameterEntry(parameter))
    ),
    dynamicsGroups: new Map(dynamicsGroups.map((group) => [group.dynamicsGroupId, group])),
    drawables: new Map(
      [...drawablesById.values()].map((drawable: any) =>
        createDrawableEntry(drawable, meshesByDrawableId.get(drawable.drawableId))
      )
    ),
    rigControls: new Map(),
    keyformBindings: packageDocument.model.keyforms.keyformSets.map((keyformSet: any) =>
      createKeyformBinding(keyformSet)
    ),
    masks: [],
    drawOrder: packageDocument.model.drawOrder.entries.map((entry: any) => ({
      drawableId: DrawableIdSchema.parse(entry.drawableId),
      drawOrder: entry.baseDrawOrder
    })),
    disabledFutureLayers: []
  };
};

const createParameterEntry = (
  parameter: any
): readonly [NormalizedParameter["id"], NormalizedParameter] => {
  const parameterId = ParameterIdSchema.parse(parameter.parameterId);

  return [
    parameterId,
    {
      id: parameterId,
      displayName: parameter.displayName,
      semanticRole: parameter.semanticRole,
      valueSource: parameter.valueSource,
      min: parameter.min,
      max: parameter.max,
      default: parameter.default
    }
  ];
};

const createDrawableEntry = (
  drawable: any,
  mesh: any
): readonly [DrawableId, NormalizedDrawable] => {
  const drawableId = DrawableIdSchema.parse(drawable.drawableId);

  return [
    drawableId,
    {
      drawableId,
      meshId: MeshIdSchema.parse(drawable.meshId),
      visible: drawable.runtimeVisibility,
      opacity: drawable.defaultOpacity,
      baseDrawOrder: drawable.baseDrawOrder,
      bounds: mesh.bounds,
      vertices: mesh.vertices,
      vertexCount: mesh.vertices.length
    }
  ];
};

const createRuntimeDynamicsGroup = (payload: any): NormalizedDynamicsGroup => ({
  dynamicsGroupId: DynamicsGroupIdSchema.parse(payload.dynamicsGroupId),
  displayName: payload.displayName,
  enabled: payload.enabled,
  solverKind: payload.solverKind,
  drivers: payload.drivers.map((driver: any) => ({
    driverId: driver.driverId,
    sourceParameterId: ParameterIdSchema.parse(driver.sourceParameterId),
    inputScale: driver.inputScale,
    inputOffset: driver.inputOffset,
    invert: driver.invert
  })),
  output: {
    outputId: payload.output.outputId,
    targetParameterId: ParameterIdSchema.parse(payload.output.targetParameterId),
    outputScale: payload.output.outputScale,
    outputOffset: payload.output.outputOffset,
    min: payload.output.min,
    max: payload.output.max,
    clampPolicy: payload.output.clampPolicy
  },
  settings: payload.settings,
  resetPolicy: payload.resetPolicy
});

const createKeyformBinding = (keyformSet: any): KeyformBinding => ({
  evaluator: keyformSet.evaluator,
  keyformSetId: KeyformSetIdSchema.parse(keyformSet.keyformSetId),
  targetId: keyformSet.target.id,
  targetKind: keyformSet.target.kind === "mesh" || keyformSet.target.kind === "rigControl"
    ? keyformSet.target.kind
    : "drawable",
  targetProperty: keyformSet.target.property,
  parameterId: ParameterIdSchema.parse(keyformSet.parameterId),
  keys: keyformSet.keys,
  compositionMode: keyformSet.compositionMode,
  compositionOrder: keyformSet.compositionOrder
});

const loadBaselinePackage = (): any => loadFixtureJson("baseline-package.json");

const loadFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/minimum-open-dynamics-v1-evidence"
);
