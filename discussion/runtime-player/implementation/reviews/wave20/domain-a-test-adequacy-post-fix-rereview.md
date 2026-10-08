# Runtime Player Wave20 Domain A Test Adequacy Post-Fix Re-review

verdict: `pass`

Date: 2026-06-27

Role: Review-Sylph, test adequacy post-fix re-review lane.

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Scope

Reviewed the Wave20 Domain A post-fix state for Control Window quit / Stage reopen lifecycle, with specific focus on the previous blocking finding: stale Stage ready / Model Visible state after direct Stage close.

Basis read:

- `discussion/runtime-player/implementation/orchestration/player-wave20-plan.md`
- `discussion/runtime-player/implementation/waves/wave20/runtime-player-wave20-domain-a-control-quit-stage-reopen-lifecycle-report.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/_map.md`

Changed files inspected:

- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/control/stage-page.stage-motion.test.ts`

## Findings

No blocking test adequacy findings remain.

The previous stale Stage-ready / Model Visible blocker is now covered. On Stage lifecycle `closed`, the bridge clears transient capture state and replaces renderer status with `Stage unavailable` (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:103`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:108`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:347`). The focused test first reports `Stage ready`, emits close, then asserts `getState`, `getStatus`, `statusChanged`, and `stateChanged` all carry `status: "empty"` / `Stage unavailable` (`apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:169`, `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:182`, `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:193`, `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:203`, `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:221`, `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:230`).

Control presentation coverage was also added. The Stage page renders closed Stage state as `Unavailable`, `Stage unavailable`, and `Not visible`, and asserts it does not contain stale `Stage ready` or visible-model text (`apps/runtime-player/src/control/stage-page.stage-motion.test.ts:57`, `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:62`). This is meaningful because the Control page displays the render status label directly and derives model visibility from `ready` / `warning` render status (`apps/runtime-player/src/control/stage-page.tsx:95`, `apps/runtime-player/src/control/stage-page.tsx:332`). There is no separate warning-status close case, but the close handler overwrites prior status unconditionally, so this is a non-blocking coverage gap.

Focused tests adequately cover `Focus Stage` existing-window, destroyed-window reopen, and reopen-failure paths. Existing-window focus is asserted at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:57`; destroyed-window reopen checks `reopenStageWindow`, restore/show/focus, click-through reset, and persisted always-on-top at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:97`; reopen failure returns an action error with destroyed state at `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:143`. Source branches align with those cases at `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:367`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:383`, and `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:400`.

Control-close quit and explicit quit paths are adequately covered. The Control close test asserts no hide/preventDefault and verifies `requestQuit` plus `closeStageWindow` (`apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:13`, `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:27`). The explicit-quit test verifies Control close does not double-request quit or Stage close while quit is already in progress (`apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:33`, `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:54`). Existing quit flush coverage remains in `RuntimePlayerQuitController` tests (`apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:108`, `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:140`), matching the controller/source wiring (`apps/runtime-player/src/main/window-management/control-window-recovery.ts:43`, `apps/runtime-player/src/main/window-management/control-window-recovery.ts:52`, `apps/runtime-player/src/main/window-management/control-window-recovery.ts:80`, `apps/runtime-player/src/main/runtime-player-main.ts:362`, `apps/runtime-player/src/main/runtime-player-main.ts:386`).

Stage direct close is covered at the deterministic bridge/lifecycle level, with app-level behavior verified by source inspection rather than a full Electron smoke. The lifecycle emits `closed` from the Stage `closed` listener without calling app quit (`apps/runtime-player/src/main/window-management/runtime-player-windows.ts:135`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:222`), and the bridge test confirms Control receives destroyed/unavailable state (`apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:169`). Runtime main routes quit through Control close, tray quit, or `window-all-closed` fallback (`apps/runtime-player/src/main/runtime-player-main.ts:362`, `apps/runtime-player/src/main/runtime-player-main.ts:386`, `apps/runtime-player/src/main/runtime-player-main.ts:411`). A real Electron/manual Stage-close smoke remains non-blocking.

No forbidden-scope changes were observed in the reviewed diff. `git status --short -uall` showed only Runtime Player lifecycle/test files plus Wave20 discussion artifacts. `git diff --name-only -- apps package.json pnpm-lock.yaml packages electron-builder.json forge.config.* .github` returned only the reviewed Runtime Player files; no Editor, Runtime Export format, package-format/schema, package manifest, lockfile, or packaging config changes were present.

## Verification Performed

- Inspected current source and tests listed above.
- Inspected current `git status --short -uall`, `git diff --stat`, `git diff --`, and focused line references.
- Ran focused Vitest with escalation because Windows Vite/Vitest worker processes can require access outside the workspace sandbox:
  - `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/window-management/control-window-recovery.test.ts src/main/stage-view-bridge-handlers.test.ts src/control/stage-page.stage-motion.test.ts`
  - Result: passed, 3 files / 38 tests.
- Ran `git diff --check --` for the reviewed source/test files.
  - Result: passed; Git printed LF-to-CRLF working-copy warnings only.

`pnpm install` was not run. Typecheck/build were not rerun by this re-review lane.

## Remaining Manual Checks / Test Gaps

- Manual packaged-app or dev Electron smoke: close Control with the normal close button and confirm Stage closes and the Runtime Player process exits after normal shutdown.
- Manual Stage recovery smoke: close Stage through OS/taskbar route, confirm Control remains alive and does not show stale ready/visible wording, then press `Focus Stage` and confirm Stage reopens/focuses.
- Manual preserved-behavior smoke: Runtime Export restore, Stage state persistence, Browser Source, Input Mapping, Body Follow, Stage Motion, Variant switching, local preview suspension, and diagnostics after reopen/relaunch.
- Optional future test: add a warning-status variant for Stage lifecycle close, even though the current close handler unconditionally overwrites prior ready/warning/error status.
- Optional future integration test: assert `onStageWindowReopened` republishes Variant status, latest native live frame when not suspended, and native display transform as one wired unit (`apps/runtime-player/src/main/runtime-player-main.ts:184`).

## Blockers / User Decisions

None for this test adequacy lane.
