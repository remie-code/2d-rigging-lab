import type {
  MeshId,
  MeshTopologyRevisionDto,
  OperationId,
  TriangleId,
  Vec2Dto,
  VertexId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

interface EditorMeshTopologyCommandBase {
  readonly operationId?: OperationId | string;
  readonly meshId: MeshId | string;
  readonly expectedTopologyRevision?: MeshTopologyRevisionDto;
  readonly lockedTargetIds?: readonly string[];
  readonly intent?: string;
}

export interface EditorAddMeshVertexCommand extends EditorMeshTopologyCommandBase {
  readonly vertexId: VertexId | string;
  readonly position: Vec2Dto;
  readonly uv: Vec2Dto;
  readonly insertIndex?: number;
}

export interface EditorRemoveMeshVertexCommand extends EditorMeshTopologyCommandBase {
  readonly vertexId: VertexId | string;
}

export interface EditorAddMeshTriangleCommand extends EditorMeshTopologyCommandBase {
  readonly triangleId: TriangleId | string;
  readonly vertexIds: readonly [VertexId | string, VertexId | string, VertexId | string];
  readonly insertIndex?: number;
}

export interface EditorRemoveMeshTriangleCommand extends EditorMeshTopologyCommandBase {
  readonly triangleId: TriangleId | string;
}

export interface EditorMoveMeshUvPointCommand extends EditorMeshTopologyCommandBase {
  readonly uvDeltas: readonly {
    readonly vertexId: VertexId | string;
    readonly delta: Vec2Dto;
  }[];
}

export const createAddMeshVertexOperationRequest = (
  command: EditorAddMeshVertexCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    ...createMeshTopologyOperationRequestBase(command, basePackageRevision),
    idempotencyKey: createMeshTopologyIdempotencyKey("addMeshVertex", command, basePackageRevision),
    operationType: "addMeshVertex",
    payload: {
      meshId: command.meshId,
      vertexId: command.vertexId,
      position: cloneVec2(command.position),
      uv: cloneVec2(command.uv),
      ...(command.insertIndex === undefined ? {} : { insertIndex: command.insertIndex }),
      ...createOptionalMeshTopologyPayloadBase(command, "editor add mesh vertex")
    }
  });

export const createRemoveMeshVertexOperationRequest = (
  command: EditorRemoveMeshVertexCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    ...createMeshTopologyOperationRequestBase(command, basePackageRevision),
    idempotencyKey: createMeshTopologyIdempotencyKey("removeMeshVertex", command, basePackageRevision),
    operationType: "removeMeshVertex",
    payload: {
      meshId: command.meshId,
      vertexId: command.vertexId,
      removalPolicy: "unreferenced-only",
      ...createOptionalMeshTopologyPayloadBase(command, "editor remove unreferenced mesh vertex")
    }
  });

export const createAddMeshTriangleOperationRequest = (
  command: EditorAddMeshTriangleCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    ...createMeshTopologyOperationRequestBase(command, basePackageRevision),
    idempotencyKey: createMeshTopologyIdempotencyKey("addMeshTriangle", command, basePackageRevision),
    operationType: "addMeshTriangle",
    payload: {
      meshId: command.meshId,
      triangleId: command.triangleId,
      vertexIds: [...command.vertexIds],
      windingPolicy: "preserveVertexOrder",
      ...(command.insertIndex === undefined ? {} : { insertIndex: command.insertIndex }),
      ...createOptionalMeshTopologyPayloadBase(command, "editor add mesh triangle")
    }
  });

export const createRemoveMeshTriangleOperationRequest = (
  command: EditorRemoveMeshTriangleCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    ...createMeshTopologyOperationRequestBase(command, basePackageRevision),
    idempotencyKey: createMeshTopologyIdempotencyKey("removeMeshTriangle", command, basePackageRevision),
    operationType: "removeMeshTriangle",
    payload: {
      meshId: command.meshId,
      triangleId: command.triangleId,
      removalPolicy: "remove-triangle-only",
      ...createOptionalMeshTopologyPayloadBase(command, "editor remove mesh triangle")
    }
  });

export const createMoveMeshUvPointOperationRequest = (
  command: EditorMoveMeshUvPointCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    ...createMeshTopologyOperationRequestBase(command, basePackageRevision),
    idempotencyKey: createMeshTopologyIdempotencyKey("moveMeshUvPoint", command, basePackageRevision),
    operationType: "moveMeshUvPoint",
    payload: {
      meshId: command.meshId,
      uvDeltas: command.uvDeltas.map((uvDelta) => ({
        vertexId: uvDelta.vertexId,
        delta: cloneVec2(uvDelta.delta)
      })),
      ...createOptionalMeshTopologyPayloadBase(command, "editor UV nudge")
    }
  });

const createMeshTopologyOperationRequestBase = (
  command: EditorMeshTopologyCommandBase,
  basePackageRevision: number
) => ({
  schemaVersion: "operation-request-v1",
  ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
  actor: "human",
  surface: "gui",
  dryRun: false,
  basePackageRevision,
  trace: {
    relatedAC: ["AC-MVP-005", "AC-MVP-012", "AC-MVP-013"],
    relatedScenarios: ["SC-AGENT-002", "SC-MVP-003", "SC-MVP-005"]
  }
});

const createOptionalMeshTopologyPayloadBase = (
  command: EditorMeshTopologyCommandBase,
  defaultIntent: string
) => ({
  ...(command.expectedTopologyRevision === undefined
    ? {}
    : { expectedTopologyRevision: command.expectedTopologyRevision }),
  ...(command.lockedTargetIds === undefined
    ? {}
    : { lockedTargetIds: [...command.lockedTargetIds] }),
  intent: command.intent ?? defaultIntent
});

const createMeshTopologyIdempotencyKey = (
  operationType: "addMeshVertex" | "removeMeshVertex" | "addMeshTriangle" | "removeMeshTriangle" | "moveMeshUvPoint",
  command: EditorAddMeshVertexCommand | EditorRemoveMeshVertexCommand | EditorAddMeshTriangleCommand | EditorRemoveMeshTriangleCommand | EditorMoveMeshUvPointCommand,
  basePackageRevision: number
): string =>
  [
    "editor-mesh-topology",
    operationType,
    command.meshId,
    `r${basePackageRevision}`,
    ...createTopologyCommandIdentityTokens(command)
  ].join("-");

const createTopologyCommandIdentityTokens = (
  command: EditorAddMeshVertexCommand | EditorRemoveMeshVertexCommand | EditorAddMeshTriangleCommand | EditorRemoveMeshTriangleCommand | EditorMoveMeshUvPointCommand
): readonly string[] => {
  if ("vertexId" in command) {
    return [command.vertexId, ...("position" in command
      ? [
          formatNumberToken(command.position.x),
          formatNumberToken(command.position.y),
          formatNumberToken(command.uv.x),
          formatNumberToken(command.uv.y)
        ]
      : [])].map(String);
  }

  if ("triangleId" in command) {
    return [command.triangleId, ...("vertexIds" in command ? command.vertexIds : [])].map(String);
  }

  return command.uvDeltas.flatMap((uvDelta) => [
    String(uvDelta.vertexId),
    formatNumberToken(uvDelta.delta.x),
    formatNumberToken(uvDelta.delta.y)
  ]);
};

const cloneVec2 = (value: Vec2Dto): Vec2Dto => ({
  x: value.x,
  y: value.y
});

const formatNumberToken = (value: number): string =>
  Number.isInteger(value) ? `${value}` : Number.parseFloat(value.toFixed(4)).toString();
