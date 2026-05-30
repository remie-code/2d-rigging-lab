import type {
  OperationId,
  PartId,
  RectDto,
  SourceAssetId,
  TextureId
} from "@private-2d-rigging-lab/contracts";
import {
  createDrawableIdFromDisplayName,
  OperationRequestSchema,
  type GenerateMeshPayloadDto,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorCreateDrawablePresetCommand {
  readonly createOperationId?: OperationId | string;
  readonly generateOperationId?: OperationId | string;
  readonly displayName: string;
  readonly sourceAssetId: SourceAssetId | string;
  readonly sourceLayerId?: string;
  readonly textureId?: TextureId | string;
  readonly partId: PartId | string;
  readonly initialBounds?: RectDto;
  readonly meshMethod?: Extract<GenerateMeshPayloadDto["method"], "manual-empty" | "auto-grid-v1">;
  readonly densityHint?: GenerateMeshPayloadDto["densityHint"];
}

export interface EditorCreateDrawablePresetOperationRequests {
  readonly createDrawable: OperationRequestDto;
  readonly generateMesh: OperationRequestDto;
}

export const createDrawablePresetOperationRequests = (
  command: EditorCreateDrawablePresetCommand,
  basePackageRevision: number
): EditorCreateDrawablePresetOperationRequests => {
  const drawableId = createDrawableIdFromDisplayName(command.displayName);
  const createDrawable = OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.createOperationId === undefined ? {} : { operationId: command.createOperationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-create-drawable-${drawableId}`,
    trace: {
      relatedAC: ["AC-MVP-009", "AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-DEF-003", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "createDrawable",
    payload: {
      sourceAssetId: command.sourceAssetId,
      ...(command.sourceLayerId === undefined ? {} : { sourceLayerId: command.sourceLayerId }),
      ...(command.textureId === undefined ? {} : { textureId: command.textureId }),
      partId: command.partId,
      displayName: command.displayName,
      ...(command.initialBounds === undefined ? {} : { initialBounds: command.initialBounds })
    }
  });
  const generateMesh = OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.generateOperationId === undefined ? {} : { operationId: command.generateOperationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision: basePackageRevision + 1,
    idempotencyKey: `editor-generate-mesh-${drawableId}`,
    trace: {
      relatedAC: ["AC-MVP-009", "AC-MVP-012", "AC-MVP-013"],
      relatedScenarios: ["SC-DEF-003", "SC-MVP-003", "SC-MVP-005"]
    },
    operationType: "generateMesh",
    payload: {
      drawableId,
      method: command.meshMethod ?? "auto-grid-v1",
      ...(command.densityHint === undefined ? {} : { densityHint: command.densityHint })
    }
  });

  return {
    createDrawable,
    generateMesh
  };
};
