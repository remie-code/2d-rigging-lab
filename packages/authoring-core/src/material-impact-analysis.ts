import type { DrawableId, MaterialImpact, MaterialIntent, TargetRefDto } from "@private-2d-rigging-lab/contracts";
import type { KeyformSetDto, RigControlDto } from "@private-2d-rigging-lab/package-format";
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

import type { DiagnosticDto } from "@private-2d-rigging-lab/contracts";
import { materialDiagnostic, materialEqual } from "./material-validation.js";

export interface MaterialCandidateOperationGuardResult {
  readonly allowed: boolean;
  readonly impact: MaterialImpact;
  readonly diagnostics: DiagnosticDto[];
}

/**
 * Run the normal operation on a deep clone, then call this guard with before/after.
 * Adopt or save that clone ONLY when allowed=true and the normal operation succeeded.
 * Revisions/dirty are operation bookkeeping; the package identity and protected graph/bytes
 * must stay intact. This is a scope guard, not a replacement for normal operation validation.
 */
export const guardMaterialCandidateOperation = (
  before: AuthoringSession, after: AuthoringSession, drawableId: DrawableId
): MaterialCandidateOperationGuardResult => {
  const impact = analyzeMaterialImpact(before, { kind: "replace", drawableId, preserveLogicalDrawableId: true,
    geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds: [] }, preserveExistingDeformers: true,
    sharedControlPolicy: "reject-shared-control-key-parameter-deletion" });
  // A guard does not claim that a rebuild or its reset has taken place.
  impact.reset = [];
  const diagnostics: DiagnosticDto[] = [];
  const reject = (target: TargetRefDto, message: string) => diagnostics.push(materialDiagnostic("operationScope", message, target));
  const target = before.graph.drawables.find((item) => item.drawableId === drawableId);
  if (!target || !after.graph.drawables.some((item) => item.drawableId === drawableId)) {
    reject({ kind: "drawable", id: drawableId }, "Candidate target must exist before and after the operation.");
  }
  const allowedIds = new Set<string>([drawableId, ...(target ? [target.meshId] : [])]);
  const dedicatedControl = (id: string): boolean => {
    const affected = [...materialAffectedDrawables(before, { kind: "rigControl", id }), ...materialAffectedDrawables(after, { kind: "rigControl", id })];
    return affected.length > 0 && affected.every((item) => item === drawableId);
  };
  const protectedControlProjection = (control: RigControlDto) => ({ ...control,
    childDrawableIds: control.childDrawableIds.filter((id) => id !== drawableId),
    childRigControlIds: control.childRigControlIds.filter((id) => !dedicatedControl(id))
  });
  const checkScoped = <T>(kind: TargetRefDto["kind"], oldItems: T[], newItems: T[], idOf: (item: T) => string): void => {
    const ids = new Set([...oldItems.map(idOf), ...newItems.map(idOf)]);
    for (const id of ids) {
      const old = oldItems.find((item) => idOf(item) === id);
      const next = newItems.find((item) => idOf(item) === id);
      const ref = { kind, id };
      const affected = [...new Set([...materialAffectedDrawables(before, ref), ...materialAffectedDrawables(after, ref)])];
      // New empty controls/parameters are allowed as the first step of ordinary rig creation.
      const dedicated = affected.length > 0 && affected.every((item) => item === drawableId);
      const newEmpty = old === undefined && affected.length === 0 && (kind === "rigControl" || kind === "parameter");
      if (dedicated || newEmpty) allowedIds.add(id);
      if (materialEqual(old, next)) continue;
      // Ordinary delete/wrap/rebind may reconnect a target-only branch under a shared
      // ancestor. Its other edges, ordering, parent and all deformation fields are fixed.
      const targetOnlyEdges = kind === "rigControl" && old !== undefined && next !== undefined && affected.includes(drawableId) &&
        materialEqual(protectedControlProjection(old as RigControlDto), protectedControlProjection(next as RigControlDto));
      if (!dedicated && !newEmpty && !targetOnlyEdges) {
        reject(ref, `Operation changes an unrelated or shared ${kind}: ${id}`);
        if (next === undefined && affected.length > 0) impact.refusedDeletions.push({ target: ref, affectedDrawableIds: affected, reason: "shared-control-key-parameter" });
      }
      if (old === undefined && (dedicated || newEmpty)) impact.created.push(ref);
      if (kind === "parameter" && next === undefined && after.graph.dynamicsGroups.some((group) =>
          [...group.inputs, ...group.outputs].some((entry) => entry.parameterId === id))) reject(ref, "Parameter is still referenced by dynamics.");
    }
  };
  checkScoped("rigControl", before.graph.rigControls, after.graph.rigControls, (item) => item.rigControlId);
  checkScoped("keyformSet", before.graph.keyformSets, after.graph.keyformSets, (item) => item.keyformSetId);
  checkScoped("parameter", before.graph.parameters, after.graph.parameters, (item) => item.parameterId);
  const protect = (a: unknown, b: unknown, kind: TargetRefDto["kind"], id: string) => {
    if (!materialEqual(a, b)) reject({ kind, id }, `Operation changes protected ${id}.`);
  };
  protect(before.packageIdentity, after.packageIdentity, "package", before.packageIdentity.packageId);
  protect(before.graph.drawables, after.graph.drawables, "drawable", drawableId);
  protect(before.graph.meshes.filter((item) => item.meshId !== target?.meshId), after.graph.meshes.filter((item) => item.meshId !== target?.meshId), "mesh", "other-meshes");
  if (target && (after.graph.meshes.filter((item) => item.meshId === target.meshId).length !== 1 ||
      after.graph.meshes.find((item) => item.meshId === target.meshId)?.drawableId !== drawableId)) reject({ kind: "mesh", id: target.meshId }, "Target mesh identity must be preserved.");
  for (const field of ["coordinateSystem", "canvasSize", "parts", "sourceAssets", "textureAtlas", "masks", "drawOrder", "variantGroups", "dynamicsGroups", "rightsRecords"] as const) {
    protect(before.graph[field], after.graph[field], "package", field);
  }
  protect(before.binaryAssets, after.binaryAssets, "package", "binaryAssets");
  // Mesh generation can add provenance, but cannot rewrite/delete an existing record.
  for (const record of before.graph.provenanceRecords) protect(record, after.graph.provenanceRecords.find((item) => item.provenanceId === record.provenanceId), "sourceAsset", record.assetId);
  protect(before.graph.rigControlRootIds.filter((id) => !allowedIds.has(id)), after.graph.rigControlRootIds.filter((id) => !allowedIds.has(id)), "rigControl", "protected-root-order");
  protect(before.graph.stableOrder.filter((id) => !allowedIds.has(id)), after.graph.stableOrder.filter((id) => !allowedIds.has(id)), "package", "protected-stable-order");
  return { allowed: diagnostics.length === 0, impact, diagnostics };
};
