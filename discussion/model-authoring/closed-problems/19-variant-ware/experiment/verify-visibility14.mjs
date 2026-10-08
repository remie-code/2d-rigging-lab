// cp19b verification 3: cp19 verify-visibility.mjs extended to 14 targets
// (13 cp19 targets + endomi_back, now a vgrp_ware target owned by var_endoministrator).
// 4 runs (Default / Rodos / Endoministrator / implicit defaultActive) x 14 targets.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const D = JSON.parse(readFileSync(join(HERE, "design-values.json"), "utf8"));
const A = JSON.parse(readFileSync(join(HERE, "design-values-addendum.json"), "utf8"));

// merged membership: cp19 table + addendum (endomi_back -> var_endoministrator)
const membership = structuredClone(D.membership);
for (const [variantId, ids] of Object.entries(A.membershipAddendum)) {
  membership[variantId] = [...membership[variantId], ...ids];
}
const allTargets = Object.values(membership).flat();

const runs = [
  ["default14", { kind: "singleSelect", variantGroupId: D.variantGroupId, variantId: "var_default" }],
  ["rodos14", { kind: "singleSelect", variantGroupId: D.variantGroupId, variantId: "var_rodos" }],
  ["endoministrator14", { kind: "singleSelect", variantGroupId: D.variantGroupId, variantId: "var_endoministrator" }],
  ["implicit-defaultactive14", undefined]
];

let failures = 0;
for (const [tag, selection] of runs) {
  const req = join(HERE, "commands", `inspect-${tag}.json`);
  writeFileSync(req, JSON.stringify({
    command: "inspectEvaluatedGeometry",
    payload: {
      targets: allTargets.map((drawableId) => ({ kind: "drawable", drawableId })),
      ...(selection ? { variantSelections: [selection] } : {})
    }
  }));
  execSync(`node "${join(HERE, "read-cmd.mjs")}" "${req}"`, { cwd: HERE, stdio: "pipe" });
  const resp = JSON.parse(readFileSync(`${req.replace(/\.json$/, "")}.response.json`, "utf8"));
  const payload = resp.aiCommandResponse?.payload ?? resp.payload ?? resp.result ?? resp;
  const expectedVariant = selection ? selection.variantId : "var_default";
  const expectedVisible = new Set(membership[expectedVariant]);
  console.log(`== ${tag}: resolved variantSelections = ${JSON.stringify(payload.variantSelections)}`);
  const echoOk = JSON.stringify(payload.variantSelections) ===
    JSON.stringify([{ kind: "singleSelect", variantGroupId: D.variantGroupId, variantId: expectedVariant }]);
  if (!echoOk) { console.log(`   FAIL: resolved echo mismatch (expected ${expectedVariant})`); failures++; }
  for (const r of payload.results) {
    const want = expectedVisible.has(r.drawableId);
    const ok = r.found === true && r.visible === want;
    if (!ok) {
      failures++;
      console.log(`   FAIL ${r.drawableId}: found=${r.found} visible=${r.visible} expected=${want}`);
    }
  }
  console.log(`   ${payload.results.length} targets checked, expected-visible=${expectedVisible.size}`);
}
console.log(failures === 0 ? "VISIBLE-SET ASSERT: PASS (4 runs x 14 targets)" : `VISIBLE-SET ASSERT: FAIL x${failures}`);
process.exit(failures === 0 ? 0 : 1);
