# Broadcast Capture Paths: Window Capture First, Spout Later

> Runtime PlayerのStageを配信ソフトへ渡す経路についての調査・方針メモ。

## 1. Status

- Status: Direction accepted and implemented by Runtime Player Wave8 source/tests.
- Date: 2026-06-23
- Scope: Runtime Player Stage WindowをOBSなどの配信ソフトへ渡す方法。

Wave8 implemented the near-term Stage Window capture-target UX. This research note still does not claim that OBS Window Capture alpha/title behavior has been manually verified; that remains a pending manual check.

## 2. Context

Runtime Playerは、Editorが生成したRuntime Exportを読み込み、tracking inputでモデルを動かすElectron desktop appである。

Wave7までに次が実装済み:

- transparent / frameless Stage Window。
- Stage model-only boundary。
- Runtime Export load。
- iFacialMocap live mapping。
- Body Follow。
- Model Mapping Profile auto-save。
- Stage window/view state auto-save。

次に必要なのは、Stageを配信画面へ載せるためのUXである。

候補は大きく2つある:

1. OBSのWindow Capture / Game CaptureなどでStage Windowを捕まえる。
2. Spout senderとしてRuntime Playerから映像textureを出し、OBS Spout pluginで受ける。

## 3. External Facts

### OBS Capture Sources

OBS公式のSources Guideでは、代表的なcapture sourceとして次が整理されている。

- Window Capture: 単一windowをcaptureする。
- Game Capture: Windows向けで、hardware-accelerated gamesを高性能にcaptureする。
- Display Capture: 画面全体をcaptureする。

Reference:

- https://obsproject.com/kb/sources-guide

### Electron Window Capabilities

Electron BrowserWindowは、transparent / frameless window、always-on-top、click-throughに相当するmouse event ignoreなどを提供する。

Reference:

- https://www.electronjs.org/docs/latest/api/browser-window
- https://www.electronjs.org/docs/latest/tutorial/custom-window-styles
- https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions

### Spout

SpoutはWindows向けのrealtime video routing / texture sharingであり、GPUを使って低遅延・低オーバーヘッドにアプリ間で映像を共有する。

OBS向けにはSpout2 input/output pluginが存在し、Spout shared textureをOBS Sourceとして扱える。

Reference:

- https://spout.zeal.co/
- https://github.com/Off-World-Live/obs-spout2-plugin
- https://github.com/leadedge/Spout2

## 4. Current Repository Facts

Runtime Player Stageはすでにcapture targetに近い形になっている。

- Stage Window is transparent.
- Stage Window is frameless.
- Stage Window is model-only.
- Stage Window has a stable title, currently `Runtime Player Stage`.
- Stage receives sanitized runtime parameter values, not raw tracking/debug data.
- Control Window owns setup and diagnostics.

Wave8時点で追加実装済み:

- Runtime Export auto restore。
- Control Windowを閉じた後の復帰導線。
- Stage Arrange mode。
- click-through toggle。
- always-on-top toggle。
- Capture Target checklist。
- Stable Stage title copy action。

Wave8後も未実装:

- OBS automation。
- OBS source creation。
- OBS capture verification automation。
- Spout specific output。

## 5. Decision

Near-term v0 should use the existing Stage Window as the capture target.

This does not mean Window/Game Capture is fundamentally superior to Spout. It means it is the correct next step because it is much lighter and fits the already implemented Stage Window model.

Accepted near-term direction, implemented in Wave8:

- Use the Stage Window as the primary broadcast capture target.
- Keep the native window title stable so OBS Window Capture can target it.
- Treat OBS setup as user-side configuration for now.
- Do not integrate OBS automatically in v0.
- Add Control-side affordances that make the Stage easy to capture:
  - Focus Stage.
  - Stage Arrange mode.
  - Copy Stage window title.
  - click-through toggle with a safe recovery path.
  - always-on-top toggle, default off.
  - Capture Target checklist.
- Keep Spout as a near-future feasibility track, not as the first implementation path.

## 6. Rationale

### Why Stage Window Capture First

Stage Window Capture fits current architecture:

- It reuses the existing Stage Window and renderer.
- It requires no native Spout sender implementation.
- It does not require users to install an OBS plugin.
- It lets the next UX wave focus on broadcast ergonomics rather than native GPU texture sharing.
- It can be manually verified quickly with a real Runtime Export and OBS.

This path mainly needs window/control UX:

- moving the Stage Window despite it being frameless.
- recovering Control Window if it is closed.
- preventing accidental Stage interaction during broadcast.
- keeping capture target identity stable.

### Why Not Spout First

Spout is not rejected because it is worse. It may be better as a final broadcast output path.

However, Spout is heavier for the next wave because:

- It is Windows-specific.
- OBS needs an additional Spout plugin.
- Runtime Player would need a Spout sender path.
- Electron/Chromium canvas output to a Spout shared texture is not currently designed.
- A naive CPU readback path may be too expensive.
- Native module or helper-process packaging/distribution would become part of the scope.

Therefore Spout should be handled as a focused feasibility investigation/prototype before becoming a product requirement.

## 7. UX Implications

### Capture Target v0

Do not label the UI `OBS Ready`.

Runtime Player cannot reliably know whether OBS is actually capturing the Stage, whether alpha is preserved, whether a source is visible, or whether the stream output is correct.

Better label:

- `Capture Target`
- `Stage Capture`
- `Broadcast Target`

Implemented Control-side checklist:

- Stage Window: Open
- Runtime Export: Loaded / Not loaded
- Model: Visible
- Background: Transparent
- Stage UI: Hidden / model only
- Window title: `Runtime Player Stage`
- Click-through: On / Off
- Always on top: On / Off

Implemented actions:

- Focus Stage
- Arrange Stage
- Reset View
- Center Model
- Copy Window Title

### Stage Arrange Mode

Because Stage is frameless, the user needs a way to move it.

The preferred direction is not permanent drag-anywhere on the Stage, because Stage pointer interactions already have meaning for view pan/zoom and future broadcast operation.

Implemented direction:

- Control Window has an `Arrange Stage` mode.
- While active, Stage shows a temporary arrange overlay with a native drag handle.
- The user can drag that setup surface to move the native Stage Window. Native drag movement still needs manual Windows Electron verification.
- Normal mode hides the setup surface so it does not appear in broadcast.

### Control Window Recovery

The user must be able to recover Control Window after closing it.

Implemented direction:

- Closing Control Window hides it rather than quitting Runtime Player.
- Tray and application menu entries:
  - Show Control Window
  - Focus Stage
  - Disable Click-through when click-through is active
  - Quit

This prevents the Stage from remaining visible while the user has no way to access controls.

### Always On Top

Always-on-top is implemented as a toggle, default off, persisted in Window State as `stageEnvironment.alwaysOnTop`.

It is useful during arrangement or when keeping Stage visible, but it is not required for OBS Window Capture and can be disruptive.

### Click-Through

Click-through is useful during broadcast but risky.

Wave8 implements it with a clear recovery path:

- Control-side toggle.
- Visible state in Control.
- Tray/application menu Disable Click-through if Control is hidden or inaccessible.
- It always starts Off on startup and is not persisted.

## 8. Spout Future Track

Spout should remain a near-future feasibility candidate.

The question is not whether Spout is useful; it probably is.

The questions are:

- Can Runtime Player produce a Spout sender from the rendered model output?
- Can alpha be preserved reliably in OBS via Spout plugin?
- Can it be implemented without CPU readback becoming a performance bottleneck?
- Does Electron require a native addon, helper process, or separate renderer pipeline?
- How does this affect packaging and distribution?
- Does Spout output replace Stage Window capture, or exist as a second output mode?

Potential future shape:

- Stage Window: local preview and arrangement.
- Spout Output: broadcast output texture.
- Control Window: selects output mode and reports sender status.

This is architecturally cleaner for broadcast, but too heavy to make the immediate next wave.

## 9. Wave8 Implementation Result

Runtime Player Wave8 implemented Broadcast Stage Setup v0:

Implemented scope:

- Runtime Export auto restore.
- Control Window recovery via tray/menu and application menu.
- Stage Arrange mode.
- click-through toggle with safe tray/application menu recovery.
- always-on-top toggle, default off, persisted in Window State.
- Capture Target checklist.
- stable Stage title / Copy Window Title.
- OBS setup guidance boundary: local readiness only, not OBS automation/readiness.

Out of scope:

- Spout sender implementation.
- obs-websocket integration.
- automatic OBS source creation.
- head-position Stage Motion.
- near/far distance response.

## 10. Open Questions And Pending Manual Verification

- Whether a future UI/docs panel should include OBS Window Capture instructions remains undecided.
- A global shortcut for click-through recovery remains a future safety improvement, not a Wave8 requirement.
- Spout feasibility remains a separate future track; decide timing after OBS Window Capture manual smoke or if Window Capture proves insufficient.
- Pending manual check: OBS Window Capture can select `Runtime Player Stage`.
- Pending manual check: OBS preserves transparent background/alpha for the user's target configuration.
- Pending manual check: Arrange overlay is hidden before capture and Stage remains model-only in normal mode.
