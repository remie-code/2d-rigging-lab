import { applyMaterialCandidate, materialRegisteredFields } from "./material-candidate-apply.js";
import { saveMaterialCandidate } from "./material-candidate-store.js";
import { MaterialCandidateSchema } from "@private-2d-rigging-lab/contracts";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { materialFixture } from "./material-command-test-fixtures.js";
import { fingerprintMaterialPackage, readMaterialPackageFiles } from "./material-package-fingerprint.js";
import { replaceMaterialBase, captureMaterialPackage, withMaterialPackageLock } from "./material-package-transaction.js";

describe("candidate state and apply protection", () => {
  it("discard leaves exact bytes and makes same-revision approve/apply impossible", async () => {
    const f = await materialFixture(); const hash = await fingerprintMaterialPackage({ directory: f.packageDirectory });
    let c = await f.next("buildMaterialCandidate", await f.register());
    c = await f.next("discardMaterialCandidate", c);
    for (const command of ["approveMaterialCandidate", "applyMaterialCandidate", "buildMaterialCandidate"]) {
      const r = await f.invoke(command, { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision });
      expect(r.outcome).toBe("rejected"); expect(r.saved).toBe(false);
    }
    expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(hash);
  }, 60000);
  it("fingerprint-only base changes mark stale and preserve candidate preview/discard", async () => {
    const f = await materialFixture(); let c = await f.next("buildMaterialCandidate", await f.register());
    c = await f.next("approveMaterialCandidate", c);
    await writeFile(join(f.packageDirectory, ".external-note"), "same revision, changed bytes");
    const changed = await fingerprintMaterialPackage({ directory: f.packageDirectory });
    const r = await f.invoke("applyMaterialCandidate", { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision });
    expect(r.outcome).toBe("rejected"); expect(r.saved).toBe(false);
    c = (await f.load(c)).candidate; expect(c.state).toBe("stale"); expect("approval" in c).toBe(false);
    expect((await f.call("previewMaterialCandidate", { candidateId: c.candidateId, mode: "placement", viewport: f.viewport })).result!.status).toBe("completed");
    await f.next("discardMaterialCandidate", c);
    expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(changed);
  }, 60000);
  it("rechecks same-revision candidate state immediately before metadata commit", async () => {
    const f = await materialFixture(); let c = await f.next("buildMaterialCandidate", await f.register()); c = await f.next("approveMaterialCandidate", c);
    const hash = await fingerprintMaterialPackage({ directory: f.packageDirectory }), loaded = await f.load(c);
    const store = { basePackageDirectory: f.packageDirectory, storeDirectory: join(f.stateDirectory, "material-candidates") };
    await expect(withMaterialPackageLock(f.packageDirectory, () => applyMaterialCandidate(store, loaded, async () => {
      await saveMaterialCandidate({ store, expectedCandidateRevision: c.candidateRevision, candidate: MaterialCandidateSchema.parse({ ...materialRegisteredFields(c), state: "discarded" }) });
    }))).rejects.toThrow("state changed");
    expect((await f.load(c)).candidate.state).toBe("discarded");
    expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(hash);
  }, 30000);
  it("closes the verify-to-write race and rolls back ordinary metadata failure", async () => {
    const f = await materialFixture(); const files = await readMaterialPackageFiles(f.packageDirectory), hash = await fingerprintMaterialPackage({ files });
    await expect(replaceMaterialBase({ directory: f.packageDirectory, expectedFingerprint: hash, files,
      beforeSwap: async () => { await writeFile(join(f.packageDirectory, ".racer"), "external bytes"); }, commit: async () => true })).rejects.toThrow("between");
    expect(await readFile(join(f.packageDirectory, ".racer"), "utf8")).toBe("external bytes");
    const changedHash = await fingerprintMaterialPackage({ directory: f.packageDirectory });
    await expect(replaceMaterialBase({ directory: f.packageDirectory, expectedFingerprint: changedHash, files, commit: async () => { throw new Error("metadata failure"); } })).rejects.toThrow("metadata failure");
    expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(changedHash);
  }, 30000);
  it("session and fingerprint use one exact snapshot, preserving whitespace and extra files", async () => {
    const f = await materialFixture(); await writeFile(join(f.packageDirectory, ".bytes"), new Uint8Array([0, 255, 13, 10]));
    const captured = await captureMaterialPackage(f.packageDirectory, join(f.root, "snapshot-test"));
    expect(await fingerprintMaterialPackage({ directory: captured.directory })).toBe(captured.version.contentFingerprint);
    expect(captured.loaded.session.packageRevision).toBe(captured.version.packageRevision);
    expect(await readFile(join(captured.directory, ".bytes"))).toEqual(Buffer.from([0, 255, 13, 10]));
  }, 20000);
  it("package lock excludes same-revision changes across state directories and ordinary commands", async () => {
    const f = await materialFixture(); const c = await f.register();
    await withMaterialPackageLock(f.packageDirectory, async () => {
      expect((await f.invoke("discardMaterialCandidate", { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision })).outcome).toBe("rejected");
      const { runAuthoringHostCommand } = await import("./run-authoring-host-command.js");
      expect((await runAuthoringHostCommand({ packageDirectory: f.packageDirectory, stateDirectory: join(f.root, "other-state"), command: { command: "getEditorState" } })).diagnostics![0]!.checkId).toBe("material.packageBusy");
    });
    expect((await f.load(c)).candidate.state).toBe("registered");
  }, 20000);
});
