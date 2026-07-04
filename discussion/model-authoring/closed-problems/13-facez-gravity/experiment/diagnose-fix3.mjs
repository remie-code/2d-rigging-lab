// cp13fix3 DIAGNOSIS (read-only, rest vertices at rev 393).
//
// Fix3 final model (user-language, L0-confirmed after 3 rounds):
//   band 1 (scalp): drawable top .. y_scalp = the region where hair GROWS =
//                   part of the scalp -> FULL rotation rot(u,y) (never leave
//                   the Z-rotation deformer's world);
//   band 2 (hang):  everything below y_scalp -> uniform carry of
//                   d_scalp(u) = rot(u, y_scalp) (X and Y, a modest oblique
//                   vector: dx ~ theta*(596-y_scalp) ~ 17px class);
//   band 3 (tips):  plumb term preserved byte-for-byte (curtains, fix2 style).
// The ONE dial of this round is y_scalp = "the bottom of the drawn hair-growing
// region" (below the sideburn / below the nape hairline). fix2's boundary sat
// at the mesh top (the attachment CUT edge), suspending the whole scalp band
// and over-swinging it; the original (550) was nearly right but its 350px
// transition straddled the pivot row 596 and cancelled the carry. Correct:
// boundary at the sideburn bottom, SHARP transition, never cross y=596.
//
// This script measures what the y_scalp decision needs:
//   0) anatomical reference rows: iris/eyelash y-extents ("just below the
//      eyes"), ear y-extents (sideburns end near the ear lobe), neck top;
//   1) tufts: per-20px-y-bin x-extents of tuft mesh vs face mesh -> the row
//      where the strand's inner edge LEAVES the face silhouette (the face
//      narrows to the jaw; the strand keeps temple x) = where the drawn
//      hair-growing band ends and free hanging starts;
//   2) curtains: back_top per-x-bin bottom edge over the curtain root columns
//      = the drawn nape hairline (the hair mass the curtain grows out of);
//   3) candidate table: d_scalp = rot(u, y_scalp) per candidate row
//      (the modest oblique vector the hanging band would carry).
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

const STRANDS = {
  hair_f_r:    { drawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r",    att: { x: 1107, y: 268 }, side: "R" },
  hair_f_l:    { drawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l",    att: { x: 869,  y: 311 }, side: "L" },
  back_hair_r: { drawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r", att: { x: 858,  y: 369 }, side: "R" },
  back_hair_l: { drawable: "draw_r0_1cea4f6f_f2691750_back_hair_l", att: { x: 1103, y: 328 }, side: "L" }
};
const REF = {
  face:     "draw_r0_1cea4f6f_5c3cada6_face",
  earR:     "draw_r0_1cea4f6f_5c3cadc5_ears-r",
  earL:     "draw_r0_1cea4f6f_5c3cade4_ears-l",
  iridesL:  "draw_r0_1cea4f6f_3a8f7081_irides-l",
  iridesR:  "draw_r0_1cea4f6f_3a8f7143_irides-r",
  eyelashL: "draw_r0_1cea4f6f_3a8f70a0_eyelash-l",
  eyelashR: "draw_r0_1cea4f6f_3a8f7162_eyelash-r",
  neck:     "draw_r0_1cea4f6f_691e2eb3_neck",
  backTopR: "draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r",
  backTopL: "draw_r131_0bbc8ea5_f823b423_back_top_hair_l"
};
const ALL = [...Object.values(STRANDS).map((s) => s.drawable), ...Object.values(REF)];

const inspect = (label) => {
  const spec = {
    command: "inspectEvaluatedGeometry",
    payload: { targets: ALL.map((id) => ({ kind: "drawable", drawableId: id })), includeVertices: true }
  };
  const p = join(HERE, "commands", `diag-fix3-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `diag-fix3-${label}.response.json`), "utf8"));
  return Object.fromEntries(r.aiCommandResponse.payload.results.map((x) =>
    [x.drawableId, x.vertices ?? x.evaluatedVertices]));
};
const rest = inspect("rest");
const f1 = (v) => v.toFixed(1);
const ext = (vs) => ({
  x0: Math.min(...vs.map((v) => v.x)), x1: Math.max(...vs.map((v) => v.x)),
  y0: Math.min(...vs.map((v) => v.y)), y1: Math.max(...vs.map((v) => v.y))
});

console.log("=== 0) anatomical reference rows (rest) ===");
for (const [name, id] of Object.entries(REF)) {
  const e = ext(rest[id]);
  console.log(` ${name.padEnd(9)} x ${f1(e.x0)}..${f1(e.x1)}  y ${f1(e.y0)}..${f1(e.y1)}`);
}

console.log("\n=== 1) tuft inner edge vs face silhouette (20px y-bins, rest) ===");
const face = rest[REF.face];
const binExt = (vs, y0, y1) => {
  const bin = vs.filter((v) => v.y >= y0 && v.y < y1);
  if (!bin.length) return null;
  return { x0: Math.min(...bin.map((v) => v.x)), x1: Math.max(...bin.map((v) => v.x)), n: bin.length };
};
for (const key of ["hair_f_r", "hair_f_l"]) {
  const el = STRANDS[key];
  const vs = rest[el.drawable];
  console.log(`${key} (att row ${el.att.y}):  [overlap = how deep the strand's inner edge sits inside the face silhouette]`);
  for (let y = 380; y < 640; y += 20) {
    const s = binExt(vs, y, y + 20), f = binExt(face, y, y + 20);
    if (!s) { console.log(`  y ${y}..${y + 20}: (no strand vertices)`); continue; }
    if (!f) { console.log(`  y ${y}..${y + 20}: strand x ${f1(s.x0)}..${f1(s.x1)} | (no face vertices)`); continue; }
    const overlap = el.side === "R" ? f.x1 - s.x0 : s.x1 - f.x0;
    console.log(`  y ${y}..${y + 20}: strand x ${f1(s.x0)}..${f1(s.x1)} | face x ${f1(f.x0)}..${f1(f.x1)} | overlap ${f1(overlap)}`);
  }
}

console.log("\n=== 2) drawn nape hairline: back_top bottom edge over the curtain root columns (60px x-bins) ===");
for (const [key, btId] of [["back_hair_r", REF.backTopR], ["back_hair_l", REF.backTopL]]) {
  const el = STRANDS[key];
  const bt = rest[btId];
  const e = ext(bt);
  console.log(`${key} vs ${btId.split("_").slice(-4).join("_")} (x ${f1(e.x0)}..${f1(e.x1)}, y ${f1(e.y0)}..${f1(e.y1)}):`);
  const rows = [];
  for (let bx = Math.floor(e.x0 / 60) * 60; bx < e.x1; bx += 60) {
    const bin = bt.filter((v) => v.x >= bx && v.x < bx + 60);
    if (bin.length) rows.push(`x${bx}..${bx + 60}: yBot ${f1(Math.max(...bin.map((v) => v.y)))}`);
  }
  console.log("  " + rows.join(" | "));
  // curtain root x-band at the candidate rows (which columns matter)
  const vs = rest[el.drawable];
  for (const y of [440, 480, 520, 560]) {
    const b = binExt(vs, y - 20, y + 20);
    if (b) console.log(`  curtain x-band @y${y}+-20: ${f1(b.x0)}..${f1(b.x1)} (n=${b.n})`);
  }
}

console.log("\n=== 3) candidate y_scalp rows: the carried oblique vector d_scalp = rot(u, y_scalp), theta=+10 ===");
for (const [key, el] of Object.entries(STRANDS)) {
  const line = [460, 480, 500, 520, 540, 556].map((y) => {
    const d = rot(el.att.x, y, THETA);
    return `y${y}: (${f1(d.x)},${f1(d.y)})`;
  });
  console.log(` ${key.padEnd(12)} @x=${el.att.x}: ` + line.join("  "));
}
console.log("\n(fix2 carried d_att for comparison, theta=+10):");
for (const [key, el] of Object.entries(STRANDS)) {
  const d = rot(el.att.x, el.att.y, THETA);
  console.log(` ${key.padEnd(12)} d_att(y=${el.att.y}) = (${f1(d.x)},${f1(d.y)})`);
}
