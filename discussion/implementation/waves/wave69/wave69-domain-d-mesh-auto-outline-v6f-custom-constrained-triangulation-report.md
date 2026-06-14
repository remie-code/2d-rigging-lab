# Wave69 Domain D Report: V6F Custom Constrained Triangulation

- Verdict: `pass`
- Wave: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Domain: `wave69-mesh-auto-outline-v6f-custom-constrained-triangulation`
- Date: 2026-06-14
- Implementer: Gnome

## Implementation Summary

- Added `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts`.
- Routed `auto-outline-v6f-contour-custom-cdt` through the shared Domain A contour candidate input.
- Implemented a repo-local custom triangulation path:
  - boundary and interior points are seeded before triangulation;
  - shared boundary constraint edges are inserted as fixed edges;
  - deterministic shortest valid non-crossing edges build a constrained planar graph;
  - triangular faces are extracted and locally improved with constrained-edge-preserving flips;
  - output is rejected/fallbacked if selected points are unused or boundary constraints are missing.
- Added focused v6F tests in `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts`.
- Updated existing `mesh-generation.test.ts` expectations so v6F is no longer treated as a deferred backend route.

## Fix Loop 1: Design / Development Review F-001

- Review finding: v6F had two authoritative implementation statuses because `V6_MESH_GENERATION_CANDIDATES` said `deferred` while the v6F route locally overrode the candidate to `implemented`.
- Fix applied:
  - changed only the v6F registry entry in `mesh-generation-contract.ts` to `backendImplementationStatus: "implemented"`;
  - removed the v6F local status override in `mesh-generation.ts`;
  - updated focused expectations so v6F is canonical `implemented` and no longer encoded as a deferred candidate.
  - updated the operation-core provenance test's v6F branch so TypeScript no longer sees v6F as a deferred candidate.
- v6D/v6E statuses and implementation files were not changed by this fix loop.

## Files Changed

- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts`
- `packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/waves/wave69/wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md`

## Basis Coverage Self-Report

| Basis / Requirement | Status | Evidence |
|---|---|---|
| Use shared v6 contour salvage pipeline | implemented | v6F calls `createV6ContourCandidateInput` and uses its boundary points, interior points, constraints, alpha bounds, mask, and diagnostics. |
| v6F is first-class candidate | implemented | `createGeneratedMeshForDrawable` now routes `auto-outline-v6f-contour-custom-cdt` to backend output when successful. |
| Custom triangulation, not v6A triangulation | implemented | New implementation uses constrained planar graph + local edge flips; no import from v6A and no discarded v6A triangulation helpers. |
| All selected points participate | implemented | v6F rejects output if any selected boundary/interior point is unused by final triangles. |
| Boundary edges are hard constraints | implemented | Boundary constraints are seeded before candidate edges, excluded from flips, verified after filtering, and missing constraints trigger fallback metadata. |
| Long boundary-to-boundary spokes reduced/counted | implemented | Long boundary chord candidates are counted, penalized in edge ordering, and focused tests assert no final long boundary chord on the rectangle fixture. |
| v6F custom metrics | implemented | `customCdtDiagnostics` reports edge flips, constraint recovery operations, long spoke candidates, rejected local improvements, missing/preserved constraints, and fallback reason. |
| Deterministic representative fixtures | implemented | v6F focused tests compare repeated output for simple rectangle, curved blob, thin tapered, and hole-like fixtures. |

## Intentionally Deferred Basis Items

- Full robust CDT for every pathological polygon is deferred. The v0 is a deterministic constrained planar triangulator with truthful fallback on missing constraints or unused selected points.
- Full hole boundary modeling is deferred. The shared pipeline reports hole-like regions; v6F filters by main mask centroid and records the shared hole limitation in metrics/provenance.
- Editor selector replacement and preview UI are deferred to Domain E.
- Final backend selection and default promotion remain out of scope.

## Mesh Generation Contract Trace

| Contract Surface | Evidence |
|---|---|
| Method route | `createGeneratedMeshForDrawable` handles `auto-outline-v6f-contour-custom-cdt` before the generic deferred fallback route. |
| Source id | Successful v6F output uses `outline-v6f-contour-custom-cdt-rgba`. |
| Output kind | Successful v6F output uses `outputKind: backend-output`; empty/missing input uses `blocked`; non-success triangulation uses visible fallback metadata. |
| Metrics | `triangulationMode: v6f-contour-custom-cdt`; `customCdtDiagnostics` includes required v6F custom fields. |
| Fallback | Missing texture and empty alpha are blocked with `texture-bytes-unavailable` / `alpha-empty`; custom failures carry `customTriangulationFallbackReason`. |
| DTO validity | Focused tests assert mesh vertices/UVs/stable IDs/triangles are valid and all selected points participate. |

## Must-not Compliance Evidence

- No dependency added; manifest and lockfile untouched by Domain D.
- Editor default was not changed.
- No Editor, operation-core, render-core, or render-webgl2 files were edited by Domain D.
- Did not edit v6D or v6E implementation files.
- Did not import or call v6A implementation.
- Firebreak search:
  - `rg -n "earClipPolygon|triangulateBoundaryFan|splitTrianglesWithInteriorPoints|row-major|v6a-local-earclip|v6a-local-deterministic-interior|fan fallback" packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts`
  - result: no matches.

## Validation

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts --reporter=dot` | sandbox `spawn EPERM`; approved outside-sandbox rerun passed: 1 file / 3 tests |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | passed: 1 file / 54 tests |
| `pnpm.cmd typecheck` | passed |
| `node scripts/check-source-organization.mjs` | passed |
| `node scripts/check-dependencies.mjs` | passed |
| firebreak `rg` command above | no matches |
| `git diff --check -- packages/authoring-core/src/mesh-generation-contract.ts packages/authoring-core/src/mesh-generation.ts packages/authoring-core/src/mesh-generation.test.ts packages/authoring-core/src/mesh-generation-v6f-custom-cdt.ts packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts packages/operation-core/src/operations/generate-mesh.test.ts discussion/implementation/waves/wave69/wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md` | passed; Git emitted CRLF working-copy warnings for existing package files |

Fix loop 1 validation:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation-v6f-custom-cdt.test.ts --reporter=dot` | passed: 1 file / 3 tests |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | passed: 1 file / 54 tests |
| `pnpm.cmd typecheck` | passed after updating v6F registry/route/test status consistency |
| firebreak `rg` command above | no matches |
| scoped `git diff --check` command above | passed; Git emitted CRLF working-copy warnings for existing package files |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | attempted because the test file needed a v6F expectation update; failed on v6E provenance expectations that still see registry/route status disagreement outside Domain D |

## Residual Risk Classification

- Medium geometry risk: v6F is intentionally small v0 custom triangulation, not a complete industrial CDT implementation.
- Medium hole risk: hole-like alpha is represented through mask filtering and limitation metadata, not explicit inner-loop constraints.
- Low contract risk for headless generation: focused tests cover deterministic backend output, blocked metadata, constraints, point participation, and long-spoke accounting.
- Low dependency/source risk: source organization and dependency guards passed.
- Cross-domain test risk: `packages/operation-core/src/operations/generate-mesh.test.ts` currently fails on v6E registry/route status mismatch after Domain C work. Domain D did not change v6E status or implementation files.

## Integration Needs For Domain E

- Domain E can expose v6F as a first-class selectable backend using the existing method id.
- No default switch is needed or made.
