// cp05 fix: measure the horizontal margin between the back-hair curtain's
// hidden-at-rest root pixels and the head silhouette edge, at param +-30.
// Silhouette occluders in the root band: front_hair, hair_f_l, hair_f_r,
// back_top_hair_r/l (new occiput layer, static first pass), face.
// Headwear excluded (unmeshed -> not rendered).
import { readFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const CX = 1001;
const CHORD = 0.1875 * (Math.cos(Math.PI / 6) - 1); // -0.02512
const ZC = 0.09375;
const EQ_Y = 463, CAP_R = 320;
const capS = (y) => y >= EQ_Y ? 1 : Math.sqrt(Math.max(0, 1 - ((EQ_Y - y) / CAP_R) ** 2));

// texture defs: file, canvas placement, size
const TEX = {
  front_hair:      { f: "psd/r0_1cea4f6f/psd_root_group_2_layer_0.raw-rgba", x: 692, y: 144, w: 620, h: 806 },
  hair_f_l:        { f: "psd/r0_1cea4f6f/psd_root_group_2_layer_1.raw-rgba", x: 732, y: 284, w: 200, h: 666 },
  hair_f_r:        { f: "psd/r0_1cea4f6f/psd_root_group_2_layer_2.raw-rgba", x: 1045, y: 244, w: 215, h: 687 },
  face:            { f: "psd/r0_1cea4f6f/psd_root_group_5_layer_1.raw-rgba", x: 864, y: 306, w: 272, h: 269 },
  back_hair_r:     { f: "psd/r0_1cea4f6f/psd_root_group_12_layer_0.raw-rgba", x: 412, y: 346, w: 592, h: 1448 },
  back_hair_l:     { f: "psd/r0_1cea4f6f/psd_root_group_12_layer_1.raw-rgba", x: 1004, y: 308, w: 463, h: 1433 },
  back_top_hair_r: { f: "psd/r131_0bbc8ea5/psd_root_group_0_layer_0.raw-rgba", x: 591, y: 216, w: 600, h: 600 },
  back_top_hair_l: { f: "psd/r131_0bbc8ea5/psd_root_group_0_layer_1.raw-rgba", x: 810, y: 211, w: 600, h: 600 },
};

const ALPHA = 64;
// rows(name) -> Map(canvasY -> [minX,maxX]) opaque extents
function rows(name) {
  const t = TEX[name];
  const buf = readFileSync(`${PKG}/assets/textures/${t.f}`);
  const m = new Map();
  for (let ry = 0; ry < t.h; ry++) {
    let mn = -1, mx = -1;
    for (let rx = 0; rx < t.w; rx++) {
      if (buf[(ry * t.w + rx) * 4 + 3] >= ALPHA) { if (mn < 0) mn = rx; mx = rx; }
    }
    if (mn >= 0) m.set(t.y + ry, [t.x + mn, t.x + mx]);
  }
  return m;
}

// committed fields (gain-1 canon)
const frontZ = (x, y) => 320 * Math.max(0, 1 - ((x - CX) / 320) ** 2) * capS(y);
const frontDx = (x, y, key) => CHORD * (x - CX) + key * ZC * frontZ(x, y); // key = +1 / -1
const U_SPREAD = 650;
const backZ = (x, y) => -CAP_R * Math.max(0, 1 - ((x - CX) / U_SPREAD) ** 2) * capS(y);
const backDx = (x, y, key) => CHORD * (x - CX) * (CAP_R / U_SPREAD) + key * ZC * backZ(x, y);

const R = Object.fromEntries(Object.keys(TEX).map(k => [k, rows(k)]));

// silhouette edge per row: union of front-layer extents
function silhouette(y, key, includeOcciput) {
  let mn = Infinity, mx = -Infinity;
  const parts = ["front_hair", "hair_f_l", "hair_f_r", "face"];
  if (includeOcciput) parts.push("back_top_hair_r", "back_top_hair_l");
  for (const p of parts) {
    const e = R[p].get(y);
    if (!e) continue;
    // move each edge by its own field (occiput treated static for now: dx=0)
    const isOcc = p.startsWith("back_top");
    const dl = isOcc ? 0 : frontDx(e[0], y, key);
    const dr = isOcc ? 0 : frontDx(e[1], y, key);
    mn = Math.min(mn, e[0] + dl);
    mx = Math.max(mx, e[1] + dr);
  }
  return [mn, mx];
}

console.log("row  | silL(rest,+30,-30) | bhr.minx rest -> dx+30/-30 | marginL+30 | silR(rest,+30,-30) | bhl.maxx rest -> dx+30/-30 | marginR-30");
for (let y = 270; y <= 900; y += 15) {
  const [sl0] = silhouette(y, 0, true); const [slp] = silhouette(y, +1, true); const [slm] = silhouette(y, -1, true);
  const [, sr0] = silhouette(y, 0, true); const [, srp] = silhouette(y, +1, true); const [, srm] = silhouette(y, -1, true);
  const br = R.back_hair_r.get(y); const bl = R.back_hair_l.get(y);
  let left = "-", ml = "-";
  if (br) {
    const b = br[0];
    const dxp = backDx(b, y, +1), dxm = backDx(b, y, -1);
    const hidden = b >= sl0;
    // at +30 curtain moves left: exposed if b+dxp < slp
    ml = hidden ? `hid rest(b-sl=${(b - sl0).toFixed(0)}) +30:${(b + dxp - slp).toFixed(0)} -30:${(b + dxm - slm).toFixed(0)}` : `visRest(${(b - sl0).toFixed(0)})`;
    left = `${b} dx ${dxp.toFixed(1)}/${dxm.toFixed(1)}`;
  }
  let right = "-", mr = "-";
  if (bl) {
    const b = bl[1];
    const dxp = backDx(b, y, +1), dxm = backDx(b, y, -1);
    const hidden = b <= sr0;
    mr = hidden ? `hid rest(sr-b=${(sr0 - b).toFixed(0)}) +30:${(srp - (b + dxp)).toFixed(0)} -30:${(srm - (b + dxm)).toFixed(0)}` : `visRest(${(sr0 - b).toFixed(0)})`;
    right = `${b} dx ${dxp.toFixed(1)}/${dxm.toFixed(1)}`;
  }
  console.log(`${y} | L ${isFinite(sl0) ? sl0.toFixed(0) : "-"} / ${isFinite(slp) ? slp.toFixed(0) : "-"} / ${isFinite(slm) ? slm.toFixed(0) : "-"} | ${left} | ${ml} || R ${isFinite(sr0) ? sr0.toFixed(0) : "-"} / ${isFinite(srp) ? srp.toFixed(0) : "-"} / ${isFinite(srm) ? srm.toFixed(0) : "-"} | ${right} | ${mr}`);
}
