export interface GeneratedEvidenceSummaryState {
  readonly runtimeSnapshotIds: readonly string[];
  readonly runtimeStateArtifactPaths: readonly string[];
  readonly runtimeStateSequenceArtifactPaths: readonly string[];
  readonly validationReportIds: readonly string[];
  readonly validationReportArtifactPaths: readonly string[];
}

export interface GeneratedEvidenceSummaryInput {
  readonly runtimeSnapshotIds?: readonly string[];
  readonly runtimeStateArtifactPaths?: readonly string[];
  readonly runtimeStateSequenceArtifactPaths?: readonly string[];
  readonly validationReportIds?: readonly string[];
  readonly validationReportArtifactPaths?: readonly string[];
}

export const createEmptyGeneratedEvidenceSummary = (): GeneratedEvidenceSummaryState => ({
  runtimeSnapshotIds: [],
  runtimeStateArtifactPaths: [],
  runtimeStateSequenceArtifactPaths: [],
  validationReportIds: [],
  validationReportArtifactPaths: []
});

export const projectGeneratedEvidenceSummary = (
  input: GeneratedEvidenceSummaryInput
): GeneratedEvidenceSummaryState => ({
  runtimeSnapshotIds: [...(input.runtimeSnapshotIds ?? [])],
  runtimeStateArtifactPaths: [...(input.runtimeStateArtifactPaths ?? [])],
  runtimeStateSequenceArtifactPaths: [...(input.runtimeStateSequenceArtifactPaths ?? [])],
  validationReportIds: [...(input.validationReportIds ?? [])],
  validationReportArtifactPaths: [...(input.validationReportArtifactPaths ?? [])]
});
