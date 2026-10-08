// cp15 measured assertions (evaluated vertices vs the design mechanism).
//
// At param_body_angle_z = v (theta = v/10 * 6 deg):
//   MECH  every corrected element: evaluated == R_B(theta) . (rest + bilinear(G_v)(rest))
//         where G_v = the committed key grids linearly interpolated in v
//         (machinery check; includes the intermediate value v=+5).
//   BAND  at v=+-10, per template band (design-spec check on real vertices):
//         - PHI=1 bands (hair scalp rows / tie knot band / shirt shoulder band):
//           evaluated == exact rotation R_B(rest) (zero-offset rows + softening)
//         - PHI=0 bands (hair hanging / tie below knot): evaluated - rest ==
//           A(u) = rot_B(u_rest, y_line) — uniform carry, affine-exact between nodes
//         - shirt hem rows (y >= 1116.92): evaluated == rest EXACTLY (the pin)
//   VERT  tie verticality: within each x-column of the hanging band the carry
//         dx spread is ~0 (rest offsets preserved -> plumb kept); the axis tilt
//         below the knot is reported before(=rigid 6deg)/after in degrees.
//   STILL bottomwear + legwear byte-still; neck / back_hair shadow / face stay
//         exact rotation members (corrections must not leak).
//
// Usage: node assert-corrections.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const D = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const { PIVOT_B, THETA_MAX_DEG, FLIP_Y } = D;

const DRAW = {
  hair_front: "draw_r0_1cea4f6f_21b4dac0_front_hair",
  hair_f_r: "draw_r0_1cea4f6f_21b4da82_hair_f_r",
  hair_f_l: "draw_r0_1cea4f6f_21b4da21_hair_f_l",
  back_hair_r: "draw_r0_1cea4f6f_f26916b1_back_hair_r",
  back_hair_l: "draw_r0_1cea4f6f_f2691750_back_hair_l",
  tie: "draw_r0_1cea4f6f_ea30e9c4_tie",
  topwear: "draw_r0_1cea4f6f_26f93e8b_topwear"
};
const ROT_MEMBERS = {
  neck: "draw_r0_1cea4f6f_691e2eb3_neck",
  back_hair_shadow: "draw_r0_1cea4f6f_f2691773_back_hair",
  face_nested: "draw_r0_1cea4f6f_5c3cada6_face"
};
const STILL = {
  bottomwear: "draw_r0_1cea4f6f_26f93eaa_bottomwear",
  legwear: "draw_r0_1cea4f6f_c7ac42f2_legwear"
};
const ALL_IDS = [...Object.values(DRAW), ...Object.values(ROT_MEMBERS), ...Object.values(STILL)];

const rad = (d) => (d * Math.PI) / 180;
const rotAbout = (theta) => (p) => {
  const c = Math.cos(rad(theta)), s = Math.sin(rad(theta));
  const x = p.x - PIVOT_B.x, y = p.y - PIVOT_B.y;
  return { x: PIVOT_B.x + c * x - s * y, y: PIVOT_B.y + s * x + c * y };
};
const rotDisp = (x, y, theta) => {
  const q = rotAbout(theta)({ x, y });
  return { x: q.x - x, y: q.y - y };
};

// bilinear evaluation of a committed grid over an element's lattice
const bilinear = (el, grid) => (p) => {
  const { domain, cols, rows } = el.control;
  const fx = ((p.x - domain.x) / domain.width) * (cols - 1);
  const fy = ((p.y - domain.y) / domain.height) * (rows - 1);
  const cx = Math.min(Math.max(fx, 0), cols - 1), cy = Math.min(Math.max(fy, 0), rows - 1);
  const c0 = Math.min(Math.floor(cx), cols - 2), r0 = Math.min(Math.floor(cy), rows - 2);
  const tx = cx - c0, ty = cy - r0;
  const g = (r, c) => grid[r * cols + c];
  const a = g(r0, c0), b = g(r0, c0 + 1), c1 = g(r0 + 1, c0), d2 = g(r0 + 1, c0 + 1);
  return {
    x: (1 - ty) * ((1 - tx) * a.x + tx * b.x) + ty * ((1 - tx) * c1.x + tx * d2.x),
    y: (1 - ty) * ((1 - tx) * a.y + tx * b.y) + ty * ((1 - tx) * c1.y + tx * d2.y)
  };
};
const gridAt = (el, v) => {
  const side = el.keys.find((k) => k.value === (v < 0 ? -10 : 10)).statePatch;
  const t = Math.abs(v) / 10;
  return side.map((o) => ({ x: t * o.x, y: t * o.y }));
};

const inspect = (overrides, label) => {
  const spec = {
    command: "inspectEvaluatedGeometry",
    payload: {
      targets: ALL_IDS.map((id) => ({ kind: "drawable", drawableId: id })),
      includeVertices: true,
      ...(overrides ? { parameterOverrides: overrides } : {})
    }
  };
  const p = join(HERE, "commands", `assert-geom-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `assert-geom-${label}.response.json`), "utf8"));
  return Object.fromEntries(r.aiCommandResponse.payload.results.map((x) => [x.drawableId, x.vertices ?? x.evaluatedVertices]));
};

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
  if (!ok) failures += 1;
};
const maxOver = (rest, got, f) => {
  let m = 0;
  for (let i = 0; i < rest.length; i++) m = Math.max(m, f(rest[i], got[i]));
  return m;
};

const rest = inspect(undefined, "rest");

// realized band rows per element (first PHI=0 lattice row / last PHI=1 row)
const bandRows = {};
for (const el of D.design) {
  const { domain, rows } = el.control;
  const ys = Array.from({ length: rows }, (_, r) => domain.y + (domain.height * r) / (rows - 1));
  bandRows[el.control.id] = {
    lastFull: el.control.kind === "anchor"
      ? ys.filter((y) => y <= D.P_FREE_Y).pop()
      : ys.filter((y) => y <= (el.control.id === "rig_bodyz_hair_front" ? D.W_FRONT.yHead : el.control.yLine)).pop(),
    firstZero: el.control.kind === "anchor"
      ? ys.find((y) => y >= D.P_PIN_Y)
      : ys.find((y) => y >= el.control.transEnd)
  };
}

for (const v of [-10, 5, 10]) {
  const theta = (v / 10) * THETA_MAX_DEG;
  const got = inspect({ param_body_angle_z: v }, `bz${v}`);
  const R = rotAbout(theta);

  // ---- MECH: corrected members follow R(p + bilinear(G_v)(p)) ----
  for (const el of D.design) {
    const key = el.control.id.replace("rig_bodyz_", "");
    const rv = rest[DRAW[key]], gv = got[DRAW[key]];
    const B = bilinear(el, gridAt(el, v));
    const err = maxOver(rv, gv, (p, q) => {
      const c = B(p);
      const e = R({ x: p.x + c.x, y: p.y + c.y });
      return Math.hypot(e.x - q.x, e.y - q.y);
    });
    check(`MECH bz=${v} ${key}: evaluated == R(${theta.toFixed(1)}deg)(rest + bilinear(c))`,
      err < 0.01, `maxErr=${err.toExponential(2)} (n=${rv.length})`);
  }

  // ---- STILL / untouched rotation members ----
  for (const [name, id] of Object.entries(STILL)) {
    const err = maxOver(rest[id], got[id], (p, q) => Math.hypot(p.x - q.x, p.y - q.y));
    check(`STILL bz=${v} ${name}: byte-still`, err === 0, `maxMove=${err}`);
  }
  for (const [name, id] of Object.entries(ROT_MEMBERS)) {
    const err = maxOver(rest[id], got[id], (p, q) => {
      const e = R(p);
      return Math.hypot(e.x - q.x, e.y - q.y);
    });
    check(`ROTMEMBER bz=${v} ${name}: exact rotation (corrections do not leak)`,
      err < 0.01, `maxErr=${err.toExponential(2)}`);
  }

  if (Math.abs(v) !== 10) {
    // intermediate value: report the hem wobble (linear key interp vs ideal pin)
    const id = DRAW.topwear;
    const hem = rest[id].map((p, i) => ({ p, q: got[id][i] })).filter(({ p }) => p.y >= D.P_PIN_Y);
    const m = Math.max(...hem.map(({ p, q }) => Math.hypot(q.x - p.x, q.y - p.y)));
    console.log(`INFO bz=${v} shirt hem wobble vs perfectly-still (linear-in-v key interp): max ${m.toFixed(3)}px (${hem.length} verts)`);
    continue;
  }

  // ---- BAND checks at the ends ----
  for (const el of D.design) {
    const key = el.control.id.replace("rig_bodyz_", "");
    const rv = rest[DRAW[key]], gv = got[DRAW[key]];
    const { lastFull, firstZero } = bandRows[el.control.id];
    // PHI=1 band: exact rotation
    const full = rv.map((p, i) => ({ p, q: gv[i] })).filter(({ p }) => p.y <= lastFull);
    if (full.length) {
      const m = Math.max(...full.map(({ p, q }) => { const e = R(p); return Math.hypot(e.x - q.x, e.y - q.y); }));
      check(`BAND bz=${v} ${key} PHI=1 (y<=${lastFull.toFixed(1)}): exact rotation`,
        m < 0.35, `max ${m.toFixed(3)}px (${full.length} verts)`);
    }
    if (el.control.kind === "anchor") {
      // hem: exactly still
      const hem = rv.map((p, i) => ({ p, q: gv[i] })).filter(({ p }) => p.y >= firstZero);
      const m = Math.max(...hem.map(({ p, q }) => Math.hypot(q.x - p.x, q.y - p.y)));
      check(`BAND bz=${v} topwear hem (y>=${firstZero.toFixed(1)}): exactly still (the pin at the tuck-in line)`,
        m < 0.05, `max ${m.toFixed(3)}px (${hem.length} verts)`);
    } else if (key !== "hair_front") {
      // hanging band: uniform carry of A(u) = rot_B(u_rest, y_line)
      const hang = rv.map((p, i) => ({ p, q: gv[i] })).filter(({ p }) => p.y >= firstZero);
      if (hang.length) {
        const m = Math.max(...hang.map(({ p, q }) => {
          const a = rotDisp(p.x, el.control.yLine, theta);
          return Math.hypot(q.x - p.x - a.x, q.y - p.y - a.y);
        }));
        check(`BAND bz=${v} ${key} PHI=0 (y>=${firstZero.toFixed(1)}): uniform carry rot_B(u,${el.control.yLine})`,
          m < 0.1, `max ${m.toFixed(3)}px (${hang.length} verts)`);
      }
    }
  }

  // ---- VERT: tie verticality below the knot ----
  {
    const rv = rest[DRAW.tie], gv = got[DRAW.tie];
    const { firstZero } = bandRows.rig_bodyz_tie;
    const hang = rv.map((p, i) => ({ p, q: gv[i] })).filter(({ p }) => p.y >= firstZero);
    // per x-column (10px bins) spread of dx across y
    const cols = new Map();
    for (const { p, q } of hang) {
      const bin = Math.round(p.x / 10);
      if (!cols.has(bin)) cols.set(bin, []);
      cols.get(bin).push(q.x - p.x);
    }
    let spread = 0;
    for (const dxs of cols.values())
      spread = Math.max(spread, Math.max(...dxs) - Math.min(...dxs));
    check(`VERT bz=${v} tie: per-column dx spread below knot (rest offsets preserved -> plumb kept)`,
      spread < 0.1, `max spread ${spread.toFixed(3)}px over ${cols.size} columns`);
    // axis tilt: centroid x at top vs bottom of the hanging band, before/after
    const ys = hang.map(({ p }) => p.y);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const at = (band, sel) => {
      const vs = hang.filter(({ p }) => Math.abs(p.y - band) < 60);
      return vs.reduce((s, e) => s + sel(e), 0) / vs.length;
    };
    const tiltAfter = Math.atan2(at(y1, (e) => e.q.x) - at(y0, (e) => e.q.x)
      - (at(y1, (e) => e.p.x) - at(y0, (e) => e.p.x)), y1 - y0) * 180 / Math.PI;
    console.log(`INFO bz=${v} tie axis tilt below knot vs rest: after=${tiltAfter.toFixed(3)}deg (before, rigid roll: ${theta.toFixed(1)}deg by construction)`);
  }
}

console.log(failures === 0 ? "ASSERT-CORRECTIONS: ALL PASS" : `ASSERT-CORRECTIONS: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
