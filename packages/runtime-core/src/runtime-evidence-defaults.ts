import {
  RuntimeEvaluationContextSchema
} from "@private-2d-rigging-lab/contracts";
import type { z } from "zod";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import {
  RuntimeEvaluationInputSchema,
  RuntimeInitialStateRequestSchema
} from "./runtime-input.js";
import type {
  RuntimeEvaluationInputInput,
  RuntimeEvaluationInputDto,
  RuntimeInitialStateRequestInput,
  RuntimeInitialStateRequestDto
} from "./runtime-input.js";
import {
  RuntimeEvaluationOptionsSchema
} from "./runtime-options.js";
import type {
  RuntimeEvaluationOptionsDto,
  RuntimeEvaluationOptionsInput
} from "./runtime-options.js";

export type RuntimeEvidenceContextInput = z.input<typeof RuntimeEvaluationContextSchema>;
export type RuntimeEvidenceContextDto = z.infer<typeof RuntimeEvaluationContextSchema>;

export const createDefaultRuntimeEvidenceInitialStateRequest = (
  graph: NormalizedRuntimeGraph,
  overrides: Partial<RuntimeInitialStateRequestInput> = {}
): RuntimeInitialStateRequestDto =>
  RuntimeInitialStateRequestSchema.parse({
    packageId: graph.packageId,
    packageRevision: graph.packageRevision,
    ...(graph.packageHash === undefined ? {} : { packageHash: graph.packageHash }),
    frameIndex: 0,
    fixedStepMs: 16.6666667,
    authoredParameterValues: {},
    resetReasons: ["validationRunStart"],
    ...overrides
  });

export const createDefaultRuntimeEvidenceFrame = (
  overrides: Partial<RuntimeEvaluationInputInput> = {}
): RuntimeEvaluationInputDto =>
  RuntimeEvaluationInputSchema.parse({
    schemaVersion: "runtime-evaluation-input-v1",
    frameIndex: 0,
    deltaTimeMs: 0,
    resetReasons: [],
    authoredParameterValues: {},
    targetIds: [],
    ...overrides
  });

export const createDefaultRuntimeEvidenceOptions = (
  overrides: RuntimeEvaluationOptionsInput = { schemaVersion: "runtime-evaluation-options-v1" }
): RuntimeEvaluationOptionsDto => RuntimeEvaluationOptionsSchema.parse(overrides);

export const createDefaultRuntimeEvidenceContext = (
  overrides: RuntimeEvidenceContextInput = {
    source: { surface: "validator" },
    policy: { strictness: "strict" }
  }
): RuntimeEvidenceContextDto => RuntimeEvaluationContextSchema.parse(overrides);
