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
          kind: `segment ${output.segmentIndex}`,
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
  // dynamics-world-frame-chain.md §9. "Scale"-suffixed knobs are multipliers
  // (positive-only; 0 or negative is meaningless), the rest are replacements.
  return {
    ...(override.enabled === undefined ? {} : { enabled: override.enabled }),
    ...(isPositiveNumber(override.outputScale)
      ? { outputScale: override.outputScale }
      : {}),
    ...(isNonNegativeNumber(override.limit) ? { limit: override.limit } : {}),
    ...(isNonNegativeNumber(override.damping)
      ? { damping: override.damping }
      : {}),
    ...(isNonNegativeNumber(override.gravityScale)
      ? { gravityScale: override.gravityScale }
      : {}),
    ...(isPositiveNumber(override.lengthScale)
      ? { lengthScale: override.lengthScale }
      : {})
  };
}

function createExportedValues(
  group: RuntimeExportLoadedPayload["artifacts"]["model"]["dynamicsGroups"][number]
): RuntimePlayerDynamicsTuningValues {
  const output = group.outputs[0];

  // Multiplier knobs (outputScale, lengthScale) have identity 1.0 as their
  // display baseline; replacement knobs read the actual exported chain/output
  // values. dynamics-world-frame-chain.md §9.
  return {
    enabled: group.enabled,
    outputScale: 1,
    limit: output === undefined ? 0 : output.limit,
    damping: group.chain.damping,
    gravityScale: group.chain.gravityScale,
    lengthScale: 1
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
    outputScale: override.outputScale ?? exportedValues.outputScale,
    limit: override.limit ?? exportedValues.limit,
    damping: override.damping ?? exportedValues.damping,
    gravityScale: override.gravityScale ?? exportedValues.gravityScale,
    lengthScale: override.lengthScale ?? exportedValues.lengthScale
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
