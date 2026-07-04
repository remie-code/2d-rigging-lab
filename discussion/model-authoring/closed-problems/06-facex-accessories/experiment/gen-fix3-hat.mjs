// cp06fix3 F2: physical differential in the front-hair subordination band
// (intentional change of ledger constraint C7; user-gate agreed).
//
// fix2 made the hat's lower band follow the front-hair field EXACTLY (v=1 ->
// dx == dx_fh). That killed the slip (+-18px -> 0.0px) but OVER-CORRECTED:
// physically the hat is the OUTER shell (C2: hat cap R371 > front-hair cap
// R320), so it must move slightly MORE than the bangs. That small differential
// is what makes the hat/hair intersection points travel vertically along the
// slanted scallop edge ("contact runs up on the bangs side, down on the
// back-hair side") — the depth cue fix2 froze out.
//
// New subordination target (C7'):
//   dx_sub = chord*u +- ZC * zSub(u,y)
//   zSub   = z_fh + LAMBDA * (z_hat - z_fh)      (LAMBDA = presentation dial)
//   z_fh   = 320*(1-(u/320)^2)*capS(y)           (front-hair shell, EQ463 R320)
//   z_hat  = 320*(1-(u/320)^2)*sHat(y)           (C2 hat crown,      EQ463 R371)
//   dx_fix3 = (1-v(y))*dx_fix + v(y)*dx_sub      (v ramp UNCHANGED = C7 bands)
// At LAMBDA=1 the interior of the band returns to the hat's own crown (the raw
// physical differential, ZC*(z_hat-z_fh) = 0.2..1.1px over the scallop band);
// the edge columns keep following ~the front-hair shell instead of the occiput
// anchor (the fix2 gain that removed the 18px-class slip is preserved).
// LAMBDA scales the shell separation only; slip stays in the few-px class by
// construction (see design table below).
//
// Constraint ledger dispositions implemented/asserted here:
//   C1 chord / C2 crown / C3 freeze / C6 ear cones : PRESERVED (v=0 rows are
//     emitted byte-identical to committed; asserted).
//   C4 outer-rim anchoring : PRESERVED (w ramp & W(y) untouched inside dx_fix).
//   C5 dy swing            : PRESERVED (dy = -+0.025*u at ALL 169 nodes;
//     asserted on the emitted grids; y untouched by the blend).
//   C7 front-hair subordination : INTENTIONAL CHANGE (exact match -> match +
//     physical differential; this file).
//   C8 G1 tail rotation    : EXTENDED separately (gen-fix3-g1.mjs, re-derived
//     against the measured per-segment partner AFTER this base is committed;
//     the fix2 DELTA is dropped from the base grids here on purpose).
//   C9 shared boundary rows: PRESERVED (v(257)=v(252)=0 -> fix3 == fix2 at the
//     btr/btl top rows; asserted; no re-punch).
//
// Drift assert: committed keyforms must equal fix2 formula + fix2 G1 DELTA at
// every node before we overwrite anything.
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

const LAMBDA_BOX = { v: Number(process.env.FIX3_LAMBDA ?? "1") }; // presentation dial
const LAMBDA = LAMBDA_BOX.v; // naming / messages (evaluation reads the box)

const DOMAIN = { x: 795, y: 79, width: 425, height: 313 };
const N = 13;

// ---------------------------------------------------------------------------
// 8th-gen field, reproduced VERBATIM from gen-fix-hat.mjs / gen-fix2-hat.mjs.
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

// fix2 subordination (verbatim) — needed for the drift assert and C9 assert.
const FH_EQ = 463, FH_CAP_R = 320;
const capS = (y) => (y >= FH_EQ ? 1 : Math.sqrt(Math.max(0, 1 - ((FH_EQ - y) / FH_CAP_R) ** 2)));
const zFh = (u, y) => SHELL_Z * Math.max(0, 1 - (u / SHELL_U) ** 2) * capS(y);

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
  const f = hatFieldFix(x, y);
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

// fix2 G1 tail-rotation deltas (gen-fix2-g1.mjs DELTA; dropped from the fix3
// base and re-derived in gen-fix3-g1.mjs with the measured bt partner).
const G1_FIX2 = {
  max: { cols: [0, 1], rows: [[9, 1.11], [10, 2.77]] },
  min: { cols: [11, 12], rows: [[9, -0.96], [10, -2.40]] }
};

// ---------------------------------------------------------------------------
// fix3 field: C7' = subordination target carries the shell differential
// ---------------------------------------------------------------------------
const zHat = (u, y) => zCrown(u, y); // C2 crown (freeze inactive for y>=288)
const hatFieldFix3 = (x, y) => {
  const f = hatFieldFix(x, y);
  const v = vOf(y);
  if (v === 0) return f;
  const u = x - CX;
  const c = CHORD * u;
  const zSub = zFh(u, y) + LAMBDA_BOX.v * (zHat(u, y) - zFh(u, y));
  return {
    max: { x: round2((1 - v) * f.max.x + v * (c + ZC * zSub)), y: f.max.y },
    min: { x: round2((1 - v) * f.min.x + v * (c - ZC * zSub)), y: f.min.y }
  };
};

// ---------------------------------------------------------------------------
// assertions
// ---------------------------------------------------------------------------
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const hatSet = kfs.find(
  (k) => k.target?.id === "rig_facex_headwear" && k.parameterId === "param_face_angle_x"
);
if (!hatSet) throw new Error("hat keyform set not found");

// (a) drift: committed == fix2 formula + fix2 G1 delta, every node.
// When iterating on LAMBDA (base already replaced once), set
// FIX3_ASSERT_PREV_LAMBDA=<prev> to assert committed == fix3(prev) instead.
const PREV = process.env.FIX3_ASSERT_PREV_LAMBDA;
const expectedCommitted = (x, y, keyVal, label) => {
  if (PREV !== undefined) {
    const save = LAMBDA_BOX.v;
    LAMBDA_BOX.v = Number(PREV);
    const f = hatFieldFix3(x, y);
    LAMBDA_BOX.v = save;
    return { ...(keyVal > 0 ? f.max : f.min) };
  }
  const f = hatFieldFix2(x, y);
  const exp = { ...(keyVal > 0 ? f.max : f.min) };
  const r = Math.round(((y - DOMAIN.y) * (N - 1)) / DOMAIN.height);
  const c = Math.round(((x - DOMAIN.x) * (N - 1)) / DOMAIN.width);
  const d = G1_FIX2[label];
  const g1 = d.rows.find(([rr]) => rr === r);
  if (g1 && d.cols.includes(c)) exp.x = round2(exp.x + g1[1]);
  return exp;
};
for (const [label, keyVal] of [["min", -30], ["max", 30]]) {
  const committed = hatSet.keys.find((k) => k.value === keyVal).statePatch;
  if (committed.length !== N * N) throw new Error("unexpected hat lattice size");
  for (let r = 0; r < N; r++) {
    const y = DOMAIN.y + (DOMAIN.height * r) / (N - 1);
    for (let c = 0; c < N; c++) {
      const x = DOMAIN.x + (DOMAIN.width * c) / (N - 1);
      const exp = expectedCommitted(x, y, keyVal, label);
      const got = committed[r * N + c];
      if (Math.abs(got.x - exp.x) > 0.02 || Math.abs(got.y - exp.y) > 0.02)
        throw new Error(`hat ${label} drift r${r} c${c}: (${got.x},${got.y}) vs (${exp.x},${exp.y})`);
    }
  }
}
console.log(`assert (drift): committed == ${PREV !== undefined ? `fix3(lambda=${PREV})` : "fix2 formula + fix2 G1 delta"} at all 169 nodes (min & max) OK`);

// (b) C1/C2/C3/C4/C6: v=0 rows (r0..r8) emitted identical to committed
for (const [label, keyVal] of [["min", -30], ["max", 30]]) {
  const committed = hatSet.keys.find((k) => k.value === keyVal).statePatch;
  for (let r = 0; r <= 8; r++) {
    const y = DOMAIN.y + (DOMAIN.height * r) / (N - 1);
    for (let c = 0; c < N; c++) {
      const x = DOMAIN.x + (DOMAIN.width * c) / (N - 1);
      const f = hatFieldFix3(x, y);
      const exp = keyVal > 0 ? f.max : f.min;
      const got = committed[r * N + c];
      if (got.x !== exp.x || got.y !== exp.y)
        throw new Error(`C1-C6 breach ${label} r${r} c${c}`);
    }
  }
}
console.log("assert (C1/C2/C3/C4/C6): rows r0..r8 byte-identical to committed OK");

// (c) C5: dy == -+0.025*u at every emitted node
for (let r = 0; r < N; r++) {
  const y = DOMAIN.y + (DOMAIN.height * r) / (N - 1);
  for (let c = 0; c < N; c++) {
    const x = DOMAIN.x + (DOMAIN.width * c) / (N - 1);
    const u = x - CX;
    const f = hatFieldFix3(x, y);
    if (f.max.y !== round2(-0.025 * u) || f.min.y !== round2(+0.025 * u))
      throw new Error(`C5 breach r${r} c${c}: dy (${f.max.y},${f.min.y})`);
  }
}
console.log("assert (C5): dy == -+0.025*u at all 169 nodes (both keys) OK");

// (d) C9: shared boundary rows y257/y252 unchanged (v=0 there)
for (const el of [
  { key: "back_top_hair_r", domain: { x: 783, y: 257, width: 196, height: 525 }, n: 5 },
  { key: "back_top_hair_l", domain: { x: 1022, y: 252, width: 196, height: 525 }, n: 5 }
]) {
  for (let c = 0; c < el.n; c++) {
    const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
    const a = hatFieldFix2(x, el.domain.y);
    const b = hatFieldFix3(x, el.domain.y);
    if (a.max.x !== b.max.x || a.min.x !== b.min.x || a.max.y !== b.max.y || a.min.y !== b.min.y)
      throw new Error(`${el.key} shared row would change; re-punch required`);
  }
  console.log(`assert (C9): ${el.key} top row fix3 == fix2 (v=0 at y${el.domain.y}) -> no re-punch needed`);
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
      const f = hatFieldFix3(x, y);
      out.push(key > 0 ? f.max : f.min);
    }
  }
  return out;
};
const batch = [];
for (const [label, keyVal] of [["max", 30], ["min", -30]]) {
  batch.push({
    file: `fix3-key-headwear-${label}-l${String(LAMBDA).replace(".", "p")}.json`,
    operationId: `op_cp06fix3_key_headwear_${label}_l${String(LAMBDA).replace(".", "p")}`,
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
    gitMessage: `[cp06fix3] key FaceX Headwear face_angle_x ${label}: C7' shell differential in subordination band (lambda=${LAMBDA}) (updateCurrent)`
  });
}
writeFileSync(new URL("batch-fix3-hat.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log(`batch-fix3-hat.json: ${batch.length} ops (LAMBDA=${LAMBDA})`);

// ---------------------------------------------------------------------------
// design tables
// ---------------------------------------------------------------------------
console.log("\ndifferential vs front-hair field (max key): slip(u,y) = dx_fix3 - dx_fh [px]");
console.log("  (fix2 was 0.0 in the v=1 band; target: few-px class, NOT 18px class)");
for (const y of [300, 313.75, 326, 339.83, 352, 365.92, 392]) {
  const cells = [];
  for (const u of [-170, -100, -50, 0, 50, 100, 170]) {
    const x = CX + u;
    const fh = CHORD * u + ZC * zFh(u, y);
    cells.push(`${(hatFieldFix3(x, y).max.x - fh).toFixed(2)}`);
  }
  console.log(` y=${y.toFixed(0).padStart(3)} v=${vOf(y).toFixed(2)} | ${cells.join("  ")}`);
}
console.log("\nchange vs committed (max key), rows r9..r12:");
for (let r = 9; r < N; r++) {
  const y = DOMAIN.y + (DOMAIN.height * r) / (N - 1);
  const committed = hatSet.keys.find((k) => k.value === 30).statePatch;
  const cells = [];
  for (const c of [0, 1, 3, 6, 9, 11, 12]) {
    const x = DOMAIN.x + (DOMAIN.width * c) / (N - 1);
    cells.push(`c${c}:${(hatFieldFix3(x, y).max.x - committed[r * N + c].x).toFixed(2)}`);
  }
  console.log(` r${r} y=${y.toFixed(1)} ${cells.join(" ")}`);
}
