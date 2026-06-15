import { PartIdSchema, type PartId } from "@private-2d-rigging-lab/contracts";
import {
  EditorStateFileSchema,
  type EditorStateFileDto,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";

export const PACKAGE_EDITOR_STATE_MODEL_FILE_PATH = "model/editor-state.json";
export const PACKAGE_EDITOR_STATE_SCHEMA_VERSION = "editor-state-v1";

export interface PackageDocumentEditorStateOptions {
  readonly editorHiddenPartIds?: Iterable<PartId>;
}

export const shouldIncludePackageEditorState = (
  baseDocument: PackageDocumentDto,
  options: PackageDocumentEditorStateOptions = {}
): boolean =>
  options.editorHiddenPartIds !== undefined ||
  baseDocument.model.editorState !== undefined;

export const createPackageEditorStateFile = (
  session: AuthoringSession,
  options: PackageDocumentEditorStateOptions = {}
): EditorStateFileDto | undefined => {
  if (options.editorHiddenPartIds === undefined) {
    return undefined;
  }

  return EditorStateFileSchema.parse({
    schemaVersion: PACKAGE_EDITOR_STATE_SCHEMA_VERSION,
    selection: [],
    lockedIds: [],
    editorHiddenIds: normalizeEditorHiddenPartIds(
      session,
      Array.from(options.editorHiddenPartIds)
    )
  });
};

export const readPackageEditorHiddenPartIds = (
  session: AuthoringSession,
  packageDocument: PackageDocumentDto
): readonly PartId[] =>
  normalizeEditorHiddenPartIds(
    session,
    packageDocument.model.editorState?.editorHiddenIds ?? []
  );

const normalizeEditorHiddenPartIds = (
  session: AuthoringSession,
  rawIds: readonly unknown[]
): readonly PartId[] => {
  const requestedPartIds = new Set<PartId>();
  const currentPartIds = new Set(session.graph.parts.map((part) => part.partId));

  for (const rawId of rawIds) {
    const parsed = PartIdSchema.safeParse(rawId);
    if (parsed.success && currentPartIds.has(parsed.data)) {
      requestedPartIds.add(parsed.data);
    }
  }

  return session.graph.parts
    .map((part) => part.partId)
    .filter((partId) => requestedPartIds.has(partId));
};
