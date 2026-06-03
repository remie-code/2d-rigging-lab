import {
  createAuthoringSessionFromPackageDocument,
  getAuthoringSessionBinaryAssetIndex,
  getAuthoringSessionBinaryFileEntries,
  getAuthoringSessionByteIntakeSummaries,
  registerAuthoringSessionBinaryBytes,
  toPackageDocument,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  OperationLogEntryDto,
  OperationRequestDto,
  OperationResultDto
} from "@private-2d-rigging-lab/operation-core";
import {
  createOperationCore,
  OperationRequestSchema,
  parseOperationLogEntriesFromJsonl,
  serializeOperationLogEntriesToJsonl
} from "@private-2d-rigging-lab/operation-core";
import {
  createPackageInMemoryFileSet,
  parsePackageDocumentFromFileSet,
  serializePackageDocumentToFileSet,
  type BinaryAssetIndexFileDto,
  type EditorStateFileDto,
  type PackageBinaryByteIntakeSummaryDto,
  type PackageDocumentDto,
  type PackageFileSet,
  type PackageInMemoryFileSet
} from "@private-2d-rigging-lab/package-format";
import type { ByteIntakePreflightInput } from "@private-2d-rigging-lab/validator-core";

import {
  createBrowserSamplePackageDocument,
  EDITOR_BROWSER_SAMPLE_PACKAGE_HASH
} from "./browser-sample-package.js";
import {
  createEditorBrowserBinaryStorageEvidence,
  createImportPsdSourceAssetCommandWithBinaryBytes,
  createEditorBrowserSourceBinaryByteRegistration,
  type EditorBrowserBinaryStorageEvidence,
  type EditorImportPsdSourceAssetWithBinaryBytesCommand
} from "./binary-byte-registration-command.js";
import {
  createAddDrawableOpacityKeyformOperationRequest,
  createSetMaskRelationOperationRequest,
  type EditorAddDrawableOpacityKeyformCommand,
  type EditorSetMaskRelationCommand
} from "./composition-command.js";
import {
  createParameterOperationRequest,
  type EditorCreateParameterCommand
} from "./create-parameter-command.js";
import {
  createDrawablePresetOperationRequests,
  type EditorCreateDrawablePresetCommand
} from "./create-drawable-preset-command.js";
import {
  createSetDrawableDrawOrderOperationRequest,
  createSetDrawableRuntimeVisibilityOperationRequest,
  type EditorSetDrawableDrawOrderCommand,
  type EditorSetDrawableRuntimeVisibilityCommand
} from "./drawable-layer-command.js";
import {
  createDynamicsGroupOperationRequest,
  createUpdateDynamicsGroupOperationRequest,
  type EditorCreateDynamicsGroupCommand,
  type EditorUpdateDynamicsGroupCommand
} from "./dynamics-group-command.js";
import {
  createMoveMeshVertexOperationRequest,
  type EditorMoveMeshVertexCommand
} from "./mesh-vertex-command.js";
import {
  createAddMeshTriangleOperationRequest,
  createAddMeshVertexOperationRequest,
  createMoveMeshUvPointOperationRequest,
  createRemoveMeshTriangleOperationRequest,
  createRemoveMeshVertexOperationRequest,
  type EditorAddMeshTriangleCommand,
  type EditorAddMeshVertexCommand,
  type EditorMoveMeshUvPointCommand,
  type EditorRemoveMeshTriangleCommand,
  type EditorRemoveMeshVertexCommand
} from "./mesh-topology-command.js";
import {
  createDeletePartOperationRequest,
  createPartOperationRequest,
  createSetDrawablePartOperationRequest,
  createSetDrawableTextureOperationRequest,
  createUpdatePartOperationRequest,
  type EditorCreatePartCommand,
  type EditorDeletePartCommand,
  type EditorSetDrawablePartCommand,
  type EditorSetDrawableTextureCommand,
  type EditorUpdatePartCommand
} from "./part-texture-layer-command.js";
import {
  createAddRigControlAngleKeyformOperationRequest,
  createAddWarpLattice2dControlPointOffsetsKeyformOperationRequest,
  createBindRigControlChildOperationRequest,
  createRotation2dRigControlOperationRequest,
  createWarpLattice2dRigControlOperationRequest,
  type EditorAddRigControlAngleKeyformCommand,
  type EditorAddWarpLattice2dControlPointOffsetsKeyformCommand,
  type EditorBindRigControlChildCommand,
  type EditorCreateRotation2dRigControlCommand,
  type EditorCreateWarpLattice2dRigControlCommand
} from "./rig-control-command.js";
import {
  createImportPsdSourceAssetOperationRequest,
  createImportSplitPngSourceAssetOperationRequest,
  createSetRightsMetadataOperationRequest,
  type EditorImportPsdSourceAssetCommand,
  type EditorImportSplitPngSourceAssetCommand,
  type EditorSetRightsMetadataCommand
} from "./source-import-command.js";
import {
  createEditorEvidenceCollector,
  summarizeEvidencePaths,
  toEvidencePackageFileEntries,
  type EditorEvidencePathSummary
} from "./evidence-provider.js";
import { createEditorSessionByteIntakePreflightAssets } from "./session-byte-availability-bridge.js";

export interface EditorSessionAdapter {
  readonly baseDocument: PackageDocumentDto;
  readonly authoringSession: AuthoringSession;
  createPersistenceSnapshot(options?: EditorSessionPersistenceSnapshotOptions): EditorSessionPersistenceSnapshot;
  getOperationLogEntries(): readonly OperationLogEntryDto[];
  dryRunOperation(request: OperationRequestDto): OperationResultDto;
  commitOperation(request: OperationRequestDto): EditorSessionPersistenceResult;
  commitCreateParameter(command: EditorCreateParameterCommand): EditorSessionPersistenceResult;
  commitCreateDrawablePreset(command: EditorCreateDrawablePresetCommand): EditorSessionDrawablePresetResult;
  commitCreatePart(command: EditorCreatePartCommand): EditorSessionPersistenceResult;
  commitUpdatePart(command: EditorUpdatePartCommand): EditorSessionPersistenceResult;
  commitDeletePart(command: EditorDeletePartCommand): EditorSessionPersistenceResult;
  commitSetDrawablePart(command: EditorSetDrawablePartCommand): EditorSessionPersistenceResult;
  commitSetDrawableTexture(command: EditorSetDrawableTextureCommand): EditorSessionPersistenceResult;
  commitSetDrawableRuntimeVisibility(
    command: EditorSetDrawableRuntimeVisibilityCommand
  ): EditorSessionPersistenceResult;
  commitSetDrawableDrawOrder(command: EditorSetDrawableDrawOrderCommand): EditorSessionPersistenceResult;
  commitMoveMeshVertex(command: EditorMoveMeshVertexCommand): EditorSessionPersistenceResult;
  commitAddMeshVertex(command: EditorAddMeshVertexCommand): EditorSessionPersistenceResult;
  commitRemoveMeshVertex(command: EditorRemoveMeshVertexCommand): EditorSessionPersistenceResult;
  commitAddMeshTriangle(command: EditorAddMeshTriangleCommand): EditorSessionPersistenceResult;
  commitRemoveMeshTriangle(command: EditorRemoveMeshTriangleCommand): EditorSessionPersistenceResult;
  commitMoveMeshUvPoint(command: EditorMoveMeshUvPointCommand): EditorSessionPersistenceResult;
  commitCreateDynamicsGroup(command: EditorCreateDynamicsGroupCommand): EditorSessionPersistenceResult;
  commitUpdateDynamicsGroup(command: EditorUpdateDynamicsGroupCommand): EditorSessionPersistenceResult;
  commitCreateRotation2dRigControl(
    command: EditorCreateRotation2dRigControlCommand
  ): EditorSessionPersistenceResult;
  commitCreateWarpLattice2dRigControl(
    command: EditorCreateWarpLattice2dRigControlCommand
  ): EditorSessionPersistenceResult;
  commitBindRigControlChild(command: EditorBindRigControlChildCommand): EditorSessionPersistenceResult;
  commitAddRigControlAngleKeyform(
    command: EditorAddRigControlAngleKeyformCommand
  ): EditorSessionPersistenceResult;
  commitAddWarpLattice2dControlPointOffsetsKeyform(
    command: EditorAddWarpLattice2dControlPointOffsetsKeyformCommand
  ): EditorSessionPersistenceResult;
  commitSetMaskRelation(command: EditorSetMaskRelationCommand): EditorSessionPersistenceResult;
  commitAddDrawableOpacityKeyform(
    command: EditorAddDrawableOpacityKeyformCommand
  ): EditorSessionPersistenceResult;
  commitImportSplitPngSourceAsset(
    command: EditorImportSplitPngSourceAssetCommand
  ): EditorSessionPersistenceResult;
  commitImportPsdSourceAsset(command: EditorImportPsdSourceAssetCommand): EditorSessionPersistenceResult;
  commitImportPsdSourceAssetWithBinaryBytes(
    command: EditorImportPsdSourceAssetWithBinaryBytesCommand
  ): Promise<EditorSessionPersistenceResult>;
  commitSetRightsMetadata(command: EditorSetRightsMetadataCommand): EditorSessionPersistenceResult;
}

export interface EditorSessionAdapterOptions {
  readonly packageDocument?: PackageDocumentDto;
  readonly packageHash?: string;
  readonly initialOperationLogEntries?: readonly OperationLogEntryDto[];
  readonly initialGeneratedArtifactEntries?: readonly PackageFileSet[number][];
  readonly now?: () => Date;
}

export interface EditorSessionPersistenceSnapshotOptions {
  readonly editorState?: EditorStateFileDto;
}

export interface EditorSessionPersistenceSnapshot {
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly operationLogJsonl: string;
  readonly packageRevision: number;
  readonly packageFileSet: PackageFileSet;
  readonly packageFilePaths: readonly string[];
  readonly packageInMemoryFileSet: PackageInMemoryFileSet;
  readonly packageInMemoryFilePaths: readonly string[];
  readonly binaryByteEvidence: EditorSessionBinaryByteEvidence;
  readonly generatedArtifactPaths: readonly string[];
  readonly document: PackageDocumentDto;
  readonly parameterIds: readonly string[];
  readonly drawableIds: readonly string[];
}

export interface EditorSessionPersistenceResult {
  readonly operationType: OperationRequestDto["operationType"];
  readonly operationResult: OperationResultDto;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly operationLogJsonl: string;
  readonly packageRevisionBefore: number;
  readonly packageRevisionAfterCommit: number;
  readonly packageFileSet: PackageFileSet;
  readonly packageFilePaths: readonly string[];
  readonly packageInMemoryFileSet: PackageInMemoryFileSet;
  readonly packageInMemoryFilePaths: readonly string[];
  readonly binaryByteEvidence: EditorSessionBinaryByteEvidence;
  readonly generatedArtifactPaths: readonly string[];
  readonly evidence: EditorEvidencePathSummary;
  readonly reloadedDocument: PackageDocumentDto;
  readonly reloadedPackageRevision: number;
  readonly parameterIdsAfterReload: readonly string[];
  readonly drawableIdsAfterReload: readonly string[];
}

export interface EditorSessionDrawablePresetResult {
  readonly status: "committed" | "rejected";
  readonly createDrawable: EditorSessionPersistenceResult;
  readonly generateMesh: EditorSessionPersistenceResult | null;
  readonly finalPersistenceResult: EditorSessionPersistenceResult;
}

export interface EditorSessionBinaryByteEvidence {
  readonly packageLocalBinaryFilePaths: readonly string[];
  readonly binaryAssetIndex: BinaryAssetIndexFileDto;
  readonly byteIntakeSummaries: readonly PackageBinaryByteIntakeSummaryDto[];
  readonly byteIntakePreflight: ByteIntakePreflightInput;
  readonly browserStorage: EditorBrowserBinaryStorageEvidence;
}

export const createEditorSessionAdapter = (
  options: EditorSessionAdapterOptions = {}
): EditorSessionAdapter => {
  const baseDocument = options.packageDocument ?? createBrowserSamplePackageDocument();
  const authoringSession = createAuthoringSessionFromPackageDocument(baseDocument);
  const now = options.now ?? (() => new Date());
  const evidenceCollector = createEditorEvidenceCollector({
    packageHash: options.packageHash ?? EDITOR_BROWSER_SAMPLE_PACKAGE_HASH,
    now
  });
  const generatedArtifactEntries = [...(options.initialGeneratedArtifactEntries ?? [])];
  const operationCore = createOperationCore({
    now,
    evidenceProvider: evidenceCollector.collectOperationEvidence,
    initialOperationLogEntries: options.initialOperationLogEntries ?? []
  });

  return {
    baseDocument,
    authoringSession,
    createPersistenceSnapshot(snapshotOptions = {}) {
      return createPersistenceSnapshot({
        authoringSession,
        baseDocument,
        operationLogEntries: operationCore.operationLog.entries,
        generatedArtifactEntries,
        now,
        ...snapshotOptions
      });
    },
    getOperationLogEntries() {
      return operationCore.operationLog.entries;
    },
    dryRunOperation(request) {
      return operationCore.dryRunOperation(authoringSession, request);
    },
    commitOperation(request) {
      return commitOperationRequest({
        request,
        authoringSession,
        baseDocument,
        operationCore,
        evidenceCollector,
        generatedArtifactEntries,
        now
      });
    },
    commitCreateParameter(command) {
      const packageRevisionBefore = authoringSession.packageRevision;
      const request = createParameterOperationRequest(command, packageRevisionBefore);
      return this.commitOperation(request);
    },
    commitCreateDrawablePreset(command) {
      const packageRevisionBefore = authoringSession.packageRevision;
      const requests = createDrawablePresetOperationRequests(command, packageRevisionBefore);
      const createDrawable = this.commitOperation(requests.createDrawable);

      if (createDrawable.operationResult.status !== "committed") {
        return {
          status: "rejected",
          createDrawable,
          generateMesh: null,
          finalPersistenceResult: createDrawable
        };
      }

      const generateMeshRequest = {
        ...requests.generateMesh,
        basePackageRevision: authoringSession.packageRevision
      };
      const generateMesh = this.commitOperation(OperationRequestSchema.parse(generateMeshRequest));

      return {
        status: generateMesh.operationResult.status === "committed" ? "committed" : "rejected",
        createDrawable,
        generateMesh,
        finalPersistenceResult: generateMesh
      };
    },
    commitCreatePart(command) {
      const request = createPartOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitUpdatePart(command) {
      const request = createUpdatePartOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitDeletePart(command) {
      const request = createDeletePartOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitSetDrawablePart(command) {
      const request = createSetDrawablePartOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitSetDrawableTexture(command) {
      const request = createSetDrawableTextureOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitSetDrawableRuntimeVisibility(command) {
      const request = createSetDrawableRuntimeVisibilityOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitSetDrawableDrawOrder(command) {
      const request = createSetDrawableDrawOrderOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitMoveMeshVertex(command) {
      const request = createMoveMeshVertexOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitAddMeshVertex(command) {
      const request = createAddMeshVertexOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitRemoveMeshVertex(command) {
      const request = createRemoveMeshVertexOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitAddMeshTriangle(command) {
      const request = createAddMeshTriangleOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitRemoveMeshTriangle(command) {
      const request = createRemoveMeshTriangleOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitMoveMeshUvPoint(command) {
      const request = createMoveMeshUvPointOperationRequest(command, authoringSession.packageRevision);
      return this.commitOperation(request);
    },
    commitCreateDynamicsGroup(command) {
      const request = createDynamicsGroupOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitUpdateDynamicsGroup(command) {
      const request = createUpdateDynamicsGroupOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitCreateRotation2dRigControl(command) {
      const request = createRotation2dRigControlOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitCreateWarpLattice2dRigControl(command) {
      const request = createWarpLattice2dRigControlOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitBindRigControlChild(command) {
      const request = createBindRigControlChildOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitAddRigControlAngleKeyform(command) {
      const request = createAddRigControlAngleKeyformOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitAddWarpLattice2dControlPointOffsetsKeyform(command) {
      const request = createAddWarpLattice2dControlPointOffsetsKeyformOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitSetMaskRelation(command) {
      const request = createSetMaskRelationOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitAddDrawableOpacityKeyform(command) {
      const request = createAddDrawableOpacityKeyformOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitImportSplitPngSourceAsset(command) {
      const request = createImportSplitPngSourceAssetOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    commitImportPsdSourceAsset(command) {
      const request = createImportPsdSourceAssetOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    },
    async commitImportPsdSourceAssetWithBinaryBytes(command) {
      const registration = await createEditorBrowserSourceBinaryByteRegistration({
        operationId: command.operationId,
        sourceAssetId: command.sourceAssetId,
        packageRelativePath: command.fileRef.packageRelativePath,
        selectedFile: command.selectedFile
      });
      const request = createImportPsdSourceAssetOperationRequest(
        createImportPsdSourceAssetCommandWithBinaryBytes(command, registration),
        authoringSession.packageRevision
      );

      return commitOperationRequest({
        request,
        authoringSession,
        baseDocument,
        operationCore,
        evidenceCollector,
        generatedArtifactEntries,
        now,
        afterCommitted: () => {
          registerAuthoringSessionBinaryBytes(authoringSession, {
            binaryAssetRef: registration.binaryAssetRef,
            bytes: registration.fileEntry.bytes,
            role: "source-original-v1",
            sourceAssetId: registration.sourceAssetId,
            createdByOperationId: registration.operationId,
            byteIntakeSummary: registration.byteIntakeSummary
          });
        }
      });
    },
    commitSetRightsMetadata(command) {
      const request = createSetRightsMetadataOperationRequest(
        command,
        authoringSession.packageRevision
      );
      return this.commitOperation(request);
    }
  };
};

const commitOperationRequest = (input: {
  readonly request: OperationRequestDto;
  readonly authoringSession: AuthoringSession;
  readonly baseDocument: PackageDocumentDto;
  readonly operationCore: ReturnType<typeof createOperationCore>;
  readonly evidenceCollector: ReturnType<typeof createEditorEvidenceCollector>;
  readonly generatedArtifactEntries: PackageFileSet[number][];
  readonly now: () => Date;
  readonly afterCommitted?: () => void;
}): EditorSessionPersistenceResult => {
  const packageRevisionBefore = input.authoringSession.packageRevision;
  const evidenceStartIndex = input.evidenceCollector.captures.length;
  const outcome = input.operationCore.commitOperation(input.authoringSession, input.request);
  const capture = input.evidenceCollector.captures[evidenceStartIndex];

  if (outcome.result.status !== "committed") {
    return createRejectedPersistenceResult({
      operationType: input.request.operationType,
      operationResult: outcome.result,
      operationLogEntries: input.operationCore.operationLog.entries,
      packageRevisionBefore,
      packageRevisionAfterCommit: input.authoringSession.packageRevision,
      authoringSession: input.authoringSession,
      baseDocument: input.baseDocument,
      generatedArtifactEntries: input.generatedArtifactEntries,
      now: input.now
    });
  }

  if (capture === undefined) {
    throw new Error(`Committed ${input.request.operationType} did not produce editor evidence artifacts.`);
  }

  input.afterCommitted?.();

  const operationLogJsonl = serializeOperationLogEntriesToJsonl(input.operationCore.operationLog.entries);
  const savedDocument = toPackageDocument(input.authoringSession, input.baseDocument, {
    updatedAt: input.now().toISOString()
  });
  appendGeneratedArtifactEntries(
    input.generatedArtifactEntries,
    toEvidencePackageFileEntries(capture)
  );
  const packageFileSet = serializePackageDocumentToFileSet(savedDocument, {
    operationLogText: operationLogJsonl,
    generatedArtifacts: input.generatedArtifactEntries
  });
  const packageInMemoryFileSet = createSessionPackageInMemoryFileSet(
    packageFileSet,
    input.authoringSession
  );
  const reloadedDocument = parsePackageDocumentFromFileSet(packageFileSet);
  const evidence = summarizeEvidencePaths(capture);
  const generatedArtifactPaths = input.generatedArtifactEntries.map((entry) => entry.path);
  const binaryByteEvidence = createSessionBinaryByteEvidence(input.authoringSession, savedDocument);

  return {
    operationType: input.request.operationType,
    operationResult: outcome.result,
    operationLogEntries: parseOperationLogEntriesFromJsonl(operationLogJsonl),
    operationLogJsonl,
    packageRevisionBefore,
    packageRevisionAfterCommit: input.authoringSession.packageRevision,
    packageFileSet,
    packageFilePaths: packageFileSet.map((entry) => entry.path),
    packageInMemoryFileSet,
    packageInMemoryFilePaths: packageInMemoryFileSet.map((entry) => entry.path),
    binaryByteEvidence,
    generatedArtifactPaths,
    evidence,
    reloadedDocument,
    reloadedPackageRevision: reloadedDocument.manifest.packageRevision,
    parameterIdsAfterReload: reloadedDocument.model.parameters.parameters.map(
      (parameter) => parameter.parameterId
    ),
    drawableIdsAfterReload: reloadedDocument.model.drawables.drawables.map(
      (drawable) => drawable.drawableId
    )
  };
};

const createPersistenceSnapshot = (input: {
  readonly authoringSession: AuthoringSession;
  readonly baseDocument: PackageDocumentDto;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly generatedArtifactEntries: readonly PackageFileSet[number][];
  readonly now: () => Date;
  readonly editorState?: EditorStateFileDto;
}): EditorSessionPersistenceSnapshot => {
  const operationLogJsonl = serializeOperationLogEntriesToJsonl(input.operationLogEntries);
  const document = applyEditorStateToDocument(
    toPackageDocument(input.authoringSession, input.baseDocument, {
      updatedAt: input.now().toISOString()
    }),
    input.editorState
  );
  const packageFileSet = serializePackageDocumentToFileSet(document, {
    operationLogText: operationLogJsonl,
    generatedArtifacts: input.generatedArtifactEntries
  });
  const packageInMemoryFileSet = createSessionPackageInMemoryFileSet(
    packageFileSet,
    input.authoringSession
  );
  const binaryByteEvidence = createSessionBinaryByteEvidence(input.authoringSession, document);

  return {
    operationLogEntries: parseOperationLogEntriesFromJsonl(operationLogJsonl),
    operationLogJsonl,
    packageRevision: document.manifest.packageRevision,
    packageFileSet,
    packageFilePaths: packageFileSet.map((entry) => entry.path),
    packageInMemoryFileSet,
    packageInMemoryFilePaths: packageInMemoryFileSet.map((entry) => entry.path),
    binaryByteEvidence,
    generatedArtifactPaths: input.generatedArtifactEntries.map((entry) => entry.path),
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

const createSessionPackageInMemoryFileSet = (
  packageFileSet: PackageFileSet,
  authoringSession: AuthoringSession
): PackageInMemoryFileSet =>
  createPackageInMemoryFileSet([
    ...packageFileSet,
    ...getAuthoringSessionBinaryFileEntries(authoringSession)
  ]);

const createSessionBinaryByteEvidence = (
  authoringSession: AuthoringSession,
  packageDocument: PackageDocumentDto
): EditorSessionBinaryByteEvidence => {
  const binaryAssetIndex = getAuthoringSessionBinaryAssetIndex(authoringSession);
  const byteIntakeSummaries = getAuthoringSessionByteIntakeSummaries(authoringSession);
  const binaryFileEntries = getAuthoringSessionBinaryFileEntries(authoringSession);
  const packageLocalBinaryFilePaths = binaryFileEntries.map((entry) => entry.path);

  return {
    packageLocalBinaryFilePaths,
    binaryAssetIndex,
    byteIntakeSummaries,
    byteIntakePreflight: {
      assets: createEditorSessionByteIntakePreflightAssets({
        packageDocument,
        binaryAssetIndex,
        byteIntakeSummaries,
        binaryFileEntries
      })
    },
    browserStorage: createEditorBrowserBinaryStorageEvidence()
  };
};

const appendGeneratedArtifactEntries = (
  target: PackageFileSet[number][],
  entries: readonly PackageFileSet[number][]
): void => {
  const incomingPaths = new Set(entries.map((entry) => entry.path));

  for (let index = target.length - 1; index >= 0; index -= 1) {
    if (incomingPaths.has(target[index]?.path ?? "")) {
      target.splice(index, 1);
    }
  }

  target.push(...entries);
};

const createRejectedPersistenceResult = (input: {
  readonly operationType: OperationRequestDto["operationType"];
  readonly operationResult: OperationResultDto;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly packageRevisionBefore: number;
  readonly packageRevisionAfterCommit: number;
  readonly authoringSession: AuthoringSession;
  readonly baseDocument: PackageDocumentDto;
  readonly generatedArtifactEntries: readonly PackageFileSet[number][];
  readonly now: () => Date;
}): EditorSessionPersistenceResult => {
  const operationLogJsonl = serializeOperationLogEntriesToJsonl(input.operationLogEntries);
  const savedDocument = toPackageDocument(input.authoringSession, input.baseDocument, {
    updatedAt: input.now().toISOString()
  });
  const packageFileSet = serializePackageDocumentToFileSet(savedDocument, {
    operationLogText: operationLogJsonl,
    generatedArtifacts: input.generatedArtifactEntries
  });
  const packageInMemoryFileSet = createSessionPackageInMemoryFileSet(
    packageFileSet,
    input.authoringSession
  );
  const reloadedDocument = parsePackageDocumentFromFileSet(packageFileSet);
  const binaryByteEvidence = createSessionBinaryByteEvidence(input.authoringSession, savedDocument);

  return {
    operationType: input.operationType,
    operationResult: input.operationResult,
    operationLogEntries: input.operationLogEntries,
    operationLogJsonl,
    packageRevisionBefore: input.packageRevisionBefore,
    packageRevisionAfterCommit: input.packageRevisionAfterCommit,
    packageFileSet,
    packageFilePaths: packageFileSet.map((entry) => entry.path),
    packageInMemoryFileSet,
    packageInMemoryFilePaths: packageInMemoryFileSet.map((entry) => entry.path),
    binaryByteEvidence,
    generatedArtifactPaths: input.generatedArtifactEntries.map((entry) => entry.path),
    evidence: {
      runtimeArtifactPaths: [],
      validationArtifactPaths: [],
      generatedRuntimeStateRefs: [],
      generatedRuntimeStateSequenceRefs: [],
      generatedValidationReportIds: []
    },
    reloadedDocument,
    reloadedPackageRevision: reloadedDocument.manifest.packageRevision,
    parameterIdsAfterReload: reloadedDocument.model.parameters.parameters.map(
      (parameter) => parameter.parameterId
    ),
    drawableIdsAfterReload: reloadedDocument.model.drawables.drawables.map(
      (drawable) => drawable.drawableId
    )
  };
};
