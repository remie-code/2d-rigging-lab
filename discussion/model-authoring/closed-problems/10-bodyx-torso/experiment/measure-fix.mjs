// cp10fix tape measure: collar tilt asymmetry (dy), boosted center translation,
// knot follow, compressed pin band, untouched-element spot checks.
// Usage: node measure-fix.mjs run|report|run report
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRAW = {
  topwear: "draw_r0_1cea4f6f_26f93e8b_topwear",
  bottomwear: "draw_r0_1cea4f6f_26f93eaa_bottomwear",
  handwear_r: "draw_r0_1cea4f6f_26f93ee8_handwear-r",
  handwear_l: "draw_r0_1cea4f6f_26f93ec9_handwear-l",
  tie: "draw_r0_1cea4f6f_ea30e9c4_tie",
  neck: "draw_r0_1cea4f6f_691e2eb3_neck",
  neck_back: "draw_r0_1cea4f6f_691e2e90_neck_back"
};

const mode = process.argv.slice(2);
if (!mode.length) mode.push("run", "report");
const cases = [["rest", {}], ["bmin", { param_body_angle_x: -10 }], ["bmax", { param_body_angle_x: 10 }]];

if (mode.includes("run")) {
  for (const [label, overrides] of cases) {
    const spec = {
      command: "inspectEvaluatedGeometry",
      payload: {
        ...(Object.keys(overrides).length ? { parameterOverrides: overrides } : {}),
        targets: Object.values(DRAW).map((drawableId) => ({ kind: "drawable", drawableId })),
        includeVertices: true
      }
    };
    const p = join(HERE, "commands", `measure-fix-${label}.json`);
    writeFileSync(p, JSON.stringify(spec));
    console.log(`== measure-fix-${label}`);
    execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
  }
}
if (!mode.includes("report")) process.exit(0);

const load = (label) => {
  const resp = JSON.parse(readFileSync(join(HERE, "commands", `measure-fix-${label}.response.json`), "utf8"));
  const out = {};
  for (const t of resp.aiCommandResponse.payload.results) out[t.drawableId] = t.vertices;
  return out;
};
const rest = load("rest"), bmin = load("bmin"), bmax = load("bmax");

const band = (key, y0, y1, x0 = -1e9, x1 = 1e9) => {
  const d = DRAW[key], r = rest[d], a = bmin[d], b = bmax[d];
  let n = 0, sxMin = 0, sxMax = 0, syMin = 0, syMax = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i].y < y0 || r[i].y >= y1 || r[i].x < x0 || r[i].x >= x1) continue;
    n++;
    sxMin += a[i].x - r[i].x; sxMax += b[i].x - r[i].x;
    syMin += a[i].y - r[i].y; syMax += b[i].y - r[i].y;
  }
  return n ? { n, dxMin: sxMin / n, dxMax: sxMax / n, dyMin: syMin / n, dyMax: syMax / n } : null;
};
const row = (label, s) => s && console.log(
  ` ${label.padEnd(38)} ${String(s.n).padStart(4)} ${s.dxMin.toFixed(1).padStart(7)} ${s.dyMin.toFixed(1).padStart(6)} ${s.dxMax.toFixed(1).padStart(7)} ${s.dyMax.toFixed(1).padStart(6)}`);

console.log("band                                      n   dx@min dy@min  dx@max dy@max");
row("collar far-L (835-935, 577-660)", band("topwear", 577, 660, 835, 935));
row("collar center (960-1035, 577-660)", band("topwear", 577, 660, 960, 1035));
row("collar near-R (1060-1160, 577-660)", band("topwear", 577, 660, 1060, 1160));
row("shoulder line L (790-900, 655-700)", band("topwear", 655, 700, 790, 900));
row("shoulder line R (1095-1205, 655-700)", band("topwear", 655, 700, 1095, 1205));
row("silhouette L col (<800, 690-760)", band("topwear", 690, 760, -1e9, 800));
row("silhouette R col (>1195, 690-760)", band("topwear", 690, 760, 1195));
row("chest (760-900)", band("topwear", 760, 900));
row("midriff (900-1050)", band("topwear", 900, 1050));
row("pre-free band (1050-1066)", band("topwear", 1050, 1066));
row("pin transition (1066-1117)", band("topwear", 1066, 1117));
row("HEM (1117-1150)", band("topwear", 1117, 1150));
row("skirt all (static proof)", band("bottomwear", 1100, 1700));
row("tie knot (643-714)", band("tie", 643, 714));
row("tie blade top (714-821)", band("tie", 714, 821));
row("tie blade mid (900-1000)", band("tie", 900, 1000));
row("tie tip (1150-1210)", band("tie", 1150, 1210));
row("neck top (547-580) [untouched]", band("neck", 547, 580));
row("neck visible (580-645) [untouched]", band("neck", 580, 645));
row("armR cap (660-760) [untouched]", band("handwear_r", 660, 760));
row("armL cap (660-760) [untouched]", band("handwear_l", 660, 760));

const fL = band("topwear", 577, 660, 835, 935), nR = band("topwear", 577, 660, 1060, 1160);
console.log(`\nTILT ASYMMETRY @max(+10, faces screen-right): far-L collar dy ${fL.dyMax.toFixed(1)} (rises=steepens), near-R dy ${nR.dyMax.toFixed(1)} (drops=lies down)`);
console.log(`TILT ASYMMETRY @min(-10, faces screen-left): far-R collar dy ${nR.dyMin.toFixed(1)} (rises), near-L dy ${fL.dyMin.toFixed(1)} (drops)`);
const cc = band("topwear", 577, 660, 960, 1035), kn = band("tie", 643, 714);
console.log(`CENTER BOOST: collar center dx ${cc.dxMin.toFixed(1)}/${cc.dxMax.toFixed(1)} (cp10 was ~ -9.9/+9.9) | knot dx ${kn.dxMin.toFixed(1)}/${kn.dxMax.toFixed(1)} -> knot follows the V`);
const mid = band("topwear", 900, 1050), hem = band("topwear", 1117, 1150);
console.log(`PIN COMPRESSION: midriff now ${mid.dxMin.toFixed(1)}/${mid.dxMax.toFixed(1)} (cp10 was ~ -0.9/+0.9), hem ${hem.dxMin.toFixed(1)}/${hem.dxMax.toFixed(1)} (still pinned)`);
