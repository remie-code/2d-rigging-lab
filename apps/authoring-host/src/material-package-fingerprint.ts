import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { MaterialHostError } from "./material-host-error.js";
export interface MaterialPackageFile { readonly path: string; readonly bytes: Uint8Array }
const version = "material-package-content-v1";
export const assertMaterialNoLinks = async (path: string): Promise<void> => {
  const full = resolve(path);
  for (let current = full;; current = dirname(current)) {
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new MaterialHostError("package-link", `Linked path is forbidden: ${current}`);
      if (resolve(await realpath(current)).toLowerCase() !== current.toLowerCase()) throw new MaterialHostError("package-alias", `Aliased path is forbidden: ${current}`);
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    if (dirname(current) === current) break;
  }
};
export const assertMaterialOutsideBase = async (base: string, destination: string): Promise<void> => {
  await assertMaterialNoLinks(base); await assertMaterialNoLinks(destination);
  const rel = relative(resolve(base), resolve(destination));
  if (rel === "" || (!rel.startsWith(`..\\`) && !rel.startsWith("../") && rel !== ".." && !isAbsolute(rel))) throw new MaterialHostError("store-inside-base", "Material store/artifacts must be outside the base package.");
};
export const normalizeMaterialPackagePath = (path: string): string => {
  const p = path.replaceAll("\\", "/");
  if (!p || p.startsWith("/") || /[:\0]/.test(p) || p.split("/").some(x=>!x || x === "." || x === ".." || /[. ]$/.test(x))) throw new MaterialHostError("invalid-package-path", `Unsafe package path: ${path}`);
  return p;
};
/** Windows exposes reparse tags beyond symbolic links. Check attributes before recursing. */
const rejectWindowsReparseTree = (directory: string): void => {
  if (process.platform !== "win32") return;
  const literal = resolve(directory).replaceAll("'", "''");
  const script = `$ErrorActionPreference='Stop'; function Check([string]$p) { $a=[IO.File]::GetAttributes($p); if (($a -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'reparse point forbidden' }; if (($a -band [IO.FileAttributes]::Directory) -ne 0) { foreach($c in [IO.Directory]::EnumerateFileSystemEntries($p)) { Check $c } } }; Check '${literal}'`;
  try { execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script,"utf16le").toString("base64")], { windowsHide: true, stdio: "pipe" }); }
  catch { throw new MaterialHostError("package-reparse", "Package tree contains a reparse point or cannot be inspected."); }
};
export const readMaterialPackageFiles = async (directory: string): Promise<MaterialPackageFile[]> => {
  await assertMaterialNoLinks(directory); rejectWindowsReparseTree(directory);
  const files: MaterialPackageFile[] = [];
  const observations: Array<{path:string;stamp:string;children?:string[]}> = [];
  const stamp=(info: Awaited<ReturnType<typeof lstat>>):string=>[info.size,info.mtimeMs,info.ctimeMs,info.ino,info.mode].join(":");
  const visit = async (absolute: string, prefix: string): Promise<void> => {
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new MaterialHostError("package-link", `Linked path is forbidden: ${absolute}`);
    if (info.isDirectory()) {
      const children=(await readdir(absolute)).sort();
      observations.push({path:absolute,stamp:stamp(info),children});
      for (const child of children) await visit(join(absolute,child), prefix ? `${prefix}/${child}` : child);
    } else if (info.isFile()) {
      const bytes = await readFile(absolute), after = await lstat(absolute);
      if (info.size !== after.size || info.mtimeMs !== after.mtimeMs || info.ctimeMs !== after.ctimeMs || info.ino !== after.ino) throw new MaterialHostError("package-changed", "Package changed during fingerprint read.");
      observations.push({path:absolute,stamp:stamp(info)});
      files.push({ path: prefix, bytes });
    } else throw new MaterialHostError("package-special-file", "Only regular package files are supported.");
  };
  await visit(resolve(directory), "");
  for(const observation of observations) {
    const current=await lstat(observation.path);
    if(current.isSymbolicLink() || stamp(current)!==observation.stamp ||
      (observation.children!==undefined && JSON.stringify((await readdir(observation.path)).sort())!==JSON.stringify(observation.children))) {
      throw new MaterialHostError("package-changed", "Package changed during snapshot read.");
    }
  }
  return files;
};
export const fingerprintMaterialPackage = async (input: { directory: string } | { files: readonly MaterialPackageFile[] }): Promise<string> => {
  const entries = "directory" in input ? await readMaterialPackageFiles(input.directory) : input.files;
  const seen = new Set<string>();
  const files = entries.map(entry=>{
    const path = normalizeMaterialPackagePath(entry.path), key = path.toLowerCase();
    if (seen.has(key)) throw new MaterialHostError("duplicate-package-path", `Duplicate canonical path: ${path}`);
    seen.add(key); return { path: Buffer.from(path,"utf8"), bytes: entry.bytes };
  }).sort((a,b)=>Buffer.compare(a.path,b.path));
  const hash = createHash("sha256").update(`${version}\n`);
  const integer = (n:number): void => { const bytes=Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(n)); hash.update(bytes); };
  integer(files.length);
  for (const file of files) { integer(file.path.length); hash.update(file.path); integer(file.bytes.length); hash.update(file.bytes); }
  return hash.digest("hex");
};

