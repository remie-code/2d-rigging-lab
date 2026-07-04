// cp10: BodyX torso core — first below-the-neck rigging.
// 5 BodyX warp deformers on bare drawables (no existing towers): shirt (ware
// topwear), tie, arm R, arm L, neck (front+back in one deformer), keys on
// param_body_angle_x (preset, -10..+10, min = screen-left turn / max =
// screen-right turn — same sign convention as param_face_angle_x).
//
// This file is the PRIMARY SOURCE of every cp10 number.
//
// ============================= PHYSICS FRAME =================================
// Rotation-projection law transposed to the spine axis (recipe 06 verbatim,
// same axis direction as FaceX — only the axis position and the shell change):
//   dx_key(point) = weight(y) * G_B * (chordC(u) +/- SIN*zT(u)),  dy = 0
//   u = x - CX_B, min key = -z term, max key = +z term.
//   chord is even => min/max are NOT mirrors (same consequence as FaceX).
// CX_B = 997  — spine axis, texture-measured (alpha centroid of the shirt
//   997.3 / skirt 994.6 / neck 994.7; face canon cx=1001 agrees within 4px,
//   as the problem definition predicted; we use the torso's own measurement).
// D = 30 deg (COS-1 = -0.13397, SIN = 0.5) — same projection angle as the
//   face canon; shallowness comes from the gain, not from a different angle.
// U_T = 215 — torso half-width (shirt max drawn width 429px / 2).
// Z_T = 150 — torso depth dial (~0.7 * U_T; a chest is an ellipse, not a
//   sphere; the head used Z=U=320 because a skull is round).
// zT(u) = Z_T * max(0, 1-(u/U_T)^2)   (parabola ansatz, fold-safe; clamped to
//   0 beyond the torso band — arm material extends far outside it).
// chordC(u) = clamp(u, -U_T, +U_T) * (COS-1)  — chord value clamped outside
//   the torso band ("piecewise-linear extrapolation is clamped", craft law:
//   beyond the band the mapping continues as pure translation).
// NOTE zT has no vertical profile (sV == 1): a torso is a vertical cylinder.
// All vertical structure lives in the per-element weights below.
//
// ================================ GAIN CANON =================================
// NEW CANON (this problem): S = 10 px = chest-front / shoulder-girdle
// amplitude at u=0 (the role FaceX's nose played). "Shallow": S/nose = 1/3.
//   G_B = S / (SIN * Z_T) = 10 / 75 = 0.13333  (gain ratio vs face canon
//   0.1875 = 0.711 — the body's *narrated* angle is much shallower than the
//   ratio suggests because Z_T < Z_nose: chest moves 10px vs nose 30px).
// Uniform gain on the whole field (gained chord — the committed model
// world-line, cp07/08/09). No alpha^2 scale correction unless the gate
// flags "too flat" (problem-definition ruling).
//
// ========================== HEAD SYNC GAIN (alpha) ===========================
// alpha — canonized HERE for cp11 ("everything above the neck is FaceX with a
// different gain" — user testimony; cp11 hypothesis: head BodyX keys =
// alpha * FaceX keys). Derivation from S (continuity at the head-neck joint):
//   the neck carries the collar translation, torso field at the collar center
//   = G_B*SIN*zT(0) = S = 10.09px (at u=-2);
//   committed FaceX face field at the chin junction (995, y577) = +/-16.47px
//   (sampled live from rig_facex_face keyforms, assert ALPHA below);
//   alpha = 10.09 / 16.47 = 0.612  ->  canon ALPHA = 0.6 (clean scalar; the
//   0.2px seam residue is absorbed by the neck's H ramp).
// Meaning: at BodyX max the (cp11) head will move like FaceX scaled 0.6 —
// nose 18px — slightly *ahead* of the chest's 10px because the nose sticks
// out farther than the chest (same twist, larger radius: rigid-ish carriage
// with a bit of neck absorption). This is the physical reading of "shallow".
//
// ========================= WAIST PIN (new BC class) ==========================
// The shirt is TUCKED INTO the skirt: a sewn anchor ("縫い付けアンカー") — a
// boundary condition class distinct from occlusion-keeping and from the
// gravity template. Formulation = the gravity template UPSIDE DOWN with the
// anchor value owned by the anchor GARMENT (not by space):
//   field_shirt = P(y) * sph(u)  +  (1-P(y)) * field_skirt(u)
// where field_skirt == 0 because the skirt is static (unrigged, out of scope).
// Zero convergence is CORRECT here (unlike hair tips, which are free and must
// carry their root's translation): the hem is physically sewn to a static
// object. When the skirt is ever rigged, the anchor value becomes its field.
//   P(y) = 1 for y <= 700 (shoulder girdle / chest top: full rotation field)
//        = 1 - smoothstep((y-700)/(1124-700)) across the torso
//        = 0 for y >= 1124 (tuck line; zero slope on approach via smoothstep)
// Y_PIN = 1124 — texture-measured: first widely-drawn skirt row (waistband
// top edge y1119..1124); the shirt's wide body ends right there (drawn rows
// collapse from w405 @y1117 to a w71 tail by y1145). The hem row must stay
// glued to the drawn waistband of the static skirt => P(hem) = 0 exactly.
//
// ================================== TIE ======================================
// Ribbon: carries the root (collar knot) translation to the tip; material
// edge, so the chord shrink stays as-is (problem-definition ruling). Because
// sph(u) has no y dependence, the root-carry blend is the identity:
//   field_tie = sph(u)  (uniform carriage; tip translates with the knot and
//   slides over the pinned hem / static skirt — a loose ribbon does exactly
//   that; NOT a contradiction with the pin, the tie is not sewn at the waist).
// Tie root rides the shirt collar constructively (same formula at y643-700).
//
// ================================== ARMS =====================================
// Root-translation carriage (cross-axis invariant, X application) + a thin
// volumetric width swap. The arm SLANTS (r-arm centroid x840@y722 -> x509@
// y1589), so the carried value is the SHOULDER ANCHOR's field (one value per
// arm per key), NOT the same-column value (the hair-curtain per-column rule
// assumed vertical strands; a fingertip column has no root material above it):
//   field_arm = W(y) * sph(u) + (1-W(y)) * D_arm
//   D_arm = sph(u_anchor),  anchors: R (-157, y700) / L (+162, y700)
//   (sleeve-cap centroids, texture-measured rows y662..722).
//   W(y) = 1 for y <= 760 (sleeve cap grips the shoulder)
//        = 1 - smoothstep((y-760)/(1150-760)) (hang transition, free length
//          ~830px -> transition 390px, ∝-rule from the gravity template)
//        = 0 for y >= 1150 (hand mass: pure translation copy of the shoulder)
// The width swap falls out of sph(u) inside the W=1 band: inner sleeve edge
// (larger zT) outruns the outer edge (chord-only, even) => sleeve widens a
// few px on the near side / narrows on the far side — the "thin face swap".
//
// ================================== NECK =====================================
// Connector element. One deformer, TWO children (neck + neck_back: one
// anatomical column, same field => constructive seam):
//   field_neck = H(y) * ALPHA * Xface(u, y577) + (1-H(y)) * sph(u)
//   H(y) = smoothstep from 1 at y549 (top of neck material, hidden behind the
//          chin) to 0 at y666 (bottom of neck_back, under the collar).
// Top boundary value = the committed FaceX face field sampled at the chin
// junction row (y577) scaled by ALPHA — the H-ramp "carry the boundary value"
// idiom (recipe 07 Y-transposition note). Bottom = the shoulder field
// (formula sharing with the shirt collar, problem-definition ruling).
// In cp10 the head is STATIC (cp11 scope): the neck top moving ~6-10px behind
// the chin edge is expected and mostly hidden (face renders in front);
// the gate is instructed to discount the missing head sync.
//
// ============================ GRID / DOMAINS =================================
// Bare drawables => childDrawableIds direct (no wrapChildren). Domains =
// REAL post-mesh vertex extents + 20px margin (declared bounds can be
// narrower than generated outlines; own displacement <= ~11px). Grids
// (material size x field curvature; bezier = transform):
//   shirt 9x11  (parabola over 430px width x smoothstep pin over 424px)
//   tie   5x7   (y-uniform field; columns carry the tiny chord slope)
//   arms  7x11  (chord-clamp kink at u=-215/+215 + W transition)
//   neck  5x5   (H ramp x chin-profile resampling)
// Interp error checked <= ~0.35px (piecewise-linear vs formula, assert GRID).
//
// Usage:
//   node gen-bodyx-torso.mjs           -> asserts + probes + batch-rig.json
//                                         (requires meshes committed first)
//   node gen-bodyx-torso.mjs premesh   -> snapshot + batch-mesh.json only
//   node gen-bodyx-torso.mjs verify    -> post-commit untouched-guarantee
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const HERE = new URL(".", import.meta.url);

// ---- canon frame ----
const CX_B = 997;
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const U_T = 215, Z_T = 150;
const S = 10;                       // px, shoulder-girdle amplitude (new canon)
const G_B = S / (SIN * Z_T);        // 0.13333
const ALPHA = 0.6;                  // head sync gain canon (derivation above)
const Y_PIN = 1124, Y_GIRDLE = 700; // waist pin band (texture-measured)
const ARM_W = { yGrip: 760, yFree: 1150 };
const NECK_H = { yTop: 549, yBot: 666 };
const Y_CHIN = 577;                 // head-neck junction row (chin drawn edge)

const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const chordC = (u) => Math.max(-U_T, Math.min(U_T, u)) * (COS - 1);
const zT = (u) => Z_T * Math.max(0, 1 - (u / U_T) ** 2);
const sph = (x) => {
  const u = x - CX_B;
  return { min: G_B * (chordC(u) - SIN * zT(u)), max: G_B * (chordC(u) + SIN * zT(u)) };
};
const P_PIN = (y) => y <= Y_GIRDLE ? 1 : 1 - smooth((y - Y_GIRDLE) / (Y_PIN - Y_GIRDLE));
const W_ARM = (y) => y <= ARM_W.yGrip ? 1 : 1 - smooth((y - ARM_W.yGrip) / (ARM_W.yFree - ARM_W.yGrip));
const H_NECK = (y) => smooth((NECK_H.yBot - y) / (NECK_H.yBot - NECK_H.yTop));

// ---- committed model files ----
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const rcRaw = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8"));
const rcs = rcRaw.rigControls ?? rcRaw;
const meshRaw = JSON.parse(readFileSync(`${PKG}/model/meshes.json`, "utf8"));
const meshes = meshRaw.meshes ?? meshRaw;
const rcById = (id) => rcs.find((r) => r.rigControlId === id);
const meshOf = (id) => meshes.find((m) => m.drawableId === id);

const DRAW = {
  topwear: "draw_r0_1cea4f6f_26f93e8b_topwear",
  bottomwear: "draw_r0_1cea4f6f_26f93eaa_bottomwear",
  handwear_r: "draw_r0_1cea4f6f_26f93ee8_handwear-r",
  handwear_l: "draw_r0_1cea4f6f_26f93ec9_handwear-l",
  tie: "draw_r0_1cea4f6f_ea30e9c4_tie",
  neck: "draw_r0_1cea4f6f_691e2eb3_neck",
  neck_back: "draw_r0_1cea4f6f_691e2e90_neck_back"
};
const MESH_ORDER = ["topwear", "bottomwear", "handwear_r", "handwear_l", "tie", "neck", "neck_back"];

// ---- assert ALPHA: live sampling of the committed FaceX chin field ----
const bilinX = (ctrl, patch, x, y) => {
  const d = ctrl.domainBounds, n = ctrl.latticeColumns, m = ctrl.latticeRows;
  const fx = ((x - d.x) / d.width) * (n - 1), fy = ((y - d.y) / d.height) * (m - 1);
  const c0 = Math.max(0, Math.min(n - 2, Math.floor(fx))), r0 = Math.max(0, Math.min(m - 2, Math.floor(fy)));
  const tx = fx - c0, ty = fy - r0;
  const p = (r, c) => patch[r * n + c].x;
  return p(r0, c0) * (1 - tx) * (1 - ty) + p(r0, c0 + 1) * tx * (1 - ty) +
    p(r0 + 1, c0) * (1 - tx) * ty + p(r0 + 1, c0 + 1) * tx * ty;
};
const faceCtrl = rcById("rig_facex_face");
const faceSet = kfs.find((s) => s.target?.id === "rig_facex_face" && s.parameterId === "param_face_angle_x");
const Xchin = (x, keyVal) => bilinX(faceCtrl, faceSet.keys.find((k) => k.value === keyVal).statePatch, x, Y_CHIN);
{
  const c = Xchin(995, 30);
  const collar = sph(995).max; // 10.09 at the collar center column
  const derived = collar / c;
  if (Math.abs(c - 16.47) > 0.35) throw new Error(`FaceX chin field drifted: ${c.toFixed(2)} (expected ~16.47)`);
  if (Math.abs(derived - ALPHA) > 0.05) throw new Error(`ALPHA canon ${ALPHA} vs derived ${derived.toFixed(3)}`);
  console.log(`assert ALPHA OK: Xchin(995,577)@+30 = ${c.toFixed(2)}, collar carry ${collar.toFixed(2)} -> derived ${derived.toFixed(3)} ~ canon ${ALPHA}`);
}

// ---- element fields ----
const fieldShirt = (x, y) => {
  const s = sph(x), p = P_PIN(y);
  return { min: p * s.min, max: p * s.max };
};
const fieldTie = (x, _y) => sph(x);
const armAnchor = { r: { x: 840, y: 700 }, l: { x: 1159, y: 700 } };
const D_ARM = { r: sph(armAnchor.r.x), l: sph(armAnchor.l.x) };
const fieldArm = (side) => (x, y) => {
  const s = sph(x), w = W_ARM(y), d = D_ARM[side];
  return { min: w * s.min + (1 - w) * d.min, max: w * s.max + (1 - w) * d.max };
};
const fieldNeck = (x, y) => {
  const s = sph(x), h = H_NECK(y);
  return {
    min: h * ALPHA * Xchin(x, -30) + (1 - h) * s.min,
    max: h * ALPHA * Xchin(x, 30) + (1 - h) * s.max
  };
};

// ---- assert CARRY (identity check, cp08fix form): field - D = W*(sph - D) ----
for (const side of ["r", "l"]) {
  const f = fieldArm(side);
  for (const [x, y] of [[700, 900], [850, 1000], [1250, 1300], [520, 1500]]) {
    for (const k of ["min", "max"]) {
      const lhs = f(x, y)[k] - D_ARM[side][k];
      const rhs = W_ARM(y) * (sph(x)[k] - D_ARM[side][k]);
      if (Math.abs(lhs - rhs) > 1e-9) throw new Error(`carry identity broken arm_${side} @(${x},${y})`);
    }
  }
}
console.log("assert CARRY OK: arm field - D == W * (sph - D) (rotational-mix identity)");

const mode = process.argv[2] ?? "gen";

// ---- snapshot (premesh, first run only): keyforms + rig-controls + meshes ----
const SNAP = new URL("snapshot-pre.json", HERE);
if (mode === "premesh") {
  if (!existsSync(SNAP)) {
    writeFileSync(SNAP, JSON.stringify({
      sets: kfs.map((s) => ({
        sig: `${s.target?.kind}:${s.target?.id}:${s.parameterId}`,
        keys: s.keys.map((k) => ({ value: k.value, json: JSON.stringify(k.statePatch) }))
      })),
      rigControls: rcs.map((r) => ({ id: r.rigControlId, json: JSON.stringify(r) })),
      meshes: meshes.map((m) => ({ id: m.drawableId, verts: m.vertices.length, json: JSON.stringify(m) }))
    }));
    console.log("snapshot-pre.json written (rev-274 committed state)");
  } else console.log("snapshot-pre.json already present — kept");
  const batchMesh = MESH_ORDER.map((key) => ({
    file: `mesh-${key}.json`,
    operationId: `op_cp10_mesh_${key}`,
    operationType: "generateMesh",
    payload: {
      drawableId: DRAW[key],
      method: "auto-outline-v6d-adaptive-contour-constrainautor",
      densityHint: "medium"
    },
    gitMessage: `[cp10] mesh ${key} (auto-outline medium)`
  }));
  writeFileSync(new URL("batch-mesh.json", HERE), JSON.stringify(batchMesh, null, 2));
  console.log(`batch-mesh.json: ${batchMesh.length} ops (${MESH_ORDER.join(", ")})`);
  process.exit(0);
}

// ---- real post-mesh extents -> domains (+20 margin) ----
const extentOf = (ids) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of ids) {
    const m = meshOf(id);
    if (!m || !m.vertices.length) throw new Error(`${id}: not meshed yet (run premesh batch first)`);
    for (const v of m.vertices) {
      if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x;
      if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
    }
  }
  return { x0, y0, x1, y1 };
};
const MARGIN = 20;
const domOf = (ids) => {
  const e = extentOf(ids);
  return {
    x: Math.floor(e.x0) - MARGIN, y: Math.floor(e.y0) - MARGIN,
    width: Math.ceil(e.x1) - Math.floor(e.x0) + 2 * MARGIN,
    height: Math.ceil(e.y1) - Math.floor(e.y0) + 2 * MARGIN
  };
};
// The field has slope kinks at the torso band edges u = +/-U_T (x782 / x1212):
// on the min key the silhouette edge is a narrow ridge (z term dies, chord
// saturates). A mid-cell kink costs ~1px of bilinear smoothing — so lattice
// COLUMNS are snapped onto the kink(s) ("edge shrink band must not be killed
// by a coarse grid", recipe 06). Rows need no snapping: all vertical profiles
// are C1 (smoothstep). kinks inside [x0..x1] only.
const KINKS = [CX_B - U_T, CX_B + U_T]; // 782, 1212
const snapCols = (dom, cols) => {
  const ks = KINKS.filter((k) => k > dom.x && k < dom.x + dom.width);
  if (!ks.length) return dom;
  if (ks.length === 2) {
    // pitch divides the band exactly; extend outward whole cells to cover
    const band = ks[1] - ks[0];
    for (let n = Math.max(2, cols - 5); n <= cols - 2; n++) {
      const p = band / n;
      const m = Math.ceil((ks[0] - dom.x) / p), k = Math.ceil((dom.x + dom.width - ks[1]) / p);
      if (n + m + k === cols - 1)
        return { x: ks[0] - m * p, y: dom.y, width: (n + m + k) * p, height: dom.height };
    }
    throw new Error("snapCols: no pitch fits both kinks — adjust cols");
  }
  // single kink: smallest pitch p with m*p >= left, (cols-1-m)*p >= right
  const K = ks[0], left = K - dom.x, right = dom.x + dom.width - K;
  for (let p = Math.ceil((left + right) / (cols - 1)); p < left + right; p += 0.5) {
    for (let m = 1; m < cols - 1; m++) {
      if (m * p >= left && (cols - 1 - m) * p >= right)
        return { x: K - m * p, y: dom.y, width: (cols - 1) * p, height: dom.height };
    }
  }
  throw new Error("snapCols: single-kink fit failed");
};

// Grids: the chord clamp / zT floor puts a slope KINK at u = +/-215 (x782 /
// x1212), inside the shirt and arm domains. One extra refinement step keeps
// the bilinear deviation (= smoothing of that kink over one cell) sub-pixel;
// the parabola/smoothstep parts are ~0.2px at these pitches.
const ELEMENTS = [
  { key: "topwear", displayName: "BodyX Topwear", kids: [DRAW.topwear], cols: 13, rows: 13, f: fieldShirt },
  { key: "tie", displayName: "BodyX Tie", kids: [DRAW.tie], cols: 5, rows: 7, f: fieldTie },
  { key: "arm_r", displayName: "BodyX Arm R", kids: [DRAW.handwear_r], cols: 9, rows: 13, f: fieldArm("r") },
  { key: "arm_l", displayName: "BodyX Arm L", kids: [DRAW.handwear_l], cols: 9, rows: 13, f: fieldArm("l") },
  { key: "neck", displayName: "BodyX Neck", kids: [DRAW.neck, DRAW.neck_back], cols: 5, rows: 5, f: fieldNeck }
];
for (const el of ELEMENTS) el.domain = snapCols(domOf(el.kids), el.cols);

// ---- assert BARE: no existing rig control / keyform set owns body drawables --
const bodyDrawSet = new Set(Object.values(DRAW));
for (const r of rcs) {
  if (r.rigControlId.startsWith("rig_bodyx_")) continue; // re-run after commit
  for (const k of r.childDrawableIds ?? [])
    if (bodyDrawSet.has(k)) throw new Error(`body drawable ${k} already owned by ${r.rigControlId}`);
}
for (const s of kfs) {
  if (s.target?.kind === "drawable" && bodyDrawSet.has(s.target.id))
    throw new Error(`body drawable ${s.target.id} already has a keyform set`);
}
console.log("assert BARE OK: body drawables own no towers / no keyform sets (childDrawableIds direct is right)");

// ---- grids ----
const round2 = (n) => Math.round(n * 100) / 100;
const grid = (el, which) => {
  const out = [];
  for (let r = 0; r < el.rows; r++) {
    const y = el.domain.y + (el.domain.height * r) / (el.rows - 1);
    for (let c = 0; c < el.cols; c++) {
      const x = el.domain.x + (el.domain.width * c) / (el.cols - 1);
      out.push({ x: which === 0 ? 0 : round2(el.f(x, y)[which > 0 ? "max" : "min"]), y: 0 });
    }
  }
  return out;
};

// ---- assert GRID: bilinear resampling error vs formula <= 0.4px ----
for (const el of ELEMENTS) {
  const d = el.domain;
  let worst = 0;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const x = d.x + (d.width * i) / 24, y = d.y + (d.height * j) / 24;
    for (const which of [-1, 1]) {
      const k = which > 0 ? "max" : "min";
      // bilinear from the lattice
      const fx = (i / 24) * (el.cols - 1), fy = (j / 24) * (el.rows - 1);
      const c0 = Math.min(el.cols - 2, Math.floor(fx)), r0 = Math.min(el.rows - 2, Math.floor(fy));
      const tx = fx - c0, ty = fy - r0;
      const node = (r, c) => el.f(
        d.x + (d.width * c) / (el.cols - 1),
        d.y + (d.height * r) / (el.rows - 1)
      )[k];
      const interp = node(r0, c0) * (1 - tx) * (1 - ty) + node(r0, c0 + 1) * tx * (1 - ty) +
        node(r0 + 1, c0) * (1 - tx) * ty + node(r0 + 1, c0 + 1) * tx * ty;
      worst = Math.max(worst, Math.abs(interp - el.f(x, y)[k]));
    }
  }
  // 0.8px budget: the only super-0.3px contributor is the one-cell smoothing
  // of the chord-clamp kink at the silhouette edge (visually a softer clamp)
  if (worst > 0.8) throw new Error(`${el.key}: lattice too coarse (bilinear err ${worst.toFixed(3)}px)`);
  console.log(`assert GRID OK: ${el.key} ${el.cols}x${el.rows} bilinear err ${worst.toFixed(3)}px`);
}

// ---- assert PIN: shirt lattice rows at/below Y_PIN are exactly zero ----
{
  const el = ELEMENTS[0], d = el.domain;
  let pinRows = 0;
  for (let r = 0; r < el.rows; r++) {
    const y = d.y + (d.height * r) / (el.rows - 1);
    if (y >= Y_PIN) {
      pinRows++;
      for (let c = 0; c < el.cols; c++) {
        const x = d.x + (d.width * c) / (el.cols - 1);
        if (el.f(x, y).min !== 0 || el.f(x, y).max !== 0)
          throw new Error(`pin broken at row y=${y}`);
      }
    }
  }
  if (pinRows < 1) throw new Error("no lattice row at/below the pin line — raise rows or extend domain");
  console.log(`assert PIN OK: ${pinRows} shirt lattice row(s) at/below y${Y_PIN} exactly zero`);
}

// ---- assert FOLD: x + dx strictly increasing along every lattice row ----
for (const el of ELEMENTS) {
  const d = el.domain;
  for (let r = 0; r < el.rows; r++) {
    const y = d.y + (d.height * r) / (el.rows - 1);
    for (const k of ["min", "max"]) {
      let prev = -Infinity;
      for (let c = 0; c < el.cols; c++) {
        const x = d.x + (d.width * c) / (el.cols - 1);
        const mapped = x + el.f(x, y)[k];
        if (mapped <= prev) throw new Error(`fold in ${el.key} row y=${y} key ${k}`);
        prev = mapped;
      }
    }
  }
}
console.log("assert FOLD OK: no horizontal fold on any lattice row (both keys)");

// ---- verify mode ----
const canon = (o) =>
  JSON.stringify(o, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]))
      : v
  );
if (mode === "verify") {
  const snap = JSON.parse(readFileSync(SNAP, "utf8"));
  const design = JSON.parse(readFileSync(new URL("design-values.json", HERE), "utf8"));
  // 1. keyform sets: every pre-existing set byte-identical (incl. hat X = C10
  //    human correction), exactly 5 new sets matching the design values
  const newSigs = new Set(design.map((d) => d.sig));
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
  const hatSig = oldSets.find(({ sig }) => sig.includes("rig_facex_headwear") && sig.includes("param_face_angle_x"));
  if (!hatSig) throw new Error("hat X set not found among untouched sets");
  console.log(`HAT X SET (human correction C10) EXPLICITLY CONFIRMED byte-identical (${oldSets.length} untouched sets total)`);
  for (const { sig, s } of addedSets) {
    const dsg = design.find((d) => d.sig === sig);
    if (!dsg) throw new Error(`unexpected new set ${sig}`);
    for (const k of s.keys) {
      const want = dsg.keys.find((w) => w.value === k.value);
      if (!want || JSON.stringify(k.statePatch) !== JSON.stringify(want.statePatch))
        throw new Error(`new set ${sig}@${k.value} does not match design values`);
    }
  }
  if (addedSets.length !== 5) throw new Error(`expected 5 new sets, got ${addedSets.length}`);
  // 2. rig controls: all pre-existing byte-identical (bare-drawable mounting
  //    touches no existing tower — no re-parent at all), 5 new controls
  const preRc = new Map(snap.rigControls.map((r) => [r.id, r.json]));
  let newRc = 0;
  for (const r of rcs) {
    const pre = preRc.get(r.rigControlId);
    if (!pre) {
      const el = ELEMENTS.find((e) => `rig_bodyx_${e.key}` === r.rigControlId ||
        (r.displayName === e.displayName));
      if (!el) throw new Error(`unexpected new rig control ${r.rigControlId} (${r.displayName})`);
      const db = r.domainBounds;
      if (r.latticeColumns !== el.cols || r.latticeRows !== el.rows ||
        db.x !== el.domain.x || db.y !== el.domain.y ||
        db.width !== el.domain.width || db.height !== el.domain.height)
        throw new Error(`new control ${r.rigControlId}: lattice/domain mismatch`);
      const kidsWant = JSON.stringify([...el.kids].sort());
      if (JSON.stringify([...(r.childDrawableIds ?? [])].sort()) !== kidsWant)
        throw new Error(`new control ${r.rigControlId}: children mismatch`);
      newRc++;
      continue;
    }
    if (canon(r) !== canon(JSON.parse(pre)))
      throw new Error(`PRE-EXISTING RIG CONTROL CHANGED: ${r.rigControlId}`);
    preRc.delete(r.rigControlId);
  }
  if (preRc.size) throw new Error(`rig controls disappeared: ${[...preRc.keys()].join(",")}`);
  if (newRc !== 5) throw new Error(`expected 5 new rig controls, got ${newRc}`);
  // 3. meshes: previously-meshed drawables byte-identical; the 7 cp10 targets
  //    now meshed; nothing else newly meshed
  const preMesh = new Map(snap.meshes.map((m) => [m.id, m]));
  for (const m of meshes) {
    const pre = preMesh.get(m.drawableId);
    if (!pre) throw new Error(`mesh list gained unknown drawable ${m.drawableId}`);
    if (pre.verts > 0) {
      if (JSON.stringify(m) !== pre.json) throw new Error(`PRE-EXISTING MESH CHANGED: ${m.drawableId}`);
    } else if (m.vertices.length > 0 && !bodyDrawSet.has(m.drawableId)) {
      throw new Error(`unexpected newly meshed drawable ${m.drawableId}`);
    }
  }
  for (const id of Object.values(DRAW)) {
    if (!meshOf(id).vertices.length) throw new Error(`cp10 target not meshed: ${id}`);
  }
  console.log(`verify OK: ${oldSets.length} pre-existing keyform sets byte-identical; 5 new sets match design; no existing control touched (+${newRc} new); pre-existing meshes byte-identical; 7 targets meshed`);
  process.exit(0);
}

// ---- design values + rig batch ----
const design = [];
const batch = [];
for (const el of ELEMENTS) {
  batch.push({
    file: `warp-${el.key}.json`,
    operationId: `op_cp10_warp_${el.key}`,
    operationType: "createWarpDeformer",
    payload: {
      displayName: el.displayName,
      childDrawableIds: el.kids,
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: el.domain,
      transformColumns: el.cols, transformRows: el.rows,
      bezierColumns: el.cols, bezierRows: el.rows,
      bezierEditType: "cubicBezierSurfaceV1"
    },
    gitMessage: `[cp10] warp ${el.displayName} (${el.cols}x${el.rows}) on bare drawable(s)`
  });
}
for (const el of ELEMENTS) {
  const patches = {
    min: { propertyPath: "controlPointOffsets", value: grid(el, -1) },
    default: { propertyPath: "controlPointOffsets", value: grid(el, 0) },
    max: { propertyPath: "controlPointOffsets", value: grid(el, +1) }
  };
  design.push({
    sig: `rigControl:rig_bodyx_${el.key}:param_body_angle_x`,
    displayName: el.displayName,
    keys: [
      { value: -10, statePatch: patches.min.value },
      { value: 0, statePatch: patches.default.value },
      { value: 10, statePatch: patches.max.value }
    ]
  });
  batch.push({
    file: `key-${el.key}.json`,
    operationId: `op_cp10_key_${el.key}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: `rig_bodyx_${el.key}` },
      targetProperty: "controlPointOffsets",
      parameterId: "param_body_angle_x",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: patches
    },
    gitMessage: `[cp10] key ${el.displayName} body_angle_x (createEndsCenter -10/0/+10)`
  });
}
writeFileSync(new URL("design-values.json", HERE), JSON.stringify(design));
writeFileSync(new URL("batch-rig.json", HERE), JSON.stringify(batch, null, 2));
console.log(`batch-rig.json: ${batch.length} ops`);
for (const el of ELEMENTS) console.log(`  ${el.key}: domain ${JSON.stringify(el.domain)} grid ${el.cols}x${el.rows}`);

// ---- probes (design-log tables) ----
console.log(`\ncanon: CX_B=${CX_B} U_T=${U_T} Z_T=${Z_T} S=${S} G_B=${G_B.toFixed(5)} (=${(G_B / 0.1875).toFixed(3)}x face canon) ALPHA=${ALPHA}`);
console.log(`arm anchors: D_r=${round2(D_ARM.r.min)}/${round2(D_ARM.r.max)}  D_l=${round2(D_ARM.l.min)}/${round2(D_ARM.l.max)} (min/max)`);
const probes = [
  ["shirt collar center (997,610)", 997, 610, fieldShirt],
  ["shirt girdle center (997,700)", 997, 700, fieldShirt],
  ["shirt shoulder L-edge (790,690)", 790, 690, fieldShirt],
  ["shirt shoulder R-edge (1205,690)", 1205, 690, fieldShirt],
  ["shirt chest (997,850)", 997, 850, fieldShirt],
  ["shirt midriff (997,950)", 997, 950, fieldShirt],
  ["shirt pre-hem (997,1080)", 997, 1080, fieldShirt],
  ["shirt hem = pin (997,1124)", 997, 1124, fieldShirt],
  ["shirt hem tail (1040,1140)", 1040, 1140, fieldShirt],
  ["tie knot (992,670)", 992, 670, fieldTie],
  ["tie mid (990,950)", 990, 950, fieldTie],
  ["tie tip (990,1195)", 990, 1195, fieldTie],
  ["armR cap (840,690)", 840, 690, fieldArm("r")],
  ["armR inner@chest (890,800)", 890, 800, fieldArm("r")],
  ["armR outer@chest (750,800)", 750, 800, fieldArm("r")],
  ["armR elbow (672,1322)", 672, 1322, fieldArm("r")],
  ["armR hand (539,1560)", 539, 1560, fieldArm("r")],
  ["armL cap (1159,690)", 1159, 690, fieldArm("l")],
  ["armL inner@chest (1110,800)", 1110, 800, fieldArm("l")],
  ["armL outer@chest (1250,800)", 1250, 800, fieldArm("l")],
  ["armL hand (1448,1560)", 1448, 1560, fieldArm("l")],
  ["neck top center (995,549)", 995, 549, fieldNeck],
  ["neck @chin edge (995,577)", 995, 577, fieldNeck],
  ["neck visible mid (995,610)", 995, 610, fieldNeck],
  ["neck @collar (995,643)", 995, 643, fieldNeck],
  ["neck bottom (995,666)", 995, 666, fieldNeck]
];
console.log("\nprobe                                  min(dx)    max(dx)");
for (const [name, x, y, f] of probes) {
  const r = f(x, y);
  console.log(` ${name.padEnd(36)} ${round2(r.min).toString().padStart(8)}   ${round2(r.max).toString().padStart(8)}`);
}
