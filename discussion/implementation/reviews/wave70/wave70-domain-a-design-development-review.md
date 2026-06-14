# Wave70 Domain A Design / Development Compliance Review

- Verdict: `pass`
- Initial verdict: `needs_changes`
- Fix Loop 1 re-review verdict: `pass`
- Review lane: Design / Development Compliance Review
- Target: `wave70-v6d-support-rings-backend-method-contract`
- Date: 2026-06-14
- Reviewer: Review-Sylph

## Scope Reviewed

- Wave70 plan sections 1-10 and 13-16, with emphasis on Domain A and orchestration/review policy.
- Mesh-generation design basis for v6D/v6E/v6F contour salvage and v6D-lineage support rings.
- Development conventions for source organization, dependency policy, operation policy, and schema/ID conventions.
- Direct source inspection of the changed authoring-core files, the new untracked support-ring implementation, operation-core generate-mesh payload/provenance paths, and the Domain A implementation report/map.

## Findings

### 1. Blocking: support-ring diagnostics are runtime extras, not a coherent contract

Domain A requires support-ring diagnostics such as ring point counts, skipped/merged points, support-band/interior triangle counts, outside-layer status, max outside-layer distance, and UV policy. The implementation computes these values, but only as a local intersection type in the new backend file: `V6DSupportRingDiagnostics` extends the base constrainautor diagnostics at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:96`.

Those fields are then assigned into `v6Metrics.constrainautorDiagnostics` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:576` and `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:645`. However, the exported metrics contract still exposes only `MeshGenerationV6ConstrainautorDiagnostics` at `packages/authoring-core/src/mesh-quality-metrics.ts:171`, whose declared fields are only the base dependency/constraint/outside-triangle fields at `packages/authoring-core/src/mesh-quality-metrics.ts:188`.

The operation-core preview payload schema validates the same base-only shape at `packages/operation-core/src/payloads/model-edit.ts:179` and wires it at `packages/operation-core/src/payloads/model-edit.ts:252`. Operation provenance formatting also records only base constrainautor fields at `packages/operation-core/src/operations/generate-mesh.ts:549`.

Impact: authoring-core tests can observe the extra properties by runtime object shape and casts, but downstream TypeScript consumers, payload validation, and operation evidence do not have a typed support-ring diagnostic contract. That undercuts the Domain A method-contract requirement and the schema/operation policy expectation that cross-module DTO/evidence boundaries be explicit and validated.

Required change: represent support-ring diagnostics as an authored contract, not an incidental extra object shape. A clean fix would add a backend-specific field such as `supportRingDiagnostics` on `MeshGenerationV6Metrics`, or a discriminated/typed support-ring diagnostics variant, then update operation-core Zod validation and provenance/evidence formatting or explicitly document which support-ring fields are intentionally not operation evidence. Add focused tests that parse preview provenance containing the support-ring diagnostics through operation-core.

### 2. Low: unrelated v6A test invariant was weakened

The v6A representative-fixture test now uses `expectValidMeshDtoAllowingOutsideBounds` at `packages/authoring-core/src/mesh-generation.test.ts:1288`. The outside-layer vertex allowance is a support-ring-specific requirement, while v6A is not part of Domain A's new support-ring method. This is not a production behavior regression by itself, but it weakens a pre-existing test in an unrelated method while Domain A's preservation target is old v6D.

Recommendation: keep the new outside-bounds helper for `auto-outline-v6d-contour-band-support-rings`, but restore the stricter helper for v6A unless there is a documented v6A contract change.

## Fix Loop 1 Re-review

### Original Finding 1: support-ring diagnostics contract

Status: resolved.

Fix Loop 1 added `MeshGenerationV6SupportRingDiagnostics` and `v6Metrics.supportRingDiagnostics` to the authored authoring-core metrics contract at `packages/authoring-core/src/mesh-quality-metrics.ts:172` and `packages/authoring-core/src/mesh-quality-metrics.ts:199`. The support-ring backend now keeps base Constrainautor fields separate from support-ring fields via `V6DSupportRingDiagnostics` at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:97`, and writes both `constrainautorDiagnostics` and `supportRingDiagnostics` into generated and fallback v6 metrics at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:635` and `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:705`.

Operation-core now validates support-ring diagnostics in preview provenance at `packages/operation-core/src/payloads/model-edit.ts:189` and wires that schema into v6 metrics at `packages/operation-core/src/payloads/model-edit.ts:272`. Operation provenance now formats support-ring diagnostics through `formatV6SupportRingDiagnosticsForTransformHistory` at `packages/operation-core/src/operations/generate-mesh.ts:571`, including ring counts, band counts, outside-layer state, offsets, and UV policy.

Coverage is adequate for this lane. Authoring-core tests assert backend-output support-ring diagnostics and fallback-output invalid-geometry diagnostics at `packages/authoring-core/src/mesh-generation.test.ts:2105` and `packages/authoring-core/src/mesh-generation.test.ts:2269`. Operation-core tests assert success provenance keys, blocked zero-valued support-ring keys, and previewMesh commit preservation at `packages/operation-core/src/operations/generate-mesh.test.ts:493`, `packages/operation-core/src/operations/generate-mesh.test.ts:1177`, and `packages/operation-core/src/operations/generate-mesh.test.ts:874`.

### Original Finding 2: unrelated v6A test weakening

Status: resolved.

The v6A representative-fixture test is back to the stricter `expectValidMeshDto` helper at `packages/authoring-core/src/mesh-generation.test.ts:1291`. The outside-bounds-permissive helper remains scoped to the support-ring backend at `packages/authoring-core/src/mesh-generation.test.ts:2075`, which matches the Domain A bounds policy.

### Final Findings

No remaining Design / Development Compliance findings after Fix Loop 1.

## Compliance Notes

- Source organization: mostly compliant. The new file has one cohesive algorithm responsibility. It is large, but not a catch-all file. Gnome reported `node scripts/check-source-organization.mjs` passing, and I did not find `index.ts` or broad helper-file misuse.
- Module boundary: acceptable with one watch item. The new backend imports `recoverV6DConstrainautorTriangles` from the old v6D file at `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts:210`; the old file exports this recovery API at `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts:207`. This does not rewrite old v6D, but if more backends reuse it, it should move to a shared constrainautor recovery module.
- Dependency policy: compliant. The candidate uses existing `delaunator` and `@kninnug/constrainautor` registry entries at `packages/authoring-core/src/mesh-generation-contract.ts:100`; manifest and lockfile diff is empty.
- Operation boundary: mutation still routes through operation-core. Provenance distinguishes method/source/output/fallback and now includes support-ring-specific diagnostics as typed, validated operation evidence.
- Determinism: covered in authoring-core tests for the new backend at `packages/authoring-core/src/mesh-generation.test.ts:2047`.
- DTO/schema/ID conventions: method/source/backend IDs are machine-readable and v6D-lineage. Fix Loop 1 resolved the support-ring diagnostic contract/schema gap.
- Forbidden scope: compliant. I found no public `v6g` IDs in production source, no new editor/renderer work, no new dependency diff, and no forbidden v6A earclip/fan/split/row-major strings in the new backend.

## Validation Reviewed

- Reviewed Gnome's recorded validation: authoring-core mesh-generation tests pass, operation-core generate-mesh tests pass, `pnpm.cmd typecheck` passes, source organization guard passes, and `git diff --check` passes with CRLF warnings only.
- Reviewed Fix Loop 1 validation: combined authoring-core and operation-core focused Vitest run passed 90 tests outside sandbox after the known esbuild EPERM sandbox failure; `pnpm.cmd typecheck` passed; source organization guard passed; `git diff --check` passed with CRLF warnings only; manifest/lockfile diff remained empty.
- Reran lightweight checks:
  - `git diff --check -- ...`: pass with CRLF working-copy warnings only.
  - manifest/lockfile diff: empty.
  - production `v6g` grep over changed production files: no matches.
  - forbidden v6A triangulation-string grep over the new backend: no matches.
- I did not rerun Vitest or typecheck because Orch-Sylph already recorded outside-sandbox passes after sandbox EPERM failures.

## Residual Risks

- Real-art visual quality remains a later Domain C / human visual review risk.
- The new support-ring implementation is a large single algorithm file; acceptable now, but future expansion should split shared constrainautor recovery and support-ring diagnostics rather than continuing to grow the file.
- Operation-core now has focused support-ring success, blocked, and preview provenance assertions. Remaining risk is limited to future expansion of the large support-ring file and visual tuning on real artwork.

## User-Decision Points

- None for this review lane after Fix Loop 1.
