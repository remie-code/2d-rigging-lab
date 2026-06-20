import type {
  BinaryAssetReferenceDto,
  BinaryAssetRoleDto,
  PackageBinaryBytes,
  PackageDocumentDto,
  PackageTextFileEntry,
  WorkspaceFileSetWarning,
  WorkspaceMetadataDto
} from "@private-2d-rigging-lab/package-format";
import { parseWorkspacePackageDocumentFromFileSet } from "@private-2d-rigging-lab/package-format";
import type { PartId, SourceAssetId, TextureId } from "@private-2d-rigging-lab/contracts";

import type { AuthoringSession } from "./authoring-session.js";
import {
  registerAuthoringSessionBinaryBytes,
  type RegisterAuthoringSessionBinaryBytesInput
} from "./binary-byte-registration.js";
import { createAuthoringSessionFromPackageDocument } from "./from-package-document.js";
import { readPackageEditorHiddenPartIds } from "./package-document-editor-state.js";

export interface AuthoringWorkspaceTextFileEntry {
  readonly path: string;
  readonly text: string;
}

export interface AuthoringWorkspaceBinaryFileEntry {
  readonly path: string;
  readonly bytes: PackageBinaryBytes;
}

export interface AuthoringWorkspaceBinaryRegistrationTarget {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly role: BinaryAssetRoleDto;
  readonly requiredForWorkspaceOpen: boolean;
  readonly sourceAssetId?: SourceAssetId | string;
  readonly textureId?: TextureId | string;
}

export interface OpenAuthoringWorkspaceFromTextFileSetInput {
  readonly fileSet: readonly AuthoringWorkspaceTextFileEntry[];
  readonly dirty?: boolean;
}

export interface OpenAuthoringWorkspaceFromTextFileSetResult {
  readonly workspaceMetadata: WorkspaceMetadataDto;
  readonly packageDocument: PackageDocumentDto;
  readonly session: AuthoringSession;
  readonly editorHiddenPartIds: readonly PartId[];
  readonly binaryRegistrationTargets: readonly AuthoringWorkspaceBinaryRegistrationTarget[];
  readonly warnings: readonly WorkspaceFileSetWarning[];
}

export function openAuthoringWorkspaceFromTextFileSet(
  input: OpenAuthoringWorkspaceFromTextFileSetInput
): OpenAuthoringWorkspaceFromTextFileSetResult {
  const parsed = parseWorkspacePackageDocumentFromFileSet(
    input.fileSet.map(toPackageTextFileEntry)
  );
  const session = createAuthoringSessionFromPackageDocument(parsed.packageDocument, {
    dirty: input.dirty ?? false
  });

  return {
    workspaceMetadata: parsed.workspaceMetadata,
    packageDocument: parsed.packageDocument,
    session,
    editorHiddenPartIds: readPackageEditorHiddenPartIds(session, parsed.packageDocument),
    binaryRegistrationTargets: collectAuthoringWorkspaceBinaryRegistrationTargets(
      parsed.packageDocument
    ),
    warnings: parsed.warnings
  };
}

export function hydrateAuthoringWorkspaceSessionBinaryAssets(input: {
  readonly session: AuthoringSession;
  readonly binaryRegistrationTargets: readonly AuthoringWorkspaceBinaryRegistrationTarget[];
  readonly binaryEntries: readonly AuthoringWorkspaceBinaryFileEntry[];
}): void {
  const entriesByPath = new Map(input.binaryEntries.map((entry) => [entry.path, entry]));

  for (const target of input.binaryRegistrationTargets) {
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
    } satisfies RegisterAuthoringSessionBinaryBytesInput);
  }
}

function collectAuthoringWorkspaceBinaryRegistrationTargets(
  packageDocument: PackageDocumentDto
): readonly AuthoringWorkspaceBinaryRegistrationTarget[] {
  const targets: AuthoringWorkspaceBinaryRegistrationTarget[] = [];

  for (const sourceAsset of packageDocument.assets.sourceManifest.sourceAssets) {
    if (sourceAsset.binaryAssetRef === undefined) {
      continue;
    }

    targets.push({
      binaryAssetRef: sourceAsset.binaryAssetRef,
      role: "source-original-v1",
      requiredForWorkspaceOpen: false,
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
      requiredForWorkspaceOpen: true,
      ...(texture.sourceAssetId === undefined ? {} : { sourceAssetId: texture.sourceAssetId }),
      textureId: texture.textureId
    });
  }

  return targets;
}

function toPackageTextFileEntry(entry: AuthoringWorkspaceTextFileEntry): PackageTextFileEntry {
  return {
    path: entry.path,
    text: entry.text
  };
}
