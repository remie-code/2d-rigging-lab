# Runtime Player Wave 9 Plan: OBS Browser Source Probe

> Objective: prove whether OBS Browser Source can become the primary broadcast output path by serving a model-only Stage page from Runtime Player over loopback HTTP/WebSocket.

## 1. Status

- Status: Ready to launch.
- Planning gate result: plan directly.
- Inventory result: Browser Source is plausible enough for a probe wave, but must be manually verified in OBS before becoming the settled product path.
- Source of truth before implementation:
  - Wave9 Sylph Browser Source feasibility inventory.
  - [broadcast-capture-paths.md](../../research/broadcast-capture-paths.md), with Wave9 expected to revise its Wave8 Window/Game Capture-first assumption.
  - [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md), with Wave9 expected to demote Window/Game Capture-specific UX to local preview/fallback.
  - [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
  - [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)
- External basis:
  - OBS Browser Source docs: https://obsproject.com/kb/browser-source
  - OBS Sources Guide: https://obsproject.com/kb/sources-guide

## 2. Product Goal

Wave8 made the native Stage Window easier to recover, arrange, and use as a local capture target. The user then verified an important platform fact: OBS Game Capture is not a reliable path for Chromium/Electron windows with transparency in the target environment.

Wave9 should shift from native window capture to Browser Source feasibility.

The desired experience is:

1. Runtime Player loads a Runtime Export and receives tracking input as it already does.
2. Runtime Player exposes a local Browser Source URL such as:

```text
http://127.0.0.1:<port>/stage?token=<token>
```

3. The user adds that URL to OBS Browser Source.
4. OBS renders the model-only Stage with transparent background.
5. Live iFacialMocap-driven motion, mapping, body follow, and dynamics-visible runtime state are reflected in the OBS Browser Source.
6. Control Window reports whether the Browser Source client is connected and whether it is rendering successfully.

This is a probe wave. Its purpose is to make the Browser Source path testable with real OBS, not to claim final broadcast readiness before manual verification.

## 3. Accepted Decisions

### 3.1 Broadcast Path

- OBS Browser Source is the new primary candidate.
- Window/Game Capture is demoted from primary broadcast path.
- The native Stage Window remains valuable for local preview, arrangement, and recovery.
- Spout2 remains deferred until Browser Source fails a critical probe condition.

### 3.2 Browser Source Shape

- Runtime Player should host a loopback HTTP server.
- OBS should load a model-only `/stage` page from that server.
- The OBS page is a separate Stage client, not a captured Electron window.
- The page must be transparent by default and must not show setup/debug UI in normal operation.
- The page should report diagnostics back to Control so the user can confirm connection/render state.

### 3.3 Transport

- HTTP serves the Stage page and current Runtime Export assets/payload.
- WebSocket sends live runtime state:
  - loaded/cleared Runtime Export signal or resync.
  - latest sanitized parameter frame.
  - heartbeat.
  - renderer diagnostics from the Browser Source page.
- Runtime Player must bind only to loopback for v0.
- Browser Source URL must include a token.
- Invalid or missing token must not receive model data.

### 3.4 Runtime Evaluation Ownership

Preferred probe architecture:

- Main/control side owns tracking input, mapping, body follow, and sanitized live parameter frame production.
- Browser Source Stage page owns render-only runtime display from Runtime Export + live parameter frames.
- Raw tracking frames, raw iFacialMocap diagnostics, and debug calibration data must not be sent to the Browser Source page.

If implementation discovers that some runtime evaluation must be shared differently, the domain report must state the reason and preserve the model-only Stage boundary.

### 3.5 Control UX

Replace the primary Wave8 `Capture Target` meaning with `Browser Source Output`.

Control should expose:

- Browser Source URL.
- Copy URL.
- Regenerate token or restart/reload output, if safe within scope.
- Server status, port, bind address.
- Connected client count.
- Last heartbeat / last frame age.
- Browser client renderer diagnostics, especially WebGL2 availability and render status.
- OBS setup checklist:
  - Add Browser Source.
  - Paste URL.
  - Set width/height.
  - Set FPS.
  - Keep transparent background/custom CSS.
  - Initially keep shutdown/refresh lifecycle options off unless testing reconnection.

Do not expose OBS automation or claim `OBS Ready`.

## 4. Wave Strategy

Use a mostly sequential chain. The work crosses shared runtime-player server, preload/control, and Stage rendering boundaries, so aggressive parallel implementation would create coordination risk.

### Batch 1

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain A | Browser Source server and transport foundation | No | Establishes loopback HTTP/WS contracts and security boundary. |

### Batch 2

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain B | Browser Source Stage client and render-only pipeline | No, after A | Depends on server routes/WS contract and current Runtime Export delivery shape. |

### Batch 3

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain C | Control UX for Browser Source Output | No, after A/B | Needs real server/client statuses to avoid placeholder-only UI. |

### Batch 4

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain D | Final integration, docs alignment, clean review | No | Updates Wave8 capture docs to Browser Source-first probe facts and records manual OBS checklist. |

## 5. Domain A: Browser Source Server / Transport Foundation

Suggested subagent name:

```text
runtime-player-wave9-browser-source-server-transport
```

### Scope

Add the main-process foundation for a loopback broadcast server that can serve the Browser Source Stage page and exchange live state with connected clients.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/runtime-export-loader/**`
- new main-side broadcast server modules, for example:
  - `apps/runtime-player/src/main/broadcast-source/**`
  - `apps/runtime-player/src/main/broadcast-source/browser-source-server.ts`
  - `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
  - `apps/runtime-player/src/main/broadcast-source/browser-source-token.ts`
- preload/control bridge files only for server status if needed by this domain.
- focused tests under `apps/runtime-player/src/main/**`

### Required Behavior

- Start a local HTTP/WebSocket server for Browser Source output.
- Bind only to `127.0.0.1` for v0.
- Produce a Browser Source URL containing a token.
- Reject missing/invalid token for protected routes and websocket connections.
- Serve the Browser Source Stage page shell or provide enough routing for Domain B to attach it.
- Provide current Runtime Export metadata/payload access to authorized Browser Source clients.
- Broadcast latest sanitized parameter frames to connected Browser Source clients.
- Support resync after page reload.
- Track connected client count and heartbeat status.
- Expose server status to Control through a narrow bridge.
- Do not serve arbitrary local files.
- Do not expose raw tracking or debug APIs.

### Tests

At minimum, add focused tests for:

- loopback bind / URL construction contract.
- token generation and rejection of missing/invalid token.
- websocket connect/disconnect client count.
- current Runtime Export resync behavior.
- no arbitrary file serving.
- no raw tracking/debug route exposure.
- no `pnpm install`.

## 6. Domain B: Browser Source Stage Client / Render Pipeline

Suggested subagent name:

```text
runtime-player-wave9-browser-source-stage-client
```

### Dependency

Start after Domain A has a stable server/transport contract.

### Scope

Create the OBS Browser Source-facing Stage client. It should be a render-only page that can run outside Electron preload/IPC and consume Runtime Export + live parameter frames over loopback HTTP/WS.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/stage/**`
- `apps/runtime-player/src/stage/stage-renderer/**`
- `packages/render-webgl2/**` only if a small reusable boundary is required.
- `packages/runtime-core/**` only if a small runtime-evaluation boundary is required.
- Vite/Electron build entry configuration for a Browser Source page, if required.
- tests under `apps/runtime-player/src/stage/**`

### Required Behavior

- Browser Source Stage page is model-only by default.
- Page background is transparent.
- Page attempts WebGL2 rendering and reports whether WebGL2 is available.
- Page can fetch/load the current Runtime Export payload/assets from Domain A's server.
- Page can receive live sanitized parameter frames through WebSocket.
- Page renders using the same visual rules as the existing Stage path as much as practical.
- Page reconnects and requests/resyncs current export/latest frame after reload.
- Page sends renderer diagnostics/heartbeat to the server:
  - connected.
  - WebGL2 available/unavailable.
  - Runtime Export loaded/not loaded.
  - render status.
  - approximate frame age or FPS if practical.
- Page must not depend on Electron preload APIs.
- Page must not display setup UI or diagnostics unless a debug-only mode is explicitly isolated and off by default.

### Tests

At minimum, add focused tests for:

- Browser Source client state machine where practical.
- transparent/model-only DOM assumptions.
- reconnect/resync behavior where deterministic.
- WebGL2 unavailable diagnostic path, if mockable.
- no Electron preload dependency in the Browser Source client entry.
- no raw tracking/debug data accepted by the client.
- no `pnpm install`.

## 7. Domain C: Control UX For Browser Source Output

Suggested subagent name:

```text
runtime-player-wave9-browser-source-control-ux
```

### Dependency

Start after A/B provide real status and diagnostics contracts.

### Scope

Update Control Window UX so the user can configure OBS Browser Source and verify that the Browser Source client is connected/rendering.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/preload/**`
- CSS under `apps/runtime-player/src/**`
- focused UI/bridge tests.

### Required Behavior

- Add or revise a `Browser Source Output` section in the appropriate Control page.
- Show the current Browser Source URL.
- Provide Copy URL.
- Show server status:
  - running/error.
  - bind address.
  - port.
  - token state, without exposing unsafe controls.
- Show connected Browser Source clients.
- Show last heartbeat / frame age / renderer status.
- Show WebGL2 status reported by the Browser Source page.
- Show Runtime Export status for the Browser Source output.
- Provide restart/reload/resync action only if safe and implementable without scope creep.
- Present concise OBS setup guidance without creating a tutorial-heavy UI.
- Demote Wave8 `Copy Window Title` / Window Capture guidance to local preview/fallback, not primary broadcast setup.
- Keep Stage Window local preview controls available.
- Do not add parameter sliders or editor-style controls.
- Do not claim OBS is actually capturing or streaming.

### Tests

At minimum, add focused tests for:

- Control section renders URL/status/client diagnostics.
- Copy URL action uses the bridge contract.
- invalid/server error status is visible.
- no connected client state is clearly distinguishable from connected/rendering.
- Window Capture-specific UI is not presented as primary broadcast output.
- no `pnpm install`.

## 8. Domain D: Final Integration + Docs Alignment

Suggested subagent name:

```text
runtime-player-wave9-final-integration-browser-source-probe
```

### Scope

Run after A/B/C complete. Do not start until all implementation domains are done and reviewed.

### Required Behavior

- Reconcile shared main/preload/control/stage contracts.
- Verify Browser Source route/client remains model-only and render-focused.
- Verify server binds loopback only.
- Verify invalid token does not receive model data.
- Verify raw tracking/debug data does not cross into Browser Source client.
- Verify native Stage Window remains useful as local preview and recovery, but is no longer the primary broadcast assumption.
- Verify Spout2 remains out of scope.
- Verify docs/maps match implementation facts.
- Write Wave9 reports and reviews under:
  - `discussion/runtime-player/implementation/waves/wave9/`
  - `discussion/runtime-player/implementation/reviews/wave9/`

Docs to update as implementation facts require:

- [broadcast-capture-paths.md](../../research/broadcast-capture-paths.md)
- [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
- a new Browser Source output/probe screen doc if the final UX needs a separate artifact.
- [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
- runtime-player maps.

## 9. Acceptance Criteria

- Runtime Player exposes a Browser Source URL on loopback.
- Browser Source URL includes an access token.
- Missing/invalid token is rejected.
- Browser Source page can load in a normal browser for development smoke.
- Browser Source page can load in OBS Browser Source for manual verification.
- Browser Source page renders the current Runtime Export model with transparent background, subject to manual OBS confirmation.
- Browser Source page reports WebGL2 availability to Control.
- Control reports connected Browser Source client count and heartbeat.
- Live sanitized parameter frames reach the Browser Source page.
- Live iFacialMocap-driven motion is visible in Browser Source, subject to manual OBS confirmation.
- Browser Source page can reconnect/resync after reload.
- Browser Source output does not expose raw tracking/debug data.
- Stage Window remains local preview/model-only and does not regress.
- Wave8 Window/Game Capture guidance is no longer the primary broadcast path in docs/UI.
- Spout2 remains out of scope.

## 10. Verification Matrix

| Area | Verification |
|---|---|
| Local server | Unit tests for bind, route, token, status, and no arbitrary file serving. |
| WebSocket transport | Unit tests for connect/disconnect, heartbeat, resync, and live frame broadcast. |
| Browser Source client | Focused tests for client state and no Electron preload dependency where practical. |
| Render boundary | Source tests or static guards that Browser Source receives only Runtime Export + sanitized parameter frames. |
| Control UX | UI/bridge tests for URL, status, connected clients, diagnostics, and error states. |
| Security boundary | Invalid token smoke/unit tests; loopback-only assertion. |
| Regression | Runtime Player typecheck and focused Vitest. |
| Manual OBS | Browser Source URL load, transparent alpha, WebGL2, live motion, reload/resync, and no unwanted audio meter activity. |

Manual OBS verification is part of the probe outcome. It is acceptable for source tests to pass while manual OBS reveals Browser Source is not viable; that result should be recorded and should trigger Spout2 feasibility discussion.

## 11. Manual Probe Checklist

The final report must include a manual checklist for the user:

- Add OBS Browser Source.
- Paste Runtime Player Browser Source URL.
- Set width/height to the chosen stage size.
- Set custom FPS to 30 or 60 for the test.
- Keep transparent background/custom CSS behavior enabled.
- Initially leave `Shutdown source when not visible` off.
- Initially leave `Refresh browser source when scene becomes active` off.
- Confirm transparent areas show lower OBS layers.
- Confirm model renders without black/white fill.
- Confirm WebGL2 status appears in Control.
- Confirm connected client and heartbeat appear in Control.
- Move face/head with iFacialMocap and confirm model motion.
- Hide/show scene and manually refresh Browser Source, then confirm reconnect/resync.
- Confirm OBS audio meter does not receive unintended audio from the Browser Source.

## 12. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player.
- Do not implement Spout sender.
- Do not implement obs-websocket or automatic OBS source creation.
- Do not implement automatic OBS capture verification.
- Do not make Window/Game Capture the primary broadcast path.
- Do not auto-connect Input Source.
- Do not move raw tracking/debug data into Browser Source Stage.
- Do not expose arbitrary local file serving.
- Bind server only to loopback for v0.
- Keep Browser Source Stage model-only by default.
- Preserve existing Electron Stage Window local preview behavior.
- If a shared file must be touched, keep the change minimal and record it in the domain report.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.

## 13. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance.
- design/development compliance.
- test adequacy.

Domain D performs the clean final integration review after A/B/C are complete.

Reviewers must specifically check:

- Browser Source URL/token safety.
- loopback-only server behavior.
- model-only Stage boundary.
- no raw tracking/debug data exposure.
- Window/Game Capture demotion is reflected in docs/UI.
- Spout2 remains deferred.

## 14. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave9 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 15. Out of Scope

- Spout sender implementation.
- obs-websocket integration.
- automatic OBS source creation.
- automatic OBS capture verification.
- Window/Game Capture as the primary broadcast setup path.
- Input Source auto-connect.
- head-position Stage Motion.
- near/far distance response.
- packaging/distribution.
- multi-output broadcast profiles.
- remote-network broadcast server.
- exposing raw iFacialMocap/debug diagnostics to Browser Source.
