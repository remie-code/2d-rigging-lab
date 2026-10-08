# Runtime Player Wave8 Final Integration Report

verdict: `pass`

Date: 2026-06-23

## Scope Completed

Domain D reconciled Wave8 Domain A/B/C implementation facts, inspected the shared Runtime Player contracts, aligned Runtime Player docs/maps to the implemented state, and added Wave8 report/review maps.

Domain A/B/C are treated as completed with `pass`:

- Domain A: Control recovery / tray-menu / explicit quit.
- Domain B: Runtime Export startup-state / auto restore.
- Domain C: Stage capture controls.

No Runtime Player source fix was required by Domain D.

## Changed Files

Wave8 final integration docs/maps:

- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/screens/_map.md`
- `discussion/runtime-player/research/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave8/_map.md`
- `discussion/runtime-player/implementation/reviews/wave8/_map.md`
- `discussion/runtime-player/implementation/waves/wave8/runtime-player-wave8-final-integration-report.md`

Source files were inspected but not edited by Domain D.

## Required Check Evidence

| Check | Evidence |
|---|---|
| Click-through cannot trap the user without recovery | Domain A implements Control close-hide plus tray/application menu recovery. Domain C wires real click-through state to the Domain A `Disable Click-through` hook in `runtime-player-main.ts`, exposes Control toggle in `stage-page.tsx`, and starts main capture state with `clickThroughEnabled: false` in `stage-view-bridge-handlers.ts`. |
| Click-through starts Off on startup | `stage-view-bridge-handlers.ts` initializes click-through false and explicitly applies `setIgnoreMouseEvents(false)` during bridge registration. click-through is not in Window State. |
| Runtime Export auto restore does not auto-connect Input Source | Control startup calls `runtimeExport.restoreLastDirectory({ reason: "startup" })`; input connection remains behind explicit Control actions. `runtime-player-main.ts` registers input handlers but does not call `inputBridge.connect()` on startup/restore. |
| Stage remains model-only in normal mode | `stage-window-app.tsx` renders the arrange overlay only when arrange mode is enabled; normal mode renders the canvas model surface only. Boundary tests protect Stage production files from setup/debug/raw tracking APIs. |
| Capture Target checklist does not claim OBS integration/readiness | `stage-page.tsx` labels the panel `Capture Target` and lists local Runtime Player readiness only. Docs now explicitly say this is not `OBS Ready` and not OBS verification. |
| Spout and OBS automation remain out of scope | Source search over `apps/runtime-player/src` for OBS/Spout/automation terms returned no matches. Docs/backlog mark Spout sender, obs-websocket, automatic OBS source creation, and OBS capture verification automation as out of scope/future. |
| Shared `runtime-player-main.ts` contracts are coherent | Main now constructs Startup State separately from Window State, registers Runtime Export handlers with startup-state integration, creates the quit controller before exposing tray/menu Quit, wires tray/menu recovery to Stage capture state, and preserves input/model-mapping/window-state flush owners. |
| Preload and Stage bridge contracts are coherent | Control preload owns Runtime Export restore and Stage capture actions. Stage preload remains narrow, with arrange-state read/subscription and runtime payload/live frame surfaces, not raw tracking/debug/control APIs. |
| Window State and Startup State stores are coherent | Startup State stores only last Runtime Export path at `<electron userData>/startup-state/runtime-player-startup.json`. Window State stores stage/control bounds, stage view, and `stageEnvironment.alwaysOnTop` at `<electron userData>/window-state/runtime-player.json`. click-through is transient. |
| Docs/maps match implementation facts | Required screen/research/backlog/map files were updated from Draft/Planned/Future wording to Wave8 implemented facts, with pending manual verification kept separate. |

## Verification Performed

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Result: passed.
- `pnpm.cmd --dir apps/runtime-player run test:unit`
  - Sandboxed run failed while loading Vitest/Vite config with known Windows `spawn EPERM`.
  - Escalated rerun passed: 45 test files / 191 tests.
- `node scripts/check-source-organization.mjs`
  - Result: passed.
- `rg -n "OBS|obs-websocket|Spout|spout|Stage Motion|near/far|auto-connect|auto connect|automatic OBS" apps/runtime-player/src`
  - Result: no matches.
- `git diff --check -- discussion/runtime-player apps/runtime-player`
  - Result: passed; Git reported LF-to-CRLF working-copy warnings only.

`pnpm install` was not run.

## Manual Verification Still Pending

These checks are not claimed as done:

- Control close hides/reopens from tray/menu.
- Explicit Quit flushes and exits.
- Runtime Export valid/invalid startup restore.
- Stage Arrange drag handle moves the native Stage Window.
- Click-through toggle and tray recovery.
- Always-on-top toggle and persistence.
- Capture Target checklist and Copy Window Title.
- OBS Window Capture title/alpha smoke check.

## Residual Risks

- Electron-native tray/menu, native drag, click-through, always-on-top, and restart behavior still need a real app session.
- OBS Window Capture alpha/title behavior is environment-sensitive and still needs manual smoke verification.
- `stage-view-bridge-handlers.ts` remains cohesive enough for Wave8, but future broadcast/native Stage controls should consider splitting capture-specific state/actions into a named main-side controller.

## User Decision Points

None for Wave8 final integration.
