// Render command emitter + runner for cp14 (BodyZ rotation core). Usage:
//   node make-renders.mjs base|post|bodyz|nested|zoom|validate
// base   = pre-op regression baselines at BodyZ=0 (byte-compare targets):
//          rest / FaceX+-30 / FaceY+-30 / FaceZ+-30 / BodyX+-10 / reg-combined / blink
// post   = the same set after the 2 ops (must be byte-identical);
// bodyz  = gate material: min/rest/max full body + bodyz-sweep7-full;
// nested = rotation2d-in-rotation2d composition watch (record only, no fixing):
//          BodyZ max x FaceZ max, BodyZ min x FaceZ min;
// zoom   = waist band (skirt boundary: sink-in/gap record = cp15 handover) and
//          tie (diagonal freeze record = cp15 handover).
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const REGC = { minX: 700, minY: 120, width: 760, height: 560 };   // cp09-13 reg-combined frame
const BLINK = { minX: 820, minY: 300, width: 380, height: 280 };  // cp09-13 blink frame
const WAIST = { minX: 620, minY: 950, width: 760, height: 460 };  // skirt in-line band (y=1124 +- travel)
const TIE = { minX: 840, minY: 560, width: 420, height: 700 };    // tie x939..1046 y640..1203 + travel

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
  rv(`${p}-z-min30-full`, FULL, { param_face_angle_z: -30 }),
  rv(`${p}-z-plus30-full`, FULL, { param_face_angle_z: 30 }),
  rv(`${p}-body-min10-full`, FULL, { param_body_angle_x: -10 }),
  rv(`${p}-body-plus10-full`, FULL, { param_body_angle_x: 10 }),
  rv(`${p}-reg-combined`, REGC,
    { param_face_angle_x: -30, param_eye_left_open: 0.5, param_eye_right_open: 0.5, param_eyeball_x: -1 }),
  rv(`${p}-blink`, BLINK, { param_eye_left_open: 0, param_eye_right_open: 0 })
];

const SETS = {
  base: REG("base"),
  post: REG("post"),
  bodyz: [
    rv("bodyz-min10-full", FULL, { param_body_angle_z: -10 }),
    rv("bodyz-rest-full", FULL),
    rv("bodyz-plus10-full", FULL, { param_body_angle_z: 10 }),
    rv("bodyz-sweep7-full", FULL, undefined, { parameterId: "param_body_angle_z", steps: 7 })
  ],
  nested: [
    rv("nested-bodyzmax-facezmax", FULL, { param_body_angle_z: 10, param_face_angle_z: 30 }),
    rv("nested-bodyzmin-facezmin", FULL, { param_body_angle_z: -10, param_face_angle_z: -30 })
  ],
  zoom: [
    rv("zoom-waist-rest", WAIST),
    rv("zoom-waist-bodyzmin", WAIST, { param_body_angle_z: -10 }),
    rv("zoom-waist-bodyzmax", WAIST, { param_body_angle_z: 10 }),
    rv("zoom-tie-rest", TIE),
    rv("zoom-tie-bodyzmin", TIE, { param_body_angle_z: -10 }),
    rv("zoom-tie-bodyzmax", TIE, { param_body_angle_z: 10 })
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
