import { z } from "zod";

import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";

import { PackageDocumentSchema, type PackageDocumentDto } from "./package-document.js";
import { PACKAGE_MANIFEST_PATH } from "./package-file-paths.js";

export const WORKSPACE_METADATA_PATH = "workspace.json";

export const WorkspaceMetadataSchema = z.object({
  schemaVersion: z.literal("ai-native-live2d-workspace-v1"),
  workspaceKind: z.literal("directory-workspace-v1"),
  packageEntrypoint: z.literal(PACKAGE_MANIFEST_PATH),
  packageId: PackageIdSchema.optional(),
  packageDisplayName: z.string().min(1).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
}).strict();
export type WorkspaceMetadataDto = z.infer<typeof WorkspaceMetadataSchema>;

export interface CreateWorkspaceMetadataForPackageDocumentOptions {
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}

export function createWorkspaceMetadataForPackageDocument(
  document: PackageDocumentDto,
  options: CreateWorkspaceMetadataForPackageDocumentOptions = {}
): WorkspaceMetadataDto {
  const parsedDocument = PackageDocumentSchema.parse(document);

  return WorkspaceMetadataSchema.parse({
    schemaVersion: "ai-native-live2d-workspace-v1",
    workspaceKind: "directory-workspace-v1",
    packageEntrypoint: PACKAGE_MANIFEST_PATH,
    packageId: parsedDocument.manifest.packageId,
    packageDisplayName: parsedDocument.manifest.packageDisplayName,
    createdAt: toIsoString(options.createdAt ?? parsedDocument.manifest.createdAt),
    updatedAt: toIsoString(options.updatedAt ?? parsedDocument.manifest.updatedAt)
  });
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
