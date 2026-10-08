// cp06fix: verify evaluated geometry at +-30 vs rest after the hat fix.
// - headwear rim: outermost vertices per row band must move only a few px (anchored)
// - headwear interior: full cap flow preserved (brim center ~ +-25)
// - headwear dy: linear in u, sign: +30 -> right side up (dy<0), left side down
// - ears: section dx profile (ridge vs flanks) per ear at +-30
// - btr/btl: top band = hat formula incl dy; occluder band y360-435 and lower rows intact
// - eyewear: affine fit unchanged (untouched by this round)
// - back_hair_r: cp05fix values intact
import { readFileSync } from "node:fs";

const load = (k) => {
  const r = JSON.parse(readFileSync(new URL(`commands/fix-measure-${k}.response.json`, import.meta.url), "utf8"));
  const map = {};
  for (const t of r.aiCommandResponse.payload.results) map[t.drawableId] = t.vertices;
  return map;
};
const rest = load("rest"), plus = load("plus30"), minus = load("minus30");

const HAT = "draw_r0_1cea4f6f_9dc00ee4_headwear";
const CX = 1001;

// --- rim anchoring: for row bands, take the 4 outermost rest vertices per side
console.log("== hat rim (outermost 4 vertices per side per band): dx+30 / dx-30 / dy+30");
for (const [lo, hi] of [[124, 170], [170, 230], [230, 290], [290, 356], [300, 382]]) {
  for (const side of ["L", "R"]) {
    const idx = [];
    for (let i = 0; i < rest[HAT].length; i++) {
      const v = rest[HAT][i];
      if (v.y < lo || v.y > hi) continue;
      if (side === "L" ? v.x - CX < 0 : v.x - CX > 0) idx.push(i);
    }
    idx.sort((a, b) => side === "L"
      ? rest[HAT][a].x - rest[HAT][b].x
      : rest[HAT][b].x - rest[HAT][a].x);
    const pick = idx.slice(0, 4);
    if (!pick.length) continue;
    const f = (arr) => (pick.reduce((s, i) => s + arr[HAT][i].x - rest[HAT][i].x, 0) / pick.length).toFixed(1);
    const fy = (pick.reduce((s, i) => s + plus[HAT][i].y - rest[HAT][i].y, 0) / pick.length).toFixed(1);
    const us = pick.map((i) => Math.round(rest[HAT][i].x - CX));
    console.log(` y[${lo},${hi}] ${side} u~${us[0]}: dx ${f(plus)} / ${f(minus)}  dy+30 ${fy}`);
  }
}

// --- interior flow + dy linearity
console.log("== hat interior bands (|u|<=110), y[230,300]: dx+30 avg / dy+30 vs -0.025u");
{
  let n = 0, s = 0, dyerr = 0;
  for (let i = 0; i < rest[HAT].length; i++) {
    const v = rest[HAT][i];
    const u = v.x - CX;
    if (Math.abs(u) > 110 || v.y < 230 || v.y > 300) continue;
    n++; s += plus[HAT][i].x - v.x;
    dyerr = Math.max(dyerr, Math.abs((plus[HAT][i].y - v.y) - (-0.025 * u)));
  }
  console.log(` n=${n} dx avg ${(s / n).toFixed(1)}  max |dy - (-0.025u)| = ${dyerr.toFixed(2)}px`);
}

// --- ear sections
console.log("== ear sections (rest y in [92,122]): u -> dx+30 , dx-30  (sorted by u)");
for (const [name, ulo, uhi] of [["left", -160, -50], ["right", 64, 178]]) {
  const pts = [];
  for (let i = 0; i < rest[HAT].length; i++) {
    const v = rest[HAT][i];
    const u = v.x - CX;
    if (v.y < 89 || v.y > 122 || u < ulo || u > uhi) continue;
    pts.push([u, plus[HAT][i].x - v.x, minus[HAT][i].x - v.x]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  console.log(` ${name}: ` + pts.map(([u, p, m]) => `${Math.round(u)}:${p.toFixed(1)}/${m.toFixed(1)}`).join(" "));
  if (pts.length >= 2) {
    const w0 = pts[pts.length - 1][0] - pts[0][0];
    const wp = w0 + (pts[pts.length - 1][1] - pts[0][1]);
    const wm = w0 + (pts[pts.length - 1][2] - pts[0][2]);
    console.log(`   width rest ${w0.toFixed(0)} -> +30: ${wp.toFixed(1)} (${((wp / w0 - 1) * 100).toFixed(1)}%)  -30: ${wm.toFixed(1)} (${((wm / w0 - 1) * 100).toFixed(1)}%)`);
  }
}

// --- btr/btl bands (dx and dy)
const bands = (id, list) => {
  console.log(`== ${id.slice(-25)}`);
  for (const [lo, hi] of list) {
    let n = 0, sp = 0, sm = 0, spy = 0, smy = 0;
    for (let i = 0; i < rest[id].length; i++) {
      const v = rest[id][i];
      if (v.y < lo || v.y > hi) continue;
      n++;
      sp += plus[id][i].x - v.x; sm += minus[id][i].x - v.x;
      spy += plus[id][i].y - v.y; smy += minus[id][i].y - v.y;
    }
    if (n) console.log(` y[${lo},${hi}] n=${n} dx ${(sp / n).toFixed(1)} / ${(sm / n).toFixed(1)}  dy ${(spy / n).toFixed(1)} / ${(smy / n).toFixed(1)}`);
  }
};
bands("draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r", [[264, 300], [300, 360], [360, 435], [435, 600], [600, 782]]);
bands("draw_r131_0bbc8ea5_f823b423_back_top_hair_l", [[252, 300], [300, 360], [360, 435], [435, 600], [600, 777]]);
bands("draw_r0_1cea4f6f_f26916b1_back_hair_r", [[346, 500], [500, 769], [1100, 1700]]);

// --- hat edge vs btr sliver differential at y~300 (pop-out check)
console.log("== L-edge differential at y[290,330]: hat edge vs btr outer vertices");
{
  const edge = (id, filt) => {
    const pick = [];
    for (let i = 0; i < rest[id].length; i++) {
      const v = rest[id][i];
      if (filt(v)) pick.push(i);
    }
    pick.sort((a, b) => rest[id][a].x - rest[id][b].x);
    return pick.slice(0, 3);
  };
  const h = edge(HAT, (v) => v.y >= 290 && v.y <= 330 && v.x < CX);
  const B = "draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r";
  const b = edge(B, (v) => v.y >= 290 && v.y <= 330);
  const avg = (id, pick, arr) => pick.reduce((s, i) => s + arr[id][i].x - rest[id][i].x, 0) / pick.length;
  console.log(` hat +30 ${avg(HAT, h, plus).toFixed(1)} btr +30 ${avg(B, b, plus).toFixed(1)} | hat -30 ${avg(HAT, h, minus).toFixed(1)} btr -30 ${avg(B, b, minus).toFixed(1)}`);
}

// --- eyewear affine fit (should be identical to pre-fix: slope -0.02512, D ~ +-20.5)
const gid = "draw_r0_1cea4f6f_9dc00e87_eyewear";
for (const [label, cur] of [["+30", plus], ["-30", minus]]) {
  const xs = [], ds = [];
  for (let i = 0; i < rest[gid].length; i++) {
    xs.push(rest[gid][i].x); ds.push(cur[gid][i].x - rest[gid][i].x);
  }
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, md = ds.reduce((a, b) => a + b) / n;
  let sxx = 0, sxd = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxd += (xs[i] - mx) * (ds[i] - md); }
  const b = sxd / sxx, a = md - b * mx;
  let maxres = 0, maxdy = 0;
  for (let i = 0; i < n; i++) {
    maxres = Math.max(maxres, Math.abs(ds[i] - (a + b * xs[i])));
    maxdy = Math.max(maxdy, Math.abs(cur[gid][i].y - rest[gid][i].y));
  }
  console.log(`eyewear ${label}: slope ${b.toFixed(5)} center ${(a + b * 997).toFixed(2)} max residual ${maxres.toFixed(3)} max|dy| ${maxdy.toFixed(3)}`);
}
