# Wave71 Domain A Test Adequacy Review

- Verdict: `pass`
- Target: `wave71-adaptive-staggered-band-backend-default-route`
- Review lane: Test Adequacy Review
- Reviewer: Review-Sylph
- Date: 2026-06-15
- Status: Fix Loop 1 re-review complete

## Basis Documents Used

- `discussion/implementation/orchestration/wave71-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-adaptive-staggered-band.md`
- `discussion/design/mesh-generation/auto-outline-v6d-staggered-inner-strip.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave71/wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md`

## Coverage Matrix

| Required evidence item | Coverage | Evidence | Notes |
|---|---|---|---|
| New method/source/backend ids exist | covered | `packages/authoring-core/src/mesh-generation-contract.ts:7`, `packages/authoring-core/src/mesh-generation-contract.ts:18`, `packages/authoring-core/src/mesh-generation-contract.ts:29`, `packages/authoring-core/src/mesh-generation.test.ts:1162` | Contract arrays and candidate table include the new ids. |
| New method routes through generation | covered | `packages/authoring-core/src/mesh-generation.ts:189`, `packages/authoring-core/src/mesh-generation.test.ts:2571` | Public generation test calls the new method and asserts source/provenance. |
| Wave70 method remains callable | covered | `packages/authoring-core/src/mesh-generation-contract.ts:12`, `packages/authoring-core/src/mesh-generation.test.ts:2059`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:648` | Existing support-ring route remains tested and legacy preview provenance is included. |
| High/medium/low reference density baselines | covered | `packages/authoring-core/src/mesh-generation.test.ts:2443`, `packages/authoring-core/src/mesh-generation.test.ts:2469`, `packages/authoring-core/src/mesh-generation.test.ts:2476`, `packages/authoring-core/src/mesh-generation.test.ts:2495` | Fix Loop 1 now asserts all three tuned reference baselines. |
| Component area as primary density signal | covered | `packages/authoring-core/src/mesh-generation.test.ts:2444`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:530` | Resolver tests use `selectedComponentPixelCount`; source inspection confirms component-area branch. |
| Alpha-bounds area fallback for density | covered | `packages/authoring-core/src/mesh-generation.test.ts:2456`, `packages/authoring-core/src/mesh-generation.test.ts:2502`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:525` | Fix Loop 1 adds alpha-bounds-only resolver coverage. |
| Smaller/larger monotonic density scaling | covered | `packages/authoring-core/src/mesh-generation.test.ts:2515` | Medium small/reference/large assertions cover required scaling direction. |
| No semantic part/drawable name density rules | covered | `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:208`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:518` | Density resolver inputs are density hint, component pixels, and alpha bounds; no semantic source is present. |
| Edge-midpoint staggered inner ring | covered | `packages/authoring-core/src/mesh-generation.test.ts:2521`, `packages/authoring-core/src/mesh-generation.test.ts:2543`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:1234` | Fix Loop 1 adds coordinate-level midpoint/phase-shift oracle through a geometry probe. |
| Explicit alpha-to-inner strip triangle topology | covered | `packages/authoring-core/src/mesh-generation.test.ts:2527`, `packages/authoring-core/src/mesh-generation.test.ts:2530`, `packages/authoring-core/src/mesh-generation.test.ts:2535` | Tests assert every active explicit strip triangle pair uses the required global index pattern. |
| Explicit staggered strip diagnostics | covered | `packages/authoring-core/src/mesh-generation.test.ts:2608`, `packages/operation-core/src/operations/generate-mesh.test.ts:522` | Diagnostics and transform history include strip counts. |
| Direct alpha-to-ordinary-interior edge count computed/asserted | covered | `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:312`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:1357`, `packages/authoring-core/src/mesh-generation.test.ts:2568`, `packages/authoring-core/src/mesh-generation.test.ts:2620` | Implementation computes the count and tests assert it through both geometry probe and generation diagnostics. |
| Ordinary interior filtering inside staggered inner polygon | covered | `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:647`, `packages/authoring-core/src/mesh-generation.test.ts:2631` | Test asserts before-filter count is at least after-filter count and inner boundary flag is true. |
| Degenerate/skipped strip diagnostics | covered | `packages/authoring-core/src/mesh-generation.test.ts:2617`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:609` | Success path asserts zero skipped/degenerate counts; global invalid branch carries adaptive diagnostics into Wave70 fallback. |
| Wave70 fallback before coarse fallback | covered | `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:239`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:249`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:425`, `packages/authoring-core/src/mesh-generation.test.ts:2645` | Fix Loop 1 probe now traverses the normal adaptive global-geometry failure branch before Wave70 fallback. |
| Operation/provenance validation after schema change | covered | `packages/operation-core/src/payloads/model-edit.ts:208`, `packages/operation-core/src/operations/generate-mesh.test.ts:522`, `packages/operation-core/src/operations/generate-mesh.test.ts:949` | Schema accepts adaptive diagnostics and operation tests preserve them through direct generation and previewMesh commit. |
| Editor default method | covered | `apps/editor/src/features/editor-session/model/mesh-tool-state.ts:61`, `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:13`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:612` | Constant and command default route are tested. |
| Algorithm selector remains absent | covered | `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts:39`, `apps/editor/e2e/psd-import.e2e.spec.ts:261` | Unit negative assertions and e2e negative assertions exist. |
| Preview/apply semantics unchanged | covered | `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:639`, `apps/editor/e2e/psd-import.e2e.spec.ts:283` | Model tests prove previewed mesh commit/provenance; e2e contains draft/apply/cancel state checks. |
| Historical Wave70/older v6D/v6E/v6F provenance display-safe | covered | `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:639` | Preview cases include adaptive, Wave70 support-ring, v6D, v6E, and v6F. |
| No renderer expansion / texture filtering work | covered | `node scripts/check-dependencies.mjs`, `git diff --check` | No renderer behavior tests were needed for this backend/default-route change. Dependency/source guard commands passed. |

## Original Findings Re-Checked

### Finding 1: Adaptive density baseline/fallback coverage

- Status: resolved.
- Fix Loop 1 adds high, medium, and low reference baseline assertions at `packages/authoring-core/src/mesh-generation.test.ts:2469`, `packages/authoring-core/src/mesh-generation.test.ts:2476`, and `packages/authoring-core/src/mesh-generation.test.ts:2495`.
- Fix Loop 1 adds alpha-bounds fallback coverage at `packages/authoring-core/src/mesh-generation.test.ts:2456` and asserts the reference/effective area diagnostics at `packages/authoring-core/src/mesh-generation.test.ts:2502`.

### Finding 2: Fallback-order coverage

- Status: resolved.
- The fallback probe now calls `createAutoOutlineV6DAdaptiveStaggeredBandMeshInternal(...)` with `forceGlobalAdaptiveGeometryFailureForTest` (`packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:425`) instead of directly constructing the fallback result.
- The forced failure is injected after generated adaptive geometry, then flows through the normal `geometry.status === "failed"` branch and calls `createWave70SupportRingFallback(...)` (`packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:239`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:249`).
- The test asserts Wave70 source before coarse fallback at `packages/authoring-core/src/mesh-generation.test.ts:2645`.

### Finding 3: Staggered midpoint and strip topology oracle

- Status: resolved.
- Fix Loop 1 adds `probeV6DAdaptiveStaggeredBandStripGeometryForTest()` (`packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts:435`) and a test that verifies a phase-shifted inner point is closer to the alpha-edge midpoint than either endpoint, is not an alpha point, and still has positive offset (`packages/authoring-core/src/mesh-generation.test.ts:2543`).
- The same test asserts every explicit strip triangle pair uses `A[i], A[i+1], I[i]` and `A[i+1], I[i+1], I[i]` global indices (`packages/authoring-core/src/mesh-generation.test.ts:2527`).

## Findings

No remaining blocking or needs-change findings for Test Adequacy Review.

## Validation Reviewed / Performed

Reviewed Fix Loop 1 implementation report claims:

- Report claims `pnpm.cmd typecheck` passed.
- Report claims focused authoring-core, operation-core, editor model/command tests passed after sandbox `spawn EPERM` reruns.
- Report states PSD import e2e was not rerun in Fix Loop 1; initial Domain A e2e pass is retained.
- Report claims source organization, dependency guard, removed local-strip-omitted `rg`, and `git diff --check` passed.

Performed in this re-review:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts --reporter=dot` | Sandbox run failed with esbuild `spawn EPERM`; approved rerun passed, 4 files / 112 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `node scripts/check-dependencies.mjs` | Pass. |
| `git diff --check -- packages/authoring-core packages/operation-core apps/editor discussion/implementation/waves/wave71 discussion/implementation/reviews/wave71` | Pass; CRLF working-copy warnings only. |

Not rerun in this lane:

- `pnpm.cmd --filter @private-2d-rigging-lab/editor test:e2e:psd-import`. Fix Loop 1 did not change e2e behavior materially beyond the default-route assertion already inspected, and the implementer report records that initial Domain A e2e validation passed.

## User-Decision Points

- None.

## Residual Risks

- Visual-quality validation remains outside automated test adequacy.
- The midpoint coordinate oracle proves a representative phase-shifted inner point and exact strip topology for all active strip pairs; it does not compare every inner point against an independently recomputed inward normal. This is acceptable for Domain A test adequacy because the topology oracle and generation diagnostics now lock the user-visible regression class.
