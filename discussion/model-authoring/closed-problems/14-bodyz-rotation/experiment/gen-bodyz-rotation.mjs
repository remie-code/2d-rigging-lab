// cp14 BodyZ rotation core generator. First NESTED rotation2d (BodyZ wraps the
// FaceZ rotation2d rig_facez_head as a child).
//
// Modes:
//   node gen-bodyz-rotation.mjs gen      -> writes batch-bodyz.json (2 ops) + design-values.json
//   node gen-bodyz-rotation.mjs snapshot -> writes snapshot-pre.json from the live package
//   node gen-bodyz-rotation.mjs verify   -> compares live package against snapshot-pre.json:
//        - all pre-existing keyformSets byte-identical (named check incl. human-corrected sets)
//        - exactly one new keyformSet with the expected shape (angleDegrees three-point key)
//        - rig controls: only the 10 wrapped tower roots change, and only in parentId
//          (canonical-minus-parentId equality + parentId expected-value check; cp11/cp12 type)
//        - new rotation2d control matches the designed payload incl. the wrapped back_hair
//          drawable as its single childDrawableId
//        - meshes byte-identical; graph roots = 10 tower ids replaced by the BodyZ id
//
// All numbers derive from the rest measurement in commands/measure-waist*.response.json
// (rev 397):
//   bottomwear (skirt) top edge at x 914..1097: y = 1124 flat  -> waist in-line
//   topwear bbox x 782..1216 (center 999); neck bbox x 944..1047 (center 995.5)
// Pivot = ( (999 + 995.5)/2 , skirt in-line ) = (997.25, 1124)
//   x: torso midline as the mean of shirt-torso center and neck center (tie center
//      992.5 within 5px); y: the measured skirt tuck line (the "スカートのイン線").
// Angle +-6 deg: body lean is shallower than the +-10 deg head tilt (cp12);
// restrained start in the 5-7 deg band, user-gate dial.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = "C:/workspace/remie/rigging/llm-rigging";

// ---- design constants (single source) --------------------------------------
const BODYZ_ID = "rig_bodyz_upper_body";
const DISPLAY_NAME = "BodyZ Upper Body";
const PIVOT = { x: 997.25, y: 1124 };    // waist: torso midline x, skirt in-line y (measured, rev 397)
const ANGLE_MAX_DEG = 6;                 // restrained start; user-gate dial
const PARAM = "param_body_angle_z";      // preset: -10..10, max = clockwise body roll
const PARAM_MIN = -10;
const PARAM_MAX = 10;
// y-down canvas: positive angleDegrees = clockwise on screen -> matches preset
// sign convention (max = clockwise body roll) directly, same as cp12.

// Runtime finding (rev 403): the back_hair shadow drawable's mesh record exists
// but is an EMPTY placeholder (0 vertices) -> the wrap binds it, yet the rotation
// has no vertices to transform (inspectEvaluatedGeometry returns n=0 and bounds
// {0,0,0,0} once deformed). Op 3 gives it a real mesh (recipe 01 method, low
// density: it is a rigid rider, no internal deformation).
const BACK_HAIR_MESH_ID = "mesh_r0_1cea4f6f_f2691773_back_hair";

// The 10 tower roots to wrap (stack order BodyZ > FaceZ > BodyX, matching the
// user's own tower build). rig_facez_head is a rotation2d -> the nesting first.
const WRAP_RC_IDS = [
  "rig_facez_head",         // FaceZ rotation2d (head rigid group; rotation2d-in-rotation2d)
  "rig_facez_hair_f_l",     // side tuft L FaceZ gravity warp tower
  "rig_facez_hair_f_r",     // side tuft R FaceZ gravity warp tower
  "rig_facez_back_hair_l",  // back hair curtain L FaceZ gravity warp tower
  "rig_facez_back_hair_r",  // back hair curtain R FaceZ gravity warp tower
  "rig_bodyx_topwear",      // shirt torso
  "rig_bodyx_arm_r",
  "rig_bodyx_arm_l",
  "rig_bodyx_tie",
  "rig_bodyx_neck"          // neck (+ neck_back child warp)
];
// back_hair shadow drawable (back_hair Parts Container, meshed, bound to no rig
// control = free root drawable) -> wrapped directly as a drawable child.
const WRAP_DRAWABLE_ID = "draw_r0_1cea4f6f_f2691773_back_hair";

const WRAP_CHILDREN = [
  ...WRAP_RC_IDS.map((id) => ({ kind: "rigControl", id })),
  { kind: "drawable", id: WRAP_DRAWABLE_ID }
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
      file: "op-bodyz-create.json",
      operationId: "op_cp14_bodyz_create",
      operationType: "createRotation2dRigControl",
      gitMessage: "[cp14] create BodyZ rotation2d control (pivot=waist, wrap 10 tower roots incl. nested FaceZ rotation2d + back_hair shadow drawable)",
      payload: {
        displayName: DISPLAY_NAME,
        pivot: PIVOT,
        restAngleDegrees: 0,
        wrapChildren: WRAP_CHILDREN
      }
    },
    {
      file: "op-bodyz-key.json",
      operationId: "op_cp14_bodyz_key",
      operationType: "editKeyformKey",
      gitMessage: "[cp14] BodyZ angleDegrees three-point key (-6/0/+6 deg, translation untouched)",
      payload: {
        action: "createEndsCenter",
        target: { kind: "rigControl", id: BODYZ_ID },
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
  writeFileSync(join(HERE, "batch-bodyz.json"), JSON.stringify(batch, null, 2));
  const meshBatch = [
    {
      file: "op-backhair-mesh.json",
      operationId: "op_cp14_backhair_mesh",
      operationType: "generateMesh",
      gitMessage: "[cp14] generate mesh for back_hair shadow drawable (was an empty placeholder; rigid rider under BodyZ, density low)",
      payload: {
        drawableId: WRAP_DRAWABLE_ID,
        method: "auto-outline-v6d-adaptive-contour-constrainautor",
        densityHint: "low"
      }
    }
  ];
  writeFileSync(join(HERE, "batch-mesh.json"), JSON.stringify(meshBatch, null, 2));
  writeFileSync(
    join(HERE, "design-values.json"),
    JSON.stringify(
      { BODYZ_ID, PIVOT, ANGLE_MAX_DEG, PARAM, PARAM_MIN, PARAM_MAX, WRAP_RC_IDS, WRAP_DRAWABLE_ID },
      null, 2
    )
  );
  console.log(`gen: batch-bodyz.json written (${batch.length} ops)`);
};

// ---- snapshot ----------------------------------------------------------------
const snapshot = () => {
  const snap = {
    packageRevision: JSON.parse(readFileSync(join(PKG, "manifest.json"), "utf8")).packageRevision,
    rigControls: readModel("rig-controls.json"),
    keyforms: readModel("keyforms.json"),
    meshesCanon: canon(readModel("meshes.json")),
    drawablesCanon: canon(readModel("drawables.json")),
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
    meshesCanon: canon(readModel("meshes.json")),
    drawablesCanon: canon(readModel("drawables.json"))
  };
  let failures = 0;
  const check = (label, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? " " + detail : ""}`);
    if (!ok) failures += 1;
  };

  // 1. meshes + drawables untouched — except the back_hair mesh, which op 3
  // fills from its empty placeholder (the only permitted mesh change).
  const preMeshes = JSON.parse(pre.meshesCanon).meshes;
  const postMeshesFile = readModel("meshes.json");
  const postMeshes = sortKeys(postMeshesFile).meshes;
  const preMeshById = new Map(preMeshes.map((m) => [m.meshId, JSON.stringify(m)]));
  let meshUnchanged = 0;
  let backHairMeshOk = false;
  for (const m of postMeshes) {
    if (m.meshId === BACK_HAIR_MESH_ID) {
      const preEmpty = JSON.parse(preMeshById.get(m.meshId)).vertices.length === 0;
      backHairMeshOk = preEmpty && m.vertices.length > 0 && m.triangles.length > 0;
      continue;
    }
    if (preMeshById.get(m.meshId) === JSON.stringify(m)) meshUnchanged += 1;
    else check(`mesh ${m.meshId} byte-identical`, false);
  }
  check("MESHES all byte-identical except back_hair", meshUnchanged === preMeshes.length - 1,
    `(${meshUnchanged}/${preMeshes.length - 1})`);
  check("MESH back_hair: empty placeholder -> real mesh", backHairMeshOk);
  check("DRAWABLES byte-identical", pre.drawablesCanon === post.drawablesCanon);

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
    .filter((id) => /headwear.*face_angle_x|topwear|tie|facez/.test(id));
  for (const id of NAMED) {
    check(`  named set ${id}`, canon(postSets.get(id)) === preSets.get(id));
  }
  const newSets = post.keyforms.keyformSets.filter((s) => !preSets.has(s.keyformSetId));
  check("KEYFORMS exactly one new set", newSets.length === 1, `(${newSets.length})`);
  if (newSets.length === 1) {
    const s = newSets[0];
    const expected = {
      target: { id: BODYZ_ID, kind: "rigControl", property: "angleDegrees" },
      parameterId: PARAM,
      keys: [
        { value: PARAM_MIN, statePatch: -ANGLE_MAX_DEG },
        { value: 0, statePatch: 0 },
        { value: PARAM_MAX, statePatch: ANGLE_MAX_DEG }
      ]
    };
    const gotKeys = [...s.keys].sort((a, b) => a.value - b.value)
      .map((k) => ({ value: k.value, statePatch: k.statePatch }));
    check("  new set target/parameter", canon(s.target) === canon(expected.target) && s.parameterId === PARAM);
    check(`  new set keys ${PARAM_MIN}/0/${PARAM_MAX} -> -${ANGLE_MAX_DEG}/0/+${ANGLE_MAX_DEG}`,
      canon(gotKeys) === canon(expected.keys), canon(gotKeys));
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
    if (WRAP_RC_IDS.includes(id)) {
      const bodyUnchanged = canon(stripParent(r)) === canon(stripParent(p));
      const parentOk = p.parentId === BODYZ_ID && r.parentId === undefined;
      check(`  wrapped ${id}: canonical-minus-parentId identical + parentId=${BODYZ_ID}`,
        bodyUnchanged && parentOk, bodyUnchanged ? "" : "(body changed!)");
    } else if (canon(r) === canon(postRC.get(id))) {
      untouched += 1;
    } else {
      check(`rigControl ${id} byte-identical`, false);
    }
  }
  check(`RIGCONTROLS non-wrapped all byte-identical`,
    untouched === preRC.size - WRAP_RC_IDS.length, `(${untouched}/${preRC.size - WRAP_RC_IDS.length})`);

  // 4. the new rotation2d control
  const bz = postRC.get(BODYZ_ID);
  check("BODYZ control exists", bz !== undefined);
  if (bz !== undefined) {
    check("  kind rotation2d", bz.kind === "rotation2d");
    check("  pivot as designed", canon(bz.pivot) === canon(PIVOT), JSON.stringify(bz.pivot));
    check("  rest angle 0 / rest translation (0,0) / rest scale (1,1)",
      bz.restAngleDegrees === 0 &&
      canon(bz.restTranslation) === canon({ x: 0, y: 0 }) &&
      canon(bz.restScale) === canon({ x: 1, y: 1 }));
    check("  childRigControlIds = 10 towers in order",
      canon(bz.childRigControlIds) === canon(WRAP_RC_IDS));
    check("  childDrawableIds = [back_hair shadow]",
      canon(bz.childDrawableIds) === canon([WRAP_DRAWABLE_ID]));
    check("  is root", bz.parentId === undefined);
  }
  const newRC = [...postRC.keys()].filter((id) => !preRC.has(id));
  check("RIGCONTROLS exactly one new control", newRC.length === 1 && newRC[0] === BODYZ_ID, newRC.join(","));

  // 5. graph roots
  const postRoots = readModel("graph.json").rigControlRootIds ?? null;
  if (pre.graphRootIds !== null && postRoots !== null) {
    const expectedRoots = new Set(pre.graphRootIds.filter((id) => !WRAP_RC_IDS.includes(id)).concat(BODYZ_ID));
    check("GRAPH roots = pre roots minus 10 towers plus BodyZ",
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
