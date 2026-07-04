// cp06fix3 F1: G1 tail rotation at the far-side bottom corners, tangent
// partner selected PER SEGMENT (extension of ledger constraint C8).
//
// fix2's C8 restored the rest joint angle against the HAIR contour
// (front_hair/hair_f_*) on both far-side corners. The ledger Q3 adjacency map
// (rest) plus this round's deformed measurement (fix3-corners.mjs on
// commands/fix3-measure-*.response.json, rev 172) show the actual partner at
// +-30 is the BACK-OF-HEAD part on the drooping side (dy>0 = away side):
//   +30, L corner: silhouette below the hat tip is btr for the WHOLE measured
//     run (tip..tip+60px, margins 2.6..20.5px outside the hair contour).
//   -30, R corner: btl for the whole run (margins 6.4..27.9px).
//   near-side corners: hair remains outermost and the hat tip tucks behind it
//     -> joint not visible -> untouched (fix2 doctrine kept).
// So the tail's tangent partner switches hair -> btr/btl on the far corners;
// scallop segments whose neighbor is the front hair keep C7 (constructive C0/
// G1 via shared field), as before.
//
// Invariant (9th-gen B doctrine, kept): deformed joint angle == REST joint
// angle, measured against the SAME partner contour:
//   rest joint vs bt : L +0.234 | R -0.312   (fix3-corners.mjs, rest)
//   deformed (rev172): L tail 0.203, btr tangent -0.187 -> joint 0.391,
//                        excess +0.157 -> ddx(r10) = +0.157*26.083 = +4.09
//                      R tail -0.256, btl tangent 0.106 -> joint -0.362,
//                        excess -0.050 -> ddx(r10) = -0.050*26.083 = -1.30
// Tail rotation about the flap-tip pivot rows (r11/r12 = 0), r9 = 0.4 taper:
//   max key: c0,c1  r9 +1.64, r10 +4.09
//   min key: c11,c12 r9 -0.52, r10 -1.30
// dy untouched (C5). All other nodes byte-preserved (asserted against
// batch-fix3-hat.json = the committed source before patching).
import { readFileSync, writeFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const N = 13;

const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const hatSet = kfs.find(
  (k) => k.target?.id === "rig_facex_headwear" && k.parameterId === "param_face_angle_x"
);

const batchA = JSON.parse(readFileSync(new URL("batch-fix3-hat.json", import.meta.url), "utf8"));
const gridOf = (label) =>
  batchA.find((e) => e.file.includes(`-${label}-`)).payload.statePatch.value;

const DELTA = {
  max: { cols: [0, 1], rows: [[9, 1.64], [10, 4.09]] },
  min: { cols: [11, 12], rows: [[9, -0.52], [10, -1.30]] }
};

const batch = [];
for (const [label, keyVal] of [["max", 30], ["min", -30]]) {
  const committed = hatSet.keys.find((k) => k.value === keyVal).statePatch;
  const gen = gridOf(label);
  if (committed.length !== N * N) throw new Error("lattice size");
  for (let i = 0; i < N * N; i++) {
    if (Math.abs(committed[i].x - gen[i].x) > 0.005 || Math.abs(committed[i].y - gen[i].y) > 0.005)
      throw new Error(`${label} drift at node ${i}: (${committed[i].x},${committed[i].y}) vs (${gen[i].x},${gen[i].y})`);
  }
  console.log(`${label}: committed == batch-fix3-hat grid (drift assert) OK`);
  const value = committed.map((p) => ({ x: p.x, y: p.y }));
  const d = DELTA[label];
  for (const [r, dv] of d.rows) {
    for (const c of d.cols) {
      value[r * N + c] = { x: Math.round((value[r * N + c].x + dv) * 100) / 100, y: value[r * N + c].y };
    }
  }
  batch.push({
    file: `fix3-g1-headwear-${label}.json`,
    operationId: `op_cp06fix3_g1_headwear_${label}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: "rig_facex_headwear" },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_x",
      interpolation: "linear-1d-v1",
      action: "updateCurrent",
      keyValue: keyVal,
      statePatch: { propertyPath: "controlPointOffsets", value }
    },
    gitMessage: `[cp06fix3] key FaceX Headwear ${label}: G1 tail rotation re-targeted to back_top_hair contour at far-side bottom corner (rest joint angle vs bt restored)`
  });
  console.log(`${label}: patched`, d.rows.map(([r]) => d.cols.map((c) => `r${r}c${c}`).join(",")).join(" "));
}
writeFileSync(new URL("batch-fix3-g1.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log("batch-fix3-g1.json: 2 ops");
