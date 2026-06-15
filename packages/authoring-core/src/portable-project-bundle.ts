import {
  createPackageInMemoryFileSet,
  exportPortablePackageBundleV0,
  importPortablePackageBundleV0,
  PackageDocumentSchema,
  type BinaryAssetReferenceDto,
  type BinaryAssetRoleDto,
  type PackageBinaryFileEntry,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { PartId } from "@private-2d-rigging-lab/contracts";

import type { AuthoringSession } from "./authoring-session.js";
import {
  getAuthoringSessionBinaryFileEntries,
  registerAuthoringSessionBinaryBytes
} from "./binary-byte-registration.js";
import { createAuthoringSessionFromPackageDocument } from "./from-package-document.js";
import { readPackageEditorHiddenPartIds } from "./package-document-editor-state.js";
import { toPackageDocumentFromAuthoringSession } from "./package-document-from-authoring-session.js";

export interface ExportAuthoringSessionPortableBundleInput {
  readonly session: AuthoringSession;
  readonly baseDocument?: unknown;
  readonly editorHiddenPartIds?: Iterable<PartId>;
  readonly updatedAt?: Date | string;
}

export interface ExportAuthoringSessionPortableBundleResult {
  readonly bundleJson: string;
  readonly packageDocument: unknown;
  readonly packageId: string;
  readonly packageDisplayName: string;
  readonly packageRevision: number;
  readonly binaryPayloadCount: number;
}

export interface ImportAuthoringSessionPortableBundleInput {
  readonly bundle: unknown;
}

export interface ImportAuthoringSessionPortableBundleResult {
  readonly session: AuthoringSession;
  readonly packageDocument: unknown;
  readonly packageId: string;
  readonly packageDisplayName: string;
  readonly packageRevision: number;
  readonly binaryPayloadCount: number;
  readonly binaryFileCount: number;
  readonly editorHiddenPartIds: readonly PartId[];
}

interface BinaryRegistrationTarget {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly role: BinaryAssetRoleDto;
  readonly sourceAssetId?: string;
  readonly textureId?: string;
}

export const exportAuthoringSessionPortableBundle = async (
  input: ExportAuthoringSessionPortableBundleInput
): Promise<ExportAuthoringSessionPortableBundleResult> => {
  const packageDocument = toPackageDocumentFromAuthoringSession(input.session, {
    ...(input.baseDocument === undefined ? {} : { baseDocument: input.baseDocument }),
    ...(input.editorHiddenPartIds === undefined
      ? {}
      : { editorHiddenPartIds: input.editorHiddenPartIds }),
    ...(input.updatedAt === undefined ? {} : { updatedAt: input.updatedAt })
  });
  const bundle = await exportPortablePackageBundleV0({
    packageDocument,
    fileSet: createPackageInMemoryFileSet([
      ...getAuthoringSessionBinaryFileEntries(input.session)
    ])
  });

  return {
    bundleJson: JSON.stringify(bundle, null, 2),
    packageDocument,
    packageId: bundle.packageId,
    packageDisplayName: packageDocument.manifest.packageDisplayName,
    packageRevision: bundle.packageRevision,
    binaryPayloadCount: bundle.binaryPayloads.length
  };
};

export const importAuthoringSessionPortableBundle = async (
  input: ImportAuthoringSessionPortableBundleInput
): Promise<ImportAuthoringSessionPortableBundleResult> => {
  const imported = await importPortablePackageBundleV0({ bundle: input.bundle });
  const packageDocument = PackageDocumentSchema.parse(imported.packageDocument);
  const session = createAuthoringSessionFromPackageDocument(packageDocument, {
    dirty: false
  });
  const editorHiddenPartIds = readPackageEditorHiddenPartIds(session, packageDocument);

  hydrateAuthoringSessionBinaryAssets({
    session,
    packageDocument,
    binaryEntries: imported.binaryEntries
  });

  return {
    session,
    packageDocument,
    packageId: packageDocument.manifest.packageId,
    packageDisplayName: packageDocument.manifest.packageDisplayName,
    packageRevision: packageDocument.manifest.packageRevision,
    binaryPayloadCount: imported.bundle.binaryPayloads.length,
    binaryFileCount: imported.binaryEntries.length,
    editorHiddenPartIds
  };
};

const hydrateAuthoringSessionBinaryAssets = (input: {
  readonly session: AuthoringSession;
  readonly packageDocument: PackageDocumentDto;
  readonly binaryEntries: readonly PackageBinaryFileEntry[];
}): void => {
  const entriesByPath = new Map(input.binaryEntries.map((entry) => [entry.path, entry]));

  for (const target of collectBinaryRegistrationTargets(input.packageDocument)) {
    const entry = entriesByPath.get(target.binaryAssetRef.packageRelativePath);
    if (entry === undefined) {
      continue;
    }

    registerAuthoringSessionBinaryBytes(input.session, {
      binaryAssetRef: target.binaryAssetRef,
      bytes: entry.bytes,
      role: target.role,
      ...(target.sourceAssetId === undefined ? {} : { sourceAssetId: target.sourceAssetId }),
      ...(target.textureId === undefined ? {} : { textureId: target.textureId })
    });
  }
};

const collectBinaryRegistrationTargets = (
  packageDocument: PackageDocumentDto
): readonly BinaryRegistrationTarget[] => {
  const targets: BinaryRegistrationTarget[] = [];

  for (const sourceAsset of packageDocument.assets.sourceManifest.sourceAssets) {
    if (sourceAsset.binaryAssetRef === undefined) {
      continue;
    }

    targets.push({
      binaryAssetRef: sourceAsset.binaryAssetRef,
      role: "source-original-v1",
      sourceAssetId: sourceAsset.sourceAssetId
    });
  }

  for (const texture of packageDocument.assets.textureAtlas?.textures ?? []) {
    if (texture.binaryAssetRef === undefined) {
      continue;
    }

    targets.push({
      binaryAssetRef: texture.binaryAssetRef,
      role: "texture-raster-v1",
      ...(texture.sourceAssetId === undefined ? {} : { sourceAssetId: texture.sourceAssetId }),
      textureId: texture.textureId
    });
  }

  return targets;
};
