// cp13 measured verification on EVALUATED VERTICES (inspectEvaluatedGeometry).
//
// A) Mechanism check (hard PASS/FAIL): each element's measured displacement at
//    param_face_angle_z = +-30 equals its designed mechanism:
//      tufts/curtains (full warp, outside): bilinear(designed grid)(p_rest)
//      front hair (correction inside rotation): R(p + bilinear(corr)(p)) - p
//      back_top L/R + all other head members: exact rotation rot(p) (cp12)
//      neck (control row): byte-static
// B) Net-rule equivalence (the problem's MAIN verification, reported numbers):
//    for every measured vertex, residual against the ideal net rule
//      net_ideal(p) = W(y) * rot(p) + (1 - W(y)) * rot(x, y_root)
//    - tufts/curtains: residual = lattice discretization only (rows sample the
//      smoothstep-times-affine cubic; columns are exact).
//    - front hair: residual = same discretization PLUS the O(theta^2)
//      composition term (R - I)*c (parent rotates the correction vector).
//    Equivalence claim = both compositions land on the same net rule within
//    the arc/chord tolerance class of the problem definition.
// C) Gravity identity on measured data: field_meas - T_root = W * (rot - T_root)
//    with field_meas = measured net displacement (cp08fix identity type);
//    reported as max deviation, expected == the class-B residuals.
// D) back_top x curtain seam: back_top is a rotation member (full rotation);
//    the curtain root band (W ~= 1) must agree constructionally. Reported as
//    max |measured - rot(p)| over curtain vertices with rest y <= yHead.
//
// Usage: node assert-facez-gravity.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DV = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const { PIVOT, THETA_MAX_DEG } = DV;

const rot = (x, y, thetaDeg) => {
  const t = (thetaDeg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const u = x - PIVOT.x, v = y - PIVOT.y;
  return { x: c * u - s * v - u, y: s * u + c * v - v };
};
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const weight = ({ yHead, yFree, wTip }) => (y) =>
  y <= yHead ? 1 : 1 - (1 - wTip) * smooth((y - yHead) / (yFree - yHead));

// bilinear evaluation of a designed lattice grid (round2 values as keyed)
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
  hair_f_r: { drawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r", mode: "full" },
  hair_f_l: { drawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l", mode: "full" },
  back_hair_r: { drawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r", mode: "full" },
  back_hair_l: { drawable: "draw_r0_1cea4f6f_f2691750_back_hair_l", mode: "full" }
};
for (const d of DV.design) {
  const key = d.control.id.replace(/^rig_facez_/, "");
  ELEMS[key].control = d.control;
  ELEMS[key].gridMin = d.keys.find((k) => k.value === -30).statePatch;
  ELEMS[key].gridMax = d.keys.find((k) => k.value === 30).statePatch;
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
  const p = join(HERE, "commands", `assert-geom-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `assert-geom-${label}.response.json`), "utf8"));
  return Object.fromEntries(r.aiCommandResponse.payload.results.map((x) =>
    [x.drawableId, x.vertices ?? x.evaluatedVertices]));
};

const rest = inspect(undefined, "rest");
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
  if (!ok) failures += 1;
};

for (const [param, theta] of [[-30, -THETA_MAX_DEG], [30, THETA_MAX_DEG]]) {
  const got = inspect({ param_face_angle_z: param }, `z${param}`);
  console.log(`\n===== param_face_angle_z = ${param} (theta = ${theta} deg) =====`);

  // control: neck static
  {
    let maxErr = 0;
    rest[CONTROL_STATIC[0]].forEach((v, i) => {
      const g = got[CONTROL_STATIC[0]][i];
      maxErr = Math.max(maxErr, Math.hypot(g.x - v.x, g.y - v.y));
    });
    check(`neck (non-member) static`, maxErr === 0, `maxErr=${maxErr}`);
  }
  // rotation members: exact rotation
  for (const id of ROTATION_MEMBERS) {
    let maxErr = 0;
    rest[id].forEach((v, i) => {
      const e = rot(v.x, v.y, theta), g = got[id][i];
      maxErr = Math.max(maxErr, Math.hypot(g.x - (v.x + e.x), g.y - (v.y + e.y)));
    });
    check(`${id.split("_").slice(-4).join("_")} = exact rotation`, maxErr < 0.01, `maxErr=${maxErr.toExponential(2)}`);
  }

  const netResiduals = {};
  for (const [key, el] of Object.entries(ELEMS)) {
    const gridVals = theta < 0 ? el.gridMin : el.gridMax;
    const fB = bilinear(el.control, gridVals);
    const w = weight(el.control.dial);
    const yRoot = el.control.dial.yHead;
    let mechErr = 0, netMax = 0, netAt = null, idMax = 0;
    rest[el.drawable].forEach((v, i) => {
      const g = got[el.drawable][i];
      const meas = { x: g.x - v.x, y: g.y - v.y };
      // A) mechanism expectation
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
      // B) ideal net rule residual
      const s = rot(v.x, v.y, theta), r = rot(v.x, yRoot, theta), wv = w(v.y);
      const ideal = { x: wv * s.x + (1 - wv) * r.x, y: wv * s.y + (1 - wv) * r.y };
      const res = Math.hypot(meas.x - ideal.x, meas.y - ideal.y);
      if (res > netMax) { netMax = res; netAt = { x: Math.round(v.x), y: Math.round(v.y) }; }
      // C) gravity identity on measured data: (meas - root) - W*(rot - root)
      idMax = Math.max(idMax,
        Math.hypot((meas.x - r.x) - wv * (s.x - r.x), (meas.y - r.y) - wv * (s.y - r.y)));
    });
    check(`${key} mechanism (${el.mode === "full" ? "bilinear full field" : "R(p + bilinear corr)"})`,
      mechErr < 0.01, `maxErr=${mechErr.toExponential(2)}`);
    console.log(`     ${key} net-rule residual: max ${netMax.toFixed(3)}px @ ${JSON.stringify(netAt)} | measured identity dev: ${idMax.toFixed(3)}px (n=${rest[el.drawable].length})`);
    netResiduals[key] = netMax;
  }
  // B) equivalence verdict: front (2-stage composition) vs tufts (1-stage)
  const frontExtra = netResiduals.hair_front;
  const tuftRef = Math.max(netResiduals.hair_f_r, netResiduals.hair_f_l);
  console.log(`     EQUIVALENCE: front net residual ${frontExtra.toFixed(3)}px vs tuft ${tuftRef.toFixed(3)}px vs curtains ${Math.max(netResiduals.back_hair_r, netResiduals.back_hair_l).toFixed(3)}px (all same net rule; front carries the extra O(theta^2) term)`);

  // D) seam: curtain root band (W ~= 1, rest y <= yHead) vs exact rotation
  for (const key of ["back_hair_r", "back_hair_l"]) {
    const el = ELEMS[key];
    let maxD = 0, at = null, n = 0;
    rest[el.drawable].forEach((v, i) => {
      if (v.y > el.control.dial.yHead) return;
      n += 1;
      const g = got[el.drawable][i];
      const e = rot(v.x, v.y, theta);
      const d = Math.hypot((g.x - v.x) - e.x, (g.y - v.y) - e.y);
      if (d > maxD) { maxD = d; at = { x: Math.round(v.x), y: Math.round(v.y) }; }
    });
    console.log(`     SEAM ${key} root band (y<=${el.control.dial.yHead}, n=${n}): max |measured - exact rotation| = ${maxD.toFixed(3)}px @ ${JSON.stringify(at)} (back_top is exact rotation -> this IS the seam gap)`);
  }
}

console.log(failures === 0 ? "\nASSERT-FACEZ-GRAVITY: ALL PASS" : `\nASSERT-FACEZ-GRAVITY: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
