import type {
  MeshId,
  OperationId,
  Vec2Dto,
  VertexId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorMoveMeshVertexCommand {
  readonly operationId?: OperationId | string;
  readonly meshId: MeshId | string;
  readonly vertexDeltas: readonly {
    readonly vertexId: VertexId | string;
    readonly delta: Vec2Dto;
  }[];
  readonly lockedTargetIds?: readonly string[];
  readonly intent?: string;
}

export interface EditorMeshVertexNudgeCommand {
  readonly operationId?: OperationId | string;
  readonly meshId: MeshId | string;
  readonly vertexId: VertexId | string;
  readonly delta: Vec2Dto;
  readonly intent?: string;
}

export const createMoveMeshVertexOperationRequest = (
  command: EditorMoveMeshVertexCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: createMoveMeshVertexIdempotencyKey(command, basePackageRevision),
    trace: {
      relatedAC: ["AC-MVP-005", "AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-AGENT-002", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "moveMeshVertex",
    payload: {
      meshId: command.meshId,
      vertexDeltas: command.vertexDeltas.map((vertexDelta) => ({
        vertexId: vertexDelta.vertexId,
        delta: {
          x: vertexDelta.delta.x,
          y: vertexDelta.delta.y
        }
      })),
      ...(command.lockedTargetIds === undefined
        ? {}
        : { lockedTargetIds: [...command.lockedTargetIds] }),
      intent: command.intent ?? "editor mesh vertex nudge"
    }
  });

export const createMoveMeshVertexNudgeOperationRequest = (
  command: EditorMeshVertexNudgeCommand,
  basePackageRevision: number
): OperationRequestDto =>
  createMoveMeshVertexOperationRequest(
    {
      ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
      meshId: command.meshId,
      vertexDeltas: [
        {
          vertexId: command.vertexId,
          delta: command.delta
        }
      ],
      ...(command.intent === undefined ? {} : { intent: command.intent })
    },
    basePackageRevision
  );

const createMoveMeshVertexIdempotencyKey = (
  command: EditorMoveMeshVertexCommand,
  basePackageRevision: number
): string =>
  [
    "editor-move-mesh-vertex",
    command.meshId,
    `r${basePackageRevision}`,
    ...command.vertexDeltas.flatMap((vertexDelta) => [
      vertexDelta.vertexId,
      formatNumberToken(vertexDelta.delta.x),
      formatNumberToken(vertexDelta.delta.y)
    ])
  ].join("-");

const formatNumberToken = (value: number): string =>
  Number.isInteger(value) ? `${value}` : Number.parseFloat(value.toFixed(4)).toString();
