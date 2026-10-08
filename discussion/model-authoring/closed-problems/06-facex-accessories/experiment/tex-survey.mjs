// cp06: survey headwear/eyewear textures (opaque extents) + adjacency vs
// neighbouring layers (front_hair, back_top_hair_r/l) to design the hat's
// edge bands and the glasses' affine field.
import { readFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const TEX = {
  headwear:        { f: "psd/r0_1cea4f6f/psd_root_layer_0.raw-rgba", x: 808, y: 92,  w: 400, h: 288 },
  eyewear:         { f: "psd/r0_1cea4f6f/psd_root_layer_3.raw-rgba", x: 862, y: 404, w: 265, h: 110 },
  front_hair:      { f: "psd/r0_1cea4f6f/psd_root_group_2_layer_0.raw-rgba", x: 692, y: 144, w: 620, h: 806 },
  back_top_hair_r: { f: "psd/r131_0bbc8ea5/psd_root_group_0_layer_0.raw-rgba", x: 591, y: 216, w: 600, h: 600 },
  back_top_hair_l: { f: "psd/r131_0bbc8ea5/psd_root_group_0_layer_1.raw-rgba", x: 810, y: 211, w: 600, h: 600 },
};
const ALPHA = 64;

function rows(name) {
  const t = TEX[name];
  const buf = readFileSync(`${PKG}/assets/textures/${t.f}`);
  const m = new Map();
  for (let ry = 0; ry < t.h; ry++) {
    let mn = -1, mx = -1, cnt = 0;
    for (let rx = 0; rx < t.w; rx++) {
      if (buf[(ry * t.w + rx) * 4 + 3] >= ALPHA) { if (mn < 0) mn = rx; mx = rx; cnt++; }
    }
    if (mn >= 0) m.set(t.y + ry, [t.x + mn, t.x + mx, cnt]);
  }
  return m;
}

const R = {};
for (const k of Object.keys(TEX)) R[k] = rows(k);

for (const k of ["headwear", "eyewear"]) {
  const ys = [...R[k].keys()];
  console.log(`\n== ${k}: opaque rows y[${Math.min(...ys)},${Math.max(...ys)}]`);
  const step = k === "eyewear" ? 5 : 10;
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += step) {
    const e = R[k].get(y);
    if (!e) { console.log(` y=${y}: (transparent row)`); continue; }
    const [mn, mx, cnt] = e;
    const fill = (cnt / (mx - mn + 1)).toFixed(2);
    // adjacency: nearest layers at this row
    const fh = R.front_hair.get(y);
    const br = R.back_top_hair_r.get(y);
    const bl = R.back_top_hair_l.get(y);
    console.log(` y=${y}: x[${mn},${mx}] w=${mx - mn + 1} fill=${fill}` +
      (fh ? ` | fh x[${fh[0]},${fh[1]}]` : "") +
      (br ? ` | btr x[${br[0]},${br[1]}]` : "") +
      (bl ? ` | btl x[${bl[0]},${bl[1]}]` : ""));
  }
}

// eyewear columns: where are the temples/lenses? column profile
console.log("\n== eyewear column profile (opaque count per column, step 10)");
{
  const t = TEX.eyewear;
  const buf = readFileSync(`${PKG}/assets/textures/${t.f}`);
  for (let rx = 0; rx < t.w; rx += 10) {
    let cnt = 0, mn = -1, mx = -1;
    for (let ry = 0; ry < t.h; ry++) {
      if (buf[(ry * t.w + rx) * 4 + 3] >= ALPHA) { cnt++; if (mn < 0) mn = ry; mx = ry; }
    }
    if (cnt) console.log(` x=${t.x + rx}: y[${t.y + mn},${t.y + mx}] cnt=${cnt}`);
  }
}
