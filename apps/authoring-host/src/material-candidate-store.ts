import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { MaterialCandidateSchema, MaterialCandidateIdSchema, type MaterialCandidate, type MaterialNormalizedImage } from "@private-2d-rigging-lab/contracts";
import { verifyMaterialImage } from "./material-image-decode.js";
import { assertMaterialOutsideBase, assertMaterialNoLinks, fingerprintMaterialPackage, normalizeMaterialPackagePath, readMaterialPackageFiles, type MaterialPackageFile } from "./material-package-fingerprint.js";
import { loadAuthoringPackageDirectory, type LoadedAuthoringPackage } from "./package-directory-io.js";
import { MaterialHostError } from "./material-host-error.js";
export interface MaterialCandidateStore { basePackageDirectory: string; storeDirectory: string }
export interface LoadedMaterialCandidate { candidate: MaterialCandidate; image: MaterialNormalizedImage; workingPackageDirectory?: string; workingPackage?: LoadedAuthoringPackage }
const candidateDirectory = async (store: MaterialCandidateStore, id: string): Promise<string> => {
  MaterialCandidateIdSchema.parse(id);
  await assertMaterialOutsideBase(store.basePackageDirectory,store.storeDirectory);
  const path=join(resolve(store.storeDirectory),id); await assertMaterialOutsideBase(store.basePackageDirectory,path); return path;
};
export const createMaterialCandidate = async (input: { store: MaterialCandidateStore; candidate: MaterialCandidate; image: MaterialNormalizedImage }): Promise<LoadedMaterialCandidate> => {
  const candidate=MaterialCandidateSchema.parse(input.candidate);
  if (candidate.state !== "registered" || candidate.candidateRevision !== 0) throw new MaterialHostError("invalid-initial-candidate", "Create requires registered revision zero.");
  verifyMaterialImage(input.image);
  if (JSON.stringify(candidate.image)!==JSON.stringify(input.image.descriptor)) throw new MaterialHostError("candidate-image-mismatch", "Image descriptor differs from candidate.");
  if (!candidate.image.alpha.nonTransparentPixelCount) throw new MaterialHostError("empty-alpha", "Candidate has no drawable alpha.");
  const directory=await candidateDirectory(input.store,candidate.candidateId);
  await mkdir(resolve(input.store.storeDirectory),{recursive:true}); await mkdir(directory);
  await writeFile(join(directory,"image.rgba"),input.image.rgbaBytes,{flag:"wx"});
  await commitSnapshot(directory,candidate);
  return loadMaterialCandidate({store:input.store,candidateId:candidate.candidateId});
};
export const loadMaterialCandidate = async (input: { store: MaterialCandidateStore; candidateId: string }): Promise<LoadedMaterialCandidate> => {
  const directory=await candidateDirectory(input.store,input.candidateId);
  await assertMaterialNoLinks(join(directory,"current.json"));
  const pointer=JSON.parse(await readFile(join(directory,"current.json"),"utf8")) as { snapshot: string };
  if (!/^snapshot_[a-f0-9-]+$/.test(pointer.snapshot)) throw new MaterialHostError("invalid-store-pointer", "Invalid candidate snapshot pointer.");
  const snapshot=join(directory,pointer.snapshot); await assertMaterialNoLinks(snapshot);
  await assertMaterialNoLinks(join(snapshot,"candidate.json"));
  const candidate=MaterialCandidateSchema.parse(JSON.parse(await readFile(join(snapshot,"candidate.json"),"utf8")));
  if(candidate.candidateId!==input.candidateId) throw new MaterialHostError("candidate-id-mismatch","Stored candidate ID mismatch.");
  await assertMaterialNoLinks(join(directory,"image.rgba"));
  const image={descriptor:candidate.image,rgbaBytes:new Uint8Array(await readFile(join(directory,"image.rgba")))}; verifyMaterialImage(image);
  if("workingPackage" in candidate && candidate.workingPackage!==undefined) {
    const workingPackageDirectory=join(snapshot,"working");
    if(await fingerprintMaterialPackage({directory:workingPackageDirectory})!==candidate.workingPackage.contentFingerprint) throw new MaterialHostError("working-hash-mismatch","Stored working package bytes changed.");
    const workingPackage=await loadAuthoringPackageDirectory(workingPackageDirectory);
    if(workingPackage.session.packageIdentity.packageId!==candidate.workingPackage.packageId || workingPackage.session.packageRevision!==candidate.workingPackage.packageRevision) throw new MaterialHostError("working-version-mismatch","Working package identity/revision mismatch.");
    return {candidate,image,workingPackageDirectory,workingPackage};
  }
  return {candidate,image};
};
export const saveMaterialCandidate = async (input: { store: MaterialCandidateStore; candidate: MaterialCandidate; expectedCandidateRevision: number; workingFiles?: readonly MaterialPackageFile[] }): Promise<LoadedMaterialCandidate> => {
  const candidate=MaterialCandidateSchema.parse(input.candidate), directory=await candidateDirectory(input.store,candidate.candidateId);
  const lock=await open(join(directory,"write.lock"),"wx");
  try {
    const previous=await loadMaterialCandidate({store:input.store,candidateId:candidate.candidateId});
    if(previous.candidate.candidateRevision!==input.expectedCandidateRevision || candidate.candidateRevision<input.expectedCandidateRevision) throw new MaterialHostError("candidate-revision-mismatch","Candidate revision changed.");
    if(JSON.stringify(candidate.image)!==JSON.stringify(previous.candidate.image) || JSON.stringify(candidate.basePackage)!==JSON.stringify(previous.candidate.basePackage)) throw new MaterialHostError("candidate-identity-mismatch","Candidate image and base version are immutable.");
    const workingFiles=input.workingFiles ?? (previous.workingPackageDirectory===undefined?undefined:await readMaterialPackageFiles(previous.workingPackageDirectory));
    await commitSnapshot(directory,candidate,workingFiles);
  } finally { await lock.close(); await unlink(join(directory,"write.lock")); }
  return loadMaterialCandidate({store:input.store,candidateId:candidate.candidateId});
};
const commitSnapshot = async (directory:string,candidate:MaterialCandidate,files?:readonly MaterialPackageFile[]):Promise<void> => {
  const name=`snapshot_${randomUUID()}`, snapshot=join(directory,name); await mkdir(snapshot);
  if("workingPackage" in candidate && candidate.workingPackage!==undefined) {
    if(files===undefined || await fingerprintMaterialPackage({files})!==candidate.workingPackage.contentFingerprint) throw new MaterialHostError("working-hash-mismatch","Working file-set must match candidate fingerprint.");
    const working=join(snapshot,"working"); await mkdir(working);
    for(const file of files) { const path=join(working,normalizeMaterialPackagePath(file.path)); await mkdir(dirname(path),{recursive:true}); await writeFile(path,file.bytes,{flag:"wx"}); }
    const loaded=await loadAuthoringPackageDirectory(working);
    if(loaded.session.packageIdentity.packageId!==candidate.workingPackage.packageId || loaded.session.packageRevision!==candidate.workingPackage.packageRevision) throw new MaterialHostError("working-version-mismatch","Working package does not match declared version.");
  }
  await writeFile(join(snapshot,"candidate.json"),JSON.stringify(candidate,null,2));
  const pointer=join(directory,`pointer_${randomUUID()}.json`); await writeFile(pointer,JSON.stringify({snapshot:name})); await rename(pointer,join(directory,"current.json"));
};

