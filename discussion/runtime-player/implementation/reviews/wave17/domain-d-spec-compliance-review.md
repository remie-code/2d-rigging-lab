# Wave17 Domain D Spec Compliance Review

- Verdict: pass
- Review lane: spec compliance
- Domain: Diagnostics / performance report semantics
- Date: 2026-06-26
- Reviewer: Review-Sylph

## Basis Documents Used

- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-a-runtime-core-render-frame-api-report.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-b-runtime-core-fast-output-internals-report.md`
- `discussion/runtime-player/implementation/waves/wave17/domain-c-runtime-player-fast-render-path-report.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave17/domain-c-spec-compliance-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave16-plan.md`
- `discussion/runtime-player/implementation/waves/wave16/wave16-followup-compiled-evaluator-proof-diagnostics-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

## Changed Files / Diff Reviewed

Required repository evidence inspected:

- `git status --short -uall`
- `git diff -- apps/runtime-player/src/preload/performance-diagnostics-contract.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- Targeted searches for `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, `runtimeCoreRenderFrameOutputDurationMs`, `runtimeCoreSnapshotCreationDurationMs`, `runtimeCoreDrawableSnapshotCreationDurationMs`, `snapshotToRenderDrawableDurationMs`, and `renderInputDrawableMappingDurationMs`.

Reviewed Domain D files:

- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`

`git status --short -uall` also showed Wave17 A/B/C runtime-core and Runtime Player changes plus Wave17 discussion artifacts. Those prior-domain changes are covered by the A/B/C pass reports listed above and were not treated as new Domain D findings.

## Findings

No spec-compliance findings.

## Spec Compliance Notes

- Pass - Performance Diagnostics contract now admits the fast-path proof fields. `compiledRenderFrameCount` and `publicSnapshotMaterializationCount` are optional renderer metric fields at `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:25` and `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:28`; `lastRuntimeCoreRenderFrameOutputDurationMs` and `runtimeCoreRenderFrameOutputDurationSampleCount` are added at `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:44`.
- Pass - main-process metrics validation accepts the new counters/duration and remains backward compatible. The validation whitelist includes the new counter/sample fields at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:21`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:24`, and `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:34`; optional reads default missing counters/durations through `readOptionalCounter(...)` / optional nullable duration handling at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:133` and `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:215`.
- Pass - copied reports include the fast path proof counters and render-frame output duration. Report aggregation reads deltas for `compiledRenderFrameCount` and `publicSnapshotMaterializationCount` at `apps/runtime-player/src/control/performance-diagnostics-report.ts:516` and `apps/runtime-player/src/control/performance-diagnostics-report.ts:531`, summarizes `runtimeCoreRenderFrameOutputDurationMs` at `apps/runtime-player/src/control/performance-diagnostics-report.ts:581`, and copies sanitized renderer snapshots at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1030`.
- Pass - copied report wording distinguishes public snapshot metrics from render-frame fast-path metrics. The formatter labels `compiledRenderFrameCount` as `scope=render-frame-fast-path` at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1193`, labels `publicSnapshotMaterializationCount` and `runtimeCoreSnapshotCreationDurationMs` as public-snapshot/deep-profile fields at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1202` and `apps/runtime-player/src/control/performance-diagnostics-report.ts:1231`, labels `runtimeCoreRenderFrameOutputDurationMs` as render-frame fast path at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1234`, and renames the copied render-input mapping line to `renderInputDrawableMappingDurationMs` with `sourceField=snapshotToRenderDrawableDurationMs` at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1274`.
- Pass - normal live diagnostics remain light while deep capture carries phase detail. The static renderer returns the base metric snapshot unless `runtimeCoreProfiling === "deep"` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:510`; phase metrics are only populated from `runtimeCoreProfile` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:907`. Runtime-core profiling options are only requested for `"deep"` in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:96` and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:149`.
- Pass - deep capture can compare before/after phase detail. The renderer records `publicSnapshotMaterializationCount` from runtime-core profile at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:908`, records `runtimeCoreRenderFrameOutputDurationMs` only for render-frame evaluations at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:923`, and still preserves existing runtime-core phase fields for comparison.
- Pass - render-frame and snapshot modes report the intended counters. Snapshot evaluation sets `compiledRenderFrameCount: 0` at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:117`; render-frame evaluation calls `evaluateRenderFrame(...)` and sets `compiledRenderFrameCount: 1` at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:130` and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:170`. The stage render-input builder defaults to render-frame mode at `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:110`.
- Pass - runtime diagnostic details stay snapshot-only. Render-frame evaluations return no snapshot diagnostics through `createRuntimeDiagnosticDetails(...)` at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:987`, preventing the fast live path from inventing broad diagnostic payloads.
- Pass - copied reports remain privacy-safe. The report's explicit privacy exclusions list raw tracking frames, calibration internals, Browser Source token, private file paths, full Runtime Export payload, Runtime Export textures, and Runtime Export mesh data at `apps/runtime-player/src/control/performance-diagnostics-report.ts:293`. Targeted search of changed reporting/validation/contract/renderer files found only these exclusion labels for token/path/full payload/texture/mesh terms. Existing privacy coverage asserts stripped unknown `privatePath` / `token` fields and no raw frame/calibration/path leakage at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:12` and `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:677`.
- Pass - missing/unknown metrics remain handled gracefully. Missing optional fields normalize to `0` or `null` in validation at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:453`, unavailable target reports use `null` counters and empty metric summaries at `apps/runtime-player/src/control/performance-diagnostics-report.ts:715`, and report tests cover unknown deep phase output at `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:587`.
- Pass - scope exclusions were respected in the reviewed source diff. No package manifest, lockfile, Editor file, or package-format schema diff was present. No `pnpm install` was run.

## Verification Commands / Results

- `git status --short -uall`
  - Confirmed D files are dirty alongside already-reviewed Wave17 A/B/C changes and Wave17 discussion artifacts.
- `git diff -- <Domain D files listed above>`
  - Reviewed.
- Targeted `rg` searches for the required metric names.
  - Confirmed new fields flow through contract, validation, renderer metrics, report aggregation, copied report formatting, and focused tests.
- `git diff --check -- <Domain D files listed above>`
  - Passed with CRLF working-copy warnings only; no whitespace findings.
- `git diff --name-only -- package.json pnpm-lock.yaml apps/editor packages/package-format`
  - No output.
- Targeted privacy search over changed report/validation/contract/renderer files.
  - Only expected privacy-exclusion labels matched.
- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
  - Passed: 6 files / 90 tests.
- `pnpm.cmd typecheck`
  - Passed.

## Residual Risks / Final Integration Notes

- Real OBS Browser Source performance improvement and a stable real-model copied report remain manual/final-integration evidence. The expected proof pattern is still `compiledRenderFrameCount > 0`, `publicSnapshotMaterializationCount = 0` for stable live render frames, zero transient fallback, and improved `renderFps` / `appliedLiveFrameFps`.
- `discussion/runtime-player/screens/performance-diagnostics.md` is still Wave16-oriented in the inspected basis. Wave17 Domain E should update docs/maps to reflect the final implemented Wave17 report terminology if this implementation passes final integration.
- `publicSnapshotMaterializationCount` is a deep runtime-core profile counter. Stable normal-live captures can still show the field as `0` when deep profile samples are absent; final manual interpretation should use the report scope labels and capture context.
