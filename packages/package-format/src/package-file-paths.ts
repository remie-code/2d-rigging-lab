import type { PackageManifestDto, RequiredModelFilesDto } from "./package-manifest.js";

export const PACKAGE_MANIFEST_PATH = "manifest.json";
export const PACKAGE_PROVENANCE_PATH = "assets/provenance.json";
export const PACKAGE_RIGHTS_PATH = "assets/rights.json";
export const PACKAGE_TEXTURE_ATLAS_PATH = "assets/textures/texture-atlas.json";

type RequiredModelFileKey = Exclude<keyof RequiredModelFilesDto, "variants" | "editorState">;
type OptionalModelFileKey = Extract<keyof RequiredModelFilesDto, "variants" | "editorState">;

export const REQUIRED_MODEL_FILE_KEYS = [
  "graph",
  "drawables",
  "meshes",
  "parameters",
  "keyforms",
  "rigControls",
  "dynamics",
  "masks",
  "drawOrder"
] as const satisfies readonly RequiredModelFileKey[];

export const OPTIONAL_MODEL_FILE_KEYS = [
  "variants",
  "editorState"
] as const satisfies readonly OptionalModelFileKey[];

export class PackageFilePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageFilePathError";
  }
}

export function assertPackageRelativePath(path: string): string {
  const reason = getUnsafePackageRelativePathReason(path);

  if (reason !== undefined) {
    throw new PackageFilePathError(`Unsafe package file path "${path}": ${reason}`);
  }

  return path;
}

export function isPackageRelativePath(path: string): boolean {
  return getUnsafePackageRelativePathReason(path) === undefined;
}

export function getAuthoredPackageFilePaths(manifest: PackageManifestDto): readonly string[] {
  const modelPaths = REQUIRED_MODEL_FILE_KEYS.map((key) => manifest.modelFiles[key]);
  const optionalModelPaths: string[] = [];

  for (const key of OPTIONAL_MODEL_FILE_KEYS) {
    const path = manifest.modelFiles[key];
    if (path !== undefined) {
      optionalModelPaths.push(path);
    }
  }

  return [
    PACKAGE_MANIFEST_PATH,
    ...modelPaths,
    ...optionalModelPaths,
    manifest.assetIndex,
    PACKAGE_TEXTURE_ATLAS_PATH,
    PACKAGE_PROVENANCE_PATH,
    PACKAGE_RIGHTS_PATH
  ];
}

export function assertUniquePackageFilePaths(paths: readonly string[]): void {
  const seen = new Set<string>();

  for (const path of paths) {
    const validatedPath = assertPackageRelativePath(path);

    if (seen.has(validatedPath)) {
      throw new PackageFilePathError(`Duplicate package file path "${validatedPath}"`);
    }

    seen.add(validatedPath);
  }
}

function getUnsafePackageRelativePathReason(path: string): string | undefined {
  if (path.length === 0) {
    return "path must not be empty";
  }

  if (path.includes("\\")) {
    return "backslash separators are not allowed";
  }

  if (path.startsWith("/") || path.startsWith("//") || /^[A-Za-z]:/.test(path)) {
    return "absolute paths are not allowed";
  }

  const segments = path.split("/");

  if (segments.some((segment) => segment.length === 0)) {
    return "empty path segments are not allowed";
  }

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return "path traversal segments are not allowed";
  }

  return undefined;
}
