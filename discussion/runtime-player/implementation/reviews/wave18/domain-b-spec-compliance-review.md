# Wave18 Domain B Spec Compliance Review

- verdict: pass
- lane: spec compliance
- reviewer: Review-Sylph Lane 1
- scope: Wave18 Domain B / product profiling transport removal and cheap proof counters
- date: 2026-06-26

## Basis Reviewed

- `discussion/runtime-player/implementation/orchestration/player-wave18-plan.md`
- `discussion/runtime-player/implementation/waves/wave18/domain-a-product-diagnostics-simplification-report.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave18/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave17-plan.md`
- `discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md`
- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

## Changed Files / Diff Inspected

Inspected actual current diff with `git diff --stat`, targeted `git diff --`, and source searches for all source/test files listed in the assignment:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-runtime-export-payload.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/preload/browser-source-bridge-channels.ts`
- `apps/runtime-player/src/preload/browser-source-status-contract.ts`
- `apps/runtime-player/src/preload/browser-source-transport-contract.ts`
- `apps/runtime-player/src/preload/performance-diagnostics-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`

## Findings

No blocking findings.

Non-blocking notes:

- `runtime-export-pose-evaluator.ts` still has an evaluator-internal `runtimeCoreProfiling?: "disabled" | "deep"` option at `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:65`, and tests still exercise it directly. This is acceptable under the Wave18 plan because the reviewed product Control, Stage IPC, Browser Source WS, and Browser Source client paths no longer expose or drive it.
- `lastRuntimeModelCompileDurationMs` / `runtimeModelCompileDurationSampleCount` remain in the sanitized renderer metrics contract at `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:30`. They are not deep runtime-core profiling mode transport and are not printed by the copied product report after Domain A/B; this review did not treat their remaining low-level metrics presence as a Domain B spec failure.

## Spec Confirmations

- Product Control no longer wires an inert profiling callback into Performance Diagnostics. `PerformanceDiagnosticsPage` accepts only `onCopyReport` in this surface (`apps/runtime-player/src/control/performance-diagnostics-page.tsx:76`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:87`), and `control-window-app.tsx` no longer passes `onSetRuntimeCoreProfiling` (`apps/runtime-player/src/control/control-window-app.tsx:864`).
- Product Stage IPC no longer exposes runtime-core profiling actions. The Stage bridge channels include render metrics and status channels but no `getRuntimeCoreProfiling`, `setRuntimeCoreProfiling`, or `runtimeCoreProfilingChanged` channel (`apps/runtime-player/src/preload/stage-view-bridge-channels.ts:1`). The Stage reporter API exposes `reportRenderMetrics` but no profiling getter/subscription (`apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:37`), and the main handler registers render metrics handlers without profiling mode state or sends (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:90`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:119`).
- The Stage window no longer reads or subscribes to product profiling changes. It reports render metrics only (`apps/runtime-player/src/stage/stage-window-app.tsx:343`), and the renderer interface no longer has `setRuntimeCoreProfiling`.
- Product Browser Source Control bridge no longer exposes profiling mode changes. The Browser Source API has only status access/subscription, and `browser-source-bridge-channels.ts` no longer defines a profiling channel.
- Browser Source protocol no longer sends product `runtime-core-profiling-changed` messages. The message union in `apps/runtime-player/src/preload/browser-source-transport-contract.ts:47` includes resync, runtime export, live frame, display, variant, heartbeat, diagnostics, and clear messages, with no profiling message variant. `RuntimePlayerBrowserSourceSession` resync broadcasts no `runtimeCoreProfiling` field (`apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:472`).
- Browser Source HTTP runtime-export responses no longer carry profiling mode. `createBrowserSourceRuntimeExportResponse` accepts status, stage display, active Variant selection, and runtime export payload only (`apps/runtime-player/src/main/broadcast-source/browser-source-runtime-export-payload.ts:63`), and the server builds that response without `runtimeCoreProfiling` (`apps/runtime-player/src/main/broadcast-source/browser-source-server.ts:370`).
- Browser Source client no longer receives or applies product runtime-core profiling changes. The parser has no runtime-core profiling branch, and the client only handles resync/runtime export/live frame/display/variant/heartbeat/diagnostics/clear flows (`apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts:91`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:229`, `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts:254`).
- Normal Browser Source behavior is preserved apart from sanitized metrics sampling. Runtime export resync, stage display state, active Variant selection, runtime export payload application, live frame application, diagnostics, and heartbeat flow remain in the inspected diffs; only profiling mode transport/application was removed.
- Wave17 render-frame fast path remains active. `createEvaluatedRuntimeExportStageRenderInput()` still defaults to `render-frame` mode unless snapshot mode is explicitly requested (`apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:112`). The live frame path calls it without snapshot mode (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:541`), while initial payload diagnostic setup explicitly uses snapshot mode (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:199`).
- `publicSnapshotMaterializationCount` is now a cheap product-safe counter independent of deep profiling. The evaluator profile sets it directly for snapshot and render-frame paths (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:118`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:172`), the render input profile forwards it (`apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:149`), and the renderer accumulates it from the lightweight profile instead of from `runtimeCoreProfile` (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:776`).
- Required lightweight counters remain available: `compiledRenderFrameCount`, `transientCompileCount`, `transientInstanceCount`, `publicSnapshotMaterializationCount`, and runtime instance cache counters remain in the metrics contract (`apps/runtime-player/src/preload/performance-diagnostics-contract.ts:23`, `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:29`), validation (`apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:117`, `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts:143`), renderer snapshots (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:406`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:416`), and copied report output (`apps/runtime-player/src/control/performance-diagnostics-report.ts:909`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:929`).
- Domain A behavior remains preserved. Start Capture still does not request deep profiling, copied reports retain `diagnosticScope: live-health-fps-connection-fast-path`, omit deep runtime-core phase fields, and keep lightweight health/FPS/connection/fast-path proof counters.
- Out-of-scope constraints are preserved. `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core` returned no output. No dependency/lockfile, Editor, package-format, Runtime Export format, or runtime-core internal profiling deletion diff was found. `pnpm install` was not run.

## Verification Considered / Run

- Inspected `git diff --stat` for the full changed source/test set: 40 files changed, 238 insertions, 1734 deletions.
- Inspected targeted `git diff --` groups for Control bridge, Stage IPC/preload/window, Browser Source bridge/session/server/protocol/client, diagnostics metrics validation/contract/report, renderer counter updates, and runtime pose evaluator updates.
- Ran required searches:
  - `rg -n "runtime-core-profiling|runtimeCoreProfiling|RuntimeCoreProfiling|profiling-changed" apps/runtime-player/src packages/runtime-core/src`
  - `rg -n "publicSnapshotMaterializationCount|compiledRenderFrameCount|transientCompileCount|runtimeModelInstanceCache" apps/runtime-player/src`
  - `rg -n "lastRuntimeCore|runtimeCore.*Duration" apps/runtime-player/src packages/runtime-core/src`
- Search result classification:
  - Product-facing profiling transport references are gone from source contracts/bridges/session/client.
  - Remaining `runtimeCoreProfiling` references are evaluator-internal options or negative tests asserting product messages/fields are ignored or absent.
  - Runtime-core internal profiling remains under `packages/runtime-core`, as allowed by the plan.
- Focused Vitest:
  - Sandbox run failed while loading Vite/esbuild config with `spawn EPERM`.
  - Elevated rerun passed:
    - `pnpm.cmd exec vitest run apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
    - Result: 15 test files passed, 128 tests passed.
- `pnpm.cmd typecheck`
  - Result: passed.
- `git diff --check -- <all reviewed changed source/test files>`
  - Result: no whitespace findings; CRLF working-copy warnings only.

## Residual Risks / Final Integration Notes

- `discussion/runtime-player/screens/performance-diagnostics.md` still reflects Wave17 deep capture behavior. Wave18 final integration should update that screen doc and maps after all Domain B review lanes pass.
- Real OBS Browser Source smoothness remains a manual final integration check with a real Runtime Export and OBS Browser Source. The code review and focused tests confirm the product deep-profiling transport is removed and lightweight counters remain available, but they do not prove real-world OBS FPS.
- The evaluator-internal `runtimeCoreProfiling` option can remain for developer/test use, but future product bridge additions should avoid re-exporting it through Control, Stage IPC, or Browser Source WS/HTTP contracts.
