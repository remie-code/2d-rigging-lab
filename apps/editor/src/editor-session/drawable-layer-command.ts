import type { DrawableId, OperationId } from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorSetDrawableRuntimeVisibilityCommand {
  readonly operationId?: OperationId | string;
  readonly drawableId: DrawableId | string;
  readonly runtimeVisibility: boolean;
}

export interface EditorSetDrawableDrawOrderCommand {
  readonly operationId?: OperationId | string;
  readonly entries: readonly {
    readonly drawableId: DrawableId | string;
    readonly baseDrawOrder: number;
  }[];
}

export const createSetDrawableRuntimeVisibilityOperationRequest = (
  command: EditorSetDrawableRuntimeVisibilityCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-set-runtime-visibility-${command.drawableId}-r${basePackageRevision}`,
    trace: {
      relatedAC: ["AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "setRuntimeVisibility",
    payload: {
      target: {
        kind: "drawable",
        id: command.drawableId
      },
      runtimeVisibility: command.runtimeVisibility
    }
  });

export const createSetDrawableDrawOrderOperationRequest = (
  command: EditorSetDrawableDrawOrderCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-set-draw-order-r${basePackageRevision}`,
    trace: {
      relatedAC: ["AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "setDrawOrder",
    payload: {
      entries: command.entries.map((entry) => ({
        drawableId: entry.drawableId,
        baseDrawOrder: entry.baseDrawOrder
      }))
    }
  });
