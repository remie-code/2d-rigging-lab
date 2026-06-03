import { describe, expect, it } from "vitest";

import {
  MeshTopologyRevisionDtoSchema,
  MeshTriangleIndicesDtoSchema,
  MeshTriangleStableIdSetDtoSchema,
  MeshTriangleVertexIdsDtoSchema,
  MeshVertexStableIdDtoSchema,
  TargetKindSchema
} from "./index.js";

describe("mesh topology contract DTOs", () => {
  it("parses topology revision, triangle indices, and stable triangle IDs", () => {
    expect(MeshTopologyRevisionDtoSchema.parse(3)).toBe(3);
    expect(MeshTriangleIndicesDtoSchema.parse([0, 1, 2])).toEqual([0, 1, 2]);
    expect(MeshTriangleVertexIdsDtoSchema.parse([
      "vtx_body_0",
      "vtx_body_1",
      "vtx_body_2"
    ])).toEqual([
      "vtx_body_0",
      "vtx_body_1",
      "vtx_body_2"
    ]);
    expect(MeshTriangleStableIdSetDtoSchema.parse(["tri_body_0"])).toEqual(["tri_body_0"]);
    expect(MeshVertexStableIdDtoSchema.parse("v0")).toBe("v0");
  });

  it("rejects unsafe topology IDs and invalid revision values", () => {
    expect(MeshTopologyRevisionDtoSchema.safeParse(-1).success).toBe(false);
    expect(MeshVertexStableIdDtoSchema.safeParse("v 0").success).toBe(false);
    expect(MeshTriangleStableIdSetDtoSchema.safeParse(["triangle_body_0"]).success).toBe(false);
    expect(MeshTriangleVertexIdsDtoSchema.safeParse([
      "vtx_body_0",
      "vertex_body_1",
      "vtx_body_2"
    ]).success).toBe(false);
  });

  it("includes triangle as a machine-readable target kind", () => {
    expect(TargetKindSchema.parse("triangle")).toBe("triangle");
    expect(TargetKindSchema.safeParse("tri angle").success).toBe(false);
  });
});
