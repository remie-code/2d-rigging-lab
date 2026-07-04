// cp10fix render sets. Usage: node make-renders-fix.mjs before|after|reg|validate
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const COLLAR = { minX: 760, minY: 520, width: 480, height: 320 };  // shoulder lines + collar + knot
const PIN = { minX: 690, minY: 560, width: 640, height: 680 };     // cp10 pin frame (before = zoom-pin-*)
const REGC = { minX: 700, minY: 120, width: 760, height: 560 };
const BLINK = { minX: 820, minY: 300, width: 380, height: 280 };

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

const SETS = {
  before: [
    rv("fix-collar-before-rest", COLLAR),
    rv("fix-collar-before-min", COLLAR, { param_body_angle_x: -10 }),
    rv("fix-collar-before-max", COLLAR, { param_body_angle_x: 10 })
  ],
  after: [
    rv("fix-body-rest-full", FULL),
    rv("fix-body-min10-full", FULL, { param_body_angle_x: -10 }),
    rv("fix-body-plus10-full", FULL, { param_body_angle_x: 10 }),
    rv("fix-collar-after-rest", COLLAR),
    rv("fix-collar-after-min", COLLAR, { param_body_angle_x: -10 }),
    rv("fix-collar-after-max", COLLAR, { param_body_angle_x: 10 }),
    rv("fix-pin-rest", PIN),
    rv("fix-pin-min", PIN, { param_body_angle_x: -10 }),
    rv("fix-pin-max", PIN, { param_body_angle_x: 10 })
  ],
  // regression: must be byte-identical to cp10's post-* set (BodyX=0 identity)
  reg: [
    rv("fix-reg-rest-full", FULL),
    rv("fix-reg-x-plus30-full", FULL, { param_face_angle_x: 30 }),
    rv("fix-reg-x-minus30-full", FULL, { param_face_angle_x: -30 }),
    rv("fix-reg-x-sweep7", { minX: 330, minY: 60, width: 1250, height: 1100 }, undefined,
      { parameterId: "param_face_angle_x", steps: 7 }),
    rv("fix-reg-y-min30-full", FULL, { param_face_angle_y: -30 }),
    rv("fix-reg-y-plus30-full", FULL, { param_face_angle_y: 30 }),
    rv("fix-reg-combined", REGC,
      { param_face_angle_x: -30, param_eye_left_open: 0.5, param_eye_right_open: 0.5, param_eyeball_x: -1 }),
    rv("fix-reg-blink", BLINK, { param_eye_left_open: 0, param_eye_right_open: 0 })
  ],
  validate: [
    { name: "fix-validate-strict", spec: { command: "validatePackage", payload: { profile: "strict" } } }
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
