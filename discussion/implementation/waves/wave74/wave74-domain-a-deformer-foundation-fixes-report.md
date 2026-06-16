# Wave74 Domain A: Deformer Foundation Fixes Report

## Verdict

pass

## Scope Implemented

- Warp Deformer draft/create/fit/reset domain calculation now uses committed mesh vertex bounds when a committed mesh exists.
- The mesh-vertex domain is expanded by deterministic fixed margin `WARP_DEFORMER_DOMAIN_MARGIN = 1`.
- Existing fallback behavior remains deterministic when no committed mesh exists.
- Existing committed Warp Deformer custom domains are preserved when used as child deformer bounds.
- Rotation `translation` Vec2 runtime/editor/package behavior was pinned with focused tests for rest fallback, exact keys, midpoint x/y interpolation, and after-load runtime evaluation.

No production runtime code was required for Rotation translation because the current generic `linear-1d-v1` evaluator and editor parameter projection already support Vec2 interpolation. This domain adds missing evidence and prevents regression.

## Files Changed

- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`

## Domain A Ownership Boundary

`apps/editor/src/features/editor-session/model/rig-tool-state.ts` is a shared dirty file. Domain A ownership is limited to warp-domain calculation: `WARP_DEFORMER_DOMAIN_MARGIN`, mesh-vertex/fallback bounds resolution, and use of those bounds for Warp Deformer draft/create/fit/reset payloads. The `keyformSetCount`, `keyformKeyCount`, `summarizeRigControlKeyforms`, and Deformer Tree keyform-count projection hunks in the same file are explicitly excluded from Domain A ownership; they are Wave74 Domain B keyform visibility/discovery read-model work and require/receive Domain B review.

`apps/editor/src/features/editor-session/model/rig-tool-state.test.ts` is also a shared dirty file. Domain A-owned tests are the warp mesh-bounds create/fit/reset assertions and related deterministic margin expectation updates. The test named `projects deterministic keyform counts for Deformer Tree discovery` and its keyform-count fixtures are explicitly excluded from Domain A ownership. It was left in place because current parallel Domain B UI files consume the count fields; removing it here would revert or break Domain B work rather than resolve Domain A behavior.

Observed but not owned by Domain A: existing/parallel dirty planning files, editor keyform-discovery UI files, and the keyform count/discovery hunks described above remained in the worktree and were not reverted.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
  - sandbox attempt failed at startup with esbuild `spawn EPERM`.
  - escalated rerun passed: 6 files / 36 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/runtime-graph-keyforms.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts`
  - escalated run passed: 5 files / 39 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/operation-core packages/authoring-core packages/runtime-core apps/editor discussion/implementation/waves/wave74`: passed with CRLF normalization warnings only.

## Basis Coverage Self-Report

- Wave74 Domain A Warp domain AC: implemented in editor rig-tool state and tests.
- Wave74 Domain A Rotation translation interpolation AC: implemented as focused runtime/editor/package evidence; no production schema or runtime logic change needed.
- Wave73 Rotation translation exposure baseline: preserved; focused operation/editor/runtime tests pass.
- UX-backed package logic authority: package/runtime evidence was updated where behavior is package/runtime-visible; GUI-only workaround was not used.
- Source organization policy: no new catch-all files; guard passed.
- Dependency policy: no dependency or lockfile changes; guard passed.
- Operation policy: package mutations continue through Operation Core; operation regression tests passed.
- Schema and ID conventions: no package schema or ID format changes.
- Rig Tool / Canvas Preview design: warp bounds remain deterministic target bounds for overlay/preview; Canvas evaluation still uses project-defined semantic deformation, not pixel/Cubism oracle behavior.

## Intentionally Deferred Basis Items

- Save/load keyform visibility, keyform count projection, and keyform discovery affordance are Domain B scope.
- Browser/e2e save/load UI proof is Domain B/C scope.
- Map closeout and review artifacts are Domain C/review scope.
- No slider performance work, selection/current parameter persistence, Viewer/Runtime View, mesh generation work, new save format, Texture Atlas, Cubism compatibility, provider/LLM integration, or scale exposure was attempted.

## User-Facing UX Trace

- Creating a Warp Deformer for a Drawable whose committed mesh vertices extend outside the source/layer rectangle now produces a domain enclosing those vertices plus 1px margin.
- Fit and reset use the same mesh-vertex domain for committed mesh children.
- Without a committed mesh, draft/fit/reset still fall back to the existing canvas bounds.
- Canvas evaluation proof shows outside-layer mesh vertices move with warp lattice offsets when the domain includes them.

## Operation / Runtime / Package Contract Trace

- Operation payload schemas were unchanged. Editor-generated `domainBounds` now carries the corrected mesh-vertex domain into existing `createWarpDeformer` / `updateRigControl` flows.
- Operation Core materialization remains deterministic and existing rig-control operation tests pass.
- Runtime `linear-1d-v1` Vec2 interpolation is pinned by exact and midpoint tests.
- Runtime rotation evaluation uses `restTranslation` when no translation sample applies and uses sampled keyed `translation` when present.
- Portable save/load evidence imports the saved session, converts it to a runtime graph, and evaluates rotation translation midpoint after load.

## Save/Load Keyform Evidence Trace

- Portable bundle round-trip still preserves keyed rotation `translation`.
- Added after-load runtime evaluation checks that imported `keyset_rotate_translation_x` samples midpoint `{ x: 2, y: -1.5 }` and applies it to `rig_head_rotate.localTransform.translation`.

## Must-Not Compliance Evidence

- No mesh generation algorithm changes.
- No mesh vertex clipping.
- No selection/current parameter/active tool/canvas view persistence.
- No save/load discovery UI or keyform count/read-model discovery implementation is claimed by Domain A.
- No browser-local save slot, archive/filesystem, new save format, Viewer/Runtime View, Texture Atlas, Variant, Cubism SDK compatibility, external transport, or LLM/provider integration.
- No `restScale` / keyed scale exposure.
- No dependency changes.
- Parallel dirty files were not reverted.

## Residual Risk Classification

low-to-medium

- Browser-level proof for the exact Warp creation UI path remains for integration or Domain B/C if desired; focused editor model and Canvas evaluation tests cover the behavior directly.
- The fixed 1px margin is intentionally deterministic and geometry-independent. If future UX wants configurable padding, that should be a separate accepted design decision.
- Parallel Domain B changes appear to be present in the shared worktree; final integration should review combined editor-file diffs, especially `rig-tool-state.ts` and `rig-tool-state.test.ts`, with the ownership boundary above applied.

## User Decision Points

None.
