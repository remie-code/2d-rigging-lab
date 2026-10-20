import type { DrawableId, MaterialImpact, MaterialIntent, TargetRefDto } from "@private-2d-rigging-lab/contracts";
import type { KeyformSetDto } from "@private-2d-rigging-lab/package-format";
import type { AuthoringSession } from "./authoring-session.js";
import { getMaterialDirectGeometryKeyformIds } from "./material-geometry-reset.js";

export const materialParameterIds = (key: KeyformSetDto): string[] => key.evaluator === "linear-1d-v1"
  ? [key.parameterId] : [key.parameterX, key.parameterY];

/** Reachability follows the actual graph, including nested rig controls and dynamics parameter outputs. */
export const materialAffectedDrawables = (session: AuthoringSession, target: TargetRefDto, visited = new Set<string>()): DrawableId[] => {
  const token = `${target.kind}:${target.id}`;
  if (visited.has(token)) return [];
  visited.add(token);
  const graph = session.graph;
  const visit = (kind: TargetRefDto["kind"], id: string) => materialAffectedDrawables(session, { kind, id }, visited);
  let affected: DrawableId[] = [];
  if (target.kind === "drawable") affected = graph.drawables.filter((item) => item.drawableId === target.id).map((item) => item.drawableId);
  if (target.kind === "mesh") affected = graph.drawables.filter((item) => item.meshId === target.id).map((item) => item.drawableId);
  if (target.kind === "texture") affected = graph.drawables.filter((item) => item.textureId === target.id).map((item) => item.drawableId);
  if (target.kind === "rigControl") {
    const control = graph.rigControls.find((item) => item.rigControlId === target.id);
    if (control) affected = [...control.childDrawableIds, ...control.childRigControlIds.flatMap((id) => visit("rigControl", id))];
  }
  if (target.kind === "keyformSet") {
    const key = graph.keyformSets.find((item) => item.keyformSetId === target.id);
    if (key) affected = visit(key.target.kind === "mesh" || key.target.kind === "rigControl" ? key.target.kind : "drawable", key.target.id);
  }
  if (target.kind === "parameter") {
    affected = graph.keyformSets.filter((key) => materialParameterIds(key).includes(target.id)).flatMap((key) => visit("keyformSet", key.keyformSetId));
    affected.push(...graph.dynamicsGroups.filter((group) => group.inputs.some((input) => input.parameterId === target.id))
      .flatMap((group) => group.outputs.flatMap((output) => visit("parameter", output.parameterId))));
  }
  return [...new Set(affected)];
};

export const analyzeMaterialImpact = (session: AuthoringSession, intent: MaterialIntent): MaterialImpact => {
  const drawable = session.graph.drawables.find((item) => item.drawableId === intent.drawableId);
  const controls: TargetRefDto[] = session.graph.rigControls.map((item) => ({ kind: "rigControl", id: item.rigControlId }));
  const keys: TargetRefDto[] = session.graph.keyformSets.map((item) => ({ kind: "keyformSet", id: item.keyformSetId }));
  const parameters: TargetRefDto[] = session.graph.parameters.map((item) => ({ kind: "parameter", id: item.parameterId }));
  const textures: TargetRefDto[] = (session.graph.textureAtlas?.textures ?? []).map((item) => ({ kind: "texture", id: item.textureId }));
  const reset = intent.kind === "replace" && drawable ? getMaterialDirectGeometryKeyformIds(session, intent.drawableId).map((id): TargetRefDto => ({ kind: "keyformSet", id })) : [];
  const references = [...controls, ...keys, ...parameters, ...textures].map((target) => ({ target, affectedDrawableIds: materialAffectedDrawables(session, target) }));
  return { drawableId: intent.drawableId,
    preserved: drawable ? [{ kind: "drawable", id: drawable.drawableId }, { kind: "part", id: drawable.partId },
      ...references.filter((ref) => ref.affectedDrawableIds.includes(drawable.drawableId) && !reset.some((item) => item.id === ref.target.id)).map((ref) => ref.target),
      ...session.graph.masks.filter((mask) => [...mask.maskDrawableIds, ...mask.targetDrawableIds].includes(drawable.drawableId)).map((mask): TargetRefDto => ({ kind: "maskRelation", id: mask.maskRelationId }))] : [],
    reset: [...reset, ...(drawable ? [{ kind: "mesh" as const, id: drawable.meshId }] : [])], created: [],
    sharedReferences: references.filter((ref) => ref.affectedDrawableIds.includes(intent.drawableId) && ref.affectedDrawableIds.some((id) => id !== intent.drawableId)),
    refusedDeletions: [], existingDeformersChanged: false };
};
