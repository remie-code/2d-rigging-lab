# Review: Wave21 Domain B Test Adequacy Rereview Fix 1

- Verdict: pass
- Reviewer: Review-Sylph
- Mode: read-only for source; wrote only this review report
- Scope: Runtime Player Wave21 Domain B Control Window Dynamics Tune test adequacy after fix cycle 1

## Findings

None.

## Fix Verification

### Previous High Finding: Fixed

Renderer-to-bridge wiring coverage now exists for the Dynamics Tune route in `ControlWindowApp`.

- `apps/runtime-player/src/control/control-window-app.tsx:217` connects the Dynamics Tune status bridge during Control Window startup.
- `apps/runtime-player/src/control/control-window-app.tsx:641` defines `connectControlWindowDynamicsTuningStatusBridge`.
- `apps/runtime-player/src/control/control-window-app.tsx:646` calls `window.runtimePlayer.dynamicsTuning.getStatus()`.
- `apps/runtime-player/src/control/control-window-app.tsx:652` subscribes to `window.runtimePlayer.dynamicsTuning.onStatusChanged(...)`.
- `apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts:24` verifies initial `getStatus`, status-change propagation, inactive guard behavior, and unsubscribe.
- `apps/runtime-player/src/control/control-window-app.tsx:659` defines the Dynamics Tune route helper used by the app route.
- `apps/runtime-player/src/control/control-window-app.tsx:670` wires page updates to `window.runtimePlayer.dynamicsTuning.updateGroup(request)`.
- `apps/runtime-player/src/control/control-window-app.tsx:675` wires page reset to `window.runtimePlayer.dynamicsTuning.resetGroup({ groupId })`.
- `apps/runtime-player/src/control/control-window-app.tsx:680` wires retry to `window.runtimePlayer.dynamicsTuning.retryProfileSave()`.
- `apps/runtime-player/src/control/control-window-app.tsx:884` routes active page `"dynamics-tune"` through that helper.
- `apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts:58` verifies route actions reach `updateGroup`, `resetGroup({ groupId })`, and `retryProfileSave`.

This is helper-level coverage rather than a full `ControlWindowApp` DOM integration test, but the helpers are exported from and called by `ControlWindowApp`, and the test covers the previously unguarded wiring boundary directly.

### Previous Medium Finding: Fixed

Reset disabled/enabled behavior is directly guarded.

- `apps/runtime-player/src/control/dynamics-tune-page.tsx:254` keeps the reset command scoped to the group id.
- `apps/runtime-player/src/control/dynamics-tune-page.tsx:256` disables reset when `group.hasOverride` is false.
- `apps/runtime-player/src/control/dynamics-tune-page.test.ts:131` adds a no-override fixture and asserts the reset button is disabled.
- `apps/runtime-player/src/control/dynamics-tune-page.test.ts:149` verifies the disabled reset path does not dispatch `onResetGroup`.

## Expected Domain B Test Coverage

- Navigation order includes `Dynamics Tune` between `Mapping` and `Stage`: `apps/runtime-player/src/control/control-window-shell.tsx:11`, `apps/runtime-player/src/control/control-window-shell.tsx:23`, `apps/runtime-player/src/control/live-controller-page.test.ts:123`.
- Empty states for missing Runtime Export and no dynamics groups are covered: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:19`.
- Group controls from bridge-shaped state are covered: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:41`.
- Every quick tune field is covered at the page payload boundary: `enabled`, `strength`, `limit`, `length`, `sway`, `reactionSpeed`, and `convergenceSpeed` at `apps/runtime-player/src/control/dynamics-tune-page.test.ts:67`.
- Reset command coverage exists at both page callback and Control route bridge boundaries: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:112`, `apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts:99`.
- Privacy/non-rendering coverage for private export paths, raw tracking data, and profile internals exists: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:157`.
- Raw input diagnostics remain hidden on the Dynamics Tune page: `apps/runtime-player/src/control/live-controller-page.test.ts:169`.
- Stage and Browser Source Control tests still pass in the full Control test directory run. No dedicated Mapping page test file exists under `apps/runtime-player/src/control`; the navigation assertion still covers Mapping order.

## Basis Docs Used

- `discussion/runtime-player/implementation/orchestration/player-wave21-plan.md`
- `discussion/runtime-player/implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md`
- `discussion/runtime-player/implementation/reviews/wave21/domain-b-test-adequacy-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Files Reviewed

- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.test.ts`
- `apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts`
- `apps/runtime-player/src/control/live-controller-page.test.ts`
- `apps/runtime-player/src/control/stage-page.stage-motion.test.ts`
- `apps/runtime-player/src/control/stage-page.browser-source.test.ts`

## Verification Performed

- `.\\node_modules\\.bin\\vitest.cmd run apps/runtime-player/src/control/dynamics-tune-page.test.ts apps/runtime-player/src/control/control-window-app.dynamics-tune.test.ts apps/runtime-player/src/control/live-controller-page.test.ts`
  - Initial sandbox attempt failed while loading Vitest config because esbuild child process spawn returned `EPERM`.
  - Escalated rerun passed: 3 files / 13 tests.
- `.\\node_modules\\.bin\\vitest.cmd run apps/runtime-player/src/control`
  - Passed: 8 files / 35 tests.
- `.\\node_modules\\.bin\\tsc.cmd --noEmit -p apps/runtime-player/tsconfig.json`
  - Passed with no output.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/control`
  - No whitespace errors. Git reported existing CRLF normalization warnings for touched files.

`pnpm install` was not run.

## Remaining Manual Checks

- In Electron, open `Dynamics Tune`, adjust enabled/strength/reaction/convergence/sway, and confirm Native Stage motion changes immediately.
- Confirm reset returns a group to exported defaults in the product UI.
- Simulate or force a profile save failure and confirm Retry restores the save path.
- Confirm OBS Browser Source uses the same effective tuning as Native Stage.
- Confirm no Runtime Export artifact is modified on disk.

## User-Decision Points

None.
