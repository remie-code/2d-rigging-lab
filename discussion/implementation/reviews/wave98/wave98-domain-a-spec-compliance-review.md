# Wave98 Domain A Spec Compliance Review

## Verdict

Verdict: `pass`.

Domain A satisfies the Wave98 spec-compliance requirements for Viewer Dynamics duplicate runtime evaluation removal and gated performance instrumentation. No source/test changes are requested from this review lane.

## Basis Read

- `discussion/implementation/orchestration/wave98-plan.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/waves/wave97/wave97-final-integration-report.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
- `discussion/implementation/waves/wave98/_map.md`

## Source/Test Evidence Reviewed

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
  - `evaluateViewerRuntimePlaybackFrame(...)` still delegates to `evaluateRuntimeFrame(...)` with the same Viewer fixed-step/max-substep path and wraps only timing/counter instrumentation (`viewer-runtime-playback.ts:100`, `viewer-runtime-playback.ts:116`, `viewer-runtime-playback.ts:129`, `viewer-runtime-playback.ts:149`).
  - `createViewerRuntimeReusableParameterValues(...)` records the evaluated frame parameter values together with the model object, parameter signature, exact state object, and state identity key (`viewer-runtime-playback.ts:153`).
  - `resolveViewerRuntimeParameterValues(...)` returns authored values for no-dynamics models, reuses only exact fresh compatible frame values, and otherwise falls back to the existing zero-delta evaluation (`viewer-runtime-playback.ts:254`, `viewer-runtime-playback.ts:260`, `viewer-runtime-playback.ts:264`, `viewer-runtime-playback.ts:279`).
  - Reuse compatibility requires the same model object, same state identity key, runtime-state compatibility, and matching parameter signature (`viewer-runtime-playback.ts:289`).
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - rAF evaluation stores a `ViewerRuntimePlaybackScreenFrame` containing both `state` and reusable parameter values (`viewer-runtime-screen.tsx:127`, `viewer-runtime-screen.tsx:260`, `viewer-runtime-screen.tsx:268`).
  - Clean Stage receives the compatible reusable frame value when the runtime state remains compatible (`viewer-runtime-screen.tsx:151`, `viewer-runtime-screen.tsx:157`, `viewer-runtime-screen.tsx:163`).
  - Clean Stage projection passes reusable values into `resolveViewerRuntimeParameterValues(...)` and records projection timing under the existing perf helper (`viewer-runtime-screen.tsx:335`, `viewer-runtime-screen.tsx:371`, `viewer-runtime-screen.tsx:401`).
  - Wave97 rAF lifecycle still schedules one frame, evaluates, and only reschedules while `isViewerRuntimePlaybackStateSettled(...)` is false (`viewer-runtime-screen.tsx:224`, `viewer-runtime-screen.tsx:234`, `viewer-runtime-screen.tsx:274`).
- `packages/render-core/src/performance-instrumentation.ts`
  - Perf collection remains disabled by default and gated by `globalThis.__LIVE2D_PERF__ === true` or `localStorage.live2dPerf === "1"` (`performance-instrumentation.ts:26`, `performance-instrumentation.ts:46`, `performance-instrumentation.ts:58`, `performance-instrumentation.ts:66`).
  - No console logging is added; `rg "console\\."` over touched instrumentation/viewer files returned no matches.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Duplicate-eval skip/fallback and output equality are covered (`viewer-runtime-screen.test.ts:375`, `viewer-runtime-screen.test.ts:407`, `viewer-runtime-screen.test.ts:420`, `viewer-runtime-screen.test.ts:428`).
  - Stale reusable frame fallback is covered (`viewer-runtime-screen.test.ts:439`, `viewer-runtime-screen.test.ts:477`).
  - No-dynamics runtime-evaluation guard and default instrumentation-off behavior are covered (`viewer-runtime-screen.test.ts:489`, `viewer-runtime-screen.test.ts:512`).
  - Dynamics motion preservation and Wave97 idle stop/restart/reset regressions remain covered (`viewer-runtime-screen.test.ts:333`, `viewer-runtime-screen.test.ts:671`, `viewer-runtime-screen.test.ts:695`, `viewer-runtime-screen.test.ts:727`).

## Spec Compliance Findings

- Fresh active-frame duplicate runtime evaluation: pass. The rAF tick performs one `evaluateViewerRuntimePlaybackFrame(...)` call and stores its parameter values; Clean Stage reuse increments `viewer.runtimeFrame.deltaZeroReevaluationSkipped` and does not increment fallback/evaluation again in the fresh compatible path.
- Fresh `parameterValues` reuse for Clean Stage: pass. The stored active-frame `parameterValues` are returned directly when the exact runtime state object and compatibility checks match.
- Conservative fallback: pass. Missing reusable values, no state, stale state, incompatible model identity/state identity, or changed parameter signature all fall back to the zero-delta evaluation path. No-dynamics models still bypass runtime evaluation entirely.
- Dynamics behavior preservation: pass. Solver formula/rate/threshold/defaults were not changed; runtime-core solver files are untouched, and Viewer playback constants remain unchanged. Existing motion/output tests still pass.
- Wave97 idle stop/restart behavior: pass. The scheduling/settled loop remains intact and focused idle stop, driver restart, and reset restart tests pass.
- Instrumentation policy: pass. Metrics are gated by the existing perf flag policy, default-off behavior is tested, and no console spam was introduced.
- Forbidden scope: pass for Domain A. The target diff is limited to Viewer playback/screen/tests, render-core instrumentation helper, and Wave98 report/map artifacts. A separate status check still shows pre-existing/unowned Runtime Player and `pnpm-lock.yaml` dirty files; per task instruction these were treated as outside Domain A ownership. The targeted forbidden-scope diff for runtime-core solver, package-format, editor runtime export/save/canvas, render-webgl2, and atlas source internals was empty.

Final metric names reviewed:

- `viewer.runtimeFrame.evaluations`
- `viewer.runtimeFrame.ms`
- `viewer.runtimeFrame.deltaZeroReevaluationSkipped`
- `viewer.runtimeFrame.deltaZeroReevaluationFallback`
- `viewer.cleanStageProjection.ms`

## Verification Commands/Results

| Command | Result |
|---|---|
| `git diff -- apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-playback.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts packages/render-core/src/performance-instrumentation.ts` | Reviewed. Changes match Domain A scope. |
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` | Pass: 2 files / 39 tests. Run escalated because prior sandbox execution hit `spawn EPERM`. |
| `pnpm.cmd exec vitest run packages/render-core/src/render-scene.test.ts` | Pass: 1 file / 5 tests. Run escalated for the same Vitest process-execution reason. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `git diff --check` | Pass; LF-to-CRLF working-copy warnings only. |
| `git diff --name-only -- packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/dynamics-evaluation.ts packages/package-format apps/editor/src/workspace/runtime-export apps/editor/src/workspace/save apps/editor/src/workspace/canvas packages/render-webgl2 packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts` | Empty. |
| `rg -n "console\\." apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-playback.ts packages/render-core/src/performance-instrumentation.ts` | No matches. |

## Blocking Issues

None.

## Residual Risks

- Runtime-core `runtime.dynamics.groups` and `runtime.dynamics.substeps` counters were not added. This is acceptable for Domain A because adding them through the existing helper would require a new runtime-core dependency direction or a second instrumentation surface.
- The worktree contains unowned Runtime Player and lockfile changes. They are not part of Domain A target files and were explicitly classified by the task as pre-existing/unowned; final integration should continue to keep them separated.
- Browser CPU profiling and pixel proof were not run. The Wave98 plan did not make them blockers for Domain A, and the focused tests prove the duplicate-evaluation skip and behavior preservation paths.
