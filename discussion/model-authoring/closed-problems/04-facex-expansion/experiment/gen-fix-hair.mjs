// [cp04fix] Front-hair FaceX field regenerated under the spherical projection law.
//
//   dx(point) = A * sqrt(max(0, r_eff(y)^2 - (x - cx)^2)) / R
//   r_eff(y)  = sqrt(max(0, R^2 - (cy - y)^2))  for y < cy   (spherical crown)
//             = R                               for y >= cy  (hanging strands carry
//                                                their attachment translation: cylinder)
//
// Dials (calibrated against canon, see design-log.md):
//   cx = 1001  (hair domain centre ~ face midline x=1000)
//   R  = 200   (feature shell 190 from eye far-side 25.5 @ |dx|=85, + layer gap ~10)
//   cy = 343   (sphere top = hair top vertex y=143 -> cy = 143 + R)
//   A  = 30    (gain-1 peak, unchanged: hair centre stays in sync with nose/forehead)
//
// Grid: rig_facex_hair_front 7x7, domain x655 y135 w692 h638.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cx = 1001, R = 200, cy = 343, A = 30;
const cols = [...Array(7)].map((_, c) => 655 + (692 / 6) * c);
const rows = [...Array(7)].map((_, r) => 135 + (638 / 6) * r);

const field = rows.map((y) => {
  const dyAxis = cy - y;
  const rEff = dyAxis > 0 ? Math.sqrt(Math.max(0, R * R - dyAxis * dyAxis)) : R;
  return cols.map((x) => {
    const dx = x - cx;
    const z = Math.sqrt(Math.max(0, rEff * rEff - dx * dx));
    return Math.round((A * z / R) * 10) / 10;
  });
});

console.log("field (+30):");
for (const row of field) console.log("  " + row.join(", "));

const offsets = (sign) => field.flatMap((row) => row.map((v) => ({ x: sign * v, y: 0 })));

const op = (name, keyValue, sign, baseRev) => ({
  operationId: `op_cp04fix_hair_${name}`,
  operationType: "editKeyformKey",
  basePackageRevision: baseRev,
  payload: {
    target: { kind: "rigControl", id: "rig_facex_hair_front" },
    targetProperty: "controlPointOffsets",
    parameterId: "param_face_angle_x",
    interpolation: "linear-1d-v1",
    action: "updateCurrent",
    keyValue,
    statePatch: { propertyPath: "controlPointOffsets", value: offsets(sign) }
  }
});

writeFileSync(join(here, "commands/fix-key-hair-min.json"), JSON.stringify(op("min", -30, -1, 108), null, 1));
writeFileSync(join(here, "commands/fix-key-hair-max.json"), JSON.stringify(op("max", 30, 1, 109), null, 1));
console.log("wrote commands/fix-key-hair-min.json (base 108), commands/fix-key-hair-max.json (base 109)");
