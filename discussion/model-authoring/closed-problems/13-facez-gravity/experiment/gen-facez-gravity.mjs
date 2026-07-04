// cp13 FaceZ gravity warps — PRIMARY SOURCE of every cp13 number.
//
// Physics (problem-definition 13, gravity template of cp08fix applied to the
// cp12 rotation field instead of the spherical field):
//
//   net(u,y) = W(y) * rot(u,y) + (1 - W(y)) * rot(u, y_root(u))
//
//   rot(p, theta) = R(pivot, theta) . p - p     (pivot = (995.5, 596), cp12 canon)
//   theta = +-10 deg at param_face_angle_z = +-30 (y-down: positive = clockwise)
//
// W boundaries / y_root reused from cp08 ("skull contact" is axis-independent):
//   front hair  y<=500 -> 1, 500..773 smoothstep -> 0.7 (light tail decay only)
//   tufts L/R   y<=550 -> 1, 550..900 smoothstep -> 0
//   curtains    y<=500 -> 1, 500..1000 smoothstep -> 0
//
// TWO COMPOSITIONS of the same net rule (the design fork under test):
//   - front hair sits INSIDE rig_facez_head (receives full rotation from the
//     parent). Its new warp writes the DIFFERENTIAL CORRECTION
//       c(u,y) = (1 - W(y)) * (rot(u, y_root) - rot(u,y))
//     so that designed net = rot + c = W*rot + (1-W)*rot(root)  (algebraic).
//     NOTE the actual runtime composition is R(p + c(p)) - p = rot(p) + R*c(p):
//     the parent rotates the correction vector, leaving an O(theta^2) residual
//     (R - I)*c against the ideal net rule. Same class as the arc/chord term
//     the problem definition already tolerates (<~1px for the head band); its
//     actual max over the front lattice is printed below and re-measured on
//     evaluated vertices by assert-facez-gravity.mjs.
//   - tufts L/R + back hair L/R sit OUTSIDE the rotation (roots). Their new
//     warps write the FULL field net(u,y) themselves, including the root-band
//     rotation (warp linearization of +-10 deg: arc-chord < 1px, tolerated).
//
// Lattice/domain rule: same as cp08 (domain = wrapped BodyX tower domain
// + x±36 / y±40 margin — verified identical to the FaceY domains; grid dims
// reuse cp08's row densification across the smoothstep bands). In x the field
// is exactly linear at fixed y (rot is affine), so bilinear columns are exact;
// rows carry the smoothstep-times-affine cubic.
//
// Modes:
//   node gen-facez-gravity.mjs gen      -> asserts + batch-a.json (front create)
//                                          + batch-b.json (rest) + design-values.json
//   node gen-facez-gravity.mjs snapshot -> snapshot-pre.json from the live package
//   node gen-facez-gravity.mjs verify   -> untouched/changed-as-designed check
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";

// ---- cp12 rotation canon ----------------------------------------------------
const PIVOT = { x: 995.5, y: 596 };
const THETA_MAX_DEG = 10;                 // param +-30 -> +-10 deg
const PARAM = "param_face_angle_z";
const FACEZ_HEAD = "rig_facez_head";

const rotDisp = (x, y, thetaDeg) => {
  const t = (thetaDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const u = x - PIVOT.x, v = y - PIVOT.y;
  return { x: c * u - s * v - u, y: s * u + c * v - v };
};

// ---- cp08 gravity dials (reused verbatim) ------------------------------------
const W_FRONT = { yHead: 500, yFree: 773, wTip: 0.7 };
const W_TUFT  = { yHead: 550, yFree: 900, wTip: 0 };
const W_CURT  = { yHead: 500, yFree: 1000, wTip: 0 };
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const weight = ({ yHead, yFree, wTip }) => (y) =>
  y <= yHead ? 1 : 1 - (1 - wTip) * smooth((y - yHead) / (yFree - yHead));

// ---- fields ------------------------------------------------------------------
// full field (tufts/curtains, warp outside the rotation writes everything):
const fullField = (dial) => (x, y, theta) => {
  const w = weight(dial)(y);
  const s = rotDisp(x, y, theta), r = rotDisp(x, dial.yHead, theta);
  return { x: w * s.x + (1 - w) * r.x, y: w * s.y + (1 - w) * r.y };
};
// differential correction (front hair, warp inside the rotation):
const corrField = (dial) => (x, y, theta) => {
  const w = weight(dial)(y);
  const s = rotDisp(x, y, theta), r = rotDisp(x, dial.yHead, theta);
  return { x: (1 - w) * (r.x - s.x), y: (1 - w) * (r.y - s.y) };
};

// ---- elements (domains = wrapped BodyX domain + x±36/y±40 = cp08 FaceY domains,
//      confirmed against the live rig-controls.json at rev 363) ----------------
const ELEMENTS = [
  { key: "hair_front", displayName: "FaceZ Hair Front", wrap: "rig_bodyx_hair_front",
    domain: { x: 619, y: 95, width: 764, height: 718 }, cols: 11, rows: 11,
    mode: "corr", dial: W_FRONT, parentExpected: FACEZ_HEAD },
  { key: "hair_f_r", displayName: "FaceZ Hair F R", wrap: "rig_bodyx_hair_f_r",
    domain: { x: 972, y: 187, width: 360, height: 801 }, cols: 7, rows: 11,
    mode: "full", dial: W_TUFT, parentExpected: undefined },
  { key: "hair_f_l", displayName: "FaceZ Hair F L", wrap: "rig_bodyx_hair_f_l",
    domain: { x: 659, y: 227, width: 346, height: 779 }, cols: 7, rows: 11,
    mode: "full", dial: W_TUFT, parentExpected: undefined },
  { key: "back_hair_r", displayName: "FaceZ Back Hair R", wrap: "rig_bodyx_back_hair_r",
    domain: { x: 339, y: 270, width: 734, height: 1600 }, cols: 11, rows: 13,
    mode: "full", dial: W_CURT, parentExpected: undefined },
  { key: "back_hair_l", displayName: "FaceZ Back Hair L", wrap: "rig_bodyx_back_hair_l",
    domain: { x: 931, y: 232, width: 609, height: 1585 }, cols: 11, rows: 13,
    mode: "full", dial: W_CURT, parentExpected: undefined }
];
const newId = (el) => `rig_facez_${el.key}`;
const WRAPPED = ELEMENTS.map((e) => e.wrap);
const PRE_PARENT = { rig_bodyx_hair_front: FACEZ_HEAD }; // others were roots

const round2 = (n) => Math.round(n * 100) / 100 || 0; // normalize -0 -> 0
const fieldOf = (el) => (el.mode === "corr" ? corrField(el.dial) : fullField(el.dial));
const grid = (el, theta) => {
  const f = fieldOf(el), out = [];
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      const v = theta === 0 ? { x: 0, y: 0 } : f(x, y, theta);
      out.push({ x: round2(v.x), y: round2(v.y) });
    }
  }
  return out;
};

const canon = (v) => JSON.stringify(sortKeys(v));
const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v !== null && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
      : v;
const readModel = (file) => JSON.parse(readFileSync(join(PKG, "model", file), "utf8"));

// =================================== GEN =====================================
const gen = () => {
  // assert 1: gravity identity net - root == W * (rot - root) on every lattice
  // node of every element, both ends (cp08fix identity, rotation-field edition).
  // For the front element the DESIGNED net is rot + corr (algebraically equal).
  for (const el of ELEMENTS) {
    const f = fieldOf(el), w = weight(el.dial);
    for (let r = 0; r < el.rows; r++) {
      const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
      for (let c = 0; c < el.cols; c++) {
        const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
        for (const theta of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
          const s = rotDisp(x, y, theta), root = rotDisp(x, el.dial.yHead, theta);
          const v = f(x, y, theta);
          const net = el.mode === "corr" ? { x: s.x + v.x, y: s.y + v.y } : v;
          for (const k of ["x", "y"]) {
            if (Math.abs((net[k] - root[k]) - w(y) * (s[k] - root[k])) > 1e-9)
              throw new Error(`identity broken: ${el.key} @(${x},${y}) theta=${theta} ${k}`);
          }
        }
      }
    }
  }
  console.log("assert identity OK: net - root == W * (rot - root) at every lattice node, both ends (both compositions, designed values)");

  // assert 2: O(theta^2) composition residual of the front correction:
  // runtime net = rot + R*c, ideal net = rot + c -> residual (R - I)*c.
  let maxRes = 0, at = null;
  const fc = corrField(W_FRONT);
  for (let r = 0; r < ELEMENTS[0].rows; r++) {
    const y = ELEMENTS[0].domain.y + (ELEMENTS[0].domain.height * r) / (ELEMENTS[0].rows - 1);
    for (let c = 0; c < ELEMENTS[0].cols; c++) {
      const x = ELEMENTS[0].domain.x + (ELEMENTS[0].domain.width * c) / (ELEMENTS[0].cols - 1);
      for (const theta of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
        const t = (theta * Math.PI) / 180, cv = fc(x, y, theta);
        const rx = Math.cos(t) * cv.x - Math.sin(t) * cv.y - cv.x;
        const ry = Math.sin(t) * cv.x + Math.cos(t) * cv.y - cv.y;
        const m = Math.hypot(rx, ry);
        if (m > maxRes) { maxRes = m; at = { x, y, theta }; }
      }
    }
  }
  console.log(`front composition residual |(R-I)c|: max ${maxRes.toFixed(3)}px @ ${JSON.stringify(at)} (O(theta^2) class; measured again on evaluated vertices)`);

  // probe table (design-log material)
  const probeRows = [];
  const show = (label, el, x, y) => {
    const th = THETA_MAX_DEG;
    const f = fieldOf(el);
    const mn = f(x, y, -th), mx = f(x, y, th);
    const s = rotDisp(x, y, th), root = rotDisp(x, el.dial.yHead, th);
    probeRows.push(`${label.padEnd(34)} min(${round2(mn.x)},${round2(mn.y)}) max(${round2(mx.x)},${round2(mx.y)}) | rot@max(${round2(s.x)},${round2(s.y)}) root@max(${round2(root.x)},${round2(root.y)}) W=${weight(el.dial)(y).toFixed(3)}`);
  };
  show("tuftR root band (1152,300)", ELEMENTS[1], 1152, 300);
  show("tuftR transition (1152,725)", ELEMENTS[1], 1152, 725);
  show("tuftR tip row (1152,988)", ELEMENTS[1], 1152, 988);
  show("curtR root band (700,400)", ELEMENTS[3], 700, 400);
  show("curtR hanging (700,1400)", ELEMENTS[3], 700, 1400);
  show("curtL hanging (1250,1400)", ELEMENTS[4], 1250, 1400);
  show("front corr tail (1001,773)", ELEMENTS[0], 1001, 773);
  show("front corr crown (1001,200)", ELEMENTS[0], 1001, 200);
  console.log(probeRows.join("\n"));

  // ---- ops -------------------------------------------------------------------
  const createOp = (el) => ({
    file: `create-${el.key}.json`,
    operationId: `op_cp13_create_${el.key}`,
    operationType: "createWarpDeformer",
    gitMessage: `[cp13] warp ${el.displayName} (${el.cols}x${el.rows}) wrapping ${el.wrap}`,
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
    operationId: `op_cp13_key_${el.key}`,
    operationType: "editKeyformKey",
    gitMessage: `[cp13] key ${el.displayName} face_angle_z (${el.mode === "corr" ? "differential correction inside rotation" : "full gravity field outside rotation"})`,
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

  // batch-a = front create alone (wrapChildren INSIDE a rotation deformer is the
  // untested behavior; parentId is inspected before anything else runs).
  writeFileSync(join(HERE, "batch-a.json"), JSON.stringify([createOp(ELEMENTS[0])], null, 2));
  const rest = [...ELEMENTS.slice(1).map(createOp), ...ELEMENTS.map(keyOp)];
  writeFileSync(join(HERE, "batch-b.json"), JSON.stringify(rest, null, 2));

  const design = ELEMENTS.map((el) => ({
    sig: `rigControl:${newId(el)}:${PARAM}`,
    control: {
      id: newId(el), displayName: el.displayName, wrap: el.wrap,
      domain: el.domain, cols: el.cols, rows: el.rows,
      parentExpected: el.parentExpected ?? null, mode: el.mode,
      dial: el.dial
    },
    keys: [
      { value: -30, statePatch: grid(el, -THETA_MAX_DEG) },
      { value: 0, statePatch: grid(el, 0) },
      { value: 30, statePatch: grid(el, THETA_MAX_DEG) }
    ]
  }));
  writeFileSync(join(HERE, "design-values.json"), JSON.stringify(
    { PIVOT, THETA_MAX_DEG, PARAM, design }, null, 1));
  console.log(`gen: batch-a.json (1 op) + batch-b.json (${rest.length} ops) + design-values.json`);
};

// ================================ SNAPSHOT ===================================
const snapshot = () => {
  const snap = {
    packageRevision: JSON.parse(readFileSync(join(PKG, "manifest.json"), "utf8")).packageRevision,
    rigControls: readModel("rig-controls.json"),
    keyforms: readModel("keyforms.json"),
    meshesCanon: canon(readModel("meshes.json")),
    graphRootIds: readModel("graph.json").rigControlRootIds ?? null
  };
  writeFileSync(join(HERE, "snapshot-pre.json"), JSON.stringify(snap));
  console.log(`snapshot: pre state saved at revision ${snap.packageRevision}`);
};

// ================================= VERIFY ====================================
const verify = () => {
  const pre = JSON.parse(readFileSync(join(HERE, "snapshot-pre.json"), "utf8"));
  const designFile = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
  const post = {
    rigControls: readModel("rig-controls.json"),
    keyforms: readModel("keyforms.json"),
    meshesCanon: canon(readModel("meshes.json"))
  };
  let failures = 0;
  const check = (label, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
    if (!ok) failures += 1;
  };

  // 1. meshes untouched
  check("MESHES byte-identical", pre.meshesCanon === post.meshesCanon);

  // 2. keyformSets: every pre set unchanged (named human-corrected sets called
  //    out), exactly 5 new sets matching the design grids.
  const preSets = new Map(pre.keyforms.keyformSets.map((s) => [s.keyformSetId, canon(s)]));
  const postSets = new Map(post.keyforms.keyformSets.map((s) => [s.keyformSetId, s]));
  let unchanged = 0;
  for (const [id, c] of preSets) {
    const p = postSets.get(id);
    if (p !== undefined && canon(p) === c) unchanged += 1;
    else check(`keyformSet ${id} unchanged`, false);
  }
  check("KEYFORMS pre sets unchanged", unchanged === preSets.size, `(${unchanged}/${preSets.size})`);
  for (const id of pre.keyforms.keyformSets
    .map((s) => s.keyformSetId)
    .filter((id) => /headwear.*face_angle_x|topwear|tie/.test(id))) {
    check(`  named human-corrected set ${id}`, canon(postSets.get(id)) === preSets.get(id));
  }
  const newSets = post.keyforms.keyformSets.filter((s) => !preSets.has(s.keyformSetId));
  check("KEYFORMS exactly five new sets", newSets.length === 5, `(${newSets.length})`);
  for (const d of designFile.design) {
    const s = newSets.find((s) => `${s.target.kind}:${s.target.id}:${s.parameterId}` === d.sig.replace(/^rigControl:/, "rigControl:"));
    const sMatch = newSets.find((s) => s.target.id === d.control.id && s.parameterId === PARAM);
    if (!sMatch) { check(`new set for ${d.control.id} exists`, false); continue; }
    const gotKeys = [...sMatch.keys].sort((a, b) => a.value - b.value)
      .map((k) => ({ value: k.value, statePatch: k.statePatch }));
    check(`  ${d.control.id} keys match design (-30/0/+30 grids)`,
      canon(gotKeys) === canon(d.keys));
    check(`  ${d.control.id} property/interp/composition`,
      sMatch.target.property === "controlPointOffsets" &&
      sMatch.interpolation === "linear-1d-v1" &&
      (sMatch.compositionMode ?? "replace") === "replace");
  }

  // 3. rig controls
  const preRC = new Map(pre.rigControls.rigControls.map((r) => [r.rigControlId, r]));
  const postRC = new Map(post.rigControls.rigControls.map((r) => [r.rigControlId, r]));
  const stripParent = ({ parentId, ...rest }) => rest;
  const stripChildren = ({ childRigControlIds, ...rest }) => rest;
  const expectedParentOfWrapped = Object.fromEntries(ELEMENTS.map((el) => [el.wrap, newId(el)]));
  let untouched = 0;
  for (const [id, r] of preRC) {
    const p = postRC.get(id);
    if (p === undefined) { check(`rigControl ${id} still exists`, false); continue; }
    if (WRAPPED.includes(id)) {
      const bodyUnchanged = canon(stripParent(r)) === canon(stripParent(p));
      const parentOk = p.parentId === expectedParentOfWrapped[id] &&
        r.parentId === PRE_PARENT[id]; // undefined for the ex-root towers
      check(`  wrapped ${id}: canonical-minus-parentId identical + parentId=${expectedParentOfWrapped[id]}`,
        bodyUnchanged && parentOk, bodyUnchanged ? (parentOk ? "" : `(parent ${r.parentId} -> ${p.parentId})`) : "(body changed!)");
    } else if (id === FACEZ_HEAD) {
      const bodyUnchanged = canon(stripChildren(r)) === canon(stripChildren(p));
      const expectedChildren = r.childRigControlIds.map((cid) =>
        cid === "rig_bodyx_hair_front" ? "rig_facez_hair_front" : cid);
      check("  rig_facez_head: canonical-minus-children identical + hair_front slot replaced by rig_facez_hair_front",
        bodyUnchanged && canon(p.childRigControlIds) === canon(expectedChildren),
        JSON.stringify(p.childRigControlIds));
    } else if (canon(r) === canon(p)) {
      untouched += 1;
    } else {
      check(`rigControl ${id} byte-identical`, false);
    }
  }
  check("RIGCONTROLS all other controls byte-identical",
    untouched === preRC.size - WRAPPED.length - 1,
    `(${untouched}/${preRC.size - WRAPPED.length - 1})`);

  // 4. the five new warps
  const newRC = [...postRC.keys()].filter((id) => !preRC.has(id));
  check("RIGCONTROLS exactly five new controls",
    newRC.length === 5 && canon([...newRC].sort()) === canon(ELEMENTS.map(newId).sort()),
    newRC.join(","));
  for (const el of ELEMENTS) {
    const w = postRC.get(newId(el));
    if (!w) { check(`new warp ${newId(el)} exists`, false); continue; }
    check(`  ${newId(el)}: warpLattice2d ${el.cols}x${el.rows}, domain as designed, wraps ${el.wrap}, parent=${el.parentExpected ?? "ROOT"}`,
      w.kind === "warpLattice2d" &&
      w.latticeColumns === el.cols && w.latticeRows === el.rows &&
      canon(w.domainBounds) === canon(el.domain) &&
      canon(w.childRigControlIds) === canon([el.wrap]) &&
      (w.childDrawableIds ?? []).length === 0 &&
      w.parentId === el.parentExpected);
  }

  // 5. graph roots: minus the 4 ex-root towers, plus the 4 new outside warps
  //    (the front warp lives inside rig_facez_head and must NOT be a root).
  const postRoots = readModel("graph.json").rigControlRootIds ?? null;
  if (pre.graphRootIds !== null && postRoots !== null) {
    const outside = ELEMENTS.filter((el) => el.parentExpected === undefined);
    const expectedRoots = new Set(
      pre.graphRootIds.filter((id) => !outside.map((el) => el.wrap).includes(id))
        .concat(outside.map(newId)));
    check("GRAPH roots = pre minus 4 towers plus 4 outside warps (front warp not a root)",
      canon([...new Set(postRoots)].sort()) === canon([...expectedRoots].sort()) &&
      !postRoots.includes("rig_facez_hair_front"));
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
