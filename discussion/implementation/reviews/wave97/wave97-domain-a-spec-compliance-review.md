# Wave97 Domain A Spec Compliance Review: Viewer Dynamics Idle Playback Throttle

## Verdict

Verdict: `pass`.

Spec compliance review found no blocking issues. The Viewer Dynamics playback loop now stops after settled state, restarts on driver/reset/model changes, preserves runtime visual behavior, keeps zero-Dynamics Viewer idle, and does not add user-facing playback controls.

## Basis Reviewed

- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave97/wave97-domain-a-viewer-dynamics-idle-playback-throttle-report.md`

## Scope Reviewed

Target files reviewed directly:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

Repository state observed during review:

- Source diffs are limited to the three target Viewer files.
- `discussion/implementation/orchestration/_map.md` is modified and `discussion/implementation/orchestration/wave97-plan.md` plus the Domain A report are untracked; these were treated as orchestration/basis artifacts, not Domain A source scope.

## Findings

No blocking or non-blocking findings.

Spec compliance checks:

- Settled Viewer does not keep rAF playback alive forever.
  - `viewer-runtime-screen.tsx` schedules at most one pending frame and only schedules another frame when `isViewerRuntimePlaybackStateSettled(...)` returns false.
  - `viewer-runtime-playback.ts` defines deterministic named thresholds and checks minimum evaluated frames, angular velocity, source velocity, angle-to-source distance, and output distance.
  - `viewer-runtime-screen.test.ts` includes a focused test proving pending rAF count reaches zero after settlement and additional flushes do not increase request count.
- Driver changes restart playback.
  - `createViewerRuntimeParameterSignature(...)` covers runtime graph parameter values plus playable Dynamics input/output IDs.
  - `runtimeParameterSignature` is a dependency of the playback lifecycle effect, so Runtime Controls or authoring parameter value changes restart evaluation.
  - Focused test proves idle playback restarts when `Face Angle X` changes and visible bounds move before settling again.
- Reset simulation restarts/initializes playback and preserves Runtime Controls overrides.
  - `resetRuntimeSimulation()` creates a manual reset state, updates the state ref, and increments a reset token without mutating `runtimeControlsState`.
  - Focused test verifies the `Face Angle X` override remains `30` before and after reset while a rAF remains scheduled.
- Dynamics visual/runtime behavior is preserved.
  - Frame advancement still goes through `evaluateViewerRuntimePlaybackFrame(...)`.
  - Clean Stage projection still resolves runtime parameter values through `resolveViewerRuntimeParameterValues(...)`.
  - Existing tests for driver-step motion, Dynamics output injection before keyform evaluation, and stale runtime state discard remain in the target test file and pass.
- Zero Dynamics Group case remains idle.
  - Viewer clears playback state and returns without scheduling when `enabledDynamicsGroupCount === 0`.
  - Focused test verifies zero pending rAF and zero rAF requests.
- No user-facing playback controls were added.
  - `runtime-controls.tsx` was not changed.
  - The only visible simulation command remains the existing Reset simulation control.

## Tests / Commands Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Initial sandboxed attempt failed before config load with `spawn EPERM` from esbuild child process startup.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Initial sandboxed attempt failed before config load with the same `spawn EPERM`.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Pass: 2 files / 35 tests.
- `pnpm.cmd typecheck`
  - Pass.
- `node scripts/check-source-organization.mjs`
  - Pass: `Source organization guard passed.`
- `node scripts/check-dependencies.mjs`
  - Pass: `Dependency guard passed.`
- `git diff --check`
  - Pass. Output contained LF-to-CRLF working-copy warnings only; no whitespace errors.
- Forbidden-scope diff check:
  - `git diff --name-only -- package.json pnpm-lock.yaml packages/runtime-core/src packages/package-format apps/runtime-player packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts apps/editor/src/workspace/canvas apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts apps/editor/src/workspace/runtime-export apps/editor/src/workspace/export`
  - Pass: no output.

## Forbidden-Scope Notes

- No Dynamics solver formula changes found.
- No Runtime Export, Workspace Save, package-format schema, mesh generation, texture atlas, Atlas Runtime source/cache, Runtime Player, dependency manifest, or lockfile changes found.
- No new dependency or Cubism/SDK/Core drift found by dependency guard.
- No source-organization violation found by guard.

## Residual Risks

- Browser CPU profiler measurement was not run in this review. The focused rAF tests prove the Dynamics playback loop itself becomes idle after convergence.
- Browser pixel proof was not run. Existing projection/runtime behavior tests passed and source review found no intentional render-source or solver change.
- Thresholds are Viewer-specific constants. They are conservative for the reviewed fixtures; future unusually slow visible sway may need a tuning wave with model-specific evidence.

## User-Decision Points

None.
