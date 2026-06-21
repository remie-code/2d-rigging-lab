# Wave97 Final Clean Integration Review: Viewer Dynamics Idle Playback Throttle

## Verdict

Verdict: `pass`.

No blocking final-integration findings were found for Wave97. Domain A's implementation, report, and three required review lanes are present and substantively pass. Focused Viewer Dynamics idle stop/restart coverage and Runtime Controls coverage pass, typecheck and repository guards pass, and the specified forbidden source/app scopes are clean.

## Basis Reviewed

- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave97/wave97-domain-a-viewer-dynamics-idle-playback-throttle-report.md`
- `discussion/implementation/reviews/wave97/wave97-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave97/wave97-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave97/wave97-domain-a-test-adequacy-review.md`

## Scope Reviewed

Source and tests reviewed directly:

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` pass evidence

Diff/status reviewed:

- Target Viewer source/test diff.
- Domain A report and three Domain A review reports.
- Current repository status.
- Specified forbidden-scope tracked diff and untracked/status checks.

## Final Integration Findings

No required-change findings.

- Domain A artifacts are present and pass: implementation report, spec compliance review, design/development review, and test adequacy review all report `pass`.
- Viewer idle rAF stop is implemented in `viewer-runtime-screen.tsx`: the playback effect keeps at most one pending frame, evaluates through `evaluateViewerRuntimePlaybackFrame(...)`, and only schedules another rAF while `isViewerRuntimePlaybackStateSettled(...)` is false.
- Restart conditions are explicit: `runtimeParameterSignature`, `runtimePlaybackModel`, and `runtimeSimulationResetToken` drive the playback effect; manual reset creates a runtime initial state and increments the reset token.
- Settled detection is Viewer-side and deterministic: `viewer-runtime-playback.ts` defines named constants for minimum evaluated frames, angular velocity, source velocity, angle/source distance, and output/target distance.
- Existing runtime behavior is preserved: Dynamics frame evaluation still uses the existing runtime evaluation path, final settled state is retained for clean-stage projection, and no user-facing playback controls were added.
- Required tests are present in `viewer-runtime-screen.test.ts`: idle stop, driver-change restart, reset restart with Runtime Controls overrides preserved, incompatible runtime identity reset, and zero-Dynamics no-loop.

## Verification Run / Reviewed

Fresh verification run by this Review-Sylph:

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` | Pass: 2 files / 35 tests. |
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `git diff --check` | Pass with LF-to-CRLF working-copy warnings only; no whitespace errors. |

Verification evidence reviewed from Domain A and review lanes:

- Domain A report: Viewer screen tests 19/19, Runtime Controls tests 16/16, typecheck, source organization guard, dependency guard, and diff check passed.
- Domain A review lanes: all three required review reports are present and conclude `pass`.

## Forbidden-Scope Result

Forbidden-scope verdict for the Wave97 specified source/app path set: `pass`.

These checks produced no output:

- `git diff --name-only -- package.json pnpm-lock.yaml packages/runtime-core/src packages/package-format apps/runtime-player packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts apps/editor/src/workspace/canvas apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts apps/editor/src/workspace/runtime-export apps/editor/src/workspace/export`
- `git status --short -uall -- package.json pnpm-lock.yaml packages/runtime-core/src packages/package-format apps/runtime-player packages/authoring-core/src/texture-atlas-targets.ts packages/authoring-core/src/texture-atlas-source-signature.ts apps/editor/src/workspace/canvas apps/editor/src/workspace/viewer/viewer-render-source.ts apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts apps/editor/src/workspace/runtime-export apps/editor/src/workspace/export`

No Dynamics solver formula, Runtime Export format, Workspace Save format, Texture Atlas / Atlas Runtime source cache, Runtime Player app, package-format schema, mesh generation, dependency manifest, or lockfile drift was found in the Wave97 specified forbidden source/app scopes.

Repository-status note: the current worktree also contains unrelated dirty Runtime Player planning/map documentation under `discussion/runtime-player/implementation/**`. I did not count those documentation orchestration artifacts as Wave97 Runtime Player app/source drift, but they should remain classified outside Wave97 ownership if Orch-Sylph prepares a whole-worktree handoff.

## Residual Risks

- Browser CPU profiling was not run. The focused rAF tests prove the Dynamics playback loop itself reaches idle and stops scheduling frames after convergence.
- Browser pixel proof was not run. Existing projection/runtime behavior tests passed, and the reviewed diff does not touch render-source, atlas, solver, export, runtime-player app, or renderer code.
- Extremely slow future Dynamics presets could require threshold tuning with model-specific evidence; current thresholds favor extra frames over premature visible motion cutoff.
- `viewer-runtime-screen.test.ts` is large, but it remains responsibility-specific and the source organization guard passes.

## User-Decision Points

None blocking for Wave97.

Repository-level note for Orch-Sylph: if the final user handoff requires a pristine whole-worktree boundary, classify or defer the unrelated `discussion/runtime-player/implementation/**` planning/map dirty state separately from Wave97.

## Required Fixes

None.
