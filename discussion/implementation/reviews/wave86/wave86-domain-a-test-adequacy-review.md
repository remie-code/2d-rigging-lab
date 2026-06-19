# Wave86 Domain A Test Adequacy Review

## Verdict

pass

## Scope Reviewed

- Wave: Wave86 `mesh-v6d-crossing-constraint-local-repair`
- Domain: `wave86-crossing-constraint-diagnostics-bounded-repair`
- Lane: Test Adequacy Review
- Focus: crossing-pair diagnostics, bounded repair positive/negative tests, fallback preservation, and existing v6D/adaptive fixture stability.

This review is read-only for implementation files. I created only this review artifact.

## Basis Documents Used

- `discussion/implementation/orchestration/wave86-plan.md`
- `discussion/implementation/waves/wave86/wave86-domain-a-crossing-constraint-diagnostics-bounded-repair-report.md`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- `tmp/mesh-diagnotice.log`

Verification evidence reviewed from the Domain A report:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`: sandbox run failed with esbuild `spawn EPERM`; escalated rerun passed 1 file / 72 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check --` touched authoring-core files: passed with LF/CRLF warnings only.

## Findings

No blocking test adequacy findings.

The Wave86-specific tests are not only existence checks. They assert exact status classes, diagnostic enums, exact crossing totals, capped sample sizes, candidate counts, repaired constraint counts, and fallback reasons. These assertions should fail on the likely regressions called out in the plan: missing pair identity, uncapped samples, repair activation on invalid non-crossing-only inputs, multi-crossing repair attempts, missing repaired constraints, or broad fixture regressions.

## Test Coverage Matrix

| Requirement | Evidence | Adequacy |
|---|---|---|
| Crossing pair sample has sanitized edge indexes and endpoint segments for a known crossing. | `packages/authoring-core/src/mesh-generation.test.ts:2268` asserts `sanitizedConstraintEdgeIndexes`, `sanitizedConstraintEdgePointIndexes`, and exact segment coordinates. Types are exposed in `packages/authoring-core/src/mesh-quality-metrics.ts:227`; collector writes these fields at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:1325`. | Covered. Exact values make this regression-sensitive. |
| Input edge indexes and input point indexes are preserved where available. | `packages/authoring-core/src/mesh-generation.test.ts:2303` asserts `inputConstraintEdgeIndexes` and `inputConstraintEdgePointIndexes`; source preservation is at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:820` and sample emission at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:1331`. | Covered. |
| Sample cap is enforced while exact total crossing count remains. | `packages/authoring-core/src/mesh-generation.test.ts:2324` asserts `crossingConstraintEdgeCount: 15`, `sampleLimit: 8`, `sampledPairCount: 8`, `totalPairCount: 15`, `sampleTruncated: true`, and `pairs` length 8. Cap constant and metadata are at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:170` and `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:1359`. | Covered. |
| Existing invalid input reason and counts remain intact. | `packages/authoring-core/src/mesh-generation.test.ts:2184` checks prior duplicate/zero-length and crossing non-success diagnostics, including `invalidConstraintInputReasons`, input/sanitized point counts, edge counts, and crossing/point-on-edge counts. Diagnostic propagation is at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:1156`. | Covered for the existing asserted invalid paths. |
| Repairable single crossing returns generated output. | `packages/authoring-core/src/mesh-generation.test.ts:2368` asserts `status: "generated"`, non-empty triangles, 3 repaired constraints, all constraints preserved, and zero post-repair crossing/point-on-edge counts. Repair gates and success diagnostics are at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:404` and `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:464`. | Covered. |
| Too-few-constraints crossing remains failed. | `packages/authoring-core/src/mesh-generation.test.ts:2199` / `packages/authoring-core/src/mesh-generation.test.ts:2233` asserts failure with `not-enough-constraint-edges` plus crossing and `boundaryRepair.attempted: false`. | Covered. |
| Duplicate / zero-length / point-on-edge invalid input does not activate repair. | `packages/authoring-core/src/mesh-generation.test.ts:2420` iterates all three cases and asserts failed output plus `boundaryRepair.attempted: false`, `result: "not-attempted-non-crossing-only"`, and `candidateCount: 0`. Activation gate is `invalidConstraintInputReasons` exactly crossing-only at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:404`. | Covered for activation behavior. |
| Multi-crossing input does not activate repair. | `packages/authoring-core/src/mesh-generation.test.ts:2324` uses 15 crossings and asserts `result: "not-attempted-crossing-pair-count"` and `candidateCount: 0`. Gate is at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:411`. | Covered. |
| Existing simple / curved / thin / adaptive fixtures remain stable enough to prove no broad regression. | Shared contour fixture contract is asserted at `packages/authoring-core/src/mesh-generation.test.ts:1209`; v6D contour backend simple/curved/thin generated output is asserted at `packages/authoring-core/src/mesh-generation.test.ts:1909`; adaptive contour generated output and metrics are asserted at `packages/authoring-core/src/mesh-generation.test.ts:1998`; fixtures are defined in `packages/authoring-core/src/mesh-generation-v6-fixtures.ts:32`. | Covered. Oracles are deterministic status/source/metrics checks, not visual perfection. |
| Repair diagnostics record attempted/repaired/failed status and candidate count. | Repaired path is asserted at `packages/authoring-core/src/mesh-generation.test.ts:2387`; non-attempted paths at `packages/authoring-core/src/mesh-generation.test.ts:2360` and `packages/authoring-core/src/mesh-generation.test.ts:2475`; failed-candidate path at `packages/authoring-core/src/mesh-generation.test.ts:2484`. Diagnostic shape is typed at `packages/authoring-core/src/mesh-quality-metrics.ts:263` and emitted at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:391`, `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:464`, and `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:491`. | Covered. |

## Residual Risks / User-Decision Points

- The tests do not use the original user PSD, which is intentional per plan. Synthetic fixtures directly target the crossing, cap, repair, and negative activation gates.
- There is no direct test that forces the repaired path to pass recovery and then fail final boundary verification, which would rewrite `boundaryRepair.result` to `failed-final-boundary-verification` via `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:603` and the adaptive final check at `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:190`. This is a residual branch-coverage gap, not a blocking adequacy issue for the stated review focus because generated repair, failed repair, fallback preservation, and existing final safety metrics are already asserted.
- No user-decision point is required from this lane.
