// Render command emitter + runner for cp10. Usage:
//   node make-renders.mjs pre|base|post|body|zoom|diag|validate
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const SWEEP = { minX: 330, minY: 60, width: 1250, height: 1100 };      // head sweep frame (cp09)
const TORSO = { minX: 560, minY: 420, width: 900, height: 1300 };      // shoulders -> below skirt
const PIN = { minX: 690, minY: 560, width: 640, height: 680 };         // shoulders + hem + skirt top
const TIE = { minX: 860, minY: 590, width: 300, height: 680 };
const ARMR = { minX: 440, minY: 600, width: 540, height: 1060 };
const ARML = { minX: 1030, minY: 600, width: 540, height: 1060 };
const NECK = { minX: 850, minY: 460, width: 320, height: 280 };
const REGC = { minX: 700, minY: 120, width: 760, height: 560 };        // cp09 reg-combined frame
const BLINK = { minX: 820, minY: 300, width: 380, height: 280 };       // cp09 blink frame

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

// base = post-mesh, pre-rig state (regression baselines for the rig stage);
// post = post-rig, byte-compare targets. pre = rev-274 record (head only).
const REG = (p) => [
  rv(`${p}-rest-full`, FULL),
  rv(`${p}-x-plus30-full`, FULL, { param_face_angle_x: 30 }),
  rv(`${p}-x-minus30-full`, FULL, { param_face_angle_x: -30 }),
  rv(`${p}-x-sweep7`, SWEEP, undefined, { parameterId: "param_face_angle_x", steps: 7 }),
  rv(`${p}-y-min30-full`, FULL, { param_face_angle_y: -30 }),
  rv(`${p}-y-plus30-full`, FULL, { param_face_angle_y: 30 }),
  rv(`${p}-reg-combined`, REGC,
    { param_face_angle_x: -30, param_eye_left_open: 0.5, param_eye_right_open: 0.5, param_eyeball_x: -1 }),
  rv(`${p}-blink`, BLINK, { param_eye_left_open: 0, param_eye_right_open: 0 })
];

const SETS = {
  pre: [rv("pre-rest-full", FULL)],
  base: REG("base"),
  post: REG("post"),
  body: [
    rv("body-min10-full", FULL, { param_body_angle_x: -10 }),
    rv("body-plus10-full", FULL, { param_body_angle_x: 10 }),
    rv("body-sweep7", TORSO, undefined, { parameterId: "param_body_angle_x", steps: 7 }),
    rv("body-rest-torso", TORSO)
  ],
  zoom: [
    rv("zoom-pin-rest", PIN),
    rv("zoom-pin-min", PIN, { param_body_angle_x: -10 }),
    rv("zoom-pin-max", PIN, { param_body_angle_x: 10 }),
    rv("zoom-tie-rest", TIE),
    rv("zoom-tie-min", TIE, { param_body_angle_x: -10 }),
    rv("zoom-tie-max", TIE, { param_body_angle_x: 10 }),
    rv("zoom-armR-rest", ARMR),
    rv("zoom-armR-min", ARMR, { param_body_angle_x: -10 }),
    rv("zoom-armR-max", ARMR, { param_body_angle_x: 10 }),
    rv("zoom-armL-rest", ARML),
    rv("zoom-armL-min", ARML, { param_body_angle_x: -10 }),
    rv("zoom-armL-max", ARML, { param_body_angle_x: 10 }),
    rv("zoom-neck-rest", NECK),
    rv("zoom-neck-min", NECK, { param_body_angle_x: -10 }),
    rv("zoom-neck-max", NECK, { param_body_angle_x: 10 })
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
