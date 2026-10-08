import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  acquireRuntimePlayerSlotLock,
  runtimePlayerSlotLockFileName
} from "./slot-lock";

async function makeSlotDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "runtime-player-slot-lock-"));
}

const alwaysAlive = (): boolean => true;
const neverAlive = (): boolean => false;

describe("acquireRuntimePlayerSlotLock", () => {
  it("acquires a free slot and writes an owner record", async () => {
    const slotUserDataPath = await makeSlotDir();
    const result = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      role: "trackingHost",
      pid: 1000,
      isProcessAlive: alwaysAlive,
      nowIso: () => "2026-07-10T00:00:00.000Z"
    });

    expect(result.ok).toBe(true);
    const lockPath = path.join(slotUserDataPath, runtimePlayerSlotLockFileName);
    expect(existsSync(lockPath)).toBe(true);
    const record = JSON.parse(readFileSync(lockPath, "utf8")) as {
      pid: number;
      role: string;
    };
    expect(record).toMatchObject({ pid: 1000, role: "trackingHost" });
  });

  it("rejects a second acquire while the owner is alive", async () => {
    const slotUserDataPath = await makeSlotDir();
    const first = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      pid: 1000,
      isProcessAlive: alwaysAlive
    });
    expect(first.ok).toBe(true);

    const second = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      pid: 2000,
      isProcessAlive: alwaysAlive
    });

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe("busy");
      expect(second.owner?.pid).toBe(1000);
    }
  });

  it("allows re-acquisition after release", async () => {
    const slotUserDataPath = await makeSlotDir();
    const first = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      pid: 1000,
      isProcessAlive: alwaysAlive
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      first.lock.release();
    }

    const lockPath = path.join(slotUserDataPath, runtimePlayerSlotLockFileName);
    expect(existsSync(lockPath)).toBe(false);

    const second = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      pid: 2000,
      isProcessAlive: alwaysAlive
    });
    expect(second.ok).toBe(true);
  });

  it("reclaims a stale lock left by a dead process", async () => {
    const slotUserDataPath = await makeSlotDir();
    const first = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      pid: 1000,
      isProcessAlive: alwaysAlive
    });
    expect(first.ok).toBe(true);

    // Owner 1000 is now considered dead: a fresh instance should reclaim.
    const reclaimed = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      pid: 3000,
      isProcessAlive: (pid) => pid !== 1000
    });

    expect(reclaimed.ok).toBe(true);
    const lockPath = path.join(slotUserDataPath, runtimePlayerSlotLockFileName);
    const record = JSON.parse(readFileSync(lockPath, "utf8")) as { pid: number };
    expect(record.pid).toBe(3000);
  });

  it("reclaims an unparseable lock file", async () => {
    const slotUserDataPath = await makeSlotDir();
    const lockPath = path.join(slotUserDataPath, runtimePlayerSlotLockFileName);
    writeFileSync(lockPath, "{ not json", "utf8");

    const result = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      pid: 4000,
      isProcessAlive: neverAlive
    });

    expect(result.ok).toBe(true);
  });

  it("does not delete a lock that was reclaimed by another owner on release", async () => {
    const slotUserDataPath = await makeSlotDir();
    const first = acquireRuntimePlayerSlotLock({
      slotUserDataPath,
      pid: 1000,
      isProcessAlive: alwaysAlive
    });
    expect(first.ok).toBe(true);

    // Another owner overwrites the lock record (simulating stale reclaim).
    const lockPath = path.join(slotUserDataPath, runtimePlayerSlotLockFileName);
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: 9999, acquiredAtIso: "x" }),
      "utf8"
    );

    if (first.ok) {
      first.lock.release();
    }

    // The other owner's lock is left intact.
    expect(existsSync(lockPath)).toBe(true);
    const record = JSON.parse(readFileSync(lockPath, "utf8")) as { pid: number };
    expect(record.pid).toBe(9999);
  });
});
