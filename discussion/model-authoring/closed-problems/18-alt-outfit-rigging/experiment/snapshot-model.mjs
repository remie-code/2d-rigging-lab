// cp18 model snapshot for the no-harm (無傷) verification.
// Usage: node snapshot-model.mjs <out.json>
// Records, keyed by id, the exact JSON serialization of every keyformSet,
// rigControl, mesh, and drawable, plus per-file sha256 of model/*.json.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";

const M = "C:/workspace/remie/rigging/llm-rigging/model";
const j = (f) => JSON.parse(readFileSync(join(M, f), "utf8"));

const fileShas = {};
for (const f of readdirSync(M)) {
  fileShas[f] = createHash("sha256").update(readFileSync(join(M, f))).digest("hex");
}

const byId = (arr, idKey) => Object.fromEntries(arr.map((x) => [x[idKey], JSON.stringify(x)]));

const snapshot = {
  packageRevision: JSON.parse(readFileSync("C:/workspace/remie/rigging/llm-rigging/manifest.json", "utf8")).packageRevision,
  fileShas,
  keyformSets: byId(j("keyforms.json").keyformSets, "keyformSetId"),
  rigControls: byId(j("rig-controls.json").rigControls, "rigControlId"),
  meshes: byId(j("meshes.json").meshes, "meshId"),
  drawables: byId(j("drawables.json").drawables, "drawableId")
};
writeFileSync(resolve(process.argv[2]), JSON.stringify(snapshot));
console.log(`snapshot: rev=${snapshot.packageRevision} keyformSets=${Object.keys(snapshot.keyformSets).length} rigControls=${Object.keys(snapshot.rigControls).length} meshes=${Object.keys(snapshot.meshes).length} drawables=${Object.keys(snapshot.drawables).length}`);
