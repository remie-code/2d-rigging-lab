# Wave18 Domain B Test Adequacy Review

verdict: pass

- lane: test adequacy
- reviewer: Review-Sylph Lane 3
- scope: Wave18 Domain B, product profiling transport removal and cheap proof counters

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
- Current `git diff` for `apps/runtime-player/src`

## Changed Files / Test Diffs Inspected

Current source/test diff under `apps/runtime-player/src` was inspected with `git diff --stat -- apps/runtime-player/src`, `git diff --name-status -- apps/runtime-player/src`, grouped `git diff --unified=20 -- ...`, and targeted `rg` searches.

Changed test files inspected:

- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts`
- `apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`

Changed source diffs inspected by area:

- Control diagnostics: `control-window-app.tsx`, `performance-diagnostics-page.tsx`, `performance-diagnostics-report.ts`
- Main Browser Source transport: `browser-source-bridge-handlers.ts`, `browser-source-runtime-export-payload.ts`, `browser-source-server.ts`, `browser-source-session.ts`
- Main Stage bridge and metrics validation: `stage-view-bridge-handlers.ts`, `performance-diagnostics-metrics-validation.ts`
- Preload contracts/bridges: `browser-source-bridge-channels.ts`, `browser-source-status-contract.ts`, `browser-source-transport-contract.ts`, `performance-diagnostics-contract.ts`, `runtime-player-bridge-contract.ts`, `runtime-player-bridge.ts`, `runtime-player-stage-bridge-contract.ts`, `runtime-player-stage-bridge.ts`, `stage-view-bridge-channels.ts`
- Stage Browser Source client/protocol/renderer: `browser-source-server-message.ts`, `browser-source-stage-client.ts`, `browser-source-stage-renderer.ts`
- Stage renderer/evaluation: `runtime-export-pose-evaluator.ts`, `evaluated-runtime-export-stage-scene.ts`, `static-stage-canvas-renderer.ts`, `stage-window-app.tsx`

## Findings

No blocking test adequacy findings.

The changed tests cover the deterministic Wave18 Domain B behavior required by the plan. The only remaining verification item is real OBS Browser Source smoothness, which is explicitly a manual final integration check rather than a deterministic unit-test requirement.

## Test Adequacy Confirmations

- Browser Source protocol tests no longer expect profiling messages. `browser-source-server-message.test.ts` now asserts a stale `runtime-core-profiling-changed` message is ignored, `browser-source-session.test.ts` asserts broadcasts/resync do not contain `runtimeCoreProfiling` or `runtime-core-profiling-changed`, and `browser-source-server.test.ts` removes `runtimeCoreProfiling` from runtime export payload expectations.
- Stage bridge tests no longer expose product profiling mode API. `stage-view-bridge-channels.test.ts`, `runtime-player-bridge.stage-view.test.ts`, `runtime-player-stage-bridge.test.ts`, and `stage-view-bridge-handlers.test.ts` no longer expect get/set/change profiling channels or API methods.
- Renderer metrics tests confirm fast-path counters remain available without deep profiling. `static-stage-canvas-renderer.frame-pacing.test.ts` asserts `compiledRenderFrameCount` and `publicSnapshotMaterializationCount` are still reported while the latest render-input options have no `runtimeCoreProfiling` value.
- Performance Diagnostics capture no longer changes runtime-core profiling mode. `performance-diagnostics-page.lifecycle.test.ts` asserts the page props do not include `onSetRuntimeCoreProfiling`, and the source diff removes the Control Window callback that previously called Stage and Browser Source profiling APIs.
- No product callback surface remains in the searched Runtime Player product bridge paths. Targeted `rg` found no `setRuntimeCoreProfiling`, `RuntimePlayerRuntimeCoreProfilingMode`, `onRuntimeCoreProfilingChanged`, or `requestCaptureRuntimeCoreProfiling` product surface. Remaining `runtimeCoreProfiling?: "disabled" | "deep"` is local to `runtime-export-pose-evaluator.ts` and its test, matching the Wave18 allowance for internal developer/test profiling.
- `publicSnapshotMaterializationCount` is covered as cheap and independent of deep profiling. `runtime-export-pose-evaluator.ts` carries it as a direct evaluation profile counter for snapshot/render-frame paths, `evaluated-runtime-export-stage-scene.ts` forwards it, and `static-stage-canvas-renderer.frame-pacing.test.ts` verifies renderer accumulation from a profile with `runtimeCoreProfile: undefined`.
- Metrics validation/report tests continue to cover retained fast-path counters and omitted deep runtime-core report fields. `performance-diagnostics-metrics-validation.test.ts` validates retained counters such as `compiledRenderFrameCount` and `publicSnapshotMaterializationCount`; `performance-diagnostics-report.test.ts` keeps copied-report assertions for fast-path counters and negative assertions for deep runtime-core fields.

## Verification Considered / Run

Considered but did not rely on Gnome's reported evidence:

- Focused Vitest initially failed in sandbox with esbuild `spawn EPERM`, then passed with escalation: 15 test files / 128 tests.
- `pnpm.cmd typecheck` passed.
- `git diff --check -- apps/runtime-player/src` had no whitespace errors; CRLF warnings only.

Independently run:

```text
pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts
```

Result: pass, 15 test files / 128 tests.

```text
pnpm.cmd typecheck
```

Result: pass.

```text
git diff --check -- apps/runtime-player/src
```

Result: no whitespace errors; CRLF working-copy warnings only.

Targeted searches run:

```text
rg -n "setRuntimeCoreProfiling|RuntimePlayerRuntimeCoreProfilingMode|runtime-core-profiling-changed|runtimeCoreProfiling|onRuntimeCoreProfilingChanged|onSetRuntimeCoreProfiling|requestCaptureRuntimeCoreProfiling" apps/runtime-player/src
```

Result: no product bridge/API surface remains. Matches were limited to negative tests, the `PerformanceDiagnosticsPage` no-prop assertion, and internal `runtime-export-pose-evaluator.ts` developer/test profiling options.

```text
rg -n "lastRuntimeCore|runtimeCore.*SampleCount|runtimeCoreRenderFrameOutput|runtimeCoreSnapshotCreation|runtimeCoreDrawableSnapshotCreation|runtimeModelCompileDuration" apps/runtime-player/src/preload/performance-diagnostics-contract.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.ts apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts
```

Result: deep runtime-core phase metric fields are absent from the product diagnostics contract, metrics validation, report formatting, and static renderer snapshot; only `runtimeModelCompileDurationSampleCount` remains as a retained scaffold/cache counter.

## Residual Risks / Final Integration Notes

- Real OBS Browser Source smoothness is still manual final integration evidence. The automated suite verifies protocol/API/counter behavior, not end-to-end visual smoothness under OBS.
- `discussion/runtime-player/screens/performance-diagnostics.md` still documents Wave17 deep-capture behavior. Wave18 final integration should update that document after Domain B is accepted.
- Runtime-core internal profiling remains reachable only through local developer/test evaluation options in Runtime Player runtime-evaluation code. This is within the Wave18 boundary, but final integration should avoid treating it as a product UI/protocol surface.
