// cp13fix: F1 "sample the visual attachment band" + F2 "plumb term for the
// longest tips". This file is the PRIMARY SOURCE of every cp13fix number.
//
// ============================== WHY (gate diagnosis) =========================
// F1 (main): user gate — the tufts/back hair "bob in place": their carried
// root displacement LACKS its X component. Measured at rev 373
// (diagnose-fix.mjs, evaluated vertices, z=+-30):
//   tuft tips     dx mean 5.5..8.9px  while dy ~19..20px
//   curtain tips  dx mean 10.8..22.5px while |dy| up to ~100px
// Cause (L0 hypothesis, confirmed): cp13 reused cp08's y_root rows verbatim
// (tuft 550 / curtain 500). The ROTATION field is strongly y-dependent:
// dx ~ sin(theta)*(596 - y), so near the pivot row (y=596) the carried dx
// almost vanishes (y=550 -> theta*46 = 8px only). For the Y sphere field the
// row choice never mattered (field ~ y-uniform); for Z it decides whether the
// X carry lives or dies. The T_root sample row must be the strand's VISUAL
// ATTACHMENT BAND — the suspension point the viewer reads the strand as
// hanging from — not the "loses skull contact" row.
//   Attachment bands (texture-measured = topmost 60px rest-vertex band of
//   each strand mesh, diagnose-fix.mjs section 2):
//     hair_f_r    (temple R)      y 268, x-centroid 1107
//     hair_f_l    (temple L)      y 311, x-centroid  869
//     back_hair_r (nape hairline) y 369, x-centroid  858
//     back_hair_l (nape hairline) y 328, x-centroid 1103
//   dx recovery at theta=+10: 6.3->55.3 / 9.9->51.4 / 18.8->41.5 / 15.0->44.9
// W(y) IS UNCHANGED (the death of rotationality is invariant); only the
// translation-copy sample point moves. Field:
//   netF1(u,y) = W(y)*rot(u,y) + (1-W(y))*rot(u, y_att)
//
// F2 (secondary, limited): anime hair beyond waist length lies about gravity
// ("fluffy" root->tip is non-vertical). Pure T_root copy freezes the shape and
// exposes the lie as "tips falling straight down". Correction, applied ONLY to
// the tip band of the longest back hair (curtains, below the waist y~1150):
//   delta(u,y) = KAPPA * P(y) * |d_att| * (u_plumb - u_offset(u,y))
//     d_att    = rot(x_att, y_att, theta)          (attachment displacement)
//     u_plumb  = (0, 1)                            (straight down, y-down)
//     u_offset = normalize((u,y) - (x_att, y_att)) (rest root->tip direction)
//     P(y)     = smoothstep((y - 1150) / (1750 - 1150))   (waist -> tip ramp)
// Gently steers the rest offset toward the plumb line under the root; NOT a
// full plumb (the drawn lie is respected). Even in theta (|d_att|): any tilt
// makes gravity re-assert. KAPPA is the styling dial, starts modest.
// Direction check (asserted): character-right curtain (root up-right of tips
// in screen coords) -> tips drift toward the root's plumb side and slightly
// down when the root moves.
//
// UNTOUCHED: front-hair FaceZ correction key, all cp12 rotation keys, all
// X/Y/BodyX keys, open/close towers, rig-controls (no re-parenting). Only the
// min/max keys of the 4 outside warps change; center keys stay zero.
//
// Usage:
//   node gen-fix-plumb.mjs                -> asserts + snapshot + batch-fix1/2
//                                            + design-fix-values.json + probes
//   node gen-fix-plumb.mjs verify         -> post-F1+F2 check (final state)
//   node gen-fix-plumb.mjs verify stage1  -> post-F1-only check (between batches)
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

// ---- cp08/cp13 W dials (PRESERVED — rotationality mixing unchanged) ----
const W_TUFT = { yHead: 550, yFree: 900, wTip: 0 };
const W_CURT = { yHead: 500, yFree: 1000, wTip: 0 };
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const weight = ({ yHead, yFree, wTip }) => (y) =>
  y <= yHead ? 1 : 1 - (1 - wTip) * smooth((y - yHead) / (yFree - yHead));

// ---- F1: attachment anchors (measured, diagnose-fix.mjs section 2) ----
// ---- F2: plumb dials ----
const KAPPA = 0.5;                       // styling dial, modest start
const PLUMB_Y0 = 1150, PLUMB_Y1 = 1750;  // waist -> longest-tip ramp
const plumbRamp = (y) => smooth((y - PLUMB_Y0) / (PLUMB_Y1 - PLUMB_Y0));

const ELEMENTS = [
  { key: "hair_f_r", displayName: "FaceZ Hair F R",
    domain: { x: 972, y: 187, width: 360, height: 801 }, cols: 7, rows: 11,
    dial: W_TUFT, att: { x: 1107, y: 268 }, plumb: false },
  { key: "hair_f_l", displayName: "FaceZ Hair F L",
    domain: { x: 659, y: 227, width: 346, height: 779 }, cols: 7, rows: 11,
    dial: W_TUFT, att: { x: 869, y: 311 }, plumb: false },
  { key: "back_hair_r", displayName: "FaceZ Back Hair R",
    domain: { x: 339, y: 270, width: 734, height: 1600 }, cols: 11, rows: 13,
    dial: W_CURT, att: { x: 858, y: 369 }, plumb: true },
  { key: "back_hair_l", displayName: "FaceZ Back Hair L",
    domain: { x: 931, y: 232, width: 609, height: 1585 }, cols: 11, rows: 13,
    dial: W_CURT, att: { x: 1103, y: 328 }, plumb: true }
];
const sigOf2 = (el) => `rigControl:rig_facez_${el.key}:${PARAM}`;

// ---- fields ----
// cp13 original (old): root sampled at the W boundary row.
const oldField = (el) => (x, y, th) => {
  const w = weight(el.dial)(y);
  const s = rotDisp(x, y, th), r = rotDisp(x, el.dial.yHead, th);
  return { x: w * s.x + (1 - w) * r.x, y: w * s.y + (1 - w) * r.y };
};
// F1: root sampled at the visual attachment row (W unchanged).
const f1Field = (el) => (x, y, th) => {
  const w = weight(el.dial)(y);
  const s = rotDisp(x, y, th), r = rotDisp(x, el.att.y, th);
  return { x: w * s.x + (1 - w) * r.x, y: w * s.y + (1 - w) * r.y };
};
// F2 plumb delta (curtains only).
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
const f2Field = (el) => (x, y, th) => {
  const a = f1Field(el)(x, y, th), b = plumbDelta(el)(x, y, th);
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
  const stage1 = process.argv[3] === "stage1";
  const snap = JSON.parse(readFileSync(new URL("snapshot-fix-pre.json", HERE), "utf8"));
  const design = JSON.parse(readFileSync(new URL("design-fix-values.json", HERE), "utf8"));
  const expected = new Map();
  for (const d of design.f1) if (stage1 || !design.f2.some((e) => e.sig === d.sig)) expected.set(d.sig, d);
  if (!stage1) for (const d of design.f2) expected.set(d.sig, d);
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
      if (k.value === 0) { // center key must remain the pre-fix zeros
        const preK = pre.keys.find((p) => p.value === 0);
        if (JSON.stringify(k.statePatch) !== preK.json)
          throw new Error(`center key changed on ${sig}`);
        continue;
      }
      const want = d.keys.find((w) => w.value === k.value);
      if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
        throw new Error(`fixed set ${sig}@${k.value} does not match cp13fix ${stage1 ? "stage-1" : "final"} design`);
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
  console.log(`verify OK (${stage1 ? "stage1 = F1 only" : "final = F1+F2"}): ` +
    `${untouched} keyform sets byte-identical (incl. front-hair FaceZ corr, cp12 rotation, X/Y/BodyX, open/close); ` +
    `${fixed} sets re-keyed to design (min/max only, center zeros intact); rig-controls byte-identical`);
  process.exit(0);
}

// ================================ GEN MODE ===================================

// ---- assert PRE: committed start state == cp13 original design (guard for
//      human corrections; also proves the re-declared dials ARE the live ones)
const cp13design = JSON.parse(readFileSync(new URL("design-values.json", HERE), "utf8"));
for (const el of ELEMENTS) {
  const sig = sigOf2(el);
  const s = kfs.find((x) => sigOf(x) === sig);
  if (!s) throw new Error(`missing committed set ${sig}`);
  const d13 = cp13design.design.find((d) => d.sig === sig);
  for (const [value, th] of [[-30, -THETA_MAX_DEG], [30, THETA_MAX_DEG]]) {
    const committed = s.keys.find((k) => k.value === value).statePatch;
    const want = grid(el, oldField, th);
    if (JSON.stringify(committed) !== JSON.stringify(want))
      throw new Error(`assert PRE: committed ${sig}@${value} != cp13 original formula (human correction? STOP)`);
    if (JSON.stringify(d13.keys.find((k) => k.value === value).statePatch) !== JSON.stringify(committed))
      throw new Error(`assert PRE: design-values.json drift on ${sig}@${value}`);
  }
  const center = s.keys.find((k) => k.value === 0).statePatch;
  if (!center.every((v) => v.x === 0 && v.y === 0))
    throw new Error(`assert PRE: center key of ${sig} is not zero`);
}
// front hair: committed == cp13 corr design (we will NOT touch it; recorded)
{
  const sig = `rigControl:rig_facez_hair_front:${PARAM}`;
  const s = kfs.find((x) => sigOf(x) === sig);
  const d13 = cp13design.design.find((d) => d.sig === sig);
  for (const k of s.keys)
    if (JSON.stringify(k.statePatch) !== JSON.stringify(d13.keys.find((w) => w.value === k.value).statePatch))
      throw new Error("assert PRE: committed front-hair FaceZ corr drifted from cp13 design");
}
console.log("assert PRE OK: committed rev-373 state matches cp13 original formulas byte-for-byte (no human corrections in the way; dials confirmed live)");

// ---- assert B: root band (W=1) numerically unchanged by F1 ----
for (const el of ELEMENTS) {
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    if (y > el.dial.yHead) continue;
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
        const o = oldField(el)(x, y, th), n = f1Field(el)(x, y, th);
        if (round2(o.x) !== round2(n.x) || round2(o.y) !== round2(n.y))
          throw new Error(`assert B: root band moved on ${el.key} @ (${x},${y})`);
      }
    }
  }
}
console.log("assert B OK: root band (y<=yHead, W=1) byte-identical before/after F1 (seam with back_top rotation members untouched)");

// ---- assert C: gravity identity for F1 (W = rotationality mixing ratio) ----
for (const el of ELEMENTS) {
  const w = weight(el.dial);
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
        const s = rotDisp(x, y, th), root = rotDisp(x, el.att.y, th);
        const n = f1Field(el)(x, y, th);
        for (const k of ["x", "y"])
          if (Math.abs((n[k] - root[k]) - w(y) * (s[k] - root[k])) > 1e-9)
            throw new Error(`assert C: identity broken ${el.key} @(${x},${y}) th=${th} ${k}`);
      }
    }
  }
}
console.log("assert C OK: netF1 - rot(att) == W * (rot - rot(att)) at every lattice node, both ends");

// ---- assert D: plumb term confinement + direction ----
for (const el of ELEMENTS) {
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      for (const th of [-THETA_MAX_DEG, THETA_MAX_DEG]) {
        const d = plumbDelta(el)(x, y, th);
        if ((!el.plumb || y <= PLUMB_Y0) && (round2(d.x) !== 0 || round2(d.y) !== 0))
          throw new Error(`assert D: plumb leaks outside the tip band: ${el.key} @(${x},${y})`);
        if (el.plumb && y > PLUMB_Y0 && Math.abs(x - el.att.x) > 50) {
          if (Math.sign(d.x) !== Math.sign(el.att.x - x))
            throw new Error(`assert D: plumb x-direction wrong: ${el.key} @(${x},${y})`);
          if (d.y < 0) throw new Error(`assert D: plumb y-direction upward: ${el.key} @(${x},${y})`);
        }
      }
    }
  }
}
console.log(`assert D OK: plumb delta confined to curtain tip band (y>${PLUMB_Y0}); direction = toward the root's plumb line (sign(dx)=sign(x_att-x)) and slightly down, both ends`);

// ---- snapshot (pre-fix committed state, first run only) ----
if (!existsSync(new URL("snapshot-fix-pre.json", HERE))) {
  writeFileSync(new URL("snapshot-fix-pre.json", HERE), JSON.stringify({
    sets: kfs.map((s) => ({
      sig: sigOf(s),
      keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
    })),
    rigControls: rcs.map((r) => ({ id: r.rigControlId, json: canon(r) }))
  }));
  console.log("snapshot-fix-pre.json written (pre-fix committed state, rev 373)");
}

// ---- design values + batches (updateCurrent, min & max keys only) ----
const design = { ATT: Object.fromEntries(ELEMENTS.map((el) => [el.key, el.att])),
  KAPPA, PLUMB_Y0, PLUMB_Y1, f1: [], f2: [] };
const batch1 = [], batch2 = [];
const pushOps = (batch, el, f, tag, why) => {
  for (const [label, keyValue, th] of [["min", -30, -THETA_MAX_DEG], ["max", 30, THETA_MAX_DEG]]) {
    batch.push({
      file: `fix-${tag}-${el.key}-${label}.json`,
      operationId: `op_cp13fix_${tag}_${el.key}_${label}`,
      operationType: "editKeyformKey",
      payload: {
        target: { kind: "rigControl", id: `rig_facez_${el.key}` },
        targetProperty: "controlPointOffsets",
        parameterId: PARAM,
        interpolation: "linear-1d-v1",
        action: "updateCurrent",
        keyValue,
        statePatch: { propertyPath: "controlPointOffsets", value: grid(el, f, th) }
      },
      gitMessage: `[cp13fix] ${el.displayName} face_angle_z ${label}: ${why}`
    });
  }
};
for (const el of ELEMENTS) {
  design.f1.push({ sig: sigOf2(el), keys: [
    { value: -30, statePatch: grid(el, f1Field, -THETA_MAX_DEG) },
    { value: 30, statePatch: grid(el, f1Field, THETA_MAX_DEG) }] });
  pushOps(batch1, el, f1Field, "f1",
    `T_root sample row -> visual attachment band y=${el.att.y} (X carry restored)`);
}
for (const el of ELEMENTS.filter((e) => e.plumb)) {
  design.f2.push({ sig: sigOf2(el), keys: [
    { value: -30, statePatch: grid(el, f2Field, -THETA_MAX_DEG) },
    { value: 30, statePatch: grid(el, f2Field, THETA_MAX_DEG) }] });
  pushOps(batch2, el, f2Field, "f2",
    `plumb term kappa=${KAPPA} on tip band y>${PLUMB_Y0} (drawn-lie translation)`);
}
writeFileSync(new URL("design-fix-values.json", HERE), JSON.stringify(design));
writeFileSync(new URL("batch-fix1.json", HERE), JSON.stringify(batch1, null, 2));
writeFileSync(new URL("batch-fix2.json", HERE), JSON.stringify(batch2, null, 2));
console.log(`batch-fix1.json: ${batch1.length} ops (F1, 4 elements x min/max) | batch-fix2.json: ${batch2.length} ops (F2, curtains x min/max)`);

// ---- probes ----
const f2p = (v) => `(${round2(v.x)},${round2(v.y)})`;
console.log("\n=== F1 probes: old -> new (theta=+10 / param z=+30) ===");
for (const el of ELEMENTS) {
  const yTip = el.domain.y + el.domain.height;
  const x = el.att.x - (el.key.includes("back") ? 250 : 0); // curtains: probe an outer tip column
  const o = oldField(el)(x, yTip, THETA_MAX_DEG), n = f1Field(el)(x, yTip, THETA_MAX_DEG);
  const a = rotDisp(x, el.att.y, THETA_MAX_DEG);
  console.log(` ${el.key.padEnd(12)} tip(x${x},y${yTip}): old ${f2p(o)} -> f1 ${f2p(n)} | rot@att-row ${f2p(a)} (att (${el.att.x},${el.att.y}))`);
}
console.log("\n=== tuftR dx profile along the strand (x=1107, theta=+10): S-shape through the W band ===");
console.log(" " + [268, 400, 550, 600, 700, 800, 900, 988].map((y) => {
  const n = f1Field(ELEMENTS[0])(1107, y, THETA_MAX_DEG);
  return `y${y}:${round2(n.x)}`;
}).join("  "));
console.log("\n=== F2 probes: plumb delta at curtain tip nodes (both ends) ===");
for (const el of ELEMENTS.filter((e) => e.plumb)) {
  for (const [x, y] of [[el.att.x - 420, el.domain.y + el.domain.height],
                        [el.att.x - 150, el.domain.y + el.domain.height],
                        [el.att.x + 120, el.domain.y + el.domain.height],
                        [el.att.x - 420, 1400]]) {
    const dmin = plumbDelta(el)(x, y, -THETA_MAX_DEG), dmax = plumbDelta(el)(x, y, THETA_MAX_DEG);
    console.log(` ${el.key.padEnd(12)} @(${x},${y}): delta(min) ${f2p(dmin)}  delta(max) ${f2p(dmax)}`);
  }
}
