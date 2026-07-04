// Tape-measure verification for cp11 (the hypothesis' primary numeric test).
// inspectEvaluatedGeometry at rest / BodyX=-10 / BodyX=+10 for the junction
// and overlap drawables, then:
//   1. NECK JUNCTION: face drawable chin band vs neck drawable top band —
//      per-vertex dx difference at body +/-10 (hypothesis: within a few px,
//      no-edit connection).
//   2. HAIR x SHOULDER overlap: back hair / back top hair displacement in the
//      shoulder band vs topwear shoulder band (the hair rides ALPHA x FaceX,
//      the shirt rides the cp10 torso field — report the differential).
//   3. TORSO REGRESSION: the 7 cp10 drawables' evaluated vertices at body
//      +/-10 byte-compare against the pre-op measurement (pre mode).
// Usage: node measure-junction.mjs pre        (before ops: torso baseline)
//        node measure-junction.mjs run report (after ops)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const DRAW = {
  face: "draw_r0_1cea4f6f_5c3cada6_face",
  neck: "draw_r0_1cea4f6f_691e2eb3_neck",
  neck_back: "draw_r0_1cea4f6f_691e2e90_neck_back",
  topwear: "draw_r0_1cea4f6f_26f93e8b_topwear",
  bottomwear: "draw_r0_1cea4f6f_26f93eaa_bottomwear",
  handwear_r: "draw_r0_1cea4f6f_26f93ee8_handwear-r",
  handwear_l: "draw_r0_1cea4f6f_26f93ec9_handwear-l",
  tie: "draw_r0_1cea4f6f_ea30e9c4_tie",
  back_hair_r: "draw_r0_1cea4f6f_f26916b1_back_hair_r",
  back_hair_l: "draw_r0_1cea4f6f_f2691750_back_hair_l",
  back_top_hair_r: "draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r",
  back_top_hair_l: "draw_r131_0bbc8ea5_f823b423_back_top_hair_l",
  hair_front: "draw_r0_1cea4f6f_21b4dac0_front_hair"
};
const TORSO_KEYS = ["neck", "neck_back", "topwear", "bottomwear", "handwear_r", "handwear_l", "tie"];

const cases = [["rest", {}], ["bmin", { param_body_angle_x: -10 }], ["bmax", { param_body_angle_x: 10 }]];
const modes = process.argv.slice(2);
if (!modes.length) modes.push("run", "report");

const measureTo = (prefix) => {
  for (const [label, overrides] of cases) {
    const spec = {
      command: "inspectEvaluatedGeometry",
      payload: {
        ...(Object.keys(overrides).length ? { parameterOverrides: overrides } : {}),
        targets: Object.values(DRAW).map((drawableId) => ({ kind: "drawable", drawableId })),
        includeVertices: true
      }
    };
    const p = join(HERE, "commands", `${prefix}-${label}.json`);
    writeFileSync(p, JSON.stringify(spec));
    console.log(`== ${prefix}-${label}`);
    execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
  }
};

const load = (prefix, label) => {
  const resp = JSON.parse(readFileSync(join(HERE, "commands", `${prefix}-${label}.response.json`), "utf8"));
  const out = {};
  for (const t of resp.aiCommandResponse.payload.results) out[t.drawableId] = t.vertices;
  return out;
};

if (modes.includes("pre")) { measureTo("measurepre"); process.exit(0); }
if (modes.includes("run")) measureTo("measure");
if (!modes.includes("report")) process.exit(0);

const rest = load("measure", "rest"), bmin = load("measure", "bmin"), bmax = load("measure", "bmax");

// ---- 3. torso regression: byte-compare vs pre-op measurement ----
if (existsSync(join(HERE, "commands", "measurepre-rest.response.json"))) {
  const preRest = load("measurepre", "rest"), preMin = load("measurepre", "bmin"), preMax = load("measurepre", "bmax");
  let clean = true;
  for (const key of TORSO_KEYS) {
    const d = DRAW[key];
    for (const [pre, post, label] of [[preRest, rest, "rest"], [preMin, bmin, "bmin"], [preMax, bmax, "bmax"]]) {
      if (JSON.stringify(pre[d]) !== JSON.stringify(post[d])) {
        console.log(`TORSO REGRESSION BROKEN: ${key} @ ${label}`);
        clean = false;
      }
    }
  }
  console.log(clean
    ? `TORSO REGRESSION OK: ${TORSO_KEYS.length} cp10 drawables byte-identical at rest/-10/+10 vs pre-op`
    : "TORSO REGRESSION FAILED (see above)");
} else console.log("(no pre-op measurement found — torso regression skipped)");

// ---- band statistics helper ----
const band = (key, y0, y1, x0 = -1e9, x1 = 1e9) => {
  const d = DRAW[key];
  const r = rest[d], a = bmin[d], b = bmax[d];
  let n = 0, sMin = 0, sMax = 0, maxDyMin = 0, maxDyMax = 0;
  for (let i = 0; i < r.length; i++) {
    if (r[i].y < y0 || r[i].y >= y1 || r[i].x < x0 || r[i].x >= x1) continue;
    n++;
    sMin += a[i].x - r[i].x; sMax += b[i].x - r[i].x;
    maxDyMin = Math.max(maxDyMin, Math.abs(a[i].y - r[i].y));
    maxDyMax = Math.max(maxDyMax, Math.abs(b[i].y - r[i].y));
  }
  return n ? { n, dxMin: sMin / n, dxMax: sMax / n, maxDy: Math.max(maxDyMin, maxDyMax) } : null;
};
const row = (label, s) => s && console.log(
  ` ${label.padEnd(40)} ${String(s.n).padStart(4)} ${s.dxMin.toFixed(2).padStart(8)} ${s.dxMax.toFixed(2).padStart(8)} ${s.maxDy.toFixed(2).padStart(8)}`);

console.log("\nband                                        n   dx@min   dx@max   max|dy|");
row("face chin band (555-585)", band("face", 555, 585));
row("face mid (400-500)", band("face", 400, 500));
row("neck top band (547-585)", band("neck", 547, 585));
row("neck visible (585-645)", band("neck", 585, 645));
row("neck_back (566-640)", band("neck_back", 566, 640));
row("shirt collar (577-650)", band("topwear", 577, 650));
row("shirt shoulder girdle (650-730)", band("topwear", 650, 730));
row("backhairR shoulder band (640-820)", band("back_hair_r", 640, 820));
row("backhairR mid (900-1200)", band("back_hair_r", 900, 1200));
row("backhairR tips (1500-1830)", band("back_hair_r", 1500, 1830));
row("backhairL shoulder band (640-820)", band("back_hair_l", 640, 820));
row("backhairL mid (900-1200)", band("back_hair_l", 900, 1200));
row("backhairL tips (1500-1830)", band("back_hair_l", 1500, 1830));
row("backtophairR lower (600-780)", band("back_top_hair_r", 600, 780));
row("backtophairL lower (600-780)", band("back_top_hair_l", 600, 780));
row("hair_front lower edge (600-770)", band("hair_front", 600, 770));

// ---- 1. NECK JUNCTION: column-matched comparison, face chin vs neck top ----
// For each neck vertex in the top band, find the nearest face vertex in the
// chin band within 12px of x; compare their displacement per key.
const junction = () => {
  const fd = DRAW.face, nd = DRAW.neck;
  const chin = [];
  for (let i = 0; i < rest[fd].length; i++) {
    if (rest[fd][i].y >= 545 && rest[fd][i].y < 592) chin.push(i);
  }
  let worstMin = 0, worstMax = 0, sum = 0, cnt = 0;
  for (let j = 0; j < rest[nd].length; j++) {
    const v = rest[nd][j];
    if (v.y < 547 || v.y >= 585) continue;
    let best = -1, bd = 12;
    for (const i of chin) {
      const dist = Math.abs(rest[fd][i].x - v.x);
      if (dist < bd) { bd = dist; best = i; }
    }
    if (best < 0) continue;
    const gapMin = (bmin[fd][best].x - rest[fd][best].x) - (bmin[nd][j].x - rest[nd][j].x);
    const gapMax = (bmax[fd][best].x - rest[fd][best].x) - (bmax[nd][j].x - rest[nd][j].x);
    worstMin = Math.max(worstMin, Math.abs(gapMin));
    worstMax = Math.max(worstMax, Math.abs(gapMax));
    sum += Math.abs(gapMin) + Math.abs(gapMax); cnt += 2;
    console.log(`  junction pair @x=${v.x.toFixed(0)} y=${v.y.toFixed(0)}: gap min ${gapMin.toFixed(2)}  max ${gapMax.toFixed(2)}`);
  }
  console.log(`NECK JUNCTION: ${cnt / 2} column pairs, mean |gap| ${(sum / cnt).toFixed(2)}px, worst min ${worstMin.toFixed(2)}px / max ${worstMax.toFixed(2)}px`);
};
console.log("\nneck junction (face chin field minus neck top field, per matched column):");
junction();

// ---- 2. hair x shoulder differential ----
const shoulderShirtR = band("topwear", 640, 820, 700, 950);
const shoulderShirtL = band("topwear", 640, 820, 1050, 1300);
const hairR = band("back_hair_r", 640, 820, 700, 950);
const hairL = band("back_hair_l", 640, 820, 1050, 1300);
if (hairR && shoulderShirtR) console.log(`\nHAIR x SHOULDER R: hair ${hairR.dxMin.toFixed(1)}/${hairR.dxMax.toFixed(1)} vs shirt ${shoulderShirtR.dxMin.toFixed(1)}/${shoulderShirtR.dxMax.toFixed(1)} -> differential ${(hairR.dxMin - shoulderShirtR.dxMin).toFixed(1)}/${(hairR.dxMax - shoulderShirtR.dxMax).toFixed(1)}px`);
if (hairL && shoulderShirtL) console.log(`HAIR x SHOULDER L: hair ${hairL.dxMin.toFixed(1)}/${hairL.dxMax.toFixed(1)} vs shirt ${shoulderShirtL.dxMin.toFixed(1)}/${shoulderShirtL.dxMax.toFixed(1)} -> differential ${(hairL.dxMin - shoulderShirtL.dxMin).toFixed(1)}/${(hairL.dxMax - shoulderShirtL.dxMax).toFixed(1)}px`);
