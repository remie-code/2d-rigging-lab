# Runtime Player Screens Map

> Runtime Player / Capture Host appの画面責務とUX設計メモ。

## Files

| Path | Status | Content |
|---|---|---|
| [initial-runtime-player-screen.md](initial-runtime-player-screen.md) | Updated / Wave6 current UX facts | Runtime Export未ロードでもInput Source接続できる現行画面体験、Control/Stage分離、Loaded/Live状態、Wave6 Body Follow v0 |
| [control-window-screen-structure.md](control-window-screen-structure.md) | Updated / Wave8 implemented UX facts | Header + `Overview` / `Input` / `Mapping` / `Stage` の実装済みControl構成。Input head position calibration、Mapping Body group、Model Mapping Profile auto-save、Stage page v0 + Window State auto-save、Wave8 Capture Target controlsを含む |
| [tracking-setup-live-mapping.md](tracking-setup-live-mapping.md) | Updated / Wave8 implemented UX facts | Input Profile、Look Forward、Guided Calibration v0、head position calibration、Auto Mapping v0 + Body X/Z、Stage Live Confirmation、Model Mapping Profile auto-save/restore、separate Window State、Runtime Export startup restore、Stage Capture Target controls |
| [broadcast-stage-setup-v0.md](broadcast-stage-setup-v0.md) | Implemented / Wave8 pass, manual verification pending | Runtime Export startup restore、Control Window recovery、Stage Arrange mode、click-through、always-on-top、Capture Target checklistの実装済みscopeと残manual checks |

## Current Screen Principles

- Runtime PlayerはEditorではなく、完成モデルをtracking inputでライブ表示するアプリである。
- 主画面はClean Stageであり、Parameter一覧、Mesh、Deformer、Editor treeは通常表示しない。
- Stage WindowとControl Windowを分離する。Stage Windowはtransparentでmodel only、Control WindowはRuntime Export、tracking input、calibration、mapping、display setupを扱う。
- Control Windowは1枚の縦積み設定画面ではなく、Header + left navigation + responsibility pagesで構成する。
- 現在のControl Window navigationは `Overview` / `Input` / `Mapping` / `Stage`。Stage pageは空のplaceholderではなく、Stage Window bounds / Stage view transformを扱う実体pageである。
- Runtime Export loadとInput Source connectionは独立しており、Runtime Export未ロードでもiFacialMocap接続・diagnostics確認は可能。
- Debug UIは必要だが、通常UXでは折りたたむ。
- Stage Live Mappingはmain-owned sanitized parameter frameとStage runtime-core evaluationで実装済み。Stageはmodel-onlyを維持する。
- Wave6 Body Follow v0はmain-owned sanitized parameter frameとしてBody X/Zを出力する。Stageはraw tracking/head-position/debug body dataを受け取らない。
- Wave7 Model Mapping Profileは手動Saveではなく自動保存する。保存状態はMapping page上部の`Mapping Profile` cardに出し、Headerには保存ボタンを置かない。保存先は`<electron userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json`。
- Wave7 Stage page v0はStage Window bounds、Stage view pan/zoom、Focus Stage、Reset View、Center Model、window-state自動保存状態を扱う。Wave8 Stage pageはさらにCapture Target checklist、Arrange Stage、click-through、always-on-top、Copy Window Title、Runtime Export startup restore statusを扱う。
- Wave8 Broadcast Stage Setup v0は、Stage WindowをOBS等のcapture targetとして使いやすくするlocal readiness UXである。OBS integration/readinessは主張せず、OBS automation/source creationも行わない。Spoutは有力な将来候補だが別feasibility trackとして扱う: [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)。
- Startup時の前回Runtime Export自動復元はWave8で実装済み。Input Source auto-connectはしない。
- click-throughは起動時Offで、永続保存しない。always-on-topはdefault OffでWindow Stateへ保存する。

## Next Questions

1. Dedicated Model / Diagnostics pagesをどのwaveで実体化するか。
2. Wave8のmanual checksで、Stage pageのCapture Target表示とStartup restore表示が過剰または不足していないかを確認する。
3. Head rotationの軸符号を実機range dataでどう確定・調整するか。
4. Wave8のmanual Electron/OBS-adjacent verificationを実行する。
5. Spout Output feasibilityをすぐ扱うか、OBS Window Capture実機検証後に扱うか。
