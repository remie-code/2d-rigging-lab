# Wave17 Domain C Test Adequacy Review

- Verdict: pass
- Review lane: test adequacy
- Date: 2026-06-26
- Reviewer: Review-Sylph

## Basis Used

Basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-a-runtime-core-render-frame-api-report.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-b-runtime-core-fast-output-internals-report.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

Reviewed diffs, files, and searches:

- `git diff -- apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
- `rg -n "Stage Motion|stage motion|motion|Variant|variant|Browser Source|browser source|target|Target" apps/runtime-player/src/stage apps/runtime-player/src -g "*.test.ts" -g "*.test.tsx"`
- focused `rg` searches for `renderFrame`, `snapshot`, `publicSnapshotMaterializationCount`, `runtimeCoreRenderFrameOutputDurationMs`, `drawOrder`, `visible`, `opacity`, `vertices`, `clipping`, `mask`, `runtimeModelInstance`, `Variant`, `Stage Motion`, and `Browser Source`.

## Findings

No blocking test adequacy findings.

The Domain C tests are adequate for connecting Runtime Player evaluated Stage render input to the runtime-core render-frame fast path. The changed tests prove the default evaluated render input path no longer exposes a public snapshot, that renderer dynamic values are mapped from `renderFrame`, and that cache / target-local semantics remain covered. Related existing Stage Motion, Variant, Browser Source, and local preview suspension tests were located and rerun successfully.

## Coverage Notes

- Pass - evaluated render input can be built from fast render-frame output. `runtime-export-default-pose-evaluation.test.ts:289` creates evaluated Stage render input, asserts `"snapshot" in renderInput.poseEvaluation` is false at `:316`, checks render-frame body vertices and opacity at `:317`, and checks the final scene mesh uses the deformed vertices at `:323`.
- Pass - fast-path proof counters are covered when deep profiling is enabled. The same test asserts `publicSnapshotMaterializationCount` is `0`, `runtimeCoreRenderFrameOutputDurationMs` is present, and `snapshotValidationDurationMs` remains `0` at `runtime-export-default-pose-evaluation.test.ts:340`.
- Pass - snapshot-mode/default pose coverage is retained where needed. Full default pose snapshot coverage remains in `runtime-export-default-pose-evaluation.test.ts:216`, including full snapshot detail, keyform samples, draw list, diagnostics, and deformed vertices. `static-stage-canvas-renderer.ts:238` explicitly uses `poseEvaluationMode: "snapshot"` for initial load diagnostics, while live/update calls omit that option and therefore use the default render-frame mode.
- Pass - Stage render mapping still covers dynamic vertices, opacity, draw order, visibility, clipping, static atlas UVs, and triangles. `runtime-export-default-pose-evaluation.test.ts:495` checks the evaluated scene body has opacity `0.25`, draw order `12`, visible `true`, clipping mask IDs, deformed vertices, UVs, and triangles. `runtime-export-stage-scene.test.ts:131` separately preserves raw scene draw order, opacity, visibility, and clipping relation mapping.
- Pass - Runtime Player cache tests cover scaffold reuse and dynamic output changes. `runtime-export-evaluation-cache.test.ts:36` reuses one scaffold/adapter while parameter input changes vertices, opacity, draw order, clipping, and dynamics state at `:60` through `:87`.
- Pass - compiled model reuse, invalidation, and target-local runtime instances are covered. `runtime-export-evaluation-cache.test.ts:90` verifies semantically identical Variant selection reuses the compiled model, separate native/browser instance caches create distinct instances, semantic Variant changes miss, and payload reload creates a different compiled model.
- Pass - Native Stage / Browser Source target separation is covered where practical. `runtime-export-evaluation-cache.test.ts:185` evaluates the same frame sequence through separate native and Browser Source instance caches, proves the rendered scenes are equal, and asserts the render-frame object and its vertex array are not shared at `:248` through `:251`.
- Pass - render-frame output ownership is directly exercised at Runtime Player level. Frame-to-frame render-frame objects are not reused in `runtime-export-evaluation-cache.test.ts:62`, and target-to-target render-frame vertex arrays are not shared in `runtime-export-evaluation-cache.test.ts:250`.
- Pass - Variant switching remains covered. `runtime-export-evaluation-cache.test.ts:261` checks semantic Variant keys ignore timestamp-only changes and switch visible drawables correctly. Existing `stage-window-app.test.ts`, `runtime-variant-session-state.test.ts`, and `browser-source-stage-client.test.ts` were also rerun.
- Pass - Stage Motion / Browser Source preservation tests remain relevant and passing. `stage-motion-transport.test.ts:9` covers Browser Source Stage Motion updates while native preview is suspended; `stage-motion-transform.test.ts`, `stage-motion-runtime.test.ts`, `browser-source-stage-client.test.ts`, and `static-stage-canvas-renderer.live-suspension.test.ts` were included in focused verification.

## Verification Run

- `git diff --check -- apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
  - Passed with CRLF working-copy warnings only.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-window-app.test.ts apps/runtime-player/src/main/stage-motion/stage-motion-transform.test.ts apps/runtime-player/src/main/stage-motion/stage-motion-runtime.test.ts apps/runtime-player/src/main/stage-motion/stage-motion-transport.test.ts apps/runtime-player/src/main/variant-controller/runtime-variant-session-state.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`
  - Passed: 10 files / 46 tests.
- `pnpm.cmd typecheck`
  - Passed.

`pnpm install` was not run.

## Residual Test Gaps

- There is no controller-level unit test that directly inspects `StaticStageCanvasRendererController` live frame application and asserts the internal `poseEvaluation` is render-frame mode. The lower-level evaluated render-input tests lock the default mode to render-frame, and source inspection shows live/update paths call that helper without `poseEvaluationMode`, so this is not blocking for Domain C.
- Real OBS Browser Source performance improvement and copied diagnostics proof remain outside this unit test lane. Domain D/E or manual verification still need to prove stable live captures show `compiledRenderFrameCount > 0`, `publicSnapshotMaterializationCount = 0`, and improved frame timing on the real model.
- App-level tests cover visibility through static drawable state and Variant-driven visibility. Keyform-driven visibility parity is still primarily covered by runtime-core/domain-B evidence rather than a dedicated Runtime Player render-frame fixture.
