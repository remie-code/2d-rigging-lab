import type {
  DrawableId,
  OperationId,
  PartId,
  TextureId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorCreatePartCommand {
  readonly operationId?: OperationId | string;
  readonly partId?: PartId | string;
  readonly displayName: string;
  readonly parentPartId?: PartId | string;
  readonly lockedTargetIds?: readonly string[];
}

export interface EditorUpdatePartCommand {
  readonly operationId?: OperationId | string;
  readonly partId: PartId | string;
  readonly displayName?: string;
  readonly parentPartId?: PartId | string | null;
  readonly lockedTargetIds?: readonly string[];
}

export interface EditorDeletePartCommand {
  readonly operationId?: OperationId | string;
  readonly partId: PartId | string;
  readonly lockedTargetIds?: readonly string[];
}

export interface EditorSetDrawablePartCommand {
  readonly operationId?: OperationId | string;
  readonly drawableId: DrawableId | string;
  readonly partId: PartId | string;
  readonly lockedTargetIds?: readonly string[];
}

export interface EditorSetDrawableTextureCommand {
  readonly operationId?: OperationId | string;
  readonly drawableId: DrawableId | string;
  readonly textureId: TextureId | string;
  readonly lockedTargetIds?: readonly string[];
}

export const createPartOperationRequest = (
  command: EditorCreatePartCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-create-part-${normalizeIdempotencyToken(command.partId ?? command.displayName)}-r${basePackageRevision}`,
    trace: {
      relatedAC: ["AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "createPart",
    payload: {
      ...(command.partId === undefined ? {} : { partId: command.partId }),
      displayName: command.displayName,
      ...(command.parentPartId === undefined ? {} : { parentPartId: command.parentPartId }),
      lockedTargetIds: [...(command.lockedTargetIds ?? [])]
    }
  });

export const createUpdatePartOperationRequest = (
  command: EditorUpdatePartCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-update-part-${normalizeIdempotencyToken(command.partId)}-r${basePackageRevision}`,
    trace: {
      relatedAC: ["AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "updatePart",
    payload: {
      partId: command.partId,
      ...(command.displayName === undefined ? {} : { displayName: command.displayName }),
      ...(Object.prototype.hasOwnProperty.call(command, "parentPartId")
        ? { parentPartId: command.parentPartId ?? null }
        : {}),
      lockedTargetIds: [...(command.lockedTargetIds ?? [])]
    }
  });

export const createDeletePartOperationRequest = (
  command: EditorDeletePartCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-delete-part-${normalizeIdempotencyToken(command.partId)}-r${basePackageRevision}`,
    trace: {
      relatedAC: ["AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "deletePart",
    payload: {
      partId: command.partId,
      lockedTargetIds: [...(command.lockedTargetIds ?? [])]
    }
  });

export const createSetDrawablePartOperationRequest = (
  command: EditorSetDrawablePartCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-set-drawable-part-${normalizeIdempotencyToken(command.drawableId)}-${normalizeIdempotencyToken(command.partId)}-r${basePackageRevision}`,
    trace: {
      relatedAC: ["AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "setDrawablePart",
    payload: {
      drawableId: command.drawableId,
      partId: command.partId,
      lockedTargetIds: [...(command.lockedTargetIds ?? [])]
    }
  });

export const createSetDrawableTextureOperationRequest = (
  command: EditorSetDrawableTextureCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-set-drawable-texture-${normalizeIdempotencyToken(command.drawableId)}-${normalizeIdempotencyToken(command.textureId)}-r${basePackageRevision}`,
    trace: {
      relatedAC: ["AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "setDrawableTexture",
    payload: {
      drawableId: command.drawableId,
      textureId: command.textureId,
      lockedTargetIds: [...(command.lockedTargetIds ?? [])]
    }
  });

const normalizeIdempotencyToken = (value: string): string =>
  String(value).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "target";
