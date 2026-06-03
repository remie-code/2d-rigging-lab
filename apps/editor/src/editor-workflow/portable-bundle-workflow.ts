import {
  exportPortablePackageBundleV0,
  importPortablePackageBundleV0,
  PortablePackageBundleError,
  serializePackageDocumentToFileSet,
  type PackageFileSet,
  type PortablePackageBundleIssue,
  type PortablePackageBundleV0Dto
} from "@private-2d-rigging-lab/package-format";

import {
  createEditorSessionAdapter,
  registerEditorImportedPortableBundleBytes,
  type EditorImportedPortableBundleByteRegistrationResult,
  type EditorPersistentByteStore,
  type EditorSessionAdapter,
  type EditorSessionPersistenceSnapshot
} from "../editor-session/index.js";
import type { EditorSemanticState } from "../editor-state/index.js";
import { projectLoadedEditorWorkflowState } from "./workflow-state-projection.js";

interface EditorWorkflowPortableBundleFailureDetails {
  readonly code: string;
  readonly message: string;
  readonly issues: readonly PortablePackageBundleIssue[];
}

export interface EditorWorkflowPortableBundleExportFailedResult
  extends EditorWorkflowPortableBundleFailureDetails {
  readonly status: "portableExportFailed";
}

export interface EditorWorkflowPortableBundleImportFailedResult
  extends EditorWorkflowPortableBundleFailureDetails {
  readonly status: "portableImportFailed";
}

export interface EditorWorkflowPortableBundleExportedResult {
  readonly status: "portableExported";
  readonly snapshot: EditorSessionPersistenceSnapshot;
  readonly bundle: PortablePackageBundleV0Dto;
  readonly bundleJson: string;
  readonly suggestedFilename: string;
  readonly binaryPayloadCount: number;
}

export type EditorWorkflowPortableBundleExportResult =
  | EditorWorkflowPortableBundleExportedResult
  | EditorWorkflowPortableBundleExportFailedResult;

export interface EditorWorkflowPortableBundleImportedResult {
  readonly status: "portableImported";
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly snapshot: EditorSessionPersistenceSnapshot;
  readonly packageFileSet: PackageFileSet;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly binaryPayloadCount: number;
  readonly byteRegistration: EditorImportedPortableBundleByteRegistrationResult;
}

export type EditorWorkflowPortableBundleImportResult =
  | EditorWorkflowPortableBundleImportedResult
  | EditorWorkflowPortableBundleImportFailedResult;

export const exportEditorWorkflowPortableBundleV0 = async (input: {
  readonly snapshot: EditorSessionPersistenceSnapshot;
}): Promise<EditorWorkflowPortableBundleExportResult> => {
  const packageLocalBinaryFilePaths = new Set(
    input.snapshot.binaryByteEvidence.packageLocalBinaryFilePaths
  );

  try {
    const bundle = await exportPortablePackageBundleV0({
      packageDocument: input.snapshot.document,
      fileSet: input.snapshot.packageInMemoryFileSet,
      requiresReupload: (binaryAssetRef) =>
        !packageLocalBinaryFilePaths.has(binaryAssetRef.packageRelativePath)
    });

    return {
      status: "portableExported",
      snapshot: input.snapshot,
      bundle,
      bundleJson: JSON.stringify(bundle, null, 2),
      suggestedFilename: createPortableBundleFilename(bundle),
      binaryPayloadCount: bundle.binaryPayloads.length
    };
  } catch (error) {
    return createPortableBundleFailureResult("portableExportFailed", error);
  }
};

export const importEditorWorkflowPortableBundleV0 = async (input: {
  readonly bundle: unknown;
  readonly persistentByteStore: EditorPersistentByteStore;
  readonly now?: () => Date;
}): Promise<EditorWorkflowPortableBundleImportResult> => {
  try {
    const imported = await importPortablePackageBundleV0({ bundle: input.bundle });
    const packageDocument = imported.packageDocument;
    const adapter = createEditorSessionAdapter({
      packageDocument,
      packageHash:
        `portable-bundle:${imported.bundle.packageId}:r${imported.bundle.packageRevision}`,
      ...(input.now === undefined ? {} : { now: input.now })
    });
    const byteRegistration = await registerEditorImportedPortableBundleBytes({
      authoringSession: adapter.authoringSession,
      packageDocument,
      binaryEntries: imported.binaryEntries,
      persistentByteStore: input.persistentByteStore,
      ...(input.now === undefined ? {} : { now: input.now })
    });
    const snapshot = adapter.createPersistenceSnapshot();
    const packageFileSet = serializePackageDocumentToFileSet(packageDocument);
    const state = projectLoadedEditorWorkflowState({
      document: packageDocument,
      packageFileSet,
      operationLogEntries: [],
      generatedArtifactPaths: [],
      binaryByteIntake: {
        sourceAssets: packageDocument.assets.sourceManifest.sourceAssets,
        ...(packageDocument.assets.textureAtlas === undefined
          ? {}
          : { textureAtlas: packageDocument.assets.textureAtlas }),
        byteIntakeSummaries: snapshot.binaryByteEvidence.byteIntakeSummaries,
        packageLocalBinaryFilePaths:
          snapshot.binaryByteEvidence.packageLocalBinaryFilePaths,
        reloadSource: "browserLocalLoad"
      },
      ...(input.now === undefined ? {} : { now: input.now })
    });

    return {
      status: "portableImported",
      adapter,
      state,
      snapshot,
      packageFileSet,
      packageId: imported.bundle.packageId,
      packageRevision: imported.bundle.packageRevision,
      binaryPayloadCount: imported.bundle.binaryPayloads.length,
      byteRegistration
    };
  } catch (error) {
    return createPortableBundleFailureResult("portableImportFailed", error);
  }
};

const createPortableBundleFilename = (bundle: PortablePackageBundleV0Dto): string => {
  const safePackageId = bundle.packageId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `${safePackageId}-r${bundle.packageRevision}.portable-package-bundle-v0.json`;
};

function createPortableBundleFailureResult(
  status: "portableExportFailed",
  error: unknown
): EditorWorkflowPortableBundleExportFailedResult;
function createPortableBundleFailureResult(
  status: "portableImportFailed",
  error: unknown
): EditorWorkflowPortableBundleImportFailedResult;
function createPortableBundleFailureResult(
  status: "portableExportFailed" | "portableImportFailed",
  error: unknown
): EditorWorkflowPortableBundleExportFailedResult | EditorWorkflowPortableBundleImportFailedResult {
  if (error instanceof PortablePackageBundleError) {
    return {
      status,
      code: error.code,
      message: error.message,
      issues: error.issues
    };
  }

  return {
    status,
    code: "portableBundle.workflow.failed",
    message: formatErrorMessage(error),
    issues: []
  };
}

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
