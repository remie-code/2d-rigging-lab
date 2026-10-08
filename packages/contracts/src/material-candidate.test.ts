import { describe, expect, it } from "vitest";
import { MaterialCandidateSchema, MaterialCandidateActionSchema } from "./material-candidate.js";
import { MaterialIntentSchema } from "./material-intent.js";
import { createMaterialCandidateFixture } from "./material-contract-fixtures.js";

describe("material intent and candidate lifecycle", () => {
  it("requires explicit replacement reset scope and shared deletion safety", () => {
    const c = createMaterialCandidateFixture();
    expect(MaterialIntentSchema.safeParse({ ...c.intent, preserveLogicalDrawableId: false }).success).toBe(false);
    expect(MaterialIntentSchema.safeParse({ ...c.intent, geometryReset: { scope: "all", keyformSetIds: [] } }).success).toBe(false);
    expect(MaterialIntentSchema.safeParse({ ...c.intent, preserveExistingDeformers: false }).success).toBe(false);
    expect(MaterialIntentSchema.safeParse({ ...c.intent, sharedControlPolicy: "delete" }).success).toBe(false);
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
  it("binds approval to exact working package and candidate revision", () => {
    const c = createMaterialCandidateFixture();
    const workingPackage = { ...c.basePackage, packageRevision: 2, contentFingerprint: "b".repeat(64) };
    const approval = { candidateRevision: 0, workingPackage, approvedBy: "root", approvedAt: "2026-09-26T00:00:00Z" };
    const approved = { ...c, state: "approved", workingPackage, approval };
    expect(MaterialCandidateSchema.safeParse(approved).success).toBe(true);
    expect(MaterialCandidateSchema.safeParse({ ...approved, candidateRevision: 1 }).success).toBe(false);
    expect(MaterialCandidateSchema.safeParse({ ...approved, workingPackage: { ...workingPackage, contentFingerprint: "c".repeat(64) } }).success).toBe(false);
    expect(MaterialCandidateSchema.safeParse({ ...approved, state: "working" }).success).toBe(false);
    expect(MaterialCandidateSchema.safeParse({ ...c, state: "working" }).success).toBe(false);
  });
  it("rejects unapproved apply, changed base content, stale candidate revisions and terminal edits", () => {
    const c = createMaterialCandidateFixture();
    const input = { candidate: c, action: "apply", expectedCandidateRevision: 0, observedBasePackage: c.basePackage };
    expect(MaterialCandidateActionSchema.safeParse(input).success).toBe(false);
    expect(MaterialCandidateActionSchema.safeParse({ ...input, action: "build" }).success).toBe(true);
    expect(MaterialCandidateActionSchema.safeParse({ ...input, action: "build", observedBasePackage: { ...c.basePackage, contentFingerprint: "b".repeat(64) } }).success).toBe(false);
    expect(MaterialCandidateActionSchema.safeParse({ ...input, action: "build", expectedCandidateRevision: 1 }).success).toBe(false);
    expect(MaterialCandidateActionSchema.safeParse({ ...input, action: "discard" }).success).toBe(true);
    expect(MaterialCandidateActionSchema.safeParse({ ...input, action: "discard", candidate: { ...c, state: "discarded" } }).success).toBe(false);
    expect(MaterialCandidateSchema.safeParse({ ...c, state: "stale", observedBasePackage: c.basePackage }).success).toBe(false);
    const stale = { ...c, state: "stale", observedBasePackage: { ...c.basePackage, packageRevision: 2 } };
    expect(MaterialCandidateActionSchema.safeParse({ ...input, candidate: stale, action: "discard" }).success).toBe(true);
  });
});


