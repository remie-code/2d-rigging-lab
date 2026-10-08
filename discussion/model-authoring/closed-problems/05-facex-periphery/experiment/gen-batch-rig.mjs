// cp05: generate warp + key op batches for the 6 periphery elements.
// Global frame (identical to committed fix2 front-hair field = gain-1 canon):
//   cx = 1001, T = 30 (nose amplitude at param +-30), Delta = 30deg
//   g = T / (U_hair * sin(30)) = 30/160 = 0.1875
//   chord coefficient = g * (cos(30)-1) = -0.025120...  (same sign both keys)
//   z-term coefficient = g * sin(30) = 0.09375          (sign flips between keys)
//   dx+-(u,y) = chordCoef * u_chord  +-  0.09375 * z(u,y);  dy = 0 everywhere
// Vertical family (same as fix2): equator y=463, cap radius 320 above, cylinder below.
import { writeFileSync } from "node:fs";

const CX = 1001;
const CHORD = 0.1875 * (Math.cos(Math.PI / 6) - 1); // -0.0251201...
const ZC = 0.09375;
const EQ_Y = 463, CAP_R = 320;

const capS = (y) => y >= EQ_Y ? 1 : Math.sqrt(Math.max(0, 1 - ((EQ_Y - y) / CAP_R) ** 2));

// Per-element field definitions. Each returns {plus, minus} dx at a grid point.
const elements = [
  {
    key: "ears_r", displayName: "FaceX Ears R",
    drawableId: "draw_r0_1cea4f6f_5c3cadc5_ears-r",
    domain: { x: 836, y: 411, width: 81, height: 96 }, n: 5,
    // Ear = limb appendage on the coronal plane of the skull: z = 0, chord only.
    field: (x, y) => { const u = x - CX; const c = CHORD * u; return { plus: c, minus: c }; }
  },
  {
    key: "ears_l", displayName: "FaceX Ears L",
    drawableId: "draw_r0_1cea4f6f_5c3cade4_ears-l",
    domain: { x: 1078, y: 411, width: 82, height: 96 }, n: 5,
    field: (x, y) => { const u = x - CX; const c = CHORD * u; return { plus: c, minus: c }; }
  },
  {
    key: "hair_f_r", displayName: "FaceX Hair F R",
    drawableId: "draw_r0_1cea4f6f_21b4da82_hair_f_r",
    domain: { x: 1008, y: 227, width: 288, height: 721 }, n: 7,
    // Same shell as committed front hair (fix2): z = +320*(1-(u/320)^2)*s(y).
    // Identical formula => root continuity with rig_facex_hair_front by construction.
    field: (x, y) => {
      const u = x - CX;
      const shape = Math.max(0, 1 - (u / 320) ** 2);
      const z = 320 * shape * capS(y);
      const c = CHORD * u;
      return { plus: c + ZC * z, minus: c - ZC * z };
    }
  },
  {
    key: "hair_f_l", displayName: "FaceX Hair F L",
    drawableId: "draw_r0_1cea4f6f_21b4da21_hair_f_l",
    domain: { x: 695, y: 267, width: 274, height: 699 }, n: 7,
    field: (x, y) => {
      const u = x - CX;
      const shape = Math.max(0, 1 - (u / 320) ** 2);
      const z = 320 * shape * capS(y);
      const c = CHORD * u;
      return { plus: c + ZC * z, minus: c - ZC * z };
    }
  },
  {
    key: "back_hair_r", displayName: "FaceX Back Hair R",
    drawableId: "draw_r0_1cea4f6f_f26916b1_back_hair_r",
    domain: { x: 375, y: 310, width: 662, height: 1520 }, n: 11,
    // Back hair = curtain behind the skull, wider than the skull (material |u| up to ~591).
    // z across the curtain's own width: deepest at center (-320 = mirror of front shell),
    // -> 0 at the spread edges. U_spread = 650 covers both pieces (one global curtain).
    // Chord uses root-carried u (strand hangs from scalp arc |u_r|<=320): u_r = u*320/650.
    field: (x, y) => backHairField(x, y)
  },
  {
    key: "back_hair_l", displayName: "FaceX Back Hair L",
    drawableId: "draw_r0_1cea4f6f_f2691750_back_hair_l",
    domain: { x: 967, y: 272, width: 537, height: 1505 }, n: 11,
    field: (x, y) => backHairField(x, y)
  }
];

const U_SPREAD = 650;
function backHairField(x, y) {
  const u = x - CX;
  const ur = u * (CAP_R / U_SPREAD);           // root-carried horizontal distance
  const shape = Math.max(0, 1 - (u / U_SPREAD) ** 2);
  const z = -CAP_R * shape * capS(y);          // z < 0: behind the axis
  const c = CHORD * ur;
  return { plus: c + ZC * z, minus: c - ZC * z };
}

const round2 = (v) => Math.round(v * 100) / 100;

const warpBatch = [];
const keyBatch = [];
for (const el of elements) {
  warpBatch.push({
    file: `warp-${el.key}.json`,
    operationId: `op_cp05_warp_${el.key}`,
    operationType: "createWarpDeformer",
    payload: {
      displayName: el.displayName,
      childDrawableIds: [el.drawableId],
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: el.domain,
      transformColumns: el.n,
      transformRows: el.n,
      bezierColumns: el.n,
      bezierRows: el.n,
      bezierEditType: "cubicBezierSurfaceV1"
    },
    gitMessage: `[cp05] warp ${el.displayName} (${el.n}x${el.n})`
  });

  // rowMajorYThenXFromDomainMinV1: rows iterate y from domain min, columns x from min.
  const plus = [], minus = [], zero = [];
  for (let r = 0; r < el.n; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.n - 1);
    for (let c = 0; c < el.n; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
      const f = el.field(x, y);
      plus.push({ x: round2(f.plus), y: 0 });
      minus.push({ x: round2(f.minus), y: 0 });
      zero.push({ x: 0, y: 0 });
    }
  }
  keyBatch.push({
    file: `key-${el.key}.json`,
    operationId: `op_cp05_key_${el.key}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: `rig_facex_${el.key}` },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_x",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: minus },
        default: { propertyPath: "controlPointOffsets", value: zero },
        max: { propertyPath: "controlPointOffsets", value: plus }
      }
    },
    gitMessage: `[cp05] key ${el.displayName} face_angle_x (createEndsCenter)`
  });
}

writeFileSync(new URL("batch-rig-warp.json", import.meta.url), JSON.stringify(warpBatch, null, 2));
writeFileSync(new URL("batch-rig-key.json", import.meta.url), JSON.stringify(keyBatch, null, 2));

// Print a compact field table for the design log.
for (const el of elements) {
  const rows = [];
  const yMid = el.domain.y + el.domain.height; // bottom row (cylinder zone for hair)
  for (let c = 0; c < el.n; c++) {
    const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
    const f = el.field(x, yMid);
    rows.push(`u=${Math.round(x - CX)}:+${round2(f.plus)}/-${round2(f.minus)}`);
  }
  console.log(el.key, "(bottom row)", rows.join("  "));
}
