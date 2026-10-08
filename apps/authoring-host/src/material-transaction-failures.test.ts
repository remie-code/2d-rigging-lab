import { describe, expect, it, vi } from "vitest";
vi.mock("node:fs/promises", async importOriginal => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  return { ...fs, rm: vi.fn(fs.rm), unlink: vi.fn(fs.unlink) };
});
import { rm, unlink, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { materialFixture } from "./material-command-test-fixtures.js";
import { fingerprintMaterialPackage, readMaterialPackageFiles } from "./material-package-fingerprint.js";
import { replaceMaterialBase } from "./material-package-transaction.js";

describe("material apply fault boundaries", () => {
  it("restores candidate pointer and base when A throws after metadata commit", async () => {
    const f = await materialFixture(); let c = await f.next("buildMaterialCandidate", await f.register()); c = await f.next("approveMaterialCandidate", c);
    const hash = await fingerprintMaterialPackage({ directory: f.packageDirectory });
    const real = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(unlink).mockImplementation(async path => { if (String(path).endsWith("write.lock")) throw new Error("injected post-commit cleanup"); return real.unlink(path); });
    try {
      const result = await f.invoke("applyMaterialCandidate", { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision });
      expect(result.outcome).toBe("error"); expect(result.saved).toBe(false);
      expect((await f.load(c)).candidate).toEqual(c);
      expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(hash);
    } finally { vi.mocked(unlink).mockImplementation(real.unlink); }
  }, 30000);
  it("host lock cleanup failure cannot hide an already applied result", async () => {
    const f = await materialFixture(); let c = await f.next("buildMaterialCandidate", await f.register()); c = await f.next("approveMaterialCandidate", c);
    const real = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(unlink).mockImplementation(async path => { if (String(path).endsWith(".authoring.lock")) throw new Error("lock cleanup"); return real.unlink(path); });
    try {
      const result = await f.invoke("applyMaterialCandidate", { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision });
      expect(result.outcome).toBe("success"); expect(result.saved).toBe(true); expect((await f.load(c)).candidate.state).toBe("applied");
    } finally { vi.mocked(unlink).mockImplementation(real.unlink); }
  }, 30000);
  it("successful commit is still successful when backup cleanup fails", async () => {
    const f = await materialFixture(), files = await readMaterialPackageFiles(f.packageDirectory), hash = await fingerprintMaterialPackage({ files });
    const real = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(rm).mockImplementation(async (path, options) => { if (String(path).includes(".material-backup-")) throw new Error("cleanup"); return real.rm(path, options); });
    try { expect(await replaceMaterialBase({ directory: f.packageDirectory, files, expectedFingerprint: hash, commit: async () => "committed" })).toBe("committed"); }
    finally { vi.mocked(rm).mockImplementation(real.rm); }
    expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(hash);
    expect((await readdir(f.root)).some(name => name.includes(".material-backup-"))).toBe(true);
  }, 20000);
  it("retains original backup if restoring the base fails", async () => {
    const f = await materialFixture(), files = await readMaterialPackageFiles(f.packageDirectory), hash = await fingerprintMaterialPackage({ files });
    const real = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
    vi.mocked(rm).mockImplementation(async (path, options) => { if (String(path) === f.packageDirectory) throw new Error("cannot remove installed directory"); return real.rm(path, options); });
    try { await expect(replaceMaterialBase({ directory: f.packageDirectory, files, expectedFingerprint: hash, commit: async () => { throw new Error("commit failure"); } })).rejects.toThrow("original bytes retained"); }
    finally { vi.mocked(rm).mockImplementation(real.rm); }
    const backup = (await readdir(f.root)).find(name => name.includes(".material-backup-"))!;
    expect(backup).toBeDefined(); expect(await fingerprintMaterialPackage({ directory: join(f.root, backup) })).toBe(hash);
    expect(await readFile(join(f.root, backup, files[0]!.path))).toEqual(Buffer.from(files[0]!.bytes));
  }, 20000);
});
