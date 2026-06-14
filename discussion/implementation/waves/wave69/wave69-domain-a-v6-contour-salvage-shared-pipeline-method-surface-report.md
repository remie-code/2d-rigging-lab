# Wave69 Domain A Report: V6 Contour Salvage Shared Pipeline / Method Surface

- Verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-v6-contour-salvage-shared-pipeline-method-surface`
- Date: 2026-06-14
- Implementer: Gnome

## Implementation Summary

- Added v6D/E/F method IDs:
  - `auto-outline-v6d-contour-constrainautor`
  - `auto-outline-v6e-contour-poly2tri`
  - `auto-outline-v6f-contour-custom-cdt`
- Added v6D/E/F source IDs:
  - `outline-v6d-contour-constrainautor-rgba`
  - `outline-v6e-contour-poly2tri-rgba`
  - `outline-v6f-contour-custom-cdt-rgba`
- Added `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts` as the shared contour salvage pipeline.
- Routed deferred v6D/E/F headless generation through the shared contour pipeline and explicit `v6-backend-not-implemented` fallback metadata.
- Extended v6 metrics and operation preview schema with shared contour pipeline diagnostics and v6F custom CDT diagnostics.
- Kept v6A/v6B/v6C headless compatibility intact.
- Did not change Editor default or visible selector behavior.

## Fix Loop 1: Test Adequacy Review

- Review artifact: `discussion/implementation/reviews/wave69/wave69-domain-a-test-adequacy-review.md`
- Addressed v6D/E/F blocked-path coverage by adding authoring-core assertions for empty-alpha and missing-texture metadata:
  - `fallbackReason`
  - `fallbackSteps`
  - `outputKind=blocked`
  - no `backend-output`
  - contour blocked diagnostics for empty alpha
  - zeroed backend-specific diagnostics for D/E/F
- Added Operation Core provenance assertions for v6D/E/F empty-alpha and missing-texture commits, including blocked output and backend-specific diagnostic history.
- Extended shared contour fixture coverage to assert `candidateInput.alphaBounds` is deterministic, non-empty, inside texture/mesh bounds, stage-mapped from pixel bounds, and contains the fixture opaque pixel bounds.

## Files Changed

- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave69/_map.md`
- `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md`

## Basis Coverage Self-Report

| Basis / Requirement | Status | Evidence |
|---|---|---|
| Wave69 plan Domain A | implemented | v6D/E/F method/source IDs, shared contour pipeline, deferred route metadata, tests. |
| v6D/v6E/v6F design doc | implemented for Domain A | Shared pipeline covers soft mask, component selection, boundary loop trace, outer loop selection, boundary sampling, constraints, interior/Steiner contract. Backend algorithms deferred to B/C/D. |
| Mesh design map | implemented | v6A is salvaged only for contour behavior; v6D/E/F are added as current candidate surfaces. |
| Wave68 final report/review | preserved | v6A/B/C remain compatible; default remains V2.6; no dependency install. |
| UX-backed package logic authority | implemented | Package contract/schema changed because accepted mesh-generation contract requires package-level method/source allowlists. |
| Source file organization policy | implemented | New pipeline is a named responsibility file; `index.ts` change is re-export only; source guard passed. |
| Dependency policy | implemented | No new dependency or install; dependency guard passed. |
| Operation policy | implemented | Operation allowlist/schema and provenance path accept v6D/E/F through Operation Core. |
| Schema and ID conventions | implemented | New IDs are machine-readable kebab-case/lowercase tokens with no spaces. |

## Intentionally Deferred Basis Items

- v6D Constrainautor backend execution is deferred to Domain B. Domain A returns explicit fallback metadata, not backend success.
- v6E Poly2Tri backend execution is deferred to Domain C. Domain A returns explicit fallback metadata, not backend success.
- v6F custom CDT backend execution is deferred to Domain D. Domain A only defines metrics/diagnostic shape and method/source surface.
- Editor visible selector replacement from v6A/B/C to v6D/E/F is deferred to Domain E. Domain A did not modify `apps/editor/**`.
- Final backend selection and default promotion are out of scope.

## Mesh Generation Contract Trace

| Contract Surface | Evidence |
|---|---|
| Method allowlist | `V6_MESH_GENERATION_METHOD_IDS` and `MESH_GENERATION_METHOD_IDS` include v6D/E/F. |
| Source allowlist | `V6_MESH_GENERATION_SOURCE_IDS` and `DRAWABLE_GENERATED_MESH_SOURCE_IDS` include v6D/E/F source IDs. |
| Backend metadata | `V6_MESH_GENERATION_BACKEND_IDS` and `V6_MESH_GENERATION_CANDIDATES` include D/E/F as deferred candidates. |
| Headless routing | `createGeneratedMeshForDrawable` routes unknown v6 methods to `createV6DeferredFallbackMeshResult`; D/E/F now run shared contour extraction before fallback. |
| Operation allowlist | `GenerateMeshPayloadSchema` uses authoring-core method IDs; v6 metrics schema uses authoring-core v6 method/source/backend arrays. |
| Shared candidate input | `V6ContourCandidateInput` carries boundary points, constraint edges, interior points, alpha bounds, main mask, and diagnostics. |
| Shared metrics | `MeshGenerationV6Metrics` carries contour pipeline diagnostics plus Constrainautor, Poly2Tri, and custom CDT diagnostics. |
| Tests | Authoring tests assert deterministic contour/constraint output; operation tests commit v6 candidates and inspect v6D/E/F fallback diagnostics. |

## Must-Not Compliance Evidence

- Default unchanged:
  - `apps/editor/src/features/editor-session/model/mesh-tool-state.ts` still sets `DEFAULT_MESH_GENERATION_METHOD` to `auto-outline-v2.6-soft-apron`.
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts` still defaults generate mesh commands to `auto-outline-v2.6-soft-apron`.
- v6A triangulation firebreak:
  - Shared pipeline does not import `mesh-generation-v6a-local.ts`.
  - `rg -n "earClipPolygon|triangulateBoundaryFan|splitTrianglesWithInteriorPoints|row-major|v6a-local-earclip|v6a-local-deterministic-interior" packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts` returned no matches.
  - Shared pipeline provenance uses `v6-contour-farthest-interior-steiner-sampling`, not v6A row-major/earclip naming.
- Rendering untouched:
  - No edits under `packages/render-core/**`, `packages/render-webgl2/**`, or rendering files.
- Editor scope untouched:
  - No edits under `apps/editor/**`.
- Dependency policy:
  - No `pnpm install`.
  - No manifest or lockfile changes.

## Validation

| Command | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | sandbox failed with esbuild `spawn EPERM`; approved outside-sandbox rerun passed: 1 file / 46 tests |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | sandbox failed with esbuild `spawn EPERM`; approved outside-sandbox rerun passed: 1 file / 29 tests |
| `node scripts/check-source-organization.mjs` | pass |
| `node scripts/check-dependencies.mjs` | pass |
| `git diff --check -- packages/authoring-core packages/operation-core discussion/implementation/waves/wave69` | pass; Git emitted CRLF working-copy warnings for edited package files |

## Residual Risk Classification

- Low implementation risk for Domain A surfaces: typecheck, focused tests, source organization, and dependency guards pass.
- Medium downstream integration risk: Domains B/C/D may need to extend diagnostics once real backend success paths exist, especially split-boundary constraints and v6F quality metrics.
- Low UX risk in Domain A: Editor visible selector still shows Wave68 choices until Domain E, intentionally unchanged.

## Requested Follow-Up

- Domain B should replace v6D deferred fallback with Delaunator + Constrainautor backend output and populate preserved/missing constraint diagnostics.
- Domain C should replace v6E deferred fallback with Poly2Tri backend output and populate polygon/hole validation diagnostics.
- Domain D should replace v6F deferred fallback with the custom all-points constrained triangulation backend and populate custom CDT diagnostics.
- Domain E should update the temporary Editor selector from v6A/B/C to v6D/E/F while keeping the default at V2.6.
