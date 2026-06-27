# Runtime Player Wave20 Domain A Test Adequacy Review

verdict: `pass`

Date: 2026-06-27

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Scope

Review-Sylph test adequacy lane reviewed whether Gnome's tests and verification adequately cover Runtime Player Wave20 Domain A lifecycle behavior.

Reviewed basis:

- `discussion/runtime-player/implementation/orchestration/player-wave20-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/waves/wave8/runtime-player-wave8-final-integration-report.md`
- `discussion/runtime-player/implementation/_map.md`

Reviewed changed source/test files:

- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`

## Findings

No blocking test adequacy findings.

The focused tests directly cover the new Control close semantics. `control-window-recovery.test.ts:13` asserts a normal Control close does not call `preventDefault` or `hide`, and does call `requestQuit` plus `closeStageWindow`. This matches `control-window-recovery.ts:80` and the main wiring at `runtime-player-main.ts:362` / `runtime-player-main.ts:368`.

The explicit quit path remains covered. `control-window-recovery.test.ts:33` puts `RuntimePlayerQuitController` into quit-in-progress state, emits Control close, and asserts the Control close handler does not double-request quit or close Stage again. Existing quit flush behavior remains covered at `control-window-recovery.test.ts:108` and `control-window-recovery.test.ts:140`.

The existing Focus Stage path remains covered. `stage-view-bridge-handlers.test.ts:56` verifies an existing minimized Stage is restored, shown, focused, and returns current state. This exercises the non-reopen branch of `stage-view-bridge-handlers.ts:338`.

Destroyed Stage reopen behavior is directly covered at the Stage bridge level. `stage-view-bridge-handlers.test.ts:96` verifies `reopenStageWindow`, click-through reset, persisted always-on-top application, restore/show/focus, and created-state status. `stage-view-bridge-handlers.test.ts:142` verifies reopen failure returns an action error and destroyed-state status. These tests align with `stage-view-bridge-handlers.ts:366`, `stage-view-bridge-handlers.ts:376`, and `stage-view-bridge-handlers.ts:382`.

Stage close state handling is directly covered for the Stage bridge. `stage-view-bridge-handlers.test.ts:168` emits a Stage lifecycle closed event and asserts Stage state becomes destroyed/unavailable, transient arrange/click-through flags clear, and Control receives a state update. This aligns with `stage-view-bridge-handlers.ts:102`. There is no direct app-quit spy in that test, but the Stage lifecycle subscriber only updates capture state; app quit is wired through Control close, tray quit, and `window-all-closed` in `runtime-player-main.ts:411`.

Stage recreated-window persistence and bounds tracking are indirectly covered, not directly unit-tested. Source uses the latest window state document when creating a Stage window at `runtime-player-windows.ts:206` / `runtime-player-windows.ts:210`, applies persisted always-on-top at `runtime-player-windows.ts:212`, and attaches bounds tracking to newly created Stage windows at `runtime-player-windows.ts:83` / `runtime-player-windows.ts:88`. Existing window-state controller/store tests cover persistence primitives, but there is no direct fake-BrowserWindow test for `createStageWindowLifecycle`.

Reopened Stage resync is not directly integration-tested. The implementation hook in `runtime-player-main.ts:184` republishes Variant status, latest live frame, and native display transform at `runtime-player-main.ts:185`, `runtime-player-main.ts:187`, and `runtime-player-main.ts:191`. Existing component tests cover latest-live-frame replay in `live-parameter-bridge-handlers.test.ts:48` and Stage Motion transport behavior in `stage-motion-transport.test.ts:9`, but no focused test asserts the `onStageWindowReopened` wiring as one integration unit. This is a remaining non-blocking test gap because the core reopen lifecycle and the resync primitives are covered separately.

## Verification Performed

- `git diff -- <changed files>` inspected.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/window-management/control-window-recovery.test.ts src/main/stage-view-bridge-handlers.test.ts`
  - Result: passed, 2 files / 32 tests.
  - Run with approved escalation because prior Windows sandbox runs hit `spawn EPERM`.
- `git diff --check -- <changed files>`
  - Result: passed; Git reported LF-to-CRLF working-copy warnings only.

Gnome-reported verification was also considered:

- Runtime Player focused Vitest: passed, 2 files / 32 tests.
- Runtime Player typecheck: passed.
- Runtime Player build: passed.
- `git diff --check`: passed, LF-to-CRLF warnings only.

Reviewer did not rerun full build/typecheck in this lane.

## Forbidden-Scope Check

- No source fixes were implemented by this reviewer.
- `pnpm install` was not run.
- Reviewed source/test diff is confined to Runtime Player main/window lifecycle and tests.
- No Runtime Export format, Editor, package-format schema, dependency, or lockfile change was introduced in the reviewed source/test files.
- Existing modified discussion map files shown by `git diff --name-only` were not edited or reviewed as part of this Domain A test adequacy lane.

## Remaining Manual Checks / Test Gaps

- Manual packaged-app smoke remains valuable: close Control with the normal window close button, confirm Stage closes and the Runtime Player process exits.
- Manual Stage recovery remains valuable: close Stage through OS/taskbar route, confirm Control remains alive, then press Focus Stage and confirm Stage reopens/focuses with the expected visual state.
- Direct unit coverage could be added later for `createStageWindowLifecycle` with an injectable BrowserWindow factory to assert reopened Stage bounds, always-on-top, ready-to-show, closed notification, load failure close, and bounds tracking on recreated windows.
- Direct integration coverage could be added later for `runtime-player-main.ts` reopen resync to assert `runtimeVariantBridge.publishStatus`, `stageLiveParameters.publishLatestFrameToStageWindow({ resetBeforePublish: true })`, and native display transform publish are called from `onStageWindowReopened`.

