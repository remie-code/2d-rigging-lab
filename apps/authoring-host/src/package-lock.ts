import { open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { HostError } from "./host-error.js";
import { assertNoLinkedPath } from "./package-path-guard.js";

/** Path of the lock file next to the package directory (`<package>.authoring.lock`). */
export const packageLockPath = (packageDirectory: string): string => `${resolve(packageDirectory)}.authoring.lock`;

/**
 * Runs `action` while holding the one lock per canonical package path, independent of the caller's state directory.
 * A held lock rejects with HostError `package-busy`. No stale-lock stealing.
 */
export const withPackageLock = async <T>(packageDirectory: string, action: () => Promise<T>): Promise<T> => {
  await assertNoLinkedPath(packageDirectory);
  const path = packageLockPath(packageDirectory);
  let handle;
  try {
    handle = await open(path, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new HostError("package-busy", "Another authoring command owns this package; retry later.");
    throw error;
  }
  try {
    return await action();
  } finally {
    // Releasing a lock is post-command cleanup; it cannot turn a saved package into a failed response.
    await handle.close().catch(() => undefined);
    await unlink(path).catch(() => undefined);
  }
};
