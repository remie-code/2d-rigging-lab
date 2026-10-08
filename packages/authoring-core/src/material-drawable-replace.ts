import type { MaterialIntent } from "@private-2d-rigging-lab/contracts";
import type { AuthoringSession } from "./authoring-session.js";
import type { MaterialSourceMapping } from "./material-source-mapping.js";
import { resetMaterialGeometry } from "./material-geometry-reset.js";
import { createGeneratedMesh } from "./mesh-generation.js";
import { replaceDrawableMesh } from "./mesh-mutations.js";

export const replaceMaterialDrawable = (session: AuthoringSession, intent: Extract<MaterialIntent, { kind: "replace" }>, mapping: MaterialSourceMapping): void => {
  resetMaterialGeometry(session, intent);
  const drawable = session.graph.drawables.find((item) => item.drawableId === intent.drawableId)!;
  const oldMesh = session.graph.meshes.find((mesh) => mesh.meshId === drawable.meshId);
  if (oldMesh === undefined) throw new Error(`Missing mesh: ${drawable.meshId}`);
  for (const source of session.graph.sourceAssets) {
    for (const layer of source.layers) layer.mappedDrawableIds = layer.mappedDrawableIds.filter((id) => id !== drawable.drawableId);
  }
  const source = session.graph.sourceAssets.find((item) => item.sourceAssetId === mapping.sourceAssetId)!;
  source.layers.find((layer) => layer.sourceLayerId === mapping.sourceLayerId)!.mappedDrawableIds.push(drawable.drawableId);
  drawable.sourceAssetId = mapping.sourceAssetId;
  drawable.textureId = mapping.textureId;
  drawable.sourceProvenanceId = mapping.provenanceId;
  const mesh = createGeneratedMesh({ meshId: drawable.meshId, drawableId: drawable.drawableId, bounds: mapping.bounds,
    provenanceId: mapping.provenanceId, method: "auto-grid-v1", densityHint: "low" });
  mesh.topologyRevision = (oldMesh.topologyRevision ?? 0) + 1;
  replaceDrawableMesh(session, mesh);
};

