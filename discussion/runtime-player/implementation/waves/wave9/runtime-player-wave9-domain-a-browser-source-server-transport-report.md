# Runtime Player Wave9 Domain A Report: Browser Source Server / Transport

## Verdict

Done / pass.

## Review/Fix Loop 1

Status: done.

Fixes applied:

- Minimized `browser-source-server-hello`; Browser Source clients no longer receive full `RuntimePlayerBrowserSourceStatus`. Full status remains Control IPC only.
- Added a conservative 4096-byte maximum for Browser Source client WebSocket message payloads. Oversized/incomplete-overflow input closes the connection.
- Strengthened WebSocket tests so Browser Source messages are asserted not to contain Control-only status fields, renderer diagnostics, raw tracking/debug names, or private path fields.
- Added connected-client broadcast coverage for `runtime-export-changed`, `live-parameter-frame`, and `live-parameter-cleared`.
- Added raw WebSocket upgrade rejection coverage for missing token, empty token, and invalid token.
- Strengthened Runtime Export payload/status assertions to exact whitelisted shapes.

## Implementation Summary

- Added a main-process Browser Source server that binds only to `127.0.0.1`, starts on an ephemeral local port, and produces a tokenized Browser Source URL:
  - `http://127.0.0.1:<port>/stage?token=<token>`
- Added token-gated HTTP routes:
  - `GET /stage?token=...` serves a transparent Browser Source Stage shell and Domain B attach config.
  - `GET /runtime-export/status?token=...` returns sanitized Runtime Export status.
  - `GET /runtime-export/payload?token=...` returns the current Runtime Export payload with texture bytes encoded as base64 JSON.
- Added token-gated WebSocket route:
  - `GET /ws?token=...` upgrades to the Browser Source transport.
- Added WebSocket session behavior:
  - sends `browser-source-server-hello` and `runtime-export-resync` on connect.
  - supports `browser-source-resync-request`.
  - broadcasts `runtime-export-changed`, `live-parameter-frame`, `live-parameter-cleared`, and server heartbeat messages.
  - tracks connected client count, last client heartbeat, last server heartbeat, and latest sanitized renderer diagnostics.
- Wired Runtime Player main so Browser Source receives only existing sanitized `RuntimePlayerLiveParameterFrame` values and Runtime Export payloads.
- Added a narrow Control bridge:
  - `window.runtimePlayer.browserSource.getStatus()`
  - `window.runtimePlayer.browserSource.onStatusChanged(callback)`

## Changed Files

Main server / transport:

- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-websocket-connection.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-websocket-frame.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-client-message.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-token.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-url.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-runtime-export-payload.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-stage-shell.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`

Preload / Control bridge contract:

- `apps/runtime-player/src/preload/browser-source-bridge-channels.ts`
- `apps/runtime-player/src/preload/browser-source-status-contract.ts`
- `apps/runtime-player/src/preload/browser-source-transport-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`

Tests:

- `apps/runtime-player/src/main/broadcast-source/browser-source-token.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-url.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.test.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-bridge-handlers.test.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts`

Reports:

- `discussion/runtime-player/implementation/waves/wave9/_map.md`
- `discussion/runtime-player/implementation/waves/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-report.md`

## Domain B Contract Summary

HTTP routes:

- `GET /stage?token=<token>`
  - Returns a transparent HTML shell with `#runtime-player-browser-source-root`.
  - Defines `window.__RUNTIME_PLAYER_BROWSER_SOURCE__` with:
    - `protocolVersion`
    - `webSocketPath`
    - `runtimeExportStatusPath`
    - `runtimeExportPayloadPath`
- `GET /runtime-export/status?token=<token>`
  - Returns sanitized Runtime Export status only.
  - Does not include local directory paths or loader error details.
- `GET /runtime-export/payload?token=<token>`
  - Returns `{ status: "loaded", runtimeExportStatus, runtimeExport }` when loaded.
  - Returns `{ status: "not-loaded", runtimeExportStatus, runtimeExport: null }` otherwise.
  - `runtimeExport.texturePage.bytesBase64` carries the raw RGBA texture bytes for browser decoding.
- Unknown valid-token routes return `404`.
- Missing/invalid token returns `401`.

WebSocket route:

- `ws://127.0.0.1:<port>/ws?token=<token>`
- Missing/invalid token is rejected during upgrade.

Server-to-client messages:

- `browser-source-server-hello` with only protocol version and timestamp.
- `runtime-export-resync`
- `runtime-export-changed`
- `live-parameter-frame`
- `live-parameter-cleared`
- `browser-source-server-heartbeat`
- `browser-source-error`

Client-to-server messages:

- `browser-source-resync-request`
- `browser-source-client-heartbeat`
- `browser-source-renderer-diagnostics`

Control bridge:

- `window.runtimePlayer.browserSource.getStatus()`
- `window.runtimePlayer.browserSource.onStatusChanged(callback)`

Status fields for Domain C:

- server state, bind address, port, Browser Source URL.
- connected client count.
- sanitized Runtime Export summary.
- latest live parameter frame sequence/timestamp.
- last client connect/disconnect/heartbeat.
- last server heartbeat.
- latest renderer diagnostics: WebGL2 status, render status, Runtime Export loaded flag, FPS/frame age.

## Verification

- From `apps/runtime-player`: `pnpm.cmd exec vitest run -c vitest.config.ts src/main/broadcast-source/browser-source-server.test.ts src/main/broadcast-source/browser-source-token.test.ts src/main/broadcast-source/browser-source-url.test.ts src/main/broadcast-source/browser-source-bridge-handlers.test.ts src/preload/runtime-player-bridge.browser-source.test.ts`
  - Result: pass, 5 files / 13 tests.
  - Note: sandboxed run first failed with Vitest/esbuild `spawn EPERM`; elevated rerun passed.
- From `apps/runtime-player`: `pnpm.cmd typecheck`
  - Result: pass.
- From `apps/runtime-player`: `pnpm.cmd test:unit`
  - Result: pass, 50 files / 204 tests.
  - Note: elevated because Vitest/esbuild spawn is blocked in sandbox.
- From repository root: `pnpm.cmd run check:source`
  - Result: pass.
- From repository root: `git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave9`
  - Result: no whitespace errors. Git reported existing LF-to-CRLF working-copy warnings for touched existing files.

## Residual Risks

- Domain B still needs the actual Browser Source Stage render client. Domain A serves only the transparent shell and transport contract.
- Manual OBS verification was not run in this domain.
- Runtime Export resync currently can carry base64 texture bytes over WebSocket as well as HTTP. This is acceptable for the v0 probe but may need optimization if large exports make reconnect heavy.
- Token regeneration/restart controls are not implemented here; Domain C can decide the user-facing control surface.
