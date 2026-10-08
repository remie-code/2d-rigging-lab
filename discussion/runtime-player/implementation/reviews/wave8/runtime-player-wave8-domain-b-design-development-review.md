# Runtime Player Wave8 Domain B Design / Development Compliance Review

verdict: pass

## Basis inspected

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Domain B changed/new files listed in the assignment, including the shared `apps/runtime-player/src/main/runtime-player-main.ts`.

## Findings ordered by severity

No blocking or non-blocking design/development compliance findings.

- Main/preload/Control responsibilities are coherent. Main owns persisted startup state and Runtime Export session mutation; preload exposes only `restoreLastDirectory({ reason?: "startup" | "retry" })`; Control only schedules startup restore and renders retry/open-new routes.
- Startup State is separate from Window State, Input Profile, and Model Mapping Profile. The store path is `<userData>/startup-state/runtime-player-startup.json` in `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.ts:43`, and the document owns only `lastRuntimeExportDirectory` plus metadata in `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-document.ts:4`.
- Manual open and restore share the same validation/session/broadcast workflow through `loadRuntimeExportIntoSession` in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-load-workflow.ts:44`. Manual open delegates at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:92`; restore delegates at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:130`.
- Successful manual open saves the last Runtime Export path at `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts:102`. Failed restore does not clear the saved path; tests assert this in `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts`.
- Startup restore is scheduled from Control after initial render/effect setup in `apps/runtime-player/src/control/control-window-app.tsx:91`, with status/error feedback and Retry/Open New routes in Overview and Stage pages.
- Stage remains model-only for this domain. No Stage renderer/raw tracking/debug/OBS/Spout automation surface was introduced.
- Shared `runtime-player-main.ts` integration is minimal for Domain B: startup-state store creation and passing it into runtime-export handlers at `apps/runtime-player/src/main/runtime-player-main.ts:56` and `apps/runtime-player/src/main/runtime-player-main.ts:93`. Other nearby lifecycle/tray changes are concurrent Domain A work and do not conflict with Domain B.
- Error handling is robust enough for the target behavior: corrupt/missing startup-state file falls back safely, invalid saved Runtime Export paths become non-crashing restore errors, and retry/open-new routes remain available.

## Source-organization assessment

Pass.

- New startup-state files have clear responsibilities: document parsing vs file store.
- Runtime Export load side effects were factored into a named workflow file instead of expanding bridge handlers with duplicate logic.
- No substantial implementation was added to `index.ts`; no new forbidden broad catch-all files were found.
- `control-window-app.tsx` is still a large existing coordinator file, but the Domain B additions are renderer orchestration and prop wiring. This is not a blocking oversized-file regression for this domain.
- `node scripts/check-source-organization.mjs` passed.

## Commands run

- `git status --short -uall`
- `git diff -- apps/runtime-player/src/main/startup-state apps/runtime-player/src/main/runtime-export-loader apps/runtime-player/src/preload/runtime-export-bridge-contract.ts apps/runtime-player/src/preload/runtime-export-bridge-channels.ts apps/runtime-player/src/preload/runtime-player-bridge.ts apps/runtime-player/src/control/control-window-app.tsx apps/runtime-player/src/control/overview-page.tsx apps/runtime-player/src/control/stage-page.tsx apps/runtime-player/src/main/runtime-player-main.ts`
- `rg --files ...` / `rg -n "startup|restore|lastRuntimeExport|runtimeExport|autoRestore|restoreRuntime|openRuntimeExport|Runtime Export" ...`
- `git diff --check -- ...` passed.
- `node scripts/check-source-organization.mjs` passed.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.test.ts apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.runtime-export.test.ts`
  - First sandboxed run failed with `spawn EPERM` while loading Vitest config.
  - Re-run with escalated sandbox permissions passed: 3 files, 11 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/runtime-export-loader/runtime-export-session-state.test.ts apps/runtime-player/src/main/runtime-export-loader/runtime-export-directory-loader.test.ts apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.test.ts apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.test.ts apps/runtime-player/src/preload/runtime-player-bridge.runtime-export.test.ts` passed: 5 files, 28 tests.
- `pnpm.cmd typecheck` passed.

## Remaining risks

- Manual Electron verification is still needed for the exact startup UX timing: Control first paint, visible `Restoring Runtime Export`, then success/error feedback.
- Startup-state save failures after successful manual open are intentionally swallowed so a loaded model is not converted into a failed load. This is acceptable for Domain B, but a future UX pass may want a small persistence warning if users report restore not sticking.
- Control renderer startup restore is guarded by a module-level one-shot flag. This is appropriate for normal startup, but unusual renderer reload/dev scenarios are not covered by the focused tests.

## User-decision points

None for Domain B. No product/scope decision is needed before passing this domain review.
