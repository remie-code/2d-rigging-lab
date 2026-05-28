import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";

import { createAuthoringGraphFromPackageDocument } from "./authoring-graph.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import { createInitialAuthoringRevision, toAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";

export interface CreateAuthoringSessionOptions {
  readonly authoringRevision?: number | AuthoringRevision;
  readonly dirty?: boolean;
}

export const createAuthoringSessionFromPackageDocument = (
  packageDocument: PackageDocumentDto,
  options: CreateAuthoringSessionOptions = {}
): AuthoringSession => ({
  packageIdentity: {
    packageId: packageDocument.manifest.packageId,
    packageDisplayName: packageDocument.manifest.packageDisplayName,
    formatVersion: packageDocument.manifest.formatVersion
  },
  packageRevision: packageDocument.manifest.packageRevision,
  authoringRevision:
    options.authoringRevision === undefined
      ? createInitialAuthoringRevision()
      : toAuthoringRevision(options.authoringRevision),
  dirty: options.dirty ?? false,
  graph: createAuthoringGraphFromPackageDocument(packageDocument)
});
