import { mkdtemp,mkdir,writeFile,symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe,expect,it } from "vitest";
import { assertMaterialOutsideBase,fingerprintMaterialPackage } from "./material-package-fingerprint.js";
describe("material byte-exact package fingerprint",()=>{
  it("matches the specified wire bytes independent of file-set order and directory location",async()=>{
    const files=[{path:"z",bytes:Buffer.from([0,255])},{path:".a",bytes:Buffer.from(" x\n")}];
    const wire=Buffer.concat([Buffer.from("material-package-content-v1\n"),Buffer.from("000000000000000200000000000000022e61000000000000000320780a00000000000000017a000000000000000200ff","hex")]);
    expect(await fingerprintMaterialPackage({files})).toBe(createHash("sha256").update(wire).digest("hex"));
    const directory=await mkdtemp(join(tmpdir(),"material-hash-")); for(const f of files) await writeFile(join(directory,f.path),f.bytes);
    expect(await fingerprintMaterialPackage({directory})).toBe(await fingerprintMaterialPackage({files:[...files].reverse()}));
    await writeFile(join(directory,".a"),"x\n"); expect(await fingerprintMaterialPackage({directory})).not.toBe(await fingerprintMaterialPackage({files}));
  });
  it("keeps path case and Unicode byte identity, rejects ambiguous paths",async()=>{
    const bytes=new Uint8Array([1]);
    expect(await fingerprintMaterialPackage({files:[{path:"A",bytes}]})).not.toBe(await fingerprintMaterialPackage({files:[{path:"a",bytes}]}));
    expect(await fingerprintMaterialPackage({files:[{path:"é",bytes}]})).not.toBe(await fingerprintMaterialPackage({files:[{path:"é",bytes}]}));
    await expect(fingerprintMaterialPackage({files:[{path:"a/b",bytes},{path:"a\\b",bytes}]})).rejects.toThrow("Duplicate");
    await expect(fingerprintMaterialPackage({files:[{path:"../bad",bytes}]})).rejects.toThrow("Unsafe");
  });
  it("rejects nested state and linked package trees",async()=>{
    const root=await mkdtemp(join(tmpdir(),"material-links-")),base=join(root,"base"),outside=join(root,"outside");await mkdir(base);await mkdir(outside);
    await expect(assertMaterialOutsideBase(base,join(base,"candidate"))).rejects.toThrow("outside");
    await symlink(outside,join(base,"alias"),process.platform==="win32"?"junction":"dir");
    await expect(fingerprintMaterialPackage({directory:base})).rejects.toThrow();
    await expect(assertMaterialOutsideBase(base,join(base,"alias","store"))).rejects.toThrow();
  });
});

