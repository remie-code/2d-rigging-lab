import { z } from "zod";

import { EditorStatePayloadSchema } from "./ai-command-response-payload.js";

export const AiEditorStateSchema = EditorStatePayloadSchema.extend({
  schemaVersion: z.literal("editor-semantic-state-v1"),
  packageRevision: z.number().int().nonnegative()
}).passthrough();
export type AiEditorState = z.infer<typeof AiEditorStateSchema>;

