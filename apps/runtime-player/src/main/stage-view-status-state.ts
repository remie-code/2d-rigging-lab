import type {
  RuntimePlayerStageViewStatus,
  RuntimePlayerStageViewStatusKind,
  RuntimePlayerStageViewStatusReport,
  RuntimePlayerStageViewStatusTone
} from "../preload/runtime-player-bridge-contract";

export class RuntimePlayerStageViewStatusState {
  private status: RuntimePlayerStageViewStatus;

  constructor(initialStatus?: RuntimePlayerStageViewStatus) {
    this.status = initialStatus ?? createInitialStageViewStatus();
  }

  getStatus(): RuntimePlayerStageViewStatus {
    return this.status;
  }

  setReportedStatus(
    report: unknown,
    updatedAtIso = new Date().toISOString()
  ): RuntimePlayerStageViewStatus {
    this.status = createStageViewStatus(report, updatedAtIso);
    return this.status;
  }
}

export function createInitialStageViewStatus(
  updatedAtIso = new Date(0).toISOString()
): RuntimePlayerStageViewStatus {
  return createStageViewStatus(
    {
      status: "empty",
      statusLabel: "Stage empty",
      message: "No Runtime Export is currently rendered on Stage.",
      details: []
    },
    updatedAtIso
  );
}

export function createStageViewStatus(
  report: unknown,
  updatedAtIso: string
): RuntimePlayerStageViewStatus {
  const status = readStatusKind(report, "status");
  const fallback = createFallbackReport(status);
  const statusLabel = readString(report, "statusLabel", fallback.statusLabel);
  const message = readString(report, "message", fallback.message);

  return {
    status,
    tone: getStatusTone(status),
    statusLabel,
    message,
    details: readStringArray(report, "details"),
    updatedAtIso: readString(
      { updatedAtIso },
      "updatedAtIso",
      new Date(0).toISOString()
    )
  };
}

function createFallbackReport(
  status: RuntimePlayerStageViewStatusKind
): RuntimePlayerStageViewStatusReport {
  if (status === "ready") {
    return {
      status,
      statusLabel: "Stage ready",
      message: "Stage is rendering the evaluated default pose.",
      details: []
    };
  }

  if (status === "warning") {
    return {
      status,
      statusLabel: "Stage diagnostics",
      message: "Stage is rendering with runtime diagnostics.",
      details: []
    };
  }

  if (status === "error") {
    return {
      status,
      statusLabel: "Stage error",
      message: "Stage rendering is unavailable.",
      details: []
    };
  }

  return {
    status: "empty",
    statusLabel: "Stage empty",
    message: "No Runtime Export is currently rendered on Stage.",
    details: []
  };
}

function getStatusTone(
  status: RuntimePlayerStageViewStatusKind
): RuntimePlayerStageViewStatusTone {
  if (status === "ready") {
    return "success";
  }

  if (status === "warning") {
    return "warning";
  }

  if (status === "error") {
    return "error";
  }

  return "neutral";
}

function readStatusKind(
  value: unknown,
  key: string
): RuntimePlayerStageViewStatusKind {
  if (isRecord(value)) {
    const rawStatus = value[key];
    if (
      rawStatus === "empty" ||
      rawStatus === "ready" ||
      rawStatus === "warning" ||
      rawStatus === "error"
    ) {
      return rawStatus;
    }
  }

  return "error";
}

function readString(
  value: unknown,
  key: string,
  fallback: string
): string {
  if (!isRecord(value)) {
    return fallback;
  }

  const rawValue = value[key];
  return typeof rawValue === "string" && rawValue.trim().length > 0
    ? rawValue
    : fallback;
}

function readStringArray(
  value: unknown,
  key: string
): readonly string[] {
  if (!isRecord(value)) {
    return [];
  }

  const rawValue = value[key];
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((detail): detail is string => typeof detail === "string")
    .filter((detail) => detail.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
