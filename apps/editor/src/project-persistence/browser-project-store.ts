import { parsePackageDocumentFromFileSet, type PackageFileSet } from "@private-2d-rigging-lab/package-format";

import {
  PERSISTED_EDITOR_PROJECT_SCHEMA_VERSION,
  type PersistedEditorProjectDto,
  type PersistedEditorProjectPackageSummary
} from "./persisted-editor-project.js";
import {
  parsePersistedEditorProjectJson,
  type PersistedEditorProjectValidationFailure
} from "./persisted-editor-project-validation.js";
import type { StorageLike } from "./storage-like.js";

export const DEFAULT_EDITOR_PROJECT_STORAGE_KEY = "private-2d-rigging-lab.editor-project";

export interface BrowserProjectStoreOptions {
  readonly storage: StorageLike;
  readonly storageKey?: string;
  readonly now?: () => Date;
}

export interface SaveEditorProjectInput {
  readonly packageFileSet: PackageFileSet;
  readonly operationLogJsonl: string;
  readonly generatedArtifactPaths: readonly string[];
}

export interface SaveEditorProjectResult {
  readonly status: "saved";
  readonly storageKey: string;
  readonly project: PersistedEditorProjectDto;
}

export interface LoadEditorProjectEmptyResult {
  readonly status: "empty";
  readonly storageKey: string;
}

export interface LoadEditorProjectLoadedResult {
  readonly status: "loaded";
  readonly storageKey: string;
  readonly project: PersistedEditorProjectDto;
}

export interface LoadEditorProjectFailedResult {
  readonly status: "failed";
  readonly storageKey: string;
  readonly reason: PersistedEditorProjectValidationFailure["reason"] | "storage-read-failed";
  readonly message: string;
}

export type LoadEditorProjectResult =
  | LoadEditorProjectEmptyResult
  | LoadEditorProjectLoadedResult
  | LoadEditorProjectFailedResult;

export interface ClearEditorProjectResult {
  readonly status: "cleared";
  readonly storageKey: string;
}

export interface BrowserProjectStore {
  saveProject(input: SaveEditorProjectInput): SaveEditorProjectResult;
  loadProject(): LoadEditorProjectResult;
  clearProject(): ClearEditorProjectResult;
}

export const createBrowserProjectStore = (
  options: BrowserProjectStoreOptions
): BrowserProjectStore => {
  const storageKey = options.storageKey ?? DEFAULT_EDITOR_PROJECT_STORAGE_KEY;
  const now = options.now ?? (() => new Date());

  return {
    saveProject(input) {
      const project = createPersistedEditorProject({
        ...input,
        savedAt: now().toISOString()
      });

      options.storage.setItem(storageKey, JSON.stringify(project));

      return {
        status: "saved",
        storageKey,
        project
      };
    },

    loadProject() {
      let text: string | null;

      try {
        text = options.storage.getItem(storageKey);
      } catch (error) {
        return {
          status: "failed",
          storageKey,
          reason: "storage-read-failed",
          message: `Could not read stored editor project: ${formatErrorMessage(error)}`
        };
      }

      if (text === null) {
        return {
          status: "empty",
          storageKey
        };
      }

      const parsed = parsePersistedEditorProjectJson(text);
      if (parsed.status === "failed") {
        return {
          status: "failed",
          storageKey,
          reason: parsed.reason,
          message: parsed.message
        };
      }

      return {
        status: "loaded",
        storageKey,
        project: parsed.project
      };
    },

    clearProject() {
      options.storage.removeItem(storageKey);

      return {
        status: "cleared",
        storageKey
      };
    }
  };
};

const createPersistedEditorProject = (
  input: SaveEditorProjectInput & { readonly savedAt: string }
): PersistedEditorProjectDto => ({
  schemaVersion: PERSISTED_EDITOR_PROJECT_SCHEMA_VERSION,
  savedAt: input.savedAt,
  packageFileSet: input.packageFileSet,
  operationLogJsonl: input.operationLogJsonl,
  generatedArtifactPaths: [...input.generatedArtifactPaths],
  packageSummary: createPackageSummary(input.packageFileSet)
});

const createPackageSummary = (
  packageFileSet: PackageFileSet
): PersistedEditorProjectPackageSummary => {
  const document = parsePackageDocumentFromFileSet(packageFileSet);

  return {
    packageId: document.manifest.packageId,
    packageDisplayName: document.manifest.packageDisplayName,
    formatVersion: document.manifest.formatVersion,
    packageRevision: document.manifest.packageRevision,
    updatedAt: document.manifest.updatedAt
  };
};

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
