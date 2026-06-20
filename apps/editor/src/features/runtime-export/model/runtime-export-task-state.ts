import type {
  AuthoringSession,
  RuntimeExportBlockerCode,
  RuntimeExportPreflightBlocker,
  RuntimeExportPreflightResult,
  RuntimeExportPreflightWarning,
  RuntimeExportTargetSummary
} from "@private-2d-rigging-lab/authoring-core";

import type {
  WorkspaceDirectoryAccessCapability
} from "../../workspace-storage/model/workspace-directory-io";

export type RuntimeExportTaskState =
  | {
      readonly status: "checking";
      readonly title: string;
      readonly message: string;
      readonly atlasPageSizeLabel: string;
      readonly targetSummary: null;
      readonly blockers: readonly [];
      readonly warnings: readonly RuntimeExportPreflightWarning[];
    }
  | {
      readonly status: "ready";
      readonly title: string;
      readonly message: string;
      readonly atlasPageSizeLabel: string;
      readonly targetSummary: RuntimeExportTargetSummary;
      readonly preflight: Extract<RuntimeExportPreflightResult, { readonly status: "ready" }>;
      readonly blockers: readonly [];
      readonly warnings: readonly RuntimeExportPreflightWarning[];
    }
  | {
      readonly status: "blocked";
      readonly title: string;
      readonly message: string;
      readonly atlasPageSizeLabel: string;
      readonly targetSummary: RuntimeExportTargetSummary;
      readonly preflight: Extract<RuntimeExportPreflightResult, { readonly status: "blocked" }>;
      readonly blockers: readonly RuntimeExportPreflightBlocker[];
      readonly warnings: readonly RuntimeExportPreflightWarning[];
      readonly primaryAction: RuntimeExportBlockedAction;
    }
  | {
      readonly status: "failed";
      readonly title: string;
      readonly message: string;
      readonly atlasPageSizeLabel: string;
      readonly targetSummary: null;
      readonly blockers: readonly [];
      readonly warnings: readonly RuntimeExportPreflightWarning[];
      readonly primaryAction: RuntimeExportBlockedAction;
    };

export type RuntimeExportBlockedAction = "textureAtlas" | "validate";
export type RuntimeExportPreflightCheckStatus = "ready" | "blocked" | "pending";

export interface RuntimeExportPreflightCheckRow {
  readonly id: string;
  readonly label: string;
  readonly status: RuntimeExportPreflightCheckStatus;
  readonly message: string;
}

const ATLAS_BLOCKER_CODES = new Set<RuntimeExportBlockerCode>([
  "runtimeExport.noCommittedAtlas",
  "runtimeExport.missingSourceSignature",
  "runtimeExport.staleAtlas",
  "runtimeExport.missingAtlasPage",
  "runtimeExport.missingAtlasTextureEntry",
  "runtimeExport.missingAtlasBinaryRef",
  "runtimeExport.missingAtlasBytes",
  "runtimeExport.atlasDimensionsMismatch",
  "runtimeExport.atlasByteLengthMismatch",
  "runtimeExport.atlasMediaTypeMismatch",
  "runtimeExport.atlasDigestMismatch",
  "runtimeExport.requiredBinaryUnavailable",
  "runtimeExport.invalidPlacementData",
  "runtimeExport.uncoveredRuntimeTarget"
]);

export function createRuntimeExportCheckingTaskState(
  session: AuthoringSession
): RuntimeExportTaskState {
  return {
    status: "checking",
    title: "Checking Runtime Export readiness",
    message: "Checking the committed Texture Atlas, atlas bytes, and runtime graph.",
    atlasPageSizeLabel: formatRuntimeExportAtlasPageSize(session),
    targetSummary: null,
    blockers: [],
    warnings: []
  };
}

export function createRuntimeExportTaskState(input: {
  readonly session: AuthoringSession;
  readonly preflight: RuntimeExportPreflightResult;
}): RuntimeExportTaskState {
  if (input.preflight.status === "ready") {
    return {
      status: "ready",
      title: "Ready to export",
      message: "Runtime Export can write a directory artifact from the current atlas.",
      atlasPageSizeLabel: formatRuntimeExportAtlasPageSize(input.session),
      targetSummary: input.preflight.targetSummary,
      preflight: input.preflight,
      blockers: [],
      warnings: input.preflight.warnings
    };
  }

  const primaryBlocker = input.preflight.blockers[0];

  return {
    status: "blocked",
    title: formatRuntimeExportBlockedTitle(primaryBlocker),
    message: primaryBlocker?.message ?? "Runtime Export is blocked.",
    atlasPageSizeLabel: formatRuntimeExportAtlasPageSize(input.session),
    targetSummary: input.preflight.targetSummary,
    preflight: input.preflight,
    blockers: input.preflight.blockers,
    warnings: input.preflight.warnings,
    primaryAction: getRuntimeExportBlockedAction(primaryBlocker)
  };
}

export function createRuntimeExportFailedTaskState(input: {
  readonly session: AuthoringSession;
  readonly error: unknown;
}): RuntimeExportTaskState {
  return {
    status: "failed",
    title: "Runtime Export preflight failed",
    message: formatRuntimeExportError(input.error),
    atlasPageSizeLabel: formatRuntimeExportAtlasPageSize(input.session),
    targetSummary: null,
    blockers: [],
    warnings: [],
    primaryAction: "validate"
  };
}

export function createRuntimeExportPreflightCheckRows(
  state: RuntimeExportTaskState
): readonly RuntimeExportPreflightCheckRow[] {
  if (state.status === "checking") {
    return [
      createCheckRow("atlas-current", "Atlas current", "pending", "Checking committed atlas."),
      createCheckRow("atlas-bytes", "Atlas bytes", "pending", "Checking raw RGBA page bytes."),
      createCheckRow("runtime-graph", "Runtime graph", "pending", "Checking materialization.")
    ];
  }

  if (state.status === "ready") {
    return [
      createCheckRow("atlas-current", "Atlas current", "ready", "Committed atlas is current."),
      createCheckRow("atlas-bytes", "Atlas bytes", "ready", "Raw RGBA page bytes are available."),
      createCheckRow("runtime-graph", "Runtime graph", "ready", "Materialized runtime graph is ready.")
    ];
  }

  if (state.status === "failed") {
    return [
      createCheckRow("atlas-current", "Atlas current", "pending", "Preflight did not complete."),
      createCheckRow("atlas-bytes", "Atlas bytes", "pending", "Preflight did not complete."),
      createCheckRow("runtime-graph", "Runtime graph", "blocked", state.message)
    ];
  }

  const atlasBlocker = state.blockers.find((blocker) => isRuntimeExportAtlasBlocker(blocker));
  const graphBlocker = state.blockers.find((blocker) => !isRuntimeExportAtlasBlocker(blocker));
  const bytesBlocker = state.blockers.find((blocker) =>
    blocker.code === "runtimeExport.missingAtlasBytes" ||
    blocker.code === "runtimeExport.atlasByteLengthMismatch" ||
    blocker.code === "runtimeExport.atlasMediaTypeMismatch" ||
    blocker.code === "runtimeExport.atlasDigestMismatch" ||
    blocker.code === "runtimeExport.requiredBinaryUnavailable"
  );

  return [
    createCheckRow(
      "atlas-current",
      "Atlas current",
      atlasBlocker === undefined ? "ready" : "blocked",
      atlasBlocker?.message ?? "Committed atlas source signature is current."
    ),
    createCheckRow(
      "atlas-bytes",
      "Atlas bytes",
      bytesBlocker === undefined ? "ready" : "blocked",
      bytesBlocker?.message ?? "Raw RGBA page bytes are available."
    ),
    createCheckRow(
      "runtime-graph",
      "Runtime graph",
      graphBlocker === undefined ? "ready" : "blocked",
      graphBlocker?.message ?? "Runtime graph can be materialized."
    )
  ];
}

export function getRuntimeExportBlockedAction(
  blocker: RuntimeExportPreflightBlocker | undefined
): RuntimeExportBlockedAction {
  if (blocker === undefined) {
    return "validate";
  }

  return isRuntimeExportAtlasBlocker(blocker) ? "textureAtlas" : "validate";
}

export function formatRuntimeExportDirectoryAccessReason(
  capability: WorkspaceDirectoryAccessCapability
): string | null {
  if (capability.supported) {
    return null;
  }

  if (capability.reason === "show-directory-picker-unavailable") {
    return "Directory export is unavailable because this browser does not expose the directory picker.";
  }

  return "Directory export is unavailable in this browser.";
}

export function formatRuntimeExportTargetSummaryLabel(
  state: RuntimeExportTaskState
): string {
  if (state.targetSummary === null) {
    return "Targets pending";
  }

  return `${state.targetSummary.includedDrawableCount} included / ${state.targetSummary.excludedUnboundDrawableCount} excluded`;
}

export function formatRuntimeExportValidateWarningLabel(
  warnings: readonly RuntimeExportPreflightWarning[]
): string {
  const warning = warnings.find((candidate) =>
    candidate.code === "runtimeExport.validateWarningsPresent"
  );

  if (warning === undefined) {
    return "No Validate warnings";
  }

  return warning.message;
}

function formatRuntimeExportBlockedTitle(
  blocker: RuntimeExportPreflightBlocker | undefined
): string {
  if (blocker === undefined) {
    return "Runtime Export blocked";
  }

  switch (blocker.code) {
    case "runtimeExport.noCommittedAtlas":
      return "Texture Atlas required";
    case "runtimeExport.staleAtlas":
      return "Texture Atlas is out of date";
    case "runtimeExport.missingAtlasBytes":
      return "Atlas texture bytes are missing";
    case "runtimeExport.runtimeGraphMaterializationFailed":
      return "Runtime graph could not be built";
    default:
      return "Runtime Export blocked";
  }
}

function isRuntimeExportAtlasBlocker(blocker: RuntimeExportPreflightBlocker): boolean {
  return ATLAS_BLOCKER_CODES.has(blocker.code);
}

function formatRuntimeExportAtlasPageSize(session: AuthoringSession): string {
  const page = session.graph.textureAtlas?.layoutSummary?.pages[0];

  if (page === undefined) {
    return "No committed page";
  }

  return `${page.width} x ${page.height}`;
}

function formatRuntimeExportError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createCheckRow(
  id: string,
  label: string,
  status: RuntimeExportPreflightCheckStatus,
  message: string
): RuntimeExportPreflightCheckRow {
  return {
    id,
    label,
    status,
    message
  };
}
