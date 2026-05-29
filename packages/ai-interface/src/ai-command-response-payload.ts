import { OperationLogEntrySchema, OperationResultSchema } from "@private-2d-rigging-lab/operation-core";
import { z } from "zod";

import {
  InspectModelResultSchema,
  InspectTargetResultSchema
} from "./ai-inspection-command.js";
import { ValidatePackageResultSchema } from "./ai-validation-command.js";

export const EditorStatePayloadSchema = z
  .object({
    schemaVersion: z.literal("editor-semantic-state-v1"),
    packageRevision: z.number().int().nonnegative().optional()
  })
  .passthrough();
export type EditorStatePayload = z.infer<typeof EditorStatePayloadSchema>;

export const AiCommandResponsePayloadSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("getEditorState"),
    payload: z.object({
      editorState: EditorStatePayloadSchema
    })
  }),
  z.object({
    command: z.literal("inspectModel"),
    payload: InspectModelResultSchema
  }),
  z.object({
    command: z.literal("inspectTarget"),
    payload: InspectTargetResultSchema
  }),
  z.object({
    command: z.literal("validatePackage"),
    payload: ValidatePackageResultSchema
  }),
  z.object({
    command: z.literal("dryRunOperation"),
    payload: z.object({
      operationResult: OperationResultSchema
    })
  }),
  z.object({
    command: z.literal("commitOperation"),
    payload: z.object({
      operationResult: OperationResultSchema
    })
  }),
  z.object({
    command: z.literal("getOperationLog"),
    payload: z.object({
      entries: z.array(OperationLogEntrySchema)
    })
  })
]);
export type AiCommandResponsePayload = z.infer<typeof AiCommandResponsePayloadSchema>;
