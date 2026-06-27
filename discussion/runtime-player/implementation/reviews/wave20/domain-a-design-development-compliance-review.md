# Runtime Player Wave20 Domain A Design / Development Compliance Review

- Date: 2026-06-27
- Role: Review-Sylph, design/development compliance lane
- Verdict: `needs_changes`

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

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

Related consumer inspected for state-display impact:

- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts`
- `apps/runtime-player/src/main/variant-controller/runtime-variant-bridge-handlers.ts`

## Findings

### 1. Stage close leaves stale render-ready state visible to Control

- Severity: medium / blocks pass
- References:
  - `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:102`
  - `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:113`
  - `apps/runtime-player/src/control/stage-page.tsx:95`
  - `apps/runtime-player/src/control/stage-page.tsx:329`
  - `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts:168`

On `stageWindowLifecycle` `closed`, the handler clears only transient capture flags and republishes state. It does not reset or override `statusState`, so a Stage that was previously rendering can keep reporting the last renderer status, such as `Stage ready`.

The current Control consumer renders `stageView.renderStatus.statusLabel` directly in the Stage Window panel and derives Local Preview model visibility from render status alone. Therefore a direct Stage close can produce an inconsistent Control state: `Stage Window: Unavailable` while `Render: Stage ready` and `Model: Visible`.

That conflicts with Wave20's accepted semantics that a directly closed Stage is treated as closed/unavailable until reopened. It also weakens the recovery signal because the user can see stale renderer readiness beside the accurate destroyed window state.

Concrete fix guidance for Gnome:

- When lifecycle reason is `closed`, clear the renderer status to an unavailable/empty state before publishing, or make `createStageStateSnapshot` force a non-ready render status while `stageWindow.windowState` is `destroyed`.
- Keep the existing `stageWindow.windowState: "destroyed"` and capture flag reset behavior.
- Add a focused assertion that after a ready/warning Stage closes, `getState()` no longer reports a ready/warning render status.
- Add or adjust Control-side coverage so destroyed Stage state cannot format the model as `Visible`.

## Design / Lifecycle Checks

- Stage lifecycle controller is small and scoped: `runtime-player-windows.ts` owns Stage creation, renderer load, close notification, and current-window access through `stageWindowLifecycle`.
- Reopen reloads the Stage renderer entry through `loadRendererEntry(stageWindow, "stage")` and reattaches bounds tracking on `created`.
- Stage recreate uses current window-state document for bounds and always-on-top, not only the startup snapshot.
- Most IPC send paths read `input.windows.stageWindow` at send time, so repeated destroy/reopen does not retain stale Stage references in the reviewed main handlers.
- Control close now requests the normal quit controller and closes Stage. Explicit quit still routes through `RuntimePlayerQuitController` and `before-quit` flush ownership.
- Browser Source ownership is not tangled with native Stage close/reopen. The implementation does not shut down Browser Source on Stage close.
- Runtime Export, latest live frame, and Variant selection have pull-based Stage mount paths:
  - Runtime Export: `StageWindowApp` calls `runtimeExport.getLoadedPayload()`.
  - Live frame: `StageWindowApp` calls `liveParameters.getLatestFrame()` after payload render.
  - Variant: `StageWindowApp` calls `variants.getStatus()`.
- Stage Motion display transform is re-pushed from `onStageWindowReopened`. That is acceptable for this wave, but should remain a manual smoke check because it is push-only rather than pulled by the Stage renderer at mount.

## Verification Performed

- Inspected required basis documents.
- Inspected `git diff --` for all changed files listed in the assignment.
- Inspected current source with line references for lifecycle, bridge, Runtime Export, Variant, live-frame, Stage page, and Stage renderer mount behavior.
- Ran focused Vitest:
  - sandbox attempt failed with known Windows `spawn EPERM` during Vite/esbuild config load.
  - escalated rerun passed:
    - `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/window-management/control-window-recovery.test.ts src/main/stage-view-bridge-handlers.test.ts`
    - 2 files passed / 32 tests passed.
- Ran `git diff --check --` for reviewed files:
  - passed; Git reported LF-to-CRLF working-copy warnings only.

Typecheck and build were not rerun by this reviewer; Gnome reported both as passed.

## Forbidden-Scope Check

- No source changes were made by this reviewer.
- Reviewed source diff is limited to Runtime Player main-process lifecycle/bridge code and focused tests.
- No Editor source changes observed in the reviewed diff.
- No Runtime Export format, package-format schema, dependency, lockfile, or `pnpm install` changes observed in the reviewed diff.
- Existing discussion map/plan files are also dirty in the worktree, but they are outside this Domain A source review lane.

## Remaining Manual Checks

- Launch packaged `.exe` or dev Runtime Player and close Control with the normal window close button; confirm the process exits after the normal quit flush.
- Relaunch, close Stage through OS/taskbar routes, and confirm Control remains alive.
- Confirm Control shows Stage as unavailable without stale `Stage ready` / `Model Visible` wording after direct Stage close.
- Press `Focus Stage` after direct Stage close; confirm Stage reopens, focuses, restores bounds / always-on-top, and re-renders the current Runtime Export.
- With active tracking, confirm the latest live frame and Stage Motion display transform resume on reopened Stage.
- With Browser Source connected and native local preview suspended, confirm Stage reopen does not resume native live preview until the existing suspension policy allows it.
