import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type { WorkspaceDirectoryHandleLike } from "./workspace-directory-io";

export type WorkspaceStorageStatus =
  | "unsupported"
  | "no-workspace"
  | "creating"
  | "opening"
  | "saving"
  | "saved"
  | "save-failed"
  | "permission-denied"
  | "permission-lost";

export interface WorkspaceStorageIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface WorkspaceStorageState {
  readonly status: WorkspaceStorageStatus;
  readonly message: string;
  readonly workspaceName: string | null;
  readonly errorCode: string | null;
  readonly issues: readonly WorkspaceStorageIssue[];
  readonly binaryWriteCount: number | null;
  readonly binarySkipCount: number | null;
  readonly completedAt: string | null;
}

export interface EditorWorkspaceTarget {
  readonly directory: WorkspaceDirectoryHandleLike;
  readonly workspaceName: string;
}

export const createInitialWorkspaceStorageState = (input: {
  readonly supported: boolean;
}): WorkspaceStorageState =>
  input.supported
    ? createNoWorkspaceStorageState()
    : {
        status: "unsupported",
        message:
          "Workspace directory access is unavailable. Portable JSON export remains available after a workspace is open.",
        workspaceName: null,
        errorCode: "unsupported",
        issues: [],
        binaryWriteCount: null,
        binarySkipCount: null,
        completedAt: null
      };

export const createNoWorkspaceStorageState = (): WorkspaceStorageState => ({
  status: "no-workspace",
  message: "No workspace is open.",
  workspaceName: null,
  errorCode: null,
  issues: [],
  binaryWriteCount: null,
  binarySkipCount: null,
  completedAt: null
});

export const createCreatingWorkspaceStorageState = (): WorkspaceStorageState => ({
  ...createNoWorkspaceStorageState(),
  status: "creating",
  message: "Creating workspace..."
});

export const createOpeningWorkspaceStorageState = (): WorkspaceStorageState => ({
  ...createNoWorkspaceStorageState(),
  status: "opening",
  message: "Opening workspace..."
});

export const createSavingWorkspaceStorageState = (
  workspaceName: string | null
): WorkspaceStorageState => ({
  ...createNoWorkspaceStorageState(),
  status: "saving",
  workspaceName,
  message: "Saving workspace..."
});

export const createSavedWorkspaceStorageState = (input: {
  readonly workspaceName: string;
  readonly binaryWriteCount: number;
  readonly binarySkipCount: number;
  readonly message?: string;
  readonly completedAt?: string;
}): WorkspaceStorageState => ({
  status: "saved",
  message: input.message ?? `Saved workspace ${input.workspaceName}.`,
  workspaceName: input.workspaceName,
  errorCode: null,
  issues: [],
  binaryWriteCount: input.binaryWriteCount,
  binarySkipCount: input.binarySkipCount,
  completedAt: input.completedAt ?? new Date().toISOString()
});

export const createWorkspaceStorageErrorState = (input: {
  readonly status?: Extract<
    WorkspaceStorageStatus,
    "save-failed" | "permission-denied" | "permission-lost" | "unsupported" | "no-workspace"
  >;
  readonly workspaceName?: string | null;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly issues?: readonly WorkspaceStorageIssue[];
}): WorkspaceStorageState => ({
  status: input.status ?? "save-failed",
  message: input.message,
  workspaceName: input.workspaceName ?? null,
  errorCode: input.code,
  issues: input.issues ?? [
    {
      code: input.code,
      message: input.message,
      ...(input.path === undefined ? {} : { path: input.path })
    }
  ],
  binaryWriteCount: null,
  binarySkipCount: null,
  completedAt: new Date().toISOString()
});

export const createWorkspaceBlockedStorageState = (
  action: string
): WorkspaceStorageState =>
  createWorkspaceStorageErrorState({
    status: "no-workspace",
    code: "workspace.required",
    message: `Create or open a workspace before ${action}.`
  });

export const createWorkspaceIdentityLabel = (input: {
  readonly session: AuthoringSession;
  readonly target: EditorWorkspaceTarget | null;
  readonly hasOpenWorkspace: boolean;
}): string => {
  if (!input.hasOpenWorkspace) {
    return "No workspace open";
  }

  return `${input.target?.workspaceName ?? input.session.packageIdentity.packageDisplayName} · rev ${input.session.packageRevision}`;
};

export const createWorkspaceSaveStatusLabel = (input: {
  readonly session: AuthoringSession;
  readonly storageState: WorkspaceStorageState;
  readonly hasOpenWorkspace: boolean;
}): string => {
  if (!input.hasOpenWorkspace) {
    return input.storageState.status === "unsupported" ? "Workspace unsupported" : "No workspace";
  }

  if (input.storageState.status === "saving") {
    return "Saving...";
  }

  if (input.storageState.status === "opening") {
    return "Opening...";
  }

  if (input.storageState.status === "creating") {
    return "Creating...";
  }

  if (
    input.storageState.status === "save-failed" ||
    input.storageState.status === "permission-denied" ||
    input.storageState.status === "permission-lost"
  ) {
    return "Save failed";
  }

  return input.session.dirty ? "Unsaved changes" : "Saved";
};

export const isWorkspaceStorageBusy = (state: WorkspaceStorageState): boolean =>
  state.status === "creating" || state.status === "opening" || state.status === "saving";
