// cp19 verification 4: no-harm. Compares snapshot-pre/post: every keyformSet,
// rigControl, mesh and drawable must be byte-identical EXCEPT the declared
// deltas (2 regenerated bottomwear meshes; 6 drawables false->true visibility;
// the 2 bottomwear drawables went true->false->true = net byte-identical).
import { readFileSync } from "node:fs";
const pre = JSON.parse(readFileSync(new URL("./snapshot-pre.json", import.meta.url), "utf8"));
const post = JSON.parse(readFileSync(new URL("./snapshot-post.json", import.meta.url), "utf8"));
const D = JSON.parse(readFileSync(new URL("./design-values.json", import.meta.url), "utf8"));

const allowedMeshDelta = new Set(D.meshGenTargets);          // by drawable id inside mesh json
const allowedVisDelta = new Set(D.restoreVisibilityTargets); // visibility-only diffs

let fail = 0;
const diffKeys = (kind) => {
  const a = pre[kind], b = post[kind];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs = [];
  for (const k of keys) if (a[k] !== b[k]) diffs.push(k);
  return diffs;
};

for (const kind of ["keyformSets", "rigControls"]) {
  const d = diffKeys(kind);
  if (d.length) { fail++; console.log(`FAIL ${kind} changed: ${d.join(", ")}`); }
  else console.log(`PASS ${kind}: all ${Object.keys(pre[kind]).length} byte-identical`);
}

const meshDiffs = diffKeys("meshes");
const meshBad = meshDiffs.filter((k) => {
  const obj = JSON.parse(post.meshes[k] ?? pre.meshes[k]);
  return !allowedMeshDelta.has(obj.drawableId);
});
console.log(meshBad.length ? `FAIL meshes unexpected: ${meshBad.join(", ")}` : `PASS meshes: diffs=${meshDiffs.length} (all in declared 2 bottomwear)`);
fail += meshBad.length;

const drawDiffs = diffKeys("drawables");
let drawBad = [];
for (const k of drawDiffs) {
  const a = JSON.parse(pre.drawables[k]), b = JSON.parse(post.drawables[k]);
  const restA = JSON.stringify({ ...a, runtimeVisibility: null });
  const restB = JSON.stringify({ ...b, runtimeVisibility: null });
  if (restA !== restB || !allowedVisDelta.has(k) || !(a.runtimeVisibility === false && b.runtimeVisibility === true)) {
    drawBad.push(k);
  }
}
console.log(drawBad.length ? `FAIL drawables unexpected: ${drawBad.join(", ")}` : `PASS drawables: diffs=${drawDiffs.length} (visibility false->true only, subset of declared 8)`);
fail += drawBad.length;

// model file shas: whitelist of files allowed to change
const allowedFiles = new Set(["variants.json", "drawables.json", "meshes.json", "editor-state.json"]);
for (const [f, sha] of Object.entries(pre.fileShas)) {
  if (post.fileShas[f] !== sha && !allowedFiles.has(f)) { fail++; console.log(`FAIL file changed: ${f}`); }
}
console.log(`file shas: changed = ${Object.entries(pre.fileShas).filter(([f, s]) => post.fileShas[f] !== s).map(([f]) => f).join(", ")}`);
console.log(fail === 0 ? "NO-HARM ASSERT: PASS" : `NO-HARM ASSERT: FAIL x${fail}`);
process.exit(fail === 0 ? 0 : 1);
