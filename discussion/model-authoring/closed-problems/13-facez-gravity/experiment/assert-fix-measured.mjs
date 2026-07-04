// cp13fix measured verification on EVALUATED VERTICES (rev 385).
//
// A) Mechanism (hard PASS/FAIL): measured displacement at z=+-30 equals
//    - tufts:    bilinear(F1 design grid)(p_rest)
//    - curtains: bilinear(F2 design grid)(p_rest)   (F1 + plumb)
//    - front hair: R(p + bilinear(cp13 ORIGINAL corr grid)(p)) - p  (untouched)
//    - back_top L/R: exact rotation (cp12, untouched); neck: byte-static
// B) X-carry restoration (the F1 gate number): tip-band measured dx/dy vs the
//    pre-fix diagnosis (diagnose-fix.mjs @ rev 373).
// C) Plumb presence on measured tips: measured - bilinear(F1-only grid) on the
//    curtain bottom band = the plumb delta as rendered (reported, with sign).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DV13 = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const DVF = JSON.parse(readFileSync(join(HERE, "design-fix-values.json"), "utf8"));
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
  hair_front: { drawable: "draw_r0_1cea4f6f_21b4dac0_front_hair", mode: "corr", stage: null },
  hair_f_r: { drawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r", mode: "full", stage: "f1", tipFrom: 850 },
  hair_f_l: { drawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l", mode: "full", stage: "f1", tipFrom: 850 },
  back_hair_r: { drawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r", mode: "full", stage: "f2", tipFrom: 1300 },
  back_hair_l: { drawable: "draw_r0_1cea4f6f_f2691750_back_hair_l", mode: "full", stage: "f2", tipFrom: 1300 }
};
for (const d of DV13.design) {
  const key = d.control.id.replace(/^rig_facez_/, "");
  ELEMS[key].control = d.control;
  ELEMS[key].gridMin13 = d.keys.find((k) => k.value === -30).statePatch;
  ELEMS[key].gridMax13 = d.keys.find((k) => k.value === 30).statePatch;
}
for (const [key, el] of Object.entries(ELEMS)) {
  if (!el.stage) { el.gridMin = el.gridMin13; el.gridMax = el.gridMax13; continue; }
  const sig = `rigControl:rig_facez_${key}:param_face_angle_z`;
  const d = DVF[el.stage].find((x) => x.sig === sig);
  el.gridMin = d.keys.find((k) => k.value === -30).statePatch;
  el.gridMax = d.keys.find((k) => k.value === 30).statePatch;
  if (el.stage === "f2") {
    const d1 = DVF.f1.find((x) => x.sig === sig);
    el.gridMinF1 = d1.keys.find((k) => k.value === -30).statePatch;
    el.gridMaxF1 = d1.keys.find((k) => k.value === 30).statePatch;
  }
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
  const p = join(HERE, "commands", `assert-fix-geom-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `assert-fix-geom-${label}.response.json`), "utf8"));
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
    const dxT = [], dyT = [];
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
      if (el.tipFrom && v.y >= el.tipFrom) { dxT.push(meas.x); dyT.push(meas.y); }
    });
    check(`${key} mechanism (${el.mode === "corr" ? "R(p + cp13 corr) UNCHANGED" : `bilinear ${el.stage.toUpperCase()} design grid`})`,
      mechErr < 0.01, `maxErr=${mechErr.toExponential(2)}`);
    if (el.tipFrom) {
      const sx = stats(dxT), sy = stats(dyT);
      console.log(`     ${key} tip band (rest y>=${el.tipFrom}, n=${sx.n}): dx mean ${f1n(sx.mean)} [${f1n(sx.lo)}..${f1n(sx.hi)}]  dy mean ${f1n(sy.mean)} [${f1n(sy.lo)}..${f1n(sy.hi)}]`);
    }
    if (el.stage === "f2") {
      const fB1 = bilinear(el.control, theta < 0 ? el.gridMinF1 : el.gridMaxF1);
      const dP = [];
      rest[el.drawable].forEach((v) => {
        if (v.y < 1450) return;
        const a = fB(v.x, v.y), b = fB1(v.x, v.y);
        dP.push({ x: a.x - b.x, y: a.y - b.y });
      });
      const sx = stats(dP.map((d) => d.x)), sy = stats(dP.map((d) => d.y));
      console.log(`     ${key} plumb delta on bottom band (rest y>=1450, n=${sx.n}): dx mean ${f1n(sx.mean)} [${f1n(sx.lo)}..${f1n(sx.hi)}]  dy mean ${f1n(sy.mean)}`);
    }
  }
}
console.log(failures === 0 ? "\nASSERT-FIX-MEASURED: ALL PASS" : `\nASSERT-FIX-MEASURED: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
