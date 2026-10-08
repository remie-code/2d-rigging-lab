import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { MaterialCandidateSchema, type MaterialCandidate } from "@private-2d-rigging-lab/contracts";
import { loadMaterialCandidate, saveMaterialCandidate, type LoadedMaterialCandidate, type MaterialCandidateStore } from "./material-candidate-store.js";
import { fingerprintMaterialPackage, readMaterialPackageFiles } from "./material-package-fingerprint.js";
import { replaceMaterialBase } from "./material-package-transaction.js";
import { MaterialHostError } from "./material-host-error.js";
export const materialRegisteredFields = (candidate: MaterialCandidate) => {
  const { schemaVersion, candidateId, candidateRevision, basePackage, image, restPose, placement, intent, provenance } = candidate;
  return { schemaVersion, candidateId, candidateRevision, basePackage, image, restPose, placement, intent, provenance };
};
export const applyMaterialCandidate = async (store: MaterialCandidateStore, loaded: LoadedMaterialCandidate, beforeSwap?: () => Promise<void>) => {
  const candidate = loaded.candidate;
  if (candidate.state !== "approved" || !loaded.workingPackageDirectory) throw new MaterialHostError("approval-required", "Apply requires the exact approved working candidate.");
  const current = await loadMaterialCandidate({ store, candidateId: candidate.candidateId });
  if (JSON.stringify(current.candidate) !== JSON.stringify(candidate)) throw new MaterialHostError("candidate-state-changed", "Candidate state changed before apply.");
  const files = await readMaterialPackageFiles(loaded.workingPackageDirectory);
  if (await fingerprintMaterialPackage({ files }) !== candidate.approval.workingPackage.contentFingerprint) throw new MaterialHostError("working-hash-mismatch", "Working bytes differ from the approved package.");
  const applied = MaterialCandidateSchema.parse({ ...candidate, state: "applied", appliedPackage: candidate.workingPackage });
  const pointer = join(store.storeDirectory, candidate.candidateId, "current.json"), oldPointer = await readFile(pointer);
  return replaceMaterialBase({ directory: store.basePackageDirectory, expectedFingerprint: candidate.basePackage.contentFingerprint, files,
    ...(beforeSwap ? { beforeSwap } : {}),
    commit: async () => {
      const latest = await loadMaterialCandidate({ store, candidateId: candidate.candidateId });
      if (JSON.stringify(latest.candidate) !== JSON.stringify(candidate)) throw new MaterialHostError("candidate-state-changed", "Candidate state changed during apply.");
      try { return await saveMaterialCandidate({ store, candidate: applied, expectedCandidateRevision: candidate.candidateRevision }); }
      catch (error) {
        // A store may throw after switching current.json (lock cleanup or final load).
        // Restore its previous pointer before the outer package rollback.
        const restore = `${pointer}.restore-${randomUUID()}`;
        await writeFile(restore, oldPointer, { flag: "wx" }); await rename(restore, pointer);
        throw error;
      }
    } });
};
