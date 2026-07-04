// cp13fix2 DIAGNOSIS (read-only, rest vertices at rev 385).
//
// Fix2 design (L0-confirmed): the fix1 W band (tuft 550..900 / curtain
// 500..1000, inherited from cp08) claims the strands stay glued to the skull
// down to the jaw. That is a lie: the drawn strands hang freely from their
// attachment bands (temple / nape hairline). Because the rotation field's dx
// flips sign at the pivot row (y=596), the lying W band CANCELS the carried X
// inside the transition ("mid-band frozen, tips swinging" inversion).
// Fix2 shortens the contact band to just below the measured attachment band
// and lets everything below carry d_att(u) = rot(u, y_att) uniformly.
//
// This script measures what the W_new decision needs:
//   1) strand root profiles: y-binned vertex extents of the top 400px of each
//      strand mesh (where does the DRAWN root band end?);
//   2) back_top L/R + headwear mesh extents and their overlap with the curtain
//      root columns (where is the seam row?);
//   3) candidate-dial table: for each strand, field dx along the strand for
//      fix1 vs fix2 candidates (the mid-band uniformity prediction), plus the
//      seam-row mismatch vs exact rotation (tear risk in px, before/after).
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
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

const STRANDS = {
  hair_f_r:    { drawable: "draw_r0_1cea4f6f_21b4da82_hair_f_r",    att: { x: 1107, y: 268 }, yTop: 242 },
  hair_f_l:    { drawable: "draw_r0_1cea4f6f_21b4da21_hair_f_l",    att: { x: 869,  y: 311 }, yTop: 282 },
  back_hair_r: { drawable: "draw_r0_1cea4f6f_f26916b1_back_hair_r", att: { x: 858,  y: 369 }, yTop: 344 },
  back_hair_l: { drawable: "draw_r0_1cea4f6f_f2691750_back_hair_l", att: { x: 1103, y: 328 }, yTop: 306 }
};
const NEIGHBORS = [
  "draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r",
  "draw_r131_0bbc8ea5_f823b423_back_top_hair_l"
];
const ALL = [...Object.values(STRANDS).map((s) => s.drawable), ...NEIGHBORS];

const inspect = (label) => {
  const spec = {
    command: "inspectEvaluatedGeometry",
    payload: { targets: ALL.map((id) => ({ kind: "drawable", drawableId: id })), includeVertices: true }
  };
  const p = join(HERE, "commands", `diag-fix2-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `diag-fix2-${label}.response.json`), "utf8"));
  return Object.fromEntries(r.aiCommandResponse.payload.results.map((x) =>
    [x.drawableId, x.vertices ?? x.evaluatedVertices]));
};
const rest = inspect("rest");
const f1 = (v) => v.toFixed(1);

console.log("=== 1) strand root profiles (40px y-bins over the top 400px; rest vertices) ===");
for (const [key, el] of Object.entries(STRANDS)) {
  const vs = rest[el.drawable];
  console.log(`${key} (mesh yTop ${el.yTop}, att row ${el.att.y}):`);
  for (let b = 0; b < 10; b++) {
    const y0 = el.yTop + b * 40, y1 = y0 + 40;
    const bin = vs.filter((v) => v.y >= y0 && v.y < y1);
    if (!bin.length) { console.log(`  y ${y0}..${y1}: (no vertices)`); continue; }
    const xs = bin.map((v) => v.x);
    console.log(`  y ${y0}..${y1}: n=${bin.length} x ${f1(Math.min(...xs))}..${f1(Math.max(...xs))} width ${f1(Math.max(...xs) - Math.min(...xs))}`);
  }
}

console.log("\n=== 2) back_top L/R extents + per-bin bottom edge over the curtain root columns ===");
for (const id of NEIGHBORS) {
  const vs = rest[id];
  const xs = vs.map((v) => v.x), ys = vs.map((v) => v.y);
  console.log(`${id.split("_").slice(-4).join("_")}: x ${f1(Math.min(...xs))}..${f1(Math.max(...xs))}  y ${f1(Math.min(...ys))}..${f1(Math.max(...ys))}`);
  // bottom edge y by 60px x-bins (where does back_top stop covering the curtain?)
  const x0 = Math.min(...xs);
  const bins = [];
  for (let b = 0; ; b++) {
    const bx0 = x0 + b * 60, bx1 = bx0 + 60;
    if (bx0 > Math.max(...xs)) break;
    const bin = vs.filter((v) => v.x >= bx0 && v.x < bx1);
    if (bin.length) bins.push(`x${Math.round(bx0)}..${Math.round(bx1)}: yBot ${f1(Math.max(...bin.map((v) => v.y)))}`);
  }
  console.log("  " + bins.join(" | "));
}

console.log("\n=== 3) candidate dials: dx profile along each strand (theta=+10) ===");
// fix1 dials (the lie) vs fix2 candidates (short contact band).
const CAND = JSON.parse(readFileSync(join(HERE, "fix2-dial-candidates.json"), "utf8"));
const W_OLD = { hair_f_r: { yHead: 550, yFree: 900 }, hair_f_l: { yHead: 550, yFree: 900 },
  back_hair_r: { yHead: 500, yFree: 1000 }, back_hair_l: { yHead: 500, yFree: 1000 } };
const weight = (d) => (y) => y <= d.yHead ? 1 : 1 - smooth((y - d.yHead) / (d.yFree - d.yHead));
const fieldDx = (el, dial) => (y) => {
  const w = weight(dial)(y);
  return w * rot(el.att.x, y, THETA).x + (1 - w) * rot(el.att.x, el.att.y, THETA).x;
};
for (const [key, el] of Object.entries(STRANDS)) {
  const cand = CAND[key];
  const dAtt = rot(el.att.x, el.att.y, THETA);
  console.log(`${key}: d_att=(${f1(dAtt.x)},${f1(dAtt.y)})  fix1 W ${W_OLD[key].yHead}..${W_OLD[key].yFree}  fix2 W ${cand.yHead}..${cand.yFree}`);
  const rows = [el.yTop, el.att.y, cand.yHead, cand.yFree, 550, 700, 850, 1000, 1300, 1600]
    .filter((y, i, a) => a.indexOf(y) === i).sort((a, b) => a - b);
  console.log("  " + rows.map((y) =>
    `y${Math.round(y)}: f1 ${f1(fieldDx(el, W_OLD[key])(y))} -> f2 ${f1(fieldDx(el, cand)(y))}`).join(" | "));
}

console.log("\n=== 4) seam mismatch vs exact rotation at candidate rows (curtains; tear risk in px) ===");
for (const key of ["back_hair_r", "back_hair_l"]) {
  const el = STRANDS[key], cand = CAND[key];
  const out = [];
  for (const y of [400, 450, 500, 550, 600, 650]) {
    const r0 = rot(el.att.x, y, THETA);
    const m = (dial) => {
      const w = weight(dial)(y);
      const fx = w * r0.x + (1 - w) * rot(el.att.x, el.att.y, THETA).x;
      const fy = w * r0.y + (1 - w) * rot(el.att.x, el.att.y, THETA).y;
      return Math.hypot(fx - r0.x, fy - r0.y);
    };
    out.push(`y${y}: f1 ${f1(m(W_OLD[key]))} -> f2 ${f1(m(cand))}`);
  }
  console.log(`${key}: ` + out.join(" | "));
}
