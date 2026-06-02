# Wave 30 Domain B Review Note: Runtime / Viewer Tutorial Evidence Summary

## Verdict

pass after R1

## Reviewer

Review-Sylph, clean read-only contexts. The reviewer was separate from the Gnome implementation context and did not edit files.

## Scope Reviewed

- `packages/runtime-core/src/tutorial-evidence-summary-schema.ts`
- `packages/runtime-core/src/tutorial-evidence-summary.ts`
- `packages/runtime-core/src/tutorial-evidence-summary.test.ts`
- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/index.ts`
- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/preview-projection.test.ts`

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave30-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Initial Review Findings

Initial verdict: `needs_changes`.

1. `meshEdits` readiness could disagree with the actual `meshEdits` evidence section. Bounds/hash-only mesh edit evidence could set `summary.meshEdits.present === true` while `semanticReadiness.missingSlices` still included `meshEdits`.
2. `maskRelationId` in the tutorial summary schema used raw `z.string()` instead of the established `MaskRelationIdSchema`.

## R1 Resolution

R1 re-review verdict: `pass`.

- `meshEdits` readiness now aligns with actual `meshEdits` refs. Hash/bounds-only edits produce deterministic fallback refs such as `meshEdit:${meshId}` when `movedVertexRefs` is empty.
- `maskRelationId` now uses `MaskRelationIdSchema`.
- Focused tests cover hash/bounds-only mesh edit readiness and invalid mask relation IDs.

No new findings were reported in R1.

## Design Compliance

- Runtime / Viewer / Preview summary reports requested semantic slices deterministically through sorted refs and slice status construction.
- Semantic readiness is separated from rendered correctness.
- Rendered correctness is explicitly bounded as `not_evaluated` with `fullRenderer=false`, `pixelOracle=false`, and `textureSamplingCorrectness=false`.
- Viewer evidence is wired through runtime viewer evidence, and editor Preview projection carries the optional tutorial evidence summary.
- No operation handler implementation, validator broad implementation, editor UI implementation, renderer/pixel oracle, image decode, texture sampling correctness, dependency, manifest, or lockfile change was introduced.
- `packages/runtime-core/src/index.ts` remains barrel-only.

## Test Adequacy

Adequate for Domain B risk.

Coverage includes a complete positive tutorial summary, incomplete semantic readiness propagation through Preview projection, viewer/runtime compatibility, preview-viewer equivalence fixture compatibility, hash/bounds-only mesh edit evidence, and mask relation ID schema rejection.

## Verification Reviewed

- `pnpm.cmd exec vitest run packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-preview/preview-projection.test.ts` -> pass, 15 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` -> pass, 1 test.
- `pnpm.cmd run check:source` -> pass.
- `pnpm.cmd typecheck` -> pass.
- `git diff --check -- packages/runtime-core/src apps/editor/src/editor-preview` -> no whitespace errors; CRLF warnings only.

## Remaining Issues

None for Domain B.

## User-Decision Points

None.
