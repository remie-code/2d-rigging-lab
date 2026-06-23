# Runtime Player Screens Map

> Runtime Player / Capture Host appの画面責務とUX設計メモ。

## Files

| Path | Status | Content |
|---|---|---|
| [initial-runtime-player-screen.md](initial-runtime-player-screen.md) | Updated / Wave6 current UX facts | Runtime Export未ロードでもInput Source接続できる現行画面体験、Control/Stage分離、Loaded/Live状態、Wave6 Body Follow v0 |
| [control-window-screen-structure.md](control-window-screen-structure.md) | Updated / Wave10 current UX facts | Header + `Overview` / `Input` / `Mapping` / `Stage` の実装済みControl構成。Browser Source OutputとLocal Preview / Fallbackの最新責務は専用screen docsを読む |
| [tracking-setup-live-mapping.md](tracking-setup-live-mapping.md) | Updated / Wave10 current UX facts | Input Profile、Look Forward、Guided Calibration v0、head position calibration、Auto Mapping v0 + Body X/Z、Stage Live Confirmation、Model Mapping Profile auto-save/restore、separate Window State、Runtime Export startup restore、Stage local preview/fallback controls |
| [broadcast-stage-setup-v0.md](broadcast-stage-setup-v0.md) | Updated / Wave10 performance baseline | Wave8 native Stage setup controlsはlocal preview/fallbackへ demoted。Wave10後のBrowser Source Outputはfixed primary broadcast pathで、Browser Source接続中はnative local preview live renderingだけをsuspendする |
| [browser-source-output-probe-v0.md](browser-source-output-probe-v0.md) | Implemented through Wave10 source/tests; manual OBS product-confidence checks pending | Browser Source Output screen, loopback URL, token/diagnostics boundaries, model-only Browser Source Stage client, Wave10 suspension/sampling/resync facts, and post-Wave10 manual OBS checklist |

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
- Wave7 Stage page v0はStage Window bounds、Stage view pan/zoom、Focus Stage、Reset View、Center Model、window-state自動保存状態を扱う。Wave8 Stage pageはさらにnative Stage setup controls、Runtime Export startup restore statusを扱う。
- Wave10後のStage pageでは`Browser Source Output`がfixed primary broadcast pathであり、Wave8のnative Stage Window capture controlsは`Local Preview / Fallback`として残る。
- Browser Source client接続中はnative local preview live renderingだけをsuspendする。Browser Source rendering、input processing、mapping、body follow、dynamics、Runtime Export state、Stage transform syncはactiveのまま維持する。
- Browser Source OutputはRuntime Playerのloopback URL、server/client/renderer diagnostics、WebGL2 status、heartbeat、sampled live frame state、local preview suspension statusを表示する。ただしOBS capture/streaming readyは主張しない。
- Control-facing live-frame statusとrepeated renderer diagnosticsはsampleされるが、server/client/export/renderの重要transitionは即時に見える。
- Browser Source Runtime Export resyncは同一payload適用をde-duplicateし、replacement payload、reload、reconnectを維持する。
- Spout2、obs-websocket、automatic OBS source creation、automatic OBS capture verificationはout of scope: [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)。
- Startup時の前回Runtime Export自動復元はWave8で実装済み。Input Source auto-connectはしない。
- click-throughは起動時Offで、永続保存しない。always-on-topはdefault OffでWindow Stateへ保存する。

## Next Questions

1. Dedicated Model / Diagnostics pagesをどのwaveで実体化するか。
2. post-Wave10 manual OBS Browser Source checklistで、Browser Source Output表示、local preview suspension/resume、diagnostic sampling、resync、OBS setup guidanceが過剰または不足していないかを確認する。
3. Head rotationの軸符号を実機range dataでどう確定・調整するか。
4. Native Stage Windowのmanual Electron verificationをlocal preview/fallback観点で実行する。
5. Spout2 feasibilityを扱うかどうかは、Browser Source manual probeのcritical failure後に判断する。
