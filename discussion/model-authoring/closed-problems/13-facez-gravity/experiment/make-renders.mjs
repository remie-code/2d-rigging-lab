// Render command emitter + runner for cp13 (FaceZ gravity warps). Usage:
//   node make-renders.mjs base|post|z|zoom|validate
// base = pre-op regression baselines (all at FaceZ=0 -> byte-compare targets)
//        + before-z-min/max full body (hair still static under the cp12 rotation:
//        the before half of the gravity before/after pair);
// post = the FaceZ=0 regression set after the 10 ops (must be byte-identical);
// z    = FaceZ gestalt material: min/rest/max full body + z-sweep7-full
//        (the FaceZ-complete through-sweep, final gate material);
// zoom = side tufts +-ends (root follow + strand verticality), front-hair tips,
//        back_top x curtain seam, whole-head root occlusion frames.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const REGC = { minX: 700, minY: 120, width: 760, height: 560 };   // cp09-12 reg-combined frame
const BLINK = { minX: 820, minY: 300, width: 380, height: 280 };  // cp09-12 blink frame
const HEAD = { minX: 760, minY: 60, width: 560, height: 560 };    // cp12 whole-head frame
const HAIRR = { minX: 950, minY: 180, width: 460, height: 880 };  // tuft R + root + tip
const HAIRL = { minX: 600, minY: 200, width: 460, height: 880 };  // tuft L + root + tip
const FRINGE = { minX: 600, minY: 380, width: 800, height: 450 }; // front-hair tail band over the eyes
const SEAM = { minX: 720, minY: 200, width: 560, height: 660 };   // back_top x curtain junction

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
  base: [
    ...REG("base"),
    rv("before-z-min30-full", FULL, { param_face_angle_z: -30 }),
    rv("before-z-plus30-full", FULL, { param_face_angle_z: 30 }),
    rv("before-zoom-hairR-zmax", HAIRR, { param_face_angle_z: 30 }),
    rv("before-zoom-hairL-zmin", HAIRL, { param_face_angle_z: -30 })
  ],
  post: REG("post"),
  z: [
    rv("z-min30-full", FULL, { param_face_angle_z: -30 }),
    rv("z-rest-full", FULL),
    rv("z-plus30-full", FULL, { param_face_angle_z: 30 }),
    rv("z-sweep7-full", FULL, undefined, { parameterId: "param_face_angle_z", steps: 7 })
  ],
  zoom: [
    rv("zoom-hairR-zmin", HAIRR, { param_face_angle_z: -30 }),
    rv("zoom-hairR-zmax", HAIRR, { param_face_angle_z: 30 }),
    rv("zoom-hairL-zmin", HAIRL, { param_face_angle_z: -30 }),
    rv("zoom-hairL-zmax", HAIRL, { param_face_angle_z: 30 }),
    rv("zoom-fringe-rest", FRINGE),
    rv("zoom-fringe-zmin", FRINGE, { param_face_angle_z: -30 }),
    rv("zoom-fringe-zmax", FRINGE, { param_face_angle_z: 30 }),
    rv("zoom-seam-zmin", SEAM, { param_face_angle_z: -30 }),
    rv("zoom-seam-zmax", SEAM, { param_face_angle_z: 30 }),
    rv("zoom-head-zmin", HEAD, { param_face_angle_z: -30 }),
    rv("zoom-head-zmax", HEAD, { param_face_angle_z: 30 })
  ],
  validate: [
    { name: "validate-strict", spec: { command: "validatePackage", payload: { profile: "strict" } } }
  ]
};

// ---- cp13fix sets ----
// Wide frames sized for the restored X transition (tuft dx grows ~6->55px):
const FTUFTR = { minX: 860, minY: 150, width: 600, height: 920 };  // tuft R + full travel
const FTUFTL = { minX: 540, minY: 170, width: 600, height: 920 };  // tuft L + full travel
const FTIPS  = { minX: 300, minY: 1060, width: 1340, height: 900 }; // both curtain tip bands
SETS["fix-before"] = [ // at rev 373 (cp13 state): the "before" half of every pair
  rv("fix-before-zoom-hairR-zmin", FTUFTR, { param_face_angle_z: -30 }),
  rv("fix-before-zoom-hairR-zmax", FTUFTR, { param_face_angle_z: 30 }),
  rv("fix-before-zoom-hairL-zmin", FTUFTL, { param_face_angle_z: -30 }),
  rv("fix-before-zoom-hairL-zmax", FTUFTL, { param_face_angle_z: 30 }),
  rv("fix-before-zoom-tips-zmin", FTIPS, { param_face_angle_z: -30 }),
  rv("fix-before-zoom-tips-zmax", FTIPS, { param_face_angle_z: 30 })
];
SETS["fix-f1"] = [ // after batch-fix1: F1 judgement + plumb-before (F1-only tips)
  rv("fix-zoom-hairR-zmin", FTUFTR, { param_face_angle_z: -30 }),
  rv("fix-zoom-hairR-zmax", FTUFTR, { param_face_angle_z: 30 }),
  rv("fix-zoom-hairL-zmin", FTUFTL, { param_face_angle_z: -30 }),
  rv("fix-zoom-hairL-zmax", FTUFTL, { param_face_angle_z: 30 }),
  rv("fix-f1-zoom-tips-zmin", FTIPS, { param_face_angle_z: -30 }),
  rv("fix-f1-zoom-tips-zmax", FTIPS, { param_face_angle_z: 30 })
];
SETS["fix-f2"] = [ // after batch-fix2: plumb-after + FaceZ gestalt
  rv("fix-zoom-tips-zmin", FTIPS, { param_face_angle_z: -30 }),
  rv("fix-zoom-tips-zmax", FTIPS, { param_face_angle_z: 30 }),
  rv("fix-z-min30-full", FULL, { param_face_angle_z: -30 }),
  rv("fix-z-rest-full", FULL),
  rv("fix-z-plus30-full", FULL, { param_face_angle_z: 30 }),
  rv("fix-z-sweep7-full", FULL, undefined, { parameterId: "param_face_angle_z", steps: 7 })
];
SETS["fix-reg"] = REG("fix"); // FaceZ=0 regression -> byte-compare vs base-*

// ---- cp13fix2 sets (contact band -> true attachment band) ----
SETS["fix2-before"] = [ // at rev 385 (fix1 state): the "before" half of every pair
  rv("fix2-before-zoom-hairR-zmin", FTUFTR, { param_face_angle_z: -30 }),
  rv("fix2-before-zoom-hairR-zmax", FTUFTR, { param_face_angle_z: 30 }),
  rv("fix2-before-zoom-hairL-zmin", FTUFTL, { param_face_angle_z: -30 }),
  rv("fix2-before-zoom-hairL-zmax", FTUFTL, { param_face_angle_z: 30 }),
  rv("fix2-before-zoom-tips-zmin", FTIPS, { param_face_angle_z: -30 }),
  rv("fix2-before-zoom-tips-zmax", FTIPS, { param_face_angle_z: 30 }),
  rv("fix2-before-zoom-seam-zmin", SEAM, { param_face_angle_z: -30 }),
  rv("fix2-before-zoom-seam-zmax", SEAM, { param_face_angle_z: 30 })
];
SETS["fix2-after"] = [ // after batch-fix2attach: judgement material
  rv("fix2-zoom-hairR-zmin", FTUFTR, { param_face_angle_z: -30 }),
  rv("fix2-zoom-hairR-zmax", FTUFTR, { param_face_angle_z: 30 }),
  rv("fix2-zoom-hairL-zmin", FTUFTL, { param_face_angle_z: -30 }),
  rv("fix2-zoom-hairL-zmax", FTUFTL, { param_face_angle_z: 30 }),
  rv("fix2-zoom-tips-zmin", FTIPS, { param_face_angle_z: -30 }),
  rv("fix2-zoom-tips-zmax", FTIPS, { param_face_angle_z: 30 }),
  rv("fix2-zoom-seam-zmin", SEAM, { param_face_angle_z: -30 }),
  rv("fix2-zoom-seam-zmax", SEAM, { param_face_angle_z: 30 }),
  rv("fix2-zoom-head-zmin", HEAD, { param_face_angle_z: -30 }),
  rv("fix2-zoom-head-zmax", HEAD, { param_face_angle_z: 30 }),
  rv("fix2-z-min30-full", FULL, { param_face_angle_z: -30 }),
  rv("fix2-z-rest-full", FULL),
  rv("fix2-z-plus30-full", FULL, { param_face_angle_z: 30 }),
  rv("fix2-z-sweep7-full", FULL, undefined, { parameterId: "param_face_angle_z", steps: 7 })
];
SETS["fix2-reg"] = REG("fix2"); // FaceZ=0 regression -> byte-compare vs base-*

// ---- cp13fix3 sets (3-band scalp model) ----
// before-half of every pair = the fix2-zoom-* renders (state unchanged at rev
// 393 between the fix2 round and the fix3 batch; assert PRE proved it).
SETS["fix3-after"] = [
  rv("fix3-zoom-hairR-zmin", FTUFTR, { param_face_angle_z: -30 }),
  rv("fix3-zoom-hairR-zmax", FTUFTR, { param_face_angle_z: 30 }),
  rv("fix3-zoom-hairL-zmin", FTUFTL, { param_face_angle_z: -30 }),
  rv("fix3-zoom-hairL-zmax", FTUFTL, { param_face_angle_z: 30 }),
  rv("fix3-zoom-tips-zmin", FTIPS, { param_face_angle_z: -30 }),
  rv("fix3-zoom-tips-zmax", FTIPS, { param_face_angle_z: 30 }),
  rv("fix3-zoom-seam-zmin", SEAM, { param_face_angle_z: -30 }),
  rv("fix3-zoom-seam-zmax", SEAM, { param_face_angle_z: 30 }),
  rv("fix3-zoom-head-zmin", HEAD, { param_face_angle_z: -30 }),
  rv("fix3-zoom-head-zmax", HEAD, { param_face_angle_z: 30 }),
  rv("fix3-z-min30-full", FULL, { param_face_angle_z: -30 }),
  rv("fix3-z-rest-full", FULL),
  rv("fix3-z-plus30-full", FULL, { param_face_angle_z: 30 }),
  rv("fix3-z-sweep7-full", FULL, undefined, { parameterId: "param_face_angle_z", steps: 7 })
];
SETS["fix3-reg"] = REG("fix3"); // FaceZ=0 regression -> byte-compare vs base-*

const wanted = SETS[process.argv[2]];
if (!wanted) { console.log("unknown set"); process.exit(1); }
for (const { name, spec } of wanted) {
  const p = join(HERE, "commands", `${name}.json`);
  writeFileSync(p, JSON.stringify(spec));
  console.log(`== ${name}`);
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
}
