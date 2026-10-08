# Runtime Player Wave18 Domain B Design / Development Compliance Review

- verdict: pass
- lane: design / development compliance
- reviewer: Review-Sylph Lane 2
- scope: Wave18 Domain B product profiling transport removal, cheap proof counters, product/privacy boundaries, and scope control
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

Inspected current working-tree diff for the requested Runtime Player source/test files, including:

- Control diagnostics: `control-window-app.tsx`, `performance-diagnostics-page.tsx`, `performance-diagnostics-report.ts`, and related tests.
- Stage/preload/main bridge surfaces: `stage-view-bridge-channels.ts`, `runtime-player-bridge.ts`, `runtime-player-stage-bridge.ts`, `stage-view-bridge-handlers.ts`, and related tests.
- Browser Source bridge/protocol/session/client surfaces: `browser-source-bridge-channels.ts`, `browser-source-status-contract.ts`, `browser-source-transport-contract.ts`, `browser-source-session.ts`, `browser-source-server.ts`, `browser-source-server-message.ts`, `browser-source-stage-client.ts`, `browser-source-stage-renderer.ts`, and related tests.
- Metrics/evaluation/rendering: `performance-diagnostics-contract.ts`, `performance-diagnostics-metrics-validation.ts`, `runtime-export-pose-evaluator.ts`, `evaluated-runtime-export-stage-scene.ts`, `static-stage-canvas-renderer.ts`, and related tests.

Also inspected scope-sensitive diffs with:

- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core`
- Result: no output.

## Findings

No blocking findings.

The Domain B implementation is design/development compliant with the Wave18 boundary. Product-reachable runtime-core deep profiling transport was removed without deleting runtime-core internal profiling utilities, and the remaining product diagnostics surface is focused on lightweight health/FPS/connection/fast-path proof metrics.

## Design / Development Confirmations

- Control no longer wires a product profiling callback into Performance Diagnostics. `PerformanceDiagnosticsPage` now receives only `onCopyReport`, and Start/Stop/Clear capture paths manage local capture/report state without profiling requests (`apps/runtime-player/src/control/performance-diagnostics-page.tsx:135`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:166`, `apps/runtime-player/src/control/performance-diagnostics-page.tsx:194`). The lifecycle test asserts the removed prop is not present (`apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts:53`).
- Stage preload/main product APIs no longer expose runtime-core profiling toggles. The remaining Stage bridge surface keeps render metrics and status/events, with no `setRuntimeCoreProfiling`, `getRuntimeCoreProfiling`, or profiling-changed channel (`apps/runtime-player/src/preload/stage-view-bridge-channels.ts:16`, `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:196`, `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:37`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:119`).
- Browser Source product bridge/protocol no longer carries profiling mode. The server message union includes resync, live frame, clear, display state, active Variant selection, and heartbeat messages but no `runtime-core-profiling-changed` variant (`apps/runtime-player/src/preload/browser-source-transport-contract.ts:47`, `apps/runtime-player/src/preload/browser-source-transport-contract.ts:54`, `apps/runtime-player/src/preload/browser-source-transport-contract.ts:101`). Session resync/broadcast code similarly omits profiling (`apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:472`, `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts:489`).
- Browser Source clients no longer receive or apply profiling changes. The parser has no profiling branch, and the regression test now treats a `runtime-core-profiling-changed` message as ignored/null (`apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts:111`, `apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts:225`, `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts:179`).
- Runtime-core internal/developer profiling remains intact. There is no `packages/runtime-core` diff, and runtime-core still exports and tests profiling utilities (`packages/runtime-core/src/index.ts:17`, `packages/runtime-core/src/runtime-profiling.ts:1`, `packages/runtime-core/src/runtime-core.test.ts:174`). Runtime Player still has an explicit evaluation helper option for dev/test use, but product code no longer reaches it through UI/IPC/WS (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:65`).
- Deep runtime-core timing fields were removed from the product diagnostics contract/validator/report path. `RuntimePlayerStageRenderMetricsSnapshot` no longer declares `lastRuntimeCore*` fields while retaining lightweight counters such as `compiledRenderFrameCount` and `publicSnapshotMaterializationCount` (`apps/runtime-player/src/preload/performance-diagnostics-contract.ts:4`, `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:23`, `apps/runtime-player/src/preload/performance-diagnostics-contract.ts:26`). Validation drops legacy runtime-core timing inputs instead of surfacing them (`apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts:13`).
- The copied report is intentionally re-scoped to lightweight health/FPS/connection/fast-path proof. It prints `diagnosticScope: live-health-fps-connection-fast-path`, FPS/counts, Browser Source client count, canvas/DPR, scaffold/cache counters, compiled render-frame counters, transient counters, and runtime instance cache counters (`apps/runtime-player/src/control/performance-diagnostics-report.ts:274`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:909`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:918`, `apps/runtime-player/src/control/performance-diagnostics-report.ts:921`). The removal of deep runtime-core timing output is within Domain B support scope after Domain A, not over-broad cleanup.
- `publicSnapshotMaterializationCount` is now sourced from cheap evaluation-profile facts instead of runtime-core deep profile payload. Snapshot evaluation records one materialization and render-frame evaluation records zero (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:117`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:171`). The renderer accumulates that cheap profile value directly (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:773`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:776`).
- Wave17 fast-path and target-local cache semantics remain intact. Runtime Player still routes render input through `createEvaluatedRuntimeExportStageRenderInput`, keeps `runtimeModelInstanceCache`, reports `compiledRenderFrameCount`, and does not reintroduce a public snapshot path for live render-frame frames (`apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:60`, `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts:147`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:406`).
- Browser Source privacy boundaries were not broadened by this change. The diff removes profiling fields and does not add new raw tracking/debug/calibration/token/path/export/texture/mesh data. Existing privacy exclusions and tests remain in place for copied reports and Browser Source diagnostics (`apps/runtime-player/src/control/performance-diagnostics-report.ts:256`, `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:609`, `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts:104`, `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts:179`).
- Scope is controlled. No Runtime Export schema, Editor, package-format, dependency, lockfile, or `pnpm install` scope was found in the inspected diff.

## Verification Considered / Run

- Inspected `git diff --stat` and targeted `git diff --` for all requested changed files.
- Ran targeted searches:
  - `rg -n "runtime-core-profiling|runtimeCoreProfiling|RuntimeCoreProfiling|profiling-changed" apps/runtime-player/src packages/runtime-core/src`
  - `rg -n "setRuntimeCoreProfiling|getRuntimeCoreProfiling|onRuntimeCoreProfilingChanged|runtimeCoreProfilingChanged|runtime-core-profiling-changed|runtimeCoreProfiling" apps/runtime-player/src`
  - `rg -n "RuntimeCoreEvaluationProfile|enableProfiling|profiling|profile" packages/runtime-core/src`
  - `rg -n "raw|token|private|texture|mesh|Runtime Export|runtimeExport" apps/runtime-player/src/main/broadcast-source apps/runtime-player/src/stage/browser-source apps/runtime-player/src/control/performance-diagnostics-report.ts`
- Initial sandboxed Vitest run failed before test startup with Vite/esbuild `spawn EPERM`.
- Elevated focused Vitest passed:
  - `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
  - Result: 9 files passed, 102 tests passed.
- Elevated `pnpm.cmd typecheck` passed.
- `git diff --check -- <reviewed Runtime Player files>` passed with no whitespace findings; CRLF working-copy warnings only.

## Residual Risks / Final Integration Notes

- `lastRuntimeModelCompileDurationMs` and non-runtime-core renderer timing summaries remain in the internal sanitized metrics DTO, but they are not printed in the copied product report. This is acceptable for Domain B because the Wave18 removal target was product-reachable runtime-core deep profiling and product-facing deep timing output; final integration can decide whether docs should mention that internal metrics still carry some lightweight renderer timing fields.
- The explicit `runtimeCoreProfiling?: "disabled" | "deep"` option remains on the Runtime Player runtime-evaluation helper for developer/test use. Current product UI/IPC/WS paths cannot toggle it, but future product callers should not wire it back without a new design decision.
- Real OBS Browser Source smoothness remains a manual final integration check; this lane verified design/development boundaries and focused automated behavior, not live OBS runtime perception.
