import { describe,expect,it } from "vitest";
import { extractMaterialSource } from "./material-source-extraction.js";
import { createMaterialRenderFixture,materialPixel,readMaterialTestPng } from "./material-test-fixtures.js";
describe("source extraction",()=>{
  it("returns original transparent raster and real context, with storage inset mapping",async()=>{
    const f=await createMaterialRenderFixture();f.session.graph.masks=[];
    const d=f.session.graph.drawables.find(d=>d.drawableId===f.ids.eyeDrawableId)!,entry=f.session.graph.textureAtlas!.textures.find(t=>t.textureId===d.textureId)!;
    entry.dimensions={width:6,height:6,pixelFormat:"rgba8"};entry.contentInset={left:1,right:1,top:1,bottom:1};
    const binaryIndex=f.session.binaryAssets!.fileEntries.findIndex(b=>b.path===entry.binaryAssetRef!.packageRelativePath); const binary={...f.session.binaryAssets!.fileEntries[binaryIndex]!,bytes:new Uint8Array(6*6*4)}; f.session.binaryAssets!.fileEntries[binaryIndex]=binary;
    binary.bytes=new Uint8Array(6*6*4);for(let y=1;y<5;y++)for(let x=1;x<5;x++)binary.bytes.set([220,80,40,128],(y*6+x)*4);
    const before=structuredClone(f.session),result=await extractMaterialSource({...f,drawableId:f.ids.eyeDrawableId,packageVersion:f.candidate.basePackage});
    const source=await readMaterialTestPng(result.sourceContext.sourceTexture.imageAbsolutePath);
    expect([...source.data]).toEqual([...binary.bytes]);expect(result.sourceContext.sourceImageToStage).toMatchObject({scale:0.5,translation:{x:11.5,y:11.5}});
    expect(result.sidecars[0]!.viewport.stageRect).toMatchObject({x:11.5,y:11.5,width:3,height:3});
    const context=await readMaterialTestPng(result.sourceContext.contextComposite.imageAbsolutePath);expect(materialPixel(context,5,4)).toEqual([20,40,240,255]);
    expect(f.session).toEqual(before);expect(result.sourceContext.relatedTargets.some(t=>t.kind==="texture")).toBe(true);
  });
  it("reports mask relations and rejects nonuniform mapping or inside-base artifacts",async()=>{
    const f=await createMaterialRenderFixture();
    const result=await extractMaterialSource({...f,drawableId:f.ids.eyeDrawableId,packageVersion:f.candidate.basePackage});expect(result.sourceContext.maskRelationIds).toHaveLength(1);
    await expect(extractMaterialSource({...f,drawableId:f.ids.eyeDrawableId,packageVersion:f.candidate.basePackage,artifactDirectory:f.basePackageDirectory})).rejects.toThrow("outside");
    const layer=f.session.graph.sourceAssets.flatMap(a=>a.layers).find(l=>l.mappedDrawableIds.some(id=>id===f.ids.eyeDrawableId))!;layer.bounds.width=3;
    await expect(extractMaterialSource({...f,drawableId:f.ids.eyeDrawableId,packageVersion:f.candidate.basePackage})).rejects.toThrow("nonuniform");
  });
});

