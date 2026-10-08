# Wave17 Domain C Design / Development Compliance Review

Verdict: pass

Review lane: design / development compliance only.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-a-runtime-core-render-frame-api-report.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-b-runtime-core-fast-output-internals-report.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-b-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Changed Files Reviewed

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`

Also inspected adjacent runtime-core and Runtime Player cache/call-site files where needed:

- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts`
- `packages/runtime-core/src/runtime-model.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-profiling.ts`

## Commands And Results

- `git status --short -uall`
  - Showed the six Domain C app files, prior Wave17 A/B runtime-core files and reports, and no package manifest / lockfile / Editor / package-format changes.
- `git diff -- <six Domain C files>`
  - Directly reviewed the actual app/test diff.
- `git diff --check -- <six Domain C files>`
  - Passed with LF-to-CRLF working-copy warnings only.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format`
  - No output.
- `rg -n 'poseEvaluationMode' apps/runtime-player/src/stage`
  - Found the default mode declaration/selection and one explicit `poseEvaluationMode: "snapshot"` call in `static-stage-canvas-renderer.ts`.
- `rg -n 'poseEvaluation\.snapshot|snapshot\.diagnostics|RuntimeSnapshotDto|evaluateRuntimeExportPose\(' apps/runtime-player/src/stage/runtime-evaluation apps/runtime-player/src/stage/stage-renderer`
  - Found snapshot use in default/static pose evaluator paths, the explicit snapshot branch, and runtime diagnostics extraction only.
- `rg -n 'evaluateRenderFrame\(' apps/runtime-player/src/stage packages/runtime-core/src`
  - Confirmed Runtime Player calls `runtimeModelInstance.evaluateRenderFrame(...)` through `evaluateRuntimeExportRenderFrame(...)`.
- `rg -n 'from "@private-2d-rigging-lab/package-format"|from "@private-2d-rigging-lab/authoring-core"|from "@private-2d-rigging-lab/operation-core"|from "@private-2d-rigging-lab/validator-core"' packages/runtime-core/src`
  - No matches; command exited with normal no-match status.
- `rg -n 'publicSnapshotMaterializationCount|runtimeCoreRenderFrameOutputDurationMs|compiledRenderFrameCount|transientCompileCount|runtimeModelInstanceCacheHitCount|runtimeModelInstanceCacheMissCount' apps/runtime-player/src/stage apps/runtime-player/src/preload apps/runtime-player/src/main apps/runtime-player/src/control packages/runtime-core/src`
  - Confirmed Domain C consumes existing compiled evaluator / instance cache counters and tests runtime-core fast-path proof fields without broad Domain D report surfacing.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
  - Passed: 6 files / 39 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.

One initial broad `rg` command failed due PowerShell/regex quoting; it was rerun with corrected quoting and did not affect the review evidence above.

## Findings

No blocking design/development findings.

Runtime Player live evaluation now goes through the runtime-core render-frame API rather than the public snapshot path. `evaluateRuntimeExportRenderFrame(...)` calls `runtime.runtimeModelInstance.evaluateRenderFrame(...)` in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:122`, while the existing `evaluateRuntimeExportPose(...)` snapshot API remains available at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:67`.

`createEvaluatedRuntimeExportStageRenderInput(...)` defaults to render-frame mode and selects the snapshot path only when `poseEvaluationMode === "snapshot"` in `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:109`. The only production explicit snapshot mode call found is `setPayload(...)` in `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:238`, where it is used for the initial/static diagnostic-producing evaluation.

The render-scene builder now adapts either render-frame dynamic data or snapshot dynamic data behind a small union, with render-frame mapping in `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:258` and the snapshot compatibility branch isolated at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:273`. Live renderer calls at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:302`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:348`, and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:657` do not pass snapshot mode.

Target-local instance ownership remains intact. Each `StaticStageCanvasRendererController` owns its own `RuntimeExportRuntimeModelInstanceCache` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:120`, and the cache stores a single mutable instance keyed by scaffold cache key in `apps/runtime-player/src/stage/stage-renderer/runtime-export-runtime-model-instance-cache.ts:20`. Browser Source and Native Stage create separate renderer/controller instances through the existing stage renderer path, so they do not share mutable runtime instances or render-frame outputs.

Runtime Export identity and semantic active Variant invalidation remain keyed through the scaffold cache. `createRuntimeExportEvaluationCacheKey(...)` includes package identity, load identity, texture identity, atlas signature, and `createSemanticActiveVariantSelectionKey(...)` in `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:145`. `setActiveVariantSelection(...)` clears target-local runtime instances when the semantic cache key changes in `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:286`.

The app/runtime-core boundary remains clean for this domain. Runtime Player continues to adapt Runtime Export DTOs into a runtime-core graph through `createRuntimeExportRuntimeGraph(...)`, while runtime-core exports and evaluates `NormalizedRuntimeGraph` / `RuntimeModelInstance` APIs. No runtime-core forbidden downstream imports were found.

Diagnostics plumbing is minimal. Domain C carries existing compiled evaluator / runtime instance cache counters through the live renderer metrics and tests `publicSnapshotMaterializationCount === 0` plus `runtimeCoreRenderFrameOutputDurationMs` in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:340`. It does not broaden copied report naming/report presentation, which remains Domain D scope.

No Runtime Export format, Editor, package-format schema, dependency, or lockfile scope creep was found.

## Residual Risks

- The live render-frame path still clones render-frame vertices into Runtime Player render drawable inputs after runtime-core has already cloned frame-owned vertices. This is target-local/frame-owned and compliant, but it may remain measurable after public snapshot materialization is removed.
- Some existing metric names still say `snapshotToRenderDrawableDurationMs` and `runtimeCoreDrawableSnapshotCreationDurationMs` even when the live path is render-frame based. This is acceptable for Domain C because Domain D owns report naming/surfacing, but Domain D should prevent copied reports from implying public snapshot materialization.
- Manual real OBS Browser Source performance remains unproven until Domain D/E integration and user capture with the real Runtime Export.

## Required Fixes

None.
