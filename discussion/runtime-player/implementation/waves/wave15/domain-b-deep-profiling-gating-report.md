# Runtime Player Wave15 Domain B Report: Deep Profiling Gating

- Verdict: pass
- Domain: Deep Profiling Gating
- Agent: Gnome
- Date: 2026-06-26

## Files Changed

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-runtime-export-payload.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/preload/browser-source-bridge-channels.ts`
- `apps/runtime-player/src/preload/browser-source-status-contract.ts`
- `apps/runtime-player/src/preload/browser-source-transport-contract.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `discussion/runtime-player/implementation/waves/wave15/domain-b-deep-profiling-gating-report.md`

Pre-existing Domain A dependency files remain modified in the worktree:

- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `packages/runtime-core/src/snapshot.ts`

## Implementation Summary

- Added `RuntimePlayerRuntimeCoreProfilingMode = "disabled" | "deep"` as the sanitized diagnostics control payload.
- Added `runtimeCoreProfiling?: "disabled" | "deep"` to Runtime Player pose evaluation; normal evaluation now omits runtime-core profiling options, while explicit `"deep"` passes `{ enabled: true }`.
- Kept Domain A snapshot validation behavior: Runtime Player pose evaluation still defaults `snapshotValidation` to `"skip"`.
- Added native Stage IPC plumbing:
  - Control API `runtimePlayer.stageView.setRuntimeCoreProfiling(mode)`.
  - Stage API `runtimePlayerStage.stageView.getRuntimeCoreProfiling()` and `onRuntimeCoreProfilingChanged(...)`.
  - main-process storage and Stage Window delivery through `stage-view` channels.
- Added Browser Source plumbing:
  - Control API `runtimePlayer.browserSource.setRuntimeCoreProfiling(mode)`.
  - Browser Source session/server storage and `runtime-core-profiling-changed` WebSocket message.
  - current profiling mode is included in Browser Source runtime-export HTTP response and `runtime-export-resync`, so newly connected Browser Source clients receive the active capture state.
  - Browser Source server/client parsers accept absent/null profiling mode as `"disabled"` for backward-compatible message handling.
- Performance Diagnostics Start Capture now requests `"deep"` for the selected target (`native-stage`, `browser-source`, or `both`); Stop, Clear, timer completion, and unmount request `"disabled"`.

## Normal Rendering Gating

- Native Stage and Browser Source renderers default `runtimeCoreProfiling` to `"disabled"`.
- `evaluateRuntimeExportPose` only creates a runtime-core deep profile when `runtimeCoreProfiling === "deep"`.
- Coarse app-side timing (`runtimeCoreEvaluationDurationMs`) remains available without enabling runtime-core phase profiling.
- `StaticStageCanvasRenderer.getRenderMetricsSnapshot()` always reports coarse render/cache/evaluation counters, but omits expanded runtime-core phase fields unless the renderer is currently in `"deep"` mode.

## Performance Diagnostics Deep Capture

- Performance Diagnostics capture sends only the sanitized target/mode payload.
- Native Stage receives mode through Stage IPC and applies it to `StaticStageCanvasRenderer`.
- Browser Source receives mode through the Browser Source control bridge, session, WebSocket protocol, and client renderer adapter.
- Reports include runtime-core phase summaries when deep fields are present.
- Reports gracefully print `sampleCount=0 p50=unknown p95=unknown max=unknown` when deep fields are absent because profiling is disabled or unavailable.

## Browser Source Diagnostics Behavior

- Normal Browser Source heartbeat/renderer diagnostics continue to include coarse render metrics.
- Normal Browser Source diagnostics omit expanded runtime-core phase keys because `StaticStageCanvasRenderer` omits them outside `"deep"` mode.
- During Performance Diagnostics deep capture, Browser Source diagnostics include expanded runtime-core phase keys when the renderer has deep profiling metrics available.
- The Browser Source profiling control message contains only `{ runtimeCoreProfiling: "disabled" | "deep" }` plus protocol metadata and timestamp.

## Tests Run and Results

- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
  - Initial sandboxed attempt failed at Vitest startup with `spawn EPERM` from esbuild.
  - Re-run with escalation: passed, 13 files / 83 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src packages/runtime-core/src discussion/runtime-player/implementation/waves/wave15/domain-b-deep-profiling-gating-report.md`
  - Passed with LF-to-CRLF working-copy warnings only.
- Fix Loop 1: `pnpm.cmd exec vitest run apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`
  - Initial sandboxed attempt failed at Vitest startup with `spawn EPERM` from esbuild.
  - Re-run with escalation: passed, 1 file / 16 tests.
- Fix Loop 1: `git diff --check -- apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`
  - Passed with LF-to-CRLF working-copy warning only.
- Fix Loop 1: `git diff --check --no-index -- NUL discussion/runtime-player/implementation/waves/wave15/domain-b-deep-profiling-gating-report.md`
  - Reported no whitespace findings; exited non-zero because the untracked report differs from the empty device, with LF-to-CRLF working-copy warning only.

`pnpm install` was not run.

## Source Organization / Privacy Notes

- No dependencies or lockfiles were changed.
- No Runtime Export format, Editor, iFacialMocap, dynamics, keyforms, deformers, clipping, Variant, Stage Motion, Body Follow, native Stage transform, or OBS Browser Source rendering semantics were intentionally changed.
- No raw tracking frames, calibration internals, Browser Source token, private paths, Runtime Export payloads, textures, or mesh data are added to diagnostics or Browser Source messages.
- The new cross-process/protocol payload is a sanitized detail level only.
- Existing Browser Source client diagnostics validation still strips unknown render metric fields and malformed render metrics.
- Source organization guard passed; no `index.ts` implementation logic was added.

## Remaining Risks / Manual Verification

- Real-model native Stage and OBS Browser Source smoothness still needs manual verification after Domain C/final integration.
- A deep capture needs live render evaluations during the capture window to produce non-empty runtime-core phase sample summaries.
- Browser Source diagnostics are sampled; the first or final capture sample can still show unknown phase fields if no deep-profiled live frame has been reported yet.
- Manual checks should compare normal capture versus deep Performance Diagnostics capture for `runtimeCoreEvaluationDurationMs`, runtime-core phase fields, render FPS, applied live frame FPS, and Browser Source smoothness.
