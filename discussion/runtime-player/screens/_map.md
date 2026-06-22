# Runtime Player Screens Map

> Runtime Player / Capture Host appの画面責務とUX設計メモ。

## Files

| Path | Status | Content |
|---|---|---|
| [initial-runtime-player-screen.md](initial-runtime-player-screen.md) | Updated / current UX facts | Runtime Export未ロードでもInput Source接続できる現行画面体験、Control/Stage分離、Loaded/Live状態 |
| [control-window-screen-structure.md](control-window-screen-structure.md) | Draft / screen structure | 1枚の縦積み設定画面から、Header + Left nav + Overview/Input/Model/Mapping/Stage/Diagnosticsへ分割する画面構成 |
| [tracking-setup-live-mapping.md](tracking-setup-live-mapping.md) | Draft / next UX direction | Input Profile、Look Forward、Auto Mapping、Model Mapping Profile、Live Confirmationの次Wave向けUX |

## Current Screen Principles

- Runtime PlayerはEditorではなく、完成モデルをtracking inputでライブ表示するアプリである。
- 主画面はClean Stageであり、Parameter一覧、Mesh、Deformer、Editor treeは通常表示しない。
- Stage WindowとControl Windowを分離する。Stage Windowはtransparentでmodel only、Control WindowはRuntime Export、tracking input、calibration、mapping、display setupを扱う。
- Control Windowは1枚の縦積み設定画面ではなく、Header + left navigation + responsibility pagesで構成する。
- Runtime Export loadとInput Source connectionは独立しており、Runtime Export未ロードでもiFacialMocap接続・diagnostics確認は可能。
- Debug UIは必要だが、通常UXでは折りたたむ。
- Startup時の前回Runtime Export自動復元はfuture扱い。現行実装では手動Open Runtime Exportが主導線。

## Next Questions

1. Input Profile / Model Mapping Profileの保存形式と保存場所。
2. Runtime Export fingerprintを何で決めるか。
3. Gaze X/Yはeye Eulerを優先するか、`eyeLook*` blendshapeを優先するか。
4. Head rotationの軸符号を実機range dataでどう確定するか。
5. Stage Windowの位置・サイズ・always-on-top・クリック透過をどこまでv0で扱うか。
6. Calibration guided sub-screenをpage / drawer / modalのどれで扱うか。
