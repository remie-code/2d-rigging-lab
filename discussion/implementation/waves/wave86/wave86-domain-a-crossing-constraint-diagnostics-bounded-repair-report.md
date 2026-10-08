# Wave86 Domain A: Crossing Constraint Diagnostics and Bounded Repair

## Verdict

pass

## Files Changed

- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`

No conditional files were changed:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`

## Basis Coverage Self-Report

Read and applied:

- `discussion/implementation/orchestration/wave86-plan.md`
- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/implementation/waves/wave85/wave85-final-integration-report.md`
- `discussion/implementation/reviews/wave85/wave85-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `tmp/mesh-diagnotice.log`
- Relevant source and tests under `packages/authoring-core/src/`.

Deferred basis items: none.

## Current-State Confirmation

- `tmp/mesh-diagnotice.log` showed the target v6D adaptive fallback as `v6d-invalid-constraint-input`, `failureStage: "constraint-input"`, `invalidConstraintInputReasons: ["crossing-constraint-edge"]`, `sanitizedConstraintEdgeCount: 109`, `crossingConstraintEdgeCount: 1`, and zero invalid endpoint, zero-length, duplicate, and point-on-edge counts.
- Existing `recoverV6DConstrainautorTriangles` failed immediately after sanitize failures and did not expose crossing pair identity or bounded repair state.
- Existing sanitize already had exact crossing and point-on-edge counts after finite point filtering, rounding, endpoint remap, zero-length removal, and duplicate edge removal.
- Existing v6D contour and adaptive callers already performed final filtering and boundary constraint verification after recovery.
- Pre-existing unrelated dirty discussion files were left untouched.

## Diagnostics Trace

- Added `crossingConstraintEdgePairSample` to `MeshGenerationV6ConstrainautorDiagnostics`.
- The sample records:
  - `coordinateSpace: "candidate-texture-pixels"`;
  - `sampleLimit`, `sampledPairCount`, `totalPairCount`, and `sampleTruncated`;
  - sanitized constraint edge ordinals;
  - sanitized constraint edge point indexes;
  - input constraint edge indexes and input point indexes where available;
  - two endpoint coordinate segments.
- The sample cap is `8`; total crossing count remains exact through `totalPairCount` and `crossingConstraintEdgeCount`.
- The diagnostics path does not dump all points or all edges.

## Repair Activation Trace

- Repair is attempted only from sanitize failure when invalid reasons are exactly `["crossing-constraint-edge"]` and the pre-repair crossing count is exactly `1`.
- The single crossing pair must be available in the capped sample and all four endpoints must be boundary points.
- The sanitized constraint set must be cyclic over boundary points.
- Candidate removals are derived from the crossing pair endpoints, deduplicated, capped at four, and filtered so repaired boundary point count remains at least three.
- Each candidate removes at most one boundary point, rebuilds cyclic boundary constraints, then re-runs sanitize, Delaunator, Constrainautor, and preserved-constraint recovery.
- Repair success records `boundaryRepair.result: "repaired"`, attempted status, candidate count, failed candidate count, removed boundary point count, pre/post crossing count, post point-on-edge count, selected removed boundary point index, repaired constraint count, and the pre-repair crossing sample.

## Fallback Preservation Trace

- Non-crossing-only failures record `boundaryRepair.attempted: false` with a specific not-attempted reason and continue returning the original fallback failure shape.
- Too-few-constraint crossings remain failed because their invalid reasons are not crossing-only.
- Multi-crossing input records not-attempted crossing-pair-count and keeps the exact crossing total.
- Duplicate, zero-length, invalid endpoint, and point-on-edge invalid inputs do not activate repair.
- If every candidate remains invalid or fails recovery, the function returns `v6d-invalid-constraint-input` with `boundaryRepair.result: "failed-no-candidate-succeeded"`.
- If a repaired recovery later fails contour/adaptive final boundary verification, the existing fallback remains active and `boundaryRepair.result` is rewritten to `failed-final-boundary-verification`.

## Must-not Compliance Evidence

- No v6f/custom CDT fallback was added.
- No dispatcher default method, Editor UI, algorithm selector, outer-loop selection, global simplification, save/load schema, Dynamics, Viewer, Deformer, or keyform code was changed.
- No dependency or lockfile changes were made.
- No PSD/user asset fixture was committed.
- Source changes stayed in the allowed `packages/authoring-core/src/` files.

## Verification

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`
  - sandbox run failed with known Vitest/esbuild `spawn EPERM`;
  - escalated rerun passed: 1 file, 72 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/authoring-core/src/mesh-quality-metrics.ts packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts packages/authoring-core/src/mesh-generation.test.ts`: passed with LF/CRLF working-copy warnings only.

## Review Lane Results and Applied Fixes

- Spec Compliance Review: pass. Artifact: `discussion/implementation/reviews/wave86/wave86-domain-a-spec-compliance-review.md`.
- Design / Development Compliance Review: pass. Artifact: `discussion/implementation/reviews/wave86/wave86-domain-a-design-development-review.md`.
- Test Adequacy Review: pass. Artifact: `discussion/implementation/reviews/wave86/wave86-domain-a-test-adequacy-review.md`.

Applied fixes: none.

Fix loop count: 0. No review lane reported blocking or warning findings.

## Residual Risks / User-Decision Points

- Real PSD data was not used as a fixture by design; synthetic tests cover the direct crossing, cap, repair, and negative gates.
- The repair remains intentionally narrow and may preserve fallback for non-single-pair or non-cyclic failures.
- Review residual: no dedicated test forces a repaired recovery to pass and then fail final boundary verification for the `failed-final-boundary-verification` rewrite branch. Existing final filtering remains active and was reviewed as non-blocking.
- Review residual: the v6D constrainautor implementation and mesh-generation integration test are large existing files. This bounded change stayed in the existing responsibility boundary, but future repair/diagnostic expansion should consider extraction.
- No user-decision point is currently identified.
