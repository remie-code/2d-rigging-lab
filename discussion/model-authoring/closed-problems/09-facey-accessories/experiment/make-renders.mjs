// Render command emitter + runner for cp09. Usage:
//   node make-renders.mjs base|post|zoom|diag|reg2|validate
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const HEAD = { minX: 700, minY: 40, width: 620, height: 620 };
const SWEEP = { minX: 330, minY: 60, width: 1250, height: 1100 };
const HAT = { minX: 730, minY: 20, width: 560, height: 460 };
const CATEARS = { minX: 800, minY: 30, width: 440, height: 220 };
const HUMEARS = { minX: 790, minY: 370, width: 440, height: 200 };
const SEAML = { minX: 740, minY: 140, width: 280, height: 300 };
const SEAMR = { minX: 1040, minY: 140, width: 280, height: 300 };

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
  base: [
    rv("base-rest-full", FULL),
    rv("base-rest-head", HEAD),
    rv("base-x-plus30-full", FULL, { param_face_angle_x: 30 }),
    rv("base-x-minus30-full", FULL, { param_face_angle_x: -30 }),
    rv("base-x-sweep7", SWEEP, undefined, { parameterId: "param_face_angle_x", steps: 7 }),
    rv("base-reg-combined", { minX: 700, minY: 120, width: 760, height: 560 },
      { param_face_angle_x: -30, param_eye_left_open: 0.5, param_eye_right_open: 0.5, param_eyeball_x: -1 }),
    rv("base-blink", { minX: 820, minY: 300, width: 380, height: 280 },
      { param_eye_left_open: 0, param_eye_right_open: 0 }),
    rv("base-y-min30", FULL, { param_face_angle_y: -30 }),
    rv("base-y-plus30", FULL, { param_face_angle_y: 30 }),
    rv("base-y-sweep7", SWEEP, undefined, { parameterId: "param_face_angle_y", steps: 7 }),
    rv("base-zoom-hat-ymin", HAT, { param_face_angle_y: -30 }),
    rv("base-zoom-hat-ymax", HAT, { param_face_angle_y: 30 })
  ],
  post: [
    rv("post-rest-full", FULL),
    rv("post-rest-head", HEAD),
    rv("post-x-plus30-full", FULL, { param_face_angle_x: 30 }),
    rv("post-x-minus30-full", FULL, { param_face_angle_x: -30 }),
    rv("post-x-sweep7", SWEEP, undefined, { parameterId: "param_face_angle_x", steps: 7 }),
    rv("post-reg-combined", { minX: 700, minY: 120, width: 760, height: 560 },
      { param_face_angle_x: -30, param_eye_left_open: 0.5, param_eye_right_open: 0.5, param_eyeball_x: -1 }),
    rv("post-blink", { minX: 820, minY: 300, width: 380, height: 280 },
      { param_eye_left_open: 0, param_eye_right_open: 0 }),
    rv("y-min30", FULL, { param_face_angle_y: -30 }),
    rv("y-plus30", FULL, { param_face_angle_y: 30 }),
    rv("y-sweep7", SWEEP, undefined, { parameterId: "param_face_angle_y", steps: 7 })
  ],
  zoom: [
    rv("zoom-hat-rest", HAT),
    rv("zoom-hat-ymin", HAT, { param_face_angle_y: -30 }),
    rv("zoom-hat-ymax", HAT, { param_face_angle_y: 30 }),
    rv("zoom-catears-rest", CATEARS),
    rv("zoom-catears-ymin", CATEARS, { param_face_angle_y: -30 }),
    rv("zoom-catears-ymax", CATEARS, { param_face_angle_y: 30 }),
    rv("zoom-humears-rest", HUMEARS),
    rv("zoom-humears-ymin", HUMEARS, { param_face_angle_y: -30 }),
    rv("zoom-humears-ymax", HUMEARS, { param_face_angle_y: 30 }),
    rv("zoom-seamL-ymin", SEAML, { param_face_angle_y: -30 }),
    rv("zoom-seamL-ymax", SEAML, { param_face_angle_y: 30 }),
    rv("zoom-seamR-ymin", SEAMR, { param_face_angle_y: -30 }),
    rv("zoom-seamR-ymax", SEAMR, { param_face_angle_y: 30 })
  ],
  diag: [
    rv("diag-ymin-xplus30", { minX: 600, minY: 40, width: 820, height: 820 },
      { param_face_angle_y: -30, param_face_angle_x: 30 }),
    rv("diag-ymin-xminus30", { minX: 600, minY: 40, width: 820, height: 820 },
      { param_face_angle_y: -30, param_face_angle_x: -30 })
  ],
  reg2: [
    rv("reg-y-blink", { minX: 820, minY: 300, width: 380, height: 280 },
      { param_face_angle_y: -30, param_eye_left_open: 0, param_eye_right_open: 0 }),
    rv("reg-y-eyeball", { minX: 700, minY: 120, width: 760, height: 560 },
      { param_face_angle_y: 30, param_eyeball_x: 1 })
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
