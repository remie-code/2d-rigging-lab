# Wave69 Domain C Report: V6E Contour + Poly2Tri

- Verdict: `done`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-mesh-auto-outline-v6e-contour-poly2tri`
- Date: 2026-06-14
- Implementer: Gnome

## Implementation Summary

- Added `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts`.
- Implemented `auto-outline-v6e-contour-poly2tri` over Domain A's shared `createV6ContourCandidateInput` pipeline.
- Used `poly2tri.SweepContext` with sampled outer contour points and shared interior points as Steiner points.
- Added v6E quantization, contour/interior dedupe, simple polygon validation, winding normalization, triangle cleanup, boundary edge verification, and visible blocked output for invalid inputs.
- Routed headless v6E generation in `packages/authoring-core/src/mesh-generation.ts`.
- Added focused v6E tests in `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts`.
- Updated the existing deferred-candidate test so v6E is no longer expected to use the non-success deferred fallback path.

## Fix Loop 1 Summary

- Addressed `C-TA-001` by adding public `createGeneratedMeshForDrawable` v6E route tests for:
  - `v6-curved-blob` backend success with source `outline-v6e-contour-poly2tri-rgba`, no fallback, backend output metrics, Poly2Tri diagnostics, and preserved boundary diagnostics;
  - `v6-hole-like` visible non-success fallback metadata without `backend-output`;
  - empty alpha and missing texture blocked metadata without `backend-output`.
- Addressed `C-TA-001` dead-code coverage by removing unreachable v6E assertions from the still-deferred candidate loop.
- Addressed `C-TA-002` by adding a reversed-winding probe that captures the normalized contour order passed to Poly2Tri and fails if normalization is removed.
- Addressed `C-TA-002` by adding a boundary-missing generated-triangle probe that returns blocked `v6e-poly2tri-generation-failed` diagnostics instead of silent success.
- Addressed `C-TA-003` by locally marking v6E generated metrics and v6E routing/fallback metrics as `backendImplementationStatus: "implemented"` without editing `mesh-generation-contract.ts`, then asserting that status in v6E direct and public route tests.

## Files Changed

- `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts`
- `packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md`

Note: `mesh-generation.ts` and `mesh-generation.test.ts` also contain concurrent v6D changes from Domain B. Domain C did not revert them.

## Approach

- Input source: shared v6 contour candidate input only.
- Backend: `poly2tri`; no new dependency and no dependency install.
- Points:
  - boundary and Steiner points are rounded to stable precision;
  - contour points are deduped, short-edge cleaned, collinear cleaned, and normalized to positive winding;
  - interior points are deduped against boundary points and filtered to the main mask / polygon interior.
- Failure handling:
  - invalid polygon preconditions return `blocked` with `polygonValidationFailed`;
  - `poly2tri` throws return `blocked` with `triangulationThrown`;
  - missing boundary edges return non-success `v6e-poly2tri-generation-failed`;
  - hole-like inputs return blocked output with `holeHandling=unsupported-fallback`, `holeValidationFailed=true`, and `limitation-hole-regions-reported` provenance.
- Multi-island handling:
  - relies on Domain A main-island-only candidate input;
  - reports `multiIslandHandling=main-island-only` and `mainIslandOnlyFallback=true` when the shared pipeline reports multiple components.

## Basis Coverage Self-Report

| Requirement | Status | Evidence |
|---|---|---|
| Use shared v6 contour salvage pipeline | implemented | v6E calls `createV6ContourCandidateInput`; no v6A import. |
| Use `poly2tri` | implemented | v6E uses `poly2tri.SweepContext`. |
| Quantize/dedupe contour/interior points | implemented | v6E sanitize helpers and focused sanitization probe test. |
| Validate simple polygon preconditions | implemented | `validateSimplePolygon`; invalid polygon probe test. |
| Normalize winding | implemented | `sanitizePolygonLoop` normalizes positive winding before triangulation. |
| Use interior samples as Steiner points | implemented | shared interior points are passed through `sweepContext.addPoints`. |
| Hole/multi-island limitation visible | implemented | hole-like fixture blocks with hole diagnostics; multi-island metadata is carried from shared pipeline. |
| Polygon validation failure visible | implemented | blocked result and probe test; not reported as backend success. |
| Backend diagnostics/quality metrics populated | implemented | v6 metrics include contour pipeline and Poly2Tri diagnostics on success and failure. |
| Browser/Vite import behavior stable | implemented with evidence | kept existing `import * as poly2tri from "poly2tri"` style; typecheck and Vitest config load passed outside sandbox. |

## Must-Not Compliance Evidence

- No `pnpm install` was run.
- No v6D or v6F implementation file was edited by Domain C.
- Editor default was not touched.
- v6E production file does not import or reference v6A implementation.
- v6A triangulation firebreak:
  - production check: `rg -n "earClipPolygon|triangulateBoundaryFan|splitTrianglesWithInteriorPoints|row-major|v6a-local-earclip|v6a-local-deterministic-interior" packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts` returned no matches.
- V1-V5 algorithms were not used as algorithmic source.

## Verification

| Command | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | sandbox failed with esbuild `spawn EPERM`; approved outside-sandbox rerun passed: 2 files / 59 tests |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.ts packages/authoring-core/src/mesh-generation-v6e-contour-poly2tri.test.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-generation.test.ts discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md` | pass for tracked diff; Git emitted CRLF working-copy warnings for existing package files. Because the v6E implementation/test and report are untracked, each was also checked with `git diff --check --no-index -- /dev/null <file>`; those commands emitted only CRLF warnings and exited non-zero because `/dev/null` differs from the files. |

## Residual Risks

- v6E blocks hole-like masks instead of implementing true holes because the shared contour pipeline does not expose hole loops.
- `mesh-generation-contract.ts` still records v6E `backendImplementationStatus` as `deferred`; Domain C did not edit shared contract status because the candidate registry status flip remains a Domain E/shared contract integration item.
- `mesh-generation.ts` and `mesh-generation.test.ts` have concurrent v6D changes from Domain B; Domain C worked with them but did not review v6D behavior.

## Integration Items

- Domain E or the shared contract owner should decide whether to flip v6E's `V6_MESH_GENERATION_CANDIDATES` `backendImplementationStatus` from `deferred` to `implemented`.
- If future UX needs a clearer user-facing reason for hole-like v6E fallback, add a contract fallback reason such as `v6e-poly2tri-hole-unsupported`; Domain C used existing allowed reasons and exposed hole diagnostics instead.
