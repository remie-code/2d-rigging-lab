// cp06fix2: verify correction A (front-hair subordination of the hat's lower
// band) with the tape measure, and produce the G1 junction data for fix B.
//
// A checks:
//  1. contact-band slip: hat vertices on the scalloped bottom edge vs the
//     front-hair field value at the same point (target: |slip| <= ~2px,
//     was up to 18px at the flaps under the 8th-gen anchor)
//  2. upper silhouette rows unchanged (y<=290 edge dx == 8th-gen values)
//  3. regression: btr/btl bands, back_hair curtain, eyewear affine fit
//
// B input:
//  4. deformed contour tangents at the bottom junctions, both sides both keys:
//     hat edge tail (last ~30px above the junction) vs hair silhouette
//     (first ~30px below). Printed as direction vectors/slopes dx/dy.
import { readFileSync } from "node:fs";

// SRC=<prefix> switches the +-30 inputs (e.g. fix3b); rest is pose-independent
// and always read from the fix2 rest measurement.
const SRC = process.env.SRC ?? "fix2";
const load = (k) => {
  const pre = k === "rest" ? "fix2" : SRC;
  const r = JSON.parse(readFileSync(new URL(`commands/${pre}-measure-${k}.response.json`, import.meta.url), "utf8"));
  const map = {};
  for (const t of r.aiCommandResponse.payload.results) map[t.drawableId] = t.vertices;
  return map;
};
const rest = load("rest"), plus = load("plus30"), minus = load("minus30");

const HAT = "draw_r0_1cea4f6f_9dc00ee4_headwear";
const FH = "draw_r0_1cea4f6f_21b4dac0_front_hair";
const HFL = "draw_r0_1cea4f6f_21b4da21_hair_f_l";
const HFR = "draw_r0_1cea4f6f_21b4da82_hair_f_r";
const BTR = "draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r";
const BTL = "draw_r131_0bbc8ea5_f823b423_back_top_hair_l";
const CX = 1001;
const CHORD = 0.1875 * (Math.cos(Math.PI / 6) - 1);
const ZC = 0.09375;
const capS = (y) => (y >= 463 ? 1 : Math.sqrt(Math.max(0, 1 - ((463 - y) / 320) ** 2)));
const zFh = (u, y) => 320 * Math.max(0, 1 - (u / 320) ** 2) * capS(y);
const fhVal = (u, y, sgn) => CHORD * u + sgn * ZC * zFh(u, y);

// --- 1. contact-band slip: hat vertices in the lower band vs fh field
console.log("== A1: lower-band hat vertices (rest y>=330) dx vs fh field (slip = dx - fh)");
for (const [label, cur, sgn] of [["+30", plus, +1], ["-30", minus, -1]]) {
  let n = 0, maxSlip = 0, sumAbs = 0, worst = null;
  for (let i = 0; i < rest[HAT].length; i++) {
    const v = rest[HAT][i];
    if (v.y < 330) continue;
    const dx = cur[HAT][i].x - v.x;
    const slip = dx - fhVal(v.x - CX, v.y, sgn);
    n++; sumAbs += Math.abs(slip);
    if (Math.abs(slip) > Math.abs(maxSlip)) { maxSlip = slip; worst = v; }
  }
  console.log(` ${label}: n=${n} mean|slip| ${(sumAbs / n).toFixed(2)}px max ${maxSlip.toFixed(2)}px at (${Math.round(worst.x)},${Math.round(worst.y)})`);
}
console.log("   (band y in [300,330) for reference — transition zone)");
for (const [label, cur, sgn] of [["+30", plus, +1], ["-30", minus, -1]]) {
  let n = 0, maxSlip = 0, sumAbs = 0;
  for (let i = 0; i < rest[HAT].length; i++) {
    const v = rest[HAT][i];
    if (v.y < 300 || v.y >= 330) continue;
    const dx = cur[HAT][i].x - v.x;
    const slip = dx - fhVal(v.x - CX, v.y, sgn);
    n++; sumAbs += Math.abs(slip);
    if (Math.abs(slip) > Math.abs(maxSlip)) maxSlip = slip;
  }
  console.log(` ${label}: n=${n} mean|slip| ${(sumAbs / n).toFixed(2)}px max ${maxSlip.toFixed(2)}px`);
}

// --- 2. upper silhouette rows: outermost vertices per band, dx (want = 8th-gen 3..7px)
console.log("== A2: upper rim bands (outermost 4/side): dx+30 / dx-30");
for (const [lo, hi] of [[170, 230], [230, 290]]) {
  for (const side of ["L", "R"]) {
    const idx = [];
    for (let i = 0; i < rest[HAT].length; i++) {
      const v = rest[HAT][i];
      if (v.y < lo || v.y > hi) continue;
      if (side === "L" ? v.x < CX : v.x > CX) idx.push(i);
    }
    idx.sort((a, b) => side === "L" ? rest[HAT][a].x - rest[HAT][b].x : rest[HAT][b].x - rest[HAT][a].x);
    const pick = idx.slice(0, 4);
    const f = (arr) => (pick.reduce((s, i) => s + arr[HAT][i].x - rest[HAT][i].x, 0) / pick.length).toFixed(1);
    console.log(` y[${lo},${hi}] ${side}: ${f(plus)} / ${f(minus)}`);
  }
}

// --- 3. regression bands
const bands = (id, list) => {
  const out = [];
  for (const [lo, hi] of list) {
    let n = 0, sp = 0, sm = 0;
    for (let i = 0; i < rest[id].length; i++) {
      const v = rest[id][i];
      if (v.y < lo || v.y > hi) continue;
      n++; sp += plus[id][i].x - v.x; sm += minus[id][i].x - v.x;
    }
    out.push(`y[${lo},${hi}] ${(sp / n).toFixed(1)}/${(sm / n).toFixed(1)}`);
  }
  return out.join("  ");
};
console.log("== A3 regression:");
console.log(" btr:", bands(BTR, [[264, 300], [360, 435], [600, 782]]));
console.log(" btl:", bands(BTL, [[252, 300], [360, 435], [600, 777]]));
console.log(" curtain:", bands("draw_r0_1cea4f6f_f26916b1_back_hair_r", [[346, 500], [1100, 1700]]));
{
  const gid = "draw_r0_1cea4f6f_9dc00e87_eyewear";
  for (const [label, cur] of [["+30", plus], ["-30", minus]]) {
    const xs = [], ds = [];
    for (let i = 0; i < rest[gid].length; i++) { xs.push(rest[gid][i].x); ds.push(cur[gid][i].x - rest[gid][i].x); }
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, md = ds.reduce((a, b) => a + b) / n;
    let sxx = 0, sxd = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxd += (xs[i] - mx) * (ds[i] - md); }
    const b = sxd / sxx, a0 = md - b * mx;
    let mr = 0;
    for (let i = 0; i < n; i++) mr = Math.max(mr, Math.abs(ds[i] - (a0 + b * xs[i])));
    console.log(` eyewear ${label}: slope ${b.toFixed(5)} center ${(a0 + b * 997).toFixed(2)} maxres ${mr.toFixed(3)}`);
  }
}

// --- 4. B input: junction tangents (deformed), both sides both keys
// contour extraction from deformed vertices: outermost vertex per y-bin.
const contour = (ids, side, yLo, yHi, cur, binH = 6) => {
  const bins = new Map();
  for (const id of ids) {
    for (let i = 0; i < rest[id].length; i++) {
      const r = rest[id][i], c = cur[id][i];
      if (c.y < yLo || c.y > yHi) continue;
      const b = Math.floor(c.y / binH);
      const e = bins.get(b);
      if (!e || (side === "L" ? c.x < e.x : c.x > e.x)) bins.set(b, { x: c.x, y: c.y, restX: r.x, restY: r.y });
    }
  }
  return [...bins.values()].sort((p, q) => p.y - q.y);
};
console.log("== B input: deformed contours near bottom junctions (outermost vertex per 6px y-bin)");
for (const [label, cur] of [["+30", plus], ["-30", minus]]) {
  for (const side of ["L", "R"]) {
    const hatC = contour([HAT], side, side === "L" ? 300 : 300, 400, cur).filter((p) => p.restY >= 300);
    const hairC = contour([FH, side === "L" ? HFL : HFR], side, 340, 460, cur);
    const fmt = (arr) => arr.map((p) => `${p.x.toFixed(1)}@${p.y.toFixed(0)}(r${Math.round(p.restX)},${Math.round(p.restY)})`).join(" ");
    console.log(` ${label} ${side} hat : ${fmt(hatC)}`);
    console.log(` ${label} ${side} hair: ${fmt(hairC)}`);
  }
}
