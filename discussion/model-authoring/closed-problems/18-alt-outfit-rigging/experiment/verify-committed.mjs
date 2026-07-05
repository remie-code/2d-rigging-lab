// cp18 verification battery (design-notes §4-2 committed tape-measure check
// and §4-4 no-harm check).
//
// 2a. committed keyformSets for the 8 new controls == design-values.json keys
// 2b. tape measure: inspectEvaluatedGeometry evaluatedControlPoints at own
//     keys == rest + designed offsets (BodyX poses, parents at identity) and
//     == R(pivot, theta) * (rest + offsets) for BodyZ poses. The rotation
//     convention is first PROVEN on the committed source tower
//     (rig_bodyz_topwear), then applied to the new warps.
// 4.  no-harm: every snapshot-pre record byte-identical, with the ONLY allowed
//     exceptions enumerated (upper_body child list append; 6 target meshes
//     filled). The collar human-correction set is guarded BY NAME.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const M = "C:/workspace/remie/rigging/llm-rigging/model";
const j = (f) => JSON.parse(readFileSync(join(M, f), "utf8"));

const D = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const pre = JSON.parse(readFileSync(join(HERE, "snapshot-pre.json"), "utf8"));

const keyformSets = j("keyforms.json").keyformSets;
const rigControls = j("rig-controls.json").rigControls;
const meshes = j("meshes.json").meshes;
const drawables = j("drawables.json").drawables;

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) failures += 1;
};

const NEW_RIG_IDS = D.design.map((d) => d.id);
const TARGET_DRAWABLES = [
  "draw_r0_1cea4f6f_a43f1585_topwear", "draw_r0_1cea4f6f_a43f1647_handwear-r", "draw_r0_1cea4f6f_a43f1666_handwear-l",
  "draw_r0_1cea4f6f_8b5c54ca_topwear", "draw_r0_1cea4f6f_8b5c542b_handwear-r", "draw_r0_1cea4f6f_8b5c5408_handwear-l"
];
const TARGET_MESH_IDS = TARGET_DRAWABLES.map((d) => d.replace(/^draw_/, "mesh_"));

// ---------- 2a. committed keyform sets == generated design ----------
console.log("== 2a. committed keyformSets vs generated design ==");
for (const d of D.design) {
  const set = keyformSets.find(
    (s) => s.target.kind === "rigControl" && s.target.id === d.id &&
      s.target.property === "controlPointOffsets" && s.parameterId === d.param
  );
  if (!set) { check(`keyset ${d.id}`, false, "missing"); continue; }
  const values = set.keys.map((k) => k.value).join(",");
  let exact = values === "-10,0,10";
  let maxErr = 0;
  for (const k of set.keys) {
    const want = d.keys[String(k.value)];
    if (!want || want.length !== k.statePatch.length) { exact = false; break; }
    for (let i = 0; i < want.length; i++) {
      maxErr = Math.max(maxErr, Math.abs(k.statePatch[i].x - want[i].x), Math.abs(k.statePatch[i].y - want[i].y));
    }
  }
  check(`keyset ${d.id} (${d.param})`, exact && maxErr === 0, `keys=[${values}] maxErr=${maxErr}`);
}

// ---------- tape measure helper ----------
const inspectRig = (overrides, label) => {
  const spec = {
    command: "inspectEvaluatedGeometry",
    payload: {
      targets: [...NEW_RIG_IDS, "rig_bodyz_topwear"].map((id) => ({ kind: "rigControl", rigControlId: id })),
      includeVertices: false,
      ...(overrides ? { parameterOverrides: overrides } : {})
    }
  };
  const p = join(HERE, "commands", `verify-geom-${label}.json`);
  writeFileSync(p, JSON.stringify(spec));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${p}"`, { stdio: "pipe", cwd: HERE });
  const r = JSON.parse(readFileSync(join(HERE, "commands", `verify-geom-${label}.response.json`), "utf8"));
  const payload = r.aiCommandResponse?.payload ?? r.payload;
  return Object.fromEntries(payload.results.map((x) => [x.rigControlId, x.evaluatedControlPoints]));
};

const rigById = (id) => rigControls.find((x) => x.rigControlId === id);
const restOf = (id) => rigById(id).restControlPoints;
const maxResidual = (got, want) => {
  let m = 0;
  for (let i = 0; i < want.length; i++)
    m = Math.max(m, Math.abs(got[i].x - want[i].x), Math.abs(got[i].y - want[i].y));
  return m;
};
const addOffsets = (rest, off) => rest.map((p, i) => ({ x: p.x + off[i].x, y: p.y + off[i].y }));

const PIVOT = { x: 997.25, y: 1124 };
const THETA_OF = { "-10": -6, "10": 6 }; // committed upper_body angleDegrees keys
const rotate = (pts, thetaDeg, sign) => {
  const t = (sign * thetaDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return pts.map((p) => {
    const dx = p.x - PIVOT.x, dy = p.y - PIVOT.y;
    return { x: PIVOT.x + c * dx - s * dy, y: PIVOT.y + s * dx + c * dy };
  });
};

// ---------- 2b-0. prove rotation convention on the committed SOURCE tower ----------
console.log("== 2b. tape measure (evaluatedControlPoints at own keys) ==");
const srcSetZ = keyformSets.find((s) => s.target.id === "rig_bodyz_topwear" && s.parameterId === "param_body_angle_z");
const srcRest = restOf("rig_bodyz_topwear");
const gotZ10 = inspectRig({ param_body_angle_z: 10 }, "bz10");
const srcWantLocal = addOffsets(srcRest, srcSetZ.keys.find((k) => k.value === 10).statePatch);
// three hypotheses for what evaluatedControlPoints reports under a rotating parent
const hyp = {
  local: maxResidual(gotZ10["rig_bodyz_topwear"], srcWantLocal),
  rotPlus: maxResidual(gotZ10["rig_bodyz_topwear"], rotate(srcWantLocal, THETA_OF["10"], +1)),
  rotMinus: maxResidual(gotZ10["rig_bodyz_topwear"], rotate(srcWantLocal, THETA_OF["10"], -1))
};
const MODEL = Object.entries(hyp).sort((a, b) => a[1] - b[1])[0][0];
const SIGN = MODEL === "rotMinus" ? -1 : +1;
const expectZ = (localPts, v) => (MODEL === "local" ? localPts : rotate(localPts, THETA_OF[String(v)], SIGN));
check("frame convention proven on source rig_bodyz_topwear @Z+10", hyp[MODEL] < 0.01,
  `model=${MODEL} residual=${hyp[MODEL].toExponential(3)} (local=${hyp.local.toFixed(3)} R+=${hyp.rotPlus.toFixed(3)} R-=${hyp.rotMinus.toFixed(3)})`);

// ---------- 2b-1. BodyX own keys (BodyZ=0 -> parents identity) ----------
for (const v of [-10, 10]) {
  const got = inspectRig({ param_body_angle_x: v }, `bx${v}`);
  for (const d of D.design.filter((x) => x.param === "param_body_angle_x")) {
    const want = addOffsets(restOf(d.id), d.keys[String(v)]);
    const res = maxResidual(got[d.id], want);
    check(`  ${d.id} @X${v > 0 ? "+" : ""}${v}`, res < 0.01, `maxResidual=${res.toExponential(3)}`);
  }
  // BodyZ warps must sit at rest in this pose
  for (const d of D.design.filter((x) => x.param === "param_body_angle_z")) {
    const res = maxResidual(got[d.id], restOf(d.id));
    check(`  ${d.id} @X${v > 0 ? "+" : ""}${v} (rest)`, res < 0.01, `maxResidual=${res.toExponential(3)}`);
  }
}

// ---------- 2b-2. BodyZ own keys (rotation composed) ----------
for (const v of [-10, 10]) {
  const got = v === 10 ? gotZ10 : inspectRig({ param_body_angle_z: v }, `bz${v}`);
  for (const d of D.design.filter((x) => x.param === "param_body_angle_z")) {
    const local = addOffsets(restOf(d.id), d.keys[String(v)]);
    const res = maxResidual(got[d.id], expectZ(local, v));
    check(`  ${d.id} @Z${v > 0 ? "+" : ""}${v}`, res < 0.01, `maxResidual=${res.toExponential(3)}`);
  }
}

// ---------- 4. no-harm ----------
console.log("== 4. no-harm (byte-identity vs snapshot-pre) ==");

// keyformSets: every pre set byte-identical; exactly 8 new
{
  const byId = Object.fromEntries(keyformSets.map((s) => [s.keyformSetId, JSON.stringify(s)]));
  let bad = 0;
  for (const [id, json] of Object.entries(pre.keyformSets)) {
    if (byId[id] !== json) { bad++; console.log(`  CHANGED keyformSet: ${id}`); }
  }
  const added = Object.keys(byId).filter((id) => !(id in pre.keyformSets));
  check("all 99 pre keyformSets byte-identical", bad === 0, `changed=${bad}`);
  check("exactly 8 new keyformSets, all cp18 targets", added.length === 8 &&
    added.every((id) => NEW_RIG_IDS.some((rid) => id.includes(rid))), added.join(","));
  // named guard: collar human-correction set
  const collarId = "keyset_rigcontrol_rig_bodyx_topwear_controlpointoffsets_body_angle_x";
  check(`NAMED GUARD ${collarId}`, byId[collarId] === pre.keyformSets[collarId]);
}

// rigControls: pre controls byte-identical except upper_body child-list append
{
  const byId = Object.fromEntries(rigControls.map((r) => [r.rigControlId, JSON.stringify(r)]));
  let bad = 0;
  for (const [id, json] of Object.entries(pre.rigControls)) {
    if (byId[id] === json) continue;
    if (id === "rig_bodyz_upper_body") {
      const before = JSON.parse(json), after = JSON.parse(byId[id]);
      const expectedKids = [...before.childRigControlIds,
        "rig_bodyz_topwear_rodos", "rig_bodyx_arm_r_rodos", "rig_bodyx_arm_l_rodos",
        "rig_bodyz_topwear_endo", "rig_bodyx_arm_r_endo", "rig_bodyx_arm_l_endo"];
      const patched = { ...before, childRigControlIds: expectedKids };
      // compare with key order normalized
      const norm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort()));
      if (norm(patched) === norm(after)) {
        console.log("  rig_bodyz_upper_body: only childRigControlIds appended (expected)");
        continue;
      }
    }
    bad++; console.log(`  CHANGED rigControl: ${id}`);
  }
  const added = Object.keys(byId).filter((id) => !(id in pre.rigControls));
  check("pre rigControls intact (upper_body append-only exception)", bad === 0, `changed=${bad}`);
  check("exactly 8 new rigControls", added.length === 8 && added.every((id) => NEW_RIG_IDS.includes(id)), added.join(","));
}

// meshes: pre meshes byte-identical except the 6 targets (empty -> generated)
{
  const byId = Object.fromEntries(meshes.map((m) => [m.meshId, JSON.stringify(m)]));
  let bad = 0;
  for (const [id, json] of Object.entries(pre.meshes)) {
    if (byId[id] === json) continue;
    if (TARGET_MESH_IDS.includes(id)) {
      const before = JSON.parse(json);
      if (before.vertices.length === 0 && JSON.parse(byId[id]).vertices.length > 0) continue; // empty -> filled
    }
    bad++; console.log(`  CHANGED mesh: ${id}`);
  }
  check("pre meshes intact (6 targets empty->generated only)", bad === 0, `changed=${bad}`);
  for (const id of TARGET_MESH_IDS)
    check(`  target meshed: ${id}`, JSON.parse(byId[id]).vertices.length > 0);
}

// drawables: all byte-identical (visibility untouched outside sweep round-trip)
{
  const byId = Object.fromEntries(drawables.map((d) => [d.drawableId, JSON.stringify(d)]));
  let bad = 0;
  for (const [id, json] of Object.entries(pre.drawables)) if (byId[id] !== json) { bad++; console.log(`  CHANGED drawable: ${id}`); }
  check("all 132 drawables byte-identical", bad === 0, `changed=${bad}`);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
