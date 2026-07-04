// cp08fix: gravity-decay convergence correction ("carry the root translation").
//
// This file is the PRIMARY SOURCE of every cp08fix number.
//
// ============================== WHY (gate diagnosis) =========================
// The cp08 initial version blended the spherical field toward SPATIAL ZERO:
//   field_old(u,y) = W(y) * sphere(u,y)          -> tips nailed to world space
// User gate: "tips look caught on an invisible stake". Corrected physics
// (problem-definition 2026-07-04 gate correction): gravity kills the
// ROTATIONALITY of the strand (the Theta-dependent swing), NOT its motion.
// A strand is attached to its root, so the root's TRANSLATION is carried all
// the way to the tip. The tip limit is a pure-translation copy of its own
// root's displacement:
//   field_new(u,y) = W(y)*sphere(u,y) + (1-W(y))*sphere(u, y_root(u))
// This is the Y twin of the X cylinder-extension law (recipe 06: "hanging
// tufts carry the root translation; decaying with the sphere tears them").
// "Carry the root translation" is an axis-crossing invariant; W(y) is only
// the mixing ratio of the rotational component.
//
// ============================ WHAT IS PRESERVED ==============================
// Everything of the 13th generation except the blend target:
//   - W(y) boundaries (the row where the strand loses skull contact) and
//     transition distances (proportional to free-hanging length):
//       front  y<=500 -> 1, 500..773 -> 0.7   (never loses contact; light tail)
//       tufts  y<=550 -> 1, 550..900 -> 0     (leaves head at jaw y~577)
//       curt   y<=500 -> 1, 500..1000 -> 0    (leaves skull at nape y~500)
//   - shells (same z as committed X), gains (G_DN 0.1875 / G_UP 0.15), CY=459,
//     grids, domains, back_top_hair ramp R(y).
//   Root band (W=1, y<=yHead) is numerically UNCHANGED (asserted).
//
// y_root(u): the 13th generation modeled "loses skull contact" as one row per
// element (jaw line / nape), not per column — the tuft/curtain roots span a
// horizontal band at that height and the shell varies smoothly in u. We REUSE
// that boundary: y_root = yHead of each element's W dial. Each column still
// copies ITS OWN root value sphere(u, yHead) — the carried translation varies
// per column through the shell, only the boundary row is shared.
//   front hair: never loses contact; its decay band starts at y=500, so the
//   0.3 rotational bleed of the tail converges to sphere(u,500) (same form,
//   unified equation type).
//
// back_top_hair: dy_bt = R(y)*dy_curtain. Its lattice spans y217..822, which
// CROSSES the curtain transition band (500..1000) — whether its rows move is
// machine-checked below (assert C); if they do, bt is re-keyed in sync with
// the corrected curtain formula (formula-level sync at y769 must survive).
//
// UNTOUCHED: eyewear (rigid field has no W), all X keys, hat, cp07 facial
// core, eye open/close + eyeball towers. Asserted in verify mode.
//
// Usage:
//   node gen-fix-carry.mjs          -> asserts + snapshot + batch-fix.json + probes
//   node gen-fix-carry.mjs verify   -> post-commit untouched/changed-as-designed check
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

// ---- canon frame (cp07, unchanged) ----
const CX = 1001, CY = 459;
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const G_DN = 0.1875, G_UP = 0.15;
const EQ = 463, APEX_R = 320;
const U_HAIR = 320, U_SPREAD = 650, Z_FRONT = 320, Z_BACK = 320;

const capS = (y) => (y >= EQ ? 1 : Math.sqrt(Math.max(0, 1 - ((EQ - y) / APEX_R) ** 2)));
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// ---- shells (committed X implementation, unchanged) ----
const shellFront = (x, y) => {
  const u = x - CX;
  return Z_FRONT * Math.max(0, 1 - (u / U_HAIR) ** 2) * capS(y);
};
const shellBack = (x, y) => {
  const u = x - CX;
  return -Z_BACK * Math.max(0, 1 - (u / U_SPREAD) ** 2) * capS(y);
};

// ---- gravity decay dials (13th generation values, PRESERVED) ----
const W_FRONT = { yHead: 500, yFree: 773, wTip: 0.7 };
const W_TUFT  = { yHead: 550, yFree: 900, wTip: 0 };
const W_CURT  = { yHead: 500, yFree: 1000, wTip: 0 };
const weight = ({ yHead, yFree, wTip }) => (y) =>
  y <= yHead ? 1 : 1 - (1 - wTip) * smooth((y - yHead) / (yFree - yHead));

// ---- full gained spherical field (no W) ----
const sphere = (shell) => (x, y) => {
  const v = y - CY, chord = v * (COS - 1), z = shell(x, y);
  return { min: G_DN * (chord + SIN * z), max: G_UP * (chord - SIN * z) };
};
const sphF = sphere(shellFront), sphB = sphere(shellBack);

// ---- OLD fields (cp08 initial: blend target = spatial zero) ----
const oldField = (sph, wOf) => (x, y) => {
  const w = wOf(y), s = sph(x, y);
  return { min: w * s.min, max: w * s.max };
};
// ---- NEW fields (cp08fix: blend target = own root translation) ----
const newField = (sph, wOf, yRoot) => (x, y) => {
  const w = wOf(y), s = sph(x, y), r = sph(x, yRoot);
  return { min: w * s.min + (1 - w) * r.min, max: w * s.max + (1 - w) * r.max };
};

const oldFront = oldField(sphF, weight(W_FRONT));
const oldTuft  = oldField(sphF, weight(W_TUFT));
const oldCurt  = oldField(sphB, weight(W_CURT));
const newFront = newField(sphF, weight(W_FRONT), W_FRONT.yHead);
const newTuft  = newField(sphF, weight(W_TUFT), W_TUFT.yHead);
const newCurt  = newField(sphB, weight(W_CURT), W_CURT.yHead);

const R_BT = (y) => Math.min(1, Math.max(0, (y - 264) / (769 - 264)));
const bt = (curt) => (x, y) => {
  const c = curt(x, y), r = R_BT(y);
  return { min: r * c.min, max: r * c.max };
};
const oldBT = bt(oldCurt), newBT = bt(newCurt);

// ---- element table (identical domains/grids to cp08) ----
const ELEMENTS = [
  { key: "hair_front", displayName: "FaceY Hair Front",
    domain: { x: 619, y: 95, width: 764, height: 718 }, cols: 11, rows: 11,
    fOld: oldFront, fNew: newFront, yHead: W_FRONT.yHead },
  { key: "hair_f_r", displayName: "FaceY Hair F R",
    domain: { x: 972, y: 187, width: 360, height: 801 }, cols: 7, rows: 11,
    fOld: oldTuft, fNew: newTuft, yHead: W_TUFT.yHead },
  { key: "hair_f_l", displayName: "FaceY Hair F L",
    domain: { x: 659, y: 227, width: 346, height: 779 }, cols: 7, rows: 11,
    fOld: oldTuft, fNew: newTuft, yHead: W_TUFT.yHead },
  { key: "back_hair_r", displayName: "FaceY Back Hair R",
    domain: { x: 339, y: 270, width: 734, height: 1600 }, cols: 11, rows: 13,
    fOld: oldCurt, fNew: newCurt, yHead: W_CURT.yHead },
  { key: "back_hair_l", displayName: "FaceY Back Hair L",
    domain: { x: 931, y: 232, width: 609, height: 1585 }, cols: 11, rows: 13,
    fOld: oldCurt, fNew: newCurt, yHead: W_CURT.yHead },
  { key: "back_top_hair_r", displayName: "FaceY Back Top Hair R",
    domain: { x: 747, y: 217, width: 268, height: 605 }, cols: 5, rows: 7,
    fOld: oldBT, fNew: newBT, yHead: W_CURT.yHead, contingent: true },
  { key: "back_top_hair_l", displayName: "FaceY Back Top Hair L",
    domain: { x: 986, y: 212, width: 268, height: 605 }, cols: 5, rows: 7,
    fOld: oldBT, fNew: newBT, yHead: W_CURT.yHead, contingent: true }
];
// untouched by design (rigid field has no W; asserted in verify):
const EYEWEAR_SIG = "rigControl:rig_facey_eyewear:param_face_angle_y";

const round2 = (n) => Math.round(n * 100) / 100;
const grid = (el, f, which) => {
  const out = [];
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      out.push({ x: 0, y: round2(f(x, y)[which]) });
    }
  }
  return out;
};

// ---- committed model files ----
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const rcRaw = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8"));
const rcs = rcRaw.rigControls ?? rcRaw;
const sigOf = (s) => `${s.target?.kind}:${s.target?.id}:${s.parameterId}`;
const setBySig = (sig) => kfs.find((s) => sigOf(s) === sig);

const canon = (o) =>
  JSON.stringify(o, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]))
      : v
  );

const mode = process.argv[2] ?? "gen";

// =============================== VERIFY MODE =================================
if (mode === "verify") {
  const snap = JSON.parse(readFileSync(new URL("snapshot-fix-pre.json", HERE), "utf8"));
  const design = JSON.parse(readFileSync(new URL("design-fix-values.json", HERE), "utf8"));
  const fixedSigs = new Set(design.map((d) => d.sig));
  if (kfs.length !== snap.sets.length)
    throw new Error(`set count ${kfs.length} != snapshot ${snap.sets.length} (no sets may be added/removed)`);
  let untouched = 0, fixed = 0;
  for (let i = 0; i < kfs.length; i++) {
    const s = kfs[i], sig = sigOf(s), pre = snap.sets[i];
    if (sig !== pre.sig) throw new Error(`set order drift at ${i}: ${pre.sig} -> ${sig}`);
    if (!fixedSigs.has(sig)) {
      const cur = s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }));
      if (JSON.stringify(cur) !== JSON.stringify(pre.keys))
        throw new Error(`UNTOUCHED KEYFORM SET CHANGED: ${sig}`);
      untouched++;
      continue;
    }
    const d = design.find((d) => d.sig === sig);
    for (const k of s.keys) {
      if (k.value === 0) { // center key must remain the pre-fix zeros
        const preK = pre.keys.find((p) => p.value === 0);
        if (JSON.stringify(k.statePatch) !== preK.json)
          throw new Error(`center key changed on ${sig}`);
        continue;
      }
      const want = d.keys.find((w) => w.value === k.value);
      if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
        throw new Error(`fixed set ${sig}@${k.value} does not match cp08fix design values`);
    }
    fixed++;
  }
  // eyewear explicitly untouched (it is not in fixedSigs, so covered above; name it)
  if (fixedSigs.has(EYEWEAR_SIG)) throw new Error("eyewear must not be re-keyed");
  // rig-controls completely untouched (no re-parenting in the fix round)
  const preRc = new Map(snap.rigControls.map((r) => [r.id, r.json]));
  for (const r of rcs) {
    const pre = preRc.get(r.rigControlId);
    if (!pre || canon(r) !== pre)
      throw new Error(`RIG CONTROL CHANGED: ${r.rigControlId}`);
    preRc.delete(r.rigControlId);
  }
  if (preRc.size) throw new Error(`rig controls disappeared: ${[...preRc.keys()].join(",")}`);
  console.log(`verify OK: ${untouched} keyform sets byte-identical (incl. eyewear, X keys, hat, cp07 core, open/close); ${fixed} sets re-keyed to cp08fix design (min/max only, center zeros intact); rig-controls byte-identical`);
  process.exit(0);
}

// ================================ GEN MODE ===================================

// ---- assert A: committed start state == cp08 design (13th gen formulas) ----
// Proves the shells/gains/W dials re-declared here ARE the committed ones.
const cp08design = JSON.parse(readFileSync(new URL("design-values.json", HERE), "utf8"));
for (const el of ELEMENTS) {
  const sig = `rigControl:rig_facey_${el.key}:param_face_angle_y`;
  const s = setBySig(sig);
  if (!s) throw new Error(`missing committed set ${sig}`);
  const wantMin = grid(el, el.fOld, "min"), wantMax = grid(el, el.fOld, "max");
  const gotMin = s.keys.find((k) => k.value === -30).statePatch;
  const gotMax = s.keys.find((k) => k.value === 30).statePatch;
  if (JSON.stringify(gotMin) !== JSON.stringify(wantMin) ||
      JSON.stringify(gotMax) !== JSON.stringify(wantMax))
    throw new Error(`assert A: committed ${sig} does not match the cp08 old-field formula`);
  const d8 = cp08design.find((d) => d.sig === sig);
  if (JSON.stringify(d8.keys.find((k) => k.value === -30).statePatch) !== JSON.stringify(gotMin))
    throw new Error(`assert A: design-values.json drift on ${sig}`);
}
// eyewear committed == cp08 design (we will not touch it)
{
  const s = setBySig(EYEWEAR_SIG), d8 = cp08design.find((d) => d.sig === EYEWEAR_SIG);
  for (const k of s.keys)
    if (JSON.stringify(k.statePatch) !== JSON.stringify(d8.keys.find((w) => w.value === k.value).statePatch))
      throw new Error("assert A: committed eyewear drifted from cp08 design");
}
console.log("assert A OK: committed cp08 state matches the 13th-gen formulas (start-state integrity; shells/gains/W dials confirmed live)");

// ---- assert B: root band (W=1) numerically unchanged by the fix ----
for (const el of ELEMENTS) {
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    if (y > el.yHead) continue;
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      const o = el.fOld(x, y), n = el.fNew(x, y);
      if (round2(o.min) !== round2(n.min) || round2(o.max) !== round2(n.max))
        throw new Error(`assert B: root band moved on ${el.key} @ (${x},${y})`);
    }
  }
}
console.log("assert B OK: root band (y<=yHead, W=1) byte-identical before/after the fix");

// ---- assert C: back_top_hair necessity (machine decision, task item 4) ----
const btDiff = {};
for (const el of ELEMENTS.filter((e) => e.contingent)) {
  let maxD = 0, rowMax = {};
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      const o = el.fOld(x, y), n = el.fNew(x, y);
      const d = Math.max(Math.abs(round2(o.min) - round2(n.min)), Math.abs(round2(o.max) - round2(n.max)));
      maxD = Math.max(maxD, d);
      rowMax[Math.round(y)] = Math.max(rowMax[Math.round(y)] ?? 0, d);
    }
  }
  btDiff[el.key] = maxD;
  console.log(`assert C: ${el.key} max |new-old| = ${maxD.toFixed(2)}px  per row: ${Object.entries(rowMax).map(([y, d]) => `y${y}:${d.toFixed(2)}`).join(" ")}`);
}
const BT_NEEDED = Math.max(...Object.values(btDiff)) > 0.005;
console.log(BT_NEEDED
  ? "assert C verdict: back_top_hair lattice crosses the curtain transition band -> RE-KEY IN SYNC (formula-level sync at y769 must follow the corrected curtain)"
  : "assert C verdict: back_top_hair unchanged -> no op");

// ---- assert D: the fix identity (W = mixing ratio of rotationality) ----
// new - root = W * (sphere - root)  at every probe: the rotational component
// (sphere - root) is what W attenuates; translation (root) passes through.
for (const [f, sph, wOf, yRoot, x, y] of [
  [newTuft, sphF, weight(W_TUFT), 550, 1152, 900],
  [newCurt, sphB, weight(W_CURT), 500, 706, 1400],
  [newFront, sphF, weight(W_FRONT), 500, 801, 700]
]) {
  const n = f(x, y), s = sph(x, y), r = sph(x, yRoot), w = wOf(y);
  for (const k of ["min", "max"])
    if (Math.abs((n[k] - r[k]) - w * (s[k] - r[k])) > 1e-9)
      throw new Error(`assert D: identity broken @ (${x},${y}) ${k}`);
}
console.log("assert D OK: field_new - root == W * (sphere - root) (W attenuates rotationality only; root translation passes through)");

// ---- snapshot (pre-fix committed state, first run only) ----
if (!existsSync(new URL("snapshot-fix-pre.json", HERE))) {
  writeFileSync(new URL("snapshot-fix-pre.json", HERE), JSON.stringify({
    sets: kfs.map((s) => ({
      sig: sigOf(s),
      keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
    })),
    rigControls: rcs.map((r) => ({ id: r.rigControlId, json: canon(r) }))
  }));
  console.log("snapshot-fix-pre.json written (pre-fix committed state, rev 250)");
}

// ---- design values + batch (updateCurrent, min & max keys only) ----
const FIX_ELEMENTS = ELEMENTS.filter((el) => !el.contingent || BT_NEEDED);
const design = [];
const batch = [];
for (const el of FIX_ELEMENTS) {
  const gMin = grid(el, el.fNew, "min"), gMax = grid(el, el.fNew, "max");
  design.push({
    sig: `rigControl:rig_facey_${el.key}:param_face_angle_y`,
    keys: [{ value: -30, statePatch: gMin }, { value: 30, statePatch: gMax }]
  });
  for (const [label, keyValue, g] of [["min", -30, gMin], ["max", 30, gMax]]) {
    batch.push({
      file: `fix-key-${el.key}-${label}.json`,
      operationId: `op_cp08fix_key_${el.key}_${label}`,
      operationType: "editKeyformKey",
      payload: {
        target: { kind: "rigControl", id: `rig_facey_${el.key}` },
        targetProperty: "controlPointOffsets",
        parameterId: "param_face_angle_y",
        interpolation: "linear-1d-v1",
        action: "updateCurrent",
        keyValue,
        statePatch: { propertyPath: "controlPointOffsets", value: g }
      },
      gitMessage: `[cp08fix] ${el.displayName} face_angle_y ${label}: carry root translation (blend target 0 -> sphere(u,y_root))`
    });
  }
}
writeFileSync(new URL("design-fix-values.json", HERE), JSON.stringify(design));
writeFileSync(new URL("batch-fix.json", HERE), JSON.stringify(batch, null, 2));
console.log(`batch-fix.json: ${batch.length} ops (${FIX_ELEMENTS.length} elements x min/max)`);

// ---- probes: the stake -> translation-copy numeric proof ----
const probes = [
  ["tuftR tip (x1152,y988 bottom row)", 1152, 988, oldTuft, newTuft, sphF, 550],
  ["tuftR mid-transition (x1152,y748)", 1152, 747.7, oldTuft, newTuft, sphF, 550],
  ["tuftL tip (x832,y1006 bottom row)", 831.7, 1006, oldTuft, newTuft, sphF, 550],
  ["curtR hanging (x706,y1070)", 706, 1070, oldCurt, newCurt, sphB, 500],
  ["curtR tip (x706,y1870 bottom row)", 706, 1870, oldCurt, newCurt, sphB, 500],
  ["curtL hanging (x1114,y1157)", 1113.8, 1157.08, oldCurt, newCurt, sphB, 500],
  ["curtL tip (x1114,y1817 bottom row)", 1113.8, 1817, oldCurt, newCurt, sphB, 500],
  ["front tail (x801,y773)", 801, 773, oldFront, newFront, sphF, 500],
  ["btR sync edge (x881,y769)", 881, 769, oldBT, newBT, null, null],
  ["curt at sync (x881,y769)", 881, 769, oldCurt, newCurt, null, null]
];
console.log("\nprobe                                   old(min/max)      new(min/max)      root-copy(min/max)");
for (const [name, x, y, fo, fn, sph, yRoot] of probes) {
  const o = fo(x, y), n = fn(x, y);
  const r = sph ? sph(x, yRoot) : null;
  console.log(` ${name.padEnd(38)} ${round2(o.min).toString().padStart(7)}/${round2(o.max).toString().padEnd(7)} ${round2(n.min).toString().padStart(7)}/${round2(n.max).toString().padEnd(7)}` +
    (r ? ` ${round2(r.min).toString().padStart(7)}/${round2(r.max).toString().padEnd(7)}` : "        (bt=R*curt)"));
}
