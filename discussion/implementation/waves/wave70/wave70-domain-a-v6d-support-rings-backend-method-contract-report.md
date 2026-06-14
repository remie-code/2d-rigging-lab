# Wave70 Domain A Report: v6D Support-Ring Backend / Method Contract

- Verdict: `pass`
- Fix Loop 1 Verdict: `pass`
- Domain: `wave70-v6d-support-rings-backend-method-contract`
- Date: 2026-06-14
- Implementer: Gnome

## Files Changed

- `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts`
  - New improved v6D support-ring backend implementation.
- `packages/authoring-core/src/mesh-generation-contract.ts`
  - Added method/source/backend IDs and support-ring fallback reasons.
- `packages/authoring-core/src/mesh-generation.ts`
  - Routed the new method through public drawable mesh generation and blocked metadata.
- `packages/authoring-core/src/mesh-quality-metrics.ts`
  - Added typed `MeshGenerationV6SupportRingDiagnostics` and `v6Metrics.supportRingDiagnostics`.
- `packages/authoring-core/src/mesh-generation.test.ts`
  - Added support-ring backend, diagnostics, bounds/UV, filter, fallback-output, blocked metadata, and old-v6D preservation coverage; restored old v6A strict DTO validation.
- `packages/operation-core/src/payloads/model-edit.ts`
  - Added Zod validation for support-ring diagnostics in preview provenance quality metrics.
- `packages/operation-core/src/operations/generate-mesh.ts`
  - Added support-ring diagnostics to operation transform history.
- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - Added support-ring success, blocked, and preview provenance assertions.
- `discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md`
  - This report.
- `discussion/implementation/waves/wave70/_map.md`
  - Wave70 local implementation artifact map.

No manifest or lockfile changes were made.

## Basis Coverage Self-Report

| Basis item | Status | Evidence |
|---|---|---|
| New method id `auto-outline-v6d-contour-band-support-rings` | Implemented | Contract registry and public dispatch route. |
| New source id `outline-v6d-contour-band-support-rings-rgba` | Implemented | Contract registry, successful generated source tests. |
| New implementation file | Implemented | `mesh-generation-v6d-contour-band-support-rings.ts`. |
| Preserve current v6D | Implemented | Old file untouched; old v6D tests still pass. |
| Reuse shared v6 contour pipeline | Implemented | New backend calls `createV6ContourCandidateInput`. |
| Outer support ring, alpha boundary ring, inner support ring when safe | Implemented | Ring diagnostics report outer/alpha/inner counts; unsafe inner rings are skipped and diagnosed. |
| Preset tuning affects offsets | Implemented | Low/Standard/Large offset test added. |
| Vertices may extend outside layer bounds while UVs stay valid | Implemented | New bounds/UV test passes. |
| Triangle filtering allows support-band triangles outside alpha | Implemented | New filter probe test passes. |
| Structured fallback/blocked metadata | Implemented | Blocked metadata tests pass; support-ring geometry fallback-output probe reports method-specific fallback reason and typed diagnostics. |
| Typed support-ring diagnostics contract | Implemented in Fix Loop 1 | `MeshGenerationV6SupportRingDiagnostics`, operation-core Zod schema, and transform-history formatter added. |
| Operation-core support-ring provenance | Implemented in Fix Loop 1 | Success, blocked empty-alpha, blocked missing-texture, and preview provenance tests assert support-ring-specific keys. |
| No new dependency | Implemented | No manifest or lockfile changes. |

## Intentionally Deferred Basis Items

- Full robust offset-curve geometry for every pathological silhouette remains deferred; the implementation favors deterministic safe construction and skips unsafe inner rings.
- Full multi-island and hole triangulation remain outside Domain A v0; existing shared pipeline records main-island / hole diagnostics.
- Editor default switch and selector removal are Domain B scope.
- Renderer padding/dilation/texture filtering work is out of scope and untouched.
- Human visual quality review remains a later integration concern.

## Mesh Generation Contract Trace

- Contract:
  - `V6_MESH_GENERATION_METHOD_IDS` includes `auto-outline-v6d-contour-band-support-rings`.
  - `V6_MESH_GENERATION_SOURCE_IDS` includes `outline-v6d-contour-band-support-rings-rgba`.
  - `V6_MESH_GENERATION_BACKEND_IDS` includes `v6d-contour-band-support-rings`.
  - Candidate entry is `implemented` and depends only on already-approved `delaunator` and `@kninnug/constrainautor`.
- Public route:
  - `createGeneratedMeshForDrawable` dispatches the new method to the new implementation.
  - Missing texture / empty alpha routes remain blocked output, not backend output.
- Output metadata:
  - Backend output uses `actualSourceId: outline-v6d-contour-band-support-rings-rgba`.
  - Fallback output uses visible fallback metadata with method-specific fallback reasons.
  - Blocked output uses `outputKind: blocked` and the new method/source/backend IDs.
  - Base Constrainautor recovery fields remain in `v6Metrics.constrainautorDiagnostics`.
  - Support-ring point counts, skipped/merged counts, band/interior triangle counts, outside-layer state, offsets, and UV policy live in `v6Metrics.supportRingDiagnostics`.
  - Operation provenance records both Constrainautor and support-ring diagnostics.

## Fix Loop 1 Changes

| Review finding | Fix |
|---|---|
| Support-ring diagnostics were runtime extras on `constrainautorDiagnostics`. | Added typed `MeshGenerationV6SupportRingDiagnostics`, moved support-ring fields into `supportRingDiagnostics`, updated operation-core Zod payload validation and provenance formatting. |
| Missing fallback-output coverage. | Added `probeV6DSupportRingGeometryFallbackForTest` and an authoring-core test for `v6d-support-ring-geometry-invalid` fallback output with structured diagnostics. |
| Operation-core support-ring provenance underasserted. | Added support-ring backend success assertions, included support-ring backend in empty/missing blocked provenance tests, and added preview provenance coverage. |
| Old v6A baseline was weakened. | Restored `expectValidMeshDto` for old v6A representative fixtures and removed duplicated alpha-bounds check. |

## Review Results

| Review lane | Final verdict | Notes |
|---|---|---|
| Spec Compliance Review | `pass` | Passed initially and remained pass after Fix Loop 1 re-review. |
| Design / Development Compliance Review | `pass` | Initial `needs_changes`; Fix Loop 1 resolved typed diagnostics/provenance and v6A test-baseline findings. |
| Test Adequacy Review | `pass` | Initial `needs_changes`; Fix Loop 1 resolved fallback-output, old-v6A baseline, and operation-core provenance coverage findings. |

## Must-Not Compliance Evidence

- Did not edit `apps/editor/**`.
- Did not edit or rewrite `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`; it remains the old v6D baseline.
- Did not remove old v6D/v6E/v6F methods.
- Did not edit renderer packages or reopen padding/dilation work.
- Did not add dependencies or touch manifests/lockfiles.
- Did not add public `v6g` method/source IDs.
- Did not use v6A ear clipping, fan fallback, or row-major interior placement for the new backend.

## Validation Performed

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | Pass, 59 tests. Initial sandbox run failed with esbuild `spawn EPERM`; outside-sandbox rerun passed. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Pass, 29 tests. Sandbox run failed with esbuild `spawn EPERM`; outside-sandbox rerun passed. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Fix Loop 1 pass, 90 tests. Sandbox run failed with esbuild `spawn EPERM`; outside-sandbox rerun passed. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `git diff --check -- packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts packages/authoring-core/src/mesh-quality-metrics.ts packages/authoring-core/src/mesh-generation-contract.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/payloads/model-edit.ts packages/operation-core/src/operations/generate-mesh.ts packages/operation-core/src/operations/generate-mesh.test.ts discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md discussion/implementation/waves/wave70/_map.md` | Fix Loop 1 pass; CRLF working-copy warnings only. |

`node scripts/check-dependencies.mjs` was not run because no dependency manifest, lockfile, dependency registry, or dependency-related file changed.

## Residual Risk Classification

- Residual risk: `medium-low`.
- Reason: backend contract, deterministic output, fallback/blocked metadata, and focused tests are covered; visual mesh quality still needs Domain C / human review on real artwork.
- Geometry risk: narrow or concave silhouettes may skip the inner ring rather than forcing invalid geometry. This is recorded in diagnostics and is preferred over misleading success.

## User-Decision Points

- None for Domain A implementation.
- Later visual review should decide whether support-ring offsets need tuning before final default promotion.
