# Runtime Player Wave8 Domain A Spec Compliance Review

- verdict: pass
- review target: Domain A - Control Window recovery / tray-menu / explicit quit
- reviewer role: Review-Sylph

## Basis

Reviewed directly against:

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

Reviewed implementation files:

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`

## Findings

No blocking spec-compliance findings.

## Compliance Notes

- Control Window close-hide is implemented by preventing non-explicit close and calling `hide()` while leaving explicit quit close unblocked: `apps/runtime-player/src/main/window-management/control-window-recovery.ts:80`.
- Explicit quit is centralized in `RuntimePlayerQuitController`; it marks quit in progress, prevents the first `before-quit`, waits for input disconnect, Model Mapping Profile flush, and Window State flush via `Promise.allSettled`, then calls final quit: `apps/runtime-player/src/main/window-management/control-window-recovery.ts:43` and `apps/runtime-player/src/main/window-management/control-window-recovery.ts:71`.
- `runtime-player-main.ts` wires the existing flush owners into the quit controller: `inputBridge.disconnect()`, `modelMappingBridge.flushPendingProfileSave()`, and `windowState.flush()`: `apps/runtime-player/src/main/runtime-player-main.ts:113`.
- Tray and application menu expose Show Control Window, Focus Stage, Disable Click-through, and Quit Runtime Player: `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:89` and `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:128`.
- Runtime integration wires tray actions to show/focus Control, focus Stage, a click-through placeholder, and explicit quit: `apps/runtime-player/src/main/runtime-player-main.ts:130`.
- The click-through recovery hook is present but click-through itself is not implemented in Domain A. Searches found no `setIgnoreMouseEvents`, always-on-top, Spout, OBS automation, startup restore, Input Source auto-connect, Stage Motion, near/far response, or raw tracking/debug additions in the Domain A changed files.
- `window-all-closed` now routes non-Darwin shutdown through the explicit quit controller when a quit is not already in progress, which is coherent with Control close-hide semantics: `apps/runtime-player/src/main/runtime-player-main.ts:156`.
- Stage close/recreate is not added. Existing Stage state snapshots report `created` vs `destroyed`, and Focus Stage returns an error when Stage is destroyed rather than recreating it: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:120` and `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:140`.

## Test Adequacy

Focused tests cover the required deterministic Domain A behavior:

- Control close-hide vs explicit quit: `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:13`.
- Show Control restore/show/focus and destroyed-window tolerance: `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:48`.
- Focus Stage safe show/focus behavior and destroyed-stage tolerance: `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:74`.
- Explicit quit flush operations and failure-tolerant quit continuation: `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:96`.
- Tray/menu action template and click-through recovery hook wiring: `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:15`.
- Tray registration, click recovery, refresh, and dispose behavior through a fake Electron adapter: `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts:72`.

## Verification

- `pnpm.cmd exec vitest run -c vitest.config.ts src/main/window-management/control-window-recovery.test.ts src/main/window-management/runtime-player-tray-menu.test.ts`
  - sandbox attempt failed with `spawn EPERM` while loading Vite/esbuild config.
  - escalated rerun passed: 2 files / 11 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - passed.
- `git diff --check -- apps/runtime-player/src/main/runtime-player-main.ts`
  - no whitespace errors; Git emitted only the expected LF-to-CRLF working-copy warning.

## Remaining Manual Verification Gaps

- Actual Electron close/hide/show behavior was not manually exercised in a running app.
- Actual OS tray icon/context menu/application menu behavior was not manually exercised; unit tests use a fake Electron adapter.
- Actual explicit Quit from tray/menu should be manually checked once the Electron app is run, including that the app exits after pending flush work.
- Stage destroyed/open reporting is source-checked, but no manual Stage close scenario was run in this review.

## User Decision Points

None for Domain A spec compliance.
