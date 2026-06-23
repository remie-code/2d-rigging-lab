# Broadcast Stage Setup v0

> Runtime Player の Stage 周辺を配信準備に使うための画面責務。Wave9 以降、主経路は Browser Source Output であり、native Stage Window は local preview / fallback として扱う。Wave10 以降、Browser Source 接続中は native local preview live rendering だけを停止して重複描画負荷を避ける。

## 1. Status

- Status: Wave8 implemented native Stage Window setup controls; Wave9 demoted those controls to local preview/fallback and added Browser Source Output as the primary broadcast setup surface; Wave10 added Browser Source-connected local preview live render suspension and sampled diagnostics; Wave11 added Stage Motion as a Stage page display transform that is also sent to Browser Source.
- Date: 2026-06-23
- Current primary broadcast doc: [browser-source-output-probe-v0.md](browser-source-output-probe-v0.md)
- Research basis: [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)

This document no longer represents Window/Game Capture as the primary broadcast assumption. It records the still-useful native Stage Window behavior and its relationship to the Browser Source-first Wave9/Wave10 path.

## 2. UX Goal After Wave11

The user should prepare broadcast output from the `Stage` page in this order:

1. Use `Browser Source Output` to copy the Runtime Player Browser Source URL and monitor server/client/render status.
2. Use OBS Browser Source for the primary probe path.
3. Use `Stage Motion` when the user wants calibrated head position to add transient Stage-level horizontal/scale offsets on top of manual pan/zoom.
4. Use `Local Preview / Fallback` native Stage Window controls for local checking, arrangement, recovery, and fallback capture only. The native preview live render is active when no Browser Source client is connected and suspended while Browser Source is connected.

The Control Window must not claim OBS is capturing or streaming. It can report Runtime Player-owned facts:

- Browser Source server state, bind address, port, and tokenized URL availability.
- connected Browser Source client count.
- latest live frame and heartbeat timestamps.
- Browser Source renderer diagnostics, including WebGL2 and render status.
- native Stage Window local preview state.
- local preview live rendering suspension while Browser Source is connected.

## 3. Implemented Native Stage Window Scope

Wave8 native Stage Window controls remain implemented:

- Runtime Export startup restore.
- Control Window close-hide recovery through tray/application menu.
- explicit quit path.
- Stage Arrange mode with temporary native drag handle.
- click-through toggle, default off and not persisted.
- tray/application menu click-through recovery.
- always-on-top toggle, default off and persisted in Window State.
- stable native title `Runtime Player Stage`.
- Copy Window Title.
- Stage Window bounds and Stage view pan/zoom persistence.

After Wave9, these controls appear under `Local Preview / Fallback` rather than as the primary capture-target checklist.

After Wave10, these controls remain usable for local preview/fallback. The Stage Window is not hidden or destroyed when Browser Source connects; only native live-frame rendering is suspended, and it resumes after the zero-client grace period.

## 4. Implemented Browser Source Output Scope

Wave9/Wave10/Wave11 Stage page behavior:

- Shows `Browser Source Output` before local fallback controls.
- Shows the tokenized Browser Source URL.
- Provides `Copy URL`.
- Shows server state/status label, bind address, port, and token availability as `Included in URL`.
- Shows connected Browser Source client count.
- Shows Runtime Export status for Browser Source output.
- Shows latest live frame sequence/timestamp.
- Shows client heartbeat and server heartbeat.
- Shows renderer status/message, WebGL2 availability, Browser Source Runtime Export loaded flag, frame age, and FPS.
- Shows local preview suspension status while Browser Source clients are connected.
- Samples Control-facing live-frame status/repeated renderer diagnostics while preserving immediate server/client/export/render transitions.
- Avoids duplicate identical Runtime Export payload application during Browser Source startup/resync.
- Receives the same composed Stage transform used for Stage Motion output.
- Shows server error details when available.
- Provides concise OBS Browser Source setup guidance.
- Does not expose a raw token field separate from the URL.
- Does not provide OBS automation, source creation, or capture verification.
- Does not add parameter sliders or editor-style controls.
- Does not receive raw tracking frames, raw head position values, calibration internals, or debug diagnostics for Stage Motion.

## 4.1 Implemented Stage Motion Scope

Wave11 adds Stage Motion to the `Stage` page as a display/composition feature:

- explicit near/far Input Profile calibration supports depth scale.
- manual Stage pan/zoom remains the saved base transform.
- live head-position horizontal and depth offsets are transient and are not saved.
- settings auto-save through Window State / local display settings.
- Browser Source receives only the sanitized composed Stage transform.
- native Stage local preview uses the same composed transform when live rendering is active.
- Wave10 native preview suspension remains limited to native live rendering; Browser Source Stage Motion continues while native preview is suspended.

Stage Motion is not Model Mapping, Runtime Export mutation, rigging, or an editor control surface.

## 5. Screen Placement

Current `Stage` page shape:

```text
Stage
  Stage Window
    Status, position, size, render
    Focus Stage, Arrange Stage

  View
    Zoom, pan
    Reset View, Center Model

  Stage Motion
    Enabled
    Horizontal Follow: strength, limit, invert
    Depth Scale: strength, limit, invert, near/far readiness
    Stabilization: dead zone, reaction
    Auto Save status

  Browser Source Output
    URL, server, bind address, port, token availability
    connected clients, Runtime Export, latest frame
    client/server heartbeat
    renderer, WebGL2, Browser Export, frame age, FPS
    local preview live rendering suspension status
    Copy URL
    OBS Browser Source setup guidance

  Local Preview / Fallback
    Stage Window, Runtime Export, model, background, Stage UI
    native live rendering active when no Browser Source client is connected
    Window Title, click-through, always-on-top
    native Stage Window controls

  Auto Save
    Window State persistence

  Startup
    Runtime Export startup restore
```

Rationale:

- Browser Source Output is the fixed primary broadcast path.
- Stage Motion belongs to Stage composition because it affects where the rendered model sits in the broadcast frame.
- Stage Window controls still matter for local preview and recovery.
- Wave10 suspension is limited to native local preview live rendering; Browser Source rendering, input processing, mapping, body follow, dynamics, Runtime Export state, Stage transform sync, and Wave11 Stage Motion remain active.
- OBS setup remains user-side configuration.

## 6. Manual OBS Browser Source Checklist

The UI docs/reports should preserve this manual checklist:

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
- Confirm body follow/dynamics remain visible in Browser Source while native local preview live rendering is suspended.
- Enable Stage Motion and confirm left/right head motion produces bounded horizontal Stage offset.
- Confirm calibrated near/far movement produces bounded Stage scale response.
- Confirm manual Stage pan/zoom remains the base composition while Stage Motion adds only transient offsets.
- Confirm Browser Source matches native local preview composition when native preview is active.
- Confirm Browser Source continues Stage Motion while native local preview live rendering is suspended.
- Hide/show scene and manually refresh Browser Source, then confirm reconnect/resync.
- Disconnect/close OBS Browser Source and confirm native Stage local preview resumes after the grace period.
- Compare CPU/GPU usage or perceived smoothness against the Wave9 duplicate-render baseline.
- Confirm OBS audio meter does not receive unintended audio.

## 7. Out Of Scope

- Spout sender / Spout2 implementation.
- obs-websocket integration.
- automatic OBS source creation.
- automatic OBS capture verification.
- making Window/Game Capture the primary setup path.
- Input Source auto-connect.
- packaging/distribution.
- multi-output broadcast profiles.
- remote-network Browser Source server.
- exposing raw iFacialMocap or debug diagnostics to Browser Source.

## 8. Manual Checks Still Pending

Browser Source manual checks:

- OBS Browser Source can load the URL.
- OBS Browser Source preserves transparent alpha.
- OBS Browser Source can render the model through WebGL2 without black/white fill.
- Control shows WebGL2 status, connected client, heartbeat, and latest frame.
- Control reports local preview live rendering suspension while connected.
- real iFacialMocap motion appears in Browser Source.
- Stage Motion left/right offset and near/far scale appear in Browser Source.
- Stage Motion settings restore after Runtime Player restart.
- Browser Source Stage Motion parity with native local preview is acceptable when native preview is active.
- OBS hide/show and manual refresh reconnect/resync as expected.
- native Stage local preview resumes after OBS Browser Source disconnect/close.
- perceived CPU/GPU usage or smoothness improves compared with the Wave9 duplicate-render baseline.
- OBS audio meter does not receive unintended audio.

Native Stage Window fallback checks:

- Control close hides/reopens from tray/menu.
- explicit quit flushes and exits.
- Runtime Export valid/invalid startup restore.
- Stage Arrange drag handle moves the native Stage Window.
- click-through toggle and tray recovery.
- always-on-top toggle and persistence.
- native local preview/fallback controls remain usable.

## 9. Implemented Stage Motion Reference

Stage Motion / Head Position Follow is documented in [stage-motion-head-position-follow.md](stage-motion-head-position-follow.md).

It keeps manual Stage pan/zoom as the base composition and adds live head-position-derived offsets:

- head position X -> horizontal Stage offset.
- explicit near/far calibrated depth -> Stage scale offset.

This is a Stage-level display transform feature, not model mapping. Its settings auto-save in Window State, while current live offsets remain transient.
