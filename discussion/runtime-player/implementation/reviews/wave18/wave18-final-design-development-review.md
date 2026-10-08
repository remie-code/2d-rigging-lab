# Runtime Player Wave18 Final Design / Development Review

- Date: 2026-06-26
- Lane: final integration design / development and architecture compliance
- Verdict: pass
- Reviewer: Review-Sylph

## Findings

No blocking findings.

Closeout recheck:

- Verified after final closeout: `discussion/runtime-player/implementation/reviews/wave18/_map.md` lists `wave18-final-design-development-review.md` with status `Pass`, `discussion/runtime-player/implementation/waves/wave18/_map.md` lists all final Review-Sylph lanes as complete with `pass`, and `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md` includes the final review results table with this lane as `pass`.

## Scope And Basis Reviewed

Reviewed basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave18-plan.md`
- `discussion/runtime-player/implementation/waves/wave18/domain-a-product-diagnostics-simplification-report.md`
- `discussion/runtime-player/implementation/waves/wave18/domain-b-product-profiling-transport-removal-report.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-b-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/waves/wave18/_map.md`
- `discussion/runtime-player/implementation/reviews/wave18/_map.md`
- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md`

Inspected current source/test/docs diff directly:

- Full `git diff -- apps/runtime-player/src`
- Targeted `git diff` / `rg` checks for the requested Control, preload, main, Browser Source, stage renderer, runtime-evaluation, docs, maps, and final report files.

## Design / Development Compliance Checks

- Product Control Start Capture no longer toggles runtime-core profiling. `PerformanceDiagnosticsPage` accepts only `onCopyReport`, and `startCapture`, `finishCapture`, and `clearCapture` only manage local capture/report state and timers. See `apps/runtime-player/src/control/performance-diagnostics-page.tsx:76`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:135`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:166`, and `apps/runtime-player/src/control/performance-diagnostics-page.tsx:194`. `control-window-app.tsx:869` now wires only report copying into the page.
- Product report output is scoped to lightweight live health / FPS / connection / fast-path proof. The copied report prints `diagnosticScope: live-health-fps-connection-fast-path` and privacy exclusions, while target lines keep FPS/counts, Browser Source client count, scaffold/cache counters, fast-path counters, transient counters, and runtime model instance cache counters. See `apps/runtime-player/src/control/performance-diagnostics-report.ts:254`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:274`, and `apps/runtime-player/src/control/performance-diagnostics-report.ts:862`.
- Deep runtime-core phase timings are not product report output. Searches over the diagnostics contract, validator, formatter, and static renderer found no `lastRuntimeCore*` / runtime-core phase duration product fields; only `runtimeModelCompileDurationSampleCount` remains as an internal sanitized sample count. The copied formatter does not print `runtimeModelCompileDurationMs` or deep phase timing lines.
- Product Stage IPC no longer exposes runtime-core profiling actions. Stage channels and handlers retain status/state/render metrics/view transform operations, with no `setRuntimeCoreProfiling`, `getRuntimeCoreProfiling`, or profiling-changed channel. See `apps/runtime-player/src/preload/stage-view-bridge-channels.ts:1`, `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:37`, and `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:90`.
- Product Browser Source bridge and protocol no longer carry runtime-core profiling mode. Browser Source Control bridge exposes status only, and the Browser Source server message union has resync/runtime export/live frame/display/variant/heartbeat/error messages with no `runtime-core-profiling-changed` variant. See `apps/runtime-player/src/preload/browser-source-bridge-channels.ts:1`, `apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.ts:24`, and `apps/runtime-player/src/preload/browser-source-transport-contract.ts:47`.
- Browser Source client handling does not apply profiling changes. The parser has no profiling branch, the client handles the remaining product messages, and regression tests assert stale `runtime-core-profiling-changed` messages parse to `null`. See `apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts:111`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:254`, and `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts:183`.
- Browser Source behavior is not changed by Performance Diagnostics except renderer diagnostics/metrics sampling. Existing runtime-export resync/change, live parameter, display state, active Variant selection, heartbeat, and diagnostics paths remain. Search and diff inspection found no product profiling side effect left in session resync, HTTP runtime-export response, WS broadcast, or client application.
- Wave17 fast render-frame path remains active. `createEvaluatedRuntimeExportStageRenderInput()` still defaults to `render-frame` mode; initial/static payload setup explicitly uses snapshot mode, while live render input construction omits snapshot mode and therefore uses the fast path. See `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:111`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:199`, and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:541`.
- `publicSnapshotMaterializationCount` is now cheap and independent of runtime-core deep profile payload. Snapshot evaluation records `1`, render-frame evaluation records `0`, the evaluated render input forwards the lightweight profile value, and `StaticStageCanvasRenderer` accumulates `profile.publicSnapshotMaterializationCount` directly rather than reading `runtimeCoreProfile`. See `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:117`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:171`, `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:147`, and `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:772`.
- Runtime-core internal developer/test profiling is preserved within the accepted boundary. Remaining `runtimeCoreProfiling?: "disabled" | "deep"` references are in `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:65`, direct developer/test coverage, and negative product tests. Current product Control, Stage IPC, Browser Source HTTP/WS, and Browser Source client paths cannot reach it.
- Privacy boundaries were not broadened by Wave18. The copied report retains explicit exclusions for raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, textures, and mesh data. Browser Source diagnostic/resync tests continue to assert raw/debug/calibration/profiling data is absent from product messages. Existing Runtime Export payload transport for Browser Source rendering remains the pre-existing render path, not a new diagnostics/report exposure.
- Scope guards passed. `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core` returned no output. I found no Runtime Export format, Editor, package-format schema, dependency, lockfile, or `pnpm install` change.
- Docs/maps reflect the Wave18 product direction. `performance-diagnostics.md`, Runtime Player maps, Wave18 map, and final integration report describe Performance Diagnostics as lightweight Live Health / FPS / connection / fast-path proof, with historical Wave15/Wave17 deep-profiling notes marked as superseded or historical rather than current product behavior.

## Verification / Searches Performed

- `git diff -- apps/runtime-player/src`
- `git diff --stat -- apps/runtime-player/src`
- `git diff --name-status -- apps/runtime-player/src`
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core`
- `git diff -- discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/_map.md discussion/runtime-player/implementation/reviews/wave18/_map.md discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- `rg -n "setRuntimeCoreProfiling|getRuntimeCoreProfiling|onRuntimeCoreProfilingChanged|runtimeCoreProfilingChanged|runtime-core-profiling-changed|runtimeCoreProfiling|RuntimeCoreProfiling|onSetRuntimeCoreProfiling|requestCaptureRuntimeCoreProfiling" apps/runtime-player/src packages/runtime-core/src`
- `rg -n "lastRuntimeCore|runtimeCore.*Duration|runtimeCoreRenderFrameOutput|runtimeCoreSnapshotCreation|runtimeCoreDrawableSnapshotCreation|runtimeModelCompileDuration" apps/runtime-player/src/preload/performance-diagnostics-contract.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `rg -n "publicSnapshotMaterializationCount|compiledRenderFrameCount|transientCompileCount|runtimeModelInstanceCache" apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/preload/performance-diagnostics-contract.ts apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `rg -n "runtime-core-profiling-changed|runtimeCoreProfiling|readBrowserSourceServerMessage|toBeNull|not\\.toContain" apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
- `rg -n "deep capture|deep runtime-core profiling|product deep profiler|runtime-core phase|runtimeCoreRenderFrameOutputDurationMs|RuntimeCoreProfiling|runtime-core-profiling" discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/_map.md discussion/runtime-player/implementation/reviews/wave18/_map.md discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
  - Result: pass, 15 files / 128 tests.
- `pnpm.cmd typecheck`
  - Result: pass.
- `git diff --check -- apps/runtime-player/src discussion/runtime-player`
  - Result: no whitespace errors; CRLF working-copy warnings only.

`pnpm install` was not run.

## Residual Risks / Next-Wave Recommendations

- Real OBS Browser Source smoothness remains manual verification with the user's real Runtime Export, live input, and OBS Browser Source. Automated tests prove protocol/API/counter behavior, not perceived smoothness.
- Future Control, Stage IPC, or Browser Source protocol work should not re-expose `runtimeCoreProfiling` without a new accepted design decision.
- Some lightweight renderer timing summaries remain in internal sanitized DTO/report objects while the copied product report intentionally omits them. If future documentation work wants exact copied-report wording, align `performance-diagnostics.md` to distinguish internal metrics from copied product report lines.
- If Browser Source still feels unsmooth after Wave18 manual verification, use the lightweight report counters to choose a narrow next target rather than reintroducing product deep profiling.

## post_review_closeout_needed

no
