# Runtime Player Wave16 Follow-up: Compiled Evaluator Proof Diagnostics

- Verdict recommendation: pass
- Agent: Gnome
- Date: 2026-06-26

## Scope

This follow-up adds copied Performance Diagnostics proof metrics for the Wave16 compiled evaluator connection. It does not optimize Runtime Player, change Runtime Export format, change runtime-core evaluation behavior, or edit Editor files.

## Files Changed

Runtime Player diagnostics / metrics:

- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`

Focused tests:

- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`

Docs / maps:

- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/waves/wave16/_map.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`

## Implementation Summary

- Added `compiledEvaluatorFrameCount`, `transientCompileCount`, and `transientInstanceCount` to renderer metrics.
- `evaluateRuntimeExportPose(...)` now reports whether a frame used the compiled evaluator through an existing instance, created a transient instance, or had to compile transiently.
- Runtime Player live Stage / Browser Source paths pass a target-local `RuntimeModelInstance`, so stable live captures should show compiled evaluator frames with zero transient compile/instance fallback.
- Added target-local `RuntimeExportRuntimeModelInstanceCache` hit/miss/invalidation counters.
- Added explicit copied report lines for `scaffoldEvaluationCache*` while preserving legacy `evaluationCache*` lines as scaffold-cache aliases.
- Added copied report lines for `runtimeModelInstanceCache*`.
- Surfaced `runtimeModelCompileDurationMs` as `scaffoldBuildSampleCount`, `latest`, and `scope=scaffold-build-cold-path`.
- Browser Source diagnostics validation remains backward compatible: missing new fields normalize to `0` / `null`, unknown fields are still stripped, and malformed render metrics are dropped.

## Phase Split Decision

No deeper runtime-core drawable/deformer phase split was added in this follow-up. The existing deep profiling already separates runtime-core snapshot, drawable materialization, deformer hierarchy, warp transform, rotation transform, masks, visibility/draw order, and validation. Splitting drawable materialization or deformer topology/effect phases further would require more invasive runtime-core instrumentation than this proof-diagnostics patch warrants.

## Manual Check Instructions

Ask the user to rerun Browser Source Performance Diagnostics with deep capture and save the copied report to `tmp/report.log`.

Expected healthy Browser Source copied-report lines during a stable capture:

- `scaffoldEvaluationCacheHitCount: <positive>`
- `scaffoldEvaluationCacheMissCount: 0`
- `compiledEvaluatorFrameCount: <positive>`
- `transientCompileCount: 0`
- `transientInstanceCount: 0`
- `runtimeModelInstanceCacheHitCount: <positive>`
- `runtimeModelInstanceCacheMissCount: 0`
- `runtimeModelInstanceCacheInvalidationCount: 0`
- `runtimeModelCompileDurationMs: scaffoldBuildSampleCount=<positive> latest=<non-negative> scope=scaffold-build-cold-path`

If the capture window includes Runtime Export reload, semantic Variant change, clear, dispose, or Browser Source renderer recreation, instance cache miss/invalidation counts may increase and should be interpreted as lifecycle evidence rather than a stable-frame fallback.

## Verification

- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
  - Passed after elevated rerun: 3 files / 48 tests.
  - Initial sandbox run failed with `spawn EPERM` while Vite/esbuild loaded config.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
  - Passed with escalation: 3 files / 46 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- <touched tracked files>`
  - Passed with LF-to-CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave16/_map.md`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.
- `git diff --no-index --check -- NUL discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
  - No whitespace findings; command returned normal no-index diff status with LF-to-CRLF warning only.

## Residual Risks

- Real OBS Browser Source smoothness and proof counters still require a user-captured report.
- `runtimeModelCompileDurationMs` is latest cold-path scaffold-build evidence, not a distribution and not a per-frame runtime-core phase.
- This patch does not prove stale OBS asset replacement by a build marker; Browser Source bundle/build ID was left out to avoid broad asset/manifest changes.
- Some broader runtime-player map/review documents outside this follow-up's allowed write scope may still describe the pre-follow-up non-copied `runtimeModelCompileDurationMs` status.
