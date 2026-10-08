import { randomUUID } from "node:crypto";
import { cloneAuthoringSession, flattenDrawableIdsByPartOrder, getPartOrderedChildren, setPartOrderedChildren, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { MaterialCandidateSchema, type MaterialCandidate, type MaterialNormalizedImage, type MaterialCoordinateSidecar, type MaterialImageArtifact } from "@private-2d-rigging-lab/contracts";
import { DrawableSchema, MeshSchema } from "@private-2d-rigging-lab/package-format";
import { createRenderScene, type RenderDrawable, type RenderMesh } from "@private-2d-rigging-lab/render-core";
import { renderSceneToPng } from "@private-2d-rigging-lab/render-software";
import { createMaterialRestScene } from "./material-render-context.js";
import { assertMaterialSessionVersion, materialRestPose, materialSoftwareView, materialViewportMapping, writeMaterialArtifact, type MaterialViewport } from "./material-render-artifact.js";
import { verifyMaterialImage } from "./material-image-decode.js";
import { materialRestOpacities } from "./material-rest-opacity.js";
import { MaterialHostError } from "./material-host-error.js";
export interface RenderMaterialPlacementPreviewInput { session:AuthoringSession;candidate:MaterialCandidate;image:MaterialNormalizedImage;viewport:MaterialViewport;basePackageDirectory:string;artifactDirectory:string }
export const renderMaterialPlacementPreview = async (input:RenderMaterialPlacementPreviewInput):Promise<{artifact:MaterialImageArtifact;sidecar:MaterialCoordinateSidecar}> => {
  const candidate=MaterialCandidateSchema.parse(input.candidate);
  if(candidate.state==="discarded") throw new MaterialHostError("discarded-candidate","Discarded candidates cannot be previewed.");
  assertMaterialSessionVersion(input.session,candidate.basePackage); verifyMaterialImage(input.image);
  if(JSON.stringify(input.image.descriptor)!==JSON.stringify(candidate.image)) throw new MaterialHostError("candidate-image-mismatch","Preview image differs from registered candidate.");
  if(candidate.image.alpha.nonTransparentPixelCount===0) throw new MaterialHostError("empty-alpha","Candidate contains no drawable alpha.");
  const original=createMaterialRestScene(input.session),session=cloneAuthoringSession(input.session),intent=candidate.intent;
  const textureId=`material_preview_${randomUUID()}`,id=intent.drawableId;
  let context:RenderDrawable;
  if(intent.kind==="replace") {
    const old=original.drawables.find(d=>d.drawableId===id);
    if(!old) throw new MaterialHostError("missing-drawable","Replacement drawable does not exist.");
    context=old;
  } else {
    if(session.graph.drawables.some(d=>d.drawableId===id)) throw new MaterialHostError("drawable-id-collision","Added drawable ID already exists.");
    const parent=session.graph.parts.find(p=>p.partId===intent.parentPartId);
    if(!parent) throw new MaterialHostError("missing-parent-part","Added drawable parent Part does not exist.");
    if(intent.rigControlIds.some(id=>!session.graph.rigControls.some(r=>r.rigControlId===id))) throw new MaterialHostError("missing-rig-control","Added drawable rig binding does not exist.");
    const children=[...getPartOrderedChildren(session.graph,parent)], insertion=intent.insertion;
    let index=insertion.position==="first"?0:children.length;
    if(insertion.position==="before"||insertion.position==="after") {
      const sibling=insertion.sibling;
      index=children.findIndex(c=>c.kind===sibling.kind&&(c.kind==="part"&&sibling.kind==="part"?c.partId===sibling.partId:c.kind==="drawable"&&sibling.kind==="drawable"&&c.drawableId===sibling.drawableId));
      if(index<0) throw new MaterialHostError("missing-structural-sibling","Insertion sibling is not a direct child of the specified Part.");
      if(insertion.position==="after") index++;
    }
    children.splice(index,0,{kind:"drawable",drawableId:id}); setPartOrderedChildren(parent,children);
    session.graph.drawables.push(DrawableSchema.parse({drawableId:id,partId:intent.parentPartId,displayName:intent.displayName,sourceAssetId:"src_material_preview",textureId:"tex_material_preview",meshId:"mesh_material_preview",sourceProvenanceId:"prov_material_preview",defaultOpacity:intent.defaultOpacity,runtimeVisibility:intent.runtimeVisibility,baseDrawOrder:0}));
    const previewMeshId=`mesh_material_preview_${randomUUID().replaceAll("-", "")}`;
    session.graph.drawables[session.graph.drawables.length-1]!.meshId=MeshSchema.shape.meshId.parse(previewMeshId);
    session.graph.meshes.push(MeshSchema.parse({meshId:previewMeshId,drawableId:id,vertices:[],uvs:[],triangles:[],vertexStableIds:[],bounds:{x:0,y:0,width:1,height:1},generationProvenanceId:"prov_material_preview"}));
    for(const rigId of intent.rigControlIds) session.graph.rigControls.find(r=>r.rigControlId===rigId)!.childDrawableIds.push(id);
    const opacity=materialRestOpacities(session).get(id)??intent.defaultOpacity;
    const maskDrawableIds:string[]=[];
    for(const binding of intent.maskBindings) {
      const mask=session.graph.masks.find(m=>m.maskRelationId===binding.maskRelationId);
      if(!mask) throw new MaterialHostError("missing-mask-relation","Added drawable mask binding does not exist.");
      if(!mask.enabled) continue;
      if(binding.role==="target") maskDrawableIds.push(...mask.maskDrawableIds);
    }
    context={drawableId:id,textureRef:{textureId},mesh:{coordinateSpace:"stage",uvSpace:"layer-local-top-left-0-1-v1",vertices:[],uvs:[],triangles:[]},opacity,visible:intent.runtimeVisibility,drawOrder:0,stableIndex:0,blendMode:"normal-premultiplied-alpha-v0",...(maskDrawableIds.length?{clipping:{mode:"drawable-alpha-mask-v0" as const,maskDrawableIds:[...new Set(maskDrawableIds)]}}:{})};
  }
  const {width,height}=candidate.image,{scale,translation}=candidate.placement;
  const mesh:RenderMesh={coordinateSpace:"stage",uvSpace:"layer-local-top-left-0-1-v1",vertices:[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>({x:translation.x+scale*x!,y:translation.y+scale*y!})),uvs:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],triangles:[[0,1,2],[0,2,3]]};
  const order=flattenDrawableIdsByPartOrder(session.graph);
  let drawables=[...original.drawables.filter(d=>d.drawableId!==id),{...context,textureRef:{textureId},mesh}];
  if(intent.kind==="add") {
    for(const binding of intent.maskBindings.filter(b=>b.role==="maskSource")) {
      const mask=session.graph.masks.find(m=>m.maskRelationId===binding.maskRelationId)!;
      if(mask.enabled) drawables=drawables.map(d=>mask.targetDrawableIds.some(t=>t===d.drawableId)?{...d,clipping:{mode:"drawable-alpha-mask-v0",maskDrawableIds:[...new Set([...(d.clipping?.maskDrawableIds??[]),id])]}}:d);
    }
  }
  drawables=drawables.map(d=>({...d,drawOrder:order.findIndex(i=>i===d.drawableId),stableIndex:order.findIndex(i=>i===d.drawableId)}));
  const scene=createRenderScene({drawables,textureSources:[...original.textureSources,{kind:"rgba8",textureId,width,height,bytes:new Uint8Array(input.image.rgbaBytes),alphaMode:"straight",contentSignature:candidate.image.rgbaSha256}]});
  const sidecar:MaterialCoordinateSidecar={schemaVersion:"material-coordinate-sidecar-v1",kind:"placement-alpha-preview",candidateId:candidate.candidateId,candidateRevision:candidate.candidateRevision,packageVersion:candidate.basePackage,viewport:input.viewport,imageToStage:materialViewportMapping(input.viewport),materialPlacement:candidate.placement,restPose:materialRestPose,coverage:"full-alpha-no-old-mesh-clip"};
  const artifact=await writeMaterialArtifact({...input,png:renderSceneToPng(scene,materialSoftwareView(input.viewport)).png,sidecar});
  return {artifact,sidecar};
};

