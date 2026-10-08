import { createVariantVisibilityPredicate, flattenDrawableIdsByPartOrder, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { createRenderScene, type RenderScene, type RenderDrawable } from "@private-2d-rigging-lab/render-core";
import { resolveRenderTextureSources } from "./perception/texture-resolution.js";
import { materialRestOpacities } from "./material-rest-opacity.js";
import { MaterialHostError } from "./material-host-error.js";
/** An undeformed rest scene: authored mesh vertices, no keyforms, no dynamics. */
export const createMaterialRestScene = (session:AuthoringSession):RenderScene => {
  const graph=session.graph;
  if(graph.coordinateSystem!=="canvas-y-down-v1") throw new MaterialHostError("unsupported-stage-space","Expected canvas-y-down-v1.");
  const order=flattenDrawableIdsByPartOrder(graph), visibility=createVariantVisibilityPredicate({variantGroups:graph.variantGroups??[]});
  const drawableIds=new Set(graph.drawables.map(d=>d.drawableId));
  for(const mask of graph.masks.filter(m=>m.enabled)) {
    if([...mask.maskDrawableIds,...mask.targetDrawableIds].some(id=>!drawableIds.has(id))) throw new MaterialHostError("unresolved-mask","Mask references missing drawables.");
  }
  const opacities=materialRestOpacities(session);
  const textures=resolveRenderTextureSources({session,textureIds:graph.drawables.map(d=>d.textureId)});
  const drawables:RenderDrawable[]=graph.drawables.map(d=>{
    const mesh=graph.meshes.find(m=>m.meshId===d.meshId);
    const texture=textures.find(t=>t.textureId===d.textureId)!;
    if(!mesh || mesh.vertices.length!==mesh.uvs.length || mesh.triangles.some(t=>t.some(i=>i<0||i>=mesh.vertices.length))) throw new MaterialHostError("invalid-rest-mesh",`Invalid mesh for ${d.drawableId}.`);
    const inset=graph.textureAtlas?.textures.find(t=>t.textureId===d.textureId)?.contentInset??{left:0,right:0,top:0,bottom:0};
    const cw=texture.width-inset.left-inset.right,ch=texture.height-inset.top-inset.bottom;
    if(cw<=0||ch<=0) throw new MaterialHostError("invalid-content-inset","Texture padding removes the content region.");
    const maskDrawableIds=[...new Set(graph.masks.filter(m=>m.enabled&&m.targetDrawableIds.includes(d.drawableId)).flatMap(m=>m.maskDrawableIds))];
    return { drawableId:d.drawableId,textureRef:{textureId:d.textureId},
      mesh:{coordinateSpace:"stage",uvSpace:"layer-local-top-left-0-1-v1",vertices:mesh.vertices,uvs:mesh.uvs.map(uv=>({x:(inset.left+uv.x*cw)/texture.width,y:(inset.top+uv.y*ch)/texture.height})),triangles:mesh.triangles},
      opacity:opacities.get(d.drawableId)??d.defaultOpacity,visible:d.runtimeVisibility&&visibility(d.drawableId),drawOrder:order.indexOf(d.drawableId),stableIndex:order.indexOf(d.drawableId),blendMode:"normal-premultiplied-alpha-v0",
      ...(maskDrawableIds.length?{clipping:{mode:"drawable-alpha-mask-v0" as const,maskDrawableIds}}:{}) };
  });
  return createRenderScene({textureSources:textures,drawables});
};

