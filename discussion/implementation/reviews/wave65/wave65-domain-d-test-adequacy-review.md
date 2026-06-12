# Wave65 Domain D Test Adequacy Review

## Verdict

`pass`

## Re-review Summary

Previous findings are closed after the Gnome fix loop.

1. Closed: operation-core now tests V2.5 `soft-boundary-generation-failed -> V2` provenance.
   - New coverage is in `packages/operation-core/src/operations/generate-mesh.test.ts:385` through `packages/operation-core/src/operations/generate-mesh.test.ts:414`.
   - The test uses the small-alpha fixture, commits `auto-outline-v2.5-soft-boundary`, asserts V2 output via `_outline_v2_` stable IDs, and checks transform history for:
     - `generateMesh:auto-outline-v2.5-soft-boundary`
     - `meshSource:outline-v2-rgba`
     - `fallback:auto-outline-v2.5-soft-boundary:soft-boundary-generation-failed`
     - `meshQuality:triangulationMode=interim-delaunay-alpha-filter`
   - It also asserts no extra `fallback:auto-outline-v2:*` step is recorded, matching the V3 precedent.

2. Closed: far-transparent rejection coverage is now branch-specific.
   - Updated coverage is in `packages/authoring-core/src/mesh-generation.test.ts:336` through `packages/authoring-core/src/mesh-generation.test.ts:359`.
   - The fixture now uses an opaque outer rectangle with a transparent hole, and directly asserts `rejectedFarTransparentTriangleCount > 0`.
   - The survivor metrics still assert `outsideTriangleSampleCount === 0` and `farTransparentSampleCount === 0`, so the test proves far-transparent candidates are rejected rather than surviving.

## New Findings

None.

## Evidence Checked

- Re-read the changed test files directly:
  - `packages/authoring-core/src/mesh-generation.test.ts`
  - `packages/operation-core/src/operations/generate-mesh.test.ts`
- Confirmed the reported fix scope matches the observed focused test changes.
- Reused the previous basis/rubric context for Domain D Test Adequacy:
  - V2.5 determinism and coarser count tests remain present at `packages/authoring-core/src/mesh-generation.test.ts:226` through `packages/authoring-core/src/mesh-generation.test.ts:280`.
  - Large Motion not denser than V2 Low Motion remains present at `packages/authoring-core/src/mesh-generation.test.ts:282` through `packages/authoring-core/src/mesh-generation.test.ts:334`.
  - Alpha-empty fallback coverage remains present at `packages/authoring-core/src/mesh-generation.test.ts:551` through `packages/authoring-core/src/mesh-generation.test.ts:570`, and operation provenance at `packages/operation-core/src/operations/generate-mesh.test.ts:433` through `packages/operation-core/src/operations/generate-mesh.test.ts:449`.

## Verification Performed

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Passed after approved outside-sandbox run: 2 test files, 38 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Exit code 0; only LF/CRLF working-copy warnings were printed.
- Source organization and dependency checks were not rerun for the fix loop because Gnome changed only test files and no manifests, lockfiles, dependency declarations, or authored source modules.

## Residual Risks

- Visual quality on real user art remains outside this test adequacy review.
- The algorithm still uses ordinary Delaunay plus filtering rather than constrained triangulation; current tests appropriately assert survivor metrics and branch-specific rejection behavior.
