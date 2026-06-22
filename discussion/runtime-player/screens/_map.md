# Runtime Player Screens Map

> Runtime Player / Capture Host appの画面責務とUX設計メモ。

## Files

| Path | Status | Content |
|---|---|---|
| [initial-runtime-player-screen.md](initial-runtime-player-screen.md) | Updated / Wave6 current UX facts | Runtime Export未ロードでもInput Source接続できる現行画面体験、Control/Stage分離、Loaded/Live状態、Wave6 Body Follow v0 |
| [control-window-screen-structure.md](control-window-screen-structure.md) | Updated / Wave6 facts | Header + `Overview` / `Input` / `Mapping` の実装済みControl構成。Input head position calibrationとMapping Body groupを含む。Model/Stage/Dedicated Diagnostics pageはfuture |
| [tracking-setup-live-mapping.md](tracking-setup-live-mapping.md) | Updated / Wave6 implemented UX basis | Input Profile、Look Forward、Guided Calibration v0、head position calibration、Auto Mapping v0 + Body X/Z、Stage Live Confirmationの実装済みUX basisとfuture項目 |

## Current Screen Principles

- Runtime PlayerはEditorではなく、完成モデルをtracking inputでライブ表示するアプリである。
- 主画面はClean Stageであり、Parameter一覧、Mesh、Deformer、Editor treeは通常表示しない。
- Stage WindowとControl Windowを分離する。Stage Windowはtransparentでmodel only、Control WindowはRuntime Export、tracking input、calibration、mapping、display setupを扱う。
- Control Windowは1枚の縦積み設定画面ではなく、Header + left navigation + responsibility pagesで構成する。
- 現在のControl Window navigationは `Overview` / `Input` / `Mapping` のみ。空の `Model` / `Stage` / `Diagnostics` pageは公開しない。
- Runtime Export loadとInput Source connectionは独立しており、Runtime Export未ロードでもiFacialMocap接続・diagnostics確認は可能。
- Debug UIは必要だが、通常UXでは折りたたむ。
- Stage Live Mappingはmain-owned sanitized parameter frameとStage runtime-core evaluationで実装済み。Stageはmodel-onlyを維持する。
- Wave6 Body Follow v0はmain-owned sanitized parameter frameとしてBody X/Zを出力する。Stageはraw tracking/head-position/debug body dataを受け取らない。
- Startup時の前回Runtime Export自動復元はfuture扱い。現行実装では手動Open Runtime Exportが主導線。

## Next Questions

1. Persistent Model Mapping Profileの保存形式、保存場所、Runtime Export fingerprint。
2. Dedicated Model / Stage / Diagnostics pagesをどのwaveで実体化するか。
3. Head rotationの軸符号を実機range dataでどう確定・調整するか。
4. Stage Windowの位置・サイズ・always-on-top・クリック透過をどこまで扱うか。
5. head-position Stage Motion、near/far distance response、Broadcast/OBS UXをどのwaveで扱うか。
