# Runtime Player Wave7 Domain B Spec Compliance Review

> Target: `runtime-player-wave7-stage-window-state-auto-save`  
> Reviewer lane: Spec Compliance Review  
> 判定: `pass`

## Scope Reviewed

Basis documents:

- `discussion/runtime-player/implementation/orchestration/player-wave7-plan.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`

Reviewed Domain B source/diff areas:

- Control UI: `apps/runtime-player/src/control/control-window-app.tsx`, `apps/runtime-player/src/control/control-window-shell.tsx`, `apps/runtime-player/src/control/stage-page.tsx`
- Main process bridge/window state: `apps/runtime-player/src/main/runtime-player-main.ts`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`, `apps/runtime-player/src/main/window-management/*`, `apps/runtime-player/src/main/window-state/*`
- Preload contracts/channels: `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`, `apps/runtime-player/src/preload/runtime-player-bridge.ts`, `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`, `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`, `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- Stage renderer/app: `apps/runtime-player/src/stage/stage-window-app.tsx`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`, `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts`, `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts`
- Focused tests: `browser-window-options.test.ts`, `window-state-store.test.ts`, `stage-view-bridge-channels.test.ts`, `stage-view-transform.test.ts`

## Findings Ordered By Severity

No blocking or needs-change spec compliance findings.

Evidence:

- Stage nav is present and routes to a real Stage page (`apps/runtime-player/src/control/control-window-shell.tsx:6`, `apps/runtime-player/src/control/control-window-shell.tsx:15`, `apps/runtime-player/src/control/control-window-app.tsx:553`).
- Stage page exposes window status/bounds, view zoom/pan, Focus Stage, Reset View, Center Model, and auto-save status (`apps/runtime-player/src/control/stage-page.tsx:34`, `apps/runtime-player/src/control/stage-page.tsx:39`, `apps/runtime-player/src/control/stage-page.tsx:55`, `apps/runtime-player/src/control/stage-page.tsx:72`, `apps/runtime-player/src/control/stage-page.tsx:89`).
- Focus Stage is a real main-process window action, including minimized-window restore, `show()`, and `focus()` (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:63`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:140`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:154`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:158`).
- Window state is loaded before windows are created, and restored bounds are passed into `BrowserWindow` options before show (`apps/runtime-player/src/main/runtime-player-main.ts:23`, `apps/runtime-player/src/main/runtime-player-main.ts:31`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:31`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:37`, `apps/runtime-player/src/main/window-management/browser-window-options.ts:43`).
- Stage/control bounds are tracked on move/resize and saved through a debounced controller; Control bounds are persisted but not surfaced as primary UX (`apps/runtime-player/src/main/window-management/runtime-player-windows.ts:58`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:101`, `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:105`, `apps/runtime-player/src/main/window-state/window-state-controller.ts:74`, `apps/runtime-player/src/main/window-state/window-state-controller.ts:119`).
- Window state storage uses the required `window-state/runtime-player.json` path and separate schema (`apps/runtime-player/src/main/window-state/window-state-store.ts:42`, `apps/runtime-player/src/main/window-state/window-state-document.ts:7`).
- Stage view transform is serialized with `stage-viewport-px-v1`, reported after wheel zoom and drag pan, and saved through main-owned window state (`apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts:40`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:289`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:323`, `apps/runtime-player/src/stage/stage-window-app.tsx:232`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:56`).
- Reset View and Center Model update persisted state and send the resulting transform to Stage (`apps/runtime-player/src/main/stage-view-bridge-handlers.ts:66`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:81`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:87`).
- Center Model preserves zoom and clears pan; renderer composition makes pan `0,0` the model-centered view for the current zoom (`apps/runtime-player/src/main/window-state/window-state-document.ts:50`, `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts:74`, `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts:21`, `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts:31`).
- Stage transform restores on Stage init through `getViewTransform`; `setPayload()` no longer resets the transform, so restored pan/zoom survives model payload load (`apps/runtime-player/src/stage/stage-window-app.tsx:51`, `apps/runtime-player/src/stage/stage-window-app.tsx:240`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:109`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:156`).
- Stage remains model-only: the Stage React tree renders only the shell and canvas, with no debug/control UI (`apps/runtime-player/src/stage/stage-window-app.tsx:161`, `apps/runtime-player/src/stage/stage-window-app.tsx:167`, `apps/runtime-player/src/styles/global.css:35`, `apps/runtime-player/src/styles/global.css:43`).
- Stage receives runtime export payloads and sanitized live parameter frames; the cross-window live frame contract contains `parameterValues`, not raw tracking frames (`apps/runtime-player/src/preload/live-parameter-bridge-contract.ts:1`, `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts:22`, `apps/runtime-player/src/stage/stage-window-app.tsx:134`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:126`).

## Spec Compliance Checklist

- Stage nav item and real Stage page: compliant.
- Focus Stage is a real main-process window focus action: compliant.
- Stage window bounds persist after move/resize with debounce: compliant.
- Control bounds may persist but are not primary UX: compliant.
- Stage view transform persists after wheel pan/zoom, drag pan, Reset View, and Center Model: compliant.
- Stage bounds restore on startup: compliant.
- Stage transform restores on Stage init or after model payload load: compliant via Stage init restore, with payload load preserving transform.
- Center Model preserves current zoom and recenters pan: compliant.
- Stage page controls are compact and operational: compliant.
- Out-of-scope items not added: compliant. No OBS/Broadcast setup, click-through, always-on-top, Stage Motion, near/far response, Stage debug UI, or raw tracking frame path into Stage was found in reviewed Domain B paths.

## Residual Risks / Manual Verification Gaps

- Manual Electron verification was not run in this review lane. The remaining product confidence gap is to move/resize Stage, pan/zoom, restart, and confirm both bounds and view restore visually.
- Gnome-reported verification was source-checked for consistency but not rerun here: targeted runtime-player Vitest, typecheck, boundary test, and `git diff --check`.
- Legacy placeholder bridge actions for old Wave1 `focus-stage` / `reset-stage-position` still exist, but the current Control UI calls the real Stage View IPC path. This is not a Domain B spec blocker.

## Recommendation For Orch-Sylph

Proceed with Domain B as spec-compliant. Keep manual Electron restart verification as a closeout item before Wave7 final acceptance.
