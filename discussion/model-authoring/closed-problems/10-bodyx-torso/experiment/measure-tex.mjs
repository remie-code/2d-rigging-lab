// cp10: texture tape-measure. Decodes the raw-rgba layers of the body materials
// (bounds-sized, positioned at bounds.x/y in canvas coords, y-down) and prints
// row/column alpha profiles: spine cx, shoulder line, skirt tuck-in line,
// tie root, arm shape. No model mutation — pure reading.
// Usage: node measure-tex.mjs
import { readFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const TEX = `${PKG}/assets/textures/psd/r0_1cea4f6f`;

const meshesRaw = JSON.parse(readFileSync(`${PKG}/model/meshes.json`, "utf8"));
const meshes = meshesRaw.meshes ?? meshesRaw;
const drawablesRaw = JSON.parse(readFileSync(`${PKG}/model/drawables.json`, "utf8"));
const drawables = drawablesRaw.drawables ?? drawablesRaw;

const LAYERS = {
  tie: "psd_root_group_6_layer_0",
  topwear: "psd_root_group_9_layer_0",       // ware (base shirt)
  bottomwear: "psd_root_group_9_layer_1",    // ware (skirt)
  handwear_l: "psd_root_group_9_layer_2",    // ware, screen-right arm
  handwear_r: "psd_root_group_9_layer_3",    // ware, screen-left arm
  neck: "psd_root_group_10_layer_0",
  neck_back: "psd_root_group_10_layer_3"
};
const DRAW = {
  tie: "draw_r0_1cea4f6f_ea30e9c4_tie",
  topwear: "draw_r0_1cea4f6f_26f93e8b_topwear",
  bottomwear: "draw_r0_1cea4f6f_26f93eaa_bottomwear",
  handwear_l: "draw_r0_1cea4f6f_26f93ec9_handwear-l",
  handwear_r: "draw_r0_1cea4f6f_26f93ee8_handwear-r",
  neck: "draw_r0_1cea4f6f_691e2eb3_neck",
  neck_back: "draw_r0_1cea4f6f_691e2e90_neck_back"
};

const load = (key) => {
  const b = meshes.find((m) => m.drawableId === DRAW[key]).bounds;
  const buf = readFileSync(`${TEX}/${LAYERS[key]}.raw-rgba`);
  if (buf.length !== b.width * b.height * 4)
    throw new Error(`${key}: byte length ${buf.length} != ${b.width}x${b.height}x4`);
  return { b, buf };
};

const rowProfile = (t) => {
  // per canvas row: [alpha-weighted x-min, x-max, alpha-centroid, coverage]
  const out = [];
  for (let r = 0; r < t.b.height; r++) {
    let n = 0, sx = 0, x0 = Infinity, x1 = -Infinity;
    for (let c = 0; c < t.b.width; c++) {
      const a = t.buf[(r * t.b.width + c) * 4 + 3];
      if (a > 32) {
        n++; sx += c;
        if (c < x0) x0 = c; if (c > x1) x1 = c;
      }
    }
    out.push(n ? { y: t.b.y + r, x0: t.b.x + x0, x1: t.b.x + x1, cx: t.b.x + sx / n, n } : { y: t.b.y + r, n: 0 });
  }
  return out;
};

const summarize = (key, step = 40) => {
  const t = load(key);
  const rows = rowProfile(t);
  const drawn = rows.filter((r) => r.n > 0);
  console.log(`\n== ${key} bounds x${t.b.x}..${t.b.x + t.b.width} y${t.b.y}..${t.b.y + t.b.height}`);
  if (!drawn.length) { console.log("  (empty)"); return rows; }
  console.log(`  drawn rows y${drawn[0].y}..${drawn[drawn.length - 1].y}`);
  // overall alpha centroid x
  let sn = 0, sx = 0;
  for (const r of drawn) { sn += r.n; sx += r.cx * r.n; }
  console.log(`  alpha centroid cx = ${(sx / sn).toFixed(1)}`);
  for (let i = 0; i < drawn.length; i += step) {
    const r = drawn[i];
    console.log(`   y${String(r.y).padStart(5)}  x${String(r.x0).padStart(5)}..${String(r.x1).padStart(4)}  w=${String(r.x1 - r.x0).padStart(4)}  cx=${r.cx.toFixed(0)}`);
  }
  const last = drawn[drawn.length - 1];
  console.log(`   y${String(last.y).padStart(5)}  x${String(last.x0).padStart(5)}..${String(last.x1).padStart(4)}  w=${String(last.x1 - last.x0).padStart(4)}  cx=${last.cx.toFixed(0)} (last)`);
  return rows;
};

const rowsTop = summarize("topwear", 30);
const rowsSkirt = summarize("bottomwear", 30);
summarize("tie", 40);
summarize("handwear_r", 60);
summarize("handwear_l", 60);
summarize("neck", 10);
summarize("neck_back", 10);

// skirt tuck-in line: first rows of the skirt that are widely drawn (its top edge),
// and the shirt coverage below that line
const skirtTop = rowsSkirt.find((r) => r.n > 100);
console.log(`\nskirt tuck line: first wide skirt row y=${skirtTop.y} (x${skirtTop.x0}..${skirtTop.x1})`);
const shirtBelow = rowsTop.filter((r) => r.n > 0 && r.y >= skirtTop.y);
console.log(`shirt rows at/below tuck line: ${shirtBelow.length} rows, down to y${shirtBelow.length ? shirtBelow[shirtBelow.length - 1].y : "-"}`);

// shoulder line: topwear width growth (first row where width exceeds 60% of max)
const maxW = Math.max(...rowsTop.filter((r) => r.n).map((r) => r.x1 - r.x0));
const shoulder = rowsTop.find((r) => r.n && (r.x1 - r.x0) > 0.6 * maxW);
console.log(`topwear max width ${maxW}; 60%-width row (shoulder shelf) y=${shoulder.y}`);
