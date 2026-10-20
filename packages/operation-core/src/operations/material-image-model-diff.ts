import type { AuthoringSession, MaterialImageAssetPlan } from "@private-2d-rigging-lab/authoring-core";
import type { MaterialAddIntent, MaterialImpact, MaterialReplaceIntent, ModelDiffDto, OperationId, TargetRefDto } from "@private-2d-rigging-lab/contracts";

import { toModelDiffJsonValue } from "./model-diff-json-value.js";

type FieldChange = ModelDiffDto["changed"][number]["fields"][number];

export const createMaterialImageModelDiff = (input: {
  readonly operationId: OperationId;
  readonly before: AuthoringSession;
  readonly after: AuthoringSession;
  readonly intent: MaterialAddIntent | MaterialReplaceIntent;
  readonly impact: MaterialImpact;
  readonly assets: MaterialImageAssetPlan;
}): ModelDiffDto => {
  const { before, after, intent, assets } = input;
  const changed: ModelDiffDto["changed"] = [];
  const change = (target: TargetRefDto, fields: FieldChange[]): void => {
    if (fields.length > 0) changed.push({ target, fields });
  };
  const created: TargetRefDto[] = [
    { kind: "sourceAsset", id: assets.sourceAssetId },
    { kind: "texture", id: assets.textureId },
    ...(intent.kind === "add" ? [{ kind: "drawable", id: intent.drawableId }, { kind: "mesh", id: assets.meshId }] as const : [])
  ];
  change({ kind: "sourceAsset", id: assets.sourceAssetId }, [{ path: `/assets/sourceManifest/sourceAssets/${assets.sourceAssetId}`, before: null,
    after: toModelDiffJsonValue(after.graph.sourceAssets.find((item) => item.sourceAssetId === assets.sourceAssetId) ?? null) }]);
  change({ kind: "texture", id: assets.textureId }, [{ path: `/model/textureAtlas/textures/${assets.textureId}`, before: null,
    after: toModelDiffJsonValue(after.graph.textureAtlas?.textures.find((item) => item.textureId === assets.textureId) ?? null) }]);

  const drawableBefore = before.graph.drawables.find((item) => item.drawableId === intent.drawableId);
  const drawableAfter = after.graph.drawables.find((item) => item.drawableId === intent.drawableId)!;
  change({ kind: "drawable", id: intent.drawableId }, [{ path: `/model/drawables/${intent.drawableId}`,
    before: drawableBefore === undefined ? null : toModelDiffJsonValue(drawableBefore), after: toModelDiffJsonValue(drawableAfter) }]);
  const meshBefore = before.graph.meshes.find((item) => item.meshId === drawableAfter.meshId);
  const meshAfter = after.graph.meshes.find((item) => item.meshId === drawableAfter.meshId);
  change({ kind: "mesh", id: drawableAfter.meshId }, [{ path: `/model/meshes/${drawableAfter.meshId}`,
    before: meshBefore === undefined ? null : toModelDiffJsonValue(meshBefore), after: toModelDiffJsonValue(meshAfter ?? null) }]);

  if (intent.kind === "add") {
    const partBefore = before.graph.parts.find((item) => item.partId === intent.parentPartId);
    const partAfter = after.graph.parts.find((item) => item.partId === intent.parentPartId);
    change({ kind: "part", id: intent.parentPartId }, [{ path: `/model/graph/parts/${intent.parentPartId}`,
      before: toModelDiffJsonValue(partBefore ?? null), after: toModelDiffJsonValue(partAfter ?? null) }]);
    for (const rigControlId of intent.rigControlIds) {
      change({ kind: "rigControl", id: rigControlId }, [{ path: `/model/rigControls/${rigControlId}/childDrawableIds`,
        before: toModelDiffJsonValue(before.graph.rigControls.find((item) => item.rigControlId === rigControlId)?.childDrawableIds ?? null),
        after: toModelDiffJsonValue(after.graph.rigControls.find((item) => item.rigControlId === rigControlId)?.childDrawableIds ?? null) }]);
    }
    for (const binding of intent.maskBindings) {
      change({ kind: "maskRelation", id: binding.maskRelationId }, [{ path: `/model/masks/${binding.maskRelationId}`,
        before: toModelDiffJsonValue(before.graph.masks.find((item) => item.maskRelationId === binding.maskRelationId) ?? null),
        after: toModelDiffJsonValue(after.graph.masks.find((item) => item.maskRelationId === binding.maskRelationId) ?? null) }]);
    }
  }
  const drawOrderBefore = before.graph.drawOrder.map((entry) => entry.drawableId);
  const drawOrderAfter = after.graph.drawOrder.map((entry) => entry.drawableId);
  if (JSON.stringify(drawOrderBefore) !== JSON.stringify(drawOrderAfter)) {
    change({ kind: "package", id: after.packageIdentity.packageId }, [{ path: "/model/drawOrder/entries",
      before: toModelDiffJsonValue(drawOrderBefore), after: toModelDiffJsonValue(drawOrderAfter) }]);
  }

  return {
    schemaVersion: "model-diff-v1",
    baseRevision: before.authoringRevision,
    candidateRevision: after.authoringRevision,
    added: created,
    removed: input.impact.reset.filter((target) => target.kind === "keyformSet"),
    changed,
    operationIds: [input.operationId]
  };
};
