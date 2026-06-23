# Browser Source Output Probe v0

> Runtime Player Wave9/Wave10 の OBS Browser Source 向け出力画面・経路の実装事実と手動プローブ手順。

## 1. Status

- Status: Implemented in Runtime Player Wave9 source/tests; Wave10 performance foundation source/tests integrated; manual OBS probe pending.
- Date: 2026-06-23
- Implementation basis: [../implementation/orchestration/player-wave9-plan.md](../implementation/orchestration/player-wave9-plan.md)
- Wave10 basis: [../implementation/orchestration/player-wave10-plan.md](../implementation/orchestration/player-wave10-plan.md), [../implementation/waves/wave10/runtime-player-wave10-final-integration-report.md](../implementation/waves/wave10/runtime-player-wave10-final-integration-report.md)
- Research basis: [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)

Wave9 introduced OBS Browser Source as the primary broadcast candidate. Wave10 keeps Browser Source as the fixed primary broadcast path and reduces duplicate local rendering work. The native Stage Window remains local preview/fallback; while at least one Browser Source client is connected, only the native local preview live rendering path is suspended.

## 2. User Flow

1. Load or restore a Runtime Export in Runtime Player.
2. Connect iFacialMocap input as usual.
3. Open the `Stage` page in Control.
4. Copy the `Browser Source Output` URL.
5. Add an OBS Browser Source and paste the URL.
6. Set OBS Browser Source width/height and custom FPS for the test.
7. Confirm Control reports Browser Source connection, heartbeat, WebGL2 status, render status, sampled live frame diagnostics, and local preview suspension while connected.
8. Disconnect or close the OBS Browser Source and confirm the native Stage local preview resumes after the grace period.

## 3. Repository Facts

Server/transport:

- Runtime Player starts a loopback HTTP/WebSocket Browser Source server.
- The server binds to `127.0.0.1`.
- The Browser Source URL includes `?token=<token>`.
- Protected HTTP routes and WebSocket upgrade reject missing/invalid tokens.
- Runtime Export payload/status and live parameter frames are token-gated.
- Generated Browser Source JS/CSS assets are tokenless by accepted design so production Vite split chunks can load.
- Static asset serving is constrained to generated `.js` / `.css` files by filename filtering and path containment.
- Browser Source client count drives native local preview live render suspension only; it does not stop Browser Source transport or rendering.

Browser Source Stage client:

- Browser Source Stage is a separate browser page, not an Electron-captured native window.
- It renders only a transparent model canvas by default.
- It has no setup/debug UI in normal operation.
- It does not depend on Electron preload, IPC, `window.runtimePlayer`, `window.runtimePlayerStage`, or Node APIs.
- It fetches Runtime Export payload and receives sanitized live parameter frames.
- It sends heartbeat and renderer diagnostics to Control.
- It applies every live frame it receives while sampling renderer diagnostics sent back to Control.
- It de-duplicates identical Runtime Export payload application during startup/resync while still applying replacement payload identities.

Control:

- `Browser Source Output` appears before `Local Preview / Fallback`.
- It displays URL, server status, bind address, port, token availability, client count, Runtime Export status, latest frame, heartbeat timestamps, renderer status, WebGL2 status, Browser Source Runtime Export loaded flag, frame age, and FPS.
- `Copy URL` copies the full tokenized URL.
- Server error state is visible.
- Local preview live rendering suspension is visible when Browser Source clients are connected.
- Control-facing live-frame status and repeated renderer diagnostics are sampled around 500 ms, while server/client connect/disconnect, Runtime Export load/clear, and render error transitions remain immediate.
- No OBS automation or OBS-ready claim is displayed.

## 4. Data Boundary

Allowed Browser Source data:

- Runtime Export payload required to render the model.
- sanitized `RuntimePlayerLiveParameterFrame` with `parameterValues`.
- Runtime Export loaded/not-loaded status summary.
- server heartbeat/resync messages.
- Browser Source client renderer diagnostics back to Control.
- sampled Browser Source performance/status diagnostics.

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
- Confirm Control reports local preview live rendering suspension while Browser Source is connected.
- Move face/head with iFacialMocap and confirm model motion.
- Confirm body follow/dynamics remain visible in Browser Source while the native local preview is suspended.
- Hide/show scene and manually refresh Browser Source, then confirm reconnect/resync without broken reload behavior.
- Disconnect/close OBS Browser Source and confirm the native Stage local preview resumes after the grace period.
- Compare CPU/GPU usage or perceived smoothness against the Wave9 duplicate-render baseline.
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
- Wave10 local preview live render suspension policy:
  - zero Browser Source clients keeps native Stage local live rendering active.
  - one or more Browser Source clients suspends only native Stage local live rendering.
  - zero clients resumes native Stage local live rendering after a short grace period.
  - reconnect during the grace period avoids preview bounce.
- Browser Source live frames continue while native local preview live rendering is suspended.
- Runtime Export state, Stage transform sync, input processing, mapping, body follow, and dynamics remain outside the suspension boundary.
- Control-facing Browser Source status/diagnostics are sampled without hiding important server/client/export/render transitions.
- Browser Source resync de-duplicates identical Runtime Export payload application while preserving replacement payload application.
- No raw tracking/debug data crosses into Browser Source.

Manual pending:

- OBS Browser Source alpha preservation.
- OBS CEF WebGL2 behavior.
- real Runtime Export rendering in OBS.
- real iFacialMocap live motion in OBS.
- OBS visibility/refresh reconnect and resync.
- local preview suspension status and resume behavior in a real OBS Browser Source lifecycle.
- perceived CPU/GPU or smoothness improvement compared with Wave9 duplicate local + Browser Source rendering.
- OBS audio meter check.

## 7. Decision After Probe

If manual checks pass, Browser Source can remain the primary broadcast path.

If manual checks fail, record the failure condition and decide whether to:

- run a narrow Browser Source follow-up wave.
- keep native Stage Window fallback for the short term.
- escalate to Spout2 feasibility.
