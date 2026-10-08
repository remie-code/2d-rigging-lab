import type { MaterialIntent, DrawableId, KeyformSetId } from "@private-2d-rigging-lab/contracts";
import type { AuthoringSession } from "./authoring-session.js";

export const getMaterialDirectGeometryKeyformIds = (session: AuthoringSession, drawableId: DrawableId): KeyformSetId[] => {
  const drawable = session.graph.drawables.find((item) => item.drawableId === drawableId);
  if (drawable === undefined) throw new Error(`Missing drawable: ${drawableId}`);
  return session.graph.keyformSets.filter((key) =>
    (key.target.kind === "mesh" && key.target.id === drawable.meshId) ||
    (key.target.kind === "drawable" && key.target.id === drawableId && key.target.property === "vertices")
  ).map((key) => key.keyformSetId);
};

export const resetMaterialGeometry = (session: AuthoringSession, intent: Extract<MaterialIntent, { kind: "replace" }>): void => {
  const actual = getMaterialDirectGeometryKeyformIds(session, intent.drawableId);
  const declared = intent.geometryReset.keyformSetIds;
  if (new Set(declared).size !== declared.length || actual.length !== declared.length || actual.some((id) => !declared.includes(id))) {
    throw new Error(`Geometry reset must name exactly the direct geometry keyforms: ${actual.join(", ")}`);
  }
  const drawable = session.graph.drawables.find((item) => item.drawableId === intent.drawableId)!;
  if (session.graph.drawables.some((item) => item.drawableId !== intent.drawableId && item.meshId === drawable.meshId)) {
    throw new Error("Cannot reset shared mesh geometry.");
  }
  session.graph.keyformSets = session.graph.keyformSets.filter((key) => !actual.includes(key.keyformSetId));
  session.graph.stableOrder = session.graph.stableOrder.filter((id) => !actual.includes(id as KeyformSetId));
};
