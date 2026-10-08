// Tape-measure verification for cp10: inspectEvaluatedGeometry at rest /
// BodyX=-10 / BodyX=+10 for the 7 body drawables, then per-band horizontal
// displacement stats: shoulder girdle vs hem (waist pin), tie root vs tip
// (ribbon carriage), arm cap vs hand (root carriage + width swap), neck
// top vs bottom (H ramp), skirt immobility, and max |dy| (must be 0).
// Usage: node measure.mjs run|report|run report
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
    const p = join(HERE, "commands", `measure-${label}.json`);
    writeFileSync(p, JSON.stringify(spec));
    console.log(`== measure-${label}`);
    execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
  }
}
if (!mode.includes("report")) process.exit(0);

const load = (label) => {
  const resp = JSON.parse(readFileSync(join(HERE, "commands", `measure-${label}.response.json`), "utf8"));
  const out = {};
  for (const t of resp.aiCommandResponse.payload.results) out[t.drawableId] = t.vertices;
  return out;
};
const rest = load("rest"), bmin = load("bmin"), bmax = load("bmax");

let globalMaxDy = 0;
const band = (key, y0, y1, x0 = -1e9, x1 = 1e9) => {
  const d = DRAW[key];
  const r = rest[d], a = bmin[d], b = bmax[d];
  let n = 0, sMin = 0, sMax = 0, maxDy = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i].y < y0 || r[i].y >= y1 || r[i].x < x0 || r[i].x >= x1) continue;
    n++;
    sMin += a[i].x - r[i].x; sMax += b[i].x - r[i].x;
    maxDy = Math.max(maxDy, Math.abs(a[i].y - r[i].y), Math.abs(b[i].y - r[i].y));
  }
  globalMaxDy = Math.max(globalMaxDy, maxDy);
  return n ? { n, dxMin: sMin / n, dxMax: sMax / n, maxDy } : null;
};
const row = (label, s) => s && console.log(
  ` ${label.padEnd(34)} ${String(s.n).padStart(4)} ${s.dxMin.toFixed(1).padStart(8)} ${s.dxMax.toFixed(1).padStart(8)} ${s.maxDy.toFixed(2).padStart(8)}`);

console.log("band                                  n   dx@min   dx@max   max|dy|");
row("shirt collar (577-650)", band("topwear", 577, 650));
row("shirt girdle (650-730)", band("topwear", 650, 730));
row("shirt girdle center cols", band("topwear", 650, 730, 930, 1065));
row("shirt chest (730-900)", band("topwear", 730, 900));
row("shirt midriff (900-1050)", band("topwear", 900, 1050));
row("shirt pre-hem (1050-1119)", band("topwear", 1050, 1119));
row("shirt HEM = PIN (1119-1150)", band("topwear", 1119, 1150));
row("skirt top band (1119-1200)", band("bottomwear", 1119, 1200));
row("skirt all (static proof)", band("bottomwear", 1100, 1700));
row("tie knot (640-720)", band("tie", 640, 720));
row("tie mid (900-1000)", band("tie", 900, 1000));
row("tie tip (1150-1210)", band("tie", 1150, 1210));
row("armR cap (660-760)", band("handwear_r", 660, 760));
row("armR chest inner (760-900,x>820)", band("handwear_r", 760, 900, 820));
row("armR chest outer (760-900,x<780)", band("handwear_r", 760, 900, -1e9, 780));
row("armR elbow (1250-1400)", band("handwear_r", 1250, 1400));
row("armR hand (1450-1600)", band("handwear_r", 1450, 1600));
row("armL cap (660-760)", band("handwear_l", 660, 760));
row("armL chest inner (760-900,x<1180)", band("handwear_l", 760, 900, -1e9, 1180));
row("armL chest outer (760-900,x>1220)", band("handwear_l", 760, 900, 1220));
row("armL elbow (1250-1400)", band("handwear_l", 1250, 1400));
row("armL hand (1450-1600)", band("handwear_l", 1450, 1600));
row("neck top (547-580)", band("neck", 547, 580));
row("neck visible (580-645)", band("neck", 580, 645));
row("neck_back (566-640)", band("neck_back", 566, 640));

// derived judgments
const girdle = band("topwear", 650, 730, 930, 1065);
const hem = band("topwear", 1119, 1150);
console.log(`\nWAIST PIN: girdle center ${girdle.dxMin.toFixed(1)}/${girdle.dxMax.toFixed(1)} vs hem ${hem.dxMin.toFixed(1)}/${hem.dxMax.toFixed(1)} (shoulders swing, hem stays)`);
const knot = band("tie", 640, 720), tip = band("tie", 1150, 1210);
console.log(`TIE CARRIAGE: knot ${knot.dxMin.toFixed(1)}/${knot.dxMax.toFixed(1)} -> tip ${tip.dxMin.toFixed(1)}/${tip.dxMax.toFixed(1)} (translation carried, ribbon rides the collar)`);
const capR = band("handwear_r", 660, 760), handR = band("handwear_r", 1450, 1600);
const capL = band("handwear_l", 660, 760), handL = band("handwear_l", 1450, 1600);
console.log(`ARM CARRIAGE R: cap ${capR.dxMin.toFixed(1)}/${capR.dxMax.toFixed(1)} -> hand ${handR.dxMin.toFixed(1)}/${handR.dxMax.toFixed(1)} (anchor D_r = -1.86/+7.47)`);
console.log(`ARM CARRIAGE L: cap ${capL.dxMin.toFixed(1)}/${capL.dxMax.toFixed(1)} -> hand ${handL.dxMin.toFixed(1)}/${handL.dxMax.toFixed(1)} (anchor D_l = -7.22/+1.43)`);
const nt = band("neck", 547, 580), nv = band("neck", 580, 645);
console.log(`NECK COLUMN: top ${nt.dxMin.toFixed(1)}/${nt.dxMax.toFixed(1)} vs visible ${nv.dxMin.toFixed(1)}/${nv.dxMax.toFixed(1)} (alpha-matched head joint / shoulder share)`);
console.log(`GLOBAL max|dy| = ${globalMaxDy.toFixed(3)} (BodyX is a horizontal affair; must be ~0)`);
