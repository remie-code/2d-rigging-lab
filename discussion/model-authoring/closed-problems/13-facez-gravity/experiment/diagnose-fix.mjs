// cp13fix F1 DIAGNOSIS (read-only, evaluated vertices).
//
// Gate finding F1: tuft / back-hair root-carried displacement lacks its X
// component ("the tufts bob in place"). L0 hypothesis: cp13 reused cp08's
// y_root rows (tuft 550 / curtain 500) verbatim, but the ROTATION field is
// strongly y-dependent: near the pivot row (y=596) dx ~ theta*(596-y) almost
// vanishes (y=550 -> theta*46 only). The T_root sample row must come from the
// strand's VISUAL ATTACHMENT BAND (high above the pivot -> large dx), not from
// the "loses skull contact" row that was fine for the y-uniform Y field.
//
// This script measures, at rev 373 (committed cp13 state):
//   1) X-deficit numbers: per element, tip-band measured (dx, dy) at z=+-30
//      vs the dx the ATTACHMENT band actually receives (the head band the
//      strand hangs from) -> the missing X in px.
//   2) Attachment-band candidates from the texture meshes: the topmost rest
//      vertex band of each strand mesh (where the strand is drawn rooted),
//      its y-range and x-centroid.
//   3) dx recovery table: rot dx at the current sample row vs candidate rows.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PIVOT = { x: 995.5, y: 596 };
const THETA = 10;

const rot = (x, y, thetaDeg) => {
  const t = (thetaDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const u = x - PIVOT.x, v = y - PIVOT.y;
  return { x: c * u - s * v - u, y: s * u + c * v - v };
};

const ELEMS = {
  hair_f_r:    { drawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r",     yHead: 550, tipFrom: 850 },
  hair_f_l:    { drawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l",     yHead: 550, tipFrom: 850 },
  back_hair_r: { drawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r",  yHead: 500, tipFrom: 1300 },
  back_hair_l: { drawable: "draw_r0_1cea4f6f_f2691750_back_hair_l",  yHead: 500, tipFrom: 1300 }
};
const ALL = Object.values(ELEMS).map((e) => e.drawable);

const inspect = (overrides, label) => {
  const spec = {
    command: "inspectEvaluatedGeometry",
    payload: {
      targets: ALL.map((id) => ({ kind: "drawable", drawableId: id })),
      includeVertices: true,
      ...(overrides ? { parameterOverrides: overrides } : {})
    }
  };
  const p = join(HERE, "commands", `diag-fix-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `diag-fix-${label}.response.json`), "utf8"));
  return Object.fromEntries(r.aiCommandResponse.payload.results.map((x) =>
    [x.drawableId, x.vertices ?? x.evaluatedVertices]));
};

const rest = inspect(undefined, "rest");
const zmax = inspect({ param_face_angle_z: 30 }, "zmax");
const zmin = inspect({ param_face_angle_z: -30 }, "zmin");

const stats = (arr) => {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const lo = Math.min(...arr), hi = Math.max(...arr);
  return { mean, lo, hi, n };
};
const f1 = (v) => v.toFixed(1);

console.log("=== 1) X-deficit at z=+30 / z=-30 (measured tip band vs its attachment band) ===");
for (const [key, el] of Object.entries(ELEMS)) {
  const vs = rest[el.drawable];
  for (const [label, got, th] of [["z=+30", zmax, THETA], ["z=-30", zmin, -THETA]]) {
    const dx = [], dy = [];
    vs.forEach((v, i) => {
      if (v.y < el.tipFrom) return;
      dx.push(got[el.drawable][i].x - v.x);
      dy.push(got[el.drawable][i].y - v.y);
    });
    const sx = stats(dx), sy = stats(dy);
    console.log(`${key.padEnd(12)} ${label} tip band (rest y>=${el.tipFrom}, n=${sx.n}):` +
      ` dx mean ${f1(sx.mean)} [${f1(sx.lo)}..${f1(sx.hi)}]  dy mean ${f1(sy.mean)} [${f1(sy.lo)}..${f1(sy.hi)}]`);
  }
}

console.log("\n=== 2) attachment-band candidates: topmost rest-vertex band of each strand mesh ===");
const att = {};
for (const [key, el] of Object.entries(ELEMS)) {
  const vs = rest[el.drawable];
  const yTop = Math.min(...vs.map((v) => v.y));
  const yBot = Math.max(...vs.map((v) => v.y));
  const band = vs.filter((v) => v.y <= yTop + 60); // top 60px band of the drawn strand
  const xs = band.map((v) => v.x), ys = band.map((v) => v.y);
  const bx = stats(xs), by = stats(ys);
  att[key] = { yTop, yBot, yAttMean: by.mean, xCentroid: bx.mean, xLo: bx.lo, xHi: bx.hi };
  console.log(`${key.padEnd(12)} mesh y ${f1(yTop)}..${f1(yBot)} | top-60px band: n=${band.length}` +
    ` y mean ${f1(by.mean)}  x ${f1(bx.lo)}..${f1(bx.hi)} centroid ${f1(bx.mean)}`);
}
writeFileSync(join(HERE, "diagnose-fix-attachment.json"), JSON.stringify(att, null, 1));

console.log("\n=== 3) rot dx recovery per candidate sample row (theta=+10deg, at element x-centroid) ===");
for (const [key, el] of Object.entries(ELEMS)) {
  const x = att[key].xCentroid;
  const rows = [el.yHead, 450, 400, 350, Math.round(att[key].yAttMean)];
  const line = rows.map((y) => {
    const r = rot(x, y, THETA);
    return `y${y}: dx ${f1(r.x)} dy ${f1(r.y)}`;
  }).join(" | ");
  console.log(`${key.padEnd(12)} (x=${f1(x)}) ${line}`);
}
console.log("\n(dx ~ sin(theta)*(596 - y) + (cos(theta)-1)*(x-995.5): the sample row picks the X carry.)");
