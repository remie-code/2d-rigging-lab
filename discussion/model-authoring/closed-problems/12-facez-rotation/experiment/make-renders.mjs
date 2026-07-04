// Render command emitter + runner for cp12 (FaceZ rotation core). Usage:
//   node make-renders.mjs base|post|z|zoom|validate
// base = pre-op regression baselines (FaceZ=0 identity byte-compare targets);
// post = same set after the 2 ops (must be byte-identical);
// z    = FaceZ gestalt material: min/rest/max full body, intermediate z=+15,
//        and z-sweep7 (rotation must still be rotation at intermediate params);
// zoom = neck-base junction (pivot hypothesis) + head-internal rigid relations.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const REGC = { minX: 700, minY: 120, width: 760, height: 560 };   // cp09/10/11 reg-combined frame
const BLINK = { minX: 820, minY: 300, width: 380, height: 280 };  // cp09/10/11 blink frame
const NECK = { minX: 850, minY: 460, width: 320, height: 280 };   // chin bottom + neck (cp10/11 frame)
const HEAD = { minX: 760, minY: 60, width: 560, height: 560 };    // whole head: hat/hair/glasses/eyes/mouth

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
  rv(`${p}-body-min10-full`, FULL, { param_body_angle_x: -10 }),
  rv(`${p}-body-plus10-full`, FULL, { param_body_angle_x: 10 }),
  rv(`${p}-reg-combined`, REGC,
    { param_face_angle_x: -30, param_eye_left_open: 0.5, param_eye_right_open: 0.5, param_eyeball_x: -1 }),
  rv(`${p}-blink`, BLINK, { param_eye_left_open: 0, param_eye_right_open: 0 })
];

const SETS = {
  base: REG("base"),
  post: REG("post"),
  z: [
    rv("z-min30-full", FULL, { param_face_angle_z: -30 }),
    rv("z-rest-full", FULL),
    rv("z-plus30-full", FULL, { param_face_angle_z: 30 }),
    rv("z-plus15-full", FULL, { param_face_angle_z: 15 }),
    rv("z-sweep7-full", FULL, undefined, { parameterId: "param_face_angle_z", steps: 7 })
  ],
  zoom: [
    rv("zoom-neckbase-rest", NECK),
    rv("zoom-neckbase-min", NECK, { param_face_angle_z: -30 }),
    rv("zoom-neckbase-max", NECK, { param_face_angle_z: 30 }),
    rv("zoom-head-rest", HEAD),
    rv("zoom-head-min", HEAD, { param_face_angle_z: -30 }),
    rv("zoom-head-max", HEAD, { param_face_angle_z: 30 }),
    rv("zoom-head-mid", HEAD, { param_face_angle_z: 15 })
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
