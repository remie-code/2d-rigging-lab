# Runtime Player Wave9 Domain B Review: Browser Source Stage Client / Render Pipeline

## Verdict

`pass after fix loop 1`

## Basis

- `discussion/runtime-player/implementation/orchestration/player-wave9-plan.md`
- `discussion/runtime-player/implementation/waves/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-report.md`
- `discussion/runtime-player/implementation/reviews/wave9/runtime-player-wave9-domain-a-browser-source-server-transport-review.md`
- `discussion/runtime-player/research/broadcast-capture-paths.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/development_convention/source-file-organization-policy.md`

## Scope Reviewed

- `apps/runtime-player/electron.vite.config.ts`
- `apps/runtime-player/src/styles/global.css`
- `apps/runtime-player/src/stage/browser-source/**`
- `apps/runtime-player/src/main/broadcast-source/browser-source-stage-client-assets.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-stage-shell.ts`
- `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
- Focused tests under the same areas.

## Review Lanes

### Design / Development Compliance

Initial verdict: `needs_changes`.

Finding:

- Blocking: production Browser Source Stage assets would fail after Vite code splitting. The initial implementation put `/browser-source-assets/*` behind the token gate, but generated Browser Source entry chunks import split chunks without `?token=...`.

Fix status:

- Resolved. `/browser-source-assets/*` is now served before token validation.
- Static serving is limited to generated renderer `assets` `.js` / `.css` files by safe filename and resolved-path containment.
- `/stage`, `/runtime-export/status`, `/runtime-export/payload`, and `/ws` remain token-gated.

Final verdict: `pass`.

### Test Adequacy

Initial verdict: `needs_changes`.

Findings:

- High: Browser Source client tests did not directly verify application of received `runtime-export-resync` payload plus latest frame.
- Medium: static Browser Source asset behavior was not exercised through the HTTP server.

Fix status:

- Resolved. Client test now sends `runtime-export-resync` with `runtimeExport` and `latestFrame`, then asserts renderer payload/frame application.
- Resolved. Client test now covers `live-parameter-cleared`.
- Resolved under accepted design. Server-level tests now assert tokenless generated JS/CSS and split chunk-style JS can load, protected data routes remain `401` without token, and disallowed assets/path traversal return `404`.

Final verdict: `pass`.

## Accepted Design Assumption

Generated Browser Source static JS/CSS under `/browser-source-assets/*` is tokenless by design.

This is accepted because static JS/CSS is generated app code, while Runtime Export payload/assets and live model data remain token-gated. The implementation relies on strict `.js` / `.css` extension allowlisting, safe filenames, and resolved-path containment.

## Verification Reviewed

From `apps/runtime-player`:

- `pnpm.cmd typecheck`
  - Result: pass.
- Focused Vitest after fix:
  - Result: pass, 4 files / 19 tests.
- `pnpm.cmd build`
  - Result: pass.
- `pnpm.cmd test:unit`
  - Result: pass, 57 files / 219 tests.

From repository root:

- `pnpm.cmd run check:source`
  - Result: pass.
- `git diff --check -- apps/runtime-player/src apps/runtime-player/electron.vite.config.ts`
  - Result: pass; Git reported only LF-to-CRLF working-copy warnings.

## Remaining Risks

- Manual OBS Browser Source verification remains pending.
- OBS CEF WebGL2 behavior, alpha preservation, performance, and reload/visibility lifecycle remain manual probe risks.
- Tokenless generated app JS/CSS is intentionally exposed on loopback; keep the static asset allowlist and path containment narrow.

## User Decision Points

None for Domain B.

## Domain C Readiness

Domain C can safely start.

It should consume Browser Source server status and renderer diagnostics from the existing `window.runtimePlayer.browserSource.getStatus()` / `onStatusChanged()` bridge, especially:

- URL/server state/client count.
- Runtime Export status.
- Latest frame and heartbeat timestamps.
- `latestRendererDiagnostics.webgl2Available`.
- `latestRendererDiagnostics.runtimeExportLoaded`.
- `latestRendererDiagnostics.renderStatus`.
- `latestRendererDiagnostics.message`.
- `latestRendererDiagnostics.fps`.
- `latestRendererDiagnostics.frameAgeMs`.
