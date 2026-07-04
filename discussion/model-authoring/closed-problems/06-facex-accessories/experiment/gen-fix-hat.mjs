// cp06fix: hat "flat cutout" fix — sticker->volume spectrum, three corrections.
// User gate: the hat read as a flat sticker rotating. Glasses untouched.
//
// The committed hat field treated the WHOLE hat as a sticker (rotation law
// applied point-wise with a separable shell*cap z). Three volume corrections:
//
// (1) SILHOUETTE ANCHORING of the lateral edges. The hat's left/right edges
//     are not material ends but silhouette rims (the locus where the line of
//     sight grazes the curved surface). Under rotation the rim stays glued to
//     the head silhouette while MATERIAL flows through it. The separable
//     ansatz z = 320*(1-(u/320)^2)*s(y) never vanishes at the actual per-row
//     silhouette half-width W(y) << 320, so the edge translated with the flow
//     (the sticker giveaway). Implementation: per-side per-row W_L/W_R(y)
//     measured from the texture; anchor weight
//         w(u,y) = clamp((|u| - 0.55*W)/(0.45*W), 0, 1)      (y >= 135)
//     blends the full field toward the occiput-layer field (chord + tiny z<0
//     term = the head-periphery motion, a few px). Outer lattice columns land
//     at w=1 (fully anchored), interior columns w=0 (full cap flow), the
//     lattice interpolates between. The band inside the far-side edge
//     stretches (pattern spacing opens) = "the hat's side coming into view";
//     the near-side band compresses = material vanishing around the rim.
//     Ear rows (y<135) are EXEMPT: standing appendages are volumes whose own
//     cone section (3) handles their silhouette; the dome does not exist there.
//
// (2) BRIM VERTICAL SWING dy = -k*u*sin(D) (y-down screen coords). The
//     hat-head connection line is a tilted 3D loop (beanie worn deep toward
//     the nape: forehead high, sides/back low - visible in the texture: brim
//     center y~282, side flaps descend to y356/372). The tilt couples dz into
//     dy: parametrizing the loop at height y0 - k*z, a yaw D gives
//         dy = -k*[sqrt(W^2-u^2)(cosD-1) + u*sinD]  ~=  -k*u*sinD (kept term).
//     Facing side (u>0 at +30): boundary shifts UP (connection line rolls away
//     behind the head); far side shifts DOWN (the back arc of the deep-worn
//     loop comes into view; back_top_hair may peek - it receives the same
//     formula on its shared top row). Sign convention verified against
//     committed eyelid keys: +y offset = downward on screen.
//     k = 0.05 (presentation dial, conservative start): edge ends |u|~200 ->
//     5px vertical at D=30. dy applies to ALL hat points (every circumference
//     of the beanie is a loop of the same tilt), unattenuated by w.
//
// (3) CAT-EAR CONE ANSATZ. The ears are projections of cones, not triangle
//     stickers. The old freeze band carried the base translation uniformly
//     (flat sticker). Now each ear point gets its own z section: a ridge line
//     (apex -> base center, measured from texture; apexes lean OUTBOARD)
//     carries the crown z of its ridge; flanks fall linearly - ASYMMETRIC:
//     outer flank falls hard (factor 0.85 -> 0.15*Z_r at the outer material
//     edge), inner flank falls gently (factor 0.15 -> 0.85*Z_r at the inner
//     edge). The asymmetry is not styling: rotating the exact measured ear
//     footprint on the per-row head circle (radius ~160 at ear height) shows
//     z must INCREASE inward - the outer edge sits near the head limb (z->0)
//     while the inner edge sits well onto the dome (z high). The symmetric
//     tent (first draft) put the inner flank at low z and produced the wrong
//     face alternation; the numeric check against the true rotated cone
//     (footprint azimuth span -76..-19 deg, D=30) fixed the shape:
//     far ear thins ~12% with material crowding toward its outer edge, near
//     ear fattens ~8% with its outer flank opening ~37% = the unseen face
//     rotating into view. Z_ridge keeps the frozen-crown amplitude (the 7th
//     gen "mass" translation the gate accepted) - a gain choice, documented.
//     The crown slack between the ears keeps the frozen-crown z (its own
//     standing-appendage treatment unchanged). Ear sections blend into the
//     crown over y in [122,150] (merge row = 122). Falloffs continue past the
//     material edges to z=0 (no dead band, chord always applies).
//
// Lattice: 9x9 columns (53px pitch) cannot express a per-ear tent (~2 nodes
// per ear, ridge between them) nor the edge anchor ramp at the ear rows ->
// deleteRigControl + recreate at 13x13 (35.4px pitch: ridge/flank nodes per
// ear, cp04fix2 delete->recreate precedent). Same domain, same displayName
// (id re-derives to rig_facex_headwear).
//
// back_top_hair top rows (shared boundary, cp06 principle (3)): re-evaluated
// with the NEW hat formula - both dx AND dy (seam preserved by construction).
// Rows 2-5 byte-preserved from cp05fix (occlusion constraint band untouched);
// committed top row asserted == the 7th-gen hat formula before replacement.
import { readFileSync, writeFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const CX = 1001;
const CHORD = 0.1875 * (Math.cos(Math.PI / 6) - 1); // -0.0251201...
const ZC = 0.09375;
const HAT_EQ = 463, HAT_R = 371, HAT_FREEZE = 170;
const SHELL_U = 320, SHELL_Z = 320;
const K_TILT = 0.05;          // (2) brim tilt dial
const RAMP_A = 0.55;          // (1) anchor ramp start as fraction of W(y)
const ANCHOR_Y_MIN = 135;     // (1) dome rows only (ears exempt)
const EAR_MERGE_Y = 122, EAR_BLEND_END = 150;

const DOMAIN = { x: 795, y: 79, width: 425, height: 313 };
const N = 13;

// --- vertical cap (unchanged from cp06: freeze below y170) ---
const sHat = (y) => {
  const yy = Math.max(y, HAT_FREEZE);
  if (yy >= HAT_EQ) return 1;
  return Math.sqrt(Math.max(0, 1 - ((HAT_EQ - yy) / HAT_R) ** 2));
};
const zCrown = (u, y) => SHELL_Z * Math.max(0, 1 - (u / SHELL_U) ** 2) * sHat(y);

// --- (1) per-row silhouette half-widths from the texture ---
const TEX = { f: "psd/r0_1cea4f6f/psd_root_layer_0.raw-rgba", x: 808, y: 92, w: 400, h: 288 };
const ALPHA = 64;
const wTab = { L: new Map(), R: new Map() };
{
  const buf = readFileSync(`${PKG}/assets/textures/${TEX.f}`);
  for (let ry = 0; ry < TEX.h; ry++) {
    const y = TEX.y + ry;
    if (y < 124) continue; // ear/slack rows are not dome silhouette
    let mnL = Infinity, mxR = -Infinity, run = 0;
    for (let rx = 0; rx < TEX.w; rx++) {
      const op = buf[(ry * TEX.w + rx) * 4 + 3] >= ALPHA;
      run = op ? run + 1 : 0;
      if (run >= 3) {
        const u0 = TEX.x + rx - CX;
        for (let d = 0; d < run && d < 3; d++) {
          const u = u0 - d;
          if (u < 0) mnL = Math.min(mnL, u);
          else mxR = Math.max(mxR, u);
        }
      }
    }
    if (mnL < Infinity) wTab.L.set(y, -mnL);
    if (mxR > -Infinity) wTab.R.set(y, mxR);
  }
}
const wOf = (side, y) => {
  const t = wTab[side];
  const ys = [...t.keys()];
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const yy = Math.max(lo, Math.min(hi, Math.round(y)));
  for (let d = 0; d <= hi - lo; d++) {
    if (t.has(yy - d)) return t.get(yy - d);
    if (t.has(yy + d)) return t.get(yy + d);
  }
  throw new Error("empty W table");
};

// --- (1) anchor field = occiput layer (cp05fix back_top_hair formula) ---
const zOcciput = (u, y) =>
  -(SHELL_Z / 6) * (1 - (u / 650) ** 2) * Math.min(1, Math.max(0, (y - 264) / (769 - 264)));

// --- (3) ear tents (tables measured from texture alpha, see design log) ---
const lerpTab = (tab, y) => {
  if (y <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (y <= tab[i][0]) {
      const [y0, v0] = tab[i - 1], [y1, v1] = tab[i];
      return v0 + ((y - y0) * (v1 - v0)) / (y1 - y0);
    }
  }
  // extrapolate half-width growth below the merge row; ridge stays put
  const [y1, v1] = tab[tab.length - 1];
  const [y0, v0] = tab[tab.length - 2];
  const slope = (v1 - v0) / (y1 - y0);
  return v1 + (y - y1) * (slope > 0 ? slope : 0);
};
// edge/ridge tables measured from texture alpha (rows y92..y120, merge y122):
const EARS = {
  left: {  // outer = more negative u
    sign: -1,
    ridge: [[92, -134.5], [104, -121], [112, -111.5], [122, -103]],
    outer: [[92, -140], [104, -151], [112, -153], [122, -155.5]],
    inner: [[92, -129], [104, -91], [112, -70], [122, -51]]
  },
  right: { // outer = more positive u
    sign: +1,
    ridge: [[92, 153.5], [104, 140], [112, 130], [122, 122]],
    outer: [[92, 156], [104, 168], [112, 171], [122, 173.5]],
    inner: [[92, 151], [104, 112], [112, 89], [122, 68]]
  }
};
const FALL_OUT = 0.85, FALL_IN = 0.15, B_FLOOR = 15;
const zEarSection = (ear, u, y) => {
  const yy = y; // tables extrapolate below the merge row (flanks keep spreading)
  const ur = lerpTab(ear.ridge, Math.min(yy, EAR_MERGE_Y)); // ridge stays put below merge
  const bOut = Math.max(B_FLOOR, Math.abs(lerpTab(ear.outer, yy) - ur));
  const bIn = Math.max(B_FLOOR, Math.abs(lerpTab(ear.inner, yy) - ur));
  const zr = SHELL_Z * Math.max(0, 1 - (ur / SHELL_U) ** 2) * sHat(HAT_FREEZE);
  const d = u - ur;
  const outward = ear.sign > 0 ? d > 0 : d < 0;
  const fall = outward ? (FALL_OUT * Math.abs(d)) / bOut : (FALL_IN * Math.abs(d)) / bIn;
  return zr * Math.max(0, 1 - fall);
};

// --- full z profile ---
const zFull = (u, y) => {
  if (y >= EAR_BLEND_END) return zCrown(u, y);
  const ear = u <= -49 ? EARS.left : u >= 66 ? EARS.right : null;
  if (!ear) return zCrown(u, y); // crown slack keeps the frozen-crown z
  const zt = zEarSection(ear, u, y);
  if (y <= EAR_MERGE_Y) return zt;
  const t = (y - EAR_MERGE_Y) / (EAR_BLEND_END - EAR_MERGE_Y);
  return zt * (1 - t) + zCrown(u, y) * t;
};

// --- assembled field: {max:{x,y}, min:{x,y}} offsets at parameter +-30 ---
const round2 = (v) => Math.round(v * 100) / 100;
const hatFieldFix = (x, y) => {
  const u = x - CX;
  const c = CHORD * u;
  const zf = zFull(u, y);
  let dxMax = c + ZC * zf, dxMin = c - ZC * zf;
  if (y >= ANCHOR_Y_MIN) {
    const W = wOf(u < 0 ? "L" : "R", y);
    const w = Math.min(1, Math.max(0, (Math.abs(u) - RAMP_A * W) / ((1 - RAMP_A) * W)));
    const zo = zOcciput(u, y);
    dxMax = (1 - w) * dxMax + w * (c + ZC * zo);
    dxMin = (1 - w) * dxMin + w * (c - ZC * zo);
  }
  const dyMax = -0.5 * K_TILT * u; // sin(+30deg) = +0.5; +y = down on screen
  const dyMin = +0.5 * K_TILT * u;
  return {
    max: { x: round2(dxMax), y: round2(dyMax) },
    min: { x: round2(dxMin), y: round2(dyMin) }
  };
};

// --- 7th-gen formula (for the drift assertion on btr/btl top rows) ---
const hatFieldOld = (x, y) => {
  const u = x - CX;
  const z = zCrown(u, y);
  const c = CHORD * u;
  return { plus: c + ZC * z, minus: c - ZC * z };
};

// --- build batch ---
const batch = [];
batch.push({
  file: "fix-delete-headwear.json",
  operationId: "op_cp06fix_delete_headwear",
  operationType: "deleteRigControl",
  payload: { rigControlId: "rig_facex_headwear" },
  gitMessage: "[cp06fix] delete FaceX Headwear 9x9 (lattice too coarse for ear cones + edge anchor ramp)"
});
batch.push({
  file: "fix-warp-headwear.json",
  operationId: "op_cp06fix_warp_headwear",
  operationType: "createWarpDeformer",
  payload: {
    displayName: "FaceX Headwear",
    childDrawableIds: ["draw_r0_1cea4f6f_9dc00ee4_headwear"],
    childRigControlIds: [],
    opacityMultiplier: 1,
    domainBounds: DOMAIN,
    transformColumns: N, transformRows: N,
    bezierColumns: N, bezierRows: N,
    bezierEditType: "cubicBezierSurfaceV1"
  },
  gitMessage: "[cp06fix] warp FaceX Headwear 13x13 (same domain)"
});
const grid = (key) => {
  const out = [];
  for (let r = 0; r < N; r++) {
    const y = DOMAIN.y + (DOMAIN.height * r) / (N - 1);
    for (let c = 0; c < N; c++) {
      const x = DOMAIN.x + (DOMAIN.width * c) / (N - 1);
      if (key === 0) { out.push({ x: 0, y: 0 }); continue; }
      const f = hatFieldFix(x, y);
      out.push(key > 0 ? f.max : f.min);
    }
  }
  return out;
};
batch.push({
  file: "fix-key-headwear.json",
  operationId: "op_cp06fix_key_headwear",
  operationType: "editKeyformKey",
  payload: {
    target: { kind: "rigControl", id: "rig_facex_headwear" },
    targetProperty: "controlPointOffsets",
    parameterId: "param_face_angle_x",
    interpolation: "linear-1d-v1",
    action: "createEndsCenter",
    statePatches: {
      min: { propertyPath: "controlPointOffsets", value: grid(-1) },
      default: { propertyPath: "controlPointOffsets", value: grid(0) },
      max: { propertyPath: "controlPointOffsets", value: grid(+1) }
    }
  },
  gitMessage: "[cp06fix] key FaceX Headwear face_angle_x (anchored rim + brim dy + ear cones)"
});

// --- back_top_hair shared top rows: new hat formula (dx AND dy) ---
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const occ = [
  { key: "back_top_hair_r", rigId: "rig_facex_back_top_hair_r",
    domain: { x: 783, y: 257, width: 196, height: 525 }, n: 5 },
  { key: "back_top_hair_l", rigId: "rig_facex_back_top_hair_l",
    domain: { x: 1022, y: 252, width: 196, height: 525 }, n: 5 }
];
for (const el of occ) {
  const set = kfs.find((k) => k.target?.id === el.rigId && k.parameterId === "param_face_angle_x");
  if (!set) throw new Error(`keyform set not found for ${el.rigId}`);
  for (const [label, keyVal] of [["min", -30], ["max", 30]]) {
    const committed = set.keys.find((k) => k.value === keyVal).statePatch;
    if (committed.length !== 25) throw new Error("unexpected lattice size");
    // drift assertion: committed top row must equal the 7th-gen hat formula
    for (let c = 0; c < el.n; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
      const f = hatFieldOld(x, el.domain.y);
      const expect = round2(keyVal > 0 ? f.plus : f.minus);
      if (Math.abs(committed[c].x - expect) > 0.02 || Math.abs(committed[c].y) > 0.02)
        throw new Error(`top row drift at ${el.key} col ${c}: (${committed[c].x},${committed[c].y}) vs ${expect}`);
    }
    const value = committed.map((p) => ({ x: p.x, y: p.y })); // rows 2-5 byte-preserved
    for (let c = 0; c < el.n; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
      const f = hatFieldFix(x, el.domain.y);
      value[c] = keyVal > 0 ? f.max : f.min;
    }
    batch.push({
      file: `fix-key-${el.key}-${label}.json`,
      operationId: `op_cp06fix_key_${el.key}_${label}`,
      operationType: "editKeyformKey",
      payload: {
        target: { kind: "rigControl", id: el.rigId },
        targetProperty: "controlPointOffsets",
        parameterId: "param_face_angle_x",
        interpolation: "linear-1d-v1",
        action: "updateCurrent",
        keyValue: keyVal,
        statePatch: { propertyPath: "controlPointOffsets", value }
      },
      gitMessage: `[cp06fix] key ${el.key} face_angle_x ${label} top row = fixed hat formula dx+dy (updateCurrent)`
    });
  }
}

writeFileSync(new URL("batch-fix-hat.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log(`batch-fix-hat.json: ${batch.length} ops`);

// --- design tables ---
console.log("\nW(y) dome half-widths (L/R):");
for (const y of [124, 157, 200, 264, 300, 340, 370])
  console.log(` y=${y}: L=${wOf("L", y)} R=${wOf("R", y)}`);
console.log("\nhat rows (max key dx/dy | min key dx/dy):");
for (const y of [92, 105, 131, 157, 209, 264, 314, 366, 392]) {
  const cells = [];
  for (const x of [808, 866, 901, 1001, 1101, 1140, 1206]) {
    const f = hatFieldFix(x, y);
    cells.push(`u${x - CX}:${f.max.x},${f.max.y}|${f.min.x},${f.min.y}`);
  }
  console.log(` y=${y} ${cells.join("  ")}`);
}
console.log("\near cross-sections (max key dx at y=105):");
for (const ear of [[-155, -135, -121, -100, -86], [84, 112, 130, 148, 170]]) {
  console.log(" " + ear.map((u) => `u${u}:${hatFieldFix(CX + u, 105).max.x}`).join("  "));
}
console.log("\nbtr/btl new top rows (max | min):");
for (const el of occ) {
  const cells = [];
  for (let c = 0; c < el.n; c++) {
    const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
    const f = hatFieldFix(x, el.domain.y);
    cells.push(`u${Math.round(x - CX)}:${f.max.x},${f.max.y}|${f.min.x},${f.min.y}`);
  }
  console.log(` ${el.key} y=${el.domain.y} ${cells.join("  ")}`);
}
