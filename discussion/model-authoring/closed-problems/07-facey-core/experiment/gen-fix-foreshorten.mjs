// cp07fix: restore the intra-element vertical gradient (foreshortening) on the
// DOWN key (param_face_angle_y = -30 = 俯き, verified by render y-min30 vs y-plus30)
// of the eye towers — the rule that recipe 06 carried for X as the 0.65T:0.25T
// column gradient on the eyes and that the transposition dropped.
//
// Diagnosis (L0/user-agreed): the viewer reads the rotation angle from BOTH
// (1) inter-element displacement (sinD terms) and (2) intra-element scale =
// foreshortening ((cosD-1) terms). The gain g scales displacements linearly,
// but the cos-based squash then sits at g*(1-cos30) = 2.5% — below perception
// (measured: eyewhite-l 56.0px at rest -> 54.6px at min = 2.5%), while the jaw
// band narrates a full nod. Principle: the SCALE must speak the same angle the
// DISPLACEMENT narrates (the artistic ~30-degree class), not the gained one.
// Geometric anchor: 1-cos30 = 13.4%; dial starts at the 10% class per the X
// precedent (>10% shrink on the eyes).
//
// Implementation: additive linear-in-y delta on the min key only,
//     ddy(y) = SQUASH * (YREF - y)
// - YREF = rest eyewhite center (L y439 / R y448, tape-measured), so the
//   aperture's MEAN displacement is preserved (the user-approved gestalt
//   amplitude does not change; the squash splits around the aperture center).
// - Direction derived, not assumed: rows ABOVE the axis-side reference move
//   down MORE (top lid presses down = 伏し目), rows below move down less.
//   Two independent derivations agree:
//   (a) local shell physics: d(dy)/dv at read-angle strength =
//       (cos30-1) + sin30*dz/dv; at the eye (v~-20, V_UP=316, Z~228 after the
//       u-taper) dz/dv = +0.11, so the slope is negative: higher points get
//       larger dy. The shell term (+5.5%) partially offsets the chord (-13.4%)
//       -> physics says ~8%, sitting right under the 10% dial.
//   (b) X recipe transposed: the limb-side endpoint (bottom, toward the jaw
//       curl where z->0) moves less; the center/axis-side endpoint (top) moves
//       more. Same sign.
// - Grid is 5x5 and the delta is linear in y -> bilinear exact, no resolution
//   issue. dx untouched (Y rotation stays a vertical business).
//
// Brows (decided by measurement, see design-log): the brow is a sampling of
// the eye field directly below it (X rule). With the eye gradient in, the lash
// top gains +4.5px extra downward motion; a static brow would WIDEN the
// brow-eye gap by ~4.5px in a pose where physics compresses it by ~13% (~3.4px)
// -> contradiction worse than before the fix. So the brows sample the SAME
// gradient line (same SQUASH, same side's YREF) at their own rows.
// Mouth: NOT patched — closed-line aperture is 10.7px tall (10% = 1px,
// imperceptible) and the mouth-chin spacing already narrates the down turn
// (gap 44px at rest -> 27px at min).
//
// Untouched-guarantee (assert design):
// 1. BEFORE emitting ops: reproduce the eleven-gen formula for all 7 FaceY
//    elements x 3 keys and assert the committed keyforms match within 0.005
//    (drift/human-correction detection; a human-corrected field must never be
//    machine-regenerated — constraint-ledger rule).
// 2. Ops address ONLY (rig_facey_eye_l|eye_r|brow_l|brow_r, param_face_angle_y,
//    key -30) via updateCurrent. Up key (+30) and default (0) are never emitted.
// 3. `node gen-fix-foreshorten.mjs verify` AFTER the batch: every keyformSet in
//    the package must byte-equal the pre-fix snapshot EXCEPT the four patched
//    (target, key=-30) entries, which must equal the design values.
//
// Usage:
//   node gen-fix-foreshorten.mjs            -> asserts + writes batch-fix-foreshorten.json + snapshot
//   node gen-fix-foreshorten.mjs eyes       -> batch with eye ops only (phase 1)
//   node gen-fix-foreshorten.mjs verify     -> post-commit untouched-guarantee check
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

// ---- dial ----
const SQUASH = 0.10; // 演出ダイヤル: aperture vertical squash added on the down key (10% class)
const YREF = { eye_l: 439, eye_r: 448 }; // rest eyewhite centers (tape measure)

// ---- eleven's formula, reproduced for the drift assert (source: gen-facey-core.mjs) ----
const CY = 459;
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const G_DN = 0.1875, G_UP = 0.15;
const V_UP = 316, V_DN = 150;
const U_SHELL = 320, Z_FACE = 240;
const zv = (v) => { const p = v <= 0 ? v / V_UP : v / V_DN; return Math.max(0, 1 - p * p); };
const faceZ = (x, y) => Z_FACE * Math.max(0, 1 - ((x - 1001) / U_SHELL) ** 2) * zv(y - CY);
const field = (zOf) => (x, y) => {
  const v = y - CY, chord = v * (COS - 1);
  const z = typeof zOf === "number" ? zOf : zOf(x, y);
  return { min: G_DN * (chord + SIN * z), max: G_UP * (chord - SIN * z) };
};
const round2 = (n) => Math.round(n * 100) / 100;
const grid = (domain, n, f, which) => {
  const out = [];
  for (let r = 0; r < n; r++) {
    const y = domain.y + (domain.height * r) / (n - 1);
    for (let c = 0; c < n; c++) {
      const x = domain.x + (domain.width * c) / (n - 1);
      out.push({ x: 0, y: which === 0 ? 0 : round2(f(x, y)[which > 0 ? "max" : "min"]) });
    }
  }
  return out;
};
const ELEMENTS = [
  { key: "face",   domain: { x: 811, y: 249, width: 378, height: 383 }, n: 9, f: field(faceZ) },
  { key: "nose",   domain: { x: 906, y: 418, width: 189, height: 130 }, n: 5, f: field(320) },
  { key: "mouth",  domain: { x: 918, y: 474, width: 165, height: 107 }, n: 5, f: field(256) },
  { key: "eye_l",  domain: { x: 940, y: 336, width: 262, height: 198 }, n: 5, f: field(272) },
  { key: "eye_r",  domain: { x: 789, y: 344, width: 271, height: 198 }, n: 5, f: field(272) },
  { key: "brow_l", domain: { x: 965, y: 305, width: 207, height: 111 }, n: 5, f: field(272) },
  { key: "brow_r", domain: { x: 816, y: 314, width: 212, height: 117 }, n: 5, f: field(272) }
];

// ---- fix targets: min-key delta lines ----
// eyes: own YREF; brows: sample the SAME line as the eye directly below (X sampling rule)
const TARGETS = {
  eye_l:  { ref: YREF.eye_l },
  eye_r:  { ref: YREF.eye_r },
  brow_l: { ref: YREF.eye_l },
  brow_r: { ref: YREF.eye_r }
};

// ---- load committed keyforms ----
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const faceySet = (key) =>
  kfs.find((s) => s.target?.id === `rig_facey_${key}` && s.parameterId === "param_face_angle_y");

const mode = process.argv[2] ?? "all";

if (mode === "verify") {
  // post-commit untouched-guarantee: compare against snapshot
  const snap = JSON.parse(readFileSync(new URL("fix-snapshot-pre.json", HERE), "utf8"));
  const design = JSON.parse(readFileSync(new URL("fix-design-values.json", HERE), "utf8"));
  let checked = 0, patched = 0;
  if (kfs.length !== snap.sets.length) throw new Error(`keyformSet count changed: ${snap.sets.length} -> ${kfs.length}`);
  for (let i = 0; i < kfs.length; i++) {
    const cur = kfs[i], pre = snap.sets[i];
    const sig = `${cur.target?.kind}:${cur.target?.id}:${cur.parameterId}`;
    if (sig !== pre.sig) throw new Error(`set order/id drift at ${i}: ${pre.sig} -> ${sig}`);
    for (const k of cur.keys) {
      const preKey = pre.keys.find((p) => p.value === k.value);
      if (!preKey) throw new Error(`new key ${sig}@${k.value}`);
      const curJson = JSON.stringify(k.statePatch);
      const designKey = design.find((d) => d.sig === sig && d.value === k.value);
      if (designKey) {
        if (curJson !== JSON.stringify(designKey.statePatch))
          throw new Error(`patched key ${sig}@${k.value} does not match design values`);
        patched++;
      } else {
        if (curJson !== preKey.json) throw new Error(`UNTOUCHED KEY CHANGED: ${sig}@${k.value}`);
        checked++;
      }
    }
  }
  const expectedPatched = design.length;
  if (patched !== expectedPatched) throw new Error(`patched-count ${patched} != design ${expectedPatched}`);
  console.log(`verify OK: ${patched} patched keys match design; ${checked} other keys byte-identical (all sets, all parameters)`);
  process.exit(0);
}

// ---- assert 1: committed FaceY fields match the eleven formula (no drift / no human corrections),
// ---- except keys already patched by THIS fix, which must match the recorded design values ----
const designSoFar = existsSync(new URL("fix-design-values.json", HERE))
  ? JSON.parse(readFileSync(new URL("fix-design-values.json", HERE), "utf8"))
  : [];
for (const el of ELEMENTS) {
  const set = faceySet(el.key);
  if (!set) throw new Error(`missing FaceY set for ${el.key}`);
  for (const [keyVal, which] of [[-30, -1], [0, 0], [30, +1]]) {
    const committed = set.keys.find((k) => k.value === keyVal)?.statePatch;
    const already = designSoFar.find(
      (d) => d.sig === `rigControl:rig_facey_${el.key}:param_face_angle_y` && d.value === keyVal
    );
    const gen = already ? already.statePatch : grid(el.domain, el.n, el.f, which);
    if (!committed || committed.length !== gen.length)
      throw new Error(`${el.key}@${keyVal}: lattice size mismatch`);
    for (let i = 0; i < gen.length; i++) {
      if (Math.abs(committed[i].x - gen[i].x) > 0.005 || Math.abs(committed[i].y - gen[i].y) > 0.005)
        throw new Error(`${el.key}@${keyVal}: drift at node ${i}: (${committed[i].x},${committed[i].y}) vs (${gen[i].x},${gen[i].y})`);
    }
  }
}
console.log("assert 1 OK: all 7 FaceY elements x 3 keys match the committed formula (no drift)");

// ---- snapshot for the post-verify (only on first run; the batch may be split eyes->brows) ----
if (!existsSync(new URL("fix-snapshot-pre.json", HERE))) {
  writeFileSync(new URL("fix-snapshot-pre.json", HERE), JSON.stringify({
    sets: kfs.map((s) => ({
      sig: `${s.target?.kind}:${s.target?.id}:${s.parameterId}`,
      keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
    }))
  }));
  console.log("snapshot fix-snapshot-pre.json written (pre-fix committed state)");
}

// ---- build min-key patches ----
const wanted = mode === "eyes" ? ["eye_l", "eye_r"] : mode === "brows" ? ["brow_l", "brow_r"] : ["eye_l", "eye_r", "brow_l", "brow_r"];
const batch = [];
const design = existsSync(new URL("fix-design-values.json", HERE))
  ? JSON.parse(readFileSync(new URL("fix-design-values.json", HERE), "utf8"))
  : [];
for (const key of wanted) {
  const el = ELEMENTS.find((e) => e.key === key);
  const set = faceySet(key);
  const committedMin = set.keys.find((k) => k.value === -30).statePatch;
  const n = el.n;
  const value = committedMin.map((p, i) => {
    const r = Math.floor(i / n);
    const y = el.domain.y + (el.domain.height * r) / (n - 1);
    const ddy = SQUASH * (TARGETS[key].ref - y);
    return { x: p.x, y: round2(p.y + ddy) };
  });
  // legibility print: per-row delta
  const rows = [];
  for (let r = 0; r < n; r++) {
    const y = el.domain.y + (el.domain.height * r) / (n - 1);
    rows.push(`r${r}(y${y}): ${round2(committedMin[r * n].y)} -> ${value[r * n].y} (d ${round2(SQUASH * (TARGETS[key].ref - y))})`);
  }
  console.log(`${key} min-key:\n  ${rows.join("\n  ")}`);
  batch.push({
    file: `fix-foreshorten-${key}.json`,
    operationId: `op_cp07fix_foreshorten_${key}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: `rig_facey_${key}` },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_y",
      interpolation: "linear-1d-v1",
      action: "updateCurrent",
      keyValue: -30,
      statePatch: { propertyPath: "controlPointOffsets", value }
    },
    gitMessage: `[cp07fix] key FaceY ${key} down(-30): intra-element vertical gradient (squash ${SQUASH}, yref ${TARGETS[key].ref}) — displacement/scale agreement`
  });
  const sig = `rigControl:rig_facey_${key}:param_face_angle_y`;
  const existing = design.findIndex((d) => d.sig === sig && d.value === -30);
  const entry = { sig, value: -30, statePatch: value };
  if (existing >= 0) design[existing] = entry; else design.push(entry);
}
writeFileSync(new URL("fix-design-values.json", HERE), JSON.stringify(design, null, 1));
const outName = mode === "eyes" ? "batch-fix-eyes.json" : mode === "brows" ? "batch-fix-brows.json" : "batch-fix-foreshorten.json";
writeFileSync(new URL(outName, HERE), JSON.stringify(batch, null, 2));
console.log(`${outName}: ${batch.length} ops (min key only; +30/default keys never emitted)`);
