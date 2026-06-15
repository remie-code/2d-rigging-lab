import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import { buildPackageDocumentAssets } from "./package-document-assets.js";
import {
  buildPackageDocumentManifest,
  type PackageDocumentManifestOptions
} from "./package-document-manifest.js";
import { buildPackageDocumentModelFiles } from "./package-document-model-files.js";
import type { AuthoringSession } from "./authoring-session.js";

export interface ToPackageDocumentOptions extends PackageDocumentManifestOptions {}

export const toPackageDocument = (
  session: AuthoringSession,
  baseDocument: PackageDocumentDto,
  options: ToPackageDocumentOptions = {}
): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: buildPackageDocumentManifest(session, baseDocument, options),
    model: buildPackageDocumentModelFiles(session, baseDocument.model, options),
    assets: buildPackageDocumentAssets(session, baseDocument.assets)
  });
