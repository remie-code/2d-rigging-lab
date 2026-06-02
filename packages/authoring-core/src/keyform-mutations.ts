import type {
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  WarpLattice2dControlPointOffsetsSchema,
  getWarpLattice2dControlPointCount,
  isWarpLattice2dControlPointOffsetsTarget
} from "@private-2d-rigging-lab/contracts";
import type {
  KeyformSetDto,
  KeyformTargetDto,
  Linear1dKeyformSetDto,
  ParameterGrid2dKeyformSetDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { hasParameter } from "./graph-selectors.js";
import { hasKeyformSet } from "./keyform-selectors.js";

export interface CreateKeyformSetMutationResult<TKeyformSet extends KeyformSetDto = KeyformSetDto> {
  readonly session: AuthoringSession;
  readonly keyformSet: TKeyformSet;
  readonly authoringRevision: AuthoringRevision;
}

export const createLinear1dKeyformSet = (
  session: AuthoringSession,
  keyformSet: Linear1dKeyformSetDto
): CreateKeyformSetMutationResult<Linear1dKeyformSetDto> => {
  assertUniqueKeyformSetId(session, keyformSet);
  assertParameterExists(session, keyformSet.parameterId);
  assertSupportedTarget(session.graph, keyformSet.target);
  assertWarpLattice2dControlPointOffsetsKeyform(session.graph, keyformSet);

  return storeKeyformSet(session, keyformSet);
};

export const createParameterGrid2dKeyformSet = (
  session: AuthoringSession,
  keyformSet: ParameterGrid2dKeyformSetDto
): CreateKeyformSetMutationResult<ParameterGrid2dKeyformSetDto> => {
  assertUniqueKeyformSetId(session, keyformSet);
  assertDistinctGridAxisParameters(keyformSet);
  assertParameterExists(session, keyformSet.parameterX);
  assertParameterExists(session, keyformSet.parameterY);
  assertSupportedTarget(session.graph, keyformSet.target);
  assertUniqueGridCoordinates(keyformSet);
  assertWarpLattice2dControlPointOffsetsKeyform(session.graph, keyformSet);

  return storeKeyformSet(session, keyformSet);
};

const storeKeyformSet = <TKeyformSet extends KeyformSetDto>(
  session: AuthoringSession,
  keyformSet: TKeyformSet
): CreateKeyformSetMutationResult<TKeyformSet> => {
  const storedKeyformSet = structuredClone(keyformSet);
  session.graph.keyformSets.push(storedKeyformSet);
  if (!session.graph.stableOrder.includes(storedKeyformSet.keyformSetId)) {
    session.graph.stableOrder.push(storedKeyformSet.keyformSetId);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    keyformSet: storedKeyformSet,
    authoringRevision: session.authoringRevision
  };
};

const assertUniqueKeyformSetId = (
  session: AuthoringSession,
  keyformSet: KeyformSetDto
): void => {
  if (hasKeyformSet(session.graph, keyformSet.keyformSetId)) {
    throw new AuthoringMutationError(
      "duplicate_keyform_set",
      `Keyform set already exists: ${keyformSet.keyformSetId}`
    );
  }
};

const assertParameterExists = (
  session: AuthoringSession,
  parameterId: KeyformParameterId
): void => {
  if (!hasParameter(session.graph, parameterId)) {
    throw new AuthoringMutationError(
      "missing_parameter",
      `Parameter does not exist: ${parameterId}`
    );
  }
};

const assertDistinctGridAxisParameters = (keyformSet: ParameterGrid2dKeyformSetDto): void => {
  if (keyformSet.parameterX === keyformSet.parameterY) {
    throw new AuthoringMutationError(
      "duplicate_keyform_grid_axis_parameter",
      `Grid keyform axes must use distinct parameters: ${keyformSet.parameterX}`
    );
  }
};

const assertUniqueGridCoordinates = (keyformSet: ParameterGrid2dKeyformSetDto): void => {
  const coordinates = new Set<string>();

  for (const key of keyformSet.keys) {
    const coordinate = `${key.x}:${key.y}`;
    if (coordinates.has(coordinate)) {
      throw new AuthoringMutationError(
        "duplicate_keyform_grid_coordinate",
        `Grid keyform coordinate is duplicated: ${coordinate}`
      );
    }

    coordinates.add(coordinate);
  }
};

const assertSupportedTarget = (graph: AuthoringGraph, target: KeyformTargetDto): void => {
  if (!targetExists(graph, target)) {
    throw new AuthoringMutationError(
      "missing_keyform_target",
      `Keyform target does not exist: ${target.kind}:${target.id}`
    );
  }

  if (!isSupportedTargetProperty(target)) {
    throw new AuthoringMutationError(
      "unsupported_keyform_target_property",
      `Keyform target property is not supported: ${target.kind}.${target.property}`
    );
  }
};

const targetExists = (graph: AuthoringGraph, target: KeyformTargetDto): boolean => {
  switch (target.kind) {
    case "mesh":
      return graph.meshes.some((mesh) => mesh.meshId === target.id);
    case "rigControl":
      return graph.rigControls.some((rigControl) => rigControl.rigControlId === target.id);
    case "drawable":
    case "opacity":
    case "visibility":
      return graph.drawables.some((drawable) => drawable.drawableId === target.id);
    case "drawOrder":
      return graph.drawOrder.some((entry) => entry.drawableId === target.id);
  }
};

const isSupportedTargetProperty = (target: KeyformTargetDto): boolean =>
  supportedTargetProperties[target.kind].has(target.property);

const assertWarpLattice2dControlPointOffsetsKeyform = (
  graph: AuthoringGraph,
  keyformSet: KeyformSetDto
): void => {
  if (!isWarpLattice2dControlPointOffsetsTarget(keyformSet.target)) {
    return;
  }

  const rigControl = graph.rigControls.find(
    (candidate) => candidate.rigControlId === keyformSet.target.id
  );
  if (rigControl?.kind !== "warpLattice2d") {
    throw new AuthoringMutationError(
      "unsupported_keyform_target_property",
      `controlPointOffsets keyforms require a warpLattice2d rig control target: ${keyformSet.target.id}`
    );
  }

  if (keyformSet.compositionMode !== "replace" && keyformSet.compositionMode !== "additiveDelta") {
    throw new AuthoringMutationError(
      "unsupported_keyform_composition_mode",
      `warpLattice2d controlPointOffsets keyforms allow only replace or additiveDelta composition: ${keyformSet.compositionMode}`
    );
  }

  const expectedControlPointCount = getWarpLattice2dControlPointCount(rigControl);
  for (const key of keyformSet.keys) {
    const parsed = WarpLattice2dControlPointOffsetsSchema.safeParse(key.statePatch);
    if (!parsed.success || !hasExpectedControlPointCount(parsed.data, expectedControlPointCount)) {
      throw new AuthoringMutationError(
        "invalid_warp_lattice_control_point_offsets_patch",
        `warpLattice2d controlPointOffsets statePatch must be Vec2[] with ${expectedControlPointCount} entries`
      );
    }
  }
};

const hasExpectedControlPointCount = (
  offsets: readonly Vec2Dto[],
  expectedControlPointCount: number
): boolean => offsets.length === expectedControlPointCount;

const supportedTargetProperties = {
  mesh: new Set(["vertices"]),
  rigControl: new Set([
    "angleDegrees",
    "restAngleDegrees",
    "translation",
    "restTranslation",
    "scale",
    "restScale",
    "controlPoints",
    "restControlPoints",
    "controlPointOffsets"
  ]),
  drawable: new Set([
    "opacity",
    "defaultOpacity",
    "visibility",
    "runtimeVisibility",
    "drawOrder",
    "baseDrawOrder"
  ]),
  opacity: new Set(["opacity", "defaultOpacity"]),
  visibility: new Set(["visibility", "runtimeVisibility"]),
  drawOrder: new Set(["drawOrder", "baseDrawOrder"])
} satisfies Record<KeyformTargetDto["kind"], ReadonlySet<string>>;

type KeyformParameterId = Linear1dKeyformSetDto["parameterId"];
