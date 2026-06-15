import type { PackageDocumentDto, PackageManifestDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import {
  PACKAGE_EDITOR_STATE_MODEL_FILE_PATH,
  PACKAGE_EDITOR_STATE_SCHEMA_VERSION,
  shouldIncludePackageEditorState,
  type PackageDocumentEditorStateOptions
} from "./package-document-editor-state.js";

export interface PackageDocumentManifestOptions extends PackageDocumentEditorStateOptions {
  readonly updatedAt?: Date | string;
}

export const buildPackageDocumentManifest = (
  session: AuthoringSession,
  baseDocument: PackageDocumentDto,
  options: PackageDocumentManifestOptions = {}
): PackageManifestDto => {
  const includeEditorState = shouldIncludePackageEditorState(baseDocument, options);
  const baseManifest = cloneDto(baseDocument.manifest);
  const schemaVersions = { ...baseManifest.schemaVersions };
  const modelFiles = { ...baseManifest.modelFiles };

  if (!includeEditorState) {
    delete schemaVersions.editorState;
    delete modelFiles.editorState;
  }

  return {
    ...baseManifest,
    packageRevision: session.packageRevision,
    updatedAt: toUpdatedAtIsoString(options.updatedAt),
    schemaVersions: {
      ...schemaVersions,
      ...(includeEditorState ? { editorState: PACKAGE_EDITOR_STATE_SCHEMA_VERSION } : {})
    },
    modelFiles: {
      ...modelFiles,
      ...(includeEditorState ? { editorState: PACKAGE_EDITOR_STATE_MODEL_FILE_PATH } : {})
    }
  };
};

const toUpdatedAtIsoString = (updatedAt: Date | string | undefined): string => {
  if (updatedAt instanceof Date) {
    return updatedAt.toISOString();
  }

  return updatedAt ?? new Date().toISOString();
};

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);
