// cp19b verification 4: no-harm. snapshot-pre-addendum vs snapshot-post-addendum.
// Allowed deltas (everything else must be byte-identical):
//   keyformSets: none
//   rigControls: +2 new (rig_bottoms_static, rig_endomi_back_carrier);
//                rig_bodyz_upper_body childRigControlIds gains rig_endomi_back_carrier (only)
//   meshes: the 4 generateMesh targets (empty -> real)
//   drawables: endomi_back runtimeVisibility false -> true (only)
//   files: rig-controls.json, meshes.json, variants.json, drawables.json, graph.json, editor-state.json
import { readFileSync } from "node:fs";
const pre = JSON.parse(readFileSync(new URL("./snapshot-pre-addendum.json", import.meta.url), "utf8"));
const post = JSON.parse(readFileSync(new URL("./snapshot-post-addendum.json", import.meta.url), "utf8"));
const A = JSON.parse(readFileSync(new URL("./design-values-addendum.json", import.meta.url), "utf8"));

const NEW_RIGS = new Set(["rig_bottoms_static", "rig_endomi_back_carrier"]);
const allowedMeshDelta = new Set(A.meshGenTargets);
const ENDOMI = "draw_r0_1cea4f6f_c7ac42d3_endomi_back";

let fail = 0;
const diffKeys = (kind) => {
  const a = pre[kind], b = post[kind];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs = [];
  for (const k of keys) if (a[k] !== b[k]) diffs.push(k);
  return diffs;
};

// keyformSets: zero diffs
const kfDiffs = diffKeys("keyformSets");
if (kfDiffs.length) { fail++; console.log(`FAIL keyformSets changed: ${kfDiffs.join(", ")}`); }
else console.log(`PASS keyformSets: all ${Object.keys(pre.keyformSets).length} byte-identical`);

// rigControls: only the declared deltas
const rcDiffs = diffKeys("rigControls");
const rcBad = [];
for (const k of rcDiffs) {
  if (NEW_RIGS.has(k) && pre.rigControls[k] === undefined) continue; // new rig
  if (k === "rig_bodyz_upper_body") {
    const a = JSON.parse(pre.rigControls[k]), b = JSON.parse(post.rigControls[k]);
    const restA = JSON.stringify({ ...a, childRigControlIds: null });
    const restB = JSON.stringify({ ...b, childRigControlIds: null });
    const childOk = JSON.stringify(b.childRigControlIds) ===
      JSON.stringify([...a.childRigControlIds, "rig_endomi_back_carrier"]);
    if (restA === restB && childOk) continue;
  }
  rcBad.push(k);
}
console.log(rcBad.length
  ? `FAIL rigControls unexpected: ${rcBad.join(", ")}`
  : `PASS rigControls: diffs=${rcDiffs.length} (2 new keyless rigs + upper_body child list append only)`);
fail += rcBad.length;

// new rigs must have no keyforms referencing them (keyformSets already byte-identical, but assert count too)
console.log(`INFO rigControls count: ${Object.keys(pre.rigControls).length} -> ${Object.keys(post.rigControls).length} (expected +2)`);
if (Object.keys(post.rigControls).length !== Object.keys(pre.rigControls).length + 2) { fail++; console.log("FAIL rigControls count delta != +2"); }

// meshes: only the 4 declared generateMesh targets
const meshDiffs = diffKeys("meshes");
const meshBad = meshDiffs.filter((k) => {
  const obj = JSON.parse(post.meshes[k] ?? pre.meshes[k]);
  return !allowedMeshDelta.has(obj.drawableId);
});
console.log(meshBad.length ? `FAIL meshes unexpected: ${meshBad.join(", ")}` : `PASS meshes: diffs=${meshDiffs.length} (all in declared 4 generateMesh targets)`);
fail += meshBad.length;

// drawables: endomi_back visibility only
const drawDiffs = diffKeys("drawables");
const drawBad = [];
for (const k of drawDiffs) {
  const a = JSON.parse(pre.drawables[k]), b = JSON.parse(post.drawables[k]);
  const restA = JSON.stringify({ ...a, runtimeVisibility: null });
  const restB = JSON.stringify({ ...b, runtimeVisibility: null });
  if (restA !== restB || k !== ENDOMI || !(a.runtimeVisibility === false && b.runtimeVisibility === true)) {
    drawBad.push(k);
  }
}
console.log(drawBad.length ? `FAIL drawables unexpected: ${drawBad.join(", ")}` : `PASS drawables: diffs=${drawDiffs.length} (endomi_back visibility false->true only)`);
fail += drawBad.length;

// model file shas
const allowedFiles = new Set(["rig-controls.json", "meshes.json", "variants.json", "drawables.json", "graph.json", "editor-state.json"]);
for (const [f, sha] of Object.entries(pre.fileShas)) {
  if (post.fileShas[f] !== sha && !allowedFiles.has(f)) { fail++; console.log(`FAIL file changed: ${f}`); }
}
console.log(`file shas: changed = ${Object.entries(pre.fileShas).filter(([f, s]) => post.fileShas[f] !== s).map(([f]) => f).join(", ")}`);
console.log(fail === 0 ? "NO-HARM ASSERT: PASS" : `NO-HARM ASSERT: FAIL x${fail}`);
process.exit(fail === 0 ? 0 : 1);
