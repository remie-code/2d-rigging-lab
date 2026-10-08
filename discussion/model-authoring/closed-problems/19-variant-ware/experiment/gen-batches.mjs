// cp19 batch generator. Reads design-values.json (single source of truth for the
// membership table) and writes batch-a/b/c/d.json for run-batch.mjs.
// Order is the spec (problem-definition §操作列): membership BEFORE visibility restore.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const D = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));

const short = (drawableId) => {
  const m = drawableId.match(/_([0-9a-f]{8})_([a-z-]+)$/);
  return m ? `${m[2].replace(/-/g, "")}_${m[1].slice(0, 4)}` : drawableId.slice(-12);
};

// Batch A: hide alt bottomwear x2 FIRST (they are still baseVisible=true; generating
// a mesh while visible would change the rest render = cp18 trap), then generateMesh x2.
const batchA = [];
for (const id of D.meshGenTargets) {
  batchA.push({
    file: `hide-${short(id)}.json`,
    operationId: `op_cp19_hide_${short(id)}`,
    operationType: "setRuntimeVisibility",
    payload: { target: { kind: "drawable", id }, runtimeVisibility: false },
    gitMessage: `[cp19] hide alt bottomwear ${short(id)} before mesh gen (align with cp18 hidden-alt premise)`
  });
}
for (const id of D.meshGenTargets) {
  batchA.push({
    file: `mesh-${short(id)}.json`,
    operationId: `op_cp19_mesh_${short(id)}`,
    operationType: "generateMesh",
    payload: { drawableId: id, method: D.meshMethod, densityHint: D.meshDensityHint },
    gitMessage: `[cp19] mesh alt bottomwear ${short(id)} (static, no rigging)`
  });
}

// Batch B: group + variants.
const batchB = [
  {
    file: "create-group.json",
    operationId: "op_cp19_create_vgrp_ware",
    operationType: "createVariantGroup",
    payload: {
      variantGroupId: D.variantGroupId,
      displayName: D.groupDisplayName,
      mode: D.mode,
      initialVariantId: "var_default",
      initialVariantName: D.variants.var_default
    },
    gitMessage: "[cp19] createVariantGroup vgrp_ware (singleSelect, initial=Default)"
  },
  ...["var_rodos", "var_endoministrator"].map((variantId) => ({
    file: `create-${variantId}.json`,
    operationId: `op_cp19_create_${variantId}`,
    operationType: "createVariant",
    payload: { variantGroupId: D.variantGroupId, variantId, displayName: D.variants[variantId] },
    gitMessage: `[cp19] createVariant ${variantId} (${D.variants[variantId]})`
  }))
];

// Batch C: add all targets, then set membership (member=true in exactly one variant).
// addVariantTargetDrawable auto-creates an EMPTY membership, so exactly one
// setVariantMembership(true) per target and no no-op rejects.
const batchC = [];
const allTargets = Object.entries(D.membership).flatMap(([variantId, ids]) =>
  ids.map((id) => ({ variantId, id })));
for (const { id } of allTargets) {
  batchC.push({
    file: `target-${short(id)}.json`,
    operationId: `op_cp19_target_${short(id)}`,
    operationType: "addVariantTargetDrawable",
    payload: { variantGroupId: D.variantGroupId, drawableId: id },
    gitMessage: `[cp19] addVariantTargetDrawable ${short(id)}`
  });
}
for (const { variantId, id } of allTargets) {
  batchC.push({
    file: `member-${short(id)}.json`,
    operationId: `op_cp19_member_${short(id)}`,
    operationType: "setVariantMembership",
    payload: { variantGroupId: D.variantGroupId, drawableId: id, variantId, member: true },
    gitMessage: `[cp19] setVariantMembership ${short(id)} -> ${variantId}`
  });
}

// Batch D: restore the 8 alt-outfit visibility flags to true (AFTER membership —
// the variant gate baseVisible AND membership now hides them under Default).
const batchD = D.restoreVisibilityTargets.map((id) => ({
  file: `show-${short(id)}.json`,
  operationId: `op_cp19_show_${short(id)}`,
  operationType: "setRuntimeVisibility",
  payload: { target: { kind: "drawable", id }, runtimeVisibility: true },
  gitMessage: `[cp19] restore runtimeVisibility=true ${short(id)} (variant gate now owns hiding)`
}));

writeFileSync(join(HERE, "batch-a.json"), JSON.stringify(batchA, null, 1));
writeFileSync(join(HERE, "batch-b.json"), JSON.stringify(batchB, null, 1));
writeFileSync(join(HERE, "batch-c.json"), JSON.stringify(batchC, null, 1));
writeFileSync(join(HERE, "batch-d.json"), JSON.stringify(batchD, null, 1));
console.log(`batch-a=${batchA.length} batch-b=${batchB.length} batch-c=${batchC.length} batch-d=${batchD.length} total=${batchA.length + batchB.length + batchC.length + batchD.length}`);
