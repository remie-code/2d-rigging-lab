# Runtime Player Wave20 Domain A Design / Development Compliance Post-Fix Re-Review

- Date: 2026-06-27
- Role: Review-Sylph, design/development compliance lane
- Verdict: `pass`

## Scope

Re-reviewed the post-fix Runtime Player Control Window quit / Stage reopen lifecycle changes, with specific focus on the previous blocking finding: Stage close left stale `Stage ready` / model-visible state visible to Control.

Basis read:

- `discussion/runtime-player/implementation/orchestration/player-wave20-plan.md`
- `discussion/runtime-player/implementation/waves/wave20/runtime-player-wave20-domain-a-control-quit-stage-reopen-lifecycle-report.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/_map.md`

Files reviewed:

- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/control/stage-page.stage-motion.test.ts`

Related behavior consumers inspected:

- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- `apps/runtime-player/src/main/variant-controller/runtime-variant-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`

## Findings

No blocking design/development findings.

The previous blocking finding is fixed. On Stage lifecycle `closed`, the bridge now clears transient capture flags, writes an explicit unavailable renderer status, sends `statusChanged`, and republishes full Control state (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:103`). The unavailable report is `status: "empty"`, `statusLabel: "Stage unavailable"` (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:347`), and snapshots still report a destroyed Stage with `bounds: null` (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:305`). Control derives model visibility from render status, so the new empty status formats as `Not visible` (`apps/runtime-player/src/control/stage-page.tsx:329`).

## Lifecycle Evidence

- Control close is routed through `RuntimePlayerQuitController`: Control close calls `requestQuit()` and `closeStageWindow()` without hiding Control (`apps/runtime-player/src/main/window-management/control-window-recovery.ts:80`), and Runtime main wires that to `quitController.requestQuit()` plus `windows.stageWindowLifecycle.closeStageWindow()` (`apps/runtime-player/src/main/runtime-player-main.ts:362`).
- Explicit quit remains controller-owned: `RuntimePlayerQuitController.requestQuit()` owns the app quit transition (`apps/runtime-player/src/main/window-management/control-window-recovery.ts:43`), `before-quit` uses the same controller flush path (`apps/runtime-player/src/main/runtime-player-main.ts:359`), tray Quit calls the controller (`apps/runtime-player/src/main/runtime-player-main.ts:386`), and app-owned services are still disposed in `will-quit` (`apps/runtime-player/src/main/runtime-player-main.ts:400`).
- Stage direct close does not request quit: Stage lifecycle emits a `closed` event from the Stage `closed` listener (`apps/runtime-player/src/main/window-management/runtime-player-windows.ts:217`) and does not call app quit. The all-windows fallback remains guarded by `!isRuntimePlayerQuitInProgress()` (`apps/runtime-player/src/main/runtime-player-main.ts:411`).
- Focus Stage reopens/focuses correctly: the window set exposes a live Stage getter and lifecycle (`apps/runtime-player/src/main/window-management/runtime-player-windows.ts:70`), `reopenStageWindow()` recreates and reloads the Stage renderer (`apps/runtime-player/src/main/window-management/runtime-player-windows.ts:148`), and the bridge then reapplies click-through/off plus persisted always-on-top before show/focus (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:356`).
- Runtime Export / Variant / live frame / Stage Motion resume paths remain coherent: a reopened Stage pulls current Runtime Export payload and subscribes to future payloads (`apps/runtime-player/src/stage/stage-window-app.tsx:113`), pulls Variant status (`apps/runtime-player/src/stage/stage-window-app.tsx:238`), and pulls latest live frame through an IPC path that returns `null` while local preview delivery is disabled (`apps/runtime-player/src/main/live-parameter-bridge-handlers.ts:35`). Runtime main also republishes Variant status, latest native Stage frame when not suspended, and native Stage display transform on reopen (`apps/runtime-player/src/main/runtime-player-main.ts:184`).
- Browser Source ownership is not moved to Stage lifetime: Browser Source server start/stop remains app-level (`apps/runtime-player/src/main/runtime-player-main.ts:175`, `apps/runtime-player/src/main/runtime-player-main.ts:400`), and Stage close does not shut it down.

## Test Evidence

- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:169` covers a previously ready Stage closing, then asserts destroyed window state, `Stage unavailable`, `status: "empty"`, and cleared transient capture flags.
- `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:57` covers Control markup for a closed Stage and asserts `Unavailable`, `Stage unavailable`, `Not visible`, no `Stage ready`, and no visible-model label.
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:97` covers Focus Stage reopening a destroyed Stage, applying persisted always-on-top, clearing transient capture flags, and focusing the reopened window.
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:13` covers Control close requesting quit and closing Stage, and `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts:33` covers explicit-quit-in-progress avoiding duplicate requests.

## Verification Performed

- Inspected `git diff --` for all assignment-listed source/test files.
- Ran focused Vitest:
  - sandbox attempt failed during Vite/esbuild config load with Windows `spawn EPERM`;
  - escalated rerun passed:
    - `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/window-management/control-window-recovery.test.ts src/main/stage-view-bridge-handlers.test.ts src/control/stage-page.stage-motion.test.ts`
    - 3 files passed / 38 tests passed.
- Ran `git diff --check --` for reviewed files:
  - passed; Git printed LF-to-CRLF working-copy warnings only.
- Ran forbidden-scope name check over Editor, packages, package manifests, lockfile, and packaging config paths:
  - no matching diffs.

## Remaining Manual Checks

- Launch Runtime Player from packaged `.exe` if available, or dev mode if not.
- Close Control with the normal window close button and confirm Stage closes and the Runtime Player process exits after normal shutdown.
- Relaunch, close Stage through taskbar / OS route, and confirm Control remains alive.
- Confirm Control shows Stage unavailable without stale `Stage ready` / `Model Visible` wording.
- Press `Focus Stage` and confirm Stage reopens, focuses, restores bounds / always-on-top, and re-renders the current Runtime Export.
- Smoke-check Browser Source output, local preview suspension, Variant switching, live mapping / Body Follow, Stage Motion display transform, and diagnostics in a real Electron session.

## Blockers / Questions

None for this review lane.
