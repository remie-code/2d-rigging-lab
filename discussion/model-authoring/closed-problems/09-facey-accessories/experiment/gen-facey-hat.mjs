// cp09: FaceY hat + ears + back_top_hair top recovery — completes the
// param_face_angle_y front. 3 new FaceY warp deformers wrapping the committed
// FaceX towers (headwear / ears_l / ears_r), keys on param_face_angle_y, plus
// the re-key of the FaceY back_top_hair min/max (the cp08 provisional
// "hat static in Y -> zero pinch at the top" is replaced by formula-level
// agreement with the hat's Y field).
//
// This file is the PRIMARY SOURCE of every cp09 number.
//
// ============================= PHYSICS FRAME =================================
// cp07 canon: CY = 459, D = 30deg,
//   dy_min(point) = G_DN * (chord + SIN*z)     min = downward nod
//   dy_max(point) = G_UP * (chord - SIN*z)     max = upward look
//   chord = v*(COS-1), v = y - CY, dx = 0 everywhere (pitch rotation moves
//   points in the y-z plane only; the X brim-loop dy exception has NO dx twin).
// G_DN = 0.1875, G_UP = 0.15.
//
// ======================= HAT z: same 3D surface, Y reading ===================
// cp08 lesson 3: the shell is the material's 3D surface; X and Y read the SAME
// z at every point. The hat's z (design knowledge from cp06 gen-fix*-hat.mjs;
// the committed X KEYS additionally carry a human visual correction (ledger
// C10) and are treated as byte-frozen — we never assert them against formulas
// and never regenerate them):
//   dome:   z = 320*(1-(u/320)^2) * sTrue(y),  sTrue = spherical cap EQ463/R371
//           *** WITHOUT the X freeze (C3). *** The y<170 freeze was the X
//           standing-appendage device (carry base translation horizontally).
//           In Y the crown top must use the TRUE vertical section: z->0 at the
//           pole y92 with z growing downward is precisely what makes the top
//           face APPEAR on a nod (rows near the pole move ~chord-only while
//           the forehead band moves chord+SIN*z: the crown stretches open).
//           Face alternation, Y version: dz/dv > 0 -> per-row scale
//           g*((COS-1) + SIN*dz/dv) = +5..6%/row stretch on min (top face
//           rotating into view), fold-away compression on max.
//   ears:   the cp06 cone sections (ridge/flank tables measured from texture
//           alpha) VERBATIM — the cone z is ~constant in y = the ear carries
//           its base-ring translation (the Y form of "standing appendages
//           carry the root translation"). The forward/backward TILT of the
//           standing appendage is a cos-series (even) effect that the gained
//           chord cannot narrate (2.5%, below perception) -> explicit
//           intra-element squash at reading-angle strength (cp07fix law:
//           scale must speak the angle the displacement narrates):
//             ddy = SQ_key * (150 - y) * sqW(u,y)     (added to BOTH keys;
//           even parity checked). SQ_DN = 0.10 (narrated angle 30deg,
//           geometric anchor 1-cos30 = 13.4%, dial start 10% + existing
//           gained chord 2.5% = 12.5% total, the cp07fix landing).
//           SQ_UP = 0.06 (up gain narrates 0.8 amplitude -> effective angle
//           asin(0.8*sin30) = 23.6deg -> 1-cos = 8.4%; 6% + 2.4% chord = 8.4%).
//           sqW = normalized cone section (ridge 1 -> flank falloff), faded
//           out across the ear->dome blend band y122..150. Anchor row y150 =
//           the base ring (physics anchors at the base; the gate axis is
//           "the ears stay planted on the crown").
//   slack (between the ears): true dome section too — the slack rows ARE the
//           crown top face; freezing them (X) would suppress its appearance.
//
// ---- silhouette edges (C4 transposed, anchor target CHANGED for Y) ----
// The lateral edges keep the w(u,y) ramp with the cp06 texture-measured
// W_L/W_R(y) tables, but the anchor target is the FRONT-HAIR SHELL field
// (EQ463/R320), not the X occiput z<0 reduction. Reason: the anchor law is
// "the same formula as the head-silhouette owner" (recipe 07). In X the
// owner's horizontal motion was the occiput layer (small chord + z<0). In Y
// the head silhouette below the hat is owned by the bangs/tufts whose
// committed Y fields move near-fully (g*(chord +- SIN*z_fh) — the gated
// world-line where the whole head translates). Anchoring the hat edge to
// chord-only (the naive sphere-outline answer) would make the hat edge LAG
// the tuft silhouette by ~15px at the notch junction and tear the outline.
// The residual interior-vs-edge differential (crown R371 vs head R320,
// 2..9px) is the Y form of "material flows through the rim": on a nod the
// crown material descends past the slower silhouette edge.
//
// ---- brim loop (C5's Y shape) ----
// In X the tilted connection loop leaked dz into dy (dy = -k*u*sinD). In Y
// the loop lies IN the rotation plane: no new coupling term exists (dx = 0
// exactly); instead the loop's front/back asymmetry is carried by the z each
// brim point already has: the scallop center (front of the loop, z big)
// drops ~+31 on min while the side flaps (loop sides, z small + anchored)
// drop ~+23 -> the brim ellipse OPENS on the nod (arc deepens), closes on
// the look-up. Constructive — no extra term.
//
// ---- bangs contact band (C7 transposed, adjudicated) ----
// The scallop lower edge is a pressed contact with the bangs. The v(y) ramp
// (cp06 band structure, a function of y independent of the lattice) blends
// the lower band toward the bangs shell + LAMBDA*(z_hat - z_fh) differential,
// LAMBDA = 4 (the committed X presentation dial for this same contact pair;
// raw physical differential 0.35..0.9px in Y is below perception, exactly as
// it was in X). Resulting Y slip vs the bangs: +1.4..+2.0px downward lead on
// min (the hat presses DOWN over the bangs — coverage grows, occlusion-safe),
// -0.4..-1.5px upward lead on max (trivially inside the coverage margin).
// Numbers printed below; render adjudication in the design log.
//
// ==================== EARS L/R (the cheap co-passenger) ======================
// CY=459 coincides with the ear centers (v in [-48,+48]) and the ears sit on
// the coronal plane (X canon z==0, limb). "Nearly motionless is CORRECT" —
// the ears are the pivot of the nod. No dead band though: chord gives
// +-(0..1.2)px*g compression toward the axis, and a small constant depth
// Z_EAR = 24 (the pinna cups slightly forward of the coronal tangent; dial)
// gives min +2.25 / max -1.8 px translation. Every material node moves
// >= 0.9px. NO reading-strength squash: the intra-element scale law says the
// scale must match the angle the element's DISPLACEMENT narrates — the ear's
// displacement narrates "I am the pivot", so only the gained chord scale
// (2.5%) applies (contrapositive of the cp07fix law, recorded in the log).
//
// =================== BACK_TOP_HAIR TOP RECOVERY (cp08 debt) ==================
// cp08 committed: dy_bt = R(y)*dy_curtain, R = clamp((y-264)/505) — the top
// pinched to ZERO because the hat was static in Y. The hat now moves; the bt
// surface pressed under the hat edge must follow it (X precedent C9: master =
// hat, receiver = bt boundary rows). The Y lattice (5x7, rows y217..822,
// pitch 100.8) has no row on the drawn edge y257/252, so the boundary
// condition is carried by a ramp instead of a single-row punch:
//   dy_bt_new(u,y) = H(y)*dy_hatY(u, min(y,392)) + (1-H(y))*R(y)*dy_curtY(u,y)
//   H(y) = 1 for y <= 392 (the hat's real coverage; brim bottom edge),
//          linear -> 0 at y = 620, 0 below.
// - rows y217/317.8: H=1 -> the hat's own formula at the same point =
//   formula-level agreement (the sliver band y300-360 follows the visible hat
//   edge; on max the hat edge rises ~-15..-19 and the slivers rise with it —
//   the tear this task exists to prevent).
// - rows y620.3 / 721.2 / 822: H=0 -> BYTE-IDENTICAL to cp08fix (the curtain
//   carry structure, the y769 formula-level sync, and the measured junction
//   band y720-790 are preserved untouched).
// - between: the transported brim-edge value fades into the rising skull-back
//   (curtain root) — the zero crossing of dy_min sits ~y525.
// The 14th-generation lesson is applied literally: assert committed == cp08fix
// formula at ALL 35 nodes per side first, then print the full per-row
// new-vs-old diff table before adjudicating (no "should be" shortcuts).
//
// ============================ GRID / DOMAINS =================================
// Domains = FaceX child domain + margin x+-36 / y+-40 (cp07/cp08 rule).
//   headwear: X {795,79,425,313} -> {759,39,497,393}, lattice 15x15
//     (X needed 13x13 = 35.4px pitch to land nodes on the ear ridges; the Y
//     domain is 72/80px wider, so 15x15 restores the SAME physical pitch —
//     35.5px cols put a node at u=-135.5 on the left apex u=-134.5, exactly
//     as X's c2 did; rows 28.1px resolve the pole sqrt + ear squash + v band)
//   ears: X {836,411,81,96} / {1078,411,82,96} -> {800,371,153,176} /
//     {1042,371,154,176}, 5x5 (near-affine field, bilinear-exact class)
//   back_top_hair: existing FaceY 5x7 lattices, re-keyed via updateCurrent.
//
// UNTOUCHED (verify mode asserts byte-identity): ALL X keys — most
// importantly the hat X set (human correction C10) — plus cp07 FaceY facial
// core, cp08 FaceY hair/eyewear (except the two bt Y sets), eye open/close +
// eyeball towers, and every rig control except the 3 re-parented wrap targets.
//
// Usage:
//   node gen-facey-hat.mjs          -> asserts + snapshot + batch-rig.json + probes
//   node gen-facey-hat.mjs verify   -> post-commit untouched/changed-as-designed check
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

// ---- canon frame ----
const CX = 1001, CY = 459;
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const G_DN = 0.1875, G_UP = 0.15;
const round2 = (n) => Math.round(n * 100) / 100;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

// ---- hat geometry constants (cp06 design knowledge, code verbatim) ----
const HAT_EQ = 463, HAT_R = 371, HAT_FREEZE = 170;
const SHELL_U = 320, SHELL_Z = 320;
const RAMP_A = 0.55;
const ANCHOR_Y_MIN = 135;
const EAR_MERGE_Y = 122, EAR_BLEND_END = 150;
const LAMBDA = 4;               // committed X presentation dial (C7')
const SQ_DN = 0.10, SQ_UP = 0.06; // ear squash dials (reading-angle strength)

// TRUE vertical cap (no freeze — the Y crown-top reading)
const sTrue = (y) => (y >= HAT_EQ ? 1 : Math.sqrt(Math.max(0, 1 - ((HAT_EQ - y) / HAT_R) ** 2)));
// X frozen cap — used ONLY for the ear ridge amplitude (cp06 verbatim)
const sHatFrozen = Math.sqrt(1 - ((HAT_EQ - HAT_FREEZE) / HAT_R) ** 2);
const par = (u) => Math.max(0, 1 - (u / SHELL_U) ** 2);
const zCrownY = (u, y) => SHELL_Z * par(u) * sTrue(y);

// front-hair shell (EQ463/R320 — the committed head-periphery Y canon)
const FH_EQ = 463, FH_CAP_R = 320;
const capS = (y) => (y >= FH_EQ ? 1 : Math.sqrt(Math.max(0, 1 - ((FH_EQ - y) / FH_CAP_R) ** 2)));
const zFh = (u, y) => SHELL_Z * par(u) * capS(y);

// ---- per-row silhouette half-widths from the texture (cp06 verbatim) ----
const TEX = { f: "psd/r0_1cea4f6f/psd_root_layer_0.raw-rgba", x: 808, y: 92, w: 400, h: 288 };
const ALPHA = 64;
const wTab = { L: new Map(), R: new Map() };
{
  const buf = readFileSync(`${PKG}/assets/textures/${TEX.f}`);
  for (let ry = 0; ry < TEX.h; ry++) {
    const y = TEX.y + ry;
    if (y < 124) continue;
    let mnL = Infinity, mxR = -Infinity, run = 0;
    for (let rx = 0; rx < TEX.w; rx++) {
      const op = buf[(ry * TEX.w + rx) * 4 + 3] >= ALPHA;
      run = op ? run + 1 : 0;
      if (run >= 3) {
        const u0 = TEX.x + rx - CX;
        for (let d = 0; d < run && d < 3; d++) {
          const u = u0 - d;
          if (u < 0) mnL = Math.min(mnL, u);
          else mxR = Math.max(mxR, u);
        }
      }
    }
    if (mnL < Infinity) wTab.L.set(y, -mnL);
    if (mxR > -Infinity) wTab.R.set(y, mxR);
  }
}
const wOf = (side, y) => {
  const t = wTab[side];
  const ys = [...t.keys()];
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const yy = Math.max(lo, Math.min(hi, Math.round(y)));
  for (let d = 0; d <= hi - lo; d++) {
    if (t.has(yy - d)) return t.get(yy - d);
    if (t.has(yy + d)) return t.get(yy + d);
  }
  throw new Error("empty W table");
};

// ---- ear cone sections (cp06 tables + code verbatim) ----
const lerpTab = (tab, y) => {
  if (y <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (y <= tab[i][0]) {
      const [y0, v0] = tab[i - 1], [y1, v1] = tab[i];
      return v0 + ((y - y0) * (v1 - v0)) / (y1 - y0);
    }
  }
  const [y1, v1] = tab[tab.length - 1];
  const [y0, v0] = tab[tab.length - 2];
  const slope = (v1 - v0) / (y1 - y0);
  return v1 + (y - y1) * (slope > 0 ? slope : 0);
};
const EARS = {
  left: {
    sign: -1,
    ridge: [[92, -134.5], [104, -121], [112, -111.5], [122, -103]],
    outer: [[92, -140], [104, -151], [112, -153], [122, -155.5]],
    inner: [[92, -129], [104, -91], [112, -70], [122, -51]]
  },
  right: {
    sign: +1,
    ridge: [[92, 153.5], [104, 140], [112, 130], [122, 122]],
    outer: [[92, 156], [104, 168], [112, 171], [122, 173.5]],
    inner: [[92, 151], [104, 112], [112, 89], [122, 68]]
  }
};
const FALL_OUT = 0.85, FALL_IN = 0.15, B_FLOOR = 15;
const earFall = (ear, u, y) => {
  const ur = lerpTab(ear.ridge, Math.min(y, EAR_MERGE_Y));
  const bOut = Math.max(B_FLOOR, Math.abs(lerpTab(ear.outer, y) - ur));
  const bIn = Math.max(B_FLOOR, Math.abs(lerpTab(ear.inner, y) - ur));
  const d = u - ur;
  const outward = ear.sign > 0 ? d > 0 : d < 0;
  return outward ? (FALL_OUT * Math.abs(d)) / bOut : (FALL_IN * Math.abs(d)) / bIn;
};
const zEarSection = (ear, u, y) => {
  const ur = lerpTab(ear.ridge, Math.min(y, EAR_MERGE_Y));
  const zr = SHELL_Z * par(ur) * sHatFrozen;
  return zr * Math.max(0, 1 - earFall(ear, u, y));
};
const earOf = (u) => (u <= -49 ? EARS.left : u >= 66 ? EARS.right : null);
const zFullY = (u, y) => {
  if (y >= EAR_BLEND_END) return zCrownY(u, y);
  const ear = earOf(u);
  if (!ear) return zCrownY(u, y); // slack = true dome section (top face appears)
  const zt = zEarSection(ear, u, y);
  if (y <= EAR_MERGE_Y) return zt;
  const t = (y - EAR_MERGE_Y) / (EAR_BLEND_END - EAR_MERGE_Y);
  return zt * (1 - t) + zCrownY(u, y) * t;
};
// normalized ear weight for the squash (ridge 1 -> flank falloff -> blend fade)
const sqWeight = (u, y) => {
  if (y >= EAR_BLEND_END) return 0;
  const ear = earOf(u);
  if (!ear) return 0;
  const norm = Math.max(0, 1 - earFall(ear, u, y));
  const fade = y <= EAR_MERGE_Y ? 1 : (EAR_BLEND_END - y) / (EAR_BLEND_END - EAR_MERGE_Y);
  return norm * fade;
};

// ---- bangs subordination ramp (cp06 band structure, function of y) ----
const V_NODES = [[287.67, 0], [313.75, 0.30], [339.83, 0.85], [365.92, 1.0], [392, 1.0]];
const vOf = (y) => {
  if (y <= V_NODES[0][0]) return 0;
  if (y >= V_NODES[V_NODES.length - 1][0]) return 1;
  for (let i = 1; i < V_NODES.length; i++) {
    if (y <= V_NODES[i][0]) {
      const [y0, v0] = V_NODES[i - 1], [y1, v1] = V_NODES[i];
      return v0 + ((y - y0) * (v1 - v0)) / (y1 - y0);
    }
  }
  return 1;
};

// ---- THE HAT Y FIELD ----
const pair = (ch, z) => ({ min: G_DN * (ch + SIN * z), max: G_UP * (ch - SIN * z) });
const hatY = (x, y) => {
  const u = x - CX, v = y - CY, ch = v * (COS - 1);
  let f = pair(ch, zFullY(u, y));
  if (y >= ANCHOR_Y_MIN) { // C4-Y: edge anchoring to the head-silhouette owner's shell
    const W = wOf(u < 0 ? "L" : "R", y);
    const w = clamp01((Math.abs(u) - RAMP_A * W) / ((1 - RAMP_A) * W));
    const a = pair(ch, zFh(u, y));
    f = { min: (1 - w) * f.min + w * a.min, max: (1 - w) * f.max + w * a.max };
  }
  const vr = vOf(y); // C7-Y: bangs subordination + lambda shell differential
  if (vr > 0) {
    const zS = zFh(u, y) + LAMBDA * (zCrownY(u, y) - zFh(u, y));
    const s = pair(ch, zS);
    f = { min: (1 - vr) * f.min + vr * s.min, max: (1 - vr) * f.max + vr * s.max };
  }
  const sq = sqWeight(u, y); // ear squash (cos-series, even parity: same sign both keys)
  if (sq > 0) {
    f.min += SQ_DN * (EAR_BLEND_END - y) * sq;
    f.max += SQ_UP * (EAR_BLEND_END - y) * sq;
  }
  return f;
};

// ---- EARS Y FIELD ----
const Z_EAR = 24; // slight forward cup of the pinna (dial; "わずかな z")
const earsY = (x, y) => pair((y - CY) * (COS - 1), Z_EAR);

// ---- committed hair Y fields (cp08fix carry form; asserted below) ----
const U_SPREAD = 650;
const shellBack = (x, y) => -SHELL_Z * Math.max(0, 1 - ((x - CX) / U_SPREAD) ** 2) * capS(y);
const shellFrontEl = (x, y) => SHELL_Z * par(x - CX) * capS(y);
const weight = ({ yHead, yFree, wTip }) => (y) =>
  y <= yHead ? 1 : 1 - (1 - wTip) * smooth((y - yHead) / (yFree - yHead));
const sphere = (shell) => (x, y) => {
  const v = y - CY, ch = v * (COS - 1), z = shell(x, y);
  return { min: G_DN * (ch + SIN * z), max: G_UP * (ch - SIN * z) };
};
const carry = (sph, wOfY, yRoot) => (x, y) => {
  const w = wOfY(y), s = sph(x, y), r = sph(x, yRoot);
  return { min: w * s.min + (1 - w) * r.min, max: w * s.max + (1 - w) * r.max };
};
const W_FRONT = { yHead: 500, yFree: 773, wTip: 0.7 };
const W_TUFT = { yHead: 550, yFree: 900, wTip: 0 };
const W_CURT = { yHead: 500, yFree: 1000, wTip: 0 };
const sphF = sphere(shellFrontEl), sphB = sphere(shellBack);
const curtY = carry(sphB, weight(W_CURT), W_CURT.yHead);
const frontY = carry(sphF, weight(W_FRONT), W_FRONT.yHead);
const tuftY = carry(sphF, weight(W_TUFT), W_TUFT.yHead);

// ---- back_top_hair: old (cp08fix committed) and new (cp09) formulas ----
const R_BT = (y) => clamp01((y - 264) / (769 - 264));
const btOld = (x, y) => {
  const c = curtY(x, y), r = R_BT(y);
  return { min: r * c.min, max: r * c.max };
};
const H_TOP = 392, H_END = 620; // hat-grip ramp (brim bottom edge -> fade-out)
const H_BT = (y) => (y <= H_TOP ? 1 : y >= H_END ? 0 : (H_END - y) / (H_END - H_TOP));
const btNew = (x, y) => {
  const h = H_BT(y);
  const o = btOld(x, y);
  if (h === 0) return o;
  const hat = hatY(x, Math.min(y, H_TOP));
  return { min: h * hat.min + (1 - h) * o.min, max: h * hat.max + (1 - h) * o.max };
};

// ---- element table ----
const HAT_N = 15;
const ELEMENTS = [
  { key: "headwear", displayName: "FaceY Headwear", wrap: "rig_facex_headwear",
    domain: { x: 759, y: 39, width: 497, height: 393 }, cols: HAT_N, rows: HAT_N, f: hatY },
  { key: "ears_r", displayName: "FaceY Ears R", wrap: "rig_facex_ears_r",
    domain: { x: 800, y: 371, width: 153, height: 176 }, cols: 5, rows: 5, f: earsY },
  { key: "ears_l", displayName: "FaceY Ears L", wrap: "rig_facex_ears_l",
    domain: { x: 1042, y: 371, width: 154, height: 176 }, cols: 5, rows: 5, f: earsY }
];
const BT = [
  { key: "back_top_hair_r", rig: "rig_facey_back_top_hair_r",
    domain: { x: 747, y: 217, width: 268, height: 605 }, cols: 5, rows: 7 },
  { key: "back_top_hair_l", rig: "rig_facey_back_top_hair_l",
    domain: { x: 986, y: 212, width: 268, height: 605 }, cols: 5, rows: 7 }
];

const nodeXY = (el, r, c) => [
  el.domain.x + (el.domain.width * c) / (el.cols - 1),
  el.domain.y + (el.domain.height * r) / (el.rows - 1)
];
const grid = (el, f, which) => {
  const out = [];
  for (let r = 0; r < el.rows; r++) for (let c = 0; c < el.cols; c++) {
    const [x, y] = nodeXY(el, r, c);
    out.push({ x: 0, y: which === 0 ? 0 : round2(f(x, y)[which > 0 ? "max" : "min"]) });
  }
  return out;
};

// ---- committed model files ----
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const rcRaw = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8"));
const rcs = rcRaw.rigControls ?? rcRaw;
const rcById = (id) => rcs.find((r) => r.rigControlId === id);
const sigOf = (s) => `${s.target?.kind}:${s.target?.id}:${s.parameterId}`;
const setOf = (id, param) => kfs.find((s) => s.target?.id === id && s.parameterId === param);

const canon = (o) =>
  JSON.stringify(o, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]))
      : v
  );

const mode = process.argv[2] ?? "gen";

// =============================== VERIFY MODE =================================
if (mode === "verify") {
  const snap = JSON.parse(readFileSync(new URL("snapshot-pre.json", HERE), "utf8"));
  const design = JSON.parse(readFileSync(new URL("design-values.json", HERE), "utf8"));
  const designBySig = new Map(design.map((d) => [d.sig, d]));
  const newSigs = new Set(ELEMENTS.map((el) => `rigControl:rig_facey_${el.key}:param_face_angle_y`));
  const btSigs = new Set(BT.map((b) => `rigControl:${b.rig}:param_face_angle_y`));
  const oldSets = [], addedSets = [];
  for (const s of kfs) {
    const sig = sigOf(s);
    (newSigs.has(sig) ? addedSets : oldSets).push({ sig, s });
  }
  if (oldSets.length !== snap.sets.length)
    throw new Error(`pre-existing set count ${oldSets.length} != snapshot ${snap.sets.length}`);
  let untouched = 0, reKeyed = 0, hatXok = false;
  for (let i = 0; i < oldSets.length; i++) {
    const { sig, s } = oldSets[i], pre = snap.sets[i];
    if (sig !== pre.sig) throw new Error(`set order drift at ${i}: ${pre.sig} -> ${sig}`);
    if (btSigs.has(sig)) { // the two re-keyed bt sets: min/max = design, center = pre bytes
      const d = designBySig.get(sig);
      for (const k of s.keys) {
        if (k.value === 0) {
          const preK = pre.keys.find((p) => p.value === 0);
          if (JSON.stringify(k.statePatch) !== preK.json)
            throw new Error(`bt center key changed on ${sig}`);
          continue;
        }
        const want = d.keys.find((w) => w.value === k.value);
        if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
          throw new Error(`re-keyed set ${sig}@${k.value} does not match cp09 design`);
      }
      reKeyed++;
      continue;
    }
    const cur = s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }));
    if (JSON.stringify(cur) !== JSON.stringify(pre.keys))
      throw new Error(`UNTOUCHED KEYFORM SET CHANGED: ${sig}`);
    if (sig === "rigControl:rig_facex_headwear:param_face_angle_x") hatXok = true;
    untouched++;
  }
  if (!hatXok) throw new Error("hat X keyform set not found among untouched sets");
  for (const { sig, s } of addedSets) {
    const d = designBySig.get(sig);
    if (!d) throw new Error(`unexpected new set ${sig}`);
    for (const k of s.keys) {
      const want = d.keys.find((w) => w.value === k.value);
      if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
        throw new Error(`new set ${sig}@${k.value} does not match design values`);
    }
  }
  if (addedSets.length !== 3) throw new Error(`expected 3 new sets, got ${addedSets.length}`);
  // rig-controls: unchanged except 3 re-parents + 3 new controls
  const preRc = new Map(snap.rigControls.map((r) => [r.id, r]));
  const wrapParent = new Map(ELEMENTS.map((el) => [el.wrap, `rig_facey_${el.key}`]));
  let newRc = 0;
  for (const r of rcs) {
    const pre = preRc.get(r.rigControlId);
    if (!pre) {
      const el = ELEMENTS.find((e) => `rig_facey_${e.key}` === r.rigControlId);
      if (!el) throw new Error(`unexpected new rig control ${r.rigControlId}`);
      const db = r.domainBounds;
      if (r.latticeColumns !== el.cols || r.latticeRows !== el.rows ||
        db.x !== el.domain.x || db.y !== el.domain.y ||
        db.width !== el.domain.width || db.height !== el.domain.height)
        throw new Error(`new control ${r.rigControlId}: lattice/domain mismatch`);
      newRc++;
      continue;
    }
    const expParent = wrapParent.get(r.rigControlId) ?? pre.parentId;
    if (canon({ ...r, parentId: null }) !== canon(JSON.parse(pre.jsonNoParent)))
      throw new Error(`RIG CONTROL CHANGED beyond re-parent: ${r.rigControlId}`);
    if ((r.parentId ?? null) !== (expParent ?? null))
      throw new Error(`parentId of ${r.rigControlId}: ${r.parentId} != expected ${expParent}`);
    preRc.delete(r.rigControlId);
  }
  if (preRc.size) throw new Error(`rig controls disappeared: ${[...preRc.keys()].join(",")}`);
  if (newRc !== 3) throw new Error(`expected 3 new rig controls, got ${newRc}`);
  console.log(`verify OK: ${untouched} pre-existing keyform sets byte-identical ` +
    `(HAT X SET (human correction C10) EXPLICITLY CONFIRMED byte-identical; ears X, cp07 core, ` +
    `cp08 hair/eyewear, open/close towers included); ${reKeyed} bt sets re-keyed to cp09 design ` +
    `(center zeros intact); 3 new sets match design; re-parent-only on the 3 wrapped towers (+${newRc} new controls)`);
  process.exit(0);
}

// ================================ GEN MODE ===================================

// ---- assert A: Y domains really are FaceX domain + (36,40) margin ----
for (const el of ELEMENTS) {
  const xd = rcById(el.wrap).domainBounds;
  const ok = el.domain.x === xd.x - 36 && el.domain.y === xd.y - 40 &&
    el.domain.width === xd.width + 72 && el.domain.height === xd.height + 80;
  if (!ok) throw new Error(`${el.key}: domain/margin mismatch vs committed FaceX domain ${JSON.stringify(xd)}`);
}
console.log("assert A OK: Y domains = committed FaceX domains + x±36/y±40");

// ---- assert B: committed FaceY hair fields == cp08fix carry formulas ----
// (basis integrity: the z_fh / curtain functions transposed into the hat
// anchor + bt formulas ARE the committed ones)
const HAIR_CHECK = [
  ["rig_facey_hair_front", { x: 619, y: 95, width: 764, height: 718 }, 11, 11, frontY],
  ["rig_facey_hair_f_r", { x: 972, y: 187, width: 360, height: 801 }, 7, 11, tuftY],
  ["rig_facey_hair_f_l", { x: 659, y: 227, width: 346, height: 779 }, 7, 11, tuftY],
  ["rig_facey_back_hair_r", { x: 339, y: 270, width: 734, height: 1600 }, 11, 13, curtY],
  ["rig_facey_back_hair_l", { x: 931, y: 232, width: 609, height: 1585 }, 11, 13, curtY]
];
for (const [id, d, cols, rows, f] of HAIR_CHECK) {
  const s = setOf(id, "param_face_angle_y");
  if (!s) throw new Error(`missing committed set ${id}`);
  for (const key of s.keys) {
    if (key.value === 0) continue;
    const which = key.value > 0 ? "max" : "min";
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = d.x + (d.width * c) / (cols - 1), y = d.y + (d.height * r) / (rows - 1);
      const got = key.statePatch[r * cols + c];
      if (Math.abs(got.y - f(x, y)[which]) > 0.006 || Math.abs(got.x) > 0.001)
        throw new Error(`Y drift ${id}@${key.value} node ${r},${c}: got (${got.x},${got.y}) want ${f(x, y)[which].toFixed(3)}`);
    }
  }
}
console.log("assert B OK: committed FaceY hair fields (front/tufts/curtains) == cp08fix carry formulas");

// ---- assert C: committed FaceY back_top_hair == cp08fix formula (pre-rewrite drift check) ----
for (const b of BT) {
  const s = setOf(b.rig, "param_face_angle_y");
  if (!s) throw new Error(`missing committed set ${b.rig}`);
  for (const key of s.keys) {
    if (key.value === 0) continue;
    const which = key.value > 0 ? "max" : "min";
    for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
      const [x, y] = nodeXY(b, r, c);
      const got = key.statePatch[r * b.cols + c];
      if (Math.abs(got.y - round2(btOld(x, y)[which])) > 0.006 || Math.abs(got.x) > 0.001)
        throw new Error(`bt drift ${b.rig}@${key.value} node ${r},${c}: got (${got.x},${got.y}) want ${round2(btOld(x, y)[which])}`);
    }
  }
}
console.log("assert C OK: committed FaceY back_top_hair == cp08fix formula at all 35 nodes/side (no drift; safe to rewrite)");

// ---- assert D: committed ears X == cp05 chord formula (integrity info) ----
const CH_X = G_DN * (COS - 1);
for (const id of ["rig_facex_ears_r", "rig_facex_ears_l"]) {
  const ctrl = rcById(id), s = setOf(id, "param_face_angle_x");
  const d = ctrl.domainBounds, n = ctrl.latticeColumns, m = ctrl.latticeRows;
  for (const key of s.keys) {
    if (key.value === 0) continue;
    for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) {
      const x = d.x + (d.width * c) / (n - 1);
      const got = key.statePatch[r * n + c];
      if (Math.abs(got.x - CH_X * (x - CX)) > 0.06 || Math.abs(got.y) > 0.001)
        throw new Error(`ears X drift ${id}@${key.value} node ${r},${c}`);
    }
  }
}
console.log("assert D OK: committed ears X == cp05 chord-only formula (limb canon; ± identical patches)");

// ---- assert E: no vertical fold on the emitted hat grids ----
{
  const el = ELEMENTS[0];
  for (const which of ["min", "max"]) {
    for (let c = 0; c < el.cols; c++) {
      for (let r = 0; r + 1 < el.rows; r++) {
        const [x1, y1] = nodeXY(el, r, c), [x2, y2] = nodeXY(el, r + 1, c);
        const gap = (y2 + hatY(x2, y2)[which]) - (y1 + hatY(x1, y1)[which]);
        if (gap <= 0) throw new Error(`vertical fold on hat ${which} col ${c} rows ${r}/${r + 1}: gap ${gap.toFixed(2)}`);
      }
    }
  }
}
console.log("assert E OK: hat grids fold-free (deformed row gaps > 0 on every column, both keys)");

// ---- assert F: parity + dx=0 ----
{
  const el = ELEMENTS[0];
  for (let r = 0; r < el.rows; r++) for (let c = 0; c < el.cols; c++) {
    const [x, y] = nodeXY(el, r, c);
    const sq = sqWeight(x - CX, y);
    if (sq > 0) {
      const dn = SQ_DN * (EAR_BLEND_END - y) * sq, up = SQ_UP * (EAR_BLEND_END - y) * sq;
      if (Math.sign(dn) !== Math.sign(up)) throw new Error("squash parity breach");
    }
  }
}
console.log("assert F OK: ear squash has even (cos-series) parity; all emitted offsets carry x=0");

// ---- assert G: bt structural preservation ----
for (const b of BT) {
  for (let r = 0; r < b.rows; r++) {
    const [, y] = nodeXY(b, r, 0);
    if (y >= H_END) {
      for (let c = 0; c < b.cols; c++) {
        const [x, yy] = nodeXY(b, r, c);
        const o = btOld(x, yy), n = btNew(x, yy);
        if (round2(o.min) !== round2(n.min) || round2(o.max) !== round2(n.max))
          throw new Error(`bt lower-structure row moved: ${b.key} r${r}`);
      }
    }
  }
  // y769 sync: new formula == curtain exactly (H=0, R=1)
  for (const x of [b.domain.x, b.domain.x + b.domain.width / 2, b.domain.x + b.domain.width]) {
    const n = btNew(x, 769), cu = curtY(x, 769);
    if (Math.abs(n.min - cu.min) > 1e-9 || Math.abs(n.max - cu.max) > 1e-9)
      throw new Error(`y769 sync broken on ${b.key}`);
  }
}
console.log(`assert G OK: bt rows y>=${H_END} byte-identical to cp08fix; y769 formula-level curtain sync preserved`);

// ---- snapshot (first run only) ----
if (!existsSync(new URL("snapshot-pre.json", HERE))) {
  writeFileSync(new URL("snapshot-pre.json", HERE), JSON.stringify({
    sets: kfs.map((s) => ({
      sig: sigOf(s),
      keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
    })),
    rigControls: rcs.map((r) => ({
      id: r.rigControlId, parentId: r.parentId ?? null,
      jsonNoParent: JSON.stringify({ ...r, parentId: null })
    }))
  }));
  console.log("snapshot-pre.json written (pre-cp09 committed state, rev 264)");
}

// ---- design values + batch ----
const design = [];
const batch = [];
for (const el of ELEMENTS) {
  batch.push({
    file: `warp-${el.key}.json`,
    operationId: `op_cp09_warp_${el.key}`,
    operationType: "createWarpDeformer",
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
    },
    gitMessage: `[cp09] warp ${el.displayName} (${el.cols}x${el.rows}) wrapping ${el.wrap}`
  });
}
for (const el of ELEMENTS) {
  const patches = {
    min: { propertyPath: "controlPointOffsets", value: grid(el, el.f, -1) },
    default: { propertyPath: "controlPointOffsets", value: grid(el, el.f, 0) },
    max: { propertyPath: "controlPointOffsets", value: grid(el, el.f, +1) }
  };
  design.push({
    sig: `rigControl:rig_facey_${el.key}:param_face_angle_y`,
    keys: [
      { value: -30, statePatch: patches.min.value },
      { value: 0, statePatch: patches.default.value },
      { value: 30, statePatch: patches.max.value }
    ]
  });
  batch.push({
    file: `key-${el.key}.json`,
    operationId: `op_cp09_key_${el.key}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: `rig_facey_${el.key}` },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_y",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: patches
    },
    gitMessage: `[cp09] key ${el.displayName} face_angle_y (createEndsCenter)`
  });
}
for (const b of BT) {
  const gMin = grid({ ...b, f: btNew }, btNew, -1), gMax = grid({ ...b, f: btNew }, btNew, +1);
  design.push({
    sig: `rigControl:${b.rig}:param_face_angle_y`,
    keys: [{ value: -30, statePatch: gMin }, { value: 30, statePatch: gMax }]
  });
  for (const [label, keyValue, g] of [["min", -30, gMin], ["max", 30, gMax]]) {
    batch.push({
      file: `btkey-${b.key}-${label}.json`,
      operationId: `op_cp09_btkey_${b.key}_${label}`,
      operationType: "editKeyformKey",
      payload: {
        target: { kind: "rigControl", id: b.rig },
        targetProperty: "controlPointOffsets",
        parameterId: "param_face_angle_y",
        interpolation: "linear-1d-v1",
        action: "updateCurrent",
        keyValue,
        statePatch: { propertyPath: "controlPointOffsets", value: g }
      },
      gitMessage: `[cp09] key ${b.key} face_angle_y ${label}: top = hat Y field via H ramp (provisional zero-pinch recovered) (updateCurrent)`
    });
  }
}
writeFileSync(new URL("design-values.json", HERE), JSON.stringify(design));
writeFileSync(new URL("batch-rig.json", HERE), JSON.stringify(batch, null, 2));
console.log(`batch-rig.json: ${batch.length} ops`);

// =============================== PROBES ======================================
console.log("\n== crown vertical section @u=0 (top-face appearance): dy_min / dy_max ==");
for (const y of [92, 123, 151, 180, 235, 282, 320, 392]) {
  const f = hatY(CX, y);
  console.log(` y=${String(y).padStart(3)} v=${String(Math.round(y - CY)).padStart(4)}  min ${round2(f.min).toString().padStart(7)}  max ${round2(f.max).toString().padStart(7)}`);
}
console.log("== brim arc (ellipse opens on min): scallop center vs flap tips ==");
for (const [label, x, y] of [["center u0 y282", 1001, 282], ["flapL u-181 y352", 820, 352], ["flapR u+179 y352", 1180, 352]]) {
  const f = hatY(x, y);
  console.log(` ${label.padEnd(18)} min ${round2(f.min).toString().padStart(7)}  max ${round2(f.max).toString().padStart(7)}`);
}
console.log("== ear ridge: tip vs base (squash reads the tilt) ==");
for (const [label, x] of [["earL ridge", CX - 130], ["earR ridge", CX + 145]]) {
  for (const y of [95, 123, 151]) {
    const f = hatY(x, y);
    console.log(` ${label} y=${y}  min ${round2(f.min).toString().padStart(7)}  max ${round2(f.max).toString().padStart(7)}  sqW ${sqWeight(x - CX, y).toFixed(2)}`);
  }
}
console.log("== edge vs interior (Y anchoring; material flows past the rim) ==");
for (const y of [180, 235, 290]) {
  const cells = [];
  for (const u of [-200, -160, -100, 0, 100, 160, 200]) {
    const f = hatY(CX + u, y);
    cells.push(`u${u}:${round2(f.min)}`);
  }
  console.log(` y=${y} min: ${cells.join("  ")}`);
}
console.log("== C7-Y adjudication: hat slip vs committed bangs Y field (hat - fh) ==");
console.log("   (min: + = hat leads DOWN = coverage grows, occlusion-safe)");
for (const [x, y] of [[1001, 282], [901, 301], [820, 351], [1180, 352], [1100, 304]]) {
  const f = hatY(x, y), fh = frontY(x, y);
  console.log(` scallop(${x},${y})  slip min ${(f.min - fh.min).toFixed(2)}  max ${(f.max - fh.max).toFixed(2)}`);
}
console.log("== EARS: near-motionless pivot (all material nodes move, none dead) ==");
for (const el of ELEMENTS.slice(1)) {
  const rows = [0, 1, 2, 3, 4].map((r) => {
    const [x, y] = nodeXY(el, r, 0);
    const f = earsY(x, y);
    return `y${Math.round(y)}: ${round2(f.min)}/${round2(f.max)}`;
  });
  console.log(` ${el.key}: ${rows.join("  ")}`);
}
{
  const face459 = pair(0, 240 * (1 - (124 / 320) ** 2)); // FaceY face shell at ear u for contrast
  console.log(` (contrast: face shell at ear height/column moves ${round2(face459.min)}/${round2(face459.max)} — the ear is the pivot, 5-10x less mobile)`);
}
console.log("\n== BT full per-row new-vs-old diff (the 14th-gen lesson: assert, don't assume) ==");
for (const b of BT) {
  console.log(` ${b.key}:`);
  for (let r = 0; r < b.rows; r++) {
    const cells = [];
    for (let c = 0; c < b.cols; c++) {
      const [x, y] = nodeXY(b, r, c);
      const o = btOld(x, y), n = btNew(x, y);
      cells.push(`c${c}:${(n.min - o.min).toFixed(1)}/${(n.max - o.max).toFixed(1)}`);
    }
    const [, y] = nodeXY(b, r, 0);
    console.log(`  r${r} y=${y.toFixed(1)} H=${H_BT(y).toFixed(2)} R=${R_BT(y).toFixed(2)}  ${cells.join(" ")}`);
  }
}
console.log("== BT seam with the hat at the drawn top edges (formula agreement) ==");
for (const [b, yEdge] of [[BT[0], 257], [BT[1], 252]]) {
  for (const c of [0, 2, 4]) {
    const x = b.domain.x + (b.domain.width * c) / (b.cols - 1);
    const n = btNew(x, yEdge), h = hatY(x, yEdge);
    console.log(` ${b.key} @(${Math.round(x)},${yEdge})  bt ${round2(n.min)}/${round2(n.max)}  hat ${round2(h.min)}/${round2(h.max)}`);
  }
}
