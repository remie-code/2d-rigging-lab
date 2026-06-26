# Runtime Player Wave16 Final Integration Report: Runtime Core Compiled Evaluator v0

- Verdict recommendation: pass
- Domain: Final Integration / Docs Alignment
- Agent: Gnome
- Date: 2026-06-26

## Scope

Domain E integrated the Wave16 source/test facts from Domains A-D, updated maps/docs to match those facts, and recorded the remaining real OBS Browser Source performance check.

Domain E did not perform source implementation, Runtime Export format work, Editor work, dependency work, package manifest edits, lockfile edits, or final clean review work.

Basis:

- [../../orchestration/player-wave16-plan.md](../../orchestration/player-wave16-plan.md)
- [domain-a-runtime-core-compiled-api-shell-report.md](domain-a-runtime-core-compiled-api-shell-report.md)
- [../../reviews/wave16/domain-a-runtime-core-compiled-api-shell-clean-review.md](../../reviews/wave16/domain-a-runtime-core-compiled-api-shell-clean-review.md)
- [domain-b-compiled-snapshot-static-templates-report.md](domain-b-compiled-snapshot-static-templates-report.md)
- [../../reviews/wave16/domain-b-compiled-snapshot-static-templates-clean-review.md](../../reviews/wave16/domain-b-compiled-snapshot-static-templates-clean-review.md)
- [domain-c-compiled-rig-deformer-topology-report.md](domain-c-compiled-rig-deformer-topology-report.md)
- [../../reviews/wave16/domain-c-compiled-rig-deformer-topology-clean-review.md](../../reviews/wave16/domain-c-compiled-rig-deformer-topology-clean-review.md)
- [domain-d-runtime-player-compiled-evaluator-connection-report.md](domain-d-runtime-player-compiled-evaluator-connection-report.md)
- [../../reviews/wave16/domain-d-runtime-player-compiled-evaluator-connection-clean-review.md](../../reviews/wave16/domain-d-runtime-player-compiled-evaluator-connection-clean-review.md)
- [../wave15/wave15-final-integration-report.md](../wave15/wave15-final-integration-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)

## Files Changed By Wave16

Domains A-D source/test changes:

- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-static-templates.ts`
- `packages/runtime-core/src/snapshot-static-templates.test.ts`
- `packages/runtime-core/src/rig-control-hierarchy.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-compiled-topology.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`

Domains A-D report/review artifacts:

- `discussion/runtime-player/implementation/waves/wave16/domain-a-runtime-core-compiled-api-shell-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-a-runtime-core-compiled-api-shell-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-b-compiled-snapshot-static-templates-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-b-compiled-snapshot-static-templates-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-c-compiled-rig-deformer-topology-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-c-compiled-rig-deformer-topology-clean-review.md`
- `discussion/runtime-player/implementation/waves/wave16/domain-d-runtime-player-compiled-evaluator-connection-report.md`
- `discussion/runtime-player/implementation/reviews/wave16/domain-d-runtime-player-compiled-evaluator-connection-clean-review.md`

Domain E docs/maps changes:

- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/_map.md`
- `discussion/runtime-player/implementation/reviews/wave16/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/screens/_map.md`
- `discussion/runtime-player/_map.md`

## Integration Evidence

Runtime-core now exposes first-class compiled evaluator v0:

- Domain A added `compileRuntimeModel(graph)`, `CompiledRuntimeModel`, and `RuntimeModelInstance`.
- `runtimeCore.compileRuntimeModel` is additive, and existing `evaluateRuntimeFrame(...)` remains available and compatible.
- Domains B/C moved compiled static snapshot templates and rig/deformer graph topology into the compiled model while preserving the compatible frame result shape.

Runtime-core dependency boundary remains intact:

- `compileRuntimeModel(graph)` compiles a `NormalizedRuntimeGraph`.
- Runtime Export DTO parsing/adaptation remains in Runtime Player through `createRuntimeExportRuntimeGraph(...)`.
- Domain A-D dependency-boundary reviews found no Runtime Export package-format imports in runtime-core.

Target-local runtime instances are implemented:

- `CompiledRuntimeModel#createInstance()` creates mutable `RuntimeModelInstance`s.
- Runtime Player's `RuntimeExportEvaluationScaffold` stores the immutable compiled model.
- `RuntimeExportRuntimeModelInstanceCache` is renderer-target-local and is owned by each `StaticStageCanvasRendererController`.
- Native Stage and Browser Source use separate renderer controllers, so they do not share one mutable runtime-core instance.

Runtime Player uses the compiled evaluator:

- `createRuntimeExportEvaluationScaffold(...)` adapts Runtime Export payloads into runtime-core graph data and compiles the graph once for the scaffold.
- `evaluateRuntimeExportPose(...)` evaluates through a `RuntimeModelInstance`.
- Stable Runtime Export identity plus semantically identical active Variant selection reuses the compiled model; Runtime Export identity or semantic active Variant changes create a new compiled model and reset the target-local instance.

Snapshot compatibility and freshness are preserved:

- Snapshot DTO shape remains unchanged.
- Domains A-C added focused deep-equality coverage against the legacy/transient evaluator.
- Consecutive compiled evaluations return distinct snapshot/drawable objects.
- Public nested arrays such as vertices, UVs, mask source/target IDs, and draw lists are materialized or cloned so later frames do not mutate previously returned snapshots.

Behavior preservation:

- Domains A-D clean reviews passed with no findings.
- Dynamics state remains mutable and target-local through `RuntimeModelInstance`.
- Keyforms, opacity, visibility/draw order, deformers, clipping, variants, Stage Motion, Body Follow, Browser Source output, and Runtime Export load/render behavior are preserved by the focused tests and review evidence cited in A-D.
- Wave10 local preview suspension, Wave11 Stage Motion, Wave12 Variant switching, Wave14 invariant scaffold cache semantics, and Wave15 validation/profiling gating remain preserved.

Browser Source reconnect continuity:

- Browser Source WebSocket reconnect/resync with an identical deduplicated Runtime Export payload preserves the same renderer target instance when Variant semantics are unchanged.
- This matches prior `liveRuntimeState` continuity. Payload replacement, Runtime Export reload identity change, clear/dispose, or semantic active Variant change still invalidates the target-local instance.

Constraints preserved:

- `pnpm install` was not run.
- No dependencies were added.
- No lockfile was edited.
- No Runtime Export format/package-format files were edited.
- No Editor files were edited.
- No public snapshot DTO shape was changed.

## Performance Interpretation

Wave16 should improve the Browser Source runtime-core hot path by removing safe graph-derived work from repeated frame evaluation:

- `runtimeCoreSnapshotCreationDurationMs` remains the outer runtime snapshot creation phase.
- In Runtime Player's compiled path, `runtimeCoreDrawableSnapshotCreationDurationMs` measures per-frame materialization/finalization of public drawable DTOs from compiled templates. It no longer includes one-time graph-to-static-drawable, texture/UV, reference vertex, or mask template construction for cached scaffolds.
- In Runtime Player's compiled path, `runtimeCoreDeformerHierarchyEvaluationDurationMs` measures per-frame rig-control sample grouping, evaluated state construction, frame-dependent parent selection, opacity/effect-chain application, and drawable transforms. It no longer includes one-time hierarchy ordering, descendant/declaration lookup construction, affected drawable lookup construction, direct parent candidate construction, or effect-chain ID lookup construction.
- `runtimeCoreWarpDeformerVertexTransformDurationMs` and `runtimeCoreRotationDeformerVertexTransformDurationMs` remain per-frame vertex transform measurements.
- `renderDurationMs` remains renderer cost and should stay interpreted separately from runtime-core evaluation.
- `renderFps`, `appliedLiveFrameFps`, and `runtimeCoreEvaluationDurationMs` are the main end-to-end improvement indicators for live smoothness.

`runtimeModelCompileDurationMs` status after the Wave16 follow-up:

- `runtimeModelCompileDurationMs` exists in Runtime Player scaffold build profiling as a cache/scaffold construction measurement.
- It is copied as `runtimeModelCompileDurationMs: scaffoldBuildSampleCount=... latest=... scope=scaffold-build-cold-path`.
- It is a scaffold-build/cache-miss metric, not a per-frame runtime-core phase.
- For copied reports, use `scaffoldEvaluationCacheHitCount`, `scaffoldEvaluationCacheMissCount`, `runtimeModelCompileDurationMs`, `renderInputScaffoldBuildDurationMs`, and the runtime-core phase summaries to reason about cache misses versus frame hot-path cost.

Remaining cost / Wave17 candidate:

- Wave16 intentionally preserves public snapshot DTO compatibility, so final snapshot/drawable DTO allocation and public array cloning remain in the frame path.
- If real Browser Source diagnostics still show high `runtimeCoreSnapshotCreationDurationMs` or `runtimeCoreDrawableSnapshotCreationDurationMs` after Wave16, Wave17 should consider typed/render buffers or direct render-scene output on top of the compiled evaluator foundation.

## Docs / Maps Alignment

- Added Wave16 report and review maps.
- Updated Runtime Player implementation and orchestration maps from "Ready to launch" to Domain E final integration recommendation `pass`, pending final clean Review-Sylph review.
- Updated Performance Diagnostics docs with Wave16 compiled-path phase interpretation and the copied scaffold-build/cold-path status of `runtimeModelCompileDurationMs`.
- Updated Runtime Player screen/root maps so the latest manual check points to Wave16 Browser Source Performance Diagnostics rather than only the Wave15 baseline.
- Did not update backlog because no standalone backlog item was closed or newly created by Domain E.

## Verification

Inherited from Domain A:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed after elevated rerun: 2 files / 10 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- Domain A whitespace checks passed with LF-to-CRLF working-copy warnings only.

Inherited from Domain B:

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/texture-projection.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/keyform-target-application.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed after elevated rerun/fix: 7 files / 27 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- Domain B whitespace checks passed with LF-to-CRLF working-copy warnings only.

Inherited from Domain C:

- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-compiled-topology.test.ts`
  - Passed: 1 file / 2 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts packages/runtime-core/src/rig-control-compiled-topology.test.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-static-templates.test.ts packages/runtime-core/src/dependency-boundary.test.ts`
  - Passed: 8 files / 40 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- Domain C whitespace checks passed with LF-to-CRLF working-copy warnings only.

Inherited from Domain D:

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
- Domain D whitespace checks passed with LF-to-CRLF working-copy warnings only.

Domain E verification:

- `git status --short -uall`
  - Confirmed current dirty tree contains Wave16 runtime-core/app source changes, A-D reports/reviews, and no package manifest/lockfile/Editor/Runtime Export format files.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/orchestration/_map.md discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/screens/_map.md discussion/runtime-player/_map.md`
  - Passed with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL <new Domain E docs/maps>`
  - Checked `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`, `discussion/runtime-player/implementation/waves/wave16/_map.md`, and `discussion/runtime-player/implementation/reviews/wave16/_map.md`.
  - No whitespace findings; commands returned normal no-index diff status with LF-to-CRLF warnings only.

`pnpm install` was not run by Domain E.

## Manual User Check Still Required

Real OBS Browser Source performance improvement is not proven until the user captures the real setup.

Please ask the user to:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source using the Runtime Player Browser Source URL.
- Run Performance Diagnostics for Browser Source with deep capture.
- Compare `renderFps`.
- Compare `appliedLiveFrameFps`.
- Confirm `compiledEvaluatorFrameCount` increases with applied live frames.
- Confirm `transientCompileCount` is `0` during a stable Browser Source capture.
- Confirm `transientInstanceCount` is `0` during a stable Browser Source capture.
- Confirm `runtimeModelInstanceCacheHitCount` increases and target-local instance cache miss/invalidation counts stay stable during the capture unless a payload/Variant reset occurs.
- Compare `runtimeModelCompileDurationMs` as a scaffold-build/cold-path latest metric, not as a per-frame runtime-core phase.
- Compare `runtimeCoreEvaluationDurationMs`.
- Compare `runtimeCoreSnapshotCreationDurationMs`.
- Compare `runtimeCoreDrawableSnapshotCreationDurationMs`.
- Compare `runtimeCoreDeformerHierarchyEvaluationDurationMs`.
- Compare `runtimeCoreWarpDeformerVertexTransformDurationMs`.
- Compare `renderDurationMs`.
- Confirm Stage Motion, Body Follow, dynamics, Variant switching parity, Browser Source output, Runtime Export load/render behavior, and Wave10 local preview suspension/resume still work.
- Confirm copied reports do not include raw tracking frames, calibration internals, Browser Source token, private file paths, full Runtime Export payload, Runtime Export textures, or Runtime Export mesh data.
- Save the updated copied report to `tmp/report.log`.

## Residual Risks

- Real-model OBS Browser Source smoothness remains manually unverified after Wave16.
- Deep Performance Diagnostics capture intentionally enables profiling and may add measurement overhead while capture is active.
- A deep capture can still produce `unknown` / `sampleCount=0` phase summaries if no live render evaluation occurs during the capture window.
- Browser Source diagnostics are sampled, so first/final report samples can lag the latest deep-profiled live frame.
- Public snapshot DTO compatibility still allocates/clones final output objects and arrays by design; this may remain the next bottleneck.
- `runtimeModelCompileDurationMs` is copied as a scaffold-build/cold-path latest metric, not a per-frame runtime-core phase.
- Browser Source identical-payload reconnect currently preserves target instance continuity; a hard reset on every reconnect would be a separate product decision.
- The compiled model still retains the supplied `NormalizedRuntimeGraph` reference inherited from Domains A-C rather than deep-freezing the entire graph.
