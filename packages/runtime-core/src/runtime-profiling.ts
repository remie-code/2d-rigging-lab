export interface RuntimeCoreEvaluationProfile {
  readonly runtimeCoreEvaluationDurationMs: number;
  readonly inputValidationDurationMs: number;
  readonly stateCompatibilityDurationMs: number;
  readonly dynamicsEvaluationDurationMs: number;
  readonly runtimeSnapshotCreationDurationMs: number;
  readonly parameterResolutionDurationMs: number;
  readonly keyformSamplingDurationMs: number;
  readonly keyformApplicationDurationMs: number;
  readonly deformerHierarchyEvaluationDurationMs: number;
  readonly warpDeformerVertexTransformDurationMs: number;
  readonly rotationDeformerVertexTransformDurationMs: number;
  readonly drawableSnapshotCreationDurationMs: number;
  readonly visibilityDrawOrderEvaluationDurationMs: number;
  readonly maskEvaluationDurationMs: number;
  readonly snapshotValidationDurationMs: number;
}

export type RuntimeCoreEvaluationProfilePhaseKey =
  Exclude<keyof RuntimeCoreEvaluationProfile, "runtimeCoreEvaluationDurationMs">;

export interface RuntimeCoreEvaluationProfilingOptions {
  readonly enabled?: boolean;
  readonly now?: () => number;
}

export interface RuntimeCoreEvaluationProfiler {
  readonly enabled: boolean;
  measure<TValue>(
    phase: RuntimeCoreEvaluationProfilePhaseKey,
    evaluate: () => TValue
  ): TValue;
  recordDuration(
    phase: RuntimeCoreEvaluationProfilePhaseKey,
    durationMs: number
  ): void;
  finish(): RuntimeCoreEvaluationProfile | undefined;
}

export const createRuntimeCoreEvaluationProfiler = (
  options: RuntimeCoreEvaluationProfilingOptions | undefined
): RuntimeCoreEvaluationProfiler => {
  const enabled = options?.enabled === true;
  const now = options?.now ?? readCurrentTimeMs;
  const startedAtMs = enabled ? now() : 0;
  const durations = createEmptyRuntimeCoreEvaluationProfileDurations();

  return {
    enabled,
    measure<TValue>(
      phase: RuntimeCoreEvaluationProfilePhaseKey,
      evaluate: () => TValue
    ): TValue {
      if (!enabled) {
        return evaluate();
      }

      const phaseStartedAtMs = now();
      try {
        return evaluate();
      } finally {
        durations[phase] += Math.max(0, now() - phaseStartedAtMs);
      }
    },
    recordDuration(
      phase: RuntimeCoreEvaluationProfilePhaseKey,
      durationMs: number
    ): void {
      if (!enabled) {
        return;
      }

      durations[phase] += Math.max(0, durationMs);
    },
    finish(): RuntimeCoreEvaluationProfile | undefined {
      if (!enabled) {
        return undefined;
      }

      return {
        runtimeCoreEvaluationDurationMs: Math.max(0, now() - startedAtMs),
        ...durations
      };
    }
  };
};

const createEmptyRuntimeCoreEvaluationProfileDurations = ():
  Record<RuntimeCoreEvaluationProfilePhaseKey, number> => ({
    inputValidationDurationMs: 0,
    stateCompatibilityDurationMs: 0,
    dynamicsEvaluationDurationMs: 0,
    runtimeSnapshotCreationDurationMs: 0,
    parameterResolutionDurationMs: 0,
    keyformSamplingDurationMs: 0,
    keyformApplicationDurationMs: 0,
    deformerHierarchyEvaluationDurationMs: 0,
    warpDeformerVertexTransformDurationMs: 0,
    rotationDeformerVertexTransformDurationMs: 0,
    drawableSnapshotCreationDurationMs: 0,
    visibilityDrawOrderEvaluationDurationMs: 0,
    maskEvaluationDurationMs: 0,
    snapshotValidationDurationMs: 0
  });

function readCurrentTimeMs(): number {
  return typeof performance === "undefined"
    ? Date.now()
    : performance.now();
}
