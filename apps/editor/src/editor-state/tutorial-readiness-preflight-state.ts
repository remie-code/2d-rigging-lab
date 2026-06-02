export type TutorialReadinessPreflightStatus = "not_run" | "pass" | "fail";

export interface TutorialReadinessPreflightState {
  readonly status: TutorialReadinessPreflightStatus;
  readonly reportId: string | null;
  readonly checkCount: number;
  readonly failingCheckIds: readonly string[];
  readonly runtimeSnapshotIds: readonly string[];
  readonly supplementalGuiEvidenceRefs: readonly string[];
}

export interface TutorialReadinessPreflightReportLike {
  readonly reportId: string;
  readonly summary: {
    readonly status: string;
  };
  readonly checks: readonly {
    readonly checkId: string;
    readonly status: string;
  }[];
  readonly evidence: {
    readonly runtimeSnapshotIds?: readonly string[];
    readonly supplementalGuiEvidenceRefs?: readonly string[];
  };
}

export const createEmptyTutorialReadinessPreflightState =
  (): TutorialReadinessPreflightState => ({
    status: "not_run",
    reportId: null,
    checkCount: 0,
    failingCheckIds: [],
    runtimeSnapshotIds: [],
    supplementalGuiEvidenceRefs: []
  });

export const projectTutorialReadinessPreflightState = (
  report: TutorialReadinessPreflightReportLike | null
): TutorialReadinessPreflightState => {
  if (report === null) {
    return createEmptyTutorialReadinessPreflightState();
  }

  return {
    status: report.summary.status === "pass" ? "pass" : "fail",
    reportId: report.reportId,
    checkCount: report.checks.length,
    failingCheckIds: report.checks
      .filter((check) => check.status !== "pass" && check.status !== "not_applicable")
      .map((check) => check.checkId),
    runtimeSnapshotIds: [...(report.evidence.runtimeSnapshotIds ?? [])],
    supplementalGuiEvidenceRefs: [...(report.evidence.supplementalGuiEvidenceRefs ?? [])]
  };
};
