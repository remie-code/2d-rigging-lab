# Wave68 Domain D Test Adequacy Review

- Verdict: `pass` after Fix Loop 2 direct-regression re-review
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6c-poly2tri-sidecar`
- Review lane: Test Adequacy
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Initial Summary

The focused authoring-core and operation-core tests pass in the current worktree, and the implemented tests cover the main v6c success path, determinism, DTO invariants, simple polygon plus Steiner-point output, visible hole and multi-island limitations, missing-byte fallback, and successful operation provenance.

The initial lane did not pass because the tests did not exercise the v6c-specific failure branches that are most important for the Domain D must-not requirements: invalid polygon fallback, `poly2tri` triangulation throw fallback, and boundary-missing fallback. The operation-core tests also did not assert v6c fallback provenance for hole or multi-island results.

## Initial Findings

### 1. Missing v6c negative coverage for invalid polygon / triangulation throw / boundary-missing diagnostics

Severity: blocking for Test Adequacy.

Domain D requires invalid polygon and triangulation failures to be visible failures, not successful v6c backend output. The implementation has explicit branches for these cases:

- `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:240` sets `v6c-poly2tri-polygon-invalid` with `polygonValidationFailed: true`.
- `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:269` chooses `v6c-poly2tri-triangulation-threw`, `v6c-poly2tri-boundary-missing`, or `v6c-poly2tri-generation-failed`.
- `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:904` catches `poly2tri` throws and sets `triangulationThrown: true`.
- `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:980` records preserved/missing boundary edges and blocks when any boundary edge is missing.

The tests cover successful v6c output at `packages/authoring-core/src/mesh-generation.test.ts:1424`, hole/multi-island fallback at `packages/authoring-core/src/mesh-generation.test.ts:1506`, and missing-byte fallback at `packages/authoring-core/src/mesh-generation.test.ts:1739`. They do not trigger or assert:

- `v6c-poly2tri-polygon-invalid`
- `v6c-poly2tri-triangulation-threw`
- `v6c-poly2tri-boundary-missing`
- `polygonValidationFailed: true` for a non-hole invalid polygon
- `triangulationThrown: true`
- `boundaryEdgeMissingCount > 0`

This leaves a regression path where invalid polygon or failed triangulation behavior could accidentally be reported as backend success without a failing test. Add focused tests, either with crafted public fixtures or a narrowly exposed/testable v6c validation/triangulation seam, that assert these failures return fallback/blocker metadata and do not use `outline-v6c-poly2tri-rgba` as the actual successful source.

### 2. Operation fallback provenance is not covered for v6c limitation paths

Severity: blocking for Test Adequacy.

Operation-core tests assert successful v6c provenance under the generic v6 candidate loop at `packages/operation-core/src/operations/generate-mesh.test.ts:396` and v6c-specific success diagnostics at `packages/operation-core/src/operations/generate-mesh.test.ts:466`. The operation formatter can emit all poly2tri diagnostic fields at `packages/operation-core/src/operations/generate-mesh.ts:537`.

However, there is no operation-level test for a v6c hole or multi-island fallback. A search found no `fallback:auto-outline-v6c-poly2tri` assertion in `packages/operation-core/src/operations/generate-mesh.test.ts`. The authoring-core fallback assertions are useful, but they do not prove operation provenance records `meshSource:alpha-aware-rgba`, `fallback:auto-outline-v6c-poly2tri:<reason>`, `meshQuality:v6Output=fallback-output`, `meshQuality:v6Poly2TriHoleValidationFailed=true`, or `meshQuality:v6Poly2TriMainIslandOnlyFallback=true` through the mutation gateway.

Add at least one operation-core fallback test for `v6c-poly2tri-hole-unsupported` or `v6c-poly2tri-multi-island-unsupported`.

## Coverage Matrix

| Acceptance / rubric item | Coverage | Adequacy |
|---|---|---|
| Headless v6c selection | `createGeneratedMeshForDrawable` uses `auto-outline-v6c-poly2tri` in authoring tests at `mesh-generation.test.ts:1424`. | Adequate. |
| Operation payload/provenance | Operation success path covers v6 candidates at `generate-mesh.test.ts:396` and v6c success diagnostics at `generate-mesh.test.ts:466`. | Partially adequate; fallback provenance missing. |
| Determinism | v6c test compares repeated results with `expect(first).toEqual(second)` at `mesh-generation.test.ts:1445`. | Adequate for covered fixtures. |
| Simple polygon + Steiner success | Rectangle, curved blob, and thin tapered fixtures run at `mesh-generation.test.ts:1424`; `steinerPointCount > 0` asserted at `mesh-generation.test.ts:1501`. | Adequate. |
| Hole limitation | Hole fallback metadata asserted at `mesh-generation.test.ts:1506`. | Adequate at authoring boundary. |
| Multi-island limitation | Multi-island fallback metadata asserted at `mesh-generation.test.ts:1523`. | Adequate at authoring boundary. |
| Diagnostics fields | Success and limitation diagnostics are asserted at `mesh-generation.test.ts:1481` and `mesh-generation.test.ts:1580`; operation formatter exists at `generate-mesh.ts:537`. | Partially adequate; untested true states for polygon invalid, triangulation thrown, and boundary missing. |
| Failure not masquerading as success | Hole, multi-island, and missing-byte paths assert fallback/blocker output at `mesh-generation.test.ts:1555` and `mesh-generation.test.ts:1747`. | Partially adequate; key v6c invalid/throw/boundary failures are not covered. |
| DTO invariants | `expectValidMeshDto` checks IDs, cardinality, bounds, UV ranges, stable ID shape, triangle indices, and nonzero triangle area at `mesh-generation.test.ts:1882`. | Adequate. |
| Existing v6a / V2.6 / V4 stability | Same focused authoring suite includes v6a, V2.6, and V4 tests; operation suite includes V2.6/V4 provenance tests. | Adequate based on focused pass. |
| Contract-shaped tests, not exact triangle layouts | v6c tests assert source, metrics, counts, DTO invariants, and determinism without hard-coding triangle arrays. | Adequate. |

## Verification

Command:

```text
pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot
```

Result:

- Sandbox run failed while loading `vitest.config.ts` with Windows/Vite/esbuild `spawn EPERM`.
- Approved escalated rerun passed.
- Passed: 2 test files, 61 tests.
  - `packages/authoring-core/src/mesh-generation.test.ts`: 37 tests.
  - `packages/operation-core/src/operations/generate-mesh.test.ts`: 24 tests.

No `pnpm install` was run.

## Unresolved User-Decision Points

None. The required changes are test design/implementation choices inside the current Domain D scope.

## Fix Loop 1 Re-review

- Date: 2026-06-14
- Re-review scope: original Test Adequacy blocking findings and direct regressions from Fix Loop 1 only.
- Final verdict: `pass`

### Original Finding Resolution

| Original finding | Status | Evidence |
|---|---|---|
| Missing v6c negative coverage for invalid polygon / triangulation throw / boundary-missing diagnostics. | Resolved. | Fix Loop 1 adds the narrow `probeAutoOutlineV6CPoly2TriFailureForTest` seam in `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:383`, routed through the shared polygon validation and `triangulateWithPoly2Tri` path at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:418` and `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:1004`. Tests at `packages/authoring-core/src/mesh-generation.test.ts:1701` assert blocked output for `v6c-poly2tri-polygon-invalid`, `v6c-poly2tri-triangulation-threw`, and `v6c-poly2tri-boundary-missing`, including `polygonValidationFailed: true`, `triangulationThrown: true`, and `boundaryEdgeMissingCount: 3`. |
| Operation fallback provenance is not covered for v6c limitation paths. | Resolved. | Fix Loop 1 adds `records auto-outline-v6c-poly2tri hole limitation fallback provenance` at `packages/operation-core/src/operations/generate-mesh.test.ts:557`. It asserts `meshSource:alpha-aware-rgba`, `fallback:auto-outline-v6c-poly2tri:v6c-poly2tri-hole-unsupported`, `meshQuality:v6Output=fallback-output`, `meshQuality:v6Poly2TriHoleValidationFailed=true`, and absence of backend-output provenance. |

### Direct Regression Check

No new direct Test Adequacy regression was found in the Fix Loop 1 changes.

The probe seam is exported from the v6c implementation file but is not re-exported from the package barrel. For this review lane, it is adequate because it drives the same validation and triangulation helper branches that production uses, while allowing deterministic coverage of otherwise hard-to-trigger defensive states. Broader API-surface taste is left to Design / Development Compliance if needed.

The limitation tests also now include a near-touching-hole case at `packages/authoring-core/src/mesh-generation.test.ts:1803`, which directly strengthens the original hole-limitation coverage.

### Fix Loop 1 Verification

Command:

```text
pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot
```

Result:

- Sandbox run failed while loading `vitest.config.ts` with Windows/Vite/esbuild `spawn EPERM`.
- Approved escalated rerun passed.
- Passed: 2 test files, 67 tests.
  - `packages/authoring-core/src/mesh-generation.test.ts`: 42 tests.
  - `packages/operation-core/src/operations/generate-mesh.test.ts`: 25 tests.

No `pnpm install` was run.

### Fix Loop 1 Unresolved User-Decision Points

None.

## Fix Loop 2 Direct-regression Re-review

- Date: 2026-06-14
- Re-review scope: direct regressions from Fix Loop 2 only.
- Final verdict: `pass`

### Direct Regression Findings

None.

The new near-duplicate sanitization coverage is scoped to v6c and does not weaken the Fix Loop 1 negative-path assertions. The added test at `packages/authoring-core/src/mesh-generation.test.ts:1892` checks contract outcomes rather than an exact triangulation layout: five input contour points are sanitized to four points, validation failures remain empty, the shortest sanitized edge stays above the configured threshold, and the backend probe still succeeds.

The added sanitization probe at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:459` calls the same `sanitizePolygonLoop` helper used by the production v6c path at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:219`. The helper itself remains localized in the v6c sidecar implementation at `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts:889`. This is adequate for the direct-regression scope because the test seam observes the production sanitization behavior without replacing the existing invalid-polygon, triangulation-throw, or boundary-missing probes from Fix Loop 1.

The Domain D report's updated verification summary is consistent with the focused rerun: `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md:133` reports 44 authoring tests, and `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md:134` reports 2 focused files / 69 tests.

### Fix Loop 2 Verification

Command:

```text
pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot
```

Result:

- Sandbox run failed while loading `vitest.config.ts` with Windows/Vite/esbuild `spawn EPERM`.
- Approved escalated rerun passed.
- Passed: 2 test files, 69 tests.
  - `packages/authoring-core/src/mesh-generation.test.ts`: 44 tests.
  - `packages/operation-core/src/operations/generate-mesh.test.ts`: 25 tests.

No `pnpm install` was run.

### Fix Loop 2 Unresolved User-Decision Points

None.
