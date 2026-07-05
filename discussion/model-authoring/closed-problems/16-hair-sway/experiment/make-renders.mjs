// Render command emitter + runner for cp16 (hair sway warps + dynamics groups).
// Usage: node make-renders.mjs pre|post|sweep|validate
//   pre      = rest full render BEFORE any op (sha256 baseline for the 0-key
//              identity check) at the cp15 FULL frame
//   post     = the same rest full render AFTER warps+keys (byte-compare vs pre)
//   sweep    = gate material: each Sway parameter at -1/0/+1, full body (wide
//              frame: back tips travel +-~645px) + system zoom, plus a 5-step
//              sweep strip per parameter (mid-key chord behavior self-check)
//   validate = validatePackage strict
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");

const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };  // cp15 frame (sha target)
const WIDE = { minX: 0, minY: 0, width: 2000, height: 2000 };    // swing travel coverage
const FRONTZ = { minX: 600, minY: 60, width: 860, height: 800 }; // front hair + travel
const SIDEZ = { minX: 560, minY: 150, width: 880, height: 900 }; // tufts L+R + travel
const BACKZ = { minX: 0, minY: 150, width: 2000, height: 1800 }; // curtains + travel
const TIEZ = { minX: 680, minY: 560, width: 660, height: 760 };  // tie + travel

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

const SYSTEMS = [
  ["front", "param_hair_front_sway_x", FRONTZ],
  ["side", "param_hair_side_sway_x", SIDEZ],
  ["back", "param_hair_back_sway_x", BACKZ],
  ["tie", "param_accessory_sway_x", TIEZ]
];

const SWEEP = SYSTEMS.flatMap(([tag, param, zoom]) => [
  rv(`sweep-${tag}-min1-full`, WIDE, { [param]: -1 }),
  rv(`sweep-${tag}-rest-full`, WIDE),
  rv(`sweep-${tag}-plus1-full`, WIDE, { [param]: 1 }),
  rv(`sweep-${tag}-min1-zoom`, zoom, { [param]: -1 }),
  rv(`sweep-${tag}-rest-zoom`, zoom),
  rv(`sweep-${tag}-plus1-zoom`, zoom, { [param]: 1 }),
  rv(`sweep-${tag}-strip5`, WIDE, undefined, { parameterId: param, steps: 5 })
]);

const FIX1 = [
  rv("fix1-rest-full", FULL), // sha256 target: must equal post-rest-full.png
  ...SYSTEMS.flatMap(([tag, param, zoom]) => [
    rv(`fix1-${tag}-min1-full`, WIDE, { [param]: -1 }),
    rv(`fix1-${tag}-plus1-full`, WIDE, { [param]: 1 }),
    rv(`fix1-${tag}-min1-zoom`, zoom, { [param]: -1 }),
    rv(`fix1-${tag}-plus1-zoom`, zoom, { [param]: 1 }),
    rv(`fix1-${tag}-strip5`, WIDE, undefined, { parameterId: param, steps: 5 })
  ])
];

// fix2: forehead-tuft focus (the raised fixed line puts the between-the-eyes
// tuft into the swing region — gate material asks for a front-hair focus)
const FIX2 = [
  rv("fix2-rest-full", FULL), // sha256 target: must equal fix1-rest-full.png
  ...SYSTEMS.flatMap(([tag, param, zoom]) => [
    rv(`fix2-${tag}-min1-full`, WIDE, { [param]: -1 }),
    rv(`fix2-${tag}-plus1-full`, WIDE, { [param]: 1 }),
    rv(`fix2-${tag}-min1-zoom`, zoom, { [param]: -1 }),
    rv(`fix2-${tag}-plus1-zoom`, zoom, { [param]: 1 }),
    rv(`fix2-${tag}-strip5`, WIDE, undefined, { parameterId: param, steps: 5 })
  ]),
  rv("fix2-front-face-min1", { minX: 700, minY: 250, width: 620, height: 560 }, { param_hair_front_sway_x: -1 }),
  rv("fix2-front-face-rest", { minX: 700, minY: 250, width: 620, height: 560 }),
  rv("fix2-front-face-plus1", { minX: 700, minY: 250, width: 620, height: 560 }, { param_hair_front_sway_x: 1 })
];

const SETS = {
  pre: [rv("pre-rest-full", FULL)],
  post: [rv("post-rest-full", FULL)],
  fix1: FIX1,
  fix2: FIX2,
  sweep: SWEEP,
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
