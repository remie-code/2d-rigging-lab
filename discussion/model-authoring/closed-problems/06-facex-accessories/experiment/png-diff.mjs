// Pixel diff between two renders emitted by render-software (8-bit RGBA, filter 0).
// Usage: node fix-png-diff.mjs a.png b.png [pxPerStageX pxPerStageY minX minY]
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const decode = (path) => {
  const b = readFileSync(path);
  let o = 8, w = 0, h = 0; const parts = [];
  const u32 = (a) => b.readUInt32BE(a);
  while (o < b.length) {
    const len = u32(o); const t = b.toString("ascii", o + 4, o + 8); const s = o + 8;
    if (t === "IHDR") { w = u32(s); h = u32(s + 4); }
    else if (t === "IDAT") parts.push(b.subarray(s, s + len));
    else if (t === "IEND") break;
    o = s + len + 4;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const row = w * 4; const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    if (raw[y * (row + 1)] !== 0) throw new Error("filter!=0");
    raw.copy(out, y * row, y * (row + 1) + 1, y * (row + 1) + 1 + row);
  }
  return { w, h, d: out };
};

const A = decode(process.argv[2]), B = decode(process.argv[3]);
const [ppx, ppy, minX, minY] = process.argv.slice(4).map(Number);
if (A.w !== B.w || A.h !== B.h) { console.log(`size mismatch ${A.w}x${A.h} vs ${B.w}x${B.h}`); process.exit(1); }
let n = 0, mnx = 1e9, mxx = -1, mny = 1e9, mxy = -1, maxd = 0;
for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
  const i = (y * A.w + x) * 4;
  const d = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i+1] - B.d[i+1]), Math.abs(A.d[i+2] - B.d[i+2]), Math.abs(A.d[i+3] - B.d[i+3]));
  if (d > 2) { n++; if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; if (d > maxd) maxd = d; }
}
console.log(`diff pixels: ${n} (maxΔ ${maxd}) of ${A.w * A.h}`);
if (n) {
  console.log(`img bbox x[${mnx},${mxx}] y[${mny},${mxy}]`);
  if (ppx) console.log(`stage bbox x[${(minX + mnx / ppx).toFixed(0)},${(minX + mxx / ppx).toFixed(0)}] y[${(minY + mny / ppy).toFixed(0)},${(minY + mxy / ppy).toFixed(0)}]`);
}
