// cp15 BodyZ correction warps — PRIMARY SOURCE of every cp15 number.
//
// ============================ THE ONE TEMPLATE ================================
// All seven warps are the SAME sentence — the "fixed line where the drawn
// attachment ends" template, third application (cp13 hair / cp13-type tie /
// cp10 sewn anchor), written as an IN-ROTATION DIFFERENTIAL against the BodyZ
// rotation field (the parent rig_bodyz_upper_body already gives full rotation
// everywhere):
//
//   desired net(u,y) = PHI(y) * rot_B(u,y) + (1 - PHI(y)) * A(u)
//
//   rot_B(p) = R(PIVOT_B, theta) . p - p,  PIVOT_B = (997.25, 1124) (cp14 canon)
//   theta = +-6 deg at param_body_angle_z = +-10 (y-down: positive = clockwise)
//
//   hair (5):  PHI = W (cp13 shapes), A(u) = rot_B(u, y_line)  — gravity carry:
//              the strand hangs from where it stops growing and carries the
//              hairline's displacement (X AND Y) uniformly.
//              y_line: tufts 520/505, curtains 540 (cp13fix3 y_scalp, reused);
//              front hair: cp13's W (500..773 smoothstep to wTip=0.7) inherited
//              WITH its known deviation (trial-run approximation, per problem
//              definition; the re-run will give the front hair a true y_scalp).
//   tie (1):   PHI = W (y_knot=710 measured from texture, 40px sharp), A(u) =
//              rot_B(u, y_knot) — the knot band gets ZERO correction (full
//              rotation, stays on the collar constructively); below, the knot's
//              displacement is carried. Rest is drawn plumb (blade centroid
//              drift ~5px over 400px), so carry alone preserves verticality —
//              no plumb term (problem-definition default; report if renders
//              demand one).
//   shirt (1): PHI = P (cp10fix row-snapped pin profile), A(u) = 0 — the sewn
//              anchor, rotation edition: full rotation to the free row, rapid
//              convergence to ZERO at the skirt tuck-in line (bottomwear is
//              static and NOT a BodyZ member — cp14 proved it byte-still).
//              P: 1 down to lattice row 10 (y=1065.83), linear to 0 at row 11
//              (y=1116.92), 0 below. The whole transition ends 7.08px ABOVE
//              the sign-flip row y=1124 (assert SIGNFLIP, 2 layers).
//
// ======================= EXACT IN-ROTATION CORRECTION ========================
// The warp sits INSIDE the rotation, so the runtime net is R(p + c(p)) - p:
// the parent rotates the correction vector. cp13 committed the naive
// c = net - rot and tolerated (R-I)c (max 2.4px at |c|<=17px, theta=10deg).
// Here |c| reaches ~140px at the curtain tips (the carry must UNDO a rotation
// that has the opposite sign below the pivot row), so the naive residual would
// be ~14px — we adopt cp13's own handoff refinement for exactly this case
// ("if the angle or the correction grows, pre-rotate"):
//
//   c(p) = R^-1 . (p + net(p)) - p        =>  R(p + c(p)) = p + net(p)  EXACT
//
// Consequences the asserts exploit:
//   - PHI=1 band: net = rot  ->  c = 0 exactly (zero offsets in the data: the
//     knot/scalp/shoulder bands literally have no key content);
//   - PHI=0 band: net is affine in (x,y) -> c is affine -> bilinear lattice
//     interpolation is EXACT between nodes: the shirt hem is exactly still,
//     the tie below the knot is exactly uniform per column (verticality is a
//     constitutive consequence, not a tuning outcome);
//   - transition band: smoothstep x affine, softened by the row gap as in
//     cp13fix3 — and as there, boundary row == sample row makes both ends of
//     the stretched transition nearly the same vector (sub-px cost, printed).
//
// ============================ STRUCTURE ======================================
// Each warp wraps its element's current tower root (in-place slot inheritance,
// cp13-established): stack BodyZ rotation > BodyZ warp > FaceZ warp/tower.
// Front hair's tower root lives INSIDE rig_facez_head (FaceZ rotation), so its
// BodyZ warp is nested under both rotations; at FaceZ=0 that is identical to
// the others (R_F = I), at FaceZ != 0 the correction is additionally rotated
// by R_F — O(theta_F * c) cross term, |c|<=9px for the front tail -> ~1.5px,
// record-only (Runtime-responsibility policy, cp14).
// Domains: tie/topwear twin the wrapped tower's domain (child displacement
// under BodyX <= ~11px < the existing ~20px margins). Hair warps take the
// FaceZ domain + 60px margins: their input arrives ALREADY displaced by the
// FaceZ warp (up to ~58px in the scalp band at z=+-30). 60px covers the
// hanging/transition bands outright; in the scalp band the correction is
// IDENTICALLY ZERO across each row, so clamping or linear extrapolation at the
// domain edge reproduces the exact value anyway (band-wise coverage argument).
//
// Modes:
//   node gen-bodyz-corrections.mjs gen      -> asserts + batch-create.json +
//                                              batch-keys.json + design-values.json
//   node gen-bodyz-corrections.mjs snapshot -> snapshot-pre.json from live package
//   node gen-bodyz-corrections.mjs verify   -> untouched/changed-as-designed check
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";

// ---- cp14 BodyZ canon (asserted against the live package in PRE) -------------
const PIVOT_B = { x: 997.25, y: 1124 };  // waist: torso midline x, skirt in-line y
const THETA_MAX_DEG = 6;                 // param +-10 -> +-6 deg (cp14 key)
const PARAM = "param_body_angle_z";
const BODYZ_ID = "rig_bodyz_upper_body";
const FACEZ_ID = "rig_facez_head";
const FLIP_Y = PIVOT_B.y;                // sign-flip row of the rotation field

const rad = (d) => (d * Math.PI) / 180;
const rotDisp = (x, y, thetaDeg) => {
  const c = Math.cos(rad(thetaDeg)), s = Math.sin(rad(thetaDeg));
  const u = x - PIVOT_B.x, v = y - PIVOT_B.y;
  return { x: c * u - s * v - u, y: s * u + c * v - v };
};
// exact in-rotation correction: c = R^-1 (p + net) - p
const exactCorr = (x, y, thetaDeg, net) => {
  const c = Math.cos(rad(thetaDeg)), s = Math.sin(rad(thetaDeg));
  const px = x + net.x - PIVOT_B.x, py = y + net.y - PIVOT_B.y;
  return { x: c * px + s * py + PIVOT_B.x - x, y: -s * px + c * py + PIVOT_B.y - y };
};
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// ---- fixed lines (the dials) --------------------------------------------------
// hair: cp13fix3 y_scalp values reused verbatim; front hair: cp13 W inherited.
// tie: y_knot measured at rev 404 (measure-tie-knot.mjs): knot bulge peak w60 @
//      y667, local width minimum plateau w34 @ y708..711 -> knot bottom 710.
// shirt: cp10fix pin rows (lattice rows of the twinned cp10 domain).
const TRANS = 40;
const W_FRONT = { yHead: 500, yFree: 773, wTip: 0.7 };   // cp13 verbatim
const wSharp = (yLine) => (y) => y <= yLine ? 1 : 1 - smooth((y - yLine) / TRANS);
const wFront = (y) => y <= W_FRONT.yHead ? 1 :
  1 - (1 - W_FRONT.wTip) * smooth((y - W_FRONT.yHead) / (W_FRONT.yFree - W_FRONT.yHead));

// topwear rows (twin domain 555..1168, 13 rows): row10 = free row, row11 = pin.
const TOP_DOMAIN = { x: 739, y: 555, width: 516, height: 613 };
const topRowY = (r) => TOP_DOMAIN.y + (TOP_DOMAIN.height * r) / 12;
const P_FREE_Y = topRowY(10);            // 1065.8333 (cp10fix FREE_ROW)
const P_PIN_Y = topRowY(11);             // 1116.9167 (< 1124: above the flip row)
const pPin = (y) => y <= P_FREE_Y ? 1 : y >= P_PIN_Y ? 0 : (P_PIN_Y - y) / (P_PIN_Y - P_FREE_Y);

// ---- elements -----------------------------------------------------------------
// hair domains = FaceZ warp domain (live rig-controls, rev 404) + 60px margins;
// tie/topwear = twin of the wrapped tower domain.
const ELEMENTS = [
  { key: "hair_front", displayName: "BodyZ Hair Front", wrap: "rig_facez_hair_front",
    parentExpected: FACEZ_ID, domain: { x: 559, y: 35, width: 884, height: 838 },
    cols: 11, rows: 11, phi: wFront, yLine: W_FRONT.yHead, kind: "carry",
    transEnd: W_FRONT.yFree },
  { key: "hair_f_r", displayName: "BodyZ Hair F R", wrap: "rig_facez_hair_f_r",
    parentExpected: BODYZ_ID, domain: { x: 912, y: 127, width: 480, height: 921 },
    cols: 7, rows: 11, phi: wSharp(520), yLine: 520, kind: "carry", transEnd: 560 },
  { key: "hair_f_l", displayName: "BodyZ Hair F L", wrap: "rig_facez_hair_f_l",
    parentExpected: BODYZ_ID, domain: { x: 599, y: 167, width: 466, height: 899 },
    cols: 7, rows: 11, phi: wSharp(505), yLine: 505, kind: "carry", transEnd: 545 },
  { key: "back_hair_r", displayName: "BodyZ Back Hair R", wrap: "rig_facez_back_hair_r",
    parentExpected: BODYZ_ID, domain: { x: 279, y: 210, width: 854, height: 1720 },
    cols: 11, rows: 13, phi: wSharp(540), yLine: 540, kind: "carry", transEnd: 580 },
  { key: "back_hair_l", displayName: "BodyZ Back Hair L", wrap: "rig_facez_back_hair_l",
    parentExpected: BODYZ_ID, domain: { x: 871, y: 172, width: 729, height: 1705 },
    cols: 11, rows: 13, phi: wSharp(540), yLine: 540, kind: "carry", transEnd: 580 },
  { key: "tie", displayName: "BodyZ Tie", wrap: "rig_bodyx_tie",
    parentExpected: BODYZ_ID, domain: { x: 919, y: 620, width: 147, height: 603 },
    cols: 5, rows: 7, phi: wSharp(710), yLine: 710, kind: "carry", transEnd: 750 },
  { key: "topwear", displayName: "BodyZ Topwear", wrap: "rig_bodyx_topwear",
    parentExpected: BODYZ_ID, domain: TOP_DOMAIN,
    cols: 13, rows: 13, phi: pPin, yLine: null, kind: "anchor", transEnd: P_PIN_Y }
];
const newId = (el) => `rig_bodyz_${el.key}`;

// desired net displacement (the design spec each assert speaks about)
const netOf = (el) => (x, y, th) => {
  const w = el.phi(y);
  const s = rotDisp(x, y, th);
  const a = el.kind === "carry" ? rotDisp(x, el.yLine, th) : { x: 0, y: 0 };
  return { x: w * s.x + (1 - w) * a.x, y: w * s.y + (1 - w) * a.y };
};
const corrOf = (el) => (x, y, th) => exactCorr(x, y, th, netOf(el)(x, y, th));

const round2 = (n) => Math.round(n * 100) / 100 || 0; // normalize -0 -> 0
const nodes = (el) => {
  const out = [];
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++)
      out.push({ x: el.domain.x + (el.domain.width * c) / (el.cols - 1), y });
  }
  return out;
};
const grid = (el, th) =>
  nodes(el).map(({ x, y }) => {
    if (th === 0) return { x: 0, y: 0 };
    const v = corrOf(el)(x, y, th);
    return { x: round2(v.x), y: round2(v.y) };
  });

const canon = (v) => JSON.stringify(sortKeys(v));
const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v !== null && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
      : v;
const readModel = (file) => JSON.parse(readFileSync(join(PKG, "model", file), "utf8"));

// slot-replacement expectations (verify + PRE structure assert)
const SLOT_REPLACE = Object.fromEntries(ELEMENTS.map((el) => [el.wrap, newId(el)]));

// ================================== GEN ======================================
const gen = () => {
  const rcs = readModel("rig-controls.json").rigControls;
  const byId = new Map(rcs.map((r) => [r.rigControlId, r]));

  // ---- assert PRE: the rotation our fields derive from is the cp14 canon ----
  const bz = byId.get(BODYZ_ID);
  if (!bz || bz.kind !== "rotation2d") throw new Error("PRE: BodyZ rotation missing");
  if (canon(bz.pivot) !== canon(PIVOT_B)) throw new Error(`PRE: BodyZ pivot drifted: ${JSON.stringify(bz.pivot)}`);
  const kfs = readModel("keyforms.json").keyformSets;
  const bzSet = kfs.find((s) => s.target?.id === BODYZ_ID && s.target?.property === "angleDegrees" && s.parameterId === PARAM);
  if (!bzSet) throw new Error("PRE: BodyZ angle key missing");
  const bzKeys = [...bzSet.keys].sort((a, b) => a.value - b.value).map((k) => [k.value, k.statePatch]);
  if (canon(bzKeys) !== canon([[-10, -THETA_MAX_DEG], [0, 0], [10, THETA_MAX_DEG]]))
    throw new Error(`PRE: BodyZ angle keys drifted: ${JSON.stringify(bzKeys)} (human correction? STOP)`);
  // structure: every wrap target exists with the expected parent, and no
  // rig_bodyz_<key> warp exists yet
  for (const el of ELEMENTS) {
    const t = byId.get(el.wrap);
    if (!t) throw new Error(`PRE: wrap target ${el.wrap} missing`);
    if (t.parentId !== el.parentExpected)
      throw new Error(`PRE: ${el.wrap} parent is ${t.parentId}, expected ${el.parentExpected}`);
    if (byId.has(newId(el))) throw new Error(`PRE: ${newId(el)} already exists`);
    // hair warps: domain must be the live FaceZ domain + 60 margins (twin+margin)
    if (el.parentExpected === BODYZ_ID && el.wrap.startsWith("rig_facez_")) {
      const d = t.domainBounds;
      const want = { x: d.x - 60, y: d.y - 60, width: d.width + 120, height: d.height + 120 };
      if (canon(el.domain) !== canon(want))
        throw new Error(`PRE: ${el.key} domain not FaceZ+60: ${JSON.stringify(el.domain)} vs ${JSON.stringify(want)}`);
    }
    if (el.wrap.startsWith("rig_bodyx_")) {
      if (canon(el.domain) !== canon(byId.get(el.wrap).domainBounds))
        throw new Error(`PRE: ${el.key} domain not a twin of ${el.wrap}`);
    }
  }
  // front hair FaceZ domain + 60 check (parent is the FaceZ rotation, not BodyZ)
  {
    const d = byId.get("rig_facez_hair_front").domainBounds;
    const want = { x: d.x - 60, y: d.y - 60, width: d.width + 120, height: d.height + 120 };
    if (canon(ELEMENTS[0].domain) !== canon(want)) throw new Error("PRE: hair_front domain not FaceZ+60");
  }
  console.log("assert PRE OK: BodyZ rotation = cp14 canon (pivot 997.25/1124, keys -6/0/+6 at -10/0/+10); " +
    "all 7 wrap targets live with expected parents; no cp15 warp exists yet; domains twin the live controls");

  // ---- assert IDENT: net - A == PHI * (rot - A) at every node, both ends ----
  for (const el of ELEMENTS) {
    for (const { x, y } of nodes(el)) {
      for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
        const s = rotDisp(x, y, th);
        const a = el.kind === "carry" ? rotDisp(x, el.yLine, th) : { x: 0, y: 0 };
        const net = netOf(el)(x, y, th), w = el.phi(y);
        for (const k of ["x", "y"])
          if (Math.abs((net[k] - a[k]) - w * (s[k] - a[k])) > 1e-9)
            throw new Error(`IDENT broken: ${el.key} @(${x},${y}) th=${th} ${k}`);
      }
    }
  }
  console.log("assert IDENT OK: net - A == PHI * (rot_B - A) at every lattice node, both ends (A = rot_B(u,y_line) for hair/tie, 0 for the shirt)");

  // ---- assert EXACT: R(p + c(p)) == p + net(p) at every node (the pre-rotated
  //      correction nulls the O(theta^2) term the naive form would leave) ----
  let maxNaive = 0, naiveAt = null;
  for (const el of ELEMENTS) {
    for (const { x, y } of nodes(el)) {
      for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
        const net = netOf(el)(x, y, th), cv = corrOf(el)(x, y, th);
        const c = Math.cos(rad(th)), s = Math.sin(rad(th));
        const px = x + cv.x - PIVOT_B.x, py = y + cv.y - PIVOT_B.y;
        const gx = c * px - s * py + PIVOT_B.x, gy = s * px + c * py + PIVOT_B.y;
        if (Math.abs(gx - (x + net.x)) > 1e-9 || Math.abs(gy - (y + net.y)) > 1e-9)
          throw new Error(`EXACT broken: ${el.key} @(${x},${y}) th=${th}`);
        const nx = net.x - rotDisp(x, y, th).x, ny = net.y - rotDisp(x, y, th).y; // naive c
        const rx = (c - 1) * nx - s * ny, ry = s * nx + (c - 1) * ny;             // (R-I)c
        const m = Math.hypot(rx, ry);
        if (m > maxNaive) { maxNaive = m; naiveAt = { el: el.key, x, y, th }; }
      }
    }
  }
  console.log(`assert EXACT OK: R(p + c) == p + net at every node, both ends (exact in-rotation correction).` +
    ` INFO naive-form residual |(R-I)c| would have peaked at ${maxNaive.toFixed(2)}px @ ${JSON.stringify(naiveAt)} — the pre-rotation buys exactly this`);

  // ---- assert ZEROBAND: PHI=1 nodes carry literally zero offsets ----
  for (const el of ELEMENTS) {
    for (const { x, y } of nodes(el)) {
      if (el.phi(y) !== 1) continue;
      for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
        const cv = corrOf(el)(x, y, th);
        if (Math.abs(cv.x) > 1e-9 || Math.abs(cv.y) > 1e-9)
          throw new Error(`ZEROBAND broken: ${el.key} @(${x},${y})`);
      }
    }
  }
  console.log("assert ZEROBAND OK: every PHI=1 node (scalp band / knot band / shoulder band) has correction == 0 — the full-rotation bands never leave the parent's rotation world, by data");

  // ---- assert AFFINE: below the transition (PHI=0) the correction is affine in
  //      (x,y) -> bilinear interpolation between nodes is exact. Machine-check:
  //      c at every PHI=0 node equals the affine map fitted from 3 reference
  //      nodes of that band. ----
  for (const el of ELEMENTS) {
    const band = nodes(el).filter(({ y }) => el.phi(y) === 0);
    if (band.length < 3) { if (el.key !== "hair_front") throw new Error(`AFFINE: no PHI=0 band on ${el.key}`); continue; }
    for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
      const f = (p) => corrOf(el)(p.x, p.y, th);
      const [p0] = band;
      const px = band.find((p) => p.x !== p0.x), py = band.find((p) => p.y !== p0.y);
      const f0 = f(p0), fx = f(px), fy = f(py);
      const gx = { x: (fx.x - f0.x) / (px.x - p0.x), y: (fx.y - f0.y) / (px.x - p0.x) };
      const gy = { x: (fy.x - f0.x) / (py.y - p0.y), y: (fy.y - f0.y) / (py.y - p0.y) };
      for (const p of band) {
        const want = {
          x: f0.x + gx.x * (p.x - p0.x) + gy.x * (p.y - p0.y),
          y: f0.y + gx.y * (p.x - p0.x) + gy.y * (p.y - p0.y)
        };
        const got = f(p);
        if (Math.abs(got.x - want.x) > 1e-6 || Math.abs(got.y - want.y) > 1e-6)
          throw new Error(`AFFINE broken: ${el.key} @(${p.x},${p.y}) th=${th}`);
      }
    }
  }
  console.log("assert AFFINE OK: on every PHI=0 node band the correction is affine in (x,y) — bilinear delivers the design EXACTLY between nodes there (hem exactly still, tie columns exactly uniform, hair carry exactly uniform)");
  console.log("  (hair_front has no PHI=0 band by design: W floors at 0.7 — inherited cp13 shape)");

  // ---- assert SIGNFLIP: transitions never touch the pivot row y=1124, at the
  //      design level AND at the lattice level (cp13 lesson, mechanized) ----
  for (const el of ELEMENTS) {
    if (el.transEnd >= FLIP_Y)
      throw new Error(`SIGNFLIP: ${el.key} transition ends at ${el.transEnd} >= ${FLIP_Y}`);
    for (const { y } of nodes(el)) {
      const w = el.phi(y);
      if (w > 0 && w < 1 && y >= FLIP_Y)
        throw new Error(`SIGNFLIP: intermediate-PHI node at/below the pivot row on ${el.key} (y=${y})`);
      if (y >= FLIP_Y && w !== 0)
        throw new Error(`SIGNFLIP: node at/below the pivot row still mixes rotation on ${el.key} (y=${y})`);
    }
  }
  console.log(`assert SIGNFLIP OK: every transition ends above the pivot row y=${FLIP_Y}` +
    ` (margins: ${ELEMENTS.map((el) => `${el.key} ${(FLIP_Y - el.transEnd).toFixed(1)}px`).join(", ")});` +
    ` no lattice node at/below y=${FLIP_Y} mixes the rotation field`);

  // ---- probes (design-log material) ----
  console.log("\n=== probes: carry vectors A = rot_B(u, y_line) at theta=+6 (z=+10), strand centerlines ===");
  const probe = [["hair_front", 1001, 500], ["hair_f_r", 1150, 520], ["hair_f_l", 860, 505],
    ["back_hair_r", 700, 540], ["back_hair_l", 1250, 540], ["tie", 994, 710]];
  for (const [k, x, yl] of probe) {
    const d = rotDisp(x, yl, THETA_MAX_DEG);
    console.log(` ${k.padEnd(12)} A(${x}) = (${round2(d.x)}, ${round2(d.y)})`);
  }
  console.log("=== probes: correction magnitude at the far ends (theta=+6) ===");
  for (const el of ELEMENTS) {
    let m = 0, at = null;
    for (const { x, y } of nodes(el)) {
      const cv = corrOf(el)(x, y, THETA_MAX_DEG);
      const h = Math.hypot(cv.x, cv.y);
      if (h > m) { m = h; at = { x, y }; }
    }
    console.log(` ${el.key.padEnd(12)} max|c| = ${m.toFixed(1)}px @ ${JSON.stringify(at)}`);
  }

  // ---- ops --------------------------------------------------------------------
  const createOp = (el) => ({
    file: `create-${el.key}.json`,
    operationId: `op_cp15_create_${el.key}`,
    operationType: "createWarpDeformer",
    gitMessage: `[cp15] warp ${el.displayName} (${el.cols}x${el.rows}) wrapping ${el.wrap} (BodyZ in-rotation correction layer)`,
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
    }
  });
  const keyOp = (el) => ({
    file: `key-${el.key}.json`,
    operationId: `op_cp15_key_${el.key}`,
    operationType: "editKeyformKey",
    gitMessage: `[cp15] key ${el.displayName} body_angle_z (${el.kind === "anchor"
      ? `sewn anchor: full rotation to y=${P_FREE_Y.toFixed(1)}, zero at the tuck-in row y=${P_PIN_Y.toFixed(1)} (< flip row 1124)`
      : `fixed line y=${el.yLine}: zero correction above, carry rot_B(u,${el.yLine}) below`}; exact pre-rotated differential)`,
    payload: {
      target: { kind: "rigControl", id: newId(el) },
      targetProperty: "controlPointOffsets",
      parameterId: PARAM,
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: grid(el, -THETA_MAX_DEG) },
        default: { propertyPath: "controlPointOffsets", value: grid(el, 0) },
        max: { propertyPath: "controlPointOffsets", value: grid(el, THETA_MAX_DEG) }
      }
    }
  });

  writeFileSync(join(HERE, "batch-create.json"), JSON.stringify(ELEMENTS.map(createOp), null, 2));
  writeFileSync(join(HERE, "batch-keys.json"), JSON.stringify(ELEMENTS.map(keyOp), null, 2));

  const design = ELEMENTS.map((el) => ({
    sig: `rigControl:${newId(el)}:${PARAM}`,
    control: {
      id: newId(el), displayName: el.displayName, wrap: el.wrap,
      parentExpected: el.parentExpected, domain: el.domain, cols: el.cols, rows: el.rows,
      kind: el.kind, yLine: el.yLine, transEnd: el.transEnd
    },
    keys: [
      { value: -10, statePatch: grid(el, -THETA_MAX_DEG) },
      { value: 0, statePatch: grid(el, 0) },
      { value: 10, statePatch: grid(el, THETA_MAX_DEG) }
    ]
  }));
  writeFileSync(join(HERE, "design-values.json"), JSON.stringify(
    { PIVOT_B, THETA_MAX_DEG, PARAM, FLIP_Y, TRANS, W_FRONT,
      P_FREE_Y, P_PIN_Y, Y_KNOT: 710, design }, null, 1));
  console.log(`\ngen: batch-create.json (7 ops) + batch-keys.json (7 ops) + design-values.json`);
};

// ================================ SNAPSHOT ===================================
const snapshot = () => {
  const snap = {
    packageRevision: JSON.parse(readFileSync(join(PKG, "manifest.json"), "utf8")).packageRevision,
    rigControls: readModel("rig-controls.json"),
    keyforms: readModel("keyforms.json"),
    meshesCanon: canon(readModel("meshes.json")),
    drawablesCanon: canon(readModel("drawables.json")),
    graphRootIds: readModel("graph.json").rigControlRootIds ?? null
  };
  writeFileSync(join(HERE, "snapshot-pre.json"), JSON.stringify(snap));
  console.log(`snapshot: pre state saved at revision ${snap.packageRevision}`);
};

// ================================= VERIFY ====================================
const verify = () => {
  const pre = JSON.parse(readFileSync(join(HERE, "snapshot-pre.json"), "utf8"));
  const designFile = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
  const expectedSets = new Map(designFile.design.map((d) => [d.sig, d]));
  const post = {
    rigControls: readModel("rig-controls.json"),
    keyforms: readModel("keyforms.json"),
    meshesCanon: canon(readModel("meshes.json")),
    drawablesCanon: canon(readModel("drawables.json"))
  };
  let failures = 0;
  const check = (label, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
    if (!ok) failures += 1;
  };

  // 1. meshes + drawables byte-identical (no remesh in cp15)
  check("MESHES byte-identical", pre.meshesCanon === post.meshesCanon);
  check("DRAWABLES byte-identical", pre.drawablesCanon === post.drawablesCanon);

  // 2. keyformSets: every pre set unchanged, exactly 7 new sets == design
  const preSets = new Map(pre.keyforms.keyformSets.map((s) => [s.keyformSetId, canon(s)]));
  const postSets = new Map(post.keyforms.keyformSets.map((s) => [s.keyformSetId, s]));
  let unchanged = 0;
  for (const [id, c] of preSets) {
    const p = postSets.get(id);
    if (p !== undefined && canon(p) === c) unchanged += 1;
    else check(`keyformSet ${id} unchanged`, false);
  }
  check("KEYFORMS pre sets unchanged", unchanged === preSets.size, `(${unchanged}/${preSets.size})`);
  const NAMED = pre.keyforms.keyformSets
    .map((s) => s.keyformSetId)
    .filter((id) => /headwear.*face_angle_x|topwear|tie|facez|body_angle_z/.test(id));
  for (const id of NAMED)
    check(`  named set ${id}`, canon(postSets.get(id)) === preSets.get(id));
  const sigOf = (s) => `${s.target?.kind}:${s.target?.id}:${s.parameterId}`;
  const newSets = post.keyforms.keyformSets.filter((s) => !preSets.has(s.keyformSetId));
  check("KEYFORMS exactly 7 new sets", newSets.length === 7, `(${newSets.length})`);
  for (const s of newSets) {
    const d = expectedSets.get(sigOf(s));
    if (!d) { check(`new set ${sigOf(s)} expected`, false); continue; }
    const got = [...s.keys].sort((a, b) => a.value - b.value)
      .map((k) => ({ value: k.value, statePatch: k.statePatch }));
    check(`  new set ${sigOf(s)} keys == design (-10/0/+10 grids)`,
      canon(got) === canon(d.keys) &&
      (s.compositionMode ?? "replace") === "replace" && s.interpolation === "linear-1d-v1");
    const center = got.find((k) => k.value === 0);
    check(`  new set ${sigOf(s)} center all-zero`,
      center.statePatch.every((v) => v.x === 0 && v.y === 0));
  }

  // 3. rig controls
  const preRC = new Map(pre.rigControls.rigControls.map((r) => [r.rigControlId, r]));
  const postRC = new Map(post.rigControls.rigControls.map((r) => [r.rigControlId, r]));
  const stripParent = ({ parentId, ...rest }) => rest;
  const stripChildren = ({ childRigControlIds, ...rest }) => rest;
  const WRAPPED = ELEMENTS.map((e) => e.wrap);
  let untouched = 0;
  for (const [id, r] of preRC) {
    const p = postRC.get(id);
    if (p === undefined) { check(`rigControl ${id} still exists`, false); continue; }
    if (WRAPPED.includes(id)) {
      const el = ELEMENTS.find((e) => e.wrap === id);
      check(`  wrapped ${id}: canonical-minus-parentId identical + parentId=${newId(el)}`,
        canon(stripParent(r)) === canon(stripParent(p)) && p.parentId === newId(el));
    } else if (id === BODYZ_ID || id === FACEZ_ID) {
      const expectedChildren = r.childRigControlIds.map((cid) => SLOT_REPLACE[cid] ?? cid);
      check(`  parent ${id}: canonical-minus-children identical + slots replaced in place`,
        canon(stripChildren(r)) === canon(stripChildren(p)) &&
        canon(p.childRigControlIds) === canon(expectedChildren));
    } else if (canon(r) === canon(p)) {
      untouched += 1;
    } else {
      check(`rigControl ${id} byte-identical`, false);
    }
  }
  check("RIGCONTROLS all non-touched byte-identical",
    untouched === preRC.size - WRAPPED.length - 2, `(${untouched}/${preRC.size - WRAPPED.length - 2})`);
  const newRC = [...postRC.keys()].filter((id) => !preRC.has(id));
  check("RIGCONTROLS exactly 7 new controls", newRC.length === 7, newRC.join(","));
  for (const el of ELEMENTS) {
    const w = postRC.get(newId(el));
    if (!w) { check(`new warp ${newId(el)} exists`, false); continue; }
    check(`  new warp ${newId(el)}: warpLattice2d, domain/grid as designed, wraps ${el.wrap}, parent ${el.parentExpected}`,
      w.kind === "warpLattice2d" &&
      canon(w.domainBounds) === canon(el.domain) &&
      w.latticeColumns === el.cols && w.latticeRows === el.rows &&
      canon(w.childRigControlIds) === canon([el.wrap]) &&
      (w.childDrawableIds ?? []).length === 0 &&
      w.parentId === el.parentExpected);
  }

  // 4. graph roots unchanged (all wraps are insertions under existing parents)
  const postRoots = readModel("graph.json").rigControlRootIds ?? null;
  if (pre.graphRootIds !== null && postRoots !== null) {
    check("GRAPH roots unchanged",
      canon([...new Set(postRoots)].sort()) === canon([...new Set(pre.graphRootIds)].sort()));
  } else {
    console.log("INFO graph.rigControlRootIds not present; root check via parentIds only");
  }

  console.log(failures === 0 ? "VERIFY: ALL PASS" : `VERIFY: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
};

const mode = process.argv[2];
if (mode === "gen") gen();
else if (mode === "snapshot") snapshot();
else if (mode === "verify") verify();
else { console.log("usage: gen | snapshot | verify"); process.exit(1); }
