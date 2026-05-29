import {
  parseOperationLogEntriesFromJsonl
} from "@private-2d-rigging-lab/operation-core";
import {
  parsePackageDocumentFromFileSet,
  type PackageFileSet
} from "@private-2d-rigging-lab/package-format";

import {
  createEditorAiCommandHost,
  projectEditorAiState,
  type EditorAiCommandHost
} from "../ai-command-host/index.js";
import {
  createEditorSessionAdapter,
  type EditorCreateParameterCommand,
  type EditorSessionAdapter,
  type EditorSessionPersistenceResult,
  type EditorSessionPersistenceSnapshot
} from "../editor-session/index.js";
import type {
  BrowserProjectStore,
  ClearEditorProjectResult,
  LoadEditorProjectResult,
  SaveEditorProjectResult
} from "../project-persistence/index.js";
import {
  projectEditorWorkflowViewModel,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../editor-state/index.js";
import {
  applyEditorWorkflowCommitResult,
  createEditorWorkflowState,
  projectLoadedEditorWorkflowState
} from "./workflow-state-projection.js";

export interface EditorWorkflowControllerOptions {
  readonly projectStore: BrowserProjectStore;
  readonly now?: () => Date;
}

export interface EditorWorkflowSaveResult {
  readonly status: "saved";
  readonly snapshot: EditorSessionPersistenceSnapshot;
  readonly storeResult: SaveEditorProjectResult;
}

export interface EditorWorkflowLoadLoadedResult {
  readonly status: "loaded";
  readonly storeResult: Extract<LoadEditorProjectResult, { readonly status: "loaded" }>;
  readonly packageFileSet: PackageFileSet;
}

export interface EditorWorkflowLoadEmptyResult {
  readonly status: "empty";
  readonly storeResult: Extract<LoadEditorProjectResult, { readonly status: "empty" }>;
}

export interface EditorWorkflowLoadFailedResult {
  readonly status: "failed";
  readonly storeResult: Extract<LoadEditorProjectResult, { readonly status: "failed" }>;
}

export type EditorWorkflowLoadResult =
  | EditorWorkflowLoadLoadedResult
  | EditorWorkflowLoadEmptyResult
  | EditorWorkflowLoadFailedResult;

export interface EditorWorkflowResetResult {
  readonly status: "reset";
  readonly clearResult: ClearEditorProjectResult;
}

export type EditorWorkflowPersistenceResult =
  | EditorWorkflowSaveResult
  | EditorWorkflowLoadResult
  | EditorWorkflowResetResult;

export interface EditorWorkflowController {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly aiCommandHost: EditorAiCommandHost;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
  readonly latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null;
  commitCreateParameter(command: EditorCreateParameterCommand): EditorSessionPersistenceResult;
  saveProject(): EditorWorkflowSaveResult;
  loadProject(): EditorWorkflowLoadResult;
  resetToSamplePackage(): EditorWorkflowResetResult;
}

export const createEditorWorkflowController = (
  options: EditorWorkflowControllerOptions
): EditorWorkflowController => {
  const createSampleAdapter = (): EditorSessionAdapter =>
    createEditorSessionAdapter({
      ...(options.now === undefined ? {} : { now: options.now })
    });

  let adapter = createSampleAdapter();
  let state = createEditorWorkflowState(adapter);
  let latestSessionPersistenceResult: EditorSessionPersistenceResult | null = null;
  let latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null = null;
  const createAiHost = (): EditorAiCommandHost =>
    createEditorAiCommandHost({
      operationHost: {
        dryRunOperation(request) {
          return adapter.dryRunOperation(request);
        },
        commitOperation(request) {
          const result = adapter.commitOperation(request);
          latestSessionPersistenceResult = result;
          if (result.operationResult.status === "committed") {
            state = applyEditorWorkflowCommitResult(state, adapter, result);
          }

          return result.operationResult;
        }
      },
      readHost: {
        getEditorState(payload) {
          return projectEditorAiState(state, payload.detail);
        },
        getOperationLog() {
          return adapter.getOperationLogEntries();
        }
      }
    });
  let aiCommandHost = createAiHost();

  return {
    get state() {
      return state;
    },
    get viewModel() {
      return projectEditorWorkflowViewModel(state);
    },
    get aiCommandHost() {
      return aiCommandHost;
    },
    get latestSessionPersistenceResult() {
      return latestSessionPersistenceResult;
    },
    get latestProjectPersistenceResult() {
      return latestProjectPersistenceResult;
    },
    commitCreateParameter(command) {
      const result = adapter.commitCreateParameter(command);

      latestSessionPersistenceResult = result;
      state = applyEditorWorkflowCommitResult(state, adapter, result);

      return result;
    },
    saveProject() {
      const snapshot = adapter.createPersistenceSnapshot();
      const storeResult = options.projectStore.saveProject({
        packageFileSet: snapshot.packageFileSet,
        operationLogJsonl: snapshot.operationLogJsonl,
        generatedArtifactPaths: snapshot.generatedArtifactPaths
      });
      const result: EditorWorkflowSaveResult = {
        status: "saved",
        snapshot,
        storeResult
      };

      latestProjectPersistenceResult = result;

      return result;
    },
    loadProject() {
      const storeResult = options.projectStore.loadProject();

      if (storeResult.status !== "loaded") {
        const result: EditorWorkflowLoadResult =
          storeResult.status === "empty"
            ? { status: "empty", storeResult }
            : { status: "failed", storeResult };
        latestProjectPersistenceResult = result;
        return result;
      }

      const project = storeResult.project;
      const document = parsePackageDocumentFromFileSet(project.packageFileSet);
      const operationLogEntries = parseOperationLogEntriesFromJsonl(project.operationLogJsonl);
      adapter = createEditorSessionAdapter({
        packageDocument: document,
        initialOperationLogEntries: operationLogEntries,
        initialGeneratedArtifactEntries: selectGeneratedArtifactEntries({
          packageFileSet: project.packageFileSet,
          generatedArtifactPaths: project.generatedArtifactPaths
        }),
        packageHash: `persisted:${project.packageSummary.packageId}:r${project.packageSummary.packageRevision}`,
        ...(options.now === undefined ? {} : { now: options.now })
      });
      state = projectLoadedEditorWorkflowState({
        document,
        packageFileSet: project.packageFileSet,
        operationLogEntries,
        generatedArtifactPaths: project.generatedArtifactPaths
      });
      latestSessionPersistenceResult = null;
      aiCommandHost = createAiHost();

      const result: EditorWorkflowLoadResult = {
        status: "loaded",
        storeResult,
        packageFileSet: project.packageFileSet
      };
      latestProjectPersistenceResult = result;

      return result;
    },
    resetToSamplePackage() {
      const clearResult = options.projectStore.clearProject();
      adapter = createSampleAdapter();
      state = createEditorWorkflowState(adapter);
      latestSessionPersistenceResult = null;
      aiCommandHost = createAiHost();

      const result: EditorWorkflowResetResult = {
        status: "reset",
        clearResult
      };
      latestProjectPersistenceResult = result;

      return result;
    }
  };
};

const selectGeneratedArtifactEntries = (input: {
  readonly packageFileSet: PackageFileSet;
  readonly generatedArtifactPaths: readonly string[];
}): PackageFileSet => {
  const generatedPathSet = new Set(input.generatedArtifactPaths);

  return input.packageFileSet.filter((entry) => generatedPathSet.has(entry.path));
};
