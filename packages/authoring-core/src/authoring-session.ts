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

export const createDryRunAuthoringSession = cloneAuthoringSession;
