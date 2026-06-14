# Wave68 Domain B Test Adequacy Review

> Review-Sylph lane: Test Adequacy Review  
> Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`  
> Domain: `wave68-mesh-auto-outline-v6a-local-sidecar`  
> Date: 2026-06-14  
> Initial verdict: `needs_changes`  
> Final verdict after Fix Loop 1: `pass`

## Scope Reviewed

Reviewed Domain B test adequacy against the Wave68 plan, Domain A test baseline, v6a design basis, development conventions, source diffs, and focused tests. This review did not rely on a Gnome summary; the Domain B implementation report was not present at `discussion/implementation/waves/wave68/wave68-domain-b-mesh-auto-outline-v6a-local-sidecar-report.md` when checked.

Implementation-relevant files inspected:

- `packages/authoring-core/src/mesh-generation-v6a-local.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

Unrelated dirty worktree areas under `apps/editor/**`, old algorithm files, dependency files, and Domain A artifacts were not attributed to Domain B except where they provided pre-existing baseline context.

## Findings

No remaining blocking or needs-change findings after Fix Loop 1.

### Resolved in Fix Loop 1: v6a DTO invariant tests omit bounds/provenance and UV validity

Domain B acceptance requires deterministic v6a output with valid mesh DTO invariants, including vertices, UVs, stable IDs, bounds/provenance, triangles, and non-degenerate geometry.

The initial review found that v6a tests partially covered this via `expectValidMeshDto(first?.mesh)` in `packages/authoring-core/src/mesh-generation.test.ts:1164`, but the helper at `packages/authoring-core/src/mesh-generation.test.ts:1505` checked only cardinality, stable ID syntax, topology revision, triangle index validity, and non-zero triangle area. It did not assert v6a-specific:

- `mesh.bounds` equals the fixture/input mesh bounds.
- `mesh.generationProvenanceId` equals the requested provenance.
- `mesh.meshId` / `mesh.drawableId` match the target mesh/drawable.
- UV coordinates are finite and within `[0, 1]`.
- vertex coordinates are finite and inside the drawable bounds, or any explicit documented allowance.
- successful v6a `alphaBounds` exists and is inside the drawable bounds.

Fix Loop 1 resolves this. The representative v6a fixture test now passes expected target IDs, provenance, and bounds into `expectValidMeshDto` at `packages/authoring-core/src/mesh-generation.test.ts:1164`, asserts successful `alphaBounds` is defined at `packages/authoring-core/src/mesh-generation.test.ts:1170`, and validates that `alphaBounds` stays inside fixture bounds at `packages/authoring-core/src/mesh-generation.test.ts:1172`.

The helper now validates:

- exact target `meshId`, `drawableId`, `generationProvenanceId`, and `mesh.bounds`.
- finite vertex coordinates inside expected drawable bounds.
- finite UV coordinates within `[0, 1]`.
- existing cardinality, stable ID, topology revision, triangle index, and non-degenerate area invariants.

No direct regression was found from this test-only fix. The assertions remain contract-shaped and do not overfit exact triangle layouts.

## Fix Loop 1 Re-review

Re-reviewed only the original blocking Test Adequacy finding and direct regressions from the test-only change in `packages/authoring-core/src/mesh-generation.test.ts`.

Evidence reviewed:

- Representative v6a fixture test at `packages/authoring-core/src/mesh-generation.test.ts:1135`.
- Updated `expectValidMeshDto` helper at `packages/authoring-core/src/mesh-generation.test.ts:1514`.
- Added `expectRectInsideBounds` helper at `packages/authoring-core/src/mesh-generation.test.ts:1593`.
- Parent verification after the fix.

Result: original blocking finding is resolved. Final verdict is `pass`.

## Test Adequacy Matrix

| Domain B requirement | Current coverage | Adequacy |
|---|---|---|
| v6a deterministic generation from rectangle, curved blob, thin tapered, and hole-like fixtures. | `packages/authoring-core/src/mesh-generation.test.ts:1135` loops all four representative fixtures, runs generation twice, and asserts equality. | Adequate. |
| Valid mesh DTO invariants: vertices, UVs, stable IDs, bounds/provenance, triangles, non-degenerate geometry. | Fix Loop 1 updates the v6a representative fixture test to pass expected target IDs, provenance, and bounds into `expectValidMeshDto`; the helper now checks exact IDs/provenance/bounds, finite in-bounds vertices, UV range, cardinality, stable IDs, topology revision, valid triangle indices, and non-zero triangle area. The same test also asserts successful `alphaBounds` is defined and inside fixture bounds. | Adequate after Fix Loop 1. |
| Empty alpha and missing alpha fallback/blocker metadata. | `packages/authoring-core/src/mesh-generation.test.ts:1307` covers v6a empty alpha and v6a missing bytes as `blocked` with explicit source/fallback metadata; it also samples missing-byte metadata for v6b deferred. | Adequate for Domain B v6a. |
| Preset density direction: high > medium > low where expected. | `packages/authoring-core/src/mesh-generation.test.ts:1201` verifies boundary, vertex, and triangle counts increase from low to medium to high on the curved blob fixture. | Adequate. |
| Quality metrics distinguish boundary/interior counts, fallback steps, output kind, source, and limitation provenance. | Authoring tests assert v6 metrics for source IDs, `outputKind`, fallback steps, boundary/interior counts, and `limitation-not-full-constrained-delaunay`; operation tests assert transform-history provenance for v6a. | Adequate. |
| v6b/v6c remain deferred visible fallback. | `packages/authoring-core/src/mesh-generation.test.ts:1243` asserts `v6-backend-not-implemented`, `fallback-output`, requested/actual source separation, and backend diagnostics for both deferred candidates. | Adequate for Domain B. |
| Operation provenance for non-deferred v6a output. | `packages/operation-core/src/operations/generate-mesh.test.ts:396` asserts v6a source, backend implementation status, output kind, fallback step count, handling metadata, and limitation provenance. | Adequate. |
| `previewMesh` allowlist still covers v6 methods. | `packages/operation-core/src/operations/generate-mesh.test.ts:472` loops all v6 candidates and commits preview meshes. | Adequate. |
| Existing V2.6 and V4 sidecar behavior remains stable. | Existing authoring/operation tests for V2.6 and V4 remain in the focused test files and the parent verification passed those files. Editor default is outside Domain B source scope. | Adequate for Domain B package scope. |
| Tests avoid overfitting exact triangle layouts. | v6a tests assert deterministic equality, counts, metadata, and DTO invariants, but not exact vertex/triangle topology. The exact operation provenance string is metadata contract evidence, not triangle layout overfit. | Adequate. |
| Browser/e2e/manual visual checks. | Domain B is package-level local backend and operation provenance work. Wave68 explicitly does not require screenshot/pixel-perfect visual or side-by-side visual diff evidence for this domain. | N/A. |

## Verification Performed

Static review performed in this lane:

- Read the Wave68 plan, v6a design document, Wave68 preplan inventory, Domain A report/review, mesh-generation map, source organization policy, operation policy, and schema/ID policy.
- Inspected Domain B source/tests directly with `Get-Content`, `rg`, `git status --short -uall`, and scoped `git diff`.
- Confirmed the target review artifact did not previously exist before writing this file.

Parent verification already performed and accepted as current evidence:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Initial sandbox run hit expected Windows `esbuild spawn EPERM`; escalated rerun passed, 2 files / 55 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `node scripts/check-dependencies.mjs` | Pass. |
| Domain B whitespace checks | Pass, LF/CRLF warnings only. |
| Fix Loop 1: `git diff --check -- packages/authoring-core/src/mesh-generation.test.ts` | Pass, CRLF warning only. |
| Fix Loop 1: `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | Initial sandbox run hit expected Windows `esbuild spawn EPERM`; escalated rerun passed, 1 file / 32 tests. |

No additional Vitest run was performed in this lane because the same focused suite had already passed in the parent session and the known Windows sandbox `esbuild spawn EPERM` behavior would require the same escalation path.

## Residual Risks / Test Gaps

- Remaining v6a visual-quality risk is still medium: tests verify representative fixtures and limitation metadata, but do not prove artist-editability or visual desirability. That is acceptable for Domain B and belongs to later comparison/manual review.
- The thin tapered fixture is covered for deterministic valid output, but there is no shape-specific oracle that asserts tip support density. This is a non-blocking residual risk because the current tests intentionally avoid exact topology overfit.
- Multi-island handling is surfaced in metrics but not directly fixture-tested in Domain B. This is non-blocking for the current representative fixture list and should be revisited if later domains rely on main-island-only fallback comparison.
- Editor/browser/e2e checks are N/A for Domain B because the domain did not own Editor UI changes; Domain E owns temporary backend selector UI and preview provenance surface tests.

## User-Decision Points

None. The needed change is a focused test coverage fix, not a product or design decision.
