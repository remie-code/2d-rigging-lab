# Runtime Player Screens Map

> Runtime Player / Capture Host appの画面責務とUX設計メモ。

## Files

| Path | Status | Content |
|---|---|---|
| [initial-runtime-player-screen.md](initial-runtime-player-screen.md) | Updated / Wave6 current UX facts | Runtime Export未ロードでもInput Source接続できる現行画面体験、Control/Stage分離、Loaded/Live状態、Wave6 Body Follow v0 |
| [control-window-screen-structure.md](control-window-screen-structure.md) | Updated / Wave11 current UX facts | Header + `Overview` / `Input` / `Mapping` / `Stage` の実装済みControl構成。Stage pageはStage Motion、Browser Source Output、Local Preview / Fallbackを扱う |
| [tracking-setup-live-mapping.md](tracking-setup-live-mapping.md) | Updated / Wave11 current UX facts | Input Profile、Look Forward、Guided Calibration v0、head position left/right + near/far calibration、Auto Mapping v0 + Body X/Z、Stage Live Confirmation、Model Mapping Profile auto-save/restore、separate Window State、Runtime Export startup restore、Stage Motion boundary |
| [broadcast-stage-setup-v0.md](broadcast-stage-setup-v0.md) | Updated / Wave11 Stage Motion baseline | Wave8 native Stage setup controlsはlocal preview/fallbackへ demoted。Wave10後のBrowser Source Outputはfixed primary broadcast pathで、Browser Source接続中はnative local preview live renderingだけをsuspendする。Wave11 Stage Motion composed transformもBrowser Sourceへ届く |
| [browser-source-output-probe-v0.md](browser-source-output-probe-v0.md) | Implemented through Wave10 source/tests; manual OBS product-confidence checks pending | Browser Source Output screen, loopback URL, token/diagnostics boundaries, model-only Browser Source Stage client, Wave10 suspension/sampling/resync facts, and post-Wave10 manual OBS checklist |
| [stage-motion-head-position-follow.md](stage-motion-head-position-follow.md) | Implemented through Wave11 source/tests/review; manual tuning pending | Head position由来のStage-level horizontal offset / explicit near/far depth scale offset、dead zone、reaction、limit、Window State auto-save、Browser Source composed transform境界 |
| [live-controller-page.md](live-controller-page.md) | Draft / accepted UX direction before implementation planning | 配信中の即時操作を集めるControl Window新ページ案。Variant切替、Look Forward、Stage Motion quick toggle、Center Model、Browser Source mini statusを扱い、Runtime ExportのVariant対応調査を次の前提にする |

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
- Wave11 Stage pageはStage Motion panelを持つ。Stage MotionはMapping pageではなく、Stage-level display transformである。
- Browser Source client接続中はnative local preview live renderingだけをsuspendする。Browser Source rendering、input processing、mapping、body follow、dynamics、Runtime Export state、Stage transform sync、Stage Motionはactiveのまま維持する。
- Browser Source OutputはRuntime Playerのloopback URL、server/client/renderer diagnostics、WebGL2 status、heartbeat、sampled live frame state、local preview suspension statusを表示する。ただしOBS capture/streaming readyは主張しない。
- Control-facing live-frame statusとrepeated renderer diagnosticsはsampleされるが、server/client/export/renderの重要transitionは即時に見える。
- Browser Source Runtime Export resyncは同一payload適用をde-duplicateし、replacement payload、reload、reconnectを維持する。
- Stage Motion / Head Position Follow is implemented: manual Stage pan/zoom remains the base transform, calibrated head position adds transient horizontal/scale offsets, settings auto-save in Window State, and current live offsets are not saved.
- Browser Source receives the sanitized composed Stage transform for Stage Motion and no raw tracking/debug/calibration data.
- Live Controller is the accepted direction for future broadcast-time quick operations. It should be a new Control Window page, not a separate window and not an overloaded Overview. Runtime Export Variant capability must be inventoried before implementation planning.
- Spout2、obs-websocket、automatic OBS source creation、automatic OBS capture verificationはout of scope: [../research/broadcast-capture-paths.md](../research/broadcast-capture-paths.md)。
- Startup時の前回Runtime Export自動復元はWave8で実装済み。Input Source auto-connectはしない。
- click-throughは起動時Offで、永続保存しない。always-on-topはdefault OffでWindow Stateへ保存する。

## Next Questions

1. Wave11 Stage Motionのleft/right方向、near/far scale方向、strength/limit/dead-zone/reaction defaultsを実機とOBS Browser Sourceでどう調整するか。
2. Dedicated Model / Diagnostics pagesをどのwaveで実体化するか。
3. post-Wave11 manual OBS Browser Source checklistで、Browser Source Output表示、Stage Motion parity、local preview suspension/resume、diagnostic sampling、resync、OBS setup guidanceが過剰または不足していないかを確認する。
4. Head rotationの軸符号を実機range dataでどう確定・調整するか。
5. Native Stage Windowのmanual Electron verificationをlocal preview/fallback観点で実行する。
6. Spout2 feasibilityを扱うかどうかは、Browser Source manual probeのcritical failure後に判断する。
7. Runtime ExportがLive ControllerのVariant switchingに必要なVariant groups、membership、default active selection、base visibilityを保持しているか確認する。
