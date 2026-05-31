import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";
import type { DynamicsGroupDto } from "@private-2d-rigging-lab/package-format";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";
import type { ValidationReportDto } from "@private-2d-rigging-lab/validator-core";

export interface DynamicsGroupState {
  readonly dynamicsGroupId: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly solverKind: "scalarDampedFollowV1";
  readonly resetPolicy: DynamicsGroupDto["resetPolicy"];
  readonly driverParameterIds: readonly string[];
  readonly outputParameterId: string;
  readonly stiffness: number;
  readonly damping: number;
  readonly maxVelocity: number | null;
  readonly maxAmplitude: number | null;
}

export interface DynamicsPreviewOutputState {
  readonly dynamicsGroupId: string;
  readonly outputParameterId: string;
  readonly outputValue: number;
  readonly position: number;
  readonly velocity: number;
  readonly tick: number;
  readonly resetCounter: number;
  readonly fixedStepMs: number;
  readonly driverValues: Readonly<Record<string, number>>;
  readonly rawTarget: number | null;
  readonly clampedTarget: number | null;
  readonly outputClamped: boolean | null;
}

export interface DynamicsPreviewDiagnosticState {
  readonly checkId: string;
  readonly severity: string;
  readonly status: string;
  readonly phase: string;
  readonly message: string;
  readonly targetKind: string | null;
  readonly targetId: string | null;
}

export interface DynamicsPreviewEvidenceState {
  readonly snapshotId: string;
  readonly packageRevision: number;
  readonly frameIndex: number;
  readonly runtimeDiffBeforeSnapshotId: string | null;
  readonly runtimeDiffAfterSnapshotId: string | null;
  readonly parameterChangeCount: number;
  readonly dynamicsChangeCount: number;
  readonly drawableChangeCount: number;
  readonly validationReportId: string | null;
  readonly validationStatus: string | null;
  readonly validationHighestSeverity: string | null;
  readonly validationCheckCount: number;
}

export interface DynamicsPreviewState {
  readonly status: "idle" | "reset" | "ran";
  readonly lastFrameCount: number;
  readonly outputs: readonly DynamicsPreviewOutputState[];
  readonly evidence: DynamicsPreviewEvidenceState | null;
  readonly diagnostics: readonly DynamicsPreviewDiagnosticState[];
}

export const createEmptyDynamicsPreviewState = (): DynamicsPreviewState => ({
  status: "idle",
  lastFrameCount: 0,
  outputs: [],
  evidence: null,
  diagnostics: []
});

export const projectDynamicsGroupState = (
  groups: readonly DynamicsGroupDto[]
): readonly DynamicsGroupState[] =>
  groups.map((group) => ({
    dynamicsGroupId: group.dynamicsGroupId,
    displayName: group.displayName,
    enabled: group.enabled,
    solverKind: group.solverKind,
    resetPolicy: group.resetPolicy,
    driverParameterIds: group.drivers.map((driver) => driver.sourceParameterId),
    outputParameterId: group.output.targetParameterId,
    stiffness: group.settings.stiffness,
    damping: group.settings.damping,
    maxVelocity: group.settings.maxVelocity ?? null,
    maxAmplitude: group.settings.maxAmplitude ?? null
  }));

export const projectDynamicsPreviewState = (input: {
  readonly status: Exclude<DynamicsPreviewState["status"], "idle">;
  readonly snapshot: RuntimeSnapshotDto;
  readonly runtimeDiff?: RuntimeDiffDto;
  readonly validationReport?: ValidationReportDto;
  readonly frameIndex: number;
  readonly frameCount: number;
}): DynamicsPreviewState => ({
  status: input.status,
  lastFrameCount: input.frameCount,
  outputs: input.snapshot.dynamics.map((group) => ({
    dynamicsGroupId: group.dynamicsGroupId,
    outputParameterId: group.outputParameterId,
    outputValue: group.outputValue,
    position: group.stateSummary.position,
    velocity: group.stateSummary.velocity,
    tick: group.tick,
    resetCounter: group.resetCounter,
    fixedStepMs: group.fixedStepMs,
    driverValues: group.driverValues,
    rawTarget: group.debug?.rawTarget ?? null,
    clampedTarget: group.debug?.clampedTarget ?? null,
    outputClamped: group.debug?.outputClamped ?? null
  })),
  evidence: {
    snapshotId: input.snapshot.snapshotId,
    packageRevision: input.snapshot.packageRevision,
    frameIndex: input.frameIndex,
    runtimeDiffBeforeSnapshotId: input.runtimeDiff?.beforeSnapshotId ?? null,
    runtimeDiffAfterSnapshotId: input.runtimeDiff?.afterSnapshotId ?? null,
    parameterChangeCount: input.runtimeDiff?.parameterChanges.length ?? 0,
    dynamicsChangeCount: input.runtimeDiff?.dynamicsChanges.length ?? 0,
    drawableChangeCount: input.runtimeDiff?.drawableChanges.length ?? 0,
    validationReportId: input.validationReport?.reportId ?? null,
    validationStatus: input.validationReport?.summary.status ?? null,
    validationHighestSeverity: input.validationReport?.summary.highestSeverity ?? null,
    validationCheckCount: input.validationReport?.checks.length ?? 0
  },
  diagnostics: (input.validationReport?.checks ?? []).map((check) => ({
    checkId: check.checkId,
    severity: check.severity,
    status: check.status,
    phase: check.phase,
    message: check.message,
    targetKind: check.target?.kind ?? null,
    targetId: check.target?.id ?? null
  }))
});
