// cp18: alt-outfit rigging by SPATIAL FIELD RESAMPLING (design-notes.md is the spec).
//
// This file is the PRIMARY SOURCE of every cp18 number.
//
// Method (design-notes §3): a committed source warp S defines a displacement
// field F_S over space via its rest lattice {q_ij} (exactly uniform, asserted)
// and a key's statePatch {d_ij}. For a new lattice point p:
//   p inside  S.domain: F(p) = bilinear interpolation in S's lattice cell
//   p outside S.domain: F(p) = F(clamp(p, S.domain))   (slope-1 continuation,
//                       the "piecewise-linear extrapolation is clamped" craft law)
// The new warp's key statePatch is F evaluated at the new rest lattice points.
// Sources are READ ONLY. rig_bodyx_topwear's collar human-correction is baked
// into its committed +/-10 patches, so it travels inside F automatically.
//
// Identity check (design-notes §4-1, in-script assert): feeding S's own rest
// lattice points through the resampler must reproduce d_ij with EXACTLY zero
// error (===). Guaranteed by snapping cell coordinates within 1e-9 of a node.
//
// Grid rule (design-notes §2): new domain = drawable mesh bbox + ~half source
// pitch margin; new grid pitch ~= source pitch (minimum density that carries
// the source physics).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const M = "C:/workspace/remie/rigging/llm-rigging/model";
const j = (f) => JSON.parse(readFileSync(join(M, f), "utf8"));

const rig = j("rig-controls.json").rigControls;
const keyformSets = j("keyforms.json").keyformSets;
const meshes = j("meshes.json").meshes;

const rigById = (id) => {
  const r = rig.find((x) => x.rigControlId === id);
  if (!r) throw new Error(`missing rig control ${id}`);
  return r;
};
const keysetOf = (rigId, param) => {
  const s = keyformSets.find(
    (x) => x.target.kind === "rigControl" && x.target.id === rigId &&
      x.target.property === "controlPointOffsets" && x.parameterId === param
  );
  if (!s) throw new Error(`missing keyform set for ${rigId} / ${param}`);
  return s;
};
const meshOf = (drawableId) => {
  const m = meshes.find((x) => x.drawableId === drawableId);
  if (!m || !m.vertices?.length) throw new Error(`missing/empty mesh for ${drawableId}`);
  return m;
};

// ---------- source field ----------
const EPS = 1e-9;
const sourceField = (rigId, param) => {
  const r = rigById(rigId);
  const { domainBounds: d, latticeColumns: C, latticeRows: R, restControlPoints: P } = r;
  // assert the rest lattice is EXACTLY the uniform domain grid (else cell
  // lookup by uniform math would be wrong -> stop, per the stop condition)
  for (let row = 0; row < R; row++) for (let col = 0; col < C; col++) {
    const q = P[row * C + col];
    const ux = d.x + d.width * (C <= 1 ? 0 : col / (C - 1));
    const uy = d.y + d.height * (R <= 1 ? 0 : row / (R - 1));
    if (q.x !== ux || q.y !== uy) throw new Error(`${rigId} rest lattice not uniform at (${row},${col})`);
  }
  const set = keysetOf(rigId, param);
  for (const k of set.keys) {
    if (!Array.isArray(k.statePatch) || k.statePatch.length !== C * R)
      throw new Error(`${rigId} key ${k.value}: statePatch length ${k.statePatch?.length} != ${C * R}`);
  }
  const snap = (v) => (Math.abs(v - Math.round(v)) < EPS ? Math.round(v) : v);
  const evalAt = (patch, p) => {
    // clamp to domain first (slope-1 continuation outside), then bilinear
    const cxp = Math.min(Math.max(p.x, d.x), d.x + d.width);
    const cyp = Math.min(Math.max(p.y, d.y), d.y + d.height);
    const fx = snap(((cxp - d.x) / d.width) * (C - 1));
    const fy = snap(((cyp - d.y) / d.height) * (R - 1));
    const c0 = Math.min(Math.floor(fx), C - 2), r0 = Math.min(Math.floor(fy), R - 2);
    const tx = fx - c0, ty = fy - r0;
    const g = (rr, cc) => patch[rr * C + cc];
    const a = g(r0, c0), b = g(r0, c0 + 1), c1 = g(r0 + 1, c0), d2 = g(r0 + 1, c0 + 1);
    if (tx === 0 && ty === 0) return { x: a.x, y: a.y };            // exact node
    if (tx === 0) return { x: (1 - ty) * a.x + ty * c1.x, y: (1 - ty) * a.y + ty * c1.y };
    if (ty === 0) return { x: (1 - tx) * a.x + tx * b.x, y: (1 - tx) * a.y + tx * b.y };
    return {
      x: (1 - ty) * ((1 - tx) * a.x + tx * b.x) + ty * ((1 - tx) * c1.x + tx * d2.x),
      y: (1 - ty) * ((1 - tx) * a.y + tx * b.y) + ty * ((1 - tx) * c1.y + tx * d2.y)
    };
  };
  return { rigControl: r, set, domain: d, cols: C, rows: R, evalAt };
};

// ---------- identity assert (design-notes §4-1) ----------
const identityAssert = (field) => {
  const { rigControl: r, set, cols: C, rows: R } = field;
  for (const k of set.keys) {
    for (let i = 0; i < C * R; i++) {
      const got = field.evalAt(k.statePatch, r.restControlPoints[i]);
      const want = k.statePatch[i];
      if (got.x !== want.x || got.y !== want.y)
        throw new Error(`IDENTITY FAIL ${r.rigControlId} key ${k.value} idx ${i}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
  }
  return `${r.rigControlId}/${set.parameterId}: ${set.keys.length} keys x ${C * R} points exact`;
};

// ---------- new warp design ----------
const meshBBox = (mesh) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of mesh.vertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  return { minX, minY, maxX, maxY };
};

const designGrid = (bbox, srcDomain, srcCols, srcRows) => {
  const pitchX = srcDomain.width / (srcCols - 1);
  const pitchY = srcDomain.height / (srcRows - 1);
  const mx = Math.round(pitchX / 2), my = Math.round(pitchY / 2);
  const x = Math.floor(bbox.minX) - mx, y = Math.floor(bbox.minY) - my;
  const width = Math.ceil(bbox.maxX) + mx - x, height = Math.ceil(bbox.maxY) + my - y;
  const cols = Math.max(2, Math.round(width / pitchX) + 1);
  const rows = Math.max(2, Math.round(height / pitchY) + 1);
  return { domain: { x, y, width, height }, cols, rows };
};

const restPoints = ({ domain, cols, rows }) => {
  const pts = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    pts.push({
      x: domain.x + domain.width * (cols <= 1 ? 0 : col / (cols - 1)),
      y: domain.y + domain.height * (rows <= 1 ? 0 : row / (rows - 1))
    });
  }
  return pts;
};

// round resampled offsets to 1e-6 px (guards against JSON noise; far below
// any perceptual or validation threshold). Identity assert above ran on the
// UNROUNDED evaluator; committed-vs-generated comparison uses these rounded
// values as the design record.
const r6 = (v) => Math.round(v * 1e6) / 1e6;

const resampleKeys = (field, gridSpec) => {
  const pts = restPoints(gridSpec);
  const byValue = {};
  for (const k of field.set.keys) {
    byValue[k.value] = pts.map((p) => {
      const o = field.evalAt(k.statePatch, p);
      return { x: r6(o.x), y: r6(o.y) };
    });
  }
  // source 0-key must be all zeros and so must its resampling
  for (const o of byValue[0]) if (o.x !== 0 || o.y !== 0) throw new Error("center key resampled non-zero");
  return byValue;
};

// ---------- targets (design-notes §1) ----------
const OUTFITS = [
  {
    tag: "rodos", label: "Rodos",
    topwear: "draw_r0_1cea4f6f_a43f1585_topwear",
    handwearR: "draw_r0_1cea4f6f_a43f1647_handwear-r",
    handwearL: "draw_r0_1cea4f6f_a43f1666_handwear-l"
  },
  {
    tag: "endo", label: "Endo",
    topwear: "draw_r0_1cea4f6f_8b5c54ca_topwear",
    handwearR: "draw_r0_1cea4f6f_8b5c542b_handwear-r",
    handwearL: "draw_r0_1cea4f6f_8b5c5408_handwear-l"
  }
];

// expected new rig id (= displayName sanitized). May already exist from an
// earlier partial run of THIS generator; then it must match the design exactly
// (asserted in pushCreate) and its create op is skipped (idempotent re-run).
const expectId = (displayName) => `rig_${displayName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}`;

// push a create op, or — if the control already exists — assert it matches the
// designed payload byte-for-byte on the fields we own, and skip the op.
const pushCreate = (op) => {
  const id = expectId(op.payload.displayName);
  const existing = rig.find((x) => x.rigControlId === id);
  if (!existing) { batchCreate.push(op); return; }
  const p = op.payload;
  const wantKids = p.wrapChildren
    ? p.wrapChildren.filter((c) => c.kind === "drawable").map((c) => c.id)
    : p.childDrawableIds;
  const wantRigKids = p.wrapChildren
    ? p.wrapChildren.filter((c) => c.kind === "rigControl").map((c) => c.id)
    : p.childRigControlIds;
  const d0 = existing.domainBounds, d1 = p.domainBounds;
  if (d0.x !== d1.x || d0.y !== d1.y || d0.width !== d1.width || d0.height !== d1.height ||
      existing.latticeColumns !== p.transformColumns || existing.latticeRows !== p.transformRows ||
      JSON.stringify([...existing.childDrawableIds]) !== JSON.stringify(wantKids) ||
      JSON.stringify([...existing.childRigControlIds]) !== JSON.stringify(wantRigKids))
    throw new Error(`existing ${id} does not match design; refusing to skip\n  committed: ${JSON.stringify({ d: d0, c: existing.latticeColumns, r: existing.latticeRows, kids: existing.childDrawableIds, rigKids: existing.childRigControlIds })}\n  designed:  ${JSON.stringify({ d: d1, c: p.transformColumns, r: p.transformRows, kids: wantKids, rigKids: wantRigKids })}`);
  console.log(`  (skip create: ${id} already committed and matches design)`);
};

// source fields
const F_bodyz_topwear = sourceField("rig_bodyz_topwear", "param_body_angle_z");
const F_bodyx_topwear = sourceField("rig_bodyx_topwear", "param_body_angle_x");
const F_bodyx_arm_l = sourceField("rig_bodyx_arm_l", "param_body_angle_x");
const F_bodyx_arm_r = sourceField("rig_bodyx_arm_r", "param_body_angle_x");

console.log("identity assert (design-notes §4-1):");
for (const f of [F_bodyz_topwear, F_bodyx_topwear, F_bodyx_arm_l, F_bodyx_arm_r])
  console.log("  PASS", identityAssert(f));

// sanity: both topwear source warps share domain+grid (they must, same tower)
if (JSON.stringify(F_bodyz_topwear.domain) !== JSON.stringify(F_bodyx_topwear.domain) ||
    F_bodyz_topwear.cols !== F_bodyx_topwear.cols || F_bodyz_topwear.rows !== F_bodyx_topwear.rows)
  throw new Error("topwear source tower domain/grid mismatch");

const batchCreate = [];
const batchKeys = [];
const design = [];

for (const o of OUTFITS) {
  // --- topwear tower: BodyX warp (bare drawable, temp root) then BodyZ wrap ---
  const twBBox = meshBBox(meshOf(o.topwear));
  const twGrid = designGrid(twBBox, F_bodyx_topwear.domain, F_bodyx_topwear.cols, F_bodyx_topwear.rows);
  // every mesh vertex must be inside the new domain
  for (const v of meshOf(o.topwear).vertices)
    if (v.x < twGrid.domain.x || v.x > twGrid.domain.x + twGrid.domain.width ||
        v.y < twGrid.domain.y || v.y > twGrid.domain.y + twGrid.domain.height)
      throw new Error(`${o.tag} topwear vertex outside domain`);

  const bodyxTw = { name: `BodyX Topwear ${o.label}`, id: expectId(`BodyX Topwear ${o.label}`) };
  const bodyzTw = { name: `BodyZ Topwear ${o.label}`, id: expectId(`BodyZ Topwear ${o.label}`) };

  pushCreate({
    file: `create-bodyx-topwear-${o.tag}.json`,
    operationId: `op_cp18_create_bodyx_topwear_${o.tag}`,
    operationType: "createWarpDeformer",
    gitMessage: `[cp18] warp ${bodyxTw.name} (${twGrid.cols}x${twGrid.rows}, domain ${twGrid.domain.x},${twGrid.domain.y} ${twGrid.domain.width}x${twGrid.domain.height}) on bare drawable`,
    payload: {
      displayName: bodyxTw.name,
      childDrawableIds: [o.topwear],
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: twGrid.domain,
      transformColumns: twGrid.cols, transformRows: twGrid.rows,
      bezierColumns: twGrid.cols, bezierRows: twGrid.rows,
      bezierEditType: "cubicBezierSurfaceV1"
    }
  });
  // NOTE (cp18 craft finding): wrapChildren + parentRigControlId is rejected
  // when the wrapped child is a root ("Wrap parent ... does not match a root
  // selected group") — wrap-with-parent is for IN-PLACE insertion only (cp15).
  // For a new tower, use create mode: childRigControlIds adopts the root child
  // (proven in cp17 vowel chain) and parentRigControlId binds under the parent.
  pushCreate({
    file: `create-bodyz-topwear-${o.tag}.json`,
    operationId: `op_cp18_create_bodyz_topwear_${o.tag}`,
    operationType: "createWarpDeformer",
    gitMessage: `[cp18] warp ${bodyzTw.name} (${twGrid.cols}x${twGrid.rows}) adopting ${bodyxTw.id} under rig_bodyz_upper_body`,
    payload: {
      displayName: bodyzTw.name,
      childDrawableIds: [],
      childRigControlIds: [bodyxTw.id],
      opacityMultiplier: 1,
      domainBounds: twGrid.domain,
      transformColumns: twGrid.cols, transformRows: twGrid.rows,
      bezierColumns: twGrid.cols, bezierRows: twGrid.rows,
      bezierEditType: "cubicBezierSurfaceV1",
      parentRigControlId: "rig_bodyz_upper_body"
    }
  });

  const twKeysX = resampleKeys(F_bodyx_topwear, twGrid);
  const twKeysZ = resampleKeys(F_bodyz_topwear, twGrid);
  batchKeys.push({
    file: `key-bodyx-topwear-${o.tag}.json`,
    operationId: `op_cp18_key_bodyx_topwear_${o.tag}`,
    operationType: "editKeyformKey",
    gitMessage: `[cp18] key ${bodyxTw.name} body_angle_x (resampled from rig_bodyx_topwear field, collar correction carried)`,
    payload: {
      target: { kind: "rigControl", id: bodyxTw.id },
      targetProperty: "controlPointOffsets",
      parameterId: "param_body_angle_x",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: twKeysX[-10] },
        default: { propertyPath: "controlPointOffsets", value: twKeysX[0] },
        max: { propertyPath: "controlPointOffsets", value: twKeysX[10] }
      }
    }
  });
  batchKeys.push({
    file: `key-bodyz-topwear-${o.tag}.json`,
    operationId: `op_cp18_key_bodyz_topwear_${o.tag}`,
    operationType: "editKeyformKey",
    gitMessage: `[cp18] key ${bodyzTw.name} body_angle_z (resampled from rig_bodyz_topwear field)`,
    payload: {
      target: { kind: "rigControl", id: bodyzTw.id },
      targetProperty: "controlPointOffsets",
      parameterId: "param_body_angle_z",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: twKeysZ[-10] },
        default: { propertyPath: "controlPointOffsets", value: twKeysZ[0] },
        max: { propertyPath: "controlPointOffsets", value: twKeysZ[10] }
      }
    }
  });
  design.push(
    { id: bodyxTw.id, source: "rig_bodyx_topwear", param: "param_body_angle_x", grid: twGrid, keys: twKeysX },
    { id: bodyzTw.id, source: "rig_bodyz_topwear", param: "param_body_angle_z", grid: twGrid, keys: twKeysZ }
  );

  // --- arms: BodyX warp directly under rig_bodyz_upper_body (create+bind) ---
  for (const [side, drawableId, srcField, srcName] of [
    ["r", o.handwearR, F_bodyx_arm_r, "rig_bodyx_arm_r"],
    ["l", o.handwearL, F_bodyx_arm_l, "rig_bodyx_arm_l"]
  ]) {
    const bbox = meshBBox(meshOf(drawableId));
    const grid = designGrid(bbox, srcField.domain, srcField.cols, srcField.rows);
    for (const v of meshOf(drawableId).vertices)
      if (v.x < grid.domain.x || v.x > grid.domain.x + grid.domain.width ||
          v.y < grid.domain.y || v.y > grid.domain.y + grid.domain.height)
        throw new Error(`${o.tag} handwear-${side} vertex outside domain`);
    const arm = { name: `BodyX Arm ${side.toUpperCase()} ${o.label}`, id: expectId(`BodyX Arm ${side.toUpperCase()} ${o.label}`) };
    pushCreate({
      file: `create-bodyx-arm_${side}-${o.tag}.json`,
      operationId: `op_cp18_create_bodyx_arm_${side}_${o.tag}`,
      operationType: "createWarpDeformer",
      gitMessage: `[cp18] warp ${arm.name} (${grid.cols}x${grid.rows}, domain ${grid.domain.x},${grid.domain.y} ${grid.domain.width}x${grid.domain.height}) under rig_bodyz_upper_body`,
      payload: {
        displayName: arm.name,
        childDrawableIds: [drawableId],
        childRigControlIds: [],
        opacityMultiplier: 1,
        domainBounds: grid.domain,
        transformColumns: grid.cols, transformRows: grid.rows,
        bezierColumns: grid.cols, bezierRows: grid.rows,
        bezierEditType: "cubicBezierSurfaceV1",
        parentRigControlId: "rig_bodyz_upper_body"
      }
    });
    const keys = resampleKeys(srcField, grid);
    batchKeys.push({
      file: `key-bodyx-arm_${side}-${o.tag}.json`,
      operationId: `op_cp18_key_bodyx_arm_${side}_${o.tag}`,
      operationType: "editKeyformKey",
      gitMessage: `[cp18] key ${arm.name} body_angle_x (resampled from ${srcName} field)`,
      payload: {
        target: { kind: "rigControl", id: arm.id },
        targetProperty: "controlPointOffsets",
        parameterId: "param_body_angle_x",
        interpolation: "linear-1d-v1",
        action: "createEndsCenter",
        statePatches: {
          min: { propertyPath: "controlPointOffsets", value: keys[-10] },
          default: { propertyPath: "controlPointOffsets", value: keys[0] },
          max: { propertyPath: "controlPointOffsets", value: keys[10] }
        }
      }
    });
    design.push({ id: arm.id, source: srcName, param: "param_body_angle_x", grid, keys });
  }
}

writeFileSync(join(HERE, "batch-create.json"), JSON.stringify(batchCreate, null, 1));
writeFileSync(join(HERE, "batch-keys.json"), JSON.stringify(batchKeys, null, 1));
writeFileSync(join(HERE, "design-values.json"), JSON.stringify({
  sources: {
    topwear: { domain: F_bodyx_topwear.domain, cols: F_bodyx_topwear.cols, rows: F_bodyx_topwear.rows },
    arm_l: { domain: F_bodyx_arm_l.domain, cols: F_bodyx_arm_l.cols, rows: F_bodyx_arm_l.rows },
    arm_r: { domain: F_bodyx_arm_r.domain, cols: F_bodyx_arm_r.cols, rows: F_bodyx_arm_r.rows }
  },
  design
}));
console.log(`batch-create.json: ${batchCreate.length} ops / batch-keys.json: ${batchKeys.length} ops`);
for (const d of design)
  console.log(`  ${d.id} <- ${d.source} grid ${d.grid.cols}x${d.grid.rows} domain ${JSON.stringify(d.grid.domain)}`);
