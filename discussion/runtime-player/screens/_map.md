# Runtime Player Screens Map

> Runtime Player / Capture Host appの画面責務とUX設計メモ。

## Files

| Path | Status | Content |
|---|---|---|
| [initial-runtime-player-screen.md](initial-runtime-player-screen.md) | Updated / Wave6 current UX facts | Runtime Export未ロードでもInput Source接続できる現行画面体験、Control/Stage分離、Loaded/Live状態、Wave6 Body Follow v0 |
| [control-window-screen-structure.md](control-window-screen-structure.md) | Updated / Wave7 implemented UX facts | Header + `Overview` / `Input` / `Mapping` / `Stage` の実装済みControl構成。Input head position calibration、Mapping Body group、Model Mapping Profile auto-save、Stage page v0 + Window State auto-saveを含む |
| [tracking-setup-live-mapping.md](tracking-setup-live-mapping.md) | Updated / Wave7 implemented UX facts | Input Profile、Look Forward、Guided Calibration v0、head position calibration、Auto Mapping v0 + Body X/Z、Stage Live Confirmation、Model Mapping Profile auto-save/restore、separate Window State |

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
- Wave7 Stage page v0はStage Window bounds、Stage view pan/zoom、Focus Stage、Reset View、Center Model、window-state自動保存状態を扱う。Window State保存先は`<electron userData>/window-state/runtime-player.json`。Broadcast/OBS、click-through、always-on-top、Stage Motionは含めない。
- Startup時の前回Runtime Export自動復元はfuture扱い。現行実装では手動Open Runtime Exportが主導線。

## Next Questions

1. Dedicated Model / Diagnostics pagesをどのwaveで実体化するか。
2. Wave7の実機UXで、Mapping Profile / Stage page保存状態表示が過剰または不足していないかを確認する。
3. Head rotationの軸符号を実機range dataでどう確定・調整するか。
4. Stage Windowのalways-on-top・クリック透過をどこまで扱うか。
5. head-position Stage Motion、near/far distance response、Broadcast/OBS UXをどのwaveで扱うか。
