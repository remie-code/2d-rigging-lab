import { describe, expect, it } from "vitest";

import { MeshDtoSchema } from "./index.js";

const legacyMesh = {
  meshId: "mesh_body",
  drawableId: "draw_body",
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 }
  ],
  uvs: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
  ],
  triangles: [[0, 1, 2]],
  vertexStableIds: ["v0", "v1", "v2"],
  bounds: { x: 0, y: 0, width: 10, height: 10 },
  generationProvenanceId: "prov_mesh_body"
} as const;

describe("package mesh topology contract", () => {
  it("keeps legacy meshes parseable when topology revision evidence is absent", () => {
    const parsed = MeshDtoSchema.parse(legacyMesh);

    expect(parsed.topologyRevision).toBeUndefined();
    expect(parsed.triangleStableIds).toBeUndefined();
    expect(parsed.vertexStableIds).toEqual(["v0", "v1", "v2"]);
  });

  it("parses optional topology revision and stable triangle identity evidence", () => {
    const parsed = MeshDtoSchema.parse({
      ...legacyMesh,
      vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"],
      triangleStableIds: ["tri_body_0"],
      topologyRevision: 4
    });

    expect(parsed.triangleStableIds).toEqual(["tri_body_0"]);
    expect(parsed.topologyRevision).toBe(4);
  });

  it("rejects invalid triangle IDs and revision values without checking renderer correctness", () => {
    expect(MeshDtoSchema.safeParse({
      ...legacyMesh,
      vertexStableIds: ["v 0", "v1", "v2"]
    }).success).toBe(false);
    expect(MeshDtoSchema.safeParse({
      ...legacyMesh,
      triangleStableIds: ["triangle_body_0"]
    }).success).toBe(false);
    expect(MeshDtoSchema.safeParse({
      ...legacyMesh,
      topologyRevision: -1
    }).success).toBe(false);
  });
});
