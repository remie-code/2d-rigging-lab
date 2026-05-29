import type { PackageDocumentDto, PackageManifestDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";

export interface PackageDocumentManifestOptions {
  readonly updatedAt?: Date | string;
}

export const buildPackageDocumentManifest = (
  session: AuthoringSession,
  baseDocument: PackageDocumentDto,
  options: PackageDocumentManifestOptions = {}
): PackageManifestDto => ({
  ...cloneDto(baseDocument.manifest),
  packageRevision: session.packageRevision,
  updatedAt: toUpdatedAtIsoString(options.updatedAt)
});

const toUpdatedAtIsoString = (updatedAt: Date | string | undefined): string => {
  if (updatedAt instanceof Date) {
    return updatedAt.toISOString();
  }

  return updatedAt ?? new Date().toISOString();
};

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);
