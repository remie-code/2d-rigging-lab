// cp18 sweep renders. Usage: node make-sweep-renders.mjs <outfitTag>
// Renders rest + BodyX +/-10 + BodyZ +/-10 at the FULL frame for the outfit
// currently shown (visibility already set by batch-sweep-*.json).
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");
const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const tag = process.argv[2];
if (!tag) { console.log("usage: node make-sweep-renders.mjs <tag>"); process.exit(1); }

const POSES = [
  ["rest", undefined],
  ["bx-10", { param_body_angle_x: -10 }],
  ["bx+10", { param_body_angle_x: 10 }],
  ["bz-10", { param_body_angle_z: -10 }],
  ["bz+10", { param_body_angle_z: 10 }]
];
for (const [ptag, overrides] of POSES) {
  const name = `sweep-${tag}-${ptag}`;
  const p = join(HERE, "commands", `${name}.json`);
  writeFileSync(p, JSON.stringify({
    command: "renderView",
    payload: {
      view: { kind: "stageViewport", stageViewport: FULL },
      ...(overrides ? { parameterOverrides: overrides } : {}),
      outDir: RENDERS, outputName: name
    }
  }));
  console.log(`== render ${name}`);
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
}
