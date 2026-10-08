import type { PartId } from "@private-2d-rigging-lab/contracts";
import {
  createWorkspaceSavePlan,
  type PackageBinaryFileEntry,
  type PackageDocumentDto,
  type WorkspaceMetadataDto,
  type WorkspaceSavePlan
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import { getAuthoringSessionBinaryFileEntries } from "./binary-byte-registration.js";
import { toPackageDocumentFromAuthoringSession } from "./package-document-from-authoring-session.js";

export interface CreateAuthoringWorkspaceSavePlanInput {
  readonly session: AuthoringSession;
  readonly baseDocument?: unknown;
  readonly editorHiddenPartIds?: Iterable<PartId>;
  readonly updatedAt?: Date | string;
  readonly workspaceMetadata?: WorkspaceMetadataDto;
  readonly existingWorkspaceBinaryFileEntries?: readonly PackageBinaryFileEntry[];
}

export interface CreateAuthoringWorkspaceSavePlanResult {
  readonly packageDocument: PackageDocumentDto;
  readonly savePlan: WorkspaceSavePlan;
}

export async function createAuthoringWorkspaceSavePlan(
  input: CreateAuthoringWorkspaceSavePlanInput
): Promise<CreateAuthoringWorkspaceSavePlanResult> {
  const packageDocument = toPackageDocumentFromAuthoringSession(input.session, {
    ...(input.baseDocument === undefined ? {} : { baseDocument: input.baseDocument }),
    ...(input.editorHiddenPartIds === undefined
      ? {}
      : { editorHiddenPartIds: input.editorHiddenPartIds }),
    ...(input.updatedAt === undefined ? {} : { updatedAt: input.updatedAt })
  });
  const savePlan = await createWorkspaceSavePlan({
    packageDocument,
    currentSessionBinaryFileEntries: getAuthoringSessionBinaryFileEntries(input.session),
    ...(input.workspaceMetadata === undefined ? {} : { workspaceMetadata: input.workspaceMetadata }),
    ...(input.existingWorkspaceBinaryFileEntries === undefined
      ? {}
      : { existingWorkspaceBinaryFileEntries: input.existingWorkspaceBinaryFileEntries })
  });

  return {
    packageDocument,
    savePlan
  };
}
