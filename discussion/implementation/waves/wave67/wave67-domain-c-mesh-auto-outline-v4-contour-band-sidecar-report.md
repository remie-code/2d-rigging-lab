# Wave67 Domain C Report: Mesh auto-outline-v4 Contour Band Sidecar

## Verdict

pass

Domain C is complete for the Wave67 sidecar scope. The implementation adds `auto-outline-v4-contour-band` as an explicit, non-default mesh generation method with source id `outline-v4-contour-band-rgba`, fallback routing through V2.6/V2.5/V2/V1 to `bounds-grid`, contour-band metrics/provenance, operation allowlist support, and focused tests.

Repository-wide typecheck is not clean because of an out-of-scope Domain A/WebGL2 test type error:

```text
packages/render-webgl2/src/webgl2-renderer.test.ts(257,5): error TS2322: Type 'string' is not assignable to type 'object'.
```

Focused Domain C verification passed.

## Orchestration

- Gnome implementation worker completed with `verdict: done`.
- Review-Sylph Spec Compliance completed with `pass`.
- Review-Sylph Design / Development Compliance completed with `pass`.
- Review-Sylph Test Adequacy completed with `pass`.
- All started child sessions were waited for and closed after completion.

Review reports:

- `discussion/implementation/reviews/wave67/wave67-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-c-test-adequacy-review.md`

## Files Changed For Domain C

- `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`
- `discussion/implementation/reviews/wave67/wave67-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave67/wave67-domain-c-test-adequacy-review.md`
- `discussion/implementation/waves/wave67/wave67-domain-c-mesh-auto-outline-v4-contour-band-sidecar-report.md`

Observed but not owned by Domain C: concurrent Domain A/B worktree changes under `apps/editor`, `packages/render-*`, `packages/runtime-core`, and Domain B review files. They are not counted as Domain C evidence.

## Implementation Summary

- Added a new authoring-core V4 generator with deterministic contour-band construction, interior fill, stable ids, and quality rejection.
- Extended mesh generation routing with explicit method/source ids and fallback chain:

```text
auto-outline-v4-contour-band
  -> auto-outline-v2.6-soft-apron
  -> auto-outline-v2.5-soft-boundary
  -> auto-outline-v2
  -> auto-outline-v1
  -> bounds-grid
```

- Added `MeshGenerationContourBandMetrics` and `contourBandMetrics` on quality metrics.
- Added operation payload enum support, previewMesh allowlist support, and transform-history formatting for V4 contour-band metrics.
- Kept Editor defaults unchanged; `commitGenerateMesh` remains defaulted to `auto-outline-v2.6-soft-apron`.
- Did not add UI selector work, package-format schema changes, renderer work, deformer work, or dependencies.

## Verification

Commands/results:

- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Initial sandbox run failed with `spawn EPERM` while Vitest/esbuild loaded config.
  - Approved outside-sandbox rerun passed: 2 files, 48 tests.
- `node scripts/check-source-organization.mjs`
  - passed.
- `node scripts/check-dependencies.mjs`
  - passed.
- `git diff --check -- packages/authoring-core packages/operation-core packages/package-format apps/editor`
  - passed; Git printed LF/CRLF working-copy warnings only.
- `pnpm.cmd typecheck`
  - failed outside Domain C at `packages/render-webgl2/src/webgl2-renderer.test.ts:257`.

Additional reviewer verification:

- Spec Compliance ran focused Vitest including `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`: 3 files, 61 tests passed.
- Spec Compliance confirmed no forbidden Cubism compatibility/reproduction or renderer seam-fix claims in Domain C target files.

## Acceptance Coverage

- Explicit V4 method id: implemented.
- Explicit V4 generated source id: implemented.
- Required fallback chain: implemented and tested for empty-alpha full-chain fallback.
- Contour-band metrics/provenance: implemented and operation formatted.
- Deterministic V4 output: tested.
- Nonzero contour-band metrics on representative fixtures: tested.
- V3-like huge envelope avoidance: covered by area-ratio caps and tests.
- Transparent-only triangle ratio, high valence, long boundary-to-interior spokes, and excessive vertex count: bounded by metrics, quality gates, and tests.
- Operation payload / generation allowlist: implemented and tested.
- Editor default remains V2.6: verified.

## Deferred / N/A

- No side-by-side comparison UI. Not required for Domain C.
- No editor V4 selector. Optional and not included.
- No package-format method metadata/schema change. Existing operation/authoring boundaries were sufficient.
- No browser/e2e/manual visual verification. N/A for this headless non-default sidecar; required before any future default switch.
- Constrained triangulation and full hole/multi-island handling remain deferred v0 limitations.

## Residual Risks

- V4 is a v0 centroid-offset/Delaunay contour-band implementation. It is bounded by metrics/tests, but human visual comparison is still needed before any default-switch decision.
- There is no focused non-empty intermediate fallback test for `V4 failed -> V2.6 generated`; current tests cover the full empty-alpha fallback chain to `bounds-grid`.
- `mesh-outline-v4-contour-band-generation.ts` is cohesive but large. Future reuse across mesh methods may justify helper extraction.
- Repository-wide typecheck must be rerun after the out-of-scope WebGL2 type error is fixed.

## Escalations

None for Domain C.

- No new dependency was added.
- No schema/package-format decision was required.
- No default-switch, renderer, deformer, or Cubism-compatibility decision was made.
