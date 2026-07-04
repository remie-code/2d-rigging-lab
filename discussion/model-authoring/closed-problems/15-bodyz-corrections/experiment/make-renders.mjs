// Render command emitter + runner for cp15 (BodyZ correction warps). Usage:
//   node make-renders.mjs base|post|bodyz|zoomafter|nested|validate
// base      = at rev 404 BEFORE the 14 ops:
//             - regression baselines (all at BodyZ=0, byte-compare targets):
//               rest / FaceX+-30 / FaceY+-30 / FaceZ+-30 / BodyX+-10 / combined / blink
//             - BEFORE material at BodyZ=+-10: waist zoom, tie zoom, hair zooms,
//               curtain-tips zoom (cp14 committed state = rigid roll, no carry)
// post      = the same 11 regression frames after the ops (must be byte-identical:
//             every new key is zero at BodyZ=0);
// bodyz     = gate material: min/rest/max full body + bodyz-sweep7-full;
// zoomafter = the same before-frames at BodyZ=+-10 after the ops (before/after pairs);
// nested    = BodyZ x FaceZ composite watch (record only, Runtime-responsibility);
// validate  = validatePackage strict.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const REGC = { minX: 700, minY: 120, width: 760, height: 560 };   // cp09-14 reg-combined frame
const BLINK = { minX: 820, minY: 300, width: 380, height: 280 };  // cp09-14 blink frame
const WAIST = { minX: 620, minY: 950, width: 760, height: 460 };  // cp14 frame (skirt in-line band)
const TIE = { minX: 840, minY: 560, width: 420, height: 700 };    // cp14 frame (tie + travel)
const HAIRR = { minX: 880, minY: 120, width: 560, height: 940 };  // tuft R + carry travel
const HAIRL = { minX: 620, minY: 160, width: 560, height: 940 };  // tuft L + carry travel
const CURT = { minX: 280, minY: 900, width: 1330, height: 1030 }; // curtain hanging band + tips

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

const ZOOMS = (p) => {
  const out = [];
  for (const [frame, tag] of [[WAIST, "waist"], [TIE, "tie"], [HAIRR, "hairR"], [HAIRL, "hairL"], [CURT, "curt"]]) {
    out.push(rv(`${p}-zoom-${tag}-rest`, frame));
    out.push(rv(`${p}-zoom-${tag}-bodyzmin`, frame, { param_body_angle_z: -10 }));
    out.push(rv(`${p}-zoom-${tag}-bodyzmax`, frame, { param_body_angle_z: 10 }));
  }
  return out;
};

const SETS = {
  base: [...REG("base"), ...ZOOMS("before")],
  post: REG("post"),
  bodyz: [
    rv("bodyz-min10-full", FULL, { param_body_angle_z: -10 }),
    rv("bodyz-rest-full", FULL),
    rv("bodyz-plus10-full", FULL, { param_body_angle_z: 10 }),
    rv("bodyz-sweep7-full", FULL, undefined, { parameterId: "param_body_angle_z", steps: 7 })
  ],
  zoomafter: ZOOMS("after"),
  nested: [
    rv("nested-bodyzmax-facezmax", FULL, { param_body_angle_z: 10, param_face_angle_z: 30 }),
    rv("nested-bodyzmin-facezmin", FULL, { param_body_angle_z: -10, param_face_angle_z: -30 })
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
