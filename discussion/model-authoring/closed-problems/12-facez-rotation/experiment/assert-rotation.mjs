// cp12 numeric assertion: at param_face_angle_z = v the evaluated vertices of the
// wrapped head drawables must equal a rigid rotation of their rest vertices about
// the designed pivot by theta(v) = v/30 * 10 deg (y-down clockwise-positive).
// This is the warp-vs-rotation essence check: it must hold at the ENDS and at
// INTERMEDIATE parameter values (a warp interpolating endpoint fields would fail
// the intermediate case by chord shrinkage), and it is simultaneously the
// rigid-body check (all head drawables share one exact isometry).
//
// Usage: node assert-rotation.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const { PIVOT, ANGLE_MAX_DEG } = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));

const DRAWABLES = [
  "draw_r0_1cea4f6f_5c3cada6_face",
  "draw_r0_1cea4f6f_9dc00ee4_headwear",
  "draw_r0_1cea4f6f_691e2eb3_neck" // NOT wrapped: must stay exactly at rest (control row)
];

const inspect = (overrides, label) => {
  const spec = {
    command: "inspectEvaluatedGeometry",
    payload: {
      targets: DRAWABLES.map((id) => ({ kind: "drawable", drawableId: id })),
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

const rot = (v, theta) => {
  const rad = (theta * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const x = v.x - PIVOT.x, y = v.y - PIVOT.y;
  return { x: PIVOT.x + c * x - s * y, y: PIVOT.y + s * x + c * y };
};

const rest = inspect(undefined, "rest");
let failures = 0;
for (const [param, theta] of [[30, ANGLE_MAX_DEG], [15, ANGLE_MAX_DEG / 2], [-30, -ANGLE_MAX_DEG], [10, ANGLE_MAX_DEG / 3]]) {
  const got = inspect({ param_face_angle_z: param }, `z${param}`);
  for (const id of DRAWABLES) {
    const isWrapped = !id.endsWith("_neck");
    const expTheta = isWrapped ? theta : 0;
    const restVs = rest[id], gotVs = got[id];
    if (!restVs || !gotVs || restVs.length !== gotVs.length) {
      console.log(`FAIL z=${param} ${id}: missing vertices (${restVs?.length} vs ${gotVs?.length})`);
      failures += 1;
      continue;
    }
    let maxErr = 0;
    for (let i = 0; i < restVs.length; i += 1) {
      const e = rot(restVs[i], expTheta);
      maxErr = Math.max(maxErr, Math.hypot(e.x - gotVs[i].x, e.y - gotVs[i].y));
    }
    const ok = maxErr < 0.01;
    console.log(`${ok ? "PASS" : "FAIL"} z=${param} theta=${expTheta.toFixed(3)} ${id.split("_").pop()} maxErr=${maxErr.toExponential(2)} (n=${restVs.length})`);
    if (!ok) failures += 1;
  }
}
console.log(failures === 0 ? "ASSERT-ROTATION: ALL PASS" : `ASSERT-ROTATION: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
