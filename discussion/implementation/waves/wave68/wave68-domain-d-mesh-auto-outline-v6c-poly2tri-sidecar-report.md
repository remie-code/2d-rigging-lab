# Wave68 Domain D Report: Mesh Auto Outline V6C Poly2Tri Sidecar

- Status: complete / pass
- Wave: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Domain: `wave68-mesh-auto-outline-v6c-poly2tri-sidecar`
- Date: 2026-06-14
- Owner: Orch-Sylph
- Implementation agent: Gnome `019ec45c-36c2-7771-9d1d-bf88c4c4edd7`
- Review agents:
  - Spec Compliance Review: Review-Sylph `019ec478-8ecf-7fa0-8923-1b4f24c974c5`
  - Design / Development Compliance Review: Review-Sylph `019ec478-a2e0-7840-958b-f872b5c83e03`
  - Test Adequacy Review: Review-Sylph `019ec478-b6cf-7973-8514-e4e2c32a65ac`

## Verdict

`pass`

Domain D implements `auto-outline-v6c-poly2tri` as a real `poly2tri` sidecar backend. It produces deterministic backend output for simple outer polygon fixtures with Steiner points, exposes v6c diagnostics, and returns visible fallback metadata for holes, near-touching holes, multiple islands, invalid polygon, `poly2tri` throw, missing boundary, empty alpha, and missing bytes.

Initial Spec Compliance and Test Adequacy reviews returned `needs_changes`. Fix Loop 1 added v6c negative-path coverage and operation fallback provenance coverage. Spec re-review then requested near-duplicate contour-point evidence. Fix Loop 2 added v6c-local sanitization evidence. Spec Compliance, Design / Development Compliance, and Test Adequacy are now final `pass`.

## Current-State Confirmation

- Domain A was complete / pass before Domain D started. It established shared v6 method/source ids, dependency gate state, diagnostics shape, dependency registry entries, and fixture helpers.
- Domain B was complete / pass before Domain D started. It implemented `auto-outline-v6a-local` and shared v6 local groundwork.
- The user reported `pnpm install` had already been run. Domain D did not run `pnpm install`.
- `poly2tri@1.5.0` was present under the authoring-core dependency context.
- The worktree was dirty before Domain D with Domain A/B artifacts and unrelated Editor/old-algorithm changes.
- Domain C ran concurrently and introduced v6b files/changes in the shared worktree. Domain D review and reporting treat v6b files as concurrent Domain C unless they directly affect v6c routing/tests.

## Scope Changed

Domain D-owned source/test changes:

- `packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts`
  - New v6c backend.
  - Builds soft alpha mask, selects main component, samples the outer boundary, samples deterministic Steiner points, validates simple polygon preconditions, calls `poly2tri.SweepContext`, verifies boundary-edge preservation, and reports blocked fallback for unsupported or invalid states.
  - Fix Loop 1 added a narrow exported test probe for defensive invalid polygon / throw / boundary-missing branches. Fix Loop 2 added a narrow exported sanitization probe for near-duplicate contour points. These probes are not re-exported from `index.ts`.
- `packages/authoring-core/src/mesh-generation.ts`
  - Routes `auto-outline-v6c-poly2tri` from deferred fallback to the v6c backend result.
  - Converts v6c blocked backend results to visible alpha-aware fallback metadata.
- `packages/authoring-core/src/mesh-generation-contract.ts`
  - Marks v6c as `implemented`.
  - Adds v6c fallback reasons.
- `packages/authoring-core/src/mesh-quality-metrics.ts`
  - Adds `v6c-poly2tri-constrained-polygon` triangulation mode and v6c diagnostics fields.
- `packages/authoring-core/src/mesh-generation.test.ts`
  - Adds deterministic v6c success tests, DTO invariant checks, diagnostics checks, hole / near-touching-hole / multi-island fallback tests, missing-byte fallback checks, Fix Loop 1 negative-path probe tests, and Fix Loop 2 near-duplicate sanitization tests.
- `packages/operation-core/src/operations/generate-mesh.test.ts`
  - Updates operation provenance expectations for implemented v6c success.
  - Fix Loop 1 adds v6c hole-limitation fallback provenance coverage.

Concurrent / not attributed to Domain D:

- `packages/authoring-core/src/mesh-generation-v6b-constrainautor*.{ts,js,d.ts}` and v6b-specific tests/provenance are treated as Domain C work.
- Pre-existing `apps/editor/**`, old mesh algorithm files, manifests, lockfile, dependency registry, and tmp logs are preserved and not attributed to Domain D.

## Implementation Summary

Successful v6c generation now reports:

- `source: "outline-v6c-poly2tri-rgba"`
- `triangulationMode: "v6c-poly2tri-constrained-polygon"`
- `backendImplementationStatus: "implemented"`
- `outputKind: "backend-output"`
- `fallbackSteps: []`
- boundary and Steiner point counts
- `poly2triDiagnostics` with dependency gate, outer point count, hole count, Steiner point count, validation flags, triangulation thrown flag, and boundary preserved/missing counts.

Visible fallback behavior:

- Empty alpha and missing bytes are blocked with existing v6 fallback metadata.
- Hole and near-touching-hole masks return `v6c-poly2tri-hole-unsupported`.
- Multiple islands return `v6c-poly2tri-multi-island-unsupported` with `mainIslandOnlyFallback: true`.
- Invalid polygon, `poly2tri` throw, and boundary-missing defensive branches return blocked probe/test evidence and do not claim backend output.
- Near-duplicate contour points are covered by a v6c sanitization probe: a five-point loop with one point inside the short-edge threshold sanitizes to four valid points before validation, then triangulates through the same poly2tri probe path with no missing boundary edges.

## Contract Trace

```text
createGeneratedMeshForDrawable
  -> method auto-outline-v6c-poly2tri
  -> createAutoOutlineV6CPoly2TriMesh
  -> soft alpha mask / main component / boundary sampling / Steiner sampling
  -> polygon validation
  -> poly2tri SweepContext triangulation
  -> boundary preservation verification
  -> valid Mesh DTO with outline-v6c-poly2tri-rgba
     OR visible alpha-aware/bounds-grid fallback with v6c diagnostics

generateMesh operation
  -> accepts v6c through shared method ids
  -> commits through operation-core mutation path
  -> records v6c source/fallback/diagnostics in transform history
```

## Dependency Import And Runtime Evidence

`poly2tri` dependency evidence:

- Domain A recorded `poly2tri@1.5.0` as BSD-3-Clause and approved for `runtime:packages/authoring-core:v6-candidate-backend`.
- `packages/authoring-core/package.json` already contained `poly2tri`; Domain D did not edit manifests or lockfile.
- From `packages/authoring-core`, CommonJS `require("poly2tri")` exposed `SweepContext` and `Point` as functions.
- From `packages/authoring-core`, dynamic `import("poly2tri")` exposed named/default interop with `SweepContext`.
- Focused Vitest exercised the production v6c import path through Vite/Vitest transform.
- Parent verification ran `pnpm.cmd exec vite build --outDir ../../tmp/vite-v6c-poly2tri-build --emptyOutDir` from `apps/editor`.
  - Sandbox run hit Windows `esbuild spawn EPERM`.
  - Approved rerun passed: Vite transformed 2182 modules and produced a production bundle in `tmp/vite-v6c-poly2tri-build`.
  - Temporary build output was removed after verification.

## Review Lanes

| Lane | Initial verdict | Current status | Notes |
|---|---|---|---|
| Spec Compliance Review | `needs_changes` | final `pass` after Fix Loop 2 | Missing report, browser/Vite evidence gap, and fixture/failure evidence gap were resolved. Fix Loop 1 added negative-path evidence; Fix Loop 2 added near-duplicate sanitization evidence. |
| Design / Development Compliance Review | `pass` | final `pass`; regression re-reviews passed | No blocking findings. Fix Loop 1/2 probe additions stayed v6c-local and not barrel-exported. |
| Test Adequacy Review | `needs_changes` | final `pass` after Fix Loop 2 direct-regression re-review | Fix Loop 1 added v6c negative-path tests and operation fallback provenance coverage. Fix Loop 2 further increased focused coverage without regressions. |

Review artifacts:

- [Spec Compliance Review](../../reviews/wave68/wave68-domain-d-spec-compliance-review.md)
- [Design / Development Compliance Review](../../reviews/wave68/wave68-domain-d-design-development-review.md)
- [Test Adequacy Review](../../reviews/wave68/wave68-domain-d-test-adequacy-review.md)

## Verification

Gnome / Review-Sylph / parent verification:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Initial sandbox run hit Windows `esbuild spawn EPERM`; approved rerun passed before Fix Loop 1, 2 files / 61 tests. |
| Fix Loop 1 same focused Vitest command | Initial sandbox run hit Windows `esbuild spawn EPERM`; approved rerun passed, 2 files / 63 tests. |
| Fix Loop 2 `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | Initial sandbox run hit Windows `esbuild spawn EPERM`; approved rerun passed, 1 file / 44 tests. |
| Fix Loop 2 focused authoring + operation Vitest command | Initial sandbox run hit Windows `esbuild spawn EPERM`; approved rerun passed, 2 files / 69 tests. |
| `pnpm.cmd typecheck` | pass. |
| `pnpm.cmd exec tsc --noEmit --pretty false` | pass during Fix Loop 1. |
| `node scripts/check-source-organization.mjs` | pass. |
| `node scripts/check-dependencies.mjs` | pass. |
| scoped `git diff --check` on Domain D changed files | pass, LF/CRLF warnings only. |
| `git diff --no-index --check -- NUL packages/authoring-core/src/mesh-generation-v6c-poly2tri.ts` | no whitespace diagnostics; nonzero exit was expected because the file is new. |
| `pnpm.cmd exec vite build --outDir ../../tmp/vite-v6c-poly2tri-build --emptyOutDir` from `apps/editor` | Sandbox `esbuild spawn EPERM`; approved rerun passed, 2182 modules transformed. |

No `pnpm install` was run.

## Must-Not Compliance

- Domain D did not switch the default mesh method to v6c.
- Domain D did not edit `apps/editor/**`, render packages, package manifests, lockfile, or dependency registry.
- Domain D did not use V1-V5/grid/envelope/apron/contour-band/recursive-ring implementations as v6c algorithm reference.
- Old mesh-generation code was read only for public DTO/routing/fallback/metrics seams.
- Invalid polygon, thrown triangulation, missing boundary, hole, and multi-island cases are not labeled as successful `poly2tri` backend output.
- Hole and multi-island limitations are visible in fallback metadata and diagnostics.
- No Cubism SDK/Core, Cubism parser, proprietary runtime, or Cubism compatibility claim was added.

## Deferred Items

Deferred by plan or explicit v0 limitation:

- Full hole triangulation support in v6c.
- Deterministic per-island merge for multiple islands.
- Final backend selection.
- Editor temporary backend selector and UI provenance: Domain E.
- Switching the default to any v6 candidate.
- Human visual/editability judgment.

## Residual Risk

- Algorithm quality risk: medium. v6c is a comparison backend and has not been visually judged against v6a/v6b.
- Hole/multi-island risk: medium. Current behavior is explicit fallback, not support.
- Test seam risk: low to medium. Fix loops added exported probes in the v6c file for defensive branches and near-duplicate sanitization; they are not re-exported from the package barrel.
- Integration concurrency risk: medium. Domain C v6b changes are present in the same worktree and share some routing/test files. Domain D preserved them but final integration must classify ownership carefully.

## User-Decision Points

None for Domain D.

Later Wave68 domains or final integration should decide which v6 backend, if any, becomes the final v6 implementation after comparison.
