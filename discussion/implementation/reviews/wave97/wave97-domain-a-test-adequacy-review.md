# Wave97 Domain A Test Adequacy Review

## Verdict

Verdict: `pass`.

The Wave97 Domain A required Viewer Dynamics idle playback tests are present, meaningful, and pass in review-side verification. The tests exercise the component-level rAF lifecycle, restart paths, reset behavior, model/session incompatibility reset, and zero-Dynamics idle case instead of only checking helper return values.

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

- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- Diff against the working tree for the four review target files.

## Test Coverage Assessment

| Required coverage | Assessment |
|---|---|
| Idle stop test | Covered by `stops the Viewer Dynamics playback loop after settled state` in `viewer-runtime-screen.test.ts`. It verifies one initial rAF, bounded flush to idle, no pending rAF, and no additional rAF requests after idle. |
| Driver-change restart test | Covered by `restarts Viewer Dynamics playback from idle when a driver value changes`. It starts from idle, changes a driver parameter, verifies a new rAF, advances frames, observes visible projection movement, and verifies the loop later idles again. |
| Reset restart test | Covered by `restarts Reset simulation while preserving Runtime Controls overrides` plus existing reset-state coverage. It verifies Runtime Controls override preservation and a single active playback rAF after reset. |
| Model/session change reset test | Covered by `resets incompatible Viewer playback state when the runtime session identity changes`. It verifies stale Dynamics output is removed and a fresh loop is scheduled for the changed runtime identity. |
| Zero-dynamics no-loop test | Covered by `does not start the Viewer playback loop when Dynamics Groups are absent`. It verifies no pending rAF and no rAF requests. |
| Existing Viewer dynamics regressions | Still covered by tests for motion after driver step, Dynamics output injection into Clean Stage before keyform evaluation, reset state preserving Runtime Controls overrides, and stale state discard. |
| Existing Runtime Controls coverage | `runtime-controls-state.test.ts` remains unchanged and passed all 16 tests, including coalescing and Reset simulation UI coverage. |

## Meaningfulness / Harness Review

- The new rAF tests mount `ViewerRuntimeScreen` through React `createRoot` and `act`, so they exercise the component effects and cleanup paths rather than only pure helper functions.
- The fake rAF harness keeps pending callbacks in an explicit `Map`, exposes `pendingCount()`, deletes callbacks before execution, and counts `requestAnimationFrame` calls through a Vitest spy. This makes duplicate scheduling visible as `pendingCount() > 1`.
- Restart tests assert `pendingCount() === 1` after driver, reset, and model/session restart paths. Those checks would catch old-frame cancellation failures on those rerender paths.
- The settled helper in `viewer-runtime-playback.ts` uses named thresholds for minimum frame count, angular velocity, source velocity, angle/source distance, and output distance. The tests indirectly exercise these thresholds through the component loop and guard against endless scheduling.

## Tests / Commands Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - First sandboxed attempt failed at Vitest config load with `spawn EPERM` from esbuild service startup.
  - Re-run with sandbox escalation for read-only verification passed: 2 files / 35 tests.
- `git diff --check -- apps/editor/src/workspace/viewer/viewer-runtime-playback.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - Passed with LF-to-CRLF working-copy warnings only.

Gnome-reported `pnpm.cmd typecheck`, `node scripts/check-source-organization.mjs`, and `node scripts/check-dependencies.mjs` were reviewed as reported evidence but not rerun by this Test Adequacy lane.

## Gaps / Residual Risks

- No blocking gap found.
- The current tests do not have a separate pure-helper unit test that mutates `isViewerRuntimePlaybackStateSettled(...)` threshold inputs one by one. The component tests still cover the required behavior, and source inspection confirms settlement is not based only on unchanged driver values or minimum frame count.
- The rAF harness verifies cleanup on rerender/restart paths through pending-count assertions, but there is no dedicated unmount-cancellation test. This is a useful future hardening target, not a Wave97 blocking gap.

## User-Decision Points

None.

## Required Fixes

None.
