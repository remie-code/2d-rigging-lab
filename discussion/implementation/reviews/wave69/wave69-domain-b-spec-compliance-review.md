# Wave69 Domain B Spec Compliance Review

- Verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-mesh-auto-outline-v6d-contour-constrainautor`
- Review lane: Spec Compliance Review rerun after bounded fix loop 1
- Reviewer: Review-Sylph
- Date: 2026-06-14

## Scope Reviewed

- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
- v6D-relevant routing in `packages/authoring-core/src/mesh-generation.ts`
- v6D-relevant tests in `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts` for v6D registry status consistency
- `packages/operation-core/src/operations/generate-mesh.test.ts` only enough to classify the remaining focused operation-core failure
- `discussion/implementation/waves/wave69/wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md`

Concurrent-work note applied: v6E/v6F source and shared-file edits are present. This review ignores unrelated v6E/v6F issues except where they create a concrete v6D spec failure.

## Basis Documents Used

- `discussion/implementation/orchestration/wave69-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`
- `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md`
- Prior Domain B reviews:
  - `discussion/implementation/reviews/wave69/wave69-domain-b-spec-compliance-review.md`
  - `discussion/implementation/reviews/wave69/wave69-domain-b-design-development-review.md`
  - `discussion/implementation/reviews/wave69/wave69-domain-b-test-adequacy-review.md`
- `discussion/implementation/waves/wave69/wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md`

## Findings

No remaining v6D spec-compliance findings.

## Prior Finding Resolution

### Resolved: v6D no longer retains counted outside/crossing triangles in successful backend output

The fix loop changed v6D so the post-recovery filter removes outside/crossing triangles before `backend-output` can be returned.

Evidence:

- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:165` runs `filterTrianglesToMainMask` after recovery, and `:196` passes only `filtered.triangles` into `createGeneratedV6DMesh`.
- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:183` falls back when filtering leaves no triangles or breaks final boundary preservation.
- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:556` computes outside/crossing state, `:559-561` increments diagnostics and continues, and `:564` only retains triangles that passed the filter.
- `packages/authoring-core/src/mesh-generation.test.ts:1921` adds a v6D outside/crossing filter regression test; `:1947-1955` asserts a forced removal and independently checks zero remaining outside/crossing triangles.

### Resolved: v6D registry/runtime status mismatch

The v6D registry now matches runtime metrics as implemented.

Evidence:

- `packages/authoring-core/src/mesh-generation-contract.ts:89-94` lists `auto-outline-v6d-contour-constrainautor` with `backendImplementationStatus: "implemented"`.
- `packages/authoring-core/src/mesh-generation.test.ts:1138-1143` expects the v6D registry entry to be `implemented`.
- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:363-370` emits implemented/backend-output metrics for successful v6D output.
- v6E remains registry-deferred at `packages/authoring-core/src/mesh-generation-contract.ts:97-102`; v6F is currently registry-implemented from concurrent Domain D work. No concrete v6D-owned status mismatch remains.

## Requirement Classification

| Requirement | Classification | Evidence |
|---|---|---|
| Use shared v6 contour salvage pipeline | implemented | v6D calls `createV6ContourCandidateInput` at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:132`; the shared pipeline exposes boundary points, constraints, and interior points at `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts:56-68`. |
| Validate/sanitize duplicate points, zero-length edges, and deterministic point ordering | implemented | `sanitizeConstrainautorInput` dedupes, remaps, sorts, and rejects zero-length/crossing invalid inputs at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:471-535`; invalid-constraint tests start at `packages/authoring-core/src/mesh-generation.test.ts:1986`. |
| Run Delaunator over boundary and interior points | implemented | `createRecoveryInput` combines boundary and interior points at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:305-320`; `Delaunator.from` runs over sanitized points at `:230`. |
| Recover boundary constraints through Constrainautor | implemented | `constrainer.constrainAll(sanitized.constraintEdges)` at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:248`. |
| Verify boundary constraint edges and fallback when not preserved | implemented | Initial recovery checks are at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:267-283`; final post-filter preservation/fallback is at `:170-193`. |
| Filter outside/crossing triangles | implemented | Filter removes outside/crossing triangles at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:556-564`; regression test at `packages/authoring-core/src/mesh-generation.test.ts:1921-1959`. |
| Surface backend diagnostics and quality metrics | implemented | Success metrics include backend id, implementation status, output kind, triangle counts, removed/outside counts, contour diagnostics, and Constrainautor diagnostics at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:360-388`; fallback metrics at `:427-456`. |
| No unconstrained success label | implemented | Missing constraints return failed recovery at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:279-287`, and post-filter missing constraints route to visible fallback at `:183-193`. |
| No v6A triangulation basis | implemented | `rg` found no `earClipPolygon`, fan fallback, `splitTrianglesWithInteriorPoints`, row-major, or v6A triangulation provenance tokens in v6D or the shared contour pipeline; success provenance uses v6D Delaunator/Constrainautor steps at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:759-768`. |
| Default unchanged | implemented | `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:74-75` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:279` keep `auto-outline-v2.6-soft-apron`. |
| Residual visual risk recorded | implemented | Domain B report records medium risk for complex concave/hole-like masks at `discussion/implementation/waves/wave69/wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md:84-86`. |

## Evidence Notes

- Focused authoring-core v6D tests: sandboxed Vitest failed with esbuild `spawn EPERM`; approved outside-sandbox rerun passed: `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts -t v6d --reporter=dot`, 5 passed / 49 skipped.
- `pnpm.cmd typecheck` passed.
- Focused operation-core check still fails, but the failing candidate is v6E, not v6D. The failure occurs at `packages/operation-core/src/operations/generate-mesh.test.ts:531` while expecting deferred fallback metadata, and the received history is for `generateMesh:auto-outline-v6e-contour-poly2tri`. This matches the v6E registry/runtime mismatch: registry still says deferred at `packages/authoring-core/src/mesh-generation-contract.ts:97-102`, while v6E public generation tests expect implemented backend output at `packages/authoring-core/src/mesh-generation.test.ts:2356-2399`. Classify this as parallel Domain C ownership.
- Operation-core v6D provenance expectations are updated for backend output at `packages/operation-core/src/operations/generate-mesh.test.ts:475-490`; no v6D failure surfaced before the v6E assertion failure.

## Residual Risks / Open Verification Items

- Automated visual proof is still a proxy. The v6D thin-tapered spoke regression test at `packages/authoring-core/src/mesh-generation.test.ts:1962-1983` reduces the known fan risk but does not visually prove the original hair/eye case.
- v6D does not implement hole constraints; this is recorded as a Domain B residual risk, not a spec gate failure for this v0.
- Final integration should re-check D/E/F registry and provenance together after Domains C/D settle, because the current operation-core focused test is blocked by the parallel v6E mismatch.
