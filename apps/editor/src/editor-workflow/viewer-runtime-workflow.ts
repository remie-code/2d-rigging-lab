import { defaultRuntimeEvaluationOptions } from "@private-2d-rigging-lab/runtime-core";
import {
  validatePackageRuntime,
  type ValidationReportDto
} from "@private-2d-rigging-lab/validator-core";

import { projectEditorPreview } from "../editor-preview/preview-projection.js";
import { summarizePreviewRuntimeDiff } from "../editor-preview/runtime-diff-summary.js";
import type {
  EditorPreviewProjectionDto,
  EditorPreviewRuntimeDiffSummaryDto
} from "../editor-preview/preview-dto.js";
import {
  evaluateViewerRuntimeFromActiveSession,
  type EditorSessionAdapter
} from "../editor-session/index.js";
import {
  projectViewerParameterOverrides,
  type EditorSemanticState
} from "../editor-state/index.js";

export interface EditorViewerRuntimeProjection {
  readonly snapshotSummary: EditorViewerRuntimeSnapshotSummary;
  readonly runtimeDiff: EditorPreviewRuntimeDiffSummaryDto;
  readonly validation: EditorViewerRuntimeValidationSummary;
  readonly previewProjection: EditorPreviewProjectionDto;
}

export interface EditorViewerRuntimeSnapshotSummary {
  readonly surface: "viewer";
  readonly snapshotId: string;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly snapshotDetail: string;
  readonly parameterCount: number;
  readonly authoredParameterCount: number;
  readonly computedParameterCount: number;
  readonly overrideCount: number;
  readonly drawableCount: number;
  readonly visibleDrawableCount: number;
  readonly drawListCount: number;
  readonly dynamicsCount: number;
  readonly diagnosticCount: number;
  readonly parameterValues: readonly EditorViewerRuntimeParameterValueSummary[];
  readonly dynamicsOutputs: readonly EditorViewerRuntimeDynamicsOutputSummary[];
  readonly evidenceLabel: string;
}

export interface EditorViewerRuntimeParameterValueSummary {
  readonly parameterId: string;
  readonly valueSource: string;
  readonly effectiveValue: number;
  readonly source: string;
}

export interface EditorViewerRuntimeDynamicsOutputSummary {
  readonly dynamicsGroupId: string;
  readonly outputParameterId: string;
  readonly outputValue: number;
  readonly position: number;
  readonly velocity: number;
  readonly tick: number;
}

export interface EditorViewerRuntimeValidationSummary {
  readonly reportId: string;
  readonly status: string;
  readonly highestSeverity: string;
  readonly checkCount: number;
  readonly diagnostics: readonly EditorViewerRuntimeValidationDiagnostic[];
}

export interface EditorViewerRuntimeValidationDiagnostic {
  readonly checkId: string;
  readonly severity: string;
  readonly status: string;
  readonly message: string;
  readonly targetLabel: string;
}

export const projectViewerRuntimeProjection = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly now?: () => Date;
}): EditorViewerRuntimeProjection | null => {
  if (input.state.viewerRuntime.surface !== "open" || input.state.loadedPackage === null) {
    return null;
  }

  const parameterOverrides = projectViewerParameterOverrides(input.state.viewerRuntime.parameters);
  const evaluation = evaluateViewerRuntimeFromActiveSession(input.adapter.authoringSession, {
    request: {
      parameterOverrides,
      targetIds: [...collectViewerTargetIds(input.state)],
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      }
    }
  });
  const packageDocument = input.adapter.createPersistenceSnapshot().document;
  const validationReport = validatePackageRuntime({
    packageDocument,
    runtimeSnapshot: evaluation.snapshot,
    profile: "editorIncremental",
    ...(input.now === undefined ? {} : { createdAt: input.now().toISOString() })
  });

  return {
    snapshotSummary: projectSnapshotSummary({
      overrideCount: Object.keys(parameterOverrides).length,
      evaluation
    }),
    runtimeDiff: summarizePreviewRuntimeDiff(evaluation.runtimeDiff),
    validation: projectValidationSummary(validationReport),
    previewProjection: projectEditorPreview({
      snapshot: evaluation.snapshot,
      runtimeDiff: evaluation.runtimeDiff,
      canvasSize: input.adapter.authoringSession.graph.canvasSize,
      drawableNames: Object.fromEntries(
        input.adapter.authoringSession.graph.drawables.map((drawable) => [
          drawable.drawableId,
          drawable.displayName
        ])
      )
    })
  };
};

const projectSnapshotSummary = (input: {
  readonly overrideCount: number;
  readonly evaluation: ReturnType<typeof evaluateViewerRuntimeFromActiveSession>;
}): EditorViewerRuntimeSnapshotSummary => {
  const snapshot = input.evaluation.snapshot;

  return {
    surface: "viewer",
    snapshotId: snapshot.snapshotId,
    packageId: snapshot.packageId,
    packageRevision: snapshot.packageRevision,
    snapshotDetail: snapshot.evaluation.snapshotDetail,
    parameterCount: snapshot.parameters.length,
    authoredParameterCount: snapshot.parameters.filter(
      (parameter) => parameter.valueSource === "authoredInput"
    ).length,
    computedParameterCount: snapshot.parameters.filter(
      (parameter) => parameter.valueSource === "computedDynamics"
    ).length,
    overrideCount: input.overrideCount,
    drawableCount: snapshot.drawables.length,
    visibleDrawableCount: snapshot.drawables.filter((drawable) => drawable.visible).length,
    drawListCount: snapshot.drawList.length,
    dynamicsCount: snapshot.dynamics.length,
    diagnosticCount: snapshot.diagnostics.length,
    parameterValues: snapshot.parameters.map((parameter) => ({
      parameterId: parameter.parameterId,
      valueSource: parameter.valueSource,
      effectiveValue: parameter.effectiveValue,
      source: parameter.source
    })),
    dynamicsOutputs: snapshot.dynamics.map((dynamics) => ({
      dynamicsGroupId: dynamics.dynamicsGroupId,
      outputParameterId: dynamics.outputParameterId,
      outputValue: dynamics.outputValue,
      position: dynamics.stateSummary.position,
      velocity: dynamics.stateSummary.velocity,
      tick: dynamics.tick
    })),
    evidenceLabel: `${input.evaluation.evidence.baselineSnapshotId} -> ${input.evaluation.evidence.snapshotId}; ${input.evaluation.evidence.finalRuntimeStateRef}`
  };
};

const projectValidationSummary = (
  report: ValidationReportDto
): EditorViewerRuntimeValidationSummary => ({
  reportId: report.reportId,
  status: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  checkCount: report.checks.length,
  diagnostics: report.checks.map((check) => ({
    checkId: check.checkId,
    severity: check.severity,
    status: check.status,
    message: check.message,
    targetLabel:
      check.target.kind === "package"
        ? "package"
        : `${check.target.kind}:${check.target.id}`
  }))
});

const collectViewerTargetIds = (state: EditorSemanticState): readonly string[] =>
  uniqueStrings([
    ...state.parameters.map((parameter) => parameter.parameterId),
    ...state.drawables.map((drawable) => drawable.drawableId),
    ...state.dynamicsGroups.map((group) => group.dynamicsGroupId),
    ...state.dynamicsGroups.map((group) => group.outputParameterId)
  ]);

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};
