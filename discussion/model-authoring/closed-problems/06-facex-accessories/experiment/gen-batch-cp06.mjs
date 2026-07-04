// cp06: FaceX accessories — headwear (cat-ear beanie) + eyewear (round glasses)
// + back_top_hair top-edge boundary-condition rewrite (cp05 interim recovery).
//
// Physical frame (gain-1 canon, reconstructed from committed fields — same as cp05):
//   cx = 1001, Delta = 30deg, chordCoef = 0.1875*(cos30-1) = -0.02512,
//   zCoef = 0.09375;  dx+-(u,y) = chordCoef*u +- zCoef*z(u,y);  dy = 0 everywhere.
//
// --- Hat (design principle (1): continuity over law at connection lines) ---
// Adjacency measured from textures + rest render (see design log):
//   the hat's lower/side edges are silhouette-continuous with front_hair /
//   hair_f_l/r (committed shell field), and its brim presses on the forehead
//   front hair. So the hat wears the SAME horizontal shell as the hair
//   (U=320, Z=320 — layer-gap dial 0, cp05 tuft precedent), guaranteeing both
//   the brim-line pressed contact and the silhouette handoff constructively.
//   Vertical profile is the hat's OWN cap (the hat crown extends above the
//   hair cap's pole y143, where the hair formula is already 0):
//     s_cap(y) = sqrt(1 - ((463-y)/371)^2)   pole y92 (material top), eq y463
//   with a crown/ears FREEZE band above y170: s_hat(y) = s_cap(max(y,170)).
//   Rationale: the cat ears + apex slack are standing appendages on the crown;
//   they must carry their base's translation (the recipe's hanging-tuft rule
//   mirrored upward), else they shear ~9px against their own base ("mass" gate).
// --- Glasses (design principle (2): rigid body = low-order field) ---
//   Sample the committed eye-layer fields at the two lens centers
//   (x927 over rig_facex_eye_r, x1067 over rig_facex_eye_l):
//     +30: (25.5 + 13.75)/2 = 19.63;  -30: (13.65 + 25.5)/2 = 19.58 -> S = 19.6
//   Affine field = rotation law with z(u) == const (order-0 flat plane):
//     dx+-(x) = chordCoef*(x-cx) +- D,  D = S * 1.05 (slight lead over the eye
//     layer, kin of the feature-lead rule) - 0.1 (own chord at center) ~= 20.5
//   Chord slope = the uniform shrink (2.5% over the frame width); no curvature
//   passes into the frame -> rigidity preserved exactly (bilinear of affine).
// --- back_top_hair rewrite (design principle (3): layer connection = shared formula) ---
//   Top lattice row (y257 / y252, hidden under the hat) switches from
//   v=0 (static-hat interim) to the HAT'S OWN formula evaluated at that row:
//     z_top(u) = 320*(1-(u/320)^2)*s_hat(y_row)
//   Direction decision: hat first (master) — its edge must stay continuous with
//   the committed front-hair silhouette, so the occiput receives. Rows 2-5 stay
//   byte-identical to cp05fix (curtain-root sync at y769/y782 and the occluder
//   band y360-435 are untouched; the lattice's own 257->388 interpolation is the
//   blend band). Without this, at +30 the near-static occiput sliver pops out
//   ~9px beyond the receding hat flap edge (measured: hat edge 808+22 vs btr
//   817+3.5 at y348).
import { readFileSync, writeFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const CX = 1001;
const CHORD = 0.1875 * (Math.cos(Math.PI / 6) - 1); // -0.0251201...
const ZC = 0.09375;
const HAT_EQ = 463, HAT_R = 371, HAT_FREEZE = 170, SHELL_U = 320, SHELL_Z = 320;
const GLASSES_D = 20.5;

const sHat = (y) => {
  const yy = Math.max(y, HAT_FREEZE);
  if (yy >= HAT_EQ) return 1;
  return Math.sqrt(Math.max(0, 1 - ((HAT_EQ - yy) / HAT_R) ** 2));
};
const hatField = (x, y) => {
  const u = x - CX;
  const z = SHELL_Z * Math.max(0, 1 - (u / SHELL_U) ** 2) * sHat(y);
  const c = CHORD * u;
  return { plus: c + ZC * z, minus: c - ZC * z };
};
const glassesField = (x, _y) => {
  const c = CHORD * (x - CX);
  return { plus: c + GLASSES_D, minus: c - GLASSES_D };
};

const round2 = (v) => Math.round(v * 100) / 100;
const grid = (domain, n, field, key) => {
  const out = [];
  for (let r = 0; r < n; r++) {
    const y = domain.y + (domain.height * r) / (n - 1);
    for (let c = 0; c < n; c++) {
      const x = domain.x + (domain.width * c) / (n - 1);
      const f = field(x, y);
      out.push({ x: round2(key === 0 ? 0 : key > 0 ? f.plus : f.minus), y: 0 });
    }
  }
  return out;
};

const elements = [
  { key: "headwear", displayName: "FaceX Headwear",
    drawableId: "draw_r0_1cea4f6f_9dc00ee4_headwear",
    domain: { x: 795, y: 79, width: 425, height: 313 }, n: 9, field: hatField },
  { key: "eyewear", displayName: "FaceX Eyewear",
    drawableId: "draw_r0_1cea4f6f_9dc00e87_eyewear",
    domain: { x: 850, y: 391, width: 289, height: 135 }, n: 5, field: glassesField }
];

const batch = [];
for (const el of elements) {
  batch.push({
    file: `warp-${el.key}.json`,
    operationId: `op_cp06_warp_${el.key}`,
    operationType: "createWarpDeformer",
    payload: {
      displayName: el.displayName,
      childDrawableIds: [el.drawableId],
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: el.domain,
      transformColumns: el.n, transformRows: el.n,
      bezierColumns: el.n, bezierRows: el.n,
      bezierEditType: "cubicBezierSurfaceV1"
    },
    gitMessage: `[cp06] warp ${el.displayName} (${el.n}x${el.n})`
  });
}
for (const el of elements) {
  batch.push({
    file: `key-${el.key}.json`,
    operationId: `op_cp06_key_${el.key}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: `rig_facex_${el.key}` },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_x",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, el.field, -1) },
        default: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, el.field, 0) },
        max: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, el.field, +1) }
      }
    },
    gitMessage: `[cp06] key ${el.displayName} face_angle_x (createEndsCenter)`
  });
}

// --- back_top_hair top-row rewrite (updateCurrent, rows 2-5 preserved verbatim) ---
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
    // assertion: committed top row must still be the cp05 chord-only interim
    for (let c = 0; c < el.n; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
      const expect = round2(CHORD * (x - CX));
      if (Math.abs(committed[c].x - expect) > 0.02)
        throw new Error(`top row drift at ${el.key} col ${c}: ${committed[c].x} vs ${expect}`);
    }
    const value = committed.map((p) => ({ x: p.x, y: p.y }));
    for (let c = 0; c < el.n; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
      const f = hatField(x, el.domain.y); // shared formula = the hat's own field
      value[c] = { x: round2(keyVal > 0 ? f.plus : f.minus), y: 0 };
    }
    batch.push({
      file: `key-${el.key}-${label}.json`,
      operationId: `op_cp06_key_${el.key}_${label}`,
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
      gitMessage: `[cp06] key ${el.key} face_angle_x ${label} top row = hat brim formula (updateCurrent)`
    });
  }
}

writeFileSync(new URL("batch-rig.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log(`batch-rig.json: ${batch.length} ops`);

// design-log tables
console.log("\nhat rows (y=100 ear-tips / 170 freeze line / 264 occiput top / 330 brim / 382 flap tip):");
for (const y of [100, 170, 264, 330, 382]) {
  const cells = [];
  for (const x of [808, 900, 1001, 1100, 1206]) {
    const f = hatField(x, y);
    cells.push(`u=${x - CX}:+${round2(f.plus)}/${round2(f.minus)}`);
  }
  console.log(` y=${y}`, cells.join("  "));
}
console.log("\nglasses (affine):");
for (const x of [862, 927, 997, 1067, 1127]) {
  const f = glassesField(x, 460);
  console.log(` x=${x}: +${round2(f.plus)}/${round2(f.minus)}`);
}
console.log("\nocciput new top rows:");
for (const el of occ) {
  const cells = [];
  for (let c = 0; c < el.n; c++) {
    const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
    const f = hatField(x, el.domain.y);
    cells.push(`u=${Math.round(x - CX)}:+${round2(f.plus)}/${round2(f.minus)}`);
  }
  console.log(` ${el.key} y=${el.domain.y}`, cells.join("  "));
}
