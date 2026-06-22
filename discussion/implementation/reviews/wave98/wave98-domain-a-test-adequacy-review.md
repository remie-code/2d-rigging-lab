# Wave98 Domain A Test Adequacy Review

## Verdict

Verdict: `pass`.

The Domain A tests adequately cover the required duplicate-evaluation removal, fallback, behavior-preservation, Wave97 idle-loop, and practical instrumentation checks. No blocking test gaps were found.

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

## Test Evidence Reviewed

- Reviewed scoped diff for:
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `packages/render-core/src/performance-instrumentation.ts`
- Reviewed Gnome report:
  - `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
  - `discussion/implementation/waves/wave98/_map.md`
- Reviewed added tests in `viewer-runtime-screen.test.ts`:
  - `reuses active Viewer Runtime frame parameter values for Clean Stage projection`
  - `falls back to zero-delta evaluation when the reusable Viewer Runtime frame is stale`
  - `keeps no-dynamics Clean Stage projection off the runtime evaluation path`
  - `keeps Viewer runtime performance instrumentation disabled by default`
- Reviewed retained regression tests:
  - `advances Viewer Dynamics over runtime frames and keeps motion after driver stops`
  - `injects Dynamics output offsets into the Viewer Clean Stage before keyform evaluation`
  - `resets Viewer simulation state without changing Runtime Controls overrides`
  - `discards stale Dynamics state when a new project reuses a Dynamics Group id`
  - `stops the Viewer Dynamics playback loop after settled state`
  - `restarts Viewer Dynamics playback from idle when a driver value changes`
  - `restarts Reset simulation while preserving Runtime Controls overrides`
  - `resets incompatible Viewer playback state when the runtime session identity changes`
  - `does not start the Viewer playback loop when Dynamics Groups are absent`

## Coverage Matrix

| Required check | Evidence reviewed | Adequacy |
|---|---|---|
| Duplicate-evaluation skip in fresh active-frame path | New reuse test enables perf stats, evaluates one active frame, projects with reusable values, and asserts `viewer.runtimeFrame.evaluations === 1`, `deltaZeroReevaluationSkipped === 1`, and no fallback counter. | Covered. The test directly proves the fresh projection path does not perform the second zero-delta evaluation. |
| Projection output parameter values unchanged from previous semantics | The same test compares reused projection `parameterValues` and drawable bounds against the fallback projection built without reusable values. | Covered at behavior/output level, not only by counters. |
| Fallback when reusable playback frame is missing/stale/incompatible | Missing reusable frame is exercised by the fallback projection in the reuse test. Stale/incompatible frame is exercised by the old-session reusable frame against a new session/model, with fallback counter and zero output asserted. Existing stale state regression also remains. | Covered. A parameter-signature-only mismatch is not isolated as a separate test, but the broader missing and stale/incompatible fallback lanes are represented. |
| No-dynamics Viewer path unchanged | New no-dynamics test asserts projected drawable movement from authored parameters and absence of runtime evaluation/fallback counters. Existing zero Dynamics Group rAF test remains. | Covered. |
| Driver changes still produce dynamics motion | Existing runtime-frame motion test and interactive idle-restart test both assert non-zero motion after driver changes. | Covered. |
| Reset simulation still restarts/initializes simulation | Existing initial-state reset test checks reset state and override preservation. Interactive reset test checks rAF restart and override preservation after clicking Reset simulation. | Covered. |
| Wave97 idle stop remains intact | Existing `stops the Viewer Dynamics playback loop after settled state` test verifies rAF becomes idle and request count does not grow after idle. Driver restart test verifies playback resumes from idle. | Covered. |
| Added perf counters/timings gated or incremented where practical | New reuse/no-dynamics/default-disabled tests assert counters/timing increments only with `__LIVE2D_PERF__` and no stats by default. Existing render-core perf disabled test still passes. | Covered for Viewer metrics. Runtime-core group/substep counters were not added due dependency-boundary constraints; this is acceptable residual scope, not a test blocker. |
| Avoid fragile implementation-only assertions where behavior-level checks are needed | Counter assertions are appropriate for perf instrumentation and duplicate-call evidence. Behavior-level equality checks, drawable bounds, rAF idle/restart behavior, and runtime motion checks accompany the counter checks. | Covered. |

## Verification Commands / Results

Commands rerun by this Review-Sylph:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts` | Pass: 2 files / 39 tests. |
| `pnpm.cmd exec vitest run packages/render-core/src/render-scene.test.ts` | Pass: 1 file / 5 tests. |

Gnome-reported verification reviewed but not rerun by this test-adequacy lane:

| Command | Reported result |
|---|---|
| `pnpm.cmd typecheck` | Pass. |
| `node scripts/check-source-organization.mjs` | Pass. |
| `node scripts/check-dependencies.mjs` | Pass. |
| `git diff --check` | Pass, LF-to-CRLF warnings only. |

## Blocking Gaps

None.

## Residual Risks

- Browser CPU profiling and pixel proof were not run; the Wave98 plan does not require them as Domain A blockers.
- Runtime-core dynamics group/substep counters are deferred because adding them through the existing instrumentation helper would cross the current dependency boundary.
- There is no isolated test for a reusable frame with the same model/state but only a changed parameter signature. The existing tests cover missing reusable data, stale/incompatible model/session data, output equality with fallback semantics, and driver-change behavior, so this is a non-blocking residual risk.
