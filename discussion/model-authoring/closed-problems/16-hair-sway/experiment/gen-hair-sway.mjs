// cp16 hair sway, fix2 revision — PRIMARY SOURCE of every cp16 keyform number.
// (v1 and fix1/v2 live in this file's git history; design-notes §7 supersedes
//  §6.2 for the field and amends the front-hair fixed line + dynamics group.)
//
// ============================ THE FIELD (v3) =================================
// Six sway warps exist (cp16 v1 twins). fix2 REGENERATES ONLY the ±1 keys
// (updateCurrent); the 0 key stays identity, untouched.
//
// Field v3 = ISOMETRIC pendulum curve (design-notes §7.2, verbatim):
//
//   y <= y_fix : completely still
//   y >  y_fix : s        = y - y_fix                    (px, depth below root)
//                theta(t) = sign * 30deg * (t / L_free_px)^KAPPA,  KAPPA = 0.5
//                pos(s)   = (x, y_fix) + INTEGRAL_0^s ( sin theta(t),
//                                                       cos theta(t) ) dt
//                offset(s)= ( INT sin theta dt, INT cos theta dt - s )
//
// The tangent is a unit vector everywhere -> arc length is preserved EXACTLY
// (the fix1 chord field dx=s*sin(theta(s)) stretched neighbours by
// sqrt(1+(s*theta')^2), ~13% real elongation at the tip — the user-visible
// "hair looks stretched"). Tips lift UP (dy < 0) along the arc; kappa=0.5
// tip guide: dx ~ 0.34*L_free, dy ~ -0.07*L_free.
// Numerics: trapezoidal rule, step <= 1px (N = ceil(s), h = s/N) — deterministic.
// The pin stays PER COLUMN (field depends on y only -> row-constant grids).
// Sign: +1 == swing toward screen right (dx > 0 for every moving node).
//
// Front hair fixed line raised (design-notes §7.3): y_fix 540 -> 454 (snapped
// exactly onto lattice row 5), L_free = 773 - 454 = 319px, so the forehead
// tuft between the eyes enters the swing region. Other five systems unchanged.
//
// ============================ DYNAMICS (fix2) ================================
// updateDynamicsGroup x1 — dyn_hair_front_sway_x ONLY (design-notes §7.3):
//   chain.segmentLengths [11.8]        (= 2/3 * 319 / 18)
//   FaceZ posX 0.046                   (= (596-454)/18 * 0.005818)
//   BodyZ posX 0.39                    (= (1124-454)/18 * 0.010472)
// FaceX 0.031 / BodyX 0.056 / damping / outputs unchanged (outputs omitted
// from the payload — partial payload = untouched-bytes guarantee). The other
// three groups are not touched at all and must stay byte-identical.
//
// Modes:
//   node gen-hair-sway.mjs snapshot -> snapshot-fix2-pre.json from live package
//   node gen-hair-sway.mjs gen      -> asserts + batch-keys-fix2.json (12 ops)
//                                      + batch-dynamics-fix2.json (1 op)
//                                      + design-values-fix2.json
//   node gen-hair-sway.mjs verify   -> untouched/changed-as-designed check
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";

const THETA_MAX_DEG = 30;
const KAPPA = 0.5; // stiffness dial (design-notes §7.2): ->0 rigid pendulum / 1 whip
const rad = (d) => (d * Math.PI) / 180;
const round2 = (n) => Math.round(n * 100) / 100 || 0; // normalize -0 -> 0

// ---- elements (fixed lines + free lengths = design-notes §1 canon, front
//      amended by §7.3; domains + lattice dims = live twins, asserted in PRE) --
const ELEMENTS = [
  { key: "hair_front", displayName: "Sway Hair Front", param: "param_hair_front_sway_x",
    wrapDrawable: "draw_r0_1cea4f6f_21b4dac0_front_hair", parent: "rig_facex_hair_front",
    domain: { x: 655, y: 135, width: 692, height: 638 }, cols: 11, rows: 11,
    yFix: 454, freeLen: 319 }, // fix2: raised from 540/233 (§7.3), row-5 snap
  { key: "hair_f_l", displayName: "Sway Hair F L", param: "param_hair_side_sway_x",
    wrapDrawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l", parent: "rig_facex_hair_f_l",
    domain: { x: 695, y: 267, width: 274, height: 699 }, cols: 7, rows: 7,
    yFix: 505, freeLen: 461 },
  { key: "hair_f_r", displayName: "Sway Hair F R", param: "param_hair_side_sway_x",
    wrapDrawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r", parent: "rig_facex_hair_f_r",
    domain: { x: 1008, y: 227, width: 288, height: 721 }, cols: 7, rows: 7,
    yFix: 520, freeLen: 428 },
  { key: "back_hair_l", displayName: "Sway Back Hair L", param: "param_hair_back_sway_x",
    wrapDrawable: "draw_r0_1cea4f6f_f2691750_back_hair_l", parent: "rig_facex_back_hair_l",
    domain: { x: 967, y: 272, width: 537, height: 1505 }, cols: 11, rows: 11,
    yFix: 540, freeLen: 1237 },
  { key: "back_hair_r", displayName: "Sway Back Hair R", param: "param_hair_back_sway_x",
    wrapDrawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r", parent: "rig_facex_back_hair_r",
    domain: { x: 375, y: 310, width: 662, height: 1520 }, cols: 11, rows: 11,
    yFix: 540, freeLen: 1290 },
  { key: "tie", displayName: "Sway Tie", param: "param_accessory_sway_x",
    wrapDrawable: "draw_r0_1cea4f6f_ea30e9c4_tie", parent: "rig_bodyx_tie",
    domain: { x: 919, y: 620, width: 147, height: 603 }, cols: 5, rows: 7,
    yFix: 710, freeLen: 513 }
];
const warpId = (el) => `rig_${el.displayName.toLowerCase().replaceAll(" ", "_")}`;

// ---- dynamics: PRE = fix1 live state, POST = fix2 (front amended, §7.3) -----
const OUT = (param) => [{ parameterId: param, segmentIndex: 1, scale: 0.0333, limit: 1 }];
const IN = (parameterId, scale) => ({ parameterId, kind: "positionX", scale });
const DYN_PRE = [
  { id: "dyn_hair_front_sway_x",
    inputs: [IN("param_face_angle_x", 0.031), IN("param_body_angle_x", 0.056),
             IN("param_face_angle_z", 0.018), IN("param_body_angle_z", 0.34)],
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [8.6], damping: 2.5, gravityScale: 1.0 },
    outputs: OUT("param_hair_front_sway_x") },
  { id: "dyn_hair_side_sway_x",
    inputs: [IN("param_face_angle_x", 0.037), IN("param_body_angle_x", 0.067),
             IN("param_face_angle_z", 0.027), IN("param_body_angle_z", 0.36)],
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [16.5], damping: 2.5, gravityScale: 1.0 },
    outputs: OUT("param_hair_side_sway_x") },
  { id: "dyn_hair_back_sway_x",
    inputs: [IN("param_face_angle_x", -0.006), IN("param_body_angle_x", -0.011),
             IN("param_face_angle_z", 0.018), IN("param_body_angle_z", 0.34)],
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [46.8], damping: 2.2, gravityScale: 1.0 },
    outputs: OUT("param_hair_back_sway_x") },
  { id: "dyn_tie_sway_x",
    inputs: [IN("param_body_angle_x", 0.055), IN("param_body_angle_z", 0.24)],
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [19.0], damping: 3.0, gravityScale: 1.0 },
    outputs: OUT("param_accessory_sway_x") }
];
const DYN_POST = DYN_PRE.map((g) =>
  g.id !== "dyn_hair_front_sway_x" ? g : {
    ...g,
    inputs: [IN("param_face_angle_x", 0.031), IN("param_body_angle_x", 0.056),
             IN("param_face_angle_z", 0.046), IN("param_body_angle_z", 0.39)],
    chain: { rootOffset: { x: 0, y: 0 }, segmentLengths: [11.8], damping: 2.5, gravityScale: 1.0 }
  });

// ---- the field v3 (isometric: unit tangent, trapezoid <= 1px) ---------------
const dispOf = (el) => (y, sign) => {
  if (y <= el.yFix) return { x: 0, y: 0 };
  const s = y - el.yFix;
  const N = Math.max(1, Math.ceil(s)); // step h = s/N <= 1px, deterministic
  const h = s / N;
  let ix = 0, iy = 0, px = 0, py = 1; // sin(theta(0)) = 0, cos(theta(0)) = 1
  for (let k = 1; k <= N; k++) {
    const A = rad(sign * THETA_MAX_DEG * Math.pow((h * k) / el.freeLen, KAPPA));
    const fx = Math.sin(A), fy = Math.cos(A);
    ix += ((px + fx) / 2) * h;
    iy += ((py + fy) / 2) * h;
    px = fx; py = fy;
  }
  return { x: ix, y: iy - s };
};

const nodes = (el) => {
  const out = [];
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++)
      out.push({ x: el.domain.x + (el.domain.width * c) / (el.cols - 1), y, r, c });
  }
  return out;
};
const grid = (el, sign) =>
  nodes(el).map(({ y }) => {
    if (sign === 0) return { x: 0, y: 0 };
    const v = dispOf(el)(y, sign);
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
const sigOf = (s) => `${s.target?.kind}:${s.target?.id}:${s.parameterId}`;

// ================================== GEN ======================================
const gen = () => {
  const rcs = readModel("rig-controls.json").rigControls;
  const byId = new Map(rcs.map((r) => [r.rigControlId, r]));
  const kfs = readModel("keyforms.json").keyformSets;
  const dyn = readModel("dynamics.json");

  // ---- assert PRE: the cp16 fix1 state is exactly what fix2 expects ---------
  if (dyn.schemaVersion !== "dynamics-file-v3")
    throw new Error(`PRE: dynamics schema is ${dyn.schemaVersion}, expected dynamics-file-v3`);
  const dynGroups = dyn.dynamicsGroups ?? dyn.groups ?? [];
  for (const g of DYN_PRE) {
    const got = dynGroups.find((x) => (x.dynamicsGroupId ?? x.id) === g.id);
    if (!got) throw new Error(`PRE: dynamics group ${g.id} missing (cp16 fix1 not applied?)`);
    if (canon(got.inputs) !== canon(g.inputs))
      throw new Error(`PRE: ${g.id} inputs drifted from fix1: ${JSON.stringify(got.inputs)}`);
    if (canon(got.outputs) !== canon(g.outputs))
      throw new Error(`PRE: ${g.id} outputs drifted: ${JSON.stringify(got.outputs)}`);
    if (canon(got.chain) !== canon(g.chain))
      throw new Error(`PRE: ${g.id} chain drifted from fix1: ${JSON.stringify(got.chain)}`);
  }
  for (const el of ELEMENTS) {
    const w = byId.get(warpId(el));
    if (!w) throw new Error(`PRE: warp ${warpId(el)} missing`);
    if (w.kind !== "warpLattice2d" || w.parentId !== el.parent ||
        canon(w.domainBounds) !== canon(el.domain) ||
        w.latticeColumns !== el.cols || w.latticeRows !== el.rows ||
        canon(w.childDrawableIds) !== canon([el.wrapDrawable]))
      throw new Error(`PRE: warp ${warpId(el)} drifted from the cp16 v1 twin shape`);
    const set = kfs.find((s) => sigOf(s) === `rigControl:${warpId(el)}:${el.param}`);
    if (!set) throw new Error(`PRE: keyform set for ${warpId(el)} missing`);
    const values = [...set.keys].map((k) => k.value).sort((a, b) => a - b);
    if (canon(values) !== canon([-1, 0, 1]))
      throw new Error(`PRE: ${warpId(el)} keys are ${JSON.stringify(values)}, expected [-1,0,1]`);
    const zero = set.keys.find((k) => k.value === 0);
    if (!zero.statePatch.every((v) => v.x === 0 && v.y === 0))
      throw new Error(`PRE: ${warpId(el)} 0-key is not identity`);
    const bottom = el.domain.y + el.domain.height;
    if (bottom !== el.yFix + el.freeLen)
      throw new Error(`PRE: ${el.key} domain bottom ${bottom} != y_fix+L_free ${el.yFix + el.freeLen}`);
  }
  // front fixed line must sit EXACTLY on a lattice row (design-notes §7.3 row snap)
  {
    const el = ELEMENTS[0];
    const onRow = [...Array(el.rows)].some(
      (_, r) => el.domain.y + (el.domain.height * r) / (el.rows - 1) === el.yFix);
    if (!onRow) throw new Error(`PRE: front y_fix ${el.yFix} is not on a lattice row`);
  }
  console.log("assert PRE OK: 6 sway warps live as twins with [-1,0,+1] keys (0 = identity); " +
    "4 dynamics groups exactly at the fix1 state; domain bottom == y_fix + L_free for all six " +
    "(front amended to 454/319); front y_fix snapped onto lattice row 5");

  // ---- assert FIXEDLINE: nodes at/above the fixed line carry literally zero --
  for (const el of ELEMENTS)
    for (const { y } of nodes(el))
      if (y <= el.yFix)
        for (const s of [-1, 1]) {
          const v = dispOf(el)(y, s);
          if (v.x !== 0 || v.y !== 0) throw new Error(`FIXEDLINE broken: ${el.key} @y=${y}`);
        }
  console.log("assert FIXEDLINE OK: every node at/above y_fix has zero offset at both ends");

  // ---- assert ROWCONST: offsets depend only on y (per-column pendulum) -------
  for (const el of ELEMENTS)
    for (const s of [-1, 1]) {
      const g = grid(el, s);
      for (let r = 0; r < el.rows; r++)
        for (let c = 1; c < el.cols; c++) {
          const a = g[r * el.cols], b = g[r * el.cols + c];
          if (a.x !== b.x || a.y !== b.y) throw new Error(`ROWCONST broken: ${el.key} r${r} c${c}`);
        }
    }
  console.log("assert ROWCONST OK: every lattice row carries one identical offset (column pendulum)");

  // ---- assert ISOMETRY (fix2 core invariant, design-notes §7.4.1): ----------
  //      per lattice column, the polyline (fixed-line point -> deformed rows)
  //      keeps the rest length L_free within 0.1%, at both ±1, using the
  //      exact grids that will be committed (round2'd)
  let isoWorst = { err: 0, key: "", sign: 0 };
  for (const el of ELEMENTS)
    for (const sign of [-1, 1]) {
      const g = grid(el, sign);
      for (let c = 0; c < el.cols; c++) {
        const x0 = el.domain.x + (el.domain.width * c) / (el.cols - 1);
        const pts = [{ x: x0, y: el.yFix }]; // the pin (not a node unless snapped)
        for (let r = 0; r < el.rows; r++) {
          const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
          if (y <= el.yFix) continue;
          const o = g[r * el.cols + c];
          pts.push({ x: x0 + o.x, y: y + o.y });
        }
        let len = 0;
        for (let i = 1; i < pts.length; i++)
          len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        const err = Math.abs(len - el.freeLen) / el.freeLen;
        if (err > isoWorst.err) isoWorst = { err, key: el.key, sign };
        if (err > 0.001)
          throw new Error(`ISOMETRY broken: ${el.key} col ${c} sign ${sign}: ` +
            `polyline ${len.toFixed(2)}px vs rest ${el.freeLen}px (${(err * 100).toFixed(3)}%)`);
      }
    }
  console.log(`assert ISOMETRY OK: every column polyline (root->tip) keeps rest length within 0.1% ` +
    `at both ends (worst ${(isoWorst.err * 100).toFixed(4)}% @ ${isoWorst.key} sign ${isoWorst.sign})`);

  // ---- assert TIPLIFT (design-notes §7.4.2): every moving row lifts (dy<0),
  //      and the tip matches the kappa=0.5 guide dx~0.34L, dy~-0.07L ----------
  for (const el of ELEMENTS) {
    for (const sign of [-1, 1])
      for (const { y } of nodes(el)) {
        if (y <= el.yFix) continue;
        const v = dispOf(el)(y, sign);
        if (!(v.y < 0)) throw new Error(`TIPLIFT broken: ${el.key} @y=${y} sign ${sign} dy=${v.y}`);
      }
    const tip = dispOf(el)(el.domain.y + el.domain.height, 1);
    const rx = tip.x / el.freeLen, ry = tip.y / el.freeLen;
    if (Math.abs(rx - 0.3394) > 0.005 || Math.abs(ry - -0.0674) > 0.005)
      throw new Error(`TIPLIFT guide broken: ${el.key} tip ratios (${rx.toFixed(4)}, ${ry.toFixed(4)})`);
  }
  console.log("assert TIPLIFT OK: every moving row has dy<0 at both ends; tip ratios == " +
    "kappa=0.5 closed integral (dx/L=0.3394, dy/L=-0.0674) for all six");

  // ---- assert RIGHT + CONTINUITY: +1 -> dx>0 on every moving row; dx grows
  //      monotonically from ~0 at the root (no onset crease) -------------------
  for (const el of ELEMENTS) {
    let prev = 0;
    for (let r = 0; r < el.rows; r++) {
      const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
      const v = dispOf(el)(y, 1);
      if (y <= el.yFix) continue;
      if (!(v.x > 0)) throw new Error(`RIGHT broken: ${el.key} @y=${y} dx=${v.x}`);
      if (!(v.x > prev)) throw new Error(`CONTINUITY broken: ${el.key} @y=${y}`);
      prev = v.x;
    }
    const eps = dispOf(el)(el.yFix + 1, 1);
    if (Math.hypot(eps.x, eps.y) > 0.15)
      throw new Error(`CONTINUITY broken at root: ${el.key} 1px below root moves ${JSON.stringify(eps)}`);
  }
  console.log("assert RIGHT+CONTINUITY OK: +1 swings every moving row toward +x, monotonically " +
    "growing from ~0 at the root");

  // ---- assert MIRROR: grid(-1) == {-x, y} of grid(+1) node-for-node ----------
  for (const el of ELEMENTS) {
    const g1 = grid(el, 1), gm = grid(el, -1);
    for (let i = 0; i < g1.length; i++)
      if (Math.abs(g1[i].x + gm[i].x) > 1e-9 || Math.abs(g1[i].y - gm[i].y) > 1e-9)
        throw new Error(`MIRROR broken: ${el.key} node ${i}`);
  }
  console.log("assert MIRROR OK: -1 is the exact x-negation of +1 (same dy: arcs lift both ways)");

  // ---- probes (design-log material) ------------------------------------------
  console.log("\n=== probes: tip displacement at +1 (s = L_free) ===");
  for (const el of ELEMENTS) {
    const v = dispOf(el)(el.domain.y + el.domain.height, 1);
    console.log(` ${el.key.padEnd(12)} L_free=${el.freeLen}px tip -> (${round2(v.x)}, ${round2(v.y)})px`);
  }

  // ---- ops --------------------------------------------------------------------
  const keyOps = ELEMENTS.flatMap((el) =>
    [-1, 1].map((sign) => ({
      file: `key-fix2-${el.key}-${sign > 0 ? "p1" : "m1"}.json`,
      operationId: `op_cp16fix2_key_${el.key}_${sign > 0 ? "p1" : "m1"}`,
      operationType: "editKeyformKey",
      gitMessage: `[cp16-fix2] key ${el.displayName} ${el.param} ${sign > 0 ? "+1" : "-1"} -> ` +
        `isometric pendulum curve (theta(t)=${sign > 0 ? "+" : "-"}30deg*(t/${el.freeLen})^0.5, ` +
        `pos = integral of unit tangent; arc length preserved exactly)` +
        (el.key === "hair_front" ? "; y_fix raised 540->454 (row-5 snap), L_free 319" : ""),
      payload: {
        target: { kind: "rigControl", id: warpId(el) },
        targetProperty: "controlPointOffsets",
        parameterId: el.param,
        interpolation: "linear-1d-v1",
        action: "updateCurrent",
        keyValue: sign,
        statePatch: { propertyPath: "controlPointOffsets", value: grid(el, sign) }
      }
    })));
  const front = DYN_POST[0];
  const dynOps = [{
    file: "dyn-fix2-hair_front_sway_x.json",
    operationId: "op_cp16fix2_dyn_hair_front_sway_x",
    operationType: "updateDynamicsGroup",
    gitMessage: "[cp16-fix2] dynamics dyn_hair_front_sway_x: fixed line 540->454 follow-up — " +
      "segmentLengths [11.8], FaceZ posX 0.046, BodyZ posX 0.39 (FaceX/BodyX/damping/outputs unchanged)",
    payload: {
      dynamicsGroupId: front.id,
      inputs: front.inputs,
      chain: front.chain
    }
  }];

  writeFileSync(join(HERE, "batch-keys-fix2.json"), JSON.stringify(keyOps, null, 2));
  writeFileSync(join(HERE, "batch-dynamics-fix2.json"), JSON.stringify(dynOps, null, 2));

  const design = ELEMENTS.map((el) => ({
    sig: `rigControl:${warpId(el)}:${el.param}`,
    control: {
      id: warpId(el), displayName: el.displayName, wrapDrawable: el.wrapDrawable,
      parent: el.parent, domain: el.domain, cols: el.cols, rows: el.rows,
      yFix: el.yFix, freeLen: el.freeLen, kappa: KAPPA
    },
    keys: [
      { value: -1, statePatch: grid(el, -1) },
      { value: 0, statePatch: grid(el, 0) },
      { value: 1, statePatch: grid(el, 1) }
    ]
  }));
  writeFileSync(join(HERE, "design-values-fix2.json"), JSON.stringify(
    { THETA_MAX_DEG, KAPPA, design, dynPre: DYN_PRE, dynPost: DYN_POST }, null, 1));
  console.log("\ngen: batch-keys-fix2.json (12 ops) + batch-dynamics-fix2.json (1 op) + design-values-fix2.json");
};

// ================================ SNAPSHOT ===================================
const snapshot = () => {
  const snap = {
    packageRevision: JSON.parse(readFileSync(join(PKG, "manifest.json"), "utf8")).packageRevision,
    rigControlsCanon: canon(readModel("rig-controls.json")),
    keyforms: readModel("keyforms.json"),
    dynamics: readModel("dynamics.json"),
    meshesCanon: canon(readModel("meshes.json")),
    drawablesCanon: canon(readModel("drawables.json")),
    drawOrderCanon: canon(readModel("draw-order.json")),
    masksCanon: canon(readModel("masks.json")),
    parametersCanon: canon(readModel("parameters.json"))
  };
  writeFileSync(join(HERE, "snapshot-fix2-pre.json"), JSON.stringify(snap));
  console.log(`snapshot: fix2 pre state saved at revision ${snap.packageRevision}`);
};

// ================================= VERIFY ====================================
const verify = () => {
  const pre = JSON.parse(readFileSync(join(HERE, "snapshot-fix2-pre.json"), "utf8"));
  const designFile = JSON.parse(readFileSync(join(HERE, "design-values-fix2.json"), "utf8"));
  const expectedSets = new Map(designFile.design.map((d) => [d.sig, d]));
  const post = {
    rigControlsCanon: canon(readModel("rig-controls.json")),
    keyforms: readModel("keyforms.json"),
    dynamics: readModel("dynamics.json"),
    meshesCanon: canon(readModel("meshes.json")),
    drawablesCanon: canon(readModel("drawables.json")),
    drawOrderCanon: canon(readModel("draw-order.json")),
    masksCanon: canon(readModel("masks.json")),
    parametersCanon: canon(readModel("parameters.json"))
  };
  let failures = 0;
  const check = (label, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
    if (!ok) failures += 1;
  };

  // 1. untouched files byte-identical (fix2 touches only keyforms + dynamics)
  check("RIG-CONTROLS byte-identical", pre.rigControlsCanon === post.rigControlsCanon);
  check("MESHES byte-identical", pre.meshesCanon === post.meshesCanon);
  check("DRAWABLES byte-identical", pre.drawablesCanon === post.drawablesCanon);
  check("DRAW-ORDER byte-identical", pre.drawOrderCanon === post.drawOrderCanon);
  check("MASKS byte-identical", pre.masksCanon === post.masksCanon);
  check("PARAMETERS byte-identical", pre.parametersCanon === post.parametersCanon);

  // 2. keyformSets: all non-cp16 sets byte-identical (88 = human-correction
  //    guard), cp16 sets: 0-key byte-identical, ±1 == fix2 design
  const cp16Sigs = new Set(expectedSets.keys());
  const preSets = new Map(pre.keyforms.keyformSets.map((s) => [s.keyformSetId, s]));
  const postSets = new Map(post.keyforms.keyformSets.map((s) => [s.keyformSetId, s]));
  check("KEYFORMS set count unchanged", preSets.size === postSets.size,
    `(${preSets.size} -> ${postSets.size})`);
  let unchanged = 0, nonCp16 = 0;
  for (const [id, s] of preSets) {
    const p = postSets.get(id);
    if (cp16Sigs.has(sigOf(s))) continue;
    nonCp16 += 1;
    if (p !== undefined && canon(p) === canon(s)) unchanged += 1;
    else check(`keyformSet ${id} unchanged`, false);
  }
  check(`KEYFORMS all ${nonCp16} non-cp16 sets byte-identical (human-correction guard)`,
    unchanged === nonCp16, `(${unchanged}/${nonCp16})`);
  const GUARDED = pre.keyforms.keyformSets
    .map((s) => s.keyformSetId)
    .filter((id) => /bodyx_tie|topwear/.test(id));
  for (const id of GUARDED)
    check(`  guarded set ${id} byte-identical`,
      canon(postSets.get(id)) === canon(preSets.get(id)));
  for (const [sig, d] of expectedSets) {
    const preS = pre.keyforms.keyformSets.find((s) => sigOf(s) === sig);
    const postS = post.keyforms.keyformSets.find((s) => sigOf(s) === sig);
    if (!preS || !postS) { check(`cp16 set ${sig} exists pre+post`, false); continue; }
    check(`  cp16 set ${sig} same id/binding`,
      preS.keyformSetId === postS.keyformSetId &&
      postS.interpolation === "linear-1d-v1" &&
      (postS.compositionMode ?? "replace") === (preS.compositionMode ?? "replace"));
    const zeroPre = preS.keys.find((k) => k.value === 0);
    const zeroPost = postS.keys.find((k) => k.value === 0);
    check(`  cp16 set ${sig} 0-key byte-identical (identity untouched)`,
      canon(zeroPre) === canon(zeroPost) &&
      zeroPost.statePatch.every((v) => v.x === 0 && v.y === 0));
    const got = [...postS.keys].sort((a, b) => a.value - b.value)
      .map((k) => ({ value: k.value, statePatch: k.statePatch }));
    check(`  cp16 set ${sig} keys == fix2 design (-1/0/+1 grids)`,
      canon(got) === canon(d.keys));
  }

  // 3. dynamics: front == fix2 design, other three byte-identical to pre;
  //    MECHANICAL ASSERT: zero angle inputs anywhere in dynamics.json
  check("DYNAMICS schema v3", post.dynamics.schemaVersion === "dynamics-file-v3");
  const preGroups = pre.dynamics.dynamicsGroups ?? pre.dynamics.groups ?? [];
  const postGroups = post.dynamics.dynamicsGroups ?? post.dynamics.groups ?? [];
  check("DYNAMICS exactly 4 groups", postGroups.length === 4, `(${postGroups.length})`);
  for (const g of designFile.dynPost) {
    const got = postGroups.find((x) => (x.dynamicsGroupId ?? x.id) === g.id);
    const was = preGroups.find((x) => (x.dynamicsGroupId ?? x.id) === g.id);
    if (!got || !was) { check(`dynamics ${g.id} exists pre+post`, false); continue; }
    if (g.id === "dyn_hair_front_sway_x") {
      check(`  dynamics ${g.id}: inputs == fix2 design (FaceZ 0.046 / BodyZ 0.39, FaceX/BodyX kept)`,
        canon(got.inputs) === canon(g.inputs));
      check(`  dynamics ${g.id}: chain == fix2 design (segmentLengths [11.8]; damping/gravity kept)`,
        canon(got.chain) === canon(g.chain) &&
        got.chain.damping === was.chain.damping &&
        got.chain.gravityScale === was.chain.gravityScale);
      check(`  dynamics ${g.id}: outputs byte-identical to pre (untouched)`,
        canon(got.outputs) === canon(was.outputs) && got.enabled !== false);
    } else {
      check(`  dynamics ${g.id}: ENTIRE group byte-identical to pre (untouched)`,
        canon(got) === canon(was));
    }
  }
  const angleInputs = postGroups.flatMap((x) => (x.inputs ?? []).filter((i) => i.kind === "angle"));
  const kinds = [...new Set(postGroups.flatMap((x) => (x.inputs ?? []).map((i) => i.kind)))];
  check("DYNAMICS mechanical assert: ZERO angle inputs in the whole file " +
    "(steady state structurally = static pose for any held input)",
    angleInputs.length === 0, `(kinds present: ${kinds.join(",")})`);

  console.log(failures === 0 ? "VERIFY: ALL PASS" : `VERIFY: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
};

const mode = process.argv[2];
if (mode === "gen") gen();
else if (mode === "snapshot") snapshot();
else if (mode === "verify") verify();
else { console.log("usage: gen | snapshot | verify"); process.exit(1); }
