# Runtime Player Wave8 Domain C Spec Compliance Review

## Verdict

pass

No spec-compliance findings were found for Domain C. The implementation satisfies the Wave8 Stage capture controls scope: Stage Arrange mode, temporary arrange overlay, click-through control and recovery, always-on-top control, Capture Target checklist, stable Stage title copy action, and scoped boundaries.

## Basis Used

- `discussion/runtime-player/implementation/orchestration/player-wave8-plan.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/implementation/waves/wave8/runtime-player-wave8-domain-a-control-recovery-tray-explicit-quit-report.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

## Findings

No findings.

## Spec Compliance Evidence

### Stage Arrange Mode

- Control exposes the Arrange Stage toggle from the Stage page: `apps/runtime-player/src/control/stage-page.tsx:84`.
- Control wires the toggle to the stage-view bridge: `apps/runtime-player/src/control/control-window-app.tsx:629`.
- Main registers the IPC handler for arrange mode: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:104`.
- Stage receives arrange state updates and disables normal view interaction while arrange mode is enabled: `apps/runtime-player/src/stage/stage-window-app.tsx:58`.
- The temporary arrange overlay is rendered only through `StageArrangeOverlay`: `apps/runtime-player/src/stage/stage-window-app.tsx:195`.
- `StageArrangeOverlay` returns `null` when disabled: `apps/runtime-player/src/stage/stage-window-app.tsx:200`.
- The CSS confines native drag to the small handle rather than making the whole Stage always draggable: `apps/runtime-player/src/styles/global.css:65`.

### Normal Stage Mode And Pan/Zoom Isolation

- The normal Stage render path remains canvas plus optional arrange overlay only: `apps/runtime-player/src/stage/stage-window-app.tsx:184`.
- The overlay renders nothing in normal mode: `apps/runtime-player/src/stage/stage-window-app.tsx:205`.
- Arrange mode disables renderer view interaction: `apps/runtime-player/src/stage/stage-window-app.tsx:63`.
- Renderer pan/zoom handlers are guarded by `shouldHandleStageViewInteraction`: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:299`.
- The interaction guard requires `viewInteractionEnabled` and active rendered input: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:394`.
- Disabling interaction cancels an active pan pointer: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:170`.

### Click-Through

- Control exposes Enable/Disable Click-through in the Capture Target panel: `apps/runtime-player/src/control/stage-page.tsx:165`.
- Control wires click-through to the stage-view bridge: `apps/runtime-player/src/control/control-window-app.tsx:634`.
- Main starts the in-memory click-through state as `false`: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:39`.
- Main explicitly applies `setIgnoreMouseEvents(false)` during bridge registration, so click-through starts off even if a prior session used it: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:68`.
- Click-through is not part of the window-state document; only always-on-top is persisted under `stageEnvironment`: `apps/runtime-player/src/main/window-state/window-state-document.ts:26`.
- Enabling click-through disables arrange mode and hides setup UI: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:349`.
- Enabling arrange mode disables click-through first: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:304`.
- The actual native click-through operation is `BrowserWindow.setIgnoreMouseEvents(enabled)`: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:413`.

### Tray/Menu Recovery

- Domain C wires Domain A's tray/menu hook to the real click-through state: `apps/runtime-player/src/main/runtime-player-main.ts:146`.
- The recovery enabled state reads `stageViewBridge.getCaptureState().clickThroughEnabled`: `apps/runtime-player/src/main/runtime-player-main.ts:156`.
- Capture state changes refresh the tray/application menu: `apps/runtime-player/src/main/runtime-player-main.ts:54`.
- The tray/application menu exposes Disable Click-through only when the hook reports click-through active: `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts:91`.
- The bridge recovery method disables click-through and returns whether it changed anything: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:171`.

### Always-On-Top

- Stage BrowserWindow default is `alwaysOnTop: false`: `apps/runtime-player/src/main/window-management/browser-window-options.ts:59`.
- The initial window-state document defaults `stageEnvironment.alwaysOnTop` to false: `apps/runtime-player/src/main/window-state/window-state-document.ts:66`.
- Invalid persisted always-on-top values normalize back to false with a warning: `apps/runtime-player/src/main/window-state/window-state-document.ts:187`.
- Stage creation applies the persisted safe environment value when present: `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:37`.
- The Control toggle calls `stageView.setAlwaysOnTop`: `apps/runtime-player/src/control/control-window-app.tsx:639`.
- Main applies `BrowserWindow.setAlwaysOnTop(enabled)` and persists the setting: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:373`.
- The controller persists always-on-top as environment/window state: `apps/runtime-player/src/main/window-state/window-state-controller.ts:115`.

### Capture Target Checklist And Window Title

- Stage page includes a local `Capture Target` panel: `apps/runtime-player/src/control/stage-page.tsx:134`.
- Checklist rows are local Runtime Player readiness only: Stage Window, Runtime Export, Model, Background, Stage UI, Window Title, Click-through, and Always on top: `apps/runtime-player/src/control/stage-page.tsx:135`.
- The UI labels the panel `Capture Target`, not `OBS Ready`: `apps/runtime-player/src/control/stage-page.tsx:134`.
- Copy Window Title is exposed in Control: `apps/runtime-player/src/control/stage-page.tsx:191`.
- Main copies the stable title constant to the clipboard: `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:401`.
- The stable title constant is `Runtime Player Stage`: `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:10`.
- The native Stage window uses that title: `apps/runtime-player/src/main/window-management/browser-window-options.ts:54`.

### Domain B Preservation

- The Stage page still includes the Runtime Export startup/restore panel and Retry/Open New behavior: `apps/runtime-player/src/control/stage-page.tsx:221`.
- Overview still exposes Runtime Export error and Retry Restore behavior: `apps/runtime-player/src/control/overview-page.tsx:111`.
- Domain C did not add input auto-connect; runtime export startup restore remains separate from input source connection.

### Boundary And Non-Goals

- Stage preload remains narrow and does not expose click-through, always-on-top, input profile, mapping, raw tracking, diagnostics, or Control APIs: `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:22`.
- The Control preload owns the capture actions: `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:138`.
- Existing boundary tests assert Stage production files do not contain setup/debug controls or raw tracking input: `apps/runtime-player/src/runtime-player-boundary.test.ts:26`.
- Repository search over `apps/runtime-player/src` found no `OBS`, `obs-websocket`, `Spout`, `spout`, `Stage Motion`, `near/far`, `auto-connect`, or `automatic OBS` source matches.

## Verification Performed

- Read the seven required basis documents listed above.
- Inspected the requested Domain C implementation files and adjacent tests.
- Ran focused Runtime Player tests:
  - `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run -c vitest.config.ts src/main/stage-view-bridge-handlers.test.ts src/preload/stage-view-bridge-channels.test.ts src/preload/runtime-player-bridge.stage-view.test.ts src/preload/runtime-player-stage-bridge.test.ts src/main/window-state/window-state-controller.test.ts src/main/window-state/window-state-store.test.ts src/main/window-management/browser-window-options.test.ts src/stage/stage-window-app.test.ts src/stage/stage-renderer/static-stage-canvas-renderer.interaction.test.ts src/runtime-player-boundary.test.ts`
  - Result: pass, 10 test files, 41 tests.
- Ran Runtime Player typecheck:
  - `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
  - Result: pass.
- Ran out-of-scope source search:
  - `rg -n "OBS|obs-websocket|Spout|spout|Stage Motion|near/far|auto-connect|auto connect|automatic OBS" apps/runtime-player/src`
  - Result: no matches.
- Ran whitespace/diff sanity on reviewed Domain C files:
  - `git diff --check -- ...Domain C files...`
  - Result: pass, with Git LF-to-CRLF working-copy warnings only.

## Remaining Risks And Manual Checks

- Manual Electron verification was not run in this review lane.
- Verify on Windows that the Stage arrange handle actually moves the frameless native Stage window.
- Verify manually that enabling click-through prevents Stage mouse input, and tray/application menu Disable Click-through restores control.
- Verify manually that the tray/application menu enabled state refreshes after toggling click-through from Control and from the recovery menu.
- Verify manually that always-on-top behaves as expected across app restart if persisted on.
- Optional OBS-adjacent manual check remains useful: Window Capture can select `Runtime Player Stage`, transparent background behaves as expected, and no arrange overlay is visible after arrange mode is disabled. This is not an automated Wave8 acceptance gate.

## User Decision Points

None.
