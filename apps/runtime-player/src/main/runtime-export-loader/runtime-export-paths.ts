import path from "node:path";

import { isPackageRelativePath } from "@private-2d-rigging-lab/package-format";

import { RuntimeExportLoaderError } from "./runtime-export-errors";

export function resolveRuntimeExportArtifactPath(
  runtimeExportDirectoryPath: string,
  artifactPath: string
): string {
  if (!isPackageRelativePath(artifactPath)) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.pathTraversal",
      `Runtime Export artifact path "${artifactPath}" is outside the selected directory.`,
      artifactPath
    );
  }

  const rootPath = path.resolve(runtimeExportDirectoryPath);
  const resolvedPath = path.resolve(rootPath, ...artifactPath.split("/"));
  const relativePath = path.relative(rootPath, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new RuntimeExportLoaderError(
      "runtimeExport.pathTraversal",
      `Runtime Export artifact path "${artifactPath}" resolves outside the selected directory.`,
      artifactPath
    );
  }

  return resolvedPath;
}
