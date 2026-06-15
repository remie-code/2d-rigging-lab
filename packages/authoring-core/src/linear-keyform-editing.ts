import type {
  KeyformSetId,
  ParameterId,
  TargetRefDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  WarpLattice2dControlPointOffsetsSchema,
  getWarpLattice2dControlPointCount
} from "@private-2d-rigging-lab/contracts";
import type {
  KeyformTargetDto,
  Linear1dKeyformSetDto,
  PackageStatePatchValueDto
} from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringGraph } from "./authoring-graph.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getInitializedParameterById } from "./parameter-surface.js";

export type LinearKeyformEditAction =
  | "addCurrent"
  | "updateCurrent"
  | "deleteCurrent"
  | "createEnds"
  | "createEndsCenter";

export interface LinearKeyformKeyInput {
  readonly value: number;
  readonly statePatch: PackageStatePatchValueDto;
}

export interface EditLinearKeyformInput {
  readonly keyformSetId: KeyformSetId;
  readonly action: LinearKeyformEditAction;
  readonly target: KeyformTargetDto;
  readonly operationTarget: TargetRefDto;
  readonly parameterId: ParameterId;
  readonly interpolation: "linear-1d-v1";
  readonly compositionMode?: Linear1dKeyformSetDto["compositionMode"];
  readonly keys: readonly LinearKeyformKeyInput[];
}

export interface EditLinearKeyformMutationResult {
  readonly session: AuthoringSession;
  readonly mutationKind: "created" | "updated" | "deleted";
  readonly keyformSetId: KeyformSetId;
  readonly keyformSetBefore?: Linear1dKeyformSetDto;
  readonly keyformSetAfter?: Linear1dKeyformSetDto;
  readonly authoringRevision: AuthoringRevision;
}

export const editLinear1dKeyformSet = (
  session: AuthoringSession,
  input: EditLinearKeyformInput
): EditLinearKeyformMutationResult => {
  const parameter = getInitializedParameterById(session.graph, input.parameterId);
  if (parameter === undefined) {
    throw new AuthoringMutationError(
      "missing_parameter",
      `Parameter does not exist: ${input.parameterId}`
    );
  }

  const existingIndex = session.graph.keyformSets.findIndex(
    (keyformSet): keyformSet is Linear1dKeyformSetDto =>
      keyformSet.evaluator === "linear-1d-v1" &&
      keyformSet.keyformSetId === input.keyformSetId
  );
  const existing = existingIndex < 0
    ? undefined
    : session.graph.keyformSets[existingIndex] as Linear1dKeyformSetDto;

  assertNoConflictingBinding(session.graph, input);
  assertKeyValuesInRange(input.keys, parameter);
  assertUniqueInputKeyValues(input.keys);
  assertSupportedV0TargetAndPatches(session.graph, input);

  if (input.action === "deleteCurrent") {
    return deleteCurrentKey(session, input, existingIndex, existing);
  }

  if (existing === undefined) {
    if (input.action === "updateCurrent") {
      throw new AuthoringMutationError(
        "missing_keyform_binding",
        `Keyform binding does not exist: ${input.keyformSetId}`
      );
    }

    return createLinearKeyformSet(session, input);
  }

  assertExistingBindingCompatible(existing, input);
  return updateExistingLinearKeyformSet(session, input, existingIndex, existing);
};

const createLinearKeyformSet = (
  session: AuthoringSession,
  input: EditLinearKeyformInput
): EditLinearKeyformMutationResult => {
  if (input.keys.length === 0) {
    throw new AuthoringMutationError(
      "missing_linear_keyform_key",
      `Keyform edit requires at least one key: ${input.keyformSetId}`
    );
  }

  const keyformSetAfter: Linear1dKeyformSetDto = {
    keyformSetId: input.keyformSetId,
    target: structuredClone(input.target),
    parameterId: input.parameterId,
    evaluator: "linear-1d-v1",
    interpolation: input.interpolation,
    compositionMode: input.compositionMode ?? "replace",
    compositionOrder: 0,
    keys: sortKeys(input.keys)
  };
  session.graph.keyformSets.push(structuredClone(keyformSetAfter));
  if (!session.graph.stableOrder.includes(input.keyformSetId)) {
    session.graph.stableOrder.push(input.keyformSetId);
  }
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    mutationKind: "created",
    keyformSetId: input.keyformSetId,
    keyformSetAfter,
    authoringRevision: session.authoringRevision
  };
};

const updateExistingLinearKeyformSet = (
  session: AuthoringSession,
  input: EditLinearKeyformInput,
  existingIndex: number,
  existing: Linear1dKeyformSetDto
): EditLinearKeyformMutationResult => {
  const keyformSetBefore = structuredClone(existing);
  const keyformSetAfter = {
    ...existing,
    compositionMode: input.compositionMode ?? existing.compositionMode,
    keys: applyKeyEdit(existing.keys, input)
  } satisfies Linear1dKeyformSetDto;

  session.graph.keyformSets[existingIndex] = structuredClone(keyformSetAfter);
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    mutationKind: "updated",
    keyformSetId: input.keyformSetId,
    keyformSetBefore,
    keyformSetAfter,
    authoringRevision: session.authoringRevision
  };
};

const deleteCurrentKey = (
  session: AuthoringSession,
  input: EditLinearKeyformInput,
  existingIndex: number,
  existing: Linear1dKeyformSetDto | undefined
): EditLinearKeyformMutationResult => {
  const keyValue = input.keys[0]?.value;
  if (keyValue === undefined || input.keys.length !== 1) {
    throw new AuthoringMutationError(
      "missing_linear_keyform_key",
      "deleteCurrent requires exactly one key value."
    );
  }
  if (existing === undefined || existingIndex < 0) {
    throw new AuthoringMutationError(
      "missing_keyform_binding",
      `Keyform binding does not exist: ${input.keyformSetId}`
    );
  }
  assertExistingBindingCompatible(existing, input);

  const keyIndex = existing.keys.findIndex((key) => key.value === keyValue);
  if (keyIndex < 0) {
    throw new AuthoringMutationError(
      "missing_linear_keyform_key",
      `Keyform key does not exist at ${keyValue}: ${input.keyformSetId}`
    );
  }

  const keyformSetBefore = structuredClone(existing);
  const remainingKeys = existing.keys.filter((key) => key.value !== keyValue);
  session.graph.keyformSets.splice(existingIndex, 1);
  session.graph.stableOrder = session.graph.stableOrder.filter((id) => id !== input.keyformSetId);

  if (remainingKeys.length > 0) {
    const keyformSetAfter = {
      ...existing,
      keys: remainingKeys
    } satisfies Linear1dKeyformSetDto;
    session.graph.keyformSets.splice(existingIndex, 0, structuredClone(keyformSetAfter));
    if (!session.graph.stableOrder.includes(input.keyformSetId)) {
      session.graph.stableOrder.push(input.keyformSetId);
    }
    session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
    session.dirty = true;

    return {
      session,
      mutationKind: "updated",
      keyformSetId: input.keyformSetId,
      keyformSetBefore,
      keyformSetAfter,
      authoringRevision: session.authoringRevision
    };
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    mutationKind: "deleted",
    keyformSetId: input.keyformSetId,
    keyformSetBefore,
    authoringRevision: session.authoringRevision
  };
};

const applyKeyEdit = (
  existingKeys: readonly LinearKeyformKeyInput[],
  input: EditLinearKeyformInput
): Linear1dKeyformSetDto["keys"] => {
  if (input.action === "addCurrent") {
    const addedKey = input.keys[0];
    if (addedKey === undefined || input.keys.length !== 1) {
      throw new AuthoringMutationError(
        "missing_linear_keyform_key",
        "addCurrent requires exactly one key."
      );
    }
    if (existingKeys.some((key) => key.value === addedKey.value)) {
      throw new AuthoringMutationError(
        "duplicate_linear_keyform_key",
        `Keyform key already exists at ${addedKey.value}: ${input.keyformSetId}`
      );
    }

    return sortKeys([...existingKeys, addedKey]);
  }

  if (input.action === "updateCurrent") {
    const updatedKey = input.keys[0];
    if (updatedKey === undefined || input.keys.length !== 1) {
      throw new AuthoringMutationError(
        "missing_linear_keyform_key",
        "updateCurrent requires exactly one key."
      );
    }
    if (!existingKeys.some((key) => key.value === updatedKey.value)) {
      throw new AuthoringMutationError(
        "missing_linear_keyform_key",
        `Keyform key does not exist at ${updatedKey.value}: ${input.keyformSetId}`
      );
    }

    return sortKeys(
      existingKeys.map((key) => key.value === updatedKey.value ? updatedKey : key)
    );
  }

  return sortKeys(upsertKeys(existingKeys, input.keys));
};

const upsertKeys = (
  existingKeys: readonly LinearKeyformKeyInput[],
  inputKeys: readonly LinearKeyformKeyInput[]
): Linear1dKeyformSetDto["keys"] => {
  const byValue = new Map<number, LinearKeyformKeyInput>(
    existingKeys.map((key) => [key.value, key])
  );
  for (const key of inputKeys) {
    byValue.set(key.value, key);
  }

  return [...byValue.values()];
};

const assertNoConflictingBinding = (
  graph: AuthoringGraph,
  input: EditLinearKeyformInput
): void => {
  const conflict = graph.keyformSets.find(
    (keyformSet) =>
      keyformSet.evaluator === "linear-1d-v1" &&
      keyformSet.keyformSetId !== input.keyformSetId &&
      keyformSet.parameterId === input.parameterId &&
      keyformSet.target.kind === input.target.kind &&
      keyformSet.target.id === input.target.id &&
      keyformSet.target.property === input.target.property
  );

  if (conflict !== undefined) {
    throw new AuthoringMutationError(
      "duplicate_keyform_set",
      `Another linear keyform set already owns this binding: ${conflict.keyformSetId}`
    );
  }
};

const assertExistingBindingCompatible = (
  existing: Linear1dKeyformSetDto,
  input: EditLinearKeyformInput
): void => {
  if (
    existing.parameterId !== input.parameterId ||
    existing.target.kind !== input.target.kind ||
    existing.target.id !== input.target.id ||
    existing.target.property !== input.target.property
  ) {
    throw new AuthoringMutationError(
      "incompatible_keyform_target_property",
      `Existing keyform set ${existing.keyformSetId} does not match the requested binding.`
    );
  }
};

const assertKeyValuesInRange = (
  keys: readonly LinearKeyformKeyInput[],
  parameter: { readonly parameterId: ParameterId; readonly min: number; readonly max: number }
): void => {
  for (const key of keys) {
    if (!Number.isFinite(key.value) || key.value < parameter.min || key.value > parameter.max) {
      throw new AuthoringMutationError(
        "keyform_key_out_of_range",
        `Keyform key ${key.value} is outside ${parameter.parameterId} range ${parameter.min}..${parameter.max}.`
      );
    }
  }
};

const assertUniqueInputKeyValues = (keys: readonly LinearKeyformKeyInput[]): void => {
  const seen = new Set<number>();
  for (const key of keys) {
    if (seen.has(key.value)) {
      throw new AuthoringMutationError(
        "duplicate_linear_keyform_key",
        `Keyform edit contains duplicate key value: ${key.value}`
      );
    }
    seen.add(key.value);
  }
};

const assertSupportedV0TargetAndPatches = (
  graph: AuthoringGraph,
  input: EditLinearKeyformInput
): void => {
  if (input.target.kind === "drawable" && input.target.property === "opacity") {
    assertDrawableExists(graph, input.target.id);
    assertCompositionMode(input.compositionMode, ["replace", "multiplyOpacity"]);
    for (const key of input.keys) {
      assertNumberPatchInRange(key.statePatch, 0, 1, input.target.property);
    }
    return;
  }

  if (input.target.kind !== "rigControl") {
    throwUnsupportedTarget(input.target);
  }

  const rigControl = graph.rigControls.find(
    (candidate) => candidate.rigControlId === input.target.id
  );
  if (rigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_keyform_target",
      `Keyform target does not exist: rigControl:${input.target.id}`
    );
  }

  if (input.target.property === "angleDegrees") {
    if (rigControl.kind !== "rotation2d") {
      throwUnsupportedTarget(input.target);
    }
    assertCompositionMode(input.compositionMode, ["replace", "additiveDelta"]);
    for (const key of input.keys) {
      assertFiniteNumberPatch(key.statePatch, input.target.property);
    }
    return;
  }

  if (input.target.property === "translation") {
    if (rigControl.kind !== "rotation2d") {
      throwUnsupportedTarget(input.target);
    }
    assertCompositionMode(input.compositionMode, ["replace", "additiveDelta"]);
    for (const key of input.keys) {
      assertFiniteVec2Patch(key.statePatch, input.target.property);
    }
    return;
  }

  if (input.target.property === "controlPointOffsets") {
    if (rigControl.kind === "warpLattice2d") {
      assertCompositionMode(input.compositionMode, ["replace", "additiveDelta"]);
      const expectedControlPointCount = getWarpLattice2dControlPointCount(rigControl);
      for (const key of input.keys) {
        assertControlPointOffsetsPatch(key.statePatch, expectedControlPointCount);
      }
      return;
    }

    throwUnsupportedTarget(input.target);
  }

  if (input.target.property === "opacityMultiplier") {
    assertCompositionMode(input.compositionMode, ["replace", "multiplyOpacity"]);
    for (const key of input.keys) {
      assertNumberPatchInRange(key.statePatch, 0, 1, input.target.property);
    }
    return;
  }

  throwUnsupportedTarget(input.target);
};

const assertDrawableExists = (graph: AuthoringGraph, drawableId: string): void => {
  if (!graph.drawables.some((drawable) => drawable.drawableId === drawableId)) {
    throw new AuthoringMutationError(
      "missing_keyform_target",
      `Keyform target does not exist: drawable:${drawableId}`
    );
  }
};

const assertCompositionMode = (
  compositionMode: Linear1dKeyformSetDto["compositionMode"] | undefined,
  allowed: readonly Linear1dKeyformSetDto["compositionMode"][]
): void => {
  if (compositionMode !== undefined && !allowed.includes(compositionMode)) {
    throw new AuthoringMutationError(
      "unsupported_keyform_composition_mode",
      `Unsupported composition mode ${compositionMode}; allowed=${allowed.join(",")}.`
    );
  }
};

const assertFiniteNumberPatch = (
  value: PackageStatePatchValueDto,
  targetProperty: string
): void => {
  readFiniteNumberPatch(value, targetProperty);
};

const readFiniteNumberPatch = (
  value: PackageStatePatchValueDto,
  targetProperty: string
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AuthoringMutationError(
      "invalid_keyform_patch_shape",
      `${targetProperty} keyforms require a finite number patch.`
    );
  }

  return value;
};

const assertNumberPatchInRange = (
  value: PackageStatePatchValueDto,
  min: number,
  max: number,
  targetProperty: string
): void => {
  const numericValue = readFiniteNumberPatch(value, targetProperty);
  if (numericValue < min || numericValue > max) {
    throw new AuthoringMutationError(
      "invalid_keyform_patch_shape",
      `${targetProperty} keyforms require a value inside ${min}..${max}.`
    );
  }
};

const assertFiniteVec2Patch = (
  value: PackageStatePatchValueDto,
  targetProperty: string
): void => {
  if (!isFiniteVec2(value)) {
    throw new AuthoringMutationError(
      "invalid_keyform_patch_shape",
      `${targetProperty} keyforms require a finite Vec2 patch.`
    );
  }
};

const isFiniteVec2 = (value: PackageStatePatchValueDto): value is Vec2Dto =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "x" in value &&
  "y" in value &&
  typeof value.x === "number" &&
  typeof value.y === "number" &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y);

const assertControlPointOffsetsPatch = (
  value: PackageStatePatchValueDto,
  expectedControlPointCount: number
): void => {
  const parsed = WarpLattice2dControlPointOffsetsSchema.safeParse(value);
  if (!parsed.success || !hasExpectedControlPointCount(parsed.data, expectedControlPointCount)) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_control_point_offsets_patch",
      `controlPointOffsets keyforms require Vec2[] with ${expectedControlPointCount} entries.`
    );
  }
};

const hasExpectedControlPointCount = (
  offsets: readonly Vec2Dto[],
  expectedControlPointCount: number
): boolean => offsets.length === expectedControlPointCount;

const throwUnsupportedTarget = (target: KeyformTargetDto): never => {
  throw new AuthoringMutationError(
    "unsupported_keyform_target_property",
    `Keyform target property is not supported for v0 editing: ${target.kind}.${target.property}`
  );
};

const sortKeys = (
  keys: readonly LinearKeyformKeyInput[]
): Linear1dKeyformSetDto["keys"] =>
  [...dedupeSamePatchKeys(keys)].sort((left, right) => left.value - right.value);

const dedupeSamePatchKeys = (
  keys: readonly LinearKeyformKeyInput[]
): Linear1dKeyformSetDto["keys"] => {
  const byValue = new Map<number, Linear1dKeyformSetDto["keys"][number]>();
  for (const key of keys) {
    if (!byValue.has(key.value)) {
      byValue.set(key.value, {
        value: key.value,
        statePatch: structuredClone(key.statePatch)
      });
    }
  }

  return [...byValue.values()];
};
