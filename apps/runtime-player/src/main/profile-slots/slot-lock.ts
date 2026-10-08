import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

/**
 * Per-slot ownership lock.
 *
 * A live instance claims a slot by creating `<slot>/slot.lock` atomically
 * (`open` with the exclusive `wx` flag). A second instance that finds the lock
 * checks whether the recorded pid is still alive; a dead pid is a stale lock
 * from an abnormal exit and is reclaimed. This replaces a single-instance lock:
 * N instances may run as long as they hold distinct slots.
 *
 * The whole operation is synchronous so it can run at the composition-root
 * entry, before `app.whenReady`, and fail fast.
 */

export const runtimePlayerSlotLockFileName = "slot.lock";

export type RuntimePlayerSlotLockOwner = {
  readonly pid: number;
  readonly role?: string;
  readonly acquiredAtIso: string;
};

export type RuntimePlayerSlotLock = {
  readonly lockFilePath: string;
  release(): void;
};

export type RuntimePlayerSlotLockResult =
  | { readonly ok: true; readonly lock: RuntimePlayerSlotLock }
  | {
      readonly ok: false;
      readonly reason: "busy";
      readonly owner: RuntimePlayerSlotLockOwner | null;
    };

export type AcquireRuntimePlayerSlotLockOptions = {
  readonly slotUserDataPath: string;
  readonly role?: string;
  readonly pid?: number;
  readonly nowIso?: () => string;
  readonly isProcessAlive?: (pid: number) => boolean;
  readonly maxAttempts?: number;
};

function defaultIsProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    // Signal 0 performs existence/permission checks without sending a signal.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but we may not signal it: treat as alive.
    return isErrorCode(error, "EPERM");
  }
}

function isErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function readOwnerRecord(lockFilePath: string): RuntimePlayerSlotLockOwner | null {
  let fileText: string;
  try {
    fileText = readFileSync(lockFilePath, "utf8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("pid" in parsed) ||
    typeof (parsed as { pid?: unknown }).pid !== "number"
  ) {
    return null;
  }

  const record = parsed as {
    pid: number;
    role?: unknown;
    acquiredAtIso?: unknown;
  };

  return {
    pid: record.pid,
    ...(typeof record.role === "string" ? { role: record.role } : {}),
    acquiredAtIso:
      typeof record.acquiredAtIso === "string"
        ? record.acquiredAtIso
        : new Date(0).toISOString()
  };
}

export function acquireRuntimePlayerSlotLock(
  options: AcquireRuntimePlayerSlotLockOptions
): RuntimePlayerSlotLockResult {
  const pid = options.pid ?? process.pid;
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  const nowIso = options.nowIso ?? (() => new Date().toISOString());
  const maxAttempts = options.maxAttempts ?? 5;
  const lockFilePath = path.join(
    options.slotUserDataPath,
    runtimePlayerSlotLockFileName
  );

  mkdirSync(options.slotUserDataPath, { recursive: true });

  const ownerRecord: RuntimePlayerSlotLockOwner = {
    pid,
    ...(options.role === undefined ? {} : { role: options.role }),
    acquiredAtIso: nowIso()
  };

  let lastOwner: RuntimePlayerSlotLockOwner | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let fd: number;
    try {
      fd = openSync(lockFilePath, "wx");
    } catch (error) {
      if (!isErrorCode(error, "EEXIST")) {
        throw error;
      }

      lastOwner = readOwnerRecord(lockFilePath);
      const ownerAlive =
        lastOwner !== null &&
        lastOwner.pid !== pid &&
        isProcessAlive(lastOwner.pid);

      if (ownerAlive) {
        return { ok: false, reason: "busy", owner: lastOwner };
      }

      // Stale (dead pid), same-pid remnant, or unparseable lock: reclaim it.
      try {
        rmSync(lockFilePath, { force: true });
      } catch {
        // Fall through to the next attempt; the exclusive open below decides.
      }
      continue;
    }

    try {
      writeFileSync(fd, `${JSON.stringify(ownerRecord, null, 2)}\n`, "utf8");
    } finally {
      closeSync(fd);
    }

    return {
      ok: true,
      lock: createLock(lockFilePath, pid)
    };
  }

  return { ok: false, reason: "busy", owner: lastOwner };
}

function createLock(lockFilePath: string, pid: number): RuntimePlayerSlotLock {
  let released = false;
  return {
    lockFilePath,
    release(): void {
      if (released) {
        return;
      }
      released = true;

      // Only remove the lock if we still own it, so a lock that was already
      // reclaimed by another instance is never deleted from under it.
      const current = readOwnerRecord(lockFilePath);
      if (current !== null && current.pid !== pid) {
        return;
      }

      try {
        rmSync(lockFilePath, { force: true });
      } catch {
        // Best-effort release; a leftover lock is reclaimed as stale next run.
      }
    }
  };
}
