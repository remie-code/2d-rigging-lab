import type { PackageId } from "@private-2d-rigging-lab/contracts";
import type {
  BinaryAssetIndexFileDto,
  PackageBinaryByteIntakeSummaryDto,
  PackageBinaryFileEntry,
  PackageManifestDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";
import type { AuthoringRevision } from "./authoring-revision.js";

export interface AuthoringPackageIdentity {
  packageId: PackageId;
  packageDisplayName: string;
  formatVersion: PackageManifestDto["formatVersion"];
}

export interface AuthoringSessionBinaryAssets {
  readonly fileEntries: PackageBinaryFileEntry[];
  readonly binaryAssetIndex: BinaryAssetIndexFileDto;
  readonly byteIntakeSummaries: PackageBinaryByteIntakeSummaryDto[];
}

export interface AuthoringSession {
  packageIdentity: AuthoringPackageIdentity;
  packageRevision: number;
  authoringRevision: AuthoringRevision;
  dirty: boolean;
  graph: AuthoringGraph;
  binaryAssets?: AuthoringSessionBinaryAssets;
}

export const cloneAuthoringSession = (session: AuthoringSession): AuthoringSession =>
  structuredClone(session);

export const cloneAuthoringSessionSharingBinaryAssets = (
  session: AuthoringSession
): AuthoringSession => {
  const nextSession: AuthoringSession = structuredClone({
    packageIdentity: session.packageIdentity,
    packageRevision: session.packageRevision,
    authoringRevision: session.authoringRevision,
    dirty: session.dirty,
    graph: session.graph
  });

  if (session.binaryAssets !== undefined) {
    nextSession.binaryAssets = {
      fileEntries: session.binaryAssets.fileEntries.map(cloneBinaryFileEntrySharingBytes),
      binaryAssetIndex: structuredClone(session.binaryAssets.binaryAssetIndex),
      byteIntakeSummaries: structuredClone(session.binaryAssets.byteIntakeSummaries)
    };
  }

  return nextSession;
};

export const cloneAuthoringSessionForGraphEdit = cloneAuthoringSessionSharingBinaryAssets;

export const createDryRunAuthoringSession = cloneAuthoringSession;

const cloneBinaryFileEntrySharingBytes = (
  entry: PackageBinaryFileEntry
): PackageBinaryFileEntry => {
  // Package-local binary bytes are immutable within a loaded session, so graph/history clones
  // copy file metadata but keep the large byte payload identity shared.
  const metadata = structuredClone({
    path: entry.path,
    mediaType: entry.mediaType,
    ...(entry.binaryAssetId === undefined ? {} : { binaryAssetId: entry.binaryAssetId })
  });

  return {
    ...metadata,
    bytes: entry.bytes
  };
};
