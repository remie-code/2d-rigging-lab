# Wave86 Domain A Spec Compliance Review

## Verdict

pass

## Scope Reviewed

- Wave: Wave86 `mesh-v6d-crossing-constraint-local-repair`
- Domain: `wave86-crossing-constraint-diagnostics-bounded-repair`
- Lane: Spec Compliance Review
- Reviewed crossing pair diagnostics, bounded boundary repair activation, repaired success gates, fallback preservation, and forbidden-scope compliance.

## Basis Documents Used

- `discussion/implementation/orchestration/wave86-plan.md`
- `discussion/implementation/waves/wave86/wave86-domain-a-crossing-constraint-diagnostics-bounded-repair-report.md`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `tmp/mesh-diagnotice.log`

Optional Wave85 basis was not needed beyond the required Wave86 plan and the diagnostic log.

## Findings

No blocking or non-blocking spec compliance findings.

## Acceptance Coverage Notes

### Crossing Pair Diagnostics

- Pass. The diagnostics schema includes capped crossing pair samples, sanitized edge ordinals, sanitized point indexes, optional input edge ordinals/indexes, endpoint coordinate segments, coordinate space, cap metadata, exact total pair count, and boundary repair diagnostics: `packages/authoring-core/src/mesh-quality-metrics.ts:193`, `packages/authoring-core/src/mesh-quality-metrics.ts:227`, `packages/authoring-core/src/mesh-quality-metrics.ts:263`.
- Pass. Collection preserves exact `totalPairCount` while only storing up to `CROSSING_CONSTRAINT_EDGE_PAIR_SAMPLE_LIMIT = 8` samples: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:170`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:1298`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:1321`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:1359`.
- Pass. Existing invalid-input counts are still populated through sanitize diagnostics and propagated to public constrainautor diagnostics: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:866`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:1135`.
- Pass. Tests cover pair sample contents and cap/exact-count behavior: `packages/authoring-core/src/mesh-generation.test.ts:2268`, `packages/authoring-core/src/mesh-generation.test.ts:2324`.

### Bounded Repair Activation

- Pass. Repair is only attempted after sanitize failure and only when invalid reasons are exactly `["crossing-constraint-edge"]`, crossing count is exactly `1`, the sample exists, endpoints are boundary points, and constraints are cyclic boundary constraints: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:255`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:380`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:404`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:421`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:425`.
- Pass. Candidate removals are limited to crossing-pair endpoints, deduplicated, capped at four, and filtered to preserve at least three boundary points: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:171`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:429`.
- Pass. Each attempted candidate removes one boundary point, rebuilds cyclic boundary constraints, reruns sanitize, then reruns the existing Delaunator/Constrainautor recovery: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:449`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:558`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:477`.
- Pass. Negative cases for non-crossing-only and multi-crossing are source-gated and tested for duplicate, zero-length, point-on-edge, too-few constraints, and multi-crossing/cap behavior: `packages/authoring-core/src/mesh-generation.test.ts:2184`, `packages/authoring-core/src/mesh-generation.test.ts:2324`, `packages/authoring-core/src/mesh-generation.test.ts:2420`.

### Repair Success Gate

- Pass. Repaired sanitize must have zero crossing constraints and zero point-on-edge constraints before recovery can continue: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:455`.
- Pass. Recovery success requires all repaired constraints to be preserved; otherwise it returns `v6d-constraint-recovery-failed`: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:323`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:340`.
- Pass. Both contour and adaptive callers still apply outside/crossing triangle filtering, require non-empty filtered triangles, and reject missing final boundary constraints: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:209`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:228`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:175`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:190`.
- Pass. Final-boundary-verification failure rewrites repaired diagnostics to `failed-final-boundary-verification` instead of reporting normal repair success: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:603`.

### Fallback Preservation

- Pass. Non-precondition cases return the existing `v6d-invalid-constraint-input` fallback shape with a specific `boundaryRepair.result`: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:360`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:387`.
- Pass. All-candidate failure preserves failure behavior and records `failed-no-candidate-succeeded`, candidate counts, failed candidate count, pre/post crossing/point-on-edge where available, and the pre-repair crossing sample: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:491`.
- Pass. Fallback creation still uses existing visible fallback output semantics and does not switch backend/source semantics: `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:717`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:437`.
- Pass. Tests cover successful repair and all-candidate fallback preservation: `packages/authoring-core/src/mesh-generation.test.ts:2368`, `packages/authoring-core/src/mesh-generation.test.ts:2484`.

### Forbidden Scope

- Pass. Reviewed changed files are limited to the allowed authoring-core implementation/test files listed in the Domain A report. No Editor selector/default routing, global simplification, v6f/custom CDT fallback, dependency, or user PSD fixture changes were present in the reviewed diff.
- Pass. `tmp/mesh-diagnotice.log` matches the Wave86 target condition: v6D adaptive fallback, `failureStage: "constraint-input"`, reasons `["crossing-constraint-edge"]`, exact crossing count `1`, and zero invalid endpoint, zero-length, duplicate, and point-on-edge counts.

## Residual Risks / User-Decision Points

- This review did not rerun verification commands; it inspected source, tests, the Wave86 plan, Domain A report, and the diagnostic log. The Domain A report records `mesh-generation.test.ts`, `pnpm typecheck`, source organization, dependency check, and diff check as passed.
- Invalid-endpoint non-repair is source-covered by the exact crossing-only reason gate, but I did not find a direct new invalid-endpoint negative test in this lane. This is not a spec-compliance blocker; it is more appropriate for the Test Adequacy Review lane.
- No user-decision point is required for this lane.
