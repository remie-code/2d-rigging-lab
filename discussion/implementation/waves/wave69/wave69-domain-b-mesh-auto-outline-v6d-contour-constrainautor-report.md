# Wave69 Domain B Report: V6D Contour + Constrainautor

- Verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-mesh-auto-outline-v6d-contour-constrainautor`
- Date: 2026-06-14
- Implementer: Gnome

## Implementation Summary

- Added `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`.
- Routed `auto-outline-v6d-contour-constrainautor` through the Domain A shared v6 contour candidate input.
- Implemented v6D all-point Delaunator triangulation over boundary + interior points.
- Recovered boundary constraints through `@kninnug/constrainautor` via the existing runtime wrapper.
- Added v6D sanitization for duplicate points, zero-length edges, crossing constraints, non-finite points, and deterministic point ordering.
- Added final filtered-triangle outside/crossing removal and boundary verification before returning `backend-output`.
- Added visible fallback metadata when v6D cannot preserve constraints or when contour/texture input is blocked.
- Reconciled the v6D shared candidate registry status to `implemented`.
- Added focused authoring-core tests for deterministic v6D backend output, invalid constraints, empty/missing alpha, outside/crossing triangle filtering, and a thin-tapered spoke-regression proxy.

## Files Changed

- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave69/wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md`

## Basis Coverage Self-Report

| Requirement | Status | Evidence |
|---|---|---|
| Use shared v6 contour salvage pipeline | implemented | v6D calls `createV6ContourCandidateInput` and preserves contour diagnostics in v6 metrics. |
| Validate duplicate points / zero-length edges / deterministic ordering | implemented | `sanitizeConstrainautorInput`; focused invalid-constraint tests. |
| Run Delaunator over boundary and interior points | implemented | `recoverV6DConstrainautorTriangles` runs `Delaunator.from([...sanitized.points])`. |
| Recover boundary constraints with Constrainautor | implemented | `constrainer.constrainAll(sanitized.constraintEdges)`. |
| Verify boundary preservation | implemented | v6D returns `backend-output` only after final filtered triangles preserve all constraint edges. |
| Filter outside/crossing triangles | implemented | `filterTrianglesToMainMask` removes outside/crossing triangles before success; focused probe test forces removal and independently checks no remaining outside/crossing triangles. |
| Surface backend diagnostics and quality metrics | implemented | v6 metrics include backend id, constraint counts, outside count, failure reason, and thrown error kind. |
| No unconstrained success label | implemented | missing constraints or empty filtered output become visible fallback, not backend success. |
| Avoid v6A triangulation | implemented | v6D file has no dependency on v6A triangulation helpers. |

## Mesh Generation Contract Trace

| Surface | Evidence |
|---|---|
| Method route | `createGeneratedMeshForDrawable` now dispatches v6D before deferred fallback. |
| Candidate registry | `auto-outline-v6d-contour-constrainautor` has `backendImplementationStatus: "implemented"`. |
| Source id | successful v6D returns `outline-v6d-contour-constrainautor-rgba`. |
| Output kind | successful constrained output uses `backend-output`; blocked/fallback paths use `blocked` or `fallback-output`. |
| Metrics | `triangulationMode` is `v6d-contour-delaunator-constrainautor`; v6D-specific `constrainautorDiagnostics` are populated. |
| Fallback | texture/empty alpha uses blocked metadata; constraint failure uses `alpha-aware-rgba` visible fallback. |

## Must-Not Compliance Evidence

- No default switch. Editor defaults were not edited.
- No dependency changes and no install command.
- No v6E/v6F implementation files were edited by this Domain B patch.
- No rendering files were edited by this Domain B patch.
- v6D source does not use `earClipPolygon`, fan fallback, `splitTrianglesWithInteriorPoints`, or row-major interior placement.
- v6D does not use V1-V5 triangulation internals as its algorithm basis.

## Validation

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts -t v6d --reporter=dot` | pass: 5 v6D tests passed; 49 skipped |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts -t "commits v6 candidates" --reporter=verbose` | fail outside Domain B: v6E currently returns `backend-output` while its registry status remains `deferred`; v6E ownership is Domain C. |
| `pnpm.cmd typecheck` | pass |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/mesh-generation-contract.ts packages/operation-core/src/operations/generate-mesh.test.ts discussion/implementation/waves/wave69/wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md` | pass; Git emitted existing CRLF working-copy warnings for edited package files |

Note: sandboxed Vitest attempts failed with esbuild `spawn EPERM`; approved outside-sandbox reruns were used for the recorded results.

## Intentionally Deferred Basis Items

- v6D does not implement hole constraints. It reports shared contour `holeHandling` metadata and filters against the main mask / outer constraints.
- v6D does not choose the final backend or update Editor selector UX. Domain E owns selector integration.

## Residual Risk Classification

- Low implementation risk for simple/curved/thin representative alpha fixtures: deterministic backend-output tests pass.
- Medium visual risk for complex concave or hole-like masks: v6D preserves outer constraints but does not model hole constraints in v0.
- Medium parallel-integration risk: the focused operation-core v6 candidate test is currently blocked by v6E registry/runtime mismatch outside Domain B.
- Low dependency risk: existing approved `delaunator` and `@kninnug/constrainautor` surfaces were reused.

## Required Integration Items For Domain E / Integrator

- Ensure Editor selector/provenance text treats successful v6D output as backend output, not deferred fallback.
- Preserve default `auto-outline-v2.6-soft-apron`.
