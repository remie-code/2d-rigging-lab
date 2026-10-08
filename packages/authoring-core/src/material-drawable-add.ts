import type { MaterialIntent } from "@private-2d-rigging-lab/contracts";
import type { AuthoringSession } from "./authoring-session.js";
import type { MaterialSourceMapping } from "./material-source-mapping.js";
import { createDrawableWithMesh } from "./drawable-mutations.js";
import { createGeneratedMesh } from "./mesh-generation.js";
import { setMaskRelation } from "./mask-relation-mutations.js";
import { bindRigControlChild } from "./rig-control-mutations.js";
import { getPartOrderedChildren, insertPartOrderedChild, partChildEntriesEqual, syncDrawOrderToPartOrder } from "./part-children-order.js";

export const addMaterialDrawable = (session: AuthoringSession, intent: Extract<MaterialIntent, { kind: "add" }>, mapping: MaterialSourceMapping): void => {
  const part = session.graph.parts.find((item) => item.partId === intent.parentPartId);
  if (part === undefined) throw new Error(`Missing parent Part: ${intent.parentPartId}`);
  const children = getPartOrderedChildren(session.graph, part);
  let index = intent.insertion.position === "first" ? 0 : children.length;
  if ("sibling" in intent.insertion) {
    const sibling = intent.insertion.sibling;
    index = children.findIndex((child) => partChildEntriesEqual(child, sibling));
    if (index < 0) throw new Error("Insertion sibling must be a direct child of the chosen Part.");
    if (intent.insertion.position === "after") index++;
  }
  if (new Set(intent.rigControlIds).size !== intent.rigControlIds.length || intent.rigControlIds.length > 1) {
    throw new Error("Existing rig graph requires at most one direct parent per drawable.");
  }
  createDrawableWithMesh(session, { drawable: { drawableId: intent.drawableId, displayName: intent.displayName,
    partId: intent.parentPartId, sourceAssetId: mapping.sourceAssetId, textureId: mapping.textureId, meshId: mapping.meshId,
    defaultOpacity: intent.defaultOpacity, runtimeVisibility: intent.runtimeVisibility, baseDrawOrder: 0, sourceProvenanceId: mapping.provenanceId },
    sourceLayerId: mapping.sourceLayerId,
    mesh: createGeneratedMesh({ meshId: mapping.meshId, drawableId: intent.drawableId, bounds: mapping.bounds,
      provenanceId: mapping.provenanceId, method: "auto-grid-v1", densityHint: "low" }) });
  insertPartOrderedChild(session.graph, part, { kind: "drawable", drawableId: intent.drawableId }, index);
  syncDrawOrderToPartOrder(session.graph);
  for (const parentRigControlId of intent.rigControlIds) {
    bindRigControlChild(session, { parentRigControlId, child: { kind: "drawable", id: intent.drawableId } });
  }
  const bindings = new Set<string>();
  for (const binding of intent.maskBindings) {
    if (bindings.has(binding.maskRelationId)) throw new Error("Duplicate or conflicting mask binding.");
    bindings.add(binding.maskRelationId);
    const mask = session.graph.masks.find((item) => item.maskRelationId === binding.maskRelationId);
    if (mask === undefined) throw new Error(`Missing mask relation: ${binding.maskRelationId}`);
    if (mask.maskDrawableIds.some((id) => !session.graph.drawables.some((draw) => draw.drawableId === id)) ||
        mask.targetDrawableIds.some((id) => !session.graph.drawables.some((draw) => draw.drawableId === id))) {
      throw new Error("Mask relation references missing drawables.");
    }
    setMaskRelation(session, { maskRelationId: mask.maskRelationId, enabled: mask.enabled,
      maskDrawableIds: [...mask.maskDrawableIds, ...(binding.role === "maskSource" ? [intent.drawableId] : [])],
      targetDrawableIds: [...mask.targetDrawableIds, ...(binding.role === "target" ? [intent.drawableId] : [])] });
  }
};

