// cp13fix3 measured verification on EVALUATED VERTICES (rev 401).
//
// A) Mechanism (hard PASS/FAIL): measured displacement at z=+-30 equals
//    bilinear(fix3 design grid)(p_rest) for the 4 strands; front hair stays
//    R(p + cp13 corr grid); back_top L/R stay exact rotation; neck byte-static.
// B) SCALP BAND (the fix3 gate check #1): vertices with rest y <= y_scalp
//    measured vs EXACT ROTATION — the hair-growing region must turn with the
//    head. Deviation bounded by the design's own lattice softening (reported
//    in px; the only source is bilinear between rows straddling the sharp
//    transition).
// C) HANGING BAND (gate check #2): mid-band vs tip-band displacement.
//    before (fix2 grids on the same vertices): whole strand carried d_att
//    (dx 41..55px, over-swing). fix3 must give "whole hanging band ~ uniform
//    d_scalp (dx 8..18px, the modest oblique vector); mid-tip difference =
//    plumb term only".
// D) Occlusion sync: hidden curtain roots (y <= 424/426, x inside the back_top
//    cover) vs exact rotation — now INSIDE the scalp band, so the deviation
//    must collapse to bilinear rounding (fix2 had 3.1/11.3px softening here).
// E) Plumb presence: design bottom band minus the per-column d_scalp carry =
//    the plumb delta as rendered (byte-preserved from fix1/fix2).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DV13 = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const DV2 = JSON.parse(readFileSync(join(HERE, "design-fix2-values.json"), "utf8"));
const DV3 = JSON.parse(readFileSync(join(HERE, "design-fix3-values.json"), "utf8"));
const PIVOT = DV13.PIVOT, THETA = DV13.THETA_MAX_DEG;

const rot = (x, y, thetaDeg) => {
  const t = (thetaDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const u = x - PIVOT.x, v = y - PIVOT.y;
  return { x: c * u - s * v - u, y: s * u + c * v - v };
};
const bilinear = (control, gridVals) => (x, y) => {
  const { domain, cols, rows } = control;
  const fx = ((x - domain.x) / domain.width) * (cols - 1);
  const fy = ((y - domain.y) / domain.height) * (rows - 1);
  const cx = Math.min(cols - 2, Math.max(0, Math.floor(fx)));
  const cy = Math.min(rows - 2, Math.max(0, Math.floor(fy)));
  const tx = fx - cx, ty = fy - cy;
  const g = (r, c) => gridVals[r * cols + c];
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  return lerp(lerp(g(cy, cx), g(cy, cx + 1), tx), lerp(g(cy + 1, cx), g(cy + 1, cx + 1), tx), ty);
};

const ELEMS = {
  hair_front: { drawable: "draw_r0_1cea4f6f_21b4dac0_front_hair", mode: "corr" },
  hair_f_r: { drawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r", mode: "full", midTo: 850, tipFrom: 850 },
  hair_f_l: { drawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l", mode: "full", midTo: 850, tipFrom: 850 },
  back_hair_r: { drawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r", mode: "full", midTo: 1150, tipFrom: 1300, hiddenTo: 424, hiddenX: [793, 969] },
  back_hair_l: { drawable: "draw_r0_1cea4f6f_f2691750_back_hair_l", mode: "full", midTo: 1150, tipFrom: 1300, hiddenTo: 426, hiddenX: [1032, 1208] }
};
for (const d of DV13.design) {
  const key = d.control.id.replace(/^rig_facez_/, "");
  if (!ELEMS[key]) continue;
  ELEMS[key].control = d.control;
  if (key === "hair_front") {
    ELEMS[key].gridMin = d.keys.find((k) => k.value === -30).statePatch;
    ELEMS[key].gridMax = d.keys.find((k) => k.value === 30).statePatch;
  }
}
for (const [key, el] of Object.entries(ELEMS)) {
  if (el.mode === "corr") continue;
  const sig = `rigControl:rig_facez_${key}:param_face_angle_z`;
  const d3 = DV3.fix3.find((x) => x.sig === sig);
  el.gridMin = d3.keys.find((k) => k.value === -30).statePatch;
  el.gridMax = d3.keys.find((k) => k.value === 30).statePatch;
  const d2 = DV2.fix2.find((x) => x.sig === sig);
  el.gridMinF2 = d2.keys.find((k) => k.value === -30).statePatch;
  el.gridMaxF2 = d2.keys.find((k) => k.value === 30).statePatch;
  el.dial = DV3.DIALS[key];
  el.att = DV3.ATT[key];
}
const ROTATION_MEMBERS = [
  "draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r",
  "draw_r131_0bbc8ea5_f823b423_back_top_hair_l"
];
const CONTROL_STATIC = ["draw_r0_1cea4f6f_691e2eb3_neck"];
const ALL = [...Object.values(ELEMS).map((e) => e.drawable), ...ROTATION_MEMBERS, ...CONTROL_STATIC];

const inspect = (overrides, label) => {
  const spec = {
    command: "inspectEvaluatedGeometry",
    payload: {
      targets: ALL.map((id) => ({ kind: "drawable", drawableId: id })),
      includeVertices: true,
      ...(overrides ? { parameterOverrides: overrides } : {})
    }
  };
  const p = join(HERE, "commands", `assert-fix3-geom-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `assert-fix3-geom-${label}.response.json`), "utf8"));
  return Object.fromEntries(r.aiCommandResponse.payload.results.map((x) =>
    [x.drawableId, x.vertices ?? x.evaluatedVertices]));
};

const rest = inspect(undefined, "rest");
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
  if (!ok) failures += 1;
};
const stats = (arr) => ({
  mean: arr.reduce((a, b) => a + b, 0) / arr.length,
  lo: Math.min(...arr), hi: Math.max(...arr), n: arr.length
});
const f1n = (v) => v.toFixed(1);
const band = (s) => `dx mean ${f1n(s.sx.mean)} [${f1n(s.sx.lo)}..${f1n(s.sx.hi)}]  dy mean ${f1n(s.sy.mean)} [${f1n(s.sy.lo)}..${f1n(s.sy.hi)}] (n=${s.sx.n})`;

for (const [param, theta] of [[-30, -THETA], [30, THETA]]) {
  const got = inspect({ param_face_angle_z: param }, `z${param}`);
  console.log(`\n===== param_face_angle_z = ${param} (theta = ${theta} deg) =====`);
  {
    let maxErr = 0;
    rest[CONTROL_STATIC[0]].forEach((v, i) => {
      const g = got[CONTROL_STATIC[0]][i];
      maxErr = Math.max(maxErr, Math.hypot(g.x - v.x, g.y - v.y));
    });
    check("neck (non-member) static", maxErr === 0, `maxErr=${maxErr}`);
  }
  for (const id of ROTATION_MEMBERS) {
    let maxErr = 0;
    rest[id].forEach((v, i) => {
      const e = rot(v.x, v.y, theta), g = got[id][i];
      maxErr = Math.max(maxErr, Math.hypot(g.x - (v.x + e.x), g.y - (v.y + e.y)));
    });
    check(`${id.split("_").slice(-4).join("_")} = exact rotation (cp12 untouched)`, maxErr < 0.01, `maxErr=${maxErr.toExponential(2)}`);
  }
  for (const [key, el] of Object.entries(ELEMS)) {
    const gridVals = theta < 0 ? el.gridMin : el.gridMax;
    const fB = bilinear(el.control, gridVals);
    let mechErr = 0;
    const collect = { scalp: { dx: [], dy: [] }, mid: { dx: [], dy: [] }, tip: { dx: [], dy: [] } };
    const before = { mid: { dx: [], dy: [] }, tip: { dx: [], dy: [] } };
    const fB2 = el.mode === "full" ? bilinear(el.control, theta < 0 ? el.gridMinF2 : el.gridMaxF2) : null;
    let scalpErr = 0, scalpDesign = 0, scalpN = 0;
    let occErr = 0, occN = 0;
    rest[el.drawable].forEach((v, i) => {
      const g = got[el.drawable][i];
      const meas = { x: g.x - v.x, y: g.y - v.y };
      let expect;
      if (el.mode === "full") {
        expect = fB(v.x, v.y);
      } else {
        const c = fB(v.x, v.y);
        const t = (theta * Math.PI) / 180, cs = Math.cos(t), sn = Math.sin(t);
        const px = v.x + c.x - PIVOT.x, py = v.y + c.y - PIVOT.y;
        expect = { x: PIVOT.x + cs * px - sn * py - v.x, y: PIVOT.y + sn * px + cs * py - v.y };
      }
      mechErr = Math.max(mechErr, Math.hypot(meas.x - expect.x, meas.y - expect.y));
      if (el.mode !== "full") return;
      const pre = fB2(v.x, v.y);
      if (v.y <= el.dial.yScalp) {
        const e = rot(v.x, v.y, theta);
        scalpErr = Math.max(scalpErr, Math.hypot(meas.x - e.x, meas.y - e.y));
        const d = fB(v.x, v.y);
        scalpDesign = Math.max(scalpDesign, Math.hypot(d.x - e.x, d.y - e.y));
        scalpN += 1;
        collect.scalp.dx.push(meas.x); collect.scalp.dy.push(meas.y);
      }
      if (v.y >= el.dial.yScalp + el.dial.trans && v.y < el.midTo) {
        collect.mid.dx.push(meas.x); collect.mid.dy.push(meas.y);
        before.mid.dx.push(pre.x); before.mid.dy.push(pre.y);
      }
      if (v.y >= el.tipFrom) {
        collect.tip.dx.push(meas.x); collect.tip.dy.push(meas.y);
        before.tip.dx.push(pre.x); before.tip.dy.push(pre.y);
      }
      if (el.hiddenTo && v.y <= el.hiddenTo && v.x >= el.hiddenX[0] && v.x <= el.hiddenX[1]) {
        const e = rot(v.x, v.y, theta);
        occErr = Math.max(occErr, Math.hypot(meas.x - e.x, meas.y - e.y));
        occN += 1;
      }
    });
    check(`${key} mechanism (${el.mode === "corr" ? "R(p + cp13 corr) UNCHANGED" : "bilinear FIX3 design grid"})`,
      mechErr < 0.01, `maxErr=${mechErr.toExponential(2)}`);
    if (el.mode !== "full") continue;
    // B) scalp band == exact rotation (bounded by the design's own softening)
    check(`${key} scalp band (y<=${el.dial.yScalp}): deviation from exact rotation == design's lattice softening (no extra source)`,
      scalpErr <= scalpDesign + 0.01,
      `measured max ${f1n(scalpErr)}px vs design softening ${f1n(scalpDesign)}px over ${scalpN} vertices`);
    // D) hidden curtain roots: now strictly inside the scalp band
    if (el.hiddenTo)
      check(`${key} hidden root band (y<=${el.hiddenTo}, behind back_top) ~ exact rotation`,
        occErr < 0.5, `measured max ${f1n(occErr)}px over ${occN} vertices (fix2 had up to 11.3px here)`);
    // C) hanging-band uniformity
    const dS = rot(el.att.x, el.dial.yScalp, theta);
    const S = (o) => ({ sx: stats(o.dx), sy: stats(o.dy) });
    const mid = S(collect.mid), tip = S(collect.tip);
    const midB = S(before.mid), tipB = S(before.tip);
    console.log(`     ${key} d_scalp(centroid col)=(${f1n(dS.x)},${f1n(dS.y)})`);
    console.log(`       hang band (rest y ${el.dial.yScalp + el.dial.trans}..${el.midTo}) before(fix2): ${band(midB)}`);
    console.log(`                                              after(fix3):  ${band(mid)}`);
    console.log(`       tip band  (rest y>=${el.tipFrom})            before(fix2): ${band(tipB)}`);
    console.log(`                                              after(fix3):  ${band(tip)}`);
    console.log(`       mid-tip dx gap: before ${f1n(Math.abs(tipB.sx.mean - midB.sx.mean))}px -> after ${f1n(Math.abs(tip.sx.mean - mid.sx.mean))}px` +
      `${el.hiddenTo ? " (plumb only)" : ""}`);
    // E) plumb presence (curtains): design bottom band minus per-column d_scalp
    if (el.hiddenTo) {
      const dPx = [], dPy = [];
      rest[el.drawable].forEach((v) => {
        if (v.y < 1450) return;
        const a = fB(v.x, v.y), dc = rot(v.x, el.dial.yScalp, theta);
        dPx.push(a.x - dc.x); dPy.push(a.y - dc.y);
      });
      const px = stats(dPx), py = stats(dPy);
      console.log(`       plumb delta on bottom band (rest y>=1450, n=${px.n}): dx mean ${f1n(px.mean)} [${f1n(px.lo)}..${f1n(px.hi)}]  dy mean ${f1n(py.mean)}`);
    }
  }
}
console.log(failures === 0 ? "\nASSERT-FIX3-MEASURED: ALL PASS" : `\nASSERT-FIX3-MEASURED: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
