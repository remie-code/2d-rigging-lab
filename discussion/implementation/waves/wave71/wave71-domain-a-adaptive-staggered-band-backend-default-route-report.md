# Wave71 Domain A Report: Adaptive Staggered-Band Backend / Default Route

- Verdict: `pass`
- Domain: `wave71-adaptive-staggered-band-backend-default-route`
- Date: 2026-06-15
- Implementer: Gnome

## Fix Loop 1 Summary

- Design/development review finding 1 resolved by recording scope ownership: the existing map/design/orchestration prep diffs are pre-existing parent/Domain-B-owned changes and are excluded from Domain A changed files.
- Design/development review finding 2 resolved by removing the unused `v6d-adaptive-staggered-band-local-strip-omitted` fallback reason and Inspector formatter case. Domain A behavior remains reduced inner-offset attempts followed by Wave70 support-ring fallback when a full safe staggered inner ring cannot be built.
- Test adequacy findings resolved with high/low density baseline tests, alpha-bounds fallback resolver coverage, a coordinate/topology-level staggered strip probe, and a fallback-order probe that now traverses the normal global adaptive-geometry failure branch before Wave70 fallback.

## Basis Coverage Self-Report

| Basis | Coverage |
|---|---|
| `wave71-plan.md` | Implemented new method/source/backend ids, new implementation file, adaptive density, explicit staggered strip diagnostics, Wave70 fallback-before-coarse behavior, and Editor default route switch. |
| `auto-outline-v6d-adaptive-staggered-band.md` | Implemented reference-area density scaling, component-area primary signal, alpha-bounds fallback in resolver, staggered edge-midpoint inner ring, explicit alpha-inner triangles, inner-boundary interior fill, and direct alpha-to-ordinary-interior edge diagnostics. |
| `auto-outline-v6d-staggered-inner-strip.md` | Implemented `I[i]` from alpha edge midpoint plus inward normal with reduced-offset attempts; explicit strip triangles are emitted before interior fill. |
| `auto-outline-v6g-contour-band-support-rings.md` / Wave70 reports | Preserved Wave70 support-ring method and reused it as the first global-invalid fallback for the new method. No public v6G ids were added. |
| Development policies | No new dependencies, no renderer changes, no selector UI restoration, no semantic part-name/drawable-name density rules, and Operation Core provenance/schema alignment updated. |

## Intentionally Deferred Basis Items

- Visual tuning across broader real artwork remains deferred to later visual review.
- Full robust offset-curve handling for pathological silhouettes remains a non-goal for this first implementation.
- Partial local strip omission as generated output remains intentionally unimplemented for Domain A. The implemented local recovery is deterministic reduced-offset attempts; if the full safe staggered inner ring cannot be built, the method falls back to Wave70 support rings before coarse fallback.
- Second inner support ring remains deferred by design.
- Wave71 final review/map closeout is Domain B work, not implemented here.
- Scope note: pre-existing parent/Domain-B preparation diffs in `discussion/design/mesh-generation/_map.md`, `discussion/implementation/_map.md`, `discussion/implementation/orchestration/_map.md`, plus untracked Wave71 plan/design docs, are excluded from Domain A changed files and were not modified or reverted in Fix Loop 1.

## Mesh Generation Contract Trace

- New method id: `auto-outline-v6d-adaptive-staggered-band`.
- New source id: `outline-v6d-adaptive-staggered-band-rgba`.
- New backend id: `v6d-adaptive-staggered-band`.
- New implementation file: `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts`.
- Routing: `packages/authoring-core/src/mesh-generation.ts` dispatches the new method and keeps Wave70 support-ring routing.
- Diagnostics: `MeshGenerationV6AdaptiveStaggeredBandDiagnostics` added to authoring metrics, operation payload validation, transform history formatting, Editor preview logging, and Inspector display.
- Editor default: `DEFAULT_MESH_GENERATION_METHOD` now points to `auto-outline-v6d-adaptive-staggered-band`.

## Density Scaling Evidence

- Baselines are the current tuned values:
  - `high` reference resolver returns `boundarySpacing=10`, `interiorSpacing=7.5`, `maxBoundaryVertices=96`, `maxInteriorVertices=64`, `interiorBoundaryClearance=1.1`.
  - `medium` reference resolver returns `boundarySpacing=15`, `interiorSpacing=10`, `maxBoundaryVertices=96`, `maxInteriorVertices=32`, `interiorBoundaryClearance=1.1`.
  - `low` reference resolver returns `boundarySpacing=30`, `interiorSpacing=15`, `maxBoundaryVertices=64`, `maxInteriorVertices=16`, `interiorBoundaryClearance=1.5`.
- Resolver uses selected component pixel count as the primary effective area, with alpha-bounds area fallback when component area is unavailable.
- Focused tests assert alpha-bounds-only reference input resolves through `adaptiveDensityReferenceArea=115200` / `adaptiveDensityEffectiveArea=115200` and returns the medium baseline.
- Focused tests assert smaller medium input reduces `maxInteriorVertices`, and larger medium input increases or preserves boundary/interior caps monotonically.

## Staggered Strip Geometry Evidence

- Inner strip points are associated with alpha edges, not alpha vertices.
- Fix Loop 1 adds a coordinate-level probe asserting at least one generated staggered inner point is phase-shifted from the edge midpoint, closer to that midpoint than to either alpha endpoint, and not alpha-vertex aligned.
- Explicit alpha-to-inner triangles are emitted as:
  - `A[i], A[i+1], I[i]`
  - `A[i+1], I[i+1], I[i]`
- Fix Loop 1 topology tests assert every active explicit strip triangle pair uses those exact global index patterns.
- Interior fill uses the staggered inner ring as its Constrainautor boundary and filters ordinary interior points inside that polygon.
- Focused generation test asserts:
  - `staggeredInnerPointCount == boundaryVertexCount`
  - `explicitAlphaInnerStripTriangleCount == staggeredInnerPointCount * 2`
  - `directAlphaToInteriorEdgeCount == 0`
  - `interiorFillUsesStaggeredInnerBoundary == true`

## Fallback Ordering Evidence

- New method fallback order for global adaptive strip/recovery failure is:
  - adaptive staggered band
  - reduced local inner offset attempts
  - Wave70 `auto-outline-v6d-contour-band-support-rings`
  - Wave70's existing coarse fallback only if Wave70 itself falls back
- Probe test `probeV6DAdaptiveStaggeredBandWave70FallbackForTest` now forces the normal adaptive global-geometry failure branch before Wave70 fallback, and verifies the returned source is `outline-v6d-contour-band-support-rings-rgba` before any coarse source.
- No partial local-strip omission fallback reason remains in the public contract; reduced-offset recovery either builds the full safe staggered inner strip or falls back to Wave70 support rings.

## Must-not Compliance Evidence

- Wave70 support-ring method/source/backend and tests remain present and callable.
- No renderer texture filtering, padding, dilation, or WebGL changes were made.
- No algorithm selector UI was restored; existing negative unit/e2e assertions remain.
- No package manifests or lockfiles changed.
- No part-name, drawable-name, or image semantic rules were added to density resolution.
- Old v6D/v6E/v6F methods remain in the contract and route surface.

## Validation Results

| Command | Result |
|---|---|
| `pnpm.cmd typecheck` | Pass. |
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts --reporter=dot` | Fix Loop 1 sandbox run hit esbuild `spawn EPERM`; approved rerun passed, 1 file / 64 tests. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts --reporter=dot` | Fix Loop 1 sandbox run hit esbuild `spawn EPERM`; approved rerun passed, 1 file / 31 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts --reporter=dot` | Fix Loop 1 sandbox run hit esbuild `spawn EPERM`; approved rerun passed, 2 files / 17 tests. |
| `pnpm.cmd --filter @private-2d-rigging-lab/editor test:e2e:psd-import` | Not rerun in Fix Loop 1; initial Domain A validation had approved rerun pass, 9 tests. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `node scripts/check-dependencies.mjs` | Pass. |
| `rg -n "local-strip-omitted\|Adaptive strip locally omitted" packages apps` | No matches; command exited 1 because the removed fallback reason is absent from source/UI code. |
| Selector/backend UI `rg` check | Only contract backend-id arrays and existing negative selector tests/e2e assertions matched in initial Domain A validation. |
| `git diff --check -- packages/authoring-core packages/operation-core apps/editor discussion/implementation/waves/wave71` | Pass; CRLF working-copy warnings only. |
| `rg -n "[ \t]+$" packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts discussion/implementation/waves/wave71/wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md` | No matches; command exited 1 because no trailing whitespace was found. |

## Residual Risk Classification

- Residual visual-quality risk: `medium-low`. Automated tests prove routing, deterministic density scaling, strip diagnostics, direct-edge invariant, fallback ordering, and preview/apply provenance; they do not replace real-art visual review.
- Geometry robustness risk: `medium-low`. Thin or pathological silhouettes may still fall back to Wave70 support rings, which is intentional and diagnosed.
- Compatibility risk: `low`. Existing method/source/backend ids are preserved, and operation payload validation accepts both old and new diagnostic shapes.
