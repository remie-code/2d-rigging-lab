# Runtime Player Wave20 Domain A Spec Compliance Review

verdict: `pass`

Date: 2026-06-27

Review lane: spec compliance.

Orchestration separation:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## Basis Read

- `discussion/runtime-player/implementation/orchestration/player-wave20-plan.md`
- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/waves/wave8/runtime-player-wave8-final-integration-report.md`
- `discussion/runtime-player/implementation/_map.md`

## Files Reviewed

- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`

Review used `git diff -- <files>` and source inspection.

## Findings

No blocking spec compliance findings.

## Compliance Evidence

- Control Window user close no longer hides Control: `attachRuntimePlayerControlWindowRecovery` no longer calls `preventDefault()` or `hide()` on non-explicit close; it calls `requestQuit()` and `closeStageWindow?.()` instead (`apps/runtime-player/src/main/window-management/control-window-recovery.ts:80`).
- Control close initiates normal app quit and closes Stage: Runtime main wires Control close to `quitController.requestQuit()` and `windows.stageWindowLifecycle.closeStageWindow()` (`apps/runtime-player/src/main/runtime-player-main.ts:362`). The quit controller still runs the existing before-quit flush path for input disconnect, model mapping save, and window state flush (`apps/runtime-player/src/main/window-management/control-window-recovery.ts:43`, `apps/runtime-player/src/main/window-management/control-window-recovery.ts:55`, `apps/runtime-player/src/main/window-management/control-window-recovery.ts:71`).
- Background services remain on normal app shutdown: Browser Source server disposal remains in `will-quit` (`apps/runtime-player/src/main/runtime-player-main.ts:400`, `apps/runtime-player/src/main/runtime-player-main.ts:407`), preserving app-owned shutdown semantics rather than adding a Stage-close shutdown path.
- Stage direct close does not quit the app by itself: Stage lifecycle emits a `closed` event from the Stage window `closed` listener (`apps/runtime-player/src/main/window-management/runtime-player-windows.ts:217`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:222`) and does not call app quit. The only all-windows fallback quit remains guarded by `!isRuntimePlayerQuitInProgress()` and only applies when Electron reports all windows closed (`apps/runtime-player/src/main/runtime-player-main.ts:411`).
- Stage destroyed/unavailable state is represented in Control state: Stage close clears transient arrange/click-through state and republishes state (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:102`), and snapshots report `windowState: "destroyed"` with `bounds: null` when the current Stage window is destroyed (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:287`).
- `Focus Stage` still focuses an existing Stage: the focus path restores minimized windows, then shows and focuses the Stage (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:385`).
- `Focus Stage` reopens a destroyed Stage: if the current Stage is destroyed, the bridge asks the Stage lifecycle to `reopenStageWindow()`, reapplies click-through off and persisted always-on-top, publishes state, runs the reopen callback, then focuses the new Stage (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:349`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:365`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:376`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:382`). The lifecycle creates a new BrowserWindow using persisted Stage bounds / always-on-top and loads the Stage renderer entry (`apps/runtime-player/src/main/window-management/runtime-player-windows.ts:148`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:153`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:175`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:206`).
- Failed Stage reopen returns an existing-style Control action error/status instead of silently failing (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:365`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:369`).
- Tray/menu explicit Quit remains valid: tray quit still calls `quitController.requestQuit()` (`apps/runtime-player/src/main/runtime-player-main.ts:372`, `apps/runtime-player/src/main/runtime-player-main.ts:386`).
- Runtime Export / Variant / live Stage behavior is not obviously regressed by Stage recreation: a reopened Stage renderer can request the current Runtime Export payload, Variant status, live frame, Stage view transform, and arrange state from existing preload/main handlers on startup (`apps/runtime-player/src/stage/stage-window-app.tsx:113`, `apps/runtime-player/src/stage/stage-window-app.tsx:182`, `apps/runtime-player/src/stage/stage-window-app.tsx:241`, `apps/runtime-player/src/stage/stage-window-app.tsx:352`, `apps/runtime-player/src/stage/stage-window-app.tsx:366`). Runtime main also republishes Variant status, latest native Stage live frame when local preview is not suspended, and native display transform after Stage reopen (`apps/runtime-player/src/main/runtime-player-main.ts:184`).
- Wave10 local preview suspension is not obviously regressed: the Stage reopen callback respects `isLocalPreviewLiveRenderSuspended` before replaying the latest frame to native Stage (`apps/runtime-player/src/main/runtime-player-main.ts:184`, `apps/runtime-player/src/main/runtime-player-main.ts:186`).

## Tests And Verification

- `git diff --check -- apps/runtime-player/src/main/window-management/runtime-player-windows.ts apps/runtime-player/src/main/window-management/control-window-recovery.ts apps/runtime-player/src/main/stage-view-bridge-handlers.ts apps/runtime-player/src/main/runtime-player-main.ts apps/runtime-player/src/main/window-management/control-window-recovery.test.ts apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
  - Result: passed; Git printed LF-to-CRLF working-copy warnings only.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/window-management/control-window-recovery.test.ts src/main/stage-view-bridge-handlers.test.ts`
  - Result: passed, 2 files / 32 tests.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Result: passed.
- Forbidden-scope name check over `git diff --name-only` for Editor, package-format/schema, package manifests, lockfile, and packaging config patterns:
  - Result: no matches.

`pnpm install` was not run.

## Forbidden-Scope Check

No forbidden implementation scope was observed in the changed file set. The source/test diff is limited to Runtime Player main/window lifecycle and focused tests. The working tree also contains Runtime Player discussion map/plan docs, but no Runtime Export format, Editor, package-format schema, dependency, lockfile, or packaging config changes were present in `git diff --name-only`.

## Remaining Manual Checks

- Launch the packaged `.exe` or dev app, close Control with the normal window close button, and confirm Stage closes and the Runtime Player process exits.
- Relaunch, close Stage through an OS/taskbar route, and confirm Control remains alive and reports Stage unavailable.
- Press `Focus Stage` after Stage direct close and confirm Stage reopens and receives focus.
- Smoke-check Runtime Export startup restore, Stage view persistence, Browser Source server/URL behavior, Input Mapping / Body Follow / Stage Motion, Variant switching, local preview suspension with Browser Source connected, and lightweight diagnostics in a real Electron session.
