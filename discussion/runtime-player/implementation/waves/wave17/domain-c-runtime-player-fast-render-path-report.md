# Runtime Player Wave17 Domain C Report: Runtime Player Fast Render Path Connection

- Verdict recommendation: pass
- Domain: Runtime Player Fast Render Path Connection
- Orchestrator: Orch-Sylph
- Implementation agent: Gnome
- Date: 2026-06-26
- Loop count: 1

## Scope

Domain C switched the Runtime Player evaluated Stage render input path to the runtime-core render-frame fast output API while preserving snapshot evaluation where Runtime Player still needs public snapshot diagnostics/default pose behavior.

This domain did not implement diagnostics/report UI semantics, Runtime Export format changes, Editor changes, package-format schema changes, dependency changes, lockfile edits, or `pnpm install`.

Basis:

- [../../orchestration/player-wave17-plan.md](../../orchestration/player-wave17-plan.md)
- [domain-a-runtime-core-render-frame-api-report.md](domain-a-runtime-core-render-frame-api-report.md)
- [domain-b-runtime-core-fast-output-internals-report.md](domain-b-runtime-core-fast-output-internals-report.md)
- [../../reviews/wave17/domain-a-spec-compliance-review.md](../../reviews/wave17/domain-a-spec-compliance-review.md)
- [../../reviews/wave17/domain-a-design-development-compliance-review.md](../../reviews/wave17/domain-a-design-development-compliance-review.md)
- [../../reviews/wave17/domain-a-test-adequacy-review.md](../../reviews/wave17/domain-a-test-adequacy-review.md)
- [../../reviews/wave17/domain-b-spec-compliance-review.md](../../reviews/wave17/domain-b-spec-compliance-review.md)
- [../../reviews/wave17/domain-b-design-development-compliance-review.md](../../reviews/wave17/domain-b-design-development-compliance-review.md)
- [../../reviews/wave17/domain-b-test-adequacy-review.md](../../reviews/wave17/domain-b-test-adequacy-review.md)
- [../../orchestration/player-wave16-plan.md](../../orchestration/player-wave16-plan.md)
- [../wave16/wave16-final-integration-report.md](../wave16/wave16-final-integration-report.md)
- [../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md](../wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

## Files Changed

Source and tests:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`

Review artifacts:

- [../../reviews/wave17/domain-c-spec-compliance-review.md](../../reviews/wave17/domain-c-spec-compliance-review.md)
- [../../reviews/wave17/domain-c-design-development-compliance-review.md](../../reviews/wave17/domain-c-design-development-compliance-review.md)
- [../../reviews/wave17/domain-c-test-adequacy-review.md](../../reviews/wave17/domain-c-test-adequacy-review.md)

Domain docs/maps:

- [domain-c-runtime-player-fast-render-path-report.md](domain-c-runtime-player-fast-render-path-report.md)
- [_map.md](_map.md)
- [../../reviews/wave17/_map.md](../../reviews/wave17/_map.md)

## Implementation Summary

- Added `evaluateRuntimeExportRenderFrame(...)` in Runtime Player stage runtime evaluation. It calls `RuntimeModelInstance#evaluateRenderFrame(...)` and returns renderer-facing `renderFrame` dynamic data.
- Kept `evaluateRuntimeExportPose(...)` as the public snapshot-compatible Runtime Player pose evaluation path.
- Changed `createEvaluatedRuntimeExportStageRenderInput(...)` to default to render-frame mode and build render scenes from runtime-core render-frame dynamic data plus cached Runtime Player scaffold/static render templates.
- Added an explicit `poseEvaluationMode: "snapshot"` option for the static/diagnostic path that still needs public snapshot diagnostics.
- Updated `StaticStageCanvasRenderer` initial payload evaluation to request snapshot mode for runtime diagnostics while leaving live frame, Variant refresh, and clear-live-frame evaluation on the default render-frame mode.
- Preserved target-local runtime instance cache usage by continuing to pass the renderer-owned `RuntimeExportRuntimeModelInstanceCache`.
- Preserved scaffold/cache key behavior for Runtime Export identity and semantic active Variant selection.
- Added or updated focused Runtime Player tests for render-frame input construction, snapshot fallback/default pose coverage, scaffold/runtime instance reuse and invalidation, target-local separation, render-frame output ownership, and dynamic render fields.

## Verification

Gnome verification:

- `pnpm.cmd typecheck`
  - Passed.
- Focused Runtime Player Vitest command
  - Passed: 10 files / 50 tests.
  - Covered Runtime Player evaluation/cache/stage scene, static renderer pacing/suspension, Browser Source client, Variant visibility, and Stage Motion tests.
- `git diff --check -- <changed Runtime Player files>`
  - No whitespace findings; CRLF working-copy warnings only.

Independent review verification:

- Spec compliance reviewer reran:
  - `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
    - Passed: 3 files / 15 tests.
  - `pnpm.cmd typecheck`
    - Passed.
  - `git diff --check -- <changed Runtime Player files>`
    - No whitespace findings; CRLF working-copy warnings only.
- Design / development compliance reviewer reran:
  - `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
    - Passed: 6 files / 39 tests.
  - `pnpm.cmd typecheck`
    - Passed.
  - `node scripts/check-source-organization.mjs`
    - Passed.
  - Package manifest / lockfile / Editor / package-format diff check
    - No output.
  - `git diff --check -- <changed Runtime Player files>`
    - No whitespace findings; CRLF working-copy warnings only.
- Test adequacy reviewer reran:
  - `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-window-app.test.ts apps/runtime-player/src/main/stage-motion/stage-motion-transform.test.ts apps/runtime-player/src/main/stage-motion/stage-motion-runtime.test.ts apps/runtime-player/src/main/stage-motion/stage-motion-transport.test.ts apps/runtime-player/src/main/variant-controller/runtime-variant-session-state.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`
    - Passed: 10 files / 46 tests.
  - `pnpm.cmd typecheck`
    - Passed.
  - `git diff --check -- <changed Runtime Player files>`
    - No whitespace findings; CRLF working-copy warnings only.

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Spec compliance | [domain-c-spec-compliance-review.md](../../reviews/wave17/domain-c-spec-compliance-review.md) | pass |
| Design / development compliance | [domain-c-design-development-compliance-review.md](../../reviews/wave17/domain-c-design-development-compliance-review.md) | pass |
| Test adequacy | [domain-c-test-adequacy-review.md](../../reviews/wave17/domain-c-test-adequacy-review.md) | pass |

All review lanes passed in the first loop. No Gnome fix loop was required.

## Constraints Confirmed

- `pnpm install` was not run.
- No dependencies were added.
- No lockfile edits were made.
- No Runtime Export format or package-format schema files were edited.
- No Editor files were edited.
- Domain C source changes are limited to Runtime Player stage evaluation/rendering files and focused tests.
- Runtime-core fast output internals were not broadened by this domain.

## Residual Risks / Next-Domain Notes

- Domain D still owns diagnostics/report naming and surfacing for render-frame counters such as `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, and `runtimeCoreRenderFrameOutputDurationMs`.
- Existing metric names such as `snapshotToRenderDrawableDurationMs` remain in Runtime Player plumbing and need Domain D report wording/naming alignment so copied reports do not imply public snapshot materialization on the live fast path.
- Real OBS Browser Source performance improvement remains unproven until Domain D/E integration and a real-model Performance Diagnostics capture.
- The live render-frame path still copies vertices into Runtime Player render drawable inputs after runtime-core creates frame-owned output. This is target-local and safe, but may remain a later profiling target after public snapshot materialization is removed.
- There is no controller-level unit test that directly introspects the private live frame `poseEvaluation` mode. Lower-level tests lock the evaluated render-input default to render-frame mode, and source/review evidence confirms live paths call that helper without overriding to snapshot mode.
- Keyform-driven visibility parity is mainly covered by runtime-core Domain B evidence; Runtime Player Domain C covers Variant/static visibility and render-frame dynamic mapping.
