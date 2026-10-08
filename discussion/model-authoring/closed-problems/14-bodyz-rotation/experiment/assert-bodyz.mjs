// cp14 numeric assertion: at param_body_angle_z = v the evaluated vertices of the
// wrapped members must equal a rigid rotation of their rest vertices about the
// designed waist pivot by theta(v) = v/10 * 6 deg (y-down clockwise-positive),
// including INTERMEDIATE parameter values (cp12 assert type).
//
// Rows:
//   - direct members (topwear, tie, neck, back_hair shadow drawable): R(pivot, theta)
//   - nested-FaceZ members (face, headwear): checked with BodyZ ONLY applied
//     (FaceZ=0 -> the inner rotation2d is identity, so the outer rotation must
//     pass through unchanged; this is the nesting propagation check)
//   - non-members (bottomwear skirt, legwear): immobile (theta=0, byte-still)
//
// COMPOSITE (record only, Runtime-responsibility policy): at BodyZ max x FaceZ max
// the face must equal R_bodyz(P_b, 6deg) o R_facez(P_f, 10deg) applied to rest.
// The result is LOGGED as INFO and does not gate.
//
// Usage: node assert-bodyz.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const { PIVOT, ANGLE_MAX_DEG } = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const FACEZ_PIVOT = { x: 995.5, y: 596 };  // cp12 design value (committed rig_facez_head pivot)
const FACEZ_MAX_DEG = 10;                  // cp12 committed key (+-10 deg at face_angle_z +-30)

const DIRECT = [
  "draw_r0_1cea4f6f_26f93e8b_topwear",
  "draw_r0_1cea4f6f_ea30e9c4_tie",
  "draw_r0_1cea4f6f_691e2eb3_neck",
  "draw_r0_1cea4f6f_f2691773_back_hair"   // wrapped as a bare drawable child
];
const NESTED = [
  "draw_r0_1cea4f6f_5c3cada6_face",       // under FaceZ rotation2d (nested)
  "draw_r0_1cea4f6f_9dc00ee4_headwear"    // under FaceZ rotation2d (nested)
];
const STILL = [
  "draw_r0_1cea4f6f_26f93eaa_bottomwear", // skirt: below the waist, NOT wrapped
  "draw_r0_1cea4f6f_c7ac42f2_legwear"     // legs: NOT wrapped
];
const ALL = [...DIRECT, ...NESTED, ...STILL];

const inspect = (overrides, label) => {
  const spec = {
    command: "inspectEvaluatedGeometry",
    payload: {
      targets: ALL.map((id) => ({ kind: "drawable", drawableId: id })),
      includeVertices: true,
      ...(overrides ? { parameterOverrides: overrides } : {})
    }
  };
  const p = join(HERE, "commands", `assert-geom-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `assert-geom-${label}.response.json`), "utf8"));
  const results = r.aiCommandResponse.payload.results;
  return Object.fromEntries(results.map((x) => [x.drawableId, x.vertices ?? x.evaluatedVertices]));
};

const rotAbout = (pivot, theta) => (v) => {
  const rad = (theta * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const x = v.x - pivot.x, y = v.y - pivot.y;
  return { x: pivot.x + c * x - s * y, y: pivot.y + s * x + c * y };
};

const maxErr = (restVs, gotVs, xf) => {
  let m = 0;
  for (let i = 0; i < restVs.length; i += 1) {
    const e = xf(restVs[i]);
    m = Math.max(m, Math.hypot(e.x - gotVs[i].x, e.y - gotVs[i].y));
  }
  return m;
};

const short = (id) => id.split("_").slice(4).join("_");
const rest = inspect(undefined, "rest");
let failures = 0;

// --- BodyZ-only rows (gate) --------------------------------------------------
for (const [param, theta] of [[10, ANGLE_MAX_DEG], [5, ANGLE_MAX_DEG / 2], [3, ANGLE_MAX_DEG * 0.3], [-10, -ANGLE_MAX_DEG]]) {
  const got = inspect({ param_body_angle_z: param }, `bz${param}`);
  for (const id of ALL) {
    const expTheta = STILL.includes(id) ? 0 : theta;
    const restVs = rest[id], gotVs = got[id];
    if (!restVs || !gotVs || restVs.length !== gotVs.length) {
      console.log(`FAIL bz=${param} ${short(id)}: missing vertices (${restVs?.length} vs ${gotVs?.length})`);
      failures += 1;
      continue;
    }
    const err = maxErr(restVs, gotVs, rotAbout(PIVOT, expTheta));
    const ok = err < 0.01;
    const tag = STILL.includes(id) ? "still" : NESTED.includes(id) ? "nested" : "direct";
    console.log(`${ok ? "PASS" : "FAIL"} bz=${param} theta=${expTheta.toFixed(2)} [${tag}] ${short(id)} maxErr=${err.toExponential(2)} (n=${restVs.length})`);
    if (!ok) failures += 1;
  }
}

// --- Composite observation (record only, does NOT gate) -----------------------
const comp = inspect({ param_body_angle_z: 10, param_face_angle_z: 30 }, "composite");
const rBody = rotAbout(PIVOT, ANGLE_MAX_DEG);
const rFace = rotAbout(FACEZ_PIVOT, FACEZ_MAX_DEG);
for (const id of NESTED) {
  const err = maxErr(rest[id], comp[id], (v) => rBody(rFace(v)));
  console.log(`INFO composite bz=10 fz=30 ${short(id)} vs R_body o R_face: maxErr=${err.toExponential(2)}`);
}
for (const id of DIRECT) {
  const err = maxErr(rest[id], comp[id], rBody);
  console.log(`INFO composite bz=10 fz=30 ${short(id)} vs R_body only: maxErr=${err.toExponential(2)}`);
}

console.log(failures === 0 ? "ASSERT-BODYZ: ALL PASS" : `ASSERT-BODYZ: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
