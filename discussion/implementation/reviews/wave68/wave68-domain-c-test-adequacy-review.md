# Wave68 Domain C Test Adequacy Review

- Verdict: `pass` after Fix Loop 1 re-review
- Lane: Test Adequacy Review
- Domain: `wave68-mesh-auto-outline-v6b-constrainautor-sidecar`
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

Basis documents:

- `discussion/implementation/orchestration/wave68-plan.md`
- `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-b-mesh-auto-outline-v6a-local-sidecar-report.md`
- `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md`
- `discussion/design/mesh-generation/auto-outline-v6b-constrainautor.md`
- `discussion/design/mesh-generation/auto-outline-v6-library-candidate-inventory.md`

Source and tests:

- `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.js`
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor-runtime.d.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

This review checked the tests from the acceptance contract and source behavior, not from an implementer summary. No source files or tests were edited.

## Findings

### C-TA-001 - Blocking test gap: v6b empty-alpha fallback is not directly covered

Severity: medium / blocking for Domain C Test Adequacy.

Resolution status: `resolved` in Fix Loop 1.

The current v6 fallback test covers empty alpha only through `auto-outline-v6a-local` and covers `auto-outline-v6b-constrainautor` only for missing texture bytes. The Domain C rubric asks fallback coverage to include missing bytes and empty alpha, and v6b has its own empty-alpha backend path in `createV6BPipelineContext`.

Evidence:

- `packages/authoring-core/src/mesh-generation.test.ts:1657` starts the v6 empty/missing-alpha test.
- `packages/authoring-core/src/mesh-generation.test.ts:1665` calls `auto-outline-v6a-local` for the empty-alpha fixture and asserts `alpha-empty`.
- `packages/authoring-core/src/mesh-generation.test.ts:1715` calls `auto-outline-v6b-constrainautor` only for the missing-bytes session and asserts `texture-bytes-unavailable`.
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:404` builds the v6b soft alpha mask.
- `packages/authoring-core/src/mesh-generation-v6b-constrainautor.ts:405` returns blocked `alpha-empty` when v6b sees no opaque pixels.
- `packages/authoring-core/src/mesh-generation.ts:1065` maps a blocked v6b backend result through the shared blocked fallback result.

Impact:

- A regression where v6b empty alpha returns the wrong source, wrong `fallbackSteps`, wrong `outputKind`, or backend-success metadata would not be caught by the current focused v6b tests.
- This is a contract-level fallback visibility requirement, not an exact geometry expectation.

Required fix:

- Add a focused assertion using `v6-empty-alpha-fallback` with `method: "auto-outline-v6b-constrainautor"`.
- Assert at minimum: `source === "bounds-grid"`, `fallbackReason === "alpha-empty"`, `fallbackSteps === [{ method: "auto-outline-v6b-constrainautor", reason: "alpha-empty" }]`, v6 metrics `methodId`, `requestedSourceId`, `actualSourceId: "bounds-grid"`, `outputKind: "blocked"`, `alphaBoundsAvailable: false`, `opaquePixelCount: 0`, and v6b constrainautor diagnostics with dependency gate visible.

## Fix Loop 1 Re-review

Final verdict: `pass`.

C-TA-001 is resolved. `packages/authoring-core/src/mesh-generation.test.ts:2140` now calls `createGeneratedMeshForDrawable` with `method: "auto-outline-v6b-constrainautor"` against the `v6-empty-alpha-fallback` fixture. The test asserts:

- `source === "bounds-grid"` at `mesh-generation.test.ts:2148`.
- `fallbackReason === "alpha-empty"` and v6b fallback steps at `mesh-generation.test.ts:2149` through `mesh-generation.test.ts:2152`.
- blocked v6 metrics, requested/actual source, `alphaBoundsAvailable: false`, and `opaquePixelCount: 0` at `mesh-generation.test.ts:2153` through `mesh-generation.test.ts:2160`.
- visible Constrainautor diagnostics with `dependencyGateStatus: "available"` at `mesh-generation.test.ts:2161` through `mesh-generation.test.ts:2163`.

Additional Fix Loop 1 coverage is adequate and does not introduce exact triangle-layout overfitting:

- Thin tapered fixture determinism and no-fake-success/fallback checks: `mesh-generation.test.ts:1329` through `mesh-generation.test.ts:1392`.
- Near-collinear recovery or structured failure: `mesh-generation.test.ts:1496` through `mesh-generation.test.ts:1535`.
- Near-duplicate-after-quantization invalid-constraint failure: `mesh-generation.test.ts:1537` through `mesh-generation.test.ts:1565`.
- Retry provenance for retry success and retry fallback probes: `mesh-generation.test.ts:1567` through `mesh-generation.test.ts:1665`.
- Main-island-only handling for multi-island alpha inputs: `mesh-generation.test.ts:1667` through `mesh-generation.test.ts:1723`.

The source changes supporting retry/fallback provenance are directly exercised through test-only probes and the public generation path:

- v6b retry loop and visible fallback/success selection: `mesh-generation-v6b-constrainautor.ts:220` through `mesh-generation-v6b-constrainautor.ts:255`.
- recovery attempt construction and retry provenance tags: `mesh-generation-v6b-constrainautor.ts:556` through `mesh-generation-v6b-constrainautor.ts:591`.
- retry probe behavior used by tests: `mesh-generation-v6b-constrainautor.ts:659` through `mesh-generation-v6b-constrainautor.ts:714`.

No new Domain C Test Adequacy finding remains.

## Coverage Matrix

| Requirement | Coverage | Evidence |
|---|---|---|
| Headless v6b selection | Covered | `mesh-generation.test.ts:1260` generates `auto-outline-v6b-constrainautor` through `createGeneratedMeshForDrawable`. |
| Operation payload/provenance | Covered | `generate-mesh.test.ts:520` commits v6b and checks method/source/diagnostic transform history. Candidate loop at `generate-mesh.test.ts:448` also checks v6b provenance fields. |
| Deterministic repeated runs | Covered | `mesh-generation.test.ts:1277` through `mesh-generation.test.ts:1280` compare two identical v6b generations; additional thin/multi-island cases repeat this pattern. |
| Simple and curved fixture boundary preservation | Covered | `mesh-generation.test.ts:1260` iterates `v6-simple-rectangle` and `v6-curved-blob`; `mesh-generation.test.ts:1323` through `mesh-generation.test.ts:1324` assert constraint counts and preservation. |
| Backend diagnostics exposed | Covered | `mesh-generation.test.ts:1294` through `mesh-generation.test.ts:1314` check v6 metrics and Constrainautor diagnostics; `generate-mesh.test.ts:520` checks operation history diagnostics. |
| Throw/failure visibility | Covered adequately | Invalid constraints fail visibly at `mesh-generation.test.ts:1448`; hole limitation fallback is visible at `mesh-generation.test.ts:1394`; retry fallback provenance is covered at `mesh-generation.test.ts:1567`. A forced Constrainautor throw is not directly induced, but fallback/error-kind fields exist in source and operation formatting. |
| No fake constrained success | Covered | Success cases require no fallback and `preservedConstraintEdgeCount === constraintEdgeCount` at `mesh-generation.test.ts:1281` through `mesh-generation.test.ts:1283` and `mesh-generation.test.ts:1323` through `mesh-generation.test.ts:1324`; invalid/crossing constraints return failed at `mesh-generation.test.ts:1476` through `mesh-generation.test.ts:1486`. |
| DTO invariants | Covered | `expectValidMeshDto` is used for v6b at `mesh-generation.test.ts:1284`, `mesh-generation.test.ts:1349`, and `mesh-generation.test.ts:1694`; helper checks ids, bounds, UVs, triangle indices, and non-degenerate areas at `mesh-generation.test.ts:2362`. |
| Missing bytes fallback | Covered | `mesh-generation.test.ts:2195` through `mesh-generation.test.ts:2217` covers v6b missing bytes. |
| Empty alpha fallback | Covered after Fix Loop 1 | `mesh-generation.test.ts:2140` through `mesh-generation.test.ts:2164` directly covers v6b empty-alpha blocked fallback metadata. |
| v6b-specific limitation/failure path | Covered | Hole limitation fallback at `mesh-generation.test.ts:1394`; invalid constraints at `mesh-generation.test.ts:1448`; retry fallback at `mesh-generation.test.ts:1631`; main-island-only behavior at `mesh-generation.test.ts:1667`. |
| Duplicate/zero-length/crossing preflight | Covered | Synthetic recovery tests at `mesh-generation.test.ts:1448` through `mesh-generation.test.ts:1494`; sanitizer rejects these paths in `mesh-generation-v6b-constrainautor.ts:761` through `mesh-generation-v6b-constrainautor.ts:819`. |
| Avoid exact triangle-layout overfit | Covered | v6b tests assert deterministic equality, DTO invariants, counts, sources, and diagnostics; they do not pin exact vertex or triangle layouts. |
| Existing v6a/V2.6/V4 stability | Covered by focused file suite | Existing tests remain in the same authoring-core and operation-core test files; parent verification ran the full focused files successfully. |
| v6c parallel dependency | No accidental v6b dependency found | Some all-candidate tests include v6c when the shared candidate registry marks it implemented, but v6b has dedicated authoring and operation assertions. Do not treat v6c assertions as Domain C evidence. |

## Verification Considered

Parent/Orch-Sylph reported:

- Initial review verification:
  - `pnpm.cmd typecheck`: pass.
  - `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot`: initial sandbox Windows `esbuild spawn EPERM`; escalated rerun passed, 2 files / 61 tests.
  - `node scripts/check-source-organization.mjs`: pass.
  - `node scripts/check-dependencies.mjs`: pass.
  - `git diff --check` on tracked Domain C-touched files: pass, LF/CRLF warnings only.
  - `git diff --no-index --check` on new v6b files and untracked contract file: no whitespace diagnostics; no-index nonzero because files differ from `NUL`.
- Fix Loop 1 verification:
  - `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot`: sandbox Windows `esbuild spawn EPERM`; escalated rerun passed, 2 files / 69 tests.
  - `pnpm.cmd typecheck`: pass.
  - `node scripts/check-source-organization.mjs`: pass.
  - `node scripts/check-dependencies.mjs`: pass.
  - scoped `git diff --check` on Domain C tracked files and discussion artifacts: pass.
  - no-index `git diff --check` on new v6b/shim/contract files: no whitespace diagnostics, expected nonzero due diff from `NUL` and LF/CRLF warnings only.

This re-review did not rerun tests and did not run `pnpm install`.

## Residual Test Gaps

Blocking:

- None after Fix Loop 1.

Non-blocking / rationale:

- The v6b design document lists broader stress fixtures such as thin tapered, near-collinear, near-duplicate, and main-island-only cases. Fix Loop 1 added focused coverage for those areas; no additional blocking fixture gap remains in this lane.
- A forced backend throw path with `thrownErrorKind` is not directly induced. Existing tests cover visible invalid-constraint and hole-limitation failure paths; a throw-specific test would be useful only if a stable mocking seam is added later.
- Browser/UI backend selection is Domain E scope, not Domain C Test Adequacy scope.

## User-Decision Points

None. This is a focused test adequacy fix request, not a product or design decision.

## Artifact

Updated: `discussion/implementation/reviews/wave68/wave68-domain-c-test-adequacy-review.md`
