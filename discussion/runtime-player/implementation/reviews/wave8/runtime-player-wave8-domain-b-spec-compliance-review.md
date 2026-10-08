# Runtime Player Wave8 Domain B Spec Compliance Review

> Review-Sylph independent clean review for Domain B: Runtime Export startup-state / auto restore.

## Verdict

pass

## Basis Inspected

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

## Changed Files / Diff Evidence

- `git status --short -uall` showed the Domain B files as modified/untracked, plus concurrent Domain A files under `apps/runtime-player/src/main/window-management/**` and shared `runtime-player-main.ts`. This review inspected Domain B behavior and only considered shared `runtime-player-main.ts` integration where it affects Domain B.
- Startup State is separate from Window State:
  - `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-document.ts:1` declares `runtime-player-startup-state-v1`.
  - `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-document.ts:5` includes `schemaVersion`, `updatedAtIso`, and `lastRuntimeExportDirectory`.
  - `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.ts:43` stores at `<userData>/startup-state/runtime-player-startup.json`.
  - `apps/runtime-player/src/main/runtime-player-main.ts:56` creates `RuntimePlayerStartupStateStore` separately from the existing Window State store.
- Manual open saves only after a successful load:
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:93` routes manual open through `loadRuntimeExportIntoSession`.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:103` saves the last Runtime Export directory only when `result.result === "loaded"`.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:165` wraps startup-state save failure so it does not convert a successful manual load into a failed load.
- Manual open and restore share validation/session/payload broadcast logic:
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:130` routes restore through the same `loadRuntimeExportIntoSession`.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts:53` broadcasts loading status before validation/load.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts:60` sets loaded session state from the loader result.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts:67` broadcasts loaded status.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts:70` sends the loaded payload to Stage.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts:80` maps loader failures to session error status and `:88` broadcasts that error.
- Startup restore is initiated from Control after renderer load/first React effect:
  - `apps/runtime-player/src/control/control-window-app.tsx:95` schedules startup restore.
  - `apps/runtime-player/src/control/control-window-app.tsx:103` uses `setTimeout(..., 0)` after initial status fetch scheduling.
  - `apps/runtime-player/src/control/control-window-app.tsx:110` invokes `restoreLastDirectory({ reason: "startup" })`.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts:23` creates loading state and `:31` labels restore loading as `Restoring Runtime Export`.
- Missing/invalid saved Runtime Export path is non-crashing and retryable:
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:121` reads the saved `lastRuntimeExportDirectory`.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:130` attempts to load the saved path; load errors become status, not thrown to crash the app.
  - There is no code path in restore failure handling that calls `saveLastRuntimeExportDirectory` or clears the saved path.
  - `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts:77` labels restore errors as `Runtime Export restore failed`.
  - `apps/runtime-player/src/control/overview-page.tsx:121` and `apps/runtime-player/src/control/stage-page.tsx:147` expose `Retry Restore`.
  - `apps/runtime-player/src/control/overview-page.tsx:133` and `apps/runtime-player/src/control/stage-page.tsx:158` expose `Open New Export` on error.
- Preload/API contract exposes restore without broadening Stage or input APIs:
  - `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:63` adds `startup-restore` and `retry-restore` operations.
  - `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts:124` defines the restore request/result contract.
  - `apps/runtime-player/src/preload/runtime-export-bridge-channels.ts:4` declares `runtime-player:runtime-export:restore-last-directory`.
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts:56` exposes `runtimeExport.restoreLastDirectory`.
- Input Source is not auto-connected by startup restore:
  - `apps/runtime-player/src/control/control-window-app.tsx:110` startup path calls only Runtime Export restore.
  - `apps/runtime-player/src/control/control-window-app.tsx:281` keeps input connection behind `connectInputSource`.
  - `apps/runtime-player/src/main/runtime-player-main.ts:64` registers input handlers but does not call `inputBridge.connect()` during startup or Runtime Export restore.
- Out-of-scope check:
  - `rg` across Domain B and adjacent Runtime Player source found no added Spout sender, obs-websocket/OBS automation, Stage Motion, near/far response, or raw tracking/debug data path into Stage. Existing `debug` matches are pre-existing input diagnostics/parser contracts, not Stage broadcast output.

## Findings

No spec-compliance findings.

## Rubric Assessment

| Requirement | Assessment |
|---|---|
| Saves last successful Runtime Export directory after successful manual open | Pass. Save occurs after shared load returns `loaded`. |
| Startup restore attempts saved path after Control first paint/load opportunity, with visible loading/status in Control | Pass. Restore is renderer-initiated after initial Control effect/status setup, and main broadcasts `Restoring Runtime Export`. |
| Missing/invalid saved path reports non-crashing status/error | Pass for saved path load/validation failures. Loader errors are converted to `Runtime Export restore failed` status. |
| Missing/invalid saved path is not automatically cleared | Pass. Restore failure does not write or clear startup-state. |
| User can Retry or Open New | Pass. Overview and Stage pages expose `Retry Restore` and `Open New Export` on restore error. |
| Manual open and auto restore share validation/session/payload broadcast logic | Pass. Both call `loadRuntimeExportIntoSession`. |
| Input Source is not auto-connected | Pass. Startup restore path does not call input connect. |
| Startup state is separate from Window State at `<userData>/startup-state/runtime-player-startup.json` with schema `runtime-player-startup-state-v1` | Pass. Separate store and schema are implemented. |
| Out-of-scope items remain out of scope | Pass. No Spout, OBS automation, Stage Motion, near/far response, or raw tracking/debug Stage path found in Domain B scope. |

## Verification Commands Run

- `pnpm.cmd exec vitest run apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.test.ts apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.test.ts apps/runtime-player/src/preload/runtime-player-bridge.runtime-export.test.ts`
  - First sandboxed attempt failed with known Windows sandbox `spawn EPERM` while loading Vitest/esbuild.
  - Re-run with escalation passed: 4 test files, 14 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- apps/runtime-player/src/main/startup-state apps/runtime-player/src/main/runtime-export-loader apps/runtime-player/src/preload/runtime-export-bridge-contract.ts apps/runtime-player/src/preload/runtime-export-bridge-channels.ts apps/runtime-player/src/preload/runtime-player-bridge.ts apps/runtime-player/src/control/control-window-app.tsx apps/runtime-player/src/control/overview-page.tsx apps/runtime-player/src/control/stage-page.tsx apps/runtime-player/src/main/runtime-player-main.ts`
  - Passed with CRLF normalization warnings only.

## Remaining Risks

- Manual Electron restart verification with a real valid saved Runtime Export path and a real missing/invalid saved path was not run in this review.
- The "after first paint/load opportunity" property is inferred from Control renderer `useEffect` plus `setTimeout(0)` and the status event path; there is no Electron E2E assertion for the exact paint timing.
- Corrupt or unsupported startup-state document warnings are retained in store snapshots but are not surfaced as a distinct Control warning. This is not blocking for the accepted saved-path restore behavior, but final integration may choose to expose it in a later UX pass.

## User-Decision Points

- None required for Domain B pass.
- Optional future decision: whether corrupt startup-state file warnings should become visible user-facing status, separate from saved Runtime Export path load failures.
