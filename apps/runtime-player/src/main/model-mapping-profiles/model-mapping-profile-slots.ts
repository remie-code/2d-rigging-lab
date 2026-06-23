import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingTarget
} from "../../preload/model-mapping-bridge-contract";
import { createDirectTargetCandidates } from "../live-mapping/runtime-export-auto-mapping";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  modelMappingProfileAutoMappingVersion,
  modelMappingProfileSchemaVersion,
  type ModelMappingProfileDocument,
  type ModelMappingProfileSlot,
  type ModelMappingRuntimeExportIdentity
} from "./model-mapping-profile-document";

export type ModelMappingProfileRestoreResult = {
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly restoredSlotCount: number;
  readonly staleSlotCount: number;
  readonly warningMessages: readonly string[];
};

export function createModelMappingProfileDocument(input: {
  readonly identity: ModelMappingRuntimeExportIdentity;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}): ModelMappingProfileDocument {
  return {
    schemaVersion: modelMappingProfileSchemaVersion,
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
    autoMappingVersion: modelMappingProfileAutoMappingVersion,
    slots: input.slots.map(toProfileSlot)
  };
}

export function restoreModelMappingProfileSlots(input: {
  readonly payload: RuntimeExportLoadedPayload;
  readonly autoSlots: readonly RuntimePlayerMappingSlot[];
  readonly profile: ModelMappingProfileDocument;
}): ModelMappingProfileRestoreResult {
  const targets = new Map(
    createDirectTargetCandidates(input.payload).map((target) => [
      target.parameterId,
      target
    ])
  );
  const profileSlots = new Map(
    input.profile.slots.map((slot) => [slot.slotId, slot])
  );
  const warningMessages: string[] = [];
  let restoredSlotCount = 0;
  let staleSlotCount = 0;

  const slots = input.autoSlots.map((autoSlot) => {
    const profileSlot = profileSlots.get(autoSlot.slotId);

    if (profileSlot === undefined) {
      return autoSlot;
    }

    if (profileSlot.target === null) {
      return autoSlot;
    }

    const currentTarget = targets.get(profileSlot.target.parameterId);

    if (currentTarget === undefined) {
      staleSlotCount += 1;
      const message =
        `Saved target ${profileSlot.target.parameterId} for ${autoSlot.label} no longer exists; Auto Map was used for that slot.`;
      warningMessages.push(message);

      return {
        ...autoSlot,
        warningMessages: [...autoSlot.warningMessages, message]
      };
    }

    restoredSlotCount += 1;
    const targetWarnings = readTargetMetadataWarnings({
      profileSlot,
      autoSlot,
      currentTarget
    });

    warningMessages.push(...targetWarnings);

    return restoreSlotControls({
      autoSlot,
      profileSlot,
      currentTarget,
      warningMessages: targetWarnings
    });
  });

  return {
    slots,
    restoredSlotCount,
    staleSlotCount,
    warningMessages
  };
}

function toProfileSlot(
  slot: RuntimePlayerMappingSlot
): ModelMappingProfileSlot {
  return {
    slotId: slot.slotId,
    target: slot.target === null
      ? null
      : {
          parameterId: slot.target.parameterId,
          displayName: slot.target.displayName,
          ...(slot.target.projectPresetAlias === undefined
            ? {}
            : { projectPresetAlias: slot.target.projectPresetAlias })
        },
    enabled: slot.enabled,
    invert: slot.invert,
    strength: slot.strength,
    ...(slot.smoothing === undefined ? {} : { smoothing: slot.smoothing }),
    ...(slot.bodyRotationStrength === undefined
      ? {}
      : { bodyRotationStrength: slot.bodyRotationStrength }),
    ...(slot.bodyRotationInvert === undefined
      ? {}
      : { bodyRotationInvert: slot.bodyRotationInvert }),
    ...(slot.bodyPositionStrength === undefined
      ? {}
      : { bodyPositionStrength: slot.bodyPositionStrength }),
    ...(slot.bodyPositionInvert === undefined
      ? {}
      : { bodyPositionInvert: slot.bodyPositionInvert })
  };
}

function restoreSlotControls(input: {
  readonly autoSlot: RuntimePlayerMappingSlot;
  readonly profileSlot: ModelMappingProfileSlot;
  readonly currentTarget: RuntimePlayerMappingTarget;
  readonly warningMessages: readonly string[];
}): RuntimePlayerMappingSlot {
  const enabled = input.profileSlot.enabled;

  return {
    ...input.autoSlot,
    target: input.currentTarget,
    enabled,
    invert: input.profileSlot.invert,
    strength: input.profileSlot.strength,
    ...(input.profileSlot.smoothing === undefined
      ? {}
      : { smoothing: input.profileSlot.smoothing }),
    ...(input.profileSlot.bodyRotationStrength === undefined
      ? {}
      : { bodyRotationStrength: input.profileSlot.bodyRotationStrength }),
    ...(input.profileSlot.bodyRotationInvert === undefined
      ? {}
      : { bodyRotationInvert: input.profileSlot.bodyRotationInvert }),
    ...(input.profileSlot.bodyPositionStrength === undefined
      ? {}
      : { bodyPositionStrength: input.profileSlot.bodyPositionStrength }),
    ...(input.profileSlot.bodyPositionInvert === undefined
      ? {}
      : { bodyPositionInvert: input.profileSlot.bodyPositionInvert }),
    status: enabled ? "mapped" : "disabled",
    warningMessages: [
      ...input.autoSlot.warningMessages.filter((message) =>
        !message.startsWith("Missing external-input target")
      ),
      ...input.warningMessages
    ]
  };
}

function readTargetMetadataWarnings(input: {
  readonly profileSlot: ModelMappingProfileSlot;
  readonly autoSlot: RuntimePlayerMappingSlot;
  readonly currentTarget: RuntimePlayerMappingTarget;
}): readonly string[] {
  const target = input.profileSlot.target;

  if (target === null) {
    return [];
  }

  if (
    target.displayName === input.currentTarget.displayName &&
    target.projectPresetAlias === input.currentTarget.projectPresetAlias
  ) {
    return [];
  }

  return [
    `Saved target metadata for ${input.autoSlot.label} changed; restored by parameter id ${target.parameterId}.`
  ];
}
