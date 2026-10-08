// cp05 fix round: occiput layer (back_top_hair_r/l) rig + back-hair curtain root squeeze.
// Physical frame identical to gen-batch-rig.mjs (gain-1 canon reconstructed from the
// committed front-hair field): cx=1001, chordCoef=-0.02512, zCoef=0.09375.
//
// Fix design (user gate 2026-07-03):
// - Curtain roots moved full amplitude (~26px) while the head silhouette edge retreats
//   ~10px at +-30 -> hidden-at-rest root rows (measured: left y360-435 at +30, right
//   y315-405 at -30) slid out from behind the head => tufts read as floating.
// - Occlusion-maintenance constraint (fix-margin-analysis.mjs): allowed root dx is a
//   few px once the occiput layer is counted as occluder; binding rows leak >20px at
//   the current full amplitude.
// - Root amplitude cap Q_ROOT = 1/6 => center root amplitude 30/6 = 5px. Verified
//   against per-row margins: worst residual exposure ~4px at the tuft emergence row,
//   landing on occiput/own-mass pixels (no background gap).
// - Occiput layer = skull back surface: z<0, small. Top edge (hat brim line, hat is
//   currently static & unmeshed) -> z-term 0, chord only (no dead zone). Bottom edge
//   (y=769) -> exactly the corrected curtain root z profile (constructive sync):
//   z_occ(u,769) = -320*Q_ROOT*(1-(u/650)^2) = z_curtain_fix(u,769).
// - Occiput chord uses full u (it IS the scalp: u_root = u). Curtain keeps the
//   root-carried chord u*320/650. Junction differential <= 2.6px at |u|=204 (overlap
//   zone, hair-on-hair; accepted, see design log).
import { writeFileSync } from "node:fs";

const CX = 1001;
const CHORD = 0.1875 * (Math.cos(Math.PI / 6) - 1); // -0.0251201...
const ZC = 0.09375;
const EQ_Y = 463, CAP_R = 320, U_SPREAD = 650;
const Q_ROOT = 1 / 6;
const OCC_TOP_Y = 264;   // hat brim line (occiput texture top edge)
const OCC_BOT_Y = 769;   // occiput bottom edge = curtain-root sync line
const FREE_Y = 1150;     // below shoulders: curtain regains gen-5 full amplitude

const capS = (y) => y >= EQ_Y ? 1 : Math.sqrt(Math.max(0, 1 - ((EQ_Y - y) / CAP_R) ** 2));
const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

// vertical root-squeeze profile for the curtain
const qy = (y) => Q_ROOT + (1 - Q_ROOT) * smooth((y - OCC_BOT_Y) / (FREE_Y - OCC_BOT_Y));
// vertical ramp for the occiput layer (0 at hat brim -> 1 at bottom)
const vy = (y) => Math.min(1, Math.max(0, (y - OCC_TOP_Y) / (OCC_BOT_Y - OCC_TOP_Y)));

const curtainField = (x, y) => {
  const u = x - CX;
  const ur = u * (CAP_R / U_SPREAD);
  const shape = Math.max(0, 1 - (u / U_SPREAD) ** 2);
  const z = -CAP_R * shape * capS(y) * qy(y);
  const c = CHORD * ur;
  return { plus: c + ZC * z, minus: c - ZC * z };
};

const occField = (x, y) => {
  const u = x - CX;
  const shape = Math.max(0, 1 - (u / U_SPREAD) ** 2);
  const z = -CAP_R * Q_ROOT * shape * vy(y);
  const c = CHORD * u; // full u: this layer is the scalp itself
  return { plus: c + ZC * z, minus: c - ZC * z };
};

const round2 = (v) => Math.round(v * 100) / 100;
const grid = (domain, n, field, key) => {
  const out = [];
  for (let r = 0; r < n; r++) {
    const y = domain.y + (domain.height * r) / (n - 1);
    for (let c = 0; c < n; c++) {
      const x = domain.x + (domain.width * c) / (n - 1);
      const f = field(x, y);
      out.push({ x: round2(key === 0 ? 0 : key > 0 ? f.plus : f.minus), y: 0 });
    }
  }
  return out;
};

// --- occiput elements (mesh rest verts +10px margin, movement <= 7px) ---
const occ = [
  { key: "back_top_hair_r", displayName: "FaceX Back Top Hair R",
    drawableId: "draw_r131_0bbc8ea5_f823b4c2_back_top_hair_r",
    domain: { x: 783, y: 257, width: 196, height: 525 }, n: 5 },
  { key: "back_top_hair_l", displayName: "FaceX Back Top Hair L",
    drawableId: "draw_r131_0bbc8ea5_f823b423_back_top_hair_l",
    domain: { x: 1022, y: 252, width: 196, height: 525 }, n: 5 }
];

// --- committed curtain deformers (11x11, domains read from rig-controls.json) ---
const curtains = [
  { key: "back_hair_r", rigId: "rig_facex_back_hair_r",
    domain: { x: 375, y: 310, width: 662, height: 1520 }, n: 11 },
  { key: "back_hair_l", rigId: "rig_facex_back_hair_l",
    domain: { x: 967, y: 272, width: 537, height: 1505 }, n: 11 }
];

const batch = [];
for (const el of occ) {
  batch.push({
    file: `fix-warp-${el.key}.json`,
    operationId: `op_cp05fix_warp_${el.key}`,
    operationType: "createWarpDeformer",
    payload: {
      displayName: el.displayName,
      childDrawableIds: [el.drawableId],
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: el.domain,
      transformColumns: el.n, transformRows: el.n,
      bezierColumns: el.n, bezierRows: el.n,
      bezierEditType: "cubicBezierSurfaceV1"
    },
    gitMessage: `[cp05fix] warp ${el.displayName} (${el.n}x${el.n})`
  });
}
for (const el of occ) {
  batch.push({
    file: `fix-key-${el.key}.json`,
    operationId: `op_cp05fix_key_${el.key}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: `rig_facex_${el.key}` },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_x",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, occField, -1) },
        default: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, occField, 0) },
        max: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, occField, +1) }
      }
    },
    gitMessage: `[cp05fix] key ${el.displayName} face_angle_x (createEndsCenter)`
  });
}
for (const el of curtains) {
  for (const [label, key] of [["min", -1], ["max", +1]]) {
    batch.push({
      file: `fix-key-${el.key}-${label}.json`,
      operationId: `op_cp05fix_key_${el.key}_${label}`,
      operationType: "editKeyformKey",
      payload: {
        target: { kind: "rigControl", id: el.rigId },
        targetProperty: "controlPointOffsets",
        parameterId: "param_face_angle_x",
        interpolation: "linear-1d-v1",
        action: "updateCurrent",
        keyValue: key * 30,
        statePatch: { propertyPath: "controlPointOffsets", value: grid(el.domain, el.n, curtainField, key) }
      },
      gitMessage: `[cp05fix] key ${el.key} face_angle_x ${label} root squeeze (updateCurrent)`
    });
  }
}

writeFileSync(new URL("fix-batch-rig.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log(`fix-batch-rig.json: ${batch.length} ops`);

// design-log tables
console.log("\nocciput bottom row (y=769):");
for (const el of occ) {
  const cells = [];
  for (let c = 0; c < el.n; c++) {
    const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
    const f = occField(x, OCC_BOT_Y);
    cells.push(`u=${Math.round(x - CX)}:+${round2(f.plus)}/-${round2(f.minus)}`);
  }
  console.log(" ", el.key, cells.join("  "));
}
console.log("\ncurtain root rows (y=463 head, y=769 junction, y=1400 tips):");
for (const el of curtains) {
  for (const y of [463, 769, 1400]) {
    const cells = [];
    for (let c = 0; c < el.n; c += 2) {
      const x = el.domain.x + (el.domain.width * c) / (el.n - 1);
      const f = curtainField(x, y);
      cells.push(`u=${Math.round(x - CX)}:+${round2(f.plus)}/-${round2(f.minus)}`);
    }
    console.log(" ", el.key, `y=${y}`, cells.join("  "));
  }
}
