# Runtime Player Wave9 Domain B Report: Browser Source Stage Client / Render Pipeline

## Verdict

Done / pass after fix loop 1.

Domain B is complete enough for Domain C to start.

## Scope Implemented

- Added a Browser Source-only Stage client under `apps/runtime-player/src/stage/browser-source/`.
- Added a Browser Source renderer entry to the Runtime Player Vite renderer build.
- Added Browser Source Stage CSS for a transparent, model-only canvas surface.
- Reused the existing Stage renderer path for Runtime Export rendering and live sanitized parameter frames.
- Added small Browser Source server support for attaching the built Browser Source client assets to `/stage`.

## Behavior

- `/stage?token=...` remains the Browser Source shell entrypoint.
- The Browser Source Stage page is model-only by default:
  - canvas-only rendered surface.
  - no setup controls.
  - no diagnostics UI in normal mode.
- Page and canvas background are transparent.
- The page attempts WebGL2 setup and reports:
  - `webgl2Available`.
  - Runtime Export loaded flag.
  - render status.
  - message.
  - FPS / frame age when available.
- The client fetches the current Runtime Export payload from Domain A's `/runtime-export/payload?token=...` route.
- The client decodes base64 texture bytes into the existing Runtime Export loaded payload shape.
- The client connects to `ws://127.0.0.1:<port>/ws?token=...`.
- On connect/reconnect, the client sends heartbeat, renderer diagnostics, and a resync request.
- The client applies:
  - `runtime-export-resync`.
  - `runtime-export-changed`.
  - `live-parameter-frame`.
  - `live-parameter-cleared`.
- The client does not depend on Electron preload APIs, IPC, `window.runtimePlayerStage`, or `window.runtimePlayer`.
- Raw tracking/debug data is not accepted as a meaningful client input path.

## Design Decision

Generated Browser Source static JS/CSS assets under `/browser-source-assets/*` are intentionally served without the token.

Reason:

- Vite production code splitting causes browser-requested split chunks to be loaded without `?token=...`.
- The static JS/CSS files are generated app code, not Runtime Export/model data.
- Keeping static JS/CSS behind the same query-token gate breaks production Browser Source loading.

Boundary retained:

- `/stage`, `/runtime-export/status`, `/runtime-export/payload`, and `/ws` remain token-gated.
- Runtime Export payload/assets and live parameter frames remain behind the token-gated routes/WS.
- Static asset serving is constrained to generated renderer `assets` `.js` / `.css` files by safe filename filtering and resolved-path containment.

## Changed Files

Browser Source Stage client:

- `apps/runtime-player/src/stage/browser-source/index.html`
- `apps/runtime-player/src/stage/browser-source/browser-source-page-config.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-render-metrics.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-runtime-export-adapter.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-app.tsx`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-entry.tsx`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-renderer.ts`

Tests:

- `apps/runtime-player/src/stage/browser-source/browser-source-runtime-export-adapter.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-server-message.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-app.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-entry-boundary.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-stage-client-assets.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-stage-shell.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`

Build/static support:

- `apps/runtime-player/electron.vite.config.ts`
- `apps/runtime-player/src/styles/global.css`
- `apps/runtime-player/src/main/broadcast-source/browser-source-stage-client-assets.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-stage-shell.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`

## Review / Fix Loop

Loop 1 review result:

- Design / Development Compliance Review: `needs_changes`
  - Blocking: production Browser Source assets failed after Vite code splitting because split chunks were requested without token.
- Test Adequacy Review: `needs_changes`
  - High: received `runtime-export-resync` application was not directly tested.
  - Medium: static asset HTTP behavior was not tested through the server.

Fixes applied:

- Moved `/browser-source-assets/*` handling before the token gate.
- Kept static asset serving constrained to `.js` / `.css` files under renderer `assets`.
- Added server-level static asset tests for tokenless JS/CSS and split chunk-style JS.
- Added regression checks that `/stage`, `/runtime-export/status`, and `/runtime-export/payload` remain `401` without token.
- Added disallowed static asset/path traversal checks.
- Added client tests for applying `runtime-export-resync` payload plus latest frame.
- Added client test coverage for `live-parameter-cleared`.

Final review result:

- Design / Development Compliance Review: `pass`.
- Test Adequacy Review: `pass`.

## Verification

From `apps/runtime-player`:

- `pnpm.cmd typecheck`
  - Result: pass.
- Focused Vitest after fix:
  - `pnpm.cmd exec vitest run -c vitest.config.ts src/stage/browser-source/browser-source-stage-client.test.ts src/stage/browser-source/browser-source-server-message.test.ts src/main/broadcast-source/browser-source-stage-client-assets.test.ts src/main/broadcast-source/browser-source-server.test.ts`
  - Result: pass, 4 files / 19 tests.
- `pnpm.cmd build`
  - Result: pass.
  - Confirmed Browser Source renderer entry and split chunks are emitted.
- `pnpm.cmd test:unit`
  - Result: pass, 57 files / 219 tests.

From repository root:

- `pnpm.cmd run check:source`
  - Result: pass.
- `git diff --check -- apps/runtime-player/src apps/runtime-player/electron.vite.config.ts`
  - Result: pass; Git reported only existing LF-to-CRLF working-copy warnings.

## Subagents

- Gnome: `019ef2ff-6c98-71a0-bc04-fcaf0fe7938c`
  - Implemented Domain B.
  - Applied fix loop 1.
- Review-Sylph Design / Development Compliance: `019ef313-169e-7333-8753-68c792048d95`
  - Final verdict: pass.
- Review-Sylph Test Adequacy: `019ef313-74db-7663-aace-9f2544f55d8b`
  - Final verdict: pass.

## Remaining Risks

- Manual OBS Browser Source verification was not run.
- OBS CEF/WebGL2 behavior, alpha preservation, performance, and visibility/reload lifecycle remain manual probe items.
- Tokenless static JS/CSS is intentionally exposed on loopback; safety depends on preserving the `.js` / `.css` allowlist, safe filename filtering, resolved-path containment, and token-gating for all model data routes.

## Domain C Start Guidance

Domain C can safely start.

Control UX should consume the existing Domain A status contract and Domain B renderer diagnostics:

- `state`
- `statusLabel`
- `bindAddress`
- `port`
- `browserSourceUrl`
- `connectedClientCount`
- `runtimeExport`
- `latestFrame`
- client connect/disconnect/heartbeat timestamps
- server heartbeat timestamp
- `latestRendererDiagnostics.webgl2Available`
- `latestRendererDiagnostics.runtimeExportLoaded`
- `latestRendererDiagnostics.renderStatus`
- `latestRendererDiagnostics.message`
- `latestRendererDiagnostics.fps`
- `latestRendererDiagnostics.frameAgeMs`
- `errorMessage`

Domain C should not claim OBS is actually capturing or streaming.
