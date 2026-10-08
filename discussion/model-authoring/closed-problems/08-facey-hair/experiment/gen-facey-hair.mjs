// cp08: FaceY hair system + eyewear — 8 FaceY warp deformers wrapping the committed
// FaceX towers (hair_front / hair_f_l / hair_f_r / back_hair_l / back_hair_r /
// back_top_hair_l / back_top_hair_r / eyewear), keys on param_face_angle_y.
//
// This file is the PRIMARY SOURCE of every cp08 number.
//
// ============================= PHYSICS FRAME =================================
// cp07 canon (recovered from committed FaceY facial-core fields, no external
// numbers): CY = 459 (vertical rotation axis, ear height), D = 30 deg,
//   dy_min(point) = G_DN * (chord + SIN*z)     min = downward turn (nod)
//   dy_max(point) = G_UP * (chord - SIN*z)     max = upward turn
//   chord = v*(COS-1), v = y - CY, dx = 0 everywhere.
// G_DN = 0.1875 (full canon gain), G_UP = 0.15 (= 0.8*G_DN, cp07 asymmetry).
//
// z profiles = THE SAME SHELLS AS THE COMMITTED X IMPLEMENTATION of each
// material, evaluated as vertical cross-sections (the shell is the 3D surface
// of the material; X and Y read the same z at every point):
//   front hair + side tufts: z = 320*(1-(u/320)^2)*capS(y)
//   back-hair curtains:      z = -320*(1-(u/650)^2)*capS(y)
//   capS(y): spherical cap above EQ463 (pole y143, R320), cylinder 1 below.
// NOTE: the X curtains carry an occlusion multiplier q(y)=1/6 at the root.
// q is an X-occlusion constraint (horizontal exposure of hidden root edges
// behind the bangs), NOT part of the physical shell — it is not transposed.
// Y occlusion is checked separately on renders (vertical slide of hidden top
// edges happens behind occluders with large vertical extent; see design-log).
//
// ========================= GRAVITY DECAY PROFILES ============================
// The new unknown of cp08. Per user language: near the root the strand follows
// the head (spherical law wins); at the tip gravity wins and the strand keeps
// hanging (dy -> 0). Implementation: a weight W(y) multiplying the WHOLE
// spherical displacement (chord included — a hanging tip follows nothing):
//   W(y) = 1                          for y <= Y_HEAD  (contact with the skull)
//        = 1 - (1-W_TIP)*smooth(t)    across the transition band
//        = W_TIP                      below (free-hanging zone)
// Boundary placement principle (the "gravity vs sphere border"):
//   Y_HEAD = the row where the strand loses contact with the skull (the head
//   can only push hair it touches); the transition distance scales with the
//   free-hanging length below (a longer pendulum distributes the
//   accommodation over more length).
//   - front hair: NEVER loses contact (plastered on the forehead/temples,
//     face-governed) -> no border; only a light tip decay to W_TIP=0.7 over
//     the long side fringes (y500..773). Central bangs rows (y<500) are W=1,
//     which keeps them riding just above the eye/brow fields (lead 1-3px,
//     outer-shell physics).
//   - side tufts: leave the head at the jaw line (y~577) -> Y_HEAD=550,
//     transition 550->900 (free length ~400px), W_TIP=0 (tips rest on the
//     shoulders/chest and do not follow at all).
//   - back curtains: leave the skull at the nape (y~500) -> Y_HEAD=500,
//     transition 500->1000 (longest material, free length ~1300px; the nod is
//     fully absorbed by the shoulder-blade line), W_TIP=0. Everything below
//     y1000 (waist-length mass) stays hanging — "tips keep hanging" gestalt.
// The vertical squash this creates (root moves, tip doesn't) IS the intra-
// element scale that narrates the angle for hair — no extra foreshortening
// term is needed (cp07fix law: scale must speak the displacement's angle; the
// gravity gradient supplies it constructively, ~20px over the band).
//
// ===================== BACK_TOP_HAIR (provisional->recover) ==================
// Same transposition as X (cp05fix): the layer is the visible surface of the
// back of the skull between hat and curtains.
//   dy_bt(u,y) = R(y) * dy_curtain(u,y),  R(y) = clamp((y-264)/(769-264),0,1)
// - top row (y257/252, under the static-in-Y hat): R=0 -> dy=0 exactly. This
//   is the PROVISIONAL to be rewritten together with the hat in cp09 (the X
//   precedent: cp06 rewrote the X top row with the hat formula).
// - bottom (drawn edge y769) : R=1 -> equals the curtain formula at the same
//   point = formula-level sync of the curtain root (X lesson, 3rd instance).
// - interior: a ramped fraction of the occiput spherical field = plausible
//   skull-back vertical displacement (NOT frozen), so the diagonal
//   (down+sideways) exposure shows a plausibly-moving surface: mid-band rises
//   ~7-14px on min, scaled continuously between hat (0) and curtain root.
//
// ============================== EYEWEAR ======================================
// Recipe 07 "rigid low-order field", Y transposition (zero-unknown re-test).
// Sample the COMMITTED FaceY eye-tower fields (cp07+cp07fix, incl. the squash
// whose mean is preserved at the aperture centers) at the lens anchor points
// (x1067,y439) on eye_l and (x927,y448) on eye_r — the rest eyewhite centers,
// i.e. the points the lenses must keep riding. Rigid field:
//   dy_key(y) = gain_key*(COS-1)*(y-CY) + D_key      (affine: translation +
//   uniform vertical shrink at the gained chord strength, as the X eyewear)
//   D_key anchored so dy(y_anchor) = 1.05 * S_key (lead 1.05 over the eye
//   field, X precedent).
// The eye aperture squashes 12.5% inside the lens on min; the lens itself
// stays rigid (correct rigid-body behaviour, X world-line: gained chord).
//
// ============================ GRID / DOMAINS =================================
// Domains = FaceX child domain + margin x±36 (absorbs FaceX ±30 displacement),
// y±40 (absorbs own FaceY movement ~30px), cp07 rule.
// Grids ("material size x field curvature"; hair = vertically huge material +
// decay gradient => vertically fine lattices; bezier = transform divisions):
//   hair_front 11x11 (X grid; cap curvature only, mild W tail)
//   tufts      7 cols x 11 rows (X 7x7 + 2 steps finer vertically: smoothstep)
//   curtains   11 cols x 13 rows (X 11x11 + 2 steps finer vertically:
//              cap + smoothstep over 500px on a 1600px domain)
//   back_top   5 cols x 7 rows (ramp x shell product, low curvature)
//   eyewear    5x5 (affine field, bilinear-exact at minimum stock)
//
// Usage:
//   node gen-facey-hair.mjs          -> asserts + snapshot + batch-rig.json + probes
//   node gen-facey-hair.mjs verify   -> post-commit untouched-guarantee check
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

// ---- canon frame (cp07) ----
const CX = 1001, CY = 459;
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const G_DN = 0.1875, G_UP = 0.15;
const EQ = 463, APEX_R = 320; // cap: pole y143 = EQ - APEX_R
const U_HAIR = 320, U_SPREAD = 650, Z_FRONT = 320, Z_BACK = 320;

const capS = (y) => (y >= EQ ? 1 : Math.sqrt(Math.max(0, 1 - ((EQ - y) / APEX_R) ** 2)));
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// ---- shells (committed X implementation, vertical cross-section) ----
const shellFront = (x, y) => {
  const u = x - CX;
  return Z_FRONT * Math.max(0, 1 - (u / U_HAIR) ** 2) * capS(y);
};
const shellBack = (x, y) => {
  const u = x - CX;
  return -Z_BACK * Math.max(0, 1 - (u / U_SPREAD) ** 2) * capS(y);
};

// ---- gravity decay dials (the cp08 design objects) ----
const W_FRONT = { yHead: 500, yFree: 773, wTip: 0.7 };  // plastered; light tail
const W_TUFT  = { yHead: 550, yFree: 900, wTip: 0 };    // leaves head at jaw y~577
const W_CURT  = { yHead: 500, yFree: 1000, wTip: 0 };   // leaves skull at nape y~500
const weight = ({ yHead, yFree, wTip }) => (y) =>
  y <= yHead ? 1 : 1 - (1 - wTip) * smooth((y - yHead) / (yFree - yHead));

// ---- spherical displacement (gained; W multiplies the whole thing) ----
const sphere = (shell, wOf) => (x, y) => {
  const v = y - CY, chord = v * (COS - 1), z = shell(x, y), w = wOf(y);
  return { min: w * G_DN * (chord + SIN * z), max: w * G_UP * (chord - SIN * z) };
};

const fieldFront = sphere(shellFront, weight(W_FRONT));
const fieldTuft  = sphere(shellFront, weight(W_TUFT));
const fieldCurt  = sphere(shellBack, weight(W_CURT));

// back_top_hair: ramp of the curtain field, 0 at the hat line, sync at y769
const R_BT = (y) => Math.min(1, Math.max(0, (y - 264) / (769 - 264)));
const fieldBT = (x, y) => {
  const c = fieldCurt(x, y), r = R_BT(y);
  return { min: r * c.min, max: r * c.max };
};

// ---- committed model files ----
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const rcRaw = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8"));
const rcs = rcRaw.rigControls ?? rcRaw;
const rcById = (id) => rcs.find((r) => r.rigControlId === id);
const setOf = (id, param) => kfs.find((s) => s.target?.id === id && s.parameterId === param);

// ---- eyewear: sample committed FaceY eye fields at the lens anchors ----
const bilin = (ctrl, patch, x, y) => {
  const d = ctrl.domainBounds, n = ctrl.latticeColumns, m = ctrl.latticeRows;
  const fx = ((x - d.x) / d.width) * (n - 1), fy = ((y - d.y) / d.height) * (m - 1);
  const c0 = Math.max(0, Math.min(n - 2, Math.floor(fx))), r0 = Math.max(0, Math.min(m - 2, Math.floor(fy)));
  const tx = fx - c0, ty = fy - r0;
  const p = (r, c) => patch[r * n + c].y;
  return (
    p(r0, c0) * (1 - tx) * (1 - ty) + p(r0, c0 + 1) * tx * (1 - ty) +
    p(r0 + 1, c0) * (1 - tx) * ty + p(r0 + 1, c0 + 1) * tx * ty
  );
};
const LENS = [
  { eye: "rig_facey_eye_l", x: 1067, y: 439 }, // rest eyewhite center L
  { eye: "rig_facey_eye_r", x: 927, y: 448 }   // rest eyewhite center R
];
const LEAD = 1.05;
const sampleEye = (keyVal) => {
  let sum = 0;
  for (const a of LENS) {
    const ctrl = rcById(a.eye);
    const patch = setOf(a.eye, "param_face_angle_y").keys.find((k) => k.value === keyVal).statePatch;
    sum += bilin(ctrl, patch, a.x, a.y);
  }
  return sum / LENS.length;
};
const Y_ANCHOR = (LENS[0].y + LENS[1].y) / 2; // 443.5
const S_MIN = sampleEye(-30), S_MAX = sampleEye(30);
const SLOPE_MIN = G_DN * (COS - 1), SLOPE_MAX = G_UP * (COS - 1);
const D_MIN = LEAD * S_MIN - SLOPE_MIN * (Y_ANCHOR - CY);
const D_MAX = LEAD * S_MAX - SLOPE_MAX * (Y_ANCHOR - CY);
const fieldEyewear = (x, y) => ({
  min: SLOPE_MIN * (y - CY) + D_MIN,
  max: SLOPE_MAX * (y - CY) + D_MAX
});

// ---- element table ----
// domains = committed FaceX domain + x±36, y±40 (asserted below)
const ELEMENTS = [
  { key: "hair_front", displayName: "FaceY Hair Front", wrap: "rig_facex_hair_front",
    domain: { x: 619, y: 95, width: 764, height: 718 }, cols: 11, rows: 11, f: fieldFront },
  { key: "hair_f_r", displayName: "FaceY Hair F R", wrap: "rig_facex_hair_f_r",
    domain: { x: 972, y: 187, width: 360, height: 801 }, cols: 7, rows: 11, f: fieldTuft },
  { key: "hair_f_l", displayName: "FaceY Hair F L", wrap: "rig_facex_hair_f_l",
    domain: { x: 659, y: 227, width: 346, height: 779 }, cols: 7, rows: 11, f: fieldTuft },
  { key: "back_hair_r", displayName: "FaceY Back Hair R", wrap: "rig_facex_back_hair_r",
    domain: { x: 339, y: 270, width: 734, height: 1600 }, cols: 11, rows: 13, f: fieldCurt },
  { key: "back_hair_l", displayName: "FaceY Back Hair L", wrap: "rig_facex_back_hair_l",
    domain: { x: 931, y: 232, width: 609, height: 1585 }, cols: 11, rows: 13, f: fieldCurt },
  { key: "back_top_hair_r", displayName: "FaceY Back Top Hair R", wrap: "rig_facex_back_top_hair_r",
    domain: { x: 747, y: 217, width: 268, height: 605 }, cols: 5, rows: 7, f: fieldBT },
  { key: "back_top_hair_l", displayName: "FaceY Back Top Hair L", wrap: "rig_facex_back_top_hair_l",
    domain: { x: 986, y: 212, width: 268, height: 605 }, cols: 5, rows: 7, f: fieldBT },
  { key: "eyewear", displayName: "FaceY Eyewear", wrap: "rig_facex_eyewear",
    domain: { x: 814, y: 351, width: 361, height: 215 }, cols: 5, rows: 5, f: fieldEyewear }
];

const round2 = (n) => Math.round(n * 100) / 100;
const grid = (el, which) => {
  const out = [];
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      out.push({ x: 0, y: which === 0 ? 0 : round2(el.f(x, y)[which > 0 ? "max" : "min"]) });
    }
  }
  return out;
};

// ---- assert A: domains really are FaceX domain + (36,40) margin ----
for (const el of ELEMENTS) {
  const xd = rcById(el.wrap).domainBounds;
  const ok = el.domain.x === xd.x - 36 && el.domain.y === xd.y - 40 &&
    el.domain.width === xd.width + 72 && el.domain.height === xd.height + 80;
  if (!ok) throw new Error(`${el.key}: domain/margin mismatch vs committed FaceX domain ${JSON.stringify(xd)}`);
}

// ---- assert B: committed X fields of the 8 wrap targets match the cp05/06
// formulas (drift / human-correction detection; the committed keyforms are the
// truth — this proves the shells transposed here ARE the committed shells) ----
const CH = G_DN * (COS - 1); // -0.02512 (X chord coefficient, same gain canon)
const ZC = G_DN * SIN;       // 0.09375
const qX = (y) => (y <= 769 ? 1 / 6 : y >= 1150 ? 1 : 1 / 6 + (1 - 1 / 6) * smooth((y - 769) / (1150 - 769)));
const xFieldOf = {
  rig_facex_hair_front: (x, y, s) => CH * (x - CX) + s * ZC * shellFront(x, y),
  rig_facex_hair_f_r: (x, y, s) => CH * (x - CX) + s * ZC * shellFront(x, y),
  rig_facex_hair_f_l: (x, y, s) => CH * (x - CX) + s * ZC * shellFront(x, y),
  rig_facex_back_hair_r: (x, y, s) => CH * (x - CX) * (320 / 650) + s * ZC * shellBack(x, y) * qX(y),
  rig_facex_back_hair_l: (x, y, s) => CH * (x - CX) * (320 / 650) + s * ZC * shellBack(x, y) * qX(y),
  rig_facex_eyewear: (x, y, s) => CH * (x - CX) + s * 20.5
};
for (const [id, f] of Object.entries(xFieldOf)) {
  const ctrl = rcById(id), set = setOf(id, "param_face_angle_x");
  const d = ctrl.domainBounds, n = ctrl.latticeColumns, m = ctrl.latticeRows;
  for (const key of set.keys) {
    if (key.value === 0) continue;
    const s = key.value > 0 ? 1 : -1;
    for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) {
      const x = d.x + (d.width * c) / (n - 1), y = d.y + (d.height * r) / (m - 1);
      const got = key.statePatch[r * n + c];
      if (Math.abs(got.x - f(x, y, s)) > 0.06 || Math.abs(got.y) > 0.001)
        throw new Error(`X drift ${id}@${key.value} node ${r},${c}: got (${got.x},${got.y}) want ${f(x, y, s).toFixed(3)}`);
    }
  }
}
// back_top_hair X: interior rows = cp05fix formula, TOP ROW = cp06fix hat formula
// (human-era canon; only checked to be non-empty + dy!=0 signature, values are
// whatever cp06fix committed — we never touch them)
for (const id of ["rig_facex_back_top_hair_r", "rig_facex_back_top_hair_l"]) {
  const ctrl = rcById(id), set = setOf(id, "param_face_angle_x");
  const d = ctrl.domainBounds, n = ctrl.latticeColumns, m = ctrl.latticeRows;
  for (const key of set.keys) {
    if (key.value === 0) continue;
    const s = key.value > 0 ? 1 : -1;
    for (let r = 1; r < m; r++) for (let c = 0; c < n; c++) {
      const x = d.x + (d.width * c) / (n - 1), y = d.y + (d.height * r) / (m - 1);
      const z = -320 * (1 / 6) * (1 - ((x - CX) / 650) ** 2) * Math.min(1, Math.max(0, (y - 264) / 505));
      const want = CH * (x - CX) + s * ZC * z;
      const got = key.statePatch[r * n + c];
      if (Math.abs(got.x - want) > 0.06 || Math.abs(got.y) > 0.001)
        throw new Error(`X drift ${id}@${key.value} node ${r},${c}`);
    }
  }
}
console.log("assert B OK: committed X fields of all 8 wrap targets match the cp05/06 formulas");

const mode = process.argv[2] ?? "gen";

// canonical JSON (sorted keys) — property order changes when the editor
// re-serializes a control after re-parenting; content is what matters
const canon = (o) =>
  JSON.stringify(o, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]))
      : v
  );

if (mode === "verify") {
  const snap = JSON.parse(readFileSync(new URL("snapshot-pre.json", HERE), "utf8"));
  const design = JSON.parse(readFileSync(new URL("design-values.json", HERE), "utf8"));
  // 1. every pre-existing keyformSet byte-identical (positional compare; sigs
  //    are NOT unique per set — e.g. opacity + offsets sets share target+param)
  const newSigs = new Set(design.map((d) => d.sig));
  const oldSets = [], addedSets = [];
  for (const s of kfs) {
    const sig = `${s.target?.kind}:${s.target?.id}:${s.parameterId}`;
    (newSigs.has(sig) ? addedSets : oldSets).push({ sig, s });
  }
  if (oldSets.length !== snap.sets.length)
    throw new Error(`pre-existing set count ${oldSets.length} != snapshot ${snap.sets.length}`);
  for (let i = 0; i < oldSets.length; i++) {
    const { sig, s } = oldSets[i], pre = snap.sets[i];
    if (sig !== pre.sig) throw new Error(`set order drift at ${i}: ${pre.sig} -> ${sig}`);
    const cur = s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }));
    if (JSON.stringify(cur) !== JSON.stringify(pre.keys))
      throw new Error(`UNTOUCHED KEYFORM SET CHANGED: ${sig}`);
  }
  const untouched = oldSets.length;
  for (const { sig, s } of addedSets) {
    const d = design.find((d) => d.sig === sig);
    for (const k of s.keys) {
      const want = d.keys.find((w) => w.value === k.value);
      if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
        throw new Error(`new set ${sig}@${k.value} does not match design values`);
    }
  }
  if (addedSets.length !== 8) throw new Error(`expected 8 new sets, got ${addedSets.length}`);
  const added = addedSets.length;
  // 2. rig-controls: pre-existing unchanged except parentId of the 8 targets
  const preRc = new Map(snap.rigControls.map((r) => [r.id, r]));
  const wrapParent = new Map(ELEMENTS.map((el) => [el.wrap, `rig_facey_${el.key}`]));
  let newRc = 0;
  for (const r of rcs) {
    const pre = preRc.get(r.rigControlId);
    if (!pre) {
      const el = ELEMENTS.find((e) => `rig_facey_${e.key}` === r.rigControlId);
      if (!el) throw new Error(`unexpected new rig control ${r.rigControlId}`);
      const db = r.domainBounds;
      if (r.latticeColumns !== el.cols || r.latticeRows !== el.rows ||
        db.x !== el.domain.x || db.y !== el.domain.y ||
        db.width !== el.domain.width || db.height !== el.domain.height)
        throw new Error(`new control ${r.rigControlId}: lattice/domain mismatch`);
      newRc++;
      continue;
    }
    const expParent = wrapParent.get(r.rigControlId) ?? pre.parentId;
    const cur = canon({ ...r, parentId: null });
    const preCanon = canon(JSON.parse(pre.jsonNoParent));
    if (cur !== preCanon) throw new Error(`RIG CONTROL CHANGED beyond re-parent: ${r.rigControlId}`);
    if ((r.parentId ?? null) !== (expParent ?? null))
      throw new Error(`parentId of ${r.rigControlId}: ${r.parentId} != expected ${expParent}`);
    preRc.delete(r.rigControlId);
  }
  if (preRc.size) throw new Error(`rig controls disappeared: ${[...preRc.keys()].join(",")}`);
  if (newRc !== 8) throw new Error(`expected 8 new rig controls, got ${newRc}`);
  console.log(`verify OK: ${untouched} pre-existing keyform sets byte-identical; 8 new sets match design; re-parent-only changes on the 8 wrapped towers (+${newRc} new controls)`);
  process.exit(0);
}

// ---- snapshot (first run only) ----
if (!existsSync(new URL("snapshot-pre.json", HERE))) {
  writeFileSync(new URL("snapshot-pre.json", HERE), JSON.stringify({
    sets: kfs.map((s) => ({
      sig: `${s.target?.kind}:${s.target?.id}:${s.parameterId}`,
      keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
    })),
    rigControls: rcs.map((r) => ({
      id: r.rigControlId, parentId: r.parentId ?? null,
      jsonNoParent: JSON.stringify({ ...r, parentId: null })
    }))
  }));
  console.log("snapshot-pre.json written (pre-cp08 committed state)");
}

// ---- design values + batch ----
const design = [];
const batch = [];
for (const el of ELEMENTS) {
  batch.push({
    file: `warp-${el.key}.json`,
    operationId: `op_cp08_warp_${el.key}`,
    operationType: "createWarpDeformer",
    payload: {
      displayName: el.displayName,
      childDrawableIds: [],
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: el.domain,
      transformColumns: el.cols, transformRows: el.rows,
      bezierColumns: el.cols, bezierRows: el.rows,
      bezierEditType: "cubicBezierSurfaceV1",
      wrapChildren: [{ kind: "rigControl", id: el.wrap }]
    },
    gitMessage: `[cp08] warp ${el.displayName} (${el.cols}x${el.rows}) wrapping ${el.wrap}`
  });
}
for (const el of ELEMENTS) {
  const patches = {
    min: { propertyPath: "controlPointOffsets", value: grid(el, -1) },
    default: { propertyPath: "controlPointOffsets", value: grid(el, 0) },
    max: { propertyPath: "controlPointOffsets", value: grid(el, +1) }
  };
  design.push({
    sig: `rigControl:rig_facey_${el.key}:param_face_angle_y`,
    keys: [
      { value: -30, statePatch: patches.min.value },
      { value: 0, statePatch: patches.default.value },
      { value: 30, statePatch: patches.max.value }
    ]
  });
  batch.push({
    file: `key-${el.key}.json`,
    operationId: `op_cp08_key_${el.key}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: `rig_facey_${el.key}` },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_y",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: patches
    },
    gitMessage: `[cp08] key ${el.displayName} face_angle_y (createEndsCenter)`
  });
}
writeFileSync(new URL("design-values.json", HERE), JSON.stringify(design));
writeFileSync(new URL("batch-rig.json", HERE), JSON.stringify(batch, null, 2));
console.log(`batch-rig.json: ${batch.length} ops`);

// ---- probes (design-log tables) ----
console.log(`\neyewear sampling: S_min=${S_MIN.toFixed(2)} S_max=${S_MAX.toFixed(2)} @y${Y_ANCHOR}` +
  ` -> D_min=${round2(D_MIN)} D_max=${round2(D_MAX)} (lead ${LEAD}, slopes ${SLOPE_MIN.toFixed(5)}/${SLOPE_MAX.toFixed(5)})`);
const probes = [
  ["bangs crown (u0,y200)", 1001, 200, fieldFront],
  ["bangs forehead (u0,y300)", 1001, 300, fieldFront],
  ["bangs brow row (u0,y360)", 1001, 360, fieldFront],
  ["bangs eye row (u-60,y440)", 941, 440, fieldFront],
  ["bangs fringe (u-200,y600)", 801, 600, fieldFront],
  ["bangs tail (u-200,y773)", 801, 773, fieldFront],
  ["tuftR root (u150,y300)", 1151, 300, fieldTuft],
  ["tuftR cheek (u150,y500)", 1151, 500, fieldTuft],
  ["tuftR transition (u150,y700)", 1151, 700, fieldTuft],
  ["tuftR tip (u150,y900+)", 1151, 940, fieldTuft],
  ["curtR root (u-120,y400)", 881, 400, fieldCurt],
  ["curtR nape (u-120,y500)", 881, 500, fieldCurt],
  ["curtR mid transition (u-300,y750)", 701, 750, fieldCurt],
  ["curtR shoulder (u-300,y1000)", 701, 1000, fieldCurt],
  ["curtR tip (u-300,y1500)", 701, 1500, fieldCurt],
  ["btR hat sliver (u-120,y300)", 881, 300, fieldBT],
  ["btR mid (u-120,y500)", 881, 500, fieldBT],
  ["btR sync edge (u-120,y769)", 881, 769, fieldBT],
  ["curt at sync (u-120,y769)", 881, 769, fieldCurt],
  ["eyewear lens top (y401)", 1001, 401, fieldEyewear],
  ["eyewear center (y459)", 1001, 459, fieldEyewear],
  ["eyewear lens bottom (y516)", 1001, 516, fieldEyewear]
];
console.log("\nprobe                                v      min(down,+y)  max(up)");
for (const [name, x, y, f] of probes) {
  const r = f(x, y);
  console.log(` ${name.padEnd(34)} ${String(Math.round(y - CY)).padStart(5)}   ${round2(r.min).toString().padStart(9)}   ${round2(r.max).toString().padStart(9)}`);
}
