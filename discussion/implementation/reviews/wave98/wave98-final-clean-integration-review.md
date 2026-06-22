# Wave98 Final Clean Integration Review

## Verdict

Verdict: `pass`.

Wave98 の target source/test diff は、active Viewer Dynamics frame の fresh path で重複 zero-delta runtime evaluation を避け、同じ fresh `parameterValues` を Clean Stage projection に再利用する実装として妥当です。fallback は保守的で、Wave97 idle throttle、Dynamics の見た目/物理 semantics、Runtime Controls / Reset simulation、Original / Atlas Runtime の責務を変えていません。console spam、依存追加、Wave98-owned forbidden-scope drift は見つかりませんでした。

## Basis Read

- `discussion/implementation/orchestration/wave98-plan.md`
- `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
- `discussion/implementation/waves/wave98/wave98-final-integration-report.md`
- `discussion/implementation/waves/wave98/_map.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave98/wave98-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave98/_map.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/waves/wave97/wave97-final-integration-report.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Source/Test Evidence Reviewed

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
  - `evaluateViewerRuntimePlaybackFrame(...)` still calls `evaluateRuntimeFrame(...)` with the existing delta clamp and max substeps; added work is gated performance counter/timing only (`viewer-runtime-playback.ts:100`, `viewer-runtime-playback.ts:116`, `viewer-runtime-playback.ts:121`, `viewer-runtime-playback.ts:128`, `viewer-runtime-playback.ts:149`).
  - `createViewerRuntimeReusableParameterValues(...)` records the fresh frame's `parameterValues`, exact `RuntimeStateDto` object, model object, state identity key, and parameter signature (`viewer-runtime-playback.ts:153`).
  - `resolveViewerRuntimeParameterValues(...)` returns authored values for no-dynamics models, reuses only exact compatible fresh values, and otherwise falls back to the prior zero-delta evaluation (`viewer-runtime-playback.ts:254`, `viewer-runtime-playback.ts:260`, `viewer-runtime-playback.ts:264`, `viewer-runtime-playback.ts:279`).
  - Reuse compatibility requires same model object, same state identity key, compatible runtime state, and matching parameter signature (`viewer-runtime-playback.ts:289`, `viewer-runtime-playback.ts:298`, `viewer-runtime-playback.ts:301`).
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - rAF results are stored as a frame containing `state` plus optional reusable parameter values (`viewer-runtime-screen.tsx:113`, `viewer-runtime-screen.tsx:127`, `viewer-runtime-screen.tsx:133`).
  - Clean Stage receives reusable values only when the stored runtime state is compatible (`viewer-runtime-screen.tsx:151`, `viewer-runtime-screen.tsx:157`, `viewer-runtime-screen.tsx:163`, `viewer-runtime-screen.tsx:167`).
  - Wave97 rAF lifecycle remains single-request and settle-aware, with rescheduling only while unsettled (`viewer-runtime-screen.tsx:224`, `viewer-runtime-screen.tsx:234`, `viewer-runtime-screen.tsx:260`, `viewer-runtime-screen.tsx:274`, `viewer-runtime-screen.tsx:287`).
  - Clean Stage projection computes base parameters, calls `resolveViewerRuntimeParameterValues(...)` with the reusable snapshot, then records gated projection timing (`viewer-runtime-screen.tsx:335`, `viewer-runtime-screen.tsx:367`, `viewer-runtime-screen.tsx:371`, `viewer-runtime-screen.tsx:401`).
- `packages/render-core/src/performance-instrumentation.ts`
  - Perf remains opt-in via `globalThis.__LIVE2D_PERF__ === true` or `localStorage.live2dPerf === "1"` (`performance-instrumentation.ts:26`, `performance-instrumentation.ts:32`).
  - Counter/timing writes are no-ops when disabled and do not log to console (`performance-instrumentation.ts:46`, `performance-instrumentation.ts:58`, `performance-instrumentation.ts:66`).
  - `performance.now()` is called through the performance object, preserving the existing helper API (`performance-instrumentation.ts:99`).
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Fresh-frame reuse, output equality vs fallback, and counter evidence are covered (`viewer-runtime-screen.test.ts:375`, `viewer-runtime-screen.test.ts:407`, `viewer-runtime-screen.test.ts:420`, `viewer-runtime-screen.test.ts:428`).
  - Stale reusable frame fallback is covered (`viewer-runtime-screen.test.ts:439`, `viewer-runtime-screen.test.ts:477`).
  - No-dynamics and default-disabled instrumentation paths are covered (`viewer-runtime-screen.test.ts:489`, `viewer-runtime-screen.test.ts:512`).
  - Dynamics motion, reset preservation, stale state discard, idle stop/restart, and zero-dynamics no-loop regressions remain covered (`viewer-runtime-screen.test.ts:333`, `viewer-runtime-screen.test.ts:583`, `viewer-runtime-screen.test.ts:615`, `viewer-runtime-screen.test.ts:671`, `viewer-runtime-screen.test.ts:695`, `viewer-runtime-screen.test.ts:727`, `viewer-runtime-screen.test.ts:793`).

## Rubric Results

| Rubric item | Verdict | Evidence |
|---|---|---|
| active Viewer dynamics frame does not run duplicate runtime evaluation in the fresh-frame path | `pass` | Fresh frame stores reusable values and `resolveViewerRuntimeParameterValues(...)` returns them before fallback. Test asserts `viewer.runtimeFrame.evaluations === 1`, skip count `1`, and no fallback count after reused projection. |
| fresh `parameterValues` are reused for Clean Stage projection | `pass` | Reusable snapshot carries the exact fresh `parameterValues`; Clean Stage passes it into projection and tests assert reused projection values equal the active frame and fallback projection output. |
| fallback behavior is conservative and safe | `pass` | Reuse requires exact state object equality plus model/state/signature compatibility. Missing/stale/incompatible paths fall back to zero-delta evaluation. No-dynamics models bypass runtime evaluation. |
| Dynamics visual behavior and Wave97 idle throttle semantics are unchanged | `pass` | Solver/rate/threshold constants and runtime-core solver files were not changed. Motion, reset, stale-state, idle stop, driver restart, and zero-dynamics tests pass. |
| instrumentation is gated and does not spam console | `pass` | Existing perf flag gate is retained; default-disabled test asserts no stats; `rg -n "console\\." ...` returned no matches. |
| no forbidden scope drift | `pass for Wave98 target diff` | Target source diff is limited to Viewer playback/screen/test and render-core perf helper. Runtime-core solver/package-format/export/save/canvas/render-webgl2/atlas-source targeted diff was empty. Global dirty Runtime Player and lockfile state remains unowned/unrelated. |
| tests/checks are sufficient for this wave | `pass` | Focused tests directly cover duplicate skip, fallback, output equality, no-dynamics, default-disabled perf, motion, reset, and idle semantics; typecheck and guards pass. Parameter-signature-only mismatch remains a non-blocking residual risk because implementation has an explicit signature gate. |

## Verification Commands / Results

Commands rerun by this final clean Review-Sylph:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts packages/render-core/src/render-scene.test.ts` | Pass: 3 files / 44 tests. Run escalated because Vitest/Vite/esbuild child process execution is sandbox-sensitive. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `git diff --check` | Pass. LF-to-CRLF working-copy warnings only; no whitespace errors. |
| `rg -n "console\\." apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-playback.ts packages/render-core/src/performance-instrumentation.ts` | No matches. |
| `git diff --name-only -- packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/dynamics-evaluation.ts packages/package-format apps/editor/src/workspace/runtime-export apps/editor/src/workspace/save apps/editor/src/workspace/canvas packages/render-webgl2 packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts` | Empty. |
| `git diff --name-only -- apps/editor/src/workspace/viewer/viewer-runtime-playback.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts packages/render-core/src/performance-instrumentation.ts` | Only the four Wave98 target source/test files. |

Additional evidence reviewed:

- `git diff --stat -- ...target files...`: 4 files changed, 398 insertions, 88 deletions.
- `git status --short -uall`: confirms Wave98 target files are dirty, plus unrelated dirty `apps/runtime-player/**`, `pnpm-lock.yaml`, `discussion/runtime-player/**`, and `discussion/implementation/orchestration/_map.md`.
- `apps/editor/package.json:17` already declares `@private-2d-rigging-lab/render-core`, so the new Viewer imports do not require dependency manifest changes.

## Forbidden-Scope Classification

Wave98-owned forbidden-scope verdict: `pass`.

Wave98 target implementation changes are limited to:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `packages/render-core/src/performance-instrumentation.ts`

The targeted forbidden-scope diff was empty for:

- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/package-format`
- `apps/editor/src/workspace/runtime-export`
- `apps/editor/src/workspace/save`
- `apps/editor/src/workspace/canvas`
- `packages/render-webgl2`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-source-signature.ts`

Global dirty state remains in `apps/runtime-player/**`, `pnpm-lock.yaml`, `discussion/runtime-player/**`, and `discussion/implementation/orchestration/_map.md`. This review treats those as unowned/unrelated to Wave98 per the task context and does not count them as Wave98 pass evidence. They remain a worktree hygiene risk for final map closeout or commit preparation.

## Findings

Blocking findings: none.

Non-blocking notes:

- Runtime-core `runtime.dynamics.groups` / `runtime.dynamics.substeps` counters were not added. This is acceptable for Wave98 because adding them through the current render-core helper would require dependency-direction or manifest decisions outside this wave.
- There is no isolated test for same model/state with only base parameter signature changed. The implementation includes an explicit signature gate, and existing tests cover missing reusable data, stale/incompatible model/session data, no-dynamics behavior, output equality, driver-change motion, reset, and idle-loop behavior.

## Residual Risks

- Browser CPU profiling and pixel proof were not rerun. Wave98 did not require them as blockers, and focused unit/component tests verify the behavioral contract.
- Clean Stage projection, runtime snapshot creation, parameter resolution, Atlas Runtime remap, canvas projection, render/mask/WebGL phases may still be next bottlenecks. New metrics should be read alongside existing canvas/render counters.
- The unrelated Runtime Player and lockfile dirty state should stay explicitly separated from Wave98 final closeout.
