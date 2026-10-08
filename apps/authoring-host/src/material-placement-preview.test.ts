import { describe,expect,it } from "vitest";
import { readFile } from "node:fs/promises";
import { MaterialCandidateSchema } from "@private-2d-rigging-lab/contracts";
import { renderMaterialPlacementPreview } from "./material-placement-preview.js";
import { createMaterialRenderFixture,materialPixel,readMaterialTestPng } from "./material-test-fixtures.js";
import { VariantGroupSchema, RigControlSchema } from "@private-2d-rigging-lab/package-format";
describe("full-alpha placement with the real renderer",()=>{
  it("draws new alpha outside old mesh and retains front occlusion / sidecar / input bytes",async()=>{
    const f=await createMaterialRenderFixture(); f.session.graph.masks=[];const before=structuredClone(f.session);
    const result=await renderMaterialPlacementPreview(f),r=await readMaterialTestPng(result.artifact.imageAbsolutePath);
    expect(materialPixel(r,3,4)).toEqual([220,80,40,255]); // stage 11.5,12.5 outside old x>=12
    expect(materialPixel(r,5,4)).toEqual([20,40,240,255]); // foreground stage 13.5
    expect(f.session).toEqual(before);expect(result.sidecar.coverage).toBe("full-alpha-no-old-mesh-clip");
    expect(JSON.parse(await readFile(result.artifact.sidecarAbsolutePath,"utf8"))).toEqual(result.sidecar);
    expect(result.sidecar.materialPlacement).toEqual(f.candidate.placement);expect(result.sidecar.imageToStage.scale).toBe(1);
  });
  it("honors an existing target mask: uncovered new alpha is clipped by mask, never by old mesh",async()=>{
    const f=await createMaterialRenderFixture();
    const result=await renderMaterialPlacementPreview(f),r=await readMaterialTestPng(result.artifact.imageAbsolutePath);
    expect(materialPixel(r,3,4)[3]).toBe(0);expect(materialPixel(r,5,4)[3]).toBe(255);
    f.session.graph.masks[0]!.maskDrawableIds.push("draw_missing" as never);
    await expect(renderMaterialPlacementPreview(f)).rejects.toThrow("missing drawables");
  });
  it("retains runtime visibility and default variant membership for replacement",async()=>{
    const f=await createMaterialRenderFixture(); f.session.graph.masks=[];
    const d=f.session.graph.drawables.find(d=>d.drawableId===f.ids.eyeDrawableId)!;d.runtimeVisibility=false;
    let r=await readMaterialTestPng((await renderMaterialPlacementPreview(f)).artifact.imageAbsolutePath);expect(materialPixel(r,3,4)[3]).toBe(0);
    d.runtimeVisibility=true;d.defaultOpacity=0.5;
    r=await readMaterialTestPng((await renderMaterialPlacementPreview(f)).artifact.imageAbsolutePath);expect(materialPixel(r,3,4)[3]).toBe(128);
    f.session.graph.variantGroups=[VariantGroupSchema.parse({variantGroupId:"vgrp_material",displayName:"Material",mode:"singleSelect",variants:[{variantId:"var_on",displayName:"On"},{variantId:"var_off",displayName:"Off"}],targetDrawableIds:[d.drawableId],memberships:[{drawableId:d.drawableId,variantIds:["var_on"]}],defaultActive:{kind:"singleSelect",variantId:"var_off"}})];
    r=await readMaterialTestPng((await renderMaterialPlacementPreview(f)).artifact.imageAbsolutePath);expect(materialPixel(r,3,4)[3]).toBe(0);
  });
  it("applies rest rig opacity without moving the placement by rest transforms or mutating base",async()=>{
    const f=await createMaterialRenderFixture();f.session.graph.masks=[];
    const control=RigControlSchema.parse({kind:"rotation2d",rigControlId:"rig_material_opacity",displayName:"Opacity",childDrawableIds:[f.ids.eyeDrawableId],childRigControlIds:[],pivot:{x:0,y:0},restAngleDegrees:0,restTranslation:{x:100,y:0},restScale:{x:1,y:1},enabled:true,opacityMultiplier:0.5});
    f.session.graph.rigControls.push(control);f.session.graph.rigControlRootIds.push(control.rigControlId);
    const before=structuredClone(f.session);
    const r=await readMaterialTestPng((await renderMaterialPlacementPreview(f)).artifact.imageAbsolutePath);
    expect(materialPixel(r,3,4)[3]).toBe(128);expect(f.session).toEqual(before);
    const candidate=MaterialCandidateSchema.parse({...f.candidate,intent:{kind:"add",drawableId:"draw_rig_alpha",displayName:"New",parentPartId:f.parent.partId,insertion:{position:"first"},rigControlIds:[control.rigControlId],maskBindings:[],runtimeVisibility:true,defaultOpacity:1}});
    const added=await readMaterialTestPng((await renderMaterialPlacementPreview({...f,candidate})).artifact.imageAbsolutePath);
    expect(materialPixel(added,3,4)[3]).toBe(128);expect(f.session).toEqual(before);
  });
  it("inserts an added full-alpha drawable before/after structural siblings",async()=>{
    const f=await createMaterialRenderFixture();f.session.graph.masks=[];
    const intent={kind:"add",drawableId:"draw_added_material",displayName:"Added",parentPartId:f.parent.partId,insertion:{position:"last"},rigControlIds:[],maskBindings:[],runtimeVisibility:true,defaultOpacity:1};
    let candidate=MaterialCandidateSchema.parse({...f.candidate,intent});
    let r=await readMaterialTestPng((await renderMaterialPlacementPreview({...f,candidate})).artifact.imageAbsolutePath);expect(materialPixel(r,5,4)).toEqual([20,40,240,255]);
    candidate=MaterialCandidateSchema.parse({...candidate,intent:{...intent,insertion:{position:"before",sibling:{kind:"drawable",drawableId:f.ids.eyeMaskDrawableId}}}});
    r=await readMaterialTestPng((await renderMaterialPlacementPreview({...f,candidate})).artifact.imageAbsolutePath);expect(materialPixel(r,5,4)).toEqual([220,80,40,255]);
  });
  it("handles added target and maskSource roles in the actual mask pass",async()=>{
    const f=await createMaterialRenderFixture(),mask=f.session.graph.masks[0]!;
    const intent={kind:"add",drawableId:"draw_added_mask_material",displayName:"Added",parentPartId:f.parent.partId,insertion:{position:"last"},rigControlIds:[],maskBindings:[{maskRelationId:mask.maskRelationId,role:"target"}],runtimeVisibility:true,defaultOpacity:1};
    let candidate=MaterialCandidateSchema.parse({...f.candidate,intent});
    let r=await readMaterialTestPng((await renderMaterialPlacementPreview({...f,candidate})).artifact.imageAbsolutePath);expect(materialPixel(r,3,4)[3]).toBe(0);
    // New source extends coverage to old eye's x=12.5, while original source starts x=13.
    candidate=MaterialCandidateSchema.parse({...f.candidate,intent:{...intent,insertion:{position:"last"},maskBindings:[{maskRelationId:mask.maskRelationId,role:"maskSource"}]}});
    const eye=f.session.graph.drawables.find(d=>d.drawableId===f.ids.eyeDrawableId)!;
    const tex=f.session.graph.textureAtlas!.textures.find(t=>t.textureId===eye.textureId)!;
    const bytes=f.session.binaryAssets!.fileEntries.find(b=>b.path===tex.binaryAssetRef!.packageRelativePath)!.bytes;
    for(let i=0;i<bytes.length;i+=4) bytes.set([30,240,60,255],i);
    r=await readMaterialTestPng((await renderMaterialPlacementPreview({...f,candidate})).artifact.imageAbsolutePath);expect(materialPixel(r,4,4)).toEqual([30,240,60,255]);
    expect(f.session.graph.drawables).toHaveLength(2);expect(mask.maskDrawableIds).toHaveLength(1);
  });
});


