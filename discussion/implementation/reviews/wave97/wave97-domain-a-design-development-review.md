# Wave97 Domain A Design / Development Compliance Review

## Verdict

Verdict: `pass`.

No blocking design, development, source-organization, dependency, or forbidden-scope findings were found for Wave97 Domain A.

## Basis Reviewed

- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave97/wave97-domain-a-viewer-dynamics-idle-playback-throttle-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Scope Reviewed

Target files:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

Additional evidence:

- Current working tree status and target diff.
- Forbidden-scope diff checks for package format, runtime-core dynamics solver, runtime export, workspace save, atlas/render paths, Runtime Player, dependency manifests, and lockfile.
- Focused Viewer and Runtime Controls tests, typecheck, source organization guard, dependency guard, and whitespace check.

## Findings

No required-change findings.

Review-lane checks:

- Restart/stop conditions are explicit and deterministic. `ViewerRuntimeScreen` restarts playback through `runtimeParameterSignature`, `runtimePlaybackModel`, and `runtimeSimulationResetToken` dependencies; reset explicitly creates a manual initial state; incompatible model state is cleared before the playback effect runs.
- Settled thresholds are named and conservative. `VIEWER_RUNTIME_SETTLED_MIN_EVALUATED_FRAMES`, angular velocity, source velocity, angle-to-source, and output-to-target thresholds are named constants with comments, and settled detection requires all playable groups to satisfy every check.
- rAF scheduling does not show a duplicate-loop or leak pattern. The playback effect keeps a single nullable `frameRequest`, clears it at tick entry, schedules only through `scheduleNextFrame()`, and cancels the pending frame during cleanup.
- React effect dependencies are defensible. The playback effect is keyed by the runtime parameter signature, model identity, reset token, and stable setter; pan/zoom and render-source changes alone do not restart physics unless they also change graph or parameter values.
- Runtime evaluation authority is preserved. Frames still go through `evaluateViewerRuntimePlaybackFrame(...)`; no runtime-core solver formula change was made.
- Original / Atlas Runtime render-source behavior is preserved. The Wave97 source diff does not touch `viewer-render-source.ts`, the Atlas Runtime source cache, atlas internals, or renderer paths.
- Forbidden-scope drift was not found. No solver/schema/export/atlas/runtime-player/dependency/lockfile files were changed.

## Source Evidence

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:24` to `:31` defines named settled constants and comments.
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:141` to `:165` builds the deterministic runtime parameter signature used for restart.
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts:167` to `:210` checks minimum evaluated frames, compatible state, angular velocity, source velocity, angle-to-source distance, and output distance before considering playback settled.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:160` to `:174` resets simulation without mutating Runtime Controls overrides.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:176` to `:184` clears incompatible runtime playback state on model identity changes.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:186` to `:256` owns the rAF lifecycle, single pending frame guard, settled stop condition, and cleanup cancellation.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:292` to `:351` keeps clean-stage projection and render-source resolution behavior on the existing path.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:490` to `:625` covers idle stop, driver-change restart, reset restart with overrides preserved, incompatible model reset, and zero-dynamics no-loop behavior.

## Tests / Commands Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Initial sandbox attempt failed with `spawn EPERM` while Vite/esbuild tried to spawn a child process.
  - Rerun with escalated process permission passed: 1 file / 19 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Initial sandbox attempt failed with `spawn EPERM` for the same child-process restriction.
  - Rerun with escalated process permission passed: 1 file / 16 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed: `Source organization guard passed.`
- `node scripts/check-dependencies.mjs`
  - Passed: `Dependency guard passed.`
- `git diff --check`
  - Passed with LF-to-CRLF working-copy warnings only; no whitespace errors.
- `git diff --name-only -- package.json pnpm-lock.yaml packages apps/runtime-player`
  - No changed files reported.
- `git diff --name-only -- apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts apps/editor/src/workspace/canvas packages/render-webgl2 packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts`
  - No changed files reported.
- `git diff --name-only -- packages/runtime-core/src/dynamics-evaluation.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/package-format`
  - No changed files reported.
- `rg -n "live2dcubismcore|CubismSdk|CubismSdkForWeb|\\.moc3|\\.model3\\.json|\\.physics3\\.json|\\.motion3\\.json|\\.pose3\\.json|\\.cmo3" apps/editor/src/workspace/viewer apps/runtime-player packages package.json pnpm-lock.yaml`
  - No new changed-file concern found. The only hit observed was an existing negative unsupported-boundary assertion in `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`.

## Source Organization / Dependency Notes

- No `index.ts` implementation logic was added.
- No broad catch-all production source file was created or expanded.
- The production logic remains localized to Viewer playback and Viewer screen lifecycle responsibilities.
- `viewer-runtime-screen.test.ts` is large after adding the interactive Fake DOM/rAF harness, but it remains responsibility-specific to ViewerRuntimeScreen integration and the source organization guard passes. This is a residual maintainability risk, not a blocking violation for this wave.
- No dependency manifests or lockfiles changed.
- No new external dependency, binary, Cubism SDK/Core, Cubism parser, or forbidden asset path was introduced.

## Forbidden-Scope Notes

- No Dynamics solver formula changes.
- No runtime snapshot schema or package-format schema changes.
- No Runtime Export or Workspace Save changes.
- No Texture Atlas, Atlas Runtime source cache, atlas algorithm, canvas renderer, or WebGL renderer changes.
- No Runtime Player app changes.
- No mesh generation changes.
- No dependencies or lockfile changes.
- No user-facing Viewer playback controls were added.
- Dynamics Tool preview behavior was not changed.

## Residual Risks

- Browser CPU profiling was not run by this Review-Sylph. The focused rAF tests prove the playback loop reaches idle and stops scheduling frames, but they do not measure total Viewer CPU from unrelated rendering or React updates.
- The runtime parameter signature intentionally includes all runtime graph parameters plus Dynamics inputs/outputs, so it may restart playback for some non-Dynamics parameter changes. This favors correctness over missed restarts.
- Extremely slow future Dynamics presets could require threshold tuning with model-specific evidence, but the current stop condition checks velocity and target distance in addition to a minimum frame count.
- The added test harness is sizeable. If more interactive Viewer tests are added later, extracting a dedicated Viewer test harness helper should be considered.

## User-Decision Points

None blocking.
