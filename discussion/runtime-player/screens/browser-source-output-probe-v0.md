# Browser Source Output Probe v0

> Runtime Player Wave9 の OBS Browser Source 向け出力画面・経路の実装事実と手動プローブ手順。

## 1. Status

- Status: Implemented in Runtime Player Wave9 source/tests; manual OBS probe pending.
- Date: 2026-06-23
- Implementation basis: [../implementation/orchestration/player-wave9-plan.md](../implementation/orchestration/player-wave9-plan.md)
- Research basis: [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)

Wave9 makes OBS Browser Source the primary broadcast candidate. The native Stage Window remains local preview/fallback.

## 2. User Flow

1. Load or restore a Runtime Export in Runtime Player.
2. Connect iFacialMocap input as usual.
3. Open the `Stage` page in Control.
4. Copy the `Browser Source Output` URL.
5. Add an OBS Browser Source and paste the URL.
6. Set OBS Browser Source width/height and custom FPS for the test.
7. Confirm Control reports Browser Source connection, heartbeat, WebGL2 status, render status, and live frame updates.

## 3. Repository Facts

Server/transport:

- Runtime Player starts a loopback HTTP/WebSocket Browser Source server.
- The server binds to `127.0.0.1`.
- The Browser Source URL includes `?token=<token>`.
- Protected HTTP routes and WebSocket upgrade reject missing/invalid tokens.
- Runtime Export payload/status and live parameter frames are token-gated.
- Generated Browser Source JS/CSS assets are tokenless by accepted design so production Vite split chunks can load.
- Static asset serving is constrained to generated `.js` / `.css` files by filename filtering and path containment.

Browser Source Stage client:

- Browser Source Stage is a separate browser page, not an Electron-captured native window.
- It renders only a transparent model canvas by default.
- It has no setup/debug UI in normal operation.
- It does not depend on Electron preload, IPC, `window.runtimePlayer`, `window.runtimePlayerStage`, or Node APIs.
- It fetches Runtime Export payload and receives sanitized live parameter frames.
- It sends heartbeat and renderer diagnostics to Control.

Control:

- `Browser Source Output` appears before `Local Preview / Fallback`.
- It displays URL, server status, bind address, port, token availability, client count, Runtime Export status, latest frame, heartbeat timestamps, renderer status, WebGL2 status, Browser Source Runtime Export loaded flag, frame age, and FPS.
- `Copy URL` copies the full tokenized URL.
- Server error state is visible.
- No OBS automation or OBS-ready claim is displayed.

## 4. Data Boundary

Allowed Browser Source data:

- Runtime Export payload required to render the model.
- sanitized `RuntimePlayerLiveParameterFrame` with `parameterValues`.
- Runtime Export loaded/not-loaded status summary.
- server heartbeat/resync messages.
- Browser Source client renderer diagnostics back to Control.

Forbidden Browser Source data:

- raw tracking frames.
- raw iFacialMocap diagnostics.
- calibration/debug data.
- Control-only Browser Source status fields.
- private Runtime Export directory paths.
- arbitrary local files.

## 5. Manual OBS Probe Checklist

- Add OBS Browser Source.
- Paste Runtime Player Browser Source URL.
- Set width/height.
- Set custom FPS to 30 or 60 for test.
- Keep transparent background/custom CSS behavior enabled.
- Initially leave `Shutdown source when not visible` off.
- Initially leave `Refresh browser source when scene becomes active` off.
- Confirm transparent areas show lower OBS layers.
- Confirm model renders without black/white fill.
- Confirm WebGL2 status appears in Control.
- Confirm connected client and heartbeat appear in Control.
- Move face/head with iFacialMocap and confirm model motion.
- Hide/show scene and manually refresh Browser Source, then confirm reconnect/resync.
- Confirm OBS audio meter does not receive unintended audio.

## 6. Acceptance Status

Source/test verified:

- loopback server and tokenized URL.
- missing/invalid token rejection.
- protected Runtime Export payload/status routes.
- no arbitrary file serving.
- no raw tracking/debug route.
- WebSocket connect/disconnect, heartbeat, diagnostics, resync, and live frame broadcast.
- model-only transparent Browser Source DOM assumptions.
- no Electron preload dependency in Browser Source entry.
- Control URL/status/client/diagnostic UI.
- Window/Game Capture UI demoted to `Local Preview / Fallback`.

Manual pending:

- OBS Browser Source alpha preservation.
- OBS CEF WebGL2 behavior.
- real Runtime Export rendering in OBS.
- real iFacialMocap live motion in OBS.
- OBS visibility/refresh reconnect and resync.
- OBS audio meter check.

## 7. Decision After Probe

If manual checks pass, Browser Source can remain the primary broadcast path.

If manual checks fail, record the failure condition and decide whether to:

- run a narrow Browser Source follow-up wave.
- keep native Stage Window fallback for the short term.
- escalate to Spout2 feasibility.
