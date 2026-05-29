import type {
  OperationId,
  ParameterId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type CreateParameterPayloadDto,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorCreateParameterCommand {
  readonly parameterId?: ParameterId | string;
  readonly operationId?: OperationId | string;
  readonly displayName: string;
  readonly semanticRole?: CreateParameterPayloadDto["semanticRole"];
  readonly projectPresetAlias?: string;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly recommendedUiStep: number;
}

export const createParameterOperationRequest = (
  command: EditorCreateParameterCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-create-parameter-${command.parameterId ?? command.displayName}`,
    trace: {
      relatedAC: ["AC-MVP-008", "AC-MVP-011", "AC-MVP-013"],
      relatedScenarios: ["SC-PARAM-002", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "createParameter",
    payload: {
      ...(command.parameterId === undefined ? {} : { parameterId: command.parameterId }),
      displayName: command.displayName,
      ...(command.semanticRole === undefined ? {} : { semanticRole: command.semanticRole }),
      ...(command.projectPresetAlias === undefined
        ? {}
        : { projectPresetAlias: command.projectPresetAlias }),
      valueSource: "authoredInput",
      min: command.min,
      max: command.max,
      default: command.defaultValue,
      recommendedUiStep: command.recommendedUiStep
    }
  });
