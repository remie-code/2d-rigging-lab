# Runtime Player Wave7 Domain B Test Adequacy Re-Review

## 判定

pass

## Scope reviewed

- Basis docs:
  - `discussion/runtime-player/implementation/orchestration/player-wave7-plan.md`
  - `discussion/runtime-player/screens/control-window-screen-structure.md`
  - `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
  - `discussion/runtime-player/backlog/runtime-player-backlog.md`
  - `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- Prior review:
  - `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-test-adequacy-review.md`
- Loop 2 Domain B tests:
  - `apps/runtime-player/src/main/window-state/window-state-controller.test.ts`
  - `apps/runtime-player/src/main/window-state/window-state-store.test.ts`
  - `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts`
  - `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts`
  - `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts`
- Relevant implementation files:
  - `apps/runtime-player/src/main/window-state/window-state-controller.ts`
  - `apps/runtime-player/src/main/window-state/window-state-store.ts`
  - `apps/runtime-player/src/main/window-state/window-state-document.ts`
  - `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
  - `apps/runtime-player/src/main/runtime-player-main.ts`
  - `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts`
  - `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
  - `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
  - `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- Worktree/diff context:
  - Reviewed `git status --short -uall` for the Domain B files and confirmed parallel Domain A / model-mapping files are present but outside this review lane.
  - Reviewed tracked diff for Stage view preload/channel changes. Untracked Loop 2 test files were reviewed from file contents.

## Findings

No `needs_changes` findings.

The Loop 2 tests directly cover the prior review's blocking test adequacy gaps. Remaining gaps are manual Electron verification items, not blockers for Domain B test adequacy.

## Loop 1 resolution status

1. `RuntimePlayerWindowStateController` debounce/flush/failure paths were untested.
   - Status: resolved.
   - Evidence:
     - `apps/runtime-player/src/main/window-state/window-state-controller.test.ts:22` verifies repeated Control/Stage bounds and Stage transform updates collapse into one debounced save with the latest state.
     - `apps/runtime-player/src/main/window-state/window-state-controller.test.ts:87` verifies `flush()` cancels a pending debounce and writes the latest state immediately.
     - `apps/runtime-player/src/main/window-state/window-state-controller.test.ts:129` verifies save failure status, warning text, and listener notification.
   - Source paths under test include `updateWindowBounds`, `updateStageViewTransform`, `flush`, and save-failure status handling in `apps/runtime-player/src/main/window-state/window-state-controller.ts`.

2. Stage view main/preload bridge behavior was mostly untested beyond channel constants.
   - Status: resolved.
   - Evidence:
     - `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:43` verifies `focusStage` restore/show/focus behavior and returned state.
     - `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:83` verifies `getState` / `getViewTransform`.
     - `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:118` verifies `resetView` stores the reset transform and asks the Stage window to apply it.
     - `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:151` verifies `centerModel` preserves zoom, clears pan, and asks the Stage window to apply it.
     - `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:179` verifies `reportViewTransform` stores the transform and publishes `stateChanged` to Control.
     - `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts:37` verifies Control preload Stage view invocations map to the intended IPC channels.
     - `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts:88` verifies Control preload `stateChanged` subscription delivery and cleanup.
     - `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts:34` verifies Stage preload reporter invocations map to the intended IPC channels.
     - `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts:67` verifies Stage preload `applyViewTransformRequested` subscription delivery and cleanup.

3. Low: valid-file reload path was indirect.
   - Status: resolved.
   - Evidence:
     - `apps/runtime-player/src/main/window-state/window-state-store.test.ts:93` writes a valid persisted state file, constructs a fresh `RuntimePlayerWindowStateStore`, and asserts `state: "loaded"` plus restored Control bounds, Stage bounds, and Stage view transform.

## Commands run and outcomes

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/window-state/window-state-store.test.ts src/main/window-state/window-state-controller.test.ts src/main/stage-view-bridge-handlers.test.ts src/preload/stage-view-bridge-channels.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/stage/stage-renderer/stage-view-transform.test.ts`
  - Outcome: passed. 7 test files, 23 tests.
  - Note: run with escalation because prior sandbox evidence hit `spawn EPERM`.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Outcome: passed.
- `git diff --check -- apps/runtime-player/src/preload/runtime-player-bridge.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.ts apps/runtime-player/src/preload/stage-view-bridge-channels.ts discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-test-adequacy-review.md`
  - Outcome: passed for tracked-file whitespace errors. Output contained only LF/CRLF working-copy warnings for tracked files.
- `rg -n '[ \t]$' apps/runtime-player/src/main/window-state/window-state-controller.test.ts apps/runtime-player/src/main/window-state/window-state-store.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-test-adequacy-review.md`
  - Outcome: no matches; untracked Loop 2 tests and this review file have no trailing whitespace.

I did not run `pnpm install`. I did not run manual Electron verification.

## Manual verification gaps

- Move/resize Control and Stage windows, restart the Electron Runtime Player, and confirm restored bounds.
- Pan/zoom Stage through the real renderer, restart, and confirm restored Stage view transform.
- Exercise Stage page `Focus Stage`, `Reset View`, and `Center Model` against the real Stage window.
- Confirm save status transitions are visible but not noisy during live use.
- Confirm corrupt `window-state/runtime-player.json` falls back safely in the packaged/manual Electron path.
- Confirm Stage remains model-only with no debug/setup UI.

## Recommendation for Orch-Sylph

Pass Domain B test adequacy after Loop 2. Keep the remaining Electron window placement and real Stage interaction checks as Domain C / final integration manual verification items.
