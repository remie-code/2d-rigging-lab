import {
  listInitializedParameters,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DrawableId,
  ParameterId,
  RigControlId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import type {
  EditKeyformKeyPayloadDto,
  StatePatchValueDto
} from "@private-2d-rigging-lab/operation-core";

export type EditorParameter = ReturnType<typeof listInitializedParameters>[number];
type KeyformSetDto = AuthoringSession["graph"]["keyformSets"][number];
type LinearKeyformSetDto = Extract<KeyformSetDto, { readonly evaluator: "linear-1d-v1" }>;
type RigControlDto = AuthoringSession["graph"]["rigControls"][number];
type RotationRigControlDto = Extract<RigControlDto, { readonly kind: "rotation2d" }>;
type WarpRigControlDto = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;

export type ParameterValueMap = Readonly<Record<string, number>>;
export type ParameterKeyformProperty =
  | "opacity"
  | "angleDegrees"
  | "controlPointOffsets"
  | "opacityMultiplier";
export type ParameterKeyformValue = number | readonly Vec2Dto[];
export type ParameterKeyformValueKind = "number" | "controlPointOffsets";
export type ParameterKeyformTarget = {
  readonly kind: "drawable" | "rigControl";
  readonly id: string;
};

export interface ParameterKeyMarker {
  readonly value: number;
  readonly selected: boolean;
}

export interface ParameterBarProjection {
  readonly parameters: readonly EditorParameter[];
  readonly activeParameter: EditorParameter | null;
  readonly currentValue: number;
  readonly keyMarkers: readonly ParameterKeyMarker[];
  readonly canCreateEnds: boolean;
  readonly canCreateEndsCenter: boolean;
}

export interface ParameterKeyformBindingDescriptor {
  readonly label: string;
  readonly target: ParameterKeyformTarget;
  readonly targetProperty: ParameterKeyformProperty;
  readonly valueKind: ParameterKeyformValueKind;
  readonly baseValue: ParameterKeyformValue;
  readonly compositionMode?: "replace" | "additiveDelta" | "multiplyOpacity";
  readonly numericRange?: {
    readonly min: number;
    readonly max: number;
    readonly step: number;
  };
}

export interface ParameterBindingProjection {
  readonly binding: ParameterKeyformBindingDescriptor;
  readonly parameter: EditorParameter | null;
  readonly currentParameterValue: number;
  readonly keyMarkers: readonly ParameterKeyMarker[];
  readonly hasBinding: boolean;
  readonly hasCurrentKeyform: boolean;
  readonly displayValue: ParameterKeyformValue;
  readonly source: "static" | "keyform" | "interpolated";
  readonly canEditValue: boolean;
  readonly canAddCurrent: boolean;
  readonly canUpdateCurrent: boolean;
  readonly canDeleteCurrent: boolean;
  readonly canCreateEnds: boolean;
  readonly canCreateEndsCenter: boolean;
  readonly disabledReason: string | null;
}

export interface EvaluatedParameterKeyformState {
  readonly drawableOpacityById: ReadonlyMap<DrawableId, number>;
  readonly rigOpacityMultiplierById: ReadonlyMap<RigControlId, number>;
  readonly rigAngleDegreesById: ReadonlyMap<RigControlId, number>;
  readonly rigControlPointOffsetsById: ReadonlyMap<RigControlId, readonly Vec2Dto[]>;
}

export const listEditorParameters = (
  session: AuthoringSession
): readonly EditorParameter[] => listInitializedParameters(session.graph);

export const resolveActiveParameterId = (
  session: AuthoringSession,
  currentActiveParameterId: ParameterId | null
): ParameterId | null => {
  const parameters = listEditorParameters(session);
  if (
    currentActiveParameterId !== null &&
    parameters.some((parameter) => parameter.parameterId === currentActiveParameterId)
  ) {
    return currentActiveParameterId;
  }

  return parameters[0]?.parameterId ?? null;
};

export const createParameterBarProjection = (
  session: AuthoringSession,
  activeParameterId: ParameterId | null,
  parameterValues: ParameterValueMap
): ParameterBarProjection => {
  const parameters = listEditorParameters(session);
  const activeParameter =
    activeParameterId === null
      ? null
      : parameters.find((parameter) => parameter.parameterId === activeParameterId) ?? null;
  const currentValue =
    activeParameter === null
      ? 0
      : resolveParameterCurrentValue(activeParameter, parameterValues);

  return {
    parameters,
    activeParameter,
    currentValue,
    keyMarkers:
      activeParameter === null
        ? []
        : createParameterKeyMarkers(session, activeParameter.parameterId, currentValue),
    canCreateEnds: activeParameter !== null && activeParameter.min !== activeParameter.max,
    canCreateEndsCenter:
      activeParameter !== null &&
      hasDistinctKeyPositions(activeParameter.min, activeParameter.default, activeParameter.max)
  };
};

export const resolveParameterCurrentValue = (
  parameter: EditorParameter,
  parameterValues: ParameterValueMap
): number => {
  const value = parameterValues[parameter.parameterId] ?? parameter.default;
  return clampParameterValue(parameter, value);
};

export const clampParameterValue = (
  parameter: EditorParameter,
  value: number
): number => {
  if (!Number.isFinite(value)) {
    return parameter.default;
  }

  return Math.min(Math.max(value, parameter.min), parameter.max);
};

export const formatParameterValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

export const formatKeyMarkers = (markers: readonly ParameterKeyMarker[]): string => {
  if (markers.length === 0) {
    return "No keys";
  }

  return markers.map((marker) => formatParameterValue(marker.value)).join(", ");
};

export const createParameterKeyMarkers = (
  session: AuthoringSession,
  parameterId: ParameterId,
  currentValue: number
): readonly ParameterKeyMarker[] => {
  const markerValues = new Set<number>();
  for (const keyformSet of session.graph.keyformSets) {
    if (keyformSet.evaluator !== "linear-1d-v1" || keyformSet.parameterId !== parameterId) {
      continue;
    }

    for (const key of keyformSet.keys) {
      markerValues.add(key.value);
    }
  }

  return [...markerValues]
    .sort((left, right) => left - right)
    .map((value) => ({
      value,
      selected: sameKeyValue(value, currentValue)
    }));
};

export const createDrawableOpacityBinding = (
  session: AuthoringSession,
  drawableId: DrawableId
): ParameterKeyformBindingDescriptor | undefined => {
  const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined) {
    return undefined;
  }

  return {
    label: "Drawable opacity",
    target: {
      kind: "drawable",
      id: drawable.drawableId
    },
    targetProperty: "opacity",
    valueKind: "number",
    baseValue: drawable.defaultOpacity,
    compositionMode: "replace",
    numericRange: {
      min: 0,
      max: 1,
      step: 0.01
    }
  };
};

export const createRigControlParameterBindings = (
  session: AuthoringSession,
  rigControlId: RigControlId
): readonly ParameterKeyformBindingDescriptor[] => {
  const rigControl = session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === rigControlId
  );
  if (rigControl === undefined) {
    return [];
  }

  if (rigControl.kind === "rotation2d") {
    return [
      createRotationAngleBinding(rigControl),
      createRigOpacityMultiplierBinding(rigControl)
    ];
  }

  if (rigControl.kind === "warpLattice2d") {
    return [
      createWarpControlPointOffsetsBinding(rigControl),
      createRigOpacityMultiplierBinding(rigControl)
    ];
  }

  return [];
};

export const createParameterBindingProjection = (
  session: AuthoringSession,
  binding: ParameterKeyformBindingDescriptor,
  activeParameterId: ParameterId | null,
  parameterValues: ParameterValueMap
): ParameterBindingProjection => {
  const parameter =
    activeParameterId === null
      ? null
      : listEditorParameters(session).find(
          (candidate) => candidate.parameterId === activeParameterId
        ) ?? null;
  const currentParameterValue =
    parameter === null ? 0 : resolveParameterCurrentValue(parameter, parameterValues);
  const keyformSet =
    parameter === null
      ? undefined
      : findLinearKeyformSet(session, binding, parameter.parameterId);
  const sampled =
    keyformSet === undefined
      ? {
          value: cloneKeyformValue(binding.baseValue),
          exact: false,
          source: "static" as const
        }
      : sampleLinearKeyformValue(keyformSet, currentParameterValue);
  const hasCurrentKeyform =
    keyformSet?.keys.some((key) => sameKeyValue(key.value, currentParameterValue)) ?? false;
  const disabledReason =
    parameter === null
      ? "Select an active parameter."
      : hasCurrentKeyform
        ? null
        : "Add a keyform at the current value to edit this property.";

  return {
    binding,
    parameter,
    currentParameterValue,
    keyMarkers:
      parameter === null
        ? []
        : createBindingKeyMarkers(keyformSet, currentParameterValue),
    hasBinding: keyformSet !== undefined,
    hasCurrentKeyform,
    displayValue: sampled.value,
    source: sampled.source,
    canEditValue: parameter !== null && hasCurrentKeyform,
    canAddCurrent: parameter !== null && !hasCurrentKeyform,
    canUpdateCurrent: parameter !== null && hasCurrentKeyform,
    canDeleteCurrent: parameter !== null && hasCurrentKeyform,
    canCreateEnds: parameter !== null && parameter.min !== parameter.max,
    canCreateEndsCenter:
      parameter !== null &&
      hasDistinctKeyPositions(parameter.min, parameter.default, parameter.max),
    disabledReason
  };
};

export const createEditKeyformPayload = (input: {
  readonly binding: ParameterKeyformBindingDescriptor;
  readonly parameter: EditorParameter;
  readonly currentParameterValue: number;
  readonly action: EditKeyformKeyPayloadDto["action"];
  readonly value: ParameterKeyformValue;
}): EditKeyformKeyPayloadDto => {
  const base = {
    target: input.binding.target,
    targetProperty: input.binding.targetProperty,
    parameterId: input.parameter.parameterId,
    interpolation: "linear-1d-v1" as const,
    ...(input.binding.compositionMode === undefined
      ? {}
      : { compositionMode: input.binding.compositionMode })
  };

  if (input.action === "deleteCurrent") {
    return {
      ...base,
      action: input.action,
      keyValue: input.currentParameterValue
    };
  }

  if (input.action === "addCurrent" || input.action === "updateCurrent") {
    return {
      ...base,
      action: input.action,
      keyValue: input.currentParameterValue,
      statePatch: createStatePatch(input.binding, input.value)
    };
  }

  if (input.action === "createEnds") {
    return {
      ...base,
      action: input.action,
      statePatches: {
        min: createStatePatch(input.binding, input.value),
        max: createStatePatch(input.binding, input.value)
      }
    };
  }

  return {
    ...base,
    action: input.action,
    statePatches: {
      min: createStatePatch(input.binding, input.value),
      default: createStatePatch(input.binding, input.value),
      max: createStatePatch(input.binding, input.value)
    }
  };
};

export const coerceBindingValue = (
  binding: ParameterKeyformBindingDescriptor,
  value: ParameterKeyformValue
): ParameterKeyformValue => {
  if (binding.valueKind === "controlPointOffsets") {
    return Array.isArray(value)
      ? normalizeOffsets(value, getControlPointCount(binding.baseValue))
      : createUniformControlPointOffsets(getControlPointCount(binding.baseValue), 0, 0);
  }

  const numeric = typeof value === "number" ? value : 0;
  if (binding.numericRange === undefined) {
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return Math.min(Math.max(numeric, binding.numericRange.min), binding.numericRange.max);
};

export const createUniformControlPointOffsets = (
  count: number,
  x: number,
  y: number
): readonly Vec2Dto[] =>
  Array.from({ length: Math.max(0, count) }, () => ({
    x: finiteOrZero(x),
    y: finiteOrZero(y)
  }));

export const getControlPointCount = (value: ParameterKeyformValue): number =>
  Array.isArray(value) ? value.length : 0;

export const readUniformOffset = (
  value: ParameterKeyformValue,
  axis: "x" | "y"
): number => {
  if (!Array.isArray(value) || value.length === 0) {
    return 0;
  }

  return value[0]?.[axis] ?? 0;
};

export const createEvaluatedParameterKeyformState = (
  session: AuthoringSession,
  parameterValues: ParameterValueMap
): EvaluatedParameterKeyformState => {
  const parametersById = new Map(
    listEditorParameters(session).map((parameter) => [parameter.parameterId, parameter])
  );
  const drawableOpacityById = new Map<DrawableId, number>();
  const rigOpacityMultiplierById = new Map<RigControlId, number>();
  const rigAngleDegreesById = new Map<RigControlId, number>();
  const rigControlPointOffsetsById = new Map<RigControlId, readonly Vec2Dto[]>();
  const drawablesById = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const rigControlsById = new Map(
    session.graph.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );

  for (const keyformSet of sortLinearKeyformSets(session.graph.keyformSets)) {
    const parameter = parametersById.get(keyformSet.parameterId);
    if (parameter === undefined) {
      continue;
    }

    const currentParameterValue = resolveParameterCurrentValue(parameter, parameterValues);
    const sampled = sampleLinearKeyformValue(keyformSet, currentParameterValue).value;
    const target = keyformSet.target;

    if (target.kind === "drawable" && target.property === "opacity") {
      const drawableId = target.id as DrawableId;
      const drawable = drawablesById.get(drawableId);
      if (drawable === undefined || typeof sampled !== "number") {
        continue;
      }

      const current = drawableOpacityById.get(drawableId) ?? drawable.defaultOpacity;
      drawableOpacityById.set(
        drawableId,
        clamp01(applyNumericComposition(current, sampled, keyformSet.compositionMode))
      );
      continue;
    }

    if (target.kind !== "rigControl") {
      continue;
    }

    const rigControlId = target.id as RigControlId;
    const rigControl = rigControlsById.get(rigControlId);
    if (rigControl === undefined) {
      continue;
    }

    if (target.property === "opacityMultiplier" && typeof sampled === "number") {
      const current =
        rigOpacityMultiplierById.get(rigControlId) ?? rigControl.opacityMultiplier ?? 1;
      rigOpacityMultiplierById.set(
        rigControlId,
        clamp01(applyNumericComposition(current, sampled, keyformSet.compositionMode))
      );
      continue;
    }

    if (
      target.property === "angleDegrees" &&
      rigControl.kind === "rotation2d" &&
      typeof sampled === "number"
    ) {
      const current = rigAngleDegreesById.get(rigControlId) ?? rigControl.restAngleDegrees;
      rigAngleDegreesById.set(
        rigControlId,
        applyNumericComposition(current, sampled, keyformSet.compositionMode)
      );
      continue;
    }

    if (
      target.property === "controlPointOffsets" &&
      rigControl.kind === "warpLattice2d" &&
      Array.isArray(sampled)
    ) {
      const expectedCount = rigControl.restControlPoints.length;
      const current =
        rigControlPointOffsetsById.get(rigControlId) ??
        createUniformControlPointOffsets(expectedCount, 0, 0);
      rigControlPointOffsetsById.set(
        rigControlId,
        keyformSet.compositionMode === "additiveDelta"
          ? addOffsets(current, sampled, expectedCount)
          : normalizeOffsets(sampled, expectedCount)
      );
    }
  }

  return {
    drawableOpacityById,
    rigOpacityMultiplierById,
    rigAngleDegreesById,
    rigControlPointOffsetsById
  };
};

export const formatKeyformFeedback = (
  diagnostics: readonly { readonly checkId: string; readonly message: string }[]
): string => {
  const checkId = diagnostics[0]?.checkId;
  if (checkId === undefined) {
    return "No keyform change was applied.";
  }

  switch (checkId) {
    case "operation.editKeyformKey.duplicateKey":
      return "A keyform already exists at this parameter value.";
    case "operation.editKeyformKey.missingKey":
      return "No keyform exists at this parameter value.";
    case "operation.editKeyformKey.missingBinding":
      return "No keyform binding exists for this target.";
    case "operation.editKeyformKey.keyOutOfRange":
      return "The parameter value is outside the parameter range.";
    case "operation.editKeyformKey.invalidPatchShape":
      return "The edited value is not valid for this target property.";
    case "operation.editKeyformKey.unsupportedTargetProperty":
      return "This target property cannot be keyformed in v0.";
    case "operation.editKeyformKey.missingParameter":
      return "The active parameter no longer exists.";
    case "operation.editKeyformKey.missingTarget":
      return "The selected target no longer exists.";
    case "operation.editKeyformKey.statePatchPropertyMismatch":
      return "The keyform payload does not match the target property.";
    default:
      return diagnostics[0]?.message ?? "Keyform operation was rejected.";
  }
};

function createRotationAngleBinding(
  rigControl: RotationRigControlDto
): ParameterKeyformBindingDescriptor {
  return {
    label: "Rotation angle",
    target: {
      kind: "rigControl",
      id: rigControl.rigControlId
    },
    targetProperty: "angleDegrees",
    valueKind: "number",
    baseValue: rigControl.restAngleDegrees,
    compositionMode: "replace",
    numericRange: {
      min: -180,
      max: 180,
      step: 1
    }
  };
}

function createRigOpacityMultiplierBinding(
  rigControl: RotationRigControlDto | WarpRigControlDto
): ParameterKeyformBindingDescriptor {
  return {
    label: "Opacity multiplier",
    target: {
      kind: "rigControl",
      id: rigControl.rigControlId
    },
    targetProperty: "opacityMultiplier",
    valueKind: "number",
    baseValue: rigControl.opacityMultiplier ?? 1,
    compositionMode: "replace",
    numericRange: {
      min: 0,
      max: 1,
      step: 0.01
    }
  };
}

function createWarpControlPointOffsetsBinding(
  rigControl: WarpRigControlDto
): ParameterKeyformBindingDescriptor {
  return {
    label: "Warp lattice offsets",
    target: {
      kind: "rigControl",
      id: rigControl.rigControlId
    },
    targetProperty: "controlPointOffsets",
    valueKind: "controlPointOffsets",
    baseValue: createUniformControlPointOffsets(rigControl.restControlPoints.length, 0, 0),
    compositionMode: "replace",
    numericRange: {
      min: -9999,
      max: 9999,
      step: 1
    }
  };
}

function createStatePatch(
  binding: ParameterKeyformBindingDescriptor,
  value: ParameterKeyformValue
): { readonly propertyPath: string; readonly value: StatePatchValueDto } {
  return {
    propertyPath: binding.targetProperty,
    value: cloneStatePatchValue(coerceBindingValue(binding, value))
  };
}

function findLinearKeyformSet(
  session: AuthoringSession,
  binding: ParameterKeyformBindingDescriptor,
  parameterId: ParameterId
): LinearKeyformSetDto | undefined {
  return session.graph.keyformSets.find(
    (keyformSet): keyformSet is LinearKeyformSetDto =>
      keyformSet.evaluator === "linear-1d-v1" &&
      keyformSet.parameterId === parameterId &&
      keyformSet.target.kind === binding.target.kind &&
      keyformSet.target.id === binding.target.id &&
      keyformSet.target.property === binding.targetProperty
  );
}

function createBindingKeyMarkers(
  keyformSet: LinearKeyformSetDto | undefined,
  currentValue: number
): readonly ParameterKeyMarker[] {
  return (
    keyformSet?.keys.map((key) => ({
      value: key.value,
      selected: sameKeyValue(key.value, currentValue)
    })) ?? []
  );
}

function sampleLinearKeyformValue(
  keyformSet: LinearKeyformSetDto,
  parameterValue: number
): {
  readonly value: ParameterKeyformValue;
  readonly exact: boolean;
  readonly source: "keyform" | "interpolated";
} {
  const keys = [...keyformSet.keys].sort((left, right) => left.value - right.value);
  const exact = keys.find((key) => sameKeyValue(key.value, parameterValue));
  if (exact !== undefined) {
    return {
      value: cloneKeyformValue(exact.statePatch),
      exact: true,
      source: "keyform"
    };
  }

  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === undefined || last === undefined) {
    return {
      value: 0,
      exact: false,
      source: "interpolated"
    };
  }

  if (parameterValue <= first.value) {
    return {
      value: cloneKeyformValue(first.statePatch),
      exact: false,
      source: "interpolated"
    };
  }

  if (parameterValue >= last.value) {
    return {
      value: cloneKeyformValue(last.statePatch),
      exact: false,
      source: "interpolated"
    };
  }

  const upperIndex = keys.findIndex((key) => key.value > parameterValue);
  const upper = keys[upperIndex];
  const lower = upperIndex <= 0 ? undefined : keys[upperIndex - 1];
  if (lower === undefined || upper === undefined) {
    return {
      value: cloneKeyformValue(first.statePatch),
      exact: false,
      source: "interpolated"
    };
  }

  const t = (parameterValue - lower.value) / (upper.value - lower.value);
  return {
    value: interpolateKeyformValue(lower.statePatch, upper.statePatch, t),
    exact: false,
    source: "interpolated"
  };
}

function interpolateKeyformValue(
  left: unknown,
  right: unknown,
  t: number
): ParameterKeyformValue {
  if (typeof left === "number" && typeof right === "number") {
    return left + (right - left) * t;
  }

  if (Array.isArray(left) && Array.isArray(right) && left.length === right.length) {
    return left.map((leftPoint, index) => {
      const rightPoint = right[index];
      if (!isVec2(leftPoint) || !isVec2(rightPoint)) {
        return { x: 0, y: 0 };
      }

      return {
        x: leftPoint.x + (rightPoint.x - leftPoint.x) * t,
        y: leftPoint.y + (rightPoint.y - leftPoint.y) * t
      };
    });
  }

  return cloneKeyformValue(left);
}

function sortLinearKeyformSets(
  keyformSets: readonly KeyformSetDto[]
): readonly LinearKeyformSetDto[] {
  return keyformSets
    .filter(
      (keyformSet): keyformSet is LinearKeyformSetDto =>
        keyformSet.evaluator === "linear-1d-v1"
    )
    .sort(
      (left, right) =>
        left.compositionOrder - right.compositionOrder ||
        left.keyformSetId.localeCompare(right.keyformSetId)
    );
}

function applyNumericComposition(
  current: number,
  patch: number,
  compositionMode: LinearKeyformSetDto["compositionMode"]
): number {
  if (compositionMode === "additiveDelta") {
    return current + patch;
  }

  if (compositionMode === "multiplyOpacity") {
    return current * patch;
  }

  return patch;
}

const addOffsets = (
  current: readonly Vec2Dto[],
  patch: readonly Vec2Dto[],
  count: number
): readonly Vec2Dto[] => {
  const normalizedCurrent = normalizeOffsets(current, count);
  const normalizedPatch = normalizeOffsets(patch, count);
  return normalizedCurrent.map((offset, index) => {
    const patchOffset = normalizedPatch[index] ?? { x: 0, y: 0 };
    return {
      x: offset.x + patchOffset.x,
      y: offset.y + patchOffset.y
    };
  });
};

const normalizeOffsets = (
  value: readonly unknown[],
  count: number
): readonly Vec2Dto[] =>
  Array.from({ length: Math.max(0, count) }, (_, index) => {
    const offset = value[index];
    return isVec2(offset)
      ? {
          x: finiteOrZero(offset.x),
          y: finiteOrZero(offset.y)
        }
      : { x: 0, y: 0 };
  });

function cloneKeyformValue(value: unknown): ParameterKeyformValue {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((candidate) =>
      isVec2(candidate)
        ? {
            x: candidate.x,
            y: candidate.y
          }
        : { x: 0, y: 0 }
    );
  }

  return 0;
}

function cloneStatePatchValue(value: unknown): StatePatchValueDto {
  const cloned = cloneKeyformValue(value);
  if (typeof cloned === "number") {
    return cloned;
  }

  return cloned.map((offset) => ({
    x: offset.x,
    y: offset.y
  }));
}

function hasDistinctKeyPositions(min: number, middle: number, max: number): boolean {
  return min !== middle && middle !== max && min !== max;
}

function sameKeyValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.000001;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function isVec2(value: unknown): value is Vec2Dto {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "x" in value &&
    "y" in value &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y)
  );
}
