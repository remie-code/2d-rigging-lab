# Wave69 Domain D Test Adequacy Review

- Verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-mesh-auto-outline-v6f-custom-constrained-triangulation`
- Review lane: Test Adequacy Review
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Basis:

- `discussion/implementation/orchestration/wave69-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md`
- `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md`

Source/tests:

- `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts`
- `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- Relevant `git diff` / status for the files above.

Refresh note:

- Rechecked after Fix Loop 1 registry/status changes. v6F canonical registry now records `backendImplementationStatus: "implemented"` and the route-local implemented-status override has been removed.

## Coverage Classification

| Requirement | Test adequacy | Evidence |
|---|---|---|
| v6F uses shared contour salvage pipeline | Direct + indirect | Dedicated v6F test checks `contourPipelineDiagnostics.status: generated` and provenance includes `shared-v6-contour-pipeline` (`mesh-generation-v6f-custom-cdt.test.ts:62-84`, `96-103`). Shared pipeline test separately checks deterministic boundary points, constraints, interior points, and contour provenance (`mesh-generation.test.ts:1173-1244`). |
| v6F is first-class method/source output | Direct | Dedicated v6F test asserts source `outline-v6f-contour-custom-cdt-rgba`, method/backend/source IDs, `backendImplementationStatus: implemented`, and `outputKind: backend-output` (`mesh-generation-v6f-custom-cdt.test.ts:49-84`). Canonical registry records v6F as implemented (`mesh-generation-contract.ts:104-110`), `mesh-generation.test.ts` asserts that registry status (`mesh-generation.test.ts:1153-1160`), and the v6F route now reads the canonical candidate directly (`mesh-generation.ts:1375-1383`). |
| Deterministic representative fixtures | Direct | The success test runs twice and compares full results over `v6-simple-rectangle`, `v6-curved-blob`, `v6-thin-tapered`, and `v6-hole-like` (`mesh-generation-v6f-custom-cdt.test.ts:24-49`). Fixtures cover simple outer boundary, curved boundary, thin tip, transparent interior, and empty alpha (`mesh-generation-v6-fixtures.ts:32-90`). |
| Mesh DTO invariants | Direct | `expectValidMeshDto` checks IDs, bounds, vertex/UV/stable ID lengths, non-empty vertices/triangles, in-bounds vertices, non-duplicate triangle indices, and valid index references (`mesh-generation-v6f-custom-cdt.test.ts:53-58`, `191-231`). |
| All selected boundary/interior points participate | Direct for representative fixtures | Test asserts metrics boundary/interior counts equal contour diagnostics and all final vertices are referenced by triangles (`mesh-generation-v6f-custom-cdt.test.ts:87-105`, `234-243`). Implementation also blocks output if `usedPointCount < points.length` (`mesh-generation-v6f-custom-cdt.ts:308-340`). |
| Boundary constraints preserved | Direct | Test asserts custom diagnostics preserved count equals constraint count and helper reports zero missing boundary edges (`mesh-generation-v6f-custom-cdt.test.ts:91-105`, `245-258`). Implementation fails if missing constraint count is non-zero (`mesh-generation-v6f-custom-cdt.ts:308-330`). |
| Long boundary-to-boundary spokes reduced/counted | Direct but narrow | Test asserts `longSpokeCandidateCount > 0` and no final long boundary chord on the rectangle fixture (`mesh-generation-v6f-custom-cdt.test.ts:109-127`, `260-288`). Source counts long boundary spokes and applies a penalty before edge insertion (`mesh-generation-v6f-custom-cdt.ts:352-440`), then local flips can improve long spokes (`mesh-generation-v6f-custom-cdt.ts:498-607`). |
| Custom diagnostics surfaced | Direct | Success assertions cover `customCdtDiagnostics`, constraint counts, recovery operation count, edge flip count, rejected local improvement count, and absent custom fallback reason (`mesh-generation-v6f-custom-cdt.test.ts:60-95`). Long-spoke count is asserted separately (`mesh-generation-v6f-custom-cdt.test.ts:124-127`). Blocked metadata includes custom fallback reason (`mesh-generation-v6f-custom-cdt.test.ts:145-186`). |
| Blocked / fallback metadata | Direct for input-blocked paths; indirect for custom triangulation failures | Dedicated v6F test covers empty alpha and missing texture bytes as `outputKind: blocked` with custom CDT fallback reasons (`mesh-generation-v6f-custom-cdt.test.ts:130-188`). Existing mesh-generation test repeats registry-driven empty/missing coverage and asserts implemented blocked metadata (`mesh-generation.test.ts:2882-2961`). Source carries custom failure metadata for contour / constraint / selected-point failures (`mesh-generation-v6f-custom-cdt.ts:735-768`, `852-859`) and fallback routing (`mesh-generation.ts:1430-1521`). |
| Forbidden v6A triangulation firebreak | Static review + indirect test | Orchestrator firebreak `rg` found no forbidden v6A symbols. I repeated the scoped `rg` against v6F source/test and found no matches. Shared contour tests assert provenance does not include `earclip`, `fan`, or `split` (`mesh-generation.test.ts:1231-1239`). There is no committed unit test that statically forbids future v6A symbol import in v6F. |
| Default remains V2.6 | Indirect / out of Domain D source scope | Domain D did not edit editor default files. Existing mesh-generation tests still cover v2.6 sidecar behavior (`mesh-generation.test.ts:387-456`, `1019-1048`). |
| Exact visual geometry is not overfit | Adequate | Tests compare deterministic repeated output and generic invariants, not exact triangle arrays. The long-spoke test is proxy-shape-specific to the rectangle fixture, but it checks a quality property rather than a hardcoded triangle layout. |

## Findings

No blocking test adequacy issues found.

The strongest coverage is around successful backend output: deterministic output across four representative alpha fixtures, DTO validity, selected-point participation, boundary constraint preservation, and custom diagnostics are all directly asserted.

The main residual gap is custom-algorithm non-success coverage. Current tests cover input-blocked paths (`alpha-empty`, `texture-bytes-unavailable`) and source has structured metadata for constraint/selected-point failures, but no test fixture or test-only probe directly forces `v6f-custom-cdt-constraint-recovery-failed` or `v6f-selected-point-unused`. This can remain a residual risk for Domain D because the current representative success tests prove the backend does not claim success with missing constraints on covered shapes, and blocked metadata is directly covered. A future pathological fixture would be useful before promoting v6F as a final default.

The long-spoke test is intentionally property-based, not exact visual geometry, but it is narrow: only `v6-simple-rectangle` has direct final-long-boundary-chord assertions. Thin tapered and hole-like fixtures are covered for deterministic valid output, not for an independent no-spoke metric. This is acceptable for Wave69 comparison-candidate status; it should be expanded before final backend selection.

Fix Loop 1 resolved the prior v6F registry/status mismatch. The canonical v6F candidate now records `backendImplementationStatus: "implemented"` (`mesh-generation-contract.ts:104-110`), the route uses `getV6MeshGenerationCandidate(...)` without a local override (`mesh-generation.ts:1375-1383`), and authoring-core tests assert both the registry state and generated/blocked v6F metadata (`mesh-generation.test.ts:1153-1160`, `2882-2961`). The remaining operation-core mismatch mentioned in orchestration is v6E-specific and is not a v6F Domain D test adequacy blocker.

## Verification Notes

Accepted orchestrator verification:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts --reporter=dot`: passed outside sandbox, 1 file / 3 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot`: passed outside sandbox, 1 file / 54 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.

Reviewer checks:

- Re-read basis docs, Domain D report, implementation, focused tests, shared mesh-generation tests, fixtures, canonical registry, and relevant diffs/status.
- Rechecked Fix Loop 1 v6F registry/status changes in `mesh-generation-contract.ts`, `mesh-generation.ts`, and `mesh-generation.test.ts`.
- Re-ran scoped v6F firebreak search against `mesh-generation-v6f-custom-cdt.ts` and `mesh-generation-v6f-custom-cdt.test.ts`: no matches.
- Re-ran scoped `git diff --check` for in-scope source/test/review files: exit 0, CRLF working-copy warnings only.

## Verdict

`pass`

Residual risks are acceptable for a Wave69 first-class comparison candidate and should be revisited before final v6 backend promotion.
