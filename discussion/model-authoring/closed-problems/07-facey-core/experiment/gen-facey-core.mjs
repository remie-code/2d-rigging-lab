// cp07: FaceY facial core — 7 FaceY warp deformers wrapping the committed FaceX towers
// (face / nose / mouth / eye L / eye R / brow L / brow R), keys on param_face_angle_y.
//
// Transposed rotation-projection law (recipe 06, Y reading):
//   dy(point) = v*(cosD - 1) + z(point)*sinD,   v = y - CY   (+y = screen down)
//   dx = 0 everywhere (Y rotation is a vertical business; pair of the X dy=0 rule).
//
// Direction semantics (preset param_face_angle_y, range -30..+30):
//   min = downward face turn (俯き, pitch forward, D=+30): dy_min = g_dn*(chord + 0.5*z)
//   max = upward face turn   (見上げ, D=-30):              dy_max = g_up*(chord - 0.5*z)
//   chord = v*(cos30-1) = -0.13397*v  — SAME sign on both keys (cos is even), so the
//   two patches are not mirror images, exactly like the X chord term.
//
// CY (vertical rotation axis) — new design object:
//   ear material spans y421..497 (both ears) -> center 459. The X-canon vertical
//   equator (eye height, cp04fix2/cp05/cp06 s(y) formulas) is y463. Both anchors
//   agree within 4px; CY = 459 (ear center; ears are the visual pivot of a nod).
//   Sensitivity probe (numeric, before committing): moving CY 440->480 keeps the
//   depth-order of feature amplitudes (nose > brows > eyes > mouth > face skin)
//   unchanged; the dial mostly redistributes the +-2px spacing compression between
//   brow band and mouth band. Render calibration confirms/adjusts after build.
//
// Vertical shell (new vs X: asymmetric around the axis):
//   above axis: pole = head top y143 (canonical hair-cap pole) -> V_UP = 316
//   below axis: the face surface curls under at the jaw; z -> 0 at y609 -> V_DN = 150
//   zv(v) = 1-(v/V_UP)^2 for v<=0,  1-(v/V_DN)^2 for v>0  (clamped at 0; parabola,
//   not sqrt — recipe 06 fold-safety rule).
//
// Per-element z (vertical cross-sections of the same shell family as X, gain-1 canon
// z-units where nose=320 <=> 30px at zC=0.09375):
//   nose  z=320 const  — protrusion, pure translation class (X canon +-30)
//   mouth z=256 const  — X canon +-24 (0.8T lead over chin band)
//   eyes  z=272 const  — X far-side canon 25.5; both eyes are equal-height in Y,
//                        so unlike X there is no near/far asymmetry: one field, both sides
//   brows z=272 const  — ride-with-the-eyes rule (X: sample the eye field). Same z,
//                        same chord formula = constructive same-ride; the chord adds a
//                        physical ~2px spacing compression toward the axis
//   face  z = 240*(1-(u/320)^2)*zv(v) — skin-flow shell. NOTE the class change vs X:
//                        the X face field was silhouette-reshaping (edges pinned, steep
//                        column taper). In Y the side edges may slide vertically under
//                        the side hair (occlusion-safe), the forehead top edge stays
//                        deep under the bangs, and the chin is the one visible
//                        silhouette edge the field must animate. So the Y face is the
//                        head shell itself (mild U=320 taper), peak Z_F=240 chosen so
//                        feature leads bracket the X canon (nose lead 1.38, eye 1.19
//                        vs X 1.2/1.32 — a single shell cannot reproduce both, because
//                        X's leads were partly an artifact of its silhouette-class
//                        column taper; midpoint taken, renders judge).
//
// Gain (from the nose, X-canon measured +-30px uniform):
//   g_dn = 0.1875 (gain-1 canon: nose 29.4px down at min — same "elegant" class as X)
//   g_up = 0.15   (= 0.8*g_dn: nose 24.5px up at max)
//   Asymmetry rationale (design object of this problem, see design-log):
//   down is the expressive main direction (nod/shy/dejected) and gets the full canon
//   gain; up exposes the undrawn jaw underside and drives brows/eyes under the static
//   bangs, so it is restrained to 0.8 — the up read is carried by the chin band
//   (chin rises 9px at max vs 6px drop at min, chord-driven, constructive).
//
// Domains = FaceX child domain + margin: x +-36 (child content displaced up to +-30
// by FaceX keys), y +-40 (own FaceY movement up to ~30px + pad).
// Grids: nose/mouth/eyes/brows have z=const -> field affine in v -> bilinear exact ->
// 5x5 minimum stock. Face has curvature in both axes on a roomy domain -> 9x9
// (X face was 7x7 on a tight domain; +2 steps per the roomy-domain rule).
// Bezier divisions = transform divisions (recipe 06 grid rule).
import { writeFileSync } from "node:fs";

const CY = 459;
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6);
const G_DN = 0.1875, G_UP = 0.15;
const V_UP = 316, V_DN = 150;
const U_SHELL = 320, Z_FACE = 240;

const zv = (v) => {
  const p = v <= 0 ? v / V_UP : v / V_DN;
  return Math.max(0, 1 - p * p);
};
const faceZ = (x, y) => {
  const u = x - 1001; // cx of the X world; only used for the mild horizontal shell taper
  return Z_FACE * Math.max(0, 1 - (u / U_SHELL) ** 2) * zv(y - CY);
};

// dy field per element: min (down) / max (up); dx = 0 everywhere.
const field = (zOf) => (x, y) => {
  const v = y - CY;
  const chord = v * (COS - 1);
  const z = typeof zOf === "number" ? zOf : zOf(x, y);
  return {
    min: G_DN * (chord + SIN * z),
    max: G_UP * (chord - SIN * z)
  };
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

const elements = [
  { key: "face", displayName: "FaceY Face", wrap: "rig_facex_face",
    domain: { x: 811, y: 249, width: 378, height: 383 }, n: 9, f: field(faceZ) },
  { key: "nose", displayName: "FaceY Nose", wrap: "rig_facex_nose",
    domain: { x: 906, y: 418, width: 189, height: 130 }, n: 5, f: field(320) },
  { key: "mouth", displayName: "FaceY Mouth", wrap: "rig_facex_mouth",
    domain: { x: 918, y: 474, width: 165, height: 107 }, n: 5, f: field(256) },
  { key: "eye_l", displayName: "FaceY Eye L", wrap: "rig_facex_eye_l",
    domain: { x: 940, y: 336, width: 262, height: 198 }, n: 5, f: field(272) },
  { key: "eye_r", displayName: "FaceY Eye R", wrap: "rig_facex_eye_r",
    domain: { x: 789, y: 344, width: 271, height: 198 }, n: 5, f: field(272) },
  { key: "brow_l", displayName: "FaceY Brow L", wrap: "rig_facex_brow_l",
    domain: { x: 965, y: 305, width: 207, height: 111 }, n: 5, f: field(272) },
  { key: "brow_r", displayName: "FaceY Brow R", wrap: "rig_facex_brow_r",
    domain: { x: 816, y: 314, width: 212, height: 117 }, n: 5, f: field(272) }
];

const batch = [];
for (const el of elements) {
  batch.push({
    file: `warp-${el.key}.json`,
    operationId: `op_cp07_warp_${el.key}`,
    operationType: "createWarpDeformer",
    payload: {
      displayName: el.displayName,
      childDrawableIds: [],
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: el.domain,
      transformColumns: el.n, transformRows: el.n,
      bezierColumns: el.n, bezierRows: el.n,
      bezierEditType: "cubicBezierSurfaceV1",
      wrapChildren: [{ kind: "rigControl", id: el.wrap }]
    },
    gitMessage: `[cp07] warp ${el.displayName} (${el.n}x${el.n}) wrapping ${el.wrap}`
  });
}
for (const el of elements) {
  batch.push({
    file: `key-${el.key}.json`,
    operationId: `op_cp07_key_${el.key}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: `rig_facey_${el.key}` },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_y",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, el.f, -1) },
        default: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, el.f, 0) },
        max: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, el.f, +1) }
      }
    },
    gitMessage: `[cp07] key ${el.displayName} face_angle_y (createEndsCenter)`
  });
}

writeFileSync(new URL("batch-rig.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log(`batch-rig.json: ${batch.length} ops`);

// design-log tables: representative points (material centers / edges)
const probes = [
  ["nose center", 1000, 483, field(320)],
  ["mouth center", 1000, 527.5, field(256)],
  ["eye L center", 1071, 435, field(272)],
  ["eye R center", 921, 443, field(272)],
  ["brow L center", 1068, 360.5, field(272)],
  ["brow R center", 922, 372.5, field(272)],
  ["face @nose row", 1000, 483, field(faceZ)],
  ["face @eye row", 1071, 439, field(faceZ)],
  ["face top edge", 1000, 304, field(faceZ)],
  ["face chin", 1000, 577, field(faceZ)],
  ["face side edge", 862, 440, field(faceZ)]
];
console.log("probe               v      min(down,+y)  max(up)");
for (const [name, x, y, f] of probes) {
  const r = f(x, y);
  console.log(
    ` ${name.padEnd(18)} ${String(Math.round(y - CY)).padStart(4)}   ${round2(r.min).toString().padStart(8)}   ${round2(r.max).toString().padStart(8)}`
  );
}
