import type {
  DrawableId,
  MaskRelationId,
  OperationId,
  ParameterId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorSetMaskRelationCommand {
  readonly operationId?: OperationId | string;
  readonly maskRelationId?: MaskRelationId | string;
  readonly maskDrawableIds: readonly (DrawableId | string)[];
  readonly targetDrawableIds: readonly (DrawableId | string)[];
  readonly enabled: boolean;
}

export interface EditorAddDrawableOpacityKeyformCommand {
  readonly operationId?: OperationId | string;
  readonly parameterId: ParameterId | string;
  readonly drawableId: DrawableId | string;
  readonly keyValue: number;
  readonly opacity: number;
}

export const createSetMaskRelationOperationRequest = (
  command: EditorSetMaskRelationCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-set-mask-relation-${sanitizeIdempotencyToken(
      [
        command.maskRelationId ?? "auto",
        ...command.maskDrawableIds,
        ...command.targetDrawableIds,
        command.enabled ? "enabled" : "disabled"
      ].join("-")
    )}`,
    trace: {
      relatedAC: ["AC-MVP-007"],
      relatedScenarios: ["SC-MVP-003"]
    },
    operationType: "setMaskRelation",
    payload: {
      ...(command.maskRelationId === undefined ? {} : { maskRelationId: command.maskRelationId }),
      maskDrawableIds: command.maskDrawableIds,
      targetDrawableIds: command.targetDrawableIds,
      enabled: command.enabled
    }
  });

export const createAddDrawableOpacityKeyformOperationRequest = (
  command: EditorAddDrawableOpacityKeyformCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-add-drawable-opacity-keyform-${sanitizeIdempotencyToken(
      `${command.drawableId}-${command.parameterId}-${command.keyValue}`
    )}`,
    trace: {
      relatedAC: ["AC-MVP-007", "AC-MVP-008"],
      relatedScenarios: ["SC-PARAM-002"]
    },
    operationType: "addKeyform",
    payload: {
      target: {
        kind: "drawable",
        id: command.drawableId
      },
      targetProperty: "opacity",
      parameterId: command.parameterId,
      keyValue: command.keyValue,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "opacity",
        value: command.opacity,
        valueSchemaHint: "drawable.opacity"
      }
    }
  });

const sanitizeIdempotencyToken = (text: string): string =>
  text.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed";
