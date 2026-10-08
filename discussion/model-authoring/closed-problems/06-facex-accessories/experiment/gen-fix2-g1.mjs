// cp06fix2 B: G1 (tangent) connection of the hat's bottom corners to the hair
// contour — one-shot experiment (stop condition: one visual iteration).
//
// Measured state after fix A (fix2-analyze.mjs, deformed contours at +-30):
// the subordination already restores C0 (tip-to-hair gap <= ~2.5px = rest poke)
// AND carries the joint mostly G1-relative: the joint angle (hat tail slope
// minus hair tangent, last ~20px each side of the junction) deviates from the
// REST joint angle only on the FAR-side corner of each key:
//   L corner, +30 (far side): tail +0.273 vs target +0.167 (rest joint 0.582,
//     deformed hair tangent -0.415) -> excess +19%
//   R corner, -30 (far side): tail -0.506 vs target -0.416 (rest joint 0.89,
//     deformed hair tangent +0.474) -> excess +6%
//   near-side corners (L-30, R+30): joint angle == rest within noise -> leave.
//
// Design judgment (recorded for the log): FULL tangent snapping (kink -> 0)
// was REJECTED: the rest joint itself is not G1 — the flap tip corner is a
// drawn garment feature (fix2-cornerR-rest.png). Making the +-30 silhouette
// smoother than the artist's rest drawing would change the garment's design
// per pose. The correct invariant is: the DEFORMATION must be C1 across the
// junction, i.e. deformed joint angle == rest joint angle; the bottom row is
// re-derived so the hat edge approaches the junction along the measured
// deformed hair tangent offset by the rest corner angle.
//
// Implementation: rotate the deformed tail segment about the (fixed) flap tip
// by the excess slope: delta dx at the r10 edge nodes = excess * rowPitch,
// tapered 0.4x at r9, zero at r8 and at the tip rows r11/r12.
//   max key ( +30 far = L): c0,c1 rows r9 +1.11, r10 +2.77
//   min key ( -30 far = R): c11,c12 rows r9 -0.96, r10 -2.40
// dy untouched. All other nodes byte-preserved (asserted against the fix2
// formula before patching).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const N = 13;

// committed fix2 grids (assert against generator output before patching)
const kfsRaw = JSON.parse(readFileSync(`${PKG}/model/keyforms.json`, "utf8"));
const kfs = kfsRaw.keyformSets ?? kfsRaw;
const hatSet = kfs.find(
  (k) => k.target?.id === "rig_facex_headwear" && k.parameterId === "param_face_angle_x"
);

// regenerate the fix2 formula values by importing gen-fix2-hat's tables is
// overkill here: the batch file it wrote IS the committed source. Assert
// committed == batch-fix2-hat.json values, then patch.
const batchA = JSON.parse(readFileSync(new URL("batch-fix2-hat.json", import.meta.url), "utf8"));
const gridOf = (label) =>
  batchA.find((e) => e.file.includes(`-${label}.`)).payload.statePatch.value;

const DELTA = {
  max: { cols: [0, 1], rows: [[9, 1.11], [10, 2.77]] },
  min: { cols: [11, 12], rows: [[9, -0.96], [10, -2.40]] }
};

const batch = [];
for (const [label, keyVal] of [["max", 30], ["min", -30]]) {
  const committed = hatSet.keys.find((k) => k.value === keyVal).statePatch;
  const gen = gridOf(label);
  if (committed.length !== N * N) throw new Error("lattice size");
  for (let i = 0; i < N * N; i++) {
    if (Math.abs(committed[i].x - gen[i].x) > 0.005 || Math.abs(committed[i].y - gen[i].y) > 0.005)
      throw new Error(`${label} drift at node ${i}: (${committed[i].x},${committed[i].y}) vs (${gen[i].x},${gen[i].y})`);
  }
  const value = committed.map((p) => ({ x: p.x, y: p.y }));
  const d = DELTA[label];
  for (const [r, dv] of d.rows) {
    for (const c of d.cols) {
      value[r * N + c] = { x: Math.round((value[r * N + c].x + dv) * 100) / 100, y: value[r * N + c].y };
    }
  }
  batch.push({
    file: `fix2-g1-headwear-${label}.json`,
    operationId: `op_cp06fix2_g1_headwear_${label}`,
    operationType: "editKeyformKey",
    payload: {
      target: { kind: "rigControl", id: "rig_facex_headwear" },
      targetProperty: "controlPointOffsets",
      parameterId: "param_face_angle_x",
      interpolation: "linear-1d-v1",
      action: "updateCurrent",
      keyValue: keyVal,
      statePatch: { propertyPath: "controlPointOffsets", value }
    },
    gitMessage: `[cp06fix2] key FaceX Headwear ${label}: G1 tail rotation at far-side bottom corner (rest joint angle restored)`
  });
  console.log(`${label}: patched nodes`, d.rows.map(([r]) => d.cols.map((c) => `r${r}c${c}`).join(",")).join(" "));
}
writeFileSync(new URL("batch-fix2-g1.json", import.meta.url), JSON.stringify(batch, null, 2));
console.log("batch-fix2-g1.json: 2 ops");
