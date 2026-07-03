// [cp04fix2] Front-hair FaceX rebuilt under the ROTATION projection law (chord form).
//
// Law (recipe 06, revised final form):  dx(point) = u*(cos D - 1) + z(point)*sin D
//   u = x - cx (screen distance from the vertical rotation axis)
//   z = designed depth profile (the only design object; sphere ansatz is initial value only)
//
// Depth profile (covers the FULL drawn extent, no dead band):
//   z_phys(u, y) = U * shapeU(u) * s(y)
//     shapeU(u) = max(0, 1 - (u/U)^2)        parabolic chord-depth: z > 0 across the
//                                            material (half-span 311 < U), finite slope
//                                            at the limb (sqrt profile folds under
//                                            piecewise-linear sampling near the edge)
//     s(y)      = sqrt(max(0, 1-((cy-y)/U)^2))  for y < cy   spherical crown, apex at the
//                                                            material top y=143 (on-axis)
//               = 1                             for y >= cy  cylinder extension: hanging
//                                                            strands carry their attachment
//   U  = 320   hair-shell radius: material half-span 311 plus margin (z>0 to the edge)
//   cx = 1001  face midline; cy = 143 + U = 463 (equator at eye level = widest head slice)
//
// Gain (canon gain-1 world, nose amplitude 30px): g = 30 / (U*sin30) = 0.1875
//   dx+-(u,y) = g*(cosD-1)*u +- 30*shapeU(u)*s(y)     with g*(cos30-1) = -0.0251202...
// The chord term is EVEN in D (cos): min/max keys are NOT mirror images. Edges (z~0)
// shrink toward the centre for BOTH turn directions -- the missing foreshortening.
//
// Grid: 11x11 transform + 11x11 bezier (two steps finer than 7x7; bezier = transform),
// domain unchanged x655 y135 w692 h638.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const cx = 1001, U = 320, yTop = 143, cy = yTop + U, A = 30;
const D = Math.PI / 6;
const g = A / (U * Math.sin(D));
const chordCoeff = g * (Math.cos(D) - 1); // -0.0251202...

const N = 11;
const dom = { x: 655, y: 135, width: 692, height: 638 };
const cols = [...Array(N)].map((_, c) => dom.x + (dom.width / (N - 1)) * c);
const rows = [...Array(N)].map((_, r) => dom.y + (dom.height / (N - 1)) * r);

const shapeU = (u) => Math.max(0, 1 - (u / U) ** 2);
const sY = (y) => (y >= cy ? 1 : Math.sqrt(Math.max(0, 1 - ((cy - y) / U) ** 2)));

const field = (sign) =>
  rows.flatMap((y) =>
    cols.map((x) => {
      const u = x - cx;
      const dx = chordCoeff * u + sign * A * shapeU(u) * sY(y);
      return { x: Math.round(dx * 10) / 10, y: 0 };
    })
  );

const zeros = rows.flatMap(() => cols.map(() => ({ x: 0, y: 0 })));
const fMax = field(+1);
const fMin = field(-1);

console.log(`chordCoeff=${chordCoeff.toFixed(6)}  g=${g}  cy=${cy}`);
for (const [label, f] of [["max(+30)", fMax], ["min(-30)", fMin]]) {
  console.log(`field ${label}:`);
  for (let r = 0; r < N; r++)
    console.log("  y" + Math.round(rows[r]) + ": " +
      f.slice(r * N, r * N + N).map((p) => p.x).join(", "));
}

const batch = [
  {
    file: "fix2-delete-hair.json",
    operationId: "op_cp04fix2_delete_hair",
    operationType: "deleteRigControl",
    payload: { rigControlId: "rig_facex_hair_front" },
    gitMessage: "[cp04fix2] facex: delete hair front deformer (7x7, bezier 2x2)"
  },
  {
    file: "fix2-warp-hair.json",
    operationId: "op_cp04fix2_warp_hair",
    operationType: "createWarpDeformer",
    payload: {
      displayName: "FaceX Hair Front",
      childDrawableIds: ["draw_r0_1cea4f6f_21b4dac0_front_hair"],
      childRigControlIds: [],
      opacityMultiplier: 1,
      domainBounds: dom,
      transformColumns: N,
      transformRows: N,
      bezierColumns: N,
      bezierRows: N,
      bezierEditType: "cubicBezierSurfaceV1"
    },
    gitMessage: "[cp04fix2] facex: recreate hair front deformer 11x11, bezier 11x11 (= transform)"
  },
  {
    file: "fix2-key-hair.json",
    operationId: "op_cp04fix2_key_hair",
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: "rig_facex_hair_front" },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_x",
      interpolation: "linear-1d-v1",
      action: "createEndsCenter",
      statePatches: {
        min: { propertyPath: "controlPointOffsets", value: fMin },
        default: { propertyPath: "controlPointOffsets", value: zeros },
        max: { propertyPath: "controlPointOffsets", value: fMax }
      }
    },
    gitMessage:
      "[cp04fix2] facex: hair front keys via rotation projection law (chord dx=u(cosD-1)+z sinD, U320 parabola, crown cy463; edges shrink inward)"
  }
];

writeFileSync(join(here, "batch-fix2.json"), JSON.stringify(batch, null, 1));
console.log("wrote batch-fix2.json (delete -> create 11x11 -> keys)");
