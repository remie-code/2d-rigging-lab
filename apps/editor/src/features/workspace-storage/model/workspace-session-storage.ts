import type {
  AuthoringWorkspaceBinaryRegistrationTarget,
  AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  createAuthoringWorkspaceSavePlan,
  hydrateAuthoringWorkspaceSessionBinaryAssets,
  openAuthoringWorkspaceFromTextFileSet
} from "@private-2d-rigging-lab/authoring-core";
import type { PartId } from "@private-2d-rigging-lab/contracts";

import {
  ensureWorkspaceDirectoryPermission,
  pickWorkspaceDirectory,
  readWorkspaceBinaryEntriesForRefs,
  readWorkspaceTextFileSet,
  writeWorkspaceBinaryDecisions,
  writeWorkspaceTextEntries,
  WorkspaceDirectoryIoError,
  type WorkspaceBinaryFileEntry,
  type WorkspaceDirectoryHandleLike
} from "./workspace-directory-io";
import type { EditorWorkspaceTarget } from "./workspace-storage-state";

export interface WorkspaceDirectoryPicker {
  readonly pickDirectory: () => Promise<WorkspaceDirectoryHandleLike>;
}

export interface EditorWorkspaceSaveInput {
  readonly target: EditorWorkspaceTarget;
  readonly session: AuthoringSession;
  readonly baseDocument?: unknown;
  readonly editorHiddenPartIds?: Iterable<PartId>;
}

export interface EditorWorkspaceSaveResult {
  readonly packageDocument: unknown;
  readonly workspaceName: string;
  readonly binaryWriteCount: number;
  readonly binarySkipCount: number;
  readonly savedAt: string;
}

export interface EditorWorkspaceOpenResult {
  readonly target: EditorWorkspaceTarget;
  readonly session: AuthoringSession;
  readonly packageDocument: unknown;
  readonly editorHiddenPartIds: readonly PartId[];
  readonly binaryFileCount: number;
  readonly openedAt: string;
  readonly warnings: readonly {
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }[];
}

export class EditorWorkspaceStorageError extends Error {
  readonly code: string;
  readonly path?: string;

  constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly path?: string;
  }) {
    super(input.message);
    this.name = "EditorWorkspaceStorageError";
    this.code = input.code;
    if (input.path !== undefined) {
      this.path = input.path;
    }
  }
}

export async function createEditorWorkspace(input: {
  readonly session: AuthoringSession;
  readonly baseDocument?: unknown;
  readonly editorHiddenPartIds?: Iterable<PartId>;
  readonly picker?: WorkspaceDirectoryPicker;
  readonly globalObject?: unknown;
}): Promise<EditorWorkspaceOpenResult> {
  const directory = await resolvePickedDirectory(input);
  const target = createEditorWorkspaceTarget(directory);
  const saved = await saveEditorWorkspace({
    target,
    session: input.session,
    ...(input.baseDocument === undefined ? {} : { baseDocument: input.baseDocument }),
    ...(input.editorHiddenPartIds === undefined
      ? {}
      : { editorHiddenPartIds: input.editorHiddenPartIds })
  });

  return {
    target,
    session: markSessionSaved(input.session),
    packageDocument: saved.packageDocument,
    editorHiddenPartIds: Array.from(input.editorHiddenPartIds ?? []),
    binaryFileCount: saved.binaryWriteCount,
    openedAt: saved.savedAt,
    warnings: []
  };
}

export async function openEditorWorkspace(input: {
  readonly picker?: WorkspaceDirectoryPicker;
  readonly globalObject?: unknown;
} = {}): Promise<EditorWorkspaceOpenResult> {
  const directory = await resolvePickedDirectory(input);
  await ensureWorkspaceDirectoryPermission({ directory, mode: "readwrite" });

  const fileSet = await readWorkspaceTextFileSet(directory);
  const opened = openAuthoringWorkspaceFileSet(fileSet);
  const binaryTargets = opened.binaryRegistrationTargets;
  const requiredBinaryTargets = binaryTargets.filter((target) => target.requiredForWorkspaceOpen);
  const binaryEntries = await readWorkspaceBinaryEntriesForRefs(
    directory,
    binaryTargets.map((target) => ({
      packageRelativePath: target.binaryAssetRef.packageRelativePath,
      mediaType: target.binaryAssetRef.mediaType,
      binaryAssetId: target.binaryAssetRef.binaryAssetId
    }))
  );
  await verifyWorkspaceBinaryEntries({
    targets: requiredBinaryTargets,
    entries: binaryEntries
  });
  hydrateAuthoringWorkspaceSessionBinaryAssets({
    session: opened.session,
    binaryRegistrationTargets: binaryTargets,
    binaryEntries
  });

  return {
    target: createEditorWorkspaceTarget(directory),
    session: opened.session,
    packageDocument: opened.packageDocument,
    editorHiddenPartIds: opened.editorHiddenPartIds,
    binaryFileCount: binaryEntries.length,
    openedAt: new Date().toISOString(),
    warnings: opened.warnings
  };
}

export async function saveEditorWorkspace(
  input: EditorWorkspaceSaveInput
): Promise<EditorWorkspaceSaveResult> {
  await ensureWorkspaceDirectoryPermission({
    directory: input.target.directory,
    mode: "readwrite"
  });

  const existingBinaryEntries = await readWorkspaceBinaryEntriesForRefs(
    input.target.directory,
    collectWorkspaceBinaryRefsFromSession(input.session)
  );
  const savedAt = new Date().toISOString();
  const result = await createAuthoringWorkspaceSavePlan({
    session: input.session,
    ...(input.baseDocument === undefined ? {} : { baseDocument: input.baseDocument }),
    ...(input.editorHiddenPartIds === undefined
      ? {}
      : { editorHiddenPartIds: input.editorHiddenPartIds }),
    updatedAt: savedAt,
    existingWorkspaceBinaryFileEntries:
      existingBinaryEntries as NonNullable<
        Parameters<typeof createAuthoringWorkspaceSavePlan>[0]["existingWorkspaceBinaryFileEntries"]
      >
  });
  const errorDecision = result.savePlan.binaryDecisions.find(
    (decision) => decision.action === "error"
  );

  if (errorDecision !== undefined && errorDecision.action === "error") {
    throw new EditorWorkspaceStorageError({
      code: `workspace.binary.${errorDecision.reason}`,
      message: errorDecision.message,
      path: errorDecision.candidate.packageRelativePath
    });
  }

  await writeWorkspaceTextEntries({
    directory: input.target.directory,
    entries: result.savePlan.workspaceTextFileSet
  });
  const binaryWriteCount = await writeWorkspaceBinaryDecisions({
    directory: input.target.directory,
    decisions: result.savePlan.binaryDecisions
  });

  return {
    packageDocument: result.packageDocument,
    workspaceName: input.target.workspaceName,
    binaryWriteCount,
    binarySkipCount: result.savePlan.binaryDecisions.filter(
      (decision) => decision.action === "skip"
    ).length,
    savedAt
  };
}

export async function saveEditorWorkspaceAs(input: {
  readonly session: AuthoringSession;
  readonly baseDocument?: unknown;
  readonly editorHiddenPartIds?: Iterable<PartId>;
  readonly picker?: WorkspaceDirectoryPicker;
  readonly globalObject?: unknown;
}): Promise<EditorWorkspaceOpenResult> {
  return createEditorWorkspace(input);
}

export function toEditorWorkspaceStorageError(error: unknown): EditorWorkspaceStorageError {
  if (error instanceof EditorWorkspaceStorageError) {
    return error;
  }

  if (error instanceof WorkspaceDirectoryIoError) {
    return new EditorWorkspaceStorageError({
      code: error.code,
      message: error.message,
      ...(error.path === undefined ? {} : { path: error.path })
    });
  }

  const message = error instanceof Error ? error.message : String(error);
  return new EditorWorkspaceStorageError({
    code: "workspace.unknown",
    message
  });
}

function createEditorWorkspaceTarget(
  directory: WorkspaceDirectoryHandleLike
): EditorWorkspaceTarget {
  return {
    directory,
    workspaceName: directory.name
  };
}

async function resolvePickedDirectory(input: {
  readonly picker?: WorkspaceDirectoryPicker;
  readonly globalObject?: unknown;
}): Promise<WorkspaceDirectoryHandleLike> {
  if (input.picker !== undefined) {
    return input.picker.pickDirectory();
  }

  return pickWorkspaceDirectory({
    mode: "readwrite",
    ...(input.globalObject === undefined ? {} : { globalObject: input.globalObject })
  });
}

function collectWorkspaceBinaryRefsFromSession(
  session: AuthoringSession
): readonly {
  readonly packageRelativePath: string;
  readonly mediaType: string;
  readonly binaryAssetId?: string;
}[] {
  return (session.graph.textureAtlas?.textures ?? [])
    .flatMap((texture) =>
      texture.binaryAssetRef === undefined
        ? []
        : [{
            packageRelativePath: texture.binaryAssetRef.packageRelativePath,
            mediaType: texture.binaryAssetRef.mediaType,
            binaryAssetId: texture.binaryAssetRef.binaryAssetId
          }]
    );
}

function openAuthoringWorkspaceFileSet(
  fileSet: Parameters<typeof openAuthoringWorkspaceFromTextFileSet>[0]["fileSet"]
): ReturnType<typeof openAuthoringWorkspaceFromTextFileSet> {
  try {
    return openAuthoringWorkspaceFromTextFileSet({ fileSet });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new EditorWorkspaceStorageError({
      code: "workspace.invalidFileSet",
      message: `Invalid workspace file set: ${message}`
    });
  }
}

async function verifyWorkspaceBinaryEntries(input: {
  readonly targets: readonly AuthoringWorkspaceBinaryRegistrationTarget[];
  readonly entries: readonly WorkspaceBinaryFileEntry[];
}): Promise<void> {
  const entriesByPath = new Map(input.entries.map((entry) => [entry.path, entry]));

  for (const target of input.targets) {
    const ref = target.binaryAssetRef;
    const entry = entriesByPath.get(ref.packageRelativePath);

    if (entry === undefined) {
      throw new EditorWorkspaceStorageError({
        code: "workspace.binary.missing",
        message: `Missing workspace binary "${ref.packageRelativePath}".`,
        path: ref.packageRelativePath
      });
    }

    if (entry.bytes.byteLength !== ref.byteLength) {
      throw new EditorWorkspaceStorageError({
        code: "workspace.binary.byteLengthMismatch",
        message:
          `Workspace binary "${ref.packageRelativePath}" has ${entry.bytes.byteLength} bytes; expected ${ref.byteLength}.`,
        path: ref.packageRelativePath
      });
    }

    const digest = await computeSha256Digest(entry.bytes);
    if (digest === null) {
      throw new EditorWorkspaceStorageError({
        code: "workspace.binary.digestUnsupported",
        message: `Workspace binary digest verification is unsupported for "${ref.packageRelativePath}".`,
        path: ref.packageRelativePath
      });
    }

    if (digest !== ref.digest.hex) {
      throw new EditorWorkspaceStorageError({
        code: "workspace.binary.digestMismatch",
        message:
          `Workspace binary "${ref.packageRelativePath}" digest mismatch; expected sha256:${ref.digest.hex}.`,
        path: ref.packageRelativePath
      });
    }
  }
}

async function computeSha256Digest(bytes: Uint8Array): Promise<string | null> {
  const digest = await globalThis.crypto?.subtle?.digest("SHA-256", bytes);

  if (digest === undefined) {
    return null;
  }

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function markSessionSaved(session: AuthoringSession): AuthoringSession {
  const nextSession = structuredClone(session);
  nextSession.dirty = false;
  return nextSession;
}
