import type {
  OperationId,
  PartId,
  RigControlId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorCreateRotation2dRigControlCommand {
  readonly operationId?: OperationId | string;
  readonly displayName: string;
  readonly partId: PartId | string;
  readonly pivot: Vec2Dto;
  readonly restAngleDegrees: number;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
}

export interface EditorBindRigControlChildCommand {
  readonly operationId?: OperationId | string;
  readonly parentRigControlId: RigControlId | string;
  readonly child: {
    readonly kind: "drawable" | "rigControl";
    readonly id: string;
  };
}

export const createRotation2dRigControlOperationRequest = (
  command: EditorCreateRotation2dRigControlCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-create-rotation2d-rig-control-${sanitizeIdempotencyToken(command.displayName)}`,
    trace: {
      relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-011"],
      relatedScenarios: ["SC-MVP-002", "SC-MVP-003"]
    },
    operationType: "createRotation2dRigControl",
    payload: {
      partId: command.partId,
      displayName: command.displayName,
      childDrawableIds: command.childDrawableIds ?? [],
      childRigControlIds: command.childRigControlIds ?? [],
      pivot: command.pivot,
      restAngleDegrees: command.restAngleDegrees
    }
  });

export const createBindRigControlChildOperationRequest = (
  command: EditorBindRigControlChildCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-bind-rig-control-child-${sanitizeIdempotencyToken(
      `${command.parentRigControlId}-${command.child.kind}-${command.child.id}`
    )}`,
    trace: {
      relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-011"],
      relatedScenarios: ["SC-MVP-002", "SC-MVP-003"]
    },
    operationType: "bindRigControlChild",
    payload: {
      parentRigControlId: command.parentRigControlId,
      child: command.child
    }
  });

const sanitizeIdempotencyToken = (text: string): string =>
  text.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed";
