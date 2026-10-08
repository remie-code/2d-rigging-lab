// Tape-measure verification for cp16 fix2: inspectEvaluatedGeometry at rest and
// at each Sway parameter's -1/+1 for the six wrapped drawables, then reports:
//   - stillness at/above the fixed line (exact-zero above the last still
//     lattice row; bilinear leakage bound inside [last still row, y_fix])
//   - field v3 agreement: every vertex displacement matches the ISOMETRIC
//     pendulum curve (offset = integral_0^s (sin theta, cos theta) dt - (0,s),
//     theta(t) = sign*30deg*(t/L)^0.5, trapezoid <= 1px) evaluated through the
//     lattice's piecewise row interpolation (field is x-independent)
//   - TIP UPLIFT (design-notes §7.4.2): tip-band mean dy < 0 at both ±1
//   - tip agreement against the raw integral (deepest band)
//   - board rotation still gone (left/right edge dy-residual symmetric)
//   - direction (+1 -> +x, -1 -> -x) and L/R same direction on shared params
// Usage: node measure-sway.mjs run    (executes the CLI measurements)
//        node measure-sway.mjs report (crunches the saved responses)
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const SYSTEMS = [
  { key: "hair_front", drawable: "draw_r0_1cea4f6f_21b4dac0_front_hair",
    param: "param_hair_front_sway_x", yFix: 454, freeLen: 319 }, // fix2 §7.3
  { key: "hair_f_l", drawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l",
    param: "param_hair_side_sway_x", yFix: 505, freeLen: 461 },
  { key: "hair_f_r", drawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r",
    param: "param_hair_side_sway_x", yFix: 520, freeLen: 428 },
  { key: "back_hair_l", drawable: "draw_r0_1cea4f6f_f2691750_back_hair_l",
    param: "param_hair_back_sway_x", yFix: 540, freeLen: 1237 },
  { key: "back_hair_r", drawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r",
    param: "param_hair_back_sway_x", yFix: 540, freeLen: 1290 },
  { key: "tie", drawable: "draw_r0_1cea4f6f_ea30e9c4_tie",
    param: "param_accessory_sway_x", yFix: 710, freeLen: 513 }
];
const DOMAINS = {
  hair_front: { y: 135, height: 638, rows: 11 },
  hair_f_l: { y: 267, height: 699, rows: 7 },
  hair_f_r: { y: 227, height: 721, rows: 7 },
  back_hair_l: { y: 272, height: 1505, rows: 11 },
  back_hair_r: { y: 310, height: 1520, rows: 11 },
  tie: { y: 620, height: 603, rows: 7 }
};
const stillRowOf = (key, yFix) => {
  const d = DOMAINS[key];
  let best = -Infinity;
  for (let r = 0; r < d.rows; r++) {
    const y = d.y + (d.height * r) / (d.rows - 1);
    if (y <= yFix && y > best) best = y;
  }
  return best;
};

// field v3 closed form (must mirror gen-hair-sway.mjs)
const THETA_MAX_DEG = 30, KAPPA = 0.5;
const rad = (d) => (d * Math.PI) / 180;
const fieldV3 = (yFix, freeLen) => (y, sign) => {
  if (y <= yFix) return { x: 0, y: 0 };
  const s = y - yFix;
  const N = Math.max(1, Math.ceil(s));
  const h = s / N;
  let ix = 0, iy = 0, px = 0, py = 1;
  for (let k = 1; k <= N; k++) {
    const A = rad(sign * THETA_MAX_DEG * Math.pow((h * k) / freeLen, KAPPA));
    const fx = Math.sin(A), fy = Math.cos(A);
    ix += ((px + fx) / 2) * h;
    iy += ((py + fy) / 2) * h;
    px = fx; py = fy;
  }
  return { x: ix, y: iy - s };
};
// prediction through the lattice: node values at lattice rows, linear in y
// between rows (field is x-independent -> row-constant grids)
const latticePred = (sys) => {
  const d = DOMAINS[sys.key];
  const f = fieldV3(sys.yFix, sys.freeLen);
  const rowY = [...Array(d.rows)].map((_, r) => d.y + (d.height * r) / (d.rows - 1));
  const round2 = (n) => Math.round(n * 100) / 100 || 0;
  return (y, sign) => {
    if (y <= rowY[0]) y = rowY[0];
    if (y >= rowY[d.rows - 1]) y = rowY[d.rows - 1];
    let r = 0;
    while (r < d.rows - 2 && rowY[r + 1] < y) r += 1;
    const t = (y - rowY[r]) / (rowY[r + 1] - rowY[r]);
    const a = f(rowY[r], sign), b = f(rowY[r + 1], sign);
    const rr = (v) => ({ x: round2(v.x), y: round2(v.y) }); // committed grids are round2'd
    const A = rr(a), B = rr(b);
    return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
  };
};

const mode = process.argv[2] ?? "run";

if (mode === "run") {
  const cases = [["rest", {}]];
  for (const s of SYSTEMS) {
    if (!cases.some(([l]) => l === `${s.param}+1`)) {
      cases.push([`${s.param}+1`, { [s.param]: 1 }]);
      cases.push([`${s.param}-1`, { [s.param]: -1 }]);
    }
  }
  for (const [label, overrides] of cases) {
    const spec = {
      command: "inspectEvaluatedGeometry",
      payload: {
        ...(Object.keys(overrides).length ? { parameterOverrides: overrides } : {}),
        targets: SYSTEMS.map((s) => ({ kind: "drawable", drawableId: s.drawable })),
        includeVertices: true
      }
    };
    const safe = label.replace(/[^a-z0-9_+-]/gi, "_");
    const p = join(HERE, "commands", `measure-${safe}.json`);
    writeFileSync(p, JSON.stringify(spec));
    console.log(`== measure-${label}`);
    execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "inherit", cwd: HERE });
  }
} else {
  const load = (label) => {
    const safe = label.replace(/[^a-z0-9_+-]/gi, "_");
    const resp = JSON.parse(readFileSync(join(HERE, "commands", `measure-${safe}.response.json`), "utf8"));
    const arr = resp.aiCommandResponse.payload.results;
    const byId = {};
    for (const r of arr) byId[r.target?.drawableId ?? r.drawableId] = r.vertices ?? r.evaluatedVertices;
    return byId;
  };
  const rest = load("rest");
  let failures = 0;
  const check = (label, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
    if (!ok) failures += 1;
  };
  const tips = {};
  for (const s of SYSTEMS) {
    const stillRow = stillRowOf(s.key, s.yFix);
    const pred = latticePred(s);
    const f = fieldV3(s.yFix, s.freeLen);
    const v0 = rest[s.drawable];
    for (const sign of [1, -1]) {
      const tag = sign > 0 ? "+1" : "-1";
      const v1 = load(`${s.param}${tag}`)[s.drawable];
      if (!v0 || !v1 || v0.length !== v1.length) { check(`${s.key} vertices comparable`, false); continue; }
      const yMax = Math.max(...v0.map((p) => p.y));
      const yTipBand = yMax - 0.1 * s.freeLen;
      let maxAboveStillRow = 0, maxFixBand = 0, maxResid = 0, maxResidY = 0;
      const tip = { n: 0, dx: 0, dy: 0, y0: 0 };
      const edges = { L: { n: 0, dy: 0 }, R: { n: 0, dy: 0 } };
      const xs = v0.filter((p) => p.y >= yTipBand).map((p) => p.x).sort((a, b) => a - b);
      const xLo = xs[Math.floor(xs.length * 0.2)], xHi = xs[Math.floor(xs.length * 0.8)];
      for (let i = 0; i < v0.length; i++) {
        const dx = v1[i].x - v0[i].x, dy = v1[i].y - v0[i].y;
        const dmag = Math.hypot(dx, dy);
        if (v0[i].y <= stillRow) maxAboveStillRow = Math.max(maxAboveStillRow, dmag);
        else if (v0[i].y <= s.yFix) maxFixBand = Math.max(maxFixBand, dmag);
        else {
          const p = pred(v0[i].y, sign);
          const resid = Math.hypot(dx - p.x, dy - p.y);
          if (resid > maxResid) { maxResid = resid; maxResidY = v0[i].y; }
        }
        if (v0[i].y >= yTipBand) {
          tip.n += 1; tip.dx += dx; tip.dy += dy; tip.y0 += v0[i].y;
          const pdY = pred(v0[i].y, sign).y;
          if (v0[i].x <= xLo) { edges.L.n += 1; edges.L.dy += dy - pdY; }
          if (v0[i].x >= xHi) { edges.R.n += 1; edges.R.dy += dy - pdY; }
        }
      }
      tip.dx /= tip.n; tip.dy /= tip.n; tip.y0 /= tip.n;
      edges.L.dy /= edges.L.n; edges.R.dy /= edges.R.n;
      check(`${s.key} ${tag}: exact-still above lattice still row y<=${stillRow.toFixed(1)}`,
        maxAboveStillRow === 0, `(max ${maxAboveStillRow.toFixed(3)}px)`);
      console.log(`  INFO ${s.key} ${tag} bilinear leakage in (${stillRow.toFixed(1)}, ${s.yFix}]: max ${maxFixBand.toFixed(2)}px`);
      check(`${s.key} ${tag}: every moving vertex == lattice-interp of isometric pendulum field`,
        maxResid < 2.0, `(max residual ${maxResid.toFixed(2)}px @y=${maxResidY.toFixed(0)})`);
      // TIP UPLIFT (§7.4.2): measured tip band rises at both ends
      check(`${s.key} ${tag}: TIP UPLIFT — tip band mean dy < 0`,
        tip.dy < 0, `(mean tip dy ${tip.dy.toFixed(1)}px over ${tip.n} verts)`);
      // tip vs raw integral (interp error shows up here; report + loose gate)
      {
        const p = f(tip.y0, sign);
        const err = Math.hypot(p.x - tip.dx, p.y - tip.dy);
        check(`${s.key} ${tag}: tip band == isometric integral at band centroid`,
          err < 8, `(pred (${p.x.toFixed(1)},${p.y.toFixed(1)}) vs meas (${tip.dx.toFixed(1)},${tip.dy.toFixed(1)}), err ${err.toFixed(1)}px)`);
      }
      check(`${s.key} ${tag}: tip band swings ${sign > 0 ? "RIGHT (+x)" : "LEFT (-x)"}`,
        sign > 0 ? tip.dx > 0 : tip.dx < 0, `(mean tip dx ${tip.dx.toFixed(1)}px over ${tip.n} verts)`);
      const residDiff = edges.L.dy - edges.R.dy;
      check(`${s.key} ${tag}: BOARD ROTATION GONE (tip-band left/right edge dy-residual symmetric)`,
        Math.abs(residDiff) < 6,
        `(edgeL resid ${edges.L.dy.toFixed(1)}px vs edgeR resid ${edges.R.dy.toFixed(1)}px, diff ${residDiff.toFixed(1)}px)`);
      tips[`${s.key}${sign}`] = tip;
    }
  }
  check("tufts L/R same direction at +1",
    tips["hair_f_l1"].dx > 0 && tips["hair_f_r1"].dx > 0);
  check("back L/R same direction at +1",
    tips["back_hair_l1"].dx > 0 && tips["back_hair_r1"].dx > 0);
  console.log(failures === 0 ? "MEASURE: ALL PASS" : `MEASURE: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
