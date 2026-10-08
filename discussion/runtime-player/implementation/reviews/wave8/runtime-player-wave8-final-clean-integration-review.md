# Runtime Player Wave8 Final Clean Integration Review

verdict: `pass`

Date: 2026-06-23

## Scope Reviewed

Clean integration review for Runtime Player Wave8 Domain D, performed independently from the final integration report.

Reviewed basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- Domain reports under `discussion/runtime-player/implementation/waves/wave8/`
- Domain reviews under `discussion/runtime-player/implementation/reviews/wave8/`
- `discussion/runtime-player/implementation/waves/wave8/runtime-player-wave8-final-integration-report.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- Relevant Runtime Player source and focused tests under `apps/runtime-player/src`

## Findings

No blocking findings.

The Wave8 final integration report, docs/maps, source contracts, and focused automated tests are coherent with the accepted Wave8 scope. Manual Electron/native-window/OBS-adjacent verification remains pending and is not falsely claimed as complete.

## Required Check Evidence

| Check | Evidence |
|---|---|
| Click-through cannot trap the user without recovery | Control close hides instead of destroying the window in `control-window-recovery.ts`; tray/application menu exposes Show Control, Focus Stage, Disable Click-through, and Quit in `runtime-player-tray-menu.ts`. `runtime-player-main.ts` wires `disableClickThrough` to `stageViewBridge.disableClickThrough()` and reads the current enabled state through `getClickThroughRecoveryState`. |
| Click-through starts Off on startup | `stage-view-bridge-handlers.ts` initializes `clickThroughEnabled: false` and calls `setIgnoreMouseEvents(false)` during bridge registration. click-through is not in `window-state-document.ts`. |
| Runtime Export auto restore does not auto-connect Input Source | Control schedules only `runtimeExport.restoreLastDirectory({ reason: "startup" })`. `runtime-player-main.ts` registers input handlers but does not call `inputBridge.connect()` during startup or Runtime Export restore. `connectInputSource()` remains a user action in `control-window-app.tsx`. |
| Runtime Export auto restore uses the shared load path | `runtime-export-bridge-handlers.ts` routes manual open and restore through `loadRuntimeExportIntoSession`; successful manual open saves startup state, while restore failures do not clear the saved path. |
| Stage remains model-only in normal mode | `stage-window-app.tsx` renders the canvas and `StageArrangeOverlay`; the overlay returns `null` when arrange mode is disabled. `runtime-player-boundary.test.ts` guards Stage production files against setup/debug/raw tracking/control API exposure. |
| Capture Target checklist does not claim OBS integration/readiness | `stage-page.tsx` labels the panel `Capture Target` and lists only local Runtime Player readiness. Source search for `OBS Ready` under `apps/runtime-player/src` found no matches. |
| Spout and OBS automation remain out of scope | Source search for `OBS`, `obs-websocket`, `Spout`, `spout`, `Stage Motion`, `near/far`, `auto-connect`, `auto connect`, and `automatic OBS` under `apps/runtime-player/src` found no matches. Docs/backlog keep these as out of scope or future work. |
| Shared `runtime-player-main.ts` is coherent | Main constructs Window State, Stage bridge, Runtime Export startup-state store, input/model-mapping bridges, quit controller, Control recovery, and tray/menu recovery without crossing ownership boundaries. |
| Preload contracts are coherent | Control preload exposes Runtime Export restore and Stage capture actions. Stage preload remains narrow: Runtime Export payload/status, live parameter frames, Stage view transform/reporting, and arrange-state read/subscription only. |
| Stage bridge contracts are coherent | Control bridge owns `setArrangeMode`, `setClickThrough`, `setAlwaysOnTop`, and `copyWindowTitle`; Stage bridge only reads arrange state and reports render/view state. |
| Window State and Startup State stores are coherent | Startup State stores only `lastRuntimeExportDirectory` under `startup-state/runtime-player-startup.json`. Window State stores window bounds, Stage view transform, and `stageEnvironment.alwaysOnTop` under `window-state/runtime-player.json`. |
| Docs/maps match implementation facts | `broadcast-stage-setup-v0.md`, `broadcast-capture-paths.md`, screen docs, backlog, Runtime Player maps, Wave8 report map, and Wave8 review map align with implemented facts and keep manual checks separate. This review adds the final clean review link to `reviews/wave8/_map.md`. |
| `pnpm install` was not run | This review did not run `pnpm install`. Scoped status for package manifests/lockfile did not show package or lockfile modifications. |
| Manual Electron/OBS verification is not falsely claimed as complete | Wave8 docs, maps, domain reports, and final integration report all list native Electron/OBS-adjacent checks as pending. |

## Verification Performed

- Read the listed basis documents, Wave8 domain reports, Wave8 review reports, final integration report, updated screen/research/backlog docs, and Runtime Player maps.
- Inspected Runtime Player source under `apps/runtime-player/src`, including main startup wiring, Runtime Export restore, Startup State, Window State, tray/menu recovery, Control Stage page, preload contracts, Stage bridge, Stage renderer/app, and focused tests.
- `rg -n "OBS|obs-websocket|Spout|spout|Stage Motion|near/far|auto-connect|auto connect|automatic OBS|OBS Ready" apps/runtime-player/src`
  - Result: no matches.
- `git diff --check -- discussion/runtime-player apps/runtime-player`
  - Result: passed; Git reported LF-to-CRLF working-copy warnings only.
- `rg -n "[ \t]+$" discussion/runtime-player/implementation/reviews/wave8/runtime-player-wave8-final-clean-integration-review.md discussion/runtime-player/implementation/reviews/wave8/_map.md`
  - Result: no matches.
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Result: passed.
- `node scripts/check-source-organization.mjs`
  - Result: passed.
- `pnpm.cmd --dir apps/runtime-player run test:unit`
  - First sandboxed run failed while loading Vitest/Vite config with Windows `spawn EPERM`.
  - Escalated rerun passed: 45 test files / 191 tests.

`pnpm install` was not run.

## Manual Verification Still Pending

These checks were not run and are not claimed complete:

- Control close hides/reopens from tray/application menu.
- Explicit Quit flushes input disconnect, Model Mapping Profile save, and Window State, then exits.
- Runtime Export valid/invalid startup restore in a real Electron session.
- Stage Arrange drag handle moves the frameless native Stage Window.
- Arrange overlay disappears and normal Stage pan/zoom works after leaving arrange mode.
- Click-through toggle and tray/application menu recovery in a real Electron session.
- Always-on-top native behavior and restart persistence.
- Capture Target checklist and Copy Window Title in the real Control Window.
- OBS Window Capture title/alpha smoke check.

## Residual Risks

- Electron-native tray/menu, native drag, click-through, always-on-top, and restart behavior are source/test-supported but still need a real app session.
- OBS Window Capture title selection and transparent alpha handling are environment-sensitive and still need manual smoke verification.
- `stage-view-bridge-handlers.ts` is still cohesive for Wave8, but future broadcast output/native Stage controls should split capture-specific state/actions into a named main-side controller before the file grows further.

## User Decision Points

None required for Wave8 pass.

Future planning decisions remain only if manual verification changes the product direction, such as prioritizing Spout feasibility, OBS automation, global click-through recovery shortcut, or head-position Stage Motion.
