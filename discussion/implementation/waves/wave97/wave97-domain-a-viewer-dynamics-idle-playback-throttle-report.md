# Wave97 Domain A Report: Viewer Dynamics Idle Playback Throttle

## Verdict

Verdict: `pass`.

Domain A implemented the Viewer Dynamics idle playback throttle in the Viewer runtime surface. The Viewer now starts Dynamics playback when state evaluation is needed, keeps the final settled runtime state, and stops scheduling `requestAnimationFrame` after all playable Dynamics Groups converge.

## Files Changed

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `discussion/implementation/waves/wave97/wave97-domain-a-viewer-dynamics-idle-playback-throttle-report.md`

Not changed:

- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- runtime-core tests
- dependency manifests / lockfiles

Pre-existing dirty orchestration entries observed and not modified by this Domain A implementation:

- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave97-plan.md`

## Implementation Summary

- Added Viewer-side deterministic runtime parameter signatures in `viewer-runtime-playback.ts`.
- Added Viewer-side settled detection using existing runtime state fields and runtime-core source computation.
- Replaced the always-on Viewer Dynamics rAF loop with a lifecycle that keeps at most one pending frame per effect instance.
- Added a runtime playback state ref so rAF evaluation reads the latest committed Viewer playback state without relying on asynchronous React state timing.
- Preserved `resolveViewerRuntimeParameterValues(...)` compatibility by retaining the final settled `runtimePlaybackState` instead of clearing it.
- Kept `evaluateViewerRuntimePlaybackFrame(...)` as the only frame evaluation authority.
- Reset simulation now creates a manual reset state, increments an internal reset token, and does not clear Runtime Controls overrides.

## Restart Conditions

The Viewer playback loop starts or restarts when:

- enabled playable Dynamics Groups are present and current runtime state needs evaluation;
- runtime parameter signature changes, covering Runtime Controls overrides and authoring/runtime parameter values;
- manual Reset simulation is invoked;
- session/runtime playback model identity changes;
- package id / revision / hash compatibility changes;
- enabled Dynamics availability changes from zero to non-zero through the runtime playback model;
- current runtime state is missing or incompatible.

The loop does not start when enabled playable Dynamics Group count is zero. Cleanup cancels the current pending rAF on unmount, model change, signature change, or reset token change.

## Settled Threshold Constants

- `VIEWER_RUNTIME_SETTLED_MIN_EVALUATED_FRAMES = 36`
- `VIEWER_RUNTIME_SETTLED_ANGULAR_VELOCITY_EPSILON = 0.01`
- `VIEWER_RUNTIME_SETTLED_SOURCE_VELOCITY_EPSILON = 0.0005`
- `VIEWER_RUNTIME_SETTLED_ANGLE_TO_SOURCE_EPSILON = 0.01`
- `VIEWER_RUNTIME_SETTLED_OUTPUT_TO_TARGET_EPSILON = 0.1`

These are conservative for Viewer use: the minimum frame count prevents immediate stop after driver/reset, angular/source velocity checks prevent cutting off active sway, and angle/output distance checks require the normalized pendulum and authored output units to be at or below visible slider precision before idle stop.

## Tests / Verification

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Pass: 1 file / 19 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Pass: 1 file / 16 tests.
- `pnpm.cmd typecheck`
  - Pass.
- `node scripts/check-source-organization.mjs`
  - Pass: `Source organization guard passed.`
- `node scripts/check-dependencies.mjs`
  - Pass: `Dependency guard passed.`
- `git diff --check`
  - Pass. LF-to-CRLF working-copy warnings only; no whitespace errors.

New focused Viewer coverage includes:

- enabled Dynamics playback rAF stops after settled state;
- driver value change from idle restarts playback, advances frames, and stops after convergence;
- Reset simulation preserves Runtime Controls overrides and keeps one playback rAF active;
- incompatible session/runtime identity does not reuse stale Dynamics output;
- zero Dynamics Group case schedules no playback loop.

Existing Viewer Dynamics behavior coverage remains passing:

- motion after driver step;
- Dynamics output offsets injected into Clean Stage before keyform evaluation;
- stale runtime state discarded;
- Runtime Controls coalescing and override tests remain passing.

## Forbidden-Scope Notes

- No Dynamics solver physical formula changes.
- No Dynamics Tool preview UI/behavior changes.
- No Runtime Export, Workspace Save, package-format schema, mesh generation, texture atlas, Atlas Runtime source/cache, or Runtime Player changes.
- No dependencies or lockfiles changed.
- No `pnpm install` was run.

## Basis Coverage Self-Report

- `discussion/implementation/orchestration/wave97-plan.md`: covered Domain A requirements, restart conditions, settled policy, tests, verification, and forbidden scope.
- `discussion/implementation/orchestration/wave96-plan.md` and `discussion/implementation/waves/wave96/wave96-final-integration-report.md`: preserved Viewer Atlas Runtime / Original render source behavior by not changing render source cache or atlas paths.
- `discussion/development_convention/source-file-organization-policy.md`: no broad helper/source files were added; source organization guard passed.
- `discussion/development_convention/dependency-policy.md`: no dependency or lockfile changes; dependency guard passed.
- `discussion/development_convention/operation-policy.md`: no package mutation path or Operation Core behavior changed.
- `.agents/skills/implementation-orchestration/SKILL.md`: followed delegated Gnome implementation scope and left review orchestration to parent / Review-Sylph.

## Deferred Basis Items

- Browser CPU profiler measurement was not run; focused rAF tests prove the idle playback loop no longer remains scheduled after convergence.
- Browser pixel proof was not run; existing projection and behavior tests remain passing.
- Runtime Player behavior was not tested or changed because it is out of scope for Wave97 Domain A.

## Residual Risks

- Viewer may still consume CPU for canvas/render work caused by unrelated React state changes or other Viewer subsystems; this wave only throttles the Dynamics playback rAF.
- The runtime parameter signature intentionally tracks runtime graph parameter values plus Dynamics input/output IDs. It may restart playback for some non-Dynamics runtime parameter changes, favoring correctness over a missed restart.
- Thresholds are Viewer-specific and conservative. If future models have extremely slow visible sway, a later wave may tune constants with model-specific evidence.
