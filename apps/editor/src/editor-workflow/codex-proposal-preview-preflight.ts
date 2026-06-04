import {
  getAuthoringSessionBinaryAssetIndex,
  getAuthoringSessionBinaryFileEntries,
  getAuthoringSessionByteIntakeSummaries,
  toPackageDocument,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import { serializeOperationLogEntriesToJsonl } from "@private-2d-rigging-lab/operation-core";
import {
  createPackageInMemoryFileSet,
  serializePackageDocumentToFileSet,
  type EditorStateFileDto,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import {
  createEditorBrowserBinaryStorageEvidence,
  type EditorSessionAdapter,
  type EditorSessionPersistenceSnapshot
} from "../editor-session/index.js";
import { createEditorSessionByteIntakePreflightAssets } from "../editor-session/session-byte-availability-bridge.js";
import type { EditorSemanticState } from "../editor-state/index.js";
import {
  runEditorProductPreflightWorkflow,
  type EditorProductPreflightWorkflowResult
} from "./product-preflight-workflow.js";

export const runCodexProposalPreviewProductPreflightWorkflow = async (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly previewSession: AuthoringSession;
  readonly now?: () => Date;
}): Promise<EditorProductPreflightWorkflowResult> =>
  runEditorProductPreflightWorkflow({
    adapter: createCodexProposalPreviewPreflightAdapter({
      adapter: input.adapter,
      previewSession: input.previewSession,
      ...(input.now === undefined ? {} : { now: input.now })
    }),
    state: input.state,
    ...(input.now === undefined ? {} : { now: input.now })
  });

const createCodexProposalPreviewPreflightAdapter = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly previewSession: AuthoringSession;
  readonly now?: () => Date;
}): EditorSessionAdapter => {
  const now = input.now ?? (() => new Date());
  const previewDocument = toPackageDocument(input.previewSession, input.adapter.baseDocument, {
    updatedAt: now().toISOString()
  });

  return {
    ...input.adapter,
    baseDocument: previewDocument,
    authoringSession: input.previewSession,
    createPersistenceSnapshot(options = {}) {
      return createPreviewPersistenceSnapshot({
        adapter: input.adapter,
        baseDocument: previewDocument,
        previewSession: input.previewSession,
        now,
        ...(options.editorState === undefined ? {} : { editorState: options.editorState })
      });
    },
    commitOperation() {
      throw new Error("Codex proposal preview Product Preflight cannot commit operations.");
    }
  };
};

const createPreviewPersistenceSnapshot = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly baseDocument: PackageDocumentDto;
  readonly previewSession: AuthoringSession;
  readonly now: () => Date;
  readonly editorState?: EditorStateFileDto;
}): EditorSessionPersistenceSnapshot => {
  const operationLogEntries = input.adapter.getOperationLogEntries();
  const operationLogJsonl = serializeOperationLogEntriesToJsonl(operationLogEntries);
  const baseSnapshot = input.adapter.createPersistenceSnapshot();
  const generatedArtifactPathSet = new Set(baseSnapshot.generatedArtifactPaths);
  const generatedArtifactEntries = baseSnapshot.packageFileSet.filter((entry) =>
    generatedArtifactPathSet.has(entry.path)
  );
  const document = applyEditorStateToDocument(
    toPackageDocument(input.previewSession, input.baseDocument, {
      updatedAt: input.now().toISOString()
    }),
    input.editorState
  );
  const packageFileSet = serializePackageDocumentToFileSet(document, {
    operationLogText: operationLogJsonl,
    generatedArtifacts: generatedArtifactEntries
  });
  const binaryFileEntries = getAuthoringSessionBinaryFileEntries(input.previewSession);
  const packageInMemoryFileSet = createPackageInMemoryFileSet([
    ...packageFileSet,
    ...binaryFileEntries
  ]);
  const binaryAssetIndex = getAuthoringSessionBinaryAssetIndex(input.previewSession);
  const byteIntakeSummaries = getAuthoringSessionByteIntakeSummaries(input.previewSession);

  return {
    operationLogEntries,
    operationLogJsonl,
    packageRevision: document.manifest.packageRevision,
    packageFileSet,
    packageFilePaths: packageFileSet.map((entry) => entry.path),
    packageInMemoryFileSet,
    packageInMemoryFilePaths: packageInMemoryFileSet.map((entry) => entry.path),
    binaryByteEvidence: {
      packageLocalBinaryFilePaths: binaryFileEntries.map((entry) => entry.path),
      binaryAssetIndex,
      byteIntakeSummaries,
      byteIntakePreflight: {
        assets: createEditorSessionByteIntakePreflightAssets({
          packageDocument: document,
          binaryAssetIndex,
          byteIntakeSummaries,
          binaryFileEntries
        })
      },
      browserStorage: createEditorBrowserBinaryStorageEvidence()
    },
    generatedArtifactPaths: baseSnapshot.generatedArtifactPaths,
    document,
    parameterIds: document.model.parameters.parameters.map((parameter) => parameter.parameterId),
    drawableIds: document.model.drawables.drawables.map((drawable) => drawable.drawableId)
  };
};

const applyEditorStateToDocument = (
  document: PackageDocumentDto,
  editorState: EditorStateFileDto | undefined
): PackageDocumentDto => {
  if (editorState === undefined) {
    return document;
  }

  return {
    ...document,
    manifest: {
      ...document.manifest,
      modelFiles: {
        ...document.manifest.modelFiles,
        editorState: "model/editor-state.json"
      }
    },
    model: {
      ...document.model,
      editorState
    }
  };
};
