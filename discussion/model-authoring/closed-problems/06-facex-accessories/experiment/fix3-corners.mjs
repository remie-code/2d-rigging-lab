// cp06fix3 F1 input: per-segment tangent-partner selection at the hat's bottom
// corners. Q3 (ledger) gives the REST adjacency; this script measures, from the
// deformed vertices at +-30 (commands/fix2-measure-*.response.json, rev 166/168):
//   1. which y-segments of the outer silhouette below the hat corner are owned
//      by btr/btl (back_top_hair) vs the hair contour (front_hair/hair_f_*),
//      i.e. where the back-of-head part peeks out on the dy>0 (drooping) side;
//   2. contour tangents of ALL candidate partners (hair, btr/btl) at the
//      junction, rest and deformed, so the rest-joint-angle invariant (9th-gen
//      B doctrine) can be re-targeted per segment.
// Read-only: no ops emitted.
import { readFileSync } from "node:fs";

// SRC=fix3 reads commands/fix3-measure-*.response.json for +-30 (rest is
// pose-independent and always taken from the fix2 rest measurement).
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
const BTR = "draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r"; // screen LEFT
const BTL = "draw_r131_0bbc8ea5_f823b423_back_top_hair_l"; // screen RIGHT
const CX = 1001;

// outermost deformed vertex within a sliding y-window (silhouette approximation),
// restricted to the requested side by REST x (stable side assignment).
const contour = (ids, side, yLo, yHi, cur, step = 4, win = 9) => {
  const pts = [];
  for (const id of ids) {
    for (let i = 0; i < rest[id].length; i++) {
      const r = rest[id][i], c = cur[id][i];
      if (side === "L" ? r.x >= CX : r.x <= CX) continue;
      pts.push(c);
    }
  }
  const out = [];
  for (let y = yLo; y <= yHi; y += step) {
    let best = null;
    for (const p of pts) {
      if (Math.abs(p.y - y) > win) continue;
      if (!best || (side === "L" ? p.x < best.x : p.x > best.x)) best = p;
    }
    if (best) out.push({ y, x: best.x });
  }
  return out;
};
const at = (arr, y) => {
  const hit = arr.find((p) => p.y === Math.round(y / 4) * 4) ??
    arr.reduce((a, p) => (!a || Math.abs(p.y - y) < Math.abs(a.y - y) ? p : a), null);
  return hit ? hit.x : NaN;
};
// least-squares slope dx/dy over a y-window of a contour
const slope = (arr, yLo, yHi) => {
  const pts = arr.filter((p) => p.y >= yLo && p.y <= yHi);
  if (pts.length < 2) return NaN;
  const n = pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / n, mx = pts.reduce((s, p) => s + p.x, 0) / n;
  let syy = 0, syx = 0;
  for (const p of pts) { syy += (p.y - my) ** 2; syx += (p.y - my) * (p.x - mx); }
  return syx / syy;
};
// hat corner: deepest hat vertex on this side (deformed)
const tipOf = (side, cur) => {
  let tip = null;
  for (let i = 0; i < rest[HAT].length; i++) {
    const r = rest[HAT][i], c = cur[HAT][i];
    if (side === "L" ? r.x >= CX : r.x <= CX) continue;
    if (!tip || c.y > tip.y) tip = c;
  }
  return tip;
};

for (const [label, cur] of [["rest", rest], ["+30", plus], ["-30", minus]]) {
  console.log(`\n===== ${label} =====`);
  for (const side of ["L", "R"]) {
    const hairIds = [FH, side === "L" ? HFL : HFR];
    const btId = side === "L" ? BTR : BTL;
    const tip = tipOf(side, cur);
    const hatC = contour([HAT], side, tip.y - 40, tip.y, cur);
    const hairC = contour(hairIds, side, tip.y - 10, tip.y + 70, cur);
    const btC = contour([btId], side, tip.y - 10, tip.y + 70, cur);
    console.log(`-- ${side}: hat tip (${tip.x.toFixed(1)}, ${tip.y.toFixed(1)})`);
    console.log("   below-tip silhouette: y | hair_x | bt_x | outermost (margin px)");
    for (let y = Math.round(tip.y / 4) * 4; y <= tip.y + 60; y += 8) {
      const hx = at(hairC, y), bx = at(btC, y);
      if (Number.isNaN(hx) && Number.isNaN(bx)) continue;
      const lead = side === "L" ? (bx < hx ? "bt" : "hair") : (bx > hx ? "bt" : "hair");
      const m = Math.abs(hx - bx);
      console.log(`   ${y} | ${hx.toFixed(1)} | ${bx.toFixed(1)} | ${lead} (+${m.toFixed(1)})`);
    }
    const tail = slope(hatC, tip.y - 34, tip.y + 0.1);
    const hairT = slope(hairC, tip.y, tip.y + 38);
    const btT = slope(btC, tip.y, tip.y + 38);
    console.log(`   tangents dx/dy: hat tail ${tail.toFixed(3)} | hair ${hairT.toFixed(3)} | bt ${btT.toFixed(3)}`);
    console.log(`   joint vs hair ${(tail - hairT).toFixed(3)} | joint vs bt ${(tail - btT).toFixed(3)}`);
  }
}
