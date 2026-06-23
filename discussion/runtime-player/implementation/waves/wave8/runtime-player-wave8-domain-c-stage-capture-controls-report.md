# Runtime Player Wave8 Domain C Report: Stage Capture Controls

## Verdict

pass

Domain C completed in 1 implementation/review loop.

Implemented scope:

- Stage page now exposes Arrange Stage, Click-through, Always-on-top, Copy Window Title, and a local Capture Target checklist.
- Stage Arrange mode is controlled from Control and shows a temporary native drag handle / arrange overlay only while enabled.
- Normal Stage mode remains model-only; the arrange overlay renders nothing when arrange mode is disabled.
- Arrange mode disables normal Stage pan/zoom interaction while active.
- Click-through is controlled from Control, always starts Off on app startup, and can be disabled from Domain A's tray/application menu recovery hook.
- Click-through state is not persisted.
- Always-on-top is controlled from Control, defaults Off, and is persisted as Window State `stageEnvironment.alwaysOnTop` with invalid values reset to Off.
- The Stage native title remains stable as `Runtime Player Stage`, and Control can copy that title.
- Stage preload remains narrow and receives only arrange-state read/subscription additions. It does not expose raw tracking/debug or Control APIs.
- Domain B Runtime Export startup/restore UI on Stage page was preserved.

## Implementation Loop

### Loop 1

Gnome implemented the Domain C source changes and focused tests.

Review results:

- Spec compliance: pass
- Design/development compliance: pass
- Test adequacy: pass

No fix loop was required.

## Changed Files

Domain C source:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/window-management/browser-window-options.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-state/window-state-controller.ts`
- `apps/runtime-player/src/main/window-state/window-state-document.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/styles/global.css`

Domain C tests:

- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/window-management/browser-window-options.test.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts`
- `apps/runtime-player/src/main/window-state/window-state-controller.test.ts`
- `apps/runtime-player/src/main/window-state/window-state-store.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
- `apps/runtime-player/src/stage/stage-window-app.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts`

Shared-file note:

- `apps/runtime-player/src/main/runtime-player-main.ts` contains Domain A recovery/tray wiring and Domain B startup-state wiring. Domain C only connected Stage capture state to the existing tray/menu click-through recovery hook and preserved the Runtime Export startup-state integration.
- `apps/runtime-player/src/control/stage-page.tsx` already contained Domain B Startup UI. Domain C added Capture Target controls while preserving that Startup panel.

## Verification

Gnome verification:

- Focused Runtime Player Vitest suite passed after rerunning outside the sandbox due to `spawn EPERM`: 11 files, 46 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- <Domain C changed files>`
  - Passed; output only had LF-to-CRLF working-copy warnings.
- `rg -n "[ \t]+$" <new/untracked test files>`
  - No trailing-whitespace matches.

Orch-Sylph confirmation:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/stage-view-bridge-handlers.test.ts src/main/window-management/runtime-player-tray-menu.test.ts src/main/window-management/browser-window-options.test.ts src/main/window-state/window-state-controller.test.ts src/main/window-state/window-state-store.test.ts src/preload/stage-view-bridge-channels.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/stage/stage-window-app.test.ts src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts src/runtime-player-boundary.test.ts`
  - Initial sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 11 test files, 46 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/control/control-window-app.tsx apps/runtime-player/src/control/stage-page.tsx apps/runtime-player/src/main/runtime-player-main.ts apps/runtime-player/src/main/stage-view-bridge-handlers.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/main/window-management/browser-window-options.ts apps/runtime-player/src/main/window-management/browser-window-options.test.ts apps/runtime-player/src/main/window-management/runtime-player-windows.ts apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts apps/runtime-player/src/main/window-state/window-state-controller.ts apps/runtime-player/src/main/window-state/window-state-controller.test.ts apps/runtime-player/src/main/window-state/window-state-document.ts apps/runtime-player/src/main/window-state/window-state-store.test.ts apps/runtime-player/src/preload/stage-view-bridge-channels.ts apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts apps/runtime-player/src/preload/runtime-player-bridge.ts apps/runtime-player/src/preload/runtime-player-bridge-contract.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.ts apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/stage/stage-window-app.tsx apps/runtime-player/src/stage/stage-window-app.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts apps/runtime-player/src/styles/global.css`
  - Passed; output only had LF-to-CRLF working-copy warnings.

`pnpm install` was not run.

## Review Results

- Spec compliance review: pass
  - `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-c-spec-compliance-review.md`
- Design/development compliance review: pass
  - `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-c-design-development-review.md`
- Test adequacy review: pass
  - `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-c-test-adequacy-review.md`

Review notes:

- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts` is now larger, but reviewers judged it cohesive for this wave. Future broadcast/native Stage controls should consider splitting capture-specific state/actions into a named main-side controller.
- No reviewers reported blocking or needs-changes findings.

## Remaining Issues

Manual Electron verification was not run in this domain loop. Domain D / final integration should manually verify:

- Arrange Stage handle moves the frameless native Stage Window on Windows.
- Arrange overlay disappears when arrange mode is disabled.
- Normal Stage mode remains model-only and pan/zoom works after leaving arrange mode.
- Click-through can be enabled from Control and disabled from tray/application menu, including when Control is hidden.
- Tray/application menu enabled state refreshes after click-through toggles from Control and from recovery.
- Always-on-top toggles and persists across restart.
- OBS-adjacent manual check: Window Capture can select `Runtime Player Stage`, transparent background behaves as expected, and no arrange overlay is visible after arrange mode is disabled.

## User Decision Points

None for Domain C.
