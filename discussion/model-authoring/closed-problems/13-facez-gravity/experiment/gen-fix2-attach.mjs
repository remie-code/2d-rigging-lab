// cp13fix2: "the contact band must be the TRUE contact band". This file is the
// PRIMARY SOURCE of every cp13fix2 number.
//
// ============================== WHY (gate diagnosis) =========================
// fix1 restored the X carry (T_root sample row -> visual attachment band) but
// kept cp08's W band (tuft 550..900 / curtain 500..1000). That W band claims
// the strands stay glued to the skull down to the jaw — a lie: the drawn
// strands hang freely from their attachment bands (temple / nape hairline).
// The rotation field's dx = theta*(596-y) FLIPS SIGN at the pivot row y=596,
// so inside the lying transition band (y>596 -> dx negative) the blend
// CANCELS the carried X: measured "mid-band X ~ 0 while tips carry +55px" —
// the inverted picture (roots pinned, tips swinging against gravity).
// For the Y sphere field the same lie was invisible because that field is
// y-uniform; a y-dependent field turns a lying contact band into lying motion.
//
// ============================== WHAT (fix2 field) ============================
//   net2(u,y) = W_new(y)*rot(u,y) + (1-W_new(y))*d_att(u) + plum(u,y)
//
//   d_att(u)   = rot(u, y_att)  (both X and Y; the fix1 attachment-row sample,
//                UNCHANGED: tuftR (1107,268) / tuftL (869,311) /
//                curtR (858,369) / curtL (1103,328))
//   plum(u,y)  = fix1 plumb term PRESERVED verbatim (kappa=0.5, curtains only,
//                same ramp/direction), recomputed on top of the new base
//   W_new      = drastically shortened contact band, measured per strand
//                (diagnose-fix2.mjs, rest vertices at rev 385):
//     hair_f_r    yHead 320, yFree 380  (mesh top 242 +78: covers the drawn
//                 cut-edge band 242..302 +18px; stem width jumps 94->110 at
//                 y~322; headwear covers x1072..1158 down to y~340-382 so the
//                 whole synced band stays hidden)
//     hair_f_l    yHead 360, yFree 420  (mesh top 282 +78: cut edge 282..342
//                 +18px; stem widens past y~362; hat bottom 320..364 there)
//     back_hair_r yHead 424, yFree 484  (mesh top 344 +80: y=424 is exactly
//                 where the mesh leaves back_top R's x-cover 793..969 — bin
//                 width jumps 81->187, x reaches 693 — i.e. becomes visible)
//     back_hair_l yHead 426, yFree 486  (mesh top 306 +120, occlusion-driven:
//                 curtain L stays inside back_top L's x-cover 1032..1208 with
//                 only a 7px right-edge margin down to y~426; the hidden band
//                 must move as exact rotation)
//   All transitions are 60px smoothsteps ending far above the pivot row 596:
//   the blend never straddles the sign flip, so the strand moves as ONE BLOCK
//   with its attachment point and hangs from there.
//
// UNTOUCHED: front-hair FaceZ correction key, all cp12 rotation keys, all
// X/Y/BodyX keys, open/close towers, rig-controls, meshes. Only the min/max
// keys of the 4 outside warps change (updateCurrent); center keys stay zero.
//
// Usage:
//   node gen-fix2-attach.mjs         -> asserts + snapshot + batch-fix2attach
//                                       + design-fix2-values.json + probes
//   node gen-fix2-attach.mjs verify  -> post-op check vs snapshot + design
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

// ---- cp12/cp13 canon (unchanged) ----
const PIVOT = { x: 995.5, y: 596 };
const THETA_MAX_DEG = 10;
const PARAM = "param_face_angle_z";
const rotDisp = (x, y, thetaDeg) => {
  const t = (thetaDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const u = x - PIVOT.x, v = y - PIVOT.y;
  return { x: c * u - s * v - u, y: s * u + c * v - v };
};
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const weight = ({ yHead, yFree }) => (y) =>
  y <= yHead ? 1 : 1 - smooth((y - yHead) / (yFree - yHead));

// ---- fix1 dials (the committed state we replace; PRE-assert reference) ----
const W_TUFT_OLD = { yHead: 550, yFree: 900 };
const W_CURT_OLD = { yHead: 500, yFree: 1000 };
// ---- fix1 plumb dials (PRESERVED verbatim) ----
const KAPPA = 0.5;
const PLUMB_Y0 = 1150, PLUMB_Y1 = 1750;
const plumbRamp = (y) => smooth((y - PLUMB_Y0) / (PLUMB_Y1 - PLUMB_Y0));

const ELEMENTS = [
  { key: "hair_f_r", displayName: "FaceZ Hair F R",
    domain: { x: 972, y: 187, width: 360, height: 801 }, cols: 7, rows: 11,
    dialOld: W_TUFT_OLD, dialNew: { yHead: 320, yFree: 380 },
    att: { x: 1107, y: 268 }, plumb: false },
  { key: "hair_f_l", displayName: "FaceZ Hair F L",
    domain: { x: 659, y: 227, width: 346, height: 779 }, cols: 7, rows: 11,
    dialOld: W_TUFT_OLD, dialNew: { yHead: 360, yFree: 420 },
    att: { x: 869, y: 311 }, plumb: false },
  { key: "back_hair_r", displayName: "FaceZ Back Hair R",
    domain: { x: 339, y: 270, width: 734, height: 1600 }, cols: 11, rows: 13,
    dialOld: W_CURT_OLD, dialNew: { yHead: 424, yFree: 484 },
    att: { x: 858, y: 369 }, plumb: true },
  { key: "back_hair_l", displayName: "FaceZ Back Hair L",
    domain: { x: 931, y: 232, width: 609, height: 1585 }, cols: 11, rows: 13,
    dialOld: W_CURT_OLD, dialNew: { yHead: 426, yFree: 486 },
    att: { x: 1103, y: 328 }, plumb: true }
];
const sigOf2 = (el) => `rigControl:rig_facez_${el.key}:${PARAM}`;

// ---- fields ----
// fix1 base (committed): W_old blend with the attachment-row sample.
const f1Field = (el) => (x, y, th) => {
  const w = weight(el.dialOld)(y);
  const s = rotDisp(x, y, th), r = rotDisp(x, el.att.y, th);
  return { x: w * s.x + (1 - w) * r.x, y: w * s.y + (1 - w) * r.y };
};
// plumb term (curtains only; IDENTICAL to gen-fix-plumb.mjs).
const plumbDelta = (el) => (x, y, th) => {
  if (!el.plumb || th === 0) return { x: 0, y: 0 };
  const p = plumbRamp(y);
  if (p === 0) return { x: 0, y: 0 };
  const d = rotDisp(el.att.x, el.att.y, th);
  const mag = Math.hypot(d.x, d.y);
  const ox = x - el.att.x, oy = y - el.att.y;
  const ol = Math.hypot(ox, oy);
  if (ol < 1) return { x: 0, y: 0 };
  return { x: KAPPA * p * mag * (0 - ox / ol), y: KAPPA * p * mag * (1 - oy / ol) };
};
// fix1 committed = f1 base (+ plumb for curtains).
const committedField = (el) => (x, y, th) => {
  const a = f1Field(el)(x, y, th), b = plumbDelta(el)(x, y, th);
  return { x: a.x + b.x, y: a.y + b.y };
};
// fix2 base: SAME shape, W_new dials.
const newBase = (el) => (x, y, th) => {
  const w = weight(el.dialNew)(y);
  const s = rotDisp(x, y, th), r = rotDisp(x, el.att.y, th);
  return { x: w * s.x + (1 - w) * r.x, y: w * s.y + (1 - w) * r.y };
};
// fix2 net = new base + preserved plumb.
const fix2Field = (el) => (x, y, th) => {
  const a = newBase(el)(x, y, th), b = plumbDelta(el)(x, y, th);
  return { x: a.x + b.x, y: a.y + b.y };
};

const round2 = (n) => Math.round(n * 100) / 100 || 0; // normalize -0 -> 0
const grid = (el, f, th) => {
  const out = [];
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      const v = th === 0 ? { x: 0, y: 0 } : f(el)(x, y, th);
      out.push({ x: round2(v.x), y: round2(v.y) });
    }
  }
  return out;
};
const nodes = (el) => {
  const out = [];
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++)
      out.push({ x: el.domain.x + (el.domain.width * c) / (el.cols - 1), y });
  }
  return out;
};

// ---- committed model files ----
const kfs = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8")).keyformSets;
const rcs = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8")).rigControls;
const sigOf = (s) => `${s.target?.kind}:${s.target?.id}:${s.parameterId}`;
const canon = (v) =>
  JSON.stringify(v, (k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]]))
      : x);

const mode = process.argv[2] ?? "gen";

// =============================== VERIFY MODE =================================
if (mode === "verify") {
  const snap = JSON.parse(readFileSync(new URL("snapshot-fix2-pre.json", HERE), "utf8"));
  const design = JSON.parse(readFileSync(new URL("design-fix2-values.json", HERE), "utf8"));
  const expected = new Map(design.fix2.map((d) => [d.sig, d]));
  if (kfs.length !== snap.sets.length)
    throw new Error(`set count ${kfs.length} != snapshot ${snap.sets.length}`);
  let untouched = 0, fixed = 0;
  for (let i = 0; i < kfs.length; i++) {
    const s = kfs[i], sig = sigOf(s), pre = snap.sets[i];
    if (sig !== pre.sig) throw new Error(`set order drift at ${i}: ${pre.sig} -> ${sig}`);
    if (!expected.has(sig)) {
      const cur = s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }));
      if (JSON.stringify(cur) !== JSON.stringify(pre.keys))
        throw new Error(`UNTOUCHED KEYFORM SET CHANGED: ${sig}`);
      untouched++;
      continue;
    }
    const d = expected.get(sig);
    for (const k of s.keys) {
      if (k.value === 0) { // center key must remain the pre-fix2 zeros
        const preK = pre.keys.find((p) => p.value === 0);
        if (JSON.stringify(k.statePatch) !== preK.json)
          throw new Error(`center key changed on ${sig}`);
        continue;
      }
      const want = d.keys.find((w) => w.value === k.value);
      if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
        throw new Error(`fixed set ${sig}@${k.value} does not match cp13fix2 design`);
    }
    fixed++;
  }
  // named untouched guard: front-hair FaceZ correction key must be byte-identical
  const frontSig = `rigControl:rig_facez_hair_front:${PARAM}`;
  if (expected.has(frontSig)) throw new Error("front hair must not be re-keyed");
  // rig-controls completely untouched
  const preRc = new Map(snap.rigControls.map((r) => [r.id, r.json]));
  for (const r of rcs) {
    const pre = preRc.get(r.rigControlId);
    if (!pre || canon(r) !== pre) throw new Error(`RIG CONTROL CHANGED: ${r.rigControlId}`);
    preRc.delete(r.rigControlId);
  }
  if (preRc.size) throw new Error(`rig controls disappeared: ${[...preRc.keys()].join(",")}`);
  console.log(`verify OK: ${untouched} keyform sets byte-identical (incl. front-hair FaceZ corr, ` +
    `cp12 rotation, X/Y/BodyX, open/close); ${fixed} sets re-keyed to cp13fix2 design ` +
    `(min/max only, center zeros intact); rig-controls byte-identical`);
  process.exit(0);
}

// ================================ GEN MODE ===================================

// ---- assert PRE: committed rev-385 state == fix1 final design (human-
//      correction guard; also proves the re-declared fix1 formulas are live)
const dvf = JSON.parse(readFileSync(new URL("design-fix-values.json", HERE), "utf8"));
if (dvf.KAPPA !== KAPPA || dvf.PLUMB_Y0 !== PLUMB_Y0 || dvf.PLUMB_Y1 !== PLUMB_Y1)
  throw new Error("assert PRE: plumb dials drifted from design-fix-values.json");
for (const el of ELEMENTS) {
  if (JSON.stringify(dvf.ATT[el.key]) !== JSON.stringify(el.att))
    throw new Error(`assert PRE: attachment anchor drifted for ${el.key}`);
  const sig = sigOf2(el);
  const s = kfs.find((x) => sigOf(x) === sig);
  if (!s) throw new Error(`missing committed set ${sig}`);
  for (const [value, th] of [[-30, -THETA_MAX_DEG], [30, THETA_MAX_DEG]]) {
    const committed = s.keys.find((k) => k.value === value).statePatch;
    const want = grid(el, committedField, th);
    if (JSON.stringify(committed) !== JSON.stringify(want))
      throw new Error(`assert PRE: committed ${sig}@${value} != fix1 final formula (human correction? STOP)`);
    const dv = (el.plumb ? dvf.f2 : dvf.f1).find((d) => d.sig === sig);
    if (JSON.stringify(dv.keys.find((k) => k.value === value).statePatch) !== JSON.stringify(committed))
      throw new Error(`assert PRE: design-fix-values.json drift on ${sig}@${value}`);
  }
  const center = s.keys.find((k) => k.value === 0).statePatch;
  if (!center.every((v) => v.x === 0 && v.y === 0))
    throw new Error(`assert PRE: center key of ${sig} is not zero`);
}
// front hair: committed == cp13 corr design (we will NOT touch it; recorded)
{
  const dv13 = JSON.parse(readFileSync(new URL("design-values.json", HERE), "utf8"));
  const sig = `rigControl:rig_facez_hair_front:${PARAM}`;
  const s = kfs.find((x) => sigOf(x) === sig);
  const d13 = dv13.design.find((d) => d.sig === sig);
  for (const k of s.keys)
    if (JSON.stringify(k.statePatch) !== JSON.stringify(d13.keys.find((w) => w.value === k.value).statePatch))
      throw new Error("assert PRE: committed front-hair FaceZ corr drifted from cp13 design");
}
console.log("assert PRE OK: committed rev-385 state matches fix1 final formulas byte-for-byte " +
  "(f1 base + plumb on curtains; no human corrections in the way; dials confirmed live)");

// ---- assert A: the required identity, net2 - d_att - plum == W_new*(rot - d_att),
//      at every lattice node of every element, both ends ----
for (const el of ELEMENTS) {
  const w = weight(el.dialNew);
  for (const { x, y } of nodes(el)) {
    for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
      const s = rotDisp(x, y, th), dAtt = rotDisp(x, el.att.y, th);
      const net = fix2Field(el)(x, y, th), plum = plumbDelta(el)(x, y, th);
      for (const k of ["x", "y"])
        if (Math.abs((net[k] - dAtt[k] - plum[k]) - w(y) * (s[k] - dAtt[k])) > 1e-9)
          throw new Error(`assert A: identity broken ${el.key} @(${x},${y}) th=${th} ${k}`);
    }
  }
}
console.log("assert A OK: net2 - d_att - plum == W_new * (rot - d_att) at every lattice node, both ends");

// ---- assert B: contact band (y <= yHead_new) == exact rotation field
//      (occlusion + seam sync with rotation members preserved) ----
for (const el of ELEMENTS) {
  for (const { x, y } of nodes(el)) {
    if (y > el.dialNew.yHead) continue;
    for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
      const s = rotDisp(x, y, th), net = fix2Field(el)(x, y, th);
      if (Math.abs(net.x - s.x) > 1e-9 || Math.abs(net.y - s.y) > 1e-9)
        throw new Error(`assert B: contact band not exact rotation on ${el.key} @(${x},${y})`);
    }
  }
}
console.log("assert B OK: contact band (y<=yHead_new, W_new=1) writes the exact rotation field (drawn cut edges stay pinned to the head)");

// ---- assert C: hanging zone (y >= yFree_new) carries d_att uniformly
//      (net2 - plum == d_att: the whole free strand is one translated block) ----
for (const el of ELEMENTS) {
  for (const { x, y } of nodes(el)) {
    if (y < el.dialNew.yFree) continue;
    for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
      const dAtt = rotDisp(x, el.att.y, th);
      const net = fix2Field(el)(x, y, th), plum = plumbDelta(el)(x, y, th);
      if (Math.abs(net.x - plum.x - dAtt.x) > 1e-9 || Math.abs(net.y - plum.y - dAtt.y) > 1e-9)
        throw new Error(`assert C: hanging zone not uniform d_att on ${el.key} @(${x},${y})`);
    }
  }
}
console.log("assert C OK: hanging zone (y>=yFree_new, W_new=0) == d_att + plum at every node (mid-band and tips carry the SAME displacement; difference is the plumb term only)");

// ---- assert D: plumb term preserved verbatim (fix1 vs fix2 recomputation,
//      and against the committed fix1 grids: committed - f1base == plumb) ----
for (const el of ELEMENTS.filter((e) => e.plumb)) {
  for (const { x, y } of nodes(el)) {
    for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
      const p = plumbDelta(el)(x, y, th);
      const a = f1Field(el)(x, y, th), c = committedField(el)(x, y, th);
      if (Math.abs((c.x - a.x) - p.x) > 1e-9 || Math.abs((c.y - a.y) - p.y) > 1e-9)
        throw new Error(`assert D: plumb term drifted from fix1 on ${el.key} @(${x},${y})`);
    }
  }
  // and the plumb-free rows: below PLUMB_Y0 the fix2 delta vs new base is zero
  for (const { x, y } of nodes(el)) {
    if (y > PLUMB_Y0) continue;
    const p = plumbDelta(el)(x, y, THETA_MAX_DEG);
    if (p.x !== 0 || p.y !== 0) throw new Error(`assert D: plumb leaks above y=${PLUMB_Y0}`);
  }
}
console.log(`assert D OK: plumb term (kappa=${KAPPA}, ramp ${PLUMB_Y0}..${PLUMB_Y1}, curtains only) is byte-preserved from fix1 and re-mounted on the new base`);

// ---- assert E: the transition never straddles the pivot row ----
for (const el of ELEMENTS)
  if (el.dialNew.yFree >= PIVOT.y - 100)
    throw new Error(`assert E: transition of ${el.key} too close to the pivot row`);
console.log("assert E OK: every W_new transition ends >=100px above the pivot row y=596 (no sign-flip cancellation possible)");

// ---- snapshot (pre-fix2 committed state, first run only) ----
if (!existsSync(new URL("snapshot-fix2-pre.json", HERE))) {
  writeFileSync(new URL("snapshot-fix2-pre.json", HERE), JSON.stringify({
    sets: kfs.map((s) => ({
      sig: sigOf(s),
      keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
    })),
    rigControls: rcs.map((r) => ({ id: r.rigControlId, json: canon(r) }))
  }));
  console.log("snapshot-fix2-pre.json written (pre-fix2 committed state, rev 385)");
}

// ---- design values + batch (updateCurrent, min & max keys only) ----
const design = {
  ATT: Object.fromEntries(ELEMENTS.map((el) => [el.key, el.att])),
  W_NEW: Object.fromEntries(ELEMENTS.map((el) => [el.key, el.dialNew])),
  KAPPA, PLUMB_Y0, PLUMB_Y1, fix2: []
};
const batch = [];
for (const el of ELEMENTS) {
  design.fix2.push({ sig: sigOf2(el), keys: [
    { value: -30, statePatch: grid(el, fix2Field, -THETA_MAX_DEG) },
    { value: 30, statePatch: grid(el, fix2Field, THETA_MAX_DEG) }] });
  for (const [label, keyValue, th] of [["min", -30, -THETA_MAX_DEG], ["max", 30, THETA_MAX_DEG]]) {
    batch.push({
      file: `fix2-${el.key}-${label}.json`,
      operationId: `op_cp13fix2_${el.key}_${label}`,
      operationType: "editKeyformKey",
      payload: {
        target: { kind: "rigControl", id: `rig_facez_${el.key}` },
        targetProperty: "controlPointOffsets",
        parameterId: PARAM,
        interpolation: "linear-1d-v1",
        action: "updateCurrent",
        keyValue,
        statePatch: { propertyPath: "controlPointOffsets", value: grid(el, fix2Field, th) }
      },
      gitMessage: `[cp13fix2] ${el.displayName} face_angle_z ${label}: ` +
        `contact band -> true attachment band (W ${el.dialNew.yHead}..${el.dialNew.yFree}); ` +
        `free strand carries d_att as one block${el.plumb ? "; plumb preserved" : ""}`
    });
  }
}
writeFileSync(new URL("design-fix2-values.json", HERE), JSON.stringify(design));
writeFileSync(new URL("batch-fix2attach.json", HERE), JSON.stringify(batch, null, 2));
console.log(`batch-fix2attach.json: ${batch.length} ops (4 elements x min/max)`);

// ---- probes ----
const fp = (v) => `(${round2(v.x)},${round2(v.y)})`;
console.log("\n=== probes: fix1 -> fix2 along each strand centerline (theta=+10 / z=+30) ===");
for (const el of ELEMENTS) {
  const dAtt = rotDisp(el.att.x, el.att.y, THETA_MAX_DEG);
  console.log(` ${el.key.padEnd(12)} d_att=${fp(dAtt)}  W_old ${el.dialOld.yHead}..${el.dialOld.yFree} -> W_new ${el.dialNew.yHead}..${el.dialNew.yFree}`);
  const ys = [el.att.y, el.dialNew.yHead, el.dialNew.yFree, 550, 700, 850, 1000, 1300, 1600]
    .filter((y) => y <= el.domain.y + el.domain.height)
    .filter((y, i, a) => a.indexOf(y) === i).sort((a, b) => a - b);
  console.log("   " + ys.map((y) => {
    const o = committedField(el)(el.att.x, y, THETA_MAX_DEG);
    const n = fix2Field(el)(el.att.x, y, THETA_MAX_DEG);
    return `y${Math.round(y)}: ${fp(o)}->${fp(n)}`;
  }).join(" "));
}
console.log("\n=== seam rows (curtains x back_top; committed fix1 value -> fix2 value, z=+30) ===");
for (const el of ELEMENTS.filter((e) => e.plumb)) {
  for (const r of [1, 2]) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    const line = [0.35, 0.5, 0.65].map((f) => {
      const x = el.att.x + (f - 0.5) * 200;
      const o = committedField(el)(x, y, THETA_MAX_DEG);
      const n = fix2Field(el)(x, y, THETA_MAX_DEG);
      const rotV = rotDisp(x, y, THETA_MAX_DEG);
      return `x${Math.round(x)}: ${fp(o)}->${fp(n)} (rot ${fp(rotV)})`;
    });
    console.log(` ${el.key} lattice row ${r} (y=${y.toFixed(1)}): ${line.join("  ")}`);
  }
}
