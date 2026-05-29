import { OperationIdSchema, SurfaceSchema } from "@private-2d-rigging-lab/contracts";
import type { OperationLogEntryDto } from "@private-2d-rigging-lab/operation-core";
import { z } from "zod";

export const AiOperationLogQuerySchema = z.object({
  operationIds: z.array(OperationIdSchema).optional(),
  targetIds: z.array(z.string().min(1)).optional(),
  surface: SurfaceSchema.optional()
});
export type AiOperationLogQuery = z.infer<typeof AiOperationLogQuerySchema>;

export const parseAiOperationLogQuery = (query: unknown): AiOperationLogQuery =>
  AiOperationLogQuerySchema.parse(query);

export const operationLogEntryMatchesAiQuery = (
  entry: OperationLogEntryDto,
  query: AiOperationLogQuery
): boolean => {
  if (query.operationIds !== undefined && !query.operationIds.includes(entry.operationId)) {
    return false;
  }
  if (query.surface !== undefined && entry.surface !== query.surface) {
    return false;
  }
  if (
    query.targetIds !== undefined &&
    !query.targetIds.some((targetId) => entry.targetIds.includes(targetId))
  ) {
    return false;
  }

  return true;
};

export const filterAiOperationLogEntries = (
  entries: readonly OperationLogEntryDto[],
  query: AiOperationLogQuery
): OperationLogEntryDto[] => entries.filter((entry) => operationLogEntryMatchesAiQuery(entry, query));

