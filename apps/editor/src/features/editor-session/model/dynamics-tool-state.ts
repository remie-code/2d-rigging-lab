import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DynamicsGroupId,
  ParameterId,
  RuntimeDynamicsGroupState
} from "@private-2d-rigging-lab/contracts";
import type {
  CreateDynamicsGroupPayloadDto,
  DynamicsInputPayloadDto,
  DynamicsOutputPayloadDto,
  DynamicsPendulumPayloadDto,
  UpdateDynamicsGroupPayloadDto
} from "@private-2d-rigging-lab/operation-core";

import type { ParameterValueMap } from "./parameter-keyform-state";
import {
  clampParameterValue,
  listEditorParameters,
  type EditorParameter
} from "./parameter-keyform-state";

export type DynamicsAxisKind = "angle" | "positionX" | "positionY";
export type DynamicsToolPresetId = "hair" | "ribbon" | "softCloth" | "rigidAccessory";
export type DynamicsToolGroup = AuthoringSession["graph"]["dynamicsGroups"][number];

export interface DynamicsToolPreset {
  readonly presetId: DynamicsToolPresetId;
  readonly label: string;
  readonly pendulum: DynamicsPendulumPayloadDto;
  readonly outputStrengthScale: number;
  readonly outputLimitScale: number;
}

export interface DynamicsToolDraft {
  readonly dynamicsGroupId?: DynamicsGroupId;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly presetId: DynamicsToolPresetId;
  readonly inputs: readonly DynamicsInputPayloadDto[];
  readonly pendulums: readonly DynamicsPendulumPayloadDto[];
  readonly outputs: readonly DynamicsOutputPayloadDto[];
}

export interface DynamicsToolValidationIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface DynamicsToolPreviewState {
  readonly selectedGroupId: DynamicsGroupId | null;
  readonly driverValuesByGroupId: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly simulationStatesByGroupId: Readonly<Record<string, RuntimeDynamicsGroupState>>;
  readonly resetSerial: number;
}

export interface DynamicsToolPreviewOutputSummary {
  readonly outputParameterId: ParameterId;
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
  readonly source: number;
  readonly rawSource: number;
  readonly state: RuntimeDynamicsGroupState | null;
  readonly output: DynamicsToolPreviewOutputSummary | null;
}

export const DYNAMICS_TOOL_PREVIEW_STEP_MS = 16.6666667;

export const DYNAMICS_TOOL_PRESETS: readonly DynamicsToolPreset[] = [
  {
    presetId: "hair",
    label: "Hair",
    pendulum: {
      length: 0.85,
      sway: 0.75,
      reactionSpeed: 12,
      convergenceSpeed: 4
    },
    outputStrengthScale: 0.35,
    outputLimitScale: 0.5
  },
  {
    presetId: "ribbon",
    label: "Ribbon",
    pendulum: {
      length: 0.55,
      sway: 0.9,
      reactionSpeed: 16,
      convergenceSpeed: 5
    },
    outputStrengthScale: 0.45,
    outputLimitScale: 0.55
  },
  {
    presetId: "softCloth",
    label: "Soft Cloth",
    pendulum: {
      length: 1.15,
      sway: 0.55,
      reactionSpeed: 8,
      convergenceSpeed: 3
    },
    outputStrengthScale: 0.3,
    outputLimitScale: 0.45
  },
  {
    presetId: "rigidAccessory",
    label: "Rigid Accessory",
    pendulum: {
      length: 0.4,
      sway: 0.35,
      reactionSpeed: 22,
      convergenceSpeed: 8
    },
    outputStrengthScale: 0.2,
    outputLimitScale: 0.35
  }
] as const;

export const createInitialDynamicsToolPreviewState = (): DynamicsToolPreviewState => ({
  selectedGroupId: null,
  driverValuesByGroupId: {},
  simulationStatesByGroupId: {},
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
    pendulums: [structuredClone(preset.pendulum)],
    outputs:
      outputParameter === undefined
        ? []
        : [createDefaultDynamicsOutput(outputParameter, preset)]
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
  pendulums: group.pendulums.map(cloneDynamicsPendulum),
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
  pendulums: draft.pendulums.map(cloneDynamicsPendulum),
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
  pendulums: draft.pendulums.map(cloneDynamicsPendulum),
  outputs: draft.outputs.map(cloneDynamicsOutput)
});

export const createDefaultDynamicsInput = (
  parameter: EditorParameter
): DynamicsInputPayloadDto => ({
  parameterId: parameter.parameterId,
  kind: "angle",
  influencePercent: 100,
  invert: false,
  normalization: {
    min: parameter.min,
    center: parameter.default,
    max: parameter.max
  }
});

export const createDefaultDynamicsOutput = (
  parameter: EditorParameter,
  preset: DynamicsToolPreset = getDynamicsToolPreset("hair")
): DynamicsOutputPayloadDto => {
  const range = Math.max(Math.abs(parameter.max - parameter.min), parameter.recommendedUiStep, 1);
  const limit = normalizePreviewNumber(range * preset.outputLimitScale);

  return {
    parameterId: parameter.parameterId,
    kind: "angle",
    strength: normalizePreviewNumber(limit * preset.outputStrengthScale),
    invert: false,
    limit
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
  session: AuthoringSession,
  draft: DynamicsToolDraft,
  inputIndex: number,
  patch: Partial<DynamicsInputPayloadDto>
): DynamicsToolDraft => ({
  ...draft,
  inputs: draft.inputs.map((input, index) => {
    if (index !== inputIndex) {
      return input;
    }

    const parameter = findEditorParameter(session, patch.parameterId ?? input.parameterId);
    return {
      ...input,
      ...patch,
      normalization:
        patch.parameterId !== undefined && parameter !== undefined
          ? createDefaultDynamicsInput(parameter).normalization
          : patch.normalization ?? input.normalization
    };
  })
});

export const updateDynamicsDraftPendulum = (
  draft: DynamicsToolDraft,
  patch: Partial<DynamicsPendulumPayloadDto>
): DynamicsToolDraft => ({
  ...draft,
  pendulums: [
    {
      ...(draft.pendulums[0] ?? getDynamicsToolPreset(draft.presetId).pendulum),
      ...patch
    }
  ]
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
    (parameter === undefined
      ? undefined
      : createDefaultDynamicsOutput(parameter, getDynamicsToolPreset(draft.presetId)));

  if (nextOutput === undefined) {
    return draft;
  }

  const resetForParameter =
    patch.parameterId !== undefined && parameter !== undefined
      ? createDefaultDynamicsOutput(parameter, getDynamicsToolPreset(draft.presetId))
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

    if (
      input.normalization.min >= input.normalization.center ||
      input.normalization.center >= input.normalization.max
    ) {
      issues.push(
        errorIssue(
          "dynamicsTool.normalizationInvalid",
          "Input normalization requires min < center < max.",
          `/inputs/${index}/normalization`
        )
      );
    }
  });

  if (draft.pendulums.length !== 1) {
    issues.push(
      errorIssue(
        "dynamicsTool.pendulumCardinalityInvalid",
        "Dynamics v0 requires exactly one pendulum.",
        "/pendulums"
      )
    );
  }

  const pendulum = draft.pendulums[0];
  if (pendulum !== undefined) {
    if (pendulum.length <= 0) {
      issues.push(errorIssue("dynamicsTool.pendulumLengthInvalid", "Length must be greater than 0.", "/pendulums/0/length"));
    }
    if (pendulum.sway < 0 || pendulum.reactionSpeed < 0 || pendulum.convergenceSpeed < 0) {
      issues.push(
        errorIssue(
          "dynamicsTool.pendulumCoefficientInvalid",
          "Pendulum coefficients must be non-negative.",
          "/pendulums/0"
        )
      );
    }
    if (pendulum.reactionSpeed > 60 || pendulum.convergenceSpeed > 30 || pendulum.sway > 10) {
      issues.push(
        warningIssue(
          "dynamicsTool.pendulumCoefficientExtreme",
          "Pendulum coefficients are high and may be unstable.",
          "/pendulums/0"
        )
      );
    }
  }

  if (draft.outputs.length !== 1) {
    issues.push(
      errorIssue(
        "dynamicsTool.outputCardinalityInvalid",
        "Dynamics v0 requires exactly one output.",
        "/outputs"
      )
    );
  }

  const output = draft.outputs[0];
  if (output !== undefined) {
    if (!parametersById.has(output.parameterId)) {
      issues.push(
        errorIssue(
          "dynamicsTool.outputParameterMissing",
          `Output parameter is missing: ${output.parameterId}.`,
          "/outputs/0/parameterId"
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
          "/outputs/0/parameterId"
        )
      );
    }

    if (output.strength === 0) {
      issues.push(
        warningIssue(
          "dynamicsTool.outputStrengthZero",
          "Output strength is zero.",
          "/outputs/0/strength"
        )
      );
    }
    if (output.limit <= 0.000001) {
      issues.push(
        warningIssue(
          "dynamicsTool.outputLimitTooSmall",
          "Output limit is too small to show visible motion.",
          "/outputs/0/limit"
        )
      );
    }
  }

  if (draft.inputs.length > 0 && draft.inputs.every((input) => input.influencePercent === 0)) {
    issues.push(
      warningIssue(
        "dynamicsTool.inputInfluenceZero",
        "All input influences are zero.",
        "/inputs"
      )
    );
  }

  return issues;
};

export const hasBlockingDynamicsToolIssues = (
  issues: readonly DynamicsToolValidationIssue[]
): boolean => issues.some((issue) => issue.severity === "error");

export const selectDynamicsToolPreviewGroup = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState,
  selectedGroupId: DynamicsGroupId | null
): DynamicsToolPreviewState => {
  if (selectedGroupId === null) {
    return {
      ...state,
      selectedGroupId: null
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
            [selectedGroupId]: createResetDynamicsState(computeDynamicsSource(group, driverValues).source, 0, true)
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
  const driverValues = {
    ...currentDriverValues,
    [input.parameterId]: nextValue
  };
  const previousState = state.simulationStatesByGroupId[input.dynamicsGroupId];
  const stepped = stepDynamicsToolPreview({
    definition: group,
    inputValues: driverValues,
    previousState,
    resetApplied: false
  });

  return {
    ...state,
    selectedGroupId: input.dynamicsGroupId,
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

export const resetDynamicsToolPreviewSimulation = (
  session: AuthoringSession,
  state: DynamicsToolPreviewState,
  dynamicsGroupId: DynamicsGroupId | null = state.selectedGroupId
): DynamicsToolPreviewState => {
  if (dynamicsGroupId === null) {
    return state;
  }

  const group = findDynamicsGroup(session, dynamicsGroupId);
  if (group === undefined) {
    return state;
  }

  const driverValues = state.driverValuesByGroupId[dynamicsGroupId] ?? createDefaultDriverValues(session, group);
  const source = computeDynamicsSource(group, driverValues).source;
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
      [dynamicsGroupId]: createResetDynamicsState(source, previousState?.resetCounter ?? 0, true)
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
      source: 0,
      rawSource: 0,
      state: null,
      output: null
    };
  }

  const group = findDynamicsGroup(session, selectedGroupId);
  if (group === undefined) {
    return {
      selectedGroupId: null,
      parameterValues: baseParameterValues,
      driverValues: {},
      source: 0,
      rawSource: 0,
      state: null,
      output: null
    };
  }

  const driverValues = {
    ...createDefaultDriverValues(session, group),
    ...(state.driverValuesByGroupId[selectedGroupId] ?? {})
  } as Readonly<Record<ParameterId, number>>;
  const source = computeDynamicsSource(group, driverValues);
  const dynamicsState =
    state.simulationStatesByGroupId[selectedGroupId] ??
    createResetDynamicsState(source.source, 0, true);
  const parameterValues: Record<string, number> = {
    ...baseParameterValues,
    ...driverValues
  };
  const output =
    group.enabled === false
      ? createDisabledOutputSummary(session, group, parameterValues)
      : createPreviewOutputSummary(session, group, parameterValues, dynamicsState);

  if (output !== null) {
    parameterValues[output.outputParameterId] = output.effectiveValue;
  }

  return {
    selectedGroupId,
    parameterValues,
    driverValues,
    source: source.source,
    rawSource: source.rawSource,
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

const createDefaultDriverValues = (
  session: AuthoringSession,
  group: DynamicsToolGroup
): Readonly<Record<ParameterId, number>> =>
  Object.fromEntries(
    group.inputs.map((input) => {
      const parameter = findEditorParameter(session, input.parameterId);
      return [input.parameterId, parameter?.default ?? input.normalization.center];
    })
  ) as Readonly<Record<ParameterId, number>>;

const stepDynamicsToolPreview = (input: {
  readonly definition: DynamicsToolGroup;
  readonly previousState: RuntimeDynamicsGroupState | undefined;
  readonly inputValues: Readonly<Record<string, number>>;
  readonly resetApplied: boolean;
}): {
  readonly state: RuntimeDynamicsGroupState;
  readonly source: ReturnType<typeof computeDynamicsSource>;
} => {
  const source = computeDynamicsSource(input.definition, input.inputValues);
  const previousState =
    input.resetApplied || input.previousState === undefined
      ? createResetDynamicsState(source.source, input.previousState?.resetCounter ?? 0, input.resetApplied)
      : input.previousState;
  const pendulum = input.definition.pendulums[0];
  if (input.resetApplied || pendulum === undefined || !input.definition.enabled) {
    return {
      state: previousState,
      source
    };
  }

  const dtSeconds = DYNAMICS_TOOL_PREVIEW_STEP_MS / 1000;
  const length = Math.max(pendulum.length, 0.0001);
  const sourceVelocity = (source.source - previousState.previousSource) / dtSeconds;
  const sourceAcceleration = (sourceVelocity - previousState.previousSourceVelocity) / dtSeconds;
  const angularAcceleration =
    ((source.source - previousState.angle) * pendulum.reactionSpeed) / length +
    sourceAcceleration * pendulum.sway -
    previousState.angularVelocity * pendulum.convergenceSpeed;
  const angularVelocity = previousState.angularVelocity + angularAcceleration * dtSeconds;
  const angle = previousState.angle + angularVelocity * dtSeconds;

  return {
    source,
    state: {
      angle,
      angularVelocity,
      previousSource: source.source,
      previousSourceVelocity: sourceVelocity,
      tick: previousState.tick + 1,
      resetCounter: previousState.resetCounter
    }
  };
};

const computeDynamicsSource = (
  group: DynamicsToolGroup,
  inputValues: Readonly<Record<string, number>>
): {
  readonly rawSource: number;
  readonly source: number;
} => {
  const rawSource = group.inputs.reduce((sum, input) => {
    const value = inputValues[input.parameterId] ?? input.normalization.center;
    const normalized = normalizeDynamicsInput(value, input);
    const signed = input.invert ? -normalized : normalized;
    return sum + signed * (input.influencePercent / 100);
  }, 0);

  return {
    rawSource,
    source: rawSource
  };
};

const normalizeDynamicsInput = (
  value: number,
  input: DynamicsInputPayloadDto
): number => {
  const { min, center, max } = input.normalization;
  if (min >= center || center >= max) {
    return 0;
  }

  if (value === center) {
    return 0;
  }

  if (value > center) {
    return clamp((value - center) / (max - center), 0, 1);
  }

  return clamp((value - center) / (center - min), -1, 0);
};

const createPreviewOutputSummary = (
  session: AuthoringSession,
  group: DynamicsToolGroup,
  parameterValues: Readonly<Record<string, number>>,
  state: RuntimeDynamicsGroupState
): DynamicsToolPreviewOutputSummary | null => {
  const output = group.outputs[0];
  if (output === undefined) {
    return null;
  }

  const parameter = findEditorParameter(session, output.parameterId);
  const baseValue = parameterValues[output.parameterId] ?? parameter?.default ?? 0;
  const signedStrength = output.invert ? -output.strength : output.strength;
  const rawOffset = state.angle * signedStrength;
  const offset = clamp(rawOffset, -Math.abs(output.limit), Math.abs(output.limit));
  const rawEffectiveValue = baseValue + offset;
  const effectiveValue =
    parameter === undefined
      ? rawEffectiveValue
      : clampParameterValue(parameter, rawEffectiveValue);

  return {
    outputParameterId: output.parameterId,
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
    baseValue,
    rawOffset: 0,
    offset: 0,
    rawEffectiveValue: baseValue,
    effectiveValue: baseValue,
    outputClamped: false,
    parameterClamped: false
  };
};

const createResetDynamicsState = (
  source: number,
  previousResetCounter: number,
  resetApplied: boolean
): RuntimeDynamicsGroupState => ({
  angle: source,
  angularVelocity: 0,
  previousSource: source,
  previousSourceVelocity: 0,
  tick: 0,
  resetCounter: previousResetCounter + (resetApplied || previousResetCounter === 0 ? 1 : 0)
});

const findDynamicsGroup = (
  session: AuthoringSession,
  dynamicsGroupId: DynamicsGroupId
): DynamicsToolGroup | undefined =>
  session.graph.dynamicsGroups.find((group) => group.dynamicsGroupId === dynamicsGroupId);

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
  influencePercent: input.influencePercent,
  invert: input.invert,
  normalization: {
    min: input.normalization.min,
    center: input.normalization.center,
    max: input.normalization.max
  }
});

const cloneDynamicsPendulum = (
  pendulum: DynamicsPendulumPayloadDto
): DynamicsPendulumPayloadDto => ({
  length: pendulum.length,
  sway: pendulum.sway,
  reactionSpeed: pendulum.reactionSpeed,
  convergenceSpeed: pendulum.convergenceSpeed
});

const cloneDynamicsOutput = (output: DynamicsOutputPayloadDto): DynamicsOutputPayloadDto => ({
  parameterId: output.parameterId,
  kind: output.kind,
  strength: output.strength,
  invert: output.invert,
  limit: output.limit
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
