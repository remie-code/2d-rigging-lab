// cp15: texture tape-measure for the tie knot bottom edge (the fixed line of
// the tie's BodyZ correction). Pure reading, no mutation.
//
// The tie is drawn as: knot (triangular bulge at the collar) -> narrow neck ->
// widening blade -> V tip. The knot bottom = the row where the knot bulge ends,
// read as the local width minimum below the bulge (the "neck" row) in the
// per-row alpha width profile.
// Usage: node measure-tie-knot.mjs
import { readFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const TEX = `${PKG}/assets/textures/psd/r0_1cea4f6f`;
const LAYER = "psd_root_group_6_layer_0";                 // tie (cp10 catalog)
const DRAW = "draw_r0_1cea4f6f_ea30e9c4_tie";

const meshes = JSON.parse(readFileSync(`${PKG}/model/meshes.json`, "utf8")).meshes;
const b = meshes.find((m) => m.drawableId === DRAW).bounds;
const buf = readFileSync(`${TEX}/${LAYER}.raw-rgba`);
if (buf.length !== b.width * b.height * 4) throw new Error("byte length mismatch");

const rows = [];
for (let r = 0; r < b.height; r++) {
  let n = 0, sx = 0, x0 = Infinity, x1 = -Infinity;
  for (let c = 0; c < b.width; c++) {
    const a = buf[(r * b.width + c) * 4 + 3];
    if (a > 32) { n++; sx += c; if (c < x0) x0 = c; if (c > x1) x1 = c; }
  }
  rows.push(n ? { y: b.y + r, x0: b.x + x0, x1: b.x + x1, w: x1 - x0 + 1, cx: b.x + sx / n, n } : { y: b.y + r, w: 0, n: 0 });
}
const drawn = rows.filter((r) => r.n > 0);
console.log(`tie bounds x${b.x}..${b.x + b.width} y${b.y}..${b.y + b.height}; drawn y${drawn[0].y}..${drawn[drawn.length - 1].y}`);

// full profile every 8 rows down to y=900 (knot region detail), then every 40
for (const r of drawn) {
  if ((r.y <= 900 && (r.y - drawn[0].y) % 8 === 0) || (r.y > 900 && (r.y - drawn[0].y) % 40 === 0))
    console.log(` y${String(r.y).padStart(5)} x${String(r.x0).padStart(5)}..${String(r.x1).padStart(4)} w=${String(r.w).padStart(4)} cx=${r.cx.toFixed(1)}`);
}

// knot bottom candidate: local width minimum in the upper half (below the widest
// knot row, above the blade re-widening)
const top = drawn.filter((r) => r.y <= drawn[0].y + 260);
const maxW = Math.max(...top.map((r) => r.w));
const peak = top.find((r) => r.w === maxW);
const below = top.filter((r) => r.y > peak.y);
let neck = below[0];
for (const r of below) if (r.w <= neck.w) neck = r;
console.log(`\nknot width peak: y=${peak.y} w=${peak.w}; local width minimum below peak (knot bottom candidate): y=${neck.y} w=${neck.w}`);
// vertical-axis check of the blade: centroid x drift below the neck
const blade = drawn.filter((r) => r.y >= neck.y && r.y <= drawn[drawn.length - 1].y - 60);
const cxs = blade.map((r) => r.cx);
console.log(`blade centroid x: min ${Math.min(...cxs).toFixed(1)} max ${Math.max(...cxs).toFixed(1)} (drawn plumb check: small drift = tie drawn vertical)`);
