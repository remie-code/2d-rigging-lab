# Runtime Player Wave18 Domain B Report: Product Profiling Transport Removal / Cheap Proof Counters

- Verdict recommendation: pass
- Domain: Domain B / Product Profiling Transport Removal and Cheap Proof Counters
- Agent: Orch-Sylph
- Loop count: 1
- Date: 2026-06-26

## Scope

Domain B removed Runtime Player product deep-profiling IPC / WS / product callback transport paths and made the fast-path public snapshot materialization proof counter cheap and independent of runtime-core deep profiling.

Basis:

- [../../orchestration/player-wave18-plan.md](../../orchestration/player-wave18-plan.md)
- [domain-a-product-diagnostics-simplification-report.md](domain-a-product-diagnostics-simplification-report.md)
- [../../reviews/wave18/domain-a-spec-compliance-review.md](../../reviews/wave18/domain-a-spec-compliance-review.md)
- [../../reviews/wave18/domain-a-design-development-compliance-review.md](../../reviews/wave18/domain-a-design-development-compliance-review.md)
- [../../reviews/wave18/domain-a-test-adequacy-review.md](../../reviews/wave18/domain-a-test-adequacy-review.md)
- [../../orchestration/player-wave17-plan.md](../../orchestration/player-wave17-plan.md)
- [../wave17/wave17-final-integration-report.md](../wave17/wave17-final-integration-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

Out of scope preserved:

- No runtime-core internal profiling utilities were deleted.
- No Runtime Export format changes.
- No Editor changes.
- No package-format schema changes.
- No new dependencies, lockfile edits, or `pnpm install`.

## Implementation Summary

Gnome implemented source/test changes in a separate context.

Changed source/test files:

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

Implementation facts:

- Control Performance Diagnostics no longer accepts or receives the inert `onSetRuntimeCoreProfiling` callback.
- Stage view product IPC no longer exposes `getRuntimeCoreProfiling`, `setRuntimeCoreProfiling`, or `runtimeCoreProfilingChanged` channels.
- Stage window and `StaticStageCanvasRenderer` no longer carry product-set runtime-core profiling mode.
- Browser Source product bridge, HTTP runtime-export response, WS message contract, session broadcasting, stage client parsing, and renderer adapter no longer expose or apply `runtime-core-profiling-changed` / `runtimeCoreProfiling`.
- Browser Source stale profiling messages are ignored rather than parsed as product protocol messages.
- Product diagnostics metrics contract, validation, and copied report output no longer carry deep runtime-core phase timing fields.
- `publicSnapshotMaterializationCount` is now carried by the Runtime Player evaluation profile directly:
  - snapshot evaluation records `1`;
  - render-frame evaluation records `0`;
  - evaluated Stage render input forwards the value;
  - `StaticStageCanvasRenderer` accumulates it from the lightweight profile, not from `runtimeCoreProfile`.
- Wave17 render-frame fast path remains the live default, and snapshot mode remains explicit for initial/static diagnostic setup.
- `compiledRenderFrameCount`, transient compile/instance counters, scaffold counters, Browser Source client count, and runtime model instance cache counters remain available in sanitized metrics/report paths.
- Runtime-core internal profiling and Runtime Player evaluator-level dev/test profiling remain available, but are no longer product-reachable through Control UI, Stage IPC, Browser Source HTTP, Browser Source WS, or Browser Source client handling.

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Spec compliance | [domain-b-spec-compliance-review.md](../../reviews/wave18/domain-b-spec-compliance-review.md) | pass |
| Design / development compliance | [domain-b-design-development-compliance-review.md](../../reviews/wave18/domain-b-design-development-compliance-review.md) | pass |
| Test adequacy | [domain-b-test-adequacy-review.md](../../reviews/wave18/domain-b-test-adequacy-review.md) | pass |

All three required Review-Sylph lanes were separate agents and received basis documents plus actual changed files / diff instructions. No fix loop was required.

## Verification

Gnome verification:

- Focused Vitest initially failed in sandbox with Vite/esbuild `spawn EPERM`.
- Elevated focused Vitest passed:
  - 15 test files / 128 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- apps/runtime-player/src`
  - No whitespace findings; CRLF working-copy warnings only.
- Residual search found no non-test product Stage / Browser Source profiling transport surface. The remaining non-test `runtimeCoreProfiling` match is the evaluator-internal dev/test option in `runtime-export-pose-evaluator.ts`.

Orch-Sylph verification:

- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts apps/runtime-player/src/main/broadcast-source/browser-source-session.test.ts apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
  - Passed, 15 test files / 128 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- apps/runtime-player/src`
  - No whitespace findings; CRLF working-copy warnings only.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core`
  - No output.

Reviewer verification:

- Spec compliance reviewer independently inspected diff/searches and ran focused tests plus typecheck; verdict `pass`.
- Design/development reviewer independently inspected product transport, protocol/privacy, internal profiling preservation, and scope-sensitive diffs; ran 9 focused test files / 102 tests plus typecheck; verdict `pass`.
- Test adequacy reviewer independently inspected test diffs/searches and ran the full focused 15-file Runtime Player test set plus typecheck; verdict `pass`.

## Residual Risks / Next-Domain Notes

- Real OBS Browser Source smoothness remains a manual final integration check with the user's real Runtime Export, live input, and OBS Browser Source.
- `discussion/runtime-player/screens/performance-diagnostics.md` still reflects Wave17 deep-capture behavior. Wave18 Domain C final integration should update docs/maps after accepting Domains A-B.
- Runtime Player evaluator-level `runtimeCoreProfiling?: "disabled" | "deep"` remains for developer/test use. Future product bridge work should not re-expose it without a new accepted design decision.
- Internal sanitized metrics still include some non-runtime-core renderer/scaffold timing fields such as scaffold build and render input timings. They are not product deep runtime-core profiling transport.
