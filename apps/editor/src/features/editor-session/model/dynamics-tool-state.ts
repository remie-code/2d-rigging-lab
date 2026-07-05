import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DynamicsGroupId,
  ParameterId,
  RuntimeDynamicsGroupState
} from "@private-2d-rigging-lab/contracts";
import { recordLive2dPerformanceCounter } from "@private-2d-rigging-lab/render-core";
import {
  computeDynamicsOutputOffsetsWithAnchor,
  stepDynamics,
  type DynamicsAnchorPose,
  type DynamicsSourceSample,
  type NormalizedDynamicsGroup
} from "@private-2d-rigging-lab/runtime-core";
import type {
  CreateDynamicsGroupPayloadDto,
  DynamicsChainPayloadDto,
  DynamicsInputPayloadDto,
  DynamicsOutputPayloadDto,
  UpdateDynamicsGroupPayloadDto
} from "@private-2d-rigging-lab/operation-core";

import type { ParameterValueMap } from "./parameter-keyform-state";
import {
  clampParameterValue,
  listEditorParameters,
  type EditorParameter
} from "./parameter-keyform-state";
import {
  createEditorDiagnosticsProjection,
  type EditorDiagnosticItem
} from "./editor-diagnostics-state";

// dynamics-file-v3 editor tool state. The physics + schema is fixed in
// discussion/design/dynamics-world-frame-chain.md (world-frame Verlet chain). The editor UI edits
// the §4 schema (inputs.scale / chain / outputs.{segmentIndex,scale,limit}), previews via the
// runtime-core solver (stepDynamics), and reads §3.5 output offsets through the anchor.

export type DynamicsAxisKind = "angle" | "positionX" | "positionY";
export type DynamicsToolPresetId = "hair" | "ribbon" | "softCloth" | "rigidAccessory";
export type DynamicsToolGroup = AuthoringSession["graph"]["dynamicsGroups"][number];

// §8: rest → 30° maps to a parameter delta of 1.0, so scale = 1/30 as the output-scale starting
// point ("parameter 1.0 = 30°"). Callers scale limit off the parameter range.
export const DEFAULT_OUTPUT_SCALE_PER_DEG = 1 / 30;
// §10: angle drivers default to 1 deg per parameter unit (FaceZ example). A conservative starting
// point; deg-valued parameters (±10, ±30) then map directly to head rotation.
export const DEFAULT_INPUT_ANGLE_SCALE = 1;

export interface DynamicsToolPreset {
  readonly presetId: DynamicsToolPresetId;
  readonly label: string;
  readonly chain: DynamicsChainPayloadDto;
}

export interface DynamicsToolDraft {
  readonly dynamicsGroupId?: DynamicsGroupId;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly presetId: DynamicsToolPresetId;
  readonly inputs: readonly DynamicsInputPayloadDto[];
  readonly chain: DynamicsChainPayloadDto;
  readonly outputs: readonly DynamicsOutputPayloadDto[];
}

export interface DynamicsToolValidationIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface DynamicsToolGroupDiagnosticSummary {
  readonly dynamicsGroupId: DynamicsGroupId;
  readonly issues: readonly EditorDiagnosticItem[];
}

export interface DynamicsToolPreviewState {
  readonly selectedGroupId: DynamicsGroupId | null;
  readonly driverValuesByGroupId: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly simulationStatesByGroupId: Readonly<Record<string, RuntimeDynamicsGroupState>>;
  readonly definitionOverridesByGroupId: Readonly<Record<string, DynamicsToolGroup>>;
  readonly resetSerial: number;
}

export interface DynamicsToolPreviewOutputSummary {
  readonly outputParameterId: ParameterId;
  readonly segmentIndex: number;
  readonly thetaLocalDeg: number;
  readonly baseValue: number;
  readonly rawOffset: number;
  readonly offset: number;
  readonly rawEffectiveValue: number;
  readonly effectiveValue: number;
  readonly outputClamped: boolean;
  readonly parameterClamped: boolean;
}

export interface DynamicsToolPreviewEvaluation {
  readonly selectedGroupId: DynamicsGroupId | null;
  readonly parameterValues: ParameterValueMap;
  readonly driverValues: Readonly<Record<ParameterId, number>>;
  // §3.2 anchor pose (φ [deg] + world pin) derived from the current inputs. Replaces the old scalar
  // {source, rawSource}; the world-frame chain has no scalar "source" — the driver signal is the
  // anchor pose, and the output is read from the head-frame segment angle (§3.5).
  readonly anchor: DynamicsAnchorPose;
  readonly state: RuntimeDynamicsGroupState | null;
  readonly output: DynamicsToolPreviewOutputSummary | null;
}

export const DYNAMICS_TOOL_PREVIEW_STEP_MS = 16.6666667;
export const DYNAMICS_TOOL_PREVIEW_MAX_ELAPSED_MS = 100;

// §8 preset initial values (segmentLengths [cm], damping [1/s], gravityScale). rootOffset default
// {0,0}. Numbers are calibration starting points, tuned later in the Editor preview.
export const DYNAMICS_TOOL_PRESETS: readonly DynamicsToolPreset[] = [
  {
    presetId: "hair",
    label: "Hair",
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [14], damping: 2.5, gravityScale: 1.0 }
  },
  {
    presetId: "ribbon",
    label: "Ribbon",
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [10], damping: 1.2, gravityScale: 0.8 }
  },
  {
    presetId: "softCloth",
    label: "Soft Cloth",
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [18], damping: 4.0, gravityScale: 1.0 }
  },
  {
    presetId: "rigidAccessory",
    label: "Rigid Accessory",
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [6], damping: 8.0, gravityScale: 1.0 }
  }
] as const;

export const createInitialDynamicsToolPreviewState = (): DynamicsToolPreviewState => ({
  selectedGroupId: null,
  driverValuesByGroupId: {},
  simulationStatesByGroupId: {},
  definitionOverridesByGroupId: {},
  resetSerial: 0
});

export const getDynamicsToolPreset = (
  presetId: DynamicsToolPresetId
): DynamicsToolPreset =>
  DYNAMICS_TOOL_PRESETS.find((preset) => preset.presetId === presetId) ??
  DYNAMICS_TOOL_PRESETS[0]!;

export const createDynamicsGroupDraftFromSession = (
  session: AuthoringSession,
  presetId: DynamicsToolPresetId = "hair"
): DynamicsToolDraft => {
  const parameters = listEditorParameters(session);
  const inputParameter = parameters[0];
  const outputParameter = parameters[1] ?? parameters[0];
  const preset = getDynamicsToolPreset(presetId);

  return {
    displayName: createNextDynamicsGroupDisplayName(session, preset.label),
    enabled: true,
    presetId,
    inputs: inputParameter === undefined ? [] : [createDefaultDynamicsInput(inputParameter)],
    chain: cloneDynamicsChain(preset.chain),
    outputs:
      outputParameter === undefined
        ? []
        : [createDefaultDynamicsOutput(outputParameter)]
  };
};

export const createDynamicsGroupDraftFromGroup = (
  group: DynamicsToolGroup
): DynamicsToolDraft => ({
  dynamicsGroupId: group.dynamicsGroupId,
  displayName: group.displayName,
  enabled: group.enabled,
  presetId: isDynamicsToolPresetId(group.presetId) ? group.presetId : "hair",
  inputs: group.inputs.map(cloneDynamicsInput),
  chain: cloneDynamicsChain(group.chain),
  outputs: group.outputs.map(cloneDynamicsOutput)
});

export const createDynamicsGroupCreatePayloadFromDraft = (
  draft: DynamicsToolDraft,
  dynamicsGroupId: DynamicsGroupId
): CreateDynamicsGroupPayloadDto => ({
  dynamicsGroupId,
  displayName: draft.displayName.trim(),
  enabled: draft.enabled,
  presetId: draft.presetId,
  inputs: draft.inputs.map(cloneDynamicsInput),
  chain: cloneDynamicsChain(draft.chain),
  outputs: draft.outputs.map(cloneDynamicsOutput)
});

export const createDynamicsGroupUpdatePayloadFromDraft = (
  draft: DynamicsToolDraft,
  dynamicsGroupId: DynamicsGroupId
): UpdateDynamicsGroupPayloadDto => ({
  dynamicsGroupId,
  displayName: draft.displayName.trim(),
  enabled: draft.enabled,
  presetId: draft.presetId,
  inputs: draft.inputs.map(cloneDynamicsInput),
  chain: cloneDynamicsChain(draft.chain),
  outputs: draft.outputs.map(cloneDynamicsOutput)
});

export const createDefaultDynamicsInput = (
  parameter: EditorParameter
): DynamicsInputPayloadDto => ({
  parameterId: parameter.parameterId,
  kind: "angle",
  scale: DEFAULT_INPUT_ANGLE_SCALE
});

export const createDefaultDynamicsOutput = (
  parameter: EditorParameter
): DynamicsOutputPayloadDto => {
  const range = Math.max(Math.abs(parameter.max - parameter.min), parameter.recommendedUiStep, 1);
  // §8: scale starts at "parameter 1.0 = 30°" (1/30). limit is left to UI calibration; a reasonable
  // default is the parameter's half-range so an offset can carry the value from default to an edge
  // without clipping normal motion.
  return {
    parameterId: parameter.parameterId,
    segmentIndex: 1,
    scale: normalizePreviewNumber(DEFAULT_OUTPUT_SCALE_PER_DEG),
    limit: normalizePreviewNumber(range / 2)
  };
};

export const addInputToDynamicsDraft = (
  session: AuthoringSession,
  draft: DynamicsToolDraft
): DynamicsToolDraft => {
  const parameters = listEditorParameters(session);
  const usedParameterIds = new Set(draft.inputs.map((input) => input.parameterId));
  const parameter =
    parameters.find((candidate) => !usedParameterIds.has(candidate.parameterId)) ??
    parameters[0];

  return parameter === undefined
    ? draft
    : {
        ...draft,
        inputs: [...draft.inputs, createDefaultDynamicsInput(parameter)]
      };
};

export const removeInputFromDynamicsDraft = (
  draft: DynamicsToolDraft,
  inputIndex: number
): DynamicsToolDraft => ({
  ...draft,
  inputs: draft.inputs.filter((_, index) => index !== inputIndex)
});

export const updateDynamicsDraftInput = (
  _session: AuthoringSession,
  draft: DynamicsToolDraft,
  inputIndex: number,
  patch: Partial<DynamicsInputPayloadDto>
): DynamicsToolDraft => ({
  ...draft,
  inputs: draft.inputs.map((input, index) =>
    index === inputIndex ? { ...input, ...patch } : input
  )
});

export const updateDynamicsDraftChain = (
  draft: DynamicsToolDraft,
  patch: Partial<DynamicsChainPayloadDto>
): DynamicsToolDraft => ({
  ...draft,
  chain: cloneDynamicsChain({ ...draft.chain, ...patch })
});

export const updateDynamicsDraftOutput = (
  session: AuthoringSession,
  draft: DynamicsToolDraft,
  patch: Partial<DynamicsOutputPayloadDto>
): DynamicsToolDraft => {
  const currentOutput = draft.outputs[0];
  const parameter = findEditorParameter(session, patch.parameterId ?? currentOutput?.parameterId);
  const nextOutput =
    currentOutput ??
    (parameter === undefined ? undefined : createDefaultDynamicsOutput(parameter));

  if (nextOutput === undefined) {
    return draft;
  }

  const resetForParameter =
    patch.parameterId !== undefined && parameter !== undefined
      ? createDefaultDynamicsOutput(parameter)
      : nextOutput;

  return {
    ...draft,
    outputs: [
      {
        ...resetForParameter,
        ...patch
      }
    ]
  };
};

export const validateDynamicsToolDraft = (
  session: AuthoringSession,
  draft: DynamicsToolDraft,
  ignoredDynamicsGroupId?: DynamicsGroupId
): readonly DynamicsToolValidationIssue[] => {
  const issues: DynamicsToolValidationIssue[] = [];
  const parametersById = new Map(
    listEditorParameters(session).map((parameter) => [parameter.parameterId, parameter])
  );

  if (draft.displayName.trim().length === 0) {
    issues.push(errorIssue("dynamicsTool.nameMissing", "Name is required.", "/displayName"));
  }

  if (draft.inputs.length < 1) {
    issues.push(errorIssue("dynamicsTool.inputMissing", "At least one driver input is required.", "/inputs"));
  }

  draft.inputs.forEach((input, index) => {
    if (!parametersById.has(input.parameterId)) {
      issues.push(
        errorIssue(
          "dynamicsTool.inputParameterMissing",
          `Driver parameter is missing: ${input.parameterId}.`,
          `/inputs/${index}/parameterId`
        )
      );
    }

    if (input.scale === 0) {
      issues.push(
        warningIssue(
          "dynamicsTool.zeroInputScale",
          "Input scale is zero, so this driver has no effect.",
          `/inputs/${index}/scale`
        )
      );
    }
  });

  // §7: chainSegmentsInvalid (empty or non-positive lengths) is blocking.
  const segmentLengths = draft.chain.segmentLengths;
  const segmentCount = segmentLengths.length;
  if (segmentCount < 1 || segmentLengths.some((length) => !(length > 0))) {
    issues.push(
      errorIssue(
        "dynamicsTool.chainSegmentsInvalid",
        "Chain requires at least one segment, and every segment length must be positive.",
        "/chain/segmentLengths"
      )
    );
  }

  // §7 revised unstable-settings basis.
  if (
    draft.chain.damping > 60 ||
    segmentLengths.some((length) => length < 0.1) ||
    segmentCount > 16 ||
    draft.chain.gravityScale > 10
  ) {
    issues.push(
      warningIssue(
        "dynamicsTool.unstableSettings",
        "Chain settings are extreme and may be unstable.",
        "/chain"
      )
    );
  }

  draft.outputs.forEach((output, index) => {
    if (!parametersById.has(output.parameterId)) {
      issues.push(
        errorIssue(
          "dynamicsTool.outputParameterMissing",
          `Output parameter is missing: ${output.parameterId}.`,
          `/outputs/${index}/parameterId`
        )
      );
    }

    if (segmentCount >= 1 && (output.segmentIndex < 1 || output.segmentIndex > segmentCount)) {
      issues.push(
        errorIssue(
          "dynamicsTool.outputSegmentIndexOutOfRange",
          `Output segment index ${output.segmentIndex} is out of range (1..${segmentCount}).`,
          `/outputs/${index}/segmentIndex`
        )
      );
    }

    const existingOwner = session.graph.dynamicsGroups.find(
      (group) =>
        group.dynamicsGroupId !== ignoredDynamicsGroupId &&
        group.outputs.some((candidate) => candidate.parameterId === output.parameterId)
    );
    if (existingOwner !== undefined) {
      issues.push(
        errorIssue(
          "dynamicsTool.outputOwnershipDuplicate",
          `Output is already owned by ${existingOwner.displayName}.`,
          `/outputs/${index}/parameterId`
        )
      );
    }

    if (output.scale === 0) {
      issues.push(
        warningIssue(
          "dynamicsTool.outputScaleZero",
          "Output scale is zero, so this output produces no motion.",
          `/outputs/${index}/scale`
        )
      );
    }
    if (output.limit <= 0.000001) {
      issues.push(
        warningIssue(
          "dynamicsTool.outputLimitTooSmall",
          "Output limit is too small to show visible motion.",
          `/outputs/${index}/limit`
        )
      );
    }
  });

  return issues;
};

export const hasBlockingDynamicsToolIssues = (
  issues: readonly DynamicsToolValidationIssue[]
): boolean => issues.some((issue) => issue.severity === "error");

export const createDynamicsToolGroupDiagnosticSummaries = (
  session: AuthoringSession
): ReadonlyMap<DynamicsGroupId, DynamicsToolGroupDiagnosticSummary> => {
  const summaries = new Map<DynamicsGroupId, EditorDiagnosticItem[]>();

  for (const item of createEditorDiagnosticsProjection(session).items) {
    if (item.category !== "dynamics") {
      continue;
    }

    for (const dynamicsGroupId of resolveDiagnosticDynamicsGroupIds(item)) {
      const current = summaries.get(dynamicsGroupId) ?? [];
      if (!current.some((candidate) => candidate.id === item.id)) {
        summaries.set(dynamicsGroupId, [...current, item]);
      }
    }
  }

  return new Map(
    [...summaries.entries()].map(([dynamicsGroupId, issues]) => [
      dynamicsGroupId,
      {
        dynamicsGroupId,
        issues: [...issues].sort((left, right) => left.id.localeCompare(right.id))
      }
    ])
  );
};

export const selectDynamicsToolPreviewGroup = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState,
  selectedGroupId: DynamicsGroupId | null
): DynamicsToolPreviewState => {
  if (selectedGroupId === null) {
    return {
      ...state,
      selectedGroupId: null,
      definitionOverridesByGroupId: {}
    };
  }

  const group = findDynamicsGroup(session, selectedGroupId);
  if (group === undefined) {
    return {
      ...state,
      selectedGroupId: null
    };
  }

  const driverValues = state.driverValuesByGroupId[selectedGroupId] ?? createDefaultDriverValues(session, group);
  const existingState = state.simulationStatesByGroupId[selectedGroupId];
  return {
    ...state,
    selectedGroupId,
    driverValuesByGroupId: {
      ...state.driverValuesByGroupId,
      [selectedGroupId]: driverValues
    },
    simulationStatesByGroupId:
      existingState === undefined
        ? {
            ...state.simulationStatesByGroupId,
            [selectedGroupId]: createResetDynamicsToolPreviewState(session, group, driverValues)
          }
        : state.simulationStatesByGroupId
  };
};

export const setDynamicsToolPreviewDriverValue = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState,
  input: {
    readonly dynamicsGroupId: DynamicsGroupId;
    readonly parameterId: ParameterId;
    readonly value: number;
  }
): DynamicsToolPreviewState => {
  const group = findDynamicsGroup(session, input.dynamicsGroupId);
  if (group === undefined) {
    return state;
  }

  const parameter = findEditorParameter(session, input.parameterId);
  const nextValue =
    parameter === undefined ? input.value : clampParameterValue(parameter, input.value);
  const currentDriverValues =
    state.driverValuesByGroupId[input.dynamicsGroupId] ?? createDefaultDriverValues(session, group);
  const currentValue = currentDriverValues[input.parameterId];
  if (
    state.selectedGroupId === input.dynamicsGroupId &&
    currentValue !== undefined &&
    sameDynamicsPreviewValue(currentValue, nextValue)
  ) {
    recordLive2dPerformanceCounter("dynamicsPreview.skippedNoOpUpdates");
    return state;
  }

  const driverValues = {
    ...currentDriverValues,
    [input.parameterId]: nextValue
  };

  recordLive2dPerformanceCounter("dynamicsPreview.appliedUpdates");
  return {
    ...state,
    selectedGroupId: input.dynamicsGroupId,
    driverValuesByGroupId: {
      ...state.driverValuesByGroupId,
      [input.dynamicsGroupId]: driverValues
    }
  };
};

export const advanceDynamicsToolPreviewSimulation = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState,
  input: {
    readonly dynamicsGroupId: DynamicsGroupId;
    readonly dtMs: number;
  }
): DynamicsToolPreviewState => {
  if (state.selectedGroupId !== input.dynamicsGroupId || input.dtMs <= 0) {
    return state;
  }

  const definition = resolvePreviewDynamicsDefinition(session, state, input.dynamicsGroupId);
  if (definition === undefined) {
    return state;
  }

  const driverValues =
    state.driverValuesByGroupId[input.dynamicsGroupId] ??
    createDefaultDriverValues(session, definition);
  const previousState = state.simulationStatesByGroupId[input.dynamicsGroupId];
  const stepped = stepDynamicsToolPreview({
    session,
    definition,
    inputValues: driverValues,
    previousState,
    resetApplied: false,
    dtMs: input.dtMs
  });

  if (stepped.state === previousState) {
    return state;
  }

  recordLive2dPerformanceCounter("dynamicsPreview.animationTicks");
  return {
    ...state,
    driverValuesByGroupId: {
      ...state.driverValuesByGroupId,
      [input.dynamicsGroupId]: driverValues
    },
    simulationStatesByGroupId: {
      ...state.simulationStatesByGroupId,
      [input.dynamicsGroupId]: stepped.state
    }
  };
};

export const setDynamicsToolPreviewDefinitionOverride = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState,
  input: {
    readonly dynamicsGroupId: DynamicsGroupId;
    readonly definition: DynamicsToolGroup;
  }
): DynamicsToolPreviewState => {
  if (findDynamicsGroup(session, input.dynamicsGroupId) === undefined) {
    return state;
  }

  const definition = cloneDynamicsGroup(input.definition);
  const current = state.definitionOverridesByGroupId[input.dynamicsGroupId];
  if (current !== undefined && sameDynamicsDefinition(current, definition)) {
    return state;
  }

  return {
    ...state,
    definitionOverridesByGroupId: {
      ...state.definitionOverridesByGroupId,
      [input.dynamicsGroupId]: definition
    }
  };
};

export const clearDynamicsToolPreviewDefinitionOverride = (
  state: DynamicsToolPreviewState,
  dynamicsGroupId: DynamicsGroupId
): DynamicsToolPreviewState => {
  if (state.definitionOverridesByGroupId[dynamicsGroupId] === undefined) {
    return state;
  }

  const remainingOverrides: Record<string, DynamicsToolGroup> = {
    ...state.definitionOverridesByGroupId
  };
  delete remainingOverrides[dynamicsGroupId];
  return {
    ...state,
    definitionOverridesByGroupId: remainingOverrides
  };
};

export const resetDynamicsToolPreviewSimulation = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState,
  dynamicsGroupId: DynamicsGroupId | null = state.selectedGroupId
): DynamicsToolPreviewState => {
  if (dynamicsGroupId === null) {
    return state;
  }

  const group = resolvePreviewDynamicsDefinition(session, state, dynamicsGroupId);
  if (group === undefined) {
    return state;
  }

  const driverValues = state.driverValuesByGroupId[dynamicsGroupId] ?? createDefaultDriverValues(session, group);
  const previousState = state.simulationStatesByGroupId[dynamicsGroupId];

  return {
    ...state,
    selectedGroupId: dynamicsGroupId,
    driverValuesByGroupId: {
      ...state.driverValuesByGroupId,
      [dynamicsGroupId]: driverValues
    },
    simulationStatesByGroupId: {
      ...state.simulationStatesByGroupId,
      [dynamicsGroupId]: createResetDynamicsToolPreviewState(session, group, driverValues, previousState)
    },
    resetSerial: state.resetSerial + 1
  };
};

export const createDynamicsToolPreviewEvaluation = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState
): DynamicsToolPreviewEvaluation => {
  const baseParameterValues = createDefaultParameterValueMap(session);
  const selectedGroupId = state.selectedGroupId;
  if (selectedGroupId === null) {
    return {
      selectedGroupId,
      parameterValues: baseParameterValues,
      driverValues: {},
      anchor: ZERO_ANCHOR,
      state: null,
      output: null
    };
  }

  const group = resolvePreviewDynamicsDefinition(session, state, selectedGroupId);
  if (group === undefined) {
    return {
      selectedGroupId: null,
      parameterValues: baseParameterValues,
      driverValues: {},
      anchor: ZERO_ANCHOR,
      state: null,
      output: null
    };
  }

  const driverValues = {
    ...createDefaultDriverValues(session, group),
    ...(state.driverValuesByGroupId[selectedGroupId] ?? {})
  } as Readonly<Record<ParameterId, number>>;
  const sampled = stepDynamicsToolPreview({
    session,
    definition: group,
    inputValues: driverValues,
    previousState: state.simulationStatesByGroupId[selectedGroupId],
    resetApplied: false,
    dtMs: 0
  });
  const dynamicsState =
    state.simulationStatesByGroupId[selectedGroupId] ??
    sampled.state;
  const parameterValues: Record<string, number> = {
    ...baseParameterValues,
    ...driverValues
  };
  const output =
    group.enabled === false
      ? createDisabledOutputSummary(session, group, parameterValues)
      : createPreviewOutputSummary(session, group, parameterValues, dynamicsState, sampled.source.anchor);

  if (output !== null) {
    parameterValues[output.outputParameterId] = output.effectiveValue;
  }

  return {
    selectedGroupId,
    parameterValues,
    driverValues,
    anchor: sampled.source.anchor,
    state: dynamicsState,
    output
  };
};

export const createDefaultParameterValueMap = (
  session: AuthoringSession
): ParameterValueMap =>
  Object.fromEntries(
    listEditorParameters(session).map((parameter) => [parameter.parameterId, parameter.default])
  );

export const createNextDynamicsGroupDisplayName = (
  session: AuthoringSession,
  presetLabel = "Dynamics"
): string => {
  const base = `${presetLabel} Dynamics`;
  const existingNames = new Set(session.graph.dynamicsGroups.map((group) => group.displayName));
  if (!existingNames.has(base)) {
    return base;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base} ${index}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }

  return `${base} ${session.graph.dynamicsGroups.length + 1}`;
};

// §3.2 parameter defaults are the rest basis for the anchor pose; the solver requires them.
const createParameterDefaultsForGroup = (
  session: AuthoringSession,
  group: DynamicsToolGroup
): Readonly<Record<ParameterId, number>> =>
  Object.fromEntries(
    group.inputs.map((input) => {
      const parameter = findEditorParameter(session, input.parameterId);
      return [input.parameterId, parameter?.default ?? 0];
    })
  ) as Readonly<Record<ParameterId, number>>;

const createDefaultDriverValues = (
  session: AuthoringSession,
  group: DynamicsToolGroup
): Readonly<Record<ParameterId, number>> =>
  Object.fromEntries(
    group.inputs.map((input) => {
      const parameter = findEditorParameter(session, input.parameterId);
      return [input.parameterId, parameter?.default ?? 0];
    })
  ) as Readonly<Record<ParameterId, number>>;

const stepDynamicsToolPreview = (input: {
  readonly session: AuthoringSession;
  readonly definition: DynamicsToolGroup;
  readonly previousState: RuntimeDynamicsGroupState | undefined;
  readonly inputValues: Readonly<Record<string, number>>;
  readonly resetApplied: boolean;
  readonly dtMs: number;
}): {
  readonly state: RuntimeDynamicsGroupState;
  readonly source: DynamicsSourceSample;
} => {
  const parameterDefaults = createParameterDefaultsForGroup(input.session, input.definition);
  const dtMs = clamp(input.dtMs, 0, DYNAMICS_TOOL_PREVIEW_MAX_ELAPSED_MS);
  const reset = stepDynamics({
    definition: input.definition as NormalizedDynamicsGroup,
    previousState: input.previousState,
    inputValues: input.inputValues,
    parameterDefaults,
    resetApplied: input.resetApplied || input.previousState === undefined,
    dtMs: 0
  });
  const previousState =
    input.resetApplied || input.previousState === undefined
      ? reset.state
      : input.previousState;
  if (input.resetApplied || !input.definition.enabled || dtMs === 0) {
    return {
      state: previousState,
      source: reset.source
    };
  }

  let nextState = previousState;
  let source = reset.source;
  let remainingMs = dtMs;

  while (remainingMs > 0.000001) {
    const stepMs = Math.min(DYNAMICS_TOOL_PREVIEW_STEP_MS, remainingMs);
    const stepped = stepDynamics({
      definition: input.definition as NormalizedDynamicsGroup,
      previousState: nextState,
      inputValues: input.inputValues,
      parameterDefaults,
      resetApplied: false,
      dtMs: stepMs
    });
    nextState = stepped.state;
    source = stepped.source;
    remainingMs -= stepMs;
  }

  return {
    source,
    state: nextState
  };
};

const createPreviewOutputSummary = (
  session: AuthoringSession,
  group: DynamicsToolGroup,
  parameterValues: Readonly<Record<string, number>>,
  state: RuntimeDynamicsGroupState,
  anchor: DynamicsAnchorPose
): DynamicsToolPreviewOutputSummary | null => {
  const output = group.outputs[0];
  if (output === undefined) {
    return null;
  }

  const parameter = findEditorParameter(session, output.parameterId);
  const baseValue = parameterValues[output.parameterId] ?? parameter?.default ?? 0;
  // §3.5 output offset read in the head frame via the anchor (θ_local = θ_world − φ).
  const outputOffset = computeDynamicsOutputOffsetsWithAnchor(
    group as NormalizedDynamicsGroup,
    state,
    anchor
  ).find((candidate) => candidate.outputParameterId === output.parameterId);
  const thetaLocalDeg = outputOffset?.thetaLocalDeg ?? 0;
  const rawOffset = outputOffset?.rawOffset ?? 0;
  const offset = outputOffset?.offset ?? 0;
  const rawEffectiveValue = baseValue + offset;
  const effectiveValue =
    parameter === undefined
      ? rawEffectiveValue
      : clampParameterValue(parameter, rawEffectiveValue);

  return {
    outputParameterId: output.parameterId,
    segmentIndex: output.segmentIndex,
    thetaLocalDeg,
    baseValue,
    rawOffset,
    offset,
    rawEffectiveValue,
    effectiveValue,
    outputClamped: rawOffset !== offset,
    parameterClamped: rawEffectiveValue !== effectiveValue
  };
};

const createDisabledOutputSummary = (
  session: AuthoringSession,
  group: DynamicsToolGroup,
  parameterValues: Readonly<Record<string, number>>
): DynamicsToolPreviewOutputSummary | null => {
  const output = group.outputs[0];
  if (output === undefined) {
    return null;
  }

  const parameter = findEditorParameter(session, output.parameterId);
  const baseValue = parameterValues[output.parameterId] ?? parameter?.default ?? 0;
  return {
    outputParameterId: output.parameterId,
    segmentIndex: output.segmentIndex,
    thetaLocalDeg: 0,
    baseValue,
    rawOffset: 0,
    offset: 0,
    rawEffectiveValue: baseValue,
    effectiveValue: baseValue,
    outputClamped: false,
    parameterClamped: false
  };
};

const createResetDynamicsToolPreviewState = (
  session: AuthoringSession,
  definition: DynamicsToolGroup,
  inputValues: Readonly<Record<string, number>>,
  previousState?: RuntimeDynamicsGroupState
): RuntimeDynamicsGroupState =>
  stepDynamics({
    definition: definition as NormalizedDynamicsGroup,
    previousState,
    inputValues,
    parameterDefaults: createParameterDefaultsForGroup(session, definition),
    resetApplied: true,
    dtMs: 0
  }).state;

const findDynamicsGroup = (
  session: AuthoringSession,
  dynamicsGroupId: DynamicsGroupId
): DynamicsToolGroup | undefined =>
  session.graph.dynamicsGroups.find((group) => group.dynamicsGroupId === dynamicsGroupId);

const resolvePreviewDynamicsDefinition = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState,
  dynamicsGroupId: DynamicsGroupId
): DynamicsToolGroup | undefined => {
  const group = findDynamicsGroup(session, dynamicsGroupId);
  if (group === undefined) {
    return undefined;
  }

  return state.definitionOverridesByGroupId[dynamicsGroupId] ?? group;
};

const findEditorParameter = (
  session: AuthoringSession,
  parameterId: ParameterId | undefined
): EditorParameter | undefined => {
  if (parameterId === undefined) {
    return undefined;
  }

  return listEditorParameters(session).find((parameter) => parameter.parameterId === parameterId);
};

const cloneDynamicsInput = (input: DynamicsInputPayloadDto): DynamicsInputPayloadDto => ({
  parameterId: input.parameterId,
  kind: input.kind,
  scale: input.scale
});

const cloneDynamicsChain = (chain: DynamicsChainPayloadDto): DynamicsChainPayloadDto => ({
  rootOffset: { x: chain.rootOffset.x, y: chain.rootOffset.y },
  segmentLengths: [...chain.segmentLengths],
  damping: chain.damping,
  gravityScale: chain.gravityScale
});

const cloneDynamicsOutput = (output: DynamicsOutputPayloadDto): DynamicsOutputPayloadDto => ({
  parameterId: output.parameterId,
  segmentIndex: output.segmentIndex,
  scale: output.scale,
  limit: output.limit
});

const cloneDynamicsGroup = (group: DynamicsToolGroup): DynamicsToolGroup => ({
  dynamicsGroupId: group.dynamicsGroupId,
  displayName: group.displayName,
  enabled: group.enabled,
  ...(group.presetId === undefined ? {} : { presetId: group.presetId }),
  inputs: group.inputs.map(cloneDynamicsInput),
  chain: cloneDynamicsChain(group.chain),
  outputs: group.outputs.map(cloneDynamicsOutput)
});

const sameDynamicsDefinition = (
  left: DynamicsToolGroup,
  right: DynamicsToolGroup
): boolean =>
  left.dynamicsGroupId === right.dynamicsGroupId &&
  left.displayName === right.displayName &&
  left.enabled === right.enabled &&
  left.presetId === right.presetId &&
  sameDynamicsInputs(left.inputs, right.inputs) &&
  sameDynamicsChain(left.chain, right.chain) &&
  sameDynamicsOutputs(left.outputs, right.outputs);

const sameDynamicsInputs = (
  left: readonly DynamicsInputPayloadDto[],
  right: readonly DynamicsInputPayloadDto[]
): boolean =>
  left.length === right.length &&
  left.every((input, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      input.parameterId === other.parameterId &&
      input.kind === other.kind &&
      input.scale === other.scale
    );
  });

const sameDynamicsChain = (
  left: DynamicsChainPayloadDto,
  right: DynamicsChainPayloadDto
): boolean =>
  left.rootOffset.x === right.rootOffset.x &&
  left.rootOffset.y === right.rootOffset.y &&
  left.damping === right.damping &&
  left.gravityScale === right.gravityScale &&
  left.segmentLengths.length === right.segmentLengths.length &&
  left.segmentLengths.every((length, index) => length === right.segmentLengths[index]);

const sameDynamicsOutputs = (
  left: readonly DynamicsOutputPayloadDto[],
  right: readonly DynamicsOutputPayloadDto[]
): boolean =>
  left.length === right.length &&
  left.every((output, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      output.parameterId === other.parameterId &&
      output.segmentIndex === other.segmentIndex &&
      output.scale === other.scale &&
      output.limit === other.limit
    );
  });

const errorIssue = (
  code: string,
  message: string,
  path?: string
): DynamicsToolValidationIssue => ({
  severity: "error",
  code,
  message,
  ...(path === undefined ? {} : { path })
});

const warningIssue = (
  code: string,
  message: string,
  path?: string
): DynamicsToolValidationIssue => ({
  severity: "warning",
  code,
  message,
  ...(path === undefined ? {} : { path })
});

const resolveDiagnosticDynamicsGroupIds = (
  item: EditorDiagnosticItem
): readonly DynamicsGroupId[] => {
  const ids: DynamicsGroupId[] = [];
  if (item.target.kind === "dynamicsGroup") {
    ids.push(item.target.id as DynamicsGroupId);
  }

  for (const hint of item.actionHints ?? []) {
    if (hint.target.kind === "dynamicsGroup") {
      ids.push(hint.target.id as DynamicsGroupId);
    }
  }

  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
};

const isDynamicsToolPresetId = (
  value: string | undefined
): value is DynamicsToolPresetId =>
  value === "hair" ||
  value === "ribbon" ||
  value === "softCloth" ||
  value === "rigidAccessory";

const normalizePreviewNumber = (value: number): number => Number(value.toFixed(6));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const ZERO_ANCHOR: DynamicsAnchorPose = { phiDeg: 0, pin: { x: 0, y: 0 } };

function sameDynamicsPreviewValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.000001;
}
