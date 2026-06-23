# Runtime Player Wave8 Domain B Report: Runtime Export Auto Restore

## Verdict

pass

Domain B completed in 2 implementation/review loops. Runtime Player now persists the last successful manual Runtime Export directory and can restore it on startup through the same validation/session/payload broadcast path used by manual open.

## Scope Completed

- Added separate startup-state persistence at `<electron userData>/startup-state/runtime-player-startup.json`.
- Added `runtime-player-startup-state-v1` with `updatedAtIso` and `lastRuntimeExportDirectory`.
- Saved the last Runtime Export directory only after successful manual open.
- Added startup restore from Control after initial renderer effect/status setup.
- Added retry restore via `runtimeExport.restoreLastDirectory({ reason: "retry" })`.
- Shared manual open, startup restore, and retry restore through `loadRuntimeExportIntoSession`.
- Broadcast visible loading/loaded/error status to Control and Stage.
- Preserved saved invalid/missing paths for retry and Open New behavior.
- Kept Input Source connection manual only.

## Changed Files

Domain B source:

- `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-document.ts`
- `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.ts`
- `apps/runtime-player/src/preload/runtime-export-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-export-bridge-channels.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/overview-page.tsx`
- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/main/runtime-player-main.ts`

Domain B tests:

- `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.test.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.runtime-export.test.ts`

Shared-file note:

- `apps/runtime-player/src/main/runtime-player-main.ts` also contains concurrent Domain A control recovery / tray integration. Domain B only added startup-state store construction and runtime-export handler wiring. Domain B did not edit or revert Domain A-owned `apps/runtime-player/src/main/window-management/**` files.

## Review Loop

### Loop 1

Gnome implemented the feature and focused tests.

Review-Sylph results:

- Spec compliance: pass.
- Design / development compliance: pass.
- Test adequacy: needs_changes.

Blocking test adequacy finding:

- Startup invalid/missing saved Runtime Export path was covered for retry restore, but not directly for `{ reason: "startup" }`.

### Loop 2

Gnome added direct startup restore failure coverage in `runtime-export-bridge-handlers.test.ts`.

Follow-up Review-Sylph test adequacy verdict:

- pass.

The new test asserts startup restore failure returns/broadcasts `operation: "startup-restore"`, `Runtime Export restore failed`, the saved path, and leaves the startup-state path unchanged.

## Review Reports

- `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-b-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-domain-b-test-adequacy-review.md`

Final review verdicts:

- Spec compliance: pass.
- Design / development compliance: pass.
- Test adequacy: pass.

## Verification

Gnome loop 1:

- `pnpm.cmd --dir apps/runtime-player exec vitest run -c vitest.config.ts ...`
  - Initial sandbox run failed with Windows sandbox `spawn EPERM`.
  - Escalated rerun passed: 4 files / 14 tests.
- `pnpm.cmd --dir apps/runtime-player run typecheck`
  - Passed.
- `pnpm.cmd --dir apps/runtime-player run test:unit`
  - Passed: 43 files / 177 tests.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- ...`
  - Passed with LF/CRLF warnings only.

Gnome loop 2:

- `pnpm.cmd --dir apps/runtime-player exec vitest run -c vitest.config.ts src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts`
  - Passed: 1 file / 5 tests.
- `git diff --check -- apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts`
  - Passed.

Orch-Sylph closeout verification:

- `pnpm.cmd --dir apps/runtime-player exec vitest run -c vitest.config.ts src/main/startup-state/runtime-player-startup-state-store.test.ts src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts src/main/runtime-export-loader/runtime-export-session-state.test.ts src/preload/runtime-player-bridge.runtime-export.test.ts`
  - Passed: 4 files / 15 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- apps/runtime-player/src/main/runtime-export-loader apps/runtime-player/src/main/startup-state apps/runtime-player/src/preload/runtime-export-bridge-contract.ts apps/runtime-player/src/preload/runtime-export-bridge-channels.ts apps/runtime-player/src/preload/runtime-player-bridge.ts apps/runtime-player/src/control/control-window-app.tsx apps/runtime-player/src/control/overview-page.tsx apps/runtime-player/src/control/stage-page.tsx apps/runtime-player/src/main/runtime-player-main.ts discussion/runtime-player/implementation/reviews/wave8`
  - Passed with LF/CRLF warnings only.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `rg -n "[ \t]+$" <new Domain B files and review reports>`
  - Passed; no trailing whitespace matches.

No `pnpm install` was run.

## Acceptance Evidence

| Requirement | Evidence |
|---|---|
| Save last successful manual Runtime Export directory | `runtime-export-bridge-handlers.ts` saves to startup-state only after `manual-open` load returns `loaded`; covered by handler test. |
| Restore saved path on startup after Control first paint/load opportunity | Control schedules `restoreLastDirectory({ reason: "startup" })` after initial status effect with a deferred timer. |
| Visible restore loading/status in Control | Session state labels restore loading as `Restoring Runtime Export`; status is broadcast through existing runtime-export status channel. |
| Missing/invalid path is non-crashing | Shared load workflow catches loader errors, maps them to renderer-safe `Runtime Export restore failed` status, and broadcasts error status. |
| Missing/invalid path is not cleared automatically | Startup-state save/clear is not called on restore error; startup and retry failure tests assert the saved path remains. |
| Retry or Open New | Overview and Stage pages expose `Retry Restore` on restore failures and `Open New Export` on error. |
| Manual open and restore share load logic | Manual open, startup restore, and retry restore all call `loadRuntimeExportIntoSession`. |
| Do not auto-connect Input Source | Runtime Export restore path updates model/mapping/live parameter state only; input connect remains behind explicit Control action. |

## Remaining Risks

- Manual Electron restart verification was not run for valid and invalid saved Runtime Export paths.
- Exact first-paint timing is inferred from the Control React effect and deferred timer, not proven by an Electron E2E test.
- Corrupt startup-state file warnings remain internal store warnings and are not surfaced as a separate Control warning.
- Startup-state save failure after a successful manual open is intentionally swallowed so it does not turn a loaded model into a load failure; a future UX pass may expose this as a small persistence warning.

## User Decision Points

None for Domain B.
