// cp10fix: collar rim-loop staging + waist-pin band compression.
// Gate diagnosis (user-worded, agreed with L0): the collar is a RIM LOOP wound
// around the neck (same volumetric class as a hat brim, recipe 07). cp10 solved
// it as a torso-shell sticker: physically right, but it reads "slid", not
// "turned". This fix adds the staging (演出) on top of the untouched physics:
//
//   F1 (collar band, topwear rows 0..3 + tie knot rows 0..1):
//     1. center (placket / knot) translation KEPT and slightly boosted
//        (dial B_CENTER, +10..20% class, applied to the sin term ONLY —
//        recipe 06 displacement/scale agreement law: gain multiplies sin).
//     2. the ROTATION TESTIMONY = asymmetric slope of the two shoulder->neck
//        lines, carried by a dy tilt (recipe 07 technique 2, dy = -k*u*sinD:
//        the rim loop is a tilted 3D loop; under a y-axis turn the drawn edge
//        must show a different part of the loop, which lives at different y).
//        Far side (opposite the facing direction) STEEPENS (the hidden back
//        face of the collar rises into view), near side lies down. This is
//        the deliberate LIE of the staging: a real collar barely deforms —
//        overdoing it is what buys the "seen at an angle" percept.
//     3. the tie knot resamples the SAME field on its own lattice (recipe 06
//        sampling idiom) so the knot rides the deformed collar V exactly.
//   F2 (waist pin band): the immobile band was too tall. Full field is
//     extended down to lattice row FREE_ROW and collapses linearly to 0 at
//     row ZERO_ROW (y1116.9, right at the drawn waistband y1119..1124).
//     Hem rows at/below Y_PIN stay EXACTLY zero (assert PIN kept).
//
// Lattice discipline (craft law 3 generalized to ROWS): every vertical kink
// (V ramp ends, P ramp ends) sits exactly ON a shirt lattice row, and every
// horizontal kink (U_C, U_SH) exactly ON a lattice column — the lattice
// delivers piecewise-linear anyway, so the formula IS piecewise-linear with
// nodes on the lattice: zero resampling error instead of a finer grid.
//
// Untouched guarantee: only 4 keys are rewritten (topwear min/max, tie
// min/max). Everything else — arms, neck (alpha canon for cp11), skirt,
// default keys, all pre-existing sets/meshes/controls — asserted byte-equal.
//
// Usage:
//   node gen-fix-collar.mjs          -> asserts + probes + batch-fix.json
//   node gen-fix-collar.mjs verify   -> post-commit untouched-guarantee
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

// ================================ DIALS =====================================
// (user-facing knobs for the final human calibration pass)
const B_CENTER = 0.15;  // center translation boost (+15%; range 0.10..0.20)
const K_ASYM = 6;     // px, collar tilt amplitude at |u| = U_C (the staging lie)
const V1_ROW = 2;     // shirt row where the collar band ends at full strength
const V0_ROW = 4;     // shirt row where the collar staging has fully faded
const UC_COLS = 2;    // collar half-width in column pitches (2*43 = 86px)
const USH_COLS = 5;   // tilt tent foot in column pitches (5*43 = 215 = U_T)
// F2 waist pin band:
const FREE_ROW = 10;  // last shirt row with the FULL rotation field (y1065.8)
const ZERO_ROW = 11;  // first all-zero row (y1116.9, ~waistband top y1119-1124)

// ---- cp10 canon frame (unchanged, from gen-bodyx-torso.mjs) ----
const CX_B = 997;
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const U_T = 215, Z_T = 150;
const S = 10;
const G_B = S / (SIN * Z_T);
const Y_PIN = 1124;
const chordC = (u) => Math.max(-U_T, Math.min(U_T, u)) * (COS - 1);
const zT = (u) => Z_T * Math.max(0, 1 - (u / U_T) ** 2);

// ---- committed model files ----
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const rcRaw = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8"));
const rcs = rcRaw.rigControls ?? rcRaw;
const meshRaw = JSON.parse(readFileSync(`${PKG}/model/meshes.json`, "utf8"));
const meshes = meshRaw.meshes ?? meshRaw;
const rcById = (id) => rcs.find((r) => r.rigControlId === id);
const setOf = (id) => kfs.find((s) => s.target?.id === id && s.parameterId === "param_body_angle_x");
const keyOf = (set, v) => set.keys.find((k) => k.value === v);
const patchArr = (key) => {
  const p = key.statePatch;
  return Array.isArray(p) ? p : Object.keys(p).map(Number).sort((a, b) => a - b).map((i) => p[i]);
};

const TOP = rcById("rig_bodyx_topwear"), TIE = rcById("rig_bodyx_tie");
const topSet = setOf("rig_bodyx_topwear"), tieSet = setOf("rig_bodyx_tie");
const rowY = (rc, r) => rc.domainBounds.y + (rc.domainBounds.height * r) / (rc.latticeRows - 1);
const colX = (rc, c) => rc.domainBounds.x + (rc.domainBounds.width * c) / (rc.latticeColumns - 1);

// ---- lattice-derived staging geometry (all kinks on nodes) ----
const PITCH_X = TOP.domainBounds.width / (TOP.latticeColumns - 1);        // 43
if (Math.abs(colX(TOP, 6) - CX_B) > 1e-9) throw new Error("center column drifted off the spine axis");
const U_C = UC_COLS * PITCH_X;                                            // 86
const U_SH = USH_COLS * PITCH_X;                                          // 215
if (Math.abs(U_SH - U_T) > 1e-9) throw new Error("tilt tent foot must sit on the silhouette kink");
const Y_V1 = rowY(TOP, V1_ROW), Y_V0 = rowY(TOP, V0_ROW);                 // 657.17 / 759.33
const Y_FREE = rowY(TOP, FREE_ROW), Y_ZERO = rowY(TOP, ZERO_ROW);         // 1065.83 / 1116.92
if (Y_ZERO >= Y_PIN) throw new Error("ZERO_ROW must sit above the pin line");
if (rowY(TOP, TOP.latticeRows - 1) < Y_PIN) throw new Error("no lattice row at/below the pin line");

// ---- fix formulas ----
// collar vertical envelope (PL, nodes on shirt rows V1_ROW / V0_ROW)
const V = (y) => y <= Y_V1 ? 1 : y >= Y_V0 ? 0 : (Y_V0 - y) / (Y_V0 - Y_V1);
// F2 pin profile (PL, nodes on shirt rows FREE_ROW / ZERO_ROW; 0 down to the hem)
const P_FIX = (y) => y <= Y_FREE ? 1 : y >= Y_ZERO ? 0 : (Y_ZERO - y) / (Y_ZERO - Y_FREE);
// center boost envelope (parabola over the collar width)
const Cb = (u) => Math.max(0, 1 - (u / U_C) ** 2);
// tilt tent: linear through 0 up to +/-1 at |u|=U_C, back to 0 at |u|=U_SH
const T = (u) => {
  const a = Math.abs(u);
  if (a >= U_SH) return 0;
  if (a <= U_C) return u / U_C;
  return Math.sign(u) * (U_SH - a) / (U_SH - U_C);
};
// sin-term-only boost (agreement law: gain multiplies the sin part, the chord
// keeps narrating the same effective angle)
const sphBoost = (x, v) => {
  const u = x - CX_B, boost = 1 + B_CENTER * Cb(u) * v;
  return {
    min: G_B * (chordC(u) - boost * SIN * zT(u)),
    max: G_B * (chordC(u) + boost * SIN * zT(u))
  };
};
// shirt: F1 staging above, F2 pin profile below (bands do not overlap:
// V=0 at/below row V0_ROW, P_FIX=1 at/above row FREE_ROW, V0_ROW < FREE_ROW)
const fieldShirtFix = (x, y) => {
  const v = V(y), p = P_FIX(y), s = sphBoost(x, v), dy = K_ASYM * T(x - CX_B) * v;
  return { min: { x: p * s.min, y: -dy }, max: { x: p * s.max, y: dy } };
};
// tie: same staging field resampled on the tie lattice (the knot follows the
// collar V constructively); vertical envelope = V sampled at TIE ROWS, linear
// between (the lattice delivers PL anyway — declaring the resampled profile as
// the design formula makes lattice == formula exact, and the true seam
// mismatch vs the shirt is measured by assert FOLLOW below)
const tieRowYs = Array.from({ length: TIE.latticeRows }, (_, r) => rowY(TIE, r));
const tieRowV = tieRowYs.map(V);
const Vtie = (y) => {
  if (y <= tieRowYs[0]) return tieRowV[0];
  for (let r = 0; r + 1 < tieRowYs.length; r++) {
    if (y <= tieRowYs[r + 1]) {
      const t = (y - tieRowYs[r]) / (tieRowYs[r + 1] - tieRowYs[r]);
      return tieRowV[r] * (1 - t) + tieRowV[r + 1] * t;
    }
  }
  return 0;
};
const fieldTieFix = (x, y) => {
  const v = Vtie(y), s = sphBoost(x, v), dy = K_ASYM * T(x - CX_B) * v;
  return { min: { x: s.min, y: -dy }, max: { x: s.max, y: dy } };
};

const mode = process.argv[2] ?? "gen";

// ---- assert PRE: committed keys == cp10 design OR == a previous run of this
// fix (dial re-adjustment). Anything else means a human edit landed under us:
// STOP (recipe 07: machine regeneration over a human-corrected field is
// forbidden). gen mode only — verify checks the keys against GRIDS instead.
if (mode !== "verify") {
  const candidates = [];
  {
    const d = JSON.parse(readFileSync(new URL("design-values.json", HERE), "utf8"));
    candidates.push(["cp10 design", (id, v) =>
      d.find((x) => x.sig === `rigControl:rig_bodyx_${id}:param_body_angle_x`)
        .keys.find((k) => k.value === v).statePatch]);
  }
  const FIXD = new URL("design-fix.json", HERE);
  if (existsSync(FIXD)) {
    const d = JSON.parse(readFileSync(FIXD, "utf8"));
    candidates.push(["previous fix design", (id, v) =>
      v === 0 ? null : d[id][v < 0 ? "min" : "max"]]);
  }
  const matches = (getWant) => {
    for (const id of ["topwear", "tie"]) {
      const set = setOf(`rig_bodyx_${id}`);
      for (const v of [-10, 0, 10]) {
        const want = getWant(id, v);
        if (want === null) continue; // fix design leaves the default key alone
        const got = patchArr(keyOf(set, v));
        if (got.length !== want.length) return false;
        for (let i = 0; i < got.length; i++)
          if (Math.abs(got[i].x - want[i].x) > 1e-9 || Math.abs(got[i].y - (want[i].y ?? 0)) > 1e-9) return false;
      }
    }
    return true;
  };
  const hit = candidates.find(([, getWant]) => matches(getWant));
  if (!hit) throw new Error("PRE: committed topwear/tie keys match neither cp10 design nor the previous fix design — possible human edit, STOP");
  console.log(`assert PRE OK: committed topwear/tie keys byte-match ${hit[0]} (no human edits under us)`);
}

// ---- grids ----
const round2 = (n) => Math.round(n * 100) / 100;
const gridFix = (rc, f, which) => {
  const d = rc.domainBounds, cols = rc.latticeColumns, rows = rc.latticeRows, out = [];
  for (let r = 0; r < rows; r++) {
    const y = d.y + (d.height * r) / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const x = d.x + (d.width * c) / (cols - 1);
      const p = f(x, y)[which];
      out.push({ x: round2(p.x), y: round2(p.y) });
    }
  }
  return out;
};
const GRIDS = {
  topwear: { min: gridFix(TOP, fieldShirtFix, "min"), max: gridFix(TOP, fieldShirtFix, "max") },
  tie: { min: gridFix(TIE, fieldTieFix, "min"), max: gridFix(TIE, fieldTieFix, "max") }
};

// ---- assert GRID: bilinear error vs formula <= 0.8px (both dx and dy) ----
const bilinPt = (rc, f, which, x, y) => {
  const d = rc.domainBounds, n = rc.latticeColumns, m = rc.latticeRows;
  const fx = ((x - d.x) / d.width) * (n - 1), fy = ((y - d.y) / d.height) * (m - 1);
  const c0 = Math.max(0, Math.min(n - 2, Math.floor(fx))), r0 = Math.max(0, Math.min(m - 2, Math.floor(fy)));
  const tx = fx - c0, ty = fy - r0;
  const node = (r, c) => f(d.x + (d.width * c) / (n - 1), d.y + (d.height * r) / (m - 1))[which];
  const mix = (k) => node(r0, c0)[k] * (1 - tx) * (1 - ty) + node(r0, c0 + 1)[k] * tx * (1 - ty) +
    node(r0 + 1, c0)[k] * (1 - tx) * ty + node(r0 + 1, c0 + 1)[k] * tx * ty;
  return { x: mix("x"), y: mix("y") };
};
for (const [name, rc, f] of [["topwear", TOP, fieldShirtFix], ["tie", TIE, fieldTieFix]]) {
  const d = rc.domainBounds;
  let worst = 0;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const x = d.x + (d.width * i) / 24, y = d.y + (d.height * j) / 24;
    for (const which of ["min", "max"]) {
      const b = bilinPt(rc, f, which, x, y), t = f(x, y)[which];
      worst = Math.max(worst, Math.abs(b.x - t.x), Math.abs(b.y - t.y));
    }
  }
  if (worst > 0.8) throw new Error(`${name}: lattice too coarse for the fix field (${worst.toFixed(3)}px)`);
  console.log(`assert GRID OK: ${name} bilinear err ${worst.toFixed(3)}px (kinks on nodes)`);
}

// ---- assert FOLD (x+dx monotone per row) and VFOLD (y+dy monotone per col) ----
for (const [name, rc, f] of [["topwear", TOP, fieldShirtFix], ["tie", TIE, fieldTieFix]]) {
  const d = rc.domainBounds, cols = rc.latticeColumns, rows = rc.latticeRows;
  for (const which of ["min", "max"]) {
    for (let r = 0; r < rows; r++) {
      const y = d.y + (d.height * r) / (rows - 1);
      let prev = -Infinity;
      for (let c = 0; c < cols; c++) {
        const x = d.x + (d.width * c) / (cols - 1);
        const m = x + f(x, y)[which].x;
        if (m <= prev) throw new Error(`fold in ${name} row y=${y} ${which}`);
        prev = m;
      }
    }
    for (let c = 0; c < cols; c++) {
      const x = d.x + (d.width * c) / (cols - 1);
      let prev = -Infinity;
      for (let r = 0; r < rows; r++) {
        const y = d.y + (d.height * r) / (rows - 1);
        const m = y + f(x, y)[which].y;
        if (m <= prev) throw new Error(`vertical fold in ${name} col x=${x} ${which}`);
        prev = m;
      }
    }
  }
}
console.log("assert FOLD/VFOLD OK: no horizontal or vertical fold on any lattice line");

// ---- assert PIN: shirt rows at/below Y_ZERO are exactly zero (dx AND dy) ----
{
  const cols = TOP.latticeColumns;
  let zeroRows = 0, pinRows = 0;
  for (let r = 0; r < TOP.latticeRows; r++) {
    const y = rowY(TOP, r);
    if (y >= Y_ZERO - 1e-9) {
      zeroRows++;
      if (y >= Y_PIN) pinRows++;
      for (let c = 0; c < cols; c++) {
        for (const which of ["min", "max"]) {
          const g = GRIDS.topwear[which][r * cols + c];
          if (g.x !== 0 || g.y !== 0) throw new Error(`pin broken at row y=${y}`);
        }
      }
    }
  }
  if (pinRows < 1) throw new Error("no all-zero lattice row at/below the pin line");
  console.log(`assert PIN OK: ${zeroRows} shirt rows all-zero from y${Y_ZERO.toFixed(1)} (hem row(s) at/below y${Y_PIN} strict zero kept)`);
}

// ---- assert SILH: collar-band rows leave the silhouette columns untouched ----
{
  const cols = TOP.latticeColumns;
  const oldMin = patchArr(keyOf(topSet, -10)), oldMax = patchArr(keyOf(topSet, 10));
  // rows with V>0 (the collar band proper). Row V0_ROW itself belongs to F2's
  // pin-profile lift, which legitimately raises ALL columns below the band.
  for (let r = 0; r < V0_ROW; r++) {
    for (const c of [0, 1, cols - 2, cols - 1]) {   // u <= -215 / u >= +215
      const i = r * cols + c;
      if (GRIDS.topwear.min[i].y !== 0 || GRIDS.topwear.max[i].y !== 0)
        throw new Error(`silhouette column got a dy at row ${r} col ${c}`);
      if (Math.abs(GRIDS.topwear.min[i].x - oldMin[i].x) > 0.011 ||
        Math.abs(GRIDS.topwear.max[i].x - oldMax[i].x) > 0.011)
        throw new Error(`silhouette column dx changed in the collar band at row ${r} col ${c}`);
    }
  }
  console.log("assert SILH OK: collar-band silhouette columns keep cp10's field (dy=0, dx unchanged)");
}

// ---- assert ROWKEEP: untouched rows byte-match the committed cp10 keys ----
{
  const checks = [
    ["topwear", TOP, topSet, GRIDS.topwear, [TOP.latticeRows - 1]],          // hem row 12
    ["tie", TIE, tieSet, GRIDS.tie, [2, 3, 4, 5, 6]]                          // hanging blade
  ];
  for (const [name, rc, set, grids, rows] of checks) {
    const cols = rc.latticeColumns;
    for (const [which, v] of [["min", -10], ["max", 10]]) {
      const old = patchArr(keyOf(set, v));
      for (const r of rows) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (grids[which][i].x !== old[i].x || grids[which][i].y !== (old[i].y ?? 0))
          throw new Error(`ROWKEEP broken: ${name} ${which} row ${r} col ${c}`);
      }
    }
  }
  console.log("assert ROWKEEP OK: shirt hem row + tie hanging-blade rows (2..6) byte-match cp10");
}

// ---- assert FOLLOW: the knot rides the deformed collar V (lattice-rendered) --
{
  let worst = { d: 0 };
  for (let x = 962; x <= 1028; x += 6) for (let y = 645; y <= 714; y += 7) {
    for (const which of ["min", "max"]) {
      const a = bilinPt(TOP, fieldShirtFix, which, x, y);
      const b = bilinPt(TIE, fieldTieFix, which, x, y);
      for (const k of ["x", "y"]) {
        const d = Math.abs(a[k] - b[k]);
        if (d > worst.d) worst = { d, x, y, which, k };
      }
    }
  }
  if (worst.d > 0.8) throw new Error(`knot does not follow the collar V: ${JSON.stringify(worst)}`);
  console.log(`assert FOLLOW OK: knot-vs-collar rendered mismatch <= ${worst.d.toFixed(3)}px over the knot band (@${worst.x},${worst.y} ${worst.which} ${worst.k})`);
}

// ---- NECKSEAM report (alpha canon integrity is structural: neck untouched) ---
{
  const collar643 = fieldShirtFix(997, 643).max.x, collar666 = fieldShirtFix(997, 666).max.x;
  const bare = G_B * (chordC(0) + SIN * zT(0));
  console.log(`NECKSEAM report: collar center dx@max y643 = ${collar643.toFixed(2)} / y666 = ${collar666.toFixed(2)} vs neck-shared bare sph ${bare.toFixed(2)} -> differential ${(collar666 - bare).toFixed(2)}px under the collar overlap (hidden; neck keys untouched, alpha=0.6 canon intact)`);
  const eL = fieldShirtFix(948, 630).max.y, eR = fieldShirtFix(1042, 630).max.y;
  console.log(`NECKSEAM report: collar dy@max at neck edges (948/1042, y630) = ${eL.toFixed(2)} / ${eR.toFixed(2)}px relative to the static neck skin behind`);
}

// ---- snapshot (pre-fix committed state), design + batch ----
const SNAP = new URL("snapshot-fix-pre.json", HERE);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const snapNow = () => ({
  sets: kfs.map((s) => ({
    sig: `${s.target?.kind}:${s.target?.id}:${s.parameterId}`,
    keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
  })),
  rigControls: rcs.map((r) => ({ id: r.rigControlId, hash: sha(JSON.stringify(r)) })),
  meshes: meshes.map((m) => ({ id: m.drawableId, hash: sha(JSON.stringify(m)) }))
});

const FIX_SIGS = new Set([
  "rigControl:rig_bodyx_topwear:param_body_angle_x",
  "rigControl:rig_bodyx_tie:param_body_angle_x"
]);

if (mode === "verify") {
  const snap = JSON.parse(readFileSync(SNAP, "utf8"));
  const cur = snapNow();
  if (cur.sets.length !== snap.sets.length) throw new Error("keyform set count changed");
  let touched = 0;
  for (let i = 0; i < cur.sets.length; i++) {
    const a = snap.sets[i], b = cur.sets[i];
    if (a.sig !== b.sig) throw new Error(`set order drift at ${i}: ${a.sig} -> ${b.sig}`);
    if (FIX_SIGS.has(b.sig)) {
      touched++;
      const name = b.sig.includes("topwear") ? "topwear" : "tie";
      for (const [which, v] of [["min", -10], ["max", 10]]) {
        const got = JSON.parse(b.keys.find((k) => k.value === v).json);
        const want = GRIDS[name][which];
        const gotArr = Array.isArray(got) ? got : (got.value ?? got);
        const flat = Array.isArray(gotArr) ? gotArr : Object.keys(gotArr).map(Number).sort((x, y) => x - y).map((k) => gotArr[k]);
        if (flat.length !== want.length) throw new Error(`${name}@${v}: length mismatch`);
        for (let j = 0; j < want.length; j++)
          if (flat[j].x !== want[j].x || flat[j].y !== want[j].y)
            throw new Error(`${name}@${v}[${j}]: committed ${JSON.stringify(flat[j])} != design ${JSON.stringify(want[j])}`);
      }
      const zero = JSON.parse(b.keys.find((k) => k.value === 0).json);
      const preZero = a.keys.find((k) => k.value === 0).json;
      if (JSON.stringify(zero) !== preZero) throw new Error(`${b.sig}: default key changed`);
    } else if (JSON.stringify(a.keys) !== JSON.stringify(b.keys)) {
      throw new Error(`UNTOUCHED KEYFORM SET CHANGED: ${b.sig}`);
    }
  }
  if (touched !== 2) throw new Error(`expected 2 touched sets, saw ${touched}`);
  const hatSig = snap.sets.find((s) => s.sig.includes("rig_facex_headwear") && s.sig.includes("param_face_angle_x"));
  if (!hatSig) throw new Error("hat X set not found");
  const bodyKept = ["arm_r", "arm_l", "neck"].every((k) =>
    !FIX_SIGS.has(`rigControl:rig_bodyx_${k}:param_body_angle_x`));
  if (!bodyKept) throw new Error("internal: fix sig list wrong");
  if (JSON.stringify(cur.rigControls) !== JSON.stringify(snap.rigControls))
    throw new Error("a rig control changed (fix must not touch structure)");
  if (JSON.stringify(cur.meshes) !== JSON.stringify(snap.meshes))
    throw new Error("a mesh changed (fix must not touch meshes)");
  console.log(`verify OK: ${cur.sets.length - 2} untouched keyform sets byte-identical (hat X / arms / neck alpha / skirt included); topwear+tie min/max match the fix design, default keys untouched; all rig controls and meshes byte-identical`);
  process.exit(0);
}

if (!existsSync(SNAP)) {
  writeFileSync(SNAP, JSON.stringify(snapNow()));
  console.log("snapshot-fix-pre.json written (pre-fix committed state)");
} else console.log("snapshot-fix-pre.json already present — kept");

writeFileSync(new URL("design-fix.json", HERE), JSON.stringify(GRIDS));
const mkOp = (name, rcId, v, grid) => ({
  file: `key-fix-${name}-${v < 0 ? "min" : "max"}.json`,
  operationId: `op_cp10fix_key_${name}_${v < 0 ? "min" : "max"}`,
  operationType: "editKeyformKey",
  payload: {
    target: { kind: "rigControl", id: rcId },
    targetProperty: "controlPointOffsets",
    parameterId: "param_body_angle_x",
    interpolation: "linear-1d-v1",
    action: "updateCurrent",
    keyValue: v,
    statePatch: { propertyPath: "controlPointOffsets", value: grid }
  },
  gitMessage: `[cp10fix] ${name} ${v < 0 ? "min" : "max"} — collar rim-loop staging (B=${B_CENTER}, K=${K_ASYM})${name === "topwear" ? ` + pin band compression (rows ${FREE_ROW}->${ZERO_ROW})` : ""}`
});
const batch = [
  mkOp("topwear", "rig_bodyx_topwear", -10, GRIDS.topwear.min),
  mkOp("topwear", "rig_bodyx_topwear", 10, GRIDS.topwear.max),
  mkOp("tie", "rig_bodyx_tie", -10, GRIDS.tie.min),
  mkOp("tie", "rig_bodyx_tie", 10, GRIDS.tie.max)
];
writeFileSync(new URL("batch-fix.json", HERE), JSON.stringify(batch, null, 2));
console.log(`batch-fix.json: ${batch.length} ops (updateCurrent x4)`);

// ---- probes ----
console.log(`\ndials: B_CENTER=${B_CENTER} K_ASYM=${K_ASYM}px U_C=${U_C} U_SH=${U_SH} V ramp y${Y_V1.toFixed(1)}->y${Y_V0.toFixed(1)} | pin: full field to y${Y_FREE.toFixed(1)}, zero from y${Y_ZERO.toFixed(1)}`);
const probes = [
  ["collar center / placket (997,610)", 997, 610, fieldShirtFix],
  ["collar far-L edge (911,610)", 911, 610, fieldShirtFix],
  ["collar near-R edge (1083,610)", 1083, 610, fieldShirtFix],
  ["shoulder line L mid (860,660)", 860, 660, fieldShirtFix],
  ["shoulder line R mid (1134,660)", 1134, 660, fieldShirtFix],
  ["shoulder point L (790,685)", 790, 685, fieldShirtFix],
  ["shoulder point R (1205,685)", 1205, 685, fieldShirtFix],
  ["chest top (997,760)", 997, 760, fieldShirtFix],
  ["midriff (997,950)", 997, 950, fieldShirtFix],
  ["pre-hem (997,1060)", 997, 1060, fieldShirtFix],
  ["hem row (997,1117)", 997, 1117, fieldShirtFix],
  ["tie knot top (992,650)", 992, 650, fieldTieFix],
  ["tie knot bottom (994,710)", 994, 710, fieldTieFix],
  ["tie blade top (990,760)", 990, 760, fieldTieFix],
  ["tie tip (990,1195)", 990, 1195, fieldTieFix]
];
console.log("probe                                    min(dx,dy)          max(dx,dy)");
for (const [name, x, y, f] of probes) {
  const r = f(x, y);
  const fmt = (p) => `${round2(p.x).toString().padStart(7)},${round2(p.y).toString().padStart(6)}`;
  console.log(` ${name.padEnd(38)} ${fmt(r.min)}   ${fmt(r.max)}`);
}
