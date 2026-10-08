# Runtime Player Wave1 Domain A Spec Compliance Review

- Target: `runtime-player-wave1-electron-shell-placeholder-ui`
- Review lane: Spec Compliance Review
- Verdict: pass

## Scope Reviewed

- `apps/runtime-player/package.json`
- `apps/runtime-player/.gitignore`
- `apps/runtime-player/electron.vite.config.ts`
- `apps/runtime-player/tsconfig.json`
- `apps/runtime-player/vitest.config.ts`
- `apps/runtime-player/src/**`

Excluded from implementation review: generated output, `node_modules`, and unrelated dirty discussion files.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave1-plan.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`

## Findings

No spec compliance findings.

The implementation satisfies the Wave1 placeholder-only intent, preserves the two-window model, and does not introduce Runtime Export loading, input networking, runtime mapping, WebGL model rendering, persistence, or Editor authoring UI.

## Evidence

- Dev/manual run command exists: `pnpm --filter @private-2d-rigging-lab/runtime-player dev`; package script is defined in `apps/runtime-player/package.json:8`, and `electron-vite dev --help` confirms `--watch` is a valid option.
- Control Window title and isolated window options are present in `apps/runtime-player/src/main/window-management/browser-window-options.ts:22`, with renderer isolation at `apps/runtime-player/src/main/window-management/browser-window-options.ts:27` and `apps/runtime-player/src/main/window-management/browser-window-options.ts:28`.
- Stage Window is created as a separate `BrowserWindow` in `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:24`, loaded through the separate `stage` renderer entry at `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:45`, and shown separately at `apps/runtime-player/src/main/window-management/runtime-player-windows.ts:30`.
- Stage Window is capture-oriented: `frame: false`, `transparent: true`, and transparent background are set in `apps/runtime-player/src/main/window-management/browser-window-options.ts:41`, `apps/runtime-player/src/main/window-management/browser-window-options.ts:42`, and `apps/runtime-player/src/main/window-management/browser-window-options.ts:44`.
- Control Window includes the required visible UI affordances: `Runtime Player` title at `apps/runtime-player/src/control/control-window-app.tsx:75`, `Settings` at `apps/runtime-player/src/control/control-window-app.tsx:86`, `Open Runtime Export` at `apps/runtime-player/src/control/control-window-app.tsx:96` and `apps/runtime-player/src/control/control-window-app.tsx:108`, `.runtime-export` helper/status text at `apps/runtime-player/src/control/control-window-app.tsx:102` and `apps/runtime-player/src/control/control-window-app.tsx:119`, Runtime Export status at `apps/runtime-player/src/control/control-window-app.tsx:125`, Input Source at `apps/runtime-player/src/control/control-window-app.tsx:131`, Connect/Disconnect at `apps/runtime-player/src/control/control-window-app.tsx:138` and `apps/runtime-player/src/control/control-window-app.tsx:144`, Look Forward at `apps/runtime-player/src/control/control-window-app.tsx:161`, Stage controls at `apps/runtime-player/src/control/control-window-app.tsx:175` and `apps/runtime-player/src/control/control-window-app.tsx:181`, and Debug affordance at `apps/runtime-player/src/control/control-window-app.tsx:194` and `apps/runtime-player/src/control/control-window-app.tsx:202`.
- Stage renderer contains only a transparent capture placeholder and model silhouette/label in `apps/runtime-player/src/stage/stage-window-app.tsx:6`, `apps/runtime-player/src/stage/stage-window-app.tsx:10`, and `apps/runtime-player/src/stage/stage-window-app.tsx:15`.
- Preload exposes a narrow typed API and does not expose raw Electron objects to React UI: `apps/runtime-player/src/preload/runtime-player-bridge.ts` wraps `ipcRenderer.invoke` behind `window.runtimePlayer`.

## Checks Performed

- Read the basis documents listed above.
- Inspected `git status --short -uall apps/runtime-player discussion/runtime-player/implementation/reviews/wave1`.
- Read package/config/source files in the requested scope.
- Searched production source for forbidden scope indicators: real Runtime Export picker/load, file reads, UDP/TCP/VMC/OSC/socket work, WebGL/canvas/runtime loop, persistence, Editor references, authoring concepts, parameter sliders, and Stage setup/debug controls. No production-source violations found.
- `git diff --check -- apps/runtime-player`: passed; only a CRLF conversion warning for `apps/runtime-player/package.json`.
- `pnpm --filter @private-2d-rigging-lab/runtime-player typecheck`: passed.
- `pnpm --filter @private-2d-rigging-lab/runtime-player test:unit`: passed outside sandbox after sandboxed Vitest startup hit `spawn EPERM`; 3 test files / 10 tests passed.
- `pnpm --filter @private-2d-rigging-lab/runtime-player exec electron-vite dev --help`: passed and confirmed the dev script option shape.

## Residual Risks

- Electron GUI launch and visual inspection were not run in this review lane; this review verifies source/config and non-GUI checks only.
- Transparent-window behavior may vary by platform/GPU/desktop compositor and still needs manual confirmation during integration.
- The Stage Window currently opens immediately as a transparent placeholder. This is allowed by the Wave1 plan, while the initial screen spec leaves "open immediately vs after load" as an open question.

## User-Decision Points

None blocking for Domain A.

Future waves still need decisions on Stage Window position/size/always-on-top/click-through behavior and when to implement previous Runtime Export restore, but those are outside the placeholder-only Wave1 scope.
