// cp13fix2 measured verification on EVALUATED VERTICES (rev 393).
//
// A) Mechanism (hard PASS/FAIL): measured displacement at z=+-30 equals
//    bilinear(fix2 design grid)(p_rest) for the 4 strands; front hair stays
//    R(p + cp13 corr grid); back_top L/R stay exact rotation; neck byte-static.
// B) UNIFORMITY (the fix2 gate number): mid-band vs tip-band displacement.
//    fix1 ("before", computed as bilinear(fix1 grids) on the same vertices):
//    mid-band dx ~ 0 while tips carry ~+55px — the inversion. fix2 must give
//    "whole strand ~ uniform d_att; mid-tip difference = plumb term only".
// C) Occlusion sync: hidden root bands (curtains y <= yHead_new, x inside the
//    back_top cover) measured vs exact rotation — reported in px (lattice
//    softening between rows is the only source).
// D) Plumb presence: measured bottom band minus (d_att-uniform prediction) =
//    the plumb delta as rendered (reported with sign).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DV13 = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const DVF = JSON.parse(readFileSync(join(HERE, "design-fix-values.json"), "utf8"));
const DV2 = JSON.parse(readFileSync(join(HERE, "design-fix2-values.json"), "utf8"));
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
  hair_f_r: { drawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r", mode: "full", midFrom: 450, midTo: 850, tipFrom: 850 },
  hair_f_l: { drawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l", mode: "full", midFrom: 480, midTo: 850, tipFrom: 850 },
  back_hair_r: { drawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r", mode: "full", midFrom: 550, midTo: 1150, tipFrom: 1300, hiddenTo: 424, hiddenX: [793, 969] },
  back_hair_l: { drawable: "draw_r0_1cea4f6f_f2691750_back_hair_l", mode: "full", midFrom: 550, midTo: 1150, tipFrom: 1300, hiddenTo: 426, hiddenX: [1032, 1208] }
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
  const d2 = DV2.fix2.find((x) => x.sig === sig);
  el.gridMin = d2.keys.find((k) => k.value === -30).statePatch;
  el.gridMax = d2.keys.find((k) => k.value === 30).statePatch;
  const d1 = (DVF.f2.find((x) => x.sig === sig) ?? DVF.f1.find((x) => x.sig === sig));
  el.gridMinF1 = d1.keys.find((k) => k.value === -30).statePatch;
  el.gridMaxF1 = d1.keys.find((k) => k.value === 30).statePatch;
  el.att = DV2.ATT[key];
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
  const p = join(HERE, "commands", `assert-fix2-geom-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `assert-fix2-geom-${label}.response.json`), "utf8"));
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
    const collect = { mid: { dx: [], dy: [] }, tip: { dx: [], dy: [] } };
    const before = { mid: { dx: [], dy: [] }, tip: { dx: [], dy: [] } };
    const fB1 = el.mode === "full" ? bilinear(el.control, theta < 0 ? el.gridMinF1 : el.gridMaxF1) : null;
    let occErr = 0, occDesign = 0, occN = 0;
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
      const pre = fB1(v.x, v.y);
      if (v.y >= el.midFrom && v.y < el.midTo) {
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
        // the design's own softening at this vertex (bilinear rows straddling
        // the 60px transition linearize it): the honest bound is the design
        // value itself; its px size is REPORTED and judged on the renders.
        const d = fB(v.x, v.y);
        occDesign = Math.max(occDesign, Math.hypot(d.x - e.x, d.y - e.y));
        occN += 1;
      }
    });
    check(`${key} mechanism (${el.mode === "corr" ? "R(p + cp13 corr) UNCHANGED" : "bilinear FIX2 design grid"})`,
      mechErr < 0.01, `maxErr=${mechErr.toExponential(2)}`);
    if (el.mode !== "full") continue;
    const dAtt = rot(el.att.x, el.att.y, theta);
    const S = (o) => ({ sx: stats(o.dx), sy: stats(o.dy) });
    const mid = S(collect.mid), tip = S(collect.tip);
    const midB = S(before.mid), tipB = S(before.tip);
    console.log(`     ${key} d_att(centroid)=(${f1n(dAtt.x)},${f1n(dAtt.y)})`);
    console.log(`       mid band  (rest y ${el.midFrom}..${el.midTo}) before: ${band(midB)}`);
    console.log(`                                        after:  ${band(mid)}`);
    console.log(`       tip band  (rest y>=${el.tipFrom})      before: ${band(tipB)}`);
    console.log(`                                        after:  ${band(tip)}`);
    console.log(`       mid-tip dx gap: before ${f1n(Math.abs(tipB.sx.mean - midB.sx.mean))}px -> after ${f1n(Math.abs(tip.sx.mean - mid.sx.mean))}px` +
      `${el.hiddenTo ? " (plumb only)" : ""}`);
    if (el.hiddenTo) {
      check(`${key} hidden root band (y<=${el.hiddenTo}, behind back_top): deviation from exact rotation == design's lattice softening (no extra source)`,
        occErr <= occDesign + 0.01,
        `measured max ${f1n(occErr)}px vs design softening ${f1n(occDesign)}px over ${occN} vertices (visibility judged on fix2-zoom-seam/head renders)`);
      // plumb presence on the bottom band: design value minus the per-column
      // d_att carry (d_att depends on x) = the plumb delta as rendered.
      const dPx = [], dPy = [];
      rest[el.drawable].forEach((v) => {
        if (v.y < 1450) return;
        const a = fB(v.x, v.y), dc = rot(v.x, el.att.y, theta);
        dPx.push(a.x - dc.x); dPy.push(a.y - dc.y);
      });
      const px = stats(dPx), py = stats(dPy);
      console.log(`       plumb delta on bottom band (rest y>=1450, n=${px.n}): dx mean ${f1n(px.mean)} [${f1n(px.lo)}..${f1n(px.hi)}]  dy mean ${f1n(py.mean)}`);
    }
  }
}
console.log(failures === 0 ? "\nASSERT-FIX2-MEASURED: ALL PASS" : `\nASSERT-FIX2-MEASURED: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
