// Tape-measure verification for cp08: runs inspectEvaluatedGeometry at rest /
// Y=-30 / Y=+30 for the 8 wrapped materials, then reports per-band vertical
// displacement, max |dx|, and the eyewear rigid (affine) fit.
// Usage: node measure.mjs [run|report]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";

const rc = JSON.parse(readFileSync(`${PKG}/model/rig-controls.json`, "utf8"));
const rcs = rc.rigControls ?? rc;
const TOWERS = ["rig_facex_hair_front", "rig_facex_hair_f_r", "rig_facex_hair_f_l",
  "rig_facex_back_hair_r", "rig_facex_back_hair_l",
  "rig_facex_back_top_hair_r", "rig_facex_back_top_hair_l", "rig_facex_eyewear"];
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
}

// ---- report ----
const load = (label) => {
  const resp = JSON.parse(readFileSync(join(HERE, "commands", `measure-${label}.response.json`), "utf8"));
  const arr = resp.aiCommandResponse.payload.results;
  const out = {};
  for (const t of arr) out[t.drawableId] = t.vertices;
  return out;
};
const rest = load("rest"), ymin = load("ymin"), ymax = load("ymax");

const bandStat = (id, y0, y1) => {
  const d = drawOf[id];
  const r = rest[d], a = ymin[d], b = ymax[d];
  let n = 0, sMin = 0, sMax = 0, maxDx = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i].y < y0 || r[i].y >= y1) continue;
    n++;
    sMin += a[i].y - r[i].y; sMax += b[i].y - r[i].y;
    maxDx = Math.max(maxDx, Math.abs(a[i].x - r[i].x), Math.abs(b[i].x - r[i].x));
  }
  return n ? { n, dyMin: sMin / n, dyMax: sMax / n, maxDx } : null;
};

console.log("element band            n    dy@min   dy@max   max|dx|");
const BANDS = [
  ["rig_facex_hair_front", [[135, 300, "crown"], [300, 430, "forehead"], [430, 520, "eye-row"], [520, 780, "fringe/tail"]]],
  ["rig_facex_hair_f_r", [[227, 450, "root"], [450, 620, "cheek/jaw"], [620, 850, "transition"], [850, 960, "tip"]]],
  ["rig_facex_hair_f_l", [[227, 450, "root"], [450, 620, "cheek/jaw"], [620, 850, "transition"], [850, 1010, "tip"]]],
  ["rig_facex_back_hair_r", [[300, 470, "root"], [470, 620, "nape"], [620, 1000, "transition"], [1000, 1900, "hanging"]]],
  ["rig_facex_back_hair_l", [[300, 470, "root"], [470, 620, "nape"], [620, 1000, "transition"], [1000, 1900, "hanging"]]],
  ["rig_facex_back_top_hair_r", [[257, 360, "hat-sliver"], [360, 600, "mid"], [600, 790, "sync-band"]]],
  ["rig_facex_back_top_hair_l", [[252, 360, "hat-sliver"], [360, 600, "mid"], [600, 790, "sync-band"]]]
];
for (const [id, bands] of BANDS) {
  for (const [y0, y1, label] of bands) {
    const s = bandStat(id, y0, y1);
    if (!s) continue;
    console.log(` ${id.replace("rig_facex_", "").padEnd(16)} ${label.padEnd(12)} ${String(s.n).padStart(4)} ${s.dyMin.toFixed(1).padStart(8)} ${s.dyMax.toFixed(1).padStart(8)} ${s.maxDx.toFixed(2).padStart(8)}`);
  }
}

// curtain root sync vs back_top_hair at the junction rows (y740-790)
for (const side of ["r", "l"]) {
  const bt = bandStat(`rig_facex_back_top_hair_${side}`, 720, 790);
  const cu = bandStat(`rig_facex_back_hair_${side}`, 720, 790);
  if (bt && cu) console.log(`sync ${side}: bt dy(min/max) ${bt.dyMin.toFixed(1)}/${bt.dyMax.toFixed(1)} vs curtain ${cu.dyMin.toFixed(1)}/${cu.dyMax.toFixed(1)}`);
}

// eyewear rigid fit: dy = slope*(y-459) + D per key, report residuals
const d = drawOf["rig_facex_eyewear"];
for (const [label, defo] of [["min", ymin], ["max", ymax]]) {
  const r = rest[d], a = defo[d];
  let sy = 0, syy = 0, sv = 0, svy = 0, n = r.length, maxDx = 0;
  for (let i = 0; i < n; i++) {
    const yy = r[i].y - 459, dv = a[i].y - r[i].y;
    sy += yy; syy += yy * yy; sv += dv; svy += dv * yy;
    maxDx = Math.max(maxDx, Math.abs(a[i].x - r[i].x));
  }
  const slope = (n * svy - sy * sv) / (n * syy - sy * sy);
  const D = (sv - slope * sy) / n;
  let maxRes = 0;
  for (let i = 0; i < n; i++) {
    const yy = r[i].y - 459, dv = a[i].y - r[i].y;
    maxRes = Math.max(maxRes, Math.abs(dv - (slope * yy + D)));
  }
  console.log(`eyewear ${label}: slope ${slope.toFixed(5)} D ${D.toFixed(2)} maxResidual ${maxRes.toFixed(3)}px maxDx ${maxDx.toFixed(3)} (n=${n})`);
}

// eye-vs-lens tracking: committed eye aperture center displacement vs eyewear at anchors
const kf = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kf.keyformSets ?? kf;
const eyeSet = (id) => kfs.find((s) => s.target?.id === id && s.parameterId === "param_face_angle_y");
console.log("(lens-anchor tracking is asserted in gen; see design-log for values)");
