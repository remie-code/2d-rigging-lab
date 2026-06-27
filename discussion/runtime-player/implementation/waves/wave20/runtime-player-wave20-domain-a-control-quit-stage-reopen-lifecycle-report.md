# Runtime Player Wave20 Domain A Report: Control Quit / Stage Reopen Lifecycle

verdict: `pass`

Date: 2026-06-27

## Summary

Domain A post-fix review recovery is complete.

Orch-Sylph did not implement source changes directly. The earlier Domain A source implementation and stale Stage status fix were delegated to Gnome before this recovery. This recovery resumed from the blocked post-fix review state, launched fresh independent Review-Sylph contexts for the required lanes, and did not require an additional Gnome fix cycle.

Both required post-fix lanes now pass:

- Design / Development Compliance Review: `pass`
- Test Adequacy Review: `pass`

The previous blocking finding, stale `Stage ready` / `Model Visible` state after direct Stage close, is confirmed fixed by independent review.

## Loop Count

- Prior implementation/review loop 1: source implementation completed; spec review `pass`, test adequacy review `pass`, design/development review `needs_changes`.
- Prior fix loop 1: Gnome fixed stale Stage ready / visible state after Stage close.
- Recovery loop 1: post-fix design/development re-review `pass`; post-fix test adequacy re-review `pass`.
- Additional Gnome fix during this recovery: none.

## Source / Test Files Changed By Prior Domain A Gnome Work

- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/control/stage-page.stage-motion.test.ts`

## Review Artifacts

Initial review artifacts:

- `discussion/runtime-player/implementation/reviews/wave20/domain-a-spec-compliance-review.md` - `pass`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-design-development-compliance-review.md` - `needs_changes`, finding fixed by Gnome before recovery
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-test-adequacy-review.md` - `pass`

Post-fix recovery review artifacts:

- `discussion/runtime-player/implementation/reviews/wave20/domain-a-design-development-compliance-post-fix-rereview.md` - `pass`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-test-adequacy-post-fix-rereview.md` - `pass`

This report:

- `discussion/runtime-player/implementation/waves/wave20/runtime-player-wave20-domain-a-control-quit-stage-reopen-lifecycle-report.md`

## Accepted Behavior Status

- Control Window close requests Runtime Player quit through `RuntimePlayerQuitController` and closes Stage.
- Control-driven quit remains on the normal app shutdown path, including app-owned background service disposal.
- Stage Window direct close does not request app quit by itself.
- Control remains alive after direct Stage close unless all windows are closed through Electron fallback semantics.
- `Focus Stage` focuses an existing Stage window.
- `Focus Stage` recreates/reopens a destroyed Stage window, reapplies relevant Stage environment, and focuses it.
- Reopen failure returns an action error/status rather than silently failing.
- Explicit app quit remains routed through the quit controller.
- Stage lifecycle close now clears stale Stage renderer readiness by publishing `Stage unavailable` / empty render status, so Control no longer claims a closed Stage is ready or model-visible.

## Verification Performed

Orch-Sylph verification:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/window-management/control-window-recovery.test.ts src/main/stage-view-bridge-handlers.test.ts src/control/stage-page.stage-motion.test.ts`
  - Passed: 3 files / 38 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player build`
  - Passed.
- `git diff --check -- ...`
  - Passed for Domain A source/test/report paths; Git reported LF-to-CRLF working-copy warnings only.

Review-Sylph verification:

- Design / Development post-fix re-review inspected source, tests, basis docs, diff, forbidden-scope paths, ran focused Vitest, and ran `git diff --check`; verdict `pass`.
- Test Adequacy post-fix re-review inspected tests, relevant source, basis docs, diff, forbidden-scope paths, ran focused Vitest, and ran `git diff --check`; verdict `pass`.

`pnpm install` was not run.

## Forbidden Scope Confirmation

Observed changed source/test files are confined to Runtime Player window lifecycle, Stage bridge behavior, and focused tests.

No observed changes to:

- Editor source
- Runtime Export format
- package-format schema
- dependencies
- lockfile
- packaged exe build scripts/config

Existing Wave20 discussion plan/map changes are documentation/orchestration artifacts, not source implementation changes.

## Remaining Manual Checks

- Launch Runtime Player from packaged `.exe` if available, or dev mode if not.
- Close Control Window with the normal close button and confirm Stage closes and the Runtime Player process exits.
- Relaunch Runtime Player.
- Close Stage through taskbar / OS route if possible and confirm Control remains alive.
- Confirm Control reports Stage unavailable and does not show stale ready/model-visible wording.
- Press `Focus Stage` and confirm Stage reopens and focuses.
- Smoke-check Runtime Export restore, Stage state persistence, Browser Source, Input Mapping, Body Follow, Stage Motion, Variant switching, local preview suspension, and diagnostics after reopen/relaunch.

## Out-of-Scope Risks

- Real packaged Electron process-exit behavior still needs manual smoke because unit tests cannot fully emulate OS close/taskbar routes.
- Stage reopen resync for Variant status, latest live frame, and Stage Motion display transform is covered by source inspection and lower-level tests, but a single wired integration test could be added in a later wave.
- Browser Source / OBS behavior remains a manual smoke area because Domain A intentionally did not change Browser Source lifecycle ownership.
