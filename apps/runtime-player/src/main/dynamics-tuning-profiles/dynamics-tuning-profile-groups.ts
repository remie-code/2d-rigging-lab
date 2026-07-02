import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerDynamicsTuningGroupOverride,
  RuntimePlayerDynamicsTuningGroupStatus,
  RuntimePlayerDynamicsTuningValues
} from "../../preload/dynamics-tuning-bridge-contract";
import {
  dynamicsTuningProfileSchemaVersion,
  type DynamicsTuningProfileDocument,
  type DynamicsTuningRuntimeExportIdentity
} from "./dynamics-tuning-profile-document";

export type DynamicsTuningProfileRestoreResult = {
  readonly overrides: Readonly<Record<string, RuntimePlayerDynamicsTuningGroupOverride>>;
  readonly restoredGroupCount: number;
  readonly staleGroupCount: number;
  readonly warningMessages: readonly string[];
};

export function createDynamicsTuningProfileDocument(input: {
  readonly identity: DynamicsTuningRuntimeExportIdentity;
  readonly groups: Readonly<Record<string, RuntimePlayerDynamicsTuningGroupOverride>>;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}): DynamicsTuningProfileDocument {
  return {
    schemaVersion: dynamicsTuningProfileSchemaVersion,
    createdAtIso: input.createdAtIso,
    updatedAtIso: input.updatedAtIso,
    exportIdentity: {
      packageId: input.identity.packageId,
      packageRevision: input.identity.packageRevision,
      ...(input.identity.packageHash === undefined
        ? {}
        : { packageHash: input.identity.packageHash }),
      parameterSignatureHash: input.identity.parameterSignatureHash
    },
    dynamicsSignatureHash: input.identity.dynamicsSignatureHash,
    groups: sanitizeGroupOverrides(input.groups)
  };
}

export function restoreDynamicsTuningProfileGroups(input: {
  readonly payload: RuntimeExportLoadedPayload;
  readonly profile: DynamicsTuningProfileDocument;
}): DynamicsTuningProfileRestoreResult {
  const currentGroupIds = new Set(
    input.payload.artifacts.model.dynamicsGroups.map((group) =>
      String(group.dynamicsGroupId)
    )
  );
  const warningMessages: string[] = [];
  const overrides: Record<string, RuntimePlayerDynamicsTuningGroupOverride> = {};
  let restoredGroupCount = 0;
  let staleGroupCount = 0;

  for (const [groupId, override] of Object.entries(input.profile.groups)) {
    if (!currentGroupIds.has(groupId)) {
      staleGroupCount += 1;
      warningMessages.push(
        `Saved dynamics tuning for ${groupId} no longer matches an exported group and was ignored.`
      );
      continue;
    }

    const sanitized = sanitizeGroupOverride(override);
    if (Object.keys(sanitized).length === 0) {
      continue;
    }

    restoredGroupCount += 1;
    overrides[groupId] = sanitized;
  }

  return {
    overrides,
    restoredGroupCount,
    staleGroupCount,
    warningMessages
  };
}

export function createDynamicsTuningGroupStatuses(input: {
  readonly payload: RuntimeExportLoadedPayload;
  readonly overrides: Readonly<Record<string, RuntimePlayerDynamicsTuningGroupOverride>>;
}): readonly RuntimePlayerDynamicsTuningGroupStatus[] {
  const parameterDisplayNames = new Map(
    input.payload.artifacts.model.parameters.map((parameter) => [
      parameter.parameterId,
      parameter.displayName
    ])
  );

  return input.payload.artifacts.model.dynamicsGroups.map((group) => {
    const override = input.overrides[group.dynamicsGroupId];
    const exportedValues = createExportedValues(group);
    const effectiveValues = applyGroupOverride(exportedValues, override);

    return {
      groupId: group.dynamicsGroupId,
      displayName: group.displayName,
      inputSummary: group.inputs.map((source) =>
        createParameterRef({
          parameterId: source.parameterId,
          kind: source.kind,
          parameterDisplayNames
        })
      ),
      outputSummary: group.outputs.map((output) =>
        createParameterRef({
          parameterId: output.parameterId,
          kind: output.kind,
          parameterDisplayNames
        })
      ),
      exportedValues,
      effectiveValues,
      override: override === undefined ? null : sanitizeGroupOverride(override),
      hasOverride: override !== undefined &&
        Object.keys(sanitizeGroupOverride(override)).length > 0,
      warningMessages: []
    } satisfies RuntimePlayerDynamicsTuningGroupStatus;
  });
}

function createParameterRef(input: {
  readonly parameterId: string;
  readonly kind: string;
  readonly parameterDisplayNames: ReadonlyMap<string, string>;
}): RuntimePlayerDynamicsTuningGroupStatus["inputSummary"][number] {
  const displayName = input.parameterDisplayNames.get(input.parameterId);

  return {
    parameterId: input.parameterId,
    kind: input.kind,
    ...(displayName === undefined ? {} : { displayName })
  };
}

export function sanitizeGroupOverrides(
  groups: Readonly<Record<string, RuntimePlayerDynamicsTuningGroupOverride>>
): Readonly<Record<string, RuntimePlayerDynamicsTuningGroupOverride>> {
  const result: Record<string, RuntimePlayerDynamicsTuningGroupOverride> = {};

  for (const [groupId, override] of Object.entries(groups)) {
    const trimmedGroupId = groupId.trim();
    if (trimmedGroupId.length === 0) {
      continue;
    }

    const sanitized = sanitizeGroupOverride(override);
    if (Object.keys(sanitized).length > 0) {
      result[trimmedGroupId] = sanitized;
    }
  }

  return result;
}

export function sanitizeGroupOverride(
  override: RuntimePlayerDynamicsTuningGroupOverride
): RuntimePlayerDynamicsTuningGroupOverride {
  return {
    ...(override.enabled === undefined ? {} : { enabled: override.enabled }),
    ...(isFiniteNumber(override.strength)
      ? { strength: override.strength }
      : {}),
    ...(isNonNegativeNumber(override.limit) ? { limit: override.limit } : {}),
    ...(isPositiveNumber(override.length) ? { length: override.length } : {}),
    ...(isNonNegativeNumber(override.sway) ? { sway: override.sway } : {}),
    ...(isNonNegativeNumber(override.reactionSpeed)
      ? { reactionSpeed: override.reactionSpeed }
      : {}),
    ...(isNonNegativeNumber(override.convergenceSpeed)
      ? { convergenceSpeed: override.convergenceSpeed }
      : {})
  };
}

function createExportedValues(
  group: RuntimeExportLoadedPayload["artifacts"]["model"]["dynamicsGroups"][number]
): RuntimePlayerDynamicsTuningValues {
  const output = group.outputs[0];
  const pendulum = group.pendulums[0];

  if (output === undefined || pendulum === undefined) {
    return {
      enabled: group.enabled,
      strength: 0,
      limit: 0,
      length: 1,
      sway: 0,
      reactionSpeed: 0,
      convergenceSpeed: 0
    };
  }

  return {
    enabled: group.enabled,
    strength: output.strength,
    limit: output.limit,
    length: pendulum.length,
    sway: pendulum.sway,
    reactionSpeed: pendulum.reactionSpeed,
    convergenceSpeed: pendulum.convergenceSpeed
  };
}

function applyGroupOverride(
  exportedValues: RuntimePlayerDynamicsTuningValues,
  override: RuntimePlayerDynamicsTuningGroupOverride | undefined
): RuntimePlayerDynamicsTuningValues {
  if (override === undefined) {
    return exportedValues;
  }

  return {
    enabled: override.enabled ?? exportedValues.enabled,
    strength: override.strength ?? exportedValues.strength,
    limit: override.limit ?? exportedValues.limit,
    length: override.length ?? exportedValues.length,
    sway: override.sway ?? exportedValues.sway,
    reactionSpeed: override.reactionSpeed ?? exportedValues.reactionSpeed,
    convergenceSpeed:
      override.convergenceSpeed ?? exportedValues.convergenceSpeed
  };
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: number | undefined): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveNumber(value: number | undefined): value is number {
  return isFiniteNumber(value) && value > 0;
}
