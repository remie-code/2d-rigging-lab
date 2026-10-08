// cp13fix3: the FINAL 3-band gravity model — "hair that GROWS turns with the
// head; hair that HANGS follows on a modest oblique vector". This file is the
// PRIMARY SOURCE of every cp13fix3 number.
//
// ============================== WHY (3-round history) ========================
// Three rounds exposed three independent design freedoms, one per round:
//   original: boundary row ~550 was nearly right, but the 350..500px SOFT
//             transition straddled the pivot sign-flip row y=596 and mixed the
//             opposite-sign field into the blend -> X carry cancelled;
//   fix1:     exposed the SAMPLE ROW as its own quantity (T_root -> visual
//             attachment band) -> X carry restored, but the lying W band kept
//             cancelling it mid-strand ("roots pinned, tips swinging");
//   fix2:     shortened the contact band, but pushed the boundary up to the
//             MESH TOP (the cut edge) — suspending the entire scalp band from
//             a high sample row (d_att dx 41..55px) -> over-swinging: temples
//             and nape hair no longer turned with the head.
// The user-fixed final model: the boundary is the BOTTOM OF THE DRAWN
// HAIR-GROWING REGION (below the sideburn / the nape hairline), the transition
// is SHARP (a few tens of px), and it must never cross the sign-flip row.
// With that boundary, the W boundary and the carry sample row COLLAPSE INTO
// ONE KNOB: the strand hangs exactly from where it stops growing.
//
// ============================== WHAT (fix3 field) ============================
//   net3(u,y) = W3(y)*rot(u,y) + (1-W3(y))*d_scalp(u) + plum(u,y)
//
//   band 1 (scalp, y <= y_scalp):      W3=1 -> FULL rotation. The drawn
//     hair-growing region is part of the scalp; it must never leave the
//     Z-rotation deformer's world (temples/nape visibly turn with the head).
//   band 2 (hanging, y >= y_scalp+T):  W3=0 -> uniform carry of
//     d_scalp(u) = rot(u, y_scalp), X AND Y (a modest oblique vector,
//     dx ~ theta*(596-y_scalp) = 10..16px, dy ~ +-sin(theta)*(u-995.5) ~
//     19..23px at the strand centerlines).
//   band 3 (longest tips):             plum(u,y) preserved BYTE-FOR-BYTE from
//     fix1/fix2 (kappa=0.5, ramp 1150..1750, curtains only, same anchors).
//
// ============================== THE DIAL =====================================
// y_scalp = "the row where the strand mesh leaves the head silhouette / face
// region" (the bottom of the drawn hair-growing band), measured per strand at
// rev 393 (diagnose-fix3.mjs, rest vertices + rest renders):
//   hair_f_r    520  (innermost tuft vertices sit 17..28px INSIDE the face
//                     silhouette down to y=513; first free vertex y=531.
//                     refs: iris bottom 474, ear bottom 497 — "a little below
//                     the eyes", the drawn sideburn tail hugging the cheek)
//   hair_f_l    505  (inside-face contact 16..30px down to y=496; free by
//                     y=522; same anatomical refs)
//   back_hair_r 540  (nape hairline: occluded from the front — anchored on the
//                     drawn neck top y=547 (hairline sits just above it) under
//                     the hard ceiling y_scalp+T < 596; the sideways flare at
//                     y 424..540 stays scalp = part of the head's hair mass,
//                     which is exactly what fix2 wrongly suspended)
//   back_hair_l 540  (same; L/R nape drawn symmetric: back_top yBot 772/767)
// TRANS = 40px sharp smoothstep. Lattice realization note: the strand grids
// have row spacing 78..133px > 40px, so bilinear stretches the transition to
// one row gap; what the sharpness buys is GRID-LEVEL purity — no lattice node
// below y=596 ever mixes the opposite-sign rotation field (asserted).
//
// UNTOUCHED: front-hair FaceZ correction key, all cp12 rotation keys, all
// X/Y/BodyX keys, open/close towers, rig-controls, meshes. Only the min/max
// keys of the 4 outside warps change (updateCurrent); center keys stay zero.
//
// Usage:
//   node gen-fix3-scalp.mjs         -> asserts + snapshot + batch-fix3scalp
//                                      + design-fix3-values.json + probes
//   node gen-fix3-scalp.mjs verify  -> post-op check vs snapshot + design
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

// ======================= THE ONE-KNOB DIALS (edit here) ======================
// y_scalp: bottom of the drawn hair-growing region (see header for the recipe).
// trans:   sharp transition length in px (keep y_scalp+trans < 596).
const DIALS = {
  hair_f_r:    { yScalp: 520, trans: 40 },
  hair_f_l:    { yScalp: 505, trans: 40 },
  back_hair_r: { yScalp: 540, trans: 40 },
  back_hair_l: { yScalp: 540, trans: 40 }
};
// =============================================================================

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

// ---- fix2 dials (the committed state we replace; PRE-assert reference) ----
const W2 = {
  hair_f_r: { yHead: 320, yFree: 380 }, hair_f_l: { yHead: 360, yFree: 420 },
  back_hair_r: { yHead: 424, yFree: 484 }, back_hair_l: { yHead: 426, yFree: 486 }
};
// ---- fix1/fix2 plumb dials + attachment anchors (plumb PRESERVED verbatim) ----
const KAPPA = 0.5;
const PLUMB_Y0 = 1150, PLUMB_Y1 = 1750;
const plumbRamp = (y) => smooth((y - PLUMB_Y0) / (PLUMB_Y1 - PLUMB_Y0));

const ELEMENTS = [
  { key: "hair_f_r", displayName: "FaceZ Hair F R",
    domain: { x: 972, y: 187, width: 360, height: 801 }, cols: 7, rows: 11,
    att: { x: 1107, y: 268 }, plumb: false },
  { key: "hair_f_l", displayName: "FaceZ Hair F L",
    domain: { x: 659, y: 227, width: 346, height: 779 }, cols: 7, rows: 11,
    att: { x: 869, y: 311 }, plumb: false },
  { key: "back_hair_r", displayName: "FaceZ Back Hair R",
    domain: { x: 339, y: 270, width: 734, height: 1600 }, cols: 11, rows: 13,
    att: { x: 858, y: 369 }, plumb: true },
  { key: "back_hair_l", displayName: "FaceZ Back Hair L",
    domain: { x: 931, y: 232, width: 609, height: 1585 }, cols: 11, rows: 13,
    att: { x: 1103, y: 328 }, plumb: true }
];
const sigOf2 = (el) => `rigControl:rig_facez_${el.key}:${PARAM}`;

// ---- weights ----
const weightOf = ({ yHead, yFree }) => (y) =>
  y <= yHead ? 1 : 1 - smooth((y - yHead) / (yFree - yHead));
const w3Of = (el) => {
  const d = DIALS[el.key];
  return weightOf({ yHead: d.yScalp, yFree: d.yScalp + d.trans });
};

// ---- fields ----
// plumb term (curtains only; IDENTICAL to gen-fix-plumb.mjs / gen-fix2-attach.mjs).
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
// fix2 base + committed fix2 (PRE-assert reference).
const fix2Base = (el) => (x, y, th) => {
  const w = weightOf(W2[el.key])(y);
  const s = rotDisp(x, y, th), r = rotDisp(x, el.att.y, th);
  return { x: w * s.x + (1 - w) * r.x, y: w * s.y + (1 - w) * r.y };
};
const fix2Field = (el) => (x, y, th) => {
  const a = fix2Base(el)(x, y, th), b = plumbDelta(el)(x, y, th);
  return { x: a.x + b.x, y: a.y + b.y };
};
// fix3: scalp-band blend, sample row == boundary row (ONE knob).
const fix3Base = (el) => (x, y, th) => {
  const w = w3Of(el)(y);
  const s = rotDisp(x, y, th), r = rotDisp(x, DIALS[el.key].yScalp, th);
  return { x: w * s.x + (1 - w) * r.x, y: w * s.y + (1 - w) * r.y };
};
const fix3Field = (el) => (x, y, th) => {
  const a = fix3Base(el)(x, y, th), b = plumbDelta(el)(x, y, th);
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
  const snap = JSON.parse(readFileSync(new URL("snapshot-fix3-pre.json", HERE), "utf8"));
  const design = JSON.parse(readFileSync(new URL("design-fix3-values.json", HERE), "utf8"));
  const expected = new Map(design.fix3.map((d) => [d.sig, d]));
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
      if (k.value === 0) { // center key must remain the pre-fix3 zeros
        const preK = pre.keys.find((p) => p.value === 0);
        if (JSON.stringify(k.statePatch) !== preK.json)
          throw new Error(`center key changed on ${sig}`);
        continue;
      }
      const want = d.keys.find((w) => w.value === k.value);
      if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
        throw new Error(`fixed set ${sig}@${k.value} does not match cp13fix3 design`);
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
    `cp12 rotation, X/Y/BodyX, open/close); ${fixed} sets re-keyed to cp13fix3 design ` +
    `(min/max only, center zeros intact); rig-controls byte-identical`);
  process.exit(0);
}

// ================================ GEN MODE ===================================

// ---- assert PRE: committed rev-393 state == fix2 final design (human-
//      correction guard; also proves the re-declared fix2 formulas are live)
const dvf2 = JSON.parse(readFileSync(new URL("design-fix2-values.json", HERE), "utf8"));
if (dvf2.KAPPA !== KAPPA || dvf2.PLUMB_Y0 !== PLUMB_Y0 || dvf2.PLUMB_Y1 !== PLUMB_Y1)
  throw new Error("assert PRE: plumb dials drifted from design-fix2-values.json");
for (const el of ELEMENTS) {
  if (JSON.stringify(dvf2.ATT[el.key]) !== JSON.stringify(el.att))
    throw new Error(`assert PRE: attachment anchor drifted for ${el.key}`);
  if (JSON.stringify(dvf2.W_NEW[el.key]) !== JSON.stringify(W2[el.key]))
    throw new Error(`assert PRE: fix2 W dial drifted for ${el.key}`);
  const sig = sigOf2(el);
  const s = kfs.find((x) => sigOf(x) === sig);
  if (!s) throw new Error(`missing committed set ${sig}`);
  for (const [value, th] of [[-30, -THETA_MAX_DEG], [30, THETA_MAX_DEG]]) {
    const committed = s.keys.find((k) => k.value === value).statePatch;
    const want = grid(el, fix2Field, th);
    if (JSON.stringify(committed) !== JSON.stringify(want))
      throw new Error(`assert PRE: committed ${sig}@${value} != fix2 final formula (human correction? STOP)`);
    const dv = dvf2.fix2.find((d) => d.sig === sig);
    if (JSON.stringify(dv.keys.find((k) => k.value === value).statePatch) !== JSON.stringify(committed))
      throw new Error(`assert PRE: design-fix2-values.json drift on ${sig}@${value}`);
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
console.log("assert PRE OK: committed rev-393 state matches fix2 final formulas byte-for-byte " +
  "(fix2 base + plumb on curtains; no human corrections in the way; dials confirmed live)");

// ---- assert A: 3-band identity, net3 - d_scalp - plum == W3*(rot - d_scalp),
//      at every lattice node of every element, both ends ----
for (const el of ELEMENTS) {
  const w = w3Of(el);
  for (const { x, y } of nodes(el)) {
    for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
      const s = rotDisp(x, y, th), dS = rotDisp(x, DIALS[el.key].yScalp, th);
      const net = fix3Field(el)(x, y, th), plum = plumbDelta(el)(x, y, th);
      for (const k of ["x", "y"])
        if (Math.abs((net[k] - dS[k] - plum[k]) - w(y) * (s[k] - dS[k])) > 1e-9)
          throw new Error(`assert A: identity broken ${el.key} @(${x},${y}) th=${th} ${k}`);
    }
  }
}
console.log("assert A OK: net3 - d_scalp - plum == W3 * (rot - d_scalp) at every lattice node, both ends");

// ---- assert B: scalp band (y <= y_scalp) == exact rotation field
//      (hair that GROWS turns with the head; occlusion/seam sync preserved) ----
for (const el of ELEMENTS) {
  for (const { x, y } of nodes(el)) {
    if (y > DIALS[el.key].yScalp) continue;
    for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
      const s = rotDisp(x, y, th), net = fix3Field(el)(x, y, th);
      if (Math.abs(net.x - s.x) > 1e-9 || Math.abs(net.y - s.y) > 1e-9)
        throw new Error(`assert B: scalp band not exact rotation on ${el.key} @(${x},${y})`);
    }
  }
}
console.log("assert B OK: scalp band (y<=y_scalp, W3=1) writes the exact rotation field (the hair-growing region never leaves the Z-rotation world)");

// ---- assert C: hanging band (y >= y_scalp+trans) carries d_scalp uniformly ----
for (const el of ELEMENTS) {
  const d = DIALS[el.key];
  for (const { x, y } of nodes(el)) {
    if (y < d.yScalp + d.trans) continue;
    for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
      const dS = rotDisp(x, d.yScalp, th);
      const net = fix3Field(el)(x, y, th), plum = plumbDelta(el)(x, y, th);
      if (Math.abs(net.x - plum.x - dS.x) > 1e-9 || Math.abs(net.y - plum.y - dS.y) > 1e-9)
        throw new Error(`assert C: hanging band not uniform d_scalp on ${el.key} @(${x},${y})`);
    }
  }
}
console.log("assert C OK: hanging band (y>=y_scalp+trans, W3=0) == d_scalp + plum at every node (mid-band and tips carry the SAME modest oblique vector; difference is the plumb term only)");

// ---- assert D: plumb term preserved byte-for-byte (fix2 -> fix3): committed
//      fix2 grid - fix2 base == plumbDelta, and plum confined to the tip band ----
for (const el of ELEMENTS.filter((e) => e.plumb)) {
  const sig = sigOf2(el);
  const s = kfs.find((x) => sigOf(x) === sig);
  for (const [value, th] of [[-30, -THETA_MAX_DEG], [30, THETA_MAX_DEG]]) {
    const committed = s.keys.find((k) => k.value === value).statePatch;
    const ns = nodes(el);
    for (let i = 0; i < ns.length; i++) {
      const { x, y } = ns[i];
      const base = fix2Base(el)(x, y, th), p = plumbDelta(el)(x, y, th);
      if (Math.abs(committed[i].x - round2(base.x + p.x)) > 1e-9 ||
          Math.abs(committed[i].y - round2(base.y + p.y)) > 1e-9)
        throw new Error(`assert D: committed fix2 - base != plumb on ${el.key} @(${x},${y})`);
    }
  }
  for (const { x, y } of nodes(el)) {
    if (y > PLUMB_Y0) continue;
    const p = plumbDelta(el)(x, y, THETA_MAX_DEG);
    if (p.x !== 0 || p.y !== 0) throw new Error(`assert D: plumb leaks above y=${PLUMB_Y0}`);
  }
}
for (const el of ELEMENTS.filter((e) => !e.plumb)) {
  for (const { x, y } of nodes(el)) {
    const p = plumbDelta(el)(x, y, THETA_MAX_DEG);
    if (p.x !== 0 || p.y !== 0) throw new Error(`assert D: plumb leaks onto ${el.key}`);
  }
}
console.log(`assert D OK: plumb term (kappa=${KAPPA}, ramp ${PLUMB_Y0}..${PLUMB_Y1}, curtains only, fix1 anchors) is byte-preserved from the committed fix2 grids and re-mounted on the fix3 base`);

// ---- assert E: the transition never touches the pivot sign-flip row, at the
//      design level AND at the lattice level ----
for (const el of ELEMENTS) {
  const d = DIALS[el.key];
  if (d.yScalp + d.trans >= PIVOT.y)
    throw new Error(`assert E: transition of ${el.key} ends at ${d.yScalp + d.trans} >= pivot row ${PIVOT.y}`);
  const w = w3Of(el);
  for (const { y } of nodes(el)) {
    if (w(y) > 0 && w(y) < 1 && y >= PIVOT.y)
      throw new Error(`assert E: lattice node with intermediate W below the pivot row on ${el.key} (y=${y})`);
    if (y >= PIVOT.y && w(y) !== 0)
      throw new Error(`assert E: lattice node at/below the pivot row still mixes rotation on ${el.key} (y=${y})`);
  }
}
console.log(`assert E OK: every transition ends above the pivot row y=${PIVOT.y}` +
  ` (margins: ${ELEMENTS.map((el) => `${el.key} ${PIVOT.y - DIALS[el.key].yScalp - DIALS[el.key].trans}px`).join(", ")});` +
  ` no lattice node at/below y=596 mixes the opposite-sign rotation field`);

// ---- snapshot (pre-fix3 committed state, first run only) ----
if (!existsSync(new URL("snapshot-fix3-pre.json", HERE))) {
  writeFileSync(new URL("snapshot-fix3-pre.json", HERE), JSON.stringify({
    sets: kfs.map((s) => ({
      sig: sigOf(s),
      keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
    })),
    rigControls: rcs.map((r) => ({ id: r.rigControlId, json: canon(r) }))
  }));
  console.log("snapshot-fix3-pre.json written (pre-fix3 committed state, rev 393)");
}

// ---- design values + batch (updateCurrent, min & max keys only) ----
const design = {
  DIALS, ATT: Object.fromEntries(ELEMENTS.map((el) => [el.key, el.att])),
  KAPPA, PLUMB_Y0, PLUMB_Y1, fix3: []
};
const batch = [];
for (const el of ELEMENTS) {
  const d = DIALS[el.key];
  design.fix3.push({ sig: sigOf2(el), keys: [
    { value: -30, statePatch: grid(el, fix3Field, -THETA_MAX_DEG) },
    { value: 30, statePatch: grid(el, fix3Field, THETA_MAX_DEG) }] });
  for (const [label, keyValue, th] of [["min", -30, -THETA_MAX_DEG], ["max", 30, THETA_MAX_DEG]]) {
    batch.push({
      file: `fix3-${el.key}-${label}.json`,
      operationId: `op_cp13fix3_${el.key}_${label}`,
      operationType: "editKeyformKey",
      payload: {
        target: { kind: "rigControl", id: `rig_facez_${el.key}` },
        targetProperty: "controlPointOffsets",
        parameterId: PARAM,
        interpolation: "linear-1d-v1",
        action: "updateCurrent",
        keyValue,
        statePatch: { propertyPath: "controlPointOffsets", value: grid(el, fix3Field, th) }
      },
      gitMessage: `[cp13fix3] ${el.displayName} face_angle_z ${label}: ` +
        `3-band scalp model (scalp y<=${d.yScalp} full rotation; hanging carries ` +
        `d_scalp=rot(u,${d.yScalp}) uniformly; sharp ${d.trans}px transition` +
        `${el.plumb ? "; plumb preserved" : ""})`
    });
  }
}
writeFileSync(new URL("design-fix3-values.json", HERE), JSON.stringify(design));
writeFileSync(new URL("batch-fix3scalp.json", HERE), JSON.stringify(batch, null, 2));
console.log(`batch-fix3scalp.json: ${batch.length} ops (4 elements x min/max)`);

// ---- probes ----
const fp = (v) => `(${round2(v.x)},${round2(v.y)})`;
console.log("\n=== probes: the modest oblique carry vector d_scalp (theta=+10 / z=+30) vs fix2's d_att ===");
for (const el of ELEMENTS) {
  const d = DIALS[el.key];
  const dS = rotDisp(el.att.x, d.yScalp, THETA_MAX_DEG);
  const dA = rotDisp(el.att.x, el.att.y, THETA_MAX_DEG);
  console.log(` ${el.key.padEnd(12)} d_scalp(y=${d.yScalp})=${fp(dS)}  vs fix2 d_att(y=${el.att.y})=${fp(dA)}`);
}
console.log("\n=== probes: fix2 -> fix3 along each strand centerline (theta=+10 / z=+30) ===");
for (const el of ELEMENTS) {
  const d = DIALS[el.key];
  const ys = [el.domain.y, 400, d.yScalp, d.yScalp + d.trans, 700, 850, 1000, 1300, 1600, el.domain.y + el.domain.height]
    .filter((y) => y >= el.domain.y && y <= el.domain.y + el.domain.height)
    .filter((y, i, a) => a.indexOf(y) === i).sort((a, b) => a - b);
  console.log(` ${el.key} (W3 ${d.yScalp}..${d.yScalp + d.trans}):`);
  console.log("   " + ys.map((y) => {
    const o = fix2Field(el)(el.att.x, y, THETA_MAX_DEG);
    const n = fix3Field(el)(el.att.x, y, THETA_MAX_DEG);
    return `y${Math.round(y)}: ${fp(o)}->${fp(n)}`;
  }).join(" "));
}
