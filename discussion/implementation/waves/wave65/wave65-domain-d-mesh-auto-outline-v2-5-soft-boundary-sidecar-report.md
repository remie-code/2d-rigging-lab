# Wave65 Domain D Report: Mesh auto-outline-v2.5-soft-boundary Sidecar

## Verdict

`done`

## Scope

- Domain: `wave65-mesh-auto-outline-v2-5-soft-boundary-sidecar`
- Implemented explicit headless method: `auto-outline-v2.5-soft-boundary`
- Editor default was not changed. Editor preview/apply still uses `auto-outline-v2`.
- No dependency or manifest changes.

## Changed Files

### Authoring Core

- `packages/authoring-core/src/mesh-outline-v2-5-soft-boundary-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`

### Operation Core

- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

### Discussion

- `discussion/implementation/waves/wave65/wave65-domain-d-mesh-auto-outline-v2-5-soft-boundary-sidecar-report.md`
- `discussion/implementation/reviews/wave65/wave65-domain-d-spec-compliance-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-d-design-development-review.md`
- `discussion/implementation/reviews/wave65/wave65-domain-d-test-adequacy-review.md`

## Implementation Summary

- Added `createAutoOutlineV25SoftBoundaryMesh` as a headless generator.
- Uses Drawable RGBA alpha thresholding and largest alpha contour selection.
- Simplifies contour more aggressively than V2.
- Applies ratio-based centroid soft boundary padding from alpha bounds size.
- Uses sparse alpha-interior sampling with deterministic jitter.
- Uses ordinary Delaunay plus filters; this is not full constrained triangulation.
- Allows transparent samples only near the soft boundary and rejects far-transparent triangles.
- Rejects triangles with samples outside the soft boundary.
- Records `softBoundaryMetrics` in `MeshGenerationQualityMetrics`.
- Records operation provenance entries such as:
  - `meshQuality:softBoundaryAlgorithm=auto-outline-v2.5-soft-boundary`
  - `meshQuality:softBoundaryOutsideSamples=0`
  - `meshQuality:softBoundaryFarTransparentSamples=0`
  - `meshQuality:softBoundaryProvenance=...transparent-near-boundary-allowance...`

## Fallback / Provenance Behavior

- Success route:
  - `auto-outline-v2.5-soft-boundary`
  - source: `outline-v2-5-soft-boundary-rgba`
  - triangulation mode: `interim-delaunay-soft-boundary-filter`
- Fallback route:
  - `auto-outline-v2.5-soft-boundary`
  - `auto-outline-v2`
  - `auto-outline-v1`
  - `bounds-grid`
- V2.5-specific failure to V2 records:
  - `fallback:auto-outline-v2.5-soft-boundary:soft-boundary-generation-failed`
- Empty alpha fallback records:
  - `fallback:auto-outline-v2.5-soft-boundary:alpha-empty`
  - `fallback:auto-outline-v2:alpha-empty`
  - `fallback:auto-outline-v1:alpha-empty`

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`
  - 21 tests passed.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/generate-mesh.test.ts`
  - 17 tests passed.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - 38 tests passed after the Test Adequacy fix loop.
- `pnpm.cmd typecheck`
  - `tsc --noEmit` passed.
- `node scripts/check-source-organization.mjs`
  - Source organization guard passed.
- `git diff --check -- packages/authoring-core/src packages/operation-core/src`
  - Passed; only existing Git LF/CRLF warnings were printed.

Not run:

- `node scripts/check-dependencies.mjs`
  - Not required because no dependency, manifest, lockfile, or binary dependency changed.

## Test Coverage Added

- Deterministic V2.5 output.
- V2.5 vertex/triangle count lower than V2 on representative fixture.
- V2.5 Large Motion not denser than V2 Low Motion on representative fixtures.
- Soft boundary transparent near-boundary allowance with zero accepted outside/far-transparent samples.
- Rejection metrics for soft-boundary / far-transparent triangles.
- Branch-specific far-transparent rejection using a transparent-hole fixture.
- V2.5 explicit routing through `createGeneratedMeshForDrawable`.
- V2.5 fallback to generated V2 and empty-alpha fallback chain.
- Operation payload/provenance for V2.5.
- Operation provenance for V2.5 `soft-boundary-generation-failed` fallback to generated V2.

## Review Gates

Passed:

- Spec Compliance Review: `pass`.
- Design / Development Compliance Review: `pass`.
- Test Adequacy Review: initially `needs_fix`; fix loop closed the operation-core failure fallback provenance and far-transparent branch-specific test findings; final verdict `pass`.

## Editor Default Evidence

Search evidence:

```text
apps/editor/src/features/editor-session/model/editor-session-commands.ts:279: method: GenerateMeshPayloadDto["method"] = "auto-outline-v2"
apps/editor/src/features/editor-session/editor-session-context.tsx:644: method: "auto-outline-v2"
apps/editor/src/features/editor-session/editor-session-context.tsx:680: "auto-outline-v2"
```

Search for V2.5 in `apps/editor/src` returned no matches.

## Residual Risks

- The triangulation remains ordinary Delaunay with filtering, not constrained triangulation.
- Multiple distant islands are still handled through largest-contour selection for V2.5.
- Visual review on real user art is still needed before considering V2.5 as an editor default.
- `apps/editor/**` already had unrelated dirty changes in the working tree; Domain D did not edit those files.
