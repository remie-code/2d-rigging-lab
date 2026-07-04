// cp12 FaceZ rotation core generator. First rotation2d operation in this workspace.
//
// Modes:
//   node gen-facez-rotation.mjs gen      -> writes batch-facez.json (2 ops) + design-values.json
//   node gen-facez-rotation.mjs snapshot -> writes snapshot-pre.json from the live package
//   node gen-facez-rotation.mjs verify   -> compares live package against snapshot-pre.json:
//        - all pre-existing keyformSets byte-identical (named check incl. human-corrected sets)
//        - exactly one new keyformSet with the expected shape (angleDegrees three-point key)
//        - rig controls: only the 14 wrapped BodyX towers change, and only in parentId
//          (canonical-minus-parentId equality + parentId expected-value check; cp11 lesson)
//        - new rotation2d control matches the designed payload
//        - meshes byte-identical; graph roots = 14 BodyX ids replaced by the FaceZ id
//
// All numbers derive from the rest measurement in commands/measure-pivot.response.json:
//   neck  bbox x 944..1047 (center 995.5), y 547..645 (center 596)
//   face  bbox x 862..1138, chin bottom y 577
// Pivot = neck horizontal center, neck vertical center (~19px below chin bottom)
//       = the "顎下・首の中心" neck-base convention from the problem definition.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";

// ---- design constants (single source) --------------------------------------
const FACEZ_ID = "rig_facez_head";
const DISPLAY_NAME = "FaceZ Head";
const PIVOT = { x: 995.5, y: 596 };      // neck bbox center (measured, rev 361)
const ANGLE_MAX_DEG = 10;                // restrained start; user-gate dial
const PARAM = "param_face_angle_z";      // preset: -30..30, max = clockwise roll
// y-down canvas: matrix (a=cos,b=sin,c=-sin,d=cos) rotates clockwise on screen
// for positive angleDegrees -> +10 deg at param max matches "clockwise face roll".

// The 14 rigid head towers (BodyX roots) to wrap. Excluded by design:
// hair_f_l/r + back_hair_l/r (gravity-ruled, cp13), neck + torso towers (do not roll).
const WRAP_IDS = [
  "rig_bodyx_face",
  "rig_bodyx_eye_l",
  "rig_bodyx_eye_r",
  "rig_bodyx_mouth",
  "rig_bodyx_nose",
  "rig_bodyx_eyewear",
  "rig_bodyx_brow_l",
  "rig_bodyx_brow_r",
  "rig_bodyx_headwear",
  "rig_bodyx_ears_l",
  "rig_bodyx_ears_r",
  "rig_bodyx_hair_front",
  "rig_bodyx_back_top_hair_l",
  "rig_bodyx_back_top_hair_r"
];

const canon = (v) => JSON.stringify(sortKeys(v));
const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v !== null && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
      : v;

const readModel = (file) => JSON.parse(readFileSync(join(PKG, "model", file), "utf8"));

// ---- gen -------------------------------------------------------------------
const gen = () => {
  const batch = [
    {
      file: "op-facez-create.json",
      operationId: "op_cp12_facez_create",
      operationType: "createRotation2dRigControl",
      gitMessage: "[cp12] create FaceZ rotation2d control (pivot=neck base, wrap 14 head towers)",
      payload: {
        displayName: DISPLAY_NAME,
        pivot: PIVOT,
        restAngleDegrees: 0,
        wrapChildren: WRAP_IDS.map((id) => ({ kind: "rigControl", id }))
      }
    },
    {
      file: "op-facez-key.json",
      operationId: "op_cp12_facez_key",
      operationType: "editKeyformKey",
      gitMessage: "[cp12] FaceZ angleDegrees three-point key (-10/0/+10 deg, translation untouched)",
      payload: {
        action: "createEndsCenter",
        target: { kind: "rigControl", id: FACEZ_ID },
        targetProperty: "angleDegrees",
        parameterId: PARAM,
        interpolation: "linear-1d-v1",
        compositionMode: "replace",
        statePatches: {
          min: { propertyPath: "angleDegrees", value: -ANGLE_MAX_DEG },
          default: { propertyPath: "angleDegrees", value: 0 },
          max: { propertyPath: "angleDegrees", value: ANGLE_MAX_DEG }
        }
      }
    }
  ];
  writeFileSync(join(HERE, "batch-facez.json"), JSON.stringify(batch, null, 2));
  writeFileSync(
    join(HERE, "design-values.json"),
    JSON.stringify({ FACEZ_ID, PIVOT, ANGLE_MAX_DEG, PARAM, WRAP_IDS }, null, 2)
  );
  console.log(`gen: batch-facez.json written (${batch.length} ops)`);
};

// ---- snapshot ----------------------------------------------------------------
const snapshot = () => {
  const snap = {
    packageRevision: JSON.parse(readFileSync(join(PKG, "manifest.json"), "utf8")).packageRevision,
    rigControls: readModel("rig-controls.json"),
    keyforms: readModel("keyforms.json"),
    meshesCanon: canon(readModel("meshes.json")),
    graphRootIds: readModel("graph.json").rigControlRootIds ?? null
  };
  writeFileSync(join(HERE, "snapshot-pre.json"), JSON.stringify(snap));
  console.log(`snapshot: pre state saved at revision ${snap.packageRevision}`);
};

// ---- verify ------------------------------------------------------------------
const verify = () => {
  const pre = JSON.parse(readFileSync(join(HERE, "snapshot-pre.json"), "utf8"));
  const post = {
    rigControls: readModel("rig-controls.json"),
    keyforms: readModel("keyforms.json"),
    meshesCanon: canon(readModel("meshes.json"))
  };
  let failures = 0;
  const check = (label, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
    if (!ok) failures += 1;
  };

  // 1. meshes untouched
  check("MESHES byte-identical", pre.meshesCanon === post.meshesCanon);

  // 2. keyformSets: every pre set unchanged, exactly one new set
  const preSets = new Map(pre.keyforms.keyformSets.map((s) => [s.keyformSetId, canon(s)]));
  const postSets = new Map(post.keyforms.keyformSets.map((s) => [s.keyformSetId, s]));
  let unchanged = 0;
  for (const [id, c] of preSets) {
    const p = postSets.get(id);
    if (p !== undefined && canon(p) === c) unchanged += 1;
    else check(`keyformSet ${id} unchanged`, false);
  }
  check(`KEYFORMS pre sets unchanged`, unchanged === preSets.size, `(${unchanged}/${preSets.size})`);
  const NAMED = pre.keyforms.keyformSets
    .map((s) => s.keyformSetId)
    .filter((id) => /headwear.*face_angle_x|topwear|tie/.test(id));
  for (const id of NAMED) {
    check(`  named human-corrected set ${id}`, canon(postSets.get(id)) === preSets.get(id));
  }
  const newSets = post.keyforms.keyformSets.filter((s) => !preSets.has(s.keyformSetId));
  check("KEYFORMS exactly one new set", newSets.length === 1, `(${newSets.length})`);
  if (newSets.length === 1) {
    const s = newSets[0];
    const expected = {
      target: { id: FACEZ_ID, kind: "rigControl", property: "angleDegrees" },
      parameterId: PARAM,
      keys: [
        { value: -30, statePatch: -ANGLE_MAX_DEG },
        { value: 0, statePatch: 0 },
        { value: 30, statePatch: ANGLE_MAX_DEG }
      ]
    };
    const gotKeys = [...s.keys].sort((a, b) => a.value - b.value)
      .map((k) => ({ value: k.value, statePatch: k.statePatch }));
    check("  new set target/parameter", canon(s.target) === canon(expected.target) && s.parameterId === PARAM);
    check("  new set keys -30/0/+30 -> -10/0/+10", canon(gotKeys) === canon(expected.keys),
      canon(gotKeys));
    check("  new set composition replace / linear-1d-v1",
      (s.compositionMode ?? "replace") === "replace" && s.interpolation === "linear-1d-v1");
  }

  // 3. rig controls
  const preRC = new Map(pre.rigControls.rigControls.map((r) => [r.rigControlId, r]));
  const postRC = new Map(post.rigControls.rigControls.map((r) => [r.rigControlId, r]));
  const stripParent = ({ parentId, ...rest }) => rest;
  let untouched = 0;
  for (const [id, r] of preRC) {
    const p = postRC.get(id);
    if (p === undefined) { check(`rigControl ${id} still exists`, false); continue; }
    if (WRAP_IDS.includes(id)) {
      const bodyUnchanged = canon(stripParent(r)) === canon(stripParent(p));
      const parentOk = p.parentId === FACEZ_ID && r.parentId === undefined;
      check(`  wrapped ${id}: canonical-minus-parentId identical + parentId=${FACEZ_ID}`,
        bodyUnchanged && parentOk, bodyUnchanged ? "" : "(body changed!)");
    } else if (canon(r) === canon(postRC.get(id))) {
      untouched += 1;
    } else {
      check(`rigControl ${id} byte-identical`, false);
    }
  }
  check(`RIGCONTROLS non-wrapped all byte-identical`,
    untouched === preRC.size - WRAP_IDS.length, `(${untouched}/${preRC.size - WRAP_IDS.length})`);

  // 4. the new rotation2d control
  const fz = postRC.get(FACEZ_ID);
  check("FACEZ control exists", fz !== undefined);
  if (fz !== undefined) {
    check("  kind rotation2d", fz.kind === "rotation2d");
    check("  pivot as designed", canon(fz.pivot) === canon(PIVOT), JSON.stringify(fz.pivot));
    check("  rest angle 0 / rest translation (0,0) / rest scale (1,1)",
      fz.restAngleDegrees === 0 &&
      canon(fz.restTranslation) === canon({ x: 0, y: 0 }) &&
      canon(fz.restScale) === canon({ x: 1, y: 1 }));
    check("  childRigControlIds = 14 towers in order",
      canon(fz.childRigControlIds) === canon(WRAP_IDS));
    check("  no child drawables / is root", (fz.childDrawableIds ?? []).length === 0 && fz.parentId === undefined);
  }
  const newRC = [...postRC.keys()].filter((id) => !preRC.has(id));
  check("RIGCONTROLS exactly one new control", newRC.length === 1 && newRC[0] === FACEZ_ID, newRC.join(","));

  // 5. graph roots
  const postRoots = readModel("graph.json").rigControlRootIds ?? null;
  if (pre.graphRootIds !== null && postRoots !== null) {
    const expectedRoots = new Set(pre.graphRootIds.filter((id) => !WRAP_IDS.includes(id)).concat(FACEZ_ID));
    check("GRAPH roots = pre roots minus 14 towers plus FaceZ",
      canon([...new Set(postRoots)].sort()) === canon([...expectedRoots].sort()));
  } else {
    console.log("INFO graph.rigControlRootIds not present in graph.json; root check via rig-controls parentIds only");
  }

  console.log(failures === 0 ? "VERIFY: ALL PASS" : `VERIFY: ${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
};

const mode = process.argv[2];
if (mode === "gen") gen();
else if (mode === "snapshot") snapshot();
else if (mode === "verify") verify();
else { console.log("usage: gen | snapshot | verify"); process.exit(1); }
