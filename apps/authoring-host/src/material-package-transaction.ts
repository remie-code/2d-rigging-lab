import { randomUUID } from "node:crypto";
import { mkdir, open, unlink, writeFile, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createAuthoringWorkspaceSavePlan, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { serializeOperationLogEntriesToJsonl } from "@private-2d-rigging-lab/operation-core";
import type { MaterialPackageVersion } from "@private-2d-rigging-lab/contracts";
import { assertMaterialNoLinks, fingerprintMaterialPackage, normalizeMaterialPackagePath, readMaterialPackageFiles, type MaterialPackageFile } from "./material-package-fingerprint.js";
import { loadAuthoringPackageDirectory, type LoadedAuthoringPackage } from "./package-directory-io.js";
import { MaterialHostError } from "./material-host-error.js";

/** One lock per canonical package path, independent of the caller's state directory. No stale-lock stealing. */
export const withMaterialPackageLock = async <T>(directory: string, action: () => Promise<T>): Promise<T> => {
  await assertMaterialNoLinks(directory);
  const path = `${resolve(directory)}.authoring.lock`;
  let handle;
  try { handle = await open(path, "wx"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new MaterialHostError("package-busy", "Another authoring command owns this package; retry later."); throw error; }
  try { return await action(); }
  finally {
    // Releasing a lock is post-commit cleanup; it cannot turn an applied package into a failed response.
    await handle.close().catch(() => undefined);
    await unlink(path).catch(() => undefined);
  }
};
export const writeMaterialFiles = async (directory: string, files: readonly MaterialPackageFile[]): Promise<void> => {
  await assertMaterialNoLinks(directory);
  await mkdir(directory, { recursive: true });
  for (const file of files) {
    const path = join(directory, normalizeMaterialPackagePath(file.path));
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, file.bytes, { flag: "wx" });
  }
};
export const materialVersion = (loaded: LoadedAuthoringPackage, fingerprint: string): MaterialPackageVersion => ({
  packageId: loaded.session.packageIdentity.packageId, packageRevision: loaded.session.packageRevision,
  contentFingerprint: fingerprint, fingerprintVersion: "material-package-content-v1"
});
/** Load only the immutable captured bytes; the render/session and hash cannot observe different disk reads. */
export const captureMaterialPackage = async (directory: string, snapshots: string) => {
  const files = await readMaterialPackageFiles(directory), fingerprint = await fingerprintMaterialPackage({ files });
  const path = join(snapshots, `snapshot_${randomUUID()}`);
  await writeMaterialFiles(path, files);
  const loaded = await loadAuthoringPackageDirectory(path);
  if (await fingerprintMaterialPackage({ directory }) !== fingerprint) throw new MaterialHostError("package-changed", "Base changed while its snapshot was captured.");
  return { files, directory: path, loaded, version: materialVersion(loaded, fingerprint) };
};
export const serializeMaterialWorking = async (loaded: LoadedAuthoringPackage, session: AuthoringSession, originalFiles: readonly MaterialPackageFile[], now: string, logText?: string) => {
  const { packageDocument, savePlan } = await createAuthoringWorkspaceSavePlan({ session, baseDocument: loaded.packageDocument, workspaceMetadata: loaded.workspaceMetadata, updatedAt: now });
  const files = new Map(originalFiles.map(file => [file.path, file]));
  for (const entry of savePlan.workspaceTextFileSet) files.set(entry.path, { path: entry.path, bytes: Buffer.from(entry.text) });
  const logPath = packageDocument.manifest.operationLog;
  files.set(logPath, { path: logPath, bytes: Buffer.from(logText ?? serializeOperationLogEntriesToJsonl(loaded.operationLogEntries)) });
  for (const decision of savePlan.binaryDecisions) {
    if (decision.action === "error") throw new MaterialHostError("working-save-failed", decision.message);
    if (decision.action === "write") files.set(decision.binaryEntry.path, decision.binaryEntry);
  }
  const result = [...files.values()];
  return { files: result, version: { packageId: session.packageIdentity.packageId, packageRevision: session.packageRevision,
    contentFingerprint: await fingerprintMaterialPackage({ files: result }), fingerprintVersion: "material-package-content-v1" as const } };
};
/** Backup remains until metadata commit succeeds. This is rollback on ordinary errors, not crash durability. */
export const replaceMaterialBase = async <T>(input: { directory: string; expectedFingerprint: string; files: readonly MaterialPackageFile[]; commit: () => Promise<T>; beforeSwap?: () => Promise<void> }): Promise<T> => {
  const stage = `${resolve(input.directory)}.material-stage-${randomUUID()}`, backup = `${resolve(input.directory)}.material-backup-${randomUUID()}`;
  await writeMaterialFiles(stage, input.files);
  // Validate a normal editable package before moving any base bytes.
  await loadAuthoringPackageDirectory(stage);
  let moved = false, installed = false, committed = false;
  try {
    if (await fingerprintMaterialPackage({ directory: input.directory }) !== input.expectedFingerprint) throw new MaterialHostError("base-stale", "Base changed before apply.");
    await input.beforeSwap?.();
    await rename(input.directory, backup); moved = true;
    if (await fingerprintMaterialPackage({ directory: backup }) !== input.expectedFingerprint) throw new MaterialHostError("base-stale", "Base changed between apply verification and replacement.");
    await rename(stage, input.directory); installed = true;
    const result = await input.commit(); committed = true; return result;
  } catch (error) {
    try {
      if (installed) await rm(input.directory, { recursive: true });
      if (moved) { await rename(backup, input.directory); moved = false; }
    } catch (restoreError) {
      // Preserve the only original copy if rollback itself fails. Never clean this backup.
      throw new AggregateError([error, restoreError], `Apply rollback failed; original bytes retained at ${backup}`);
    }
    throw error;
  } finally {
    // Cleanup cannot change the outcome of an already committed transaction.
    await rm(stage, { recursive: true, force: true }).catch(() => undefined);
    if (committed && moved) await rm(backup, { recursive: true, force: true }).catch(() => undefined);
  }
};
