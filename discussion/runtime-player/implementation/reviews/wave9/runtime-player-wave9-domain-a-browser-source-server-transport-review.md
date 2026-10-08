# Runtime Player Wave9 Domain A Review: Browser Source Server / Transport

## Verdict

`pass after fix loop 1`

## Basis

- `discussion/runtime-player/implementation/orchestration/player-wave9-plan.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Scope Reviewed

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/broadcast-source/**`
- `apps/runtime-player/src/preload/browser-source-*.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.browser-source.test.ts`
- `discussion/runtime-player/implementation/waves/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-report.md`

## Review Lanes

### Design / Development Compliance

Initial verdict: `needs_changes`.

Findings:

- Blocking: `browser-source-server-hello` exposed full `RuntimePlayerBrowserSourceStatus` to Browser Source clients, including Control-only fields such as `browserSourceUrl`, client counts, heartbeat fields, and renderer diagnostics.
- Medium: WebSocket client input was unbounded.

Fix status:

- Resolved. `browser-source-server-hello` now carries only protocol version and timestamp. Full Browser Source status remains Control IPC only.
- Resolved. Browser Source client WebSocket message payloads are limited to 4096 bytes; oversized input closes the connection.

### Test Adequacy

Initial verdict: `needs_changes`.

Findings:

- High: connected-client live broadcast behavior was not directly covered after connection.
- Medium: WebSocket missing-token rejection was named but not exercised.
- Medium: Runtime Export no-private-path/status assertions were weaker than the contract boundary.

Fix status:

- Resolved. Tests now cover connected-client `runtime-export-changed`, `live-parameter-frame`, and `live-parameter-cleared` broadcasts.
- Resolved. Tests now cover raw `/ws`, `/ws?token=`, and invalid-token upgrade rejection.
- Resolved. Runtime Export status/payload tests now assert exact whitelisted response shapes and absence of Control/raw/debug/private fields in Browser Source messages.

## Verification

- From `apps/runtime-player`: `pnpm.cmd typecheck`
  - Result: pass.
- From `apps/runtime-player`: `pnpm.cmd exec vitest run -c vitest.config.ts src/main/broadcast-source/browser-source-server.test.ts src/main/broadcast-source/browser-source-token.test.ts src/main/broadcast-source/browser-source-url.test.ts src/main/broadcast-source/browser-source-bridge-handlers.test.ts src/preload/runtime-player-bridge.browser-source.test.ts`
  - Result: pass, 5 files / 13 tests.
- From `apps/runtime-player`: `pnpm.cmd test:unit`
  - Result: pass, 50 files / 204 tests.
- From repository root: `pnpm.cmd run check:source`
  - Result: pass.
- From repository root: `git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave9`
  - Result: pass; Git reported only LF-to-CRLF working-copy warnings for touched existing files.

## Remaining Risks

- Domain B must still build and verify the render-only Browser Source Stage client against the Domain A contract.
- Manual OBS Browser Source verification remains pending and belongs to the broader Wave9 probe outcome.
- Runtime Export payload transfer currently uses base64 JSON and can be sent over both HTTP and WebSocket resync/change messages. This is acceptable for v0 but may need optimization for large exports.

## User Decision Points

None for Domain A.
