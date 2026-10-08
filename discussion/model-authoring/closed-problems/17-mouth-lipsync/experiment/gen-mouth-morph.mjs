// cp17 gen script — single numeric source of truth for the mouth lip-sync warps.
//
// Implements design-notes.md verbatim:
//   §2 silhouette measurement: mesh-boundary profiles (x_L/x_R = horizontal
//      vertex extremes; N-band column profile y_top/y_bot, N >= 2x lattice
//      columns; 3-point moving average smoothing; deterministic)
//   §3 morph field, two-stage map per lattice point p=(x,y):
//      1. horizontal corner affine  u=(x-xL_B)/(xR_B-xL_B); x'=xL_T+u*(xR_T-xL_T)
//      2. vertical per-column edge correspondence
//         v=(y-yTop_B)/(yBot_B-yTop_B)
//         v in [0,1]: y'=yTop_T+v*(yBot_T-yTop_T)
//         v<0: y'=y+(yTop_T-yTop_B)   (parallel transport by top-edge delta)
//         v>1: y'=y+(yBot_T-yBot_B)
//      outside corners (u<0/u>1): parallel transport by nearest corner delta
//      statePatch = (x',y') - rest
//
// Usage:
//   node gen-mouth-morph.mjs create     -> design-values.json + batch-create.json
//   node gen-mouth-morph.mjs keys       -> batch-keys.json (reads committed
//                                          rig-controls.json restControlPoints)
//   node gen-mouth-morph.mjs predict    -> grid-residual report only (no files)
//   node gen-mouth-morph.mjs fix-open   -> batch-fix-open.json (delete both
//                                          MouthOpen keys, resize its lattice)
//   node gen-mouth-morph.mjs rekey-open -> batch-rekey-open.json (re-key
//                                          MouthOpen from committed rest nodes)
//
// MouthOpen lattice exception (measured 2026-07-05): the crush field is kinked
// exactly along the silhouette edges (v=0 / v=1 lines), so uniform-lattice
// bilinear reconstruction undershoots the crush by ~rowSpacing/4 x crushSlope.
// The committed 9x7 twin lattice leaves a +4.9px column-height excess vs the
// closed reference (gate: <= +2px). Exact field residual is 0.41px, so the
// formula is right and only MouthOpen's grid must be finer: a numeric scan
// gives 25x23 -> predicted excess 0.99px (50% margin). The scan must emulate
// the runtime silhouette faithfully — map VERTICES through the lattice, then
// chord the boundary edges; mapping dense boundary samples through the field
// overestimates accuracy (21x19 predicted 1.5 that way but measured 2.02).
// Domain stays the twin domain; vowel warps keep 9x7 (their gates pass).
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";

const IDS = {
  mouth_a: "draw_r463_780c04ef_dc637e24_mouth_a",
  mouth_closed: "draw_r0_1cea4f6f_3a8f6fa8_mouth",
  mouth_i: "draw_r463_780c04ef_dc637e05_mouth_i",
  mouth_u: "draw_r463_780c04ef_dc637ee6_mouth_u",
  mouth_e: "draw_r463_780c04ef_dc637ec7_mouth_e",
  mouth_o: "draw_r463_780c04ef_dc637ea0_mouth_o"
};

// ---------- mesh boundary -> dense silhouette samples ----------
const meshOf = (drawableId) => {
  const meshes = JSON.parse(readFileSync(join(PKG, "model/meshes.json"), "utf8"));
  const arr = Object.values(meshes).find(Array.isArray);
  const m = arr.find((x) => x.drawableId === drawableId);
  if (!m || !(m.vertices?.length > 0)) throw new Error(`no mesh for ${drawableId}`);
  return m;
};

// boundary edges = edges used by exactly one triangle; sample densely along them
const boundarySamples = (mesh, step = 0.5) => {
  const count = new Map();
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (const t of mesh.triangles) {
    const idx = Array.isArray(t) ? t : [t.a, t.b, t.c];
    for (let i = 0; i < 3; i++) {
      const k = key(idx[i], idx[(i + 1) % 3]);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  const samples = [];
  for (const [k, c] of count) {
    if (c !== 1) continue;
    const [a, b] = k.split("_").map(Number);
    const p = mesh.vertices[a], q = mesh.vertices[b];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) {
      samples.push({ x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n });
    }
  }
  if (samples.length === 0) throw new Error("no boundary edges");
  return samples;
};

// ---------- §2 profile: corners + N-band column profile, u-indexed ----------
const smooth3 = (arr) =>
  arr.map((_, i) => {
    const a = arr[Math.max(0, i - 1)], b = arr[i], c = arr[Math.min(arr.length - 1, i + 1)];
    return (a + b + c) / 3;
  });

const profileOf = (samples, N) => {
  const xs = samples.map((p) => p.x);
  const xL = Math.min(...xs), xR = Math.max(...xs);
  const yTop = Array(N).fill(Infinity), yBot = Array(N).fill(-Infinity);
  for (const p of samples) {
    let k = Math.floor(((p.x - xL) / (xR - xL)) * N);
    if (k === N) k = N - 1;
    if (p.y < yTop[k]) yTop[k] = p.y;
    if (p.y > yBot[k]) yBot[k] = p.y;
  }
  // fill any empty band from neighbors (dense sampling should leave none)
  for (let k = 0; k < N; k++) {
    if (yTop[k] === Infinity) {
      let l = k - 1; while (l >= 0 && yTop[l] === Infinity) l--;
      let r = k + 1; while (r < N && yTop[r] === Infinity) r++;
      const src = l >= 0 ? l : r;
      yTop[k] = yTop[src]; yBot[k] = yBot[src];
    }
  }
  return { xL, xR, yTop: smooth3(yTop), yBot: smooth3(yBot), N };
};

// piecewise-linear lookup of a profile edge at parameter u (band centers)
const edgeAt = (prof, arr, u) => {
  const t = u * prof.N - 0.5;
  if (t <= 0) return arr[0];
  if (t >= prof.N - 1) return arr[prof.N - 1];
  const k = Math.floor(t), f = t - k;
  return arr[k] * (1 - f) + arr[k + 1] * f;
};

// ---------- §3 two-stage map: field B -> T ----------
const makeField = (B, T) => (x, y) => {
  const u = (x - B.xL) / (B.xR - B.xL);
  let xp, dyTop, dyBot, yTopB, yBotB, yTopT, yBotT;
  if (u < 0 || u > 1) {
    // outside corners: parallel transport by nearest corner delta
    const uc = u < 0 ? 0 : 1;
    xp = x + (u < 0 ? T.xL - B.xL : T.xR - B.xR);
    yTopB = edgeAt(B, B.yTop, uc); yBotB = edgeAt(B, B.yBot, uc);
    yTopT = edgeAt(T, T.yTop, uc); yBotT = edgeAt(T, T.yBot, uc);
    const midB = (yTopB + yBotB) / 2, midT = (yTopT + yBotT) / 2;
    return { x: xp, y: y + (midT - midB) };
  }
  xp = T.xL + u * (T.xR - T.xL);
  yTopB = edgeAt(B, B.yTop, u); yBotB = edgeAt(B, B.yBot, u);
  yTopT = edgeAt(T, T.yTop, u); yBotT = edgeAt(T, T.yBot, u);
  const hB = yBotB - yTopB;
  let yp;
  if (hB <= 1e-9) {
    const midB = (yTopB + yBotB) / 2, midT = (yTopT + yBotT) / 2;
    yp = y + (midT - midB);
  } else {
    const v = (y - yTopB) / hB;
    if (v >= 0 && v <= 1) yp = yTopT + v * (yBotT - yTopT);
    else if (v < 0) yp = y + (yTopT - yTopB);
    else yp = y + (yBotT - yBotB);
  }
  return { x: xp, y: yp };
};

// ---------- lattice: rest nodes, offsets, bilinear application ----------
const latticeNodes = (domain, cols, rows) => {
  const nodes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      nodes.push({
        x: domain.x + (domain.width * c) / (cols - 1),
        y: domain.y + (domain.height * r) / (rows - 1),
        row: r, col: c
      });
    }
  }
  return nodes;
};

const round2 = (n) => Math.round(n * 100) / 100 || 0;

const offsetsFor = (field, nodes) =>
  nodes.map((p) => {
    const q = field(p.x, p.y);
    return { x: round2(q.x - p.x), y: round2(q.y - p.y) };
  });

// bilinear evaluation of node offsets at an arbitrary point (mirrors runtime)
const applyLattice = (domain, cols, rows, offsets) => (p) => {
  let u = ((p.x - domain.x) / domain.width) * (cols - 1);
  let v = ((p.y - domain.y) / domain.height) * (rows - 1);
  u = Math.max(0, Math.min(cols - 1 - 1e-9, u));
  v = Math.max(0, Math.min(rows - 1 - 1e-9, v));
  const c = Math.floor(u), r = Math.floor(v), fu = u - c, fv = v - r;
  const o = (rr, cc) => offsets[rr * cols + cc];
  const o00 = o(r, c), o01 = o(r, c + 1), o10 = o(r + 1, c), o11 = o(r + 1, c + 1);
  const dx = (o00.x * (1 - fu) + o01.x * fu) * (1 - fv) + (o10.x * (1 - fu) + o11.x * fu) * fv;
  const dy = (o00.y * (1 - fu) + o01.y * fu) * (1 - fv) + (o10.y * (1 - fu) + o11.y * fu) * fv;
  return { x: p.x + dx, y: p.y + dy };
};

// residual of (lattice-applied B silhouette) profile vs target profile
// hExcess = worst (mapped column height - target column height): the §4-2
// crush gate is on heights, where opposite-sign edge errors add up
const profileResidual = (mapped, T, N) => {
  const P = profileOf(mapped, N);
  let sum = 0, max = 0, cnt = 0, hExcess = -Infinity;
  for (let k = 0; k < N; k++) {
    const u = (k + 0.5) / N;
    const rTop = Math.abs(P.yTop[k] - edgeAt(T, T.yTop, u));
    const rBot = Math.abs(P.yBot[k] - edgeAt(T, T.yBot, u));
    sum += rTop + rBot; cnt += 2;
    max = Math.max(max, rTop, rBot);
    const h = P.yBot[k] - P.yTop[k];
    const hT = edgeAt(T, T.yBot, u) - edgeAt(T, T.yTop, u);
    hExcess = Math.max(hExcess, h - hT);
  }
  // corner residuals (horizontal)
  const rXL = Math.abs(P.xL - T.xL), rXR = Math.abs(P.xR - T.xR);
  max = Math.max(max, rXL, rXR);
  sum += rXL + rXR; cnt += 2;
  return { avg: sum / cnt, max, hExcess };
};

// ---------- main ----------
const mode = process.argv[2] ?? "predict";

const GRID_CANDIDATES = [
  { cols: 7, rows: 5 },
  { cols: 9, rows: 7 },
  { cols: 11, rows: 9 },
  { cols: 13, rows: 11 },
  { cols: 15, rows: 13 }
];
const MARGIN = 6;
const N_BANDS = 28; // >= 2 x max candidate columns (design §2)

const meshA = meshOf(IDS.mouth_a);
const sampA = boundarySamples(meshA);
const B = profileOf(sampA, N_BANDS);

const TARGETS = {
  open0: IDS.mouth_closed, // MouthOpen key 0 target
  vowel_i: IDS.mouth_i,
  vowel_u: IDS.mouth_u,
  vowel_e: IDS.mouth_e,
  vowel_o: IDS.mouth_o
};
const profiles = { B };
const fields = {};
for (const [name, id] of Object.entries(TARGETS)) {
  const prof = profileOf(boundarySamples(meshOf(id)), N_BANDS);
  profiles[name] = prof;
  fields[name] = makeField(B, prof);
}

// domain: mouth_a bbox + margin (all targets verified inside mouth_a bbox)
const xsA = sampA.map((p) => p.x), ysA = sampA.map((p) => p.y);
const bboxA = {
  minX: Math.min(...xsA), maxX: Math.max(...xsA),
  minY: Math.min(...ysA), maxY: Math.max(...ysA)
};
const domain = {
  x: Math.floor(bboxA.minX - MARGIN),
  y: Math.floor(bboxA.minY - MARGIN),
  width: Math.ceil(bboxA.maxX + MARGIN) - Math.floor(bboxA.minX - MARGIN),
  height: Math.ceil(bboxA.maxY + MARGIN) - Math.floor(bboxA.minY - MARGIN)
};

// grid selection: smallest candidate whose PREDICTED post-lattice profile
// residual meets the §4 gate (avg<=3, max<=6) with margin factor 0.75
let chosen, residReport = {};
for (const g of GRID_CANDIDATES) {
  const nodes = latticeNodes(domain, g.cols, g.rows);
  let worstAvg = 0, worstMax = 0;
  const per = {};
  for (const [name, field] of Object.entries(fields)) {
    const offs = offsetsFor(field, nodes);
    const apply = applyLattice(domain, g.cols, g.rows, offs);
    const mapped = sampA.map(apply);
    const r = profileResidual(mapped, profiles[name], N_BANDS);
    per[name] = { avg: +r.avg.toFixed(3), max: +r.max.toFixed(3), hExcess: +r.hExcess.toFixed(3) };
    worstAvg = Math.max(worstAvg, r.avg); worstMax = Math.max(worstMax, r.max);
  }
  residReport[`${g.cols}x${g.rows}`] = per;
  if (!chosen && worstAvg <= 3 * 0.75 && worstMax <= 6 * 0.75) chosen = g;
}
if (!chosen) chosen = GRID_CANDIDATES[GRID_CANDIDATES.length - 1];

console.log("domain:", JSON.stringify(domain));
console.log("bboxA:", JSON.stringify(bboxA));
console.log("predicted residuals:", JSON.stringify(residReport, null, 1));
console.log("chosen grid:", JSON.stringify(chosen));

if (mode === "predict") process.exit(0);

const WARPS = [
  { id: "rig_mouth_open", name: "Mouth Open", param: "param_mouth_open", fieldAtMin: "open0" },
  { id: "rig_mouth_vowel_i", name: "Mouth Vowel I", param: "param_mouth_vowel_i", fieldAtMax: "vowel_i" },
  { id: "rig_mouth_vowel_u", name: "Mouth Vowel U", param: "param_mouth_vowel_u", fieldAtMax: "vowel_u" },
  { id: "rig_mouth_vowel_e", name: "Mouth Vowel E", param: "param_mouth_vowel_e", fieldAtMax: "vowel_e" },
  { id: "rig_mouth_vowel_o", name: "Mouth Vowel O", param: "param_mouth_vowel_o", fieldAtMax: "vowel_o" }
];

if (mode === "create") {
  // inside-out: vowel_o wraps mouth_a; each next wraps the previous; mouth_open
  // binds under rig_facex_mouth (existing follow-tower innermost).
  const mk = (name, displayName, children, parent) => ({
    file: `create-${name}.json`,
    operationId: `op_cp17_create_${name}`,
    operationType: "createWarpDeformer",
    gitMessage: `[cp17] create ${displayName} warp (${chosen.cols}x${chosen.rows}, domain ${domain.x},${domain.y} ${domain.width}x${domain.height})${parent ? ` under ${parent}` : ""}`,
    payload: {
      displayName,
      ...children,
      opacityMultiplier: 1,
      domainBounds: domain,
      transformColumns: chosen.cols,
      transformRows: chosen.rows,
      bezierColumns: chosen.cols,
      bezierRows: chosen.rows,
      bezierEditType: "cubicBezierSurfaceV1",
      ...(parent ? { parentRigControlId: parent } : {})
    }
  });
  const batch = [
    mk("mouth_vowel_o", "Mouth Vowel O", { childDrawableIds: [IDS.mouth_a], childRigControlIds: [] }),
    mk("mouth_vowel_e", "Mouth Vowel E", { childDrawableIds: [], childRigControlIds: ["rig_mouth_vowel_o"] }),
    mk("mouth_vowel_u", "Mouth Vowel U", { childDrawableIds: [], childRigControlIds: ["rig_mouth_vowel_e"] }),
    mk("mouth_vowel_i", "Mouth Vowel I", { childDrawableIds: [], childRigControlIds: ["rig_mouth_vowel_u"] }),
    mk("mouth_open", "Mouth Open", { childDrawableIds: [], childRigControlIds: ["rig_mouth_vowel_i"] }, "rig_facex_mouth")
  ];
  writeFileSync(join(HERE, "batch-create.json"), JSON.stringify(batch, null, 1));
  writeFileSync(join(HERE, "design-values.json"), JSON.stringify({
    domain, grid: chosen, nBands: N_BANDS, margin: MARGIN, bboxA,
    profiles: Object.fromEntries(Object.entries(profiles).map(([k, p]) => [k, {
      xL: +p.xL.toFixed(2), xR: +p.xR.toFixed(2),
      yTop: p.yTop.map((v) => +v.toFixed(2)), yBot: p.yBot.map((v) => +v.toFixed(2))
    }])),
    predictedResiduals: residReport
  }, null, 1));
  console.log("batch-create.json + design-values.json written");
}

const OPEN_GRID = { cols: 25, rows: 23 };

if (mode === "fix-open") {
  const batch = [
    {
      file: "fix-open-delkey0.json",
      operationId: "op_cp17_fix_open_delkey0",
      operationType: "editKeyformKey",
      gitMessage: "[cp17] fix: delete Mouth Open key 0 (lattice resize prep)",
      payload: {
        target: { kind: "rigControl", id: "rig_mouth_open" },
        targetProperty: "controlPointOffsets",
        parameterId: "param_mouth_open",
        interpolation: "linear-1d-v1",
        action: "deleteCurrent",
        keyValue: 0
      }
    },
    {
      file: "fix-open-delkey1.json",
      operationId: "op_cp17_fix_open_delkey1",
      operationType: "editKeyformKey",
      gitMessage: "[cp17] fix: delete Mouth Open key 1 (removes binding)",
      payload: {
        target: { kind: "rigControl", id: "rig_mouth_open" },
        targetProperty: "controlPointOffsets",
        parameterId: "param_mouth_open",
        interpolation: "linear-1d-v1",
        action: "deleteCurrent",
        keyValue: 1
      }
    },
    {
      file: "fix-open-resize.json",
      operationId: "op_cp17_fix_open_resize",
      operationType: "updateRigControl",
      gitMessage: `[cp17] fix: Mouth Open lattice ${OPEN_GRID.cols}x${OPEN_GRID.rows} (crush kink rides the silhouette; 9x7 undershot by +4.9px vs +2px gate)`,
      payload: {
        rigControlId: "rig_mouth_open",
        transformColumns: OPEN_GRID.cols,
        transformRows: OPEN_GRID.rows,
        bezierColumns: OPEN_GRID.cols,
        bezierRows: OPEN_GRID.rows
      }
    }
  ];
  writeFileSync(join(HERE, "batch-fix-open.json"), JSON.stringify(batch, null, 1));
  console.log("batch-fix-open.json written:", batch.length, "ops");
}

if (mode === "rekey-open") {
  const rc = JSON.parse(readFileSync(join(PKG, "model/rig-controls.json"), "utf8"));
  const arr = Object.values(rc).find(Array.isArray);
  const ctl = arr.find((x) => x.rigControlId === "rig_mouth_open");
  if (ctl.latticeColumns !== OPEN_GRID.cols || ctl.latticeRows !== OPEN_GRID.rows)
    throw new Error(`rig_mouth_open grid is ${ctl.latticeColumns}x${ctl.latticeRows}, expected ${OPEN_GRID.cols}x${OPEN_GRID.rows}`);
  const rest = ctl.restControlPoints;
  const field = fields.open0;
  const offs = rest.map((p) => {
    const q = field(p.x, p.y);
    return { x: round2(q.x - p.x), y: round2(q.y - p.y) };
  });
  const batch = [{
    file: "rekey-mouth_open.json",
    operationId: "op_cp17_rekey_mouth_open",
    operationType: "editKeyformKey",
    gitMessage: `[cp17] key Mouth Open param_mouth_open 0/1 on ${OPEN_GRID.cols}x${OPEN_GRID.rows} (0=crush-to-closed, 1=identity)`,
    payload: {
      target: { kind: "rigControl", id: "rig_mouth_open" },
      targetProperty: "controlPointOffsets",
      parameterId: "param_mouth_open",
      interpolation: "linear-1d-v1",
      action: "createEnds",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: offs },
        max: { propertyPath: "controlPointOffsets", value: Array(rest.length).fill({ x: 0, y: 0 }) }
      }
    }
  }];
  writeFileSync(join(HERE, "batch-rekey-open.json"), JSON.stringify(batch, null, 1));
  console.log("batch-rekey-open.json written");
}

if (mode === "keys") {
  // read committed restControlPoints so node order needs no assumption
  const rc = JSON.parse(readFileSync(join(PKG, "model/rig-controls.json"), "utf8"));
  const arr = Object.values(rc).find(Array.isArray);
  const zeros = (n) => Array(n).fill({ x: 0, y: 0 });
  const batch = [];
  for (const w of WARPS) {
    const ctl = arr.find((x) => x.rigControlId === w.id);
    if (!ctl) throw new Error(`missing committed rig control ${w.id}`);
    if (ctl.latticeColumns !== chosen.cols || ctl.latticeRows !== chosen.rows)
      throw new Error(`grid mismatch on ${w.id}`);
    const rest = ctl.restControlPoints;
    const fieldName = w.fieldAtMin ?? w.fieldAtMax;
    const field = fields[fieldName];
    const offs = rest.map((p) => {
      const q = field(p.x, p.y);
      return { x: round2(q.x - p.x), y: round2(q.y - p.y) };
    });
    const minPatch = w.fieldAtMin ? offs : zeros(rest.length);
    const maxPatch = w.fieldAtMax ? offs : zeros(rest.length);
    batch.push({
      file: `key-${w.id}.json`,
      operationId: `op_cp17_key_${w.id.replace("rig_", "")}`,
      operationType: "editKeyformKey",
      gitMessage: `[cp17] key ${ctl.displayName} ${w.param} 0/1 (${w.fieldAtMin ? "0=crush-to-closed, 1=identity" : "0=identity, 1=morph-to-reference"})`,
      payload: {
        target: { kind: "rigControl", id: w.id },
        targetProperty: "controlPointOffsets",
        parameterId: w.param,
        interpolation: "linear-1d-v1",
        action: "createEnds",
        statePatches: {
          min: { propertyPath: "controlPointOffsets", value: minPatch },
          max: { propertyPath: "controlPointOffsets", value: maxPatch }
        }
      }
    });
  }
  writeFileSync(join(HERE, "batch-keys.json"), JSON.stringify(batch, null, 1));
  console.log("batch-keys.json written:", batch.length, "ops");
}
