# Wave71 Final Clean Integration Review

- Verdict: `pass`
- Target: `wave71-final-clean-integration-review`
- Reviewed scope: Wave71 Domain B final clean integration after Domain A pass and parent final validation.
- Reviewer: Review-Sylph
- Date: 2026-06-15

## Findings

No blocking findings and no required changes.

Domain B final report and map closeout are intentionally still pending until this review passes; that pending state is not counted as a failure.

## Basis Documents Used

- `discussion/implementation/orchestration/wave71-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-adaptive-staggered-band.md`
- `discussion/design/mesh-generation/auto-outline-v6d-staggered-inner-strip.md`
- `discussion/design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md`
- `discussion/implementation/waves/wave70/wave70-final-integration-report.md`
- `discussion/implementation/reviews/wave70/wave70-final-clean-integration-review.md`
- `discussion/implementation/waves/wave71/wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md`
- `discussion/implementation/reviews/wave71/wave71-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave71/wave71-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave71/wave71-domain-a-test-adequacy-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Scope Reviewed

- Ran `git status --short -uall`; changed/untracked files matched the parent-provided Wave71 scope.
- Ran `git diff --name-status -- packages/authoring-core packages/operation-core apps/editor discussion/implementation/waves/wave71 discussion/implementation/reviews/wave71 discussion/implementation/_map.md discussion/implementation/orchestration/_map.md discussion/design/mesh-generation/_map.md`.
- Inspected targeted diffs for `packages/authoring-core`, `packages/operation-core`, `apps/editor`, and the Wave71 map/prep docs.
- Inspected untracked Wave71 files, including the plan/design/report/review artifacts and `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts`.

## Evidence Summary

### Upstream Gate

- Domain A implementation report exists and records `Verdict: pass`.
- Domain A Spec Compliance, Design / Development Compliance, and Test Adequacy reviews all exist and record `Verdict: pass`.
- The Domain A reviews were not used as the only evidence; source, tests, diffs, and guard commands were inspected directly in this clean review.

### Method / Source / Backend IDs

- New IDs are registered in `packages/authoring-core/src/mesh-generation-contract.ts`: `auto-outline-v6d-adaptive-staggered-band`, `outline-v6d-adaptive-staggered-band-rgba`, and `v6d-adaptive-staggered-band`.
- The new implementation file exists at `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts`.
- `packages/authoring-core/src/mesh-generation.ts` imports and dispatches the new method.
- Wave70 support-ring IDs and route remain present: `auto-outline-v6d-contour-band-support-rings`, `outline-v6d-contour-band-support-rings-rgba`, and `v6d-contour-band-support-rings`.
- Older v6D/v6E/v6F methods remain present in the contract and tests.

### Adaptive Density

- The adaptive backend captures the tuned high/medium/low baselines in `ADAPTIVE_DENSITY_BASELINES`.
- The resolver uses `selectedComponentPixelCount` first and falls back to alpha bounds area only when component area is unavailable.
- The resolver is deterministic and records adaptive density diagnostics including reference area, effective area, area ratio, spacing scale, vertex scale, and resolved density parameters.
- Tests assert the high/medium/low reference baselines, alpha-bounds fallback, and small/reference/large monotonic behavior.

### Staggered Strip

- `findSafeStaggeredInnerPoint` builds `I[i]` from the alpha edge midpoint plus inward offset, with reduced offset attempts `[1, 0.75, 0.5, 0.25]`.
- `createExplicitAlphaInnerStripTriangles` emits the required two-triangle strip per alpha edge: `A[i], A[i+1], I[i]` and `A[i+1], I[i+1], I[i]`.
- Ordinary interior points are filtered to the staggered inner polygon before interior recovery.
- Interior fill uses the staggered inner ring as its constraint boundary.
- Final geometry counts direct alpha-to-ordinary-interior edges and falls back if any are present.
- Tests assert midpoint-shifted inner points, exact strip topology, explicit strip counts, `directAlphaToInteriorEdgeCount == 0`, and inner-boundary fill diagnostics.

### Fallback Order

- The implementation attempts adaptive staggered-band generation first.
- Local staggered inner point failures use reduced offset attempts before global failure.
- Global adaptive geometry or recovery failure calls Wave70 support-ring v6D through `createWave70SupportRingFallback`.
- If Wave70 itself falls back, its fallback steps are appended after the adaptive fallback step, preserving the adaptive -> Wave70 -> coarse ordering.
- Tests force the normal adaptive global-geometry failure branch and assert the returned source is `outline-v6d-contour-band-support-rings-rgba` before coarse fallback.

### Editor Default / UX

- `DEFAULT_MESH_GENERATION_METHOD` now points to `auto-outline-v6d-adaptive-staggered-band`.
- Editor preview stores the new method/source/provenance in the draft, and apply commits the preview mesh and preview provenance through `commitGenerateMesh`.
- Product-facing presets remain the visible control dimension.
- Targeted selector searches found no restored algorithm selector implementation; only negative selector assertions and backend-id contracts matched.
- PSD e2e now expects the default preview result to display `Adaptive contour mesh`.

### Preview / Apply / Historical Provenance

- Editor command tests cover default generation with adaptive provenance.
- Preview commit tests cover adaptive, Wave70 support-ring, old v6D, v6E, and v6F provenance cases.
- Inspector display maps old and new method/source/backend IDs to safe labels.

### Operation Payload / Provenance / Schema

- `MeshGenerationV6AdaptiveStaggeredBandDiagnostics` is added to authoring quality metrics.
- Operation payload validation accepts optional adaptive diagnostics separately from support-ring diagnostics.
- Operation transform history emits adaptive density, strip, direct-edge, and fallback diagnostics.
- PreviewMesh commit tests preserve adaptive diagnostics through Operation Core.

### Forbidden Scope

- No renderer texture filtering, padding, dilation, or WebGL changes were present in the targeted diff.
- No package manifests or lockfiles changed; `node scripts/check-dependencies.mjs` passed.
- No algorithm selector UI was restored.
- No Wave70 v6D, old v6D, v6E, or v6F methods were deleted.
- No broad unrelated source refactor was found in the reviewed source diffs.
- Targeted search found no public production `auto-outline-v6g` or `outline-v6g` IDs.

## Validation Reviewed / Performed

Parent final validation reviewed:

- `pnpm.cmd typecheck`: pass.
- Focused Vitest run for authoring-core, operation-core, and editor model/command tests: sandbox `spawn EPERM`, approved rerun pass, 4 files / 112 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor test:e2e:psd-import`: sandbox `spawn EPERM`, approved rerun pass, 9 tests.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- Targeted `git diff --check`: pass with CRLF working-copy warnings only.

Performed in this clean review:

- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- packages/authoring-core packages/operation-core apps/editor discussion/implementation/waves/wave71 discussion/implementation/reviews/wave71 discussion/implementation/_map.md discussion/implementation/orchestration/_map.md discussion/design/mesh-generation/_map.md`: pass with CRLF working-copy warnings only.
- Dependency/renderer manifest diff check: empty.
- Targeted selector/v6G/local-strip-omitted searches: no production violations; only negative `v6g` test assertions matched.

## Residual Risks

- Visual mesh quality on broad real artwork remains a real residual risk. The automated evidence proves deterministic routing, density behavior, strip topology, fallback/provenance shape, and selector absence; it does not replace human visual tuning.
- Thin or highly concave silhouettes may fall back to Wave70 support rings rather than producing a partial adaptive strip. This is diagnosed and contract-coherent.
- The new adaptive backend file is large but cohesive and passes the source-organization guard. Future geometry/fallback expansion should split reusable density, strip, and fallback helpers before the file becomes mixed-responsibility.

## User-Decision Points

- None blocking Wave71 integration.
- Later visual review can decide whether adaptive density clamp ranges, partial local strip omission as a generated output, or a second inner support ring should be tuned in a future wave.
