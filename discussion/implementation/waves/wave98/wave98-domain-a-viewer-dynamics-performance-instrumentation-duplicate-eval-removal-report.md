# Wave98 Domain A Report: Viewer Dynamics Performance Instrumentation + Duplicate Eval Removal

## Verdict Recommendation

Recommendation: `pass`.

Domain A removes the fresh active-frame duplicate zero-delta Viewer runtime evaluation and adds gated Viewer performance instrumentation. Runtime-core solver behavior, Dynamics formulas, presets, idle throttle semantics, Runtime Player, export formats, workspace save formats, dependencies, and lockfile were not changed.

## Files Changed

Source:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `packages/render-core/src/performance-instrumentation.ts`

Tests:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

Report/map:

- `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
- `discussion/implementation/waves/wave98/_map.md`

Observed pre-existing unrelated dirty files remained untouched, including `apps/runtime-player/**`, `pnpm-lock.yaml`, and `discussion/implementation/orchestration/_map.md`.

## Implementation Summary

Before:

- `ViewerRuntimeScreen` rAF tick called `evaluateViewerRuntimePlaybackFrame(...)` for active Dynamics playback.
- The tick stored only `runtimePlaybackState`.
- `createViewerRuntimeCleanStageProjection(...)` called `resolveViewerRuntimeParameterValues(...)`.
- For Dynamics-enabled models, `resolveViewerRuntimeParameterValues(...)` called `evaluateViewerRuntimePlaybackFrame(...)` again with `deltaTimeMs: 0`.
- Active fresh-frame projection could therefore pay for two Viewer runtime evaluations in one frame path.

After:

- The rAF tick stores a `ViewerRuntimeReusableParameterValues` snapshot alongside the fresh `RuntimeStateDto`.
- The reusable snapshot contains the fresh `parameterValues`, the runtime playback model object, state identity key, parameter signature, and the exact state object.
- `createViewerRuntimeCleanStageProjection(...)` passes the reusable snapshot to `resolveViewerRuntimeParameterValues(...)`.
- `resolveViewerRuntimeParameterValues(...)` reuses the snapshot only when:
  - Dynamics are enabled;
  - projection receives the same runtime state object;
  - the same `ViewerRuntimePlaybackModel` object is used;
  - state identity and state compatibility match;
  - the current base parameter signature matches.
- If any condition fails, the old zero-delta evaluation fallback is preserved.

## Performance Metrics Added

Added under the existing `globalThis.__LIVE2D_PERF__ === true` or `localStorage.live2dPerf === "1"` policy:

- `viewer.runtimeFrame.evaluations`
- `viewer.runtimeFrame.ms`
- `viewer.runtimeFrame.deltaZeroReevaluationSkipped`
- `viewer.runtimeFrame.deltaZeroReevaluationFallback`
- `viewer.cleanStageProjection.ms`

Not added:

- `runtime.dynamics.groups`
- `runtime.dynamics.substeps`

Reason: `packages/runtime-core` does not depend on `@private-2d-rigging-lab/render-core`. Adding runtime-core counters with the existing instrumentation helper would require a package dependency/manifest change, which is outside Domain A allowed scope and conflicts with the no-dependency/no-lockfile boundary. Duplicating instrumentation in runtime-core would create a second policy surface. This is deferred.

## Duplicate-Eval Skip Proof

Focused test: `reuses active Viewer Runtime frame parameter values for Clean Stage projection`.

Evidence:

- With perf enabled, after one active `evaluateViewerRuntimePlaybackFrame(...)` call and one Clean Stage projection using the reusable frame:
  - `viewer.runtimeFrame.evaluations === 1`
  - `viewer.runtimeFrame.deltaZeroReevaluationSkipped === 1`
  - `viewer.runtimeFrame.deltaZeroReevaluationFallback` is absent
  - `viewer.cleanStageProjection.ms` count is `1`
- The same test then builds the previous fallback projection without the reusable frame and proves output equality:
  - reused `parameterValues` equal fallback `parameterValues`
  - reused drawable bounds equal fallback drawable bounds
  - after fallback, `viewer.runtimeFrame.evaluations === 2` and `viewer.runtimeFrame.deltaZeroReevaluationFallback === 1`

This proves the fresh active-frame projection path skips the duplicate zero-delta evaluation while preserving previous projection output.

## Behavior Preservation Evidence

Covered by focused tests:

- Active Dynamics motion still advances over runtime frames and keeps motion after the driver stops.
- Runtime Controls overrides still feed Clean Stage without mutating authoring values.
- Dynamics output offsets still inject before keyform evaluation.
- Stale Dynamics state with a reused group id still falls back safely.
- Stale reusable frame falls back to zero-delta evaluation.
- No-Dynamics projection stays off the runtime evaluation path.
- Reset simulation still initializes/restarts simulation and preserves Runtime Controls overrides.
- Driver value changes still restart playback from idle and produce motion.
- Wave97 idle stop remains intact: playback loop stops after settled state and does not schedule more rAF frames while idle.
- Zero Dynamics Group case still schedules no playback loop.
- Perf instrumentation remains disabled by default.

## Conditional Write-Scope Justification

`packages/render-core/src/performance-instrumentation.ts` was changed because adding `viewer.runtimeFrame.ms` and `viewer.cleanStageProjection.ms` exposed an existing helper issue in Node/Vitest: extracting `performance.now` and calling it unbound can throw because the receiver is lost. The fix keeps the same public API and policy, but calls `performance.now()` through the performance object.

No runtime-core files were touched. Runtime-core group/substep counters are deferred for the dependency-boundary reason above.

## Verification Performed

Initial sandboxed focused test attempt:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- Result: blocked by sandbox, `spawn EPERM` while Vite/esbuild loaded config.

Final verification:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` | Pass: 2 files / 39 tests. |
| `pnpm.cmd exec vitest run packages/render-core/src/render-scene.test.ts` | Pass: 1 file / 5 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `git diff --check` | Pass. Git reported LF-to-CRLF working-copy warnings only. |

## Basis Coverage Self-Report

Read and applied:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave98-plan.md`
- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/waves/wave97/wave97-final-integration-report.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- relevant source/tests listed in the task

Deferred basis items:

- Wave84 was listed in the Wave98 plan as historical baseline, but not in the direct Gnome task basis list. It was not reread for this bounded Domain A implementation.
- Browser CPU profiling and pixel proof were not run; the plan did not make them blockers for Domain A.
- Runtime-core `runtime.dynamics.groups` / `runtime.dynamics.substeps` counters are deferred to a future design that can address dependency direction without manifest/lockfile drift.

## Residual Risks / Likely Next Bottlenecks

- `viewer.runtimeFrame.evaluations` now identifies total Viewer runtime evaluations, including fallback zero-delta evaluations. The skip/fallback counters should be read alongside it.
- Clean Stage projection still builds canvas projection and render-source projection every relevant Viewer update. `viewer.cleanStageProjection.ms`, existing `canvas.projection.ms`, and render/WebGL counters are the next evidence sources.
- Runtime snapshot creation and parameter resolution may still be significant during active Dynamics frames.
- Atlas Runtime dynamic projection remap and render/mask/WebGL phases remain possible bottlenecks after duplicate eval removal.
- Runtime-core group/substep counters remain unavailable until the instrumentation dependency boundary is designed.

## User-Decision Points

None blocking.
