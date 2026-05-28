import { z } from "zod";

export const RuntimeStateArtifactRefSchema = z.string().regex(
  /^runtime\/states\/[A-Za-z0-9_.-]+\.runtime-state\.json$/
);
export type RuntimeStateArtifactRef = z.infer<typeof RuntimeStateArtifactRefSchema>;
export const RuntimeStateArtifactRefDtoSchema = RuntimeStateArtifactRefSchema;
export type RuntimeStateArtifactRefDto = RuntimeStateArtifactRef;

export const RuntimeStateSequenceArtifactRefSchema = z.string().regex(
  /^runtime\/state-sequences\/[A-Za-z0-9_.-]+\.runtime-state-sequence\.json$/
);
export type RuntimeStateSequenceArtifactRef = z.infer<typeof RuntimeStateSequenceArtifactRefSchema>;
export const RuntimeStateSequenceArtifactRefDtoSchema = RuntimeStateSequenceArtifactRefSchema;
export type RuntimeStateSequenceArtifactRefDto = RuntimeStateSequenceArtifactRef;
