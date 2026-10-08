// cp17 visual cross-check (design-notes §2: one temporary show -> mouth-focus
// render -> hide round-trip per vowel, committed ops). The reference drawable
// is drawn over the vowel-morphed mouth_a (open=1, vowel=1), so silhouette
// mismatch appears as fringes. Numbers stay owned by the mesh-boundary tape
// measure; these renders are eyeball-confirmation only.
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RENDERS = join(HERE, "renders").replaceAll("\\", "/");
const MOUTHZ = { minX: 900, minY: 440, width: 220, height: 190 };

const REFS = [
  ["i", "draw_r463_780c04ef_dc637e05_mouth_i", "param_mouth_vowel_i"],
  ["u", "draw_r463_780c04ef_dc637ee6_mouth_u", "param_mouth_vowel_u"],
  ["e", "draw_r463_780c04ef_dc637ec7_mouth_e", "param_mouth_vowel_e"],
  ["o", "draw_r463_780c04ef_dc637ea0_mouth_o", "param_mouth_vowel_o"]
];

const runOp = (spec) => {
  const p = join(HERE, "commands", `${spec.file}`);
  const { file, gitMessage, ...op } = spec;
  writeFileSync(p, JSON.stringify(op, null, 1));
  console.log(`== op ${spec.file}`);
  execSync(`node "${join(HERE, "run-batch-single.mjs")}" "${p}" "${gitMessage}"`, { stdio: "inherit", cwd: HERE });
};
const render = (name, overrides) => {
  const p = join(HERE, "commands", `${name}.json`);
  writeFileSync(p, JSON.stringify({
    command: "renderView",
    payload: {
      view: { kind: "stageViewport", stageViewport: MOUTHZ },
      ...(overrides ? { parameterOverrides: overrides } : {}),
      outDir: RENDERS, outputName: name
    }
  }));
  console.log(`== render ${name}`);
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
};

for (const [tag, id, param] of REFS) {
  runOp({
    file: `vis-show-${tag}.json`,
    operationId: `op_cp17_vis_show_${tag}`,
    operationType: "setRuntimeVisibility",
    gitMessage: `[cp17] temp show mouth_${tag} reference (visual cross-check)`,
    payload: { target: { kind: "drawable", id }, runtimeVisibility: true }
  });
  render(`overlay-${tag}`, { param_mouth_open: 1, [param]: 1 });
  runOp({
    file: `vis-hide-${tag}.json`,
    operationId: `op_cp17_vis_hide_${tag}`,
    operationType: "setRuntimeVisibility",
    gitMessage: `[cp17] re-hide mouth_${tag} reference`,
    payload: { target: { kind: "drawable", id }, runtimeVisibility: false }
  });
}
console.log("visual check round-trips done");
