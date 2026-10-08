// Tape-measure verification for cp09: inspectEvaluatedGeometry at rest /
// Y=-30 / Y=+30 for headwear, ears, back_top_hair, curtains and front hair,
// then per-band vertical displacement, max |dx|, junction sync, hat/bangs slip
// and ear immobility numbers.
// Usage: node measure.mjs [run|report]
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";

const rc = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8"));
const rcs = rc.rigControls ?? rc;
const TOWERS = ["rig_facex_headwear", "rig_facex_ears_r", "rig_facex_ears_l",
  "rig_facex_back_top_hair_r", "rig_facex_back_top_hair_l",
  "rig_facex_back_hair_r", "rig_facex_back_hair_l", "rig_facex_hair_front"];
const drawOf = {};
for (const id of TOWERS) drawOf[id] = rcs.find((r) => r.rigControlId === id).childDrawableIds[0];

const mode = process.argv[2] ?? "run";
const cases = [["rest", {}], ["ymin", { param_face_angle_y: -30 }], ["ymax", { param_face_angle_y: 30 }]];

if (mode === "run") {
  for (const [label, overrides] of cases) {
    const spec = {
      command: "inspectEvaluatedGeometry",
      payload: {
        ...(Object.keys(overrides).length ? { parameterOverrides: overrides } : {}),
        targets: Object.values(drawOf).map((drawableId) => ({ kind: "drawable", drawableId })),
        includeVertices: true
      }
    };
    const p = join(HERE, "commands", `measure-${label}.json`);
    writeFileSync(p, JSON.stringify(spec));
    console.log(`== measure-${label}`);
    execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
  }
  if (process.argv[3] !== "report") process.exit(0);
}

const load = (label) => {
  const resp = JSON.parse(readFileSync(join(HERE, "commands", `measure-${label}.response.json`), "utf8"));
  const arr = resp.aiCommandResponse.payload.results;
  const out = {};
  for (const t of arr) out[t.drawableId] = t.vertices;
  return out;
};
const rest = load("rest"), ymin = load("ymin"), ymax = load("ymax");

const bandStat = (id, y0, y1, x0 = -1e9, x1 = 1e9) => {
  const d = drawOf[id];
  const r = rest[d], a = ymin[d], b = ymax[d];
  let n = 0, sMin = 0, sMax = 0, maxDx = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i].y < y0 || r[i].y >= y1 || r[i].x < x0 || r[i].x >= x1) continue;
    n++;
    sMin += a[i].y - r[i].y; sMax += b[i].y - r[i].y;
    maxDx = Math.max(maxDx, Math.abs(a[i].x - r[i].x), Math.abs(b[i].x - r[i].x));
  }
  return n ? { n, dyMin: sMin / n, dyMax: sMax / n, maxDx } : null;
};

console.log("element band              n    dy@min   dy@max   max|dx|");
const BANDS = [
  ["rig_facex_headwear", [[89, 152, "ears+slack"], [152, 235, "upper-dome"], [235, 292, "mid-dome"], [292, 395, "brim-band"]]],
  ["rig_facex_ears_r", [[411, 508, "whole"]]],
  ["rig_facex_ears_l", [[411, 508, "whole"]]],
  ["rig_facex_back_top_hair_r", [[257, 360, "hat-sliver"], [360, 600, "mid"], [600, 790, "sync-band"]]],
  ["rig_facex_back_top_hair_l", [[252, 360, "hat-sliver"], [360, 600, "mid"], [600, 790, "sync-band"]]],
  ["rig_facex_hair_front", [[300, 430, "forehead"], [430, 520, "eye-row"]]]
];
for (const [id, bands] of BANDS) {
  for (const [y0, y1, label] of bands) {
    const s = bandStat(id, y0, y1);
    if (!s) continue;
    console.log(` ${id.replace("rig_facex_", "").padEnd(17)} ${label.padEnd(11)} ${String(s.n).padStart(4)} ${s.dyMin.toFixed(1).padStart(8)} ${s.dyMax.toFixed(1).padStart(8)} ${s.maxDx.toFixed(2).padStart(8)}`);
  }
}

// hat: crown-top appearance (pole rows vs brim rows @ center columns)
const pole = bandStat("rig_facex_headwear", 89, 130, 950, 1055);
const brimC = bandStat("rig_facex_headwear", 260, 300, 950, 1055);
if (pole && brimC) {
  console.log(`crown stretch (center cols): pole ${pole.dyMin.toFixed(1)}/${pole.dyMax.toFixed(1)} vs brim ${brimC.dyMin.toFixed(1)}/${brimC.dyMax.toFixed(1)}` +
    `  -> extent change min ${(brimC.dyMin - pole.dyMin).toFixed(1)}px (opens) / max ${(brimC.dyMax - pole.dyMax).toFixed(1)}px (folds)`);
}
// cat ear tips vs bases (ear columns)
for (const [label, x0, x1] of [["catL", 845, 905], ["catR", 1105, 1180]]) {
  const tip = bandStat("rig_facex_headwear", 89, 112, x0, x1);
  const base = bandStat("rig_facex_headwear", 135, 160, x0, x1);
  if (tip && base) console.log(`${label}: tip ${tip.dyMin.toFixed(1)}/${tip.dyMax.toFixed(1)} vs base ${base.dyMin.toFixed(1)}/${base.dyMax.toFixed(1)} -> forward-tilt squash min ${(tip.dyMin - base.dyMin).toFixed(1)}px`);
}
// bt junction vs curtain (y720-790)
for (const side of ["r", "l"]) {
  const bt = bandStat(`rig_facex_back_top_hair_${side}`, 720, 790);
  const cu = bandStat(`rig_facex_back_hair_${side}`, 720, 790);
  if (bt && cu) console.log(`junction ${side}: bt ${bt.dyMin.toFixed(1)}/${bt.dyMax.toFixed(1)} vs curtain ${cu.dyMin.toFixed(1)}/${cu.dyMax.toFixed(1)} (must stay within lattice-interp diff)`);
}
// hat vs bangs slip in the scallop band (drawn-region proxies)
const hatBrim = bandStat("rig_facex_headwear", 300, 380);
const bangs = bandStat("rig_facex_hair_front", 300, 380);
if (hatBrim && bangs) console.log(`scallop band slip: hat ${hatBrim.dyMin.toFixed(1)}/${hatBrim.dyMax.toFixed(1)} vs bangs ${bangs.dyMin.toFixed(1)}/${bangs.dyMax.toFixed(1)}`);
// ear immobility proof
for (const side of ["r", "l"]) {
  const e = bandStat(`rig_facex_ears_${side}`, 411, 508);
  if (e) console.log(`ear ${side} pivot: |dy| min-key ${Math.abs(e.dyMin).toFixed(2)} / max-key ${Math.abs(e.dyMax).toFixed(2)} (vs face shell ~19/-15: pivot, alive, no dead band)`);
}
