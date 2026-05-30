import type { PackageAssetFilesDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";

export const buildPackageDocumentAssets = (
  session: AuthoringSession,
  baseAssetFiles: PackageAssetFilesDto
): PackageAssetFilesDto => {
  const textureAtlas = session.graph.textureAtlas ?? baseAssetFiles.textureAtlas;

  return {
    sourceManifest: {
      ...cloneDto(baseAssetFiles.sourceManifest),
      sourceAssets: cloneDto(session.graph.sourceAssets)
    },
    ...(textureAtlas === undefined
      ? {}
      : { textureAtlas: cloneDto(textureAtlas) }),
    provenance: {
      ...cloneDto(baseAssetFiles.provenance),
      records: cloneDto(session.graph.provenanceRecords)
    },
    rights: {
      ...cloneDto(baseAssetFiles.rights),
      records: cloneDto(session.graph.rightsRecords)
    }
  };
};

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);
