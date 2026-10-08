import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * One-time, idempotent, non-destructive adoption of the pre-slot ("legacy")
 * profile data that lived directly under the default userData root.
 *
 * On the first launch of the `tracking-default` slot the known store
 * directories are copied into the slot so today's single Tracking Host keeps
 * its calibration / mappings / tuning / window state / Browser Source token.
 * The source is never modified. A marker file makes re-runs no-ops.
 */

export const runtimePlayerLegacyAdoptionMarkerFileName = ".legacy-adopted.json";

/**
 * Known store roots under the default userData directory (see the C1 planning
 * inventory, observation 2). Each is a directory that stores DI its userData
 * base; copying the directory carries every file the store owns.
 */
export const runtimePlayerLegacyAdoptionEntries = [
  "window-state",
  "browser-source",
  "model-mapping-profiles",
  "dynamics-tuning-profiles",
  "input-profiles",
  "startup-state"
] as const;

export type RuntimePlayerLegacyAdoptionResult =
  | { readonly adopted: false; readonly reason: "already-adopted" }
  | {
      readonly adopted: true;
      readonly copiedEntries: readonly string[];
      readonly skippedExistingEntries: readonly string[];
    };

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function adoptRuntimePlayerLegacyDefaults(input: {
  readonly defaultUserDataPath: string;
  readonly slotUserDataPath: string;
  readonly entries?: readonly string[];
  readonly nowIso?: () => string;
}): Promise<RuntimePlayerLegacyAdoptionResult> {
  const entries = input.entries ?? runtimePlayerLegacyAdoptionEntries;
  const nowIso = input.nowIso ?? (() => new Date().toISOString());
  const markerPath = path.join(
    input.slotUserDataPath,
    runtimePlayerLegacyAdoptionMarkerFileName
  );

  if (await pathExists(markerPath)) {
    return { adopted: false, reason: "already-adopted" };
  }

  await mkdir(input.slotUserDataPath, { recursive: true });

  const copiedEntries: string[] = [];
  const skippedExistingEntries: string[] = [];

  for (const entry of entries) {
    const sourcePath = path.join(input.defaultUserDataPath, entry);
    const destinationPath = path.join(input.slotUserDataPath, entry);

    if (!(await pathExists(sourcePath))) {
      continue;
    }

    // Defensive: never overwrite data already present in the slot.
    if (await pathExists(destinationPath)) {
      skippedExistingEntries.push(entry);
      continue;
    }

    await cp(sourcePath, destinationPath, {
      recursive: true,
      errorOnExist: false,
      force: false
    });
    copiedEntries.push(entry);
  }

  await writeFile(
    markerPath,
    `${JSON.stringify(
      {
        adoptedAtIso: nowIso(),
        copiedEntries,
        skippedExistingEntries
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { adopted: true, copiedEntries, skippedExistingEntries };
}

/**
 * Reads the adoption marker if present (test/diagnostic helper).
 */
export async function readRuntimePlayerLegacyAdoptionMarker(
  slotUserDataPath: string
): Promise<unknown | null> {
  const markerPath = path.join(
    slotUserDataPath,
    runtimePlayerLegacyAdoptionMarkerFileName
  );

  try {
    return JSON.parse(await readFile(markerPath, "utf8"));
  } catch {
    return null;
  }
}
