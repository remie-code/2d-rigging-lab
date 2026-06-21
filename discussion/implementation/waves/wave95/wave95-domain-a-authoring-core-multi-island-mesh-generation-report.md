# Wave95 Domain A: Authoring Core Multi-Island Mesh Generation Report

## Summary

Implemented `wave95-authoring-core-multi-island-mesh-generation` for the V6D default path.

The default `auto-outline-v6d-adaptive-contour-constrainautor` path now detects raw alpha connected components before soft contour processing. A true single raw island still uses the previous V6D implementation path directly. Multiple valid islands are isolated into per-island RGBA buffers, generated through the existing V6D path, and merged into one disconnected mesh.

Loop 2 fixed review findings around all-kept-island failure semantics, budget cap pressure, and test adequacy.

## Changed Files

- `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts`
  - New focused helper for raw alpha island detection, tiny/noise filtering, RGBA isolation, and global budget allocation.
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
  - Added multi-island dispatch, per-island V6D invocation, merge, metrics/provenance, localized fallback glue, and whole-drawable fallback for all-kept-island failure.
- `packages/authoring-core/src/mesh-generation.test.ts`
  - Added two-island, tiny noise skip, all-noise/no-valid fallback, small valid island, disconnected topology, no cross-gap triangle, stable-id, deterministic output, source-space UV, budget, and UV/topology coverage.

## Single-Island Preservation

Raw alpha detection runs first. If the raw detector sees zero/invalid input or exactly one component, the implementation calls the previous single-island V6D path directly.

This preserves the old virtual padding, soft mask, component selection, adaptive density resolution, Constrainautor recovery, triangle filtering, UV mapping, and alpha-empty blocked fallback behavior for normal single-island assets.

If raw input has more than one component but filtering leaves one valid island, generation uses an isolated RGBA buffer for that kept island so skipped noise cannot be seen by soft/support expansion.

## Raw Component Detection And Filtering

Detection uses original RGBA alpha bytes with the existing threshold default of `alpha > 8`, before blur, crack closing, mask expansion, support processing, or virtual padding.

Initial conservative tiny/noise constants are documented in code:

- Always drop components with `pixelCount <= 2`.
- Always drop extremely tiny boxes with `width <= 2` and `height <= 2`.
- Drop relative dust when all are true:
  - `pixelCount <= 8`
  - `pixelCount / largestComponentPixelCount <= 0.005`
  - `width <= 4`
  - `height <= 4`
  - `max(width, height) < 6`

This keeps narrow meaningful islands such as a slim separated strand because a non-trivial dimension prevents the relative dust rule from firing.

## Budget Allocation

Multi-island generation resolves one global V6D adaptive density budget from the kept-island total pixel count and union pixel bounds.

That global budget is allocated across islands using a deterministic weight:

```text
weight = pixelCount + sqrt(pixelCount) * boundingBoxPerimeter
```

Each island receives a narrow minimum viable boundary budget of `3` vertices. Interior budget has no allocator floor; the existing contour pipeline may still add its single best interior fallback point when needed by that pipeline.

Allocated `maxBoundaryVertices` and `maxInteriorVertices` cap each per-island V6D final contour run. Smaller islands receive less of the remaining global budget through the weighting.

The allocator now keeps allocated boundary/interior caps within the global drawable cap unless the global boundary cap is smaller than `3 * keptIslandCount`. That minimum-floor exception is explicit in `multiIslandDiagnostics.budgetPolicy`:

- `globalMaxBoundaryVertices`
- `globalMaxInteriorVertices`
- `allocatedMaxBoundaryVertices`
- `allocatedMaxInteriorVertices`
- `minimumBoundaryFloorExceededGlobalCap`
- `minimumInteriorFloorExceededGlobalCap`

## Merge / IDs / UVs / Bounds

The merged mesh:

- concatenates vertices and UVs;
- offsets triangle indices by each island's vertex offset;
- suffixes vertex and triangle stable IDs with `_island_<componentOrder>` when more than one island is merged;
- preserves original texture-space UVs because each isolated island uses the full original texture size and only masks non-island pixels transparent;
- returns `alphaBounds` as the union of generated island alpha bounds;
- keeps `MeshDto.bounds` as the original drawable mesh bounds for package/runtime compatibility.

No package-format schema, runtime export, atlas, renderer, or dependency changes were made.

## Fallback Behavior

Per-island generation can return:

- backend output;
- the existing V6D visible fallback output;
- a localized alpha-bounds fallback if an isolated kept island blocks before backend output.

If at least one island succeeds with backend output and another island has localized fallback, the merged result is returned as `status: "fallback"` with `fallbackSteps` so details remain user-visible. Successful tiny/noise filtering with valid islands remaining is not surfaced as fallback.

If every kept island ends in fallback or backend-blocked fallback, Loop 2 now routes to a whole-drawable alpha-aware fallback over the original RGBA input instead of returning a concatenation of per-island fallback meshes. Multi-island diagnostics, localized fallback reasons, and provenance are still attached.

If filtering leaves no kept island, the implementation returns a visible fallback with reason `v6-contour-extraction-failed` and diagnostics that record the skipped noise.

Partial failure is implemented. A stable public alpha fixture that forces one island through backend failure while another succeeds was not practical without adding a synthetic backend injection seam, so no partial-failure fixture was added in this wave.

## Metrics / Provenance

Runtime `v6Metrics` now includes `multiIslandDiagnostics` for this path:

- `rawAlphaComponentCount`
- `keptIslandCount`
- `generatedIslandCount`
- `backendGeneratedIslandCount`
- `skippedTinyNoiseIslandCount`
- `skippedTinyNoisePixelCount`
- `rawOpaquePixelCount`
- `largestComponentPixelCount`
- `localizedFallbackCount`
- `localizedFallbackReasons`
- per-island component order, pixel count, bounds, handling, generated vertex/triangle counts, and allocated budget
- budget policy totals and minimum-floor exception booleans
- noise filter constants

Successful multi-island output reports `multiIslandHandling: "supported"` and provenance includes raw detection, noise filtering, global budget allocation, isolated generation, and disconnected merge markers.

The `MeshGenerationV6Metrics` TypeScript interface was not edited because `mesh-quality-metrics.ts` was not in the delegated write scope. The fields are emitted at runtime; Domain B can formalize type surface if its scope requires it.

## Tests Run

Passed:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`
  - 76 tests passed.
  - Includes two-island disconnected mesh, deterministic output, original source-space UV ranges, no cross-gap triangle, global budget allocation assertions, tiny noise skip, all-noise/no-valid fallback, small valid island retention, valid UV/topology, and existing V6D empty/missing alpha fallback coverage.
- `pnpm.cmd typecheck`
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check -- packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts packages/authoring-core/src/mesh-generation.test.ts discussion/implementation/waves/wave95`

Additional broad check:

- `pnpm.cmd test:unit` was run and failed in unrelated validator/operation/runtime fixture areas. The changed authoring-core mesh-generation test passed inside that run.
- Observed unrelated failures included:
  - `packages/validator-core/src/rig-control-runtime-evidence.test.ts`
  - `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
  - `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts`
  - `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts`
  - `packages/runtime-core/src/runtime-grid2d-keyform-fixture.test.ts`
  - Wave30 tutorial mini model fixture tests
  - Wave32 warp lattice contract fixture tests

## Basis Coverage Self-Report

- Preserve current single-island behavior: covered by exact raw-single fast path and existing V6D tests.
- Detect raw alpha connected components before soft/support processing: covered in new helper before virtual padding/soft mask.
- Deterministic island descriptors: covered by scan-order `componentOrder`, pixel count, and pixel bounds.
- Filter tiny/noise islands with compound policy: implemented and covered by 2-pixel speck skip plus slim island retention.
- Invoke existing V6D per kept island: implemented through isolated RGBA and the existing single-island internal path.
- Prevent soft/support processing from seeing other islands: implemented by full-size isolated RGBA buffers.
- Merge disconnected mesh: implemented and tested via triangle component count and no cross-gap triangles.
- Global preset budget: implemented with one global adaptive budget allocated across kept islands; Loop 2 keeps allocated caps within the global cap except the explicit 3-boundary-vertices-per-kept-island floor.
- Localized fallback: implemented for partial failure when at least one island succeeds; public forced partial-failure fixture deferred as non-practical.
- All-island/no-valid fallback: Loop 2 routes all-kept fallback to whole-drawable alpha-aware fallback over the original RGBA, and directly tests the no-valid/all-noise branch.
- Metrics/provenance: runtime fields and provenance added in authoring-core without schema/contracts edits.

## Deferred Basis Items

- Formal TypeScript interface extension for `multiIslandDiagnostics` is deferred because `mesh-quality-metrics.ts` was outside this Gnome write scope.
- A deterministic public partial-island backend-failure fixture is deferred. Implementing one cleanly likely needs a test-only seam or synthetic backend hook, which was not justified for Domain A. The all-kept fallback code path was fixed, but not forced through a natural alpha-only backend-failure fixture.
- V6D adaptive contour file is now larger. The raw detection/filter/budget helper was split out, but future cleanup could move merge diagnostics into a separate V6D-owned helper if subsequent waves touch this area.

## Loop 2 Review Fixes

- All-kept-island failure fallback:
  - Added detection for `fallbackOutputs.length === sortedOutputs.length`.
  - This now returns a whole-drawable `alpha-aware-rgba` fallback built from the original RGBA and kept-island union bounds.
  - Added provenance markers `v6d-adaptive-contour-multi-island-all-islands-fallback` and `v6d-adaptive-contour-multi-island-whole-drawable-fallback`.
- Budget policy:
  - Reduced allocator floor to the narrow boundary minimum needed for a loop (`3`) and removed the interior allocator floor.
  - Added `multiIslandDiagnostics.budgetPolicy` so cap usage and any floor exception are explicit.
  - Added tests proving the two-island path allocates a global budget, not a full preset budget per island.
- Test adequacy:
  - Added direct all-noise/no-valid fallback coverage.
  - Strengthened two-island UV assertions to prove source-space x ranges.
  - Added deterministic two-island output equality for mesh, alpha bounds, and multi-island diagnostics.

## Conditional Scope Justification

none
