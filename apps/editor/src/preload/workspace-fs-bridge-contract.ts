// Pure type surface for the workspace node:fs bridge.
//
// This file must stay free of any `electron`/`node:*` import so renderer
// production code can reference the API type (via `import type`) or the
// `window.editorWorkspaceFs` global without tripping the editor shell boundary
// guard (see `src/editor-shell-boundary.test.ts`).

export type WorkspaceFsEntryKind = "file" | "directory";

export interface WorkspaceFsPickedDirectory {
  readonly rootPath: string;
  readonly name: string;
}

export interface WorkspaceFsDirectoryEntry {
  readonly name: string;
  readonly kind: WorkspaceFsEntryKind;
}

export interface WorkspaceFsStatResult {
  readonly exists: boolean;
  readonly kind: WorkspaceFsEntryKind | null;
}

export type WorkspaceFsReadMode = "utf8" | "binary";

export type WorkspaceFsWritePayload =
  | { readonly kind: "utf8"; readonly text: string }
  | { readonly kind: "binary"; readonly bytes: Uint8Array };

export interface WorkspaceFsReadFile {
  (rootPath: string, relPath: string, mode: "utf8"): Promise<string>;
  (rootPath: string, relPath: string, mode: "binary"): Promise<Uint8Array>;
}

export interface WorkspaceFsApi {
  readonly pickWorkspaceDirectory: () => Promise<WorkspaceFsPickedDirectory | null>;
  readonly listDirectory: (
    rootPath: string,
    relPath: string
  ) => Promise<readonly WorkspaceFsDirectoryEntry[]>;
  readonly statPath: (
    rootPath: string,
    relPath: string
  ) => Promise<WorkspaceFsStatResult>;
  readonly readFile: WorkspaceFsReadFile;
  readonly writeFile: (
    rootPath: string,
    relPath: string,
    payload: WorkspaceFsWritePayload
  ) => Promise<void>;
}

declare global {
  interface Window {
    readonly editorWorkspaceFs?: WorkspaceFsApi;
  }
}
