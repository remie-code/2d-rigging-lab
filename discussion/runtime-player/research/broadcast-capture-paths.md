# Broadcast Capture Paths: Browser Source Probe First, Stage Window Fallback, Spout2 Deferred

> Runtime Player の Stage を OBS などの配信ソフトへ渡す経路についての調査・方針メモ。

## 1. Status

- Status: Direction updated by Runtime Player Wave9 source/tests and Runtime Player Wave10 performance foundation source/tests.
- Date: 2026-06-23
- Scope: Runtime Player の配信用出力経路。Editor 本体や OBS 自動操作は対象外。

Wave8 implemented native Stage Window capture-target ergonomics. Wave9 supersedes the Wave8 "Window/Game Capture first" assumption for primary broadcast setup and makes OBS Browser Source the primary candidate to probe. Wave10 keeps Browser Source as the fixed primary broadcast implementation path and reduces duplicate local Stage rendering while Browser Source clients are connected.

Manual OBS Browser Source verification is still pending. Source/tests prove the Runtime Player side of the Browser Source output path and Wave10 performance boundary, not that OBS CEF preserves alpha/performance in the user's environment.

## 2. External Facts

Official OBS Browser Source documentation describes Browser Source as a web browser source that can load a URL, has width/height and custom FPS settings, and includes custom CSS behavior whose default CSS makes the page background transparent and removes page margins/overflow. It also exposes lifecycle options such as `Shutdown source when not visible` and `Refresh browser source when scene becomes active`.

The OBS Sources Guide lists Browser Source as a source for adding a web page to a scene, while Window Capture and Game Capture remain separate capture-source categories.

References:

- https://obsproject.com/kb/browser-source
- https://obsproject.com/kb/sources-guide

## 3. Repository Facts Before Wave9

Wave8 facts:

- Runtime Player has a transparent, frameless native Stage Window.
- The native Stage Window is model-only in normal mode.
- Control Window can focus/arrange the Stage, toggle click-through, toggle always-on-top, and copy the stable native title `Runtime Player Stage`.
- Control Window recovery through tray/application menu exists.
- The Wave8 `Capture Target` checklist was local readiness only and did not prove OBS capture.
- Spout sender, obs-websocket, automatic OBS source creation, and automatic OBS capture verification were out of scope.

Post-Wave8 product finding:

- OBS Game Capture is not reliable for Chromium/Electron transparent windows in the target environment.
- Window/Game Capture should no longer be the primary broadcast assumption.

## 4. Wave9 Repository Facts

Wave9 adds an OBS Browser Source output probe:

- Runtime Player starts a loopback HTTP/WebSocket server bound to `127.0.0.1`.
- Control exposes a Browser Source URL shaped like `http://127.0.0.1:<port>/stage?token=<token>`.
- `/stage`, `/runtime-export/status`, `/runtime-export/payload`, and `/ws` require the token.
- Missing or invalid tokens receive `401` for protected HTTP routes or WebSocket upgrade rejection.
- Generated Browser Source JS/CSS under `/browser-source-assets/*` is intentionally tokenless so Vite split chunks can load in production.
- Static asset serving is constrained to generated `.js` / `.css` files under the renderer `assets` directory by filename filtering and path containment.
- Runtime Export payload/status and live parameter frames remain token-gated.
- Browser Source clients receive Runtime Export payloads and sanitized `RuntimePlayerLiveParameterFrame` values.
- Browser Source clients do not receive raw tracking frames, raw iFacialMocap diagnostics, debug calibration data, Control status, or private directory paths.
- The Browser Source Stage client is a separate browser page under `apps/runtime-player/src/stage/browser-source/`.
- The Browser Source page is transparent and model-only by default, with a canvas surface and no setup/debug UI.
- The Browser Source page does not depend on Electron preload APIs, `window.runtimePlayer`, `window.runtimePlayerStage`, `ipcRenderer`, or Node APIs.
- Browser Source clients report renderer diagnostics back to Control: WebGL2 availability, render status, Runtime Export loaded flag, FPS, and frame age.
- Control Stage page now shows `Browser Source Output` as the primary broadcast setup/status panel.
- Native Stage Window controls are retained under `Local Preview / Fallback`.

## 4.1 Wave10 Performance Repository Facts

Wave10 adds a Browser Source performance foundation without changing the accepted broadcast route:

- Browser Source remains the fixed primary broadcast path.
- Native Stage Window remains visible and usable as local preview/fallback when no Browser Source client is connected.
- When Browser Source connected client count is greater than zero, only native Stage local live rendering is suspended.
- The suspension does not stop Browser Source rendering, live parameter frame production, iFacialMocap input processing, mapping, body follow, dynamics, Runtime Export state, or Stage transform synchronization.
- When Browser Source connected client count stays at zero for the grace period, native Stage local live rendering resumes.
- Control reports the local preview suspension state while Browser Source is connected.
- Control-facing Browser Source live-frame status and repeated renderer diagnostics are sampled around 500 ms; important server/client/export/render state changes remain immediate.
- Browser Source resync de-duplicates identical Runtime Export payload application while preserving reload/reconnect and replacement payload behavior.
- No raw tracking frames, raw iFacialMocap diagnostics, debug calibration data, private paths, or Control-only status fields are added to the Browser Source boundary.

## 5. Current Decision

Accepted Wave9/Wave10 direction:

- Treat OBS Browser Source as the fixed primary broadcast implementation path, while manual OBS verification remains required before claiming product-ready OBS behavior.
- Keep the native Stage Window as local preview, arrangement/recovery surface, and fallback capture target.
- Do not make Window/Game Capture the primary setup path.
- Do not implement Spout2 sender until Browser Source fails a critical manual probe condition.
- Do not implement obs-websocket, automatic OBS source creation, or automatic OBS capture verification.
- Do not expose raw tracking/debug data to the Browser Source route/client.

This is a probe decision, not a final broadcast readiness claim. The next evidence needed is manual OBS verification with the user's real Runtime Export, real iFacialMocap input, and target OBS configuration.

## 6. Browser Source v0 Boundary

Browser Source output is intentionally narrow:

- Main/control side owns tracking input, mapping, body follow, and live sanitized parameter frame production.
- Browser Source page owns render-only display from Runtime Export + sanitized live parameter frames.
- Control owns server/client/renderer diagnostics display.
- The Browser Source page can request resync and send renderer diagnostics/heartbeat.
- The Browser Source page cannot inspect raw input diagnostics or Control-only runtime state.
- Wave10 samples Control-facing diagnostics/status only; it does not throttle Browser Source live motion frames.

Security and locality:

- v0 binds only to `127.0.0.1`.
- Browser Source URL includes an access token.
- The token is visible in Control because the user must paste the URL into OBS.
- The URL should not be shown in public capture if it should remain private.

## 7. Native Stage Window Role After Wave10

The native Stage Window remains useful:

- local preview while arranging and checking the model.
- recovery/visibility surface when OBS is not involved.
- fallback capture target if Browser Source fails in OBS.
- holder for existing Stage Window placement, pan/zoom, click-through, always-on-top, and recovery controls.

But it is no longer the primary broadcast setup path. Documentation and UI should not lead with Window/Game Capture instructions.

Wave10 adds one important runtime boundary: while Browser Source clients are connected, native Stage live rendering is suspended to avoid duplicate live WebGL work. The native Stage Window is not hidden or destroyed, and local preview resumes after the zero-client grace period.

## 8. Spout2 Future Track

Spout2 remains deferred.

Spout2 should be revisited if Browser Source fails a critical probe condition, for example:

- OBS Browser Source cannot preserve transparent alpha in the target environment.
- OBS Browser Source cannot use WebGL2 reliably enough for the model.
- Browser Source reload/visibility lifecycle cannot resync safely.
- Browser Source performance is not acceptable with a real Runtime Export after Wave10's duplicate-render suspension.

Future Spout2 questions remain:

- Can Runtime Player publish a GPU texture with alpha without expensive CPU readback?
- Does Electron require a native addon, helper process, or separate rendering pipeline?
- How does Spout2 affect packaging/distribution and user setup?
- Should Spout2 replace Browser Source or exist as an alternate output mode?

## 9. Manual OBS Browser Source Probe Checklist

Run these after Wave10 source/docs integration:

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
- Confirm Control reports local preview live rendering suspension while OBS Browser Source is connected.
- Move face/head with iFacialMocap and confirm model motion.
- Confirm body follow/dynamics remain visible in Browser Source while native local preview live rendering is suspended.
- Hide/show scene and manually refresh Browser Source, then confirm reconnect/resync.
- Disconnect/close OBS Browser Source and confirm native Stage local preview resumes after the grace period.
- Compare CPU/GPU usage or perceived smoothness against the Wave9 duplicate-render baseline.
- Confirm OBS audio meter does not receive unintended audio.

## 10. Remaining Questions

- Manual result: does OBS Browser Source preserve alpha and WebGL2 rendering with the user's target OBS/Windows/GPU setup?
- Manual result: does Browser Source reconnect/resync behave well with OBS visibility changes and manual refresh?
- Manual result: is live iFacialMocap motion smooth enough through Browser Source?
- Manual result: does local preview suspension/resume behave understandably during OBS connect, refresh, and disconnect?
- Manual result: does Wave10 improve perceived performance or CPU/GPU load enough for the real Runtime Export?
- Decision after manual probe: keep Browser Source as primary path, run a narrow Browser Source follow-up, or escalate to Spout2 feasibility.
