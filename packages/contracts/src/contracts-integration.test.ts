import { describe, expect, it } from "vitest";

import {
  CheckIdSchema,
  CodexProposalOperationCatalogDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  DiagnosticSchema,
  FieldChangeSchema,
  JsonValueSchema,
  ModelDiffSchema,
  PACKAGE_TRANSPORT_CAPABILITY_CATALOG,
  PackageIdSchema,
  PackageTransportCapabilityCatalogDtoSchema,
  RectDtoSchema,
  RuntimeDiffSchema,
  RuntimeEvaluationContextSchema,
  RuntimeSequenceFrameSchema,
  RuntimeSourceSurfaceSchema,
  RuntimeStateArtifactRefSchema,
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactSchema,
  RuntimeStateSequenceArtifactRefSchema,
  SeveritySchema,
  TargetRefSchema,
  Transform2DDtoSchema,
  ValidationDiffSchema,
  Vec2DtoSchema,
  contractsPackageInfo
} from "./index.js";
import type {
  Brand,
  DiagnosticDto,
  ModelDiffDto,
  PackageId,
  RuntimeDiffDto,
  RuntimeStateDto,
  ValidationDiffDto,
  Vec2Dto
} from "./index.js";

const runtimeState = {
  schemaVersion: "runtime-state-v1",
  packageId: "pkg_integration",
  packageRevision: 1,
  frameIndex: 0,
  fixedStepMs: 16.6667,
  accumulatorMs: 0,
  dynamicsGroups: {
    dyn_hairSway: {
      particles: [{ x: 0, y: 14, px: 0, py: 14 }],
      tick: 0,
      resetCounter: 0
    }
  }
} as const;

describe("contracts public surface integration", () => {
  it("exports package metadata, branded IDs, primitives, and enums", () => {
    const packageId: PackageId = PackageIdSchema.parse("pkg_integration");
    const brandedPackageId: Brand<string, "PackageId"> = packageId;
    const vec2: Vec2Dto = Vec2DtoSchema.parse({ x: 1, y: -1 });

    expect(contractsPackageInfo.moduleId).toBe("contracts");
    expect(brandedPackageId).toBe("pkg_integration");
    expect(vec2).toEqual({ x: 1, y: -1 });
    expect(RectDtoSchema.parse({ x: 0, y: 0, width: 10, height: 20 })).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 20
    });
    expect(
      Transform2DDtoSchema.parse({
        translation: { x: 0, y: 1 },
        rotationDegrees: 15,
        scale: { x: 1, y: 1 }
      })
    ).toEqual({
      translation: { x: 0, y: 1 },
      rotationDegrees: 15,
      scale: { x: 1, y: 1 }
    });
    expect(SeveritySchema.parse("blocking")).toBe("blocking");
    expect(RuntimeSourceSurfaceSchema.parse("validator")).toBe("validator");
  });

  it("exports diagnostic schemas", () => {
    const diagnostic: DiagnosticDto = DiagnosticSchema.parse({
      checkId: CheckIdSchema.parse("runtime.stateSequenceLengthMismatch"),
      status: "fail",
      severity: "error",
      phase: "validation",
      target: TargetRefSchema.parse({
        kind: "runtimeSnapshot",
        id: "snap_before"
      }),
      message: "State sequence length does not match frame count."
    });

    expect(diagnostic).toEqual({
      checkId: "runtime.stateSequenceLengthMismatch",
      status: "fail",
      severity: "error",
      phase: "validation",
      target: {
        kind: "runtimeSnapshot",
        id: "snap_before"
      },
      message: "State sequence length does not match frame count.",
      evidence: [],
      relatedAC: [],
      relatedScenarios: [],
      repairCandidateIds: []
    });
  });

  it("exports runtime artifact refs, state, and sequence contracts", () => {
    const state: RuntimeStateDto = RuntimeStateDtoSchema.parse(runtimeState);

    expect(RuntimeStateArtifactRefSchema.parse("runtime/states/integration.runtime-state.json")).toBe(
      "runtime/states/integration.runtime-state.json"
    );
    expect(
      RuntimeStateSequenceArtifactRefSchema.parse(
        "runtime/state-sequences/integration.runtime-state-sequence.json"
      )
    ).toBe("runtime/state-sequences/integration.runtime-state-sequence.json");
    expect(RuntimeSequenceFrameSchema.parse({ frameIndex: 0, deltaTimeMs: 16 })).toEqual({
      frameIndex: 0,
      deltaTimeMs: 16,
      resetReasons: [],
      authoredParameterValues: {},
      targetIds: []
    });
    expect(RuntimeEvaluationContextSchema.parse({ source: { surface: "preview" } })).toEqual({
      source: { surface: "preview" },
      policy: { strictness: "interactive" }
    });
    expect(
      RuntimeStateSequenceArtifactSchema.parse({
        schemaVersion: "runtime-state-sequence-v1",
        packageId: "pkg_integration",
        packageRevision: 1,
        fixedStepMs: 16.6667,
        frameCount: 0,
        states: [state]
      })
    ).toEqual({
      schemaVersion: "runtime-state-sequence-v1",
      packageId: "pkg_integration",
      packageRevision: 1,
      fixedStepMs: 16.6667,
      frameCount: 0,
      states: [state]
    });
  });

  it("exports JSON, field change, and diff envelope contracts", () => {
    expect(JsonValueSchema.parse({ nested: [null, true, 1, "value"] })).toEqual({
      nested: [null, true, 1, "value"]
    });
    expect(FieldChangeSchema.parse({ path: "/parameters/0", before: 0, after: 1 })).toEqual({
      path: "/parameters/0",
      before: 0,
      after: 1
    });

    const modelDiff: ModelDiffDto = ModelDiffSchema.parse({
      schemaVersion: "model-diff-v1",
      baseRevision: 1,
      candidateRevision: 2
    });
    const runtimeDiff: RuntimeDiffDto = RuntimeDiffSchema.parse({
      schemaVersion: "runtime-diff-v1",
      beforeSnapshotId: "snap_before",
      afterSnapshotId: "snap_after"
    });
    const validationDiff: ValidationDiffDto = ValidationDiffSchema.parse({
      schemaVersion: "validation-diff-v1",
      beforeReportId: "val_before",
      afterReportId: "val_after"
    });

    expect(modelDiff.operationIds).toEqual([]);
    expect(runtimeDiff.dynamicsChanges).toEqual([]);
    expect(runtimeDiff.drawableRuntimeStateChanges).toEqual([]);
    expect(runtimeDiff.drawListChanges).toEqual([]);
    expect(validationDiff.newFailures).toEqual([]);
  });

  it("exports package transport capability contracts", () => {
    const catalog = PackageTransportCapabilityCatalogDtoSchema.parse(
      PACKAGE_TRANSPORT_CAPABILITY_CATALOG
    );
    const supportedCapability = catalog.capabilities.find((capability) =>
      capability.status === "supported"
    );

    expect(supportedCapability).toMatchObject({
      capabilityId: "projectDefinedJsonBundleV0",
      transportKind: "portableBundle",
      portableBundle: {
        schemaVersion: "portable-package-bundle-v0",
        bundleKind: "project-defined-json-bundle-v0"
      }
    });
  });

  it("exports Codex proposal contracts", () => {
    const proposal = CodexRiggingEditProposalDtoSchema.parse({
      schemaVersion: "codex-rigging-edit-proposal-v0",
      proposalId: "proposal_integration",
      createdAt: "2026-06-04T00:00:00.000Z",
      source: {
        surface: "codex",
        agentId: "agent_integration"
      },
      packageContext: {
        packageId: "pkg_integration",
        basePackageRevision: 1
      },
      metadata: {
        title: "Integration proposal",
        summary: "Codex proposal public export smoke."
      },
      operations: [
        {
          stepId: "step_createParameter",
          operationType: "createParameter",
          operationId: "op_integrationParameter",
          payload: {
            parameterId: "param_integration"
          }
        }
      ]
    });
    const catalog = CodexProposalOperationCatalogDtoSchema.safeParse({
      schemaVersion: "codex-proposal-operation-catalog-v0",
      catalogId: "catalog_integration",
      unsupportedBoundaries: []
    });

    expect(proposal.approvalPolicy).toEqual({
      requiresUserApproval: true,
      allowAutomaticCommit: false
    });
    expect(catalog.success).toBe(false);
  });
});
