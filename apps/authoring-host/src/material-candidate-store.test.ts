import { mkdtemp,mkdir,readFile,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { createMaterialCandidateFixture,createMaterialImageFixture,MaterialCandidateSchema } from "@private-2d-rigging-lab/contracts";
import { createMaterialCandidate,loadMaterialCandidate,saveMaterialCandidate } from "./material-candidate-store.js";
import { fingerprintMaterialPackage,readMaterialPackageFiles } from "./material-package-fingerprint.js";
import { writeEyeSmokeFixturePackage } from "./test-support/authoring-host-fixtures.js";
import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
describe("persistent material candidates",()=>{
  it("restores metadata/rgba and a normally reloadable working package while base bytes stay unchanged",async()=>{
    const root=await mkdtemp(join(tmpdir(),"material-store-")),base=join(root,"base"),store={basePackageDirectory:base,storeDirectory:join(root,"candidates")};
    await writeEyeSmokeFixturePackage(base); const loaded=await loadAuthoringPackageDirectory(base),hash=await fingerprintMaterialPackage({directory:base});
    const candidate=MaterialCandidateSchema.parse({...createMaterialCandidateFixture(),basePackage:{...createMaterialCandidateFixture().basePackage,packageId:loaded.session.packageIdentity.packageId,packageRevision:loaded.session.packageRevision,contentFingerprint:hash}}),image=createMaterialImageFixture().image;
    await createMaterialCandidate({store,candidate,image});
    const working=MaterialCandidateSchema.parse({...candidate,state:"working",candidateRevision:1,workingPackage:candidate.basePackage});
    const saved=await saveMaterialCandidate({store,candidate:working,expectedCandidateRevision:0,workingFiles:await readMaterialPackageFiles(base)});
    expect(saved.image.rgbaBytes).toEqual(image.rgbaBytes);expect(saved.candidate).toEqual(working);expect(saved.workingPackage!.session.graph.drawables).toEqual(loaded.session.graph.drawables);
    expect(await fingerprintMaterialPackage({directory:base})).toBe(hash);
    await expect(saveMaterialCandidate({store,candidate:working,expectedCandidateRevision:0})).rejects.toThrow("revision");
    await writeFile(join(saved.workingPackageDirectory!,"extra.txt"),"changed");
    await expect(loadMaterialCandidate({store,candidateId:candidate.candidateId})).rejects.toThrow("working package bytes changed");
    expect(await fingerprintMaterialPackage({directory:base})).toBe(hash);
  },20000);
  it("rejects raw-byte tampering, inside-base stores and mismatched working file sets",async()=>{
    const root=await mkdtemp(join(tmpdir(),"material-store-negative-")),base=join(root,"base");await mkdir(base);
    const candidate=createMaterialCandidateFixture(),image=createMaterialImageFixture().image;
    await expect(createMaterialCandidate({store:{basePackageDirectory:base,storeDirectory:join(base,"bad")},candidate,image})).rejects.toThrow("outside");
    const store={basePackageDirectory:base,storeDirectory:join(root,"candidates")}; await createMaterialCandidate({store,candidate,image});
    const bad=MaterialCandidateSchema.parse({...candidate,state:"working",candidateRevision:1,workingPackage:candidate.basePackage});
    await expect(saveMaterialCandidate({store,candidate:bad,expectedCandidateRevision:0,workingFiles:[]})).rejects.toThrow("fingerprint");
    expect((await loadMaterialCandidate({store,candidateId:candidate.candidateId})).candidate.state).toBe("registered");
    const path=join(store.storeDirectory,candidate.candidateId,"image.rgba"),bytes=await readFile(path);bytes[0]=100;await writeFile(path,bytes);
    await expect(loadMaterialCandidate({store,candidateId:candidate.candidateId})).rejects.toThrow("RGBA SHA-256");
  });
});
