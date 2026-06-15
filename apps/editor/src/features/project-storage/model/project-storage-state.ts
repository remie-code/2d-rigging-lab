import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type {
  EditorProjectStorageError,
  ExportEditorProjectBundleResult,
  ImportEditorProjectBundleResult
} from "./editor-project-storage";

export type ProjectStorageStatus = "idle" | "loading" | "loaded" | "saving" | "saved" | "error";

export interface ProjectStorageState {
  readonly status: ProjectStorageStatus;
  readonly message: string;
  readonly lastAction: "open" | "save" | null;
  readonly fileName: string | null;
  readonly errorCode: string | null;
  readonly issues: readonly {
    readonly code: string;
    readonly message: string;
    readonly targetPath?: string;
  }[];
  readonly binaryPayloadCount: number | null;
  readonly binaryFileCount: number | null;
  readonly completedAt: string | null;
}

export const createIdleProjectStorageState = (): ProjectStorageState => ({
  status: "idle",
  message: "No portable project operation has run in this session.",
  lastAction: null,
  fileName: null,
  errorCode: null,
  issues: [],
  binaryPayloadCount: null,
  binaryFileCount: null,
  completedAt: null
});

export const createSavingProjectStorageState = (): ProjectStorageState => ({
  ...createIdleProjectStorageState(),
  status: "saving",
  lastAction: "save",
  message: "Saving portable project bundle..."
});

export const createLoadingProjectStorageState = (fileName?: string): ProjectStorageState => ({
  ...createIdleProjectStorageState(),
  status: "loading",
  lastAction: "open",
  fileName: fileName ?? null,
  message: "Opening portable project bundle..."
});

export const createSavedProjectStorageState = (
  result: ExportEditorProjectBundleResult
): ProjectStorageState => ({
  status: "saved",
  message: `Saved ${result.packageDisplayName} revision ${result.packageRevision}.`,
  lastAction: "save",
  fileName: result.fileName,
  errorCode: null,
  issues: [],
  binaryPayloadCount: result.binaryPayloadCount,
  binaryFileCount: result.binaryPayloadCount,
  completedAt: result.exportedAt
});

export const createLoadedProjectStorageState = (
  result: ImportEditorProjectBundleResult,
  fileName?: string
): ProjectStorageState => ({
  status: "loaded",
  message: `Opened ${result.packageDisplayName} revision ${result.packageRevision}.`,
  lastAction: "open",
  fileName: fileName ?? null,
  errorCode: null,
  issues: [],
  binaryPayloadCount: result.binaryPayloadCount,
  binaryFileCount: result.binaryFileCount,
  completedAt: new Date().toISOString()
});

export const createProjectStorageErrorState = (
  error: EditorProjectStorageError,
  action: "open" | "save",
  fileName?: string
): ProjectStorageState => ({
  status: "error",
  message: error.message,
  lastAction: action,
  fileName: fileName ?? null,
  errorCode: error.code,
  issues: error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    ...(issue.targetPath === undefined ? {} : { targetPath: issue.targetPath })
  })),
  binaryPayloadCount: null,
  binaryFileCount: null,
  completedAt: new Date().toISOString()
});

export const createProjectIdentityLabel = (session: AuthoringSession): string =>
  `${session.packageIdentity.packageDisplayName} · rev ${session.packageRevision}`;

export const createProjectSaveStatusLabel = (
  session: AuthoringSession,
  storageState: ProjectStorageState
): string => {
  if (storageState.status === "saving") {
    return "Saving...";
  }

  if (storageState.status === "loading") {
    return "Opening...";
  }

  if (storageState.status === "error") {
    return "Storage error";
  }

  return session.dirty ? "Unsaved changes" : "Saved";
};
