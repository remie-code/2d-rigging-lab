import { createRequire } from "node:module";
import { readFile,mkdir,mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { createEmptyParameterPerceptionFixture } from "./test-support/perception-fixtures.js";
import { createMaterialCandidateFixture,MaterialCandidateSchema,createMaterialImageFixture } from "@private-2d-rigging-lab/contracts";
const png=createRequire(import.meta.url)("pngjs") as {PNG:{sync:{read(bytes:Buffer):{width:number;height:number;data:Buffer}}}};
export const readMaterialTestPng=async(path:string)=>png.PNG.sync.read(await readFile(path));
export const materialTestViewport={stageRect:{space:"rest-stage-canvas-y-down-v1" as const,x:8,y:8,width:12,height:12},outputWidth:12,outputHeight:12};
export const createMaterialRenderFixture=async()=>{
  const f=createEmptyParameterPerceptionFixture(),{session,ids}=f;
  const parent=session.graph.parts.find(p=>p.drawableIds.includes(session.graph.drawables[0]!.drawableId))!;
  parent.children=[{kind:"drawable",drawableId:session.graph.drawables.find(d=>d.drawableId===ids.eyeMaskDrawableId)!.drawableId},{kind:"drawable",drawableId:session.graph.drawables.find(d=>d.drawableId===ids.eyeDrawableId)!.drawableId}];
  for(const [index,id] of [ids.eyeDrawableId,ids.eyeMaskDrawableId].entries()) {
    const d=session.graph.drawables.find(d=>d.drawableId===id)!,mesh=session.graph.meshes.find(m=>m.meshId===d.meshId)!;
    const x=index===0?12:13,y=12,w=2,h=2;
    mesh.vertices=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];mesh.uvs=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];mesh.triangles=[[0,1,2],[0,2,3]];mesh.bounds={x,y,width:w,height:h};
    const entry=session.graph.textureAtlas!.textures.find(t=>t.textureId===d.textureId)!;
    const bytes=session.binaryAssets!.fileEntries.find(b=>b.path===entry.binaryAssetRef!.packageRelativePath)!.bytes;
    for(let i=0;i<bytes.length;i+=4) bytes.set(index===0?[220,80,40,255]:[20,40,240,255],i);
    for(const asset of session.graph.sourceAssets) for(const layer of asset.layers) if(layer.mappedDrawableIds.includes(d.drawableId)) layer.bounds={...mesh.bounds};
  }
  session.dirty=false;
  const image=createMaterialImageFixture("wide").image;
  const base=createMaterialCandidateFixture();
  const candidate=MaterialCandidateSchema.parse({...base,image:image.descriptor,placement:createMaterialImageFixture("wide").placement,basePackage:{...base.basePackage,packageId:session.packageIdentity.packageId,packageRevision:session.packageRevision},intent:{...base.intent,drawableId:ids.eyeDrawableId}});
  const root=process.env.MATERIAL_ARTIFACT_DIRECTORY?resolve(process.env.MATERIAL_ARTIFACT_DIRECTORY):await mkdtemp(join(tmpdir(),"material-render-"));
  const basePackageDirectory=join(root,"base"),artifactDirectory=join(root,"artifacts");await mkdir(basePackageDirectory,{recursive:true});
  return {session,ids,candidate,image,basePackageDirectory,artifactDirectory,parent,viewport:materialTestViewport};
};
export const materialPixel=(r:{width:number;data:Uint8Array},x:number,y:number)=>[...r.data.slice((y*r.width+x)*4,(y*r.width+x)*4+4)];

