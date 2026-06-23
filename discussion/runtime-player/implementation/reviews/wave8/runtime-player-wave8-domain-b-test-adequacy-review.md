# Runtime Player Wave8 Domain B Test Adequacy Follow-up Review

- verdict: `pass`
- follow-up status: previous blocking finding resolved
- review lane: Test Adequacy
- reviewer role: Review-Sylph
- report path: `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-b-test-adequacy-review.md`
- review date: 2026-06-23

## Scope

This follow-up review rechecked the previous blocking test adequacy finding:

> Startup restore invalid/missing path status was not directly tested for `{ reason: "startup" }`; only retry was covered.

No source files were edited by this review.

## Files Inspected

- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts`
- `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.runtime-export.test.ts`

## Follow-up Finding Status

### Resolved: startup invalid/missing restore status now has direct deterministic coverage

`apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts` now includes a direct startup failure test:

- test name: `reports a startup restore error without clearing the saved invalid path`
- invocation: `runtimeExportBridgeChannels.restoreLastDirectory` with `{ reason: "startup" }`
- loader behavior: `loadDirectory` throws `RuntimeExportLoaderError("runtimeExport.missingArtifact", ...)`
- assertions include:
  - result is `error`
  - `runtimeExport.statusLabel` is `Runtime Export restore failed`
  - `runtimeExport.directoryPath` is the saved invalid path
  - `runtimeExport.operation` is `startup-restore`
  - error code/artifact path are preserved
  - saved startup-state path remains unchanged
  - `statusChanged` error is broadcast with `operation: "startup-restore"`

The source path supports the asserted behavior:

- `readRestoreOperation` maps `{ reason: "startup" }` to `startup-restore` in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`.
- restore calls the shared `loadRuntimeExportIntoSession` path in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`.
- load failure calls `session.setError(...)` and broadcasts status in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts`.
- restore operations get `Runtime Export restore failed` from `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts`.

This directly satisfies the Wave8 Domain B minimum test item `startup auto restore invalid/missing path status` from `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`.

## Coverage Assessment

Domain B focused coverage is adequate for this follow-up:

- startup-state path/read/write/corrupt fallback remains covered in `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.test.ts`.
- successful manual load updates the saved path in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts`.
- startup auto restore success is covered through `{ reason: "startup" }`.
- startup auto restore invalid/missing path status is now directly covered through `{ reason: "startup" }`.
- saved invalid path remains available for retry/reporting is still covered through `{ reason: "retry" }`.
- preload IPC mapping/status subscription coverage remains present in `apps/runtime-player/src/preload/runtime-player-bridge.runtime-export.test.ts`.

No remaining deterministic test gap blocks Domain B test adequacy.

## Commands Run

| Command | Outcome |
|---|---|
| `Get-Content -Encoding UTF8 <review/basis/source/test files>` | Passed; files were read directly. |
| `rg -n "startup|retry|invalid|missing|restore|reason|status|last|session" <target files>` | Passed; located the startup restore, retry restore, status, and persistence evidence. |
| `rg -n "Domain B|startup|restore|invalid|missing|test|Retry|Open New|Input Source|auto-connect|first-paint|startup state|last successful|saved" discussion/runtime-player/implementation/orchestration/player-wave8-plan.md discussion/runtime-player/screens/broadcast-stage-setup-v0.md` | Passed; confirmed the relevant plan and screen requirements. |
| `pnpm.cmd --dir apps/runtime-player exec vitest run -c vitest.config.ts src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts` | First sandbox run failed with `spawn EPERM` while loading Vitest config/esbuild; elevated rerun passed: 1 file, 5 tests. |
| `git diff --check -- apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts` | Passed with no output. |
| `git status --short -uall discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-b-test-adequacy-review.md apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts` | Showed both the reviewed test file and this review artifact as untracked in the current workspace. |

## Repository State Note

`apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts` is currently untracked in this workspace, as is this review artifact. I did not treat that as a test adequacy blocker because the file was inspected directly and the focused Vitest command executed it successfully. The parent/integration step should ensure both files are included in the final change set.

## Residual Manual Verification Items

These are not blocking for the focused Domain B test adequacy verdict, but should remain in the Wave8 manual verification set:

- Run the real Electron app with a valid saved Runtime Export path and verify startup restore occurs after Control first paint with visible loading/status.
- Run the real Electron app with a missing/invalid saved Runtime Export path and verify Control does not crash, reports restore failure, keeps Retry available, and allows Open New.
- Verify failed startup restore does not erase `startup-state/runtime-player-startup.json`.
- Verify startup restore does not auto-connect Input Source.
- Verify Retry Restore / Open New Export labels and disabled states render correctly in the real Control Window.

## User Decision Points

None. The previous issue was a missing deterministic test, and the follow-up test now covers it directly.
