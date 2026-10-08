# Wave17 Domain D Test Adequacy Review

- Verdict: pass
- Review lane: test adequacy
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

Repository evidence inspected:

- `git status --short -uall`
- `git diff -- apps/runtime-player/src/preload/performance-diagnostics-contract.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- targeted `rg -n` / line inspections for `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, `runtimeCoreRenderFrameOutputDurationMs`, `renderInputDrawableMappingDurationMs`, privacy exclusions, validation helpers, and renderer metric accumulation.

Reviewed Domain D changed files:

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

Additional related test evidence inspected because it locks render-frame profile behavior used by Domain D:

- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`

`git status --short -uall` also shows Wave17 A/B/C runtime-core changes and prior Wave17 reports/maps dirty in the workspace. Those are treated as upstream-domain facts based on the A/B/C pass reports, not as Domain D review scope.

## Findings

No test adequacy findings.

## Adequacy Notes

- Pass - metrics contract and validation cover the new fields. `compiledRenderFrameCount`, `publicSnapshotMaterializationCount`, and `runtimeCoreRenderFrameOutputDurationMs` are optional aggregate fields in `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:24`, `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:28`, and `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:44`. The validator accepts them through the shared optional counter/duration paths at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:129`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:145`, and `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:215`.
- Pass - backward compatibility for missing metrics is directly tested. The legacy-metrics test deletes the new counters/durations and expects zero/null defaults at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:24` through `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:148`.
- Pass - malformed new counters/durations are covered consistently through the shared validation helpers. Representative cases cover a non-integer `compiledRenderFrameCount`, negative `publicSnapshotMaterializationCount`, negative `lastRuntimeCoreRenderFrameOutputDurationMs`, and non-integer `runtimeCoreRenderFrameOutputDurationSampleCount` at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:151` through `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:260`; optional malformed snapshots are dropped as unavailable at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:263`.
- Pass - copied report rendering clearly displays the new fast-path proof counters and phase summary. Report aggregation reads deltas/samples at `apps/runtime-player/src/control/performance-diagnostics-report.ts:511`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:516`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:531`, and `apps/runtime-player/src/control/performance-diagnostics-report.ts:581`. Formatting labels `compiledRenderFrameCount` as `scope=render-frame-fast-path`, `publicSnapshotMaterializationCount` as public snapshot path/deep-profile scoped, and `runtimeCoreRenderFrameOutputDurationMs` as render-frame-fast-path scoped at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1190` through `apps/runtime-player/src/control/performance-diagnostics-report.ts:1236`.
- Pass - copied report wording distinguishes renderer input mapping from public snapshot materialization. The report prints `renderInputDrawableMappingDurationMs` while preserving the internal source field only as `sourceField=snapshotToRenderDrawableDurationMs` and an explicit non-public-snapshot scope at `apps/runtime-player/src/control/performance-diagnostics-report.ts:1274`; the test asserts the new wording and rejects a standalone copied `snapshotToRenderDrawableDurationMs:` line at `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:372`.
- Pass - report tests prove both Native Stage and Browser Source aggregation for the new counters. Native Stage report assertions cover the new counters and render-frame output duration at `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:216` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:274`; copied text assertions cover wording at `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:357`. Browser Source delta aggregation covers the same counters at `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:450` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:500`.
- Pass - unknown/disabled deep profiling behavior remains graceful. When only coarse runtime-core evaluation is available, the report keeps snapshot and render-frame phase summaries at `sampleCount=0` and prints `unknown` values with explicit scopes at `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:587` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:637`.
- Pass - privacy exclusions remain true. The copied report implementation lists excluded data classes at `apps/runtime-player/src/control/performance-diagnostics-report.ts:295` through `apps/runtime-player/src/control/performance-diagnostics-report.ts:301`. The privacy test injects token, raw frame, calibration, and private path fixtures and asserts neither stored samples nor copied report text contain them at `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:677` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:734`.
- Pass - renderer metric plumbing is tested where deterministic. `StaticStageCanvasRenderer` exposes the new counters in metrics snapshots at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:462` and accumulates render-frame/public-snapshot counters plus deep render-frame output duration at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:900` through `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:929`. Frame-pacing tests assert `compiledRenderFrameCount: 1`, `publicSnapshotMaterializationCount: 0`, deep `runtimeCoreRenderFrameOutputDurationMs`, and disabled deep fields at `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts:320` through `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts:390`.
- Pass - lower-level render-frame profile evidence supports the Domain D counters. `evaluateRuntimeExportPose(...)` reports `compiledRenderFrameCount: 0`, while `evaluateRuntimeExportRenderFrame(...)` reports `compiledRenderFrameCount: 1` at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:68` and `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:124`. The render-frame evaluation test asserts no public snapshot is present, deep public snapshot materialization count is `0`, and render-frame output duration is present at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:289` through `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts:351`.
- Pass - IPC storage and rejection paths remain covered. Stage render metrics are stored and published unchanged at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:135`, and malformed metrics are rejected without storing or notifying Control at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:190`.

The validation tests do not enumerate every invalid shape for every new field, but this is adequate because the production validator routes all optional counters through one `readOptionalCounter(...)` helper and all optional nullable durations through one `readOptionalNullableNonNegativeFiniteNumber(...)` helper at `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:453` and `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:457`; representative new-field cases exercise both helper paths.

## Verification Commands / Results

- `git status --short -uall`
  - Confirmed Domain D files dirty alongside upstream Wave17 A/B/C files and reports.
- `git diff -- <Domain D files listed above>`
  - Reviewed. No test adequacy findings.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-client-message.test.ts`
  - Initial sandbox run failed while loading Vitest config with `Error: spawn EPERM`.
  - Escalated rerun passed: 5 files / 92 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
  - Passed with escalation: 3 files / 15 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- <Domain D files listed above>`
  - No whitespace findings. Git emitted LF-to-CRLF working-copy warnings only.

`pnpm install` was not run.

## Residual Risks / Final Integration Notes

- Real OBS Browser Source performance improvement and stable real-model proof counters still require final integration/manual capture. This review only confirms deterministic unit/integration test adequacy for Domain D.
- `publicSnapshotMaterializationCount` is accumulated from runtime-core profile details when available; copied report wording correctly scopes it to public snapshot path/deep runtime-core profile. Final integration should confirm the real Browser Source copied report shows the expected stable pattern: `compiledRenderFrameCount > 0`, `publicSnapshotMaterializationCount: 0`, `transientCompileCount: 0`, `transientInstanceCount: 0`, and runtime model instance cache hits increasing after warm-up.
- Existing internal field names such as `snapshotToRenderDrawableDurationMs` remain in source/DTO surfaces for compatibility, but copied report wording is now tested as `renderInputDrawableMappingDurationMs` with explicit source/scope text. Future cleanup can rename internal DTO fields if desired, but it is not required for Wave17 Domain D.
