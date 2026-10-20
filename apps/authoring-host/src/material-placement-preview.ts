import { randomUUID } from "node:crypto";
import { cloneAuthoringSession, flattenDrawableIdsByPartOrder, getPartOrderedChildren, setPartOrderedChildren, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { MaterialIntentSchema, MaterialPlacementSchema, type MaterialCoordinateSidecar, type MaterialImageArtifact, type MaterialIntent,
  type MaterialNormalizedImage, type MaterialPlacement } from "@private-2d-rigging-lab/contracts";
import { DrawableSchema, MeshSchema } from "@private-2d-rigging-lab/package-format";
import { createRenderScene, type RenderDrawable, type RenderMesh } from "@private-2d-rigging-lab/render-core";
import { renderSceneToPng } from "@private-2d-rigging-lab/render-software";
import { createMaterialRestScene } from "./material-render-context.js";
import { materialRestPose, materialSessionPackageRef, materialSoftwareView, materialViewportMapping, writeMaterialArtifact, type MaterialViewport } from "./material-render-artifact.js";
import { verifyMaterialImage } from "./material-image-decode.js";
import { materialRestOpacities } from "./material-rest-opacity.js";
import { HostError } from "./host-error.js";

export interface RenderMaterialPlacementPreviewInput {
  readonly session: AuthoringSession;
  readonly intent: MaterialIntent;
  readonly placement: MaterialPlacement;
  readonly image: MaterialNormalizedImage;
  readonly viewport: MaterialViewport;
  readonly packageDirectory: string;
  readonly artifactDirectory: string;
}

/**
 * Read-only "try placing it" render before any mesh exists: the full image alpha is drawn as one quad at `placement`,
 * in the structural order the add/replace intent would produce, with existing masks applied. Never changes `session`.
 */
export const renderMaterialPlacementPreview = async (input: RenderMaterialPlacementPreviewInput): Promise<{ artifact: MaterialImageArtifact; sidecar: MaterialCoordinateSidecar }> => {
  const packageRef = materialSessionPackageRef(input.session);
  const intent = MaterialIntentSchema.parse(input.intent), placement = MaterialPlacementSchema.parse(input.placement);
  verifyMaterialImage(input.image);
  const descriptor = input.image.descriptor;
  if (descriptor.alpha.nonTransparentPixelCount === 0) throw new HostError("empty-alpha", "Image contains no drawable alpha.");
  const original = createMaterialRestScene(input.session), session = cloneAuthoringSession(input.session);
  const textureId = `material_preview_${randomUUID()}`, id = intent.drawableId;
  let context: RenderDrawable;
  if (intent.kind === "replace") {
    const old = original.drawables.find(d => d.drawableId === id);
    if (!old) throw new HostError("missing-drawable", "Replacement drawable does not exist.");
    context = old;
  } else {
    if (session.graph.drawables.some(d => d.drawableId === id)) throw new HostError("drawable-id-collision", "Added drawable ID already exists.");
    const parent = session.graph.parts.find(p => p.partId === intent.parentPartId);
    if (!parent) throw new HostError("missing-parent-part", "Added drawable parent Part does not exist.");
    if (intent.rigControlIds.some(rigId => !session.graph.rigControls.some(r => r.rigControlId === rigId))) throw new HostError("missing-rig-control", "Added drawable rig binding does not exist.");
    const children = [...getPartOrderedChildren(session.graph, parent)], insertion = intent.insertion;
    let index = insertion.position === "first" ? 0 : children.length;
    if (insertion.position === "before" || insertion.position === "after") {
      const sibling = insertion.sibling;
      index = children.findIndex(c => c.kind === sibling.kind && (c.kind === "part" && sibling.kind === "part" ? c.partId === sibling.partId : c.kind === "drawable" && sibling.kind === "drawable" && c.drawableId === sibling.drawableId));
      if (index < 0) throw new HostError("missing-structural-sibling", "Insertion sibling is not a direct child of the specified Part.");
      if (insertion.position === "after") index++;
    }
    children.splice(index, 0, { kind: "drawable", drawableId: id }); setPartOrderedChildren(parent, children);
    const previewMeshId = MeshSchema.shape.meshId.parse(`mesh_material_preview_${randomUUID().replaceAll("-", "")}`);
    session.graph.drawables.push(DrawableSchema.parse({ drawableId: id, partId: intent.parentPartId, displayName: intent.displayName, sourceAssetId: "src_material_preview",
      textureId: "tex_material_preview", meshId: previewMeshId, sourceProvenanceId: "prov_material_preview", defaultOpacity: intent.defaultOpacity,
      runtimeVisibility: intent.runtimeVisibility, baseDrawOrder: 0 }));
    session.graph.meshes.push(MeshSchema.parse({ meshId: previewMeshId, drawableId: id, vertices: [], uvs: [], triangles: [], vertexStableIds: [], bounds: { x: 0, y: 0, width: 1, height: 1 }, generationProvenanceId: "prov_material_preview" }));
    for (const rigId of intent.rigControlIds) session.graph.rigControls.find(r => r.rigControlId === rigId)!.childDrawableIds.push(id);
    const opacity = materialRestOpacities(session).get(id) ?? intent.defaultOpacity;
    const maskDrawableIds: string[] = [];
    for (const binding of intent.maskBindings) {
      const mask = session.graph.masks.find(m => m.maskRelationId === binding.maskRelationId);
      if (!mask) throw new HostError("missing-mask-relation", "Added drawable mask binding does not exist.");
      if (!mask.enabled) continue;
      if (binding.role === "target") maskDrawableIds.push(...mask.maskDrawableIds);
    }
    context = { drawableId: id, textureRef: { textureId }, mesh: { coordinateSpace: "stage", uvSpace: "layer-local-top-left-0-1-v1", vertices: [], uvs: [], triangles: [] },
      opacity, visible: intent.runtimeVisibility, drawOrder: 0, stableIndex: 0, blendMode: "normal-premultiplied-alpha-v0",
      ...(maskDrawableIds.length ? { clipping: { mode: "drawable-alpha-mask-v0" as const, maskDrawableIds: [...new Set(maskDrawableIds)] } } : {}) };
  }
  const { width, height } = descriptor, { scale, translation } = placement;
  const mesh: RenderMesh = { coordinateSpace: "stage", uvSpace: "layer-local-top-left-0-1-v1",
    vertices: [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => ({ x: translation.x + scale * x!, y: translation.y + scale * y! })),
    uvs: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], triangles: [[0, 1, 2], [0, 2, 3]] };
  const order = flattenDrawableIdsByPartOrder(session.graph);
  let drawables = [...original.drawables.filter(d => d.drawableId !== id), { ...context, textureRef: { textureId }, mesh }];
  if (intent.kind === "add") {
    for (const binding of intent.maskBindings.filter(b => b.role === "maskSource")) {
      const mask = session.graph.masks.find(m => m.maskRelationId === binding.maskRelationId)!;
      if (mask.enabled) drawables = drawables.map(d => mask.targetDrawableIds.some(t => t === d.drawableId) ? { ...d, clipping: { mode: "drawable-alpha-mask-v0", maskDrawableIds: [...new Set([...(d.clipping?.maskDrawableIds ?? []), id])] } } : d);
    }
  }
  drawables = drawables.map(d => ({ ...d, drawOrder: order.findIndex(i => i === d.drawableId), stableIndex: order.findIndex(i => i === d.drawableId) }));
  const scene = createRenderScene({ drawables, textureSources: [...original.textureSources, { kind: "rgba8", textureId, width, height,
    bytes: new Uint8Array(input.image.rgbaBytes), alphaMode: "straight", contentSignature: descriptor.rgbaSha256 }] });
  const sidecar: MaterialCoordinateSidecar = { schemaVersion: "material-coordinate-sidecar-v1", kind: "placement-alpha-preview", packageRef,
    viewport: input.viewport, imageToStage: materialViewportMapping(input.viewport), materialPlacement: placement, materialRgbaSha256: descriptor.rgbaSha256,
    restPose: materialRestPose, coverage: "full-alpha-no-old-mesh-clip" };
  const artifact = await writeMaterialArtifact({ packageDirectory: input.packageDirectory, artifactDirectory: input.artifactDirectory,
    png: renderSceneToPng(scene, materialSoftwareView(input.viewport)).png, sidecar });
  return { artifact, sidecar };
};
