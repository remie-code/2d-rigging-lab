import { describe, expect, it } from "vitest";

import {
  applyCommittedOperationSummary,
  createInitialEditorSemanticState,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState
} from "./index.js";

describe("editor semantic state view model", () => {
  it("projects an empty initial state", () => {
    const state = createInitialEditorSemanticState();
    const viewModel = projectEditorWorkflowViewModel(state);

    expect(state.loadedPackage).toBeNull();
    expect(state.parameters).toEqual([]);
    expect(state.operationLog.entryCount).toBe(0);
    expect(viewModel).toMatchObject({
      packageTitle: "No package loaded",
      packageRevisionLabel: "Package r0 / authoring r0",
      isPackageLoaded: false,
      parameterCountLabel: "0 parameters",
      canSubmitCreateParameter: false,
      lastOperationLabel: "No operation committed",
      operationLogLabel: "0 operations",
      generatedEvidenceLabel: "0 runtime / 0 validation artifacts",
      reloadLabel: "Not reloaded"
    });
  });

  it("summarizes a committed createParameter operation for the view model", () => {
    const loaded = projectLoadedPackageState({
      identity: {
        packageId: "pkg_minimal",
        packageDisplayName: "Minimal Package",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      }
    });

    const state = applyCommittedOperationSummary(loaded, {
      result: {
        operationId: "op_create_smile",
        operationType: "createParameter",
        status: "committed",
        precondition: {
          ok: true
        },
        reversible: true
      },
      operationLogEntries: [
        {
          operationId: "op_create_smile",
          operationType: "createParameter",
          surface: "gui",
          timestamp: "2026-05-29T00:00:00.000Z",
          targetIds: ["param_smile"]
        }
      ],
      generatedEvidence: {
        runtimeSnapshotIds: ["snapshot_after_smile"],
        runtimeStateArtifactPaths: ["runtime/states/pkg_minimal-r1-after.runtime-state.json"],
        validationReportIds: ["val_after_smile"],
        validationReportArtifactPaths: ["validation/reports/val_after_smile.validation.json"]
      },
      revision: {
        packageRevision: 1,
        authoringRevision: 1
      },
      parameters: [
        {
          parameterId: "param_smile",
          displayName: "Smile",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      ],
      reload: {
        status: "reloaded",
        packageRevision: 1,
        parameterIds: ["param_smile"],
        filePaths: ["model/parameters.json", "operations/log.jsonl"]
      }
    });
    const viewModel = projectEditorWorkflowViewModel(state);

    expect(state.lastOperationResult).toMatchObject({
      operationId: "op_create_smile",
      operationType: "createParameter",
      status: "committed",
      preconditionOk: true
    });
    expect(state.operationLog.latestEntry).toMatchObject({
      operationId: "op_create_smile",
      surface: "gui",
      targetIds: ["param_smile"]
    });
    expect(state.parameters).toEqual([
      {
        parameterId: "param_smile",
        displayName: "Smile",
        valueSource: "authoredInput",
        min: 0,
        max: 1,
        defaultValue: 0,
        recommendedUiStep: 0.01
      }
    ]);
    expect(viewModel).toMatchObject({
      packageTitle: "Minimal Package",
      packageRevisionLabel: "Package r1 / authoring r1",
      isPackageLoaded: true,
      parameterCountLabel: "1 parameter",
      canSubmitCreateParameter: true,
      lastOperationLabel: "createParameter committed",
      operationLogLabel: "1 operation",
      generatedEvidenceLabel: "2 runtime / 2 validation artifacts",
      reloadLabel: "Reloaded r1 with 1 parameter"
    });
    expect(viewModel.previewControls).toMatchObject({
      hasParameters: true,
      parameterCountLabel: "1 preview parameter",
      resetLabel: "Reset preview parameters",
      authoredInputCount: 1,
      parameterControls: [
        {
          parameterId: "param_smile",
          displayName: "Smile",
          min: 0,
          max: 1,
          defaultValue: 0,
          currentValue: 0,
          disabled: false,
          label: "Smile",
          valueLabel: "Smile: 0",
          rangeLabel: "0 to 1",
          defaultValueLabel: "Default 0",
          disabledMessage: null
        }
      ]
    });
  });

  it("projects disabled preview controls for non-authored parameters", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_dynamics",
        packageDisplayName: "Dynamics Package",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
      parameters: [
        {
          parameterId: "param_hair_sway",
          displayName: "Hair Sway",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      ]
    });

    expect(projectEditorWorkflowViewModel(state).previewControls).toMatchObject({
      authoredInputCount: 0,
      parameterControls: [
        {
          parameterId: "param_hair_sway",
          disabled: true,
          disabledMessage: "Preview control disabled for computedDynamics parameter"
        }
      ]
    });
  });
});
