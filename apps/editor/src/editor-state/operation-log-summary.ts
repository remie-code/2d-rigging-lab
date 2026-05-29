export interface OperationLogEntrySummaryState {
  readonly operationId: string;
  readonly operationType: string;
  readonly surface: string;
  readonly timestamp: string;
  readonly targetIds: readonly string[];
}

export interface OperationLogSummaryState {
  readonly entryCount: number;
  readonly latestEntry?: OperationLogEntrySummaryState;
  readonly operationTypes: readonly string[];
}

export interface OperationLogEntryProjectionInput {
  readonly operationId: string;
  readonly operationType: string;
  readonly surface: string;
  readonly timestamp: string;
  readonly targetIds?: readonly string[];
}

export const createEmptyOperationLogSummary = (): OperationLogSummaryState => ({
  entryCount: 0,
  operationTypes: []
});

export const projectOperationLogSummary = (
  entries: readonly OperationLogEntryProjectionInput[]
): OperationLogSummaryState => {
  const latest = entries.at(-1);
  const operationTypes = [...new Set(entries.map((entry) => entry.operationType))];

  if (latest === undefined) {
    return createEmptyOperationLogSummary();
  }

  return {
    entryCount: entries.length,
    latestEntry: {
      operationId: latest.operationId,
      operationType: latest.operationType,
      surface: latest.surface,
      timestamp: latest.timestamp,
      targetIds: [...(latest.targetIds ?? [])]
    },
    operationTypes
  };
};
