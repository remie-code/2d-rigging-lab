import { describe, expect, it } from "vitest";
import { MaterialIntentSchema } from "./material-intent.js";

const replace = { kind: "replace", drawableId: "draw_fixture", preserveLogicalDrawableId: true,
  geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds: [] },
  preserveExistingDeformers: true, sharedControlPolicy: "reject-shared-control-key-parameter-deletion" };

describe("material intent", () => {
  it("requires explicit replacement reset scope and shared deletion safety", () => {
    expect(MaterialIntentSchema.safeParse(replace).success).toBe(true);
    expect(MaterialIntentSchema.safeParse({ ...replace, preserveLogicalDrawableId: false }).success).toBe(false);
    expect(MaterialIntentSchema.safeParse({ ...replace, geometryReset: { scope: "all", keyformSetIds: [] } }).success).toBe(false);
    expect(MaterialIntentSchema.safeParse({ ...replace, preserveExistingDeformers: false }).success).toBe(false);
    expect(MaterialIntentSchema.safeParse({ ...replace, sharedControlPolicy: "delete" }).success).toBe(false);
  });

  it("requires Part, structural order, motion membership, masks and visibility for add", () => {
    const add = { kind: "add", drawableId: "draw_new", displayName: "New",
      parentPartId: "part_body", insertion: { position: "after", sibling: { kind: "part", partId: "part_head" } },
      rigControlIds: [], maskBindings: [{ maskRelationId: "maskrel_fixture", role: "target" }], runtimeVisibility: true, defaultOpacity: 1 };
    expect(MaterialIntentSchema.safeParse(add).success).toBe(true);
    expect(MaterialIntentSchema.safeParse({ ...add, maskBindings: [{ maskRelationId: "maskrel_fixture" }] }).success).toBe(false);
    for (const key of ["parentPartId", "insertion", "rigControlIds", "maskBindings", "runtimeVisibility"]) {
      const missing: Record<string, unknown> = { ...add }; delete missing[key];
      expect(MaterialIntentSchema.safeParse(missing).success).toBe(false);
    }
  });
});
