// cp06fix3 F1 iteration 2 (the single budgeted visual/measured iteration):
// max-key far corner only.
//
// After gen-fix3-g1.mjs (r9 +1.64 / r10 +4.09), the measured joint vs btr at
// L+30 improved 0.391 -> 0.329 but remains 0.095 above the rest joint (0.234):
// the lattice response is ~0.015 slope/px because the visible last segment is
// dominated by vertices near the pivot row r11 which receive almost no delta.
// Pushing r10 alone to close the gap (~+6px more) would swell the mid-flap
// btr sliver beyond its measured envelope.
//
// This iteration therefore combines:
//   r10 c0/c1 +2.50 (upper-tail rotation, mid-band exposure stays below the
//                    existing tip-band value 18.8px)
//   r9  c0/c1 +1.00 (taper)
//   r11 c0/c1 -1.00 (direct micro-rotation of the LAST segment. C0 tuck at the
//                    tip stays preserved: measured tuck at +30 is 5.0px inside
//                    the bangs contour vs 3.7px at rest; -1.0 leaves 4.0px.
//                    Also reduces tip-band sliver exposure 18.8 -> ~17.8px.)
// Predicted residual ~0.02 (fix2 accepted +6% ~ 0.023 on the same doctrine).
// min key untouched (residual -0.022 already at the accepted level).
//
// Final cumulative C8' delta vs the fix3 base (batch-fix3-hat.json):
//   max: c0,c1: r9 +2.64, r10 +6.59, r11 -1.00
//   min: c11,c12: r9 -0.52, r10 -1.30
import { readFileSync, writeFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const N = 13;

const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const hatSet = kfs.find(
  (k) => k.target?.id === "rig_facex_headwear" && k.parameterId === "param_face_angle_x"
);

const batchA = JSON.parse(readFileSync(new URL("batch-fix3-hat.json", import.meta.url), "utf8"));
const base = batchA.find((e) => e.file.includes("-max-")).payload.statePatch.value;

// assert committed == fix3 base + g1 v1 delta
const V1 = { cols: [0, 1], rows: [[9, 1.64], [10, 4.09]] };
const committed = hatSet.keys.find((k) => k.value === 30).statePatch;
for (let i = 0; i < N * N; i++) {
  const r = Math.floor(i / N), c = i % N;
  let exp = base[i].x;
  const g1 = V1.rows.find(([rr]) => rr === r);
  if (g1 && V1.cols.includes(c)) exp = Math.round((exp + g1[1]) * 100) / 100;
  if (Math.abs(committed[i].x - exp) > 0.005 || Math.abs(committed[i].y - base[i].y) > 0.005)
    throw new Error(`max drift at node ${i} (r${r}c${c}): (${committed[i].x},${committed[i].y}) vs (${exp},${base[i].y})`);
}
console.log("assert: committed max == fix3 base + g1 v1 delta OK");

const INC = { cols: [0, 1], rows: [[9, 1.0], [10, 2.5], [11, -1.0]] };
const value = committed.map((p) => ({ x: p.x, y: p.y }));
for (const [r, dv] of INC.rows) {
  for (const c of INC.cols) {
    value[r * N + c] = { x: Math.round((value[r * N + c].x + dv) * 100) / 100, y: value[r * N + c].y };
  }
}
const batch = [{
  file: "fix3-g1b-headwear-max.json",
  operationId: "op_cp06fix3_g1b_headwear_max",
  operationType: "editKeyformKey",
  payload: {
    target: { kind: "rigControl", id: "rig_facex_headwear" },
    targetProperty: "controlPointOffsets",
    parameterId: "param_face_angle_x",
    interpolation: "linear-1d-v1",
    action: "updateCurrent",
    keyValue: 30,
    statePatch: { propertyPath: "controlPointOffsets", value }
  },
  gitMessage: "[cp06fix3] key FaceX Headwear max: G1 iteration 2 (upper-tail +2.5/+1.0, tip micro-rotation -1.0; joint vs btr toward rest 0.234)"
}];
writeFileSync(new URL("batch-fix3-g1b.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log("batch-fix3-g1b.json: 1 op; patched r9/r10/r11 c0,c1");
