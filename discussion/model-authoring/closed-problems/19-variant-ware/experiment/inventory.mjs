// cp19 inventory: ware / bottoms / tie / alt-outfit parts — actual drawable ids,
// runtimeVisibility, and mesh vertex counts (empty mesh = never rendered).
import { readFileSync } from "node:fs";
const M = "C:/workspace/remie/rigging/llm-rigging/model";
const j = (f) => JSON.parse(readFileSync(`${M}/${f}`, "utf8"));
const g = j("graph.json"), d = j("drawables.json"), m = j("meshes.json");
const dmap = new Map(d.drawables.map((x) => [x.drawableId, x]));
const mmap = new Map(m.meshes.map((x) => [x.drawableId ?? x.meshId, x]));
for (const p of g.parts) {
  if (!/ware|bottom|tie|rodos|endo/i.test(`${p.partId} ${p.displayName}`)) continue;
  console.log(`PART ${p.partId} | ${p.displayName}`);
  for (const id of p.drawableIds) {
    const dr = dmap.get(id), me = mmap.get(id);
    const v = me ? (me.vertices?.length ?? (me.vertexPositions ? me.vertexPositions.length / 2 : "?")) : "NOMESH";
    console.log(`  ${id} | ${dr?.displayName} | vis=${dr?.runtimeVisibility} | verts=${v}`);
  }
}
