import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { MaterialSourceContextSchema, MaterialPlacementSchema, type MaterialSourceContext, type MaterialImageArtifact, type MaterialCoordinateSidecar } from "@private-2d-rigging-lab/contracts";
import { encodeRgba8ToPng } from "@private-2d-rigging-lab/render-software";
import { createMaterialRestScene } from "./material-render-context.js";
import { materialRestPose, materialSessionPackageRef, writeMaterialArtifact, type MaterialViewport } from "./material-render-artifact.js";
import { writeMaterialContextComposite } from "./material-context-composite.js";
import { HostError } from "./host-error.js";
/** Read-only: renders from the saved session and writes artifacts outside `packageDirectory`. */
export interface ExtractMaterialSourceInput { session:AuthoringSession;drawableId:string;viewport:MaterialViewport;packageDirectory:string;artifactDirectory:string }
export const extractMaterialSource = async (input:ExtractMaterialSourceInput):Promise<{sourceContext:MaterialSourceContext;artifacts:MaterialImageArtifact[];sidecars:MaterialCoordinateSidecar[]}> => {
  const packageRef=materialSessionPackageRef(input.session);
  const graph=input.session.graph,d=graph.drawables.find(d=>d.drawableId===input.drawableId);
  if(!d) throw new HostError("missing-drawable","Source drawable does not exist.");
  const scene=createMaterialRestScene(input.session),texture=scene.textureSources.find(t=>t.textureId===d.textureId)!;
  const entry=graph.textureAtlas?.textures.find(t=>t.textureId===d.textureId);
  const layers=graph.sourceAssets.filter(a=>a.sourceAssetId===d.sourceAssetId).flatMap(a=>a.layers).filter(l=>l.mappedDrawableIds.includes(d.drawableId));
  const layer=entry?.sourceLayerId===undefined?(layers.length===1?layers[0]:undefined):layers.find(l=>l.sourceLayerId===entry.sourceLayerId);
  if(!layer) throw new HostError("ambiguous-source-layer","Cannot resolve one source layer for the drawable texture.");
  const inset=entry?.contentInset??{left:0,right:0,top:0,bottom:0},bounds=layer.bounds;
  const scale=bounds.width/(texture.width-inset.left-inset.right),scaleY=bounds.height/(texture.height-inset.top-inset.bottom);
  if(Math.abs(scale-scaleY)>1e-9*Math.max(1,scale)) throw new HostError("nonuniform-source-mapping","Source bounds and raster content require nonuniform scaling.");
  const sourceImageToStage=MaterialPlacementSchema.parse({from:"source-image-pixel-edge-v1",to:"rest-stage-canvas-y-down-v1",scale,translation:{x:bounds.x-inset.left*scale,y:bounds.y-inset.top*scale}});
  const sourceViewport:MaterialViewport={stageRect:{space:"rest-stage-canvas-y-down-v1",...sourceImageToStage.translation,width:texture.width*scale,height:texture.height*scale},outputWidth:texture.width,outputHeight:texture.height};
  const sourceSidecar:MaterialCoordinateSidecar={schemaVersion:"material-coordinate-sidecar-v1",kind:"source-texture",packageRef,viewport:sourceViewport,imageToStage:sourceImageToStage,restPose:materialRestPose,coverage:"full-image"};
  const sourceTexture=await writeMaterialArtifact({...input,png:encodeRgba8ToPng(texture.bytes,texture.width,texture.height),sidecar:sourceSidecar});
  const context=await writeMaterialContextComposite({...input,scene}),contextComposite=context.artifact;
  const controls=new Set(graph.rigControls.filter(r=>r.childDrawableIds.includes(d.drawableId)).map(r=>r.rigControlId));
  let changed=true; while(changed) { changed=false; for(const r of graph.rigControls) if(r.childRigControlIds.some(id=>controls.has(id))&&!controls.has(r.rigControlId)) {controls.add(r.rigControlId);changed=true;} }
  const masks=graph.masks.filter(m=>m.maskDrawableIds.includes(d.drawableId)||m.targetDrawableIds.includes(d.drawableId));
  const sourceContext=MaterialSourceContextSchema.parse({packageRef,drawableId:d.drawableId,meshId:d.meshId,parentPartId:d.partId,rigControlIds:[...controls],maskRelationIds:masks.map(m=>m.maskRelationId),variantRefs:(graph.variantGroups??[]).filter(v=>v.targetDrawableIds.includes(d.drawableId)).map(v=>v.variantGroupId),relatedTargets:[{kind:"drawable",id:d.drawableId},{kind:"mesh",id:d.meshId},{kind:"part",id:d.partId},{kind:"texture",id:d.textureId},{kind:"sourceAsset",id:d.sourceAssetId},...graph.keyformSets.filter(k=>k.target.id===d.drawableId).map(k=>({kind:"keyformSet",id:k.keyformSetId}))],sourceTexture,contextComposite,sourceImageToStage,sourceLayerStageBounds:{space:"rest-stage-canvas-y-down-v1",...bounds},restPose:materialRestPose});
  return {sourceContext,artifacts:[sourceTexture,contextComposite],sidecars:[sourceSidecar,context.sidecar]};
};
