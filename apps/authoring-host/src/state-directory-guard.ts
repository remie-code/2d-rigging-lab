import { relative, resolve, sep } from "node:path";

/**
 * Determines whether `stateDirectory` resolves to the same location as, or a descendant
 * of, `packageDirectory`. Used to reject writing approval/transcript state inside the
 * package directory, which would corrupt the package's own file set (the loader reads
 * every `.json` under the package root) and break the "state lives outside the package"
 * invariant the headless host relies on.
 *
 * The comparison is deterministic and filesystem-free: both inputs are resolved to
 * absolute, normalized paths and compared by their relative path. On case-insensitive
 * platforms (Windows), the comparison is case-insensitive so `C:\Pkg` and `c:\pkg\state`
 * are still recognized as nested.
 */
export const isStateDirectoryInsidePackageDirectory = (
  packageDirectory: string,
  stateDirectory: string
): boolean => {
  const normalizedPackage = normalizeForComparison(resolve(packageDirectory));
  const normalizedState = normalizeForComparison(resolve(stateDirectory));

  if (normalizedState === normalizedPackage) {
    return true;
  }

  const relativePath = relative(normalizedPackage, normalizedState);
  // A descendant has a relative path that does not escape upward (no "..") and is not
  // absolute (which would indicate a different drive/root on Windows).
  return (
    relativePath.length > 0 &&
    !relativePath.startsWith(`..${sep}`) &&
    relativePath !== ".." &&
    !isAbsoluteLike(relativePath)
  );
};

const normalizeForComparison = (absolutePath: string): string =>
  process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath;

const isAbsoluteLike = (candidate: string): boolean =>
  candidate.startsWith(sep) || /^[A-Za-z]:[\\/]/.test(candidate);
