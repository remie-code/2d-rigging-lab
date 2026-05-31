import type {
  DynamicsGroupId,
  OperationId,
  ParameterId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type CreateDynamicsGroupPayloadDto,
  type OperationRequestDto,
  type UpdateDynamicsGroupPayloadDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorCreateDynamicsGroupCommand {
  readonly operationId?: OperationId | string;
  readonly dynamicsGroupId?: DynamicsGroupId | string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly driverParameterId: ParameterId | string;
  readonly outputParameterId: ParameterId | string;
  readonly outputMin: number;
  readonly outputMax: number;
  readonly outputScale: number;
  readonly outputOffset: number;
  readonly resetPolicy: CreateDynamicsGroupPayloadDto["resetPolicy"];
  readonly stiffness: number;
  readonly damping: number;
  readonly maxVelocity?: number;
  readonly maxAmplitude?: number;
}

export interface EditorUpdateDynamicsGroupCommand {
  readonly operationId?: OperationId | string;
  readonly dynamicsGroupId: DynamicsGroupId | string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly resetPolicy: UpdateDynamicsGroupPayloadDto["resetPolicy"];
}

export const createDynamicsGroupOperationRequest = (
  command: EditorCreateDynamicsGroupCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-create-dynamics-group-${command.dynamicsGroupId ?? command.displayName}`,
    trace: {
      relatedAC: ["AC-MVP-010", "AC-PHYS-001", "AC-PHYS-002", "AC-PHYS-003"],
      relatedScenarios: ["SC-DYN-001", "SC-DYN-002", "SC-MVP-003"]
    },
    operationType: "createDynamicsGroup",
    payload: {
      ...(command.dynamicsGroupId === undefined ? {} : { dynamicsGroupId: command.dynamicsGroupId }),
      displayName: command.displayName,
      enabled: command.enabled,
      solverKind: "scalarDampedFollowV1",
      resetPolicy: command.resetPolicy,
      settings: {
        stiffness: command.stiffness,
        damping: command.damping,
        ...(command.maxVelocity === undefined ? {} : { maxVelocity: command.maxVelocity }),
        ...(command.maxAmplitude === undefined ? {} : { maxAmplitude: command.maxAmplitude })
      },
      drivers: [
        {
          sourceParameterId: command.driverParameterId,
          inputScale: 1,
          inputOffset: 0,
          invert: false
        }
      ],
      output: {
        targetParameterId: command.outputParameterId,
        outputScale: command.outputScale,
        outputOffset: command.outputOffset,
        min: command.outputMin,
        max: command.outputMax,
        clampPolicy: "clamp-to-output-range"
      }
    }
  });

export const createUpdateDynamicsGroupOperationRequest = (
  command: EditorUpdateDynamicsGroupCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-update-dynamics-group-${command.dynamicsGroupId}`,
    trace: {
      relatedAC: ["AC-MVP-010", "AC-PHYS-001"],
      relatedScenarios: ["SC-DYN-001", "SC-DYN-002"]
    },
    operationType: "updateDynamicsGroup",
    payload: {
      dynamicsGroupId: command.dynamicsGroupId,
      displayName: command.displayName,
      enabled: command.enabled,
      resetPolicy: command.resetPolicy
    }
  });
