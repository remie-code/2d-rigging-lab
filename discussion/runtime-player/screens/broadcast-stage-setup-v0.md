# Broadcast Stage Setup v0

> Runtime Playerで、Stage Windowを配信ソフトに載せるための次実装範囲。

## 1. Status

- Status: Implemented in Runtime Player Wave8; source/tests/reviews `pass`.
- Date: 2026-06-23
- Basis:
  - [broadcast-capture-paths.md](../research/broadcast-capture-paths.md)
  - [control-window-screen-structure.md](control-window-screen-structure.md)
  - [tracking-setup-live-mapping.md](tracking-setup-live-mapping.md)
  - [../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md](../implementation/waves/wave8/runtime-player-wave8-final-integration-report.md)

Wave8 implemented Broadcast Stage Setup v0 as source/test-verified functionality. Electron-native and OBS-adjacent manual checks remain pending and are listed in the final integration report; this document must not be read as evidence that those manual checks have been run.

## 2. UX Goal

Wave7までで、Runtime Playerは次の状態になった。

- Runtime Exportを読み込める。
- iFacialMocapでモデルを自然に動かせる。
- Body Followを調整できる。
- Mapping / Body Follow調整が保存復元される。
- Stage Window位置・サイズ・pan/zoomが保存復元される。

次にユーザーが得るべき体験は、モデルを「動かせる」から、配信ソフトへ「迷子にならずに載せられる」へ進むことである。

Broadcast Stage Setup v0の目的:

- Stage WindowをOBSなどのcapture targetとして扱いやすくする。
- Stage Windowがframelessであることによる移動しづらさを解消する。
- Control Windowを閉じても復帰できるようにする。
- 配信中の誤操作を避けるためのclick-throughを安全に扱う。
- 前回使ったRuntime Exportへ戻る手間を減らす。

このwaveはOBSを自動操作するものではない。OBS側のsource作成・capture method・alpha確認はユーザー側の設定である。

## 3. Primary User Story

ユーザーはRuntime Playerを起動する。

前回使っていたRuntime Exportが自動で読み込まれ、Stage Windowには前回のモデル・位置・サイズ・表示倍率でモデルが表示される。

ユーザーはControl WindowのStage/Capture関連画面で、Stage Windowを配置し、必要ならalways-on-topやclick-throughを切り替える。

OBSでは、ユーザーが`Runtime Player Stage`をWindow Captureなどで選ぶ。

Control Windowを閉じてもアプリは終了せず、tray/menuから再表示できる。

## 4. Implemented Scope

### 4.1 Runtime Export Auto Restore

前回開いたRuntime Export directoryを次回起動時に自動復元する。

Implemented behavior:

- 最後に成功して開いたRuntime Export pathを保存する。
- 起動後、Control Windowの初期renderer effect/status setup後に、そのpathの自動復元を試みる。
- 有効なら、手動Openと同じvalidation/session/payload broadcast pathで読み込む。
- 無効ならクラッシュせず、Control Windowに復元失敗状態を出す。
- 無効な保存pathは自動削除しない。ユーザーは`Retry Restore`または通常の`Open Runtime Export`/`Open New Export`から進める。
- 成功したらlast runtime export pathを更新する。

Out of scope:

- Input Sourceの自動接続。
- iFacialMocap接続設定の自動復元。
- Runtime Exportの自動探索。

Rationale:

前回Runtime Exportの復元は、配信準備を短くする効果が大きい。

一方、Input Sourceは現状Connectボタンを押せばよく、自動UDP待受を起動時に行う必要性はまだ低い。

### 4.2 Control Window Recovery

Control Windowを閉じた時、Runtime Playerを終了せず、Control Windowをhideする。

Implemented behavior:

- Control Window close は hide。
- Stage Windowとinput receiverは維持される。
- tray/application menuからControl Windowを再表示できる。
- tray/application menuからStage Windowをfocusできる。
- 明示的なQuit操作でRuntime Player全体を終了する。
- 明示的Quitはinput disconnect、Model Mapping Profile flush、Window State flushを通る。

Implemented tray/menu entries:

- Show Control Window
- Focus Stage
- Disable Click-through, if click-through is currently enabled
- Quit Runtime Player

Rationale:

Stage Windowだけが残り、Control Windowに戻れない状態は配信中の詰みになる。

click-throughを扱う場合、Control Window recoveryは安全装置として必須である。

### 4.3 Stage Arrange Mode

Stage Windowはframelessなので、OS標準タイトルバーで移動できない。

Stage Arrange Modeは、Stage Windowを配信前に配置するための一時モードである。

Implemented behavior:

- Control Windowから`Arrange Stage`を有効化する。
- 有効中、Stage Window上に一時的なarrange overlay / native drag handleを表示する。
- ユーザーはそのdrag regionを掴んでnative Stage Windowを移動できる想定で実装している。
- Arrange mode中は、Stage pan/zoomとの操作衝突を避ける。
- 通常モードではsetup overlayを消し、Stage Windowはmodel-onlyに戻る。

Implementation notes:

- Stage全体を常時ドラッグ可能にしない。
- drag-anywhereはStage view panや将来のbroadcast操作と衝突するため避ける。
- 配信に映る可能性がある補助UIは、Arrange mode中だけ表示する。
- Wave8 implementation uses an Electron native draggable region (`app-region: drag`) on the temporary handle.
- Native drag behavior still needs manual Windows Electron verification.

### 4.4 Click-Through Toggle

Stage Windowを配信中に誤操作しないため、click-throughをtoggleできるようにする。

Implemented behavior:

- Control Windowからclick-throughをOn/Offできる。
- click-through On中はStage Windowがmouse inputを受け取らない。
- Control Windowにはclick-through状態が明確に表示される。
- tray/menuからclick-throughを解除できる。
- click-throughは起動時に必ずOffから始まる。
- click-throughは永続保存しない。
- Arrange modeとclick-throughは同時にOnにしない。片方を有効にする時、もう片方は解除される。

Safety requirement:

- click-through On中でもユーザーが復帰できる導線が必須。
- v0ではtray/menuの`Disable Click-through`を必須とする。
- global shortcutはv0必須ではないが、将来候補として残す。

Out of scope:

- Stage上にclick-through解除UIを出すこと。click-through中はStageがmouseを受け取らないため不適切。

### 4.5 Always-On-Top Toggle

Stage Windowをalways-on-topにできるtoggleを追加する。

Implemented behavior:

- Default is off.
- Control WindowからOn/Offできる。
- 状態はWindow Stateの`stageEnvironment.alwaysOnTop`として保存する。
- 不正な保存値はOffへfallbackする。

Rationale:

always-on-topは配置や運用時に便利なことがあるが、OBS Window Captureには必須ではなく、邪魔になる場面もある。

### 4.6 Capture Target Checklist

OBS連携状態そのものは検出できないため、`OBS Ready`とは呼ばない。

Control Window上では、Stageがcapture targetとして扱いやすい状態かを表示する。

Implemented label:

- Capture Target

Implemented checklist:

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

Important:

Runtime Player cannot reliably know:

- whether OBS is running.
- whether OBS has a source targeting Stage.
- whether OBS preserves alpha.
- whether the source is visible in the active scene.
- whether stream/recording output is correct.

Therefore the checklist is local readiness, not OBS verification.

### 4.7 Stable Stage Window Title

Keep Stage Window native title stable.

Expected behavior:

- Native window title remains `Runtime Player Stage` or another fixed title.
- Do not include model name or session-specific values in the native title.
- Provide `Copy Window Title` action in Control Window.

Rationale:

OBS Window Capture selection can depend on window title. A stable title makes user setup easier.

## 5. Screen Placement

The primary home should be the existing `Stage` page.

Stage page after this scope should contain groups like:

```text
Stage
  Window
    Status: Open
    Bounds: x, y, width, height
    [Focus Stage] [Arrange Stage]

  View
    Zoom: 80%
    Pan: x, y
    [Reset View] [Center Model]

  Capture Target
    Stage Window: Open
    Model: Visible
    Background: Transparent
    Stage UI: Hidden
    Window title: Runtime Player Stage [Copy]
    Click-through: Off [Toggle]
    Always on top: Off [Toggle]

  Startup
    Last Runtime Export: loaded / missing / not set
    [Open Runtime Export]
```

Do not move these controls to Overview by default.

Rationale:

- Overview should remain a quick live-status screen.
- Stage setup is important but low-frequency.
- Broadcast setup should not crowd calibration or mapping workflows.

## 6. Persistence

### Window State

The following belong to Window State or adjacent environment state:

- Stage bounds.
- Control bounds.
- Stage view pan/zoom.
- always-on-top.

The following is intentionally not persisted:

- click-through.

Reason:

- Restoring click-through automatically can trap or surprise the user. Wave8 always starts click-through Off and relies on Control plus tray/application menu recovery for safety.

### Runtime Export Restore

Store last successful Runtime Export directory separately from Window State.

Suggested location:

```text
<electron userData>/
  startup-state/
    runtime-player-startup.json
```

Implemented schema:

```json
{
  "schemaVersion": "runtime-player-startup-state-v1",
  "updatedAtIso": "2026-06-23T00:00:00.000Z",
  "lastRuntimeExportDirectory": "C:/path/to/model.runtime-export"
}
```

Do not store Input Profile or Model Mapping Profile here. Those already have their own ownership.

## 7. Out of Scope

- Spout sender implementation.
- obs-websocket integration.
- automatic OBS source creation.
- automatic OBS capture verification.
- Input Source auto-connect.
- input source profile switching beyond existing Input Profile behavior.
- head-position Stage Motion.
- near/far distance response.
- packaging/distribution.
- multi-output broadcast profiles.

## 8. Acceptance Criteria Status

- Runtime Player startup can restore the last successful Runtime Export: implemented and covered by focused source tests.
- If last Runtime Export is missing/invalid, Control Window reports that state without crashing: implemented and covered by focused source tests.
- Closing Control Window does not trap the user; tray/menu can show Control Window again: implemented and covered by focused source tests; manual Electron check pending.
- Runtime Player can still be explicitly quit: implemented and covered by focused source tests; manual Electron check pending.
- Stage Arrange mode allows moving frameless Stage Window: implemented with native drag handle; manual Windows Electron drag check pending.
- Stage Arrange mode does not leave setup UI visible in normal Stage mode: implemented and covered by focused source tests.
- Click-through can be toggled from Control Window: implemented and covered by focused source tests; manual Electron check pending.
- Click-through can be disabled from tray/menu: implemented and covered by focused source tests; manual Electron check pending.
- Always-on-top can be toggled and defaults off: implemented and covered by focused source tests; manual Electron persistence/z-order check pending.
- Capture Target checklist reflects app-owned readiness without claiming OBS integration: implemented and source-checked.
- Stage native title remains stable and can be copied: implemented and source-checked.
- Stage remains model-only during normal operation: implemented and protected by boundary/source tests.

## 9. Resolved Planning Questions And Remaining Manual Checks

Resolved by Wave8:

- click-through always starts Off and is not restored as On.
- Stage Arrange uses a temporary arrange overlay with a small native drag handle.
- Runtime Export auto restore is triggered from Control after initial renderer effect/status setup, with visible loading/status.
- Invalid last Runtime Export path is kept for Retry/Open New behavior.
- Tray/application menu recovery is implemented as the v0 recovery path.
- Runtime Player exposes a local Capture Target checklist, not an OBS readiness claim.

Manual verification still pending:

- Control close hides/reopens from tray/menu.
- Explicit Quit flushes and exits.
- Runtime Export valid/invalid startup restore.
- Stage Arrange drag handle moves the native Stage Window.
- Click-through toggle and tray recovery.
- Always-on-top toggle and persistence.
- Capture Target checklist and Copy Window Title.
- OBS Window Capture title/alpha smoke check.
