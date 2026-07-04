// Render/measure command emitter + runner for cp08. Usage:
//   node make-renders.mjs base|post|zoom|diag|<name...>
// Each entry writes commands/<name>.json and runs read-cmd.mjs on it.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = "C:/workspace/remie/code/ai-native-live2d-editor/discussion/model-authoring/closed-problems/08-facey-hair/experiment/renders";

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const HEAD = { minX: 700, minY: 40, width: 620, height: 620 };
const SWEEP = { minX: 330, minY: 60, width: 1250, height: 1100 };
const TIPS = { minX: 330, minY: 700, width: 1250, height: 1200 };

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
    rv("base-y-sweep7", SWEEP, undefined, { parameterId: "param_face_angle_y", steps: 7 })
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
    // hair zooms: root follows / tips hang (right side tuft + curtain, both keys)
    rv("zoom-hairR-ymin", { minX: 1000, minY: 150, width: 560, height: 900 }, { param_face_angle_y: -30 }),
    rv("zoom-hairR-ymax", { minX: 1000, minY: 150, width: 560, height: 900 }, { param_face_angle_y: 30 }),
    rv("zoom-hairL-ymin", { minX: 350, minY: 150, width: 560, height: 900 }, { param_face_angle_y: -30 }),
    rv("zoom-hairL-ymax", { minX: 350, minY: 150, width: 560, height: 900 }, { param_face_angle_y: 30 }),
    // hat brim + occiput band (hidden-edge pop check)
    rv("zoom-hat-rest", { minX: 730, minY: 60, width: 560, height: 420 }),
    rv("zoom-hat-ymin", { minX: 730, minY: 60, width: 560, height: 420 }, { param_face_angle_y: -30 }),
    rv("zoom-hat-ymax", { minX: 730, minY: 60, width: 560, height: 420 }, { param_face_angle_y: 30 }),
    // glasses on eyes (down key = the ±20px separation case)
    rv("zoom-glasses-rest", { minX: 820, minY: 330, width: 380, height: 260 }),
    rv("zoom-glasses-ymin", { minX: 820, minY: 330, width: 380, height: 260 }, { param_face_angle_y: -30 }),
    rv("zoom-glasses-ymax", { minX: 820, minY: 330, width: 380, height: 260 }, { param_face_angle_y: 30 })
  ],
  diag: [
    // diagonal watch (record only, btr height coherence): down + sideways
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
  // ---- cp08fix sets ----
  // tip zoom: hanging mass of tufts+curtains (the "invisible stake" zone).
  // before = pre-fix committed state (tips nailed), after = root translation carried.
  fixbefore: [
    rv("fix-before-tips-rest", TIPS),
    rv("fix-before-tips-ymin", TIPS, { param_face_angle_y: -30 }),
    rv("fix-before-tips-ymax", TIPS, { param_face_angle_y: 30 })
  ],
  fix: [
    rv("fix-tips-rest", TIPS), // must byte-match fix-before-tips-rest (rest untouched)
    rv("fix-tips-ymin", TIPS, { param_face_angle_y: -30 }),
    rv("fix-tips-ymax", TIPS, { param_face_angle_y: 30 }),
    rv("fix-y-min30", FULL, { param_face_angle_y: -30 }),
    rv("fix-y-plus30", FULL, { param_face_angle_y: 30 }),
    rv("fix-y-sweep7", SWEEP, undefined, { parameterId: "param_face_angle_y", steps: 7 })
  ],
  fixreg: [
    // Y=0 renders: must byte-match the cp08 post-* renders (fix touches Y min/max only)
    rv("fix-rest-full", FULL),
    rv("fix-x-plus30-full", FULL, { param_face_angle_x: 30 }),
    rv("fix-x-minus30-full", FULL, { param_face_angle_x: -30 }),
    rv("fix-x-sweep7", SWEEP, undefined, { parameterId: "param_face_angle_x", steps: 7 }),
    rv("fix-reg-combined", { minX: 700, minY: 120, width: 760, height: 560 },
      { param_face_angle_x: -30, param_eye_left_open: 0.5, param_eye_right_open: 0.5, param_eyeball_x: -1 }),
    rv("fix-blink", { minX: 820, minY: 300, width: 380, height: 280 },
      { param_eye_left_open: 0, param_eye_right_open: 0 })
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
