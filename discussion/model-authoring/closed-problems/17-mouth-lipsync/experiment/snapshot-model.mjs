// cp17: per-entry hash snapshot of the rigging model files, used for the
// "existing keys / rig-controls / other drawables byte-intact" verification.
// Usage: node snapshot-model.mjs <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const PKG = "C:/workspace/remie/rigging/llm-rigging";
const sha = (s) => createHash("sha256").update(s).digest("hex");

const out = { files: {}, entries: {} };
const FILES = [
  "model/drawables.json", "model/rig-controls.json", "model/keyforms.json",
  "model/meshes.json", "model/parameters.json", "model/draw-order.json",
  "model/masks.json", "model/graph.json", "model/dynamics.json",
  "model/variants.json", "model/editor-state.json"
];
for (const f of FILES) {
  const txt = readFileSync(join(PKG, f), "utf8");
  out.files[f] = sha(txt);
  const j = JSON.parse(txt);
  const arr = Object.values(j).find(Array.isArray);
  if (!Array.isArray(arr)) continue;
  const idOf = (x, i) =>
    x.drawableId ?? x.rigControlId ?? x.keyformSetId ?? x.bindingId ?? x.meshId ??
    x.parameterId ?? x.maskRelationId ?? x.partId ?? x.dynamicsGroupId ?? x.variantId ??
    (x.target ? `${x.target.kind}:${x.target.id}:${x.targetProperty}:${x.parameterId ?? ""}` : `idx${i}`);
  out.entries[f] = {};
  arr.forEach((x, i) => { out.entries[f][idOf(x, i)] = sha(JSON.stringify(x)); });
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log("snapshot written:", process.argv[2], "files:", Object.keys(out.files).length);
