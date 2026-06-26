# Runtime Player Wave16 Domain D: Runtime Player Compiled Evaluator Connection

- Verdict recommendation: pass
- Domain: Runtime Player compiled evaluator connection
- Agent: Gnome
- Date: 2026-06-26

## Scope

Runtime Player now consumes runtime-core's compiled evaluator without changing Runtime Export payload shape, Runtime Export format files, Editor files, dependencies, or lockfile.

Runtime Export payload adaptation still happens in Runtime Player through `createRuntimeExportRuntimeGraph(...)`. The resulting runtime-core graph is compiled once into the invariant Runtime Player scaffold, and mutable runtime-core instances are owned by each renderer target.

## Files Changed

Runtime Player source:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`

Runtime Player tests:

- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`

Report:

- `discussion/runtime-player/implementation/waves/wave16/domain-d-runtime-player-compiled-evaluator-connection-report.md`

No runtime-core source, Editor files, Runtime Export format/package-format files, dependency manifests, or lockfiles were edited by Domain D.

Pre-existing Domain A/B/C and orchestration working-tree changes were not reverted or overwritten.

## Implementation Summary

- `RuntimeExportEvaluationScaffold` now stores `compiledRuntimeModel: CompiledRuntimeModel`.
- `createRuntimeExportEvaluationScaffold(...)` builds the compiled model once from `compileRuntimeModel(adapter.graph)` after Runtime Export to runtime-core graph adaptation.
- Scaffold cache keys remain based on Runtime Export identity, texture identity, atlas source signature, and semantic active Variant selection.
- `evaluateRuntimeExportPose(...)` now evaluates through a `RuntimeModelInstance`.
- Standalone/default-pose callers still work: when no target-local instance is supplied, the pose evaluator creates a one-frame instance from the supplied compiled model or a transient compiled model.
- Existing `previousState` compatibility is preserved for standalone callers by initializing a one-frame instance from `previousState`.
- Normal Runtime Player live evaluation continues to request `snapshotValidation: "skip"`.
- Deep runtime-core profiling is still requested only when `runtimeCoreProfiling === "deep"`.

## Instance / Cache Lifecycle

- `RuntimeExportEvaluationCache` owns only immutable scaffold data, including the compiled model. It does not own mutable `RuntimeModelInstance` state.
- `RuntimeExportRuntimeModelInstanceCache` is a renderer-target-local single-entry cache keyed by `RuntimeExportEvaluationScaffold.cacheKey`.
- Each `StaticStageCanvasRendererController` owns its own `RuntimeExportRuntimeModelInstanceCache`.
- Native Stage and Browser Source use separate `StaticStageCanvasRendererController` instances, so they own separate mutable runtime-core instances.
- Browser Source page reloads create a new Browser Source renderer and therefore a fresh target-local instance cache.
- Browser Source WebSocket reconnect/resync keeps the same renderer target when the Runtime Export payload is deduplicated, matching the prior `liveRuntimeState` continuity behavior; payload/Variant changes still reset the target-local runtime instance.
- `setPayload(...)`, `clearLiveParameterFrame()`, `clear()`, and `dispose()` clear the target-local runtime instance cache.
- Semantic active Variant selection changes clear the target-local runtime instance cache and reset `liveRuntimeState`.
- Non-semantic Variant timestamp-only changes reuse the current target-local instance because the scaffold/cache key is unchanged.
- Live frame evaluation no longer passes renderer-owned `previousState`; the runtime-core instance internal state is the source of truth.
- `liveRuntimeState` is still updated from evaluation results for compatibility with existing renderer state/reporting, but it no longer drives cached live evaluation when a target-local instance is present.

## Behavior Preservation Notes

- Runtime Export to runtime-core graph adaptation remains in Runtime Player and is unchanged.
- Render texture source, drawable render templates, clipping scaffold, model bounds, and existing cache hit/miss/invalidation counters remain Runtime Player scaffold responsibilities.
- Snapshot/render-scene DTO/output shapes are unchanged.
- Stage Motion and Body Follow are not changed by Domain D.
- Variant switching is preserved and now also resets the runtime-core instance when the semantic Variant selection changes.
- Dynamics state remains target-local through `RuntimeModelInstance`.
- Clipping and Browser Source render output remain covered by the existing evaluated-scene and Browser Source tests.
- Wave10 native local preview suspension remains covered by the live-suspension regression test.
- Wave14 invariant scaffold cache semantics are preserved except for the additive immutable `CompiledRuntimeModel` field on the scaffold.
- Wave15 validation/profiling gating is preserved: normal Runtime Player pose evaluation skips snapshot validation, and deep phase profiling remains opt-in.
- No raw tracking/debug/calibration data was added to Browser Source messages or diagnostics.

## Verification

- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
  - Passed: 2 files / 10 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
  - Passed: 3 files / 24 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts`
  - Passed: 3 files / 12 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- <Domain D tracked Runtime Player files>`
  - Passed with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave16/domain-d-runtime-player-compiled-evaluator-connection-report.md`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.

Vitest and typecheck were run with escalation because this environment's Vitest/Vite and TypeScript toolchain process spawning can fail under the restricted sandbox.

## Focused Test Evidence Added

- Runtime Player scaffold cache reuses the same `CompiledRuntimeModel` for a stable Runtime Export and semantically identical active Variant selection.
- Non-semantic Variant timestamp changes do not change the scaffold/compiled model.
- Semantic active Variant selection changes create a distinct compiled model and a distinct target-local runtime instance.
- Runtime Export reload identity changes create a distinct compiled model and a distinct target-local runtime instance.
- Separate Native-style and Browser Source-style target caches do not share one mutable `RuntimeModelInstance`.
- Separate target-local instances produce visually consistent render scenes and matching runtime state ticks for the same live frame sequence.

## Residual Risks / Follow-Up

- Real OBS Browser Source performance improvement is still manually unverified until Domain E/user diagnostics run against the real model.
- Browser Source WebSocket reconnect with an identical deduplicated payload preserves the current renderer target instance, matching prior live state continuity. If product behavior later requires reconnect to hard-reset dynamics even without payload/Variant change, that should be a separate explicit decision.
- The compiled model still retains the upstream runtime-core graph reference inherited from Domains A-C; Domain D does not change that runtime-core design caveat.

## Constraints Confirmation

- `pnpm install` was not run.
- No dependencies were added.
- No lockfile was edited.
- No Runtime Export format/package-format files were edited.
- No Editor files were edited.
- No public snapshot DTO shape was changed.
