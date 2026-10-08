// cp11: BodyX head shallow sync — the SIMILARITY-HYPOTHESIS testbed.
//
//   HYPOTHESIS ("parameter families are similar"): head element BodyX field
//     = ALPHA x (that element's COMMITTED FaceX field), ALPHA = 0.6 (cp10 canon,
//     derived there as collar carriage / FaceX chin field = 10.03/16.47 = 0.609).
//
// If true, the whole head BodyX rig is a ZERO-UNKNOWN mechanical transplant:
// no design, no formula re-evaluation — read the committed FaceX keyforms
// (human corrections included: hat dy field C10, back_top_hair dy) and copy
// them point-to-point scaled by ALPHA (dx AND dy), onto new BodyX deformers
// whose domain + lattice dims EQUAL the element's FaceX deformer (recipe 06
// transplant discipline: grid-match assertion before point-to-point copy).
//
// Structure: 18 head towers. Committed stack is FaceY > FaceX > element
// (FaceY towers are the roots). New BodyX deformer wrapChildren's the FaceY
// tower => stack becomes BodyX > FaceY > FaceX > element (user convention).
//
// Keys: param_body_angle_x (preset -10..+10, same sign convention as FaceX
// -30..+30): BodyX min(-10) = ALPHA x FaceX min(-30) patch, max(+10) = ALPHA x
// FaceX max(+30) patch, center 0 = zeros (BodyX=0 identity => byte-stable
// regression). Uniform ALPHA — NO alpha^2 scale correction (gate-only dial,
// problem-definition ruling).
//
// Sources of numbers: committed model files ONLY (keyforms.json/rig-controls
// .json). ALPHA is the single constant. This file re-evaluates NO field
// formulas — that is the point of the experiment.
//
// Usage:
//   node gen-bodyx-head.mjs          -> asserts + snapshot + batch-rig.json
//                                       + design-values.json + probes
//   node gen-bodyx-head.mjs verify   -> post-commit untouched-guarantee +
//                                       new-state-matches-design proof
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

const ALPHA = 0.6; // cp10 canon (gen-bodyx-torso.mjs HEAD SYNC GAIN section)
const Y_CHIN = 577; // head-neck junction row (cp10 canon, used for probes only)

// ---- committed model files ----
const kfs = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8")).keyformSets;
const rcs = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8")).rigControls;
const meshes = JSON.parse(readFileSync(`${PKG}/model/meshes.json`, "utf8")).meshes;
const graph = JSON.parse(readFileSync(`${PKG}/model/graph.json`, "utf8"));
const rcById = (id) => rcs.find((r) => r.rigControlId === id);
const setOf = (id, param) => kfs.find((s) => s.target?.id === id && s.parameterId === param);

// ---- the 18 head towers (suffix joins facex/facey/new bodyx ids) ----
const SUFFIXES = [
  "face", "nose", "mouth", "eye_l", "eye_r", "brow_l", "brow_r",
  "eyewear", "headwear", "ears_l", "ears_r", "hair_front",
  "hair_f_l", "hair_f_r", "back_hair_l", "back_hair_r",
  "back_top_hair_l", "back_top_hair_r"
];
if (SUFFIXES.length !== 18) throw new Error("head tower count must be 18");

const ELEMENTS = SUFFIXES.map((sfx) => {
  const facex = rcById(`rig_facex_${sfx}`);
  const facey = rcById(`rig_facey_${sfx}`);
  if (!facex || !facey) throw new Error(`missing tower for ${sfx}`);
  return {
    sfx,
    facex,
    facey,
    bodyxId: `rig_bodyx_${sfx}`,
    displayName: facex.displayName.replace(/^FaceX /, "BodyX ")
  };
});

const mode = process.argv[2] ?? "gen";

// ---- assert TOPO (gen only — the wrap itself changes this topology): FaceY
// wraps FaceX, FaceY is a root => wrap target is right. verify mode proves the
// POST topology independently below.
for (const el of mode === "verify" ? [] : ELEMENTS) {
  if (el.facey.parentId !== undefined)
    throw new Error(`${el.facey.rigControlId} is not a root (parent ${el.facey.parentId}) — wrap plan invalid, escalate`);
  const kids = el.facey.childRigControlIds ?? [];
  if (kids.length !== 1 || kids[0] !== el.facex.rigControlId)
    throw new Error(`${el.facey.rigControlId} does not wrap exactly ${el.facex.rigControlId} — escalate`);
  if (el.facex.parentId !== el.facey.rigControlId)
    throw new Error(`${el.facex.rigControlId} parent is not ${el.facey.rigControlId} — escalate`);
  if (!graph.rigControlRootIds.includes(el.facey.rigControlId))
    throw new Error(`${el.facey.rigControlId} missing from graph roots`);
  if (rcById(el.bodyxId)) throw new Error(`${el.bodyxId} already exists`);
}
if (mode !== "verify")
  console.log("assert TOPO OK: 18 FaceY roots each wrapping exactly their FaceX tower; no bodyx head ids taken");

// ---- assert GRID: FaceX restControlPoints == uniform grid over its domain ----
// The new BodyX deformer is created by the host as the uniform grid over the
// SAME domain with the SAME lattice dims => restControlPoints match FaceX's
// point-to-point. This assertion IS the transplant precondition (recipe 06).
for (const el of ELEMENTS) {
  const r = el.facex, d = r.domainBounds, n = r.latticeColumns, m = r.latticeRows;
  if (r.restControlPoints.length !== n * m)
    throw new Error(`${r.rigControlId}: restControlPoints length mismatch`);
  for (let row = 0; row < m; row++) for (let c = 0; c < n; c++) {
    const p = r.restControlPoints[row * n + c];
    const ex = d.x + (d.width * c) / (n - 1), ey = d.y + (d.height * row) / (m - 1);
    if (Math.abs(p.x - ex) > 1e-9 || Math.abs(p.y - ey) > 1e-9)
      throw new Error(`${r.rigControlId}: rest grid not uniform at (${row},${c}) — point-to-point premise broken, escalate`);
  }
}
console.log("assert GRID OK: 18 FaceX rest grids exactly uniform => BodyX twin grids will match point-to-point");

// ---- assert KEYS: committed FaceX sets are -30/0/30, zero default, full patch --
for (const el of ELEMENTS) {
  const s = setOf(el.facex.rigControlId, "param_face_angle_x");
  if (!s) throw new Error(`${el.facex.rigControlId}: no FaceX keyform set`);
  const values = s.keys.map((k) => k.value).sort((a, b) => a - b).join(",");
  if (values !== "-30,0,30") throw new Error(`${el.facex.rigControlId}: keys ${values} != -30,0,30`);
  const size = el.facex.latticeColumns * el.facex.latticeRows;
  for (const k of s.keys) {
    if (k.statePatch.length !== size)
      throw new Error(`${el.facex.rigControlId}@${k.value}: patch ${k.statePatch.length} != ${size}`);
  }
  const def = s.keys.find((k) => k.value === 0);
  if (def.statePatch.some((p) => p.x !== 0 || p.y !== 0))
    throw new Error(`${el.facex.rigControlId}: default key not zero — copy semantics unclear, escalate`);
  el.set = s;
}
console.log("assert KEYS OK: 18 committed FaceX sets, keys -30/0/30, zero defaults, patch = lattice size");

const round2 = (v) => Math.round(v * 100) / 100;
const scaled = (patch) => patch.map((p) => ({ x: round2(ALPHA * p.x), y: round2(ALPHA * p.y) }));
const zeros = (nPts) => Array.from({ length: nPts }, () => ({ x: 0, y: 0 }));

// ---- junction probe: predicted head chin field vs committed neck top row ----
// cp10 committed the neck top row as H(=1 there) x ALPHA x Xchin(x) — the same
// value this transplant will give the face bottom. Static prediction of the
// junction gap, before any commit (tape-measure verification comes post-op).
{
  const face = ELEMENTS.find((e) => e.sfx === "face");
  const bilin = (ctrl, patch, x, y, comp) => {
    const d = ctrl.domainBounds, n = ctrl.latticeColumns, m = ctrl.latticeRows;
    const fx = ((x - d.x) / d.width) * (n - 1), fy = ((y - d.y) / d.height) * (m - 1);
    const c0 = Math.max(0, Math.min(n - 2, Math.floor(fx))), r0 = Math.max(0, Math.min(m - 2, Math.floor(fy)));
    const tx = fx - c0, ty = fy - r0;
    const p = (r, c) => patch[r * n + c][comp];
    return p(r0, c0) * (1 - tx) * (1 - ty) + p(r0, c0 + 1) * tx * (1 - ty) +
      p(r0 + 1, c0) * (1 - tx) * ty + p(r0 + 1, c0 + 1) * tx * ty;
  };
  const neck = rcById("rig_bodyx_neck");
  const neckSet = setOf("rig_bodyx_neck", "param_body_angle_x");
  console.log("\njunction prediction (neck top row y527 committed  vs  ALPHA x FaceX face @ chin y577):");
  console.log("  x      neck.min  head.min   gap |  neck.max  head.max   gap");
  for (const [which, faceKey] of [["min", -30], ["max", 30]]) { void which; void faceKey; }
  const n = neck.latticeColumns;
  for (let c = 0; c < n; c++) {
    const x = neck.restControlPoints[c].x;
    const row = [x.toFixed(0).padStart(5)];
    for (const [neckVal, faceVal] of [[-10, -30], [10, 30]]) {
      const nv = neckSet.keys.find((k) => k.value === neckVal).statePatch[c].x;
      const hv = ALPHA * bilin(face.facex, face.set.keys.find((k) => k.value === faceVal).statePatch, x, Y_CHIN, "x");
      row.push(nv.toFixed(2).padStart(9), hv.toFixed(2).padStart(9), (hv - nv).toFixed(2).padStart(6));
      if (neckVal === -10) row.push(" |");
    }
    console.log("  " + row.join(""));
  }
}

// ---- snapshot (first gen run only) ----
const SNAP = new URL("snapshot-pre.json", HERE);
if (mode !== "verify") {
  if (!existsSync(SNAP)) {
    writeFileSync(SNAP, JSON.stringify({
      sets: kfs.map((s) => ({
        sig: `${s.target?.kind}:${s.target?.id}:${s.parameterId}`,
        keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
      })),
      rigControls: rcs.map((r) => ({ id: r.rigControlId, json: JSON.stringify(r) })),
      meshes: meshes.map((m) => ({ id: m.drawableId, json: JSON.stringify(m) })),
      rootIds: graph.rigControlRootIds
    }));
    console.log("\nsnapshot-pre.json written (committed pre-cp11 state)");
  } else console.log("\nsnapshot-pre.json already present — kept");
}

// ---- design values + batch (18 warps then 18 keys; 1 op = 1 git commit) ----
const design = [];
const batch = [];
for (const el of ELEMENTS) {
  const fx = el.facex;
  batch.push({
    file: `warp-${el.sfx}.json`,
    operationId: `op_cp11_warp_${el.sfx}`,
    operationType: "createWarpDeformer",
    payload: {
      displayName: el.displayName,
      childDrawableIds: [],
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: { ...fx.domainBounds },
      transformColumns: fx.latticeColumns, transformRows: fx.latticeRows,
      bezierColumns: fx.latticeColumns, bezierRows: fx.latticeRows,
      bezierEditType: "cubicBezierSurfaceV1",
      wrapChildren: [{ kind: "rigControl", id: el.facey.rigControlId }]
    },
    gitMessage: `[cp11] warp ${el.displayName} (${fx.latticeColumns}x${fx.latticeRows} = FaceX twin grid) wraps ${el.facey.rigControlId}`
  });
}
for (const el of ELEMENTS) {
  const size = el.facex.latticeColumns * el.facex.latticeRows;
  const patches = {
    min: { propertyPath: "controlPointOffsets", value: scaled(el.set.keys.find((k) => k.value === -30).statePatch) },
    default: { propertyPath: "controlPointOffsets", value: zeros(size) },
    max: { propertyPath: "controlPointOffsets", value: scaled(el.set.keys.find((k) => k.value === 30).statePatch) }
  };
  design.push({
    sig: `rigControl:${el.bodyxId}:param_body_angle_x`,
    displayName: el.displayName,
    keys: [
      { value: -10, statePatch: patches.min.value },
      { value: 0, statePatch: patches.default.value },
      { value: 10, statePatch: patches.max.value }
    ]
  });
  batch.push({
    file: `key-${el.sfx}.json`,
    operationId: `op_cp11_key_${el.sfx}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: el.bodyxId },
      targetProperty: "controlPointOffsets",
      parameterId: "param_body_angle_x",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: patches
    },
    gitMessage: `[cp11] key ${el.displayName} body_angle_x = ${ALPHA} x committed FaceX patch (dx+dy, createEndsCenter -10/0/+10)`
  });
}

// ---- verify mode ----
const canon = (o) =>
  JSON.stringify(o, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]))
      : v
  );
if (mode === "verify") {
  const snap = JSON.parse(readFileSync(SNAP, "utf8"));
  const designWant = JSON.parse(readFileSync(new URL("design-values.json", HERE), "utf8"));
  // 1. keyform sets: every pre-existing set byte-identical; 18 new match design
  const newSigs = new Set(designWant.map((d) => d.sig));
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
  for (const named of [
    "rigControl:rig_facex_headwear:param_face_angle_x",           // hat X human correction C10
    "rigControl:rig_bodyx_topwear:param_body_angle_x",            // cp10fix + user human finish
    "rigControl:rig_bodyx_tie:param_body_angle_x",                // cp10fix + user human finish
    "rigControl:rig_bodyx_neck:param_body_angle_x",               // alpha canon junction partner
    "rigControl:rig_neck_back_warp_deformer:param_body_angle_x"
  ]) {
    if (!oldSets.some(({ sig }) => sig === named))
      throw new Error(`named untouched set missing: ${named}`);
  }
  console.log(`untouched sets OK: ${oldSets.length} byte-identical (hat X C10, topwear/tie human finish, neck alpha canon NAMED-CONFIRMED)`);
  for (const { sig, s } of addedSets) {
    const dsg = designWant.find((d) => d.sig === sig);
    if (!dsg) throw new Error(`unexpected new set ${sig}`);
    if (s.keys.length !== 3) throw new Error(`${sig}: expected 3 keys`);
    for (const k of s.keys) {
      const want = dsg.keys.find((w) => w.value === k.value);
      if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
        throw new Error(`new set ${sig}@${k.value} does not match design values`);
    }
  }
  if (addedSets.length !== 18) throw new Error(`expected 18 new sets, got ${addedSets.length}`);
  // 2. rig controls: pre-existing byte-identical EXCEPT the 18 wrapped FaceY
  //    roots whose ONLY change is parentId -> the new BodyX id; 18 new controls
  //    are exact FaceX grid twins wrapping their FaceY.
  const faceyToBodyx = new Map(ELEMENTS.map((el) => [el.facey.rigControlId, el.bodyxId]));
  const preRc = new Map(snap.rigControls.map((r) => [r.id, r.json]));
  let newRc = 0;
  for (const r of rcs) {
    const pre = preRc.get(r.rigControlId);
    if (!pre) {
      const el = ELEMENTS.find((e) => e.bodyxId === r.rigControlId);
      if (!el) throw new Error(`unexpected new rig control ${r.rigControlId}`);
      const fx = el.facex, db = r.domainBounds, fd = fx.domainBounds;
      if (r.latticeColumns !== fx.latticeColumns || r.latticeRows !== fx.latticeRows ||
        db.x !== fd.x || db.y !== fd.y || db.width !== fd.width || db.height !== fd.height)
        throw new Error(`${r.rigControlId}: not a FaceX grid twin`);
      if (JSON.stringify(r.restControlPoints) !== JSON.stringify(fx.restControlPoints))
        throw new Error(`${r.rigControlId}: restControlPoints differ from FaceX twin — transplant premise broken`);
      if (JSON.stringify(r.childRigControlIds) !== JSON.stringify([el.facey.rigControlId]) ||
        (r.childDrawableIds ?? []).length !== 0)
        throw new Error(`${r.rigControlId}: children wrong`);
      if (r.parentId !== undefined) throw new Error(`${r.rigControlId}: should be a root`);
      newRc++;
      continue;
    }
    const preObj = JSON.parse(pre);
    const expectedParent = faceyToBodyx.get(r.rigControlId);
    if (expectedParent !== undefined) {
      if (r.parentId !== expectedParent)
        throw new Error(`${r.rigControlId}: parentId ${r.parentId} != ${expectedParent}`);
      const cur = { ...r }; delete cur.parentId;
      const was = { ...preObj }; delete was.parentId;
      if (preObj.parentId !== undefined) throw new Error(`${r.rigControlId}: had a parent pre-cp11?`);
      if (canon(cur) !== canon(was))
        throw new Error(`WRAPPED FACEY CONTROL CHANGED BEYOND parentId: ${r.rigControlId}`);
    } else if (canon(r) !== canon(preObj)) {
      throw new Error(`PRE-EXISTING RIG CONTROL CHANGED: ${r.rigControlId}`);
    }
    preRc.delete(r.rigControlId);
  }
  if (preRc.size) throw new Error(`rig controls disappeared: ${[...preRc.keys()].join(",")}`);
  if (newRc !== 18) throw new Error(`expected 18 new rig controls, got ${newRc}`);
  console.log("rig controls OK: 18 new FaceX-twin BodyX roots; 18 FaceY re-parented (parentId ONLY); all others byte-identical");
  // 3. meshes byte-identical (cp11 runs no mesh ops)
  const preMesh = new Map(snap.meshes.map((m) => [m.id, m.json]));
  for (const m of meshes) {
    const pre = preMesh.get(m.drawableId);
    if (pre === undefined) throw new Error(`mesh list gained ${m.drawableId}`);
    if (JSON.stringify(m) !== pre) throw new Error(`MESH CHANGED: ${m.drawableId}`);
    preMesh.delete(m.drawableId);
  }
  if (preMesh.size) throw new Error(`meshes disappeared`);
  // 4. graph roots: each facey root replaced (in place set-wise) by its bodyx
  const wantRoots = new Set(snap.rootIds.map((id) => faceyToBodyx.get(id) ?? id));
  const gotRoots = new Set(graph.rigControlRootIds);
  if (wantRoots.size !== gotRoots.size || [...wantRoots].some((id) => !gotRoots.has(id)))
    throw new Error(`graph roots mismatch: want ${[...wantRoots].join(",")} got ${[...gotRoots].join(",")}`);
  console.log("meshes OK: all byte-identical; graph roots OK: 18 FaceY roots swapped for BodyX roots");
  console.log(`verify OK: ${oldSets.length} untouched sets + 18 design-matched new sets; structure and meshes clean`);
  process.exit(0);
}

writeFileSync(new URL("design-values.json", HERE), JSON.stringify(design));
writeFileSync(new URL("batch-rig.json", HERE), JSON.stringify(batch, null, 2));
console.log(`\nbatch-rig.json: ${batch.length} ops (18 warps + 18 keys)`);

// ---- probes ----
console.log(`\nALPHA=${ALPHA} (uniform, dx+dy). per-element committed FaceX -> BodyX copy summary:`);
console.log("element              grid   |dx|max F->B (min key)   |dx|max F->B (max key)  dyPts");
for (const el of ELEMENTS) {
  const mn = el.set.keys.find((k) => k.value === -30).statePatch;
  const mx = el.set.keys.find((k) => k.value === 30).statePatch;
  const amax = (p) => Math.max(...p.map((q) => Math.abs(q.x)));
  const dyPts = mn.filter((q) => q.y !== 0).length + mx.filter((q) => q.y !== 0).length;
  console.log(` ${el.sfx.padEnd(18)} ${(el.facex.latticeColumns + "x" + el.facex.latticeRows).padEnd(6)} ${amax(mn).toFixed(1).padStart(8)} -> ${round2(ALPHA * amax(mn)).toFixed(1).padStart(6)} ${amax(mx).toFixed(1).padStart(12)} -> ${round2(ALPHA * amax(mx)).toFixed(1).padStart(6)} ${String(dyPts).padStart(6)}`);
}
