export interface ReloadSummaryState {
  readonly status: "not_reloaded" | "reloaded" | "failed";
  readonly packageRevision: number;
  readonly parameterCount: number;
  readonly parameterIds: readonly string[];
  readonly filePaths: readonly string[];
}

export interface ReloadSummaryInput {
  readonly status: "reloaded" | "failed";
  readonly packageRevision: number;
  readonly parameterIds?: readonly string[];
  readonly filePaths?: readonly string[];
}

export const createEmptyReloadSummary = (): ReloadSummaryState => ({
  status: "not_reloaded",
  packageRevision: 0,
  parameterCount: 0,
  parameterIds: [],
  filePaths: []
});

export const projectReloadSummary = (input: ReloadSummaryInput): ReloadSummaryState => {
  const parameterIds = [...(input.parameterIds ?? [])];

  return {
    status: input.status,
    packageRevision: input.packageRevision,
    parameterCount: parameterIds.length,
    parameterIds,
    filePaths: [...(input.filePaths ?? [])]
  };
};
