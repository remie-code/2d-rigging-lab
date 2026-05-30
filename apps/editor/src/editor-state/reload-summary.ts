export interface ReloadSummaryState {
  readonly status: "not_reloaded" | "reloaded" | "failed";
  readonly packageRevision: number;
  readonly parameterCount: number;
  readonly parameterIds: readonly string[];
  readonly drawableCount: number;
  readonly drawableIds: readonly string[];
  readonly filePaths: readonly string[];
}

export interface ReloadSummaryInput {
  readonly status: "reloaded" | "failed";
  readonly packageRevision: number;
  readonly parameterIds?: readonly string[];
  readonly drawableIds?: readonly string[];
  readonly filePaths?: readonly string[];
}

export const createEmptyReloadSummary = (): ReloadSummaryState => ({
  status: "not_reloaded",
  packageRevision: 0,
  parameterCount: 0,
  parameterIds: [],
  drawableCount: 0,
  drawableIds: [],
  filePaths: []
});

export const projectReloadSummary = (input: ReloadSummaryInput): ReloadSummaryState => {
  const parameterIds = [...(input.parameterIds ?? [])];
  const drawableIds = [...(input.drawableIds ?? [])];

  return {
    status: input.status,
    packageRevision: input.packageRevision,
    parameterCount: parameterIds.length,
    parameterIds,
    drawableCount: drawableIds.length,
    drawableIds,
    filePaths: [...(input.filePaths ?? [])]
  };
};
