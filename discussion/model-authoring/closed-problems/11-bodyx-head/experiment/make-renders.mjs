// Render command emitter + runner for cp11. Usage:
//   node make-renders.mjs base|post|body|zoom|diag|validate
// base = pre-op regression baselines (BodyX=0 identity byte-compare targets);
// post = same set after the 36 ops (must be byte-identical);
// body = the BodyX-complete gestalt material (full-body sweep = gate material);
// zoom = neck junction + hair x shoulder overlap; diag = monitoring only.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const REGC = { minX: 700, minY: 120, width: 760, height: 560 };   // cp09/10 reg-combined frame
const BLINK = { minX: 820, minY: 300, width: 380, height: 280 };  // cp09/10 blink frame
const NECK = { minX: 850, minY: 460, width: 320, height: 280 };   // chin bottom + neck (cp10 frame)
const SHLDR_R = { minX: 560, minY: 480, width: 480, height: 520 };  // screen-left shoulder x back hair R
const SHLDR_L = { minX: 880, minY: 480, width: 480, height: 520 };  // screen-right shoulder x back hair L

const rv = (name, viewport, overrides, sweep) => ({
  name,
  spec: {
    command: "renderView",
    payload: {
      view: { kind: "stageViewport", stageViewport: viewport },
      ...(overrides ? { parameterOverrides: overrides } : {}),
      ...(sweep ? { sweep } : {}),
      outDir: RENDERS,
      outputName: name
    }
  }
});

const REG = (p) => [
  rv(`${p}-rest-full`, FULL),
  rv(`${p}-x-plus30-full`, FULL, { param_face_angle_x: 30 }),
  rv(`${p}-x-minus30-full`, FULL, { param_face_angle_x: -30 }),
  rv(`${p}-y-min30-full`, FULL, { param_face_angle_y: -30 }),
  rv(`${p}-y-plus30-full`, FULL, { param_face_angle_y: 30 }),
  rv(`${p}-reg-combined`, REGC,
    { param_face_angle_x: -30, param_eye_left_open: 0.5, param_eye_right_open: 0.5, param_eyeball_x: -1 }),
  rv(`${p}-blink`, BLINK, { param_eye_left_open: 0, param_eye_right_open: 0 })
];

const SETS = {
  base: REG("base"),
  post: REG("post"),
  body: [
    rv("body-min10-full", FULL, { param_body_angle_x: -10 }),
    rv("body-rest-full", FULL),
    rv("body-plus10-full", FULL, { param_body_angle_x: 10 }),
    rv("body-sweep7-full", FULL, undefined, { parameterId: "param_body_angle_x", steps: 7 })
  ],
  zoom: [
    rv("zoom-junction-rest", NECK),
    rv("zoom-junction-min", NECK, { param_body_angle_x: -10 }),
    rv("zoom-junction-max", NECK, { param_body_angle_x: 10 }),
    rv("zoom-hairshoulderR-rest", SHLDR_R),
    rv("zoom-hairshoulderR-min", SHLDR_R, { param_body_angle_x: -10 }),
    rv("zoom-hairshoulderR-max", SHLDR_R, { param_body_angle_x: 10 }),
    rv("zoom-hairshoulderL-rest", SHLDR_L),
    rv("zoom-hairshoulderL-min", SHLDR_L, { param_body_angle_x: -10 }),
    rv("zoom-hairshoulderL-max", SHLDR_L, { param_body_angle_x: 10 })
  ],
  diag: [
    rv("diag-bodymax-xplus30", { minX: 400, minY: 0, width: 1250, height: 1700 },
      { param_body_angle_x: 10, param_face_angle_x: 30 }),
    rv("diag-bodymin-ymin30", { minX: 400, minY: 0, width: 1250, height: 1700 },
      { param_body_angle_x: -10, param_face_angle_y: -30 }),
    rv("reg-body-blink", BLINK, { param_body_angle_x: -10, param_eye_left_open: 0, param_eye_right_open: 0 })
  ],
  validate: [
    { name: "validate-strict", spec: { command: "validatePackage", payload: { profile: "strict" } } }
  ]
};

const wanted = SETS[process.argv[2]];
if (!wanted) { console.log("unknown set"); process.exit(1); }
for (const { name, spec } of wanted) {
  const p = join(HERE, "commands", `${name}.json`);
  writeFileSync(p, JSON.stringify(spec));
  console.log(`== ${name}`);
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
}
