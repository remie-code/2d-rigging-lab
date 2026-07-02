# Review: Wave21 Domain B Test Adequacy

- Verdict: needs_changes
- Reviewer: Review-Sylph
- Mode: read-only except this report
- Scope: Control Window Dynamics Tune UX test adequacy

## Findings

### 1. Missing renderer-to-bridge wiring coverage for Dynamics Tune actions

- Severity: high
- Files:
  - `apps/runtime-player/src/control/control-window-app.tsx:842`
  - `apps/runtime-player/src/control/control-window-app.tsx:846`
  - `apps/runtime-player/src/control/control-window-app.tsx:851`
  - `apps/runtime-player/src/control/control-window-app.tsx:856`
  - `apps/runtime-player/src/control/dynamics-tune-page.test.ts:65`
  - `apps/runtime-player/src/control/dynamics-tune-page.test.ts:107`

`DynamicsTunePage` is wired in `ControlWindowApp` to `window.runtimePlayer.dynamicsTuning.updateGroup(request)`, `resetGroup({ groupId })`, and `retryProfileSave()`. The current Domain B tests instantiate `DynamicsTunePage` directly and verify only local callback payloads. They do not render or otherwise exercise the `ControlWindowApp` wiring that turns those callbacks into preload bridge calls.

This leaves the Wave21 expected tests only partially satisfied for:

- changing sliders/toggles calls bridge update with expected payload;
- reset calls expected bridge command;
- save-failed Retry calls the expected bridge command.

A regression such as wiring `onUpdateGroup` to the wrong bridge API, dropping the reset `{ groupId }` wrapper, omitting `retryProfileSave`, or failing to pass bridge status into the page would not be caught by `dynamics-tune-page.test.ts`. The main bridge handler test covers backend update/reset handling, but it does not cover the Control renderer wiring from `DynamicsTunePage` to `window.runtimePlayer.dynamicsTuning`.

Recommended fix: add a focused Control renderer wiring test with a stubbed `window.runtimePlayer.dynamicsTuning` API and active `Dynamics Tune` page, or extract a small pure page-routing/wiring helper that can be tested without broad Electron setup. The test should prove at least one slider payload, the enabled toggle, reset, Retry, initial `getStatus`, and `onStatusChanged` status propagation reach the expected bridge methods.

### 2. Reset disabled/enabled behavior is not directly guarded

- Severity: medium
- Files:
  - `apps/runtime-player/src/control/dynamics-tune-page.tsx:251`
  - `apps/runtime-player/src/control/dynamics-tune-page.tsx:256`
  - `apps/runtime-player/src/control/dynamics-tune-page.test.ts:107`
  - `apps/runtime-player/src/control/dynamics-tune-page.test.ts:122`

The implementation disables the per-group reset button when `group.hasOverride` is false. The test only uses the default fixture where `hasOverride: true` and then invokes the component callback helper directly. It does not assert that reset is disabled for an untouched group, and the helper would still call an `onClick` prop even if a rendered button were disabled.

Recommended fix: add a no-override fixture and assert the reset control is disabled or otherwise cannot dispatch reset. Keep the existing positive reset command expectation for `hasOverride: true`.

## Adequacy Already Covered

- Navigation order includes `Dynamics Tune` between `Mapping` and `Stage`: `apps/runtime-player/src/control/live-controller-page.test.ts:122`.
- Missing Runtime Export and no dynamics groups empty states are covered: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:19`.
- Group controls render from bridge-shaped state, including input/output summaries: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:41`.
- Every quick tune field is covered at the page callback boundary: `enabled`, `strength`, `limit`, `length`, `sway`, `reactionSpeed`, and `convergenceSpeed` at `apps/runtime-player/src/control/dynamics-tune-page.test.ts:65`.
- Save-failed Retry UI is covered at the page callback boundary: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:107`.
- Structural editing labels/actions are guarded negatively for create/delete/output invert/pendulum count: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:59`.
- Dynamics Tune is excluded from the raw input diagnostics panel policy: `apps/runtime-player/src/control/live-controller-page.test.ts:165`.
- UI rendering does not expose an injected private-looking fingerprint, `dynamicsSignatureHash`, or `trackingFrame`: `apps/runtime-player/src/control/dynamics-tune-page.test.ts:129`.

Privacy note: the current tests cover UI non-rendering. Renderer-state privacy remains partly contract-level because `RuntimePlayerDynamicsTuningStatus` includes `effectiveProfile` metadata in `apps/runtime-player/src/preload/dynamics-tuning-bridge-contract.ts:88`; the contract does not include raw tracking diagnostics, and no private Runtime Export path field was found in the Dynamics Tune contract.

## Basis Docs Used

- `discussion/runtime-player/implementation/orchestration/player-wave21-plan.md`
- `discussion/runtime-player/implementation/waves/wave21/domain-a-dynamics-tuning-profile-runtime-layer-report.md`
- `discussion/runtime-player/implementation/reviews/wave21/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Files Reviewed

- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.tsx`
- `apps/runtime-player/src/control/dynamics-tune-page.test.ts`
- `apps/runtime-player/src/control/live-controller-page.test.ts`
- `apps/runtime-player/src/control/stage-page.stage-motion.test.ts`
- `apps/runtime-player/src/control/stage-page.browser-source.test.ts`
- `apps/runtime-player/src/preload/dynamics-tuning-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/main/dynamics-tuning-bridge-handlers.ts`

## Verification

- `.\\node_modules\\.bin\\vitest.cmd run apps/runtime-player/src/control/dynamics-tune-page.test.ts apps/runtime-player/src/control/live-controller-page.test.ts apps/runtime-player/src/control/stage-page.stage-motion.test.ts apps/runtime-player/src/control/stage-page.browser-source.test.ts`
  - Initial sandbox attempt: failed to load Vitest config because esbuild child process spawn returned `EPERM`.
  - Escalated rerun: pass, 4 files / 20 tests.
- `.\\node_modules\\.bin\\vitest.cmd run apps/runtime-player/src/control/dynamics-tune-page.test.ts apps/runtime-player/src/control/live-controller-page.test.ts apps/runtime-player/src/main/dynamics-tuning-bridge-handlers.test.ts`
  - Pass, 3 files / 11 tests.
- `.\\node_modules\\.bin\\vitest.cmd run apps/runtime-player/src/control`
  - Pass, 7 files / 32 tests.
- `.\\node_modules\\.bin\\tsc.cmd --noEmit -p apps/runtime-player/tsconfig.json`
  - Pass.

`pnpm install` was not run.

## Remaining Manual Checks

- In Electron, open `Dynamics Tune`, adjust enabled/strength/reaction/convergence/sway, and confirm Native Stage motion changes immediately.
- Confirm reset returns a group to exported defaults in the product UI.
- Simulate or force a profile save failure and confirm Retry restores the save path.
- Confirm OBS Browser Source uses the same effective tuning as Native Stage.
- Confirm no Runtime Export artifact is modified on disk.

## User-Decision Points

None. This is a test coverage gap for Orch-Sylph/Gnome to address.
