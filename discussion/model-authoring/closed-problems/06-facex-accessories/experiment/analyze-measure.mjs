// cp06: compare evaluated vertices at +-30 vs rest.
// - headwear: band-averaged dx per y-band (field applied as designed? dy=0?)
// - eyewear: rigidity check — fit dx = a + b*x per key, report max residual
// - back_top_hair: top band vs lower bands (rewrite applied, lower rows intact)
// - back_hair_r: unchanged vs cp05fix (spot check root/tip bands)
import { readFileSync } from "node:fs";

const load = (k) => {
  const r = JSON.parse(readFileSync(new URL(`commands/measure-${k}.response.json`, import.meta.url), "utf8"));
  const targets = r.aiCommandResponse.payload.results;
  const map = {};
  for (const t of targets) map[t.drawableId] = t.vertices;
  return map;
};
const rest = load("rest"), plus = load("plus30"), minus = load("minus30");
const ids = Object.keys(rest);
console.log("targets:", ids.map(i => `${i.slice(-20)}(${rest[i].length})`).join(" "));

const stats = (id, bands) => {
  console.log(`== ${id.slice(-25)}`);
  for (const [lo, hi] of bands) {
    let n = 0, sp = 0, sm = 0, spy = 0, smy = 0, minp = 1e9, maxp = -1e9;
    for (let i = 0; i < rest[id].length; i++) {
      const v = rest[id][i];
      if (v.y < lo || v.y > hi) continue;
      const dp = plus[id][i].x - v.x, dm = minus[id][i].x - v.x;
      n++; sp += dp; sm += dm; spy += Math.abs(plus[id][i].y - v.y); smy += Math.abs(minus[id][i].y - v.y);
      minp = Math.min(minp, dp); maxp = Math.max(maxp, dp);
    }
    if (n) console.log(` y[${lo},${hi}] n=${n} dx+30 avg ${(sp / n).toFixed(1)} [${minp.toFixed(1)},${maxp.toFixed(1)}] | dx-30 avg ${(sm / n).toFixed(1)} | |dy| ${(spy / n + smy / n).toFixed(2)}`);
  }
};

stats("draw_r0_1cea4f6f_9dc00ee4_headwear", [[89, 170], [170, 264], [264, 330], [330, 382]]);
stats("draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r", [[264, 300], [300, 360], [360, 435], [435, 600], [600, 782]]);
stats("draw_r131_0bbc8ea5_f823b423_back_top_hair_l", [[252, 300], [300, 360], [360, 435], [435, 600], [600, 777]]);
stats("draw_r0_1cea4f6f_f26916b1_back_hair_r", [[346, 500], [500, 769], [1100, 1700]]);

// eyewear rigidity: least-squares dx = a + b*x, max residual
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
  console.log(`eyewear ${label}: n=${n} fit dx = ${a.toFixed(2)} + ${b.toFixed(5)}*x  (slope target ${(-0.02512).toFixed(5)}) center dx ${(a + b * 997).toFixed(2)} | max residual ${maxres.toFixed(3)}px | max |dy| ${maxdy.toFixed(3)}`);
}
