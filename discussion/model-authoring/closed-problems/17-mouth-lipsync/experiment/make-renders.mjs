// cp17 render emitter. Usage: node make-renders.mjs post|sweep|validate
//   post     = rest full-body render at the cp15/cp16 FULL frame (diff target
//              vs pre-rest-full.png; expected diff = mouth region only, since
//              default open=0 now crushes mouth_a)
//   sweep    = gate material: open {0,0.5,1} x {neutral, each vowel=1} mouth
//              focus (15 renders) + rest full body
//   validate = validatePackage strict
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");
const FULL = { minX: 250, minY: 0, width: 1500, height: 2000 };
const MOUTHZ = { minX: 900, minY: 440, width: 220, height: 190 };

const rv = (name, viewport, overrides) => ({
  name,
  spec: {
    command: "renderView",
    payload: {
      view: { kind: "stageViewport", stageViewport: viewport },
      ...(overrides && Object.keys(overrides).length ? { parameterOverrides: overrides } : {}),
      outDir: RENDERS, outputName: name
    }
  }
});

const VOWELS = [
  ["a", {}], // あ = rest itself, no vowel warp
  ["i", { param_mouth_vowel_i: 1 }],
  ["u", { param_mouth_vowel_u: 1 }],
  ["e", { param_mouth_vowel_e: 1 }],
  ["o", { param_mouth_vowel_o: 1 }]
];
const OPENS = [["open0", 0], ["open05", 0.5], ["open1", 1]];

const SWEEP = [
  rv("sweep-rest-full", FULL),
  ...OPENS.flatMap(([otag, o]) =>
    VOWELS.map(([vtag, ov]) =>
      rv(`sweep-${otag}-${vtag}`, MOUTHZ, { param_mouth_open: o, ...ov })))
];

const SETS = {
  post: [rv("post-rest-full", FULL)],
  sweep: SWEEP,
  validate: [{ name: "validate-strict", spec: { command: "validatePackage", payload: { profile: "strict" } } }]
};

const wanted = SETS[process.argv[2]];
if (!wanted) { console.log("unknown set"); process.exit(1); }
for (const { name, spec } of wanted) {
  const p = join(HERE, "commands", `${name}.json`);
  writeFileSync(p, JSON.stringify(spec));
  console.log(`== ${name}`);
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
}
