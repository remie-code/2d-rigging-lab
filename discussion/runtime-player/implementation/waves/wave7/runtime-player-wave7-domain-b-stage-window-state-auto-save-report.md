# Runtime Player Wave7 Domain B Report: Stage Window State Auto Save

## Verdict

pass

Domain B completed in 2 implementation/review loops.

Implemented scope:

- Added a real Stage page to the Control Window navigation.
- Replaced Stage focus/reset page actions with Stage view IPC backed by main-process behavior.
- Added main-owned window state persistence under `<userData>/window-state/runtime-player.json`.
- Persisted Stage and Control window bounds, with Stage bounds surfaced on the Stage page.
- Persisted Stage view pan/zoom with coordinate space `stage-viewport-px-v1`.
- Restored Stage bounds before window show and restored Stage view transform on Stage init / model payload load.
- Added Reset View and Center Model actions; Center Model preserves zoom and recenters pan.
- Kept Stage Window model-only. No Stage debug UI, raw tracking frame path, OBS/broadcast setup, click-through, always-on-top, Stage Motion, or near/far behavior was added.

## Implementation Loops

### Loop 1

Gnome implemented Domain B source and focused tests.

Review results:

- Spec compliance: pass
- Design/development compliance: pass
- Test adequacy: needs_changes

Test adequacy requested deterministic coverage for:

- `RuntimePlayerWindowStateController` debounce / flush / save-failure behavior.
- Stage view main/preload bridge behavior beyond channel constant tests.
- Direct valid-file reload coverage for the window-state store.

### Loop 2

Gnome added focused tests for the test adequacy findings.

Re-review results:

- Test adequacy: pass

## Changed Files

Domain B source:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/window-management/browser-window-options.ts`
- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-state/window-state-controller.ts`
- `apps/runtime-player/src/main/window-state/window-state-document.ts`
- `apps/runtime-player/src/main/window-state/window-state-store.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts`

Domain B tests:

- `apps/runtime-player/src/main/window-management/browser-window-options.test.ts`
- `apps/runtime-player/src/main/window-state/window-state-store.test.ts`
- `apps/runtime-player/src/main/window-state/window-state-controller.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.stage-view.test.ts`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts`

Review/report artifacts:

- `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/waves/wave7/runtime-player-wave7-domain-b-stage-window-state-auto-save-report.md`

## Verification

Gnome Loop 1:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/window-state/window-state-store.test.ts src/main/window-management/browser-window-options.test.ts src/stage/stage-renderer/stage-view-transform.test.ts src/preload/stage-view-bridge-channels.test.ts`
  - Initial sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 4 test files, 15 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/runtime-player-boundary.test.ts`
  - Passed: 1 test file, 5 tests.
- `git diff --check -- <Domain B files>`
  - Passed; output only had LF/CRLF working-copy warnings.

Gnome Loop 2:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/window-state/window-state-store.test.ts src/main/window-state/window-state-controller.test.ts src/main/stage-view-bridge-handlers.test.ts src/preload/stage-view-bridge-channels.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/stage/stage-renderer/stage-view-transform.test.ts`
  - Initial sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 7 test files, 23 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `git diff --check -- <changed test files>`
  - Passed, no whitespace errors.

Review-Sylph test adequacy re-review:

- Focused Vitest passed: 7 test files, 23 tests.
- Runtime Player typecheck passed.
- Whitespace checks passed for tracked diff and untracked Loop 2 tests/review file.

Orch-Sylph confirmation:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/window-state/window-state-store.test.ts src/main/window-state/window-state-controller.test.ts src/main/stage-view-bridge-handlers.test.ts src/preload/stage-view-bridge-channels.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/stage/stage-renderer/stage-view-transform.test.ts`
  - Sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 7 test files, 23 tests.

`pnpm install` was not run.

## Review Results

- Spec compliance review: pass
  - `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-spec-compliance-review.md`
- Design/development compliance review: pass
  - `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-design-development-review.md`
- Test adequacy review: pass after Loop 2
  - `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-b-test-adequacy-review.md`

## Remaining Issues

- Manual Electron verification was not run in this domain loop.
- Domain C / final integration should manually verify:
  - Move/resize Stage and Control windows, restart, and confirm restored bounds.
  - Pan/zoom Stage through the real renderer, restart, and confirm restored view transform.
  - Stage page `Focus Stage`, `Reset View`, and `Center Model` against the real Stage window.
  - Save status transitions are visible but not noisy during live use.
  - Corrupt `window-state/runtime-player.json` falls back safely in the Electron path.
  - Stage remains model-only with no debug/setup UI.
- Nonblocking cleanup recorded by design review: Domain C may tighten the Control/Stage bridge surface and remove stale legacy reset-request exposure.
- Platform risk remains for multi-monitor / disconnected-monitor restored coordinates; current implementation restores persisted `x/y` and enforces minimum sizes but does not clamp to the active display work area.

## User Decision Points

None for Domain B. Remaining items are verification / integration cleanup, not product decisions.
