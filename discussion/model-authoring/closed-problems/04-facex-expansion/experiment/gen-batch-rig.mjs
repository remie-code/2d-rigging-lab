// cp04: generate batch JSON for 5 FaceX deformers + 5 keyform sets.
// Field design: see design-log.md. T = 30 (gain-1 world line).
import { writeFileSync } from "node:fs";

const T = 30;
const pt = (x) => ({ x: Math.round(x * 100) / 100, y: 0 });
const uniform = (n, v) => Array.from({ length: n }, () => pt(v));
const zeros = (n) => uniform(n, 0);
// column-major-value grid: value depends on column only (rows x cols, row-major order)
const colField = (rows, cols, colVals) => {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(pt(colVals[c]));
  return out;
};
// product field rowM x colM x T
const prodField = (rowM, colM, sign) => {
  const out = [];
  for (const rm of rowM) for (const cm of colM) out.push(pt(sign * T * rm * cm));
  return out;
};
const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

const warp = (file, opid, name, dom, cols, rows, children, git) => ({
  file, operationId: opid, operationType: "createWarpDeformer",
  payload: {
    displayName: name,
    childDrawableIds: children.drawables ?? [],
    childRigControlIds: [],
    opacityMultiplier: 1,
    domainBounds: dom,
    transformColumns: cols, transformRows: rows,
    bezierColumns: 2, bezierRows: 2, bezierEditType: "cubicBezierSurfaceV1",
    ...(children.wrap ? { wrapChildren: children.wrap.map((id) => ({ kind: "rigControl", id })) } : {})
  },
  gitMessage: git
});
const key = (file, opid, rigId, minV, maxV, n, git) => ({
  file, operationId: opid, operationType: "editKeyformKey",
  payload: {
    target: { kind: "rigControl", id: rigId },
    targetProperty: "controlPointOffsets",
    parameterId: "param_face_angle_x",
    interpolation: "linear-1d-v1",
    action: "createEndsCenter",
    statePatches: {
      min: { propertyPath: "controlPointOffsets", value: minV },
      default: { propertyPath: "controlPointOffsets", value: zeros(n) },
      max: { propertyPath: "controlPointOffsets", value: maxV }
    }
  },
  gitMessage: git
});

// --- fields ---
// mouth: uniform +-0.8T
const mouthMin = uniform(25, -24), mouthMax = uniform(25, 24);
// eye R: min = gradient edge(-7.5, left col) -> center(-19.5, right col); max = uniform +25.5
const eyeRMin = colField(5, 5, lin(-7.5, -19.5, 5));
const eyeRMax = uniform(25, 25.5);
// brow L (screen right): max = sample eye L f(x)=19.5-12*(x-976)/190 at x 1001..1136
const browLx = lin(1001, 1136, 5).map((x) => 19.5 - (12 * (x - 976)) / 190);
const browLMax = colField(5, 5, browLx);
const browLMin = uniform(25, -25.5);
// brow R (screen left): min = sample eye R f(x)=-7.5-12*(x-825)/199 at x 852..992
const browRx = lin(852, 992, 5).map((x) => -7.5 - (12 * (x - 825)) / 199);
const browRMin = colField(5, 5, browRx);
const browRMax = uniform(25, 25.5);
// front hair: 7x7 product field, symmetric sign-flip
const hairRowM = [0, 0.55, 0.9, 1, 1, 1, 1];
const hairColM = [0, 0.4, 0.8, 1, 0.8, 0.4, 0];
const hairMax = prodField(hairRowM, hairColM, 1);
const hairMin = prodField(hairRowM, hairColM, -1);

const batch = [
  warp("warp-mouth.json", "op_cp04_warp_mouth", "FaceX Mouth",
    { x: 954, y: 514, width: 93, height: 27 }, 5, 5,
    { drawables: ["draw_r0_1cea4f6f_3a8f6fa8_mouth"] },
    "[cp04] facex: create FaceX Mouth deformer (5x5)"),
  key("key-mouth.json", "op_cp04_key_mouth", "rig_facex_mouth", mouthMin, mouthMax, 25,
    "[cp04] facex: mouth key uniform +-0.8T (local face field 18.6 x feature lead 1.3)"),
  warp("warp-eye-r.json", "op_cp04_warp_eye_r", "FaceX Eye R",
    { x: 825, y: 384, width: 199, height: 118 }, 5, 5,
    { wrap: ["rig_eye_r_open", "rig_eye_r_half", "rig_eye_r_close"] },
    "[cp04] facex: create FaceX Eye R deformer wrapping eye R tower"),
  key("key-eye-r.json", "op_cp04_key_eye_r", "rig_facex_eye_r", eyeRMin, eyeRMax, 25,
    "[cp04] facex: eye R mirror key (min gradient 0.25-0.65T squash, max uniform +0.85T)"),
  warp("warp-brow-l.json", "op_cp04_warp_brow_l", "FaceX Brow L",
    { x: 1001, y: 345, width: 135, height: 31 }, 5, 5,
    { drawables: ["draw_r0_1cea4f6f_3a8f70c7_eyebrow-l"] },
    "[cp04] facex: create FaceX Brow L deformer (5x5)"),
  key("key-brow-l.json", "op_cp04_key_brow_l", "rig_facex_brow_l", browLMin, browLMax, 25,
    "[cp04] facex: brow L key (max sampled from eye L field 17.9->9.4, min uniform -0.85T)"),
  warp("warp-brow-r.json", "op_cp04_warp_brow_r", "FaceX Brow R",
    { x: 852, y: 354, width: 140, height: 37 }, 5, 5,
    { drawables: ["draw_r0_1cea4f6f_3a8f70e6_eyebrow-r"] },
    "[cp04] facex: create FaceX Brow R deformer (5x5)"),
  key("key-brow-r.json", "op_cp04_key_brow_r", "rig_facex_brow_r", browRMin, browRMax, 25,
    "[cp04] facex: brow R key (min sampled from eye R field -9.1->-17.6, max uniform +0.85T)"),
  warp("warp-hair-front.json", "op_cp04_warp_hair_front", "FaceX Hair Front",
    { x: 655, y: 135, width: 692, height: 638 }, 7, 7,
    { drawables: ["draw_r0_1cea4f6f_21b4dac0_front_hair"] },
    "[cp04] facex: create FaceX Hair Front deformer (7x7)"),
  key("key-hair-front.json", "op_cp04_key_hair_front", "rig_facex_hair_front", hairMin, hairMax, 49,
    "[cp04] facex: hair front key (cylinder silhouette fixed, col 0/.4/.8/1 row 0/.55/.9/1 x 1.0T)")
];

writeFileSync(new URL("./batch-rig.json", import.meta.url), JSON.stringify(batch, null, 1));
console.log("batch-rig.json written:", batch.length, "ops");
// echo hair field rows for sanity
for (let r = 0; r < 7; r++) console.log("hair r" + r + ":", hairMax.slice(r * 7, r * 7 + 7).map((p) => p.x).join(" "));
console.log("browL max:", browLx.map((v) => v.toFixed(2)).join(" "));
console.log("browR min:", browRx.map((v) => v.toFixed(2)).join(" "));
