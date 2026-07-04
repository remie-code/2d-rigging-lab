// cp06fix2: hat lower-front band subordination to the front-hair field (fix A)
// + optional G1 bottom-corner correction (fix B, separate batch, see gen-fix2-g1.mjs).
//
// User gate after cp06fix: the volume expression works, but the hat/front-hair
// RELATIONSHIP still breaks: the band of the hat that is pictorially interlocked
// with the bangs (the scalloped bottom edge + lower flaps) was edge-anchored to
// the occiput field (3-7px) by the 8th gen while the bangs flow with the full
// shell (+25px class). The two layers slide apart -> "two flat stickers".
//
// Principle (L0-user agreed): where two layers overlap on screen, the front
// layer owns the look of the contact band; the back layer's field must locally
// follow the front layer's field there. NOTE (measured this round): in DRAW
// ORDER the hat (baseDrawOrder 0) is actually the topmost drawable — "front"
// here is PERCEPTUAL: the artist scalloped the hat's bottom alpha edge so bang
// strands read as lying in front. Operationally identical: in the interlock
// band the hat surface sits just above the front-hair shell, so ~zero parallax
// (hat field == front-hair field) is also the physically correct statement.
//
// Ownership map (fix2-ownership.mjs, rest textures at placement = rest render,
// draw order established empirically via overlap-pixel color test):
//   - side edges y124..~300: outside = background -> true silhouette rim,
//     keep the 8th-gen occiput anchoring (w-ramp) unchanged.
//   - concave notch y~314..332 both sides: regime change carved by the artist
//     (skull silhouette passes behind the hat; below begins the flap that lies
//     over the hair mass).
//   - bottom edge y282(center)..360/378(flaps): below/behind = front hair for
//     every column u in [-181,+179] -> the whole bottom band must follow the
//     front-hair field.
//   - btr/btl slivers are fully covered at rest (0 visible px within 8px of
//     the edge); cover margins 24/38px at y312 -> v(r9)=0.30 keeps them
//     covered there. In the flap band the emerging sliver (3..15px at +-30) is
//     FREE PARALLAX, continuous with the same emergence along the hair
//     silhouette below y380 (cp05-praised depth cue), not a seam tear.
//
// Implementation: one more blend stage on top of the 8th-gen field.
//   dx_fix2 = (1 - v(y)) * dx_fix + v(y) * dx_frontHair
//   v per lattice row (13x13, domain y79 h313, pitch 26.083):
//     rows r0..r8 (y<=287.67): 0        (crown/anchor regime untouched)
//     r9  (y=313.75): 0.30              (notch; sliver cover margin respected)
//     r10 (y=339.83): 0.85
//     r11 (y=365.92): 1.00              (flap bottoms: full subordination)
//     r12 (y=392):    1.00              (below material; carries the cell)
//   front-hair field = committed cp04fix2 shell (identical formula as cp05):
//     z_fh = 320*(1-(u/320)^2)*capS(y), capS: equator y463, cap radius 320
//     dx+- = CHORD*u +- ZC*z_fh ; dy_fh = 0
//   dy of the hat: UNCHANGED (k=0.05 brim swing, gate-passed; do-not-touch).
//   Interior columns change sub-pixel only (crown z at the bottom rows already
//   ~= fh shell: e.g. u0/y366: 309 vs 305); the real change is the edge
//   columns where the w-ramp had pinned the flaps to the occiput.
//
// btr/btl shared top rows (y257/252): v=0 there -> fix2 == fix, boundary rows
// stay valid; asserted below, no re-punch ops emitted (doctrine: re-punch only
// when the master formula changes AT the shared row).
//
// Ears / eyewear / k=0.05 dy: untouched (gate-passed).
import { readFileSync, writeFileSync } from "node:fs";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const CX = 1001;
const CHORD = 0.1875 * (Math.cos(Math.PI / 6) - 1); // -0.0251201...
const ZC = 0.09375;
const HAT_EQ = 463, HAT_R = 371, HAT_FREEZE = 170;
const SHELL_U = 320, SHELL_Z = 320;
const K_TILT = 0.05;
const RAMP_A = 0.55;
const ANCHOR_Y_MIN = 135;
const EAR_MERGE_Y = 122, EAR_BLEND_END = 150;

const DOMAIN = { x: 795, y: 79, width: 425, height: 313 };
const N = 13;

// ---------------------------------------------------------------------------
// 8th-gen field, reproduced VERBATIM from gen-fix-hat.mjs (drift assertion
// source; fix2 blends on top of it).
// ---------------------------------------------------------------------------
const sHat = (y) => {
  const yy = Math.max(y, HAT_FREEZE);
  if (yy >= HAT_EQ) return 1;
  return Math.sqrt(Math.max(0, 1 - ((HAT_EQ - yy) / HAT_R) ** 2));
};
const zCrown = (u, y) => SHELL_Z * Math.max(0, 1 - (u / SHELL_U) ** 2) * sHat(y);

const TEX = { f: "psd/r0_1cea4f6f/psd_root_layer_0.raw-rgba", x: 808, y: 92, w: 400, h: 288 };
const ALPHA = 64;
const wTab = { L: new Map(), R: new Map() };
{
  const buf = readFileSync(`${PKG}/assets/textures/${TEX.f}`);
  for (let ry = 0; ry < TEX.h; ry++) {
    const y = TEX.y + ry;
    if (y < 124) continue;
    let mnL = Infinity, mxR = -Infinity, run = 0;
    for (let rx = 0; rx < TEX.w; rx++) {
      const op = buf[(ry * TEX.w + rx) * 4 + 3] >= ALPHA;
      run = op ? run + 1 : 0;
      if (run >= 3) {
        const u0 = TEX.x + rx - CX;
        for (let d = 0; d < run && d < 3; d++) {
          const u = u0 - d;
          if (u < 0) mnL = Math.min(mnL, u);
          else mxR = Math.max(mxR, u);
        }
      }
    }
    if (mnL < Infinity) wTab.L.set(y, -mnL);
    if (mxR > -Infinity) wTab.R.set(y, mxR);
  }
}
const wOf = (side, y) => {
  const t = wTab[side];
  const ys = [...t.keys()];
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const yy = Math.max(lo, Math.min(hi, Math.round(y)));
  for (let d = 0; d <= hi - lo; d++) {
    if (t.has(yy - d)) return t.get(yy - d);
    if (t.has(yy + d)) return t.get(yy + d);
  }
  throw new Error("empty W table");
};

const zOcciput = (u, y) =>
  -(SHELL_Z / 6) * (1 - (u / 650) ** 2) * Math.min(1, Math.max(0, (y - 264) / (769 - 264)));

const lerpTab = (tab, y) => {
  if (y <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (y <= tab[i][0]) {
      const [y0, v0] = tab[i - 1], [y1, v1] = tab[i];
      return v0 + ((y - y0) * (v1 - v0)) / (y1 - y0);
    }
  }
  const [y1, v1] = tab[tab.length - 1];
  const [y0, v0] = tab[tab.length - 2];
  const slope = (v1 - v0) / (y1 - y0);
  return v1 + (y - y1) * (slope > 0 ? slope : 0);
};
const EARS = {
  left: {
    sign: -1,
    ridge: [[92, -134.5], [104, -121], [112, -111.5], [122, -103]],
    outer: [[92, -140], [104, -151], [112, -153], [122, -155.5]],
    inner: [[92, -129], [104, -91], [112, -70], [122, -51]]
  },
  right: {
    sign: +1,
    ridge: [[92, 153.5], [104, 140], [112, 130], [122, 122]],
    outer: [[92, 156], [104, 168], [112, 171], [122, 173.5]],
    inner: [[92, 151], [104, 112], [112, 89], [122, 68]]
  }
};
const FALL_OUT = 0.85, FALL_IN = 0.15, B_FLOOR = 15;
const zEarSection = (ear, u, y) => {
  const yy = y;
  const ur = lerpTab(ear.ridge, Math.min(yy, EAR_MERGE_Y));
  const bOut = Math.max(B_FLOOR, Math.abs(lerpTab(ear.outer, yy) - ur));
  const bIn = Math.max(B_FLOOR, Math.abs(lerpTab(ear.inner, yy) - ur));
  const zr = SHELL_Z * Math.max(0, 1 - (ur / SHELL_U) ** 2) * sHat(HAT_FREEZE);
  const d = u - ur;
  const outward = ear.sign > 0 ? d > 0 : d < 0;
  const fall = outward ? (FALL_OUT * Math.abs(d)) / bOut : (FALL_IN * Math.abs(d)) / bIn;
  return zr * Math.max(0, 1 - fall);
};
const zFull = (u, y) => {
  if (y >= EAR_BLEND_END) return zCrown(u, y);
  const ear = u <= -49 ? EARS.left : u >= 66 ? EARS.right : null;
  if (!ear) return zCrown(u, y);
  const zt = zEarSection(ear, u, y);
  if (y <= EAR_MERGE_Y) return zt;
  const t = (y - EAR_MERGE_Y) / (EAR_BLEND_END - EAR_MERGE_Y);
  return zt * (1 - t) + zCrown(u, y) * t;
};

const round2 = (v) => Math.round(v * 100) / 100;
const hatFieldFix = (x, y) => {
  const u = x - CX;
  const c = CHORD * u;
  const zf = zFull(u, y);
  let dxMax = c + ZC * zf, dxMin = c - ZC * zf;
  if (y >= ANCHOR_Y_MIN) {
    const W = wOf(u < 0 ? "L" : "R", y);
    const w = Math.min(1, Math.max(0, (Math.abs(u) - RAMP_A * W) / ((1 - RAMP_A) * W)));
    const zo = zOcciput(u, y);
    dxMax = (1 - w) * dxMax + w * (c + ZC * zo);
    dxMin = (1 - w) * dxMin + w * (c - ZC * zo);
  }
  const dyMax = -0.5 * K_TILT * u;
  const dyMin = +0.5 * K_TILT * u;
  return {
    max: { x: round2(dxMax), y: round2(dyMax) },
    min: { x: round2(dxMin), y: round2(dyMin) }
  };
};

// ---------------------------------------------------------------------------
// fix2: front-hair subordination of the lower band
// ---------------------------------------------------------------------------
const FH_EQ = 463, FH_CAP_R = 320;
const capS = (y) => (y >= FH_EQ ? 1 : Math.sqrt(Math.max(0, 1 - ((FH_EQ - y) / FH_CAP_R) ** 2)));
const zFh = (u, y) => SHELL_Z * Math.max(0, 1 - (u / SHELL_U) ** 2) * capS(y);

// subordination weight per lattice row (piecewise-linear in y between nodes)
const V_NODES = [[287.67, 0], [313.75, 0.30], [339.83, 0.85], [365.92, 1.0], [392, 1.0]];
const vOf = (y) => {
  if (y <= V_NODES[0][0]) return 0;
  if (y >= V_NODES[V_NODES.length - 1][0]) return 1;
  for (let i = 1; i < V_NODES.length; i++) {
    if (y <= V_NODES[i][0]) {
      const [y0, v0] = V_NODES[i - 1], [y1, v1] = V_NODES[i];
      return v0 + ((y - y0) * (v1 - v0)) / (y1 - y0);
    }
  }
  return 1;
};

const hatFieldFix2 = (x, y) => {
  const f = hatFieldFix(x, y); // rounded, = committed values (drift-safe base)
  const v = vOf(y);
  if (v === 0) return f;
  const u = x - CX;
  const c = CHORD * u;
  const z = zFh(u, y);
  return {
    max: { x: round2((1 - v) * f.max.x + v * (c + ZC * z)), y: f.max.y },
    min: { x: round2((1 - v) * f.min.x + v * (c - ZC * z)), y: f.min.y }
  };
};

// ---------------------------------------------------------------------------
// drift assertions against committed keyforms
// ---------------------------------------------------------------------------
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const hatSet = kfs.find(
  (k) => k.target?.id === "rig_facex_headwear" && k.parameterId === "param_face_angle_x"
);
if (!hatSet) throw new Error("hat keyform set not found");
for (const [label, keyVal] of [["min", -30], ["max", 30]]) {
  const committed = hatSet.keys.find((k) => k.value === keyVal).statePatch;
  if (committed.length !== N * N) throw new Error("unexpected hat lattice size");
  for (let r = 0; r < N; r++) {
    const y = DOMAIN.y + (DOMAIN.height * r) / (N - 1);
    for (let c = 0; c < N; c++) {
      const x = DOMAIN.x + (DOMAIN.width * c) / (N - 1);
      const f = hatFieldFix(x, y);
      const exp = keyVal > 0 ? f.max : f.min;
      const got = committed[r * N + c];
      if (Math.abs(got.x - exp.x) > 0.02 || Math.abs(got.y - exp.y) > 0.02)
        throw new Error(
          `hat ${label} drift r${r} c${c}: (${got.x},${got.y}) vs (${exp.x},${exp.y})`
        );
    }
  }
}
console.log("drift assert: committed hat grids == 8th-gen formula (min & max) OK");

// btr/btl shared top rows: fix2 must equal fix there (v(257)=v(252)=0)
for (const el of [
  { key: "back_top_hair_r", domain: { x: 783, y: 257, width: 196, height: 525 }, n: 5 },
  { key: "back_top_hair_l", domain: { x: 1022, y: 252, width: 196, height: 525 }, n: 5 }
]) {
  for (let c = 0; c < el.n; c++) {
    const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
    const a = hatFieldFix(x, el.domain.y);
    const b = hatFieldFix2(x, el.domain.y);
    if (a.max.x !== b.max.x || a.min.x !== b.min.x)
      throw new Error(`${el.key} shared row would change; re-punch required`);
  }
  console.log(`${el.key} top row: fix2 == fix (v=0 at y${el.domain.y}) -> no re-punch needed`);
}

// ---------------------------------------------------------------------------
// batch: updateCurrent max & min (1 op = 1 commit each)
// ---------------------------------------------------------------------------
const grid = (key) => {
  const out = [];
  for (let r = 0; r < N; r++) {
    const y = DOMAIN.y + (DOMAIN.height * r) / (N - 1);
    for (let c = 0; c < N; c++) {
      const x = DOMAIN.x + (DOMAIN.width * c) / (N - 1);
      const f = hatFieldFix2(x, y);
      out.push(key > 0 ? f.max : f.min);
    }
  }
  return out;
};
const batch = [];
for (const [label, keyVal] of [["max", 30], ["min", -30]]) {
  batch.push({
    file: `fix2-key-headwear-${label}.json`,
    operationId: `op_cp06fix2_key_headwear_${label}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: "rig_facex_headwear" },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_x",
      interpolation: "linear-1d-v1",
      action: "updateCurrent",
      keyValue: keyVal,
      statePatch: { propertyPath: "controlPointOffsets", value: grid(keyVal) }
    },
    gitMessage: `[cp06fix2] key FaceX Headwear face_angle_x ${label}: lower band subordinated to front-hair field (updateCurrent)`
  });
}
writeFileSync(new URL("batch-fix2-hat.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log(`batch-fix2-hat.json: ${batch.length} ops`);

// ---------------------------------------------------------------------------
// design tables
// ---------------------------------------------------------------------------
console.log("\nrow v | edge-column values old(max) -> new(max) [left c0/c1 | right c11/c12]");
for (let r = 8; r < N; r++) {
  const y = DOMAIN.y + (DOMAIN.height * r) / (N - 1);
  const cells = [];
  for (const c of [0, 1, 11, 12]) {
    const x = DOMAIN.x + (DOMAIN.width * c) / (N - 1);
    cells.push(`c${c}(u${Math.round(x - CX)}): ${hatFieldFix(x, y).max.x} -> ${hatFieldFix2(x, y).max.x}`);
  }
  console.log(` r${r} y=${y.toFixed(1)} v=${vOf(y).toFixed(2)}  ${cells.join("  ")}`);
}
console.log("\nbottom-edge slip check (max key): hat_fix2 - fh at scallop edge samples");
const yBot = (u) => 282 + 0.0026 * u * u; // rough scallop shape for sampling only
for (const u of [-181, -160, -120, -80, -40, 0, 40, 80, 120, 160, 179]) {
  const y = Math.min(378, yBot(u));
  const x = CX + u;
  const fhv = CHORD * u + ZC * zFh(u, y);
  const f2 = hatFieldFix2(x, y).max.x;
  const f1 = hatFieldFix(x, y).max.x;
  console.log(
    ` u=${u} y=${y.toFixed(0)}: fh=${fhv.toFixed(1)} fix=${f1} fix2=${f2} slip ${(f1 - fhv).toFixed(1)} -> ${(f2 - fhv).toFixed(1)}`
  );
}
