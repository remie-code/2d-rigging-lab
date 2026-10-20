import type {
  BinaryAssetReferenceDto,
  BinaryAssetRoleDto
} from "./binary-asset.js";
import {
  getBinaryAssetExpectedMetadata,
  verifyIndexedPackageBinaryAssetBytes,
  verifyPackageBinaryFileEntryAgainstExpected
} from "./package-binary-asset-verification.js";
import {
  indexPackageInMemoryFileSet,
  type PackageInMemoryFileIndex
} from "./package-binary-file-index.js";
import type {
  PackageBinaryAssetVerificationReport,
  PackageBinaryFileEntry
} from "./package-binary-file-set.js";
import { PackageDocumentSchema, type PackageDocumentDto } from "./package-document.js";
import { assertUniquePackageFilePaths } from "./package-file-paths.js";
import {
  serializePackageDocumentToFileSet,
  type PackageFileSet
} from "./package-file-set.js";
import type { WorkspaceMetadataDto } from "./workspace-metadata.js";
import {
  serializeWorkspacePackageFileSet
} from "./workspace-file-set.js";

export type WorkspaceBinaryCandidateSource =
  | "texture-atlas-texture-v1";

export type WorkspaceExcludedBinaryReferenceReason =
  | "psd-source-original-excluded-v1"
  | "source-original-excluded-v1";

export interface WorkspaceBinaryAssetCandidate {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly role: BinaryAssetRoleDto;
  readonly source: WorkspaceBinaryCandidateSource;
  readonly packageRelativePath: string;
  readonly textureId: string;
  readonly sourceAssetId?: string;
  readonly sourceLayerId?: string;
}

export interface WorkspaceExcludedBinaryReference {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly reason: WorkspaceExcludedBinaryReferenceReason;
  readonly packageRelativePath: string;
  readonly sourceAssetId: string;
}

export interface WorkspaceBinaryCandidateCollection {
  readonly candidates: readonly WorkspaceBinaryAssetCandidate[];
  readonly excluded: readonly WorkspaceExcludedBinaryReference[];
}

export type WorkspaceBinaryWriteReason =
  | "existing-missing"
  | "existing-asset-id-mismatch"
  | "existing-byte-length-mismatch"
  | "existing-digest-mismatch"
  | "existing-media-type-mismatch"
  | "existing-verification-mismatch";

export type WorkspaceBinaryErrorReason =
  | "existing-verification-unsupported"
  | "session-bytes-missing"
  | "session-bytes-mismatch"
  | "session-verification-unsupported";

export type WorkspaceBinarySaveDecision =
  | {
      readonly action: "skip";
      readonly candidate: WorkspaceBinaryAssetCandidate;
      readonly existingVerificationReport: PackageBinaryAssetVerificationReport;
    }
  | {
      readonly action: "write";
      readonly reason: WorkspaceBinaryWriteReason;
      readonly candidate: WorkspaceBinaryAssetCandidate;
      readonly binaryEntry: PackageBinaryFileEntry;
      readonly existingVerificationReport: PackageBinaryAssetVerificationReport;
      readonly sessionVerificationReport: PackageBinaryAssetVerificationReport;
    }
  | {
      readonly action: "error";
      readonly reason: WorkspaceBinaryErrorReason;
      readonly candidate: WorkspaceBinaryAssetCandidate;
      readonly existingVerificationReport?: PackageBinaryAssetVerificationReport;
      readonly sessionVerificationReport?: PackageBinaryAssetVerificationReport;
      readonly message: string;
    };

export interface CreateWorkspaceSavePlanInput {
  readonly packageDocument: PackageDocumentDto;
  readonly workspaceMetadata?: WorkspaceMetadataDto;
  /**
   * Bytes already in the workspace (typically just read from disk). They are only read for
   * verification and are not copied, so callers must not modify these bytes while
   * createWorkspaceSavePlan is running.
   */
  readonly existingWorkspaceBinaryFileEntries?: readonly PackageBinaryFileEntry[];
  /**
   * Current session bytes. All of them are copied once when the plan starts, so the whole plan is
   * decided against the session bytes as of that moment, and write decisions hand out those copies.
   */
  readonly currentSessionBinaryFileEntries?: readonly PackageBinaryFileEntry[];
}

export interface WorkspaceSavePlan {
  readonly packageDocument: PackageDocumentDto;
  readonly packageTextFileSet: PackageFileSet;
  readonly workspaceTextFileSet: PackageFileSet;
  readonly binaryCandidates: readonly WorkspaceBinaryAssetCandidate[];
  readonly excludedBinaryRefs: readonly WorkspaceExcludedBinaryReference[];
  readonly binaryDecisions: readonly WorkspaceBinarySaveDecision[];
}

export class WorkspaceSavePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceSavePlanError";
  }
}

export function collectWorkspaceBinaryAssetCandidates(
  packageDocument: PackageDocumentDto
): WorkspaceBinaryCandidateCollection {
  const document = PackageDocumentSchema.parse(packageDocument);
  const candidates: WorkspaceBinaryAssetCandidate[] = [];
  const excluded: WorkspaceExcludedBinaryReference[] = [];

  for (const sourceAsset of document.assets.sourceManifest.sourceAssets) {
    if (sourceAsset.binaryAssetRef === undefined) {
      continue;
    }

    excluded.push({
      binaryAssetRef: sourceAsset.binaryAssetRef,
      reason: sourceAsset.kind === "psd-source-v1"
        ? "psd-source-original-excluded-v1"
        : "source-original-excluded-v1",
      packageRelativePath: sourceAsset.binaryAssetRef.packageRelativePath,
      sourceAssetId: sourceAsset.sourceAssetId
    });
  }

  for (const texture of document.assets.textureAtlas?.textures ?? []) {
    if (texture.binaryAssetRef === undefined) {
      continue;
    }

    candidates.push({
      binaryAssetRef: texture.binaryAssetRef,
      role: "texture-raster-v1",
      source: "texture-atlas-texture-v1",
      packageRelativePath: texture.binaryAssetRef.packageRelativePath,
      textureId: texture.textureId,
      ...(texture.sourceAssetId === undefined ? {} : { sourceAssetId: texture.sourceAssetId }),
      ...(texture.sourceLayerId === undefined ? {} : { sourceLayerId: texture.sourceLayerId })
    });
  }

  assertUniqueWorkspaceBinaryCandidatePaths(candidates);

  return { candidates, excluded };
}

export async function createWorkspaceSavePlan(
  input: CreateWorkspaceSavePlanInput
): Promise<WorkspaceSavePlan> {
  const packageDocument = PackageDocumentSchema.parse(input.packageDocument);
  const packageTextFileSet = serializePackageDocumentToFileSet(packageDocument);
  const workspaceTextFileSet = serializeWorkspacePackageFileSet({
    packageDocument,
    ...(input.workspaceMetadata === undefined ? {} : { workspaceMetadata: input.workspaceMetadata })
  });
  const binaryCollection = collectWorkspaceBinaryAssetCandidates(packageDocument);
  // Each entry set is checked once (path safety, duplicates) and indexed by path; the per-candidate
  // decisions below look entries up instead of re-checking and copying the whole set every time.
  // Existing bytes are only read, so they are shared (see CreateWorkspaceSavePlanInput). Session
  // bytes are copied once here, so every decision sees the session bytes as of the plan's start.
  const existingFileIndex = indexPackageInMemoryFileSet([
    ...(input.existingWorkspaceBinaryFileEntries ?? [])
  ], "share");
  const sessionFileIndex = indexPackageInMemoryFileSet([
    ...(input.currentSessionBinaryFileEntries ?? [])
  ], "copy");
  const binaryDecisions: WorkspaceBinarySaveDecision[] = [];

  for (const candidate of binaryCollection.candidates) {
    binaryDecisions.push(await decideWorkspaceBinarySaveAction({
      candidate,
      existingFileIndex,
      sessionFileIndex
    }));
  }

  return {
    packageDocument,
    packageTextFileSet,
    workspaceTextFileSet,
    binaryCandidates: binaryCollection.candidates,
    excludedBinaryRefs: binaryCollection.excluded,
    binaryDecisions
  };
}

async function decideWorkspaceBinarySaveAction(input: {
  readonly candidate: WorkspaceBinaryAssetCandidate;
  readonly existingFileIndex: PackageInMemoryFileIndex;
  readonly sessionFileIndex: PackageInMemoryFileIndex;
}): Promise<WorkspaceBinarySaveDecision> {
  const expected = getBinaryAssetExpectedMetadata(input.candidate.binaryAssetRef);
  const existingVerificationReport = await verifyIndexedPackageBinaryAssetBytes(
    input.existingFileIndex,
    expected
  );

  if (existingVerificationReport.status === "pass") {
    return {
      action: "skip",
      candidate: input.candidate,
      existingVerificationReport
    };
  }

  if (existingVerificationReport.status === "unsupported") {
    return {
      action: "error",
      reason: "existing-verification-unsupported",
      candidate: input.candidate,
      existingVerificationReport,
      message: `Cannot verify existing workspace bytes for "${input.candidate.packageRelativePath}".`
    };
  }

  // The session index owns a private copy taken at the plan's start. That copy is verified and is
  // the very entry handed out for writing, so the written bytes are exactly the verified bytes.
  const binaryEntry = input.sessionFileIndex.binaryEntriesByPath.get(expected.packageRelativePath);
  const sessionVerificationReport = await verifyPackageBinaryFileEntryAgainstExpected(
    binaryEntry,
    expected
  );

  if (sessionVerificationReport.status !== "pass") {
    return {
      action: "error",
      reason: getSessionVerificationErrorReason(sessionVerificationReport),
      candidate: input.candidate,
      existingVerificationReport,
      sessionVerificationReport,
      message: `Current session bytes do not match binary reference "${input.candidate.packageRelativePath}".`
    };
  }

  if (binaryEntry === undefined) {
    return {
      action: "error",
      reason: "session-bytes-missing",
      candidate: input.candidate,
      existingVerificationReport,
      sessionVerificationReport,
      message: `Current session bytes are missing for "${input.candidate.packageRelativePath}".`
    };
  }

  return {
    action: "write",
    reason: getWorkspaceBinaryWriteReason(existingVerificationReport),
    candidate: input.candidate,
    binaryEntry,
    existingVerificationReport,
    sessionVerificationReport
  };
}

function assertUniqueWorkspaceBinaryCandidatePaths(
  candidates: readonly WorkspaceBinaryAssetCandidate[]
): void {
  try {
    assertUniquePackageFilePaths(candidates.map((candidate) => candidate.packageRelativePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new WorkspaceSavePlanError(message);
  }
}

function getWorkspaceBinaryWriteReason(
  report: PackageBinaryAssetVerificationReport
): WorkspaceBinaryWriteReason {
  const issueCodes = report.issues.map((issue) => issue.code);

  if (issueCodes.includes("binary.bytes.missing")) {
    return "existing-missing";
  }

  if (issueCodes.includes("binary.assetId.mismatch")) {
    return "existing-asset-id-mismatch";
  }

  if (issueCodes.includes("binary.byteLength.mismatch")) {
    return "existing-byte-length-mismatch";
  }

  if (issueCodes.includes("binary.digest.mismatch")) {
    return "existing-digest-mismatch";
  }

  if (issueCodes.includes("binary.mediaType.mismatch")) {
    return "existing-media-type-mismatch";
  }

  return "existing-verification-mismatch";
}

function getSessionVerificationErrorReason(
  report: PackageBinaryAssetVerificationReport
): WorkspaceBinaryErrorReason {
  if (report.status === "unsupported") {
    return "session-verification-unsupported";
  }

  if (report.issues.some((issue) => issue.code === "binary.bytes.missing")) {
    return "session-bytes-missing";
  }

  return "session-bytes-mismatch";
}
