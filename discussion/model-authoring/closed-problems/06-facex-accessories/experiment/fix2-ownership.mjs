// cp06fix2: ownership map of the hat's contact edges (fix2 correction A input).
//
// Principle (L0-user agreed): where two layers overlap on screen, the FRONT
// layer owns the appearance; the back layer's field must locally follow the
// front layer's field in the contact band, or the two slide apart and read as
// two flat stickers.
//
// Draw order (established empirically this round): LOWER baseDrawOrder is
// drawn IN FRONT. headwear = 0 = the topmost drawable of the whole model.
// So nothing literally covers the hat; the "bangs in front of the brim" look
// is the hat texture's scalloped alpha edge with hair (order 2/3/4) visible
// through/around it. Ownership of the hat's visible boundary therefore has to
// be measured per row: what is the topmost visible layer immediately OUTSIDE
// the hat's alpha edge, and how much hair sits right BEHIND the edge band.
//   - outside = background (or btr/btl sliver): the hat edge is a true outer
//     silhouette -> keep the 8th-gen occiput anchoring.
//   - outside/behind = front hair or side tufts: the visible boundary is
//     pictorially interlocked with hair strands the viewer reads as being in
//     front -> the hat edge band must follow the FRONT-HAIR field (hat surface
//     sits just above the front-hair shell, so ~zero parallax is also the
//     physically correct statement).
//
// Placements: headwear/front_hair/btr/btl from tex-survey.mjs (canonical);
// hair_f_l/hair_f_r fitted from meshes.json uv mapping this round:
//   hair_f_l (730,282) 200x666, hair_f_r (1043,242) 215x687
// (uv->stage linear fit residual <= 2px; byteLength factorization fixes W*H).
import { readFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const L = (f, x, y, w, h) => ({ buf: readFileSync(`${PKG}/assets/textures/${f}`), x, y, w, h });
const hat = L("psd/r0_1cea4f6f/psd_root_layer_0.raw-rgba", 808, 92, 400, 288);
const fh  = L("psd/r0_1cea4f6f/psd_root_group_2_layer_0.raw-rgba", 692, 144, 620, 620);
const hfl = L("psd/r0_1cea4f6f/psd_root_group_2_layer_1.raw-rgba", 730, 282, 200, 666);
const hfr = L("psd/r0_1cea4f6f/psd_root_group_2_layer_2.raw-rgba", 1043, 242, 215, 687);
const btr = L("psd/r131_0bbc8ea5/psd_root_group_0_layer_0.raw-rgba", 591, 216, 600, 600);
const btl = L("psd/r131_0bbc8ea5/psd_root_group_0_layer_1.raw-rgba", 810, 211, 600, 600);
const ALPHA = 64;

const a = (t, sx, sy) => {
  const rx = Math.round(sx - t.x), ry = Math.round(sy - t.y);
  if (rx < 0 || ry < 0 || rx >= t.w || ry >= t.h) return 0;
  return t.buf[(ry * t.w + rx) * 4 + 3];
};
// topmost visible non-hat layer at a stage pixel (front-to-back order)
const visible = (sx, sy) => {
  if (a(fh, sx, sy) >= ALPHA) return "FH";
  if (a(hfl, sx, sy) >= ALPHA) return "HL";
  if (a(hfr, sx, sy) >= ALPHA) return "HR";
  if (a(btr, sx, sy) >= ALPHA) return "BR";
  if (a(btl, sx, sy) >= ALPHA) return "BL";
  return "..";
};
const hairAt = (sx, sy) =>
  a(fh, sx, sy) >= ALPHA || a(hfl, sx, sy) >= ALPHA || a(hfr, sx, sy) >= ALPHA;

// --- per-row edge survey ---
console.log("row | edgeL  outsideL(5..25px) hairBehindL | edgeR  outsideR hairBehindR");
for (let y = 124; y <= 380; y += 4) {
  let mn = -1, mx = -1;
  for (let rx = 0; rx < hat.w; rx++) {
    if (a(hat, hat.x + rx, y) >= ALPHA) { if (mn < 0) mn = hat.x + rx; mx = hat.x + rx; }
  }
  if (mn < 0) { console.log(`y=${y}: transparent`); continue; }
  const side = (edge, dir) => {
    const tally = {};
    for (let d = 5; d <= 25; d++) {
      const v = visible(edge + dir * d, y);
      tally[v] = (tally[v] ?? 0) + 1;
    }
    const top = Object.entries(tally).sort((p, q) => q[1] - p[1])[0][0];
    // hair coverage right behind the hat within 30px inside the edge
    let inHair = 0, inN = 0;
    for (let d = 0; d <= 30; d++) {
      const sx = edge - dir * d;
      if (a(hat, sx, y) < ALPHA) continue;
      inN++; if (hairAt(sx, y)) inHair++;
    }
    return `${top}:${(Object.values(tally).sort((p,q)=>q-p)[0] / 21).toFixed(2)} bh=${inN ? (inHair / inN).toFixed(2) : "-"}`;
  };
  console.log(`y=${y}: L x${mn} ${side(mn, -1)} | R x${mx} ${side(mx, +1)}`);
}

// --- bottom scallop: per column, what is below the hat's bottom alpha edge ---
console.log("\ncol | bottomEdgeY  below(5..25px)");
for (let x = 820; x <= 1200; x += 20) {
  let bot = -1;
  for (let ry = hat.h - 1; ry >= 0; ry--) {
    if (a(hat, x, hat.y + ry) >= ALPHA) { bot = hat.y + ry; break; }
  }
  if (bot < 0) continue;
  const tally = {};
  for (let d = 5; d <= 25; d++) {
    const v = visible(x, bot + d);
    tally[v] = (tally[v] ?? 0) + 1;
  }
  const top = Object.entries(tally).sort((p, q) => q[1] - p[1])[0][0];
  console.log(`x=${x} (u=${x - 1001}): bottom y=${bot} below=${top}`);
}

// --- rest hair silhouette below the hat corners (B input: rest contour) ---
console.log("\nhair silhouette rows y380..470 (L: min-x of fh|hfl, R: max-x of fh|hfr)");
for (let y = 380; y <= 470; y += 6) {
  let mn = 1e9, mx = -1e9;
  for (let sx = 700; sx <= 1320; sx++) {
    if (a(fh, sx, y) >= ALPHA || a(hfl, sx, y) >= ALPHA) mn = Math.min(mn, sx);
    if (a(fh, sx, y) >= ALPHA || a(hfr, sx, y) >= ALPHA) mx = Math.max(mx, sx);
  }
  console.log(`y=${y}: L ${mn === 1e9 ? "-" : mn} R ${mx === -1e9 ? "-" : mx}`);
}
