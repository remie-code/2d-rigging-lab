import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { HostError } from "./host-error.js";

/** Rejects a path when it or any ancestor is a symbolic link or resolves to a different (aliased) path. */
export const assertNoLinkedPath = async (path: string): Promise<void> => {
  const full = resolve(path);
  for (let current = full; ; current = dirname(current)) {
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new HostError("package-link", `Linked path is forbidden: ${current}`);
      if (resolve(await realpath(current)).toLowerCase() !== current.toLowerCase()) throw new HostError("package-alias", `Aliased path is forbidden: ${current}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (dirname(current) === current) break;
  }
};

/** Host-written artifacts (renders, sidecars) must never land inside the package directory. */
export const assertOutsidePackage = async (packageDirectory: string, destination: string): Promise<void> => {
  await assertNoLinkedPath(packageDirectory);
  await assertNoLinkedPath(destination);
  const rel = relative(resolve(packageDirectory), resolve(destination));
  if (rel === "" || (!rel.startsWith("..\\") && !rel.startsWith("../") && rel !== ".." && !isAbsolute(rel))) {
    throw new HostError("artifacts-inside-package", "Artifacts must be written outside the package directory.");
  }
};
